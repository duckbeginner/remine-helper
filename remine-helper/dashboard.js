// dashboard.js - 0.05초 초고속 대시보드 진입점 (Page Visibility Throttling & Lazy Mounting)
import { TAB_CONFIG_LIST, OFFICIAL_CHANNELS, FANPAGE_LIST, CHANNEL_DATA_MAP, DEFAULT_TIKTOK_FEEDS, DEFAULT_USER_SETTINGS, ICONS } from './constants.js';
import {
  createTabBarHTML,
  createTabContainersHTML,
  createLiveBannerHTML,
  createDashboardHeaderControlsHTML,
  createHubCardHTML,
  createYoutubeSectionHTML,
  createWoniSectionHTML,
  createFanpageCardHTML,
  createStickyFooterHTML,
  createScheduleModalHTML,
  createSettingsModalHTML
} from './common/templates.js';
import {
  initThemeEngine,
  initTabEngine,
  initCalendarManager,
  initAppStorageData,
  initScheduleModal,
  initSettingsModal,
  parseUserSettings,
  loadUserSettings,
  initNavPosition,
  renderInstaEmbeds,
  renderXEmbeds,
  renderTiktokEmbeds,
  requestBackgroundRefresh
} from './common/common.js';

// --- 경량 마이크로 캐시 (Micro-SWR Cache: 5KB 미만으로 0.1ms 즉시 파싱) ---
const MICRO_CACHE_KEY = '__remine_micro_cache__';

function getMicroCache() {
  try {
    const raw = localStorage.getItem(MICRO_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function getRelevantSchedulesForCache(schedules) {
  if (!Array.isArray(schedules) || schedules.length === 0) return [];
  const now = new Date().getTime();
  const sorted = [...schedules].sort((a, b) => {
    const tA = (a.startTime || a.date) ? new Date(a.startTime || a.date).getTime() : 0;
    const tB = (b.startTime || b.date) ? new Date(b.startTime || b.date).getTime() : 0;
    return tA - tB;
  });
  let nextIdx = sorted.findIndex(item => {
    const t = (item.startTime || item.date) ? new Date(item.startTime || item.date).getTime() : 0;
    return t >= now;
  });
  if (nextIdx === -1) nextIdx = Math.max(0, sorted.length - 15);
  const start = Math.max(0, nextIdx - 5);
  const end = Math.min(sorted.length, start + 30);
  return sorted.slice(start, end);
}

function setMicroCache(data) {
  try {
    if (!data) return;
    const micro = {
      userSettings: data.userSettings,
      latestVideos: (data.latestVideos || []).slice(0, 6),
      officialPlaylistVideos: (data.officialPlaylistVideos || []).slice(0, 6),
      woniVideos: (data.woniVideos || []).slice(0, 6),
      blipSchedules: getRelevantSchedulesForCache(data.blipSchedules),
      isLive: data.isLive,
      channelOrder: data.channelOrder
    };
    localStorage.setItem(MICRO_CACHE_KEY, JSON.stringify(micro));
  } catch (e) { }
}

document.addEventListener('DOMContentLoaded', () => {
  const liveBannerMount = document.getElementById('liveBannerMount');
  const tabBarMount = document.getElementById('tabBarMount');
  const tabContainersMount = document.getElementById('tabContainersMount');
  const rightColMount = document.getElementById('dashboardRightColMount');
  const modalMount = document.getElementById('modalMount');

  if (liveBannerMount) liveBannerMount.innerHTML = createLiveBannerHTML();

  const microCache = getMicroCache();
  const initialSettings = microCache && microCache.userSettings ? parseUserSettings(microCache.userSettings) : DEFAULT_USER_SETTINGS;

  const feedCache = {
    insta: null,
    x: null,
    tiktok: DEFAULT_TIKTOK_FEEDS
  };

  let calendarManager = null;
  let currentTabList = initialSettings.tabList;
  let currentFanpages = initialSettings.fanpages;
  let isScheduleModalMounted = false;
  let isSettingsModalMounted = false;
  let isSyncPending = false;

  let fullStorageData = microCache || null;

  function ensureScheduleModal() {
    if (isScheduleModalMounted) return;
    isScheduleModalMounted = true;
    if (modalMount) {
      modalMount.insertAdjacentHTML('beforeend', createScheduleModalHTML());
      initScheduleModal();
    }
  }

  function ensureSettingsModal() {
    if (isSettingsModalMounted) return;
    isSettingsModalMounted = true;
    if (modalMount) {
      modalMount.insertAdjacentHTML('beforeend', createSettingsModalHTML());
      initSettingsModal({
        onTabsChanged: (newTabList) => {
          loadUserSettings((u) => renderDashboardViews(newTabList, u.fanpages, { cachedStorage: fullStorageData }));
        },
        onFanpagesChanged: (newFanpages) => {
          loadUserSettings((u) => renderDashboardViews(u.tabList, newFanpages, { cachedStorage: fullStorageData }));
        },
        onNavPositionChanged: (newPos) => {
          initNavPosition(newPos);
        }
      });
    }
  }

  function renderDashboardViews(tabList = currentTabList, fanpages = currentFanpages, { cachedStorage = null } = {}) {
    currentTabList = tabList;
    currentFanpages = fanpages;
    const effectiveStorage = cachedStorage || fullStorageData || microCache;

    const dashboardTabs = tabList.filter(t => t.id !== 'tabHome' && t.id !== 'tabShorts').map(t => ({
      ...t,
      defaultActive: t.id === 'tabSchedule'
    }));

    if (tabBarMount) {
      tabBarMount.innerHTML = createTabBarHTML(dashboardTabs, { tabBarId: 'dashboardTabBar', activeTabId: 'tabSchedule' });
    }
    if (tabContainersMount) {
      tabContainersMount.innerHTML = createTabContainersHTML(dashboardTabs, 'tabSchedule');
    }
    if (rightColMount) {
      rightColMount.innerHTML = [
        createHubCardHTML(OFFICIAL_CHANNELS, CHANNEL_DATA_MAP, { showControls: false }),
        createYoutubeSectionHTML(),
        createWoniSectionHTML(),
        createFanpageCardHTML(fanpages),
        createStickyFooterHTML()
      ].join('\n');
    }

    calendarManager = initCalendarManager({
      gridId: 'spCalendarGrid',
      titleId: 'spCalendarMonthTitle',
      prevBtnId: 'spPrevMonthBtn',
      nextBtnId: 'spNextMonthBtn'
    });

    initTabEngine(document.getElementById('dashboardTabBar'), document.getElementById('tabGlassSlider'), dashboardTabs, {
      onTabChange: (targetId, tabConfig, loadedMap) => {
        const isDark = document.documentElement.classList.contains('dark-mode') || document.body.classList.contains('dark-mode');
        if (targetId === 'tabInsta') {
          chrome.storage.local.get(['instaFeeds'], (res) => {
            const feeds = (res && res.instaFeeds) || feedCache.insta;
            if (feeds && feeds.length > 0) {
              const hash = JSON.stringify(feeds.map(f => f.id || f.shortcode || f.link));
              if (loadedMap[targetId] !== hash) {
                loadedMap[targetId] = hash;
                feedCache.insta = feeds;
                renderInstaEmbeds(document.getElementById('instaFeedList'), feeds, isDark);
              }
            }
          });
        } else if (targetId === 'tabX') {
          chrome.storage.local.get(['xFeeds'], (res) => {
            const feeds = (res && res.xFeeds) || feedCache.x;
            if (feeds && feeds.length > 0) {
              const hash = JSON.stringify(feeds.map(f => f.id || f.link));
              if (loadedMap[targetId] !== hash) {
                loadedMap[targetId] = hash;
                feedCache.x = feeds;
                renderXEmbeds(document.getElementById('xFeedList'), feeds, isDark);
              }
            }
          });
        } else if (targetId === 'tabTiktok') {
          chrome.storage.local.get(['tiktokFeeds'], (res) => {
            const feeds = (res && res.tiktokFeeds) || feedCache.tiktok || DEFAULT_TIKTOK_FEEDS;
            const hash = JSON.stringify((feeds || []).map(f => f.id || f.link));
            if (loadedMap[targetId] !== hash) {
              loadedMap[targetId] = hash;
              feedCache.tiktok = feeds;
              renderTiktokEmbeds(document.getElementById('tiktokFeedList'), feeds, isDark);
            }
          });
        }
      }
    });

    if (effectiveStorage) {
      initAppStorageData({
        hubContainerId: 'hubContainer',
        liveBannerId: 'liveBanner',
        youtubeListId: 'youtubeList',
        playlistId: 'playlistYoutubeList',
        woniListId: 'woniYoutubeList',
        cachedData: effectiveStorage,
        onSchedulesLoaded: (schedules) => {
          if (calendarManager) calendarManager.setSchedules(schedules);
        }
      });
    }
  }

  // =========================================================================
  // Step 1: 0ms 동기식 즉시 마운트 (SWR Instant Mount & Hydration)
  // =========================================================================
  const headerControlsMount = document.getElementById('dashboardHeaderControls');
  if (headerControlsMount) {
    headerControlsMount.innerHTML = createDashboardHeaderControlsHTML();
  }

  initNavPosition(initialSettings.navPosition || 'left');
  renderDashboardViews(initialSettings.tabList, initialSettings.fanpages, { cachedStorage: microCache });

  // 캘린더 최대화 버튼 바인딩
  const maximizeBtn = document.getElementById('maximizeCalendarBtn');
  if (maximizeBtn) {
    maximizeBtn.addEventListener('click', () => {
      const isMaximized = document.body.classList.toggle('calendar-maximized');
      maximizeBtn.innerHTML = isMaximized
        ? `${ICONS.minimize}축소`
        : `${ICONS.maximize}최대화`;
    });
  }

  // 전역 이벤트 위임: 설정 버튼 또는 스케줄 클릭 시 온디맨드 모달 마운트
  document.addEventListener('click', (e) => {
    if (e.target.closest('#openSettingsBtn')) {
      ensureSettingsModal();
    } else if (e.target.closest('.schedule-item, .cal-event-badge, .schedule-calendar-item')) {
      ensureScheduleModal();
    }
  }, true);

  // =========================================================================
  // Step 2: 브라우저 유휴 시간 백그라운드 스토리지 동기화 (Visibility Aware)
  // =========================================================================
  const syncTask = () => {
    // 탭이 백그라운드에 있으면 사이드패널 오픈 중 자원 경합을 방지하기 위해 동기화 보류
    if (document.hidden) {
      isSyncPending = true;
      return;
    }
    isSyncPending = false;

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(
        [
          'userSettings',
          'themeMode',
          'latestVideos',
          'officialPlaylistVideos',
          'woniVideos',
          'blipSchedules',
          'isLive',
          'isLiveStreaming',
          'liveVideoInfo',
          'channelOrder',
          'instaFeeds',
          'xFeeds',
          'tiktokFeeds'
        ],
        (res) => {
          if (!res) return;
          setMicroCache(res);

          initThemeEngine(document.getElementById('themeToggleBtn'), {
            initialMode: res.themeMode || 'system'
          });

          if (res.instaFeeds) feedCache.insta = res.instaFeeds;
          if (res.xFeeds) feedCache.x = res.xFeeds;
          if (res.tiktokFeeds && res.tiktokFeeds.length > 0) feedCache.tiktok = res.tiktokFeeds;

          const settings = parseUserSettings(res.userSettings);
          if (settings.navPosition) {
            initNavPosition(settings.navPosition);
          }

          const tabListChanged = JSON.stringify(settings.tabList) !== JSON.stringify(currentTabList);
          const fanpagesChanged = JSON.stringify(settings.fanpages) !== JSON.stringify(currentFanpages);

          if (tabListChanged || fanpagesChanged) {
            renderDashboardViews(settings.tabList, settings.fanpages, { cachedStorage: res });
          } else {
            initAppStorageData({
              hubContainerId: 'hubContainer',
              liveBannerId: 'liveBanner',
              youtubeListId: 'youtubeList',
              playlistId: 'playlistYoutubeList',
              woniListId: 'woniYoutubeList',
              cachedData: res,
              onSchedulesLoaded: (schedules) => {
                if (calendarManager) calendarManager.setSchedules(schedules);
              }
            });
          }
        }
      );
    } else {
      initThemeEngine(document.getElementById('themeToggleBtn'));
    }
  };

  // 대시보드 탭으로 다시 돌아왔을 때 즉시 최신 상태 재동기화
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      syncTask();
    }
  });

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      syncTask();
      requestBackgroundRefresh();
    }, { timeout: 100 });
  } else {
    setTimeout(() => {
      syncTask();
      requestBackgroundRefresh();
    }, 30);
  }
});

