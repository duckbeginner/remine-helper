// tests/data-hub/pure-raw-master.test.js
// 프로덕션 경로 일치성(Production Parity) 기반 순수 마스터(Pure Raw Master) 무결성 전수 검증 스위트

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';
import { mergeSchedulesV2 } from '../../scripts/data-hub/collectors/schedule.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const LIVE_MASTER_PATH = path.join(ROOT_DIR, 'docs/api/v1/master-schedules.json');

export async function run() {
  const runner = new TestRunner('Data Hub - Pure Raw Master 프로덕션 일치성 검증');
  runner.run();

  // =========================================================================
  // Section 1: 실제 프로덕션 docs/api/v1/master-schedules.json 정밀 전수 검증
  // =========================================================================

  runner.test('1. 프로덕션 마스터 파일 실존성 및 최소 건수 하한선(500건) 충족', () => {
    assert(fs.existsSync(LIVE_MASTER_PATH), 'docs/api/v1/master-schedules.json 파일이 존재해야 합니다.');
    const data = JSON.parse(fs.readFileSync(LIVE_MASTER_PATH, 'utf8'));
    const items = data.items || data;
    assert(Array.isArray(items), 'items 배열이 존재해야 합니다.');
    assert(items.length >= 1000, `프로덕션 마스터는 최소 1000건 이상이어야 합니다. (현재: ${items.length}건)`);
  });

  const masterData = JSON.parse(fs.readFileSync(LIVE_MASTER_PATH, 'utf8'));
  const masterItems = masterData.items || masterData;

  runner.test('2. Pure Raw Master: 프로덕션 마스터 내 linkedScheduleIds 속성은 영구히 0건이어야 함 (빈 배열 포함 일체 불허 - DEF-04)', () => {
    const withLinks = masterItems.filter(item => item.linkedScheduleIds !== undefined);
    assert.strictEqual(withLinks.length, 0, `마스터에 linkedScheduleIds 속성이 ${withLinks.length}건 잔존 (0건이어야 함)`);
  });

  runner.test('3. Pure Raw Master: 프로덕션 마스터 내 isDeleted / _isDeleted / _isModified 속성은 영구히 0건이어야 함 (DEF-04)', () => {
    const withDeleted = masterItems.filter(item => 'isDeleted' in item || '_isDeleted' in item || '_isModified' in item);
    assert.strictEqual(withDeleted.length, 0, `마스터에 삭제/수정 플래그가 ${withDeleted.length}건 잔존 (0건이어야 함)`);
  });

  runner.test('4. Pure Raw Master: 프로덕션 마스터 내 custom_ 일정 및 _isCustom은 정확히 0건이어야 함 (customSchedules와 분리 - DEF-04)', () => {
    const withCustom = masterItems.filter(item => (item.id && String(item.id).startsWith('custom_')) || item._isCustom === true);
    assert.strictEqual(withCustom.length, 0, `마스터에 custom_ 일정이 ${withCustom.length}건 유입됨 (0건이어야 함)`);
  });

  runner.test('5. Pure Raw Master: 프로덕션 마스터 항목은 100% 공식 수집 소스(blip, mnet, youtube)여야 함', () => {
    const validSources = new Set(['blip', 'mnet', 'youtube']);
    const invalidSources = masterItems.filter(item => !validSources.has(item.source));
    assert.strictEqual(invalidSources.length, 0, `마스터에 비공식 소스 항목이 ${invalidSources.length}건 존재함`);
  });

  // =========================================================================
  // Section 2: mergeSchedulesV2 런타임 수집 시 마스터 순수성 불변 보증
  // =========================================================================

  runner.test('6. mergeSchedulesV2: 오버라이드에 링크 및 삭제가 있어도 masterItems에는 100% 미반영 순수 원본 유지', () => {
    const mockRawItems = [
      { id: 'blip_1001', title: '원래 블립 일정', startTime: '2026-10-01T10:00Z', source: 'blip' },
      { id: 'mnet_2002', title: '원래 엠넷 일정', startTime: '2026-10-01T10:00Z', source: 'mnet' }
    ];

    const mockOverrides = {
      sourceOverrides: {
        'blip_1001': {
          title: '오버라이드된 제목',
          linkedScheduleIds: ['mnet_2002']
        },
        'mnet_2002': {
          isDeleted: true
        }
      },
      customSchedules: {
        'custom_9999': {
          id: 'custom_9999',
          title: '커스텀 일정',
          startTime: '2026-10-02T10:00Z'
        }
      }
    };

    const result = mergeSchedulesV2(mockRawItems, mockOverrides);
    const masterResult = result.masterItems || [];

    // 1) 배포본(result)에는 오버라이드가 반영되어 있어야 함
    const activeBlip = result.find(it => it.id === 'blip_1001');
    assert(activeBlip, '배포본에 blip_1001 존재');
    assert.strictEqual(activeBlip.title, '오버라이드된 제목', '배포본에 수정된 제목 반영');
    const activeMnet = result.find(it => it.id === 'mnet_2002');
    assert.strictEqual(activeMnet, undefined, '배포본에서 삭제된 mnet_2002는 배제되어야 함');

    // 2) 마스터(masterResult)에는 오버라이드가 일체 반영되지 않은 순수 원본이어야 함
    const masterBlip = masterResult.find(it => it.id === 'blip_1001');
    assert(masterBlip, '마스터에 blip_1001 존재');
    assert.strictEqual(masterBlip.title, '원래 블립 일정', '마스터에는 원본 제목이 보존되어야 함 (오버라이드 미반영)');
    assert.strictEqual(masterBlip.linkedScheduleIds, undefined, '마스터에는 linkedScheduleIds가 없어야 함');

    const masterMnet = masterResult.find(it => it.id === 'mnet_2002');
    assert(masterMnet, '마스터에는 삭제된 mnet_2002도 아카이브로 보존되어야 함');
    assert.strictEqual(masterMnet.isDeleted, undefined, '마스터에는 isDeleted 플래그가 없어야 함');

    const masterCustom = masterResult.find(it => it.id === 'custom_9999');
    assert.strictEqual(masterCustom, undefined, '마스터에는 custom_ 일정이 일체 수록되지 않아야 함');
  });

  return runner.summary();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const res = await run();
  process.exit(res.isSuccess ? 0 : 1);
}
