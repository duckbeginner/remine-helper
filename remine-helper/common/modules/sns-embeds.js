// common/modules/sns-embeds.js - 인스타그램, X, 틱톡 임베드 렌더러 및 리사이즈
import { escapeHtml } from '../templates.js';
import { FEED_PAGE_SIZE, bindFeedInfiniteScroll, enableIframeScrollGuard } from './tabs.js';

export function renderInstaEmbeds(container, feeds = [], isDark = false) {
  if (!container) return;
  if (!feeds || feeds.length === 0) {
    container.innerHTML = "<p style=\"text-align: center; color: #888; padding: 20px;\">인스타그램 피드가 없습니다.</p>";
    return;
  }

  const themeStr = isDark ? "dark" : "light";
  container.innerHTML = "";

  // 동일한 shortcode/id 중복 원천 제거
  const seenInstaKeys = new Set();
  const validFeeds = [];
  feeds.forEach(feed => {
    let type = (feed.type || "p").toLowerCase();
    let id = feed.shortcode || feed.id;
    const link = feed.link || feed.permalink || feed.url || "";
    const m = link.match(/\/(p|reel|reels)\/([^\/?#]+)/i);
    if (m) {
      type = (m[1] || "p").toLowerCase();
      id = m[2];
    }
    if (id && !seenInstaKeys.has(id)) {
      seenInstaKeys.add(id);
      validFeeds.push({ ...feed, id, type });
    }
  });

  let loadedCount = 0;

  function appendNextBatch() {
    const nextBatch = validFeeds.slice(loadedCount, loadedCount + FEED_PAGE_SIZE);
    if (nextBatch.length === 0) return false;

    const fragment = document.createDocumentFragment();
    nextBatch.forEach(feed => {
      let type = (feed.type || "p").toLowerCase();
      let id = feed.shortcode || feed.id;
      const link = feed.link || feed.permalink || feed.url || "";
      const m = link.match(/\/(p|reel|reels)\/([^\/?#]+)/i);
      if (m) {
        type = (m[1] || "p").toLowerCase();
        id = m[2];
      }
      if (!id) return;

      const wrapper = document.createElement("div");
      wrapper.className = "feed-iframe-wrapper";
      wrapper.innerHTML = `<iframe credentialless src="https://www.instagram.com/${type}/${id}/embed/captioned/?theme=${themeStr}" style="width: 100%; height: 650px; min-height: 650px; transition: height 0.3s ease;" frameborder="0" scrolling="no" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" loading="lazy"></iframe>`;
      fragment.appendChild(wrapper);
    });

    container.appendChild(fragment);
    loadedCount += nextBatch.length;
    enableIframeScrollGuard(container);
    return loadedCount < validFeeds.length;
  }

  appendNextBatch();

  if (loadedCount < validFeeds.length) {
    bindFeedInfiniteScroll(container, appendNextBatch);
  }
}

export function renderXEmbeds(container, feeds = [], isDark = false) {
  if (!container) return;
  if (!feeds || feeds.length === 0) {
    container.innerHTML = "<p style=\"text-align: center; color: #888; padding: 20px;\">X 피드가 없습니다.</p>";
    return;
  }

  const themeStr = isDark ? "dark" : "light";
  container.innerHTML = "";

  // 동일한 tweetId 중복 원천 제거
  const seenXIds = new Set();
  const validFeeds = [];
  feeds.forEach(feed => {
    const id = String(feed.id || "");
    if (id && !seenXIds.has(id)) {
      seenXIds.add(id);
      validFeeds.push(feed);
    }
  });
  let loadedCount = 0;

  function appendNextBatch() {
    const nextBatch = validFeeds.slice(loadedCount, loadedCount + FEED_PAGE_SIZE);
    if (nextBatch.length === 0) return false;

    const fragment = document.createDocumentFragment();
    nextBatch.forEach(feed => {
      const tweetId = feed.id;
      if (!tweetId) return;

      const wrapper = document.createElement("div");
      wrapper.className = "feed-iframe-wrapper tweet-embed-wrapper";
      wrapper.innerHTML = `<iframe credentialless src="https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=${themeStr}" style="width: 100%; height: 250px; transition: height 0.25s ease;" frameborder="0" scrolling="no" loading="lazy"></iframe>`;
      fragment.appendChild(wrapper);
    });

    container.appendChild(fragment);
    loadedCount += nextBatch.length;
    enableIframeScrollGuard(container);
    return loadedCount < validFeeds.length;
  }

  appendNextBatch();

  if (loadedCount < validFeeds.length) {
    bindFeedInfiniteScroll(container, appendNextBatch);
  }
}

/* =========================================================================
   틱톡 단일 모달 플레이어 & 초경량 썸네일 카드 엔진
   ========================================================================= */

let activeTiktokModalOverlay = null;

// 단일 틱톡 모달 플레이어 닫기
export function closeTiktokModal() {
  if (!activeTiktokModalOverlay) return;
  const overlay = activeTiktokModalOverlay;
  activeTiktokModalOverlay = null;

  overlay.classList.remove("active");
  setTimeout(() => {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }, 250);
}

// 탭 전환 또는 외부 요청 시 모든 틱톡 일괄 닫기/정지
export function pauseAllTiktokEmbeds(container) {
  closeTiktokModal();
}

// 틱톡 비디오 단 1개만 모달로 띄워 재생
export function openTiktokModal(videoId) {
  if (!videoId) return;
  closeTiktokModal();

  const overlay = document.createElement("div");
  overlay.className = "tiktok-modal-overlay";
  overlay.innerHTML = `
    <div class="tiktok-modal-container">
      <button type="button" class="tiktok-modal-close-btn" title="닫기 (ESC)">✕</button>
      <iframe credentialless src="https://www.tiktok.com/player/v1/${videoId}?autoplay=1&controls=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
    </div>
  `;

  // 닫기 버튼 클릭
  overlay.querySelector(".tiktok-modal-close-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    closeTiktokModal();
  });

  // 모달 바깥 백드롭 클릭 시 닫기
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeTiktokModal();
    }
  });

  // ESC 키 닫기 핸들러
  const handleEsc = (e) => {
    if (e.key === "Escape") {
      closeTiktokModal();
      document.removeEventListener("keydown", handleEsc);
    }
  };
  document.addEventListener("keydown", handleEsc);

  document.body.appendChild(overlay);
  activeTiktokModalOverlay = overlay;

  requestAnimationFrame(() => {
    overlay.classList.add("active");
  });
}

// 틱톡 oEmbed 백그라운드 썸네일 보강 캐시
const tiktokOEmbedCache = new Map();

async function fetchTiktokThumb(videoId, imgElem, titleElem) {
  if (!videoId || !imgElem) return;
  if (tiktokOEmbedCache.has(videoId)) {
    const cached = tiktokOEmbedCache.get(videoId);
    if (cached.thumb) imgElem.src = cached.thumb;
    if (cached.title && titleElem && (!titleElem.textContent || titleElem.textContent === "RESCENE TikTok Video")) {
      titleElem.textContent = cached.title;
    }
    return;
  }
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=https://www.tiktok.com/@rescene_official/video/${videoId}`);
    if (res.ok) {
      const data = await res.json();
      tiktokOEmbedCache.set(videoId, { thumb: data.thumbnail_url, title: data.title });
      if (data.thumbnail_url) imgElem.src = data.thumbnail_url;
      if (data.title && titleElem && (!titleElem.textContent || titleElem.textContent === "RESCENE TikTok Video")) {
        titleElem.textContent = data.title;
      }
    }
  } catch (e) {}
}

export function renderTiktokEmbeds(container, feeds = [], isDark = false) {
  if (!container) return;

  if (feeds && feeds.length > 0) {
    container.innerHTML = "";
    // 동일한 videoId 중복 원천 제거
    const seenTiktokIds = new Set();
    const validFeeds = [];
    feeds.forEach(feed => {
      const id = String(feed.id || "");
      if (id && !seenTiktokIds.has(id)) {
        seenTiktokIds.add(id);
        validFeeds.push(feed);
      }
    });
    let loadedCount = 0;

    function appendNextBatch() {
      const nextBatch = validFeeds.slice(loadedCount, loadedCount + FEED_PAGE_SIZE);
      if (nextBatch.length === 0) return false;

      const fragment = document.createDocumentFragment();
      nextBatch.forEach(feed => {
        const videoId = feed.id;
        const card = document.createElement("div");
        card.className = "tiktok-card";
        card.dataset.videoId = videoId;

        const initialThumb = feed.thumb || "icons/rescene-logo.png";
        const titleText = feed.title ? escapeHtml(feed.title) : "RESCENE TikTok Video";

        card.innerHTML = `
          <img src="${initialThumb}" alt="TikTok Video" class="tiktok-card-thumb" loading="lazy" />
          <div class="tiktok-card-gradient"></div>
          <div class="tiktok-card-play-btn">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
          <div class="tiktok-card-badge">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z"/>
            </svg>
            <span>TikTok</span>
          </div>
          <div class="tiktok-card-info">
            <p class="tiktok-card-title">${titleText}</p>
          </div>
        `;

        // 썸네일이 기본 로고인 경우 백그라운드에서 oEmbed로 자동 보강
        if (!feed.thumb) {
          const imgElem = card.querySelector(".tiktok-card-thumb");
          const titleElem = card.querySelector(".tiktok-card-title");
          fetchTiktokThumb(videoId, imgElem, titleElem);
        }

        // 카드 클릭 시 단일 모달 플레이어 오픈!
        card.addEventListener("click", () => {
          openTiktokModal(videoId);
        });

        fragment.appendChild(card);
      });

      container.appendChild(fragment);
      loadedCount += nextBatch.length;
      return loadedCount < validFeeds.length;
    }

    appendNextBatch();

    if (loadedCount < validFeeds.length) {
      bindFeedInfiniteScroll(container, appendNextBatch);
    }
    return;
  }

  container.innerHTML = "<p style=\"text-align: center; color: #888; padding: 20px;\">TikTok 피드가 없습니다.</p>";
}

/* =========================================================================
   8. 스케줄 모달 & 툴팁 팝업 핸들러 (Modal & Tooltip)
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
        if (height && typeof height === 'number' && height > 50) {
          const iframes = document.querySelectorAll('.feed-iframe-wrapper iframe, .modal-embed-card iframe');
          for (let iframe of iframes) {
            if (iframe.contentWindow === event.source) {
              iframe.style.height = `${height}px`;
              iframe.style.minHeight = `${height}px`;
              if (iframe.parentElement) {
                iframe.parentElement.style.height = `${height}px`;
                iframe.parentElement.style.minHeight = `${height}px`;
              }
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
