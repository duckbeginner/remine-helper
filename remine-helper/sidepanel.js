// sidepanel.js - 0ms 즉시 렌더링 및 단일 일괄 스토리지 쿼리(Single-Batch IPC) 초고속 진입점
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
  parseUserSettings,
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

  // 소셜 피드 메모리 캐시 (탭 전환 시 0ms 즉시 렌더링)
  const feedCache = {
    insta: null,
    x: null,
    tiktok: DEFAULT_TIKTOK_FEEDS
  };

  let calendarManager = null;
  let currentTabList = DEFAULT_USER_SETTINGS.tabList;
  let currentFanpages = DEFAULT_USER_SETTINGS.fanpages;

  // 사이드바 & 탭 컨테이너 렌더링 함수
  function renderAppViews(tabList = currentTabList, fanpages = currentFanpages, { isInitial = false, cachedStorage = null } = {}) {
    currentTabList = tabList;
    currentFanpages = fanpages;

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

    // 1-4. 캘린더 매니저 초기화
    calendarManager = initCalendarManager({
      gridId: 'spCalendarGrid',
      titleId: 'spCalendarMonthTitle',
      prevBtnId: 'spPrevMonthBtn',
      nextBtnId: 'spNextMonthBtn'
    });

    // 1-5. 탭 전환 엔진 초기화 (사전 캐시 기반 0ms 즉각 렌더링)
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

    // 1-6. 스토리지 데이터 자동 로드 & 실시간 바인딩 (캐시가 있으면 0ms 즉시 주입)
    initAppStorageData({
      hubContainerId: 'hubContainer',
      liveBannerId: 'liveBanner',
      youtubeListId: 'youtubeList',
      playlistId: 'playlistYoutubeList',
      woniListId: 'woniYoutubeList',
      scheduleListId: 'scheduleList',
      cachedData: cachedStorage,
      onSchedulesLoaded: (schedules) => {
        if (calendarManager) calendarManager.setSchedules(schedules);
      }
    });
  }

  // =========================================================================
  // Step 1: 0ms 동기식 즉시 마운트 (Instant Synchronous Mount)
  // 스토리지 응답을 1ms도 기다리지 않고 완전한 UI 골격과 뼈대를 먼저 화면에 즉시 렌더링합니다.
  // =========================================================================
  initNavPosition(DEFAULT_USER_SETTINGS.navPosition || 'left');
  renderAppViews(DEFAULT_USER_SETTINGS.tabList, DEFAULT_USER_SETTINGS.fanpages, { isInitial: true });

  if (modalMount) {
    modalMount.innerHTML = createScheduleModalHTML() + createSettingsModalHTML();
    initScheduleModal();
  }

  // =========================================================================
  // Step 2: 단일 일괄 스토리지 쿼리 (Single-Batch IPC Query)
  // 단 1회의 IPC 호출로 설정, 테마, 비디오, 스케줄, 피드를 일괄 수신하여 0ms로 채워넣습니다.
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

        // 1) 테마 모드 즉시 적용
        initThemeEngine(document.getElementById('themeToggleBtn'), {
          initialMode: res.themeMode || 'system'
        });

        // 2) 피드 캐시 갱신
        if (res.instaFeeds) feedCache.insta = res.instaFeeds;
        if (res.xFeeds) feedCache.x = res.xFeeds;
        if (res.tiktokFeeds && res.tiktokFeeds.length > 0) feedCache.tiktok = res.tiktokFeeds;

        // 3) 사용자 설정 파싱 및 커스텀 레이아웃 반영
        const settings = parseUserSettings(res.userSettings);
        if (settings.navPosition) {
          initNavPosition(settings.navPosition);
        }

        // 4) 커스텀 탭/팬페이지가 있거나 스토리지 데이터 주입
        renderAppViews(settings.tabList, settings.fanpages, { cachedStorage: res });

        // 5) 사용자 설정 모달 이벤트 바인딩
        if (modalMount) {
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
      }
    );
  } else {
    initThemeEngine(document.getElementById('themeToggleBtn'));
  }

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
