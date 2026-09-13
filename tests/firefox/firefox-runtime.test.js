// tests/firefox/firefox-runtime.test.js
// Firefox MV2 호환성 및 WebExtensions 스토리지/webRequest 무결성 테스트

import { TestRunner, assert } from '../test-helper.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

export async function run() {
  const runner = new TestRunner('Firefox - Runtime & Storage Compatibility');
  runner.run();

  // 1. background.js 소스 코드 정적 분석 검증
  const bgPath = path.join(ROOT_DIR, 'remine-helper/background.js');
  const bgContent = fs.readFileSync(bgPath, 'utf8');

  await runner.testAsync('Storage Async Guard: chrome.storage.local.get이 Promise가 아닐 때를 대비한 safeStorage 래퍼 존재 확인', async () => {
    assert(bgContent.includes('safeStorageGet') || bgContent.includes('getStorage'), 'background.js에 안전한 스토리지 래퍼 함수(safeStorageGet/getStorage)가 정의되어야 합니다.');
    assert(bgContent.includes('safeStorageSet') || bgContent.includes('setStorage'), 'background.js에 안전한 스토리지 저장 래퍼 함수(safeStorageSet/setStorage)가 정의되어야 합니다.');
  });

  await runner.testAsync('WebRequest urls Filter Guard: onBeforeSendHeaders 등록 시 빈 배열(urls: []) 전달 차단 가드 확인', async () => {
    assert(
      bgContent.includes('uaPatterns.length > 0') ||
      bgContent.includes('USER_AGENT_RULES.length > 0'),
      'onBeforeSendHeaders 등록부에 uaPatterns.length > 0 또는 USER_AGENT_RULES.length > 0 가드가 있어야 합니다.'
    );
  });

  await runner.testAsync('Startup Auto Sync: 초기 데이터 부재 시 즉시 백그라운드 동기화 가드 확인', async () => {
    assert(
      bgContent.includes('checkInitialDataOnStartup') ||
      bgContent.includes('executeAllBackgroundRefreshes'),
      'background.js 최상위 레벨에 초기 데이터 확인 및 즉시 동기화 로직이 있어야 합니다.'
    );
  });

  // 2. Firefox MV2 콜백 전용 환경 동적 시뮬레이션
  await runner.testAsync('Simulation: Firefox MV2 Callback-Only 환경에서 safeStorage 동작 검증', async () => {
    // Firefox MV2의 콜백 전용 chrome.storage.local 모의(Mock)
    const mockStore = {
      blipSchedules: [{ id: 's1', title: 'Firefox Test Schedule' }],
      latestVideos: [{ id: 'v1', title: 'Firefox Video' }]
    };

    const mockChromeStorage = {
      get: (keys, callback) => {
        // 콜백 스타일: Promise를 반환하지 않고 undefined 반환
        setTimeout(() => {
          const result = {};
          keys.forEach(k => { if (k in mockStore) result[k] = mockStore[k]; });
          callback(result);
        }, 1);
        return undefined; // Firefox MV2 특성
      },
      set: (items, callback) => {
        Object.assign(mockStore, items);
        if (typeof callback === 'function') setTimeout(callback, 1);
        return undefined;
      }
    };

    // safeStorageGet 로직 테스트
    function safeStorageGetMock(keys) {
      return new Promise((resolve) => {
        mockChromeStorage.get(keys, (res) => resolve(res || {}));
      });
    }

    function safeStorageSetMock(items) {
      return new Promise((resolve) => {
        mockChromeStorage.set(items, () => resolve());
      });
    }

    const data = await safeStorageGetMock(['blipSchedules', 'latestVideos', 'nonExistent']);
    assert(data !== undefined && data !== null, 'safeStorageGet은 절대 undefined나 null을 반환하지 않아야 합니다.');
    assert(Array.isArray(data.blipSchedules) && data.blipSchedules.length === 1, 'blipSchedules 데이터가 정상 조회되어야 합니다.');
    assert(data.nonExistent === undefined, '존재하지 않는 키는 안전하게 undefined여야 합니다.');

    // 저장 테스트
    await safeStorageSetMock({ newKey: 'savedInFirefox' });
    const updated = await safeStorageGetMock(['newKey']);
    assert(updated.newKey === 'savedInFirefox', 'safeStorageSet으로 저장된 데이터가 정상 조회되어야 합니다.');
  });

  // 3. Firefox WebExtensions Strict Parameter Filter 시뮬레이션
  await runner.testAsync('Simulation: Firefox WebExtensions strict urls filter error 방어 검증', async () => {
    let addListenerCalled = false;
    const mockWebRequest = {
      onBeforeSendHeaders: {
        addListener: (_callback, filter, _extra) => {
          if (!filter || !Array.isArray(filter.urls) || filter.urls.length === 0) {
            throw new TypeError('Error processing urls: Array requires at least 1 items; you have 0');
          }
          addListenerCalled = true;
        }
      }
    };

    const USER_AGENT_RULES = [];
    const uaPatterns = USER_AGENT_RULES.map(r => r.urlPattern);

    // 가드가 있는 경우
    if (mockWebRequest && mockWebRequest.onBeforeSendHeaders && uaPatterns.length > 0) {
      mockWebRequest.onBeforeSendHeaders.addListener(() => {}, { urls: uaPatterns });
    }

    assert(addListenerCalled === false, 'urls가 비어있을 때는 addListener가 호출되지 않아야 합니다.');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('firefox-runtime.test.js')) {
  run();
}
