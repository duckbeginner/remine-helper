// common/common.js - 공통 UI 로직, 동적 탭 엔진, 인터랙션 및 렌더러 모듈
import { TAB_CONFIG_LIST, CHANNEL_DATA_MAP, DEFAULT_USER_SETTINGS, FANPAGE_LIST, MEMBER_NICKNAME_MAP, MEMBER_AVATAR_MAP } from '../constants.js';
import { escapeHtml, createVideoCardHTML, createFanpageLinkCardHTML, createScheduleModalHTML, createSettingsModalHTML } from './templates.js';

// =========================================================================
// 환경 감지 & 콘솔 로깅 제어 (로컬 개발/테스트 모드에서만 console.log 활성화)
// =========================================================================
(function initConsoleGuard() {
  const isDev = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest && !('update_url' in chrome.runtime.getManifest());
  if (!isDev) {
    const noop = () => {};
    console.log = noop;
    console.info = noop;
    console.debug = noop;
    console.warn = noop;
  }
})();

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

/* =========================================================================
   0. 3단계 순환 테마 엔진 (3-State Theme Engine: System -> Dark -> Light)
   ========================================================================= */

export function initThemeEngine(themeToggleBtn, { onThemeChange, initialMode } = {}) {
  const bodyEl = document.body;
  const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

  function applyTheme(mode, { withTransition = false } = {}) {
    if (withTransition) {
      document.documentElement.classList.add('theme-transitioning');
      setTimeout(() => {
        document.documentElement.classList.remove('theme-transitioning');
      }, 350);
    }

    let isDark = false;
    if (mode === 'dark') {
      isDark = true;
    } else if (mode === 'light') {
      isDark = false;
    } else {
      isDark = systemThemeQuery.matches;
    }

    try {
      localStorage.setItem('themeMode', mode);
    } catch (e) { }

    const docEl = document.documentElement;
    docEl.classList.toggle('dark-mode', isDark);
    docEl.style.colorScheme = isDark ? 'dark' : 'light';
    docEl.style.backgroundColor = isDark ? '#181520' : '#fff0f5';

    if (bodyEl) {
      bodyEl.classList.toggle('dark-mode', isDark);
    }

    // 열려있는 임베드 iframe들의 테마 파라미터 실시간 업데이트
    const themeStr = isDark ? 'dark' : 'light';
    const iframes = document.querySelectorAll('.feed-iframe-wrapper iframe');
    iframes.forEach(iframe => {
      const src = iframe.src;
      if (src && src.includes('theme=')) {
        const newSrc = src.replace(/theme=(dark|light)/i, `theme=${themeStr}`);
        if (newSrc !== src) {
          iframe.src = newSrc;
        }
      }
    });

    // Shorts 원격 Iframe에 실시간 테마 변경 알림
    const shortsFrame = document.getElementById('shortsTabFrame');
    if (shortsFrame && shortsFrame.contentWindow) {
      try {
        shortsFrame.contentWindow.postMessage({ type: 'SET_THEME', isDark }, '*');
      } catch (e) { }
    }

    // 문서 내 모든 테마 토글 버튼 상태 업데이트 (사이드바 및 대시보드)
    const allThemeBtns = document.querySelectorAll('#themeToggleBtn');
    allThemeBtns.forEach(btn => {
      const svgHolder = btn.querySelector('.vtab-icon-svg');
      const emojiEl = btn.querySelector('.vtab-icon-emoji');
      const labelEl = btn.querySelector('.vtab-btn-label');

      if (svgHolder) {
        if (mode === 'dark') {
          svgHolder.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
          if (labelEl) labelEl.textContent = '다크';
        } else if (mode === 'light') {
          svgHolder.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
          if (labelEl) labelEl.textContent = '라이트';
        } else {
          svgHolder.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor"></path></svg>`;
          if (labelEl) labelEl.textContent = '시스템';
        }
      } else if (emojiEl && labelEl) {
        if (mode === 'dark') {
          emojiEl.textContent = '🌙';
          labelEl.textContent = '다크';
        } else if (mode === 'light') {
          emojiEl.textContent = '☀️';
          labelEl.textContent = '라이트';
        } else {
          emojiEl.textContent = '💻';
          labelEl.textContent = '시스템';
        }
      } else {
        if (mode === 'dark') {
          btn.innerText = '🌙 다크';
        } else if (mode === 'light') {
          btn.innerText = '☀️ 라이트';
        } else {
          btn.innerText = '💻 시스템';
        }
      }
    });

    if (typeof onThemeChange === 'function') {
      onThemeChange(mode, isDark);
    }
  }

  // 초기 테마 로드 (0ms 동기 즉시 적용 - 트랜지션 없음)
  const syncCachedMode = initialMode || (function () {
    try { return localStorage.getItem('themeMode'); } catch (e) { return null; }
  })() || 'system';
  applyTheme(syncCachedMode, { withTransition: false });

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['themeMode'], (res) => {
      const currentMode = res.themeMode || 'system';
      if (currentMode !== syncCachedMode) {
        applyTheme(currentMode, { withTransition: false });
      }
    });

    // 다른 창(사이드패널 <-> 대시보드) 간 실시간 테마 변경 동기화
    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.themeMode) {
          applyTheme(changes.themeMode.newValue || 'system', { withTransition: true });
        }
      });
    }

    // OS 시스템 테마 실시간 변경 감지
    systemThemeQuery.addEventListener('change', () => {
      chrome.storage.local.get(['themeMode'], (res) => {
        const currentMode = res.themeMode || 'system';
        if (currentMode === 'system') {
          applyTheme('system', { withTransition: true });
        }
      });
    });

    // 전역 이벤트 위임: 어떤 #themeToggleBtn이든 클릭 시 3단계 순환 (시스템 -> 다크 -> 라이트)
    if (!window.__themeDelegationInitialized) {
      window.__themeDelegationInitialized = true;
      document.addEventListener('click', (e) => {
        const btn = e.target.closest('#themeToggleBtn');
        if (btn) {
          chrome.storage.local.get(['themeMode'], (res) => {
            let currentMode = res.themeMode || 'system';
            let nextMode = 'system';

            if (currentMode === 'system') nextMode = 'dark';
            else if (currentMode === 'dark') nextMode = 'light';
            else if (currentMode === 'light') nextMode = 'system';

            chrome.storage.local.set({ themeMode: nextMode });
            applyTheme(nextMode, { withTransition: true });
          });
        }
      });
    }
  } else if (!initialMode) {
    applyTheme('system', { withTransition: false });
  }

  return { applyTheme };
}

/* =========================================================================
   1. 동적 탭 & 크리스탈 글래스 슬라이더 엔진 (Tab & Glass Slider Engine)
   ========================================================================= */

export function updateGlassSlider(targetBtn, sliderEl) {
  if (!sliderEl || !targetBtn) return;

  const isVertical = sliderEl.classList.contains('vtab-slider') || targetBtn.classList.contains('vtab-btn');
  const inset = 2;

  if (isVertical) {
    sliderEl.style.top = `${targetBtn.offsetTop + inset}px`;
    sliderEl.style.height = `${targetBtn.offsetHeight - inset * 2}px`;
    sliderEl.style.left = `${targetBtn.offsetLeft + inset}px`;
    sliderEl.style.width = `${targetBtn.offsetWidth - inset * 2}px`;
  } else {
    sliderEl.style.left = `${targetBtn.offsetLeft + inset}px`;
    sliderEl.style.width = `${targetBtn.offsetWidth - inset * 2}px`;
  }
}

// 지정된 컨테이너 또는 전체 페이지 내의 모든 미디어(iframe, video, audio) 재생 및 소리 즉시 중지
export function stopAllIframeMedia(container = document, forceReset = false) {
  if (!container) return;

  // 1. 모든 iframe (유튜브, 인스타, 틱톡, X 등) 일시정지 postMessage 전송
  const iframes = container.querySelectorAll('iframe');
  iframes.forEach(iframe => {
    try {
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
        iframe.contentWindow.postMessage('{"event":"command","func":"stopVideo","args":""}', '*');
        iframe.contentWindow.postMessage('{"method":"pause"}', '*');
        iframe.contentWindow.postMessage({ method: 'pause' }, '*');
        iframe.contentWindow.postMessage({ type: 'pause' }, '*');
      }
      if (forceReset) {
        const currentSrc = iframe.src;
        if (currentSrc && currentSrc !== 'about:blank') {
          iframe.src = currentSrc;
        }
      }
    } catch (e) {
      // ignore
    }
  });

  // 3. HTML5 비디오/오디오 정지
  const html5Medias = container.querySelectorAll('video, audio');
  html5Medias.forEach(media => {
    try {
      media.pause();
      if (forceReset) media.currentTime = 0;
    } catch (e) {
      // ignore
    }
  });
}

export function initTabEngine(tabBarEl, sliderEl, tabList = TAB_CONFIG_LIST, { onTabChange } = {}) {
  if (!tabBarEl) return;

  const tabButtons = tabBarEl.querySelectorAll('.panel-tab-btn, .vtab-btn');
  const tabContents = document.querySelectorAll('.panel-tab-content');
  const loadedMap = {};

  // 마우스 호버 시 글래스 슬라이더 등장
  if (sliderEl) {
    tabBarEl.addEventListener('mouseenter', () => {
      sliderEl.classList.add('visible');
      const activeBtn = tabBarEl.querySelector('.panel-tab-btn.active, .vtab-btn.active');
      if (activeBtn) updateGlassSlider(activeBtn, sliderEl);
    });

    tabBarEl.addEventListener('mouseleave', () => {
      sliderEl.classList.remove('visible');
    });

    tabButtons.forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        sliderEl.classList.add('visible');
        updateGlassSlider(btn, sliderEl);
      });
    });

    window.addEventListener('resize', () => {
      const currentActive = tabBarEl.querySelector('.panel-tab-btn.active, .vtab-btn.active');
      if (currentActive) updateGlassSlider(currentActive, sliderEl);
    });
  }

  // 탭 클릭 이벤트 바인딩
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const tabConfig = tabList.find(t => t.id === targetId);

      // 버튼 active 정리
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (sliderEl) updateGlassSlider(btn, sliderEl);

      // 컨텐츠 뷰 전환 및 비활성화되는 모든 이전 탭의 미디어 재생 즉시 중지 (src 임시 언로드)
      tabContents.forEach(content => {
        if (content.id === targetId) {
          content.classList.add('active');
          // 활성화된 탭의 iframe src 복원
          const savedIframes = content.querySelectorAll('iframe[data-saved-src]');
          savedIframes.forEach(iframe => {
            iframe.src = iframe.getAttribute('data-saved-src');
            iframe.removeAttribute('data-saved-src');
          });
        } else {
          // 비활성화된 탭의 iframe src를 about:blank로 전환하여 소리/재생 100% 즉시 중지
          const iframes = content.querySelectorAll('iframe');
          iframes.forEach(iframe => {
            if (iframe.src && iframe.src !== 'about:blank' && !iframe.getAttribute('data-saved-src')) {
              iframe.setAttribute('data-saved-src', iframe.src);
              iframe.src = 'about:blank';
            }
          });
          // HTML5 미디어도 일시정지
          const medias = content.querySelectorAll('video, audio');
          medias.forEach(m => { try { m.pause(); } catch (e) { } });
          content.classList.remove('active');
        }
      });

      // 탭 타입별 지연 렌더링 (Lazy Loading)
      if (tabConfig && !loadedMap[targetId]) {
        const isDark = document.body.classList.contains('dark-mode');

        if (tabConfig.type === 'iframe') {
          const containerId = `${targetId.replace('tab', '').toLowerCase()}FeedList`;
          const container = document.getElementById(containerId);
          if (container) {
            renderIframeTab(container, tabConfig, isDark);
            loadedMap[targetId] = true;
          }
        }
      }

      if (typeof onTabChange === 'function') {
        onTabChange(targetId, tabConfig, loadedMap);
      }
    });
  });

  // 사이드패널 닫힘 또는 탭 백그라운드 전환 시 모든 미디어 자동 정지
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stopAllIframeMedia(document);
    }
  });
  window.addEventListener('pagehide', () => stopAllIframeMedia(document));
  window.addEventListener('beforeunload', () => stopAllIframeMedia(document));

  // 초기 활성 탭 슬라이더 위치 설정 및 초기 로딩 트리거
  const initialActiveBtn = tabBarEl.querySelector('.panel-tab-btn.active, .vtab-btn.active');
  if (initialActiveBtn) {
    if (sliderEl) updateGlassSlider(initialActiveBtn, sliderEl);
    const targetId = initialActiveBtn.getAttribute('data-target');
    const tabConfig = tabList.find(t => t.id === targetId);
    if (tabConfig && !loadedMap[targetId]) {
      const isDark = document.body.classList.contains('dark-mode');
      if (tabConfig.type === 'iframe') {
        const containerId = `${targetId.replace('tab', '').toLowerCase()}FeedList`;
        const container = document.getElementById(containerId);
        if (container) {
          renderIframeTab(container, tabConfig, isDark);
          loadedMap[targetId] = true;
        }
      }
      if (typeof onTabChange === 'function') {
        onTabChange(targetId, tabConfig, loadedMap);
      }
    }
  }

  return {
    loadedMap,
    switchTab: (targetId) => {
      const btn = tabBarEl.querySelector(`.panel-tab-btn[data-target="${targetId}"], .vtab-btn[data-target="${targetId}"]`);
      if (btn) btn.click();
    }
  };
}

export function setupHorizontalScroller(target) {
  const orig = typeof target === 'string' ? document.getElementById(target) : target;
  if (!orig) return;

  let viewport = orig.querySelector('.hscroll-viewport');

  // viewport가 없으면 생성하여 자식들을 안전하게 이동
  if (!viewport) {
    // 기존 버튼들이 남아있다면 정리
    const oldBtns = orig.querySelectorAll('.hscroll-btn');
    oldBtns.forEach(b => b.remove());

    viewport = document.createElement('div');
    viewport.className = 'hscroll-viewport';
    while (orig.firstChild) {
      viewport.appendChild(orig.firstChild);
    }
    orig.appendChild(viewport);
    orig.classList.add('hscroll-container');

    const leftBtn = document.createElement('button');
    leftBtn.className = 'hscroll-btn left';
    leftBtn.setAttribute('aria-label', '이전 영상');
    leftBtn.innerText = '◀';

    const rightBtn = document.createElement('button');
    rightBtn.className = 'hscroll-btn right';
    rightBtn.setAttribute('aria-label', '다음 영상');
    rightBtn.innerText = '▶';

    orig.insertBefore(leftBtn, viewport);
    orig.appendChild(rightBtn);

    function scrollByCards(count) {
      const card = viewport.querySelector('.video-card');
      const gap = parseFloat(getComputedStyle(viewport).gap) || 8;
      const cardWidth = card ? Math.ceil(card.getBoundingClientRect().width + gap) : 180;
      viewport.scrollBy({ left: cardWidth * count, behavior: 'smooth' });
    }

    leftBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      scrollByCards(-2);
    });

    rightBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      scrollByCards(2);
    });

    viewport.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
        e.preventDefault();
        viewport.scrollLeft += e.deltaY;
      }
    }, { passive: false });

    // 마우스 드래그 스크롤 지원
    let isDown = false;
    let startX;
    let scrollLeft;

    viewport.addEventListener('mousedown', (e) => {
      isDown = true;
      startX = e.pageX - viewport.offsetLeft;
      scrollLeft = viewport.scrollLeft;
    });

    viewport.addEventListener('mouseleave', () => {
      isDown = false;
    });

    viewport.addEventListener('mouseup', () => {
      isDown = false;
    });

    viewport.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - viewport.offsetLeft;
      const walk = (x - startX) * 1.5;
      viewport.scrollLeft = scrollLeft - walk;
    });
  }
}


/* =========================================================================
   3. 공식 채널 허브 드래그 앤 드롭 정렬 엔진 (Hub Reordering Engine)
   ========================================================================= */

export function setupHubIconReordering(containerEl, onOrderChanged) {
  if (!containerEl) return;

  let dragSrcEl = null;

  function handleDragStart(e) {
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.getAttribute('data-key'));

    // dragstart 순간의 모습을 고정한 ghost 이미지 생성
    // (DOM이 즉시 이동하면 브라우저 ghost가 달라지는 현상 방지)
    const ghost = this.cloneNode(true);
    ghost.style.cssText = `
      position: fixed;
      top: -1000px; left: -1000px;
      width: ${this.offsetWidth}px;
      height: ${this.offsetHeight}px;
      border-radius: 50%;
      opacity: 0.9;
      pointer-events: none;
    `;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, this.offsetWidth / 2, this.offsetHeight / 2);
    setTimeout(() => ghost.remove(), 0);

    // dragging 클래스는 다음 틱에 적용 (ghost 캡처 이후)
    requestAnimationFrame(() => this.classList.add('dragging'));
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  function handleDragEnter(e) {
    e.preventDefault();
    if (!dragSrcEl || dragSrcEl === this) return;

    // 드래그 중 실시간 DOM 재배치 (미리보기)
    const allBtns = Array.from(containerEl.querySelectorAll('.hub-icon-btn'));
    const srcIdx = allBtns.indexOf(dragSrcEl);
    const targetIdx = allBtns.indexOf(this);

    if (srcIdx < targetIdx) {
      this.parentNode.insertBefore(dragSrcEl, this.nextSibling);
    } else {
      this.parentNode.insertBefore(dragSrcEl, this);
    }
  }

  function handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();

    // 드롭 시 최종 순서 저장
    if (typeof onOrderChanged === 'function') {
      const newOrder = Array.from(containerEl.querySelectorAll('.hub-icon-btn'))
        .map(b => b.getAttribute('data-key'));
      onOrderChanged(newOrder);
    }
    return false;
  }

  function handleDragEnd() {
    this.classList.remove('dragging');
    containerEl.querySelectorAll('.hub-icon-btn').forEach(item => {
      item.classList.remove('over');
    });
  }

  function bindItem(item) {
    item.setAttribute('draggable', 'true');
    item.addEventListener('dragstart', handleDragStart, false);
    item.addEventListener('dragenter', handleDragEnter, false);
    item.addEventListener('dragover', handleDragOver, false);
    item.addEventListener('drop', handleDrop, false);
    item.addEventListener('dragend', handleDragEnd, false);
  }

  containerEl.querySelectorAll('.hub-icon-btn').forEach(bindItem);
}

/* =========================================================================
   4. 유튜브 비디오 렌더러 (YouTube Video Renderers)
   ========================================================================= */

export function renderOfficialYoutubeList(container, videos = []) {
  if (!container) return;
  const cardsHtml = (!videos || videos.length === 0)
    ? '<p style="font-size: 12px; color: #777; text-align: center; width: 100%;">등록된 영상이 없습니다.</p>'
    : videos.map(v => createVideoCardHTML(v)).join('');

  const viewport = container.querySelector('.hscroll-viewport');
  if (viewport) {
    viewport.innerHTML = cardsHtml;
  } else {
    container.innerHTML = cardsHtml;
  }
}

export function renderWoniYoutubeList(container, videos = []) {
  if (!container) return;
  const cardsHtml = (!videos || videos.length === 0)
    ? '<p style="font-size: 12px; color: #777; text-align: center; width: 100%;">등록된 영상이 없습니다.</p>'
    : videos.map(v => createVideoCardHTML(v)).join('');

  const viewport = container.querySelector('.hscroll-viewport');
  if (viewport) {
    viewport.innerHTML = cardsHtml;
  } else {
    container.innerHTML = cardsHtml;
  }
}

/**
 * 스토리지 내 모든 비디오 풀에서 Shorts 영상만 추출하여 최신순 정렬
 */
export function extractAllShortsVideos(data = {}) {
  const pool = [
    ...(data.latestVideos || []),
    ...(data.officialPlaylistVideos || []),
    ...(data.woniVideos || [])
  ];
  const seen = new Set();
  const shorts = [];
  for (const v of pool) {
    if (!v || !v.id) continue;
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    const isShort = v.isShorts || (v.url && v.url.includes('/shorts/')) || /shorts|#shorts|#Shorts|\[shorts\]|\(shorts\)|#쇼츠|#short\b/i.test((v.title || '') + ' ' + (v.url || ''));
    if (isShort) {
      shorts.push(v);
    }
  }
  // 최신순 정렬
  shorts.sort((a, b) => {
    const tA = (a.publishedAt || a.published) ? new Date(a.publishedAt || a.published).getTime() : 0;
    const tB = (b.publishedAt || b.published) ? new Date(b.publishedAt || b.published).getTime() : 0;
    return tB - tA;
  });
  return shorts;
}

// --- YouTube Iframe Player API SDK 공식 로더 ---
let isYTReady = false;
/**
 * YouTube iframe 제어 명령 전송 (공식 규격)
 */
export function sendYouTubeCommand(iframe, func, args = []) {
  if (!iframe || !iframe.contentWindow) return;
  try {
    const payload = JSON.stringify({
      event: 'command',
      func: func,
      args: Array.isArray(args) ? args : [args]
    });
    iframe.contentWindow.postMessage(payload, '*');
  } catch (e) { }
}

let cachedShortsData = null;

/**
 * 모든 Shorts 비디오 일시 정지 (샌드박스 Iframe에 전달)
 */
export function pauseAllShortsVideos() {
  const iframe = document.getElementById('shortsTabFrame');
  if (iframe && iframe.contentWindow) {
    try {
      iframe.contentWindow.postMessage({ type: 'PAUSE_ALL' }, '*');
    } catch (e) { }
  }
}

let cachedShortsIds = '';

function getMuteOnLoadSetting() {
  try {
    // 1. 메모리 캐시 또는 localStorage 확인
    const raw = localStorage.getItem('userSettings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.sound && typeof parsed.sound.muteOnLoad === 'boolean') {
        return parsed.sound.muteOnLoad;
      }
    }
  } catch (e) { }
  return false;
}

/**
 * Shorts 탭 전용 렌더러 (샌드박스/원격 Iframe에 데이터 전송)
 */
export function renderShortsList(container, shorts = []) {
  cachedShortsData = shorts;
  const isDark = document.documentElement.classList.contains('dark-mode') || document.body.classList.contains('dark-mode');
  const iframe = document.getElementById('shortsTabFrame');
  const newIds = (shorts || []).map(s => s.id).join(',');
  const muteOnLoad = getMuteOnLoadSetting();

  if (iframe && iframe.contentWindow) {
    try {
      if (cachedShortsIds === newIds && newIds.length > 0) {
        // 이미 렌더링된 동일한 비디오 목록이면 테마만 실시간 반영 (영상 재로딩 방지)
        iframe.contentWindow.postMessage({
          type: 'SET_THEME',
          isDark
        }, '*');
      } else {
        cachedShortsIds = newIds;
        iframe.contentWindow.postMessage({
          type: 'INIT_SHORTS_DATA',
          shorts: shorts || [],
          isDark,
          muteOnLoad
        }, '*');
      }
    } catch (e) { }
  }
}

// 샌드박스 Iframe이 로드 완료 신호(SHORTS_SANDBOX_READY)를 보내면 최신 데이터 즉시 주입
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHORTS_SANDBOX_READY') {
      const isDark = document.documentElement.classList.contains('dark-mode') || document.body.classList.contains('dark-mode');
      const iframe = document.getElementById('shortsTabFrame');
      const muteOnLoad = getMuteOnLoadSetting();
      if (iframe && iframe.contentWindow) {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['latestVideos', 'officialPlaylistVideos', 'woniVideos'], (res) => {
            const shorts = (res && (res.latestVideos || res.officialPlaylistVideos || res.woniVideos))
              ? extractAllShortsVideos(res)
              : (cachedShortsData || []);
            cachedShortsData = shorts;
            iframe.contentWindow.postMessage({
              type: 'INIT_SHORTS_DATA',
              shorts: shorts,
              isDark,
              muteOnLoad
            }, '*');
          });
        } else if (cachedShortsData) {
          iframe.contentWindow.postMessage({
            type: 'INIT_SHORTS_DATA',
            shorts: cachedShortsData,
            isDark,
            muteOnLoad
          }, '*');
        }
      }
    }
  });
}

/* =========================================================================
   5. 스케줄 리스트 렌더러 (Schedule List Renderer)
   ========================================================================= */

export function parseSafeDate(startTimeStr) {
  if (!startTimeStr) return new Date();
  if (startTimeStr.length === 10 && !startTimeStr.includes('T')) {
    const [y, m, d] = startTimeStr.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0);
  }
  const d = new Date(startTimeStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function cleanScheduleText(text) {
  if (!text) return "";
  return text
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]/gu, '')
    .replace(/[<>\[\]{}()_!?,.~`'"•\-\/]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeTitle(title) {
  let clean = cleanScheduleText(title);

  const synonyms = {
    'show champion': '쇼챔피언',
    'm countdown': '엠카운트다운',
    'music bank': '뮤직뱅크',
    'inkigayo': '인기가요',
    'the show': '더쇼',
    'music core': '음악중심',
    'kcon': '케이콘',
    'k world dream awards': '케이월드드림어워즈',
    'k-world dream awards': '케이월드드림어워즈',
    'kwda': '케이월드드림어워즈',
    'dream concert': '드림콘서트',
    '맨시티': '맨체스터시티',
    'man city': '맨체스터시티',
    'mancity': '맨체스터시티',
    'water music pool party': '워터뮤직풀파티',
    'just makeup': '저스트메이크업',
  };

  for (let [en, ko] of Object.entries(synonyms)) {
    if (clean.includes(en)) {
      clean = clean.replace(new RegExp(en, 'g'), ko);
    }
  }

  return clean.replace(/\s+/g, '');
}

export function parseTitleStructure(title) {
  if (!title) return { main: '', sub: '' };

  // 1. <메인> 서브 또는 [메인] 서브
  const bracketMatch = title.match(/^[<\[](.+?)[>\]]\s*(.*)$/);
  if (bracketMatch) {
    return {
      main: normalizeTitle(bracketMatch[1]),
      sub: normalizeTitle(bracketMatch[2])
    };
  }

  // 2. 메인 - 서브 또는 메인 | 서브 또는 메인 : 서브
  const dashMatch = title.match(/^(.+?)\s*[-|:]\s*(.+)$/);
  if (dashMatch) {
    return {
      main: normalizeTitle(dashMatch[1]),
      sub: normalizeTitle(dashMatch[2])
    };
  }

  return {
    main: normalizeTitle(title),
    sub: ''
  };
}

export function areSchedulesDuplicate(item1, item2) {
  // 0단계: 유튜브 영상 ID 대조 (서로 다른 영상 ID를 가지고 있으면 100% 다른 일정이므로 병합 거부!)
  const extractYtId = (item) => {
    const text = [item.url, item.link, item.message, item.title].filter(Boolean).join(' ');
    const match = text.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
    return match ? match[1] : null;
  };

  const yt1 = extractYtId(item1);
  const yt2 = extractYtId(item2);
  if (yt1 && yt2) {
    if (yt1 === yt2) return true; // 동일 영상 ID면 무조건 동일 일정
    return false; // 서로 다른 영상 ID면 절대로 중복 아님!
  }

  // 순수 제목 기준 비교 (본문 메시지에 의한 오병합 방지)
  const t1 = item1.title || "";
  const t2 = item2.title || "";
  if (!t1 || !t2) return false;

  // 1단계: 구조적 메인-부제(Sub-event) 분석 기반 정밀 판별 (하드코딩 0%)
  const s1 = parseTitleStructure(t1);
  const s2 = parseTitleStructure(t2);

  if (s1.main && s2.main) {
    const isSameMain = s1.main === s2.main ||
      (Math.min(s1.main.length, s2.main.length) >= 4 && (s1.main.includes(s2.main) || s2.main.includes(s1.main)));

    if (isSameMain) {
      // 둘 다 서브타이틀(부제)이 존재하는 경우
      if (s1.sub && s2.sub) {
        // 부제가 일치하거나 포함 관계이면 같은 세부 무대/코너 (중복 병합)
        if (s1.sub === s2.sub || s1.sub.includes(s2.sub) || s2.sub.includes(s1.sub)) {
          return true;
        }
        // 부제가 서로 다르면 (예: 프리뷰쇼 vs 하프타임쇼, SHOWCASE vs CONCERT) 서로 다른 세부 행사 (분리 보존)
        return false;
      }
      // 한쪽만 부제가 있고 다른 한쪽은 전체 메인 행사명인 경우 구체적 정보로 병합
      return true;
    }

    // 구조적 교차 매칭: 한쪽의 부제(sub)가 다른 쪽의 메인(main)과 일치하거나 포함 관계인 경우
    // (예: <대회명> 맨시티 vs AT마드리드 하프타임쇼 <-> <맨시티 vs AT마드리드 하프타임쇼>)
    if (s1.sub && s2.main && Math.min(s1.sub.length, s2.main.length) >= 4 && (s1.sub === s2.main || s1.sub.includes(s2.main) || s2.main.includes(s1.sub))) {
      return true;
    }
    if (s2.sub && s1.main && Math.min(s2.sub.length, s1.main.length) >= 4 && (s2.sub === s1.main || s2.sub.includes(s1.main) || s1.main.includes(s2.sub))) {
      return true;
    }
  }

  // 2단계: 카테고리/형태가 명확히 다른 경우(방송 vs 현장 공연/행사 등) 병합 거부
  const type1 = item1.typeId || 0;
  const type2 = item2.typeId || 0;
  const isBroadcasting1 = type1 === 1 || (item1.extField && item1.extField.key === '채널') || (item1.typeText === '방송');
  const isPhysicalEvent1 = type1 === 5 || (item1.extField && item1.extField.key === '장소') || (item1.typeText === '공연' || item1.typeText === '행사');
  const isBroadcasting2 = type2 === 1 || (item2.extField && item2.extField.key === '채널') || (item2.typeText === '방송');
  const isPhysicalEvent2 = type2 === 5 || (item2.extField && item2.extField.key === '장소') || (item2.typeText === '공연' || item2.typeText === '행사');

  // 하나는 순수 방송(온라인/중계)이고 하나는 순수 현장 공연/행사인 경우 분리 보존
  if ((isBroadcasting1 && !isPhysicalEvent1 && isPhysicalEvent2 && !isBroadcasting2) ||
    (isBroadcasting2 && !isPhysicalEvent2 && isPhysicalEvent1 && !isBroadcasting1)) {
    return false;
  }

  // 3단계: 정규화 텍스트 완전 일치 및 포함 관계
  const n1 = normalizeTitle(t1);
  const n2 = normalizeTitle(t2);
  if (n1 && n2) {
    if (n1 === n2) return true;
    if ((n1.includes(n2) || n2.includes(n1)) && Math.min(n1.length, n2.length) >= 4) {
      return true;
    }
  }

  // 4단계: 괄호 안팎 한/영 분리 매칭
  const extractParts = (str) => {
    const parts = [str];
    const match = str.match(/(.*?)\((.*?)\)/);
    if (match) {
      if (match[1].trim()) parts.push(match[1].trim());
      if (match[2].trim()) parts.push(match[2].trim());
    }
    return parts;
  };

  const parts1 = extractParts(t1).map(normalizeTitle);
  const parts2 = extractParts(t2).map(normalizeTitle);

  for (let p1 of parts1) {
    for (let p2 of parts2) {
      if (p1 && p2 && p1.length >= 4 && p2.length >= 4) {
        if (p1 === p2 || p1.includes(p2) || p2.includes(p1)) {
          return true;
        }
      }
    }
  }

  // 3단계: 단어 교집합 유사도 (순수 제목 기반)
  const words1 = cleanScheduleText(t1).split(' ').filter(w => w.length >= 2);
  const words2 = cleanScheduleText(t2).split(' ').filter(w => w.length >= 2);
  if (words1.length > 0 && words2.length > 0) {
    const intersection = words1.filter(w => words2.includes(w));
    if (intersection.length >= 2 && Math.max(words1.length, words2.length) <= intersection.length + 1) {
      return true;
    }
  }

  return false;
}

export function pickBestTitle(title1, title2) {
  if (!title1) return title2 || "";
  if (!title2) return title1 || "";
  if (title1.includes('(') && !title2.includes('(')) return title1;
  if (title2.includes('(') && !title1.includes('(')) return title2;
  return title1.length >= title2.length ? title1 : title2;
}

let _lastScheduleInputRef = null;
let _lastScheduleCleanResult = null;

export function deduplicateScheduleList(schedules = []) {
  if (!Array.isArray(schedules) || schedules.length === 0) return [];

  // 참조 및 길이 기반 0ms 즉각 반환 메모이제이션
  if (_lastScheduleInputRef === schedules && _lastScheduleCleanResult) {
    return _lastScheduleCleanResult;
  }
  if (_lastScheduleInputRef && _lastScheduleInputRef.length === schedules.length && _lastScheduleCleanResult) {
    if (_lastScheduleInputRef[0] === schedules[0] && _lastScheduleInputRef[schedules.length - 1] === schedules[schedules.length - 1]) {
      return _lastScheduleCleanResult;
    }
  }

  const mergedList = [];

  // 직캠, 투표, 쇼츠, 포스터/응모/증정/공지 이벤트 정밀 필터링
  const excludePatterns = [
    /직캠/i, /풀캠/i, /팬캠/i, /페이스캠/i, /입덕직캠/i, /최애직캠/i, /팔로우캠/i, /안방1열/i, /음중직캠/i, /음중풀캠/i, /음중팔로우캠/i,
    /fan\W*cam/i, /k\W*fancam/i, /choreo/i, /fancam/i, /\bcam\b/i,
    // 쇼츠 제외
    /shorts/i, /#shorts/i, /#쇼츠/i, /\/shorts\//i,
    // 투표 관련 일정 제외
    /투표/i, /사전투표/i, /실시간투표/i, /\bvote\b/i, /\bvoting\b/i, /\bpoll\b/i,
    /덕애드/i, /스타패스/i, /아이돌챔프/i, /뮤빗/i, /팬플러스/i, /포도알/i, /케이돌/i, /엠넷플러스\s*투표/i,
    // 포스터/응모/증정/빅크/특전 이벤트 및 단순 공지 제외
    /포스터\s*이벤트/i, /사인\s*.*이벤트/i, /싸인\s*.*이벤트/i, /이벤트\s*안내/i, /안내\s*\(Notice\)/i,
    /\[빅크/i, /\bBIGC\b/i, /응모\s*이벤트/i, /증정\s*이벤트/i, /특전\s*이벤트/i, /구매자\s*이벤트/i,
    /럭키드로우/i, /\b럭드\b/i
  ];

  const filtered = schedules.filter(item => {
    const text = [item.title, item.message, item.url, item.link].filter(Boolean).join(" ");
    if (excludePatterns.some(p => p.test(text))) return false;

    // 1) 쇼츠 영상 링크/ID를 포함하는 일정은 제외
    const ytIdMatches = text.matchAll(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/g);
    for (const m of ytIdMatches) {
      if (text.includes('/shorts/') || /shorts|#shorts|#쇼츠/i.test(text)) return false;
    }

    // 2) 유튜브 채널 홈 URL만 있고 특정 영상 ID가 없는 유튜브 자컨/라이브 플레이스홀더 알림 일정만 선별 제외
    const hasSpecificVideoLink = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|live\/))([\w-]{11})/.test(text);
    const isYoutubeChannelHome = /youtube\.com\/@/i.test(text);
    const cleanTitle = (item.title || '').replace(/[<>]/g, '').trim();
    const isPlaceholderChannelOnly = !hasSpecificVideoLink && (
      (isYoutubeChannelHome && /^(?:안녕하세요\s*원이입니다.*|안원잘부.*|rescene\s*vlog.*|youtube\s*live|유튜브\s*라이브)$/i.test(cleanTitle)) ||
      (isYoutubeChannelHome && /공개\s*예정\s*채널|유튜브에서\s*만나요/i.test(text))
    );
    if (isPlaceholderChannelOnly) return false;
    return true;
  });

  filtered.forEach(newItem => {
    const newD = parseSafeDate(newItem.startTime || newItem.date);
    const newDateStr = `${newD.getFullYear()}-${String(newD.getMonth() + 1).padStart(2, '0')}-${String(newD.getDate()).padStart(2, '0')}`;

    let matchedIndex = -1;

    for (let i = 0; i < mergedList.length; i++) {
      const existing = mergedList[i];
      const existD = parseSafeDate(existing.startTime || existing.date);
      const existDateStr = `${existD.getFullYear()}-${String(existD.getMonth() + 1).padStart(2, '0')}-${String(existD.getDate()).padStart(2, '0')}`;

      // ★ 반드시 같은 날짜(YYYY-MM-DD)일 때만 중복 병합! (다른 날짜의 2일차, 3일차 일정 100% 보존)
      if (newDateStr === existDateStr && areSchedulesDuplicate(existing, newItem)) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex !== -1) {
      const target = mergedList[matchedIndex];

      // Mnet 출처 우선순위 적용 (새로 들어온 항목이 Mnet이면 공식 정보 우선 반영)
      if (newItem.source === 'mnet') {
        target.source = 'mnet';
        if (newItem.typeText) target.typeText = newItem.typeText;
        if (newItem.startTime) target.startTime = newItem.startTime;
        if (newItem.endTime) target.endTime = newItem.endTime;
      }

      // 제목은 더 완성도 높고 구체적인 쪽으로 보완 (예: Blip의 <KCON LA 2026> SHOWCASE 등)
      target.title = pickBestTitle(target.title, newItem.title);

      // 상세 설명(message)은 더 상세한 쪽으로 보완
      if (newItem.message && newItem.message.length > (target.message ? target.message.length : 0)) {
        target.message = newItem.message;
      }
      if (!target.typeId && newItem.typeId) {
        target.typeId = newItem.typeId;
      }
      if (!target.typeText && newItem.typeText) {
        target.typeText = newItem.typeText;
      }
      if (!target.endTime && newItem.endTime) {
        target.endTime = newItem.endTime;
      }
      if (!target.location && newItem.location) {
        target.location = newItem.location;
      }
      if (!target.channel && newItem.channel) {
        target.channel = newItem.channel;
      }
      if (!target.extField && newItem.extField) {
        target.extField = newItem.extField;
      }
      if ((!target.starAttendees || target.starAttendees.length === 0) && (newItem.starAttendees && newItem.starAttendees.length > 0)) {
        target.starAttendees = newItem.starAttendees;
      }
      if (newItem.isOfficialYoutube) target.isOfficialYoutube = true;
      if (newItem.isWoniYoutube) target.isWoniYoutube = true;
    } else {
      mergedList.push({ ...newItem });
    }
  });

  _lastScheduleInputRef = schedules;
  _lastScheduleCleanResult = mergedList;
  return mergedList;
}

// 브라우저 윈도우 환경 안전 바인딩
if (typeof window !== 'undefined') {
  window.deduplicateScheduleList = deduplicateScheduleList;
  window.areSchedulesDuplicate = areSchedulesDuplicate;
  window.cleanScheduleText = cleanScheduleText;
  window.normalizeTitle = normalizeTitle;
  window.pickBestTitle = pickBestTitle;
  window.isBroadcasterName = isBroadcasterName;
  window.enrichSchedulesWithYouTubeOEmbed = enrichSchedulesWithYouTubeOEmbed;
}

export function isBroadcasterName(name) {
  if (!name) return false;
  const n = String(name).trim();
  return /^(?:MBC|KBS|KBS2|SBS|Mnet|JTBC|tvN|ENA|EBS|TV조선|채널A|MBN|Arirang|아리랑|CJ\s*ENM|M2|SBSKPOP|MBCkpop|KBS\s*Kpop|스튜디오\s*춤|STUDIO\s*CHOOM|1theK|원더케이|it's\s*Live|잇츠라이브)/i.test(n);
}

export function isTvMainBroadcast(item, channel) {
  const t = (item.title || '').replace(/[<>]/g, '').trim();
  const c = String(channel || '').trim();
  const isBroadcaster = /^(?:MBC|KBS|KBS2|SBS|Mnet|JTBC|tvN|ENA|EBS|TV조선|채널A|MBN)/i.test(c);
  if (!isBroadcaster) return false;

  if (/미방분|비하인드|선공개|직캠|fancam|풀버전|클립|behind|up코노|코없코|우쥬레코드|웹예능|아이돌부스/i.test(t + ' ' + (item.message || ''))) {
    return false;
  }

  if (/전지적\s*참견\s*시점|전참시|놀라운\s*토요일|놀토|복면가왕|아는\s*형님|뮤직뱅크|쇼!?\s*음악중심|인기가요|m\s*countdown|엠카운트다운|쇼!?\s*챔피언|더쇼|the\s*show|심플리\s*케이팝|simply\s*k-pop|식객\s*허영만의\s*백반기행|열혈농구단|최우수산|배성재의\s*텐|아이돌\s*라디오|친한친구/i.test(t)) {
    return true;
  }
  return false;
}

export async function enrichSchedulesWithYouTubeOEmbed(schedules) {
  if (!Array.isArray(schedules) || schedules.length === 0) return;
  const oembedCache = new Map();

  for (let item of schedules) {
    const text = [item.url, item.link, item.message, item.title].filter(Boolean).join(' ');
    const match = text.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/);
    if (!match) continue;

    const vid = match[1];
    let oeData = oembedCache.get(vid);
    if (!oeData) {
      try {
        const oeRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vid}&format=json`);
        if (oeRes.ok) {
          oeData = await oeRes.json();
          oembedCache.set(vid, oeData);
        }
      } catch (e) { }
    }

    if (oeData) {
      // 1) 썸네일 및 링크 보강
      if (!item.thumbnail || item.thumbnail.includes('rescene-logo')) {
        item.thumbnail = oeData.thumbnail_url || `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
      }
      if (!item.url) item.url = `https://www.youtube.com/watch?v=${vid}`;
      if (!item.link) item.link = item.url;

      // 2) 채널명 처리 (단, 방송사인 경우는 방송사 명을 채널명으로 유지!)
      const currentChannel = item.channel || (item.extField && (item.extField.key === '채널' || item.extField.key === '방송사') ? item.extField.value : null);
      if (!currentChannel || !isBroadcasterName(currentChannel)) {
        const author = oeData.author_name;
        if (author) {
          item.channel = author;
          item.extField = { key: '채널', value: author };
        }
      }

      // 3) 제목 재구성: TV 본방이 아닌 경우 oEmbed의 정식 제목으로 전면 변환
      const isTvShow = isTvMainBroadcast(item, currentChannel);
      if (!isTvShow && oeData.title) {
        item.title = oeData.title;
      }

      // 4) 카테고리(typeText) 정돈: TV 본방이 아니고 공식 채널/웹 콘텐츠면 "영상"으로 보정
      if (!isTvShow) {
        if (/RESCENE|안녕하세요원이|자컨|비하인드|vlog|브이로그|ep\.|유튜브|youtube/i.test((item.channel || '') + ' ' + (item.title || '') + ' ' + (item.message || ''))) {
          item.typeText = "영상";
        }
      }
    }
  }
}

export function cleanDisplayTitle(title, maxLength = 0) {
  if (!title) return "";
  // 시스템 카테고리 접두어 제거, 끝단 해시태그/채널 접미사 정돈 및 길이 조정
  let clean = title
    .replace(/^(\[(?:방송|영상|공식\s*영상|행사|팬이벤트|기념일|릴리즈|일정|🎬|📺|📻|🎉|🎤|💿)\]\s*)+/gi, '')
    .replace(/(?:\s*#[^\s#]+)+$/g, '')
    .replace(/\s*\|\s*(?:RESCENE|리센느|안녕하세요원이입니다잘부탁드립니다|안녕하세요\s*원이입니다|helloiamwoni)\s*$/i, '')
    .trim();

  if (maxLength > 0 && clean.length > maxLength) {
    clean = clean.slice(0, maxLength).trim() + '...';
  }
  return clean;
}

export function getScheduleTypeInfo(item) {
  let typeText = item.typeText || "";

  // 0. 공식 유튜브 영상(source === 'youtube')은 100% 최우선 "영상" 확정
  if (item.source === 'youtube') {
    return { typeText: "영상", bg: "#e0f7fa", color: "#00838f" };
  }

  // 1. [태그] 형식 추출 및 이모지 표준화
  const combinedText = `${item.title || ""} ${item.message || ""} ${(item.extField && item.extField.value) || ""} ${item.url || ""} ${item.link || ""}`;
  const bracketMatch = combinedText.match(/\[(.*?)\]/);
  if (!typeText && bracketMatch) {
    const rawTag = bracketMatch[1].trim();
    if (rawTag === '🎬') typeText = "영상";
    else if (rawTag === '🎉') typeText = "기념일";
    else if (rawTag === '🎤') typeText = "행사";
    else if (rawTag === '💿') typeText = "릴리즈";
    else if (rawTag === '📺' || rawTag === '📻') typeText = "방송";
    else if (['방송', '영상', '공식 영상', '행사', '팬이벤트', '기념일', '릴리즈', '일정'].includes(rawTag)) {
      typeText = rawTag;
    }
  }

  // 2. typeId 기반 매핑 (Blip 표준 코드: 5=행사, 1=방송, 4=기념일 등)
  if (!typeText && item.typeId) {
    const typeMap = {
      1: "방송",
      2: "릴리즈",
      3: "영상",
      4: "기념일",
      5: "행사",
      6: "팬이벤트",
      7: "일정"
    };
    typeText = typeMap[item.typeId] || "";
  }

  const lower = combinedText.toLowerCase();

  // ★ 3. 유튜브 공식 채널/자체콘텐츠/비하인드/브이로그 최우선 보정 (메라디오, 원쨩먹짱, 까엉TV 등)
  const isOfficialYoutube = (
    /안녕하세요원이입니다|안원잘부|@helloiamwoninicetomeetyou|helloiamwoni|@rescene_official|rescene_official/i.test(lower) ||
    /자컨|비하인드|behind|vlog|브이로그|ep\.|먹짱|메라디오|까엉tv/i.test(lower)
  );

  if (isOfficialYoutube && !/kcon|케이콘|어워즈|awards|쇼케이스|showcase|페스티벌|콘서트|팬사인|팬미팅/i.test(lower)) {
    typeText = "영상";
  }

  // ★ 4. TV / 라디오 / 음악방송 / 예능 프로그램 보정 (전참시 등)
  if (!typeText || typeText === "일정" || (!isOfficialYoutube && typeText === "영상")) {
    const isTvBroadcast = /전참시|전지적\s*참견\s*시점|놀라운\s*토요일|놀토|아는\s*형님|아형|런닝맨|라디오스타|라스|복면가왕|주간\s*아이돌|주간아|아이돌\s*리그|쇼챔피언|쇼챔|엠카운트다운|엠카|뮤직뱅크|뮤뱅|인기가요|인가|더쇼|음악중심|음중|심플리케이팝|simply\s*k-pop|방송|tv|on air|생방송|본방|재방|mbc|kbs|sbs|mnet|jtbc|tvn|ena|ebs|정오의 희망곡|가요광장|영스트리트|키스 더 라디오|꿈꾸는 라디오|친한친구|별이 빛나는 밤에|두시탈출|컬투쇼|아이돌 라디오|idol radio|fm4u|power fm/i.test(lower);

    if (isTvBroadcast && !isOfficialYoutube) {
      typeText = "방송";
    }
  }

  // ★ 4. 지능형 키워드 기반 우선순위 정밀 분류
  if (!typeText || typeText === "일정") {
    // 4-1. 오프라인 행사 / 공연 / 페스티벌 / 쇼케이스 / 시상식
    if (/kcon|케이콘|어워즈|awards|쇼케이스|showcase|페스티벌|festival|콘서트|concert|행사|공연|축제|드림콘서트|시구|시타|위촉식|풀파티|썸머소닉/i.test(lower)) {
      typeText = "행사";
      // 4-2. 팬사인회 / 팬이벤트 / 팬미팅 (일반 단어 meet 오매칭 방지)
    } else if (/팬사인회|팬사인|팬싸인회|팬싸|팬미팅|fan\s*meeting|fan\s*sign|영통\s*팬|대면\s*팬|대면\s*팬싸|대면\s*사인/i.test(lower)) {
      typeText = "팬이벤트";
      // 4-3. TV / 라디오 / 음악방송
    } else if (/쇼챔피언|쇼챔|엠카운트다운|엠카|뮤직뱅크|뮤뱅|인기가요|인가|더쇼|음악중심|음중|심플리케이팝|simply\s*k-pop|방송|라디오|예능|tv|on air|live|생방송|본방|재방|mbc|kbs|sbs|mnet|jtbc|tvn|ena|ebs|아리랑|arirang|스튜디오|studio|정오의 희망곡|가요광장|영스트리트|키스 더 라디오|꿈꾸는 라디오|친한친구|별이 빛나는 밤에|두시탈출|컬투쇼|아이돌 라디오|idol radio|fm4u|power fm/i.test(lower)) {
      typeText = "방송";
      // 4-4. 멤버 생일 / 기념일
    } else if (/기념일|생일|birthday|happy|day|데뷔|anniversary/i.test(lower)) {
      typeText = "기념일";
      // 4-5. 음원 / 앨범 / 릴리즈
    } else if (/릴리즈|발매|release|album|mv|뮤비|음원/i.test(lower)) {
      typeText = "릴리즈";
      // 4-6. 유튜브 공식 채널 영상 / 자체콘텐츠 / 안원잘부 / 비하인드 / 브이로그
    } else if (
      /@helloiamwoninicetomeetyou|helloiamwoni|안원잘부|안녕하세요원이|@rescene_official|rescene_official|자컨|비하인드|behind|vlog|브이로그|ep\.|shorts|쇼츠|릴스|reels|full ver|풀버전/i.test(lower) ||
      /youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|@helloiamwoninicetomeetyou|@rescene_official)/i.test(lower)
    ) {
      typeText = "영상";
    } else {
      typeText = typeText || "일정";
    }
  }

  let bg = "#e3f2fd", color = "#1976d2";
  if (typeText.includes("영상") || typeText.includes("콘텐츠") || typeText.includes("미디어")) {
    bg = "#e0f7fa"; color = "#00838f"; // 산뜻한 청록/시안 (유튜브/영상)
  } else if (typeText.includes("방송") || typeText.includes("라디오")) {
    bg = "#ffe4ec"; color = "#d63384"; // 화사한 핑크 (TV/라디오 방송)
  } else if (typeText.includes("행사") || typeText.includes("공연") || typeText.includes("쇼케이스")) {
    bg = "#e2f0d9"; color = "#2e7d32"; // 싱그러운 초록 (행사/공연)
  } else if (typeText.includes("팬사인") || typeText.includes("팬싸") || typeText.includes("팬이벤트") || typeText.includes("팬미팅")) {
    bg = "#f3e5f5"; color = "#7b1fa2"; // 세련된 보라 (팬이벤트)
  } else if (typeText.includes("기념일") || typeText.includes("생일")) {
    bg = "#fff9c4"; color = "#e65100"; // 밝은 골드/오렌지 (기념일)
  } else if (typeText.includes("릴리즈") || typeText.includes("발매")) {
    bg = "#ffe0b2"; color = "#bf360c"; // 코랄/오렌지 (릴리즈)
  }

  return { typeText, bg, color };
}

// 공식 채널 / 원이 채널 영상 일정 제목 앞 미니 엠블럼 아이콘 생성
export function getChannelIconHTML(item, { isSmall = false } = {}) {
  if (!item) return '';

  const size = isSmall ? 11 : 14;
  const margin = isSmall ? 'margin-right:2px; vertical-align:-1px;' : 'margin-right:4px; vertical-align:-2px;';

  const channelName = String(item.channel || (item.extField && item.extField.value) || '').trim();

  // 1. 원이 개인 채널
  const isWoni = Boolean(item.isWoniYoutube) ||
    channelName === '안녕하세요원이입니다잘부탁드립니다' ||
    item.channelKey === 'helloiamwoni';

  if (isWoni) {
    return `<img src="icons/hellowoni_profile.jpg" class="sched-channel-icon woni" style="width:${size}px; height:${size}px; border-radius:50%; ${margin} object-fit:cover; display:inline-block; border:1px solid rgba(255,105,180,0.4); flex-shrink:0;" alt="원이채널" title="안녕하세요원이입니다잘부탁드립니다">`;
  }

  // 2. RESCENE 공식 채널
  const isOfficial = Boolean(item.isOfficialYoutube) ||
    (item.source === 'youtube' && (channelName === '공식 유튜브' || channelName === 'RESCENE')) ||
    channelName === '공식 유튜브';

  if (isOfficial) {
    return `<img src="icons/rescene_official_profile.jpg" class="sched-channel-icon official" style="width:${size}px; height:${size}px; border-radius:50%; ${margin} object-fit:cover; display:inline-block; border:1px solid rgba(255,105,180,0.4); flex-shrink:0;" alt="공식채널" title="RESCENE 공식 유튜브 채널">`;
  }

  return '';
}

export function renderScheduleList(container, schedules = [], isDark = false, onSelectDate) {
  if (!container) return;

  // 지능형 중복 병합 및 제외 필터 적용
  schedules = deduplicateScheduleList(schedules);

  if (!schedules || schedules.length === 0) {
    container.innerHTML = '<div class="schedule-item">예정된 스케줄이 없습니다.</div>';
    return;
  }

  // 시작 시간 순 정렬 보장
  schedules.sort((a, b) => {
    const tA = parseSafeDate(a.startTime || a.date).getTime();
    const tB = parseSafeDate(b.startTime || b.date).getTime();
    return tA - tB;
  });

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nowTime = now.getTime();

  // 1순위: 오늘 날짜(YYYY-MM-DD)와 일치하는 일정
  let todayIndices = [];
  schedules.forEach((item, idx) => {
    const d = parseSafeDate(item.startTime || item.date);
    const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (dStr === todayStr) {
      todayIndices.push(idx);
    }
  });

  let nextIndex = -1;
  if (todayIndices.length > 0) {
    const upcomingToday = todayIndices.find(idx => {
      const item = schedules[idx];
      const endT = item.endTime ? parseSafeDate(item.endTime).getTime() : parseSafeDate(item.startTime || item.date).getTime();
      return endT >= nowTime;
    });
    // 오늘 진행 중이거나 예정된 일정이 있으면 그 중 첫 번째, 오늘 일정이 모두 종료되었으면 현재 시점과 가장 가까운 오늘의 마지막 일정 선택
    nextIndex = upcomingToday !== undefined ? upcomingToday : todayIndices[todayIndices.length - 1];
  }

  // 2순위: 오늘 일정이 없으면 오늘 이후 첫 번째 미래 일정
  if (nextIndex === -1) {
    nextIndex = schedules.findIndex(item => parseSafeDate(item.startTime || item.date).getTime() >= nowTime);
  }

  // 3순위: 미래 일정도 없으면 가장 최근 과거 일정 (마지막 항목)
  if (nextIndex === -1) {
    nextIndex = Math.max(0, schedules.length - 1);
  }

  // 기준점(오늘/가장 가까운 예정 일정) 중심: 전 15개 + 후 15개 초기 로드
  const CHUNK_SIZE = 15;
  let startIndex = Math.max(0, nextIndex - CHUNK_SIZE);
  let endIndex = Math.min(schedules.length, nextIndex + CHUNK_SIZE + 1);

  // 개별 일정 아이템 HTML 생성 함수
  function createItemHTML(item, globalIdx) {
    let dateLabel = "일정";
    let timeStr = "";
    const rawDate = item.startTime || item.date;

    if (rawDate) {
      const d = parseSafeDate(rawDate);
      const currentYear = new Date().getFullYear();
      const itemYear = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');

      if (itemYear !== currentYear) {
        // 올해가 아니면 연도 표기 (예: '24.03/26)
        const shortYear = String(itemYear).slice(2);
        dateLabel = `'${shortYear}.${month}/${day}`;
      } else {
        dateLabel = `${month}/${day}`;
      }

      let h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, '0');
      if (!(h === 0 && m === '00' && String(rawDate).includes('T15:00:00'))) {
        const ap = h >= 12 ? '오후' : '오전';
        h = h % 12 || 12;
        timeStr = ` ${ap} ${h}:${m}`;
      } else {
        timeStr = " 종일";
      }
    }

    const { typeText, bg, color } = getScheduleTypeInfo(item);
    let typeBadge = '';
    if (typeText) {
      typeBadge = `<span class="schedule-type-badge" style="background:${bg}; color:${color}; padding:2px 6px; border-radius:4px; font-size:10.5px; font-weight:600; margin:0 4px; flex-shrink:0;">${escapeHtml(typeText)}</span>`;
    }

    const fullTitle = cleanDisplayTitle(item.title || item.message || '스케줄');
    const cleanTitle = cleanDisplayTitle(item.title || item.message || '스케줄', 42);
    let extraInfo = '';
    const ext = item.extField;
    const loc = item.location || (ext && ext.key === '장소' ? ext.value : null);
    const ch = item.channel || (ext && (ext.key === '채널' || ext.key === '방송사') ? ext.value : null);

    if (loc && String(loc).trim()) {
      extraInfo = ` <span class="schedule-ext-info" style="color:#888; font-size:10.5px; margin-left:4px; display:inline-flex; align-items:center; gap:2px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; flex-shrink:0;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>${escapeHtml(String(loc).trim())}</span>`;
    } else if (ch && String(ch).trim()) {
      extraInfo = ` <span class="schedule-ext-info" style="color:#888; font-size:10.5px; margin-left:4px; display:inline-flex; align-items:center; gap:2px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; flex-shrink:0;"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>${escapeHtml(String(ch).trim())}</span>`;
    } else if (ext && ext.value && String(ext.value).trim()) {
      const keyLabel = ext.key ? `${ext.key}: ` : '';
      extraInfo = ` <span class="schedule-ext-info" style="color:#888; font-size:10.5px; margin-left:4px;">(${escapeHtml(keyLabel)}${escapeHtml(String(ext.value).trim())})</span>`;
    }

    const channelIconHtml = getChannelIconHTML(item);
    const titleText = escapeHtml(cleanTitle);
    const isNext = (globalIdx === nextIndex);
    const activeClass = isNext ? ' active' : '';

    return `
      <div class="schedule-item${activeClass}" data-date="${escapeHtml(rawDate)}" data-index="${globalIdx}" title="${escapeHtml(fullTitle)}">
        <div class="schedule-line">
          <span class="schedule-date-time">[${dateLabel}${timeStr}]</span>
          ${typeBadge}
          <span class="schedule-title">${channelIconHtml}${titleText}${extraInfo}</span>
        </div>
      </div>
    `;
  }

  // 초기 렌더링
  let initialHtml = '';
  for (let i = startIndex; i < endIndex; i++) {
    initialHtml += createItemHTML(schedules[i], i);
  }
  container.innerHTML = initialHtml;

  const scrollEl = container.closest('.schedule-container') || container;

  // 초기 포커스: 활성화된(가장 가까운 예정) 일정으로 정밀하게 스크롤 이동
  const focusActiveItem = () => {
    const doScroll = () => {
      const activeEl = container.querySelector('.schedule-item.active');
      if (activeEl && scrollEl) {
        const activeRect = activeEl.getBoundingClientRect();
        const scrollRect = scrollEl.getBoundingClientRect();
        if (scrollRect.height > 0 && activeRect.height > 0) {
          const diff = (activeRect.top - scrollRect.top) - (scrollRect.height / 2) + (activeRect.height / 2);
          scrollEl.scrollTop = Math.max(0, scrollEl.scrollTop + diff);
        } else if (scrollEl.clientHeight > 0) {
          const targetTop = activeEl.offsetTop - (scrollEl.clientHeight / 2) + (activeEl.offsetHeight / 2);
          scrollEl.scrollTop = Math.max(0, targetTop);
        }
      }
    };

    requestAnimationFrame(doScroll);
    setTimeout(doScroll, 40);
    setTimeout(doScroll, 120);
    setTimeout(doScroll, 300);
  };
  focusActiveItem();

  // 상/하단 로드 실행 함수
  let isScrollingLoading = false;

  function loadPastItems() {
    if (isScrollingLoading || startIndex <= 0) return;
    isScrollingLoading = true;
    const oldScrollHeight = scrollEl.scrollHeight;
    const oldScrollTop = scrollEl.scrollTop;

    const prevStart = startIndex;
    startIndex = Math.max(0, startIndex - CHUNK_SIZE);

    const fragment = document.createDocumentFragment();
    for (let i = startIndex; i < prevStart; i++) {
      const temp = document.createElement('div');
      temp.innerHTML = createItemHTML(schedules[i], i);
      fragment.appendChild(temp.firstElementChild);
    }
    container.insertBefore(fragment, container.firstElementChild);

    // 스크롤 점프 방지 (사용자 시야 유지)
    const heightDiff = scrollEl.scrollHeight - oldScrollHeight;
    scrollEl.scrollTop = oldScrollTop + heightDiff;

    setTimeout(() => { isScrollingLoading = false; }, 60);
  }

  function loadFutureItems() {
    if (isScrollingLoading || endIndex >= schedules.length) return;
    isScrollingLoading = true;
    const prevEnd = endIndex;
    endIndex = Math.min(schedules.length, endIndex + CHUNK_SIZE);

    const fragment = document.createDocumentFragment();
    for (let i = prevEnd; i < endIndex; i++) {
      const temp = document.createElement('div');
      temp.innerHTML = createItemHTML(schedules[i], i);
      fragment.appendChild(temp.firstElementChild);
    }
    container.appendChild(fragment);

    setTimeout(() => { isScrollingLoading = false; }, 60);
  }

  // 양방향 무한 스크롤 핸들러 (위/아래 넉넉한 80px 임계값으로 추가 로드)
  scrollEl.onscroll = () => {
    if (scrollEl.scrollTop <= 80 && startIndex > 0) {
      loadPastItems();
    } else if (scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 80 && endIndex < schedules.length) {
      loadFutureItems();
    }
  };

  // 휠(Wheel) 바운스 감지 (최상단/최하단 도달 시 추가 스크롤 감지, passive 리스너로 100% 네이티브 스크롤 보장)
  scrollEl.addEventListener('wheel', (e) => {
    if (e.deltaY < 0 && scrollEl.scrollTop <= 10 && startIndex > 0) {
      loadPastItems();
    } else if (e.deltaY > 0 && scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 10 && endIndex < schedules.length) {
      loadFutureItems();
    }
  }, { passive: true });

  // 클릭 이벤트 위임 (동적으로 추가된 일정 아이템도 안정적으로 모달 오픈)
  container.onclick = (e) => {
    const el = e.target.closest('.schedule-item');
    if (!el || !container.contains(el)) return;

    container.querySelectorAll('.schedule-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');

    const idx = parseInt(el.getAttribute('data-index'), 10);
    const item = schedules[idx];
    if (item) {
      const d = parseSafeDate(item.startTime || item.date);
      const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
      let h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, '0');
      const ap = h >= 12 ? '오후' : '오전';
      h = h % 12 || 12;
      const timeStr = (h === 0 && m === '00' && String(item.startTime || item.date).includes('T15:00:00')) ? '종일 일정' : `${ap} ${h}:${m}`;
      const { typeText } = getScheduleTypeInfo(item);

      const ext = item.extField;
      showScheduleModal({
        title: item.title || item.message || '스케줄 상세 정보',
        date: dateStr,
        time: timeStr,
        type: typeText,
        location: item.location || (ext && ext.key === '장소' ? ext.value : ''),
        channel: item.channel || (ext && (ext.key === '채널' || ext.key === '방송사') ? ext.value : ''),
        extField: ext || null,
        detail: item.message || item.description || item.detail || item.title,
        link: item.url || item.link,
        starAttendees: item.starAttendees || [],
        resolvedMediaUrls: item.resolvedMediaUrls || []
      });
    }

    if (typeof onSelectDate === 'function') {
      const date = el.getAttribute('data-date');
      onSelectDate(date);
    }
  };
}

/* =========================================================================
   6. 캘린더 렌더러 & 인터랙션 (Calendar Renderer & Interactions)
   ========================================================================= */

export function renderCalendar(gridEl, titleEl, currentDate, schedules = [], onSelectEvent) {
  if (!gridEl) return;

  // 지능형 중복 병합 및 제외 필터 적용
  schedules = deduplicateScheduleList(schedules);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  if (titleEl) {
    titleEl.textContent = `${year}년 ${month + 1}월`;
  }

  gridEl.innerHTML = '';

  const firstDayIndex = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const prevLastDay = new Date(year, month, 0).getDate();

  let daysArr = [];
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    daysArr.push({ day: prevLastDay - i, isCurrentMonth: false, dateStr: "" });
  }
  for (let i = 1; i <= lastDay; i++) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(i).padStart(2, '0');
    daysArr.push({ day: i, isCurrentMonth: true, dateStr: `${year}-${mm}-${dd}` });
  }

  const totalCells = daysArr.length <= 35 ? 35 : 42;
  let nextDayNum = 1;
  while (daysArr.length < totalCells) {
    daysArr.push({ day: nextDayNum++, isCurrentMonth: false, dateStr: "" });
  }

  const today = new Date();
  let weeksArr = [];
  for (let i = 0; i < daysArr.length; i += 7) {
    weeksArr.push(daysArr.slice(i, i + 7));
  }

  // 1. 각 스케줄 항목 정규화 (시작일/종료일 및 multi-day 여부 판단)
  const normalizedSchedules = schedules.map((item, idx) => {
    const startRaw = item.startTime || item.date;
    const endRaw = item.endTime || item.startTime || item.date;
    const startD = parseSafeDate(startRaw);
    const endD = parseSafeDate(endRaw);

    const startY = startD.getFullYear();
    const startM = String(startD.getMonth() + 1).padStart(2, '0');
    const startDay = String(startD.getDate()).padStart(2, '0');
    const startStr = `${startY}-${startM}-${startDay}`;

    const endY = endD.getFullYear();
    const endM = String(endD.getMonth() + 1).padStart(2, '0');
    const endDay = String(endD.getDate()).padStart(2, '0');
    const endStr = `${endY}-${endM}-${endDay}`;

    const isMulti = (startStr !== endStr) && (endD.getTime() > startD.getTime());

    return {
      ...item,
      id: item.id || `sched-${idx}`,
      startDateStr: startStr,
      endDateStr: endStr,
      isMultiDay: isMulti,
      spanGroupId: isMulti ? `span-grp-${idx}-${startStr.replace(/\D/g, '')}` : null
    };
  });

  // 2. 주(Week)별 행 렌더링
  weeksArr.forEach((weekDays) => {
    const weekRow = document.createElement("div");
    weekRow.className = "calendar-week-row";

    weekDays.forEach(cellInfo => {
      const cell = document.createElement("div");
      cell.className = `calendar-cell ${cellInfo.isCurrentMonth ? '' : 'other-month'}`;

      const isToday = cellInfo.isCurrentMonth &&
        today.getDate() === cellInfo.day &&
        today.getMonth() === month &&
        today.getFullYear() === year;
      if (isToday) cell.classList.add("today");

      cell.innerHTML = `<div class="cell-date">${cellInfo.day}</div><div class="cell-events"></div>`;
      const eventsContainer = cell.querySelector(".cell-events");

      if (cellInfo.isCurrentMonth && cellInfo.dateStr) {
        // 해당 날짜에 해당하는 모든 스케줄 조회 (단일일 일치 또는 연속 일정 기간 내 포함)
        const daySchedules = normalizedSchedules.filter(item => {
          if (item.isMultiDay) {
            return cellInfo.dateStr >= item.startDateStr && cellInfo.dateStr <= item.endDateStr;
          }
          return item.startDateStr === cellInfo.dateStr;
        });

        daySchedules.forEach(item => {
          const { typeText, bg, color } = getScheduleTypeInfo(item);
          const badge = document.createElement("div");
          badge.className = "cal-event-badge";
          badge.style.background = bg;
          badge.style.color = color;

          let timeStrForHover = "";
          let timeStrForModal = "";
          const rawDate = item.startTime || item.date;

          if (rawDate) {
            const d = parseSafeDate(rawDate);
            let h = d.getHours();
            const m = String(d.getMinutes()).padStart(2, '0');
            if (!(h === 0 && m === '00' && String(rawDate).includes('T15:00:00'))) {
              const ap = h >= 12 ? '오후' : '오전';
              h = h % 12 || 12;
              timeStrForHover = `${ap} ${h}:${m}`;
              timeStrForModal = `${ap} ${h}:${m}`;
            } else {
              timeStrForModal = item.isMultiDay ? "연속 일정" : "종일 일정";
            }
          }

          const fullPureTitle = cleanDisplayTitle(item.title || item.message || '일정');
          const titleText = escapeHtml(fullPureTitle);
          const displayTitle = typeText ? `[${typeText}] ${fullPureTitle}` : fullPureTitle;
          const dateForModal = item.isMultiDay ? `${item.startDateStr} ~ ${item.endDateStr}` : cellInfo.dateStr;

          const channelIconSmall = getChannelIconHTML(item, { isSmall: true });

          // 특정 시간이 존재하는 일정에 한해서만 호버 시 시간 + 아이콘 라인 생성
          const hoverTimeHtml = timeStrForHover
            ? `<div class="badge-hover-time"><span class="badge-hover-time-text">${escapeHtml(timeStrForHover)}</span>${channelIconSmall ? `<span class="badge-hover-channel-icon">${channelIconSmall}</span>` : ''}</div>`
            : '';
          const contentHtml = `<div class="badge-main-content">${channelIconSmall}<span class="badge-title-text">${titleText}</span></div>`;

          // 연속 일정인 경우 스타일 및 그룹 식별자 추가
          if (item.isMultiDay) {
            badge.classList.add("multi-day-badge");
            badge.setAttribute('data-span-group', item.spanGroupId);

            if (cellInfo.dateStr === item.startDateStr) {
              badge.classList.add("span-start");
            } else if (cellInfo.dateStr === item.endDateStr) {
              badge.classList.add("span-end");
            } else {
              badge.classList.add("span-middle");
            }

            badge.innerHTML = `${hoverTimeHtml}${contentHtml}`;
            badge.title = `${displayTitle} (${item.startDateStr} ~ ${item.endDateStr})`;

            // 연속 일정 그룹 동시 마우스 오버 하이라이트
            badge.addEventListener("mouseenter", () => {
              const siblings = gridEl.querySelectorAll(`[data-span-group="${item.spanGroupId}"]`);
              siblings.forEach(el => el.classList.add("span-hover-active"));
            });

            badge.addEventListener("mouseleave", () => {
              const siblings = gridEl.querySelectorAll(`[data-span-group="${item.spanGroupId}"]`);
              siblings.forEach(el => el.classList.remove("span-hover-active"));
            });
          } else {
            badge.innerHTML = `${hoverTimeHtml}${contentHtml}`;
            badge.title = `${displayTitle}${timeStrForModal ? ` (${timeStrForModal})` : ''}`;
          }

          badge.addEventListener("click", (e) => {
            e.stopPropagation();
            if (typeof onSelectEvent === 'function') {
              const ext = item.extField;
              onSelectEvent({
                title: displayTitle,
                pureTitle: fullPureTitle,
                channelIconHtml: getChannelIconHTML(item),
                date: dateForModal,
                time: timeStrForModal,
                type: typeText,
                location: item.location || (ext && ext.key === '장소' ? ext.value : ''),
                channel: item.channel || (ext && (ext.key === '채널' || ext.key === '방송사') ? ext.value : ''),
                extField: ext || null,
                detail: item.message || item.description || '',
                starAttendees: item.starAttendees || [],
                url: item.url || item.link || ''
              });
            }
          });

          eventsContainer.appendChild(badge);
        });
      }

      weekRow.appendChild(cell);
    });

    gridEl.appendChild(weekRow);
  });
}

/* =========================================================================
   7. 임베드 & iframe 렌더러 (Embed & Iframe Renderers)
   ========================================================================= */

export function renderIframeTab(container, tabConfig, isDark = false) {
  if (!container || !tabConfig || !tabConfig.iframeUrl) return;

  const themeStr = isDark ? 'dark' : 'light';
  const finalUrl = tabConfig.iframeUrl.replace('{theme}', themeStr);

  // 팝업 탈출 및 외부 링크(유튜브 등) 연결을 위한 표준 권한 확보
  let sandboxValue = tabConfig.sandbox || 'allow-scripts allow-same-origin allow-forms allow-popups';
  if (!sandboxValue.includes('allow-popups-to-escape-sandbox')) {
    sandboxValue += ' allow-popups-to-escape-sandbox';
  }
  if (!sandboxValue.includes('allow-top-navigation-by-user-activation')) {
    sandboxValue += ' allow-top-navigation-by-user-activation';
  }
  if (!sandboxValue.includes('allow-presentation')) {
    sandboxValue += ' allow-presentation';
  }

  const heightStyle = tabConfig.height ? `height: ${tabConfig.height};` : 'height: 100%;';

  container.innerHTML = `
    <iframe src="${finalUrl}" 
            title="${escapeHtml(tabConfig.label)}" 
            style="width: 100%; ${heightStyle} border: none; display: block; transition: height 0.3s ease;" 
            frameborder="0"
            sandbox="${sandboxValue}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen>
    </iframe>
  `;
}

// iframe 마우스 휠 스크롤 인터랙션 엔진
export function enableIframeScrollGuard(container = document) {
  if (!container) return;
  const wrappers = container.querySelectorAll('.feed-iframe-wrapper, .modal-embed-card');
  wrappers.forEach(wrapper => {
    const iframe = wrapper.querySelector('iframe');
    if (!iframe) return;

    // 1. 기본 상태: 휠 스크롤이 부모 컨테이너로 자연스럽게 통과되도록 설정
    iframe.style.pointerEvents = 'none';

    // 2. 클릭 시 미디어 제어/재생을 위해 pointer-events 활성화
    wrapper.addEventListener('click', () => {
      iframe.style.pointerEvents = 'auto';
    });

    // 3. 마우스가 카드를 벗어나면 다시 부드러운 스크롤 모드로 복구
    wrapper.addEventListener('mouseleave', () => {
      iframe.style.pointerEvents = 'none';
    });

    // 4. 보조 휠 이벤트 포워딩 (인터랙션 중에도 마우스 휠을 굴리면 부모 스크롤 실행)
    wrapper.addEventListener('wheel', (e) => {
      const scrollParent = wrapper.closest('.embed-modal-body') ||
        wrapper.closest('.feed-list-container') ||
        wrapper.closest('.panel-tab-content') ||
        document.documentElement;
      if (scrollParent && scrollParent !== wrapper) {
        scrollParent.scrollTop += e.deltaY;
      }
    }, { passive: true });
  });
}

export function renderInstaEmbeds(container, feeds = [], isDark = false) {
  if (!container) return;
  if (!feeds || feeds.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">인스타그램 피드가 없습니다.</p>';
    return;
  }

  const themeStr = isDark ? 'dark' : 'light';
  container.innerHTML = '';

  feeds.forEach(feed => {
    const link = feed.link || (feed.shortcode ? `https://www.instagram.com/p/${feed.shortcode}/` : '') || feed.permalink || feed.url || '';
    const m = link.match(/\/(p|reel|reels)\/([^\/?#]+)/i);
    if (!m) return;
    const type = (m[1] || 'p').toLowerCase();
    const id = m[2];

    const wrapper = document.createElement('div');
    wrapper.className = 'feed-iframe-wrapper';
    wrapper.innerHTML = `
      <iframe src="https://www.instagram.com/${type}/${id}/embed/captioned/?theme=${themeStr}" 
              style="width: 100%; height: 650px; min-height: 650px; transition: height 0.3s ease;" 
              frameborder="0" 
              scrolling="no" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
              loading="lazy">
      </iframe>
    `;
    container.appendChild(wrapper);
  });

  enableIframeScrollGuard(container);
}

export function renderXEmbeds(container, feeds = [], isDark = false) {
  if (!container) return;
  if (!feeds || feeds.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">X 피드가 없습니다.</p>';
    return;
  }

  const themeStr = isDark ? 'dark' : 'light';
  container.innerHTML = '';

  feeds.forEach(feed => {
    const tweetId = feed.id;
    if (tweetId) {
      const wrapper = document.createElement('div');
      wrapper.className = 'feed-iframe-wrapper';
      wrapper.innerHTML = `<iframe src="https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=${themeStr}" style="width: 100%; height: 250px; transition: height 0.3s ease;" frameborder="0" scrolling="no" loading="lazy"></iframe>`;
      container.appendChild(wrapper);
    }
  });

  enableIframeScrollGuard(container);
}

export function renderTiktokEmbeds(container, feeds = [], isDark = false) {
  if (!container) return;

  const themeStr = isDark ? 'dark' : 'light';

  // 1. 수집된 틱톡 비디오 목록이 있으면 개별 숏폼 플레이어 카드로 렌더링 (반응형 멀티 컬럼 그리드)
  if (feeds && feeds.length > 0) {
    container.innerHTML = '';
    feeds.forEach(feed => {
      const videoId = feed.id;
      if (videoId) {
        const wrapper = document.createElement('div');
        wrapper.className = 'feed-iframe-wrapper tiktok-feed-item';
        wrapper.innerHTML = `
          <iframe src="https://www.tiktok.com/embed/v2/${videoId}" 
                  style="width: 325px; max-width: 100%; height: 740px; min-height: 580px; transition: height 0.3s cubic-bezier(0.16, 1, 0.3, 1); border: none; border-radius: 12px; display: block; margin: 0 auto;" 
                  frameborder="0" 
                  scrolling="no" 
                  loading="lazy" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowfullscreen>
          </iframe>
        `;
        container.appendChild(wrapper);
      }
    });
    enableIframeScrollGuard(container);
    return;
  }

  // 2. 피드가 아직 없으면 공식 프로필 위젯으로 폴백 렌더링
  container.innerHTML = `
    <div class="feed-iframe-wrapper tiktok-feed-item" style="height: calc(100vh - 120px); min-height: 500px;">
      <iframe src="https://www.tiktok.com/embed/@rescene_official?theme=${themeStr}" 
              title="TikTok" 
              style="width: 325px; max-width: 100%; height: 100%; min-height: 500px; transition: height 0.3s cubic-bezier(0.16, 1, 0.3, 1); border: none; border-radius: 12px; display: block; margin: 0 auto;" 
              frameborder="0"
              scrolling="no"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share">
      </iframe>
    </div>
  `;
}

/* =========================================================================
   8. 스케줄 모달 & 툴팁 팝업 핸들러 (Modal & Tooltip)
   ========================================================================= */

export function decodeHtmlEntities(str) {
  if (!str) return '';
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}

export function linkifyMessage(text) {
  if (!text) return '';
  // 1. 기존 엔티티(&lt;, &gt;, &amp;) 디코딩
  const rawText = decodeHtmlEntities(text);
  // 2. 안전하게 다시 escape
  let safeText = escapeHtml(rawText);

  // 3. 스케줄 본문에 포함된 다양한 이모지들을 모던 심플 SVG 아이콘으로 치환
  const svgIcons = {
    link: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block; color:var(--primary-color, #ff007a);"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`,
    twitter: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
    news: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>`,
    notice: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>`,
    video: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`,
    tv: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>`,
    radio: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><circle cx="16" cy="14" r="3"/><path d="M4 18h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2Z"/><path d="M7 12v-2"/><path d="m17 4-5 2"/></svg>`,
    camera: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`,
    calendar: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
    clock: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    pin: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
    music: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`,
    sparkle: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`,
    birthday: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/></svg>`,
    mail: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
    arrow: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1.5px; margin-right:3px; display:inline-block;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="19 12 12 19 19 12 12 5"></polyline></svg>`
  };

  // 손가락/화살표/재생/링크 이모지와 '보러 가기' / '보러가기' / '바로 가기' / '바로가기' 패턴을 '관련 링크'로 통일 치환
  safeText = safeText.replace(/(?:[👉👇👈👆▶️🔗📎]+\s*)?(?:[가-힣a-zA-Z0-9\s]*?)?(?:보러\s*가기|바로\s*가기)/g, `${svgIcons.link} 관련 링크`);
  // 손가락/화살표/재생 이모지 바로 뒤에 링크가 오는 경우 링크 아이콘으로 치환
  safeText = safeText.replace(/(?:👉|👇|👈|👆|👉🏻|👉🏼|👉🏽|👉🏾|👉🏿|👇🏻|👇🏼|👇🏽|👇🏾|👇🏿|➡️|▶️?)\s*(?=https?:\/\/)/g, `${svgIcons.link} `);
  // 남은 단독 링크 이모지 치환 (🔗, 📎)
  safeText = safeText.replace(/🔗|📎/g, svgIcons.link);
  // 트위터 / 소셜
  safeText = safeText.replace(/\[🐦\]|🐦/g, svgIcons.twitter);
  // 기사 / 뉴스
  safeText = safeText.replace(/\[📰\]|📰/g, svgIcons.news);
  // 공지 / 확성기
  safeText = safeText.replace(/\[📢\]|📢|📣/g, svgIcons.notice);
  // 영상 / 필름
  safeText = safeText.replace(/\[🎬\]|🎬|▶️|🎥/g, svgIcons.video);
  // TV / 방송
  safeText = safeText.replace(/\[📺\]|📺/g, svgIcons.tv);
  // 라디오
  safeText = safeText.replace(/\[📻\]|📻/g, svgIcons.radio);
  // 사진 / 카메라
  safeText = safeText.replace(/\[📸\]|📸|📷/g, svgIcons.camera);
  // 달력 / 일정
  safeText = safeText.replace(/\[📅\]|📅|📆|🗓️?/g, svgIcons.calendar);
  // 시계 / 알림
  safeText = safeText.replace(/\[⏰\]|⏰|⏱️|⏳/g, svgIcons.clock);
  // 핀 / 장소
  safeText = safeText.replace(/\[📍\]|📍|🗺️/g, svgIcons.pin);
  // 음악 / 음원
  safeText = safeText.replace(/\[🎵\]|\[🎶\]|🎵|🎶|🎧/g, svgIcons.music);
  // 반짝임 / 스파클
  safeText = safeText.replace(/\[✨\]|✨|🌟|💫/g, svgIcons.sparkle);
  // 생일 / 파티
  safeText = safeText.replace(/\[🎂\]|🎂|🎉|🥳/g, svgIcons.birthday);
  // 편지 / 메일
  safeText = safeText.replace(/\[💌\]|💌|✉️/g, svgIcons.mail);
  // 기타 일반 화살표
  safeText = safeText.replace(/👉|👉🏻|👉🏼|👉🏽|👉🏾|👉🏿|➡️/g, svgIcons.arrow);

  // 4. 개별 URL 링크화 (링크 바로 앞에 별도의 아이콘이 없는 경우 링크 열기 아이콘 자동 추가)
  const openLinkIcon = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1.5px; margin-right:3px; display:inline-block; flex-shrink:0;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;

  safeText = safeText.replace(/((?:<svg[^>]*>[\s\S]*?<\/svg>\s*)?)(https?:\/\/[^\s<]+)/g, (match, prefix, url) => {
    if (prefix && prefix.trim().length > 0) {
      return `${prefix}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    } else {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; word-break:break-all;">${openLinkIcon}<span>${url}</span></a>`;
    }
  });

  // 5. 줄바꿈 처리 (\n -> <br>)
  safeText = safeText.replace(/\r?\n/g, '<br>');

  return safeText;
}

export function parseMediaEmbeds(sources = [], isDark = false) {
  const allText = sources.filter(Boolean).join(' ');
  if (!allText) return '';

  const themeStr = isDark ? 'dark' : 'light';
  const embedHtmls = [];
  const processedUrls = new Set();

  // 1. YouTube (watch, youtu.be, shorts) - 크롬 확장프로그램 iframe JS 차단 회피 및 원클릭 스마트 플레이어
  const ytRegex = /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
  let ytMatch;
  while ((ytMatch = ytRegex.exec(allText)) !== null) {
    const videoId = ytMatch[1];
    if (!processedUrls.has(videoId)) {
      processedUrls.add(videoId);
      embedHtmls.push(`
        <div class="youtube-preview-card" data-video-id="${videoId}" style="margin-bottom: 12px; border-radius: 12px; overflow: hidden; aspect-ratio: 16/9; position: relative; cursor: pointer; background: #000; box-shadow: 0 4px 16px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15);">
          <img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.35s ease;" alt="YouTube Thumbnail" loading="lazy">
          <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.5) 100%); display: flex; flex-direction: column; justify-content: space-between; padding: 12px; box-sizing: border-box;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="background: #ff0000; color: #fff; font-size: 10.5px; font-weight: bold; padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 2px 6px rgba(255,0,0,0.4);">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                YouTube
              </span>
              <span style="color: rgba(255,255,255,0.9); font-size: 11px; font-weight: 500; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">영상 바로보기 ↗</span>
            </div>
            <div style="align-self: center;">
              <div class="yt-play-btn" style="width: 50px; height: 50px; background: rgba(255,0,0,0.95); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 18px rgba(255,0,0,0.55); transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s ease;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white" style="margin-left: 3px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              </div>
            </div>
            <div style="color: #fff; font-size: 11.5px; font-weight: 600; text-shadow: 0 1px 4px rgba(0,0,0,0.9); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              클릭하여 YouTube에서 최고화질로 감상하기
            </div>
          </div>
        </div>
      `);
    }
  }

  // 2. Instagram (p, reel, tv 등 계정명 포함 URL 지원)
  const instaRegex = /https?:\/\/(?:www\.)?instagram\.com\/(?:[a-zA-Z0-9_.]+\/)?(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/g;
  let instaMatch;
  while ((instaMatch = instaRegex.exec(allText)) !== null) {
    const postId = instaMatch[1];
    if (!processedUrls.has(postId)) {
      processedUrls.add(postId);
      embedHtmls.push(`
        <div class="modal-embed-card" style="margin-bottom: 10px; border-radius: 10px; overflow: hidden; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15);">
          <iframe src="https://www.instagram.com/p/${postId}/embed/captioned/?theme=${themeStr}" style="width: 100%; height: 500px; min-height: 380px; border: none; transition: height 0.25s ease;" scrolling="no" frameborder="0"></iframe>
        </div>
      `);
    }
  }

  // 3. X (Twitter)
  const xRegex = /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/([0-9]+)/g;
  let xMatch;
  while ((xMatch = xRegex.exec(allText)) !== null) {
    const tweetId = xMatch[1];
    if (!processedUrls.has(tweetId)) {
      processedUrls.add(tweetId);
      embedHtmls.push(`
        <div class="modal-embed-card" style="margin-bottom: 10px; border-radius: 10px; overflow: hidden;">
          <iframe src="https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=${themeStr}" style="width: 100%; height: 260px; border: none;" scrolling="no" frameborder="0"></iframe>
        </div>
      `);
    }
  }

  // 4. TikTok (일반 영상)
  const ttRegex = /https?:\/\/(?:www\.)?tiktok\.com\/@[a-zA-Z0-9_.]+\/video\/([0-9]+)/g;
  let ttMatch;
  while ((ttMatch = ttRegex.exec(allText)) !== null) {
    const videoId = ttMatch[1];
    if (!processedUrls.has(videoId)) {
      processedUrls.add(videoId);
      embedHtmls.push(`
        <div class="modal-embed-card" style="margin-bottom: 10px; border-radius: 10px; overflow: hidden;">
          <iframe src="https://www.tiktok.com/embed/v2/${videoId}" style="width: 100%; height: 460px; border: none;" scrolling="no" frameborder="0"></iframe>
        </div>
      `);
    }
  }

  // 5. TikTok 단축 URL (vt.tiktok.com)
  const vtTtRegex = /https?:\/\/vt\.tiktok\.com\/([a-zA-Z0-9_-]+)/g;
  let vtMatch;
  while ((vtMatch = vtTtRegex.exec(allText)) !== null) {
    const shortCode = vtMatch[1];
    const fullUrl = `https://vt.tiktok.com/${shortCode}/`;
    if (!processedUrls.has(fullUrl)) {
      processedUrls.add(fullUrl);
      embedHtmls.push(`
        <div class="tiktok-short-preview-card" data-url="${fullUrl}">
          <div class="tiktok-card-left">
            <div class="tiktok-icon-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#fe2c55"><path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.068-.102a2.895 2.895 0 0 1 2.37-4.498c.312 0 .614.05.897.143V9.41a6.34 6.34 0 0 0-.897-.064 6.341 6.341 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34c3.483 0 6.315-2.81 6.34-6.287V9.32a8.217 8.217 0 0 0 4.764 1.517V7.392a4.814 4.814 0 0 1-.99-.706z"/></svg>
            </div>
            <div class="tiktok-card-info">
              <div class="tiktok-card-title">TikTok 숏폼 영상</div>
              <div class="tiktok-card-desc">클릭하여 틱톡에서 바로 감상하기</div>
            </div>
          </div>
          <div class="tiktok-card-btn">
            보러가기 ↗
          </div>
        </div>
      `);
    }
  }

  if (embedHtmls.length === 0) return '';
  return embedHtmls.join('');
}

export function showScheduleModal(scheduleData) {
  let overlay = document.getElementById('scheduleModalOverlay');
  let bodyContent = document.getElementById('modalBodyContent');

  if (!overlay || !bodyContent) {
    const modalMount = document.getElementById('modalMount') || document.body;
    modalMount.insertAdjacentHTML('beforeend', createScheduleModalHTML());
    initScheduleModal();
    overlay = document.getElementById('scheduleModalOverlay');
    bodyContent = document.getElementById('modalBodyContent');
    if (!overlay || !bodyContent) return;
  }

  const modalTitle = document.getElementById('modalTitle');
  const embedCard = document.getElementById('modalEmbedCard');
  const embedBody = document.getElementById('modalEmbedBodyContent');

  if (modalTitle) {
    const rawTitle = decodeHtmlEntities(scheduleData.title || '스케줄 상세 정보');
    const chIcon = scheduleData.channelIconHtml || getChannelIconHTML(scheduleData);
    modalTitle.innerHTML = `${chIcon}<span>${escapeHtml(rawTitle)}</span>`;
  }

  const isDark = document.body.classList.contains('dark-mode');

  let html = '';
  if (scheduleData.date) {
    const timeStr = scheduleData.time ? ` ${scheduleData.time}` : '';
    html += `<span class="detail-time"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>일시: ${escapeHtml(scheduleData.date)}${escapeHtml(timeStr)}</span>`;
  }

  const ext = scheduleData.extField;
  const location = scheduleData.location || (ext && ext.key === '장소' ? ext.value : (scheduleData.place || scheduleData.venue));
  const channel = scheduleData.channel || (ext && (ext.key === '채널' || ext.key === '방송사') ? ext.value : null);

  if (location && String(location).trim()) {
    html += `<span class="detail-time"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>장소: ${escapeHtml(String(location).trim())}</span>`;
  }
  if (channel && String(channel).trim()) {
    html += `<span class="detail-time"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:4px;"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>채널: ${escapeHtml(String(channel).trim())}</span>`;
  }
  if (ext && ext.key && ext.value && ext.key !== '장소' && ext.key !== '채널' && ext.key !== '방송사') {
    html += `<span class="detail-time"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:4px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>${escapeHtml(ext.key)}: ${escapeHtml(String(ext.value).trim())}</span>`;
  }

  // Mnet / Blip 참석 멤버 정보 렌더링 (동일 멤버는 항상 동일한 대표 프로필 아이콘 및 활동명 렌더링)
  const attendees = scheduleData.starAttendees || scheduleData.members || [];
  if (Array.isArray(attendees) && attendees.length > 0) {
    const attendeesHtml = attendees.map(a => {
      const realName = getMemberDisplayName(a.nickname || a.name);
      const avatarUrl = getMemberAvatarUrl(realName, a.avatarImgPath || a.profileImg);
      const avatar = avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" style="width:16px; height:16px; border-radius:50%; object-fit:cover; vertical-align:-2px; margin-right:4px; border:1px solid rgba(255,105,180,0.4);" alt="${escapeHtml(realName)}">` : '';
      const rawNick = a.nickname || a.name || '';
      const isCustomNick = rawNick && rawNick !== realName;
      const nickTitle = isCustomNick ? ` title="닉네임: ${escapeHtml(rawNick)}"` : '';
      return `<span style="display:inline-flex; align-items:center; background:rgba(255,105,180,0.1); border:1px solid rgba(255,105,180,0.25); border-radius:12px; padding:1px 7px; font-size:11px; font-weight:600; color:#d63384; margin:1px 2px;"${nickTitle}>${avatar}${escapeHtml(realName)}</span>`;
    }).join(' ');
    html += `<div style="display:flex; flex-wrap:wrap; align-items:center; margin:3px 0;"><span class="detail-time" style="display:inline-flex; align-items:center; margin:0; margin-right:4px; flex-shrink:0; border-bottom:none !important; padding-bottom:0 !important;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:4px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>참석 멤버:</span><div style="display:inline-flex; flex-wrap:wrap; align-items:center; gap:2px;">${attendeesHtml}</div></div>`;
  }

  let hasRenderedLinkInBody = false;
  if (scheduleData.detail || scheduleData.description) {
    const detailContent = linkifyMessage(scheduleData.detail || scheduleData.description);
    if (detailContent.includes('<a href=')) {
      hasRenderedLinkInBody = true;
    }
    html += `<div style="margin-top: 8px;">${detailContent}</div>`;
  }

  // 본문에 이미 링크가 렌더링되었거나 공식 유튜브 항목인 경우 하단 중복 링크 버튼 생략
  if (!hasRenderedLinkInBody && scheduleData.source !== 'youtube' && (scheduleData.link || scheduleData.url)) {
    const link = scheduleData.link || scheduleData.url;
    html += `<p style="margin-top: 10px;"><a href="${link}" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; gap:4px; font-weight:600;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; flex-shrink:0;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg><span>관련 링크 바로가기</span> <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-left:1px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a></p>`;
  }

  bodyContent.innerHTML = html;

  // 유튜브, 인스타, X, 틱톡 미디어 링크 자동 추출 및 세컨더리 카드 렌더링
  let mediaSources = [];
  if (scheduleData.source === 'youtube') {
    // 공식 유튜브 영상 항목인 경우 해당 유튜브 링크만 정확하게 미디어 카드로 렌더링
    mediaSources = [scheduleData.url, scheduleData.link].filter(Boolean);
  } else {
    // 일반 스케줄인 경우 상세 본문 및 링크에서 미디어 추출
    mediaSources = [
      scheduleData.detail,
      scheduleData.description,
      scheduleData.link,
      scheduleData.url,
      ...(scheduleData.resolvedMediaUrls || [])
    ].filter(Boolean);
  }

  let embedsHtml = parseMediaEmbeds(mediaSources, isDark);

  function applyEmbeds(htmlContent) {
    if (!embedCard || !embedBody) return;
    if (htmlContent) {
      embedBody.innerHTML = htmlContent;
      embedCard.style.display = 'flex';
      embedCard.style.flexDirection = 'column';

      // 유튜브 프리뷰 카드 클릭 이벤트
      embedBody.querySelectorAll('.youtube-preview-card').forEach(card => {
        card.addEventListener('click', () => {
          const videoId = card.getAttribute('data-video-id');
          if (videoId) {
            const url = `https://www.youtube.com/watch?v=${videoId}`;
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
              chrome.tabs.create({ url });
            } else {
              window.open(url, '_blank');
            }
          }
        });
      });

      // 틱톡 숏폼 카드 클릭 이벤트
      embedBody.querySelectorAll('.tiktok-short-preview-card').forEach(card => {
        card.addEventListener('click', () => {
          const url = card.getAttribute('data-url');
          if (url) {
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
              chrome.tabs.create({ url });
            } else {
              window.open(url, '_blank');
            }
          }
        });
      });

      // 모달 내부 iframe 휠 스크롤 인터랙션 가드 활성화
      enableIframeScrollGuard(embedBody);
    } else {
      embedBody.innerHTML = '';
      embedCard.style.display = 'none';
    }
  }

  applyEmbeds(embedsHtml);
  overlay.style.display = 'flex';
}

export function initScheduleModal() {
  const overlay = document.getElementById('scheduleModalOverlay');
  const closeBtn = document.getElementById('modalCloseBtn');

  function closeModal() {
    if (!overlay) return;
    overlay.style.display = 'none';
    stopAllIframeMedia(overlay);
    const embedBody = document.getElementById('embedBodyContent');
    const embedCard = document.getElementById('modalEmbedCard');
    if (embedBody) embedBody.innerHTML = '';
    if (embedCard) embedCard.style.display = 'none';
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      // 모달 카드 및 추가 미디어 카드 바깥의 모든 빈 영역 클릭 시 닫기
      if (!e.target.closest('.schedule-modal-card') && !e.target.closest('.schedule-embed-card')) {
        closeModal();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });

  // iframe 자동 높이 조절 엔진 활성화
  setupIframeAutoHeight();
}

/* =========================================================================
   9. 인스타 & X 공식 위젯 자동 높이 조절 (postMessage Auto-Height Engine)
   ========================================================================= */

let isAutoHeightSetup = false;
export function setupIframeAutoHeight() {
  if (isAutoHeightSetup) return;
  isAutoHeightSetup = true;

  window.addEventListener('message', (event) => {
    // 1. 인스타그램 공식 MEASURE 메시지 감지
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data && data.type === 'MEASURE' && data.details && data.details.height) {
        const iframes = document.querySelectorAll('.feed-iframe-wrapper iframe, .modal-embed-card iframe');
        for (let iframe of iframes) {
          if (iframe.contentWindow === event.source) {
            iframe.style.height = `${data.details.height}px`;
            iframe.style.minHeight = `${data.details.height}px`;
            break;
          }
        }
      }
    } catch (e) { }

    // 2. 트위터(X) twttr.private.resize 감지
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data && data['twttr.embed'] && data['twttr.embed'].method === 'twttr.private.resize') {
        const params = data['twttr.embed'].params;
        const height = Array.isArray(params) && params.length > 0 ? params[0].height : params.height;
        if (height) {
          const iframes = document.querySelectorAll('.feed-iframe-wrapper iframe, .modal-embed-card iframe');
          for (let iframe of iframes) {
            if (iframe.contentWindow === event.source) {
              iframe.style.height = `${height}px`;
              iframe.style.minHeight = `${height}px`;
              break;
            }
          }
        }
      }
    } catch (e) { }

    // 3. 틱톡(TikTok) 공식 임베드 자동 높이 조절 (postMessage Auto-Resize)
    try {
      let data = event.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { }
      }

      if (data && typeof data === 'object') {
        let tiktokHeight = null;
        let videoId = data.videoId || data.video_id || data.id || null;

        // 다양한 TikTok 메시지 포맷 추출 (숫자, 래핑 객체, 시그널 등)
        if (typeof data.height === 'number' && data.height > 100) {
          tiktokHeight = data.height;
        } else if (data['tiktok-embed-message']) {
          const msg = data['tiktok-embed-message'];
          if (typeof msg === 'object') {
            if (typeof msg.height === 'number') tiktokHeight = msg.height;
            else if (msg.value && typeof msg.value.height === 'number') tiktokHeight = msg.value.height;
            else if (msg.params && typeof msg.params.height === 'number') tiktokHeight = msg.params.height;
            if (msg.videoId || msg.id) videoId = msg.videoId || msg.id;
          }
        } else if (data.type && /tiktok|size|resize/i.test(String(data.type))) {
          if (typeof data.height === 'number') tiktokHeight = data.height;
          else if (data.value && typeof data.value.height === 'number') tiktokHeight = data.value.height;
          else if (data.details && typeof data.details.height === 'number') tiktokHeight = data.details.height;
        } else if (data.signal && /resize|height|size/i.test(String(data.signal))) {
          if (typeof data.height === 'number') tiktokHeight = data.height;
        }

        if (tiktokHeight) {
          const iframes = document.querySelectorAll('#tabTiktok iframe, .tiktok-feed-item iframe, .modal-embed-card iframe');
          let matched = false;

          // 1단계: event.source 직접 비교로 매칭
          for (let iframe of iframes) {
            if (iframe.contentWindow === event.source) {
              const targetHeight = Math.max(300, Math.round(tiktokHeight));
              iframe.style.height = `${targetHeight}px`;
              iframe.style.minHeight = `${targetHeight}px`;
              matched = true;
              break;
            }
          }

          // 2단계: subframe 등으로 event.source 불일치 시 videoId URL 패턴으로 매칭
          if (!matched && videoId) {
            for (let iframe of iframes) {
              if (iframe.src && iframe.src.includes(String(videoId))) {
                const targetHeight = Math.max(300, Math.round(tiktokHeight));
                iframe.style.height = `${targetHeight}px`;
                iframe.style.minHeight = `${targetHeight}px`;
                matched = true;
                break;
              }
            }
          }
        }
      }
    } catch (e) { }
  });
}

// 자동 활성화
if (typeof window !== 'undefined') {
  setupIframeAutoHeight();
}

/* =========================================================================
   10. 고수준 통합 매니저 (High-Level Application Managers)
   ========================================================================= */

// 캘린더 상태 관리 및 월 이동 / 보기 전환(달력<->목록) 네비게이션 엔진
export function initCalendarManager({
  gridId = 'spCalendarGrid',
  titleId = 'spCalendarMonthTitle',
  prevBtnId = 'spPrevMonthBtn',
  nextBtnId = 'spNextMonthBtn',
  todayMonthBtnId = 'spTodayMonthBtn',
  todayListBtnId = 'spTodayListBtn',
  calViewId = 'spCalendarView',
  listViewId = 'spScheduleListView',
  tabListId = 'tabScheduleList',
  viewCalBtnId = 'spViewCalBtn',
  viewListBtnId = 'spViewListBtn',
  navControlsId = 'spCalendarNavControls',
  listNavControlsId = 'spScheduleListNavControls',
  initialDate = new Date()
} = {}) {
  let currentDate = new Date(initialDate);
  let globalSchedules = [];
  let currentMode = 'calendar'; // 'calendar' | 'list'

  const gridEl = typeof gridId === 'string' ? document.getElementById(gridId) : gridId;
  const titleEl = typeof titleId === 'string' ? document.getElementById(titleId) : titleId;
  const prevBtn = typeof prevBtnId === 'string' ? document.getElementById(prevBtnId) : prevBtnId;
  const nextBtn = typeof nextBtnId === 'string' ? document.getElementById(nextBtnId) : nextBtnId;
  const todayMonthBtn = typeof todayMonthBtnId === 'string' ? document.getElementById(todayMonthBtnId) : todayMonthBtnId;
  const todayListBtn = typeof todayListBtnId === 'string' ? document.getElementById(todayListBtnId) : todayListBtnId;
  const calView = typeof calViewId === 'string' ? document.getElementById(calViewId) : calViewId;
  const listView = typeof listViewId === 'string' ? document.getElementById(listViewId) : listViewId;
  const tabListEl = typeof tabListId === 'string' ? document.getElementById(tabListId) : tabListId;
  const viewCalBtn = typeof viewCalBtnId === 'string' ? document.getElementById(viewCalBtnId) : viewCalBtnId;
  const viewListBtn = typeof viewListBtnId === 'string' ? document.getElementById(viewListBtnId) : viewListBtnId;
  const navControls = typeof navControlsId === 'string' ? document.getElementById(navControlsId) : navControlsId;
  const listNavControls = typeof listNavControlsId === 'string' ? document.getElementById(listNavControlsId) : listNavControlsId;

  function update() {
    if (gridEl) {
      renderCalendar(gridEl, titleEl, currentDate, globalSchedules, (eventData) => {
        showScheduleModal(eventData);
      });
    }
    if (tabListEl && globalSchedules.length > 0) {
      renderScheduleList(tabListEl, globalSchedules);
    }
  }

  function setMode(mode) {
    currentMode = mode;
    if (mode === 'calendar') {
      if (calView) calView.style.display = '';
      if (listView) listView.style.display = 'none';
      if (viewCalBtn) viewCalBtn.classList.add('active');
      if (viewListBtn) viewListBtn.classList.remove('active');
      if (navControls) navControls.style.display = 'flex';
      if (listNavControls) listNavControls.style.display = 'none';
    } else {
      if (calView) calView.style.display = 'none';
      if (listView) listView.style.display = '';
      if (viewCalBtn) viewCalBtn.classList.remove('active');
      if (viewListBtn) viewListBtn.classList.add('active');
      if (navControls) navControls.style.display = 'none';
      if (listNavControls) listNavControls.style.display = 'flex';
      if (tabListEl && globalSchedules.length > 0) {
        renderScheduleList(tabListEl, globalSchedules);
      }
    }
  }

  if (viewCalBtn) {
    viewCalBtn.addEventListener('click', () => setMode('calendar'));
  }
  if (viewListBtn) {
    viewListBtn.addEventListener('click', () => setMode('list'));
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      update();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      update();
    });
  }

  if (todayMonthBtn) {
    todayMonthBtn.addEventListener('click', () => {
      currentDate = new Date();
      update();
    });
  }

  if (todayListBtn) {
    todayListBtn.addEventListener('click', () => {
      if (tabListEl && globalSchedules.length > 0) {
        renderScheduleList(tabListEl, globalSchedules);
        const activeItem = tabListEl.querySelector('.sched-list-item.nearest-active') || tabListEl.querySelector('.sched-list-item.today');
        if (activeItem) {
          activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });
  }

  return {
    setSchedules: (schedules) => {
      globalSchedules = schedules || [];
      update();
    },
    refresh: update,
    setMode,
    getMode: () => currentMode,
    getCurrentDate: () => currentDate,
    setDate: (newDate) => {
      currentDate = new Date(newDate);
      update();
    }
  };
}

// 스토리지 데이터 자동 로드 & 영상/라이브/채널순서/스케줄 일괄 초기화 엔진
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

    // 4. 스케줄 리스트 렌더링 (직캠/투표 필터링 및 지능형 중복 병합)
    const schedEl = typeof scheduleListId === 'string' ? document.getElementById(scheduleListId) : scheduleListId;
    const tabSchedEl = document.getElementById('tabScheduleList');
    const rawFiltered = (result.blipSchedules || []).filter(item => {
      const text = (item.title || "") + " " + (item.message || "");
      return !/(직캠|풀캠|팬캠|페이스캠|입덕직캠|최애직캠|팔로우캠|안방1열|음중직캠|음중풀캠|음중팔로우캠|fan\W*cam|k\W*fancam|choreo|fancam|\bcam\b|투표|사전투표|실시간투표|\bvote\b|\bvoting\b|\bpoll\b|덕애드|스타패스|아이돌챔프|뮤빗|팬플러스|포도알|케이돌|엠넷플러스\s*투표)/i.test(text);
    });

    const cleanSchedules = deduplicateScheduleList(rawFiltered);

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
export function parseUserSettings(savedSettings) {
  const baseTabMap = {};
  TAB_CONFIG_LIST.forEach(t => { baseTabMap[t.id] = t; });

  if (!savedSettings || typeof savedSettings !== 'object') {
    return JSON.parse(JSON.stringify(DEFAULT_USER_SETTINGS));
  }

  let mergedTabs = [];
  if (Array.isArray(savedSettings.tabList) && savedSettings.tabList.length > 0) {
    savedSettings.tabList.forEach(savedTab => {
      const baseTab = baseTabMap[savedTab.id];
      if (baseTab) {
        mergedTabs.push({
          ...savedTab,
          ...baseTab,
          enabled: savedTab.enabled !== false
        });
      }
    });
    TAB_CONFIG_LIST.forEach(baseTab => {
      if (!mergedTabs.some(t => t.id === baseTab.id)) {
        mergedTabs.push({ ...baseTab, enabled: baseTab.enabled !== false });
      }
    });
  } else {
    mergedTabs = JSON.parse(JSON.stringify(DEFAULT_USER_SETTINGS.tabList));
  }

  return {
    navPosition: savedSettings.navPosition || DEFAULT_USER_SETTINGS.navPosition,
    refreshInterval: savedSettings.refreshInterval || DEFAULT_USER_SETTINGS.refreshInterval,
    notifications: { ...DEFAULT_USER_SETTINGS.notifications, ...(savedSettings.notifications || {}) },
    sound: { ...DEFAULT_USER_SETTINGS.sound, ...(savedSettings.sound || {}) },
    tabList: mergedTabs,
    fanpages: (savedSettings.fanpages && savedSettings.fanpages.length > 0) ? savedSettings.fanpages : DEFAULT_USER_SETTINGS.fanpages
  };
}

// 1. 사용자 설정 로드 (기본값 및 원본 메타데이터 안전 병합)
export function loadUserSettings(callback) {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['userSettings'], (res) => {
      const settings = parseUserSettings(res.userSettings);
      try {
        localStorage.setItem('userSettings', JSON.stringify(settings));
      } catch (e) { }
      if (typeof callback === 'function') callback(settings);
    });
  } else {
    if (typeof callback === 'function') callback(JSON.parse(JSON.stringify(DEFAULT_USER_SETTINGS)));
  }
}

// 2. 사용자 설정 저장
export function saveUserSettings(newSettings, callback) {
  try {
    localStorage.setItem('userSettings', JSON.stringify(newSettings));
  } catch (e) { }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ userSettings: newSettings }, () => {
      if (typeof callback === 'function') callback(newSettings);
    });
  } else {
    if (typeof callback === 'function') callback(newSettings);
  }
}

// 3. 네비게이션 위치 적용 (좌측 vs 우측)
export function initNavPosition(position = 'left') {
  const isRight = position === 'right';
  document.body.classList.toggle('nav-right', isRight);
  document.body.classList.toggle('nav-left', !isRight);

  const appLayout = document.querySelector('.app-layout');
  if (appLayout) {
    appLayout.classList.toggle('nav-right', isRight);
    appLayout.classList.toggle('nav-left', !isRight);
  }
}

export function openSettingsModal() {
  let currentOverlay = document.getElementById('settingsModalOverlay');
  if (!currentOverlay) {
    const modalMount = document.getElementById('modalMount') || document.body;
    modalMount.insertAdjacentHTML('beforeend', createSettingsModalHTML());
    initSettingsModal();
    currentOverlay = document.getElementById('settingsModalOverlay');
    if (!currentOverlay) return;
  }
  const openBtn = document.getElementById('openSettingsBtn');
  if (openBtn) {
    openBtn.click();
  } else {
    loadUserSettings(() => {
      currentOverlay.classList.add('active');
    });
  }
}

export function closeSettingsModal() {
  const currentOverlay = document.getElementById('settingsModalOverlay');
  if (currentOverlay) currentOverlay.classList.remove('active');
}

// 4. 설정 모달 및 인터랙션 전체 초기화
export function initSettingsModal({ onTabsChanged, onFanpagesChanged, onNavPositionChanged } = {}) {
  const modalOverlay = document.getElementById('settingsModalOverlay');
  const saveNotice = document.getElementById('settingsSaveNotice');
  const resetBtn = document.getElementById('resetSettingsBtn');

  if (!modalOverlay) return;

  let currentSettings = JSON.parse(JSON.stringify(DEFAULT_USER_SETTINGS));

  function showSaveNotice(msg = '저장되었습니다.') {
    if (saveNotice) {
      const text = (typeof msg === 'string' && msg.trim()) ? msg : '저장되었습니다.';
      saveNotice.textContent = text;
      saveNotice.classList.add('visible');
      setTimeout(() => saveNotice.classList.remove('visible'), 2000);
    }
  }

  // 모달 열릴 때 폼 채우기
  function openModal() {
    loadUserSettings((loaded) => {
      currentSettings = loaded;
      populateSettingsForm(currentSettings);
      modalOverlay.classList.add('active');
    });
  }

  function closeModal() {
    modalOverlay.classList.remove('active');
  }

  // 전역 이벤트 위임 (어떤 #openSettingsBtn이든 항상 열림 보장)
  if (!window.__settingsDelegationInitialized) {
    window.__settingsDelegationInitialized = true;
    document.addEventListener('click', (e) => {
      if (e.target.closest('#openSettingsBtn')) {
        openModal();
      } else if (e.target.closest('#settingsCloseBtn') || e.target.closest('#saveSettingsDoneBtn')) {
        closeModal();
      } else if (e.target.id === 'settingsModalOverlay') {
        closeModal();
      }
    });
  }

  // 서브 탭 전환 (모달 내부 클릭 위임)
  modalOverlay.addEventListener('click', (e) => {
    const navBtn = e.target.closest('.settings-nav-btn');
    if (navBtn) {
      const targetTab = navBtn.getAttribute('data-tab');
      const navBtns = modalOverlay.querySelectorAll('.settings-nav-btn');
      const sections = modalOverlay.querySelectorAll('.settings-section');
      navBtns.forEach(b => b.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));
      navBtn.classList.add('active');
      const targetSection = document.getElementById(targetTab);
      if (targetSection) targetSection.classList.add('active');
    }
  });

  // 폼 채우기 및 리스너 바인딩
  function populateSettingsForm(settings) {
    // 1. 사이드바 위치 라디오
    const navPos = settings.navPosition || 'left';
    const radioLeft = document.getElementById('navPosLeft');
    const radioRight = document.getElementById('navPosRight');
    if (radioLeft && radioRight) {
      if (navPos === 'right') radioRight.checked = true;
      else radioLeft.checked = true;
    }

    // 2. 새로고침 주기 셀렉트
    const intervalSelect = document.getElementById('settingRefreshInterval');
    if (intervalSelect) {
      intervalSelect.value = String(settings.refreshInterval || 15);
    }

    // 3. 미디어 음소거
    const muteSwitch = document.getElementById('settingMuteOnLoad');
    if (muteSwitch) {
      muteSwitch.checked = !!(settings.sound && settings.sound.muteOnLoad);
    }

    // 4. 알림 스위치
    const noti = settings.notifications || DEFAULT_USER_SETTINGS.notifications;
    const notiMaster = document.getElementById('settingNotiMaster');
    const notiYoutube = document.getElementById('settingNotiYoutube');
    const notiLive = document.getElementById('settingNotiLive');
    const notiSchedule = document.getElementById('settingNotiSchedule');
    const dailyScheduleTimeSelect = document.getElementById('settingDailyScheduleTime');
    const dailyScheduleTimeRow = document.getElementById('dailyScheduleTimeRow');
    const subOpts = document.getElementById('notiSubOptions');

    if (notiMaster) notiMaster.checked = noti.enabled !== false;
    if (notiYoutube) notiYoutube.checked = noti.youtube !== false;
    if (notiLive) notiLive.checked = noti.live !== false;
    if (notiSchedule) notiSchedule.checked = noti.schedule !== false;
    if (dailyScheduleTimeSelect) dailyScheduleTimeSelect.value = noti.dailyScheduleTime || "09:00";
    if (dailyScheduleTimeRow) dailyScheduleTimeRow.style.opacity = (noti.schedule !== false && noti.enabled !== false) ? '1' : '0.4';
    if (subOpts) subOpts.style.opacity = notiMaster && notiMaster.checked ? '1' : '0.4';

    // 4. 탭 순서 & 활성화 목록
    renderTabReorderList(settings.tabList);

    // 5. 팬페이지 목록
    renderFanpageReorderList(settings.fanpages);
  }

  // 드래그 앤 드롭 순서 변경 바인딩 헬퍼
  function setupReorderListDragAndDrop(listEl, getList, onReorder) {
    if (!listEl) return;
    let draggedItem = null;
    let draggedIndex = -1;

    const rows = listEl.querySelectorAll('.reorder-item-row');
    rows.forEach(row => {
      row.setAttribute('draggable', 'true');

      row.addEventListener('dragstart', (e) => {
        draggedItem = row;
        draggedIndex = parseInt(row.getAttribute('data-index'), 10);
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(draggedIndex));
      });

      row.addEventListener('dragend', () => {
        draggedItem = null;
        draggedIndex = -1;
        listEl.querySelectorAll('.reorder-item-row').forEach(r => {
          r.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
        });
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!draggedItem || draggedItem === row) return;

        const rect = row.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          row.classList.add('drag-over-top');
          row.classList.remove('drag-over-bottom');
        } else {
          row.classList.add('drag-over-bottom');
          row.classList.remove('drag-over-top');
        }
      });

      row.addEventListener('dragleave', () => {
        row.classList.remove('drag-over-top', 'drag-over-bottom');
      });

      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drag-over-top', 'drag-over-bottom');
        if (!draggedItem || draggedItem === row) return;

        const fromIdx = draggedIndex;
        let toIdx = parseInt(row.getAttribute('data-index'), 10);
        const rect = row.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const isBelow = e.clientY >= midY;

        if (fromIdx < toIdx && !isBelow) {
          toIdx -= 1;
        } else if (fromIdx > toIdx && isBelow) {
          toIdx += 1;
        }

        const list = getList();
        if (fromIdx >= 0 && fromIdx < list.length && toIdx >= 0 && toIdx < list.length && fromIdx !== toIdx) {
          const item = list.splice(fromIdx, 1)[0];
          list.splice(toIdx, 0, item);
          onReorder(list);
        }
      });
    });
  }

  // 탭 목록 UI 렌더링
  function renderTabReorderList(tabList = []) {
    const listEl = document.getElementById('tabReorderList');
    if (!listEl) return;
    listEl.innerHTML = '';

    const dragHandleSvg = `
      <span class="reorder-drag-handle" title="드래그하여 순서 변경">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <circle cx="9" cy="5" r="1.2"></circle>
          <circle cx="9" cy="12" r="1.2"></circle>
          <circle cx="9" cy="19" r="1.2"></circle>
          <circle cx="15" cy="5" r="1.2"></circle>
          <circle cx="15" cy="12" r="1.2"></circle>
          <circle cx="15" cy="19" r="1.2"></circle>
        </svg>
      </span>
    `;

    const baseTabMap = {};
    TAB_CONFIG_LIST.forEach(t => { baseTabMap[t.id] = t; });

    tabList.forEach((tab, index) => {
      const baseTab = baseTabMap[tab.id] || tab;
      let iconHtml = '';
      if (baseTab.channelKey && CHANNEL_DATA_MAP[baseTab.channelKey]) {
        const ch = CHANNEL_DATA_MAP[baseTab.channelKey];
        if (ch.svg) iconHtml = `<span class="reorder-icon-mini">${ch.svg}</span>`;
        else if (ch.img) iconHtml = `<img class="reorder-icon-mini-img" src="${ch.img}" alt="">`;
      } else if (baseTab.svg) {
        iconHtml = `<span class="reorder-icon-mini">${baseTab.svg}</span>`;
      } else if (baseTab.icon) {
        iconHtml = `<span class="reorder-icon-mini-emoji">${baseTab.icon}</span>`;
      }

      const row = document.createElement('div');
      row.className = 'reorder-item-row';
      row.setAttribute('data-index', String(index));
      row.innerHTML = `
        <div class="reorder-item-left">
          ${dragHandleSvg}
          <label class="setting-switch small">
            <input type="checkbox" class="tab-toggle-cb" data-id="${tab.id}" ${tab.enabled !== false ? 'checked' : ''}>
            <span class="slider round"></span>
          </label>
          <span class="reorder-item-label">${iconHtml}<span>${escapeHtml(tab.label || tab.id)}</span></span>
        </div>
      `;
      listEl.appendChild(row);
    });

    // 드래그 앤 드롭 활성화
    setupReorderListDragAndDrop(
      listEl,
      () => currentSettings.tabList,
      (newList) => {
        currentSettings.tabList = newList;
        renderTabReorderList(currentSettings.tabList);
        saveUserSettings(currentSettings, () => {
          showSaveNotice();
          if (typeof onTabsChanged === 'function') onTabsChanged(currentSettings.tabList);
        });
      }
    );

    // 탭 활성/비활성 토글 리스너
    listEl.querySelectorAll('.tab-toggle-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        const target = currentSettings.tabList.find(t => t.id === id);
        if (target) {
          target.enabled = e.target.checked;
          saveUserSettings(currentSettings, () => {
            showSaveNotice();
            if (typeof onTabsChanged === 'function') onTabsChanged(currentSettings.tabList);
          });
        }
      });
    });
  }

  // 팬페이지 목록 UI 렌더링
  function renderFanpageReorderList(fanpages = []) {
    const listEl = document.getElementById('fanpageReorderList');
    if (!listEl) return;
    listEl.innerHTML = '';

    const dragHandleSvg = `
      <span class="reorder-drag-handle" title="드래그하여 순서 변경">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <circle cx="9" cy="5" r="1.2"></circle>
          <circle cx="9" cy="12" r="1.2"></circle>
          <circle cx="9" cy="19" r="1.2"></circle>
          <circle cx="15" cy="5" r="1.2"></circle>
          <circle cx="15" cy="12" r="1.2"></circle>
          <circle cx="15" cy="19" r="1.2"></circle>
        </svg>
      </span>
    `;

    fanpages.forEach((fp, index) => {
      const row = document.createElement('div');
      row.className = 'reorder-item-row';
      row.setAttribute('data-index', String(index));
      row.innerHTML = `
        <div class="reorder-item-left">
          ${dragHandleSvg}
          <label class="setting-switch small">
            <input type="checkbox" class="fp-toggle-cb" data-id="${fp.id}" ${fp.enabled !== false ? 'checked' : ''}>
            <span class="slider round"></span>
          </label>
          <span class="reorder-item-label">${fp.icon ? fp.icon + ' ' : ''}<strong>${escapeHtml(fp.name)}</strong></span>
          <span class="reorder-item-sub">${escapeHtml(fp.url)}</span>
        </div>
        <div class="reorder-btn-group">
          <button class="reorder-edit-btn" data-id="${fp.id}" title="수정">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="reorder-delete-btn" data-id="${fp.id}" title="삭제">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;
      listEl.appendChild(row);
    });

    // 드래그 앤 드롭 활성화
    setupReorderListDragAndDrop(
      listEl,
      () => currentSettings.fanpages,
      (newList) => {
        currentSettings.fanpages = newList;
        renderFanpageReorderList(currentSettings.fanpages);
        saveUserSettings(currentSettings, () => {
          showSaveNotice();
          if (typeof onFanpagesChanged === 'function') onFanpagesChanged(currentSettings.fanpages);
        });
      }
    );

    // 팬페이지 토글 리스너
    listEl.querySelectorAll('.fp-toggle-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        const target = currentSettings.fanpages.find(f => f.id === id);
        if (target) {
          target.enabled = e.target.checked;
          saveUserSettings(currentSettings, () => {
            showSaveNotice();
            if (typeof onFanpagesChanged === 'function') onFanpagesChanged(currentSettings.fanpages);
          });
        }
      });
    });

    // 팬페이지 인라인 수정 리스너
    listEl.querySelectorAll('.reorder-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const fp = currentSettings.fanpages.find(f => f.id === id);
        if (!fp) return;

        const row = btn.closest('.reorder-item-row');
        if (!row) return;

        row.innerHTML = `
          <div class="reorder-item-edit-form">
            <div class="reorder-item-edit-row">
              <input type="text" class="edit-fp-icon" value="${escapeHtml(fp.icon || '')}" placeholder="이모지" maxlength="4" style="width: 52px; text-align: center;">
              <input type="text" class="edit-fp-name" value="${escapeHtml(fp.name || '')}" placeholder="팬페이지 이름" style="flex: 1;">
            </div>
            <div class="reorder-item-edit-row">
              <input type="url" class="edit-fp-url" value="${escapeHtml(fp.url || '')}" placeholder="https://..." style="flex: 1;">
              <button class="reorder-inline-btn save edit-fp-save-btn" data-id="${fp.id}">저장</button>
              <button class="reorder-inline-btn cancel edit-fp-cancel-btn">취소</button>
            </div>
          </div>
        `;

        const nameInput = row.querySelector('.edit-fp-name');
        const urlInput = row.querySelector('.edit-fp-url');
        const iconInput = row.querySelector('.edit-fp-icon');
        const saveBtn = row.querySelector('.edit-fp-save-btn');
        const cancelBtn = row.querySelector('.edit-fp-cancel-btn');

        if (nameInput) nameInput.focus();

        const doSave = () => {
          const newName = (nameInput.value || '').trim();
          const newUrl = (urlInput.value || '').trim();
          const newIcon = (iconInput.value || '').trim() || '🌐';

          if (!newName || !newUrl) {
            alert('팬페이지 이름과 URL을 모두 입력해주세요.');
            return;
          }

          fp.name = newName;
          fp.url = newUrl;
          fp.icon = newIcon;

          saveUserSettings(currentSettings, () => {
            showSaveNotice('팬페이지가 수정되었습니다.');
            renderFanpageReorderList(currentSettings.fanpages);
            if (typeof onFanpagesChanged === 'function') onFanpagesChanged(currentSettings.fanpages);
          });
        };

        if (saveBtn) saveBtn.addEventListener('click', doSave);
        if (cancelBtn) {
          cancelBtn.addEventListener('click', () => {
            renderFanpageReorderList(currentSettings.fanpages);
          });
        }

        row.querySelectorAll('input').forEach(input => {
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              doSave();
            } else if (e.key === 'Escape') {
              renderFanpageReorderList(currentSettings.fanpages);
            }
          });
        });
      });
    });

    // 팬페이지 삭제 리스너
    listEl.querySelectorAll('.reorder-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (confirm('이 팬페이지 바로가기를 삭제하시겠습니까?')) {
          currentSettings.fanpages = currentSettings.fanpages.filter(f => f.id !== id);
          renderFanpageReorderList(currentSettings.fanpages);
          saveUserSettings(currentSettings, () => {
            showSaveNotice();
            if (typeof onFanpagesChanged === 'function') onFanpagesChanged(currentSettings.fanpages);
          });
        }
      });
    });
  }

  // 사이드바 위치 라디오 체인지 이벤트
  modalOverlay.querySelectorAll('input[name="navPosition"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        currentSettings.navPosition = e.target.value;
        initNavPosition(currentSettings.navPosition);
        saveUserSettings(currentSettings, () => {
          showSaveNotice('사이드바 위치가 변경되었습니다.');
          if (typeof onNavPositionChanged === 'function') onNavPositionChanged(currentSettings.navPosition);
        });
      }
    });
  });

  // 새로고침 주기 셀렉트 체인지 이벤트
  const intervalSelect = document.getElementById('settingRefreshInterval');
  if (intervalSelect) {
    intervalSelect.addEventListener('change', (e) => {
      currentSettings.refreshInterval = parseInt(e.target.value, 10) || 15;
      saveUserSettings(currentSettings, () => {
        showSaveNotice('새로고침 주기가 변경되었습니다.');
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            action: "UPDATE_REFRESH_INTERVAL",
            intervalMinutes: currentSettings.refreshInterval
          });
        }
      });
    });
  }

  // 음소거 스위치 체인지
  const muteSwitch = document.getElementById('settingMuteOnLoad');
  if (muteSwitch) {
    muteSwitch.addEventListener('change', (e) => {
      currentSettings.sound = currentSettings.sound || {};
      currentSettings.sound.muteOnLoad = e.target.checked;
      saveUserSettings(currentSettings, () => showSaveNotice());

      const iframe = document.getElementById('shortsTabFrame');
      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage({
            type: 'SET_MUTE_SETTING',
            muteOnLoad: e.target.checked
          }, '*');
        } catch (err) { }
      }
    });
  }

  // 알림 스위치 체인지
  const notiMaster = document.getElementById('settingNotiMaster');
  const notiYoutube = document.getElementById('settingNotiYoutube');
  const notiLive = document.getElementById('settingNotiLive');
  const notiSchedule = document.getElementById('settingNotiSchedule');
  const dailyScheduleTimeSelect = document.getElementById('settingDailyScheduleTime');
  const dailyScheduleTimeRow = document.getElementById('dailyScheduleTimeRow');
  const subOpts = document.getElementById('notiSubOptions');

  function syncNotiSettings() {
    currentSettings.notifications = {
      enabled: notiMaster ? notiMaster.checked : true,
      youtube: notiYoutube ? notiYoutube.checked : true,
      live: notiLive ? notiLive.checked : true,
      schedule: notiSchedule ? notiSchedule.checked : true,
      dailyScheduleTime: dailyScheduleTimeSelect ? dailyScheduleTimeSelect.value : "09:00"
    };
    if (subOpts) subOpts.style.opacity = currentSettings.notifications.enabled ? '1' : '0.4';
    if (dailyScheduleTimeRow) dailyScheduleTimeRow.style.opacity = (currentSettings.notifications.schedule && currentSettings.notifications.enabled) ? '1' : '0.4';
    saveUserSettings(currentSettings, () => showSaveNotice());
  }

  if (notiMaster) notiMaster.addEventListener('change', syncNotiSettings);
  if (notiYoutube) notiYoutube.addEventListener('change', syncNotiSettings);
  if (notiLive) notiLive.addEventListener('change', syncNotiSettings);
  if (notiSchedule) notiSchedule.addEventListener('change', syncNotiSettings);
  if (dailyScheduleTimeSelect) dailyScheduleTimeSelect.addEventListener('change', syncNotiSettings);

  // 신규 팬페이지 추가 버튼
  const addFpBtn = document.getElementById('addNewFanpageBtn');
  if (addFpBtn) {
    addFpBtn.addEventListener('click', () => {
      const iconInput = document.getElementById('newFpIcon');
      const nameInput = document.getElementById('newFpName');
      const urlInput = document.getElementById('newFpUrl');

      const name = (nameInput.value || '').trim();
      const url = (urlInput.value || '').trim();
      const icon = (iconInput.value || '').trim() || '🌐';

      if (!name || !url) {
        alert('팬페이지 이름과 URL을 모두 입력해주세요.');
        return;
      }

      const newId = 'fp_' + Date.now();
      currentSettings.fanpages.push({
        id: newId,
        name: name,
        url: url,
        icon: icon,
        enabled: true
      });

      nameInput.value = '';
      urlInput.value = '';
      iconInput.value = '';

      renderFanpageReorderList(currentSettings.fanpages);
      saveUserSettings(currentSettings, () => {
        showSaveNotice('팬페이지가 추가되었습니다.');
        if (typeof onFanpagesChanged === 'function') onFanpagesChanged(currentSettings.fanpages);
      });
    });
  }

  // 기본값 복원 버튼
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('모든 사용자 설정을 기본값으로 초기화하시겠습니까?')) {
        currentSettings = JSON.parse(JSON.stringify(DEFAULT_USER_SETTINGS));
        populateSettingsForm(currentSettings);
        initNavPosition(currentSettings.navPosition);
        saveUserSettings(currentSettings, () => {
          showSaveNotice('기본값으로 복원되었습니다.');
          if (typeof onTabsChanged === 'function') onTabsChanged(currentSettings.tabList);
          if (typeof onFanpagesChanged === 'function') onFanpagesChanged(currentSettings.fanpages);
          if (typeof onNavPositionChanged === 'function') onNavPositionChanged(currentSettings.navPosition);
        });
      }
    });
  }

  // 다른 창(사이드패널 <-> 대시보드) 간 실시간 설정 동기화 감지 (불필요한 리렌더링 방지)
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.userSettings && changes.userSettings.newValue) {
        const updated = changes.userSettings.newValue;
        const old = changes.userSettings.oldValue || {};

        if (updated.navPosition && updated.navPosition !== old.navPosition) {
          initNavPosition(updated.navPosition);
        }
        if (typeof onTabsChanged === 'function' && updated.tabList && JSON.stringify(updated.tabList) !== JSON.stringify(old.tabList)) {
          onTabsChanged(updated.tabList);
        }
        if (typeof onFanpagesChanged === 'function' && updated.fanpages && JSON.stringify(updated.fanpages) !== JSON.stringify(old.fanpages)) {
          onFanpagesChanged(updated.fanpages);
        }
      }
    });
  }
}

/**
 * 사이드패널 또는 보드(대시보드) 진입 시 백그라운드 데이터 1회 갱신 요청
 */
export function requestBackgroundRefresh(force = false) {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      chrome.runtime.sendMessage({ action: "REFRESH_ALL_DATA", force }, (response) => {
        if (chrome.runtime.lastError) {
          // 백그라운드 서비스 워커 준비 중이거나 응답 채널 종료 시 에러 무시
          console.debug('[RemineHelper] Background refresh message skipped:', chrome.runtime.lastError.message);
        }
      });
    } catch (e) {
      console.debug('[RemineHelper] Failed to send refresh message:', e);
    }
  }
}

