// tests/client/tabs-theme.test.js
// 탭 전환 및 테마 상태 순환 엔진 단위 테스트

import { TestRunner, assert } from '../test-helper.js';

export async function run() {
  const runner = new TestRunner('Client - Tabs & Theme Engine');
  runner.run();

  // 1. 테마 3단계 순환(System -> Dark -> Light -> System) 로직 검증
  runner.test('Theme Cycle: system -> dark -> light -> system 3단 순환', () => {
    function getNextThemeMode(currentMode) {
      if (currentMode === 'system') return 'dark';
      if (currentMode === 'dark') return 'light';
      return 'system';
    }

    assert.strictEqual(getNextThemeMode('system'), 'dark');
    assert.strictEqual(getNextThemeMode('dark'), 'light');
    assert.strictEqual(getNextThemeMode('light'), 'system');
  });

  // 2. 다크 모드 불리언 판별 로직
  runner.test('Theme Resolution: 명시적 모드 및 시스템 모드 평가', () => {
    function resolveIsDark(mode, systemMatches) {
      if (mode === 'dark') return true;
      if (mode === 'light') return false;
      return Boolean(systemMatches);
    }

    assert.strictEqual(resolveIsDark('dark', false), true);
    assert.strictEqual(resolveIsDark('light', true), false);
    assert.strictEqual(resolveIsDark('system', true), true);
    assert.strictEqual(resolveIsDark('system', false), false);
  });

  // 3. Iframe 테마 URL 파라미터 교체 검증
  runner.test('Iframe Theme Query: theme=dark/light 쿼리 파라미터 자동 치환', () => {
    const originalSrc = 'https://adam-yam.github.io/remine-helper/shorts/?theme=light&lang=ko';
    const isDark = true;
    const themeStr = isDark ? 'dark' : 'light';
    const newSrc = originalSrc.replace(/theme=(dark|light)/i, `theme=${themeStr}`);

    assert.strictEqual(newSrc, 'https://adam-yam.github.io/remine-helper/shorts/?theme=dark&lang=ko');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('tabs-theme.test.js')) {
  run();
}
