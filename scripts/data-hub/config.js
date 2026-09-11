// scripts/data-hub/config.js
// 데이터 허브 중앙 설정 파일 (Single Source of Truth)

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');

// 기본 제외 키워드 목록
export const DEFAULT_EXCLUDE_KEYWORDS = [
  // 투표
  '투표', '사전투표', '실시간투표', 'vote', 'voting', 'poll',
  '덕애드', '스타패스', '아이돌챔프', '뮤빗', '팬플러스', '포도알', '케이돌', '엠넷플러스 투표',
  // 직캠
  '직캠', '풀캠', '팬캠', '페이스캠', '입덕직캠', '최애직캠', '팔로우캠', '안방1열', '음중직캠', 'fancam', 'choreo',
  // 단순 이벤트 및 공지
  '포스터 이벤트', '사인 이벤트', '싸인 이벤트', '이벤트 안내', '안내 (Notice)', '빅크', 'BIGC', '응모 이벤트', '증정 이벤트', '특전 이벤트', '구매자 이벤트', '럭키드로우', '럭드'
];

// 쇼츠 / 숏폼 판별 정규식 패턴
export const SHORTS_PATTERNS = [
  /youtube\.com\/shorts\//i,
  /#shorts\b/i,
  /#쇼츠\b/i,
  /(?:vt\.tiktok\.com\/|tiktok\.com\/@[^/]+\/video\/\d+)/i,
  /instagram\.com\/reels?\/[\w-]+/i
];

// 수집 기간 설정 (기본: 과거 1개월 ~ 미래 3개월, 총 5개월)
export const MONTH_FETCH_CONFIG = {
  pastMonths: 1,
  futureMonths: 3
};

// 캐시 디렉터리 및 원본 Raw 캐시 설정
export const CACHE_CONFIG = {
  cacheDir: path.join(ROOT_DIR, '.cache'),
  rawCacheDir: path.join(ROOT_DIR, '.cache/raw'),
  oembedCacheFile: path.join(ROOT_DIR, '.cache/oembed-cache.json'),
  ttlMs: 24 * 60 * 60 * 1000 // 24시간
};
