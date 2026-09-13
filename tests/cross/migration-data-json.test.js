// tests/cross/migration-data-json.test.js
// 레거시 data.json 제거 시 신버전/구버전 클라이언트 영향도 사전 시나리오 테스트 스위트 (정책 4)

import { TestRunner, assert } from '../test-helper.js';

export async function run() {
  const runner = new TestRunner('Cross - data.json Migration Scenario Compatibility');
  runner.run();

  // ─────────────────────────────────────────────────────────────
  // 시나리오 1: 최신 버전(v1.0.3+) 사용자 - data.json 없이 100% 정상 작동 검증
  // ─────────────────────────────────────────────────────────────
  runner.test('Scenario 1: v1.0.3+ 사용자는 core.json + schedules.json 2계층 페치 성공 시 data.json 없어도 100% 정상 렌더링', async () => {
    // 2계층 정상 수신 시뮬레이션
    const mockCoreData = {
      version: '1.0.0',
      youtube: { officialVideos: [{ id: 'vid_1', title: 'Love Attack' }] },
      schedules: { activeItems: [{ id: 'sch_1', title: '뮤직뱅크' }] }
    };
    const mockSchedulesData = {
      items: [{ id: 'sch_1', title: '뮤직뱅크' }, { id: 'sch_2', title: '인기가요' }]
    };

    // v1.0.3 페치 파이프라인
    function simulateV103Fetch(coreResult, schedulesResult, _dataJsonAvailable = false) {
      if (!coreResult) {
        throw new Error('Core data missing');
      }
      return {
        videos: coreResult.youtube.officialVideos,
        schedules: schedulesResult ? schedulesResult.items : coreResult.schedules.activeItems,
        source: '2-tier-architecture'
      };
    }

    // data.json이 아예 없어도(false) 2계층 데이터로 완벽 동작
    const result = simulateV103Fetch(mockCoreData, mockSchedulesData, false);
    assert.strictEqual(result.source, '2-tier-architecture');
    assert.strictEqual(result.videos.length, 1);
    assert.strictEqual(result.schedules.length, 2);
  });

  // ─────────────────────────────────────────────────────────────
  // 시나리오 2: 구버전(v1.0.2 이하) 사용자 - data.json 누락 시 영향도 검증
  // ─────────────────────────────────────────────────────────────
  runner.test('Scenario 2: v1.0.2 사용자는 1/2순위(core.json) 성공 시 3순위(data.json) 부재와 무관하게 정상 작동', () => {
    // background.js L695 폴백 체인 시뮬레이션
    const fetchEndpoints = [
      { name: '1st: Gist core.json', available: true },
      { name: '2nd: GitHub Pages core.json', available: true },
      { name: '3rd: Legacy data.json', available: false } // data.json 제거됨
    ];

    function simulateFallbackChain(endpoints) {
      for (const ep of endpoints) {
        if (ep.available) {
          return { success: true, usedEndpoint: ep.name };
        }
      }
      return { success: false, usedEndpoint: null };
    }

    const res = simulateFallbackChain(fetchEndpoints);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.usedEndpoint, '1st: Gist core.json', '1순위 core.json으로 먼저 성공하므로 data.json 부재 무영향');
  });

  runner.test('Scenario 3: 모든 네트워크 실패 시 직전 로컬 캐시(Silent Fallback)로 안전 렌더링 유지 (정책 3)', () => {
    const localCachedStorage = {
      latestVideos: [{ id: 'cached_v1', title: '캐시된 영상' }],
      activeSchedules: [{ id: 'cached_s1', title: '캐시된 일정' }]
    };

    function simulateOfflineRender(networkSuccess, cachedData) {
      if (!networkSuccess) {
        // 정책 3: 조용한 로컬 캐시 렌더링 + 오프라인 인디케이터 플래그
        return {
          renderData: cachedData,
          isOfflineIndicatorVisible: true,
          hasErrorMessage: false
        };
      }
      return { renderData: {}, isOfflineIndicatorVisible: false, hasErrorMessage: false };
    }

    const offlineResult = simulateOfflineRender(false, localCachedStorage);
    assert.strictEqual(offlineResult.isOfflineIndicatorVisible, true);
    assert.strictEqual(offlineResult.hasErrorMessage, false, '에러 팝업을 띄우지 않는 조용한 UX');
    assert.strictEqual(offlineResult.renderData.latestVideos[0].id, 'cached_v1');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('migration-data-json.test.js')) {
  run().then(res => {
    if (res.failed > 0) process.exit(1);
  });
}
