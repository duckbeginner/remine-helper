// remine-helper/common/modules/utils.js
// 단일 진실 공급원(SSOT) 공통 유틸리티 모듈
// 날짜 파싱, KST 변환, XSS 방어(escapeHtml), HTML 엔티티 디코딩, 타이틀 정제 등

/**
 * 1. 안전한 날짜 파서 (KST 표준 및 결측치 방어)
 * 결측치(null, undefined, 빈문자열, 비정상 포맷) 인입 시 반드시 null을 반환하여
 * 호출부에서 조용히 스킵(렌더링 제외)할 수 있도록 방어합니다 (운영 정책 1 준수).
 * 
 * @param {string|number|Date} startTimeStr 
 * @returns {Date|null}
 */
export function parseSafeDate(startTimeStr) {
  if (!startTimeStr) return null;
  if (startTimeStr instanceof Date) {
    return isNaN(startTimeStr.getTime()) ? null : startTimeStr;
  }
  if (typeof startTimeStr !== 'string') return null;
  
  const trimmed = startTimeStr.trim();
  if (!trimmed) return null;

  // YYYY-MM-DD 기본 정규식 및 월/일 범위 유효성 선행 검증 (오버플로우 방어)
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const d = parseInt(match[3], 10);
    if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
      return null;
    }
  }

  // YYYY-MM-DD 10자리 로컬 날짜
  if (trimmed.length === 10 && !trimmed.includes('T')) {
    const [y, m, d] = trimmed.split('-').map(Number);
    if (isNaN(y) || isNaN(m) || isNaN(d) || m < 1 || m > 12 || d < 1 || d > 31) {
      return null;
    }
    return new Date(y, m - 1, d, 0, 0, 0);
  }

  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 2. KST(UTC+9) 기준 연-월-일(YYYY-MM-DD) 문자열 변환
 * UTC 15:00:00Z 자정 경계 데이터도 정확히 익일(KST 00시) 날짜로 변환합니다.
 * 
 * @param {string|Date} dateInput 
 * @returns {string|null} YYYY-MM-DD 포맷 문자열
 */
export function getKstDateString(dateInput) {
  const d = parseSafeDate(dateInput);
  if (!d) return null;
  
  // UTC 밀리초에 KST 오프셋(9시간)을 더해 KST 연월일 산출
  const kstMs = d.getTime() + (9 * 60 * 60 * 1000);
  const kstDate = new Date(kstMs);
  return kstDate.toISOString().slice(0, 10);
}

/**
 * 3. XSS 방어 HTML 새니타이징
 * 
 * @param {string} str 
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 4. HTML 엔티티 디코딩
 * 
 * @param {string} str 
 * @returns {string}
 */
export function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

/**
 * 5. 제목 클리닝 및 말줄임 유틸리티
 * 
 * @param {string} title 
 * @param {number} maxLength 
 * @returns {string}
 */
export function cleanDisplayTitle(title, maxLength = 0) {
  if (!title) return '';
  let clean = decodeHtmlEntities(title)
    .replace(/^(\[(?:방송|영상|공식\s*영상|행사|팬이벤트|기념일|릴리즈|일정|🎬|📺|📻|🎉|🎤|💿)\]\s*)+/gi, '')
    .trim();

  // 접미사 (파이프 채널명 및 해시태그) 반복 제거
  let prev = '';
  while (prev !== clean) {
    prev = clean;
    clean = clean
      .replace(/\s*\|\s*(?:RESCENE|리센느|안녕하세요원이입니다잘부탁드립니다|안녕하세요\s*원이입니다|helloiamwoni)\s*$/i, '')
      .replace(/(?:\s*#[^\s#]+)+$/g, '')
      .trim();
  }

  if (maxLength > 0 && clean.length > maxLength) {
    clean = clean.slice(0, maxLength).trim() + '...';
  }
  return clean;
}

/**
 * 6. 스케줄 검색 및 매칭용 텍스트 정규화
 * 이모지 및 특수문자를 제거하고 소문자 단일 공백으로 치환합니다.
 * 
 * @param {string} text 
 * @returns {string}
 */
export function cleanScheduleText(text) {
  if (!text) return '';
  return text
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]/gu, '')
    .replace(/[<>[\]{}()_!?,.~`'"•\-/]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 7. 상대 시간 계산 유틸리티
 * 
 * @param {string|Date} dateString 
 * @returns {string}
 */
export function getTimeAgo(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const past = parseSafeDate(dateString);
  if (!past) return '';

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
