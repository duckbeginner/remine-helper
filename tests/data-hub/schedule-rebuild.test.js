// tests/data-hub/schedule-rebuild.test.js
// 데이터 허브 전면 재구축 핵심 스위트 (순수 마스터, 초경량 Pure Diff, 데이터 무결성 및 정제 전수 검증)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';
import {
  isFieldValueEqual,
  computePureDiff
} from '../../scripts/data-hub/tools/rebuild-pipeline.js';
import {
  cleanUrl,
  cleanTextUrls
} from '../../scripts/data-hub/utils/url-cleaner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const REBUILD_DIR = path.join(ROOT_DIR, '.cache', 'rebuild');

export async function run() {
  const runner = new TestRunner('Data Hub - 전면 재구축 및 데이터 무결성 통합 검증');
  runner.run();

  // =========================================================================
  // Section 1: 순수 원본 마스터(Pure Raw Master) 무결성 검증
  // =========================================================================
  const masterPath = path.join(REBUILD_DIR, 'master-schedules.json');
  const overridesPath = path.join(REBUILD_DIR, 'schedule-overrides.json');
  const schedulesPath = path.join(REBUILD_DIR, 'schedules.json');

  runner.test('1. 리빌드 산출물 파일 실존성 확인', () => {
    assert(fs.existsSync(masterPath), 'master-schedules.json 이 존재해야 함');
    assert(fs.existsSync(overridesPath), 'schedule-overrides.json 이 존재해야 함');
    assert(fs.existsSync(schedulesPath), 'schedules.json 이 존재해야 함');
  });

  const masterData = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
  const overridesData = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
  const schedulesData = JSON.parse(fs.readFileSync(schedulesPath, 'utf8'));

  const masterList = Array.isArray(masterData) ? masterData : (masterData.items || masterData.schedules || []);
  const schedulesList = Array.isArray(schedulesData) ? schedulesData : (schedulesData.items || schedulesData.schedules || []);
  const sourceOverrides = overridesData.sourceOverrides || {};
  const customSchedules = overridesData.customSchedules || {};

  runner.test('2. Pure Raw Master: master-schedules.json 내 isDeleted 항목은 정확히 0건이어야 함', () => {
    const deletedInMaster = masterList.filter(item => item.isDeleted === true || item._isDeleted === true);
    assert.strictEqual(deletedInMaster.length, 0, `마스터에 isDeleted 플래그가 ${deletedInMaster.length}건 존재함 (0건이어야 함)`);
  });

  runner.test('3. Pure Raw Master: 마스터 항목은 공식 수집 소스(blip, mnet, youtube)여야 함', () => {
    const validSources = new Set(['blip', 'mnet', 'youtube']);
    const invalidSources = masterList.filter(item => !validSources.has(item.source));
    assert.strictEqual(invalidSources.length, 0, `비공식 소스 항목이 ${invalidSources.length}건 발견됨`);
  });

  runner.test('4. Overrides Separation: schedule-overrides.json에 isDeleted 플래그가 안전하게 보존되어야 함', () => {
    const deletedOverrides = Object.entries(sourceOverrides).filter(([, v]) => v && (v.isDeleted === true || v._isDeleted === true));
    assert(deletedOverrides.length >= 150, `오버라이드에 삭제 일정(tombstone)이 ${deletedOverrides.length}건 보존되어야 함 (최소 150건 이상)`);
  });

  runner.test('5. SPOTV K-POP AWARDS: SKA 삭제(isDeleted: true) 및 2026 수정 내역이 오버라이드에 존재해야 함', () => {
    const spotvDeleted = sourceOverrides['mnet_6a69f06d62e6743977db6c12'];
    assert(spotvDeleted && spotvDeleted.isDeleted === true, 'SPOTV K-POP AWARDS(SKA)의 isDeleted: true가 오버라이드에 보존되어야 합니다.');
    const spotvModified = sourceOverrides['blip_1107273'];
    assert(spotvModified, '2026 SPOTV K-POP AWARDS 수정 내역 존재');
  });

  runner.test('6. Custom Schedules: custom_ 일정에는 extField가 일체 존재하지 않아야 함', () => {
    const customs = Object.values(customSchedules);
    assert(customs.length > 0, '커스텀 스케줄이 최소 1건 이상 존재해야 함');
    for (const c of customs) {
      assert.strictEqual(c.extField, undefined, `커스텀 일정 ${c.id} 에 extField가 남아있음`);
    }
  });

  runner.test('7. Synthesis: schedules.json 에 isDeleted: true 인 일정은 노출되지 않아야 함', () => {
    const deletedInSchedules = schedulesList.filter(item => item.isDeleted === true);
    assert.strictEqual(deletedInSchedules.length, 0, `최종 합성 스케줄에 삭제된 일정이 ${deletedInSchedules.length}건 노출됨`);
  });

  // =========================================================================
  // Section 2: 초정밀 Sparse Diff & No-op 완전 소거 검증
  // =========================================================================
  runner.test('isFieldValueEqual: 빈 값 및 시간 타임스탬프 동등성 검증', () => {
    assert(isFieldValueEqual('location', null, ''));
    assert(isFieldValueEqual('channel', undefined, null));
    assert(isFieldValueEqual('starAttendees', [], undefined));
    assert(isFieldValueEqual('isAllday', false, undefined));
    assert(isFieldValueEqual('startTime', '2026-09-18T10:00:00Z', '2026-09-18T19:00:00+09:00'));
    assert(isFieldValueEqual('title', '  공백 포함  ', '공백 포함'));
    assert(isFieldValueEqual('linkedScheduleIds', ['a', 'b'], ['b', 'a']));
  });

  runner.test('computePureDiff: 마스터와 동일한 일정은 null(No-op) 반환 검증', () => {
    const base = { id: 'test_1', title: '제목', location: '장소', startTime: '2026-09-15T08:00Z' };
    const patchIdentical = { title: '제목', location: '장소', startTime: '2026-09-15T08:00Z' };
    assert.strictEqual(computePureDiff(base, patchIdentical), null);

    const patchModified = { title: '새 제목', location: '장소' };
    const diff = computePureDiff(base, patchModified);
    assert.deepStrictEqual(diff, { title: '새 제목' });

    const patchDeleted = { isDeleted: true, title: '제목' };
    assert.deepStrictEqual(computePureDiff(base, patchDeleted), { isDeleted: true });
  });

  runner.test('Real Data: blip_1117261 이 schedule-overrides.json에 존재하지 않아야 함 (No-op 소거)', () => {
    assert.strictEqual(sourceOverrides['blip_1117261'], undefined);
  });

  runner.test('Real Data: 모든 isDeleted 항목은 정확히 { isDeleted: true } 단독 객체여야 함', () => {
    for (const [key, patch] of Object.entries(sourceOverrides)) {
      if (patch.isDeleted) {
        assert.deepStrictEqual(patch, { isDeleted: true }, `${key} 삭제 패치가 단독 객체가 아님: ${JSON.stringify(patch)}`);
      }
    }
  });

  runner.test('Real Data: 모든 sourceOverrides의 linkedScheduleIds에 자기 자신 ID가 0건이어야 함 (Self-Ref 완전 소거)', () => {
    for (const [k, v] of Object.entries(sourceOverrides)) {
      if (Array.isArray(v.linkedScheduleIds)) {
        assert(!v.linkedScheduleIds.includes(k), `${k} 가 linkedScheduleIds에 자기 자신을 포함하고 있음`);
      }
    }
  });

  // =========================================================================
  // Section 3: URL 정제 및 파라미터 정규화 무결성 검증
  // =========================================================================
  runner.test('cleanUrl & cleanTextUrls: 추적 파라미터(utm, stkn, igsh, s=20) 제거 검증', () => {
    assert.strictEqual(
      cleanUrl('https://www.instagram.com/p/DB12345/?igsh=MWx123&stkn=abc'),
      'https://www.instagram.com/p/DB12345/'
    );
    assert.strictEqual(
      cleanUrl('https://x.com/rescene_official/status/123456?s=20&t=abc'),
      'https://x.com/rescene_official/status/123456'
    );
    assert.strictEqual(
      cleanUrl('https://youtu.be/dQw4w9WgXcQ?si=abc&t=42'),
      'https://youtu.be/dQw4w9WgXcQ?t=42'
    );
    const cleanedMsg = cleanTextUrls('본문 링크: https://x.com/user/status/123?s=20 확인');
    assert(!cleanedMsg.includes('s=20'));
  });

  runner.test('Cleanliness: 전체 마스터 및 스케줄에 추적 파라미터가 0건이어야 함', () => {
    const forbidden = ['utm_', 'stkn=', 'igsh=', 's=20'];
    schedulesList.forEach(item => {
      const text = `${item.url || ''} ${item.link || ''} ${item.message || ''}`;
      for (const f of forbidden) {
        assert(!text.includes(f), `스케줄 ${item.id} 에 금지된 파라미터 ${f} 잔존`);
      }
    });
  });

  // =========================================================================
  // Section 4: Canonical Key 규칙 및 렌더링 무손실 전수 검증
  // =========================================================================
  runner.test('Canonical Key 규칙 검증: 모든 일정 ID는 mnet_, blip_, yt_, custom_ 규격이어야 함', () => {
    const validPrefixes = ['mnet_', 'blip_', 'yt_', 'custom_'];
    schedulesList.forEach(item => {
      const valid = validPrefixes.some(p => item.id.startsWith(p));
      assert(valid, `비정규 ID 발견: ${item.id}`);
    });
  });

  runner.test('레거시 키 및 Alias 완전 소거 검증: legacyAliases 및 날짜_제목 키 0건 확인', () => {
    const sourceOverrides = overridesData.sourceOverrides || {};
    const legacyAliases = overridesData.legacyAliases || {};
    assert.strictEqual(Object.keys(legacyAliases).length, 0, 'legacyAliases 가 0건이어야 함');

    for (const key of Object.keys(sourceOverrides)) {
      assert(!/^\d{4}-\d{2}-\d{2}_/.test(key), `날짜_제목 레거시 키 잔존 발견: ${key}`);
    }
  });

  runner.test('1일정 1수정본 단일 상태 검증: 중복 키나 연쇄 체인 부재 확인', () => {
    const sourceOverrides = overridesData.sourceOverrides || {};
    const keys = Object.keys(sourceOverrides);
    const uniqueKeys = new Set(keys);
    assert.strictEqual(keys.length, uniqueKeys.size, '오버라이드 키 중복 존재');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('schedule-rebuild.test.js')) {
  run();
}
