// common/modules/calendar.js - 스케줄 중복제거, 캘린더 매니저 및 뷰 렌더러
import { escapeHtml } from '../templates.js';
import { showScheduleModal } from './modals.js';

export function parseSafeDate(startTimeStr) {
  if (!startTimeStr) return new Date();
  if (startTimeStr.length === 10 && !startTimeStr.includes('T')) {
    const [y, m, d] = startTimeStr.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0);
  }
  const d = new Date(startTimeStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function cleanScheduleText(text) {
  if (!text) return "";
  return text
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]/gu, '')
    .replace(/[<>[\]{}()_!?,.~`'"•\-/]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeTitle(title) {
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
    'dream concert': '드림콘서트',
    '맨시티': '맨체스터시티',
    'man city': '맨체스터시티',
    'mancity': '맨체스터시티',
    'water music pool party': '워터뮤직풀파티',
    'just makeup': '저스트메이크업',
  };

  for (let [en, ko] of Object.entries(synonyms)) {
    if (clean.includes(en)) {
      clean = clean.replace(new RegExp(en, 'g'), ko);
    }
  }

  return clean.replace(/\s+/g, '');
}

export function parseTitleStructure(title) {
  if (!title) return { main: '', sub: '' };

  // 1. <메인> 서브 또는 [메인] 서브
  const bracketMatch = title.match(/^[<[](.+?)[>\]]\s*(.*)$/);
  if (bracketMatch) {
    return {
      main: normalizeTitle(bracketMatch[1]),
      sub: normalizeTitle(bracketMatch[2])
    };
  }

  // 2. 메인 - 서브 또는 메인 | 서브 또는 메인 : 서브
  const dashMatch = title.match(/^(.+?)\s*[-|:]\s*(.+)$/);
  if (dashMatch) {
    return {
      main: normalizeTitle(dashMatch[1]),
      sub: normalizeTitle(dashMatch[2])
    };
  }

  return {
    main: normalizeTitle(title),
    sub: ''
  };
}

export function areSchedulesDuplicate(item1, item2) {
  // 0단계: 유튜브 영상 ID 대조 (서로 다른 영상 ID를 가지고 있으면 100% 다른 일정이므로 병합 거부!)
  const extractYtId = (item) => {
    const text = [item.url, item.link, item.message, item.title].filter(Boolean).join(' ');
    const match = text.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
    return match ? match[1] : null;
  };

  const yt1 = extractYtId(item1);
  const yt2 = extractYtId(item2);
  if (yt1 && yt2) {
    if (yt1 === yt2) return true; // 동일 영상 ID면 무조건 동일 일정
    return false; // 서로 다른 영상 ID면 절대로 중복 아님!
  }

  // 순수 제목 기준 비교 (본문 메시지에 의한 오병합 방지)
  const t1 = item1.title || "";
  const t2 = item2.title || "";
  if (!t1 || !t2) return false;

  // 1단계: 구조적 메인-부제(Sub-event) 분석 기반 정밀 판별 (하드코딩 0%)
  const s1 = parseTitleStructure(t1);
  const s2 = parseTitleStructure(t2);

  if (s1.main && s2.main) {
    const isSameMain = s1.main === s2.main ||
      (Math.min(s1.main.length, s2.main.length) >= 4 && (s1.main.includes(s2.main) || s2.main.includes(s1.main)));

    if (isSameMain) {
      // 둘 다 서브타이틀(부제)이 존재하는 경우
      if (s1.sub && s2.sub) {
        // 부제가 일치하거나 포함 관계이면 같은 세부 무대/코너 (중복 병합)
        if (s1.sub === s2.sub || s1.sub.includes(s2.sub) || s2.sub.includes(s1.sub)) {
          return true;
        }
        // 부제가 서로 다르면 (예: 프리뷰쇼 vs 하프타임쇼, SHOWCASE vs CONCERT) 서로 다른 세부 행사 (분리 보존)
        return false;
      }
      // 한쪽만 부제가 있고 다른 한쪽은 전체 메인 행사명인 경우 구체적 정보로 병합
      return true;
    }

    // 구조적 교차 매칭: 한쪽의 부제(sub)가 다른 쪽의 메인(main)과 일치하거나 포함 관계인 경우
    // (예: <대회명> 맨시티 vs AT마드리드 하프타임쇼 <-> <맨시티 vs AT마드리드 하프타임쇼>)
    if (s1.sub && s2.main && Math.min(s1.sub.length, s2.main.length) >= 4 && (s1.sub === s2.main || s1.sub.includes(s2.main) || s2.main.includes(s1.sub))) {
      return true;
    }
    if (s2.sub && s1.main && Math.min(s2.sub.length, s1.main.length) >= 4 && (s2.sub === s1.main || s2.sub.includes(s1.main) || s1.main.includes(s2.sub))) {
      return true;
    }
  }

  // 2단계: 카테고리/형태가 명확히 다른 경우(방송 vs 현장 공연/행사 등) 병합 거부
  const type1 = item1.typeId || 0;
  const type2 = item2.typeId || 0;
  const isBroadcasting1 = type1 === 1 || (item1.extField && item1.extField.key === '채널') || (item1.typeText === '방송');
  const isPhysicalEvent1 = type1 === 5 || (item1.extField && item1.extField.key === '장소') || (item1.typeText === '공연' || item1.typeText === '행사');
  const isBroadcasting2 = type2 === 1 || (item2.extField && item2.extField.key === '채널') || (item2.typeText === '방송');
  const isPhysicalEvent2 = type2 === 5 || (item2.extField && item2.extField.key === '장소') || (item2.typeText === '공연' || item2.typeText === '행사');

  // 하나는 순수 방송(온라인/중계)이고 하나는 순수 현장 공연/행사인 경우 분리 보존
  if ((isBroadcasting1 && !isPhysicalEvent1 && isPhysicalEvent2 && !isBroadcasting2) ||
    (isBroadcasting2 && !isPhysicalEvent2 && isPhysicalEvent1 && !isBroadcasting1)) {
    return false;
  }

  // 3단계: 정규화 텍스트 완전 일치 및 포함 관계
  const n1 = normalizeTitle(t1);
  const n2 = normalizeTitle(t2);
  if (n1 && n2) {
    if (n1 === n2) return true;
    if ((n1.includes(n2) || n2.includes(n1)) && Math.min(n1.length, n2.length) >= 4) {
      return true;
    }
  }

  // 4단계: 괄호 안팎 한/영 분리 매칭
  const extractParts = (str) => {
    const parts = [str];
    const match = str.match(/(.*?)\((.*?)\)/);
    if (match) {
      if (match[1].trim()) parts.push(match[1].trim());
      if (match[2].trim()) parts.push(match[2].trim());
    }
    return parts;
  };

  const parts1 = extractParts(t1).map(normalizeTitle);
  const parts2 = extractParts(t2).map(normalizeTitle);

  for (let p1 of parts1) {
    for (let p2 of parts2) {
      if (p1 && p2 && p1.length >= 4 && p2.length >= 4) {
        if (p1 === p2 || p1.includes(p2) || p2.includes(p1)) {
          return true;
        }
      }
    }
  }

  // 3단계: 단어 교집합 유사도 (순수 제목 기반)
  const words1 = cleanScheduleText(t1).split(' ').filter(w => w.length >= 2);
  const words2 = cleanScheduleText(t2).split(' ').filter(w => w.length >= 2);
  if (words1.length > 0 && words2.length > 0) {
    const intersection = words1.filter(w => words2.includes(w));
    if (intersection.length >= 2 && Math.max(words1.length, words2.length) <= intersection.length + 1) {
      return true;
    }
  }

  return false;
}

export function pickBestTitle(title1, title2) {
  if (!title1) return title2 || "";
  if (!title2) return title1 || "";
  if (title1.includes('(') && !title2.includes('(')) return title1;
  if (title2.includes('(') && !title1.includes('(')) return title2;
  return title1.length >= title2.length ? title1 : title2;
}

let _lastScheduleInputRef = null;
let _lastScheduleCleanResult = null;

export function deduplicateScheduleList(schedules = []) {
  if (!Array.isArray(schedules) || schedules.length === 0) return [];
  // 백엔드 Central Data Hub(schedule.js v2.0)에서 이미 고유 ID 부여, 중복 제거, 쇼츠/투표 필터링,
  // Gist 오버라이드 합성이 완벽하게 완료되어 발행되므로 클라이언트는 추가 가공 없이 그대로 즉각 반환합니다.
  return schedules;
}

// 브라우저 윈도우 환경 안전 바인딩
if (typeof window !== 'undefined') {
  window.deduplicateScheduleList = deduplicateScheduleList;
  window.areSchedulesDuplicate = areSchedulesDuplicate;
  window.cleanScheduleText = cleanScheduleText;
  window.normalizeTitle = normalizeTitle;
  window.pickBestTitle = pickBestTitle;
  window.isBroadcasterName = isBroadcasterName;
  window.enrichSchedulesWithYouTubeOEmbed = enrichSchedulesWithYouTubeOEmbed;
}

export function isBroadcasterName(name) {
  if (!name) return false;
  const n = String(name).trim();
  return /^(?:MBC|KBS|KBS2|SBS|Mnet|JTBC|tvN|ENA|EBS|TV조선|채널A|MBN|Arirang|아리랑|CJ\s*ENM|M2|SBSKPOP|MBCkpop|KBS\s*Kpop|스튜디오\s*춤|STUDIO\s*CHOOM|1theK|원더케이|it's\s*Live|잇츠라이브)/i.test(n);
}

export function isTvMainBroadcast(item, channel) {
  const t = (item.title || '').replace(/[<>]/g, '').trim();
  const c = String(channel || '').trim();
  const isBroadcaster = /^(?:MBC|KBS|KBS2|SBS|Mnet|JTBC|tvN|ENA|EBS|TV조선|채널A|MBN)/i.test(c);
  if (!isBroadcaster) return false;

  if (/미방분|비하인드|선공개|직캠|fancam|풀버전|클립|behind|up코노|코없코|우쥬레코드|웹예능|아이돌부스/i.test(t + ' ' + (item.message || ''))) {
    return false;
  }

  if (/전지적\s*참견\s*시점|전참시|놀라운\s*토요일|놀토|복면가왕|아는\s*형님|뮤직뱅크|쇼!?\s*음악중심|인기가요|m\s*countdown|엠카운트다운|쇼!?\s*챔피언|더쇼|the\s*show|심플리\s*케이팝|simply\s*k-pop|식객\s*허영만의\s*백반기행|열혈농구단|최우수산|배성재의\s*텐|아이돌\s*라디오|친한친구/i.test(t)) {
    return true;
  }
  return false;
}

export async function enrichSchedulesWithYouTubeOEmbed(schedules) {
  if (!Array.isArray(schedules) || schedules.length === 0) return;
  const oembedCache = new Map();

  for (let item of schedules) {
    const text = [item.url, item.link, item.message, item.title].filter(Boolean).join(' ');
    const match = text.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/);
    if (!match) continue;

    const vid = match[1];
    let oeData = oembedCache.get(vid);
    if (!oeData) {
      try {
        const oeRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vid}&format=json`);
        if (oeRes.ok) {
          oeData = await oeRes.json();
          oembedCache.set(vid, oeData);
        }
      } catch (e) { }
    }

    if (oeData) {
      // 1) 썸네일 및 링크 보강
      if (!item.thumbnail || item.thumbnail.includes('rescene-logo')) {
        item.thumbnail = oeData.thumbnail_url || `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
      }
      if (!item.url) item.url = `https://www.youtube.com/watch?v=${vid}`;
      if (!item.link) item.link = item.url;

      // 2) 채널명 처리 (단, 방송사인 경우는 방송사 명을 채널명으로 유지!)
      const currentChannel = item.channel || (item.extField && (item.extField.key === '채널' || item.extField.key === '방송사') ? item.extField.value : null);
      if (!currentChannel || !isBroadcasterName(currentChannel)) {
        const author = oeData.author_name;
        if (author) {
          item.channel = author;
          item.extField = { key: '채널', value: author };
        }
      }

      // 3) 제목 재구성: TV 본방이 아닌 경우 oEmbed의 정식 제목으로 전면 변환
      const isTvShow = isTvMainBroadcast(item, currentChannel);
      if (!isTvShow && oeData.title) {
        item.title = oeData.title;
      }

      // 4) 카테고리(typeText) 정돈: TV 본방이 아니고 공식 채널/웹 콘텐츠면 "영상"으로 보정
      if (!isTvShow) {
        if (/RESCENE|안녕하세요원이|자컨|비하인드|vlog|브이로그|ep\.|유튜브|youtube/i.test((item.channel || '') + ' ' + (item.title || '') + ' ' + (item.message || ''))) {
          item.typeText = "영상";
        }
      }
    }
  }
}

export function cleanDisplayTitle(title, maxLength = 0) {
  if (!title) return "";
  // 시스템 카테고리 접두어 제거, 끝단 해시태그/채널 접미사 정돈 및 길이 조정
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

export function getScheduleTypeInfo(item) {
  let typeText = item.typeText || "";

  // 0. 공식 유튜브 영상(source === 'youtube')은 100% 최우선 "영상" 확정
  if (item.source === 'youtube') {
    return { typeText: "영상", bg: "#e0f7fa", color: "#00838f" };
  }

  // 1. [태그] 형식 추출 및 이모지 표준화
  const combinedText = `${item.title || ""} ${item.message || ""} ${(item.extField && item.extField.value) || ""} ${item.url || ""} ${item.link || ""}`;
  const bracketMatch = combinedText.match(/\[(.*?)\]/);
  if (!typeText && bracketMatch) {
    const rawTag = bracketMatch[1].trim();
    if (rawTag === '🎬') typeText = "영상";
    else if (rawTag === '🎉') typeText = "기념일";
    else if (rawTag === '🎤') typeText = "행사";
    else if (rawTag === '💿') typeText = "릴리즈";
    else if (rawTag === '📺' || rawTag === '📻') typeText = "방송";
    else if (['방송', '영상', '공식 영상', '행사', '팬이벤트', '기념일', '릴리즈', '일정'].includes(rawTag)) {
      typeText = rawTag;
    }
  }

  // 2. typeId 기반 매핑 (Blip 표준 코드: 5=행사, 1=방송, 4=기념일 등)
  if (!typeText && item.typeId) {
    const typeMap = {
      1: "방송",
      2: "릴리즈",
      3: "영상",
      4: "기념일",
      5: "행사",
      6: "팬이벤트",
      7: "일정"
    };
    typeText = typeMap[item.typeId] || "";
  }

  const lower = combinedText.toLowerCase();

  // ★ 3. 유튜브 공식 채널/자체콘텐츠/비하인드/브이로그 최우선 보정 (메라디오, 원쨩먹짱, 까엉TV 등)
  const isOfficialYoutube = (
    /안녕하세요원이입니다|안원잘부|@helloiamwoninicetomeetyou|helloiamwoni|@rescene_official|rescene_official/i.test(lower) ||
    /자컨|비하인드|behind|vlog|브이로그|ep\.|먹짱|메라디오|까엉tv/i.test(lower)
  );

  if (isOfficialYoutube && !/kcon|케이콘|어워즈|awards|쇼케이스|showcase|페스티벌|콘서트|팬사인|팬미팅/i.test(lower)) {
    typeText = "영상";
  }

  // ★ 4. TV / 라디오 / 음악방송 / 예능 프로그램 보정 (전참시 등)
  if (!typeText || typeText === "일정" || (!isOfficialYoutube && typeText === "영상")) {
    const isTvBroadcast = /전참시|전지적\s*참견\s*시점|놀라운\s*토요일|놀토|아는\s*형님|아형|런닝맨|라디오스타|라스|복면가왕|주간\s*아이돌|주간아|아이돌\s*리그|쇼챔피언|쇼챔|엠카운트다운|엠카|뮤직뱅크|뮤뱅|인기가요|인가|더쇼|음악중심|음중|심플리케이팝|simply\s*k-pop|방송|tv|on air|생방송|본방|재방|mbc|kbs|sbs|mnet|jtbc|tvn|ena|ebs|정오의 희망곡|가요광장|영스트리트|키스 더 라디오|꿈꾸는 라디오|친한친구|별이 빛나는 밤에|두시탈출|컬투쇼|아이돌 라디오|idol radio|fm4u|power fm/i.test(lower);

    if (isTvBroadcast && !isOfficialYoutube) {
      typeText = "방송";
    }
  }

  // ★ 4. 지능형 키워드 기반 우선순위 정밀 분류
  if (!typeText || typeText === "일정") {
    // 4-1. 오프라인 행사 / 공연 / 페스티벌 / 쇼케이스 / 시상식
    if (/kcon|케이콘|어워즈|awards|쇼케이스|showcase|페스티벌|festival|콘서트|concert|행사|공연|축제|드림콘서트|시구|시타|위촉식|풀파티|썸머소닉/i.test(lower)) {
      typeText = "행사";
      // 4-2. 팬사인회 / 팬이벤트 / 팬미팅 (일반 단어 meet 오매칭 방지)
    } else if (/팬사인회|팬사인|팬싸인회|팬싸|팬미팅|fan\s*meeting|fan\s*sign|영통\s*팬|대면\s*팬|대면\s*팬싸|대면\s*사인/i.test(lower)) {
      typeText = "팬이벤트";
      // 4-3. TV / 라디오 / 음악방송
    } else if (/쇼챔피언|쇼챔|엠카운트다운|엠카|뮤직뱅크|뮤뱅|인기가요|인가|더쇼|음악중심|음중|심플리케이팝|simply\s*k-pop|방송|라디오|예능|tv|on air|live|생방송|본방|재방|mbc|kbs|sbs|mnet|jtbc|tvn|ena|ebs|아리랑|arirang|스튜디오|studio|정오의 희망곡|가요광장|영스트리트|키스 더 라디오|꿈꾸는 라디오|친한친구|별이 빛나는 밤에|두시탈출|컬투쇼|아이돌 라디오|idol radio|fm4u|power fm/i.test(lower)) {
      typeText = "방송";
      // 4-4. 멤버 생일 / 기념일
    } else if (/기념일|생일|birthday|happy|day|데뷔|anniversary/i.test(lower)) {
      typeText = "기념일";
      // 4-5. 음원 / 앨범 / 릴리즈
    } else if (/릴리즈|발매|release|album|mv|뮤비|음원/i.test(lower)) {
      typeText = "릴리즈";
      // 4-6. 유튜브 공식 채널 영상 / 자체콘텐츠 / 안원잘부 / 비하인드 / 브이로그
    } else if (
      /@helloiamwoninicetomeetyou|helloiamwoni|안원잘부|안녕하세요원이|@rescene_official|rescene_official|자컨|비하인드|behind|vlog|브이로그|ep\.|shorts|쇼츠|릴스|reels|full ver|풀버전/i.test(lower) ||
      /youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|@helloiamwoninicetomeetyou|@rescene_official)/i.test(lower)
    ) {
      typeText = "영상";
    } else {
      typeText = typeText || "일정";
    }
  }

  let bg = "#e3f2fd", color = "#1976d2";
  if (typeText.includes("영상") || typeText.includes("콘텐츠") || typeText.includes("미디어")) {
    bg = "#e0f7fa"; color = "#00838f"; // 산뜻한 청록/시안 (유튜브/영상)
  } else if (typeText.includes("방송") || typeText.includes("라디오")) {
    bg = "#ffe4ec"; color = "#d63384"; // 화사한 핑크 (TV/라디오 방송)
  } else if (typeText.includes("행사") || typeText.includes("공연") || typeText.includes("쇼케이스")) {
    bg = "#e2f0d9"; color = "#2e7d32"; // 싱그러운 초록 (행사/공연)
  } else if (typeText.includes("팬사인") || typeText.includes("팬싸") || typeText.includes("팬이벤트") || typeText.includes("팬미팅")) {
    bg = "#f3e5f5"; color = "#7b1fa2"; // 세련된 보라 (팬이벤트)
  } else if (typeText.includes("기념일") || typeText.includes("생일")) {
    bg = "#fff9c4"; color = "#e65100"; // 밝은 골드/오렌지 (기념일)
  } else if (typeText.includes("릴리즈") || typeText.includes("발매")) {
    bg = "#ffe0b2"; color = "#bf360c"; // 코랄/오렌지 (릴리즈)
  }

  return { typeText, bg, color };
}

// 공식 채널 / 원이 채널 영상 일정 제목 앞 미니 엠블럼 아이콘 생성
export function getChannelIconHTML(item, { isSmall = false } = {}) {
  if (!item) return '';

  const size = isSmall ? 11 : 14;
  const margin = isSmall ? 'margin-right:2px; vertical-align:-1px;' : 'margin-right:4px; vertical-align:-2px;';

  const channelName = String(item.channel || (item.extField && item.extField.value) || '').trim();

  // 1. 원이 개인 채널
  const isWoni = Boolean(item.isWoniYoutube) ||
    channelName === '안녕하세요원이입니다잘부탁드립니다' ||
    item.channelKey === 'helloiamwoni';

  if (isWoni) {
    return `<img src="icons/hellowoni_profile.jpg" class="sched-channel-icon woni" style="width:${size}px; height:${size}px; border-radius:50%; ${margin} object-fit:cover; display:inline-block; border:1px solid rgba(255,105,180,0.4); flex-shrink:0;" alt="원이채널" title="안녕하세요원이입니다잘부탁드립니다">`;
  }

  // 2. RESCENE 공식 채널 (공식 유튜브 계정이 직접 올린 영상에만 표시)
  const isExplicitNonOfficialChannel = Boolean(channelName && 
    channelName !== '공식 유튜브' && 
    channelName !== 'RESCENE' && 
    !/^RESCENE\s*공식/i.test(channelName));

  const isOfficial = !isExplicitNonOfficialChannel && (
    channelName === '공식 유튜브' ||
    channelName === 'RESCENE' ||
    (item.source === 'youtube' && !isExplicitNonOfficialChannel) ||
    (Boolean(item.isOfficialYoutube) && (channelName === 'RESCENE' || channelName === '공식 유튜브'))
  );

  if (isOfficial) {
    return `<img src="icons/rescene_official_profile.jpg" class="sched-channel-icon official" style="width:${size}px; height:${size}px; border-radius:50%; ${margin} object-fit:cover; display:inline-block; border:1px solid rgba(255,105,180,0.4); flex-shrink:0;" alt="공식채널" title="RESCENE 공식 유튜브 채널">`;
  }

  return '';
}

export function renderScheduleList(container, schedules = [], isDark = false, onSelectDate) {
  if (!container) return;

  // 지능형 중복 병합 및 제외 필터 적용
  schedules = deduplicateScheduleList(schedules);

  if (!schedules || schedules.length === 0) {
    container.innerHTML = '<div class="schedule-item">예정된 스케줄이 없습니다.</div>';
    return;
  }

  // 시작 시간 순 정렬 보장
  schedules.sort((a, b) => {
    const tA = parseSafeDate(a.startTime || a.date).getTime();
    const tB = parseSafeDate(b.startTime || b.date).getTime();
    return tA - tB;
  });

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nowTime = now.getTime();

  // 1순위: 오늘 날짜(YYYY-MM-DD)와 일치하는 일정
  let todayIndices = [];
  schedules.forEach((item, idx) => {
    const d = parseSafeDate(item.startTime || item.date);
    const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (dStr === todayStr) {
      todayIndices.push(idx);
    }
  });

  let nextIndex = -1;
  if (todayIndices.length > 0) {
    const upcomingToday = todayIndices.find(idx => {
      const item = schedules[idx];
      const endT = item.endTime ? parseSafeDate(item.endTime).getTime() : parseSafeDate(item.startTime || item.date).getTime();
      return endT >= nowTime;
    });
    // 오늘 진행 중이거나 예정된 일정이 있으면 그 중 첫 번째, 오늘 일정이 모두 종료되었으면 현재 시점과 가장 가까운 오늘의 마지막 일정 선택
    nextIndex = upcomingToday !== undefined ? upcomingToday : todayIndices[todayIndices.length - 1];
  }

  // 2순위: 오늘 일정이 없으면 오늘 이후 첫 번째 미래 일정
  if (nextIndex === -1) {
    nextIndex = schedules.findIndex(item => parseSafeDate(item.startTime || item.date).getTime() >= nowTime);
  }

  // 3순위: 미래 일정도 없으면 가장 최근 과거 일정 (마지막 항목)
  if (nextIndex === -1) {
    nextIndex = Math.max(0, schedules.length - 1);
  }

  // 기준점(오늘/가장 가까운 예정 일정) 중심: 전 40개 + 후 40개 넉넉한 초기 로드로 스크롤 끊김 완전 제거
  const CHUNK_SIZE = 40;
  let startIndex = Math.max(0, nextIndex - CHUNK_SIZE);
  let endIndex = Math.min(schedules.length, nextIndex + CHUNK_SIZE + 1);

  // 개별 일정 아이템 HTML 생성 함수
  function createItemHTML(item, globalIdx) {
    let dateLabel = "일정";
    let timeStr = "";
    const rawDate = item.startTime || item.date;

    if (rawDate) {
      const d = parseSafeDate(rawDate);
      const currentYear = new Date().getFullYear();
      const itemYear = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');

      if (itemYear !== currentYear) {
        // 올해가 아니면 연도 표기 (예: '24.03/26)
        const shortYear = String(itemYear).slice(2);
        dateLabel = `'${shortYear}.${month}/${day}`;
      } else {
        dateLabel = `${month}/${day}`;
      }

      let h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, '0');
      const isAllDay = Boolean(item.isAllday || (h === 0 && m === '00' && String(rawDate).includes('T15:00:00')));
      if (!isAllDay) {
        const ap = h >= 12 ? '오후' : '오전';
        const displayH = h % 12 || 12;
        timeStr = ` ${ap} ${displayH}:${m}`;
      } else {
        timeStr = " 종일";
      }
    }

    const { typeText, bg, color } = getScheduleTypeInfo(item);
    let typeBadge = '';
    if (typeText) {
      typeBadge = `<span class="schedule-type-badge" style="background:${bg}; color:${color}; padding:2px 6px; border-radius:4px; font-size:10.5px; font-weight:600; margin:0 4px; flex-shrink:0;">${escapeHtml(typeText)}</span>`;
    }

    const fullTitle = cleanDisplayTitle(item.title || item.message || '스케줄');
    const cleanTitle = cleanDisplayTitle(item.title || item.message || '스케줄', 42);
    let extraInfo = '';
    const ext = item.extField;
    const loc = item.location || (ext && ext.key === '장소' ? ext.value : null);
    const ch = item.channel || (ext && (ext.key === '채널' || ext.key === '방송사') ? ext.value : null);

    if (loc && String(loc).trim()) {
      extraInfo = ` <span class="schedule-ext-info" style="color:#888; font-size:10.5px; margin-left:4px; display:inline-flex; align-items:center; gap:2px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; flex-shrink:0;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>${escapeHtml(String(loc).trim())}</span>`;
    } else if (ch && String(ch).trim()) {
      extraInfo = ` <span class="schedule-ext-info" style="color:#888; font-size:10.5px; margin-left:4px; display:inline-flex; align-items:center; gap:2px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; flex-shrink:0;"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>${escapeHtml(String(ch).trim())}</span>`;
    } else if (ext && ext.value && String(ext.value).trim()) {
      const keyLabel = ext.key ? `${ext.key}: ` : '';
      extraInfo = ` <span class="schedule-ext-info" style="color:#888; font-size:10.5px; margin-left:4px;">(${escapeHtml(keyLabel)}${escapeHtml(String(ext.value).trim())})</span>`;
    }

    const channelIconHtml = getChannelIconHTML(item);
    const titleText = escapeHtml(cleanTitle);
    const isNext = (globalIdx === nextIndex);
    const activeClass = isNext ? ' active' : '';

    return `
      <div class="schedule-item${activeClass}" data-date="${escapeHtml(rawDate)}" data-index="${globalIdx}" title="${escapeHtml(fullTitle)}">
        <div class="schedule-line">
          <span class="schedule-date-time">[${dateLabel}${timeStr}]</span>
          ${typeBadge}
          <span class="schedule-title">${channelIconHtml}${titleText}${extraInfo}</span>
        </div>
      </div>
    `;
  }

  // 초기 렌더링
  let initialHtml = '';
  for (let i = startIndex; i < endIndex; i++) {
    initialHtml += createItemHTML(schedules[i], i);
  }
  container.innerHTML = initialHtml;

  const scrollEl = container.closest('.schedule-container') || container;

  // 초기 포커스: 활성화된(가장 가까운 예정) 일정으로 정밀하게 스크롤 이동
  const focusActiveItem = () => {
    const doScroll = () => {
      const activeEl = container.querySelector('.schedule-item.active');
      if (activeEl && scrollEl) {
        const activeRect = activeEl.getBoundingClientRect();
        const scrollRect = scrollEl.getBoundingClientRect();
        if (scrollRect.height > 0 && activeRect.height > 0) {
          const diff = (activeRect.top - scrollRect.top) - (scrollRect.height / 2) + (activeRect.height / 2);
          scrollEl.scrollTop = Math.max(0, scrollEl.scrollTop + diff);
        } else if (scrollEl.clientHeight > 0) {
          const targetTop = activeEl.offsetTop - (scrollEl.clientHeight / 2) + (activeEl.offsetHeight / 2);
          scrollEl.scrollTop = Math.max(0, targetTop);
        }
      }
    };

    requestAnimationFrame(doScroll);
    setTimeout(doScroll, 40);
    setTimeout(doScroll, 120);
    setTimeout(doScroll, 300);
  };
  focusActiveItem();

  // 상/하단 로드 실행 함수
  let isScrollingLoading = false;

  function loadPastItems() {
    if (isScrollingLoading || startIndex <= 0) return;
    isScrollingLoading = true;
    const oldScrollHeight = scrollEl.scrollHeight;
    const oldScrollTop = scrollEl.scrollTop;

    const prevStart = startIndex;
    startIndex = Math.max(0, startIndex - CHUNK_SIZE);

    const fragment = document.createDocumentFragment();
    for (let i = startIndex; i < prevStart; i++) {
      const temp = document.createElement('div');
      temp.innerHTML = createItemHTML(schedules[i], i);
      fragment.appendChild(temp.firstElementChild);
    }
    container.insertBefore(fragment, container.firstElementChild);

    // 스크롤 점프 방지 (사용자 시야 유지)
    const heightDiff = scrollEl.scrollHeight - oldScrollHeight;
    scrollEl.scrollTop = oldScrollTop + heightDiff;

    setTimeout(() => { isScrollingLoading = false; }, 60);
  }

  function loadFutureItems() {
    if (isScrollingLoading || endIndex >= schedules.length) return;
    isScrollingLoading = true;
    const prevEnd = endIndex;
    endIndex = Math.min(schedules.length, endIndex + CHUNK_SIZE);

    const fragment = document.createDocumentFragment();
    for (let i = prevEnd; i < endIndex; i++) {
      const temp = document.createElement('div');
      temp.innerHTML = createItemHTML(schedules[i], i);
      fragment.appendChild(temp.firstElementChild);
    }
    container.appendChild(fragment);

    setTimeout(() => { isScrollingLoading = false; }, 60);
  }

  // 양방향 무한 스크롤 핸들러 (위/아래 250px 사전 감지로 끊김 없는 매끄러운 추가 로드)
  scrollEl.onscroll = () => {
    if (scrollEl.scrollTop <= 250 && startIndex > 0) {
      loadPastItems();
    } else if (scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 250 && endIndex < schedules.length) {
      loadFutureItems();
    }
  };

  // 휠(Wheel) 바운스 감지 (최상단/최하단 도달 시 추가 스크롤 감지, passive 리스너로 100% 네이티브 스크롤 보장)
  scrollEl.addEventListener('wheel', (e) => {
    if (e.deltaY < 0 && scrollEl.scrollTop <= 10 && startIndex > 0) {
      loadPastItems();
    } else if (e.deltaY > 0 && scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 10 && endIndex < schedules.length) {
      loadFutureItems();
    }
  }, { passive: true });

  // 클릭 이벤트 위임 (동적으로 추가된 일정 아이템도 안정적으로 모달 오픈)
  container.onclick = (e) => {
    const el = e.target.closest('.schedule-item');
    if (!el || !container.contains(el)) return;

    container.querySelectorAll('.schedule-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');

    const idx = parseInt(el.getAttribute('data-index'), 10);
    const item = schedules[idx];
    if (item) {
      const d = parseSafeDate(item.startTime || item.date);
      const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
      let h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, '0');
      const isAllDay = Boolean(item.isAllday || (h === 0 && m === '00' && String(item.startTime || item.date).includes('T15:00:00')));
      const ap = h >= 12 ? '오후' : '오전';
      const displayH = h % 12 || 12;
      const timeStr = isAllDay ? '종일 일정' : `${ap} ${displayH}:${m}`;
      const { typeText } = getScheduleTypeInfo(item);

      const ext = item.extField;
      showScheduleModal({
        title: item.title || item.message || '스케줄 상세 정보',
        date: dateStr,
        time: timeStr,
        type: typeText,
        location: item.location || (ext && ext.key === '장소' ? ext.value : ''),
        channel: item.channel || (ext && (ext.key === '채널' || ext.key === '방송사') ? ext.value : ''),
        extField: ext || null,
        detail: item.message || item.description || item.detail || item.title,
        link: item.url || item.link,
        starAttendees: item.starAttendees || [],
        resolvedMediaUrls: item.resolvedMediaUrls || []
      });
    }

    if (typeof onSelectDate === 'function') {
      const date = el.getAttribute('data-date');
      onSelectDate(date);
    }
  };
}

/* =========================================================================
   6. 캘린더 렌더러 & 인터랙션 (Calendar Renderer & Interactions)
   ========================================================================= */

export function renderCalendar(gridEl, titleEl, currentDate, schedules = [], onSelectEvent) {
  if (!gridEl) return;

  // 지능형 중복 병합 및 제외 필터 적용
  schedules = deduplicateScheduleList(schedules);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  if (titleEl) {
    titleEl.textContent = `${year}년 ${month + 1}월`;
  }

  gridEl.innerHTML = '';

  const firstDayIndex = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const prevLastDay = new Date(year, month, 0).getDate();

  let daysArr = [];
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    daysArr.push({ day: prevLastDay - i, isCurrentMonth: false, dateStr: "" });
  }
  for (let i = 1; i <= lastDay; i++) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(i).padStart(2, '0');
    daysArr.push({ day: i, isCurrentMonth: true, dateStr: `${year}-${mm}-${dd}` });
  }

  const totalCells = daysArr.length <= 35 ? 35 : 42;
  let nextDayNum = 1;
  while (daysArr.length < totalCells) {
    daysArr.push({ day: nextDayNum++, isCurrentMonth: false, dateStr: "" });
  }

  const today = new Date();
  let weeksArr = [];
  for (let i = 0; i < daysArr.length; i += 7) {
    weeksArr.push(daysArr.slice(i, i + 7));
  }

  // 1. 각 스케줄 항목 정규화 (시작일/종료일 및 multi-day 여부 판단)
  const normalizedSchedules = schedules.map((item, idx) => {
    const startRaw = item.startTime || item.date;
    const endRaw = item.endTime || item.startTime || item.date;
    const startD = parseSafeDate(startRaw);
    const endD = parseSafeDate(endRaw);

    const startY = startD.getFullYear();
    const startM = String(startD.getMonth() + 1).padStart(2, '0');
    const startDay = String(startD.getDate()).padStart(2, '0');
    const startStr = `${startY}-${startM}-${startDay}`;

    const endY = endD.getFullYear();
    const endM = String(endD.getMonth() + 1).padStart(2, '0');
    const endDay = String(endD.getDate()).padStart(2, '0');
    const endStr = `${endY}-${endM}-${endDay}`;

    const isMulti = (startStr !== endStr) && (endD.getTime() > startD.getTime());

    return {
      ...item,
      id: item.id || `sched-${idx}`,
      startDateStr: startStr,
      endDateStr: endStr,
      isMultiDay: isMulti,
      spanGroupId: isMulti ? `span-grp-${idx}-${startStr.replace(/\D/g, '')}` : null
    };
  });

  // 2. 주(Week)별 행 렌더링
  weeksArr.forEach((weekDays) => {
    const weekRow = document.createElement("div");
    weekRow.className = "calendar-week-row";

    weekDays.forEach(cellInfo => {
      const cell = document.createElement("div");
      cell.className = `calendar-cell ${cellInfo.isCurrentMonth ? '' : 'other-month'}`;

      const isToday = cellInfo.isCurrentMonth &&
        today.getDate() === cellInfo.day &&
        today.getMonth() === month &&
        today.getFullYear() === year;
      if (isToday) cell.classList.add("today");

      cell.innerHTML = `<div class="cell-date">${cellInfo.day}</div><div class="cell-events"></div>`;
      const eventsContainer = cell.querySelector(".cell-events");

      if (cellInfo.isCurrentMonth && cellInfo.dateStr) {
        // 해당 날짜에 해당하는 모든 스케줄 조회 (단일일 일치 또는 연속 일정 기간 내 포함)
        const daySchedules = normalizedSchedules.filter(item => {
          if (item.isMultiDay) {
            return cellInfo.dateStr >= item.startDateStr && cellInfo.dateStr <= item.endDateStr;
          }
          return item.startDateStr === cellInfo.dateStr;
        });

        daySchedules.forEach(item => {
          const { typeText, bg, color } = getScheduleTypeInfo(item);
          const badge = document.createElement("div");
          badge.className = "cal-event-badge";
          badge.style.background = bg;
          badge.style.color = color;

          let timeStrForHover = "";
          let timeStrForModal = "";
          const rawDate = item.startTime || item.date;

          if (rawDate) {
            const d = parseSafeDate(rawDate);
            let h = d.getHours();
            const m = String(d.getMinutes()).padStart(2, '0');
            const isAllDay = Boolean(item.isAllday || (h === 0 && m === '00' && String(rawDate).includes('T15:00:00')));
            if (!isAllDay) {
              const ap = h >= 12 ? '오후' : '오전';
              const displayH = h % 12 || 12;
              timeStrForHover = `${ap} ${displayH}:${m}`;
              timeStrForModal = `${ap} ${displayH}:${m}`;
            } else {
              timeStrForModal = item.isMultiDay ? "연속 일정" : "종일 일정";
            }
          }

          const fullPureTitle = cleanDisplayTitle(item.title || item.message || '일정');
          const titleText = escapeHtml(fullPureTitle);
          const displayTitle = typeText ? `[${typeText}] ${fullPureTitle}` : fullPureTitle;
          const dateForModal = item.isMultiDay ? `${item.startDateStr} ~ ${item.endDateStr}` : cellInfo.dateStr;

          const channelIconSmall = getChannelIconHTML(item, { isSmall: true });

          // 특정 시간이 존재하는 일정에 한해서만 호버 시 시간 + 아이콘 라인 생성
          const hoverTimeHtml = timeStrForHover
            ? `<div class="badge-hover-time"><span class="badge-hover-time-text">${escapeHtml(timeStrForHover)}</span>${channelIconSmall ? `<span class="badge-hover-channel-icon">${channelIconSmall}</span>` : ''}</div>`
            : '';
          const contentHtml = `<div class="badge-main-content">${channelIconSmall}<span class="badge-title-text">${titleText}</span></div>`;

          // 연속 일정인 경우 스타일 및 그룹 식별자 추가
          if (item.isMultiDay) {
            badge.classList.add("multi-day-badge");
            badge.setAttribute('data-span-group', item.spanGroupId);

            if (cellInfo.dateStr === item.startDateStr) {
              badge.classList.add("span-start");
            } else if (cellInfo.dateStr === item.endDateStr) {
              badge.classList.add("span-end");
            } else {
              badge.classList.add("span-middle");
            }

            badge.innerHTML = `${hoverTimeHtml}${contentHtml}`;
            badge.title = `${displayTitle} (${item.startDateStr} ~ ${item.endDateStr})`;

            // 연속 일정 그룹 동시 마우스 오버 하이라이트
            badge.addEventListener("mouseenter", () => {
              const siblings = gridEl.querySelectorAll(`[data-span-group="${item.spanGroupId}"]`);
              siblings.forEach(el => el.classList.add("span-hover-active"));
            });

            badge.addEventListener("mouseleave", () => {
              const siblings = gridEl.querySelectorAll(`[data-span-group="${item.spanGroupId}"]`);
              siblings.forEach(el => el.classList.remove("span-hover-active"));
            });
          } else {
            badge.innerHTML = `${hoverTimeHtml}${contentHtml}`;
            badge.title = `${displayTitle}${timeStrForModal ? ` (${timeStrForModal})` : ''}`;
          }

          badge.addEventListener("click", (e) => {
            e.stopPropagation();
            if (typeof onSelectEvent === 'function') {
              const ext = item.extField;
              onSelectEvent({
                title: displayTitle,
                pureTitle: fullPureTitle,
                channelIconHtml: getChannelIconHTML(item),
                date: dateForModal,
                time: timeStrForModal,
                type: typeText,
                location: item.location || (ext && ext.key === '장소' ? ext.value : ''),
                channel: item.channel || (ext && (ext.key === '채널' || ext.key === '방송사') ? ext.value : ''),
                extField: ext || null,
                detail: item.message || item.description || '',
                starAttendees: item.starAttendees || [],
                url: item.url || item.link || ''
              });
            }
          });

          eventsContainer.appendChild(badge);
        });
      }

      weekRow.appendChild(cell);
    });

    gridEl.appendChild(weekRow);
  });
}

/* =========================================================================
   7. 임베드 & iframe 렌더러 (Embed & Iframe Renderers)
   ========================================================================= */


export function initCalendarManager({
  gridId = 'spCalendarGrid',
  titleId = 'spCalendarMonthTitle',
  prevBtnId = 'spPrevMonthBtn',
  nextBtnId = 'spNextMonthBtn',
  todayMonthBtnId = 'spTodayMonthBtn',
  todayListBtnId = 'spTodayListBtn',
  calViewId = 'spCalendarView',
  listViewId = 'spScheduleListView',
  tabListId = 'tabScheduleList',
  viewCalBtnId = 'spViewCalBtn',
  viewListBtnId = 'spViewListBtn',
  navControlsId = 'spCalendarNavControls',
  listNavControlsId = 'spScheduleListNavControls',
  initialDate = new Date()
} = {}) {
  let currentDate = new Date(initialDate);
  let globalSchedules = [];
  let currentMode = 'calendar'; // 'calendar' | 'list'

  const gridEl = typeof gridId === 'string' ? document.getElementById(gridId) : gridId;
  const titleEl = typeof titleId === 'string' ? document.getElementById(titleId) : titleId;
  const prevBtn = typeof prevBtnId === 'string' ? document.getElementById(prevBtnId) : prevBtnId;
  const nextBtn = typeof nextBtnId === 'string' ? document.getElementById(nextBtnId) : nextBtnId;
  const todayMonthBtn = typeof todayMonthBtnId === 'string' ? document.getElementById(todayMonthBtnId) : todayMonthBtnId;
  const todayListBtn = typeof todayListBtnId === 'string' ? document.getElementById(todayListBtnId) : todayListBtnId;
  const calView = typeof calViewId === 'string' ? document.getElementById(calViewId) : calViewId;
  const listView = typeof listViewId === 'string' ? document.getElementById(listViewId) : listViewId;
  const tabListEl = typeof tabListId === 'string' ? document.getElementById(tabListId) : tabListId;
  const viewCalBtn = typeof viewCalBtnId === 'string' ? document.getElementById(viewCalBtnId) : viewCalBtnId;
  const viewListBtn = typeof viewListBtnId === 'string' ? document.getElementById(viewListBtnId) : viewListBtnId;
  const navControls = typeof navControlsId === 'string' ? document.getElementById(navControlsId) : navControlsId;
  const listNavControls = typeof listNavControlsId === 'string' ? document.getElementById(listNavControlsId) : listNavControlsId;

  function update() {
    if (gridEl) {
      renderCalendar(gridEl, titleEl, currentDate, globalSchedules, (eventData) => {
        showScheduleModal(eventData);
      });
    }
    if (tabListEl && globalSchedules.length > 0) {
      renderScheduleList(tabListEl, globalSchedules);
    }
  }

  function setMode(mode) {
    currentMode = mode;
    if (mode === 'calendar') {
      if (calView) calView.style.display = '';
      if (listView) listView.style.display = 'none';
      if (viewCalBtn) viewCalBtn.classList.add('active');
      if (viewListBtn) viewListBtn.classList.remove('active');
      if (navControls) navControls.style.display = 'flex';
      if (listNavControls) listNavControls.style.display = 'none';
    } else {
      if (calView) calView.style.display = 'none';
      if (listView) listView.style.display = '';
      if (viewCalBtn) viewCalBtn.classList.remove('active');
      if (viewListBtn) viewListBtn.classList.add('active');
      if (navControls) navControls.style.display = 'none';
      if (listNavControls) listNavControls.style.display = 'flex';
      if (tabListEl && globalSchedules.length > 0) {
        renderScheduleList(tabListEl, globalSchedules);
      }
    }
  }

  if (viewCalBtn) {
    viewCalBtn.addEventListener('click', () => setMode('calendar'));
  }
  if (viewListBtn) {
    viewListBtn.addEventListener('click', () => setMode('list'));
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      update();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      update();
    });
  }

  if (todayMonthBtn) {
    todayMonthBtn.addEventListener('click', () => {
      currentDate = new Date();
      update();
    });
  }

  if (todayListBtn) {
    todayListBtn.addEventListener('click', () => {
      if (tabListEl && globalSchedules.length > 0) {
        renderScheduleList(tabListEl, globalSchedules);
        const activeItem = tabListEl.querySelector('.sched-list-item.nearest-active') || tabListEl.querySelector('.sched-list-item.today');
        if (activeItem) {
          activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });
  }

  return {
    setSchedules: (schedules) => {
      globalSchedules = schedules || [];
      update();
    },
    refresh: update,
    setMode,
    getMode: () => currentMode,
    getCurrentDate: () => currentDate,
    setDate: (newDate) => {
      currentDate = new Date(newDate);
      update();
    }
  };
}

// 스토리지 데이터 자동 로드 & 영상/라이브/채널순서/스케줄 일괄 초기화 엔진
