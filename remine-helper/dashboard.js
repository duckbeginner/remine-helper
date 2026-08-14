// dashboard.js - 0ms 즉시 렌더링 및 단일 일괄 스토리지 쿼리 기반 대시보드 진입점
import { TAB_CONFIG_LIST, OFFICIAL_CHANNELS, FANPAGE_LIST, CHANNEL_DATA_MAP, DEFAULT_TIKTOK_FEEDS, DEFAULT_USER_SETTINGS } from './constants.js';
import {
  createTabBarHTML,
  createTabContainersHTML,
  createLiveBannerHTML,
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
  renderTiktokEmbeds
} from './common/common.js';

document.addEventListener('DOMContentLoaded', () => {
  const liveBannerMount = document.getElementById('liveBannerMount');
  const tabBarMount = document.getElementById('tabBarMount');
  const tabContainersMount = document.getElementById('tabContainersMount');
  const rightColMount = document.getElementById('dashboardRightColMount');
  const modalMount = document.getElementById('modalMount');

  if (liveBannerMount) liveBannerMount.innerHTML = createLiveBannerHTML();

  // 소셜 피드 메모리 캐시 (탭 전환 0ms 즉각 반응)
  const feedCache = {
    insta: null,
    x: null,
    tiktok: DEFAULT_TIKTOK_FEEDS
  };

  let calendarManager = null;
  let currentTabList = DEFAULT_USER_SETTINGS.tabList;
  let currentFanpages = DEFAULT_USER_SETTINGS.fanpages;

  function renderDashboardViews(tabList = currentTabList, fanpages = currentFanpages, { cachedStorage = null } = {}) {
    currentTabList = tabList;
    currentFanpages = fanpages;

    // 대시보드 탭 목록 (홈 탭 제외, 스케줄 기본 활성화)
    const dashboardTabs = tabList.filter(t => t.id !== 'tabHome').map(t => ({
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
        const isDark = document.body.classList.contains('dark-mode');
        if (targetId === 'tabInsta' && !loadedMap[targetId]) {
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

    initAppStorageData({
      hubContainerId: 'hubContainer',
      liveBannerId: 'liveBanner',
      youtubeListId: 'youtubeList',
      playlistId: 'playlistYoutubeList',
      woniListId: 'woniYoutubeList',
      cachedData: cachedStorage,
      onSchedulesLoaded: (schedules) => {
        if (calendarManager) calendarManager.setSchedules(schedules);
      }
    });
  }

  // =========================================================================
  // Step 1: 0ms 동기식 즉시 마운트
  // =========================================================================
  initNavPosition(DEFAULT_USER_SETTINGS.navPosition || 'left');
  renderDashboardViews(DEFAULT_USER_SETTINGS.tabList, DEFAULT_USER_SETTINGS.fanpages);

  if (modalMount) {
    modalMount.innerHTML = createScheduleModalHTML() + createSettingsModalHTML();
    initScheduleModal();
  }

  // 캘린더 최대화 버튼 바인딩
  const maximizeBtn = document.getElementById('maximizeCalendarBtn');
  if (maximizeBtn) {
    maximizeBtn.addEventListener('click', () => {
      const isMaximized = document.body.classList.toggle('calendar-maximized');
      maximizeBtn.innerHTML = isMaximized
        ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:2px;"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/></svg>축소`
        : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:2px;"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>최대화`;
    });
  }

  // =========================================================================
  // Step 2: 단일 일괄 스토리지 쿼리 (Single-Batch IPC)
  // =========================================================================
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

        renderDashboardViews(settings.tabList, settings.fanpages, { cachedStorage: res });

        if (modalMount) {
          initSettingsModal({
            onTabsChanged: (newTabList) => {
              loadUserSettings((u) => renderDashboardViews(newTabList, u.fanpages));
            },
            onFanpagesChanged: (newFanpages) => {
              loadUserSettings((u) => renderDashboardViews(u.tabList, newFanpages));
            },
            onNavPositionChanged: (newPos) => {
              initNavPosition(newPos);
            }
          });
        }
      }
    );
  } else {
    initThemeEngine(document.getElementById('themeToggleBtn'));
  }
});
