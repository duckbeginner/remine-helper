// scripts/data-hub/utils/url-cleaner.js
// 마케팅 추적 파라미터 제거 및 YouTube 재생시점(?t=, ?start=) 보존 URL 정제기

// 제거 대상 마케팅/트래킹 파라미터 목록
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'si',
  'igsh',
  'stkn',
  'fbclid',
  'gclid',
  'feature',
  'ref',
  'ref_src',
  'ref_url',
  's', // 트위터/X 공유 추적 (s=20 등)
  't' // 트위터/X 공유 시간 추적 (단, YouTube는 아래에서 별도 보존)
]);

/**
 * URL에서 마케팅 추적 파라미터를 100% 제거하고,
 * YouTube ?t=, ?start= 등 재생 시점 파라미터를 엄격하게 보존합니다.
 *
 * @param {string} rawUrl - 원본 URL 문자열
 * @returns {string} 정제된 URL 문자열
 */
export function cleanUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  try {
    let hadProtocol = true;
    let urlToParse = trimmed;
    if (!/^https?:\/\//i.test(trimmed)) {
      // 유효 도메인 형태(예: youtube.com/..., www.xxx)인 경우에만 프로토콜 보정 파싱
      if (!/^(?:www\.|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/|$))/i.test(trimmed)) {
        return trimmed;
      }
      hadProtocol = false;
      urlToParse = 'https://' + trimmed;
    }

    const parsed = new URL(urlToParse);
    const host = parsed.hostname.toLowerCase();

    // 1. 인스타그램: 릴스/게시물은 쿼리 파라미터가 전부 불필요하므로 일괄 제거
    if (host.includes('instagram.com')) {
      parsed.search = '';
      let cleaned = parsed.toString();
      if (cleaned.endsWith('?')) cleaned = cleaned.slice(0, -1);
      return hadProtocol ? cleaned : cleaned.replace(/^https?:\/\//, '');
    }

    // 2. 일반 및 YouTube, 트위터 등: 추적 파라미터 선별 제거
    const keysToDelete = [];
    for (const [key] of parsed.searchParams.entries()) {
      const lowerKey = key.toLowerCase();
      // YouTube의 't' 또는 'start' 파라미터(예: ?t=1m30s, ?t=95)는 엄격히 보존
      if ((lowerKey === 't' || lowerKey === 'start') && (host.includes('youtube.com') || host.includes('youtu.be'))) {
        continue;
      }
      // YouTube의 'v' (영상 ID)는 당연히 보존
      if (lowerKey === 'v' && host.includes('youtube.com')) {
        continue;
      }

      if (TRACKING_PARAMS.has(lowerKey) || lowerKey.startsWith('utm_')) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      parsed.searchParams.delete(key);
    }

    let cleaned = parsed.toString();

    // 3. 파라미터가 모두 비어있을 때 끝에 붙은 불필요한 '?' 제거
    if (cleaned.endsWith('?')) {
      cleaned = cleaned.slice(0, -1);
    }

    return hadProtocol ? cleaned : cleaned.replace(/^https?:\/\//, '');
  } catch (e) {
    // 유효하지 않은 URL은 원본 그대로 안전하게 반환
    return trimmed;
  }
}

/**
 * 메시지 본문 텍스트 내에 포함된 모든 URL을 찾아 정제된 URL로 치환합니다.
 *
 * @param {string} text - 원본 텍스트
 * @returns {string} 링크가 정제된 텍스트
 */
export function cleanTextUrls(text) {
  if (!text || typeof text !== 'string') return text;

  // URL 탐색 정규식 (https?:// 뿐만 아니라 프로토콜 없는 주요 SNS 도메인도 포착)
  const urlRegex = /(?:https?:\/\/|(?:www\.|youtube\.com\/|youtu\.be\/|instagram\.com\/|x\.com\/|twitter\.com\/))[^\s"'<>]+/g;
  return text.replace(urlRegex, (matchedUrl) => {
    // URL 끝에 문장 부호(마침표, 쉼표, 닫는 괄호 등)가 붙은 경우 분리
    let trail = '';
    let urlToClean = matchedUrl;
    while (urlToClean.length > 0 && /[.,;:)\]}>]$/.test(urlToClean)) {
      trail = urlToClean.slice(-1) + trail;
      urlToClean = urlToClean.slice(0, -1);
    }
    const cleaned = cleanUrl(urlToClean);
    return cleaned + trail;
  });
}

/**
 * URL이나 문자열에서 YouTube 11자리 영상 ID를 추출합니다.
 *
 * @param {string} url - YouTube URL 또는 문자열
 * @returns {string|null} 11자리 videoId 또는 null
 */
export function extractYoutubeId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

/**
 * YouTube 영상 ID 또는 URL을 기반으로 공식 썸네일 주소를 동적 반환합니다.
 *
 * @param {string} urlOrId - YouTube URL 또는 11자리 videoId
 * @returns {string|null} 썸네일 URL
 */
export function getYoutubeThumbnail(urlOrId) {
  if (!urlOrId || typeof urlOrId !== 'string') return null;
  const vid = extractYoutubeId(urlOrId) || (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId.trim()) ? urlOrId.trim() : null);
  if (!vid) return null;
  return `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
}

