// =========================================================================
// 환경 감지 & 콘솔 로깅 제어 (로컬 개발/테스트 모드에서만 console.log 활성화)
// =========================================================================
(function initConsoleGuard() {
  const isDev = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest && !('update_url' in chrome.runtime.getManifest());
  if (!isDev) {
    const noop = () => {};
    console.log = noop;
    console.info = noop;
    console.debug = noop;
    console.warn = noop;
  }
})();

const OFFICIAL_CHANNEL_ID = "UCtKtCiaWRz-d3EZn2xd1mdA";
const OFFICIAL_PLAYLIST_ID = "PL7zZDePsdYwPNu51o8b9MKQ_eGk520SFt";
const WONI_CHANNEL_ID = "UCWpY0eSJtyO-qNAPbKFRSSg";

// Firefox/older browsers에서 DNR 대신 webRequest로 CSP를 조정하는 처리
const FIREFOX_FRAME_ANCESTORS = "frame-ancestors https: http: moz-extension:";
const CSP_URL_PATTERNS = [
  "*://*.mnetplus.world/*",
  "*://adam-yam.github.io/*",
  "*://clip.naver.com/*"
];

const USER_AGENT_RULES = [];

function updateResponseCspHeaders(details) {
  const responseHeaders = details.responseHeaders || [];
  let found = false;

  const modifiedHeaders = responseHeaders.map((header) => {
    if (header.name && header.name.toLowerCase() === "content-security-policy") {
      found = true;
      return { ...header, value: FIREFOX_FRAME_ANCESTORS };
    }
    return header;
  });

  if (!found) {
    modifiedHeaders.push({ name: "content-security-policy", value: FIREFOX_FRAME_ANCESTORS });
  }

  return { responseHeaders: modifiedHeaders };
}

function updateRequestUserAgent(details) {
  const headers = details.requestHeaders || [];
  const rule = USER_AGENT_RULES.find(r => {
    const pattern = r.urlPattern.replace(/\*/g, '.*');
    const regex = new RegExp(pattern);
    return regex.test(details.url);
  });

  if (rule) {
    for (let i = 0; i < headers.length; i++) {
      if (headers[i].name.toLowerCase() === 'user-agent') {
        headers[i].value = rule.userAgent;
        break;
      }
    }
  }

  return { requestHeaders: headers };
}

try {
  if (chrome.webRequest && chrome.webRequest.onHeadersReceived) {
    chrome.webRequest.onHeadersReceived.addListener(
      updateResponseCspHeaders,
      { urls: CSP_URL_PATTERNS, types: ["sub_frame"] },
      ["blocking", "responseHeaders"]
    );
  }

  if (chrome.webRequest && chrome.webRequest.onBeforeSendHeaders) {
    const uaPatterns = USER_AGENT_RULES.map(r => r.urlPattern);
    chrome.webRequest.onBeforeSendHeaders.addListener(
      updateRequestUserAgent,
      { urls: uaPatterns, types: ["sub_frame"] },
      ["blocking", "requestHeaders"]
    );
  }
} catch (e) {
  console.warn('webRequest listener registration failed:', e && e.message);
}

// 브라우저 툴바 액션 클릭 및 사이드바/사이드패널 동작 설정
chrome.runtime.onInstalled.addListener(() => {
  if (typeof chrome !== 'undefined' && chrome.sidePanel && typeof chrome.sidePanel['setPanelBehavior'] === 'function') {
    chrome.sidePanel['setPanelBehavior']({ openPanelOnActionClick: true })
      .catch((error) => console.error(error));
  }
});

// Firefox 등에서 툴바 아이콘 클릭 시 사이드바 열기 지원
const actionApi = (typeof chrome !== 'undefined' && (chrome.action || chrome.browserAction)) || (typeof browser !== 'undefined' && (browser.action || browser.browserAction));
const sidebarApi = (typeof browser !== 'undefined' && browser.sidebarAction) || (typeof chrome !== 'undefined' && chrome.sidebarAction);

if (actionApi && actionApi.onClicked && sidebarApi && sidebarApi.open) {
  actionApi.onClicked.addListener(() => {
    try {
      sidebarApi.open();
    } catch (e) {
      console.warn('Failed to open sidebar:', e);
    }
  });
}

function setupRefreshAlarms(intervalMinutes = 15) {
  const period = Math.max(Number(intervalMinutes) || 15, 1);
  chrome.alarms.clear("refreshData", () => {
    chrome.alarms.create("refreshData", { periodInMinutes: period });
  });
  chrome.alarms.clear("fetchSocialFeeds", () => {
    chrome.alarms.create("fetchSocialFeeds", { periodInMinutes: Math.max(period, 30) });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  executeAllBackgroundRefreshes();
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['userSettings'], (res) => {
      const settings = res && res.userSettings ? res.userSettings : {};
      setupRefreshAlarms(settings.refreshInterval || 15);
    });
  } else {
    setupRefreshAlarms(15);
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "refreshData" || alarm.name === "fetchSocialFeeds") {
    executeAllBackgroundRefreshes();
  }
});

// =========================================================================
// 공통 유틸리티 (스케줄 제목 정돈 및 날짜 파싱)
// =========================================================================
function parseSafeDate(startTimeStr) {
  if (!startTimeStr) return new Date();
  if (startTimeStr.length === 10 && !startTimeStr.includes('T')) {
    const [y, m, d] = startTimeStr.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0);
  }
  const d = new Date(startTimeStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

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

// =========================================================================
// 알림 전송 및 알림 클릭 이벤트 라우팅
// =========================================================================
function sendNotification(title, message, category = 'all', iconUrl = null, notificationId = null, callback = null) {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['userSettings'], (res) => {
      const noti = res && res.userSettings && res.userSettings.notifications;
      if (noti) {
        if (noti.enabled === false) { if (callback) callback(false, "알림 마스터 OFF"); return; }
        if (category === 'youtube' && noti.youtube === false) { if (callback) callback(false, "유튜브 알림 OFF"); return; }
        if (category === 'live' && noti.live === false) { if (callback) callback(false, "라이브 알림 OFF"); return; }
        if (category === 'schedule' && noti.schedule === false) { if (callback) callback(false, "스케줄 알림 OFF"); return; }
      }
      if (chrome.notifications && chrome.notifications.create) {
        const defaultLogo = 'icons/rescene-logo.png';
        const hasValidCustomImage = typeof iconUrl === 'string' && iconUrl.trim().length > 0 && iconUrl !== defaultLogo;
        const isDev = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest && !('update_url' in chrome.runtime.getManifest());
        const displayTitle = isDev ? `[DEV] ${title}` : title;

        const notiOptions = {
          type: hasValidCustomImage ? "image" : "basic",
          iconUrl: defaultLogo,
          title: displayTitle,
          message: message,
          priority: 2
        };

        if (hasValidCustomImage) {
          notiOptions.imageUrl = iconUrl;
        }

        const finalNotiId = notificationId || (category === 'schedule' ? `sched_${Date.now()}` : (category === 'youtube' ? `yt_${Date.now()}` : `noti_${Date.now()}`));

        chrome.notifications.create(finalNotiId, notiOptions, (id) => {
          if (chrome.runtime.lastError) {
            chrome.notifications.create(finalNotiId, {
              type: "basic",
              iconUrl: defaultLogo,
              title: displayTitle,
              message: message,
              priority: 2
            }, (fallbackId) => {
              void chrome.runtime.lastError;
              if (callback) callback(true, fallbackId || finalNotiId);
            });
          } else {
            if (callback) callback(true, id || finalNotiId);
          }
        });
      } else {
        if (callback) callback(false, "chrome.notifications not available");
      }
    });
  } else {
    if (callback) callback(false, "chrome.storage not available");
  }
}

chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.notifications.clear(notificationId);
  if (!notificationId) return;

  const isYoutube = notificationId.startsWith('yt_') ||
    notificationId.startsWith('live_') ||
    (!notificationId.startsWith('sched_') && !notificationId.includes('schedule') && /^[a-zA-Z0-9_-]{11}$/.test(notificationId));

  if (isYoutube) {
    let targetVideoId = notificationId;
    if (targetVideoId.startsWith('yt_')) targetVideoId = targetVideoId.replace('yt_', '');
    else if (targetVideoId.startsWith('live_')) targetVideoId = targetVideoId.replace('live_', '');

    chrome.storage.local.get(['viewedVideoIds'], (res) => {
      const viewed = res.viewedVideoIds || {};
      viewed[targetVideoId] = Date.now();
      chrome.storage.local.set({ viewedVideoIds: viewed });
    });

    if (targetVideoId.startsWith('http')) {
      chrome.tabs.create({ url: targetVideoId });
      return;
    }

    chrome.tabs.query({ url: '*://*.youtube.com/watch?v=' + targetVideoId + '*' }, function (tabs) {
      if (tabs && tabs.length > 0) {
        chrome.tabs.update(tabs[0].id, { active: true });
      } else {
        chrome.tabs.create({
          url: 'https://www.youtube.com/watch?v=' + targetVideoId
        });
      }
    });
    return;
  }

  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs && tabs[0];
      if (currentTab && chrome.sidePanel && chrome.sidePanel.open) {
        chrome.sidePanel.open({ windowId: currentTab.windowId }).catch(() => {
          chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
        });
      } else {
        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
      }
    });
  }
});

// 브라우저 탭에서 사용자가 직접 유튜브 영상을 열었을 때 실시간 감지
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const targetUrl = changeInfo.url || tab.url;
  if (!targetUrl) return;

  let videoId = null;
  if (targetUrl.includes('youtube.com/watch')) {
    const match = targetUrl.match(/[?&]v=([^&#]+)/);
    if (match) videoId = match[1];
  } else if (targetUrl.includes('youtube.com/shorts/')) {
    const match = targetUrl.match(/youtube\.com\/shorts\/([^?&#/]+)/);
    if (match) videoId = match[1];
  } else if (targetUrl.includes('youtu.be/')) {
    const match = targetUrl.match(/youtu\.be\/([^?&#/]+)/);
    if (match) videoId = match[1];
  }

  if (videoId) {
    chrome.storage.local.get(['viewedVideoIds'], (res) => {
      const viewed = res.viewedVideoIds || {};
      if (!viewed[videoId]) {
        viewed[videoId] = Date.now();
        chrome.storage.local.set({ viewedVideoIds: viewed });
      }
    });
  }
});

// =========================================================================
// 스케줄 알림 검사 (당일 종합 요약 & 임박 알림)
// =========================================================================
function checkDailyScheduleNotification(schedules) {
  if (!Array.isArray(schedules) || schedules.length === 0) return;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  chrome.storage.local.get(['lastScheduleNotiDate', 'userSettings'], (res) => {
    const lastNotiDate = res && res.lastScheduleNotiDate;
    if (lastNotiDate === todayStr) return;

    const notiSettings = (res && res.userSettings && res.userSettings.notifications) || {};
    if (notiSettings.enabled === false || notiSettings.schedule === false) return;

    const targetTimeStr = notiSettings.dailyScheduleTime || "09:00";
    const [targetHour, targetMinute] = targetTimeStr.split(':').map(val => parseInt(val, 10) || 0);
    const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetHour, targetMinute, 0);

    if (now.getTime() < targetDate.getTime()) {
      return;
    }

    const todaySchedules = schedules.filter(item => {
      const d = parseSafeDate(item.startTime);
      const itemDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return itemDateStr === todayStr;
    });

    if (todaySchedules.length === 0) return;

    todaySchedules.sort((a, b) => {
      const tA = a.startTime ? parseSafeDate(a.startTime).getTime() : 0;
      const tB = b.startTime ? parseSafeDate(b.startTime).getTime() : 0;
      return tA - tB;
    });

    const nowMs = now.getTime();
    const remainingSchedules = [];
    const pastSchedules = [];

    todaySchedules.forEach(item => {
      if (item.isAllday || !item.startTime || !item.startTime.includes('T')) {
        remainingSchedules.push(item);
      } else {
        const itemTimeMs = parseSafeDate(item.startTime).getTime();
        if (itemTimeMs >= nowMs) {
          remainingSchedules.push(item);
        } else {
          pastSchedules.push(item);
        }
      }
    });

    const totalCount = todaySchedules.length;
    let notiTitle = `📅 [RESCENE] 오늘 ${totalCount}개의 일정이 있습니다!`;
    let notiMessage = '';

    if (remainingSchedules.length > 0) {
      const firstRem = remainingSchedules[0];
      const timeStr = firstRem.isAllday || !firstRem.startTime.includes('T') ? '종일' : parseSafeDate(firstRem.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      notiMessage = `다가오는 일정: [${timeStr}] ${cleanDisplayTitle(firstRem.title, 25)}`;
      if (remainingSchedules.length > 1) {
        notiMessage += ` 외 ${remainingSchedules.length - 1}건`;
      }
    } else {
      notiTitle = `📅 [RESCENE] 오늘 예정된 모든 일정이 완료되었습니다.`;
      const lastPast = pastSchedules[pastSchedules.length - 1];
      notiMessage = `최근 완료: ${cleanDisplayTitle(lastPast.title, 30)} (총 ${totalCount}건 완료)`;
    }

    sendNotification(notiTitle, notiMessage, 'schedule', null, `sched_daily_${todayStr}`, (success) => {
      if (success) {
        chrome.storage.local.set({ lastScheduleNotiDate: todayStr });
      }
    });
  });
}

function checkUpcomingScheduleAlerts(schedules = []) {
  if (!Array.isArray(schedules) || schedules.length === 0) return;

  const now = Date.now();
  const thirtyMinutesMs = 30 * 60 * 1000;

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['notifiedScheduleIds'], (res) => {
      const notifiedMap = res && res.notifiedScheduleIds ? res.notifiedScheduleIds : {};
      let hasNewNotification = false;

      schedules.forEach(item => {
        if (!item.startTime || item.isAllday) return;
        const startTimeMs = parseSafeDate(item.startTime).getTime();
        const diffMs = startTimeMs - now;

        if (diffMs > 0 && diffMs <= thirtyMinutesMs) {
          const id = item.id || `${item.title}_${item.startTime}`;
          if (!notifiedMap[id]) {
            notifiedMap[id] = now;
            hasNewNotification = true;

            const minutesLeft = Math.max(1, Math.round(diffMs / 60000));
            const cleanTitle = cleanDisplayTitle(item.title);
            sendNotification(
              `⏰ [스케줄 임박] ${minutesLeft}분 후 시작 예정!`,
              `${cleanTitle}\n📅 시작 시간: ${parseSafeDate(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
              'schedule',
              null,
              `sched_upcoming_${id}`
            );
          }
        }
      });

      if (hasNewNotification) {
        const oneDayMs = 24 * 60 * 60 * 1000;
        Object.keys(notifiedMap).forEach(key => {
          if (now - notifiedMap[key] > oneDayMs) {
            delete notifiedMap[key];
          }
        });
        chrome.storage.local.set({ notifiedScheduleIds: notifiedMap });
      }
    });
  }
}

// =========================================================================
// 신규 영상 & 라이브 알림 검사 (Central Hub 데이터 기반)
// =========================================================================
function checkNewVideosAndNotify(videos = []) {
  if (!Array.isArray(videos) || videos.length === 0) return;

  chrome.storage.local.get(["notifiedVideoIds", "viewedVideoIds"], (result) => {
    let notifiedMap = result.notifiedVideoIds || {};
    const viewedMap = result.viewedVideoIds || {};
    let hasNewNotification = false;

    // 첫 실행 시 폭탄 알림 방지: notifiedVideoIds가 없으면 최신 영상들을 이미 알림된 것으로 마킹
    if (!result.notifiedVideoIds) {
      videos.slice(0, 10).forEach(v => {
        notifiedMap[v.id] = Date.now();
      });
      chrome.storage.local.set({ notifiedVideoIds: notifiedMap });
      return;
    }

    // 신규 공식 VOD 알림 (상위 3개 대상)
    videos.slice(0, 3).forEach((video) => {
      if (!video.isLive && !notifiedMap[video.id] && !viewedMap[video.id]) {
        notifiedMap[video.id] = Date.now();
        hasNewNotification = true;
        sendNotification(
          "🔔 [RESCENE] 새로운 공식 유튜브 영상 업로드!",
          video.title,
          'youtube',
          video.thumbnail || null,
          video.id
        );
      }
    });

    if (hasNewNotification) {
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      Object.keys(notifiedMap).forEach(key => {
        if (now - notifiedMap[key] > thirtyDaysMs) {
          delete notifiedMap[key];
        }
      });
      chrome.storage.local.set({ notifiedVideoIds: notifiedMap });
    }
  });
}

function checkLiveAndNotify(liveInfo) {
  if (!liveInfo || !liveInfo.id) return;

  chrome.storage.local.get(['liveNotificationHistory', 'userSettings'], (res) => {
    const settings = res.userSettings || {};
    if (settings.notifyLive !== false) {
      const notiHistory = res.liveNotificationHistory || {};
      const key = `live_${liveInfo.id}`;
      const now = Date.now();
      if (!notiHistory[key] || (now - notiHistory[key] > 12 * 60 * 60 * 1000)) {
        sendNotification(
          "🔴 RESCENE 유튜브 라이브 시작!",
          liveInfo.title || "지금 RESCENE 공식 유튜브 라이브가 진행 중입니다!",
          "live",
          liveInfo.thumbnail || "icons/rescene-logo.png",
          key
        );
        notiHistory[key] = now;
        chrome.storage.local.set({ liveNotificationHistory: notiHistory });
      }
    }
  });
}

// =========================================================================
// 중앙 데이터 허브 (Central Data Hub) 연동 엔진
// =========================================================================
const CENTRAL_CORE_URLS = [
  "https://gist.githubusercontent.com/duckbeginner/44b49b328233ef6157499debe03f165c/raw/core.json",
  "https://duckbeginner.github.io/remine-helper/api/v1/core.json",
  "https://gist.githubusercontent.com/duckbeginner/44b49b328233ef6157499debe03f165c/raw/data.json"
];

const CENTRAL_SCHEDULES_URLS = [
  "https://gist.githubusercontent.com/duckbeginner/44b49b328233ef6157499debe03f165c/raw/schedules.json",
  "https://duckbeginner.github.io/remine-helper/api/v1/schedules.json"
];

// 1계층: 초경량 core.json 다운로드 (단 20~25 KB, 5분 고속 동기화, ETag 304 조건부 캐싱 지원)
async function fetchFromCentralDataHub(force = false) {
  let savedEtag = null;
  if (!force) {
    const local = await chrome.storage.local.get(['centralCoreEtag']);
    savedEtag = local && local.centralCoreEtag;
  }

  for (const baseUrl of CENTRAL_CORE_URLS) {
    try {
      const url = `${baseUrl}?_t=${Date.now()}`;
      const headers = {};
      if (savedEtag) {
        headers['If-None-Match'] = savedEtag;
      }
      const res = await fetch(url, { headers, cache: 'no-cache' });

      // 304 Not Modified: 원격 데이터에 변경 없음 (전송량 0바이트)
      if (res.status === 304) {
        return { notModified: true };
      }

      if (!res.ok) continue;

      const newEtag = res.headers.get('etag');
      const data = await res.json();
      if (data && data.youtube) {
        if (newEtag) {
          data._newEtag = newEtag;
        }
        return data;
      }
    } catch (e) {
      // 다음 엔드포인트 시도
    }
  }
  return null;
}

// 2계층: 마스터 스케줄 아카이브 다운로드 (신규 일정 변경 시 단 1회 백그라운드 동기화, ETag 지원)
async function fetchMasterSchedules(force = false) {
  let savedEtag = null;
  if (!force) {
    const local = await chrome.storage.local.get(['centralSchedulesEtag']);
    savedEtag = local && local.centralSchedulesEtag;
  }

  for (const baseUrl of CENTRAL_SCHEDULES_URLS) {
    try {
      const url = `${baseUrl}?_t=${Date.now()}`;
      const headers = {};
      if (savedEtag) {
        headers['If-None-Match'] = savedEtag;
      }
      const res = await fetch(url, { headers, cache: 'no-cache' });

      if (res.status === 304) {
        return { notModified: true };
      }

      if (!res.ok) continue;

      const newEtag = res.headers.get('etag');
      const data = await res.json();
      if (data && Array.isArray(data.items) && data.items.length > 0) {
        if (newEtag) {
          data._newEtag = newEtag;
        }
        return data;
      }
    } catch (e) { }
  }
  return null;
}

async function applyCentralDataToStorage(data) {
  if (!data || data.notModified) return false;

  const isLive = Boolean(data.youtube?.isLive);
  const liveInfo = data.youtube?.liveInfo || null;

  let latestVideos = [...(data.youtube?.officialVideos || [])];
  if (isLive && liveInfo) {
    const existingIdx = latestVideos.findIndex(v => v.id === liveInfo.id);
    if (existingIdx >= 0) {
      latestVideos[existingIdx] = { ...latestVideos[existingIdx], ...liveInfo };
    } else {
      latestVideos.unshift(liveInfo);
    }
  }

  const activeSchedules = data.schedules?.activeItems || data.schedules?.items || [];
  const masterUpdatedAt = data.schedules?.masterUpdatedAt || data.updatedAt || null;

  const storagePayload = {
    latestVideos: latestVideos,
    officialPlaylistVideos: data.youtube?.playlistVideos || [],
    woniVideos: data.youtube?.woniVideos || [],
    isLive: isLive,
    isLiveStreaming: isLive,
    liveVideoInfo: liveInfo,
    activeSchedules: activeSchedules,
    xFeeds: data.sns?.x || [],
    instaFeeds: data.sns?.instagram || [],
    tiktokFeeds: data.sns?.tiktok || [],
    lastCentralSyncTime: Date.now(),
    lastCentralSyncUpdatedAt: data.updatedAt || null
  };

  if (data._newEtag) {
    storagePayload.centralCoreEtag = data._newEtag;
  }

  const local = await chrome.storage.local.get(['blipSchedules', 'schedulesMasterUpdatedAt']);
  let needMasterSync = false;

  if (!local.blipSchedules || local.blipSchedules.length === 0) {
    needMasterSync = true;
  } else if (masterUpdatedAt && local.schedulesMasterUpdatedAt !== masterUpdatedAt) {
    needMasterSync = true;
  }

  if (needMasterSync) {
    fetchMasterSchedules().then(result => {
      if (result && !result.notModified && Array.isArray(result.items) && result.items.length > 0) {
        const updatePayload = {
          blipSchedules: result.items,
          schedulesMasterUpdatedAt: masterUpdatedAt
        };
        if (result._newEtag) {
          updatePayload.centralSchedulesEtag = result._newEtag;
        }
        chrome.storage.local.set(updatePayload);
        checkUpcomingScheduleAlerts(result.items);
        checkDailyScheduleNotification(result.items);
      }
    });
  } else {
    const currentList = local.blipSchedules || activeSchedules;
    checkUpcomingScheduleAlerts(currentList);
    checkDailyScheduleNotification(currentList);
  }

  if (!local.blipSchedules || local.blipSchedules.length === 0) {
    storagePayload.blipSchedules = activeSchedules;
  }

  await chrome.storage.local.set(storagePayload);

  // 신규 VOD 업로드 알림 검사
  if (latestVideos.length > 0) {
    checkNewVideosAndNotify(latestVideos);
  }

  // 실시간 라이브 시작 알림 검사
  if (isLive && liveInfo) {
    checkLiveAndNotify(liveInfo);
  }

  return true;
}

let lastBackgroundRefreshTime = 0;
let backgroundRefreshPromise = null;

async function executeAllBackgroundRefreshes(force = false) {
  if (backgroundRefreshPromise) {
    return backgroundRefreshPromise;
  }
  backgroundRefreshPromise = (async () => {
    try {
      const centralData = await fetchFromCentralDataHub(force);
      if (centralData && centralData.notModified) {
        lastBackgroundRefreshTime = Date.now();
        console.log("⚡ [Central Hub] 304 Not Modified - 원격 변경 없음 (전송량 0B 유지)");

        // 데이터 변경이 없어도 시간이 경과함에 따른 스케줄 알림은 로컬 데이터로 점검
        const local = await chrome.storage.local.get(['blipSchedules', 'activeSchedules']);
        const currentList = local.blipSchedules || local.activeSchedules || [];
        if (currentList.length > 0) {
          checkUpcomingScheduleAlerts(currentList);
          checkDailyScheduleNotification(currentList);
        }
        return;
      }

      if (centralData) {
        const applied = await applyCentralDataToStorage(centralData);
        if (applied) {
          lastBackgroundRefreshTime = Date.now();
          console.log("⚡ [Central Hub] 중앙 데이터 허브에서 최신 데이터 즉시 동기화 완료!", {
            updatedAt: centralData.updatedAt,
            schedules: centralData.schedules?.totalCount
          });
          return;
        }
      }
      console.warn("⚠️ [Central Hub] 중앙 데이터 허브 동기화 실패 또는 데이터 없음");
    } finally {
      backgroundRefreshPromise = null;
    }
  })();
  return backgroundRefreshPromise;
}

// =========================================================================
// 런타임 메시지 핸들러
// =========================================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "REFRESH_ALL_DATA" || request.action === "FORCE_REFRESH") {
    const force = request.action === "FORCE_REFRESH" || request.force === true;
    const now = Date.now();

    if (!force && !backgroundRefreshPromise && (now - lastBackgroundRefreshTime < 30000)) {
      sendResponse({ success: true, skipped: true });
      return true;
    }

    executeAllBackgroundRefreshes(force).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      sendResponse({ success: false, error: String(err) });
    });
    return true;
  }

  if (request.action === "SEND_NOTIFICATION" || request.action === "sendNotification") {
    sendNotification(
      request.title,
      request.message,
      request.category || 'all',
      request.iconUrl || null,
      request.notificationId || null,
      (success, notiIdOrReason) => {
        sendResponse({ success: success, id: notiIdOrReason });
      }
    );
    return true;
  }

  if (request.action === "TRIGGER_DAILY_SCHEDULE_CHECK") {
    chrome.storage.local.get(['blipSchedules', 'activeSchedules'], (res) => {
      const schedules = (res && (res.blipSchedules || res.activeSchedules)) || [];
      if (schedules.length > 0) {
        checkDailyScheduleNotification(schedules);
        sendResponse({ success: true, count: schedules.length });
      } else {
        sendResponse({ success: false, reason: "No schedules found" });
      }
    });
    return true;
  }

  if (request.action === "UPDATE_REFRESH_INTERVAL") {
    const minutes = parseInt(request.intervalMinutes, 10) || 15;
    setupRefreshAlarms(minutes);
    executeAllBackgroundRefreshes();
    sendResponse({ success: true, intervalMinutes: minutes });
    return true;
  }

  if (request.action === "getActualCookies") {
    const targetUrl = request.url || "https://artist.mnetplus.world";
    const targetHostname = new URL(targetUrl).hostname;

    chrome.cookies.getAll({ domain: targetHostname }, (cookies) => {
      sendResponse({ cookies: cookies });
    });
    return true;
  }

  if (request.action === "setCookie") {
    const cookie = request.cookie;
    chrome.cookies.set({
      url: cookie.url || `https://${cookie.domain ? cookie.domain.replace(/^\./, "") : "artist.mnetplus.world"}${cookie.path || "/"}`,
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path || "/",
      secure: cookie.secure,
      sameSite: cookie.sameSite || "no_restriction",
      httpOnly: cookie.httpOnly,
      expirationDate: cookie.expirationDate,
      storeId: cookie.storeId
    }).then((result) => {
      sendResponse({ ok: true, cookie: result });
    }).catch((error) => {
      sendResponse({ ok: false, error: error.message });
    });
    return true;
  }

  if (request.action === "syncCookies") {
    const targetUrl = request.targetUrl || "https://artist.mnetplus.world";
    const targetHostname = new URL(targetUrl).hostname;

    Promise.all((request.cookies || []).map((cookie) => {
      const cookieUrl = `https://${targetHostname}${cookie.path || "/"}`;
      return chrome.cookies.set({
        url: cookieUrl,
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain || targetHostname,
        path: cookie.path || "/",
        secure: cookie.secure,
        sameSite: cookie.sameSite || "no_restriction",
        httpOnly: cookie.httpOnly,
        expirationDate: cookie.expirationDate,
        storeId: cookie.storeId
      }).catch((error) => {
        console.warn("쿠키 설정 실패:", cookie.name, error.message);
        return null;
      });
    })).then(() => {
      sendResponse({ ok: true });
    }).catch((error) => {
      sendResponse({ ok: false, error: error.message });
    });
    return true;
  }

  if (request.action === "persistResponseCookies") {
    const cookies = Array.isArray(request.cookies) ? request.cookies : [];
    Promise.all(cookies.map((cookie) => {
      const cookieUrl = cookie.url || `https://${cookie.domain ? cookie.domain.replace(/^\./, "") : "artist.mnetplus.world"}${cookie.path || "/"}`;
      return chrome.cookies.set({
        url: cookieUrl,
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path || "/",
        secure: cookie.secure,
        sameSite: cookie.sameSite || "no_restriction",
        httpOnly: cookie.httpOnly,
        expirationDate: cookie.expirationDate,
        storeId: cookie.storeId
      }).catch((error) => {
        console.warn("응답 쿠키 저장 실패:", cookie.name, error.message);
        return null;
      });
    })).then(() => {
      sendResponse({ ok: true });
    }).catch((error) => {
      sendResponse({ ok: false, error: error.message });
    });
    return true;
  }
});

export { sendNotification, checkUpcomingScheduleAlerts, checkDailyScheduleNotification, executeAllBackgroundRefreshes };