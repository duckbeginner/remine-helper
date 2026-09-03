// scripts/data-hub/collectors/schedule.js
// 블립(Blip) & Mnet Plus 스케줄 수집, 정제, 지능형 중복 병합 엔진

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
export async function collectScheduleData() {
  console.log("▶ [Schedule] 데이터 수집 시작 (Blip & Mnet Plus)...");

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;

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
    const newDateStr = `${newD.getFullYear()}-${String(newD.getMonth() + 1).padStart(2, '0')}-${String(newD.getDate()).padStart(2, '0')}`;

    let matchIdx = -1;
    for (let i = 0; i < mergedList.length; i++) {
      const existD = parseSafeDate(mergedList[i].startTime);
      const existDateStr = `${existD.getFullYear()}-${String(existD.getMonth() + 1).padStart(2, '0')}-${String(existD.getDate()).padStart(2, '0')}`;

      if (newDateStr === existDateStr && areSchedulesDuplicate(mergedList[i], newItem)) {
        matchIdx = i;
        break;
      }
    }

    if (matchIdx !== -1) {
      const target = mergedList[matchIdx];
      target.title = pickBestTitle(target.title, newItem.title);
      if (!target.url && newItem.url) target.url = newItem.url;
      if (!target.typeText && newItem.typeText) target.typeText = newItem.typeText;
      if (!target.location && newItem.location) target.location = newItem.location;
      if (!target.channel && newItem.channel) target.channel = newItem.channel;
      if (!target.starAttendees || target.starAttendees.length === 0) target.starAttendees = newItem.starAttendees;
    } else {
      mergedList.push({ ...newItem });
    }
  });

  // 날짜 순 정렬
  mergedList.sort((a, b) => parseSafeDate(a.startTime).getTime() - parseSafeDate(b.startTime).getTime());

  console.log(`✓ [Schedule] 완료: 총 ${allRaw.length}건 중 ${mergedList.length}건 병합 완료`);

  return {
    totalCount: mergedList.length,
    items: mergedList
  };
}
