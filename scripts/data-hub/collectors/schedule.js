import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.resolve(__dirname, '../../../.cache');
const OEMBED_CACHE_FILE = path.join(CACHE_DIR, 'oembed-cache.json');
const STREAMS_CACHE_FILE = path.join(CACHE_DIR, 'streams-cache.json');

// 캐시 디렉터리 준비
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
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
        seeds.forEach(s => { if (s && s.id) cache[s.id] = s; });
      }
    }
  } catch (e) { }

  // 2. 런타임 캐시 파일이 있으면 덮어쓰기
  try {
    if (fs.existsSync(STREAMS_CACHE_FILE)) {
      const runtimeCache = JSON.parse(fs.readFileSync(STREAMS_CACHE_FILE, 'utf8'));
      Object.assign(cache, runtimeCache);
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
        cache[s.id] = {
          id: s.id,
          title: cleanTitle,
          publishedAt,
          published,
          url: 'https://www.youtube.com/watch?v=' + s.id,
          thumbnail: `https://i.ytimg.com/vi/${s.id}/hqdefault.jpg`
        };
        newFetches++;
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

// 제목 정규화 및 정리
function cleanDisplayTitle(title, maxLength = 0) {
  if (!title) return "";
  let clean = title
    .replace(/^(\[(?:방송|영상|공식\s*영상|행사|팬이벤트|기념일|릴리즈|일정|🎬|📺|📻|🎉|🎤|💿)\]\s*)+/gi, '')
    .replace(/(?:\s*#[^\s#]+)+$/g, '')
    .replace(/\s*\|\s*(?:RESCENE|리센느|안녕하세요원이입니다잘부탁드립니다|안녕하세요\s*원이입니다|helloiamwoni)\s*$/i, '')
    .trim();

  if (maxLength > 0 && clean.length > maxLength) {
    clean = clean.slice(0, maxLength).trim() + '...';
  }
  return clean;
}

// 방송사 명칭 판별 헬퍼 (공식 TV/라디오 방송사 및 주요 KPOP 방송 미디어)
function isBroadcasterName(name) {
  if (!name) return false;
  const n = String(name).trim();
  return /^(?:MBC|KBS|KBS2|SBS|Mnet|JTBC|tvN|ENA|EBS|TV조선|채널A|MBN|Arirang|아리랑|CJ\s*ENM|M2|SBSKPOP|MBCkpop|KBS\s*Kpop|스튜디오\s*춤|STUDIO\s*CHOOM|1theK|원더케이|it's\s*Live|잇츠라이브)/i.test(n);
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
  console.log(`  🔎 [Debug Streams]: ${officialStreams.map(s => `${s.id}(${s.published})`).join(', ')}`);

  const targetDebug = schedules.find(s => (s.title && s.title.includes('생일 기념 라이브')) || (s.message && s.message.includes('생일 기념 라이브')));
  if (targetDebug) {
    console.log(`  🔎 [Debug Live Target] 발견: title="${targetDebug.title}", _isShorts=${targetDebug._isShorts}, _isExcluded=${targetDebug._isExcluded}, channel="${targetDebug.channel}", extField=${JSON.stringify(targetDebug.extField)}`);
  } else {
    console.log(`  🔎 [Debug Live Target] 스케줄 목록 내 없음 (전체: ${schedules.length}건)`);
  }

  schedules.forEach(item => {
    const isTargetItem = (item.title && item.title.includes('생일 기념 라이브')) || (item.message && item.message.includes('생일 기념 라이브'));

    if (item._isShorts || item._isExcluded) {
      if (isTargetItem) console.log(`  🔎 [Debug Live Step] 제외됨: _isShorts=${item._isShorts}, _isExcluded=${item._isExcluded}`);
      return;
    }
    const text = [item.title, item.message, item.url, item.link, item.channel, item.extField?.value].filter(Boolean).join(' ');
    const hasVid = text.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/);

    // 타 채널 외부 방송(침착맨, 문명특급, 방송사, 페스티벌 등)은 공식 채널 스트림 매칭에서 제외
    const isExternalBroadcast = /침착맨|문명특급|mmtg|대\.?친\.?소|인기가요|뮤직뱅크|쇼챔|엠카|it'?s\s*live|아이돌\s*라디오|친한친구|kcon|서든어택|월드컵/i.test(text);
    if (isExternalBroadcast) {
      if (isTargetItem) console.log(`  🔎 [Debug Live Step] 외부 방송으로 판정됨: text=${text.slice(0, 100)}`);
      return;
    }

    // 리센느 공식 채널 라이브 방송인지 판별
    const isOfficialLive = item.channel === 'RESCENE' || /youtube\.com\/@rescene_official|RESCENE\s*공식\s*YOUTUBE/i.test(text);
    if (!isOfficialLive) {
      if (isTargetItem) console.log(`  🔎 [Debug Live Step] 공식 채널 라이브 아님: channel=${item.channel}`);
      return;
    }

    // 비디오 ID가 없고 라이브 관련 키워드가 있는 일정
    const isLiveKeyword = /\[live\]|라이브|\blive\b/i.test(item.title || '') || /\[live\]|라이브/i.test(item.message || '');
    if (isTargetItem) {
      console.log(`  🔎 [Debug Live Step] 조건: hasVid=${Boolean(hasVid)}, isLiveKeyword=${isLiveKeyword}, startTime=${item.startTime}`);
    }
    if (!hasVid && isLiveKeyword && item.startTime) {
      const itemDate = parseSafeDate(item.startTime);
      const kstItemDate = new Date(itemDate.getTime() + 9 * 60 * 60 * 1000);
      const itemDateStr = `${kstItemDate.getUTCFullYear()}-${String(kstItemDate.getUTCMonth() + 1).padStart(2, '0')}-${String(kstItemDate.getUTCDate()).padStart(2, '0')}`;
      const itemTimeMs = itemDate.getTime();

      // 스트림 VOD가 이미 존재하거나 현재 시각보다 과거인 경우 종료된 라이브로 판정
      const hasStreamUploaded = officialStreams.some(s => s.published === itemDateStr);
      const isPast = (itemTimeMs < Date.now()) || hasStreamUploaded;

      if (isTargetItem) {
        console.log(`  🔎 [Debug Live Step] 날짜/시각: itemDateStr=${itemDateStr}, hasStreamUploaded=${hasStreamUploaded}, isPast=${isPast}, streamCount=${officialStreams.length}`);
      }

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
    .replace(/[<>\[\]{}()_!?,.~`'"•\-\/]/g, ' ')
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
        if (json && Array.isArray(json.events)) {
          return json.events.map(ev => {
            const loc = ev.location || ev.place || ev.venue || ev.locationName || ev.address || null;
            const isAllDay = ev.allDay || Boolean(ev.startAtAllDay);
            const labelName = ev.label ? ev.label.name : null;
            const attendees = Array.isArray(ev.starAttendees) ? ev.starAttendees.map(a => ({
              id: a.id,
              nickname: a.nickname,
              avatarImgPath: a.avatarImgPath,
              type: a.type
            })) : [];

            return {
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

          return {
            title: item.title ? item.title.trim() : "",
            startTime: item.startTime,
            endTime: item.endTime || item.startTime,
            isAllday: Boolean(item.isAllday),
            message: item.message || "",
            typeId: item.typeId || null,
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
  console.log("▶ [Schedule] 데이터 수집 시작 (Blip & Mnet Plus)...");

  const now = new Date();
  const curYear = now.getFullYear();

  // 2024년 1월 ~ 2027년 12월까지 전체 월 대상
  const monthsToFetch = [];
  const startYear = 2024;
  const endYear = curYear + 1;

  for (let y = startYear; y <= endYear; y++) {
    for (let m = 1; m <= 12; m++) {
      monthsToFetch.push({ year: y, month: m });
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

  // 중복 병합
  const mergedList = [];
  allRaw.forEach(newItem => {
    if (!newItem.title || !newItem.startTime) return;
    const newD = parseSafeDate(newItem.startTime);
    const kstNewD = new Date(newD.getTime() + 9 * 60 * 60 * 1000);
    const newDateStr = `${kstNewD.getUTCFullYear()}-${String(kstNewD.getUTCMonth() + 1).padStart(2, '0')}-${String(kstNewD.getUTCDate()).padStart(2, '0')}`;

    let matchIdx = -1;
    for (let i = 0; i < mergedList.length; i++) {
      const existD = parseSafeDate(mergedList[i].startTime);
      const kstExistD = new Date(existD.getTime() + 9 * 60 * 60 * 1000);
      const existDateStr = `${kstExistD.getUTCFullYear()}-${String(kstExistD.getUTCMonth() + 1).padStart(2, '0')}-${String(kstExistD.getUTCDate()).padStart(2, '0')}`;

      if (newDateStr === existDateStr && areSchedulesDuplicate(mergedList[i], newItem)) {
        matchIdx = i;
        break;
      }
    }

    if (matchIdx !== -1) {
      const target = mergedList[matchIdx];
      target.title = pickBestTitle(target.title, newItem.title);
      if (!target.url && newItem.url) target.url = newItem.url;
      if (!target.message && newItem.message) target.message = newItem.message;
      if (!target.typeText && newItem.typeText) target.typeText = newItem.typeText;
      if (!target.location && newItem.location) target.location = newItem.location;
      if (!target.channel && newItem.channel) target.channel = newItem.channel;
      if (!target.starAttendees || target.starAttendees.length === 0) target.starAttendees = newItem.starAttendees;
    } else {
      mergedList.push({ ...newItem });
    }
  });

  // YouTube oEmbed 사전 일괄 보강 수행!
  await enrichSchedulesWithYouTubeOEmbed(mergedList, allYtVideos);

  // [쇼츠 일정 원천 제외] 쇼츠(_isShorts)로 판별된 항목은 스케줄 아카이브에 등록하지 않고 완전 제외
  const nonShortsList = mergedList.filter(item => !item._isShorts);
  const removedShortsCount = mergedList.length - nonShortsList.length;
  if (removedShortsCount > 0) {
    console.log(`  ✂️ [Schedule Filter] 스케줄 목록에서 쇼츠(Shorts) ${removedShortsCount}건 원천 제외 완료`);
  }

  // 날짜 순 정렬
  nonShortsList.sort((a, b) => parseSafeDate(a.startTime).getTime() - parseSafeDate(b.startTime).getTime());

  // [초강력 데이터 다이어트] 불필요한 공백, 빈 배열, 중복 필드 제거
  const slimmedList = nonShortsList.map(item => {
    const slim = {
      title: item.title,
      startTime: item.startTime,
      endTime: item.endTime,
      isAllday: Boolean(item.isAllday),
      typeId: item.typeId,
      url: item.url || item.link || undefined,
      typeText: item.typeText || undefined,
      channel: item.channel || undefined,
      location: item.location || undefined,
      source: item.source || undefined,
      thumbnail: item.thumbnail || undefined,
      isOfficialYoutube: item.isOfficialYoutube || undefined,
      extField: item.extField || undefined
    };

    // 무의미한 줄바꿈/공백이 아닌 유효한 메시지만 포함 (120KB+ 절감)
    const trimmedMsg = (item.message || '').trim();
    if (trimmedMsg && trimmedMsg !== '\n') {
      slim.message = trimmedMsg;
    }

    return slim;
  });

  console.log(`✓ [Schedule] 완료: 총 ${allRaw.length}건 중 ${slimmedList.length}건 병합 및 슬림화 완료`);

  return {
    totalCount: slimmedList.length,
    items: slimmedList
  };
}
