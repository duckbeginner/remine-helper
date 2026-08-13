import { DEFAULT_CHANNEL_ORDER, CHANNEL_DATA_MAP } from './constants.js';

document.addEventListener("DOMContentLoaded", () => {
  const bodyEl = document.body;
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

  // --- 테마 적용 코어 함수 ---
  function applyTheme(mode) {
    let isDark = false;

    if (mode === "dark") {
      isDark = true;
    } else if (mode === "light") {
      isDark = false;
    } else {
      // mode === "system"
      isDark = systemThemeQuery.matches;
    }

    // 화면에 다크모드 클래스 토글
    if (isDark) bodyEl.classList.add("dark-mode");
    else bodyEl.classList.remove("dark-mode");

    // 버튼 텍스트 업데이트
    if (themeToggleBtn) {
      if (mode === "dark") {
        themeToggleBtn.innerText = "🌙 다크";
      } else if (mode === "light") {
        themeToggleBtn.innerText = "☀️ 라이트";
      } else {
        themeToggleBtn.innerText = "💻 시스템";
      }
    }
  }

  // 1. 초기 로드 시 테마 설정 (기본값: 시스템)
  chrome.storage.local.get(["themeMode"], (res) => {
    const currentMode = res.themeMode || "system";
    applyTheme(currentMode);
  });

  // 2. 기기(OS) 테마가 실시간으로 바뀔 때 감지 (시스템 모드일 때만 반응)
  systemThemeQuery.addEventListener("change", () => {
    chrome.storage.local.get(["themeMode"], (res) => {
      const currentMode = res.themeMode || "system";
      if (currentMode === "system") {
        applyTheme("system");
      }
    });
  });

  // 3. 테마 토글 버튼 클릭 시 3단계 순환 (시스템 -> 다크 -> 라이트 -> 시스템...)
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      chrome.storage.local.get(["themeMode"], (res) => {
        let currentMode = res.themeMode || "system";
        let nextMode = "system";

        if (currentMode === "system") nextMode = "dark";
        else if (currentMode === "dark") nextMode = "light";
        else if (currentMode === "light") nextMode = "system";

        // 스토리지에 새 모드 저장 (저장하면 onChanged 리스너가 받아서 적용함)
        chrome.storage.local.set({ themeMode: nextMode });
      });
    });
  }

  // 4. 새 탭 ↔ 사이드 패널 간 테마 실시간 동기화
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.themeMode) {
      applyTheme(changes.themeMode.newValue);
    }
  });

  // --- 대시보드 강제 열기 기능 ---
  const openDashboardBtn = document.getElementById("openDashboardBtn");
  if (openDashboardBtn) {
    openDashboardBtn.addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
    });
  }

  // --- constants.js에서 공식 로고 가져와서 탭 버튼에 동적 삽입 ---
  const tabInsta = document.querySelector('.panel-tab-btn[data-target="tabInsta"]');
  const tabX = document.querySelector('.panel-tab-btn[data-target="tabX"]');
  const tabTiktok = document.querySelector('.panel-tab-btn[data-target="tabTiktok"]');
  const tabBlip = document.querySelector('.panel-tab-btn[data-target="tabBlip"]');
  const tabClip = document.querySelector('.panel-tab-btn[data-target="tabClip"]');
  const tabXEmbed = document.querySelector('.panel-tab-btn[data-target="tabXEmbed"]');
  const tabDC = document.querySelector('.panel-tab-btn[data-target="tabDC"]');
  const tabTiktokFrame = document.querySelector('.panel-tab-btn[data-target="tabTiktokFrame"]');

  if (tabInsta && CHANNEL_DATA_MAP.instagram) {
    tabInsta.innerHTML = `<span class="tab-icon-wrap">${CHANNEL_DATA_MAP.instagram.svg}</span>`;
  }
  if (tabX && CHANNEL_DATA_MAP.x) {
    tabX.innerHTML = `<span class="tab-icon-wrap">${CHANNEL_DATA_MAP.x.svg}</span>`;
  }
  if (tabTiktok && CHANNEL_DATA_MAP.tiktok) {
    tabTiktok.innerHTML = `<span class="tab-icon-wrap">${CHANNEL_DATA_MAP.tiktok.svg}</span>`;
  }
  if (tabBlip && CHANNEL_DATA_MAP.blip) {
    tabBlip.innerHTML = `<span class="tab-icon-wrap">${CHANNEL_DATA_MAP.blip.svg}</span>`;
  }
  if (tabClip && CHANNEL_DATA_MAP.clip) {
    tabClip.innerHTML = `<span class="tab-icon-wrap">${CHANNEL_DATA_MAP.clip.svg}</span>`;
  }
  if (tabXEmbed && CHANNEL_DATA_MAP.x) {
    tabXEmbed.innerHTML = `<span class="tab-icon-wrap">${CHANNEL_DATA_MAP.x.svg}Embed</span>`;
  }
  if (tabDC && CHANNEL_DATA_MAP.dcinside) {
    tabDC.innerHTML = `<span class="tab-icon-wrap"><img class="tab-icon-dc" src="${CHANNEL_DATA_MAP.dcinside.img}" alt="DC Inside Logo"  /></span>`;
  }
  if (tabTiktokFrame && CHANNEL_DATA_MAP.tiktok) {
    tabTiktokFrame.innerHTML = `<span class="tab-icon-wrap">${CHANNEL_DATA_MAP.tiktok.svg}</span>`;
  }

  // --- 사이드 패널 상단 탭 전환 로직 ---
  const tabButtons = document.querySelectorAll(".panel-tab-btn");
  const tabContents = document.querySelectorAll(".panel-tab-content");

  let isInstaLoaded = false;
  let isXLoaded = false;
  let isTiktokLoaded = false;
  let isSceneFlixLoaded = false;
  let isResceneLoveLoaded = false;
  let isMuzipChartLoaded = false;
  let isToDoLoaded = false;
  let isResceneFanLoaded = false;
  let isBlipLoaded = false;
  let isClipLoaded = false;
  let isTiktokFrameLoaded = false;
  let isDCLoaded = false;
  let isMnetLoaded = false;

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");

      // 버튼 active 클래스 정리
      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // 탭 컨텐츠 뷰 전환
      tabContents.forEach(content => {
        if (content.id === targetId) {
          content.classList.add("active");
        } else {
          content.classList.remove("active");
        }
      });

      // 탭이 열릴 때 공식 임베드 지연 렌더링 실행
      if (targetId === "tabInsta" && !isInstaLoaded) {
        renderInstaEmbeds();
        isInstaLoaded = true;
      } else if (targetId === "tabX" && !isXLoaded) {
        renderXEmbeds();
        isXLoaded = true;
      } else if (targetId === "tabTiktok" && !isTiktokLoaded) {
        renderTiktokEmbeds();
        isTiktokLoaded = true;
      } else if (targetId === "tabSceneFlix" && !isSceneFlixLoaded) {
        renderSceneFlixEmbeds();
        isSceneFlixLoaded = true;
      } else if (targetId === "tabResceneLove" && !isResceneLoveLoaded) {
        renderResceneLoveEmbeds();
        isResceneLoveLoaded = true;
      } else if (targetId === "tabMuzipChart" && !isMuzipChartLoaded) {
        renderMuzipChartEmbeds();
        isMuzipChartLoaded = true;
      } else if (targetId === "tabToDo" && !isToDoLoaded) {
        renderToDoEmbeds();
        isToDoLoaded = true;
      } else if (targetId === "tabResceneFan" && !isResceneFanLoaded) {
        renderResceneFanEmbeds();
        isResceneFanLoaded = true;
      } else if (targetId === "tabBlip" && !isBlipLoaded) {
        renderBlipEmbeds();
        isBlipLoaded = true;
      } else if (targetId === "tabClip" && !isClipLoaded) {
        renderClipEmbeds();
        isClipLoaded = true;
      } else if (targetId === "tabTiktokFrame" && !isTiktokFrameLoaded) {
        renderTiktokFrame();
        isTiktokFrameLoaded = true;
      } else if (targetId === "tabDC" && !isDCLoaded) {
        renderDCEmbeds();
        isDCLoaded = true;
      } else if (targetId === "tabMnet" && !isMnetLoaded) {
        renderMnetEmbeds();
        isMnetLoaded = true;
      }
    });
  });

  // --- 유틸리티 함수 모음 ---
  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function linkifyMessage(text) {
    if (!text) return "";
    const safeText = escapeHtml(text);
    return safeText.replace(/(https?:\/\/[^\s]+)/g, (url) => `<a href="${url}" target="_blank">${url}</a>`);
  }

  function parseSafeDate(startTimeStr) {
    if (!startTimeStr) return new Date();
    if (startTimeStr.length === 10 && !startTimeStr.includes('T')) {
      const [y, m, d] = startTimeStr.split('-').map(Number);
      return new Date(y, m - 1, d, 0, 0, 0);
    }
    const d = new Date(startTimeStr);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  function getTimeAgo(dateString) {
    if (!dateString) return "최신 업로드";
    const now = new Date();
    const past = parseSafeDate(dateString);
    const diffMs = now - past;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return "방금 전";
    if (diffMin < 60) return `${diffMin}분 전`;
    if (diffHour < 24) return `${diffHour}시간 전`;
    if (diffDay < 7) return `${diffDay}일 전`;
    if (diffDay < 30) return `${Math.floor(diffDay / 7)}주 전`;
    if (diffDay < 365) return `${Math.floor(diffDay / 30)}개월 전`;
    return `${Math.floor(diffDay / 365)}년 전`;
  }

  // 모달 제어 함수
  const modalOverlay = document.getElementById("scheduleModalOverlay");
  const modalBody = document.getElementById("modalBodyContent");
  const modalCloseBtn = document.getElementById("modalCloseBtn");

  function openModal(htmlContent) {
    if (modalBody && modalOverlay) {
      modalBody.innerHTML = htmlContent;
      modalOverlay.classList.add("show");
    }
  }

  function closeModal() {
    if (modalOverlay) {
      modalOverlay.classList.remove("show");
    }
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // 허브 렌더링
  function renderHubIcons(order) {
    const hubContainer = document.getElementById("hubContainer");
    if (!hubContainer) return;
    hubContainer.innerHTML = "";
    order.forEach(key => {
      const channel = CHANNEL_DATA_MAP[key];
      if (channel) {
        const a = document.createElement("a");
        a.href = channel.url;
        a.target = "_blank";
        a.className = "hub-icon-btn";
        a.title = channel.name;

        if (channel.img) {
          const img = document.createElement("img");
          img.src = channel.img;
          if (channel.customImgClass) img.className = channel.customImgClass;
          a.innerHTML = "";
          a.appendChild(img);
        } else {
          a.innerHTML = channel.svg;
        }

        a.setAttribute("draggable", "true");
        a.setAttribute("data-key", key);

        a.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/plain", key);
          setTimeout(() => a.classList.add("dragging"), 0);
        });

        a.addEventListener("dragend", () => a.classList.remove("dragging"));
        a.addEventListener("dragover", (e) => e.preventDefault());
        a.addEventListener("drop", (e) => {
          e.preventDefault();
          const draggedKey = e.dataTransfer.getData("text/plain");
          if (draggedKey === key) return;

          chrome.storage.local.get(["channelOrder"], (res) => {
            let currentOrder = [...(res.channelOrder || DEFAULT_CHANNEL_ORDER)];
            const fromIdx = currentOrder.indexOf(draggedKey);
            const toIdx = currentOrder.indexOf(key);

            if (fromIdx !== -1 && toIdx !== -1) {
              currentOrder.splice(fromIdx, 1);
              currentOrder.splice(toIdx, 0, draggedKey);
              chrome.storage.local.set({ channelOrder: currentOrder }, () => {
                renderHubIcons(currentOrder);
              });
            }
          });
        });

        hubContainer.appendChild(a);
      }
    });
  }

  chrome.storage.local.get(["channelOrder"], (res) => {
    renderHubIcons(res.channelOrder || DEFAULT_CHANNEL_ORDER);
  });

  // --- 수평 스크롤러 생성 및 버튼 제어 (2개씩 이동) ---
  function scrollByCards(viewport, count) {
    const card = viewport.querySelector('.video-card');
    if (!card) return;
    const gap = parseFloat(getComputedStyle(viewport).gap) || 8;
    const cardWidth = Math.ceil(card.getBoundingClientRect().width + gap) || viewport.clientWidth / 3;
    viewport.scrollBy({ left: cardWidth * count, behavior: 'smooth' });
  }

  function setupHorizontalScroller(containerId) {
    const orig = document.getElementById(containerId);
    if (!orig) return;
    if (orig.classList.contains('hscroll-container')) return;

    const leftBtn = document.createElement('button');
    leftBtn.className = 'hscroll-btn left';
    leftBtn.setAttribute('aria-label', '왼쪽으로 이동');
    leftBtn.innerText = '◀';
    const rightBtn = document.createElement('button');
    rightBtn.className = 'hscroll-btn right';
    rightBtn.setAttribute('aria-label', '오른쪽으로 이동');
    rightBtn.innerText = '▶';

    const viewport = document.createElement('div');
    viewport.className = 'hscroll-viewport';
    while (orig.firstChild) viewport.appendChild(orig.firstChild);
    orig.appendChild(viewport);
    orig.classList.add('hscroll-container');
    orig.insertBefore(leftBtn, viewport);
    orig.appendChild(rightBtn);

    leftBtn.addEventListener('click', () => scrollByCards(viewport, -2));
    rightBtn.addEventListener('click', () => scrollByCards(viewport, 2));

    viewport.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
        e.preventDefault();
        viewport.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

  // 캘린더 전용 변수
  let spCurrentYear = new Date().getFullYear();
  let spCurrentMonth = new Date().getMonth();
  let spGlobalSchedules = [];

  // 데이터 초기 로드
  chrome.storage.local.get(["latestVideos", "officialPlaylistVideos", "woniVideos", "isLive", "blipSchedules"], (result) => {
    const liveBanner = document.getElementById("liveBanner");
    if (liveBanner) {
      if (result.isLive && result.latestVideos && result.latestVideos.length > 0) {
        liveBanner.style.display = "block";
        liveBanner.href = result.latestVideos[0].url;
      } else {
        liveBanner.style.display = "none";
      }
    }

    const youtubeContainer = document.getElementById("youtubeList");
    if (youtubeContainer && result.latestVideos) {
      youtubeContainer.innerHTML = "";
      result.latestVideos.slice(0, 10).forEach(video => {
        const card = document.createElement("a");
        card.href = video.url;
        card.target = "_blank";
        card.className = "video-card";
        card.innerHTML = `
          <img src="${video.thumbnail}" alt="thumb">
          <div class="video-info">
            <div class="card-title">${escapeHtml(video.title)}</div>
            <div class="card-date">📅 ${getTimeAgo(video.published)}</div>
          </div>
        `;
        youtubeContainer.appendChild(card);
      });
      setupHorizontalScroller('youtubeList');
    }

    const playlistContainer = document.getElementById("playlistYoutubeList");
    if (playlistContainer) {
      playlistContainer.innerHTML = "";
      if (result.officialPlaylistVideos && result.officialPlaylistVideos.length > 0) {
        result.officialPlaylistVideos.slice(0, 10).forEach(video => {
          const card = document.createElement("a");
          card.href = video.url;
          card.target = "_blank";
          card.className = "video-card";
          card.innerHTML = `
            <img src="${video.thumbnail}" alt="thumb">
            <div class="video-info">
              <div class="card-title">${escapeHtml(video.title)}</div>
              <div class="card-date">📅 ${getTimeAgo(video.published)}</div>
            </div>
          `;
          playlistContainer.appendChild(card);
        });
        setupHorizontalScroller('playlistYoutubeList');
      } else {
        playlistContainer.innerHTML = `<p style="font-size: 12px; color: #777; text-align: center; grid-column: span 3;">공식 재생목록 영상이 없습니다.</p>`;
      }
    }

    const woniContainer = document.getElementById("woniYoutubeList");
    if (woniContainer && result.woniVideos) {
      woniContainer.innerHTML = "";
      result.woniVideos.slice(0, 10).forEach(video => {
        const card = document.createElement("a");
        card.href = video.url;
        card.target = "_blank";
        card.className = "video-card";
        card.innerHTML = `
          <img src="${video.thumbnail}" alt="thumb">
          <div class="video-info">
            <div class="card-title">${escapeHtml(video.title)}</div>
            <div class="card-date">📅 ${getTimeAgo(video.published)}</div>
          </div>
        `;
        woniContainer.appendChild(card);
      });
      setupHorizontalScroller('woniYoutubeList');
    }

    const scheduleContainer = document.getElementById("scheduleList");
    let schedules = result.blipSchedules || [];

    if (scheduleContainer && schedules.length > 0) {
      scheduleContainer.innerHTML = "";
      const now = new Date().getTime();
      let nextIndex = schedules.findIndex(item => parseSafeDate(item.startTime).getTime() >= now);
      if (nextIndex === -1) nextIndex = schedules.length - 1;

      const startIndex = Math.max(0, nextIndex - 5);
      const endIndex = Math.min(schedules.length, nextIndex + 6);
      const slicedSchedules = schedules.slice(startIndex, endIndex);

      let selectedItemDiv = null;

      slicedSchedules.forEach((item) => {
        const div = document.createElement("div");
        div.className = "schedule-item";

        let dateLabel = "일정";
        let timeStr = "";
        if (item.startTime) {
          const d = parseSafeDate(item.startTime);
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          dateLabel = `${month}/${day}`;

          let h = d.getHours();
          const m = String(d.getMinutes()).padStart(2, '0');
          if (!(h === 0 && m === '00' && item.startTime.includes('T15:00:00'))) {
            const ap = h >= 12 ? '오후' : '오전';
            h = h % 12 || 12;
            timeStr = `${ap} ${h}:${m}`;
          } else {
            timeStr = "종일 일정";
          }
        }

        let typeText = "";
        if (item.message && item.message.startsWith("[")) {
          const match = item.message.match(/^\[(.*?)\]/);
          if (match) typeText = match[1];
        } else if (item.typeId) {
          const typeMap = { 1: "방송", 2: "릴리즈", 4: "기념일", 5: "행사" };
          typeText = typeMap[item.typeId] || "";
        }

        let typeBadge = "";
        if (typeText) {
          let bg = "#e3f2fd", color = "#1976d2";
          if (typeText.includes("방송")) { bg = "#ffe4ec"; color = "#d63384"; }
          else if (typeText.includes("행사") || typeText.includes("공연")) { bg = "#e2f0d9"; color = "#388e3c"; }
          else if (typeText.includes("팬사인") || typeText.includes("팬싸")) { bg = "#f3e5f5"; color = "#8e24aa"; }
          else if (typeText.includes("기념일") || typeText.includes("생일")) { bg = "#fff9c4"; color = "#f57f17"; }

          typeBadge = `<span style="background:${bg}; color:${color}; padding:1px 4px; border-radius:3px; font-size:10px; font-weight:600; margin-left:4px; margin-right:4px;">[${typeText}]</span>`;
        }

        const title = item.title || "스케줄";
        let extraInfo = "";
        if (item.extField && item.extField.value) {
          extraInfo = ` <span style="color:#888; font-size:10px;">(${escapeHtml(item.extField.value.trim())})</span>`;
        }

        const dateAndTimeString = `${dateLabel} ${timeStr}`;

        div.innerHTML = `
          <div class="schedule-line">
            <span class="schedule-date-time">[${dateAndTimeString}]</span>
            ${typeBadge}
            <span class="schedule-title" title="">${escapeHtml(title)}${extraInfo}</span>
          </div>
        `;

        const detailedContent = `<span class="detail-time">⏰ [${dateAndTimeString}]</span>` + linkifyMessage(item.message);

        div.addEventListener("mouseenter", () => {
          const tooltip = document.getElementById("scheduleTooltip");
          if (tooltip) {
            tooltip.innerText = title;
            tooltip.style.display = "block";
          }
        });
        div.addEventListener("mousemove", (e) => {
          const tooltip = document.getElementById("scheduleTooltip");
          if (tooltip) {
            tooltip.style.left = (e.pageX + 10) + "px";
            tooltip.style.top = (e.pageY + 15) + "px";
          }
        });
        div.addEventListener("mouseleave", () => {
          const tooltip = document.getElementById("scheduleTooltip");
          if (tooltip) tooltip.style.display = "none";
        });

        div.addEventListener("click", () => {
          const tooltip = document.getElementById("scheduleTooltip");
          if (tooltip) tooltip.style.display = "none";
          document.querySelectorAll(".schedule-item").forEach(el => el.classList.remove("active"));
          div.classList.add("active");
          openModal(detailedContent);
        });

        if (parseSafeDate(item.startTime).getTime() >= now && !selectedItemDiv) {
          div.classList.add("active");
          selectedItemDiv = div;
        }

        scheduleContainer.appendChild(div);
      });

      if (selectedItemDiv) {
        setTimeout(() => {
          selectedItemDiv.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }, 100);
      }
    } else if (scheduleContainer) {
      scheduleContainer.innerHTML = `<div class="schedule-item">등록된 스케줄이 없습니다.</div>`;
    }

    spGlobalSchedules = result.blipSchedules || [];
    renderSidePanelCalendar();
  });

  // 캘린더 네비게이션 버튼 이벤트 (이전/다음 달)
  const spPrevBtn = document.getElementById("spPrevMonthBtn");
  const spNextBtn = document.getElementById("spNextMonthBtn");

  if (spPrevBtn) {
    spPrevBtn.addEventListener("click", () => {
      spCurrentMonth--;
      if (spCurrentMonth < 0) { spCurrentMonth = 11; spCurrentYear--; }
      renderSidePanelCalendar();
    });
  }
  if (spNextBtn) {
    spNextBtn.addEventListener("click", () => {
      spCurrentMonth++;
      if (spCurrentMonth > 11) { spCurrentMonth = 0; spCurrentYear++; }
      renderSidePanelCalendar();
    });
  }

  // 캘린더 렌더링 코어 함수
  function renderSidePanelCalendar() {
    const calendarGrid = document.getElementById("spCalendarGrid");
    const monthTitle = document.getElementById("spCalendarMonthTitle");

    if (monthTitle) {
      monthTitle.innerText = `${spCurrentYear}년 ${spCurrentMonth + 1}월`;
    }

    if (!calendarGrid) return;
    calendarGrid.innerHTML = "";

    const firstDayIndex = new Date(spCurrentYear, spCurrentMonth, 1).getDay();
    const lastDay = new Date(spCurrentYear, spCurrentMonth + 1, 0).getDate();
    const prevLastDay = new Date(spCurrentYear, spCurrentMonth, 0).getDate();

    let daysArr = [];
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      daysArr.push({ day: prevLastDay - i, isCurrentMonth: false, dateStr: "" });
    }
    for (let i = 1; i <= lastDay; i++) {
      const mm = String(spCurrentMonth + 1).padStart(2, '0');
      const dd = String(i).padStart(2, '0');
      daysArr.push({ day: i, isCurrentMonth: true, dateStr: `${spCurrentYear}-${mm}-${dd}` });
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
          today.getMonth() === spCurrentMonth &&
          today.getFullYear() === spCurrentYear;
        if (isToday) cell.classList.add("today");

        cell.innerHTML = `<div class="cell-date">${cellInfo.day}</div><div class="cell-events"></div>`;
        const eventsContainer = cell.querySelector(".cell-events");

        if (cellInfo.isCurrentMonth && cellInfo.dateStr) {
          const daySchedules = spGlobalSchedules.filter(item => {
            if (!item.startTime) return false;
            const d = parseSafeDate(item.startTime);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}` === cellInfo.dateStr;
          });

          daySchedules.forEach(item => {
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

            const badge = document.createElement("div");
            badge.className = "cal-event-badge";
            badge.style.background = bg;
            badge.style.color = color;

            let timeStrForBadge = "";
            let timeStrForModal = "";
            if (item.startTime) {
              const d = parseSafeDate(item.startTime);
              let h = d.getHours();
              const m = String(d.getMinutes()).padStart(2, '0');
              if (!(h === 0 && m === '00' && item.startTime.includes('T15:00:00'))) {
                const ap = h >= 12 ? '오후' : '오전';
                h = h % 12 || 12;
                timeStrForBadge = `${ap} ${h}:${m}`;
                timeStrForModal = `${cellInfo.dateStr} ${ap} ${h}:${m}`;
              } else {
                timeStrForBadge = "종일 일정";
                timeStrForModal = `${cellInfo.dateStr} 종일 일정`;
              }
            }

            badge.innerHTML = `<span class="badge-time">${timeStrForBadge}</span>${escapeHtml(item.title || "일정")}`;

            badge.addEventListener("mouseenter", () => {
              const tooltip = document.getElementById("scheduleTooltip");
              if (tooltip) {
                tooltip.innerText = item.title || "일정";
                tooltip.style.display = "block";
              }
            });
            badge.addEventListener("mousemove", (e) => {
              const tooltip = document.getElementById("scheduleTooltip");
              if (tooltip) {
                tooltip.style.left = (e.pageX + 10) + "px";
                tooltip.style.top = (e.pageY + 15) + "px";
              }
            });
            badge.addEventListener("mouseleave", () => {
              const tooltip = document.getElementById("scheduleTooltip");
              if (tooltip) tooltip.style.display = "none";
            });

            badge.addEventListener("click", (e) => {
              e.stopPropagation();
              const tooltip = document.getElementById("scheduleTooltip");
              if (tooltip) tooltip.style.display = "none";
              const detailedContent = `<span class="modal-time">⏰ ${timeStrForModal}</span>` + linkifyMessage(item.message);
              openModal(detailedContent);
            });

            eventsContainer.appendChild(badge);
          });
        }
        weekRow.appendChild(cell);
      });
      calendarGrid.appendChild(weekRow);
    });
  }

  // --- 2단 모드 반응형 UX 처리 (빈 화면 방지) ---
  const mediaQuery = window.matchMedia("(min-width: 800px)");

  function handleResize(e) {
    if (e.matches) {
      const homeBtn = document.querySelector('.panel-tab-btn[data-target="tabHome"]');
      if (homeBtn && homeBtn.classList.contains('active')) {
        const scheduleBtn = document.querySelector('.panel-tab-btn[data-target="tabSchedule"]');
        if (scheduleBtn) scheduleBtn.click();
      }
    } else {
      const scheduleBtn = document.querySelector('.panel-tab-btn[data-target="tabSchedule"]');
      if (scheduleBtn && scheduleBtn.classList.contains('active')) {
        const homeBtn = document.querySelector('.panel-tab-btn[data-target="tabHome"]');
        if (homeBtn) homeBtn.click();
      }
    }
  }

  mediaQuery.addEventListener('change', handleResize);
  handleResize(mediaQuery);

  // --- 소셜 피드 렌더링 (지연 로딩) ---
  function renderInstaEmbeds() {
    const container = document.getElementById("instaFeedList");
    if (!container) return;

    chrome.storage.local.get(["instaFeeds"], (res) => {
      const feeds = res.instaFeeds || [];
      if (feeds.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#888; margin-top:20px;">불러온 피드가 없습니다.</p>`;
        return;
      }

      container.innerHTML = "";
      feeds.forEach(feed => {
        const m = feed.link.match(/\/(p|reel|reels)\/([^\/?#]+)/i);
        if (!m) return;
        const type = (m[1] || 'p').toLowerCase();
        const id = m[2];
        const isDark = document.body.classList.contains("dark-mode") ? "dark" : "light";

        const wrapper = createInstagramEmbedIframe(type, id, isDark);
        container.appendChild(wrapper);
      });
    });
  }

  function createInstagramEmbedIframe(type, id, isDark) {
    const wrapper = document.createElement('div');
    wrapper.className = 'feed-iframe-wrapper';

    let embedPath = '';
    embedPath = `/${type}/${id}/embed/captioned/?theme=${isDark}`;

    const iframe = document.createElement('iframe');
    iframe.src = `https://www.instagram.com${embedPath}`;
    iframe.style.width = '100%';
    iframe.style.height = '650px';
    iframe.style.transition = 'height 0.3s ease';
    iframe.style.minHeight = '650px';
    iframe.frameBorder = '0';
    iframe.scrolling = 'no';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.loading = 'lazy';
    iframe.height = '650';

    wrapper.appendChild(iframe);
    return wrapper;
  }

  function renderXEmbeds() {
    const container = document.getElementById("xFeedList");
    if (!container) return;

    chrome.storage.local.get(["xFeeds"], (res) => {
      const feeds = res.xFeeds || [];
      if (feeds.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#888; margin-top:20px;">불러온 피드가 없습니다.</p>`;
        return;
      }

      container.innerHTML = "";
      const isDark = document.body.classList.contains("dark-mode") ? "dark" : "light";

      feeds.forEach(feed => {
        const tweetId = feed.id;
        if (tweetId) {
          const wrapper = document.createElement("div");
          wrapper.className = "feed-iframe-wrapper";
          wrapper.innerHTML = `<iframe src="https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=${isDark}" style="width: 100%; height: 250px; transition: height 0.3s ease;" frameborder="0" scrolling="no"></iframe>`;
          container.appendChild(wrapper);
        }
      });
    });
  }

  function renderTiktokEmbeds() {
    const container = document.getElementById("tiktokFeedList");
    if (!container) return;

    const isDark = document.body.classList.contains("dark-mode") ? "dark" : "light";
    container.className = "feed-iframe-wrapper";

    // [수정] 오타 수정: ${isDark}x -> ${isDark}
    container.innerHTML = `<iframe src="https://www.tiktok.com/embed/@rescene_official?theme=${isDark}" title="TikTok" style="width: 100%; height: 460px; transition: height 0.3s ease;" frameborder="0"></iframe>`;
  }

  function renderSceneFlixEmbeds() {
    const container = document.getElementById("sceneFlixFeedList");
    if (!container) return;

    const isDark = document.body.classList.contains("dark-mode") ? "dark" : "light";

    // [수정] 오타 수정: andbox= -> sandbox=
    container.innerHTML = `<iframe src="https://adam-yam.github.io/SCENE-FLIX/?theme=${isDark}" title="SCENE-FLIX" style="width: 100%; height: 250px; transition: height 0.3s ease;" frameborder="0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`;
  }

  function renderResceneLoveEmbeds() {
    const container = document.getElementById("resceneLoveFeedList");
    if (!container) return;

    const isDark = document.body.classList.contains("dark-mode") ? "dark" : "light";

    container.innerHTML = `<iframe src="https://rescene.love/?theme=${isDark}" title="Rescene Love" style="width: 100%; height: 250px; transition: height 0.3s ease;" frameborder="0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`;
  }

  function renderToDoEmbeds() {
    const container = document.getElementById("toDoFeedList");
    if (!container) return;

    container.innerHTML = `<iframe src="https://rescenefan.com/" title="To Do" style="width: 100%; height: 250px; transition: height 0.3s ease;" frameborder="0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`;
  }

  function renderMuzipChartEmbeds() {
    const container = document.getElementById("muzipChartFeedList");
    if (!container) return;

    container.innerHTML = `<iframe src="https://rescene.muzip.link/chart/" title="Muzip Chart" style="width: 100%; height: 250px; transition: height 0.3s ease;" frameborder="0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`;
  }

  function renderResceneFanEmbeds() {
    const container = document.getElementById("resceneFanFeedList");
    if (!container) return;

    container.innerHTML = `<iframe src="https://rescene.fan/" title="Rescene Fan" style="width: 100%; height: 250px; transition: height 0.3s ease;" frameborder="0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`;
  }
  function renderBlipEmbeds() {
    const container = document.getElementById("blipFeedList");
    if (!container) return;

    const isDark = document.body.classList.contains("dark-mode") ? "dark" : "light";

    container.innerHTML = `<iframe src="https://blip.kr/artists/RESCENE" title="Mnet" style="width: 100%; height: 250px; transition: height 0.3s ease;" frameborder="0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`;
  }
  function renderClipEmbeds() {
    const container = document.getElementById("clipFeedList");
    if (!container) return;

    const isDark = document.body.classList.contains("dark-mode") ? "dark" : "light";

    container.innerHTML = `<iframe src="https://clip.naver.com/@themuzeent?tab=all&filter=all&theme=${isDark}" title="Naver Clip" style="width: 100%; height: 250px; transition: height 0.3s ease;" frameborder="0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`;
  }
  function renderTiktokFrame() {
    const container = document.getElementById("tiktokFrameFeedList");
    if (!container) return;

    const isDark = document.body.classList.contains("dark-mode") ? "dark" : "light";

    container.innerHTML = `<iframe src="https://www.tiktok.com/@rescene_official" title="Tiktok" style="width: 100%; height: 250px; transition: height 0.3s ease;" frameborder="0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`;
  }
  function renderDCEmbeds() {
    const container = document.getElementById("dcFeedList");
    if (!container) return;

    const isDark = document.body.classList.contains("dark-mode") ? "dark" : "light";

    container.innerHTML = `<iframe src="https://m.dcinside.com/board/rescene1" title="DC" style="width: 100%; height: 250px; transition: height 0.3s ease;" frameborder="0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-same-site-none-cookies"></iframe>`;
  }
  function renderMnetEmbeds() {
    const container = document.getElementById("mnetFeedList");
    if (!container) return;

    const isDark = document.body.classList.contains("dark-mode") ? "dark" : "light";

    container.innerHTML = `<iframe src="https://artist.mnetplus.world/main/stg/rescene-official" title="Mnet" style="width: 100%; height: 250px; transition: height 0.3s ease;" frameborder="0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-same-site-none-cookies"></iframe>`;
  }

});
// https://themuze.kr/protect

// --- 인스타 & X 공식 위젯 자동 높이 조절 (postMessage 감지) ---
window.addEventListener("message", (event) => {
  try {
    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    if (data && data.type === 'MEASURE' && data.details && data.details.height) {
      const iframes = document.querySelectorAll('.feed-iframe-wrapper iframe');
      for (let iframe of iframes) {
        if (iframe.contentWindow === event.source) {
          iframe.style.height = `${data.details.height}px`;
          break;
        }
      }
    }
  } catch (e) { }

  try {
    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    if (data && data["twttr.embed"] && data["twttr.embed"].method === "twttr.private.resize") {
      const params = data["twttr.embed"].params;
      const height = Array.isArray(params) && params.length > 0 ? params[0].height : params.height;

      if (height) {
        const iframes = document.querySelectorAll('.feed-iframe-wrapper iframe');
        for (let iframe of iframes) {
          if (iframe.contentWindow === event.source) {
            iframe.style.height = `${height}px`;
            break;
          }
        }
      }
    }
  } catch (e) { }

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
