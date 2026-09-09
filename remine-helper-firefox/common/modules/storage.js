// common/modules/storage.js - 크롬 스토리지 연동, 닉네임/아바타 매핑 및 백그라운드 갱신 요청
import { MEMBER_NICKNAME_MAP, MEMBER_AVATAR_MAP } from '../../constants.js';
import { renderOfficialYoutubeList, renderWoniYoutubeList, extractAllShortsVideos, renderShortsList } from './youtube.js';
import { setupHorizontalScroller, setupHubIconReordering } from './tabs.js';
import { renderScheduleList } from './calendar.js';

export function getMemberDisplayName(rawNickname) {
  if (!rawNickname) return '멤버';
  const trimmed = String(rawNickname).trim();
  if (MEMBER_NICKNAME_MAP && MEMBER_NICKNAME_MAP[trimmed]) return MEMBER_NICKNAME_MAP[trimmed];
  if (MEMBER_NICKNAME_MAP) {
    for (const [nick, realName] of Object.entries(MEMBER_NICKNAME_MAP)) {
      if (trimmed.includes(nick) || nick.includes(trimmed)) return realName;
    }
  }
  return trimmed;
}

export function getMemberAvatarUrl(realName, fallbackImg) {
  if (!realName) return fallbackImg || '';
  const trimmed = String(realName).trim();
  if (MEMBER_AVATAR_MAP && MEMBER_AVATAR_MAP[trimmed]) return MEMBER_AVATAR_MAP[trimmed];
  if (MEMBER_AVATAR_MAP) {
    for (const [name, url] of Object.entries(MEMBER_AVATAR_MAP)) {
      if (trimmed.includes(name) || name.includes(trimmed)) return url;
    }
  }
  return fallbackImg || '';
}


export const EXCLUDE_SCHEDULE_REGEX = /(직캠|풀캠|팬캠|페이스캠|입덕직캠|최애직캠|팔로우캠|안방1열|음중직캠|음중풀캠|음중팔로우캠|fan\W*cam|k\W*fancam|choreo|fancam|\bcam\b|투표|사전투표|실시간투표|\bvote\b|\bvoting\b|\bpoll\b|덕애드|스타패스|아이돌챔프|뮤빗|팬플러스|포도알|케이돌|엠넷플러스\s*투표)/i;

export function filterAndDeduplicateSchedules(schedules) {
  if (!Array.isArray(schedules) || schedules.length === 0) return [];
  const seen = new Set();
  const results = [];

  for (const item of schedules) {
    if (!item) continue;
    // 관리자가 직접 생성했거나 수정한 커스텀 일정은 키워드 매칭과 무관하게 100% 보존
    if (!item._isCustom) {
      const text = (item.title || "") + " " + (item.message || "");
      if (EXCLUDE_SCHEDULE_REGEX.test(text)) continue;
    }

    // 중복 제거 가드 (동일 ID 또는 동일 시작일+제목)
    const key = item.id || `${(item.startTime || '').slice(0, 10)}_${item.title}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push(item);
  }

  return results;
}

export function initAppStorageData({
  hubContainerId = 'hubContainer',
  liveBannerId = 'liveBanner',
  youtubeListId = 'youtubeList',
  playlistId = 'playlistYoutubeList',
  woniListId = 'woniYoutubeList',
  shortsListId = 'shortsGridList',
  scheduleListId = 'scheduleList',
  onSchedulesLoaded,
  onDataLoaded,
  cachedData = null
} = {}) {
  const processResult = (result) => {
    if (!result) return;

    // 1. 유튜브 비디오 렌더링 및 수평 스크롤러 적용
    const ytEl = typeof youtubeListId === 'string' ? document.getElementById(youtubeListId) : youtubeListId;
    const plyEl = typeof playlistId === 'string' ? document.getElementById(playlistId) : playlistId;
    const woniEl = typeof woniListId === 'string' ? document.getElementById(woniListId) : woniListId;
    const shortsEl = typeof shortsListId === 'string' ? document.getElementById(shortsListId) : shortsListId;

    if (ytEl && result.latestVideos) {
      renderOfficialYoutubeList(ytEl, result.latestVideos);
      setupHorizontalScroller(ytEl);
    }
    if (plyEl && result.officialPlaylistVideos) {
      renderOfficialYoutubeList(plyEl, result.officialPlaylistVideos);
      setupHorizontalScroller(plyEl);
    }
    if (woniEl && result.woniVideos) {
      renderWoniYoutubeList(woniEl, result.woniVideos);
      setupHorizontalScroller(woniEl);
    }
    if (document.getElementById('shortsTabFrame')) {
      const targetShortsEl = shortsEl || document.getElementById('tabShorts');
      const shorts = extractAllShortsVideos(result);
      renderShortsList(targetShortsEl, shorts);
    }

    // 2. 실시간 라이브 배너 연동
    const liveBanner = typeof liveBannerId === 'string' ? document.getElementById(liveBannerId) : liveBannerId;
    if (liveBanner) {
      if ((result.isLive || result.isLiveStreaming) && (result.liveVideoInfo || (result.latestVideos && result.latestVideos.length > 0))) {
        liveBanner.style.display = 'block';
        const liveUrl = (result.liveVideoInfo && result.liveVideoInfo.url) || 'https://www.youtube.com/@RESCENE_official/live';
        liveBanner.href = liveUrl;
        liveBanner.onclick = (e) => {
          e.preventDefault();
          window.open(liveUrl, '_blank');
        };
      } else {
        liveBanner.style.display = 'none';
        liveBanner.onclick = null;
      }
    }

    // 3. 채널 아이콘 순서 복원 및 드래그 정렬 엔진 바인딩
    const hubEl = typeof hubContainerId === 'string' ? document.getElementById(hubContainerId) : hubContainerId;
    if (hubEl) {
      if (result.channelOrder && Array.isArray(result.channelOrder)) {
        const currentBtns = Array.from(hubEl.querySelectorAll('.hub-icon-btn'));
        const btnMap = {};
        currentBtns.forEach(b => { btnMap[b.getAttribute('data-key')] = b; });
        result.channelOrder.forEach(key => {
          if (btnMap[key]) {
            hubEl.appendChild(btnMap[key]);
            delete btnMap[key];
          }
        });
        // channelOrder에 없는 신규 채널(예: x_twt)도 누락 없이 표시
        Object.values(btnMap).forEach(btn => {
          hubEl.appendChild(btn);
        });
      }
      setupHubIconReordering(hubEl, (newOrder) => {
        chrome.storage.local.set({ channelOrder: newOrder });
      });
    }

    // 4. 스케줄 리스트 렌더링 (대상이 존재하거나 콜백이 요청되었을 때만 처리하여 불필요한 초기 지연 제거)
    const schedEl = typeof scheduleListId === 'string' ? document.getElementById(scheduleListId) : scheduleListId;
    const tabSchedEl = document.getElementById('tabScheduleList');

    if ((schedEl || tabSchedEl || typeof onSchedulesLoaded === 'function') && result.blipSchedules) {
      const cleanSchedules = filterAndDeduplicateSchedules(result.blipSchedules);

      if (schedEl && cleanSchedules) {
        renderScheduleList(schedEl, cleanSchedules);
      }
      if (tabSchedEl && cleanSchedules) {
        renderScheduleList(tabSchedEl, cleanSchedules);
      }

      // 5. 스케줄 데이터 콜백 (캘린더 매니저 등)
      if (typeof onSchedulesLoaded === 'function' && cleanSchedules) {
        onSchedulesLoaded(cleanSchedules);
      }
    }

    // 6. 전체 데이터 로드 완료 콜백
    if (typeof onDataLoaded === 'function') {
      onDataLoaded(result);
    }
  };

  // 1. 이미 메모리에 로드된 캐시 데이터가 있으면 즉시 0ms 렌더링
  if (cachedData) {
    processResult(cachedData);
  }

  // 2. 비동기 백그라운드 스토리지 재검증 (SWR Revalidate)
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const storageKeys = [
      'latestVideos',
      'officialPlaylistVideos',
      'woniVideos',
      'blipSchedules',
      'isLive',
      'isLiveStreaming',
      'liveVideoInfo',
      'themeMode',
      'channelOrder'
    ];

    // 캐시가 있었더라도 최신 스토리지 데이터로 재검증
    chrome.storage.local.get(storageKeys, (res) => {
      if (res) processResult(res);
    });

    // 3. 실시간 스토리지 변경 감지 (라이브 시작/종료, 새 영상 등록 즉시 화면 반영)
    if (!window.__remine_storage_listener_attached__) {
      window.__remine_storage_listener_attached__ = true;
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;

        // 라이브 상태 변경 시 배너 즉시 반영
        if (changes.isLive || changes.liveVideoInfo || changes.isLiveStreaming) {
          const liveBanner = typeof liveBannerId === 'string' ? document.getElementById(liveBannerId) : liveBannerId;
          if (liveBanner) {
            chrome.storage.local.get(['isLive', 'isLiveStreaming', 'latestVideos', 'liveVideoInfo'], (res) => {
              if (res && (res.isLive || res.isLiveStreaming)) {
                liveBanner.style.display = 'block';
                const liveUrl = (res.liveVideoInfo && res.liveVideoInfo.url) || 'https://www.youtube.com/@RESCENE_official/live';
                liveBanner.href = liveUrl;
                liveBanner.onclick = (e) => {
                  e.preventDefault();
                  window.open(liveUrl, '_blank');
                };
              } else {
                liveBanner.style.display = 'none';
                liveBanner.onclick = null;
              }
            });
          }
        }

        // 관련 데이터 변경 시 전체 재검증
        const hasRelevantChanges = Object.keys(changes).some(k => storageKeys.includes(k));
        if (hasRelevantChanges) {
          chrome.storage.local.get(storageKeys, (res) => {
            if (res) processResult(res);
          });
        }
      });
    }
  }
}

/* =========================================================================
   11. 통합 사용자 설정 엔진 (User Settings Management Engine)
   ========================================================================= */

// 동기식 사용자 설정 파서 (기본값 및 원본 메타데이터 안전 병합)

export function requestBackgroundRefresh(force = false) {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      chrome.runtime.sendMessage({ action: "REFRESH_ALL_DATA", force }, (_response) => {
        if (chrome.runtime.lastError) {
          // 백그라운드 서비스 워커 준비 중이거나 응답 채널 종료 시 에러 무시
          console.debug('[RemineHelper] Background refresh message skipped:', chrome.runtime.lastError.message);
        }
      });
    } catch (_e) {
      console.debug('[RemineHelper] Failed to send refresh message:', _e);
    }
  }
}
