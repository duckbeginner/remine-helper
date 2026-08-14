// sidepanel.js - 세로형 사이드 네비게이션 및 사용자 설정 통합 진입점
import { TAB_CONFIG_LIST, OFFICIAL_CHANNELS, FANPAGE_LIST, CHANNEL_DATA_MAP, DEFAULT_TIKTOK_FEEDS, DEFAULT_USER_SETTINGS } from './constants.js';
import {
  createVerticalSidebarHTML,
  createTabContainersHTML,
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
  loadUserSettings,
  initNavPosition,
  renderInstaEmbeds,
  renderXEmbeds,
  renderTiktokEmbeds
} from './common/common.js';

document.addEventListener('DOMContentLoaded', () => {
  const sidebarMount = document.getElementById('sidebarMount');
  const tabContainersMount = document.getElementById('tabContainersMount');
  const modalMount = document.getElementById('modalMount');

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

  // 1. 사용자 설정 로드 및 전체 레이아웃 초기 마운트
  loadUserSettings((settings) => {
    // 네비게이션 위치 적용 (좌측 vs 우측)
    initNavPosition(settings.navPosition || 'left');

    let calendarManager = null;

    // 사이드바 & 탭 컨테이너 렌더링 함수
    function renderAppViews(tabList, fanpages) {
      // 1-1. 세로 사이드바 마운트
      const currentActiveBtn = sidebarMount ? sidebarMount.querySelector('.vtab-btn.active') : null;
      const activeTabId = currentActiveBtn ? currentActiveBtn.getAttribute('data-target') : 'tabHome';

      if (sidebarMount) {
        sidebarMount.innerHTML = createVerticalSidebarHTML(tabList, { activeTabId });
      }

      // 1-2. 탭 컨테이너 마운트
      if (tabContainersMount) {
        tabContainersMount.innerHTML = createTabContainersHTML(tabList, activeTabId);
      }

      // 1-3. 홈 탭 내용 마운트
      const homeTabEl = document.getElementById('tabHome');
      if (homeTabEl) {
        homeTabEl.innerHTML = createAllHomeModulesHTML({ fanpages });
      }

      // 1-5. 테마 엔진 바인딩
      initThemeEngine(document.getElementById('themeToggleBtn'));

      // 1-6. 캘린더 매니저 재초기화
      calendarManager = initCalendarManager({
        gridId: 'spCalendarGrid',
        titleId: 'spCalendarMonthTitle',
        prevBtnId: 'spPrevMonthBtn',
        nextBtnId: 'spNextMonthBtn'
      });

      // 1-7. 탭 전환 엔진 초기화 (사전 캐시 기반 0ms 즉각 렌더링)
      initTabEngine(document.getElementById('mainVerticalSidebar'), document.getElementById('tabGlassSlider'), tabList, {
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

      // 1-8. 스토리지 데이터 자동 로드 & 실시간 바인딩
      initAppStorageData({
        hubContainerId: 'hubContainer',
        liveBannerId: 'liveBanner',
        youtubeListId: 'youtubeList',
        playlistId: 'playlistYoutubeList',
        woniListId: 'woniYoutubeList',
        scheduleListId: 'scheduleList',
        onSchedulesLoaded: (schedules) => {
          if (calendarManager) calendarManager.setSchedules(schedules);
        }
      });
    }

    // 초기 마운트 실행
    renderAppViews(settings.tabList || TAB_CONFIG_LIST, settings.fanpages || FANPAGE_LIST);

    // 2. 모달 마운트 (스케줄 상세 모달 + 사용자 설정 모달)
    if (modalMount) {
      modalMount.innerHTML = createScheduleModalHTML() + createSettingsModalHTML();
      initScheduleModal();
      initSettingsModal({
        onTabsChanged: (newTabList) => {
          loadUserSettings((u) => renderAppViews(newTabList, u.fanpages));
        },
        onFanpagesChanged: (newFanpages) => {
          loadUserSettings((u) => renderAppViews(u.tabList, newFanpages));
        },
        onNavPositionChanged: (newPos) => {
          initNavPosition(newPos);
        }
      });
    }
  });

  // 대시보드 새 탭 열기 전역 이벤트 위임
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#openDashboardBtn');
    if (btn) {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
      } else {
        window.open('dashboard.html', '_blank');
      }
    }
  });

  // 3. 미디어 쿼리 2단 모드 (800px 이상) 시 서브 탭 자동 활성화
  const wideQuery = window.matchMedia('(min-width: 800px)');
  function handleWideModeChange(e) {
    if (e.matches) {
      const activeBtn = document.querySelector('.vtab-btn.active, .panel-tab-btn.active');
      if (activeBtn && activeBtn.getAttribute('data-target') === 'tabHome') {
        const scheduleBtn = document.querySelector('.vtab-btn[data-target="tabSchedule"], .panel-tab-btn[data-target="tabSchedule"]');
        if (scheduleBtn) {
          scheduleBtn.click();
        } else {
          const firstSubBtn = document.querySelector('.vtab-btn:not([data-target="tabHome"]), .panel-tab-btn:not([data-target="tabHome"])');
          if (firstSubBtn) firstSubBtn.click();
        }
      }
    }
  }
  wideQuery.addEventListener('change', handleWideModeChange);
  if (wideQuery.matches) {
    handleWideModeChange(wideQuery);
  }
});
