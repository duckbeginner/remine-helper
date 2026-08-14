// common/common.js - 공통 UI 로직, 동적 탭 엔진, 인터랙션 및 렌더러 모듈
import { TAB_CONFIG_LIST, CHANNEL_DATA_MAP } from '../constants.js';
import { escapeHtml, createVideoCardHTML } from './templates.js';

/* =========================================================================
   0. 3단계 순환 테마 엔진 (3-State Theme Engine: System -> Dark -> Light)
   ========================================================================= */

export function initThemeEngine(themeToggleBtn, { onThemeChange } = {}) {
  const bodyEl = document.body;
  const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

  function applyTheme(mode) {
    let isDark = false;
    if (mode === 'dark') {
      isDark = true;
    } else if (mode === 'light') {
      isDark = false;
    } else {
      isDark = systemThemeQuery.matches;
    }

    if (isDark) bodyEl.classList.add('dark-mode');
    else bodyEl.classList.remove('dark-mode');

    // 열려있는 임베드 iframe들의 테마 파라미터 실시간 업데이트
    const themeStr = isDark ? 'dark' : 'light';
    const iframes = document.querySelectorAll('.feed-iframe-wrapper iframe');
    iframes.forEach(iframe => {
      const src = iframe.src;
      if (src && src.includes('theme=')) {
        const newSrc = src.replace(/theme=(dark|light)/i, `theme=${themeStr}`);
        if (newSrc !== src) {
          iframe.src = newSrc;
        }
      }
    });

    if (themeToggleBtn) {
      if (mode === 'dark') {
        themeToggleBtn.innerText = '🌙 다크';
      } else if (mode === 'light') {
        themeToggleBtn.innerText = '☀️ 라이트';
      } else {
        themeToggleBtn.innerText = '💻 시스템';
      }
    }

    if (typeof onThemeChange === 'function') {
      onThemeChange(mode, isDark);
    }
  }

  // 초기 테마 로드
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['themeMode'], (res) => {
      const currentMode = res.themeMode || 'system';
      applyTheme(currentMode);
    });

    // 다른 창(사이드패널 <-> 대시보드) 간 실시간 테마 변경 동기화
    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.themeMode) {
          applyTheme(changes.themeMode.newValue || 'system');
        }
      });
    }

    // OS 시스템 테마 실시간 변경 감지
    systemThemeQuery.addEventListener('change', () => {
      chrome.storage.local.get(['themeMode'], (res) => {
        const currentMode = res.themeMode || 'system';
        if (currentMode === 'system') {
          applyTheme('system');
        }
      });
    });

    // 버튼 클릭 시 3단계 순환 (시스템 -> 다크 -> 라이트)
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        chrome.storage.local.get(['themeMode'], (res) => {
          let currentMode = res.themeMode || 'system';
          let nextMode = 'system';

          if (currentMode === 'system') nextMode = 'dark';
          else if (currentMode === 'dark') nextMode = 'light';
          else if (currentMode === 'light') nextMode = 'system';

          chrome.storage.local.set({ themeMode: nextMode });
          applyTheme(nextMode);
        });
      });
    }
  }

  return { applyTheme };
}

/* =========================================================================
   1. 동적 탭 & 크리스탈 글래스 슬라이더 엔진 (Tab & Glass Slider Engine)
   ========================================================================= */

export function updateGlassSlider(targetBtn, sliderEl) {
  if (!sliderEl || !targetBtn) return;

  // 좌우 1px inset — 버튼 테두리와 슬라이더 테두리가 겹쳐 오버되는 것을 방지
  const inset = 1;
  sliderEl.style.left = `${targetBtn.offsetLeft + inset}px`;
  sliderEl.style.width = `${targetBtn.offsetWidth - inset * 2}px`;
}

// 지정된 컨테이너 또는 전체 페이지 내의 모든 미디어(iframe, video, audio) 재생 및 소리 즉시 중지
export function stopAllIframeMedia(container = document, forceReset = false) {
  if (!container) return;

  // 1. iframe 일시정지 명령 전송 및 옵션에 따른 리셋
  const iframes = container.querySelectorAll('iframe');
  iframes.forEach(iframe => {
    try {
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
        iframe.contentWindow.postMessage('{"method":"pause"}', '*');
        iframe.contentWindow.postMessage({ method: 'pause' }, '*');
        iframe.contentWindow.postMessage({ type: 'pause' }, '*');
      }
      if (forceReset) {
        const currentSrc = iframe.src;
        if (currentSrc && currentSrc !== 'about:blank') {
          iframe.src = currentSrc;
        }
      }
    } catch (e) {
      // ignore
    }
  });

  // 2. HTML5 비디오/오디오 정지
  const html5Medias = container.querySelectorAll('video, audio');
  html5Medias.forEach(media => {
    try {
      media.pause();
      if (forceReset) media.currentTime = 0;
    } catch (e) {
      // ignore
    }
  });
}

export function initTabEngine(tabBarEl, sliderEl, tabList = TAB_CONFIG_LIST, { onTabChange } = {}) {
  if (!tabBarEl) return;

  const tabButtons = tabBarEl.querySelectorAll('.panel-tab-btn');
  const tabContents = document.querySelectorAll('.panel-tab-content');
  const loadedMap = {};

  // 마우스 호버 시 글래스 슬라이더 등장
  if (sliderEl) {
    tabBarEl.addEventListener('mouseenter', () => {
      sliderEl.classList.add('visible');
      const activeBtn = tabBarEl.querySelector('.panel-tab-btn.active');
      if (activeBtn) updateGlassSlider(activeBtn, sliderEl);
    });

    tabBarEl.addEventListener('mouseleave', () => {
      sliderEl.classList.remove('visible');
    });

    tabButtons.forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        sliderEl.classList.add('visible');
        updateGlassSlider(btn, sliderEl);
      });
    });

    window.addEventListener('resize', () => {
      const currentActive = tabBarEl.querySelector('.panel-tab-btn.active');
      if (currentActive) updateGlassSlider(currentActive, sliderEl);
    });
  }

  // 탭 클릭 이벤트 바인딩
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const tabConfig = tabList.find(t => t.id === targetId);

      // 버튼 active 정리
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (sliderEl) updateGlassSlider(btn, sliderEl);

      // 컨텐츠 뷰 전환 및 비활성화되는 탭의 미디어 재생 즉시 중지
      tabContents.forEach(content => {
        if (content.id === targetId) {
          content.classList.add('active');
        } else {
          if (content.classList.contains('active')) {
            stopAllIframeMedia(content);
          }
          content.classList.remove('active');
        }
      });

      // 탭 타입별 지연 렌더링 (Lazy Loading)
      if (tabConfig && !loadedMap[targetId]) {
        const isDark = document.body.classList.contains('dark-mode');

        if (tabConfig.type === 'iframe') {
          const containerId = `${targetId.replace('tab', '').toLowerCase()}FeedList`;
          const container = document.getElementById(containerId);
          if (container) {
            renderIframeTab(container, tabConfig, isDark);
            loadedMap[targetId] = true;
          }
        }
      }

      if (typeof onTabChange === 'function') {
        onTabChange(targetId, tabConfig, loadedMap);
      }
    });
  });

  // 사이드패널 닫힘 또는 탭 백그라운드 전환 시 모든 미디어 자동 정지
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stopAllIframeMedia(document);
    }
  });
  window.addEventListener('pagehide', () => stopAllIframeMedia(document));
  window.addEventListener('beforeunload', () => stopAllIframeMedia(document));

  // 초기 활성 탭 슬라이더 위치 설정
  const initialActiveBtn = tabBarEl.querySelector('.panel-tab-btn.active');
  if (initialActiveBtn && sliderEl) {
    updateGlassSlider(initialActiveBtn, sliderEl);
  }

  return {
    loadedMap,
    switchTab: (targetId) => {
      const btn = tabBarEl.querySelector(`.panel-tab-btn[data-target="${targetId}"]`);
      if (btn) btn.click();
    }
  };
}

export function setupHorizontalScroller(target) {
  const orig = typeof target === 'string' ? document.getElementById(target) : target;
  if (!orig) return;
  if (orig.classList.contains('hscroll-container')) return;

  const leftBtn = document.createElement('button');
  leftBtn.className = 'hscroll-btn left';
  leftBtn.setAttribute('aria-label', '이전 영상');
  leftBtn.innerText = '◀';

  const rightBtn = document.createElement('button');
  rightBtn.className = 'hscroll-btn right';
  rightBtn.setAttribute('aria-label', '다음 영상');
  rightBtn.innerText = '▶';

  const viewport = document.createElement('div');
  viewport.className = 'hscroll-viewport';
  while (orig.firstChild) viewport.appendChild(orig.firstChild);
  orig.appendChild(viewport);
  orig.classList.add('hscroll-container');
  orig.insertBefore(leftBtn, viewport);
  orig.appendChild(rightBtn);

  function scrollByCards(count) {
    const card = viewport.querySelector('.video-card');
    const gap = parseFloat(getComputedStyle(viewport).gap) || 8;
    const cardWidth = card ? Math.ceil(card.getBoundingClientRect().width + gap) : 180;
    viewport.scrollBy({ left: cardWidth * count, behavior: 'smooth' });
  }

  leftBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    scrollByCards(-2);
  });

  rightBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    scrollByCards(2);
  });

  viewport.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
      e.preventDefault();
      viewport.scrollLeft += e.deltaY;
    }
  }, { passive: false });

  // 마우스 드래그 스크롤 지원
  let isDown = false;
  let startX;
  let scrollLeft;

  viewport.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isDown = true;
    startX = e.pageX - viewport.offsetLeft;
    scrollLeft = viewport.scrollLeft;
  });

  viewport.addEventListener('mouseleave', () => { isDown = false; });
  viewport.addEventListener('mouseup', () => { isDown = false; });

  viewport.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - viewport.offsetLeft;
    const walk = (x - startX) * 1.5;
    viewport.scrollLeft = scrollLeft - walk;
  });
}

/* =========================================================================
   3. 공식 채널 허브 드래그 앤 드롭 정렬 엔진 (Hub Reordering Engine)
   ========================================================================= */

export function setupHubIconReordering(containerEl, onOrderChanged) {
  if (!containerEl) return;

  let dragSrcEl = null;

  function handleDragStart(e) {
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.getAttribute('data-key'));

    // dragstart 순간의 모습을 고정한 ghost 이미지 생성
    // (DOM이 즉시 이동하면 브라우저 ghost가 달라지는 현상 방지)
    const ghost = this.cloneNode(true);
    ghost.style.cssText = `
      position: fixed;
      top: -1000px; left: -1000px;
      width: ${this.offsetWidth}px;
      height: ${this.offsetHeight}px;
      border-radius: 50%;
      opacity: 0.9;
      pointer-events: none;
    `;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, this.offsetWidth / 2, this.offsetHeight / 2);
    setTimeout(() => ghost.remove(), 0);

    // dragging 클래스는 다음 틱에 적용 (ghost 캡처 이후)
    requestAnimationFrame(() => this.classList.add('dragging'));
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  function handleDragEnter(e) {
    e.preventDefault();
    if (!dragSrcEl || dragSrcEl === this) return;

    // 드래그 중 실시간 DOM 재배치 (미리보기)
    const allBtns = Array.from(containerEl.querySelectorAll('.hub-icon-btn'));
    const srcIdx = allBtns.indexOf(dragSrcEl);
    const targetIdx = allBtns.indexOf(this);

    if (srcIdx < targetIdx) {
      this.parentNode.insertBefore(dragSrcEl, this.nextSibling);
    } else {
      this.parentNode.insertBefore(dragSrcEl, this);
    }
  }

  function handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();

    // 드롭 시 최종 순서 저장
    if (typeof onOrderChanged === 'function') {
      const newOrder = Array.from(containerEl.querySelectorAll('.hub-icon-btn'))
        .map(b => b.getAttribute('data-key'));
      onOrderChanged(newOrder);
    }
    return false;
  }

  function handleDragEnd() {
    this.classList.remove('dragging');
    containerEl.querySelectorAll('.hub-icon-btn').forEach(item => {
      item.classList.remove('over');
    });
  }

  function bindItem(item) {
    item.setAttribute('draggable', 'true');
    item.addEventListener('dragstart',  handleDragStart, false);
    item.addEventListener('dragenter',  handleDragEnter, false);
    item.addEventListener('dragover',   handleDragOver,  false);
    item.addEventListener('drop',       handleDrop,      false);
    item.addEventListener('dragend',    handleDragEnd,   false);
  }

  containerEl.querySelectorAll('.hub-icon-btn').forEach(bindItem);
}

/* =========================================================================
   4. 유튜브 비디오 렌더러 (YouTube Video Renderers)
   ========================================================================= */

export function renderOfficialYoutubeList(container, videos = []) {
  if (!container) return;
  if (!videos || videos.length === 0) {
    container.innerHTML = '<p style="font-size: 12px; color: #777; text-align: center; width: 100%;">등록된 영상이 없습니다.</p>';
    return;
  }

  container.innerHTML = videos.map(v => createVideoCardHTML(v)).join('');
}

export function renderWoniYoutubeList(container, videos = []) {
  if (!container) return;
  if (!videos || videos.length === 0) {
    container.innerHTML = '<p style="font-size: 12px; color: #777; text-align: center; width: 100%;">등록된 영상이 없습니다.</p>';
    return;
  }

  container.innerHTML = videos.map(v => createVideoCardHTML(v)).join('');
}

/* =========================================================================
   5. 스케줄 리스트 렌더러 (Schedule List Renderer)
   ========================================================================= */

export function parseSafeDate(startTimeStr) {
  if (!startTimeStr) return new Date();
  if (startTimeStr.length === 10 && !startTimeStr.includes('T')) {
    const [y, m, d] = startTimeStr.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0);
  }
  const d = new Date(startTimeStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function getScheduleTypeInfo(item) {
  let typeText = "";
  if (item.message && item.message.startsWith("[")) {
    const match = item.message.match(/^\[(.*?)\]/);
    if (match) typeText = match[1];
  } else if (item.typeId) {
    const typeMap = { 1: "방송", 2: "릴리즈", 4: "기념일", 5: "행사" };
    typeText = typeMap[item.typeId] || "";
  }

  let bg = "#e3f2fd", color = "#1976d2";
  if (typeText.includes("방송")) { bg = "#ffe4ec"; color = "#d63384"; }
  else if (typeText.includes("행사") || typeText.includes("공연")) { bg = "#e2f0d9"; color = "#388e3c"; }
  else if (typeText.includes("팬사인") || typeText.includes("팬싸")) { bg = "#f3e5f5"; color = "#8e24aa"; }
  else if (typeText.includes("기념일") || typeText.includes("생일")) { bg = "#fff9c4"; color = "#f57f17"; }

  return { typeText, bg, color };
}

export function renderScheduleList(container, schedules = [], isDark = false, onSelectDate) {
  if (!container) return;

  if (!schedules || schedules.length === 0) {
    container.innerHTML = '<div class="schedule-item">예정된 스케줄이 없습니다.</div>';
    return;
  }

  const now = new Date().getTime();
  let nextIndex = schedules.findIndex(item => parseSafeDate(item.startTime || item.date).getTime() >= now);
  if (nextIndex === -1) nextIndex = schedules.length - 1;

  const startIndex = Math.max(0, nextIndex - 5);
  const endIndex = Math.min(schedules.length, nextIndex + 6);
  const slicedSchedules = schedules.slice(startIndex, endIndex);

  container.innerHTML = slicedSchedules.map((item, idx) => {
    let dateLabel = "일정";
    let timeStr = "";
    const rawDate = item.startTime || item.date;

    if (rawDate) {
      const d = parseSafeDate(rawDate);
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dateLabel = `${month}/${day}`;

      let h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, '0');
      if (!(h === 0 && m === '00' && String(rawDate).includes('T15:00:00'))) {
        const ap = h >= 12 ? '오후' : '오전';
        h = h % 12 || 12;
        timeStr = ` ${ap} ${h}:${m}`;
      } else {
        timeStr = " 종일";
      }
    }

    const { typeText, bg, color } = getScheduleTypeInfo(item);
    let typeBadge = '';
    if (typeText) {
      typeBadge = `<span class="schedule-type-badge" style="background:${bg}; color:${color}; padding:1px 5px; border-radius:4px; font-size:10.5px; font-weight:600; margin:0 4px; flex-shrink:0;">${escapeHtml(typeText)}</span>`;
    }

    // 리스트에는 짧은 제목(item.title)만 표시
    let cleanTitle = item.title || item.message || '스케줄';
    if (typeText && cleanTitle.startsWith(`[${typeText}]`)) {
      cleanTitle = cleanTitle.replace(`[${typeText}]`, '').trim();
    }
    let extraInfo = '';
    if (item.extField && item.extField.value) {
      extraInfo = ` <span style="color:#888; font-size:10px;">(${escapeHtml(item.extField.value.trim())})</span>`;
    }

    const titleText = escapeHtml(cleanTitle);
    const isNext = (startIndex + idx === nextIndex);
    const activeClass = isNext ? ' active' : '';

    return `
      <div class="schedule-item${activeClass}" data-date="${escapeHtml(rawDate)}" data-index="${idx}" title="${titleText}">
        <div class="schedule-line">
          <span class="schedule-date-time">[${dateLabel}${timeStr}]</span>
          ${typeBadge}
          <span class="schedule-title">${titleText}${extraInfo}</span>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.schedule-item').forEach(el => {
    el.addEventListener('click', () => {
      container.querySelectorAll('.schedule-item').forEach(i => i.classList.remove('active'));
      el.classList.add('active');

      const idx = parseInt(el.getAttribute('data-index'), 10);
      const item = slicedSchedules[idx];
      if (item) {
        const d = parseSafeDate(item.startTime || item.date);
        const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
        let h = d.getHours();
        const m = String(d.getMinutes()).padStart(2, '0');
        const ap = h >= 12 ? '오후' : '오전';
        h = h % 12 || 12;
        const timeStr = (h === 0 && m === '00' && String(item.startTime || item.date).includes('T15:00:00')) ? '종일 일정' : `${ap} ${h}:${m}`;
        const { typeText } = getScheduleTypeInfo(item);

        // 모달에는 세부 내용(item.message) 및 사전 해석된 미디어 URL 전달
        showScheduleModal({
          title: item.title || item.message || '스케줄 상세 정보',
          date: dateStr,
          time: timeStr,
          type: typeText,
          detail: item.message || item.description || item.detail || item.title,
          link: item.url || item.link,
          resolvedMediaUrls: item.resolvedMediaUrls || []
        });
      }

      if (typeof onSelectDate === 'function') {
        const date = el.getAttribute('data-date');
        onSelectDate(date);
      }
    });
  });
}

/* =========================================================================
   6. 캘린더 렌더러 & 인터랙션 (Calendar Renderer & Interactions)
   ========================================================================= */

export function renderCalendar(gridEl, titleEl, currentDate, schedules = [], onSelectEvent) {
  if (!gridEl) return;

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
        const daySchedules = schedules.filter(item => {
          const rawDate = item.startTime || item.date;
          if (!rawDate) return false;
          const d = parseSafeDate(rawDate);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}` === cellInfo.dateStr;
        });

        daySchedules.forEach(item => {
          const { typeText, bg, color } = getScheduleTypeInfo(item);
          const badge = document.createElement("div");
          badge.className = "cal-event-badge";
          badge.style.background = bg;
          badge.style.color = color;

          let timeStrForBadge = "";
          let timeStrForModal = "";
          const rawDate = item.startTime || item.date;

          if (rawDate) {
            const d = parseSafeDate(rawDate);
            let h = d.getHours();
            const m = String(d.getMinutes()).padStart(2, '0');
            if (!(h === 0 && m === '00' && String(rawDate).includes('T15:00:00'))) {
              const ap = h >= 12 ? '오후' : '오전';
              h = h % 12 || 12;
              timeStrForBadge = `<span class="badge-time">${ap} ${h}:${m}</span>`;
              timeStrForModal = `${ap} ${h}:${m}`;
            } else {
              timeStrForModal = "종일 일정";
            }
          }

          const titleText = escapeHtml(item.title || item.message || '일정');
          const displayTitle = typeText ? `[${typeText}] ${titleText}` : titleText;

          badge.innerHTML = `${timeStrForBadge}${titleText}`;
          badge.title = `${displayTitle} ${timeStrForModal ? `(${timeStrForModal})` : ''}`;

          badge.addEventListener("click", (e) => {
            e.stopPropagation();
            if (typeof onSelectEvent === 'function') {
              onSelectEvent({
                title: displayTitle,
                date: cellInfo.dateStr,
                time: timeStrForModal,
                type: typeText,
                detail: item.message || item.description || '',
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

export function renderIframeTab(container, tabConfig, isDark = false) {
  if (!container || !tabConfig || !tabConfig.iframeUrl) return;

  const themeStr = isDark ? 'dark' : 'light';
  const finalUrl = tabConfig.iframeUrl.replace('{theme}', themeStr);
  const sandboxAttr = tabConfig.sandbox ? ` sandbox="${tabConfig.sandbox}"` : '';
  const heightStyle = tabConfig.height ? `height: ${tabConfig.height};` : 'height: 100%;';

  container.innerHTML = `
    <iframe src="${finalUrl}" title="${escapeHtml(tabConfig.label)}" style="width: 100%; ${heightStyle} transition: height 0.3s ease;" frameborder="0"${sandboxAttr}></iframe>
  `;
}

// iframe 마우스 휠 스크롤 인터랙션 엔진
export function enableIframeScrollGuard(container = document) {
  if (!container) return;
  const wrappers = container.querySelectorAll('.feed-iframe-wrapper, .modal-embed-card');
  wrappers.forEach(wrapper => {
    const iframe = wrapper.querySelector('iframe');
    if (!iframe) return;

    // 1. 기본 상태: 휠 스크롤이 부모 컨테이너로 자연스럽게 통과되도록 설정
    iframe.style.pointerEvents = 'none';

    // 2. 클릭 시 미디어 제어/재생을 위해 pointer-events 활성화
    wrapper.addEventListener('click', () => {
      iframe.style.pointerEvents = 'auto';
    });

    // 3. 마우스가 카드를 벗어나면 다시 부드러운 스크롤 모드로 복구
    wrapper.addEventListener('mouseleave', () => {
      iframe.style.pointerEvents = 'none';
    });

    // 4. 보조 휠 이벤트 포워딩 (인터랙션 중에도 마우스 휠을 굴리면 부모 스크롤 실행)
    wrapper.addEventListener('wheel', (e) => {
      const scrollParent = wrapper.closest('.embed-modal-body') || 
                           wrapper.closest('.feed-list-container') || 
                           wrapper.closest('.panel-tab-content') || 
                           document.documentElement;
      if (scrollParent && scrollParent !== wrapper) {
        scrollParent.scrollTop += e.deltaY;
      }
    }, { passive: true });
  });
}

export function renderInstaEmbeds(container, feeds = [], isDark = false) {
  if (!container) return;
  if (!feeds || feeds.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">인스타그램 피드가 없습니다.</p>';
    return;
  }

  const themeStr = isDark ? 'dark' : 'light';
  container.innerHTML = '';

  feeds.forEach(feed => {
    const link = feed.link || (feed.shortcode ? `https://www.instagram.com/p/${feed.shortcode}/` : '') || feed.permalink || feed.url || '';
    const m = link.match(/\/(p|reel|reels)\/([^\/?#]+)/i);
    if (!m) return;
    const type = (m[1] || 'p').toLowerCase();
    const id = m[2];

    const wrapper = document.createElement('div');
    wrapper.className = 'feed-iframe-wrapper';
    wrapper.innerHTML = `
      <iframe src="https://www.instagram.com/${type}/${id}/embed/captioned/?theme=${themeStr}" 
              style="width: 100%; height: 650px; min-height: 650px; transition: height 0.3s ease;" 
              frameborder="0" 
              scrolling="no" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
              loading="lazy">
      </iframe>
    `;
    container.appendChild(wrapper);
  });

  enableIframeScrollGuard(container);
}

export function renderXEmbeds(container, feeds = [], isDark = false) {
  if (!container) return;
  if (!feeds || feeds.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">X 피드가 없습니다.</p>';
    return;
  }

  const themeStr = isDark ? 'dark' : 'light';
  container.innerHTML = '';

  feeds.forEach(feed => {
    const tweetId = feed.id;
    if (tweetId) {
      const wrapper = document.createElement('div');
      wrapper.className = 'feed-iframe-wrapper';
      wrapper.innerHTML = `<iframe src="https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=${themeStr}" style="width: 100%; height: 250px; transition: height 0.3s ease;" frameborder="0" scrolling="no" loading="lazy"></iframe>`;
      container.appendChild(wrapper);
    }
  });

  enableIframeScrollGuard(container);
}

export function renderTiktokEmbeds(container, feeds = [], isDark = false) {
  if (!container) return;

  const themeStr = isDark ? 'dark' : 'light';

  // 1. 수집된 틱톡 비디오 목록이 있으면 개별 숏폼 플레이어 카드로 렌더링
  if (feeds && feeds.length > 0) {
    container.innerHTML = '';
    feeds.forEach(feed => {
      const videoId = feed.id;
      if (videoId) {
        const wrapper = document.createElement('div');
        wrapper.className = 'feed-iframe-wrapper tiktok-feed-item';
        wrapper.style.maxWidth = '380px';
        wrapper.style.width = '100%';
        wrapper.style.margin = '0 auto 16px auto';
        wrapper.innerHTML = `
          <iframe src="https://www.tiktok.com/embed/v2/${videoId}" 
                  style="width: 100%; height: 680px; min-height: 680px; border: none; border-radius: 12px; display: block;" 
                  frameborder="0" 
                  scrolling="no" 
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowfullscreen>
          </iframe>
        `;
        container.appendChild(wrapper);
      }
    });
    enableIframeScrollGuard(container);
    return;
  }

  // 2. 피드가 아직 없으면 공식 프로필 위젯으로 폴백 렌더링
  container.innerHTML = `
    <div class="feed-iframe-wrapper" style="width: 100%; height: calc(100vh - 120px); min-height: 650px;">
      <iframe src="https://www.tiktok.com/embed/@rescene_official?theme=${themeStr}" 
              title="TikTok" 
              style="width: 100%; height: 100%; min-height: 650px; border: none; border-radius: 12px; display: block;" 
              frameborder="0"
              scrolling="no"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share">
      </iframe>
    </div>
  `;
}

/* =========================================================================
   8. 스케줄 모달 & 툴팁 팝업 핸들러 (Modal & Tooltip)
   ========================================================================= */

export function decodeHtmlEntities(str) {
  if (!str) return '';
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}

export function linkifyMessage(text) {
  if (!text) return '';
  // 1. 기존 엔티티(&lt;, &gt;, &amp;) 디코딩
  const rawText = decodeHtmlEntities(text);
  // 2. 안전하게 다시 escape
  const safeText = escapeHtml(rawText);
  // 3. URL 링크화
  return safeText.replace(/(https?:\/\/[^\s]+)/g, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
}

export function parseMediaEmbeds(sources = [], isDark = false) {
  const allText = sources.filter(Boolean).join(' ');
  if (!allText) return '';

  const themeStr = isDark ? 'dark' : 'light';
  const embedHtmls = [];
  const processedUrls = new Set();

  // 1. YouTube (watch, youtu.be, shorts) - 크롬 확장프로그램 iframe JS 차단 회피 및 원클릭 스마트 플레이어
  const ytRegex = /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
  let ytMatch;
  while ((ytMatch = ytRegex.exec(allText)) !== null) {
    const videoId = ytMatch[1];
    if (!processedUrls.has(videoId)) {
      processedUrls.add(videoId);
      embedHtmls.push(`
        <div class="youtube-preview-card" data-video-id="${videoId}" style="margin-bottom: 12px; border-radius: 12px; overflow: hidden; aspect-ratio: 16/9; position: relative; cursor: pointer; background: #000; box-shadow: 0 4px 16px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15);">
          <img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.35s ease;" alt="YouTube Thumbnail" loading="lazy">
          <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.5) 100%); display: flex; flex-direction: column; justify-content: space-between; padding: 12px; box-sizing: border-box;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="background: #ff0000; color: #fff; font-size: 10.5px; font-weight: bold; padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 2px 6px rgba(255,0,0,0.4);">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                YouTube
              </span>
              <span style="color: rgba(255,255,255,0.9); font-size: 11px; font-weight: 500; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">영상 바로보기 ↗</span>
            </div>
            <div style="align-self: center;">
              <div class="yt-play-btn" style="width: 50px; height: 50px; background: rgba(255,0,0,0.95); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 18px rgba(255,0,0,0.55); transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s ease;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white" style="margin-left: 3px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              </div>
            </div>
            <div style="color: #fff; font-size: 11.5px; font-weight: 600; text-shadow: 0 1px 4px rgba(0,0,0,0.9); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              클릭하여 YouTube에서 최고화질로 감상하기
            </div>
          </div>
        </div>
      `);
    }
  }

  // 2. Instagram (p, reel, tv 등 계정명 포함 URL 지원)
  const instaRegex = /https?:\/\/(?:www\.)?instagram\.com\/(?:[a-zA-Z0-9_.]+\/)?(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/g;
  let instaMatch;
  while ((instaMatch = instaRegex.exec(allText)) !== null) {
    const postId = instaMatch[1];
    if (!processedUrls.has(postId)) {
      processedUrls.add(postId);
      embedHtmls.push(`
        <div class="modal-embed-card" style="margin-bottom: 10px; border-radius: 10px; overflow: hidden; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15);">
          <iframe src="https://www.instagram.com/p/${postId}/embed/captioned/?theme=${themeStr}" style="width: 100%; height: 500px; min-height: 380px; border: none; transition: height 0.25s ease;" scrolling="no" frameborder="0"></iframe>
        </div>
      `);
    }
  }

  // 3. X (Twitter)
  const xRegex = /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/([0-9]+)/g;
  let xMatch;
  while ((xMatch = xRegex.exec(allText)) !== null) {
    const tweetId = xMatch[1];
    if (!processedUrls.has(tweetId)) {
      processedUrls.add(tweetId);
      embedHtmls.push(`
        <div class="modal-embed-card" style="margin-bottom: 10px; border-radius: 10px; overflow: hidden;">
          <iframe src="https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=${themeStr}" style="width: 100%; height: 260px; border: none;" scrolling="no" frameborder="0"></iframe>
        </div>
      `);
    }
  }

  // 4. TikTok (일반 영상)
  const ttRegex = /https?:\/\/(?:www\.)?tiktok\.com\/@[a-zA-Z0-9_.]+\/video\/([0-9]+)/g;
  let ttMatch;
  while ((ttMatch = ttRegex.exec(allText)) !== null) {
    const videoId = ttMatch[1];
    if (!processedUrls.has(videoId)) {
      processedUrls.add(videoId);
      embedHtmls.push(`
        <div class="modal-embed-card" style="margin-bottom: 10px; border-radius: 10px; overflow: hidden;">
          <iframe src="https://www.tiktok.com/embed/v2/${videoId}" style="width: 100%; height: 460px; border: none;" scrolling="no" frameborder="0"></iframe>
        </div>
      `);
    }
  }

  // 5. TikTok 단축 URL (vt.tiktok.com)
  const vtTtRegex = /https?:\/\/vt\.tiktok\.com\/([a-zA-Z0-9_-]+)/g;
  let vtMatch;
  while ((vtMatch = vtTtRegex.exec(allText)) !== null) {
    const shortCode = vtMatch[1];
    const fullUrl = `https://vt.tiktok.com/${shortCode}/`;
    if (!processedUrls.has(fullUrl)) {
      processedUrls.add(fullUrl);
      embedHtmls.push(`
        <div class="tiktok-short-preview-card" data-url="${fullUrl}">
          <div class="tiktok-card-left">
            <div class="tiktok-icon-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#fe2c55"><path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.068-.102a2.895 2.895 0 0 1 2.37-4.498c.312 0 .614.05.897.143V9.41a6.34 6.34 0 0 0-.897-.064 6.341 6.341 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34c3.483 0 6.315-2.81 6.34-6.287V9.32a8.217 8.217 0 0 0 4.764 1.517V7.392a4.814 4.814 0 0 1-.99-.706z"/></svg>
            </div>
            <div class="tiktok-card-info">
              <div class="tiktok-card-title">TikTok 숏폼 영상</div>
              <div class="tiktok-card-desc">클릭하여 틱톡에서 바로 감상하기</div>
            </div>
          </div>
          <div class="tiktok-card-btn">
            보러가기 ↗
          </div>
        </div>
      `);
    }
  }

  if (embedHtmls.length === 0) return '';
  return embedHtmls.join('');
}

export function showScheduleModal(scheduleData) {
  const overlay = document.getElementById('scheduleModalOverlay');
  const bodyContent = document.getElementById('modalBodyContent');
  const modalTitle = document.getElementById('modalTitle');
  const embedCard = document.getElementById('modalEmbedCard');
  const embedBody = document.getElementById('modalEmbedBodyContent');

  if (!overlay || !bodyContent) return;

  if (modalTitle) {
    const rawTitle = decodeHtmlEntities(scheduleData.title || '스케줄 상세 정보');
    modalTitle.textContent = rawTitle;
  }

  const isDark = document.body.classList.contains('dark-mode');

  let html = '';
  if (scheduleData.date) {
    const timeStr = scheduleData.time ? ` ${scheduleData.time}` : '';
    html += `<span class="detail-time">📅 일시: ${escapeHtml(scheduleData.date)}${escapeHtml(timeStr)}</span>`;
  }
  if (scheduleData.type) {
    html += `<p><strong>분류:</strong> ${escapeHtml(scheduleData.type)}</p>`;
  }
  if (scheduleData.detail || scheduleData.description) {
    const detailContent = linkifyMessage(scheduleData.detail || scheduleData.description);
    html += `<div style="margin-top: 8px;">${detailContent}</div>`;
  }
  if (scheduleData.link || scheduleData.url) {
    const link = scheduleData.link || scheduleData.url;
    html += `<p style="margin-top: 10px;"><a href="${link}" target="_blank" rel="noopener noreferrer">🔗 관련 링크 바로가기</a></p>`;
  }

  bodyContent.innerHTML = html;

  // 유튜브, 인스타, X, 틱톡 미디어 링크 자동 추출 및 세컨더리 카드 렌더링
  let mediaSources = [
    scheduleData.detail,
    scheduleData.description,
    scheduleData.link,
    scheduleData.url,
    scheduleData.message,
    ...(scheduleData.resolvedMediaUrls || [])
  ];

  let embedsHtml = parseMediaEmbeds(mediaSources, isDark);

  function applyEmbeds(htmlContent) {
    if (!embedCard || !embedBody) return;
    if (htmlContent) {
      embedBody.innerHTML = htmlContent;
      embedCard.style.display = 'flex';
      embedCard.style.flexDirection = 'column';

      // 유튜브 프리뷰 카드 클릭 이벤트
      embedBody.querySelectorAll('.youtube-preview-card').forEach(card => {
        card.addEventListener('click', () => {
          const videoId = card.getAttribute('data-video-id');
          if (videoId) {
            const url = `https://www.youtube.com/watch?v=${videoId}`;
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
              chrome.tabs.create({ url });
            } else {
              window.open(url, '_blank');
            }
          }
        });
      });

      // 틱톡 숏폼 카드 클릭 이벤트
      embedBody.querySelectorAll('.tiktok-short-preview-card').forEach(card => {
        card.addEventListener('click', () => {
          const url = card.getAttribute('data-url');
          if (url) {
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
              chrome.tabs.create({ url });
            } else {
              window.open(url, '_blank');
            }
          }
        });
      });

      // 모달 내부 iframe 휠 스크롤 인터랙션 가드 활성화
      enableIframeScrollGuard(embedBody);
    } else {
      embedBody.innerHTML = '';
      embedCard.style.display = 'none';
    }
  }

  applyEmbeds(embedsHtml);
  overlay.style.display = 'flex';
}

export function initScheduleModal() {
  const overlay = document.getElementById('scheduleModalOverlay');
  const closeBtn = document.getElementById('modalCloseBtn');

  function closeModal() {
    if (!overlay) return;
    overlay.style.display = 'none';
    stopAllIframeMedia(overlay);
    const embedBody = document.getElementById('embedBodyContent');
    const embedCard = document.getElementById('modalEmbedCard');
    if (embedBody) embedBody.innerHTML = '';
    if (embedCard) embedCard.style.display = 'none';
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      // 모달 카드 및 추가 미디어 카드 바깥의 모든 빈 영역 클릭 시 닫기
      if (!e.target.closest('.schedule-modal-card') && !e.target.closest('.schedule-embed-card')) {
        closeModal();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });

  // iframe 자동 높이 조절 엔진 활성화
  setupIframeAutoHeight();
}

/* =========================================================================
   9. 인스타 & X 공식 위젯 자동 높이 조절 (postMessage Auto-Height Engine)
   ========================================================================= */

let isAutoHeightSetup = false;
export function setupIframeAutoHeight() {
  if (isAutoHeightSetup) return;
  isAutoHeightSetup = true;

  window.addEventListener('message', (event) => {
    // 1. 인스타그램 공식 MEASURE 메시지 감지
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data && data.type === 'MEASURE' && data.details && data.details.height) {
        const iframes = document.querySelectorAll('.feed-iframe-wrapper iframe, .modal-embed-card iframe');
        for (let iframe of iframes) {
          if (iframe.contentWindow === event.source) {
            iframe.style.height = `${data.details.height}px`;
            iframe.style.minHeight = `${data.details.height}px`;
            break;
          }
        }
      }
    } catch (e) { }

    // 2. 트위터(X) twttr.private.resize 감지
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data && data['twttr.embed'] && data['twttr.embed'].method === 'twttr.private.resize') {
        const params = data['twttr.embed'].params;
        const height = Array.isArray(params) && params.length > 0 ? params[0].height : params.height;
        if (height) {
          const iframes = document.querySelectorAll('.feed-iframe-wrapper iframe, .modal-embed-card iframe');
          for (let iframe of iframes) {
            if (iframe.contentWindow === event.source) {
              iframe.style.height = `${height}px`;
              iframe.style.minHeight = `${height}px`;
              break;
            }
          }
        }
      }
    } catch (e) { }

    // 3. 틱톡 iframe height 감지
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data && data.height) {
        const iframes = document.querySelectorAll('#tabTiktok iframe, .modal-embed-card iframe');
        for (let iframe of iframes) {
          if (iframe.contentWindow === event.source) {
            iframe.style.height = `${data.height - 2}px`;
            break;
          }
        }
      }
    } catch (e) { }
  });
}

// 자동 활성화
if (typeof window !== 'undefined') {
  setupIframeAutoHeight();
}

/* =========================================================================
   10. 고수준 통합 매니저 (High-Level Application Managers)
   ========================================================================= */

// 캘린더 상태 관리 및 월 이동 네비게이션 엔진
export function initCalendarManager({
  gridId = 'spCalendarGrid',
  titleId = 'spCalendarMonthTitle',
  prevBtnId = 'spPrevMonthBtn',
  nextBtnId = 'spNextMonthBtn',
  initialDate = new Date()
} = {}) {
  let currentDate = new Date(initialDate);
  let globalSchedules = [];

  const gridEl = typeof gridId === 'string' ? document.getElementById(gridId) : gridId;
  const titleEl = typeof titleId === 'string' ? document.getElementById(titleId) : titleId;
  const prevBtn = typeof prevBtnId === 'string' ? document.getElementById(prevBtnId) : prevBtnId;
  const nextBtn = typeof nextBtnId === 'string' ? document.getElementById(nextBtnId) : nextBtnId;

  function update() {
    renderCalendar(gridEl, titleEl, currentDate, globalSchedules, (eventData) => {
      showScheduleModal(eventData);
    });
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

  return {
    setSchedules: (schedules) => {
      globalSchedules = schedules || [];
      update();
    },
    refresh: update,
    getCurrentDate: () => currentDate,
    setDate: (newDate) => {
      currentDate = new Date(newDate);
      update();
    }
  };
}

// 스토리지 데이터 자동 로드 & 영상/라이브/채널순서/스케줄 일괄 초기화 엔진
export function initAppStorageData({
  hubContainerId = 'hubContainer',
  liveBannerId = 'liveBanner',
  youtubeListId = 'youtubeList',
  playlistId = 'playlistYoutubeList',
  woniListId = 'woniYoutubeList',
  scheduleListId = 'scheduleList',
  onSchedulesLoaded,
  onDataLoaded
} = {}) {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

  chrome.storage.local.get(
    [
      'latestVideos',
      'officialPlaylistVideos',
      'woniVideos',
      'blipSchedules',
      'isLive',
      'themeMode',
      'channelOrder'
    ],
    (result) => {
      // 1. 유튜브 비디오 렌더링 및 수평 스크롤러 적용
      const ytEl = typeof youtubeListId === 'string' ? document.getElementById(youtubeListId) : youtubeListId;
      const plyEl = typeof playlistId === 'string' ? document.getElementById(playlistId) : playlistId;
      const woniEl = typeof woniListId === 'string' ? document.getElementById(woniListId) : woniListId;

      if (ytEl && result.latestVideos) {
        renderOfficialYoutubeList(ytEl, result.latestVideos);
        setupHorizontalScroller(ytEl);
      }
      if (plyEl && result.officialPlaylistVideos) {
        renderOfficialYoutubeList(plyEl, result.officialPlaylistVideos);
        setupHorizontalScroller(plyEl);
      }
      if (woniEl && result.woniVideos) {
        renderWoniYoutubeList(woniEl, result.woniVideos);
        setupHorizontalScroller(woniEl);
      }

      // 2. 실시간 라이브 배너 연동
      const liveBanner = typeof liveBannerId === 'string' ? document.getElementById(liveBannerId) : liveBannerId;
      if (liveBanner) {
        if (result.isLive && result.latestVideos && result.latestVideos.length > 0) {
          liveBanner.style.display = 'block';
          liveBanner.href = result.latestVideos[0].url || '#';
        } else {
          liveBanner.style.display = 'none';
        }
      }

      // 3. 채널 아이콘 순서 복원 및 드래그 정렬 엔진 바인딩
      const hubEl = typeof hubContainerId === 'string' ? document.getElementById(hubContainerId) : hubContainerId;
      if (hubEl) {
        if (result.channelOrder && Array.isArray(result.channelOrder)) {
          const currentBtns = Array.from(hubEl.querySelectorAll('.hub-icon-btn'));
          const btnMap = {};
          currentBtns.forEach(b => { btnMap[b.getAttribute('data-key')] = b; });
          result.channelOrder.forEach(key => {
            if (btnMap[key]) hubEl.appendChild(btnMap[key]);
          });
        }
        setupHubIconReordering(hubEl, (newOrder) => {
          chrome.storage.local.set({ channelOrder: newOrder });
        });
      }

      // 4. 스케줄 리스트 렌더링 (사이드패널 홈 탭용)
      const schedEl = typeof scheduleListId === 'string' ? document.getElementById(scheduleListId) : scheduleListId;
      if (schedEl && result.blipSchedules) {
        renderScheduleList(schedEl, result.blipSchedules);
      }

      // 5. 스케줄 데이터 콜백 (캘린더 매니저 등)
      if (typeof onSchedulesLoaded === 'function' && result.blipSchedules) {
        onSchedulesLoaded(result.blipSchedules);
      }

      // 6. 전체 데이터 로드 완료 콜백
      if (typeof onDataLoaded === 'function') {
        onDataLoaded(result);
      }
    }
  );
}
