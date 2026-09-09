// common/modules/youtube.js - 유튜브 공식/개인 채널 목록 및 쇼츠 렌더러
import { escapeHtml, createVideoCardHTML } from '../templates.js';

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
