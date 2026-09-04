// common/modules/theme.js - 3단계 순환 테마 엔진 (System -> Dark -> Light)

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
