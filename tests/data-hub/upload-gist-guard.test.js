// tests/data-hub/upload-gist-guard.test.js
// Gist 업로더 High-Water Mark 및 Fail-Closed 가드 무결성 테스트

import { TestRunner, assert } from '../test-helper.js';
import { verifyHighWaterMark } from '../../scripts/data-hub/upload-gist.js';

export async function run() {
  const runner = new TestRunner('Data Hub - Gist High-Water Mark & Fail-Closed Guards');
  runner.run();

  const createMockItems = (count) => Array.from({ length: count }, (_, i) => ({ id: `item_${i}` }));

  // 1. 신규 마스터가 절대 하한선(500건) 미만일 때 즉각 차단
  runner.test('1. 신규 마스터 건수 < 500건 절대 하한선 미달 시 예외 발생 및 차단', () => {
    assert.throws(() => {
      verifyHighWaterMark({
        masterObj: { items: createMockItems(499) },
        schedObj: { items: createMockItems(450) },
        remoteMasterResult: { ok: true, data: { items: createMockItems(1300) } },
        remoteSchedResult: { ok: true, data: { items: createMockItems(600) } }
      });
    }, /절대 하한선\(500건\) 미만/);
  });

  // 2. 신규 배포본이 절대 하한선(400건) 미만일 때 즉각 차단
  runner.test('2. 신규 배포본 건수 < 400건 절대 하한선 미달 시 예외 발생 및 차단', () => {
    assert.throws(() => {
      verifyHighWaterMark({
        masterObj: { items: createMockItems(1300) },
        schedObj: { items: createMockItems(399) },
        remoteMasterResult: { ok: true, data: { items: createMockItems(1300) } },
        remoteSchedResult: { ok: true, data: { items: createMockItems(600) } }
      });
    }, /절대 하한선\(400건\) 미만/);
  });

  // 3. SEC-01 방어: 원격 마스터 조회 실패(네트워크 오류/429/503/타임아웃) 시 신규 마스터가 1000건 미만이면 Fail-Closed 차단
  runner.test('3. [SEC-01 Fail-Closed] 원격 마스터 확인 불가 시 604건 불완전 데이터는 즉각 차단', () => {
    assert.throws(() => {
      verifyHighWaterMark({
        masterObj: { items: createMockItems(604) }, // 500건은 넘지만 1,000건 미만
        schedObj: { items: createMockItems(450) },
        remoteMasterResult: { ok: false, error: 'HTTP 429 Too Many Requests' },
        remoteSchedResult: { ok: true, data: { items: createMockItems(450) } }
      });
    }, /Fail-Closed.*안전 기준\(1000건\) 미만/);

    assert.throws(() => {
      verifyHighWaterMark({
        masterObj: { items: createMockItems(604) },
        schedObj: { items: createMockItems(450) },
        remoteMasterResult: { ok: false, error: 'AbortError: timeout' },
        remoteSchedResult: { ok: false, error: 'AbortError: timeout' }
      });
    }, /Fail-Closed.*안전 기준\(1000건\) 미만/);
  });

  // 4. 원격 마스터 확인 실패 상태라도 신규 마스터가 1000건 이상 완전체(예: 1372건)이면 정상 통과
  runner.test('4. 원격 마스터 확인 불가 상태라도 신규 마스터가 1000건 이상 완전체(1372건)이면 통과', () => {
    const result = verifyHighWaterMark({
      masterObj: { items: createMockItems(1372) },
      schedObj: { items: createMockItems(604) },
      remoteMasterResult: { ok: false, error: 'HTTP 503 Service Unavailable' },
      remoteSchedResult: { ok: false, error: 'HTTP 503 Service Unavailable' }
    });
    assert.strictEqual(result, true, '신규 마스터가 1,372건 완전체인 경우 통과해야 함');
  });

  // 5. 원격 마스터 대비 20% 이상 급감 시 차단 (예: 1372건 -> 1000건은 27% 감소이므로 차단)
  runner.test('5. 원격 마스터(1372건) 대비 20% 초과 급감 시 차단 (1000건 -> 27% 감소 차단)', () => {
    assert.throws(() => {
      verifyHighWaterMark({
        masterObj: { items: createMockItems(1000) },
        schedObj: { items: createMockItems(500) },
        remoteMasterResult: { ok: true, data: { items: createMockItems(1372) } },
        remoteSchedResult: { ok: true, data: { items: createMockItems(600) } }
      });
    }, /마스터 일정 건수 비정상 급감 감지/);
  });

  // 6. SEC-02 독립성: masterObj가 정상일 때 schedules.json 급감 독립 차단
  runner.test('6. [SEC-02] 배포본 schedules.json 건수 급감(600건 -> 450건: 25% 감소) 독립 차단', () => {
    assert.throws(() => {
      verifyHighWaterMark({
        masterObj: { items: createMockItems(1372) },
        schedObj: { items: createMockItems(450) },
        remoteMasterResult: { ok: true, data: { items: createMockItems(1372) } },
        remoteSchedResult: { ok: true, data: { items: createMockItems(600) } }
      });
    }, /배포용 schedules\.json 건수 비정상 급감 감지/);
  });

  // 7. 모든 검증 정상 조건 충족 시 안전 통과
  runner.test('7. 정상 케이스: 원격 1372건 / 신규 1375건 증분 업데이트 정상 통과', () => {
    const result = verifyHighWaterMark({
      masterObj: { items: createMockItems(1375) },
      schedObj: { items: createMockItems(605) },
      remoteMasterResult: { ok: true, data: { items: createMockItems(1372) } },
      remoteSchedResult: { ok: true, data: { items: createMockItems(604) } }
    });
    assert.strictEqual(result, true);
  });

  // 8. SEC-03 방어: 원격 schedules.json 조회 실패 시 신규 배포본이 500건 미만(예: 405건)이면 Fail-Closed 차단
  runner.test('8. [SEC-03 Fail-Closed] 원격 배포본 확인 불가 시 405건 급감본은 즉각 차단', () => {
    assert.throws(() => {
      verifyHighWaterMark({
        masterObj: { items: createMockItems(1372) },
        schedObj: { items: createMockItems(405) }, // 400건은 넘지만 안전 기준 500건 미만
        remoteMasterResult: { ok: true, data: { items: createMockItems(1372) } },
        remoteSchedResult: { ok: false, error: 'HTTP 500 Internal Server Error' }
      });
    }, /Fail-Closed.*신규 배포본 건수\(405건\)가 안전 기준\(500건\) 미만/);
  });

  // 9. EDGE-01 방어: 원격 응답이 200 OK이지만 빈 배열({ items: [] })로 오염된 경우 원격 신뢰 불가로 Fail-Closed 격리
  runner.test('9. [EDGE-01] 원격 마스터가 빈 배열(0건)로 오염 수신 시 원격 신뢰 불가 처리 및 1000건 미만 마스터 차단', () => {
    assert.throws(() => {
      verifyHighWaterMark({
        masterObj: { items: createMockItems(604) },
        schedObj: { items: createMockItems(600) },
        remoteMasterResult: { ok: true, data: { items: [] } }, // 오염된 0건 응답
        remoteSchedResult: { ok: true, data: { items: createMockItems(600) } }
      });
    }, /Fail-Closed.*원격 마스터 상태 신뢰 불가.*안전 기준\(1000건\) 미만/);
  });

  return runner.summary();
}

if (process.argv[1]?.endsWith('upload-gist-guard.test.js')) {
  run().then(s => process.exit(s.isSuccess ? 0 : 1));
}
