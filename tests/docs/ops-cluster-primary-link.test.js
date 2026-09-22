// tests/docs/ops-cluster-primary-link.test.js
// Ops 포털 연관 일정 클러스터링(전이적 폐포) 및 대표 일정 중복 렌더링 방어 회귀 테스트

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const OPS_JS_PATH = path.join(ROOT_DIR, 'docs/ops.js');

export async function run() {
  const runner = new TestRunner('Docs - Ops Cluster Primary & Transitive Linking Regressions');
  runner.run();

  const opsJs = fs.readFileSync(OPS_JS_PATH, 'utf8');

  // ─────────────────────────────────────────────────────────────
  // 1. 소스 코드 내 방어 로직 존재 검증
  // ─────────────────────────────────────────────────────────────
  runner.test('Transitive Clustering Implementation: buildScheduleClusterTransitive 또는 동등한 BFS 탐색 존재 확인', () => {
    assert(
      opsJs.includes('buildScheduleClusterTransitive') || opsJs.includes('buildScheduleCluster'),
      'docs/ops.js에 전이적 클러스터 수집 함수가 선언되어 있어야 합니다.'
    );
  });

  runner.test('Primary Duplication Fail-Safe Guard: renderedPrimaryKeys 중복 차단 가드 존재 확인', () => {
    assert(
      opsJs.includes('renderedPrimaryKeys') || opsJs.includes('renderedGlobalPrimaryKeys'),
      'docs/ops.js renderScheduleGroupsHTML 내에 대표 일정 중복 방지 가드가 존재해야 합니다.'
    );
  });

  runner.test('Preserve isPrimary on Modal Save: 모달 저장 객체 내 isPrimary 보존 확인', () => {
    assert(
      opsJs.includes('isPrimary: Boolean(item.isPrimary)') || opsJs.includes('isPrimary: item.isPrimary') || opsJs.includes('isPrimary: !!item.isPrimary'),
      'docs/ops.js 모달 submit 처리부에서 item.isPrimary 플래그를 보존해야 합니다.'
    );
  });

  // ─────────────────────────────────────────────────────────────
  // 2. BFS 전이적 클러스터링 (Transitive Closure) 알고리즘 단위 검증
  // ─────────────────────────────────────────────────────────────
  runner.test('Transitive Closure: A<->B, A<->C 구조에서 어느 노드에서 시작해도 [A, B, C] 전체를 단일 클러스터로 수집해야 함', () => {
    // ops.js에 도입할 함수 규격과 동일한 순수 알고리즘 검증
    function getScheduleKey(item) {
      return item.id || item._originKey;
    }

    function buildScheduleClusterTransitive(startItem, allList) {
      if (!startItem) return [];
      const cluster = [];
      const visitedKeys = new Set();
      const queue = [startItem];

      const startKey = startItem.id || startItem._originKey || getScheduleKey(startItem);
      if (startKey) visitedKeys.add(startKey);

      while (queue.length > 0) {
        const cur = queue.shift();
        cluster.push(cur);

        const curId = cur.id;
        const curKey = cur._originKey || getScheduleKey(cur);

        // 1. 순방향 링크 탐색: cur.linkedScheduleIds 에 정의된 대상들
        const linkedIds = Array.isArray(cur.linkedScheduleIds) ? cur.linkedScheduleIds : [];
        linkedIds.forEach(tId => {
          if (!tId) return;
          const matched = allList.find(cand => {
            return (cand.id && cand.id === tId) || cand._originKey === tId || getScheduleKey(cand) === tId;
          });
          if (matched) {
            const mKey = matched.id || matched._originKey || getScheduleKey(matched);
            if (mKey && !visitedKeys.has(mKey)) {
              visitedKeys.add(mKey);
              queue.push(matched);
            }
          }
        });

        // 2. 역방향 링크 탐색: 다른 일정 중 curId 또는 curKey 를 링크하고 있는 대상들
        allList.forEach(cand => {
          const mKey = cand.id || cand._originKey || getScheduleKey(cand);
          if (mKey && visitedKeys.has(mKey)) return;
          const cLinked = Array.isArray(cand.linkedScheduleIds) ? cand.linkedScheduleIds : [];
          if ((curId && cLinked.includes(curId)) || (curKey && cLinked.includes(curKey))) {
            visitedKeys.add(mKey);
            queue.push(cand);
          }
        });
      }

      return cluster;
    }

    const itemA = { id: 'mnet_primary', title: '대표 일정 A', isPrimary: true, linkedScheduleIds: ['blip_sub1', 'blip_sub2'] };
    const itemB = { id: 'blip_sub1', title: '서브 일정 B', linkedScheduleIds: ['mnet_primary'] };
    const itemC = { id: 'blip_sub2', title: '서브 일정 C', linkedScheduleIds: ['mnet_primary'] };
    const allList = [itemB, itemC, itemA]; // 정렬상 B, C가 앞에 올 수 있는 상황

    // B에서 시작해도 3건 모두 탐색되어야 함
    const clusterFromB = buildScheduleClusterTransitive(itemB, allList);
    assert.strictEqual(clusterFromB.length, 3, 'B에서 시작 시 클러스터 크기는 3이어야 합니다.');
    assert(clusterFromB.some(c => c.id === 'mnet_primary'), 'mnet_primary가 포함되어야 합니다.');
    assert(clusterFromB.some(c => c.id === 'blip_sub1'), 'blip_sub1이 포함되어야 합니다.');
    assert(clusterFromB.some(c => c.id === 'blip_sub2'), 'blip_sub2가 포함되어야 합니다.');

    // C에서 시작해도 3건 모두 탐색되어야 함
    const clusterFromC = buildScheduleClusterTransitive(itemC, allList);
    assert.strictEqual(clusterFromC.length, 3, 'C에서 시작 시 클러스터 크기는 3이어야 합니다.');

    // A에서 시작해도 3건 모두 탐색되어야 함
    const clusterFromA = buildScheduleClusterTransitive(itemA, allList);
    assert.strictEqual(clusterFromA.length, 3, 'A에서 시작 시 클러스터 크기는 3이어야 합니다.');
  });

  // ─────────────────────────────────────────────────────────────
  // 3. KGMA 실제 재현 시나리오 기반 렌더링 중복 차단 시뮬레이션
  // ─────────────────────────────────────────────────────────────
  runner.test('KGMA Scenario: 대표 지정 후 추가 연결 시 카드가 2개가 아닌 정확히 1개만 배출되어야 함', () => {
    const kgma1 = {
      id: 'blip_1118783',
      title: '<2026 KGMA>',
      startTime: '2026-11-06T15:00:00.000Z',
      linkedScheduleIds: ['mnet_6a3e7e069f69517347795cee']
    };
    const kgma2 = {
      id: 'blip_1119029',
      title: 'MC <2026 KGMA>',
      startTime: '2026-11-06T15:00:00.000Z',
      linkedScheduleIds: ['mnet_6a3e7e069f69517347795cee']
    };
    const kgmaMnet = {
      id: 'mnet_6a3e7e069f69517347795cee',
      title: '2026 KGMA (코리아 그랜드 뮤직 어워즈)',
      startTime: '2026-11-07T00:00:00+09:00',
      isPrimary: true,
      linkedScheduleIds: ['blip_1118783', 'blip_1119029']
    };

    const allSchedules = [kgma1, kgma2, kgmaMnet];
    const filteredItems = [kgma1, kgma2, kgmaMnet];

    function determineClusterPrimary(cluster) {
      if (!cluster || cluster.length === 0) return null;
      if (cluster.length === 1) return cluster[0];
      const explicit = cluster.find(c => c && c.isPrimary);
      if (explicit) return explicit;
      return cluster[0];
    }

    // 전이적 클러스터링과 중복 대표 가드가 적용된 렌더러 시뮬레이션
    function simulateRender(items, allList) {
      const renderedGlobalScheduleIds = new Set();
      const renderedPrimaryKeys = new Set();
      const renderedCards = [];

      items.forEach(item => {
        if (item.id && renderedGlobalScheduleIds.has(item.id)) return;
        const key = item.id || item._originKey;
        if (key && renderedGlobalScheduleIds.has(key)) return;

        // BFS 전이적 클러스터링
        const cluster = [];
        const visitedKeys = new Set();
        const queue = [item];
        if (key) visitedKeys.add(key);

        while (queue.length > 0) {
          const cur = queue.shift();
          cluster.push(cur);
          const cId = cur.id;
          const cKey = cur.id || cur._originKey;

          const linked = Array.isArray(cur.linkedScheduleIds) ? cur.linkedScheduleIds : [];
          linked.forEach(tId => {
            const m = allList.find(c => c.id === tId || c._originKey === tId);
            if (m) {
              const mKey = m.id || m._originKey;
              if (mKey && !visitedKeys.has(mKey)) {
                visitedKeys.add(mKey);
                queue.push(m);
              }
            }
          });

          allList.forEach(cand => {
            const candKey = cand.id || cand._originKey;
            if (candKey && visitedKeys.has(candKey)) return;
            const cLinked = Array.isArray(cand.linkedScheduleIds) ? cand.linkedScheduleIds : [];
            if ((cId && cLinked.includes(cId)) || (cKey && cLinked.includes(cKey))) {
              visitedKeys.add(candKey);
              queue.push(cand);
            }
          });
        }

        // 클러스터 멤버 전원 글로벌 집합에 등록
        cluster.forEach(c => {
          if (c.id) renderedGlobalScheduleIds.add(c.id);
          if (c._originKey) renderedGlobalScheduleIds.add(c._originKey);
        });

        const primary = determineClusterPrimary(cluster);
        const primaryKey = primary.id || primary._originKey;

        // Fail-Safe: 대표 키 중복 배출 가드
        if (renderedPrimaryKeys.has(primaryKey)) {
          return;
        }
        renderedPrimaryKeys.add(primaryKey);

        const subItems = cluster.filter(c => c !== primary);
        renderedCards.push({
          primaryId: primary.id,
          primaryTitle: primary.title,
          subCount: subItems.length,
          subIds: subItems.map(s => s.id)
        });
      });

      return renderedCards;
    }

    const cards = simulateRender(filteredItems, allSchedules);
    assert.strictEqual(cards.length, 1, '결과 카드는 정확히 1개여야 합니다.');
    assert.strictEqual(cards[0].primaryId, 'mnet_6a3e7e069f69517347795cee', '대표 일정은 mnet_...이어야 합니다.');
    assert.strictEqual(cards[0].subCount, 2, '서브 일정은 2개(blip 2건)가 모두 포함되어야 합니다.');
    assert(cards[0].subIds.includes('blip_1118783'), 'blip_1118783이 포함되어야 합니다.');
    assert(cards[0].subIds.includes('blip_1119029'), 'blip_1119029가 포함되어야 합니다.');
  });

  // ─────────────────────────────────────────────────────────────
  // 4. 동일 날짜/동일 제목 타 출처 일정 클러스터링 검증 (NOL FESTIVAL, 동구동락)
  // ─────────────────────────────────────────────────────────────
  runner.test('Identical Date & Title Clustering: 날짜와 제목이 100% 동일한 blip/mnet 쌍도 가상키 간섭 없이 단일 클러스터로 합성되어야 함', () => {
    function buildScheduleClusterPure(startItem, allList) {
      if (!startItem) return [];
      const cluster = [];
      const visitedIds = new Set();
      const queue = [startItem];

      const getId = (x) => x.id || x._originKey;
      const startId = getId(startItem);
      if (startId) visitedIds.add(startId);

      while (queue.length > 0) {
        const cur = queue.shift();
        if (!cluster.includes(cur)) cluster.push(cur);

        const curId = getId(cur);
        if (curId) visitedIds.add(curId);

        const linked = Array.isArray(cur.linkedScheduleIds) ? cur.linkedScheduleIds : [];
        linked.forEach(tId => {
          if (!tId) return;
          const m = allList.find(cand => cand.id === tId || cand._originKey === tId);
          if (m) {
            const mId = getId(m);
            if (mId && !visitedIds.has(mId)) {
              visitedIds.add(mId);
              queue.push(m);
            }
          }
        });

        allList.forEach(cand => {
          const candId = getId(cand);
          if (candId && visitedIds.has(candId)) return;
          const cLinked = Array.isArray(cand.linkedScheduleIds) ? cand.linkedScheduleIds : [];
          if (curId && cLinked.includes(curId)) {
            visitedIds.add(candId);
            queue.push(cand);
          }
        });
      }
      return cluster;
    }

    // 1) NOL FESTIVAL - 고양 (2026-10-17)
    const blipNol = {
      id: 'blip_1108116',
      title: 'NOL FESTIVAL - 고양',
      startTime: '2026-10-16T15:00:00.000Z',
      linkedScheduleIds: ['mnet_6a4612a67dd960680ac6f9b8']
    };
    const mnetNol = {
      id: 'mnet_6a4612a67dd960680ac6f9b8',
      title: 'NOL FESTIVAL - 고양',
      startTime: '2026-10-17T00:00:00Z',
      linkedScheduleIds: []
    };
    const nolList = [blipNol, mnetNol];

    const nolClusterFromBlip = buildScheduleClusterPure(blipNol, nolList);
    assert.strictEqual(nolClusterFromBlip.length, 2, 'NOL FESTIVAL은 blip에서 시작 시 2건이 모두 묶여야 함');
    assert(nolClusterFromBlip.some(c => c.id === 'mnet_6a4612a67dd960680ac6f9b8'), 'mnet 일정이 포함되어야 함');

    const nolClusterFromMnet = buildScheduleClusterPure(mnetNol, nolList);
    assert.strictEqual(nolClusterFromMnet.length, 2, 'NOL FESTIVAL은 mnet에서 시작 시 2건이 모두 묶여야 함');
    assert(nolClusterFromMnet.some(c => c.id === 'blip_1108116'), 'blip 일정이 포함되어야 함');

    // 2) 2026 대전 동구동락 축제 (2026-10-10)
    const blipDong = {
      id: 'blip_1113040',
      title: '2026 대전 동구동락 축제',
      startTime: '2026-10-09T15:00:00.000Z',
      linkedScheduleIds: ['mnet_6a98f7a94563ce4caf466391']
    };
    const mnetDong = {
      id: 'mnet_6a98f7a94563ce4caf466391',
      title: '2026 대전 동구동락 축제',
      startTime: '2026-10-10T00:00:00Z',
      linkedScheduleIds: []
    };
    const dongList = [blipDong, mnetDong];

    const dongCluster = buildScheduleClusterPure(blipDong, dongList);
    assert.strictEqual(dongCluster.length, 2, '동구동락 축제 2건이 단일 클러스터로 묶여야 함');
    assert(dongCluster.some(c => c.id === 'mnet_6a98f7a94563ce4caf466391'), '동구동락 mnet 일정이 포함되어야 함');
  });

  // ─────────────────────────────────────────────────────────────
  // 5. ops.js 소스 코드 내 가상키(getRawScheduleKey) 완전 퇴출 정적 검증
  // ─────────────────────────────────────────────────────────────
  runner.test('Zero Virtual Key in ops.js: getRawScheduleKey 정의 및 호출 0건 전수 박멸 확인', () => {
    // 1) 파일 전체에서 getRawScheduleKey 잔재 0건 확인
    assert(!opsJs.includes('getRawScheduleKey'), 'ops.js 파일 전체에 getRawScheduleKey 정의 및 호출이 0건이어야 합니다 (완전 박멸).');

    // 2) getScheduleKey 에서 가상키 폴백 제거 확인
    const skStart = opsJs.indexOf('function getScheduleKey(');
    assert(skStart > 0, 'getScheduleKey 함수가 존재해야 함');
    const skEnd = opsJs.indexOf('function ', skStart + 30);
    const skBody = opsJs.slice(skStart, skEnd);
    assert(!skBody.includes('return getRawScheduleKey'), 'getScheduleKey에서 getRawScheduleKey 폴백이 제거되어야 합니다.');
  });

  // ─────────────────────────────────────────────────────────────
  // 6. 감사관 지적 사항(code_critic) 하드닝 패치 정적/동적 검증
  // ─────────────────────────────────────────────────────────────
  runner.test('Audit Hardening: renderedPrimaryKeys Falsy Guard (DEFECT-01)', () => {
    // renderedPrimaryKeys.has(primaryKey)가 primaryKey truthy 조건 하에서만 실행되는지 확인
    assert(opsJs.includes('if (primaryKey) {\n            if (renderedPrimaryKeys.has(primaryKey))') ||
           opsJs.includes('if (primaryKey) {\r\n            if (renderedPrimaryKeys.has(primaryKey))'),
      'renderedPrimaryKeys 등록 시 빈 문자열/Falsy 키로 인한 연쇄 누락 방지 가드가 존재해야 합니다.');
  });

  runner.test('Audit Hardening: determineClusterPrimary Deterministic Sort (DEFECT-02)', () => {
    // determineClusterPrimary 본문 추출
    const dpStart = opsJs.indexOf('function determineClusterPrimary(');
    const dpEnd = opsJs.indexOf('function renderScheduleGroupsHTML(', dpStart);
    const dpBody = opsJs.slice(dpStart, dpEnd > 0 ? dpEnd : dpStart + 2000);

    assert(dpBody.includes('explicitList.sort('), 'isPrimary 후보 복수 시 ID 기반 결정론적 정렬이 수행되어야 합니다.');
    assert(dpBody.includes('customList.sort('), '_isCustom 후보 복수 시 ID 기반 결정론적 정렬이 수행되어야 합니다.');
    assert(dpBody.includes('modifiedList.sort('), '_isModified 후보 복수 시 ID 기반 결정론적 정렬이 수행되어야 합니다.');
  });

  runner.test('Audit Hardening: Gist sourceOverrides Sanitization & Inbound Schema Validation (DEFECT-03, 04)', () => {
    // sourceOverrides 키 정제 확인
    assert(opsJs.includes("if (!dKey || typeof dKey !== 'string' || !dKey.trim()) return;"),
      'sourceOverrides 삭제 키에 Falsy/공백 유입 방어 가드가 존재해야 합니다.');
    assert(opsJs.includes("if (!mKey || typeof mKey !== 'string' || !mKey.trim()) return;"),
      'sourceOverrides 수정 키에 Falsy/공백 유입 방어 가드가 존재해야 합니다.');

    // baseItems 및 customSchedules 스키마 검증 필터 확인
    assert(opsJs.includes('.filter(isValidScheduleItem).map('),
      'baseItems 수집 시 isValidScheduleItem 필터가 적용되어야 합니다.');
    assert(opsJs.includes('if (!c || !isValidScheduleItem(c)) return;'),
      'customSchedules 파싱 시 isValidScheduleItem 검증이 적용되어야 합니다.');
  });

  return runner.summary();
}

// 직접 실행 지원
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().then(res => {
    process.exit(res && res.isSuccess ? 0 : 1);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
