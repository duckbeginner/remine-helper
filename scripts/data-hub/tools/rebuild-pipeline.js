// scripts/data-hub/tools/rebuild-pipeline.js
// 원본 소스 캐시 · Canonical Key 마스터 · 순수 Diff 오버라이드 전면 재구축 독립 도구

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CACHE_CONFIG } from '../config.js';
import {
  generateCanonicalScheduleId,
  slimScheduleItem,
  mergeSchedulesV2
} from '../collectors/schedule.js';
import { cleanUrl, cleanTextUrls } from '../utils/url-cleaner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../');

const LIVE_MASTER_PATH = path.join(ROOT_DIR, 'docs/api/v1/master-schedules.json');
const LIVE_SCHEDULES_PATH = path.join(ROOT_DIR, 'docs/api/v1/schedules.json');
const DEFAULT_OVERRIDES_CACHE = path.join(CACHE_CONFIG.cacheDir, 'schedule-overrides.json');
const DEFAULT_OUTPUT_DIR = CACHE_CONFIG.rebuildDir || path.join(CACHE_CONFIG.cacheDir, 'rebuild');
const RAW_CACHE_DIR = CACHE_CONFIG.rawCacheDir || path.join(CACHE_CONFIG.cacheDir, 'raw');
const SEEDS_DIR = path.resolve(ROOT_DIR, 'scripts/data-hub/seeds');

// 미디어 ID 파서 (YouTube, Instagram, X/Twitter URL -> 표준 미디어 ID)
export function parseMediaId(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // 이미 ID 형태인 경우: yt:xxx, ig:xxx, x:xxx
  if (/^yt:[\w-]{11}(?:\?t=[\w-]+)?$/i.test(trimmed)) {
    return trimmed;
  }
  if (/^ig:[\w-]{5,}$/i.test(trimmed)) {
    return trimmed;
  }
  if (/^x:\d+$/i.test(trimmed)) {
    return trimmed;
  }

  // 1. YouTube (영상, 쇼츠, 라이브, 타임스탬프)
  const ytMatch = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^&]+&)*v=|shorts\/|live\/))([\w-]{11})/i);
  if (ytMatch) {
    const videoId = ytMatch[1];
    const timeMatch = trimmed.match(/[?&](?:t|start)=([0-9a-zA-Z]+)/i);
    let timeParam = '';
    if (timeMatch) {
      timeParam = `?t=${timeMatch[1]}`;
    }
    return `yt:${videoId}${timeParam}`;
  }

  // 2. Instagram (포스트, 릴스 단일 콘텐츠만 추출, 계정 프로필은 일반 Full URL 보존을 위해 null 반환)
  const igMatch = trimmed.match(/instagram\.com\/(?:p|reel|reels)\/([\w-]+)/i);
  if (igMatch) {
    return `ig:${igMatch[1]}`;
  }

  // 3. X / Twitter (트윗 상태 ID만 추출, 계정 프로필은 일반 Full URL 보존을 위해 null 반환)
  const xMatch = trimmed.match(/(?:twitter\.com|x\.com)\/(?:[^/]+\/)?status\/(\d+)/i);
  if (xMatch) {
    return `x:${xMatch[1]}`;
  }

  return null;
}

// 복수 미디어 ID 파서 (단일 또는 복수 URL -> 중복 없는 미디어 ID 배열)
export function parseMediaIds(urlOrArray) {
  if (!urlOrArray) return [];
  const list = Array.isArray(urlOrArray) ? urlOrArray : [urlOrArray];
  const results = [];
  for (const item of list) {
    if (!item) continue;
    const mId = parseMediaId(item);
    if (mId && !results.includes(mId)) {
      results.push(mId);
    }
  }
  return results;
}

// 미디어 ID -> Canonical Full URL 복원
export function formatMediaUrl(mediaIdOrUrl) {
  if (!mediaIdOrUrl || typeof mediaIdOrUrl !== 'string') return mediaIdOrUrl;
  const trimmed = mediaIdOrUrl.trim();

  // 1. YouTube: yt:VIDEO_ID(?t=...)
  if (trimmed.startsWith('yt:')) {
    const raw = trimmed.slice(3);
    const [videoId, query] = raw.split('?');
    let url = `https://www.youtube.com/watch?v=${videoId}`;
    if (query) {
      const match = query.match(/^t=([\w-]+)/);
      if (match) {
        url += `&t=${match[1]}`;
      }
    }
    return url;
  }

  // 2. Instagram: ig:SHORTCODE
  if (trimmed.startsWith('ig:')) {
    const code = trimmed.slice(3);
    return `https://www.instagram.com/p/${code}/`;
  }

  // 3. X / Twitter: x:TWEET_ID
  if (trimmed.startsWith('x:')) {
    const tweetId = trimmed.slice(2);
    return `https://x.com/i/status/${tweetId}`;
  }

  return trimmed;
}

// 일정 객체 정제 유틸 (URL 정제, 메시지 링크 정제, custom_ extField 완전 배제, 유튜브 중복 thumbnail 배제)
export function sanitizeScheduleItem(item) {
  if (!item) return item;
  const clean = { ...item };

  // 1. URL 정제
  if (clean.url) {
    clean.url = cleanUrl(clean.url);
    if (!clean.url) delete clean.url;
  }

  // 2. Message 본문 속 URL 정제
  if (clean.message) {
    clean.message = cleanTextUrls(clean.message).trim();
    if (!clean.message) delete clean.message;
  }

  // 3. custom_ 일정: extField 완전 삭제
  if (clean.id && String(clean.id).startsWith('custom_')) {
    delete clean.extField;
  }

  // 4. 유튜브 일정 중복 thumbnail 필드 생략 (클라이언트에서 videoId 기반 동적 생성 표준화)
  const isYoutube = clean.source === 'youtube' || (clean.url && (clean.url.includes('youtube.com') || clean.url.includes('youtu.be')));
  if (isYoutube && clean.thumbnail && clean.thumbnail.includes('i.ytimg.com')) {
    delete clean.thumbnail;
  }

  return clean;
}

// 제목 정규화 헬퍼 (공백 및 특수문자 전처리)
export function normalizeTitle(title) {
  if (!title) return '';
  return String(title)
    .replace(/^\[[^\]]+\]\s*/, '') // [방송], [행사] 등 대괄호 태그 제거
    .replace(/[<>[\]()]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

// ISO 8601 시각 문자열을 초/밀리초가 없는 100% 표준 UTC Z (YYYY-MM-DDTHH:mmZ)로 통일
export function formatMinuteIso(isoString) {
  if (!isoString || typeof isoString !== 'string') return isoString || '';
  const trimmed = isoString.trim();
  if (!trimmed) return '';

  // 날짜 단독 (YYYY-MM-DD)인 경우 날짜 문자열 보존
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // 1. 이미 초 없는 UTC Z 형식 (YYYY-MM-DDTHH:mmZ)이면 즉시 반환
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  // 2. 모든 오프셋(+09:00, -07:00 등), 초(:ss), 밀리초(.sss)를 Date 객체를 통해 100% 표준 UTC Z로 일원화 변환
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) {
    return trimmed;
  }

  return `${d.toISOString().slice(0, 16)}Z`;
}

// ISO 8601 시각 문자열을 레거시 v1 하위 호환을 위해 초 단위(:00Z) 표준 UTC Z로 통일
export function formatSecondsIso(isoString) {
  if (!isoString || typeof isoString !== 'string') return isoString || '';
  const trimmed = isoString.trim();
  if (!trimmed) return '';

  // 날짜 단독 (YYYY-MM-DD)인 경우
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00Z`;
  }

  // 이미 초(:00Z 등)가 있는 UTC Z 형식이면 반환
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  const d = new Date(trimmed);
  if (isNaN(d.getTime())) {
    return trimmed;
  }

  return `${d.toISOString().slice(0, 19)}Z`;
}

// 시각 값 동등성 정밀 비교 헬퍼 (1. 분 단위 표준화 절대 타임스탬프 일치, 2. 종일 일정 또는 자정(00:00) 날짜 일치)
export function isTimeValueEqual(editVal, baseVal, isAllday = false) {
  if (!editVal && !baseVal) return true;
  if (!editVal || !baseVal) return false;

  const fEdit = formatMinuteIso(editVal);
  const fBase = formatMinuteIso(baseVal);

  // 1단계: 분 단위 표준화 후 절대 타임스탬프 일치 (초/밀리초 차이 무효화)
  const tEdit = new Date(fEdit).getTime();
  const tBase = new Date(fBase).getTime();
  if (!isNaN(tEdit) && !isNaN(tBase) && tEdit === tBase) {
    return true;
  }

  // 2단계: 종일 일정 또는 자정(00:00) / 월클락(slice(0, 16)) 동일 시각 일치 (Mnet T00:00:00Z vs Gist T00:00:00+09:00 차이 무효화)
  const origEditYmd = String(editVal).slice(0, 10);
  const origBaseYmd = String(baseVal).slice(0, 10);
  const isOrigZero = String(editVal).includes('T00:00') && String(baseVal).includes('T00:00');
  if (origEditYmd === origBaseYmd && (isAllday || isOrigZero)) {
    return true;
  }

  const clock16Edit = String(fEdit).slice(0, 16);
  const clock16Base = String(fBase).slice(0, 16);
  if (clock16Edit.slice(0, 10) === clock16Base.slice(0, 10)) {
    if (isAllday) {
      return true;
    }
    if (clock16Edit === clock16Base) {
      return true;
    }
    const isEditZero = clock16Edit.endsWith('T00:00') || clock16Edit.length === 10;
    const isBaseZero = clock16Base.endsWith('T00:00') || clock16Base.length === 10;
    if (isEditZero && isBaseZero) {
      return true;
    }
  }

  return false;
}

// 필드 값 동등성 정밀 비교 헬퍼 (빈 값 동등성, 밀리초 타임스탬프 동등성, trim 동등성, linkedScheduleIds 정규화)
export function isFieldValueEqual(field, editVal, baseVal, isAllday = false) {
  // 1. 빈 값 동등 처리 (null, undefined, '', false, 빈 배열은 동일한 '빈 값'으로 간주)
  const isBaseEmpty = baseVal === undefined || baseVal === null || baseVal === '' || baseVal === false || (Array.isArray(baseVal) && baseVal.length === 0);
  const isEditEmpty = editVal === undefined || editVal === null || editVal === '' || editVal === false || (Array.isArray(editVal) && editVal.length === 0);
  if (isBaseEmpty && isEditEmpty) return true;
  if (isBaseEmpty !== isEditEmpty) return false;

  // 2. 시간/날짜 필드: 4단계 시각 정밀 비교
  if (field === 'startTime' || field === 'endTime') {
    return isTimeValueEqual(editVal, baseVal, isAllday);
  }

  // 3. URL 필드: 미디어 ID 및 Full URL 간 동등성 정밀 판정
  if (field === 'url') {
    if (typeof editVal === 'string' && typeof baseVal === 'string') {
      const mEdit = parseMediaId(editVal);
      const mBase = parseMediaId(baseVal);
      if (mEdit && mBase) {
        return mEdit === mBase;
      }
      return cleanUrl(editVal) === cleanUrl(baseVal);
    }
  }

  // 4. 문자열 필드: 양 끝 공백 제거 후 비교
  if (typeof editVal === 'string' && typeof baseVal === 'string') {
    return editVal.trim() === baseVal.trim();
  }

  // 5. 배열 필드: linkedScheduleIds 정규화 및 정렬 비교
  if (Array.isArray(editVal) && Array.isArray(baseVal)) {
    if (field === 'linkedScheduleIds') {
      const normalizeId = id => (typeof id === 'string' && /^[a-f0-9]{24}$/.test(id)) ? `mnet_${id}` : String(id);
      const setEdit = [...new Set(editVal.map(normalizeId))].sort();
      const setBase = [...new Set(baseVal.map(normalizeId))].sort();
      return JSON.stringify(setEdit) === JSON.stringify(setBase);
    }
    return JSON.stringify(editVal) === JSON.stringify(baseVal);
  }

  // 6. 기타 (숫자, 불리언 등)
  return JSON.stringify(editVal) === JSON.stringify(baseVal);
}

// 순수 차이점(Pure Diff) 추출 헬퍼 (마스터와 실제 다른 필드만 추출, No-op 및 중복 필드 완전 배제)
export function computePureDiff(baseItem, editedItem, _options = {}) {
  if (!editedItem) return null;

  // 편집본 필드 정제
  const sanitizedEdit = sanitizeScheduleItem(editedItem);
  const sanitizedBase = baseItem ? sanitizeScheduleItem(baseItem) : null;

  if (sanitizedEdit.isDeleted) {
    // 관리자가 숨김 처리한 삭제 플래그는 { isDeleted: true } 만 단독 보존
    return { isDeleted: true };
  }

  const isAllday = Boolean(sanitizedEdit.isAllday || (sanitizedBase && sanitizedBase.isAllday));

  const diff = {};
  let hasDiff = false;

  const compareFields = [
    'title',
    'startTime',
    'endTime',
    'isAllday',
    'typeId',
    'typeText',
    'channel',
    'location',
    'url',
    'thumbnail',
    'isOfficialYoutube',
    'message'
  ];

  for (const field of compareFields) {
    const editVal = sanitizedEdit[field];
    const baseVal = sanitizedBase ? sanitizedBase[field] : undefined;

    if (editVal === undefined || editVal === null) continue;

    // endTime 특수 처리: 만약 editVal(종료시각)이 edit의 시작시각과 동일하고,
    // 시작시각이 마스터와 동일하다면(즉 시작시각이 diff에 포함되지 않는다면),
    // 종료시각도 별도 지정된 것이 아니므로 diff에 포함하지 않음
    if (field === 'endTime') {
      const editStart = sanitizedEdit.startTime;
      if (editStart && isTimeValueEqual(editVal, editStart, isAllday)) {
        const baseStart = sanitizedBase ? sanitizedBase.startTime : undefined;
        if (isTimeValueEqual(editStart, baseStart, isAllday)) {
          continue;
        }
      }
    }

    // 마스터와 값이 동등하면 diff에 일절 포함하지 않음 (Sparse Patch)
    if (isFieldValueEqual(field, editVal, baseVal, isAllday)) {
      continue;
    }

    // URL 필드: SNS 링크인 경우 오버라이드에는 ID만 압축 저장 (일반 웹사이트는 Full URL 보존)
    if (field === 'url') {
      const mediaId = parseMediaId(editVal);
      diff[field] = mediaId || editVal;
    } else if (field === 'startTime' || field === 'endTime') {
      diff[field] = formatMinuteIso(editVal);
    } else {
      diff[field] = editVal;
    }
    hasDiff = true;
  }

  // starAttendees 비교 및 보존 (마스터와 다를 때만 기록)
  if (Array.isArray(sanitizedEdit.starAttendees)) {
    const baseAttendees = (sanitizedBase && Array.isArray(sanitizedBase.starAttendees)) ? sanitizedBase.starAttendees : [];
    if (!isFieldValueEqual('starAttendees', sanitizedEdit.starAttendees, baseAttendees)) {
      diff.starAttendees = sanitizedEdit.starAttendees;
      hasDiff = true;
    }
  }

  // linkedScheduleIds 보존 (마스터와 다를 때만 기록, 자기 자신 ID 배제)
  if (Array.isArray(sanitizedEdit.linkedScheduleIds) && sanitizedEdit.linkedScheduleIds.length > 0) {
    const canonicalId = (sanitizedBase && sanitizedBase.id) || (sanitizedEdit && sanitizedEdit.id);
    const rawId = canonicalId ? canonicalId.replace(/^(mnet_|blip_|yt_|custom_)/, '') : null;
    const normalizeId = id => (typeof id === 'string' && /^[a-f0-9]{24}$/.test(id)) ? `mnet_${id}` : String(id);

    // 자기 자신 ID 및 중복 제거
    const filteredLinks = sanitizedEdit.linkedScheduleIds
      .map(normalizeId)
      .filter(id => id && id !== canonicalId && id !== rawId);
    const uniqueLinks = Array.from(new Set(filteredLinks));

    const baseLinks = (sanitizedBase && Array.isArray(sanitizedBase.linkedScheduleIds))
      ? sanitizedBase.linkedScheduleIds.map(normalizeId).filter(id => id && id !== canonicalId && id !== rawId)
      : [];

    if (uniqueLinks.length > 0 && !isFieldValueEqual('linkedScheduleIds', uniqueLinks, baseLinks)) {
      diff.linkedScheduleIds = uniqueLinks;
      hasDiff = true;
    }
  }

  return hasDiff ? diff : null;
}

// 공식 수집 원본 캐시 확보 헬퍼 (2024.01 ~ 2027.12)
export async function ensureRawSourceCaches(options = {}) {
  const startYear = options.startYear || 2024;
  const endYear = options.endYear || 2027;
  const rawCacheDir = options.rawCacheDir || RAW_CACHE_DIR;
  if (!fs.existsSync(rawCacheDir)) fs.mkdirSync(rawCacheDir, { recursive: true });

  const months = [];
  for (let y = startYear; y <= endYear; y++) {
    for (let m = 1; m <= 12; m++) {
      months.push({ year: y, month: m });
    }
  }

  const CHUNK_SIZE = 6;
  for (let i = 0; i < months.length; i += CHUNK_SIZE) {
    const chunk = months.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(async ({ year, month }) => {
      const paddedMonth = String(month).padStart(2, '0');
      const ymKey = `${year}_${paddedMonth}`;
      const blipFile = path.join(rawCacheDir, `blip_${ymKey}.json`);
      const mnetFile = path.join(rawCacheDir, `mnet_${ymKey}.json`);

      if (!fs.existsSync(blipFile)) {
        try {
          const blipUrl = `https://blip.kr/old-api/homepage/schedules?year=${year}&month=${month}&types=1&types=2&types=3&types=4&types=5&types=6&types=7&unitId=133`;
          const res = await fetch(blipUrl, {
            headers: {
              'accept': 'application/json',
              'x-blip-agent': 'BLIP WEB',
              'x-blip-device-lang': 'ko',
              'x-blip-s2s-api-key': 'c95b9a274f67c09a47638bf92632cea9'
            },
            signal: AbortSignal.timeout(10000)
          });
          if (res.ok) {
            const json = await res.json();
            fs.writeFileSync(blipFile, JSON.stringify({ hash: '', data: json, cachedAt: Date.now() }), 'utf8');
          }
        } catch (e) {}
      }

      if (!fs.existsSync(mnetFile)) {
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
            },
            signal: AbortSignal.timeout(10000)
          });
          if (res.ok) {
            const json = await res.json();
            fs.writeFileSync(mnetFile, JSON.stringify({ hash: '', data: json, cachedAt: Date.now() }), 'utf8');
          }
        } catch (e) {}
      }
    }));
  }
}

// 순수 원본 마스터(Pure Raw Master) 생성기: .cache/raw/ 의 Blip/Mnet 원본과 YouTube 시드만 사용하여 구축
export function buildPureRawMaster(rawCacheDir, seedsDir) {
  const cacheDir = rawCacheDir || RAW_CACHE_DIR;
  const seedDir = seedsDir || SEEDS_DIR;

  if (!fs.existsSync(cacheDir)) {
    throw new Error(`Raw cache directory not found: ${cacheDir}`);
  }

  const idMap = new Map();
  const rawFiles = fs.readdirSync(cacheDir).filter(f => f.endsWith('.json')).sort();

  for (const f of rawFiles) {
    const filePath = path.join(cacheDir, f);
    let parsed = null;
    try {
      parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      continue;
    }
    const rawData = parsed.data || parsed;

    if (f.startsWith('blip_')) {
      const items = Array.isArray(rawData) ? rawData : (rawData.data || []);
      for (const item of items) {
        if (!item.title || !item.startTime) continue;
        const cId = generateCanonicalScheduleId('blip', item);

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
        })) : (Array.isArray(item.starAttendees) ? item.starAttendees : []);

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
            resolvedTypeText = '영상';
          } else {
            resolvedTypeText = '기타';
          }
        }

        let blipUrl = item.url || null;
        if (!blipUrl && item.message) {
          const m = item.message.match(/https?:\/\/[^\s]+/);
          if (m) blipUrl = m[0];
        }

        const rawItem = {
          id: cId,
          title: item.title ? item.title.trim() : "",
          startTime: formatMinuteIso(item.startTime),
          endTime: formatMinuteIso(item.endTime || item.startTime),
          isAllday: Boolean(item.isAllday),
          message: item.message || "",
          typeId: item.typeId || null,
          typeText: resolvedTypeText,
          location: loc,
          channel: ch,
          url: blipUrl,
          source: 'blip',
          starAttendees: members
        };

        const cleanItem = sanitizeScheduleItem(rawItem);
        // 순수 마스터에는 삭제/수정 플래그 일체 없음
        delete cleanItem.isDeleted;
        delete cleanItem._isDeleted;
        delete cleanItem._isModified;

        idMap.set(cId, cleanItem);
      }
    } else if (f.startsWith('mnet_')) {
      const events = Array.isArray(rawData.events) ? rawData.events : (Array.isArray(rawData) ? rawData : []);
      for (const ev of events) {
        if (!ev.title) continue;
        const cId = generateCanonicalScheduleId('mnet', ev);

        let isAllDay = Boolean(ev.isAllDay);
        if (!isAllDay && ev.startAtAllDay) isAllDay = true;

        let loc = ev.location || ev.place || ev.venue || null;
        let labelName = (ev.scheduleType && ev.scheduleType.name) ? ev.scheduleType.name.trim() : null;
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

        const rawItem = {
          id: cId,
          title: ev.title ? ev.title.trim() : "",
          startTime: formatMinuteIso(ev.startAt || (ev.startAtAllDay ? `${ev.startAtAllDay}T00:00Z` : "")),
          endTime: formatMinuteIso(ev.endAt || (ev.endAtForAllDay ? `${ev.endAtForAllDay}T23:59Z` : (ev.startAt || (ev.startAtAllDay ? `${ev.startAtAllDay}T00:00Z` : "")))),
          isAllday: isAllDay,
          message: `[${labelName || '일정'}] ${ev.title}`,
          typeText: labelName,
          typeId: labelName === '방송' ? 1 : (labelName === '공연' ? 5 : (labelName === '기념일' ? 3 : (labelName === '행사' ? 5 : null))),
          location: loc,
          channel: null,
          source: 'mnet',
          starAttendees: attendees
        };

        const cleanItem = sanitizeScheduleItem(rawItem);
        delete cleanItem.isDeleted;
        delete cleanItem._isDeleted;
        delete cleanItem._isModified;

        idMap.set(cId, cleanItem);
      }
    }
  }

  // YouTube Seeds 추가
  const streamsSeedFile = path.join(seedDir, 'official-streams.json');
  if (fs.existsSync(streamsSeedFile)) {
    try {
      const streams = JSON.parse(fs.readFileSync(streamsSeedFile, 'utf8'));
      if (Array.isArray(streams)) {
        for (const s of streams) {
          if (!s.id || !s.title) continue;
          const cId = `yt_${s.id}`;
          const startTime = formatMinuteIso(s.publishedAt || (s.published ? `${s.published}T00:00Z` : ''));
          if (!startTime) continue;
          const item = sanitizeScheduleItem({
            id: cId,
            title: s.title.trim(),
            startTime,
            endTime: startTime,
            isAllday: false,
            typeId: 8,
            typeText: '영상',
            channel: 'YouTube',
            url: s.url || `https://www.youtube.com/watch?v=${s.id}`,
            source: 'youtube',
            isOfficialYoutube: true
          });
          delete item.isDeleted;
          delete item._isDeleted;
          idMap.set(cId, item);
        }
      }
    } catch (e) {}
  }

  const cleanItems = Array.from(idMap.values());
  cleanItems.sort((a, b) => {
    const tA = new Date(a.startTime || 0).getTime();
    const tB = new Date(b.startTime || 0).getTime();
    return tA - tB;
  });

  return {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    itemCount: cleanItems.length,
    items: cleanItems
  };
}

// Clean Master 데이터셋 생성기 (레거시 마스터 호환용)
export function buildCleanMaster(liveMasterJson) {
  const rawItems = liveMasterJson.items || [];
  const cleanItems = [];

  for (const raw of rawItems) {
    const canonicalId = generateCanonicalScheduleId(raw.source, raw);
    const item = sanitizeScheduleItem({
      ...raw,
      id: canonicalId
    });

    // 소스명 명시
    if (!item.source) {
      if (canonicalId.startsWith('mnet_')) item.source = 'mnet';
      else if (canonicalId.startsWith('blip_')) item.source = 'blip';
      else if (canonicalId.startsWith('yt_')) item.source = 'youtube';
      else if (canonicalId.startsWith('custom_')) item.source = 'custom';
    }

    // linkedScheduleIds 내부의 hex ID도 Canonical ID(mnet_)로 정규화
    if (Array.isArray(item.linkedScheduleIds)) {
      item.linkedScheduleIds = item.linkedScheduleIds.map(id => {
        if (typeof id === 'string' && /^[a-f0-9]{24}$/.test(id)) {
          return `mnet_${id}`;
        }
        return id;
      });
    }

    if (item.startTime) item.startTime = formatMinuteIso(item.startTime);
    if (item.endTime) item.endTime = formatMinuteIso(item.endTime);

    cleanItems.push(item);
  }

  // 시작일시 오름차순 정렬
  cleanItems.sort((a, b) => {
    const tA = new Date(a.startTime || 0).getTime();
    const tB = new Date(b.startTime || 0).getTime();
    return tA - tB;
  });

  return {
    lastUpdated: new Date().toISOString(),
    itemCount: cleanItems.length,
    items: cleanItems
  };
}

// KST(한국 표준시) 기준 YYYY-MM-DD 날짜 추출 헬퍼
export function getKstDateKey(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr).slice(0, 10);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

// 기존 946건 오버라이드 역추적 매퍼 및 순수 diff 생성기
export function migrateOverridesToCanonical(rawOverrides, cleanMaster, liveSchedulesJson = null, options = {}) {
  const masterItems = cleanMaster.items || [];

  // 검색 색인 구축
  const masterById = new Map();
  const masterByDateTitle = new Map();
  const masterByExactDateTitle = new Map();
  const masterByDateOnly = new Map();

  for (const m of masterItems) {
    masterById.set(m.id, m);

    // Mnet 24자리 hex raw ID 매핑
    if (m.id.startsWith('mnet_')) {
      const rawHex = m.id.replace('mnet_', '');
      masterById.set(rawHex, m);
    }
    // Blip raw id 매핑
    if (m.id.startsWith('blip_')) {
      const rawNum = m.id.replace('blip_', '');
      masterById.set(rawNum, m);
    }

    const dateKeyUtc = (m.startTime || '').slice(0, 10);
    const dateKeyKst = getKstDateKey(m.startTime);
    const dateKeys = Array.from(new Set([dateKeyUtc, dateKeyKst].filter(Boolean)));
    const normTitle = normalizeTitle(m.title);

    for (const dateKey of dateKeys) {
      if (m.title) {
        const exactKey = `${dateKey}__${m.title.trim()}`;
        if (!masterByExactDateTitle.has(exactKey)) {
          masterByExactDateTitle.set(exactKey, m);
        }
      }

      if (normTitle) {
        const compositeKey = `${dateKey}__${normTitle}`;
        if (!masterByDateTitle.has(compositeKey)) {
          masterByDateTitle.set(compositeKey, m);
        }
      }

      if (!masterByDateOnly.has(dateKey)) masterByDateOnly.set(dateKey, []);
      masterByDateOnly.get(dateKey).push(m);
    }
  }

  const rawSourceOverrides = rawOverrides.sourceOverrides || {};
  const newSourceOverrides = {};
  const mappingStats = {
    totalInputKeys: Object.keys(rawSourceOverrides).length,
    mappedById: 0,
    mappedByLinks: 0,
    mappedByDateTitle: 0,
    mappedByDateFuzzy: 0,
    unmappedKeys: [],
    pureDiffExtracted: 0,
    noopEliminated: 0,
    deletedCount: 0
  };

  // 키 리졸버 함수 (ID 직통 -> overrideVal.id -> linkedScheduleIds 역추적 -> 날짜/제목 매칭)
  function resolveToCanonicalMaster(key, overrideVal) {
    if (!key && !overrideVal) return null;

    // 1) ID 직통 매칭 (Canonical ID, raw hex ID, raw blip ID, raw yt ID)
    if (key && masterById.has(key)) {
      mappingStats.mappedById++;
      return masterById.get(key);
    }

    // 2) overrideVal 내부의 id 필드 직통 매칭
    if (overrideVal && overrideVal.id) {
      const oId = String(overrideVal.id);
      if (masterById.has(oId)) {
        mappingStats.mappedById++;
        return masterById.get(oId);
      }
      if (/^[a-f0-9]{24}$/.test(oId) && masterById.has(`mnet_${oId}`)) {
        mappingStats.mappedById++;
        return masterById.get(`mnet_${oId}`);
      }
      if (/^\d+$/.test(oId) && masterById.has(`blip_${oId}`)) {
        mappingStats.mappedById++;
        return masterById.get(`blip_${oId}`);
      }
    }

    // 3) 날짜_제목 키 파싱 (예: 2024-03-26_[제목])
    if (key) {
      const dateMatch = key.match(/^(\d{4}-\d{2}-\d{2})_(.+)$/);
      if (dateMatch) {
        const [, datePart, titlePart] = dateMatch;
        const exactKey = `${datePart}__${titlePart.trim()}`;

        // Exact 원본 제목 일치 우선
        if (masterByExactDateTitle.has(exactKey)) {
          mappingStats.mappedByDateTitle++;
          return masterByExactDateTitle.get(exactKey);
        }

        const norm = normalizeTitle(titlePart);
        const compositeKey = `${datePart}__${norm}`;

        // 꺾쇠괄호가 포함된 경우 Blip 우선 매칭
        const candidates = masterByDateOnly.get(datePart) || [];
        if (titlePart.startsWith('<') && titlePart.endsWith('>')) {
          const blipCand = candidates.find(c => c.id.startsWith('blip_') && normalizeTitle(c.title) === norm);
          if (blipCand) {
            mappingStats.mappedByDateTitle++;
            return blipCand;
          }
        }

        if (masterByDateTitle.has(compositeKey)) {
          mappingStats.mappedByDateTitle++;
          return masterByDateTitle.get(compositeKey);
        }

        // 삭제 플래그가 있는 일정은 오매칭 방지를 위해 fuzzy/인접 날짜 매칭 배제 (정확한 ID/Exact 매칭만 허용)
        if (overrideVal && overrideVal.isDeleted) {
          return null;
        }

        // 같은 날짜 후보 중 fuzzy / 토큰 매칭
        for (const cand of candidates) {
          const candNorm = normalizeTitle(cand.title);
          if (!candNorm) continue;
          if (norm.includes(candNorm) || candNorm.includes(norm)) {
            mappingStats.mappedByDateFuzzy++;
            return cand;
          }

          // 주요 키워드 토큰 매칭 (군산대, 대진대, 현대 N, 코없코, 배성재, 가천대, 우송 등)
          const keywords = ['군산대', '대진대', '현대 n', '코없코', '배성재', '가천', '우송', '선문', '밤밤밤', '데뷔 1주년', '시구', 'project 326'];
          for (const kw of keywords) {
            if (norm.includes(kw) && candNorm.includes(kw)) {
              mappingStats.mappedByDateFuzzy++;
              return cand;
            }
          }
        }

        // KST/UTC 시차 대응: 전일 및 익일 날짜 후보군에서도 키워드 매칭
        const dObj = new Date(datePart);
        if (!isNaN(dObj.getTime())) {
          const prevDate = new Date(dObj.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          const nextDate = new Date(dObj.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          const adjCandidates = [
            ...(masterByDateOnly.get(prevDate) || []),
            ...(masterByDateOnly.get(nextDate) || [])
          ];
          for (const cand of adjCandidates) {
            const candNorm = normalizeTitle(cand.title);
            if (!candNorm) continue;
            const keywords = ['군산대', '대진대', '현대 n', '코없코', '배성재', '가천', '우송', '선문', '밤밤밤', '데뷔 1주년', '시구', 'project 326'];
            for (const kw of keywords) {
              if (norm.includes(kw) && candNorm.includes(kw)) {
                mappingStats.mappedByDateFuzzy++;
                return cand;
              }
            }
          }
        }
      }
    }

    // 5) overrideVal 내부의 startTime/title 활용
    if (overrideVal && overrideVal.startTime) {
      const d = overrideVal.startTime.slice(0, 10);
      const t = normalizeTitle(overrideVal.title || '');
      if (d && t) {
        const comp = `${d}__${t}`;
        if (masterByDateTitle.has(comp)) {
          mappingStats.mappedByDateTitle++;
          return masterByDateTitle.get(comp);
        }
      }
    }

    return null;
  }

  // ID 형태의 키(Canonical ID, hex ID, blip ID 등)를 먼저 처리하고 날짜_제목 키는 나중에 처리
  const sortedEntries = Object.entries(rawSourceOverrides).sort(([kA], [kB]) => {
    const isDateA = /^\d{4}-\d{2}-\d{2}_/.test(kA);
    const isDateB = /^\d{4}-\d{2}-\d{2}_/.test(kB);
    if (isDateA && !isDateB) return 1;
    if (!isDateA && isDateB) return -1;
    return 0;
  });

  // Canonical ID 단위로 최종 상태 병합 (1일정 1수정본)
  const mergedByCanonicalId = new Map();

  for (const [key, ovVal] of sortedEntries) {
    if (!ovVal) continue;

    const matchedMaster = resolveToCanonicalMaster(key, ovVal);
    if (!matchedMaster) {
      mappingStats.unmappedKeys.push(key);
      continue;
    }

    const cId = matchedMaster.id;
    const existing = mergedByCanonicalId.get(cId) || {};

    // 삭제 플래그 우선 계승
    const isDeleted = Boolean(existing.isDeleted || ovVal.isDeleted);
    const combined = {
      ...existing,
      ...ovVal,
      isDeleted
    };

    mergedByCanonicalId.set(cId, combined);
  }

  // 순수 Diff 추출 (preserveMasterOverrides 지원)
  for (const [canonicalId, combinedEdit] of mergedByCanonicalId.entries()) {
    const baseItem = masterById.get(canonicalId);
    const pureDiff = computePureDiff(baseItem, combinedEdit, options);

    if (pureDiff) {
      if (Array.isArray(pureDiff.linkedScheduleIds)) {
        const rawId = canonicalId.replace(/^(mnet_|blip_|yt_|custom_)/, '');
        pureDiff.linkedScheduleIds = pureDiff.linkedScheduleIds
          .map(id => (typeof id === 'string' && /^[a-f0-9]{24}$/.test(id)) ? `mnet_${id}` : id)
          .filter(id => id && id !== canonicalId && id !== rawId);
        if (pureDiff.linkedScheduleIds.length === 0) {
          delete pureDiff.linkedScheduleIds;
        }
      }
      newSourceOverrides[canonicalId] = pureDiff;
      mappingStats.pureDiffExtracted++;
      if (pureDiff.isDeleted) {
        mappingStats.deletedCount++;
      }
    } else {
      mappingStats.noopEliminated++;
    }
  }

  // Custom Schedules 정규화 (custom_ 접두사 강제, extField 완전 배제 및 슬림화)
  const rawCustom = rawOverrides.customSchedules || {};
  const newCustomSchedules = {};

  for (const [cKey, cVal] of Object.entries(rawCustom)) {
    if (!cVal) continue;
    const cleanKey = cKey.startsWith('custom_') ? cKey : `custom_${cKey}`;
    const baseMaster = masterById.get(cleanKey);

    // 마스터에 이미 영구 수렴된 일정이면 마스터의 유효한 값(url, message 등)을 보존
    const merged = { ...baseMaster };
    Object.entries(cVal).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        merged[k] = v;
      }
    });

    const slimmed = slimScheduleItem({
      ...merged,
      id: cleanKey,
      source: merged.source || 'custom'
    });

    if (slimmed) {
      delete slimmed.extField;
      if (slimmed.url) {
        const mId = parseMediaId(slimmed.url);
        if (mId) slimmed.url = mId;
      }
      if (slimmed.startTime) slimmed.startTime = formatMinuteIso(slimmed.startTime);
      if (slimmed.endTime) slimmed.endTime = formatMinuteIso(slimmed.endTime);
      newCustomSchedules[cleanKey] = slimmed;
    }
  }

  // 레거시 마스터에 남아있던 custom_ 일정들도 안전하게 customSchedules로 이관 (extField 완전 배제)
  const legacyMasterList = options.legacyMasterItems || [];
  for (const item of legacyMasterList) {
    if (item && item.id && String(item.id).startsWith('custom_')) {
      const cId = String(item.id);
      if (!newCustomSchedules[cId]) {
        const slimmed = slimScheduleItem({
          ...item,
          id: cId,
          source: item.source || 'custom'
        });
        if (slimmed) {
          delete slimmed.extField;
          if (slimmed.url) {
            const mId = parseMediaId(slimmed.url);
            if (mId) slimmed.url = mId;
          }
          if (slimmed.startTime) slimmed.startTime = formatMinuteIso(slimmed.startTime);
          if (slimmed.endTime) slimmed.endTime = formatMinuteIso(slimmed.endTime);
          newCustomSchedules[cId] = slimmed;
        }
      }
    }
  }

  // 라이브 운영 일정 중 보호(승인)가 필요한 일정들을 approvedScheduleIds로 계승
  const approvedIds = new Set();
  if (liveSchedulesJson && Array.isArray(liveSchedulesJson.items)) {
    for (const liveItem of liveSchedulesJson.items) {
      const cItem = resolveToCanonicalMaster(liveItem.id, liveItem);
      if (cItem && !newSourceOverrides[cItem.id]?.isDeleted) {
        approvedIds.add(cItem.id);
      }
    }
  }

  const cleanOverrides = {
    version: '2.0.0',
    updatedAt: new Date().toISOString(),
    pipelineConfig: {
      mode: 'auto',
      approvedScheduleIds: Array.from(approvedIds)
    },
    filterRules: rawOverrides.filterRules || {},
    customSchedules: newCustomSchedules,
    sourceOverrides: newSourceOverrides
    // legacyAliases 완전 소거
  };

  return { cleanOverrides, mappingStats };
}

// 최종 배포 스케줄 합성기 (공식 2트랙 아키텍처 및 클러스터링 필터 엔진 활용)
export function synthesizeSchedules(cleanMaster, cleanOverrides, options = {}) {
  const mergedResult = mergeSchedulesV2(cleanMaster.items || [], cleanOverrides);
  const items = Array.isArray(mergedResult) ? mergedResult : (mergedResult.items || []);
  const trimSeconds = options.trimSeconds !== false; // 기본값: true (v1.0.6 분 단위 최적화)

  const slimmed = items.map(item => {
    const sItem = slimScheduleItem(item);
    if (!sItem) return null;

    // 1. url 필드가 있으면 항상 Canonical Full URL로 복원
    if (sItem.url) {
      sItem.url = formatMediaUrl(sItem.url);
    }

    // 2. 미디어 ID 추출 및 단일 mediaIds 배열 주입 (단수형 mediaId 중복 배제 피드백 반영)
    if (sItem.url) {
      const mId = parseMediaId(sItem.url);
      if (mId) {
        sItem.mediaIds = [mId];
      }
    }

    // 3. 타임스탬프 최적화 (v1.0.6은 초(:00) 제거, v1은 레거시 하위 호환 초(:00) 보정)
    if (trimSeconds) {
      if (sItem.startTime) sItem.startTime = formatMinuteIso(sItem.startTime);
      if (sItem.endTime) sItem.endTime = formatMinuteIso(sItem.endTime);
    } else {
      if (sItem.startTime) sItem.startTime = formatSecondsIso(sItem.startTime);
      if (sItem.endTime) sItem.endTime = formatSecondsIso(sItem.endTime);
    }

    // 4. 버전 분리 원칙에 따른 extField 최적화:
    // v1.0.6 및 최신 표준 배포본에서는 extField 100% 완전 배제 (channel, location이 표준 필드로 존재함)
    const isLegacyV1 = options.version === '1.0.0';
    if (!isLegacyV1) {
      delete sItem.extField;
    }

    return sItem;
  }).filter(Boolean);

  // 시작일시 오름차순 정렬
  slimmed.sort((a, b) => {
    const tA = new Date(a.startTime || 0).getTime();
    const tB = new Date(b.startTime || 0).getTime();
    return tA - tB;
  });

  return {
    version: options.version || '1.0.6',
    lastUpdated: new Date().toISOString(),
    totalCount: slimmed.length,
    items: slimmed
  };
}

// 재구축 파이프라인 엔트리포인트 (실제 동작 실행)
export async function runRebuildPipeline(options = {}) {
  const outputDir = options.outputDir || DEFAULT_OUTPUT_DIR;
  const masterPath = options.masterPath || LIVE_MASTER_PATH;
  const overridesPath = options.overridesPath || DEFAULT_OVERRIDES_CACHE;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('===============================================================');
  console.log('🚀 [Rebuild Pipeline] Canonical Key 전면 재구축 파이프라인 시작');
  console.log(`   - 출력 경로 (격리 공간): ${outputDir}`);
  console.log('===============================================================');

  // 1. 공식 원본 수집 소스 캐시 확보 (.cache/raw/ 2024.01 ~ 2027.12)
  await ensureRawSourceCaches(options);

  // 2. 레거시 마스터 로드 (custom_ 일정 이관 및 백업용)
  let liveMaster = null;
  if (fs.existsSync(masterPath)) {
    try {
      liveMaster = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
    } catch (e) {}
  }

  // 3. 마스터 생성 (useRawSources: true 가 기본값)
  let cleanMaster;
  if (options.useRawSources !== false) {
    cleanMaster = buildPureRawMaster(RAW_CACHE_DIR, SEEDS_DIR);
    console.log(`✓ 순수 원본 마스터(Pure Raw Master) 생성 완료: ${cleanMaster.items.length}건 (공식 Blip/Mnet/YouTube 기반)`);
  } else {
    if (!liveMaster) {
      throw new Error(`Master 파일 누락: ${masterPath}`);
    }
    cleanMaster = buildCleanMaster(liveMaster);
    console.log(`✓ 운영 Master 기반 Clean Master 생성 완료 (${cleanMaster.items.length}건)`);
  }

  const outMasterFile = path.join(outputDir, 'master-schedules.json');
  fs.writeFileSync(outMasterFile, JSON.stringify(cleanMaster, null, 2), 'utf8');
  console.log(`✓ 마스터 파일 저장 완료: ${cleanMaster.items.length}건 ➔ ${outMasterFile}`);

  // 4. Existing Overrides 읽기 전용 로드
  let rawOverrides = null;
  if (fs.existsSync(overridesPath)) {
    rawOverrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
  } else {
    rawOverrides = { version: '1.0.0', sourceOverrides: {}, customSchedules: {} };
  }
  console.log(`✓ 오버라이드 원본 로드 완료 (${Object.keys(rawOverrides.sourceOverrides || {}).length}개 키)`);

  // 5. 오버라이드 역추적 매핑 및 Pure Diff 추출 (레거시 custom_ 일정 자동 계승)
  let liveSchedules = null;
  if (fs.existsSync(LIVE_SCHEDULES_PATH)) {
    try {
      liveSchedules = JSON.parse(fs.readFileSync(LIVE_SCHEDULES_PATH, 'utf8'));
    } catch (e) {}
  }
  const migrateOpts = {
    ...options,
    legacyMasterItems: liveMaster ? (liveMaster.items || []) : []
  };
  const { cleanOverrides, mappingStats } = migrateOverridesToCanonical(rawOverrides, cleanMaster, liveSchedules, migrateOpts);
  const outOverridesFile = path.join(outputDir, 'schedule-overrides.json');
  fs.writeFileSync(outOverridesFile, JSON.stringify(cleanOverrides, null, 2), 'utf8');

  const oldSize = fs.existsSync(overridesPath) ? fs.statSync(overridesPath).size : 0;
  const newSize = fs.statSync(outOverridesFile).size;
  const reduction = oldSize > 0 ? (((oldSize - newSize) / oldSize) * 100).toFixed(1) : '0';

  console.log(`✓ 초경량 Pure Diff 오버라이드 생성 완료 ➔ ${outOverridesFile}`);
  console.log(`   - 원본 용량: ${(oldSize / 1024).toFixed(1)} KB ➔ ${(newSize / 1024).toFixed(1)} KB (${reduction}% 압축)`);
  console.log(`   - 추출된 Pure Diff: ${mappingStats.pureDiffExtracted}건, no-op 제거: ${mappingStats.noopEliminated}건`);

  // 6. 최종 배포 스케줄 합성 및 버전별 분리 출력
  // 6-1. v1 호환 배포본 (version 1.0.0, 레거시 호환용 초(:00) 유지)
  const v1Schedules = synthesizeSchedules(cleanMaster, cleanOverrides, { version: '1.0.0', trimSeconds: false });
  const v1Dir = path.join(outputDir, 'v1');
  if (!fs.existsSync(v1Dir)) fs.mkdirSync(v1Dir, { recursive: true });
  const outV1SchedulesFile = path.join(v1Dir, 'schedules.json');
  fs.writeFileSync(outV1SchedulesFile, JSON.stringify(v1Schedules, null, 2), 'utf8');

  // 6-2. v1.0.6 차기 릴리즈 배포본 (version 1.0.6, 분 단위 축약 및 mediaIds 완비)
  const v106Schedules = synthesizeSchedules(cleanMaster, cleanOverrides, { version: '1.0.6', trimSeconds: true });
  const v106Dir = path.join(outputDir, 'v1.0.6');
  if (!fs.existsSync(v106Dir)) fs.mkdirSync(v106Dir, { recursive: true });
  const outV106SchedulesFile = path.join(v106Dir, 'schedules.json');
  fs.writeFileSync(outV106SchedulesFile, JSON.stringify(v106Schedules, null, 2), 'utf8');

  // 6-3. 최신 기본 루트 배포본 (version 1.0.6)
  const outSchedulesFile = path.join(outputDir, 'schedules.json');
  fs.writeFileSync(outSchedulesFile, JSON.stringify(v106Schedules, null, 2), 'utf8');

  console.log(`✓ 최종 합성 배포 스케줄 생성 완료:`);
  console.log(`   - [v1/schedules.json]     (ver 1.0.0): ${v1Schedules.items.length}건 ➔ ${outV1SchedulesFile}`);
  console.log(`   - [v1.0.6/schedules.json] (ver 1.0.6): ${v106Schedules.items.length}건 ➔ ${outV106SchedulesFile}`);
  console.log(`   - [schedules.json]        (ver 1.0.6): ${v106Schedules.items.length}건 ➔ ${outSchedulesFile}`);

  // 7. 감사 보고서 생성
  const auditReport = {
    generatedAt: new Date().toISOString(),
    masterItemCount: cleanMaster.items.length,
    schedulesItemCount: v106Schedules.items.length,
    overridesStats: {
      oldSizeBytes: oldSize,
      newSizeBytes: newSize,
      reductionPercent: `${reduction}%`,
      ...mappingStats
    }
  };
  const outAuditFile = path.join(outputDir, 'migration-audit-report.json');
  fs.writeFileSync(outAuditFile, JSON.stringify(auditReport, null, 2), 'utf8');
  console.log(`✓ 감사 보고서 생성 완료 ➔ ${outAuditFile}`);

  return {
    success: true,
    cleanMaster,
    cleanOverrides,
    cleanSchedules: v106Schedules,
    v1Schedules,
    v106Schedules,
    auditReport
  };
}

// CLI 직접 실행 지원
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runRebuildPipeline().then(() => {
    console.log('\n🎉 [Rebuild Pipeline] 격리 재구축이 완벽하게 완료되었습니다.');
  }).catch(err => {
    console.error('\n❌ [Rebuild Pipeline] 재구축 실패:', err);
    process.exit(1);
  });
}
