// tests/client/unnecessary-refresh-prevent.test.js
// 불필요한 화면 갱신 방지 (3중 방어선) 단위 테스트

import { TestRunner, assert } from '../test-helper.js';

export async function run() {
  const runner = new TestRunner('Client - Skip Unnecessary Refresh Prevention');
  runner.run();

  // ─────────────────────────────────────────────────────────────
  // 1. Background Service Worker: applyCentralDataToStorage 변경 감지 로직
  // ─────────────────────────────────────────────────────────────
  runner.test('Background: 데이터 변경 없을 때 무거운 스토리지 갱신 방지 및 ETag만 갱신', async () => {
    const COMPARE_KEYS = [
      'latestVideos', 'officialPlaylistVideos', 'woniVideos',
      'isLive', 'isLiveStreaming', 'liveVideoInfo', 'activeSchedules',
      'xFeeds', 'instaFeeds', 'tiktokFeeds'
    ];

    // 기존 스토리지 상태 모킹
    const mockStorage = {
      latestVideos: [{ id: 'vid1', title: 'Video 1' }],
      officialPlaylistVideos: [],
      woniVideos: [],
      isLive: false,
      isLiveStreaming: false,
      liveVideoInfo: null,
      activeSchedules: [{ id: 'sch1', title: 'Schedule 1' }],
      xFeeds: [{ id: 'x1' }],
      instaFeeds: [],
      tiktokFeeds: [],
      blipSchedules: [{ id: 'sch1', title: 'Schedule 1' }],
      schedulesMasterUpdatedAt: '2026-09-12T00:00:00Z',
      centralCoreEtag: '"etag-1"'
    };

    let setCalledWith = null;

    // 모의 함수: 변경 감지 알고리즘 시뮬레이션
    function simulateApplyCentralData(data, currentLocal, force = false) {
      if (!data || data.notModified) return false;

      const isLive = Boolean(data.youtube?.isLive);
      const liveInfo = data.youtube?.liveInfo || null;
      let latestVideos = [...(data.youtube?.officialVideos || [])];

      const activeSchedules = data.schedules?.activeItems || data.schedules?.items || [];
      const masterUpdatedAt = data.schedules?.masterUpdatedAt || data.updatedAt || null;

      const storagePayload = {
        latestVideos,
        officialPlaylistVideos: data.youtube?.playlistVideos || [],
        woniVideos: data.youtube?.woniVideos || [],
        isLive,
        isLiveStreaming: isLive,
        liveVideoInfo: liveInfo,
        activeSchedules,
        xFeeds: data.sns?.x || [],
        instaFeeds: data.sns?.instagram || [],
        tiktokFeeds: data.sns?.tiktok || []
      };

      const hasDataChange = COMPARE_KEYS.some(key =>
        JSON.stringify(storagePayload[key]) !== JSON.stringify(currentLocal[key])
      );

      const needMasterSync = Boolean(
        !currentLocal.blipSchedules || currentLocal.blipSchedules.length === 0 ||
        (masterUpdatedAt && currentLocal.schedulesMasterUpdatedAt !== masterUpdatedAt)
      );

      if (!force && !hasDataChange && !needMasterSync) {
        if (data._newEtag) {
          setCalledWith = {
            centralCoreEtag: data._newEtag,
            lastCentralSyncTime: 12345
          };
        }
        return false;
      }

      setCalledWith = storagePayload;
      return true;
    }

    // 케이스 1: 동일 데이터가 들어왔을 때
    const incomingSameData = {
      _newEtag: '"etag-2"',
      updatedAt: '2026-09-12T00:00:00Z',
      youtube: {
        isLive: false,
        liveInfo: null,
        officialVideos: [{ id: 'vid1', title: 'Video 1' }],
        playlistVideos: [],
        woniVideos: []
      },
      schedules: {
        activeItems: [{ id: 'sch1', title: 'Schedule 1' }],
        masterUpdatedAt: '2026-09-12T00:00:00Z'
      },
      sns: {
        x: [{ id: 'x1' }],
        instagram: [],
        tiktok: []
      }
    };

    const resSame = simulateApplyCentralData(incomingSameData, mockStorage, false);
    assert.strictEqual(resSame, false, '데이터 변경 없으면 false 반환');
    assert.strictEqual(setCalledWith.centralCoreEtag, '"etag-2"', 'ETag만 갱신');
    assert.strictEqual(setCalledWith.latestVideos, undefined, '전체 스토리지 페이로드 저장 생략');

    // 케이스 2: 새 영상이 추가되었을 때
    const incomingNewVideo = {
      ...incomingSameData,
      youtube: {
        ...incomingSameData.youtube,
        officialVideos: [{ id: 'vid1', title: 'Video 1' }, { id: 'vid2', title: 'Video 2' }]
      }
    };
    const resNew = simulateApplyCentralData(incomingNewVideo, mockStorage, false);
    assert.strictEqual(resNew, true, '새 영상 있을 때 true 반환');
    assert.strictEqual(setCalledWith.latestVideos.length, 2, '전체 스토리지 페이로드 기록');

    // 케이스 3: force = true인 경우 동일 데이터여도 전체 기록
    setCalledWith = null;
    const resForce = simulateApplyCentralData(incomingSameData, mockStorage, true);
    assert.strictEqual(resForce, true, 'force=true 시 true 반환');
    assert(setCalledWith.latestVideos !== undefined, 'force=true 시 전체 페이로드 기록');

    // 케이스 4: activeSchedules 또는 liveVideoInfo만 단독 변경되었을 때도 정상 감지
    const incomingNewSchedule = {
      ...incomingSameData,
      schedules: {
        ...incomingSameData.schedules,
        activeItems: [{ id: 'sch2', title: 'New Schedule' }]
      }
    };
    const resSchedule = simulateApplyCentralData(incomingNewSchedule, mockStorage, false);
    assert.strictEqual(resSchedule, true, '스케줄 변경 감지');
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Storage Module: onChanged 리스너의 실질적 변경 키 필터링
  // ─────────────────────────────────────────────────────────────
  runner.test('Storage: onChanged에서 실질적 변경(newValue !== oldValue)이 있는 키만 선별', () => {
    const storageKeys = ['latestVideos', 'activeSchedules', 'isLive'];

    function filterRealChanges(changes) {
      const realChanges = {};
      for (const [key, change] of Object.entries(changes)) {
        // 관심 있는 키 또는 라이브 상태 키만 검사
        if (!storageKeys.includes(key) && key !== 'isLive' && key !== 'liveVideoInfo' && key !== 'isLiveStreaming') {
          continue;
        }
        if (JSON.stringify(change.newValue) !== JSON.stringify(change.oldValue)) {
          realChanges[key] = change;
        }
      }
      return realChanges;
    }

    // 1) 값 내용이 완전히 동일한 changes 이벤트 (단순 재기록 등)
    const identicalChanges = {
      latestVideos: {
        oldValue: [{ id: 'v1', title: 'Test' }],
        newValue: [{ id: 'v1', title: 'Test' }]
      },
      lastCentralSyncTime: {
        oldValue: 1000,
        newValue: 2000
      }
    };
    const filtered1 = filterRealChanges(identicalChanges);
    assert.strictEqual(Object.keys(filtered1).length, 0, '동일 데이터 및 무관 키 필터링으로 빈 객체 반환');

    // 2) 실제 값이 달라진 changes 이벤트
    const actualChanges = {
      latestVideos: {
        oldValue: [{ id: 'v1', title: 'Test' }],
        newValue: [{ id: 'v1', title: 'Test' }, { id: 'v2', title: 'New' }]
      }
    };
    const filtered2 = filterRealChanges(actualChanges);
    assert.strictEqual(Object.keys(filtered2).length, 1, '실제 변경 키만 포함');
    assert(filtered2.latestVideos !== undefined);
  });

  // ─────────────────────────────────────────────────────────────
  // 3. Sidepanel / Dashboard: syncTask 해시 비교 재렌더링 차단
  // ─────────────────────────────────────────────────────────────
  runner.test('Views: syncTask에서 동일 데이터 해시 수신 시 initAppStorageData 호출 차단', () => {
    let renderCallCount = 0;
    let lastSyncDataHash = '';

    function computeDataHash(res) {
      return JSON.stringify([
        (res.latestVideos || []).map(v => v.id),
        (res.officialPlaylistVideos || []).map(v => v.id),
        (res.woniVideos || []).map(v => v.id),
        (res.blipSchedules || []).map(s => `${s.id || s.title}_${s.startDateTime || ''}_${s.state || ''}`),
        res.isLive,
        res.channelOrder
      ]);
    }

    function mockSyncTask(res) {
      const dataHash = computeDataHash(res);
      if (dataHash === lastSyncDataHash) {
        return; // 건너뛰기
      }
      lastSyncDataHash = dataHash;
      renderCallCount++;
    }

    const state1 = {
      latestVideos: [{ id: 'v1' }],
      officialPlaylistVideos: [],
      woniVideos: [],
      blipSchedules: [{ id: 's1', startDateTime: '2026-09-12 12:00', state: 'CONFIRMED' }],
      isLive: false,
      channelOrder: ['yt', 'x']
    };

    // 1회차: 최초 실행
    mockSyncTask(state1);
    assert.strictEqual(renderCallCount, 1, '최초 호출 시 렌더링');

    // 2회차: 동일 상태 재호출 (창 전환 등)
    mockSyncTask(state1);
    assert.strictEqual(renderCallCount, 1, '동일 데이터일 때 렌더링 호출 차단');

    // 3회차: 스케줄 상태 또는 시간 변경
    const state2 = {
      ...state1,
      blipSchedules: [{ id: 's1', startDateTime: '2026-09-12 13:00', state: 'CONFIRMED' }]
    };
    mockSyncTask(state2);
    assert.strictEqual(renderCallCount, 2, '스케줄 시간 변경 시 정상 렌더링 호출');

    // 4회차: 라이브 상태 변경
    const state3 = {
      ...state2,
      isLive: true
    };
    mockSyncTask(state3);
    assert.strictEqual(renderCallCount, 3, '라이브 상태 변경 시 정상 렌더링 호출');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('unnecessary-refresh-prevent.test.js')) {
  run().then(res => {
    if (res.failed > 0) process.exit(1);
  });
}
