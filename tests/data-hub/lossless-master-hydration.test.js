// tests/data-hub/lossless-master-hydration.test.js
// 마스터 일정 Gist Hydration 및 무손실 델타 보존 테스트

import { TestRunner, assert } from '../test-helper.js';
import { loadBaseMasterSchedules, getMonthsToFetch } from '../../scripts/data-hub/collectors/schedule.js';

export async function run() {
  const runner = new TestRunner('Data Hub - Lossless Master Hydration & Archiving');
  runner.run();

  const mockMonths = [
    { year: 2026, month: 8 },
    { year: 2026, month: 9 },
    { year: 2026, month: 10 },
    { year: 2026, month: 11 },
    { year: 2026, month: 12 }
  ];

  // 1. isFull=true 모드일 때는 아카이브 로드를 스킵하고 빈 배열 반환
  await runner.testAsync('1. isFull=true 전체 수집 시 베이스 아카이브는 빈 배열이어야 함', async () => {
    const items = await loadBaseMasterSchedules(true, mockMonths, { fetchRemote: false });
    assert.strictEqual(items.length, 0, 'isFull=true일 때는 archivedItems가 0건이어야 함');
  });

  // 2. 로컬 파일 건수 < 원격 Gist 건수일 때 원격 Gist 마스터를 우선 채택
  await runner.testAsync('2. 로컬 587건 < 원격 1372건일 때 더 완전한 원격 마스터를 채택하여 비수집 기간 보존', async () => {
    const mockLocal = {
      items: [
        { id: 'mnet_2024_old', title: '2024년 과거 일정', startTime: '2024-05-01T12:00:00Z', source: 'mnet' },
        { id: 'mnet_2026_active', title: '2026년 9월 일정', startTime: '2026-09-15T12:00:00Z', source: 'mnet' }
      ]
    };
    const mockRemote = {
      items: [
        { id: 'mnet_2024_old', title: '2024년 과거 일정', startTime: '2024-05-01T12:00:00Z', source: 'mnet' },
        { id: 'blip_2025_old', title: '2025년 과거 일정', startTime: '2025-06-01T12:00:00Z', source: 'blip' },
        { id: 'mnet_2026_active', title: '2026년 9월 일정', startTime: '2026-09-15T12:00:00Z', source: 'mnet' }
      ]
    };

    const archived = await loadBaseMasterSchedules(false, mockMonths, {
      mockLocal,
      mockRemote,
      fetchRemote: true
    });

    // 2026년 9월은 수집 대상 5개월이므로 제외되고, 2024년 + 2025년 2건이 보존되어야 함
    assert.strictEqual(archived.length, 2, `원격 3건 중 비수집 기간 2건이 보존되어야 함 (실제: ${archived.length})`);
    const ids = archived.map(i => i.id);
    assert(ids.includes('mnet_2024_old'), '2024년 과거 일정이 보존되어야 함');
    assert(ids.includes('blip_2025_old'), '2025년 과거 일정이 보존되어야 함');
    assert(!ids.includes('mnet_2026_active'), '수집 대상 기간 일정은 비수집 아카이브에서 제외되어야 함');
  });

  // 3. 원격 Gist fetch 실패 시 로컬 파일로 안전하게 폴백
  await runner.testAsync('3. 원격 Gist 네트워크 장애 시 로컬 마스터로 안전하게 폴백', async () => {
    const mockLocal = {
      items: [
        { id: 'mnet_2024_old', title: '2024년 과거 일정', startTime: '2024-05-01T12:00:00Z', source: 'mnet' }
      ]
    };

    const archived = await loadBaseMasterSchedules(false, mockMonths, {
      mockLocal,
      mockRemoteError: new Error('Network Timeout'),
      fetchRemote: true
    });

    assert.strictEqual(archived.length, 1, '네트워크 장애 시 로컬 1건이 안전하게 보존되어야 함');
    assert.strictEqual(archived[0].id, 'mnet_2024_old');
  });

  // 4. 원격에 빈 객체 등 오염 데이터(유효율 < 90%)가 주입되었을 때 로컬 마스터를 우선 선택
  await runner.testAsync('4. 원격에 오염된 빈 레코드 대량 주입 시 유효율 검증으로 로컬 마스터 안전 채택', async () => {
    const mockLocal = {
      items: [
        { id: 'mnet_2024_old', title: '정상 2024년 일정', startTime: '2024-05-01T12:00:00Z', source: 'mnet' }
      ]
    };
    // 원격에 깨진 빈 레코드 10건 주입 (길이 11건, 정상 1건 -> 유효율 < 10%)
    const mockRemote = {
      items: [
        { id: 'mnet_2024_old', title: '정상 2024년 일정', startTime: '2024-05-01T12:00:00Z', source: 'mnet' },
        {}, {}, {}, {}, {}, {}, {}, {}, {}, {}
      ]
    };

    const archived = await loadBaseMasterSchedules(false, mockMonths, {
      mockLocal,
      mockRemote,
      fetchRemote: true
    });

    assert.strictEqual(archived.length, 1, '오염된 원격을 버리고 로컬 1건이 보존되어야 함');
    assert.strictEqual(archived[0].id, 'mnet_2024_old');
  });

  // 5. KST 기준 월 계산: UTC 말일 15:00 (한국 시간 익월 1일 00:00) 시점의 KST 월 판정 검증
  runner.test('5. getMonthsToFetch: UTC 말일 15:00 (KST 익월 1일) 시점에 KST 기준으로 올바른 당월/익월 산출', () => {
    // 2026-08-31T15:30:00Z -> KST 기준 2026-09-01T00:30:00
    const utcEndOfMonth = new Date('2026-08-31T15:30:00Z');
    const months = getMonthsToFetch(utcEndOfMonth, false);
    
    // KST 기준으로 당월은 9월이어야 함 (오프셋 -1은 8월, 0은 9월, 1은 10월, 2는 11월, 3은 12월)
    const monthList = months.map(m => `${m.year}-${String(m.month).padStart(2, '0')}`);
    assert.deepStrictEqual(monthList, ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12'], 
      `KST 기준 9월을 당월로 하여 8~12월 5개월이 나와야 함 (실제: ${monthList.join(', ')})`);
  });

  // 6. 날짜 깨진 레코드(Invalid Date) 주입 시 유효성 검증 탈락 및 오염 차단 검증
  await runner.testAsync('6. 날짜가 파손된(Invalid Date) 레코드 주입 시 유효 레코드 카운트 제외 및 안전 격리', async () => {
    const mockLocal = {
      items: [
        { id: 'mnet_valid_2024', title: '정상 과거 일정', startTime: '2024-05-01T12:00:00Z', source: 'mnet' }
      ]
    };
    const mockRemote = {
      items: [
        { id: 'mnet_valid_2024', title: '정상 과거 일정', startTime: '2024-05-01T12:00:00Z', source: 'mnet' },
        { id: 'corrupt_item_1', title: '날짜 깨짐 1', startTime: 'invalid-date-string', source: 'mnet' },
        { id: 'corrupt_item_2', title: '날짜 깨짐 2', startTime: '2026-99-99T99:99:99Z', source: 'mnet' },
        { id: 'corrupt_item_3', title: '날짜 깨짐 3', startTime: 'null', source: 'mnet' }
      ]
    };

    const archived = await loadBaseMasterSchedules(false, mockMonths, {
      mockLocal,
      mockRemote,
      fetchRemote: true
    });

    // 원격은 4건 중 유효한 건 1건뿐 (유효율 25% < 90%) -> 로컬 마스터(1건) 채택되어 1건만 보존
    assert.strictEqual(archived.length, 1, `깨진 날짜 레코드가 걸러져 정상 1건만 보존되어야 함 (실제: ${archived.length})`);
    assert.strictEqual(archived[0].id, 'mnet_valid_2024');
  });

  return runner.summary();
}

if (process.argv[1]?.endsWith('lossless-master-hydration.test.js')) {
  run().then(s => process.exit(s.isSuccess ? 0 : 1));
}
