import { DEFAULT_CHANNEL_ORDER, CHANNEL_DATA_MAP } from './constants.js';

// Dashboard 페이지는 새탭 대신 사이드패널/대시보드 오픈 버튼으로만 사용됩니다.

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

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function linkifyMessage(text) {
    if (!text) return "";
    const safeText = escapeHtml(text);
    return safeText.replace(/(https?:\/\/[^\s]+)/g, (url) => `<a href="${url}">${url}</a>`);
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

  function renderHubIcons(order) {
    const hubContainer = document.getElementById("dashboardHubContainer");
    if (!hubContainer) return;
    hubContainer.innerHTML = "";
    order.forEach(key => {
      const channel = CHANNEL_DATA_MAP[key];
      if (channel) {
        const a = document.createElement("a");
        a.href = channel.url;
        // a.target = "_blank"; // [제거] 현재 탭에서 열리도록 설정
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

        hubContainer.appendChild(a);
      }
    });
  }

  chrome.storage.local.get(["channelOrder"], (res) => {
    const order = res.channelOrder || DEFAULT_CHANNEL_ORDER;
    renderHubIcons(order);
  });

  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth();

  function loadDashboardData() {
    chrome.storage.local.get(["latestVideos", "officialPlaylistVideos", "woniVideos", "isLive", "blipSchedules"], (result) => {
      const liveBanner = document.getElementById("dashboardLiveBanner");
      if (liveBanner) {
        if (result.isLive && result.latestVideos && result.latestVideos.length > 0) {
          liveBanner.style.display = "inline-block";
          liveBanner.href = result.latestVideos[0].url;
          liveBanner.removeAttribute("target"); // 현재 탭 이동
        } else {
          liveBanner.style.display = "none";
        }
      }

      const youtubeContainer = document.getElementById("dashboardYoutubeList");
      if (youtubeContainer && result.latestVideos) {
        youtubeContainer.innerHTML = "";
        result.latestVideos.slice(0,10).forEach(video => {
          const card = document.createElement("a");
          card.href = video.url;
          // card.target = "_blank";
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
        setupHorizontalScroller('dashboardYoutubeList');
      }

      const playlistContainer = document.getElementById("dashboardPlaylistYoutubeList");
      if (playlistContainer) {
        playlistContainer.innerHTML = "";
        if (result.officialPlaylistVideos && result.officialPlaylistVideos.length > 0) {
          result.officialPlaylistVideos.slice(0,10).forEach(video => {
            const card = document.createElement("a");
            card.href = video.url;
            // card.target = "_blank";
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
          setupHorizontalScroller('dashboardPlaylistYoutubeList');
        } else {
          playlistContainer.innerHTML = `<p class="video-placeholder">공식 재생목록 영상이 없습니다.</p>`;
        }
      }

      const woniContainer = document.getElementById("dashboardWoniYoutubeList");
      if (woniContainer && result.woniVideos) {
        woniContainer.innerHTML = "";
        result.woniVideos.slice(0,10).forEach(video => {
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
        setupHorizontalScroller('dashboardWoniYoutubeList');
      }

      renderCalendar(result.blipSchedules);
    });
  }

      // --- 수평 스크롤러 생성 및 버튼 제어 (2개씩 이동) ---
      function scrollByCards(viewport, count) {
        const card = viewport.querySelector('.video-card');
        if (!card) return;
        const gap = parseFloat(getComputedStyle(viewport).gap) || 8;
        const cardWidth = Math.ceil(card.getBoundingClientRect().width + gap) || Math.max(1, Math.round(viewport.clientWidth / 3));
        viewport.scrollBy({ left: cardWidth * count, behavior: 'smooth' });
      }

      function setupHorizontalScroller(containerId) {
        const orig = document.getElementById(containerId);
        if (!orig) return;
        const hasContainerClass = orig.classList.contains('hscroll-container');
        const existingViewport = orig.querySelector('.hscroll-viewport');
        // If container already has the wrapper and viewport, nothing to do.
        if (hasContainerClass && existingViewport) return;

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
        // Move current children into viewport (works whether orig was freshly emptied or contains cards)
        while (orig.firstChild) viewport.appendChild(orig.firstChild);
        orig.appendChild(viewport);
        // Ensure container class exists
        orig.classList.add('hscroll-container');
        // Insert buttons around the viewport
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
// --- 모달 및 툴팁 제어 전역 함수/엘리먼트 ---
  const modalOverlay = document.getElementById("calendarModalOverlay");
  const modalBody = document.getElementById("modalBodyContent");
  const modalCloseBtn = document.getElementById("modalCloseBtn");
  const tooltip = document.getElementById("calendarTooltip");

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

  // ESC 키 누르면 모달 닫기
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  function renderCalendar(blipSchedules) {
    const calendarGrid = document.getElementById("calendarGrid");
    const monthTitle = document.getElementById("calendarMonthTitle");
    const detailBox = document.getElementById("calendarDetailBox");



    let schedules = blipSchedules || [];
    if (monthTitle) {
      monthTitle.innerText = `${currentYear}년 ${currentMonth + 1}월 스케줄`;
    }

    if (calendarGrid) {
      calendarGrid.innerHTML = "";

      const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
      const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      const prevLastDay = new Date(currentYear, currentMonth, 0).getDate();

      let daysArr = [];
      for (let i = firstDayIndex - 1; i >= 0; i--) {
        daysArr.push({ day: prevLastDay - i, isCurrentMonth: false, dateStr: "" });
      }
      for (let i = 1; i <= lastDay; i++) {
        const mm = String(currentMonth + 1).padStart(2, '0');
        const dd = String(i).padStart(2, '0');
        daysArr.push({ day: i, isCurrentMonth: true, dateStr: `${currentYear}-${mm}-${dd}` });
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
                          today.getMonth() === currentMonth &&
                          today.getFullYear() === currentYear;
          if (isToday) cell.classList.add("today");

          cell.innerHTML = `<div class="cell-date">${cellInfo.day}</div><div class="cell-events"></div>`;
          const eventsContainer = cell.querySelector(".cell-events");

          if (cellInfo.isCurrentMonth && cellInfo.dateStr) {
            const daySchedules = schedules.filter(item => {
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
                  timeStrForBadge = `${ap} ${h}:${m} `;
                  timeStrForModal = `${cellInfo.dateStr} ${ap} ${h}:${m}`;
                } else {
                  timeStrForModal = `${cellInfo.dateStr} 종일 일정`;
                }
              }

              badge.innerHTML = `<span class="badge-time">${timeStrForBadge}</span>${escapeHtml(item.title || "일정")}`;
              // [추가] 마우스 오버 시 툴팁 표시
              badge.addEventListener("mouseenter", (e) => {
                if (tooltip) {
                  tooltip.innerText = item.title || "일정";
                  tooltip.style.display = "block";
                }
              });

              badge.addEventListener("mousemove", (e) => {
                if (tooltip) {
                  tooltip.style.left = (e.pageX + 10) + "px";
                  tooltip.style.top = (e.pageY + 15) + "px";
                }
              });

              badge.addEventListener("mouseleave", () => {
                if (tooltip) {
                  tooltip.style.display = "none";
                }
              });

              // [수정] 클릭 시 하단 확장 대신 모달 팝업 창 띄우기
              badge.addEventListener("click", (e) => {
                e.stopPropagation();
                if (tooltip) tooltip.style.display = "none"; // 툴팁 숨기기

                const detailedContent = `<span class="modal-time">⏰ ${timeStrForModal}</span>` + linkifyMessage(item.message);
                openModal(detailedContent);
              });

              eventsContainer.appendChild(badge);
            });
          }

          cell.addEventListener("click", (e) => {
            if (!e.target.classList.contains("cal-event-badge") && !e.target.closest(".cal-event-badge")) {
              document.querySelectorAll(".calendar-week-row").forEach(r => r.classList.remove("expanded"));
              if (detailBox) detailBox.style.display = "none";
            }
          });

          weekRow.appendChild(cell);
        });

        calendarGrid.appendChild(weekRow);
      });
    }
  }

  const maximizeBtn = document.getElementById("maximizeCalendarBtn");
  const dashboardContainer = document.getElementById("dashboardMainGrid");

  if (maximizeBtn && dashboardContainer) {
    let isMaximized = false;
    maximizeBtn.addEventListener("click", () => {
      isMaximized = !isMaximized;
      if (isMaximized) {
        dashboardContainer.classList.add("maximized-calendar");
        maximizeBtn.innerText = "🔍 대시보드 복원";
      } else {
        dashboardContainer.classList.remove("maximized-calendar");
        maximizeBtn.innerText = "🔍 최대화";
      }
    });
  }
  // 화면 너비가 줄어들어 1024px 이하가 되는 경우 대시보드 복원
  // 1. 감지할 미디어 쿼리 조건 정의 (예: 화면 너비 768px 이하)
  const mediaQuery = window.matchMedia('(max-width: 1024px)');

  // 2. 상태 변화를 감지할 핸들러 함수 작성
  function handleDeviceChange(e) {
    if (e.matches) {
        dashboardContainer.classList.remove("maximized-calendar");
        maximizeBtn.innerText = "🔍 최대화";
      // console.log('세로모드');
    } else {
      // console.log('가로모드');
    }
  }

  // 3. 이벤트 리스너 등록 (상태가 바뀔 때마다 실행)
  mediaQuery.addEventListener('change', handleDeviceChange);

  // 4. 페이지 초기 로드 시점에도 한 번 실행 (현재 상태 반영)
  handleDeviceChange(mediaQuery);

  const mainGrid = document.getElementById("dashboardMainGrid");
  if (mainGrid) {
    mainGrid.addEventListener("click", (e) => {
      if (e.target.id === "dashboardMainGrid" || e.target.id === "calendarCardWrapper" || e.target.id === "calendarGrid") {
        document.querySelectorAll(".calendar-week-row").forEach(r => r.classList.remove("expanded"));
        const detailBox = document.getElementById("calendarDetailBox");
        if (detailBox) detailBox.style.display = "none";
      }
    });
  }

  const prevBtn = document.getElementById("prevMonthBtn");
  const nextBtn = document.getElementById("nextMonthBtn");

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      currentMonth--;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      loadDashboardData();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      loadDashboardData();
    });
  }

  loadDashboardData();
  // --- 대시보드 공식 로고 삽입 ---
  const tabInsta = document.querySelector('.panel-tab-btn[data-target="ntTabInsta"]');
  const tabX = document.querySelector('.panel-tab-btn[data-target="ntTabX"]');
  const tabTiktok = document.querySelector('.panel-tab-btn[data-target="ntTabTiktok"]');
  const tabClip = document.querySelector('.panel-tab-btn[data-target="ntTabClip"]');
  const tabDC = document.querySelector('.panel-tab-btn[data-target="ntTabDC"]');

  if (tabInsta && CHANNEL_DATA_MAP.instagram) tabInsta.innerHTML = `<span class="tab-icon-wrap">${CHANNEL_DATA_MAP.instagram.svg}</span><span class="btn-name">Instagram</span>`;
  if (tabX && CHANNEL_DATA_MAP.x) tabX.innerHTML = `<span class="tab-icon-wrap">${CHANNEL_DATA_MAP.x.svg}</span><span class="btn-name">X</span>`;
  if (tabTiktok && CHANNEL_DATA_MAP.tiktok) tabTiktok.innerHTML = `<span class="tab-icon-wrap">${CHANNEL_DATA_MAP.tiktok.svg}</span><span class="btn-name">TikTok</span>`;
  if (tabClip && CHANNEL_DATA_MAP.clip) tabClip.innerHTML = `<span class="tab-icon-wrap">${CHANNEL_DATA_MAP.clip.svg}</span><span class="btn-name">Clip</span>`;
  if (tabDC && CHANNEL_DATA_MAP.dcinside) tabDC.innerHTML = `<span class="tab-icon-wrap"><img class="tab-icon-dc" src="${CHANNEL_DATA_MAP.dcinside.img}" alt="DC Inside Logo"  /></span><span class="btn-name">DC</span>`;

  // --- 새 탭 멀티 뷰어 탭 전환 및 지연 로딩 ---
  const ntTabButtons = document.querySelectorAll(".panel-tab-btn");
  const ntTabContents = document.querySelectorAll(".panel-tab-content");

  let ntInstaLoaded = false;
  let ntXLoaded = false;
  let ntTiktokLoaded = false;
  let ntSceneFlixLoaded = false;
  let ntResceneLoveLoaded = false;
  let ntMuzipChartLoaded = false;
  let ntToDoLoaded = false;
  let ntResceneFanLoaded = false;
  let ntClipLoaded = false;
  let ntDCLoaded = false;

  ntTabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");

      ntTabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      ntTabContents.forEach(content => {
        content.classList.toggle("active", content.id === targetId);
      });

      // 지연 렌더링
      const isDark = document.body.classList.contains("dark-mode") ? "dark" : "light";

      if (targetId === "ntTabInsta" && !ntInstaLoaded) {
        renderNtInstaEmbeds(isDark); ntInstaLoaded = true;
      } else if (targetId === "ntTabX" && !ntXLoaded) {
        renderNtXEmbeds(isDark); ntXLoaded = true;
      } else if (targetId === "ntTabTiktok" && !ntTiktokLoaded) {
        const tiktokContainer = document.getElementById("ntTiktokFeedList");
        if (tiktokContainer) {
          const wrapper = document.createElement("div");
          wrapper.className = "feed-iframe-wrapper";
          wrapper.innerHTML = `<iframe src="https://www.tiktok.com/embed/@rescene_official?theme=${isDark}" style="width: 100%; height: 400px; max-width: 780px; transition: height 0.3s ease;" frameborder="0"></iframe>`;
          tiktokContainer.appendChild(wrapper);

          // tiktokContainer.innerHTML = `<iframe src="https://www.tiktok.com/embed/@rescene_official?theme=${isDark}" style="width: 100%; height: 400px; max-width: 780px; transition: height 0.3s ease;" frameborder="0"></iframe>`;
          ntTiktokLoaded = true;
        }
        // document.getElementById("ntTiktokFeedList").innerHTML = `<iframe src="https://www.tiktok.com/embed/@rescene_official?theme=${isDark}" style="width: 100%; height: 400px; max-width: 780px; transition: height 0.3s ease;" frameborder="0"></iframe>`;
        ntTiktokLoaded = true;
      } else if (targetId === "ntTabSceneFlix" && !ntSceneFlixLoaded) {
        document.getElementById("ntSceneFlixFeedList").innerHTML = `<iframe src="https://adam-yam.github.io/SCENE-FLIX/?theme=${isDark}" style="width: 100%; height: 100%;" frameborder="0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`;
        ntSceneFlixLoaded = true;
      } else if (targetId === "ntTabResceneLove" && !ntResceneLoveLoaded) {
        document.getElementById("ntResceneLoveFeedList").innerHTML = `<iframe src="https://rescene.love/" style="width: 100%; height: 100%;" frameborder="0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`;
        ntResceneLoveLoaded = true;
      } else if (targetId === "ntTabMuzipChart" && !ntMuzipChartLoaded) {
        document.getElementById("ntMuzipChartFeedList").innerHTML = `<iframe src="https://rescene.muzip.link/chart/" style="width: 100%; height: 100%;" frameborder="0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`;
        ntMuzipChartLoaded = true;
      } else if (targetId === "ntTabToDo" && !ntToDoLoaded) {
        document.getElementById("ntToDoFeedList").innerHTML = `<iframe src="https://rescenefan.com/" style="width: 100%; height: 100%;" frameborder="0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`;
        ntToDoLoaded = true;
      } else if (targetId === "ntTabResceneFan" && !ntResceneFanLoaded) {
        document.getElementById("ntResceneFanFeedList").innerHTML = `<iframe src="https://rescene.fan/" style="width: 100%; height: 100%;" frameborder="0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`;
        ntResceneFanLoaded = true;
      } else if (targetId === "ntTabClip" && !ntClipLoaded) {
        document.getElementById("ntClipFeedList").innerHTML = `<iframe src="https://clip.naver.com/@themuzeent?tab=all&filter=all&theme=${isDark}" style="width: 100%; height: 100%;" frameborder="0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`;
        ntClipLoaded = true;
      } else if (targetId === "ntTabDC" && !ntDCLoaded) {
        document.getElementById("ntDCFeedList").innerHTML = `<iframe src="https://m.dcinside.com/board/rescene1" style="width: 100%; height: 100%;" frameborder="0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-same-site-none-cookies"></iframe>`;
        ntDCLoaded = true;
      }
    });
  });

  function renderNtInstaEmbeds(isDark) {
    const container = document.getElementById("ntInstaFeedList");
    if (!container) return;
    chrome.storage.local.get(["instaFeeds"], (res) => {
      const feeds = res.instaFeeds || [];
      if (feeds.length === 0) { container.innerHTML = `<p style="text-align:center; color:#888;">피드가 없습니다.</p>`; return; }
      container.innerHTML = "";
      feeds.slice(0,4).forEach(feed => {
        // support /p/ (post) and /reel/ or /reels/ (reel) links
        const m = feed.link.match(/\/(p|reel|reels)\/([^\/?#]+)/i);
        if (!m) return;
        const type = (m[1] || 'p').toLowerCase();
        const id = m[2];

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
    iframe.style.height = '460px';
    iframe.style.transition = 'height 0.3s ease';
    iframe.frameBorder = '0';
    iframe.scrolling = 'no';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.loading = 'lazy';

    wrapper.appendChild(iframe);
    return wrapper;
  }

  function renderNtXEmbeds(isDark) {
    const container = document.getElementById("ntXFeedList");
    if (!container) return;
    chrome.storage.local.get(["xFeeds"], (res) => {
      const feeds = res.xFeeds || [];
      if (feeds.length === 0) { container.innerHTML = `<p style="text-align:center; color:#888;">피드가 없습니다.</p>`; return; }
      container.innerHTML = "";
      feeds.slice(0,4).forEach(feed => {
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

// --- 인스타 & X 공식 위젯 자동 높이 조절 (postMessage 감지) ---
window.addEventListener("message", (event) => {
  try {
    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    if (data && data.type === 'MEASURE' && data.details && data.details.height) {
      document.querySelectorAll('.feed-iframe-wrapper iframe').forEach(iframe => {
        if (iframe.contentWindow === event.source) iframe.style.height = `${data.details.height}px`;
      });
    }
  } catch (e) {}

  try {
    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    if (data && data["twttr.embed"] && data["twttr.embed"].method === "twttr.private.resize") {
      const params = data["twttr.embed"].params;
      const height = Array.isArray(params) && params.length > 0 ? params[0].height : params.height;
      if (height) {
        document.querySelectorAll('.feed-iframe-wrapper iframe').forEach(iframe => {
          if (iframe.contentWindow === event.source) iframe.style.height = `${height}px`;
        });
      }
    }
  } catch (e) {}

  try {
    // TikTok embed height adjustment
    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    if (data && data.height) {
      document.querySelectorAll('.feed-iframe-wrapper iframe').forEach(iframe => {
        if (iframe.contentWindow === event.source) iframe.style.height = `${data.height}px`;
      });
    }
  } catch (e) {}
});
});
