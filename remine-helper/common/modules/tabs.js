// common/modules/tabs.js - 동적 탭 & 크리스탈 글래스 슬라이더 & Iframe 관리
import { TAB_CONFIG_LIST } from '../../constants.js';

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
    <iframe credentialless 
            src="${finalUrl}" 
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

const FEED_PAGE_SIZE = 12;

// 공통 무한 스크롤 바인딩 유틸 (IntersectionObserver 네이티브 뷰포트 감지 + 2중 폴백)
function bindFeedInfiniteScroll(container, loadMoreFn) {
  if (!container) return;

  // 기존 센티넬이 있으면 제거
  const oldSentinel = container.querySelector(".feed-scroll-sentinel");
  if (oldSentinel) oldSentinel.remove();

  const sentinel = document.createElement("div");
  sentinel.className = "feed-scroll-sentinel";
  sentinel.style.cssText = "width: 100%; height: 50px; grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; color: #888; font-size: 12px; pointer-events: none; opacity: 0.6;";
  sentinel.textContent = "피드를 추가로 불러오는 중...";
  container.appendChild(sentinel);

  let isLoading = false;
  const triggerLoad = () => {
    if (isLoading) return;
    isLoading = true;
    const hasMore = loadMoreFn();
    if (!hasMore) {
      if (observer) observer.disconnect();
      sentinel.remove();
    } else {
      container.appendChild(sentinel);
      setTimeout(() => { isLoading = false; }, 250);
    }
  };

  const observer = new IntersectionObserver((entries) => {
    const entry = entries[0];
    if (entry && entry.isIntersecting) {
      triggerLoad();
    }
  }, {
    rootMargin: "450px"
  });

  observer.observe(sentinel);

  // 2중 방어 스크롤 리스너 (패널 탭, 컨테이너, 윈도우 스크롤 모두 지원)
  const scrollParent = container.closest(".panel-tab-content") || container.parentElement;
  if (scrollParent) {
    scrollParent.addEventListener("scroll", () => {
      if (scrollParent.scrollHeight - scrollParent.scrollTop - scrollParent.clientHeight < 450) {
        triggerLoad();
      }
    }, { passive: true });
  }
  container.addEventListener("scroll", () => {
    if (container.scrollHeight - container.scrollTop - container.clientHeight < 450) {
      triggerLoad();
    }
  }, { passive: true });
}


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
