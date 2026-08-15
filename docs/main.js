// docs/main.js - Remine Helper Landing Page Interactive Engine

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initShowcaseTabs();
  initFaqAccordion();
  initSmoothScroll();
});

// 1. 테마 토글 엔진 (로컬 스토리지 및 시스템 설정 감지)
function initTheme() {
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const savedTheme = localStorage.getItem('remine_landing_theme') || 'dark';

  setTheme(savedTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isDark = document.body.classList.contains('dark-mode');
      const newTheme = isDark ? 'light' : 'dark';
      setTheme(newTheme);
      localStorage.setItem('remine_landing_theme', newTheme);
    });
  }
}

function setTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
    document.body.setAttribute('data-theme', 'dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.body.classList.remove('dark-mode');
    document.body.setAttribute('data-theme', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

// 2. 인터랙티브 스크린샷 쇼케이스 탭 전환
function initShowcaseTabs() {
  const tabs = document.querySelectorAll('.showcase-tab');
  const frameViewport = document.getElementById('frameViewport');
  const sidepanelImg = document.getElementById('sidepanelShowcaseImg');
  const dashboardImg = document.getElementById('dashboardShowcaseImg');
  const urlBarSpan = document.getElementById('frameUrlText');
  const modeBadge = document.getElementById('frameModeBadge');

  const imageMap = {
    'sp-light': {
      type: 'sidepanel',
      src: 'screenshots/sidepanel_01_light.png',
      url: 'https://rescene.kr/remine-helper',
      badge: 'SIDEPANEL (LIGHT)'
    },
    'sp-dark': {
      type: 'sidepanel',
      src: 'screenshots/sidepanel_02_dark.png',
      url: 'https://rescene.kr/remine-helper',
      badge: 'SIDEPANEL (DARK)'
    },
    'sp-list': {
      type: 'sidepanel',
      src: 'screenshots/sidepanel_03_list.png',
      url: 'https://rescene.kr/remine-helper',
      badge: 'SCHEDULE LIST'
    },
    'sp-modal': {
      type: 'sidepanel',
      src: 'screenshots/sidepanel_04_modal.png',
      url: 'https://rescene.kr/remine-helper',
      badge: 'SCHEDULE MEDIA'
    },
    'sp-insta': {
      type: 'sidepanel',
      src: 'screenshots/sidepanel_05_insta.png',
      url: 'https://rescene.kr/remine-helper',
      badge: 'INSTAGRAM FEED'
    },
    'sp-x': {
      type: 'sidepanel',
      src: 'screenshots/sidepanel_06_x.png',
      url: 'https://rescene.kr/remine-helper',
      badge: 'X (TWITTER) FEED'
    },
    'sp-tiktok': {
      type: 'sidepanel',
      src: 'screenshots/sidepanel_07_tiktok.png',
      url: 'https://rescene.kr/remine-helper',
      badge: 'TIKTOK SHORTS'
    },
    'sp-sceneflix': {
      type: 'sidepanel',
      src: 'screenshots/sidepanel_08_sceneflix.png',
      url: 'https://rescene.kr/remine-helper',
      badge: 'SCENE-FLIX'
    },
    'dash-light': {
      type: 'dashboard',
      src: 'screenshots/dashboard_01_light.png',
      url: 'chrome-extension://remine-helper/dashboard.html',
      badge: 'FULL DASHBOARD'
    },
    'dash-dark': {
      type: 'dashboard',
      src: 'screenshots/dashboard_02_dark.png',
      url: 'chrome-extension://remine-helper/dashboard.html',
      badge: 'DASHBOARD DARK'
    },
    'dash-settings': {
      type: 'dashboard',
      src: 'screenshots/dashboard_04_settings.png',
      url: 'chrome-extension://remine-helper/dashboard.html',
      badge: 'SETTINGS MODAL'
    }
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const target = tab.getAttribute('data-target');
      const item = imageMap[target];
      if (!item) return;

      if (urlBarSpan) urlBarSpan.textContent = item.url;
      if (modeBadge) modeBadge.textContent = item.badge;

      if (frameViewport) {
        frameViewport.className = `frame-viewport mode-${item.type}`;
      }

      if (item.type === 'sidepanel' && sidepanelImg) {
        sidepanelImg.style.opacity = '0';
        setTimeout(() => {
          sidepanelImg.src = item.src;
          sidepanelImg.onload = () => { sidepanelImg.style.opacity = '1'; };
        }, 80);
      } else if (item.type === 'dashboard' && dashboardImg) {
        dashboardImg.style.opacity = '0';
        setTimeout(() => {
          dashboardImg.src = item.src;
          dashboardImg.onload = () => { dashboardImg.style.opacity = '1'; };
        }, 80);
      }
    });
  });
}

// 3. FAQ 아코디언 인터랙션
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question');
    if (questionBtn) {
      questionBtn.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        
        // 다른 열린 항목 닫기
        faqItems.forEach(i => i.classList.remove('active'));

        // 클릭된 항목 토글
        if (!isActive) {
          item.classList.add('active');
        }
      });
    }
  });
}

// 4. 부드러운 스크롤 및 앵커 링크
function initSmoothScroll() {
  const links = document.querySelectorAll('a[href^="#"]');

  links.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href === '#' || href === '') return;

      const targetEl = document.querySelector(href);
      if (targetEl) {
        e.preventDefault();
        const headerOffset = 80;
        const elementPosition = targetEl.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}
