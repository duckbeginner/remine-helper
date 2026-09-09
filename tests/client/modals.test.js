// tests/client/modals.test.js
// 모달 및 설정 파서 단위 테스트

import { TestRunner, assert } from '../test-helper.js';
import {
  parseUserSettings,
  decodeHtmlEntities,
  linkifyMessage
} from '../../remine-helper/common/modules/modals.js';
import { DEFAULT_USER_SETTINGS } from '../../remine-helper/constants.js';

export async function run() {
  const runner = new TestRunner('Client - Modals & Settings Module');
  runner.run();

  // 1. parseUserSettings
  runner.test('parseUserSettings: 빈 값이 주어졌을 때 완벽한 기본값 복제 반환', () => {
    const settings = parseUserSettings(null);
    assert.strictEqual(settings.refreshInterval, DEFAULT_USER_SETTINGS.refreshInterval);
    assert.strictEqual(settings.navPosition, DEFAULT_USER_SETTINGS.navPosition);
    assert.strictEqual(settings.notifications.live, true);
    assert.strictEqual(settings.tabList.length, DEFAULT_USER_SETTINGS.tabList.length);
  });

  runner.test('parseUserSettings: 사용자 설정과 기본값 딥 머지 (신규 키 보존)', () => {
    const custom = {
      refreshInterval: 10,
      notifications: { live: false }, // video/schedule는 누락됨
      tabList: [{ id: 'home', visible: true }] // 나머지 탭 누락됨
    };
    const merged = parseUserSettings(custom);
    assert.strictEqual(merged.refreshInterval, 10);
    assert.strictEqual(merged.notifications.live, false);
    // 누락된 기본 알림 키가 보존되었는지 검증
    assert.strictEqual(merged.notifications.video, DEFAULT_USER_SETTINGS.notifications.video);
    // 누락된 기본 탭들이 뒤에 유지되는지 검증
    assert(merged.tabList.length >= DEFAULT_USER_SETTINGS.tabList.length);
  });

  // 2. decodeHtmlEntities
  runner.test('decodeHtmlEntities: 주요 HTML 특수 엔티티 변환', () => {
    const raw = '&lt;RESCENE&gt; &amp; &quot;Love Attack&quot; &#39;Woni&#39;';
    const decoded = decodeHtmlEntities(raw);
    assert.strictEqual(decoded, '<RESCENE> & "Love Attack" \'Woni\'');
  });

  runner.test('decodeHtmlEntities: 빈 값 및 안전 폴백', () => {
    assert.strictEqual(decodeHtmlEntities(''), '');
    assert.strictEqual(decodeHtmlEntities(null), '');
  });

  // 3. linkifyMessage
  runner.test('linkifyMessage: URL 자동 하이퍼링크 및 이모지 변환', () => {
    const msg = '생방송 바로가기 https://youtube.com/live/12345 확인 부탁드립니다.';
    const formatted = linkifyMessage(msg);
    assert(formatted.includes('href="https://youtube.com/live/12345"'));
    assert(formatted.includes('관련 링크'));
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('modals.test.js')) {
  run();
}
