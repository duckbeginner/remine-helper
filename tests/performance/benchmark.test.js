// tests/performance/benchmark.test.js
// 5대 핵심 성능 벤치마크 및 리소스 예산(Performance Budget) TDD 검증 스위트

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

export async function run() {
  const runner = new TestRunner('Performance - 5 Core Benchmarks & Performance Budgets');
  runner.run();

  // ─────────────────────────────────────────────────────────────
  // 1. 대용량 일정(1,000건) 렌더링/필터링 벤치마크 (< 30ms)
  // ─────────────────────────────────────────────────────────────
  runner.test('Benchmark 1: 1,000건 대용량 일정 필터링 및 렌더링 루프 연산 속도 (< 30ms)', () => {
    // 1,000개 일정 대량 모킹 생성
    const largeSchedules = [];
    const baseTime = new Date('2026-09-01T00:00:00+09:00').getTime();
    for (let i = 0; i < 1000; i++) {
      largeSchedules.push({
        id: `bench_sched_${i}`,
        title: `리센느 방송 출연 및 팬미팅 ${i}`,
        startTime: new Date(baseTime + i * 3600000).toISOString(),
        channel: i % 2 === 0 ? 'Mnet' : 'KBS',
        location: '상암 CJ ENM',
        starAttendees: [{ name: '원이' }, { name: '미나미' }]
      });
    }

    const t0 = performance.now();

    // 1,000건 필터링 및 정렬 시뮬레이션
    const valid = largeSchedules.filter(it => it.title && it.startTime);
    const sorted = [...valid].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    let cardHtmlBuffer = '';
    for (let i = 0; i < sorted.length; i++) {
      const it = sorted[i];
      cardHtmlBuffer += `<div class="schedule-item" data-id="${it.id}">${it.title} (${it.channel})</div>`;
    }

    const elapsed = performance.now() - t0;
    console.log(`     ⚡ [측정 결과] 1,000건 렌더링 연산 시간: ${elapsed.toFixed(2)}ms (예산: < 30ms)`);
    assert(elapsed < 30, `1,000건 렌더링 시간은 30ms 미만이어야 하나 ${elapsed.toFixed(2)}ms 소요됨`);
    assert.strictEqual(valid.length, 1000);
    assert(cardHtmlBuffer.length > 0);
  });

  // ─────────────────────────────────────────────────────────────
  // 2. 마이크로 캐시(Micro-SWR) 추출 및 정렬 벤치마크 (< 5ms)
  // ─────────────────────────────────────────────────────────────
  runner.test('Benchmark 2: 마이크로 캐시(0.05초 즉시 팝업 로딩용) 15건 추출 속도 (< 5ms)', () => {
    // 550건 실데이터 규모의 일정 준비
    const mockSchedules = [];
    const now = Date.now();
    for (let i = -200; i < 350; i++) {
      mockSchedules.push({
        id: `item_${i}`,
        title: `스케줄 ${i}`,
        startTime: new Date(now + i * 86400000).toISOString()
      });
    }

    const t0 = performance.now();

    // dashboard.js의 getRelevantSchedulesForCache 알고리즘 벤치마크
    const clean = mockSchedules.filter(s => s && s.title && s.startTime);
    const sorted = [...clean].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    let nextIdx = sorted.findIndex(item => new Date(item.startTime).getTime() >= now);
    if (nextIdx === -1) nextIdx = Math.max(0, sorted.length - 15);
    const start = Math.max(0, nextIdx - 5);
    const relevant = sorted.slice(start, start + 15);

    const elapsed = performance.now() - t0;
    console.log(`     ⚡ [측정 결과] 마이크로 캐시 추출 시간: ${elapsed.toFixed(2)}ms (예산: < 5ms)`);
    assert(elapsed < 5, `마이크로 캐시 추출 시간은 5ms 미만이어야 하나 ${elapsed.toFixed(2)}ms 소요됨`);
    assert.strictEqual(relevant.length, 15);
  });

  // ─────────────────────────────────────────────────────────────
  // 3. 백엔드 스케줄 머지 및 클러스터링 벤치마크 (< 150ms)
  // ─────────────────────────────────────────────────────────────
  runner.test('Benchmark 3: 500건 일정의 유사도 판별 및 ID 선출 머지 연산 (< 150ms)', () => {
    const raw500 = [];
    for (let i = 0; i < 250; i++) {
      raw500.push({
        id: `blip_${i}`,
        source: 'blip',
        title: `뮤직뱅크 리센느 생방송 ${i}`,
        startTime: '2026-09-15T17:00:00+09:00',
        channel: 'KBS2',
        starAttendees: [{ name: '원이' }]
      });
      raw500.push({
        id: `mnet_${i}`,
        source: 'mnet',
        title: `KBS2 뮤직뱅크 ${i}`,
        startTime: '2026-09-15T17:00:00+09:00',
        channel: 'KBS2'
      });
    }

    const t0 = performance.now();

    // v2.0 정규화 및 클러스터링 알고리즘 시뮬레이션
    const clusters = new Map();
    raw500.forEach(item => {
      const key = `${item.startTime.slice(0, 10)}_${item.channel || ''}`;
      if (!clusters.has(key)) {
        clusters.set(key, []);
      }
      clusters.get(key).push(item);
    });

    const mergedResults = [];
    clusters.forEach(group => {
      // 1건 선출 및 starAttendees 합성
      const primary = group[0];
      const mergedAttendees = [];
      group.forEach(g => {
        if (g.starAttendees) mergedAttendees.push(...g.starAttendees);
      });
      mergedResults.push({
        ...primary,
        starAttendees: mergedAttendees,
        linkedScheduleIds: group.map(g => g.id)
      });
    });

    const elapsed = performance.now() - t0;
    console.log(`     ⚡ [측정 결과] 500건 머지/클러스터링 시간: ${elapsed.toFixed(2)}ms (예산: < 150ms)`);
    assert(elapsed < 150, `머지 클러스터링 시간은 150ms 미만이어야 하나 ${elapsed.toFixed(2)}ms 소요됨`);
    assert(mergedResults.length > 0);
  });

  // ─────────────────────────────────────────────────────────────
  // 4. 백그라운드 서비스 워커 변경 감지(Diff) 연산 (< 3ms)
  // ─────────────────────────────────────────────────────────────
  runner.test('Benchmark 4: 백그라운드 5분 주기 로컬 vs 원격 데이터 diff 연산 속도 (< 3ms)', () => {
    const COMPARE_KEYS = [
      'latestVideos', 'officialPlaylistVideos', 'woniVideos',
      'isLive', 'isLiveStreaming', 'liveVideoInfo', 'activeSchedules',
      'xFeeds', 'instaFeeds', 'tiktokFeeds'
    ];

    const currentStorage = {
      latestVideos: Array.from({ length: 20 }, (_, i) => ({ id: `v_${i}`, title: `Vid ${i}` })),
      activeSchedules: Array.from({ length: 30 }, (_, i) => ({ id: `s_${i}`, title: `Sched ${i}` })),
      isLive: false
    };

    const incomingData = {
      latestVideos: Array.from({ length: 20 }, (_, i) => ({ id: `v_${i}`, title: `Vid ${i}` })),
      activeSchedules: Array.from({ length: 30 }, (_, i) => ({ id: `s_${i}`, title: `Sched ${i}` })),
      isLive: false
    };

    const t0 = performance.now();

    // JSON 문자열 비교 기반 초고속 diff
    let hasChanged = false;
    for (const key of COMPARE_KEYS) {
      if (JSON.stringify(currentStorage[key]) !== JSON.stringify(incomingData[key])) {
        hasChanged = true;
        break;
      }
    }

    const elapsed = performance.now() - t0;
    console.log(`     ⚡ [측정 결과] 백그라운드 Diff 연산 시간: ${elapsed.toFixed(2)}ms (예산: < 3ms)`);
    assert(elapsed < 3, `Diff 연산 시간은 3ms 미만이어야 하나 ${elapsed.toFixed(2)}ms 소요됨`);
    assert.strictEqual(hasChanged, false, '동일 데이터는 변경 없음으로 판별');
  });

  // ─────────────────────────────────────────────────────────────
  // 5. 배포 데이터 페이로드 용량 예산 준수 검증
  // ─────────────────────────────────────────────────────────────
  runner.test('Budget 5: core.json <= 80KB 및 schedules.json <= 300KB 예산 엄격 준수', () => {
    const corePath = path.join(ROOT_DIR, 'docs/api/v1/core.json');
    const schedulesPath = path.join(ROOT_DIR, 'docs/api/v1/schedules.json');

    if (fs.existsSync(corePath)) {
      const coreSizeKb = fs.statSync(corePath).size / 1024;
      console.log(`     📦 core.json 현재 용량: ${coreSizeKb.toFixed(1)}KB (상한 예산: 80KB)`);
      assert(coreSizeKb <= 80, `core.json 크기는 80KB 이하이어야 함: ${coreSizeKb.toFixed(1)}KB`);
    }

    if (fs.existsSync(schedulesPath)) {
      const schedSizeKb = fs.statSync(schedulesPath).size / 1024;
      console.log(`     📦 schedules.json 현재 용량: ${schedSizeKb.toFixed(1)}KB (상한 예산: 300KB)`);
      assert(schedSizeKb <= 300, `schedules.json 크기는 300KB 이하이어야 함: ${schedSizeKb.toFixed(1)}KB`);
    }
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('benchmark.test.js')) {
  run().then(res => {
    if (res.failed > 0) process.exit(1);
  });
}
