// dashboard.js - 공통 모듈 기반 대시보드 진입점 스크립트
import { TAB_CONFIG_LIST, OFFICIAL_CHANNELS, FANPAGE_LIST, CHANNEL_DATA_MAP, DEFAULT_TIKTOK_FEEDS } from './constants.js';
import {
  createTabBarHTML,
  createTabContainersHTML,
  createLiveBannerHTML,
  createHubCardHTML,
  createYoutubeSectionHTML,
  createWoniSectionHTML,
  createFanpageCardHTML,
  createStickyFooterHTML,
  createScheduleModalHTML
} from './common/templates.js';
import {
  initThemeEngine,
  initTabEngine,
  initCalendarManager,
  initAppStorageData,
  initScheduleModal,
  renderInstaEmbeds,
  renderXEmbeds,
  renderTiktokEmbeds
} from './common/common.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. UI 컴포넌트 팩토리 일괄 마운트
  const liveBannerMount = document.getElementById('liveBannerMount');
  const tabBarMount = document.getElementById('tabBarMount');
  const tabContainersMount = document.getElementById('tabContainersMount');
  const rightColMount = document.getElementById('dashboardRightColMount');
  const modalMount = document.getElementById('modalMount');

  if (liveBannerMount) liveBannerMount.innerHTML = createLiveBannerHTML();

  // 대시보드 탭 목록 (기본 활성화를 캘린더로 지정)
  const dashboardTabs = TAB_CONFIG_LIST.filter(t => t.id !== 'tabHome').map(t => ({
    ...t,
    defaultActive: t.id === 'tabSchedule'
  }));

  if (tabBarMount) {
    tabBarMount.innerHTML = createTabBarHTML(dashboardTabs, { tabBarId: 'dashboardTabBar' });
  }
  if (tabContainersMount) {
    tabContainersMount.innerHTML = createTabContainersHTML(dashboardTabs);
  }
  if (rightColMount) {
    rightColMount.innerHTML = [
      createHubCardHTML(OFFICIAL_CHANNELS, CHANNEL_DATA_MAP, { showControls: false }),
      createYoutubeSectionHTML(),
      createWoniSectionHTML(),
      createFanpageCardHTML(FANPAGE_LIST),
      createStickyFooterHTML()
    ].join('\n');
  }
  if (modalMount) {
    modalMount.innerHTML = createScheduleModalHTML();
  }

  // 2. 공통 코어 엔진 일괄 초기화
  initThemeEngine(document.getElementById('themeToggleBtn'));
  initScheduleModal();

  const calendarManager = initCalendarManager({
    gridId: 'spCalendarGrid',
    titleId: 'spCalendarMonthTitle',
    prevBtnId: 'spPrevMonthBtn',
    nextBtnId: 'spNextMonthBtn'
  });

  // 소셜 피드 메모리 캐시 (탭 전환 0ms 즉각 반응)
  let feedCache = {
    insta: null,
    x: null,
    tiktok: DEFAULT_TIKTOK_FEEDS
  };

  chrome.storage.local.get(['instaFeeds', 'xFeeds', 'tiktokFeeds'], (res) => {
    if (res) {
      if (res.instaFeeds) feedCache.insta = res.instaFeeds;
      if (res.xFeeds) feedCache.x = res.xFeeds;
      if (res.tiktokFeeds && res.tiktokFeeds.length > 0) feedCache.tiktok = res.tiktokFeeds;
    }
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
    onSchedulesLoaded: (schedules) => calendarManager.setSchedules(schedules)
  });

  // 3. 대시보드 전용 캘린더 최대화 토글 버튼
  const maximizeBtn = document.getElementById('maximizeCalendarBtn');
  if (maximizeBtn) {
    maximizeBtn.addEventListener('click', () => {
      const isMaximized = document.body.classList.toggle('calendar-maximized');
      maximizeBtn.innerHTML = isMaximized
        ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:2px;"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/></svg>축소`
        : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:2px;"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>최대화`;
    });
  }

  // 4. 대시보드 내 모든 링크는 현재 탭에서 탐색 (라이브 배너 제외)
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link && link.href && !link.href.startsWith('javascript:') && !link.href.startsWith('#')) {
      if (link.id !== 'liveBanner') {
        link.target = '_self';
      }
    }
  });
});
