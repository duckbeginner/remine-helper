// common/templates.js - 원자/분자/섹션 계층형 HTML 컴포넌트 팩토리
import { TAB_CONFIG_LIST, OFFICIAL_CHANNELS, FANPAGE_LIST, CHANNEL_DATA_MAP, REFRESH_INTERVAL_OPTIONS, ICONS } from '../constants.js';

// --- 유틸리티 ---
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function parseSafeDate(startTimeStr) {
  if (!startTimeStr) return new Date();
  if (startTimeStr.length === 10 && !startTimeStr.includes('T')) {
    const [y, m, d] = startTimeStr.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0);
  }
  const d = new Date(startTimeStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function getTimeAgo(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const past = parseSafeDate(dateString);
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}주 전`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)}개월 전`;
  return `${Math.floor(diffDay / 365)}년 전`;
}

/* =========================================================================
   1. 원자 컴포넌트 (Atoms / UI Elements)
   ========================================================================= */

export function createTabGlassSliderHTML() {
  return `<div class="tab-glass-slider" id="tabGlassSlider"></div>`;
}

export function createTabButtonHTML(tab, channelMap = CHANNEL_DATA_MAP) {
  const activeClass = tab.defaultActive ? ' active' : '';
  let iconHtml = '';

  if (tab.id === 'tabShorts') {
    iconHtml = `<span class="tab-icon-wrap">${ICONS.shorts}</span>`;
  } else if (tab.channelKey && channelMap[tab.channelKey]) {
    const chData = channelMap[tab.channelKey];
    if (chData.svg) {
      iconHtml = `<span class="tab-icon-wrap">${chData.svg}</span>`;
    } else if (chData.img) {
      const isCustom = chData.img.includes('logo') || chData.img.includes('dc') ? ' tab-icon-dc' : '';
      iconHtml = `<span class="tab-icon-wrap"><img class="${isCustom}" src="${chData.img}" alt="${escapeHtml(tab.label)}"></span>`;
    }
  } else if (tab.svg) {
    iconHtml = `<span class="tab-icon-wrap">${tab.svg}</span>`;
  } else if (tab.icon) {
    iconHtml = `<span class="tab-icon-text">${tab.icon}</span>`;
  }

  const labelHtml = tab.label ? `<span class="btn-name">${escapeHtml(tab.label)}</span>` : '';
  return `<button class="panel-tab-btn${activeClass}" data-target="${tab.id}">${iconHtml} ${labelHtml}</button>`;
}

export function createHubIconButtonHTML(channel, channelMap = CHANNEL_DATA_MAP) {
  const data = channelMap[channel.key] || {};
  let iconContent = '';

  if (data.svg) {
    iconContent = `<span class="tab-icon-wrap">${data.svg}</span>`;
  } else if (data.img) {
    const isCustom = data.img.includes('logo') ? ' custom-logo' : '';
    iconContent = `<img src="${data.img}" alt="${escapeHtml(channel.name || data.name)}" class="tab-icon-img${isCustom}">`;
  } else {
    iconContent = `<span>${escapeHtml((channel.name || '채널').slice(0, 2))}</span>`;
  }

  const badgeHtml = channel.key === 'x_twt' ? `<span class="hub-icon-badge">twt</span>` : '';

  return `
    <a href="${channel.url || data.url}" target="_blank" class="hub-icon-btn" data-key="${channel.key}" title="${escapeHtml(channel.name || data.name)}" draggable="true">
      ${iconContent}${badgeHtml}
    </a>
  `;
}

export function createThemeToggleButtonsHTML() {
  return `
    <div class="header-controls">
      <button class="theme-toggle-btn" id="openDashboardBtn" title="대시보드 열기">
        ${ICONS.dashboard}대시보드
      </button>
      <button class="theme-toggle-btn" id="themeToggleBtn" title="테마 전환">
        ${ICONS.theme}테마
      </button>
    </div>
  `;
}

export function createDashboardHeaderControlsHTML() {
  return `
    <button class="theme-toggle-btn" id="themeToggleBtn" title="테마 전환">
      <span class="vtab-icon-svg" id="themeIconHolder">
        ${ICONS.theme}
      </span>
      <span class="vtab-btn-label">테마</span>
    </button>
    <button class="theme-toggle-btn" id="openSettingsBtn" title="사용자 설정">
      <span class="vtab-icon-svg">
        ${ICONS.settings}
      </span>
      <span class="vtab-btn-label">설정</span>
    </button>
    <button class="maximize-btn" id="maximizeCalendarBtn">${ICONS.maximize}최대화</button>
  `;
}

export function createHScrollButtonsHTML() {
  return `
    <button class="hscroll-btn left" aria-label="이전 영상">
      ${ICONS.hscrollLeft}
    </button>
    <button class="hscroll-btn right" aria-label="다음 영상">
      ${ICONS.hscrollRight}
    </button>
  `;
}

export function createCalendarNavButtonsHTML(monthTitle = '2026년 스케줄') {
  return `
    <div class="calendar-header-left" id="spCalendarNavControls">
      <button class="cal-nav-btn" id="spPrevMonthBtn" title="이전 달">
        ${ICONS.prevMonth}
      </button>
      <span id="spCalendarMonthTitle">${escapeHtml(monthTitle)}</span>
      <button class="cal-nav-btn" id="spNextMonthBtn" title="다음 달">
        ${ICONS.nextMonth}
      </button>
      <button class="cal-nav-btn cal-today-btn" id="spTodayMonthBtn" title="오늘 달력으로 이동">
        ${ICONS.today}오늘
      </button>
    </div>
    <div class="calendar-header-left" id="spScheduleListNavControls" style="display: none;">
      <span class="schedule-list-header-title">스케줄 목록</span>
      <button class="cal-nav-btn cal-today-btn" id="spTodayListBtn" title="지금 시점 일정으로 이동">
        ${ICONS.today}지금
      </button>
    </div>
    <div class="schedule-view-switcher" id="scheduleViewSwitcher">
      <button type="button" class="view-switch-btn active" id="spViewCalBtn" data-view="calendar" title="달력으로 보기">
        ${ICONS.viewCalendar}
        <span>달력</span>
      </button>
      <button type="button" class="view-switch-btn" id="spViewListBtn" data-view="list" title="목록으로 보기">
        ${ICONS.viewList}
        <span>목록</span>
      </button>
    </div>
  `;
}

/* =========================================================================
   2. 분자 및 카드 컴포넌트 (Molecules / Cards)
   ========================================================================= */

export function createGlassCardHTML(contentHtml, { extraClass = '', id = '' } = {}) {
  const idAttr = id ? ` id="${id}"` : '';
  const classAttr = extraClass ? ` ${extraClass}` : '';
  return `
    <div class="glass-card mb-12${classAttr}"${idAttr}>
      ${contentHtml}
    </div>
  `;
}

export function createVideoCardHTML(video) {
  const title = escapeHtml(video.title || '영상');
  const rawDate = video.published || video.date;
  const dateStr = rawDate ? (getTimeAgo(rawDate) || rawDate) : '';
  const url = video.url || video.videoUrl || (video.id ? `https://www.youtube.com/watch?v=${video.id}` : '#');
  const thumbnail = video.thumbnail || 'icons/rescene_official_profile.jpg';

  const calIcon = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:3px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;

  return `
    <a href="${url}" target="_blank" class="video-card">
      <img src="${thumbnail}" alt="${title}" loading="lazy">
      <div class="card-info">
        <span class="card-title" title="${title}">${title}</span>
        ${dateStr ? `<span class="card-date">${calIcon}${escapeHtml(dateStr)}</span>` : ''}
      </div>
    </a>
  `;
}

export function createFanpageLinkCardHTML(fanpage) {
  const iconStr = fanpage.icon ? `${fanpage.icon} ` : '';
  return `
    <a href="${fanpage.url}" target="_blank" class="fanpage-link-card">${iconStr}${escapeHtml(fanpage.name)}</a>
  `;
}

/* =========================================================================
   3. 섹션 및 복합 모듈 (Organisms / Section Modules)
   ========================================================================= */

// 세로형 사이드 네비게이션 바 생성 (신규 레이아웃)
export function createVerticalSidebarHTML(tabs = TAB_CONFIG_LIST, { sidebarId = 'mainVerticalSidebar', sliderId = 'tabGlassSlider', activeTabId = 'tabHome' } = {}) {
  const enabledTabs = tabs.filter(t => t.enabled !== false);
  const buttonsHtml = enabledTabs.map((tab, idx) => {
    const isFirstOrActive = activeTabId ? (tab.id === activeTabId) : (tab.defaultActive || idx === 0);
    const activeClass = isFirstOrActive ? ' active' : '';
    let iconHtml = '';
    if (tab.channelKey && CHANNEL_DATA_MAP[tab.channelKey]) {
      const ch = CHANNEL_DATA_MAP[tab.channelKey];
      if (ch.svg) iconHtml = `<span class="vtab-icon">${ch.svg}</span>`;
      else if (ch.img) iconHtml = `<span class="vtab-icon"><img src="${ch.img}" alt="${escapeHtml(tab.label)}"></span>`;
    } else if (tab.svg) {
      iconHtml = `<span class="vtab-icon">${tab.svg}</span>`;
    } else if (tab.icon) {
      iconHtml = `<span class="vtab-icon-emoji">${tab.icon}</span>`;
    }
    return `
      <button class="vtab-btn${activeClass}" data-target="${tab.id}" title="${escapeHtml(tab.label)}">
        ${iconHtml}
        <span class="vtab-tooltip">${escapeHtml(tab.label)}</span>
      </button>
    `;
  }).join('\n');

  return `
    <nav class="vertical-sidebar" id="${sidebarId}">
      <div class="vtab-group-top">
        <div class="vtab-slider" id="${sliderId}"></div>
        ${buttonsHtml}
      </div>
      <div class="vtab-group-bottom">
        <button class="vtab-util-btn" id="openDashboardBtn" title="대시보드 새 탭 열기">
          <span class="vtab-icon-svg">
            ${ICONS.dashboard}
          </span>
          <span class="vtab-btn-label">보드</span>
          <span class="vtab-tooltip">대시보드</span>
        </button>
        <button class="vtab-util-btn" id="themeToggleBtn" title="테마 전환">
          <span class="vtab-icon-svg" id="themeIconHolder">
            ${ICONS.theme}
          </span>
          <span class="vtab-btn-label">테마</span>
          <span class="vtab-tooltip">테마 전환</span>
        </button>
        <button class="vtab-util-btn" id="openSettingsBtn" title="사용자 설정">
          <span class="vtab-icon-svg">
            ${ICONS.settings}
          </span>
          <span class="vtab-btn-label">설정</span>
          <span class="vtab-tooltip">설정</span>
        </button>
      </div>
    </nav>
  `;
}

// 상단 탭 네비게이션 바 생성 (기존 호환)
export function createTabBarHTML(tabs = TAB_CONFIG_LIST, { tabBarId = 'mainTabBar', activeTabId = '' } = {}) {
  const enabledTabs = tabs.filter(t => t.enabled !== false);
  const buttonsHtml = enabledTabs.map((t, idx) => {
    const isFirstOrActive = activeTabId ? (t.id === activeTabId) : (t.defaultActive || idx === 0);
    return createTabButtonHTML({ ...t, defaultActive: isFirstOrActive });
  }).join('\n    ');

  return `
  <div class="panel-tab-bar" id="${tabBarId}">
    ${createTabGlassSliderHTML()}
    ${buttonsHtml}
  </div>
  `;
}

// 각 탭의 컨텐츠 컨테이너 생성
export function createTabContainersHTML(tabs = TAB_CONFIG_LIST, activeTabId = 'tabHome') {
  const enabledTabs = tabs.filter(t => t.enabled !== false);

  return enabledTabs.map((tab, idx) => {
    const isFirstOrActive = activeTabId ? (tab.id === activeTabId) : (tab.defaultActive || idx === 0);
    const activeClass = isFirstOrActive ? ' active' : '';

    if (tab.type === 'home') {
      return `<div class="panel-tab-content${activeClass}" id="${tab.id}"></div>`;
    }

    if (tab.type === 'schedule') {
      return `
      <div class="panel-tab-content${activeClass}" id="${tab.id}">
        ${createCalendarWrapperHTML()}
      </div>`;
    }

    if (tab.type === 'shorts' || tab.id === 'tabShorts') {
      return `<div class="panel-tab-content${activeClass}" id="${tab.id}"></div>`;
    }

    if (tab.type === 'embed-list') {
      const feedListId = tab.id === 'tabInsta' ? 'instaFeedList' : (tab.id === 'tabX' ? 'xFeedList' : 'tiktokFeedList');
      return `
      <div class="panel-tab-content${activeClass}" id="${tab.id}">
        <div class="feed-list-container" id="${feedListId}">
          <p style="text-align: center; color: #888; padding: 20px;">최신 피드를 불러오는 중...</p>
        </div>
      </div>`;
    }

    if (tab.type === 'iframe') {
      const frameListId = `${tab.id.replace('tab', '').toLowerCase()}FeedList`;
      return `
      <div class="panel-tab-content${activeClass}" id="${tab.id}">
        <div class="iframe-wrapper" id="${frameListId}">
          <p style="text-align: center; color: #888; padding: 20px;">${escapeHtml(tab.label)}을(를) 불러오는 중...</p>
        </div>
      </div>`;
    }

    return `<div class="panel-tab-content${activeClass}" id="${tab.id}"></div>`;
  }).join('\n\n');
}

// 라이브 배너
export function createLiveBannerHTML() {
  return `<a href="#" id="liveBanner" target="_blank" style="display: none;"><span class="live-pulse-dot"></span> [LIVE] 리센느 실시간 라이브 중! 클릭 이동</a>`;
}

// 공식 채널 바로가기 허브 카드 (컨트롤 버튼 기본 제거)
export function createHubCardHTML(channels = OFFICIAL_CHANNELS, channelMap = CHANNEL_DATA_MAP, { showControls = false } = {}) {
  const iconsHtml = channels.map(ch => createHubIconButtonHTML(ch, channelMap)).join('\n      ');
  const controlsHtml = showControls ? createThemeToggleButtonsHTML() : '';

  return `
    <div class="glass-card mb-12">
      <div class="panel-header-bar">
        <h2><img src="icons/rescene-logo.png" alt="icon" class="custom-logo"> 공식 채널 바로가기</h2>
        ${controlsHtml}
      </div>
      <div class="hub-oneline" id="hubContainer">
        ${iconsHtml}
      </div>
    </div>
  `;
}

// 공식 유튜브 섹션 카드
export function createYoutubeSectionHTML() {
  return `
    <div class="glass-card mb-12">
      <h2><img src="icons/rescene_official_profile.jpg" alt="icon"> RESCENE official</h2>
      <div id="youtubeList" class="video-grid">
        <p style="font-size: 12px; color: #777; text-align: center; grid-column: span 3;">불러오는 중...</p>
      </div>
      <h3 class="subsection-title">RESCENE Archive</h3>
      <div id="playlistYoutubeList" class="video-grid">
        <p style="font-size: 12px; color: #777; text-align: center; grid-column: span 3;">불러오는 중...</p>
      </div>
    </div>
  `;
}

// 안녕하세요원이입니다잘부탁드립니다 섹션 카드
export function createWoniSectionHTML() {
  return `
    <div class="glass-card mb-12">
      <h2><img src="icons/hellowoni_profile.jpg" alt="icon"> 안녕하세요원이입니다잘부탁드립니다</h2>
      <div id="woniYoutubeList" class="video-grid">
        <p style="font-size: 12px; color: #777; text-align: center; grid-column: span 3;">불러오는 중...</p>
      </div>
    </div>
  `;
}

// 스케줄 리스트 카드 (스마트 가변 뷰포트)
export function createScheduleCardHTML() {
  return `
    <div class="glass-card mb-12 schedule-card-flex">
      <h2>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:4px;">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>스케줄
      </h2>
      <div class="schedule-container">
        <div class="schedule-viewport" id="scheduleList">
          <div class="schedule-item">스케줄 정보를 불러오는 중...</div>
        </div>
      </div>
    </div>
  `;
}

// 팬페이지 바로가기 카드
export function createFanpageCardHTML(fanpages = FANPAGE_LIST) {
  const linksHtml = fanpages.map(fp => createFanpageLinkCardHTML(fp)).join('\n        ');

  return `
    <div class="glass-card mb-12">
      <h2>
        ${ICONS.link}팬페이지 바로가기
      </h2>
      <div class="fanpage-links-grid">
        ${linksHtml}
      </div>
    </div>
  `;
}

// 캘린더 & 스케줄 목록 통합 래퍼 뷰
export function createCalendarWrapperHTML(initialMonthTitle = '스케줄 캘린더') {
  return `
    <div class="calendar-wrapper" id="spScheduleMainWrapper">
      <div class="calendar-header">
        ${createCalendarNavButtonsHTML(initialMonthTitle)}
      </div>
      <div class="calendar-view-container" id="spCalendarView">
        <div class="calendar-weekdays">
          <div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div>
        </div>
        <div class="calendar-grid" id="spCalendarGrid"></div>
      </div>
      <div class="schedule-tab-list-container" id="spScheduleListView" style="display: none;">
        <div class="schedule-container" style="height: 100%; min-height: 0; flex: 1;">
          <div class="schedule-viewport" id="tabScheduleList">
            <div class="schedule-item">스케줄 정보를 불러오는 중...</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// 하단 고정 푸터
export function createStickyFooterHTML() {
  return `
    <div class="glass-card disclaimer-card sticky-footer">
      <footer>
        본 확장 프로그램은 팬이 자발적으로 제작한 비공식 앱으로 소속사 및 아티스트와 무관합니다.<br>
        모든 콘텐츠의 저작권은 원저작자에게 있습니다.
      </footer>
    </div>
  `;
}

// 스케줄 상세 모달 및 툴팁
export function createScheduleModalHTML() {
  return `
    <div class="schedule-modal-overlay" id="scheduleModalOverlay">
      <div class="schedule-modal-container" id="scheduleModalContainer">
        <!-- 1. 기본 상세 모달 카드 -->
        <div class="schedule-modal-card">
          <div class="modal-header">
            <span id="modalTitle">스케줄 상세 정보</span>
            <button class="modal-close-btn" id="modalCloseBtn" aria-label="닫기">
              ${ICONS.close}
            </button>
          </div>
          <div class="modal-body" id="modalBodyContent"></div>
        </div>

        <!-- 2. 임베드 미디어 전용 추가 카드 (미디어 존재 시 노출) -->
        <div class="schedule-embed-card" id="modalEmbedCard" style="display: none;">
          <div class="modal-header">
            <span class="embed-modal-title">
              ${ICONS.media}관련 미디어
            </span>
          </div>
          <div class="embed-modal-body" id="modalEmbedBodyContent"></div>
        </div>
      </div>
    </div>
    <div class="schedule-tooltip" id="scheduleTooltip"></div>
  `;
}

// 홈 탭 상단 핵심 모듈 (0.005초 즉시 페인팅: 라이브 배너 + 공식 채널 + 공식 유튜브)
export function createPrimaryHomeModulesHTML({ channels = OFFICIAL_CHANNELS } = {}) {
  return [
    createLiveBannerHTML(),
    createHubCardHTML(channels),
    createYoutubeSectionHTML()
  ].join('\n');
}

// 홈 탭 하단 보조 모듈 (1프레임 뒤 지연 페인팅: 원이 채널 + 스케줄 + 팬페이지)
export function createSecondaryHomeModulesHTML({ fanpages = FANPAGE_LIST } = {}) {
  return [
    createWoniSectionHTML(),
    createScheduleCardHTML(),
    createFanpageCardHTML(fanpages)
  ].join('\n');
}

// 홈 탭의 모든 기본 모듈을 조합하여 반환하는 헬퍼
export function createAllHomeModulesHTML({ fanpages = FANPAGE_LIST, channels = OFFICIAL_CHANNELS } = {}) {
  return [
    createLiveBannerHTML(),
    createHubCardHTML(channels),
    createYoutubeSectionHTML(),
    createWoniSectionHTML(),
    createScheduleCardHTML(),
    createFanpageCardHTML(fanpages)
  ].join('\n');
}

// 사용자 설정 통합 모달
export function createSettingsModalHTML() {
  return `
    <div class="settings-modal-overlay" id="settingsModalOverlay">
      <div class="settings-modal-card">
        <div class="settings-modal-header">
          <div class="settings-modal-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:6px;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            <span>사용자 설정</span>
          </div>
          <button class="settings-close-btn" id="settingsCloseBtn" aria-label="닫기">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <!-- 설정 서브 탭 네비게이션 -->
        <div class="settings-tab-nav" id="settingsTabNav">
          <button class="settings-nav-btn active" data-tab="settingGeneral">일반 / 디스플레이</button>
          <button class="settings-nav-btn" data-tab="settingNotifications">알림</button>
          <button class="settings-nav-btn" data-tab="settingTabs">탭 관리</button>
          <button class="settings-nav-btn" data-tab="settingFanpages">팬페이지 관리</button>
        </div>

        <div class="settings-modal-body">
          <!-- 1. 일반 / 디스플레이 설정 -->
          <div class="settings-section active" id="settingGeneral">
            <div class="setting-group-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:5px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
              <span>네비게이션 사이드바 위치</span>
            </div>
            <div class="setting-item-row">
              <div class="setting-desc">
                <strong>사이드바 배치</strong>
                <p>사이드 탭바를 화면 좌측 또는 우측에 배치합니다.</p>
              </div>
              <div class="setting-radio-group">
                <label class="setting-radio-label">
                  <input type="radio" name="navPosition" value="left" id="navPosLeft" checked>
                  <span>Left</span>
                </label>
                <label class="setting-radio-label">
                  <input type="radio" name="navPosition" value="right" id="navPosRight">
                  <span>Right</span>
                </label>
              </div>
            </div>

            <div class="setting-group-title" style="margin-top: 24px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:5px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              <span>데이터 새로고침 주기</span>
            </div>
            <div class="setting-item-row">
              <div class="setting-desc">
                <strong>자동 백그라운드 갱신 주기</strong>
                <p>유튜브 새 영상, 스케줄, 소셜 피드 등의 정보를 백그라운드에서 자동으로 새로고침하는 주기를 설정합니다.</p>
              </div>
              <div class="setting-select-wrap">
                <select id="settingRefreshInterval" class="setting-select">
                  ${REFRESH_INTERVAL_OPTIONS.map(opt => `<option value="${opt.value}">${escapeHtml(opt.label)}</option>`).join('\n')}
                </select>
              </div>
            </div>

            <div class="setting-group-title" style="margin-top: 24px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:5px;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
              <span>미디어 사운드</span>
            </div>
            <div class="setting-item-row">
              <div class="setting-desc">
                <strong>임베드 로드 시 자동 음소거</strong>
                <p>인스타그램, 틱톡, 트위터 피드 진입 시 소리를 기본 음소거 상태로 시작합니다.</p>
              </div>
              <label class="setting-switch">
                <input type="checkbox" id="settingMuteOnLoad">
                <span class="slider round"></span>
              </label>
            </div>
          </div>

          <!-- 2. 알림 설정 -->
          <div class="settings-section" id="settingNotifications">
            <div class="setting-group-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:5px;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              <span>푸시 알림 수신</span>
            </div>
            <div class="setting-item-row">
              <div class="setting-desc">
                <strong>전체 푸시 알림 활성화</strong>
                <p>새로운 소식이 있을 때 브라우저 알림을 받습니다.</p>
              </div>
              <label class="setting-switch">
                <input type="checkbox" id="settingNotiMaster" checked>
                <span class="slider round"></span>
              </label>
            </div>

            <div class="setting-sub-options" id="notiSubOptions">
              <div class="setting-item-row sub">
                <div class="setting-desc">
                  <span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:4px;"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                    유튜브 공식 채널 새 영상 업로드
                  </span>
                </div>
                <label class="setting-switch small">
                  <input type="checkbox" id="settingNotiYoutube" checked>
                  <span class="slider round"></span>
                </label>
              </div>
              <div class="setting-item-row sub">
                <div class="setting-desc">
                  <span>
                    <span class="live-dot-inline"></span>
                    유튜브 공식 실시간 라이브 감지
                  </span>
                </div>
                <label class="setting-switch small">
                  <input type="checkbox" id="settingNotiLive" checked>
                  <span class="slider round"></span>
                </label>
              </div>
              <div class="setting-item-row sub">
                <div class="setting-desc">
                  <span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    당일 스케줄 요약 및 방송/영상 시작 전(30분 이내) 임박 알림
                  </span>
                </div>
                <label class="setting-switch small">
                  <input type="checkbox" id="settingNotiSchedule" checked>
                  <span class="slider round"></span>
                </label>
              </div>
            </div>
          </div>

          <!-- 3. 상단 탭 목록 관리 -->
          <div class="settings-section" id="settingTabs">
            <div class="setting-group-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:5px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
              <span>탭 활성화 및 노출 순서</span>
            </div>
            <p class="setting-help-text">화면에 표시할 탭을 켜고 끄거나, 항목을 드래그 또는 화살표로 순서를 변경할 수 있습니다.</p>
            <div class="reorder-list" id="tabReorderList"></div>
          </div>

          <!-- 4. 팬페이지 관리 -->
          <div class="settings-section" id="settingFanpages">
            <div class="setting-group-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:5px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
              <span>팬페이지 바로가기 링크 관리</span>
            </div>
            <p class="setting-help-text">나만의 팬페이지 바로가기를 추가하거나 드래그하여 순서를 관리할 수 있습니다.</p>
            <div class="reorder-list" id="fanpageReorderList"></div>
            
            <div class="fanpage-add-box">
              <div class="fanpage-input-row">
                <input type="text" id="newFpIcon" placeholder="이모지/아이콘" maxlength="4" style="width: 86px;">
                <input type="text" id="newFpName" placeholder="팬페이지 이름 (예: 리센느 팬카페)" style="flex: 1;">
              </div>
              <div class="fanpage-input-row" style="margin-top: 8px;">
                <input type="url" id="newFpUrl" placeholder="웹사이트 URL (https://...)" style="flex: 1;">
                <button class="setting-action-btn primary" id="addNewFanpageBtn">추가</button>
              </div>
            </div>
          </div>
        </div>

        <div class="settings-modal-footer">
          <button class="setting-action-btn danger-outline" id="resetSettingsBtn">기본값 복원</button>
          <span class="settings-save-notice" id="settingsSaveNotice"></span>
          <button class="setting-action-btn primary" id="saveSettingsDoneBtn">완료</button>
        </div>
      </div>
    </div>
  `;
}
