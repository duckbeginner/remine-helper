// sidepanel.js - 0.01초 극한 가속 (Two-Phase Progressive Mount + Micro-SWR + On-Demand Modals)
import { TAB_CONFIG_LIST, OFFICIAL_CHANNELS, FANPAGE_LIST, CHANNEL_DATA_MAP, DEFAULT_TIKTOK_FEEDS, DEFAULT_USER_SETTINGS } from './constants.js';
import {
  createVerticalSidebarHTML,
  createTabContainersHTML,
  createPrimaryHomeModulesHTML,
  createSecondaryHomeModulesHTML,
  createAllHomeModulesHTML,
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
  requestBackgroundRefresh,
  extractAllShortsVideos,
  renderShortsList,
  pauseAllShortsVideos
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
  } catch (e) {}
}

document.addEventListener('DOMContentLoaded', () => {
  const sidebarMount = document.getElementById('sidebarMount');
  const tabContainersMount = document.getElementById('tabContainersMount');
  const modalMount = document.getElementById('modalMount');

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
          loadUserSettings((u) => renderAppViews(newTabList, u.fanpages, { isInitial: false, cachedStorage: fullStorageData }));
        },
        onFanpagesChanged: (newFanpages) => {
          loadUserSettings((u) => renderAppViews(u.tabList, newFanpages, { isInitial: false, cachedStorage: fullStorageData }));
        },
        onNavPositionChanged: (newPos) => {
          initNavPosition(newPos);
        }
      });
    }
  }

  function ensureCalendarManager() {
    if (calendarManager) return calendarManager;
    calendarManager = initCalendarManager({
      gridId: 'spCalendarGrid',
      titleId: 'spCalendarMonthTitle',
      prevBtnId: 'spPrevMonthBtn',
      nextBtnId: 'spNextMonthBtn'
    });
    if (fullStorageData && fullStorageData.blipSchedules) {
      calendarManager.setSchedules(fullStorageData.blipSchedules);
    }
    return calendarManager;
  }

  // 2단계 점진적 뷰 렌더링 함수
  function renderAppViews(tabList = currentTabList, fanpages = currentFanpages, { isInitial = false, cachedStorage = null } = {}) {
    currentTabList = tabList;
    currentFanpages = fanpages;

    const enabledTabs = (tabList || []).filter(t => t.enabled !== false);
    const firstEnabledTabId = enabledTabs.length > 0 ? enabledTabs[0].id : 'tabHome';

    let activeTabId = firstEnabledTabId;
    if (!isInitial) {
      const currentActiveBtn = sidebarMount ? sidebarMount.querySelector('.vtab-btn.active') : null;
      const currentActiveId = currentActiveBtn ? currentActiveBtn.getAttribute('data-target') : null;
      if (currentActiveId && enabledTabs.some(t => t.id === currentActiveId)) {
        activeTabId = currentActiveId;
      }
    }

    if (sidebarMount) {
      sidebarMount.innerHTML = createVerticalSidebarHTML(tabList, { activeTabId });
    }

    if (tabContainersMount) {
      tabContainersMount.innerHTML = createTabContainersHTML(tabList, activeTabId);
    }

    const homeTabEl = document.getElementById('tabHome');
    const effectiveStorage = cachedStorage || fullStorageData || microCache;

    if (homeTabEl) {
      if (isInitial) {
        // [Phase 1] 0.002초 초경량 즉시 페인팅 (상단 허브 + 공식 유튜브만 먼저 주입)
        homeTabEl.innerHTML = createPrimaryHomeModulesHTML();

        if (effectiveStorage) {
          initAppStorageData({
            hubContainerId: 'hubContainer',
            liveBannerId: 'liveBanner',
            youtubeListId: 'youtubeList',
            playlistId: 'playlistYoutubeList',
            cachedData: effectiveStorage
          });
        }

        // [Phase 2] 1프레임 뒤 스크롤 영역 결합 (원이 채널 + 스케줄 + 팬페이지)
        requestAnimationFrame(() => {
          homeTabEl.insertAdjacentHTML('beforeend', createSecondaryHomeModulesHTML({ fanpages }));
          if (effectiveStorage) {
            initAppStorageData({
              woniListId: 'woniYoutubeList',
              scheduleListId: 'scheduleList',
              cachedData: effectiveStorage,
              onSchedulesLoaded: (schedules) => {
                if (calendarManager) calendarManager.setSchedules(schedules);
              }
            });
          }
        });
      } else {
        homeTabEl.innerHTML = createAllHomeModulesHTML({ fanpages });
        if (effectiveStorage) {
          initAppStorageData({
            hubContainerId: 'hubContainer',
            liveBannerId: 'liveBanner',
            youtubeListId: 'youtubeList',
            playlistId: 'playlistYoutubeList',
            woniListId: 'woniYoutubeList',
            scheduleListId: 'scheduleList',
            cachedData: effectiveStorage,
            onSchedulesLoaded: (schedules) => {
              if (calendarManager) calendarManager.setSchedules(schedules);
            }
          });
        }
      }
    }

    initTabEngine(document.getElementById('mainVerticalSidebar'), document.getElementById('tabGlassSlider'), tabList, {
      onTabChange: (targetId, tabConfig, loadedMap) => {
        const isDark = document.documentElement.classList.contains('dark-mode') || document.body.classList.contains('dark-mode');

        if (targetId !== 'tabShorts') {
          pauseAllShortsVideos();
        }

        if (targetId === 'tabSchedule') {
          ensureCalendarManager();
        } else if (targetId === 'tabShorts') {
          const shortsContainer = document.getElementById('tabShorts');
          if (shortsContainer && !loadedMap[targetId]) {
            loadedMap[targetId] = true;
            const themeParam = isDark ? '?theme=dark' : '?theme=light';
            shortsContainer.innerHTML = `
              <iframe id="shortsTabFrame" class="shorts-tab-iframe" src="https://duckbeginner.github.io/remine-helper/shorts/${themeParam}" frameborder="0" style="background: transparent;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
            `;
          }
          const effectiveStorage = fullStorageData || microCache;
          if (shortsContainer && effectiveStorage) {
            const shorts = extractAllShortsVideos(effectiveStorage);
            renderShortsList(shortsContainer, shorts);
          }
        } else if (targetId === 'tabInsta' && !loadedMap[targetId]) {
          loadedMap[targetId] = true;
          if (feedCache.insta) {
            renderInstaEmbeds(document.getElementById('instaFeedList'), feedCache.insta, isDark);
          } else {
            chrome.storage.local.get(['instaFeeds'], (res) => {
              if (res && res.instaFeeds) {
                feedCache.insta = res.instaFeeds;
                renderInstaEmbeds(document.getElementById('instaFeedList'), res.instaFeeds, isDark);
              }
            });
          }
        } else if (targetId === 'tabX' && !loadedMap[targetId]) {
          loadedMap[targetId] = true;
          if (feedCache.x) {
            renderXEmbeds(document.getElementById('xFeedList'), feedCache.x, isDark);
          } else {
            chrome.storage.local.get(['xFeeds'], (res) => {
              if (res && res.xFeeds) {
                feedCache.x = res.xFeeds;
                renderXEmbeds(document.getElementById('xFeedList'), res.xFeeds, isDark);
              }
            });
          }
        } else if (targetId === 'tabTiktok' && !loadedMap[targetId]) {
          loadedMap[targetId] = true;
          renderTiktokEmbeds(document.getElementById('tiktokFeedList'), feedCache.tiktok || DEFAULT_TIKTOK_FEEDS, isDark);
        }
      }
    });
  }

  // =========================================================================
  // Step 1: 0.002초 초경량 즉시 렌더링 (Critical Path Instant Paint)
  // =========================================================================
  initNavPosition(initialSettings.navPosition || 'left');
  renderAppViews(initialSettings.tabList, initialSettings.fanpages, { isInitial: true, cachedStorage: microCache });

  document.addEventListener('click', (e) => {
    if (e.target.closest('#openSettingsBtn')) {
      ensureSettingsModal();
    } else if (e.target.closest('.schedule-item, .cal-event-badge, .schedule-calendar-item')) {
      ensureScheduleModal();
    }
  }, true);

  // =========================================================================
  // Step 2: 브라우저 유휴 시간 백그라운드 스토리지 동기화 (Idle Revalidate)
  // =========================================================================
  const syncTask = () => {
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
          'channelOrder',
          'instaFeeds',
          'xFeeds',
          'tiktokFeeds'
        ],
        (res) => {
          if (!res) return;
          fullStorageData = res;
          setMicroCache(res);

          initThemeEngine(document.getElementById('themeToggleBtn'), {
            initialMode: res.themeMode || 'system'
          });

          if (res.instaFeeds) feedCache.insta = res.instaFeeds;
          if (res.xFeeds) feedCache.x = res.xFeeds;
          if (res.tiktokFeeds && res.tiktokFeeds.length > 0) feedCache.tiktok = res.tiktokFeeds;

          const settings = parseUserSettings(res.userSettings);
          try {
            localStorage.setItem('userSettings', JSON.stringify(settings));
          } catch (e) { }
          if (settings.navPosition) {
            initNavPosition(settings.navPosition);
          }

          const tabListChanged = JSON.stringify(settings.tabList) !== JSON.stringify(currentTabList);
          const fanpagesChanged = JSON.stringify(settings.fanpages) !== JSON.stringify(currentFanpages);

          if (tabListChanged || fanpagesChanged) {
            renderAppViews(settings.tabList, settings.fanpages, { isInitial: false, cachedStorage: res });
          } else {
            initAppStorageData({
              hubContainerId: 'hubContainer',
              liveBannerId: 'liveBanner',
              youtubeListId: 'youtubeList',
              playlistId: 'playlistYoutubeList',
              woniListId: 'woniYoutubeList',
              scheduleListId: 'scheduleList',
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

  // 사용자가 사이드패널로 돌아올 때(Focus/Visibility) 즉시 최신 상태 재동기화
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      syncTask();
    }
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#openDashboardBtn');
    if (btn) {
      const targetPath = 'dashboard.html';
      const fullUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
        ? chrome.runtime.getURL(targetPath)
        : targetPath;

      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
        chrome.tabs.query({}, (tabs) => {
          const existingTab = (tabs || []).find(t => t.url && (t.url.includes(targetPath) || t.url === fullUrl));
          if (existingTab && existingTab.id !== undefined) {
            chrome.tabs.update(existingTab.id, { active: true });
            if (existingTab.windowId !== undefined && chrome.windows && chrome.windows.update) {
              chrome.windows.update(existingTab.windowId, { focused: true });
            }
          } else if (chrome.tabs.create) {
            chrome.tabs.create({ url: fullUrl });
          } else {
            window.open(fullUrl, '_blank');
          }
        });
      } else {
        window.open(fullUrl, '_blank');
      }
    }
  });
});
