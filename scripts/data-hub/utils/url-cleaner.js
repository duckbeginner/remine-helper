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
  'fbclid',
  'gclid',
  'feature',
  'ref',
  'ref_src',
  's' // 트위터 공유 추적 (s=20 등)
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
    const parsed = new URL(trimmed);

    // 1. 추적 파라미터 제거
    const keysToDelete = [];
    for (const [key] of parsed.searchParams.entries()) {
      const lowerKey = key.toLowerCase();
      // 단, YouTube의 't' 파라미터(예: ?t=1m30s, ?t=95)는 트위터의 ?s=20&t=...와 구분
      // youtube 도메인 또는 youtu.be인 경우 't'는 절대 삭제하지 않음
      if (lowerKey === 't' && (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be'))) {
        continue;
      }
      if (lowerKey === 'start' && (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be'))) {
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

    // 2. 파라미터가 모두 비어있을 때 끝에 붙은 불필요한 '?' 제거
    if (cleaned.endsWith('?')) {
      cleaned = cleaned.slice(0, -1);
    }

    return cleaned;
  } catch (e) {
    // 유효하지 않은 URL은 원본 그대로 안전하게 반환
    return trimmed;
  }
}
