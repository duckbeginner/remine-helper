// sidepanel.js - 공통 모듈 기반 사이드 패널 진입점 스크립트
import { TAB_CONFIG_LIST, OFFICIAL_CHANNELS, FANPAGE_LIST, CHANNEL_DATA_MAP, DEFAULT_TIKTOK_FEEDS } from './constants.js';
import {
  createTabBarHTML,
  createTabContainersHTML,
  createAllHomeModulesHTML,
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
  const tabBarMount = document.getElementById('tabBarMount');
  const tabContainersMount = document.getElementById('tabContainersMount');
  const modalMount = document.getElementById('modalMount');

  // 상단 탭 네비게이션 마운트
  if (tabBarMount) {
    tabBarMount.innerHTML = createTabBarHTML(TAB_CONFIG_LIST, { tabBarId: 'mainTabBar' });
  }

  // 각 탭별 컨테이너 마운트
  if (tabContainersMount) {
    tabContainersMount.innerHTML = createTabContainersHTML(TAB_CONFIG_LIST);
  }

  // 스케줄 모달 마운트
  if (modalMount) {
    modalMount.innerHTML = createScheduleModalHTML();
    initScheduleModal();
  }

  // 홈 탭의 모든 서브 모듈 마운트
  const homeTabEl = document.getElementById('tabHome');
  if (homeTabEl) {
    homeTabEl.innerHTML = createAllHomeModulesHTML(CHANNEL_DATA_MAP, FANPAGE_LIST);
  }

  // 2. 엔진 초기화
  initThemeEngine(document.getElementById('themeToggleBtn'));

  // 대시보드 열기 버튼 연동
  const openDashboardBtn = document.getElementById('openDashboardBtn');
  if (openDashboardBtn) {
    openDashboardBtn.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
      } else {
        window.open('dashboard.html', '_blank');
      }
    });
  }

  // 캘린더 관리자 초기화
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

  // 탭 전환 엔진 초기화 (사전 캐시 기반 0ms 즉각 렌더링)
  initTabEngine(document.getElementById('mainTabBar'), document.getElementById('tabGlassSlider'), TAB_CONFIG_LIST, {
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

  // 스토리지 데이터 자동 로드 & 실시간 바인딩
  initAppStorageData({
    hubContainerId: 'hubContainer',
    liveBannerId: 'liveBanner',
    youtubeListId: 'youtubeList',
    playlistId: 'playlistYoutubeList',
    woniListId: 'woniYoutubeList',
    scheduleListId: 'scheduleList',
    onSchedulesLoaded: (schedules) => {
      calendarManager.setSchedules(schedules);
    }
  });

  // 3. 미디어 쿼리 2단 모드 (800px 이상) 시 서브 탭 자동 활성화
  const wideQuery = window.matchMedia('(min-width: 800px)');
  function handleWideModeChange(e) {
    if (e.matches) {
      const activeBtn = document.querySelector('#mainTabBar .panel-tab-btn.active');
      if (activeBtn && activeBtn.getAttribute('data-target') === 'tabHome') {
        const scheduleBtn = document.querySelector('#mainTabBar .panel-tab-btn[data-target="tabSchedule"]');
        if (scheduleBtn) scheduleBtn.click();
      }
    }
  }
  wideQuery.addEventListener('change', handleWideModeChange);
  if (wideQuery.matches) {
    handleWideModeChange(wideQuery);
  }
});
