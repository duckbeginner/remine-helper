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

    // OS 테마 실시간 변경 감지
    systemThemeQuery.addEventListener('change', () => {
      chrome.storage.local.get(['themeMode'], (res) => {
        const currentMode = res.themeMode || 'system';
        if (currentMode === 'system') {
          applyTheme('system');
        }
      });
    });

    // 버튼 클릭 시 3단계 순환
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

      // 컨텐츠 뷰 전환
      tabContents.forEach(content => {
        if (content.id === targetId) {
          content.classList.add('active');
        } else {
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

  container.innerHTML = slicedSchedules.map(item => {
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

    const { typeText } = getScheduleTypeInfo(item);
    const typePrefix = typeText ? `[${escapeHtml(typeText)}] ` : '';
    const titleText = escapeHtml(item.message || item.title || '스케줄');

    return `
      <div class="schedule-item" data-date="${escapeHtml(rawDate)}" title="${titleText}">
        <div class="schedule-line">
          <span class="schedule-date-time">${dateLabel}${timeStr}</span>
          <span class="schedule-title">${typePrefix}${titleText}</span>
        </div>
      </div>
    `;
  }).join('');

  if (typeof onSelectDate === 'function') {
    container.querySelectorAll('.schedule-item').forEach(el => {
      el.addEventListener('click', () => {
        const date = el.getAttribute('data-date');
        onSelectDate(date);
      });
    });
  }
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

export function renderInstaEmbeds(container, feeds = [], isDark = false) {
  if (!container) return;
  if (!feeds || feeds.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">인스타그램 피드가 없습니다.</p>';
    return;
  }

  const themeStr = isDark ? 'dark' : 'light';
  container.innerHTML = '';

  feeds.forEach(feed => {
    const link = feed.link || feed.permalink || feed.url || '';
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
      wrapper.innerHTML = `<iframe src="https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=${themeStr}" style="width: 100%; height: 250px; transition: height 0.3s ease;" frameborder="0" scrolling="no"></iframe>`;
      container.appendChild(wrapper);
    }
  });
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

export function showScheduleModal(scheduleData) {
  const overlay = document.getElementById('scheduleModalOverlay');
  const bodyContent = document.getElementById('modalBodyContent');
  const modalTitle = document.getElementById('modalTitle');

  if (!overlay || !bodyContent) return;

  if (modalTitle) {
    const rawTitle = decodeHtmlEntities(scheduleData.title || '스케줄 상세 정보');
    modalTitle.textContent = rawTitle;
  }

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
  overlay.style.display = 'flex';
}

export function initScheduleModal() {
  const overlay = document.getElementById('scheduleModalOverlay');
  const closeBtn = document.getElementById('modalCloseBtn');

  if (closeBtn && overlay) {
    closeBtn.addEventListener('click', () => {
      overlay.style.display = 'none';
    });
  }

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.style.display = 'none';
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const overlay = document.getElementById('scheduleModalOverlay');
      if (overlay) overlay.style.display = 'none';
    }
  });
}

/* =========================================================================
   9. 인스타 & X 공식 위젯 자동 높이 조절 (postMessage Auto-Height Engine)
   ========================================================================= */

export function setupIframeAutoHeight() {
  window.addEventListener('message', (event) => {
    // 1. 인스타그램 공식 MEASURE 메시지 감지
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data && data.type === 'MEASURE' && data.details && data.details.height) {
        const iframes = document.querySelectorAll('.feed-iframe-wrapper iframe');
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
          const iframes = document.querySelectorAll('.feed-iframe-wrapper iframe');
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
        const iframes = document.querySelectorAll('#tabTiktok iframe');
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

      // 4. 스케줄 데이터 콜백
      if (typeof onSchedulesLoaded === 'function' && result.blipSchedules) {
        onSchedulesLoaded(result.blipSchedules);
      }

      // 5. 전체 데이터 로드 완료 콜백
      if (typeof onDataLoaded === 'function') {
        onDataLoaded(result);
      }
    }
  );
}
