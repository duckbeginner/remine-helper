// common/theme-preload.js - Manifest V3 CSP 준수 0ms 동기식 테마 프리로드 & 초기 트랜지션 억제 스크립트
(function() {
  try {
    const docEl = document.documentElement;
    docEl.classList.add('preload'); // 초기 로드 트랜지션 애니메이션 완전 차단

    const mode = localStorage.getItem('themeMode') || 'system';
    const isDark = mode === 'dark' || (mode !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      docEl.classList.add('dark-mode');
      docEl.style.backgroundColor = '#181520';
      docEl.style.colorScheme = 'dark';
    } else {
      docEl.classList.remove('dark-mode');
      docEl.style.backgroundColor = '#fff0f5';
      docEl.style.colorScheme = 'light';
    }

    // 첫 프레임 페인트 완료 후 트랜지션 잠금 해제
    function releasePreload() {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          docEl.classList.remove('preload');
        });
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', releasePreload, { once: true });
    } else {
      releasePreload();
    }
  } catch (e) {}
})();
