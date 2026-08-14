// common/templates.js - 원자/분자/섹션 계층형 HTML 컴포넌트 팩토리
import { TAB_CONFIG_LIST, OFFICIAL_CHANNELS, FANPAGE_LIST, CHANNEL_DATA_MAP } from '../constants.js';

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

  if (tab.channelKey && channelMap[tab.channelKey]) {
    const chData = channelMap[tab.channelKey];
    if (chData.svg) {
      iconHtml = `<span class="tab-icon-wrap">${chData.svg}</span>`;
    } else if (chData.img) {
      const isCustom = chData.img.includes('logo') || chData.img.includes('dc') ? ' tab-icon-dc' : '';
      iconHtml = `<span class="tab-icon-wrap"><img class="${isCustom}" src="${chData.img}" alt="${escapeHtml(tab.label)}"></span>`;
    }
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

  return `
    <a href="${channel.url || data.url}" target="_blank" class="hub-icon-btn" data-key="${channel.key}" title="${escapeHtml(channel.name || data.name)}" draggable="true">
      ${iconContent}
    </a>
  `;
}

export function createThemeToggleButtonsHTML() {
  return `
    <div class="header-controls">
      <button class="theme-toggle-btn" id="openDashboardBtn" title="대시보드 열기"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:2px;"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect></svg>대시보드</button>
      <button class="theme-toggle-btn" id="themeToggleBtn" title="테마 전환">🌓 테마</button>
    </div>
  `;
}

export function createHScrollButtonsHTML() {
  return `
    <button class="hscroll-btn left" aria-label="이전 영상">◀</button>
    <button class="hscroll-btn right" aria-label="다음 영상">▶</button>
  `;
}

export function createCalendarNavButtonsHTML(monthTitle = '2026년 스케줄') {
  return `
    <div class="calendar-header-left">
      <button class="cal-nav-btn" id="spPrevMonthBtn">◀</button>
      <span id="spCalendarMonthTitle">${escapeHtml(monthTitle)}</span>
      <button class="cal-nav-btn" id="spNextMonthBtn">▶</button>
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

  return `
    <a href="${url}" target="_blank" class="video-card">
      <img src="${thumbnail}" alt="${title}" loading="lazy">
      <div class="card-info">
        <span class="card-title" title="${title}">${title}</span>
        ${dateStr ? `<span class="card-date">📅 ${escapeHtml(dateStr)}</span>` : ''}
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

// 상단 탭 네비게이션 바 생성
export function createTabBarHTML(tabs = TAB_CONFIG_LIST, { tabBarId = 'mainTabBar' } = {}) {
  const enabledTabs = tabs.filter(t => t.enabled !== false);
  const buttonsHtml = enabledTabs.map(t => createTabButtonHTML(t)).join('\n    ');

  return `
  <div class="panel-tab-bar" id="${tabBarId}">
    ${createTabGlassSliderHTML()}
    ${buttonsHtml}
  </div>
  `;
}

// 각 탭의 컨텐츠 컨테이너 생성
export function createTabContainersHTML(tabs = TAB_CONFIG_LIST) {
  const enabledTabs = tabs.filter(t => t.enabled !== false);

  return enabledTabs.map(tab => {
    const activeClass = tab.defaultActive ? ' active' : '';

    if (tab.type === 'home') {
      return `<div class="panel-tab-content${activeClass}" id="${tab.id}"></div>`;
    }

    if (tab.type === 'schedule') {
      return `
      <div class="panel-tab-content${activeClass}" id="${tab.id}">
        ${createCalendarWrapperHTML()}
      </div>`;
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
  return `<a href="#" id="liveBanner" target="_blank" style="display: none;">🔴 [ON AIR] 리센느 실시간 라이브 중! 클릭 이동</a>`;
}

// 공식 채널 바로가기 허브 카드
export function createHubCardHTML(channels = OFFICIAL_CHANNELS, channelMap = CHANNEL_DATA_MAP, { showControls = true } = {}) {
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

// 원이 채널 섹션 카드
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
      <h2>📅 스케줄</h2>
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
      <h2>🌟 팬페이지 바로가기</h2>
      <div class="fanpage-links-grid">
        ${linksHtml}
      </div>
    </div>
  `;
}

// 캘린더 래퍼 뷰
export function createCalendarWrapperHTML(initialMonthTitle = '스케줄 캘린더') {
  return `
    <div class="calendar-wrapper">
      <div class="calendar-header">
        ${createCalendarNavButtonsHTML(initialMonthTitle)}
      </div>
      <div class="calendar-weekdays">
        <div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div>
      </div>
      <div class="calendar-grid" id="spCalendarGrid"></div>
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
            <button class="modal-close-btn" id="modalCloseBtn">✕</button>
          </div>
          <div class="modal-body" id="modalBodyContent"></div>
        </div>

        <!-- 2. 임베드 미디어 전용 추가 카드 (미디어 존재 시 노출) -->
        <div class="schedule-embed-card" id="modalEmbedCard" style="display: none;">
          <div class="modal-header">
            <span class="embed-modal-title">🎬 관련 미디어</span>
          </div>
          <div class="embed-modal-body" id="modalEmbedBodyContent"></div>
        </div>
      </div>
    </div>
    <div class="schedule-tooltip" id="scheduleTooltip"></div>
  `;
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
