// common/modules/calendar.js - 스케줄 중복제거, 캘린더 매니저 및 뷰 렌더러
import { MEMBER_ID_MAP, MEMBER_NICKNAME_MAP, MEMBER_AVATAR_MAP } from '../../constants.js';
import { parseSafeDate, cleanScheduleText, cleanDisplayTitle, escapeHtml, getKstDateString } from './utils.js';
import { showScheduleModal } from './modals.js';

export { parseSafeDate, cleanScheduleText, cleanDisplayTitle, getKstDateString };

export function getMemberAttendeeBadgesHTML(attendees) {
  if (!Array.isArray(attendees) || attendees.length === 0) return '';

  const badges = attendees.map(a => {
    if (!a) return '';
    let realName = '멤버';
    if (typeof a === 'object' && a !== null) {
      if (a.id && MEMBER_ID_MAP && MEMBER_ID_MAP[a.id]) {
        realName = MEMBER_ID_MAP[a.id];
      } else {
        const raw = (a.nickname || a.name || '').trim();
        if (MEMBER_NICKNAME_MAP && MEMBER_NICKNAME_MAP[raw]) {
          realName = MEMBER_NICKNAME_MAP[raw];
        } else if (MEMBER_NICKNAME_MAP) {
          let found = false;
          for (const [nick, name] of Object.entries(MEMBER_NICKNAME_MAP)) {
            if (raw.includes(nick) || nick.includes(raw)) {
              realName = name;
              found = true;
              break;
            }
          }
          if (!found) realName = raw || '멤버';
        } else {
          realName = raw || '멤버';
        }
      }
    } else if (typeof a === 'string') {
      const raw = a.trim();
      if (MEMBER_ID_MAP && MEMBER_ID_MAP[raw]) {
        realName = MEMBER_ID_MAP[raw];
      } else if (MEMBER_NICKNAME_MAP && MEMBER_NICKNAME_MAP[raw]) {
        realName = MEMBER_NICKNAME_MAP[raw];
      } else {
        realName = raw;
      }
    }

    const avatarUrl = (MEMBER_AVATAR_MAP && MEMBER_AVATAR_MAP[realName]) || (a && (a.avatarImgPath || a.profileImg)) || '';

    if (avatarUrl) {
      return `<img src="${escapeHtml(avatarUrl)}" class="attendee-mini-avatar" style="width:14px; height:14px; border-radius:50%; object-fit:cover; border:1px solid rgba(255,105,180,0.6); vertical-align:-2px; flex-shrink:0;" alt="${escapeHtml(realName)}" title="${escapeHtml(realName)}">`;
    }
    return `<span class="attendee-mini-badge" style="display:inline-block; width:14px; height:14px; line-height:14px; border-radius:50%; background:#ff4081; color:#fff; font-size:9px; text-align:center; font-weight:bold; vertical-align:-2px;" title="${escapeHtml(realName)}">${escapeHtml(realName.slice(0, 1))}</span>`;
  }).filter(Boolean);

  if (badges.length === 0) return '';
  return `<span class="schedule-attendees-badges" style="display:inline-flex; align-items:center; gap:2px; margin-left:4px; vertical-align:middle;">${badges.join('')}</span>`;
}

export function deduplicateScheduleList(schedules = []) {
  if (!Array.isArray(schedules) || schedules.length === 0) return [];
  // 백엔드 Central Data Hub(schedule.js v2.0)에서 이미 고유 ID 부여, 중복 제거, 쇼츠/투표 필터링,
  // Gist 오버라이드 합성이 완벽하게 완료되어 발행되므로 클라이언트는 순수 뷰어로서 그대로 즉각 반환합니다.
  return schedules;
}

// 브라우저 윈도우 환경 안전 바인딩
if (typeof window !== 'undefined') {
  window.deduplicateScheduleList = deduplicateScheduleList;
}

// 순수 스타일 매퍼: 서버(SSOT)가 확정한 typeText를 100% 최우선 보존하며 본문/URL로 인한 변조를 전면 금지합니다.
export function getScheduleTypeInfo(item) {
  if (!item) {
    return { typeText: "일정", bg: "#e3f2fd", color: "#1976d2" };
  }

  let typeText = "";

  // 1. 서버(Data Hub / Gist)에서 내려준 typeText 100% 최우선 보존 (순수 뷰어 원칙)
  if (item.typeText && typeof item.typeText === 'string' && item.typeText.trim()) {
    typeText = item.typeText.trim();
  } else if (item.source === 'youtube') {
    // 2. 유튜브 공식 소스는 '영상'
    typeText = "영상";
  } else if (item.typeId) {
    // 3. Blip 표준 typeId 매핑 (1=방송, 2=릴리즈, 3=영상, 4=기념일, 5=행사, 6=팬이벤트, 7=일정)
    const typeMap = {
      1: "방송",
      2: "릴리즈",
      3: "영상",
      4: "기념일",
      5: "행사",
      6: "팬이벤트",
      7: "일정"
    };
    typeText = typeMap[item.typeId] || "일정";
  } else if (item.channel || (item.extField && (item.extField.key === '채널' || item.extField.key === '방송사'))) {
    // 4. 최소 폴백: 채널/방송사 정보가 있는 경우
    typeText = "방송";
  } else if (item.location || (item.extField && item.extField.key === '장소')) {
    // 5. 최소 폴백: 장소 정보가 있는 경우
    typeText = "행사";
  } else {
    typeText = "일정";
  }

  // 표준 카테고리별 CSS 뱃지 색상 매핑
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

export function createScheduleItemHTML(item, globalIdx = 0, nextIndex = -1) {
  if (!item || !item.title) return '';
  const rawDate = item.startTime || item.date;
  const d = parseSafeDate(rawDate);
  if (!d) return '';

  let dateLabel = "일정";
  let timeStr = "";

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

  // 참석 멤버 미니 아바타 뱃지 (14px)
  const attendees = item.starAttendees || item.members || [];
  const attendeeBadgesHtml = getMemberAttendeeBadgesHTML(attendees);

  const channelIconHtml = getChannelIconHTML(item);
  const titleText = escapeHtml(cleanTitle);
  const isNext = (globalIdx === nextIndex);
  const activeClass = isNext ? ' active' : '';

  return `
    <div class="schedule-item${activeClass}" data-date="${escapeHtml(rawDate)}" data-index="${globalIdx}" title="${escapeHtml(fullTitle)}">
      <div class="schedule-line">
        <span class="schedule-date-time">[${dateLabel}${timeStr}]</span>
        ${typeBadge}
        <span class="schedule-title">${channelIconHtml}${titleText}${extraInfo}${attendeeBadgesHtml}</span>
      </div>
    </div>
  `;
}

export function renderScheduleList(container, schedules = [], isDark = false, onSelectDate) {
  if (!container) return;

  // 지능형 중복 병합 및 제외 필터 적용
  schedules = deduplicateScheduleList(schedules);

  // 정책 1: 날짜 및 제목이 없는 비정상/결측 일정은 일반 화면 렌더링에서 100% 제외(스킵)
  schedules = (schedules || []).filter(item => {
    if (!item || !item.title) return false;
    const d = parseSafeDate(item.startTime || item.date);
    return d !== null;
  });

  if (schedules.length === 0) {
    container.innerHTML = '<div class="schedule-item">예정된 스케줄이 없습니다.</div>';
    return;
  }

  // 시작 시간 순 정렬 보장
  schedules.sort((a, b) => {
    const dA = parseSafeDate(a.startTime || a.date);
    const dB = parseSafeDate(b.startTime || b.date);
    const tA = dA ? dA.getTime() : 0;
    const tB = dB ? dB.getTime() : 0;
    return tA - tB;
  });

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nowTime = now.getTime();

  // 1순위: 오늘 날짜(YYYY-MM-DD)와 일치하는 일정
  let todayIndices = [];
  schedules.forEach((item, idx) => {
    const d = parseSafeDate(item.startTime || item.date);
    if (!d) return;
    const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (dStr === todayStr) {
      todayIndices.push(idx);
    }
  });

  let nextIndex = -1;
  if (todayIndices.length > 0) {
    const upcomingToday = todayIndices.find(idx => {
      const item = schedules[idx];
      const endD = item.endTime ? parseSafeDate(item.endTime) : null;
      const startD = parseSafeDate(item.startTime || item.date);
      const endT = endD ? endD.getTime() : (startD ? startD.getTime() : 0);
      return endT >= nowTime;
    });
    // 오늘 진행 중이거나 예정된 일정이 있으면 그 중 첫 번째, 오늘 일정이 모두 종료되었으면 현재 시점과 가장 가까운 오늘의 마지막 일정 선택
    nextIndex = upcomingToday !== undefined ? upcomingToday : todayIndices[todayIndices.length - 1];
  }

  // 2순위: 오늘 일정이 없으면 오늘 이후 첫 번째 미래 일정
  if (nextIndex === -1) {
    nextIndex = schedules.findIndex(item => {
      const d = parseSafeDate(item.startTime || item.date);
      return d ? d.getTime() >= nowTime : false;
    });
  }

  // 3순위: 미래 일정도 없으면 가장 최근 과거 일정 (마지막 항목)
  if (nextIndex === -1) {
    nextIndex = Math.max(0, schedules.length - 1);
  }

  // 기준점(오늘/가장 가까운 예정 일정) 중심: 전 40개 + 후 40개 넉넉한 초기 로드로 스크롤 끊김 완전 제거
  const CHUNK_SIZE = 40;
  let startIndex = Math.max(0, nextIndex - CHUNK_SIZE);
  let endIndex = Math.min(schedules.length, nextIndex + CHUNK_SIZE + 1);

  const createItemHTML = (item, idx) => createScheduleItemHTML(item, idx, nextIndex);

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
      if (!d) return;
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
    if (!item || !item.title) return null;
    const startRaw = item.startTime || item.date;
    const endRaw = item.endTime || item.startTime || item.date;
    const startD = parseSafeDate(startRaw);
    const endD = parseSafeDate(endRaw);
    if (!startD || !endD) return null;

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
  }).filter(Boolean);

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
            if (d) {
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
