// tests/data-hub/lossless-overrides-restore.test.js
// 과거 일정 수정 내역(184건) 무손실 복원(Lossless Hydration) 및 회귀 방지 전수 검증 스위트

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';
import { restoreLosslessOverrides } from '../../scripts/data-hub/tools/restore-lossless-overrides.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');

const OVERRIDES_FILE = path.join(ROOT_DIR, '.cache/schedule-overrides.json');
const SCHEDULES_FILE = path.join(ROOT_DIR, 'docs/api/v1/schedules.json');

export async function run() {
  const runner = new TestRunner('Data Hub - Lossless Overrides Restore 무손실 복원 검증');
  runner.run();

  // =========================================================================
  // Section 1: restoreLosslessOverrides 순수 함수 알고리즘 검증
  // =========================================================================

  runner.test('1. restoreLosslessOverrides: Rebuild 속성을 손실 없이 복원하고 Current의 최신 보정을 우선 적용', () => {
    const mockRebuild = {
      sourceOverrides: {
        blip_001: {
          title: '복원된 제목',
          message: '복원된 메시지',
          location: '고척돔',
          linkedScheduleIds: ['mnet_002', '2026-09-04_<가상키>']
        },
        mnet_002: {
          location: '상암'
        }
      }
    };

    const mockCurrent = {
      version: '2.0.0',
      sourceOverrides: {
        blip_001: {
          location: '새로운 고척돔', // Current 우선 적용되어야 함
          url: 'https://example.com' // Current 신규 필드
        },
        blip_003: {
          isDeleted: true // Current의 최신 삭제
        }
      },
      customSchedules: {}
    };

    const mockMaster = [
      { id: 'blip_001', title: '원본' },
      { id: 'mnet_002', title: '원본2' },
      { id: 'blip_003', title: '원본3' }
    ];

    const { restoredOverrides, stats: _stats } = restoreLosslessOverrides({
      rebuildData: mockRebuild,
      currentData: mockCurrent,
      masterItems: mockMaster,
      officialStreams: []
    });

    const item1 = restoredOverrides.sourceOverrides.blip_001;
    assert.strictEqual(item1.title, '복원된 제목', 'Rebuild의 title이 보존되어야 함');
    assert.strictEqual(item1.message, '복원된 메시지', 'Rebuild의 message가 보존되어야 함');
    assert.strictEqual(item1.location, '새로운 고척돔', 'Current의 location이 우선 적용되어야 함');
    assert.strictEqual(item1.url, 'https://example.com', 'Current의 url이 보존되어야 함');

    // 가상키 필터링 검증
    assert(!item1.linkedScheduleIds.includes('2026-09-04_<가상키>'), '가상키는 링크에서 제외되어야 함');
    assert(item1.linkedScheduleIds.includes('mnet_002'), '유효한 mnet_002는 보존되어야 함');

    // 양방향 대칭 보정 검증: blip_001 -> mnet_002 링크로 인해 mnet_002에도 blip_001이 자동 등록되어야 함
    const item2 = restoredOverrides.sourceOverrides.mnet_002;
    assert(item2.linkedScheduleIds.includes('blip_001'), '양방향 대칭으로 blip_001 링크가 상호 보장되어야 함');

    // 최신 삭제 보존
    assert.strictEqual(restoredOverrides.sourceOverrides.blip_003.isDeleted, true, 'Current의 삭제 상태가 보존되어야 함');
  });

  runner.test('2. restoreLosslessOverrides: yt_ 공식 라이브 접두사 키를 정상 보존', () => {
    const mockRebuild = {
      sourceOverrides: {
        yt_test123: { startTime: '2026-06-07T16:19Z', channel: 'RESCENE' }
      }
    };
    const mockStreams = [{ id: 'test123', title: '테스트 라이브' }];

    const { restoredOverrides } = restoreLosslessOverrides({
      rebuildData: mockRebuild,
      currentData: { sourceOverrides: {} },
      masterItems: [],
      officialStreams: mockStreams
    });

    assert(Boolean(restoredOverrides.sourceOverrides.yt_test123), '공식 유튜브 yt_ 키가 보존되어야 함');
    assert.strictEqual(restoredOverrides.sourceOverrides.yt_test123.channel, 'RESCENE');
  });

  // =========================================================================
  // Section 2: 실제 영속 파일 .cache/schedule-overrides.json 전수 정합성 검증
  // =========================================================================

  runner.test('3. 영속 데이터 검증: .cache/schedule-overrides.json 건수 회복 및 하한선(>=500건)', () => {
    assert(fs.existsSync(OVERRIDES_FILE), '오버라이드 파일이 존재해야 합니다.');
    const data = JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8'));
    const soKeys = Object.keys(data.sourceOverrides || {});
    assert(soKeys.length >= 500, `sourceOverrides 건수가 최소 500건 이상이어야 합니다. (현재: ${soKeys.length}건)`);
    assert(Object.keys(data.customSchedules || {}).length === 26, 'customSchedules는 26건 유지되어야 합니다.');
  });

  runner.test('4. 무손실 복원 핵심 일정(KGMA/키움/유성온천/입크)의 물리적 속성 보존 검증', () => {
    const data = JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8'));
    const so = data.sourceOverrides || {};

    // 1) 2026 KGMA 엠넷 상세 일정 복원 검증
    const kgma = so['mnet_6a3e7e069f69517347795cee'];
    assert(Boolean(kgma), 'KGMA 엠넷 일정이 존재해야 함');
    assert.strictEqual(kgma.typeText, '공연', 'KGMA typeText가 공연이어야 함');
    assert.strictEqual(kgma.url, 'https://x.com/i/status/2098184755238035855', 'KGMA 공식 SNS URL이 보존되어야 함');
    assert(Boolean(kgma.message && kgma.message.includes('남지현·리센느 원이')), 'KGMA MC 확정 메시지가 보존되어야 함');
    assert(Array.isArray(kgma.linkedScheduleIds) && kgma.linkedScheduleIds.includes('blip_1118783'), 'KGMA 블립 일정과 상호 링크되어야 함');

    // 2) 키움 시구
    const kiwoom = so['mnet_67f75b736bf606620a6202fe'];
    assert(Boolean(kiwoom), '키움 시구 일정이 존재해야 함');
    assert.strictEqual(kiwoom.location, '고척 스카이돔', '키움 시구 장소가 고척 스카이돔이어야 함');
    assert.strictEqual(kiwoom.typeText, '행사', '키움 시구 typeText가 행사여야 함');
    assert(Boolean(kiwoom.url), '키움 시구 url이 존재해야 함');

    // 3) 유성온천문화축제
    const yuseong = so['blip_814228'];
    assert(Boolean(yuseong), '유성온천 일정이 존재해야 함');
    assert.strictEqual(yuseong.title, '2025 유성온천문화축제');
    assert.strictEqual(yuseong.location, '유성구 계룡스파텔 광장');
    assert(Boolean(yuseong.message), '유성온천 상세 메시지가 보존되어야 함');

    // 4) 입크 페스티벌
    const ipke = so['blip_1108061'];
    assert(Boolean(ipke), '입크 페스티벌 일정이 존재해야 함');
    assert.strictEqual(ipke.title, '2026 입크 페스티벌');
    assert.strictEqual(ipke.typeText, '공연');

    // 5) 경기과학기술대학교 축제
    const gyeonggi = so['blip_1089139'];
    assert(Boolean(gyeonggi), '경기과기대 축제 일정이 존재해야 함');
    assert.strictEqual(gyeonggi.location, '경기과학기술대학교');

    // 6) 최근 삭제 일정 보존
    const deletedItem = so['blip_1119770'];
    assert(Boolean(deletedItem && deletedItem.isDeleted), '최근 삭제 일정 blip_1119770이 isDeleted: true로 보존되어야 함');
  });

  runner.test('5. 비표준 키 0건 및 링크 완전 양방향 대칭 검증', () => {
    const data = JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8'));
    const so = data.sourceOverrides || {};
    const cs = data.customSchedules || {};

    // 1) 비표준 키 0건 (ADR-0002)
    const illegalKeys = Object.keys(so).filter(k => !/^(blip_|mnet_|yt_|del_)[a-zA-Z0-9_-]+$/.test(k));
    assert.strictEqual(illegalKeys.length, 0, `비표준 키가 0건이어야 합니다. (발견: ${illegalKeys.join(', ')})`);

    // 2) [SEC-HYDR-03] Dual-SSOT 방지: custom_ 일정은 customSchedules 단일 SSOT여야 하므로 sourceOverrides 내 0건이어야 함
    const customInSO = Object.keys(so).filter(k => k.startsWith('custom_'));
    assert.strictEqual(customInSO.length, 0, `sourceOverrides에 custom_ 키가 존재하지 않아야 합니다 (Dual-SSOT 방지). (발견: ${customInSO.join(', ')})`);

    // 3) [SEC-HYDR-05] 링크 대칭성 100% 검증 (so + cs 양방향 전수 순회)
    let asymmetricCount = 0;
    const allHosts = { ...so, ...cs };
    for (const [hostId, obj] of Object.entries(allHosts)) {
      if (Array.isArray(obj.linkedScheduleIds)) {
        for (const tid of obj.linkedScheduleIds) {
          const targetObj = allHosts[tid];
          const targetLinks = targetObj?.linkedScheduleIds || [];
          if (!targetLinks.includes(hostId)) {
            asymmetricCount++;
          }
        }
      }
    }
    assert.strictEqual(asymmetricCount, 0, `so 및 cs 전 구간 비대칭 링크가 0건이어야 합니다. (발견: ${asymmetricCount}건)`);
  });

  // =========================================================================
  // Section 3: schedules.json 배포본 수화 정합성 검증
  // =========================================================================

  runner.test('6. schedules.json 배포본에 복원된 상세 속성이 올바르게 수화(Hydration)되어 반영됨', () => {
    assert(fs.existsSync(SCHEDULES_FILE), 'schedules.json 파일이 존재해야 합니다.');
    const schedData = JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf8'));
    const items = schedData.items || [];

    const kiwoomItem = items.find(i => i.id === 'mnet_67f75b736bf606620a6202fe');
    assert(Boolean(kiwoomItem), '배포본에 키움 시구 일정이 포함되어야 함');
    assert.strictEqual(kiwoomItem.location, '고척 스카이돔', '배포본 키움 시구 장소가 고척 스카이돔이어야 함');
    assert.strictEqual(kiwoomItem.typeText, '행사', '배포본 키움 시구 typeText가 행사여야 함');

    const yuseongItem = items.find(i => i.id === 'blip_814228');
    assert(Boolean(yuseongItem), '배포본에 유성온천축제가 포함되어야 함');
    assert.strictEqual(yuseongItem.title, '2025 유성온천문화축제');
    assert.strictEqual(yuseongItem.location, '유성구 계룡스파텔 광장');

    const kgmaItem = items.find(i => i.id === 'blip_1118783');
    assert(Boolean(kgmaItem), '배포본에 KGMA 일정이 포함되어야 함');
    assert(Array.isArray(kgmaItem.linkedScheduleIds) && kgmaItem.linkedScheduleIds.includes('mnet_6a3e7e069f69517347795cee'), 'KGMA 엠넷 일정이 링크되어야 함');
  });

  return runner.summary();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().then(res => {
    if (!res.isSuccess) process.exit(1);
  });
}
