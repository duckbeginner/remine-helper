// tests/data-hub/sync-tools.test.js
// Gist 연동 및 마이그레이션 도구 단위 테스트

import { TestRunner, assert } from '../test-helper.js';
import { migrateOverridesV1toV2 } from '../../scripts/data-hub/collectors/schedule.js';

export async function run() {
  const runner = new TestRunner('Data Hub - Sync & Migration Tools');
  runner.run();

  runner.test('migrateOverridesV1toV2: v1.0 형식(customSchedules, deletedList)을 v2.0(sourceOverrides, customItems)으로 정상 변환', () => {
    const v1 = {
      version: "1.0.0",
      created: [
        { title: '신규 팬사인회', startTime: '2026-09-20T14:00:00+09:00' }
      ],
      deleted: ['2026-09-15_구버전삭제일정'],
      modified: {}
    };

    const v2 = migrateOverridesV1toV2(v1, []);
    assert.strictEqual(v2.version, '2.0.0');
    assert(typeof v2.customSchedules === 'object');
    const customKeys = Object.keys(v2.customSchedules);
    assert(customKeys.length >= 1);
    assert.strictEqual(v2.customSchedules[customKeys[0]].title, '신규 팬사인회');
    assert(typeof v2.sourceOverrides === 'object');
    assert(typeof v2.legacyAliases === 'object');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('sync-tools.test.js')) {
  run();
}
