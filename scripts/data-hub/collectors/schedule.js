import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { CACHE_CONFIG, DEFAULT_EXCLUDE_KEYWORDS } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = CACHE_CONFIG.cacheDir;
const RAW_CACHE_DIR = CACHE_CONFIG.rawCacheDir;
const OEMBED_CACHE_FILE = path.join(CACHE_DIR, 'oembed-cache.json');
const STREAMS_CACHE_FILE = path.join(CACHE_DIR, 'streams-cache.json');
const OVERRIDES_CACHE_FILE = path.join(CACHE_DIR, 'schedule-overrides.json');
const GIST_ID = process.env.GIST_ID || "44b49b328233ef6157499debe03f165c";

// 캐시 디렉터리 준비
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  if (!fs.existsSync(RAW_CACHE_DIR)) {
    fs.mkdirSync(RAW_CACHE_DIR, { recursive: true });
  }
}

// SHA-256 해시 계산 헬퍼
export function getSha256Hash(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(str).digest('hex');
}

// Raw 응답 원본 JSON 캐싱
export function saveRawCache(source, ymKey, data) {
  try {
    ensureCacheDir();
    const filePath = path.join(RAW_CACHE_DIR, `${source}_${ymKey}.json`);
    const hash = getSha256Hash(data);
    fs.writeFileSync(filePath, JSON.stringify({ hash, data, cachedAt: Date.now() }), 'utf8');
  } catch (e) {}
}

// Raw 응답 원본 JSON 로드
export function loadRawCache(source, ymKey) {
  try {
    const filePath = path.join(RAW_CACHE_DIR, `${source}_${ymKey}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {}
  return null;
}

// 유튜브 비디오 ID 안전 추출 정규식 파서
export function extractYouTubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([a-zA-Z0-9_-]{11})/i);
  return match ? match[1] : null;
}

// 크롤링 대상 월 계산 (기본: 과거 1개월 ~ 미래 3개월 패스트트랙, isFull=true: 2024년~내년 말 전수)
export function getMonthsToFetch(baseDate = new Date(), isFull = false) {
  const months = [];
  const curYear = baseDate.getFullYear();
  const curMonth = baseDate.getMonth() + 1; // 1 ~ 12

  if (isFull) {
    const startYear = 2024;
    const endYear = curYear + 1;
    for (let y = startYear; y <= endYear; y++) {
      for (let m = 1; m <= 12; m++) {
        months.push({ year: y, month: m });
      }
    }
  } else {
    // 과거 1개월 ~ 미래 3개월 (총 5개월)
    for (let offset = -1; offset <= 3; offset++) {
      const d = new Date(curYear, curMonth - 1 + offset, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }
  }

  return months;
}

// 스케줄 단일 아이템 슬림화 (starAttendees 복원 및 extField 하위 호환 보강)
export function slimScheduleItem(item) {
  if (!item) return null;

  const slim = {
    id: item.id || undefined,
    title: item.title,
    startTime: item.startTime,
    endTime: (item.endTime && item.endTime !== item.startTime) ? item.endTime : undefined,
    isAllday: Boolean(item.isAllday),
    typeId: item.typeId,
    url: item.url || item.link || undefined,
    typeText: item.typeText || undefined,
    channel: item.channel || undefined,
    location: item.location || undefined,
    source: item.source || undefined,
    thumbnail: item.thumbnail || undefined,
    isOfficialYoutube: item.isOfficialYoutube || undefined,
    // [하위 호환] extField 유예 보조 생성 (v1.0.3 클라이언트 { key, value } 규격 완벽 호환)
    extField: (item.extField && item.extField.key && item.extField.value)
      ? item.extField
      : (item.channel ? { key: '채널', value: item.channel } : (item.location ? { key: '장소', value: item.location } : undefined)),
    linkedScheduleIds: (Array.isArray(item.linkedScheduleIds) && item.linkedScheduleIds.length > 0) ? item.linkedScheduleIds : undefined,
    // [참석 멤버 복원] starAttendees 보존
    starAttendees: (Array.isArray(item.starAttendees) && item.starAttendees.length > 0)
      ? item.starAttendees.map(a => ({
          name: a.name || a.nickname || '',
          profileImage: a.profileImage || a.profileImageUrl || undefined
        })).filter(a => a.name)
      : undefined
  };

  const trimmedMsg = (item.message || '').trim();
  if (trimmedMsg && trimmedMsg !== '\n') {
    slim.message = trimmedMsg;
  }

  return slim;
}

// 로컬 oEmbed 캐시 로드
function loadOembedCache() {
  try {
    if (fs.existsSync(OEMBED_CACHE_FILE)) {
      const raw = fs.readFileSync(OEMBED_CACHE_FILE, 'utf8');
      const obj = JSON.parse(raw);
      return new Map(Object.entries(obj));
    }
  } catch (e) { }
  return new Map();
}

// 로컬 oEmbed 캐시 저장
function saveOembedCache(cacheMap) {
  try {
    ensureCacheDir();
    const obj = Object.fromEntries(cacheMap);
    fs.writeFileSync(OEMBED_CACHE_FILE, JSON.stringify(obj), 'utf8');
  } catch (e) { }
}

const SEEDS_STREAMS_FILE = path.resolve(__dirname, '../seeds/official-streams.json');

// 로컬 라이브 스트림 캐시 로드 (시드 폴백 지원)
function loadStreamsCache() {
  const cache = {};
  // 1. 기본 시드 파일에서 로드 (CI fresh runner 등에서도 즉시 100% 가용)
  try {
    if (fs.existsSync(SEEDS_STREAMS_FILE)) {
      const seeds = JSON.parse(fs.readFileSync(SEEDS_STREAMS_FILE, 'utf8'));
      if (Array.isArray(seeds)) {
        seeds.forEach(s => {
          if (s && s.id) cache[s.id] = { ...s };
        });
      }
    }
  } catch (e) { }

  // 2. 런타임 캐시 파일이 있으면 유효한 값만 스마트 병합 (시드의 유효한 published를 빈 값으로 덮어쓰지 않음)
  try {
    if (fs.existsSync(STREAMS_CACHE_FILE)) {
      const runtimeCache = JSON.parse(fs.readFileSync(STREAMS_CACHE_FILE, 'utf8'));
      for (const [id, val] of Object.entries(runtimeCache)) {
        if (!cache[id]) {
          cache[id] = val;
        } else {
          cache[id] = {
            ...cache[id],
            ...val,
            published: val.published || cache[id].published,
            publishedAt: val.publishedAt || cache[id].publishedAt,
            title: val.title || cache[id].title
          };
        }
      }
    }
  } catch (e) { }

  return cache;
}

// 로컬 라이브 스트림 캐시 저장
function saveStreamsCache(cache) {
  try {
    ensureCacheDir();
    fs.writeFileSync(STREAMS_CACHE_FILE, JSON.stringify(cache), 'utf8');
  } catch (e) { }
}

// 공식 유튜브 채널의 실시간 라이브 다시보기(/streams) 목록 수집
async function fetchOfficialLiveStreams() {
  const cache = loadStreamsCache();
  try {
    const res = await fetch('https://www.youtube.com/@RESCENE_official/streams', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cookie': 'CONSENT=YES+cb.20210328-17-p0.en+FX+100; SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    // 1차: 불변 정규식으로 비디오 ID 일괄 추출
    const vids = [...new Set([...html.matchAll(/\/watch\?v=([\w-]{11})/g)].map(m => m[1]))];
    const rawList = [];

    // 2차: ytInitialData에서 제목 보강 시도
    let titleMap = new Map();
    try {
      const match = html.match(/var ytInitialData = ({.*?});<\/script>/s);
      if (match) {
        const data = JSON.parse(match[1]);
        const tabs = data.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
        const streamTab = tabs.find(t => {
          const url = t.tabRenderer?.endpoint?.commandMetadata?.webCommandMetadata?.url || '';
          return url.endsWith('/streams') || /라이브|Live|Streams/i.test(t.tabRenderer?.title || '');
        });
        const contents = streamTab?.tabRenderer?.content?.richGridRenderer?.contents || [];
        contents.forEach(c => {
          const vm = c.richItemRenderer?.content?.lockupViewModel;
          if (vm && vm.contentId) {
            const title = vm.metadata?.lockupMetadataViewModel?.title?.content || '';
            if (title) titleMap.set(vm.contentId, title);
          }
        });
      }
    } catch (e) { }

    vids.forEach(vid => {
      rawList.push({
        id: vid,
        title: titleMap.get(vid) || ''
      });
    });

    let newFetches = 0;
    await Promise.all(rawList.map(async s => {
      if (cache[s.id] && cache[s.id].published) {
        if (!cache[s.id].title && s.title) cache[s.id].title = s.title;
        return;
      }
      try {
        const r = await fetch('https://www.youtube.com/watch?v=' + s.id, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
          }
        });
        const h = await r.text();
        const m = h.match(/itemprop="datePublished" content="([^"]+)"/) || h.match(/"publishDate":"([^"]+)"/) || h.match(/"uploadDate":"([^"]+)"/);
        const titleM = h.match(/<title>([^<]+)<\/title>/);
        const cleanTitle = s.title || (titleM ? titleM[1].replace(' - YouTube', '').trim() : '');
        const publishedAt = m ? m[1] : null;
        let published = '';
        if (publishedAt) {
          const d = new Date(publishedAt);
          const kstD = new Date(d.getTime() + 9 * 60 * 60 * 1000);
          published = `${kstD.getUTCFullYear()}-${String(kstD.getUTCMonth() + 1).padStart(2, '0')}-${String(kstD.getUTCDate()).padStart(2, '0')}`;
        }
        if (publishedAt || cleanTitle) {
          cache[s.id] = {
            id: s.id,
            title: cleanTitle || cache[s.id]?.title || '',
            publishedAt: publishedAt || cache[s.id]?.publishedAt || null,
            published: published || cache[s.id]?.published || '',
            url: 'https://www.youtube.com/watch?v=' + s.id,
            thumbnail: `https://i.ytimg.com/vi/${s.id}/hqdefault.jpg`
          };
          newFetches++;
        }
      } catch (e) { }
    }));

    if (newFetches > 0) {
      saveStreamsCache(cache);
    }
  } catch (err) {
    console.warn('  ⚠️ [Schedule] 라이브 스트림 목록 실시간 조회 실패 (시드/캐시 사용):', err.message);
  }

  return Object.values(cache);
}

// 소스별 불변 고유 ID 생성기 (v2.0)
export function generateScheduleId(source, item) {
  if (!item) return null;
  if (item.id && typeof item.id === 'string' && item.id.trim()) {
    return item.id.trim();
  }

  // 1) Blip 공식 일정
  if (source === 'blip' || item.source === 'blip') {
    const sId = item.scheduleId || item.id;
    if (sId) return `blip_${sId}`;
  }

  // 2) Mnet Plus 공식 일정
  if (source === 'mnet' || item.source === 'mnet') {
    const eId = item.eventId || item.id;
    if (eId) return `mnet_${eId}`;
  }

  // 3) YouTube 공식/라이브 영상
  if (source === 'youtube' || item.source === 'youtube') {
    const vId = item.videoId || item.id;
    if (vId) return `yt_${vId}`;
  }

  // 4) 커스텀/관리자 수동 일정
  if (item._isCustom || source === 'custom' || item.source === 'custom' || item.source === 'namu') {
    const dateStr = item.startTime ? item.startTime.slice(2, 10).replace(/-/g, '') : '000000';
    const rand = crypto.randomBytes(3).toString('hex');
    return `custom_${dateStr}_${rand}`;
  }

  // 5) 레거시 구버전 호환용 결정론적 해시 ID
  const rawKey = `${(item.startTime || '').slice(0, 10)}_${item.title || ''}`;
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex').slice(0, 8);
  return `legacy_${hash}`;
}

// 날짜 파싱 헬퍼
function parseSafeDate(dateStr) {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  let s = String(dateStr).trim();
  if (!s.includes('T') && s.includes(' ')) {
    s = s.replace(' ', 'T');
  }
  return new Date(s);
}

// 실제 TV 정규 방송 프로그램 판별 (본방 제목 유지 대상)
function isTvMainBroadcast(item, channel) {
  const t = (item.title || '').replace(/[<>]/g, '').trim();
  const c = String(channel || '').trim();
  const isBroadcaster = /^(?:MBC|KBS|KBS2|SBS|Mnet|JTBC|tvN|ENA|EBS|TV조선|채널A|MBN)/i.test(c);
  if (!isBroadcaster) return false;

  // 웹 전용 클립, 미방분, 비하인드, 유튜브 전용 코너는 제외 (oEmbed 제목 적용)
  if (/미방분|비하인드|선공개|직캠|fancam|풀버전|클립|behind|up코노|코없코|우쥬레코드|웹예능|아이돌부스/i.test(t + ' ' + (item.message || ''))) {
    return false;
  }

  // 대표 정규 TV 프로그램 매칭
  if (/전지적\s*참견\s*시점|전참시|놀라운\s*토요일|놀토|복면가왕|아는\s*형님|뮤직뱅크|쇼!?\s*음악중심|인기가요|m\s*countdown|엠카운트다운|쇼!?\s*챔피언|더쇼|the\s*show|심플리\s*케이팝|simply\s*k-pop|식객\s*허영만의\s*백반기행|열혈농구단|최우수산|배성재의\s*텐|아이돌\s*라디오|친한친구/i.test(t)) {
    return true;
  }
  return false;
}

// 유튜브 링크가 있는 일정 항목들을 YouTube oEmbed API로 사전 일괄 보강
// 및 쇼츠/숏폼(_isShorts) 판별 + 공식/안원잘부 채널 롱폼 정제 및 타 채널(수원시 등) 원 채널명 보존
async function enrichSchedulesWithYouTubeOEmbed(schedules, allYtVideos = []) {
  if (!Array.isArray(schedules) || schedules.length === 0) return;
  const oembedCache = loadOembedCache();
  let cacheHitCount = 0;
  let newFetchCount = 0;

  // allYtVideos 맵 생성 (id -> video)
  const allYtVideoMap = new Map((allYtVideos || []).map(v => [v.id, v]));

  // 1. 공식 채널 링크 포함 일정의 채널명 표준화 및 틱톡/숏폼 사전 검사
  schedules.forEach(item => {
    const rawText = [item.url, item.link, item.message, item.title].filter(Boolean).join(' ');

    // (1) 틱톡 비디오 링크 또는 숏폼 URL 검사 -> 스케줄 제외 마킹
    const isTikTokVideo = /(?:https?:\/\/)?(?:vt\.tiktok\.com\/[\w-]+\/?|tiktok\.com\/@[^/]+\/video\/\d+)/i.test(rawText) ||
      ((item.url && /tiktok\.com/i.test(item.url)) || (item.link && /tiktok\.com/i.test(item.link)));
    const isReel = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/reels?\/[\w-]+/i.test(rawText);

    if (isTikTokVideo || isReel) {
      item._isShorts = true;
    }

    // (2) 공식 채널 링크 표준화
    if (/youtube\.com\/@rescene_official|RESCENE\s*공식\s*YOUTUBE/i.test(rawText) || item.channel === 'RESCENE 공식 YOUTUBE 채널') {
      item.channel = 'RESCENE';
      if (item.extField) item.extField.value = 'RESCENE';
      else item.extField = { key: '채널', value: 'RESCENE' };
    } else if (/helloiamwoni|UCWpY0eSJtyO-qNAPbKFRSSg/i.test(rawText) || (item.channel && item.channel.includes('안원잘부'))) {
      item.channel = '안녕하세요원이입니다잘부탁드립니다';
      if (item.extField) item.extField.value = '안녕하세요원이입니다잘부탁드립니다';
      else item.extField = { key: '채널', value: '안녕하세요원이입니다잘부탁드립니다' };
    }
  });

  // 2. 비디오 ID가 없는 일정 중 채널 링크만 있는 '예정 일정'의 유튜브 영상 자동 매칭
  schedules.forEach(item => {
    if (item._isShorts) return;
    const text = [item.url, item.link, item.message, item.title].filter(Boolean).join(' ');
    const hasVid = text.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/);

    if (!hasVid && item.startTime) {
      const isWoniChannelItem = /helloiamwoni|UCWpY0eSJtyO-qNAPbKFRSSg/i.test(text) || item.channel === '안녕하세요원이입니다잘부탁드립니다';
      const isResceneChannelItem = /@rescene_official/i.test(text) || item.channel === 'RESCENE';

      if (isWoniChannelItem || isResceneChannelItem) {
        const itemDate = parseSafeDate(item.startTime);
        const itemDateStr = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}-${String(itemDate.getDate()).padStart(2, '0')}`;
        const itemTimeMs = itemDate.getTime();

        // 매칭 후보 영상 필터링
        const targetChannelName = isWoniChannelItem ? '안녕하세요원이입니다잘부탁드립니다' : 'RESCENE';
        const candidateVideos = (allYtVideos || []).filter(v => {
          if (v.channelName !== targetChannelName) return false;
          if (!v.publishedAt && !v.published) return false;
          const vDateStr = v.published || (v.publishedAt ? v.publishedAt.split('T')[0] : '');
          if (vDateStr === itemDateStr) return true;
          if (v.publishedAt) {
            const diffMs = Math.abs(new Date(v.publishedAt).getTime() - itemTimeMs);
            return diffMs <= 12 * 60 * 60 * 1000; // ±12시간 이내
          }
          return false;
        });

        if (candidateVideos.length > 0) {
          // 롱폼 영상 최우선 매칭, 시간 오차 최소인 영상 선택
          const longFormVideos = candidateVideos.filter(v => !v.isShorts);
          const pool = longFormVideos.length > 0 ? longFormVideos : candidateVideos;

          pool.sort((a, b) => {
            const diffA = a.publishedAt ? Math.abs(new Date(a.publishedAt).getTime() - itemTimeMs) : 999999999;
            const diffB = b.publishedAt ? Math.abs(new Date(b.publishedAt).getTime() - itemTimeMs) : 999999999;
            return diffA - diffB;
          });

          const matched = pool[0];
          if (matched.isShorts) {
            item._isShorts = true;
          } else {
            // 정식 롱폼 영상으로 일정 보강
            item.url = `https://www.youtube.com/watch?v=${matched.id}`;
            item.link = item.url;
            item.title = matched.title || item.title;
            item.thumbnail = matched.thumbnail || `https://img.youtube.com/vi/${matched.id}/hqdefault.jpg`;
            item.channel = matched.channelName || targetChannelName;
            item.extField = { key: '채널', value: item.channel };
            item.typeText = "영상";
            item.typeId = 1;
            item.message = ""; // 블립 안내문구 제거
            item.isOfficialYoutube = true;
          }
        }
      }
    }
  });

  // 2-2. 공식 라이브 스트림(/streams) 수집 및 종료된 라이브 예정 일정 실제 영상 자동 매칭
  const officialStreams = await fetchOfficialLiveStreams();
  officialStreams.forEach(s => {
    if (!allYtVideoMap.has(s.id)) {
      allYtVideoMap.set(s.id, { ...s, isShorts: false });
    }
  });
  console.log(`  🎥 [Live Stream] 공식 라이브 스트림 총 ${officialStreams.length}건 확보 완료`);

  schedules.forEach(item => {
    if (item._isShorts || item._isExcluded) return;
    const text = [item.title, item.message, item.url, item.link, item.channel, item.extField?.value].filter(Boolean).join(' ');
    const hasVid = text.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/);

    // 타 채널 외부 방송(침착맨, 문명특급, 방송사, 페스티벌 등)은 공식 채널 스트림 매칭에서 제외
    const isExternalBroadcast = /침착맨|문명특급|mmtg|대\.?친\.?소|인기가요|뮤직뱅크|쇼챔|엠카|it'?s\s*live|아이돌\s*라디오|친한친구|kcon|서든어택|월드컵/i.test(text);
    if (isExternalBroadcast) return;

    // 리센느 공식 채널 라이브 방송인지 판별
    const isOfficialLive = item.channel === 'RESCENE' || /youtube\.com\/@rescene_official|RESCENE\s*공식\s*YOUTUBE/i.test(text);
    if (!isOfficialLive) return;

    // 비디오 ID가 없고 라이브 관련 키워드가 있는 일정
    const isLiveKeyword = /\[live\]|라이브|\blive\b/i.test(item.title || '') || /\[live\]|라이브/i.test(item.message || '');
    if (!hasVid && isLiveKeyword && item.startTime) {
      const itemDate = parseSafeDate(item.startTime);
      const kstItemDate = new Date(itemDate.getTime() + 9 * 60 * 60 * 1000);
      const itemDateStr = `${kstItemDate.getUTCFullYear()}-${String(kstItemDate.getUTCMonth() + 1).padStart(2, '0')}-${String(kstItemDate.getUTCDate()).padStart(2, '0')}`;
      const itemTimeMs = itemDate.getTime();

      // 스트림 VOD가 이미 존재하거나 현재 시각보다 과거인 경우 종료된 라이브로 판정
      const hasStreamUploaded = officialStreams.some(s => s.published === itemDateStr);
      const isPast = (itemTimeMs < Date.now()) || hasStreamUploaded;

      if (isPast && officialStreams.length > 0) {
        // 날짜가 같거나 ±24시간 이내인 스트림 후보 추출
        const candidates = officialStreams.filter(s => {
          if (!s.published) return false;
          if (s.published === itemDateStr) return true;
          if (s.publishedAt) {
            const diffMs = Math.abs(new Date(s.publishedAt).getTime() - itemTimeMs);
            return diffMs <= 24 * 60 * 60 * 1000;
          }
          return false;
        });

        if (candidates.length > 0) {
          const cleanItemTitle = (item.title || '').toLowerCase();
          candidates.sort((a, b) => {
            const aTitle = (a.title || '').toLowerCase();
            const bTitle = (b.title || '').toLowerCase();

            let scoreA = 0;
            let scoreB = 0;
            if (cleanItemTitle.includes('생일') && (aTitle.includes('birthday') || aTitle.includes('생일'))) scoreA += 10;
            if (cleanItemTitle.includes('생일') && (bTitle.includes('birthday') || bTitle.includes('생일'))) scoreB += 10;
            if (cleanItemTitle.includes('메이') && aTitle.includes('may')) scoreA += 5;
            if (cleanItemTitle.includes('메이') && bTitle.includes('may')) scoreB += 5;
            if (cleanItemTitle.includes('원이') && aTitle.includes('woni')) scoreA += 5;
            if (cleanItemTitle.includes('원이') && bTitle.includes('woni')) scoreB += 5;
            if (cleanItemTitle.includes('리브') && aTitle.includes('liv')) scoreA += 5;
            if (cleanItemTitle.includes('리브') && bTitle.includes('liv')) scoreB += 5;

            if (scoreA !== scoreB) return scoreB - scoreA;

            const diffA = a.publishedAt ? Math.abs(new Date(a.publishedAt).getTime() - itemTimeMs) : 999999999;
            const diffB = b.publishedAt ? Math.abs(new Date(b.publishedAt).getTime() - itemTimeMs) : 999999999;
            return diffA - diffB;
          });

          const matchedStream = candidates[0];
          item.url = `https://www.youtube.com/watch?v=${matchedStream.id}`;
          item.link = item.url;
          item.thumbnail = matchedStream.thumbnail || `https://img.youtube.com/vi/${matchedStream.id}/hqdefault.jpg`;
          item.channel = 'RESCENE';
          item.extField = { key: '채널', value: 'RESCENE' };
          item.typeText = "영상";
          item.typeId = 1;
          item.isOfficialYoutube = true;
          item.message = ""; // 블립 이전 사전안내문구 제거

          // [LIVE] 접두사 유지
          const hadLivePrefix = /\[live\]/i.test(item.title || '');
          item.title = hadLivePrefix ? `[LIVE] ${matchedStream.title}` : matchedStream.title;

          console.log(`  🎥 [Live Match] 라이브 일정 매칭 완료: "${item.title}" (${item.url})`);
        }
      }
    }
  });

  // 3. 유튜브 비디오 ID가 있는 일정들 추출
  const targetItems = [];
  schedules.forEach(item => {
    if (item._isShorts) return;
    const text = [item.url, item.link, item.message, item.title].filter(Boolean).join(' ');
    const match = text.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/);
    if (match) {
      targetItems.push({ item, vid: match[1] });
    } else {
      if (/#shorts|#Shorts|#쇼츠|\/shorts\//i.test(text)) {
        item._isShorts = true;
      }
    }
  });

  // 4. 병렬 10개씩 청크 처리로 초고속 조회
  const CHUNK_SIZE = 10;
  for (let i = 0; i < targetItems.length; i += CHUNK_SIZE) {
    const chunk = targetItems.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(async ({ item, vid }) => {
      // 쇼츠 여부 1차 검사
      const rawText = [item.url, item.link, item.message, item.title].filter(Boolean).join(' ');
      let isShorts = /shorts\/|#shorts|#Shorts|#쇼츠|\[shorts\]|\(shorts\)/i.test(rawText);

      const knownYt = allYtVideoMap.get(vid);
      if (knownYt && knownYt.isShorts) {
        isShorts = true;
      }

      let oeData = oembedCache.get(vid);
      if (!oeData) {
        try {
          const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vid}&format=json`);
          if (res.ok) {
            oeData = await res.json();
            oembedCache.set(vid, oeData);
            newFetchCount++;
          }
        } catch (e) { }
      } else {
        cacheHitCount++;
      }

      if (oeData) {
        if (/#shorts|#Shorts|#쇼츠/i.test(oeData.title || '')) {
          isShorts = true;
        }

        // 쇼츠 여부 2차 검사: 유튜브 /shorts/ 엔드포인트 HEAD 리다이렉트 판별 (캐시 지원)
        if (!isShorts) {
          if (typeof oeData.isShorts === 'boolean') {
            isShorts = oeData.isShorts;
          } else {
            try {
              const shortRes = await fetch(`https://www.youtube.com/shorts/${vid}`, { method: 'HEAD', redirect: 'manual' });
              isShorts = (shortRes.status === 200);
            } catch (e) { }
            oeData.isShorts = isShorts;
          }
        }

        if (isShorts) {
          item._isShorts = true;
          return;
        }

        const authorName = (oeData.author_name || '').trim();
        const authorUrl = oeData.author_url || '';

        // 공식 채널 직접 업로드 여부 판별 (재생목록 수록 타채널 영상 제외)
        const isDirectRescene = authorName === 'RESCENE' || /youtube\.com\/@rescene_official/i.test(authorUrl);
        const isDirectWoni = authorName.includes('원이') || /helloiamwoni|UCWpY0eSJtyO-qNAPbKFRSSg/i.test(authorUrl);

        if (isDirectRescene || isDirectWoni) {
          // [공식 채널 영상 중 유튜브 롱폼]
          const officialChannelName = isDirectWoni ? '안녕하세요원이입니다잘부탁드립니다' : 'RESCENE';
          item.title = oeData.title || item.title;
          item.thumbnail = oeData.thumbnail_url || `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
          item.url = `https://www.youtube.com/watch?v=${vid}`;
          item.link = item.url;
          item.channel = officialChannelName;
          item.extField = { key: '채널', value: officialChannelName };
          item.typeText = "영상";
          item.typeId = 1;
          item.message = ""; // 블립 안내문구 제거
          item.isOfficialYoutube = true;
          return;
        }

        // [타 채널 영상 (수원시, 방송사, 웹예능 등 외부 출연 영상)]
        // 공식 재생목록(Archive)에 등록되었더라도 원 채널명(authorName)을 채널명으로 온전히 보존
        if (!item.thumbnail || item.thumbnail.includes('rescene-logo')) {
          item.thumbnail = oeData.thumbnail_url || `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
        }
        if (!item.url) item.url = `https://www.youtube.com/watch?v=${vid}`;
        if (!item.link) item.link = item.url;

        // 원 채널명 보존
        const effectiveChannel = authorName || item.channel || (item.extField?.value);
        if (effectiveChannel) {
          item.channel = effectiveChannel;
          item.extField = { key: '채널', value: effectiveChannel };
        }

        const isTvShow = isTvMainBroadcast(item, effectiveChannel);
        if (!isTvShow && oeData.title) {
          item.title = oeData.title;
        }

        if (!isTvShow) {
          item.typeText = "영상";
        }

        item.isOfficialYoutube = false;
      } else if (isShorts) {
        item._isShorts = true;
      }
    }));
  }

  saveOembedCache(oembedCache);
  console.log(`  🔍 [Schedule oEmbed] 총 ${targetItems.length}건 보강 (캐시 적중: ${cacheHitCount}건, 신규 조회: ${newFetchCount}건)`);
}

// 순수 텍스트 정규화
function cleanScheduleText(text) {
  if (!text) return "";
  return text
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]/gu, '')
    .replace(/[<>[\]{}()_!?,.~`'"•\-/]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTitle(title) {
  let clean = cleanScheduleText(title);
  const synonyms = {
    'show champion': '쇼챔피언',
    'm countdown': '엠카운트다운',
    'music bank': '뮤직뱅크',
    'inkigayo': '인기가요',
    'the show': '더쇼',
    'music core': '음악중심',
    'kcon': '케이콘',
    'k world dream awards': '케이월드드림어워즈',
    'k-world dream awards': '케이월드드림어워즈',
    'kwda': '케이월드드림어워즈',
    'dream concert': '드림콘서트'
  };

  for (let [en, ko] of Object.entries(synonyms)) {
    if (clean.includes(en)) {
      clean = clean.replace(new RegExp(en, 'g'), ko);
    }
  }

  return clean.replace(/\s+/g, '');
}

// 스케줄 중복 판별
function areSchedulesDuplicate(item1, item2) {
  const extractYtId = (item) => {
    const text = [item.url, item.link, item.message, item.title].filter(Boolean).join(' ');
    const match = text.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
    return match ? match[1] : null;
  };

  const ytId1 = extractYtId(item1);
  const ytId2 = extractYtId(item2);
  if (ytId1 && ytId2) {
    return ytId1 === ytId2;
  }

  const t1 = item1.title || "";
  const t2 = item2.title || "";
  const norm1 = normalizeTitle(t1);
  const norm2 = normalizeTitle(t2);

  if (norm1 && norm2) {
    if (norm1 === norm2) return true;
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      if (Math.min(norm1.length, norm2.length) >= 4) return true;
    }
  }

  return false;
}

function pickBestTitle(title1, title2) {
  if (!title1) return title2 || "";
  if (!title2) return title1 || "";
  if (title1.includes('(') && !title2.includes('(')) return title1;
  if (title2.includes('(') && !title1.includes('(')) return title2;
  return title1.length >= title2.length ? title1 : title2;
}

// 단일 월 Mnet & Blip 병렬 수집
async function fetchMonthRawSchedules(year, month) {
  const paddedMonth = String(month).padStart(2, '0');

  // [A] Mnet Plus 수집
  const fetchMnet = async () => {
    try {
      const lastDay = new Date(year, month, 0).getDate();
      const mnetUrl = `https://artist.mnetplus.world/svc/stg/rescene-official/space/api/v1/calendar?endAt=${year}-${paddedMonth}-${lastDay}T23:59:59Z&endAtForAllDay=${year}-${paddedMonth}-${lastDay}&startAt=${year}-${paddedMonth}-01T00:00:00Z&startAtForAllDay=${year}-${paddedMonth}-01`;
      const res = await fetch(mnetUrl, {
        headers: {
          'accept': '*/*',
          'x-bmf-country': 'KR',
          'x-bmf-currency': 'KRW',
          'x-bmf-language': 'ko',
          'x-bmf-shop-id': '33'
        }
      });
      if (res.ok) {
        const json = await res.json();
        saveRawCache('mnet', `${year}_${paddedMonth}`, json);
        if (json && Array.isArray(json.events)) {
          return json.events.map(ev => {
            const loc = ev.location || ev.place || ev.venue || ev.locationName || ev.address || null;
            const isAllDay = ev.allDay || Boolean(ev.startAtAllDay);
            let labelName = ev.label ? ev.label.name : null;
            if (labelName === '방송') {
              const combinedText = `${ev.title || ''} ${ev.description || ''}`;
              if (/라디오|파워fm|fm4u|sbs 파워|정오의 희망곡|가요광장|영스트리트|친한친구|별이 빛나는 밤에|두시탈출|컬투쇼|아이돌 라디오|러브게임/i.test(combinedText)) {
                labelName = '라디오';
              }
            } else if (labelName === '공연') {
              const combinedText = `${ev.title || ''} ${ev.description || ''}`;
              if (/팬사인회|팬사인|팬싸|영통|대면\s*사인|fansign/i.test(combinedText)) {
                labelName = '팬사인회';
              }
            }

            const attendees = Array.isArray(ev.starAttendees) ? ev.starAttendees.map(a => ({
              id: a.id,
              nickname: a.nickname,
              avatarImgPath: a.avatarImgPath,
              type: a.type
            })) : [];

            return {
              id: generateScheduleId('mnet', ev),
              title: ev.title ? ev.title.trim() : "",
              startTime: ev.startAt || (ev.startAtAllDay ? `${ev.startAtAllDay}T00:00:00Z` : ""),
              endTime: ev.endAt || (ev.endAtForAllDay ? `${ev.endAtForAllDay}T23:59:59Z` : (ev.startAt || (ev.startAtAllDay ? `${ev.startAtAllDay}T00:00:00Z` : ""))),
              isAllday: isAllDay,
              message: `[${labelName || '일정'}] ${ev.title}`,
              typeText: labelName,
              typeId: labelName === '방송' ? 1 : (labelName === '공연' ? 5 : (labelName === '기념일' ? 3 : (labelName === '행사' ? 5 : null))),
              location: loc,
              channel: null,
              source: 'mnet',
              starAttendees: attendees,
              extField: loc ? { key: '장소', value: loc } : null
            };
          });
        }
      }
    } catch (e) { }
    return [];
  };

  // [B] Blip 수집
  const fetchBlip = async () => {
    try {
      const blipUrl = `https://blip.kr/old-api/homepage/schedules?year=${year}&month=${month}&types=1&types=2&types=3&types=4&types=5&types=6&types=7&unitId=133`;
      const res = await fetch(blipUrl, {
        headers: {
          'accept': 'application/json',
          'x-blip-agent': 'BLIP WEB',
          'x-blip-device-lang': 'ko',
          'x-blip-s2s-api-key': 'c95b9a274f67c09a47638bf92632cea9'
        }
      });
      if (res.ok) {
        const json = await res.json();
        saveRawCache('blip', `${year}_${paddedMonth}`, json);
        const data = Array.isArray(json) ? json : (json.data || []);
        return data.map(item => {
          const ext = item.extField || null;
          let loc = item.location || item.place || item.venue || null;
          let ch = item.channel || null;
          if (ext && ext.key && ext.value) {
            if (ext.key === '장소') loc = loc || ext.value.trim();
            if (ext.key === '채널' || ext.key === '방송사') ch = ch || ext.value.trim();
          }
          const members = Array.isArray(item.members) ? item.members.map(m => ({
            id: m.memberId || m.id,
            nickname: m.name || m.nickname,
            avatarImgPath: m.profileImg || m.avatarImgPath || ''
          })) : [];

          // 블립 원본 분류(typeId 및 내용) 기반 typeText 보강
          let resolvedTypeText = item.typeText || null;
          if (!resolvedTypeText && item.typeId) {
            const combinedText = `${item.title || ''} ${item.message || ''} ${ch || ''}`;
            if (item.typeId === 1) {
              resolvedTypeText = /라디오|파워fm|fm4u|sbs 파워|정오의 희망곡|가요광장|영스트리트|친한친구|별이 빛나는 밤에|두시탈출|컬투쇼|아이돌 라디오|러브게임/i.test(combinedText) ? '라디오' : '방송';
            } else if (item.typeId === 2) {
              resolvedTypeText = '릴리즈';
            } else if (item.typeId === 3) {
              resolvedTypeText = '공지';
            } else if (item.typeId === 4) {
              resolvedTypeText = '기념일';
            } else if (item.typeId === 5) {
              resolvedTypeText = /팬사인회|팬사인|팬싸|영통|대면\s*사인|fansign/i.test(combinedText) ? '팬사인회' : (/콘서트|concert|쇼케이스|showcase|공연/i.test(combinedText) ? '공연' : '행사');
            } else if (item.typeId === 6) {
              resolvedTypeText = /화보|nylon/i.test(combinedText) ? '화보' : '행사';
            } else if (item.typeId === 8) {
              resolvedTypeText = '공지';
            } else {
              resolvedTypeText = '기타';
            }
          }

          return {
            id: generateScheduleId('blip', item),
            title: item.title ? item.title.trim() : "",
            startTime: item.startTime,
            endTime: item.endTime || item.startTime,
            isAllday: Boolean(item.isAllday),
            message: item.message || "",
            typeId: item.typeId || null,
            typeText: resolvedTypeText,
            location: loc,
            channel: ch,
            source: 'blip',
            starAttendees: members,
            extField: ext
          };
        });
      }
    } catch (e) { }
    return [];
  };

  const [mnetList, blipList] = await Promise.all([fetchMnet(), fetchBlip()]);
  return [...mnetList, ...blipList];
}

// 전체 스케줄 수집 & 병합 진입점
export async function collectScheduleData(allYtVideos = []) {
  const isFull = process.argv.includes('--full');
  console.log(`▶ [Schedule] 데이터 수집 시작 (Blip & Mnet Plus) [모드: ${isFull ? '전체 수집 (--full)' : '최근 5개월 패스트트랙'}]...`);

  const now = new Date();
  const monthsToFetch = getMonthsToFetch(now, isFull);
  console.log(`  📅 수집 대상 월: ${monthsToFetch.map(m => `${m.year}.${m.month}`).join(', ')}`);

  // 델타 병합을 위한 기존 마스터 일정 로드 (패스트트랙 시 비수집 기간 보존)
  const MASTER_SCHEDULES_FILE = path.resolve(__dirname, '../../../docs/api/v1/schedules.json');
  let archivedItems = [];
  if (!isFull && fs.existsSync(MASTER_SCHEDULES_FILE)) {
    try {
      const masterData = JSON.parse(fs.readFileSync(MASTER_SCHEDULES_FILE, 'utf8'));
      if (Array.isArray(masterData.items)) {
        const activeMonthKeys = new Set(monthsToFetch.map(m => `${m.year}-${String(m.month).padStart(2, '0')}`));
        archivedItems = masterData.items.filter(item => {
          if (!item.startTime) return false;
          const d = parseSafeDate(item.startTime);
          const kstD = new Date(d.getTime() + 9 * 60 * 60 * 1000);
          const key = `${kstD.getUTCFullYear()}-${String(kstD.getUTCMonth() + 1).padStart(2, '0')}`;
          return !activeMonthKeys.has(key);
        });
        console.log(`  💾 [Delta Cache] 비수집 기간 과거/미래 마스터 일정 ${archivedItems.length}건 보존`);
      }
    } catch (e) {
      console.warn(`  ⚠️ 기존 마스터 파일 로드 실패: ${e.message}`);
    }
  }

  // 6개월 단위 청크로 병렬 수집
  const CHUNK_SIZE = 6;
  const allRaw = [];

  for (let i = 0; i < monthsToFetch.length; i += CHUNK_SIZE) {
    const chunk = monthsToFetch.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(
      chunk.map(({ year, month }) => fetchMonthRawSchedules(year, month))
    );
    allRaw.push(...chunkResults.flat());
  }

  // 1:1 무손실 수집 (수집 시점 강제 오병합 제거, 고유 ID 기준 보존)
  const idMap = new Map();
  const combinedRaw = [...archivedItems, ...allRaw];

  combinedRaw.forEach(newItem => {
    if (!newItem.title || !newItem.startTime) return;
    const id = newItem.id || generateScheduleId(newItem.source, newItem);
    idMap.set(id, { ...newItem, id });
  });

  const rawList = Array.from(idMap.values());

  // YouTube oEmbed 사전 일괄 보강 수행!
  await enrichSchedulesWithYouTubeOEmbed(rawList, allYtVideos);

  // [oEmbed 이후 2차 쇼츠 URL 체크] oEmbed 보강 후 확정된 URL 기반으로 누락 Shorts 추가 감지
  rawList.forEach(item => {
    if (!item._isShorts && item.url && /youtube\.com\/shorts\//i.test(item.url)) {
      item._isShorts = true;
    }
  });

  // [수동 보정 및 클러스터링 합성 규칙 적용] Gist의 schedule-overrides.json (수정/삭제/추가 및 YouTube 합성) 최우선 반영!
  const overriddenList = await applyScheduleOverrides(rawList);

  // 날짜 순 정렬
  overriddenList.sort((a, b) => parseSafeDate(a.startTime).getTime() - parseSafeDate(b.startTime).getTime());

  // [초강력 데이터 다이어트 & starAttendees 복원]
  const slimmedList = overriddenList.map(item => slimScheduleItem(item)).filter(Boolean);

  console.log(`✓ [Schedule] 완료: 총 수집/아카이브 ${rawList.length}건 중 ${slimmedList.length}건 유효 슬림화 완료`);

  return {
    totalCount: slimmedList.length,
    items: slimmedList
  };
}

export { DEFAULT_EXCLUDE_KEYWORDS };

export function isShortsSchedule(item) {
  if (!item) return false;
  if (item._isShorts) return true;
  const raw = [item.url, item.link, item.title, item.message].filter(Boolean).join(' ');
  if (/youtube\.com\/shorts\//i.test(raw) || /#shorts\b|#쇼츠\b/i.test(raw)) return true;
  if (/(?:vt\.tiktok\.com\/|tiktok\.com\/@[^/]+\/video\/\d+)/i.test(raw)) return true;
  if (/instagram\.com\/reels?\/[\w-]+/i.test(raw)) return true;
  return false;
}

// [Gist 보정 규칙 v2.0] 사용자가 Ops 포털에서 수정한 오버라이드(수정/삭제/추가) 규칙 적용
export function mergeSchedulesV2(rawItems, overridesV2) {
  const {
    filterRules = {},
    customSchedules = {},
    sourceOverrides = {},
    legacyAliases = {}
  } = (overridesV2 || {});

  // 필터 규칙 설정
  const filterEnabled = filterRules.enabled !== false;
  const excludeShorts = filterRules.excludeShorts !== false; // 기본값 true
  const excludeTypes = Array.isArray(filterRules.excludeTypes) ? filterRules.excludeTypes : [];
  const excludeChannels = Array.isArray(filterRules.excludeChannels) ? filterRules.excludeChannels : [];
  const excludeKeywords = Array.isArray(filterRules.excludeKeywords)
    ? filterRules.excludeKeywords
    : DEFAULT_EXCLUDE_KEYWORDS;

  const matchFilter = (item) => {
    if (!filterEnabled || excludeKeywords.length === 0) return false;
    const text = [item.title, item.message, item.url, item.link].filter(Boolean).join(' ').toLowerCase();
    return excludeKeywords.some(kw => {
      const cleanKw = kw.trim().toLowerCase();
      if (!cleanKw) return false;
      return text.includes(cleanKw);
    });
  };

  // (A) 원본 아이템에 ID 부여 및 소스 오버라이드 맵 준비
  const itemMap = new Map();
  rawItems.forEach(raw => {
    const id = generateScheduleId(raw.source, raw);
    const item = { ...raw, id };
    itemMap.set(id, item);
  });

  // (B) 커스텀 일정들을 itemMap에 등록
  Object.entries(customSchedules).forEach(([cId, cData]) => {
    const item = {
      ...cData,
      id: cId,
      _isCustom: true,
      source: cData.source || 'custom'
    };
    itemMap.set(cId, item);
  });

  // (C) 소스 오버라이드(수정 및 개별 삭제) 적용 (legacyAliases 구버전 키 호환)
  const resolvedOverrides = {};
  Object.entries(sourceOverrides).forEach(([k, v]) => {
    const realId = legacyAliases[k] || k;
    resolvedOverrides[realId] = { ...resolvedOverrides[realId], ...v };
  });

  let delCount = 0;
  let modCount = 0;
  let filterCount = 0;

  // (D) 개별 삭제 및 필터 규칙 적용 (100% 독립 동작)
  const activeItems = [];
  itemMap.forEach(item => {
    const ov = resolvedOverrides[item.id];
    if (ov && ov.isDeleted) {
      delCount++;
      return;
    }
    if (item.isDeleted) {
      delCount++;
      return;
    }

    // 쇼츠 제외 (커스텀 일정은 보호 대상 제외)
    if (excludeShorts && !item._isCustom && (item._isShorts || isShortsSchedule(item))) {
      filterCount++;
      return;
    }

    // 관리자가 직접 작성한 커스텀 일정이거나 명시적 오버라이드가 있는 항목은 필터링에서 보호
    const isProtected = item._isCustom || Boolean(ov && Object.keys(ov).length > 0);

    // 종류(typeText)별 제외
    if (!isProtected && excludeTypes.length > 0 && item.typeText && excludeTypes.includes(item.typeText)) {
      filterCount++;
      return;
    }

    // 채널(channel / extField)별 제외
    if (!isProtected && excludeChannels.length > 0) {
      const channelValues = [
        item.channel,
        (item.extField && (item.extField.key === '채널' || item.extField.key === '방송사') ? item.extField.value : null)
      ].filter(Boolean).map(s => s.trim().toLowerCase());

      const isChannelExcluded = excludeChannels.some(ex => {
        const cleanEx = ex.trim().toLowerCase();
        if (!cleanEx) return false;
        return channelValues.some(c => c === cleanEx || c.includes(cleanEx));
      });

      if (isChannelExcluded) {
        filterCount++;
        return;
      }
    }

    if (!isProtected && matchFilter(item)) {
      filterCount++;
      return;
    }

    // 수정 필드 적용 (수정된 것만 덮어쓰고 원본은 보존)
    if (ov) {
      const merged = { ...item };
      ['title', 'startTime', 'endTime', 'isAllday', 'url', 'location', 'typeText', 'message', 'channel', 'thumbnail', 'isOfficialYoutube'].forEach(f => {
        if (ov[f] !== undefined) merged[f] = ov[f];
      });
      if (ov.linkedScheduleIds) {
        merged.linkedScheduleIds = Array.from(new Set([...(merged.linkedScheduleIds || []), ...ov.linkedScheduleIds]));
      }
      activeItems.push(merged);
      modCount++;
    } else {
      activeItems.push(item);
    }
  });

  if (filterCount > 0) {
    console.log(`  ✂️ [Filter Rules] 제외 필터 규칙에 의해 ${filterCount}건 자동 제외 완료 (투표/직캠/이벤트 등)`);
  }

  // (E) 연관 일정 상호 합성 (linkedScheduleIds 및 동일 YouTube Video ID 기준 양방향 클러스터링)
  const adj = new Map();
  activeItems.forEach(item => {
    if (!adj.has(item.id)) adj.set(item.id, new Set());
    const linked = item.linkedScheduleIds || [];
    linked.forEach(targetId => {
      adj.get(item.id).add(targetId);
      if (!adj.has(targetId)) adj.set(targetId, new Set());
      adj.get(targetId).add(item.id);
    });
  });

  // 동일 YouTube Video ID 자동 인접 엣지 추가 (동일 영상 일정 100% 자동 클러스터링)
  const ytVideoMap = new Map();
  activeItems.forEach(item => {
    const vid = extractYouTubeVideoId(item.url || item.link);
    if (vid) {
      if (!ytVideoMap.has(vid)) ytVideoMap.set(vid, []);
      ytVideoMap.get(vid).push(item.id);
    }
  });

  ytVideoMap.forEach(ids => {
    if (ids.length > 1) {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          adj.get(ids[i]).add(ids[j]);
          adj.get(ids[j]).add(ids[i]);
        }
      }
    }
  });

  const finalResults = [];
  const visited = new Set();

  activeItems.forEach(item => {
    if (visited.has(item.id)) return;

    // BFS 클러스터 탐색
    const cluster = [];
    const queue = [item.id];
    visited.add(item.id);

    while (queue.length > 0) {
      const curId = queue.shift();
      const curItem = activeItems.find(x => x.id === curId);
      if (curItem) cluster.push(curItem);

      const neighbors = adj.get(curId) || new Set();
      neighbors.forEach(nId => {
        if (!visited.has(nId)) {
          visited.add(nId);
          queue.push(nId);
        }
      });
    }

    if (cluster.length === 1) {
      finalResults.push(cluster[0]);
      return;
    }

    // 대표 선출 규칙: 커스텀(수동) 일정 우선 > 공식 소스
    let primary = cluster.find(c => c._isCustom) || cluster[0];
    const secondaries = cluster.filter(c => c.id !== primary.id);

    // 필드별 합성: 대표가 빈 필드는 서브 공식 정보에서 채우고, 공식 메타데이터(멤버 등) 흡수
    const synthetic = { ...primary };

    secondaries.forEach(sec => {
      if (!synthetic.url && sec.url) synthetic.url = sec.url;
      if (!synthetic.location && sec.location) synthetic.location = sec.location;
      if (!synthetic.channel && sec.channel) synthetic.channel = sec.channel;
      if (!synthetic.message && sec.message) synthetic.message = sec.message;
      if (!synthetic.typeText && sec.typeText) synthetic.typeText = sec.typeText;
      if (sec.starAttendees && sec.starAttendees.length > 0) {
        if (!synthetic.starAttendees || synthetic.starAttendees.length === 0) {
          synthetic.starAttendees = [...sec.starAttendees];
        } else {
          const existNames = new Set(synthetic.starAttendees.map(a => a.name));
          const newOnes = sec.starAttendees.filter(a => a.name && !existNames.has(a.name));
          synthetic.starAttendees = [...synthetic.starAttendees, ...newOnes];
        }
      }
      if (!synthetic.extField && sec.extField) synthetic.extField = sec.extField;
    });

    // 상호 등록: 연결된 모든 ID를 linkedScheduleIds에 상호 반영
    synthetic.linkedScheduleIds = Array.from(new Set(cluster.flatMap(c => [c.id, ...(c.linkedScheduleIds || [])])));
    finalResults.push(synthetic);
  });

  const addCount = Object.keys(customSchedules).length;
  if (modCount > 0 || delCount > 0 || addCount > 0) {
    console.log(`  🛠️ [Schedule Overrides v2.0] 수동 보정 적용: 수정 ${modCount}건, 삭제 ${delCount}건, 신규 ${addCount}건`);
  }

  return finalResults;
}

// v1.0 레거시 데이터 ➡️ v2.0 스키마 변환기
export function migrateOverridesV1toV2(v1Data, sampleRawItems = []) {
  const v2 = {
    version: "2.0.0",
    updatedAt: v1Data.updatedAt || new Date().toISOString(),
    customSchedules: {},
    sourceOverrides: {},
    legacyAliases: {}
  };

  const createdList = v1Data.created || [];
  const modifiedMap = v1Data.modified || {};
  const deletedList = v1Data.deleted || [];

  // 1) created 항목 마이그레이션
  createdList.forEach(c => {
    const rawKey = `${(c.startTime || '').slice(0, 10)}_${c.title}`;
    const id = generateScheduleId('custom', c);

    const mod = modifiedMap[rawKey] || modifiedMap[c.title] || {};
    const merged = {
      ...c,
      ...mod,
      id,
      _isCustom: true,
      source: c.source || 'custom'
    };

    v2.customSchedules[id] = merged;
    v2.legacyAliases[rawKey] = id;
    if (c._originKey) v2.legacyAliases[c._originKey] = id;
  });

  // 2) deleted 항목 마이그레이션
  deletedList.forEach(delKey => {
    const matchedRaw = sampleRawItems.find(r => {
      const rKey = `${(r.startTime || '').slice(0, 10)}_${r.title}`;
      return rKey === delKey || r.title === delKey;
    });

    const targetId = matchedRaw ? matchedRaw.id : `del_${crypto.createHash('sha256').update(delKey).digest('hex').slice(0, 8)}`;
    v2.sourceOverrides[targetId] = {
      ...v2.sourceOverrides[targetId],
      id: targetId,
      isDeleted: true
    };
    v2.legacyAliases[delKey] = targetId;
  });

  // 3) modified 중 created에 속하지 않은 원본 오버라이드 마이그레이션
  Object.entries(modifiedMap).forEach(([mKey, mVal]) => {
    if (v2.legacyAliases[mKey]) return; // 이미 custom에 매핑됨

    const matchedRaw = sampleRawItems.find(r => {
      const rKey = `${(r.startTime || '').slice(0, 10)}_${r.title}`;
      return rKey === mKey || r.title === mVal.title;
    });

    const targetId = matchedRaw ? matchedRaw.id : `mod_${crypto.createHash('sha256').update(mKey).digest('hex').slice(0, 8)}`;
    v2.sourceOverrides[targetId] = {
      ...v2.sourceOverrides[targetId],
      ...mVal,
      id: targetId
    };
    v2.legacyAliases[mKey] = targetId;
  });

  return v2;
}

// [Gist 보정 규칙] 최신 오버라이드 데이터 로드 및 v2.0 적용
async function applyScheduleOverrides(scheduleList) {
  let overridesData = null;

  // 1. 로컬 캐시 확인
  let localData = null;
  if (fs.existsSync(OVERRIDES_CACHE_FILE)) {
    try {
      localData = JSON.parse(fs.readFileSync(OVERRIDES_CACHE_FILE, 'utf8'));
    } catch (e) { }
  }

  // 2. Gist에서 최신 schedule-overrides.json 로드 시도
  try {
    const res = await fetch(`https://gist.githubusercontent.com/duckbeginner/${GIST_ID}/raw/schedule-overrides.json?t=${Date.now()}`);
    if (res.ok) {
      const gistData = await res.json();
      const gistTime = gistData && gistData.updatedAt ? new Date(gistData.updatedAt).getTime() : 0;
      const localTime = localData && localData.updatedAt ? new Date(localData.updatedAt).getTime() : 0;

      if (!localData || gistTime >= localTime) {
        overridesData = gistData;
        try {
          ensureCacheDir();
          fs.writeFileSync(OVERRIDES_CACHE_FILE, JSON.stringify(overridesData), 'utf8');
        } catch (e) { }
      } else {
        overridesData = localData;
      }
    }
  } catch (err) { }

  if (!overridesData) {
    overridesData = localData;
  }

  if (!overridesData || typeof overridesData !== 'object') {
    return scheduleList;
  }

  // v1.0 레거시 데이터인 경우 v2.0 구조로 실시간 마이그레이션 호환 처리
  let overridesV2 = overridesData;
  if (overridesData.version !== "2.0.0") {
    overridesV2 = migrateOverridesV1toV2(overridesData, scheduleList);
  }

  return mergeSchedulesV2(scheduleList, overridesV2);
}
