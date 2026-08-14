const OFFICIAL_CHANNEL_ID = "UCtKtCiaWRz-d3EZn2xd1mdA";
const OFFICIAL_PLAYLIST_ID = "PL7zZDePsdYwPNu51o8b9MKQ_eGk520SFt";
const WONI_CHANNEL_ID     = "UCWpY0eSJtyO-qNAPbKFRSSg";

// Firefox/older browsers에서 DNR 대신 webRequest로 CSP를 조정하는 처리
const FIREFOX_FRAME_ANCESTORS = "frame-ancestors https: http: moz-extension:";
const CSP_URL_PATTERNS = [
  "*://*.notion.site/*",
  "*://*.mnetplus.world/*",
  "*://rescene.love/*",
  "*://rescene.muzip.link/*",
  "*://rescenefan.com/*",
  "*://rescene.fan/*",
  "*://adam-yam.github.io/*"
];


// 지정 사이트를 대상으로 userAgent를 변경하는 처리
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
/**
 * User-Agent 헤더 수정 함수 (Request)
 */
function updateRequestUserAgent(details) {
  const headers = details.requestHeaders || [];

  // 현재 요청 URL에 해당하는 규칙 찾기
  // (단순화를 위해 첫 번째 매칭되는 규칙 적용)
  const rule = USER_AGENT_RULES.find(r => {
    // webRequest 필터에서 이미 걸러지지만, 안전을 위해 패턴 체크 (간단한 wildcard 처리)
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

  // 1. CSP 수정을 위한 리스너 (onHeadersReceived)
  if (chrome.webRequest && chrome.webRequest.onHeadersReceived) {
    chrome.webRequest.onHeadersReceived.addListener(
      updateResponseCspHeaders,
      { urls: CSP_URL_PATTERNS, types: ["sub_frame"] },
      ["blocking", "responseHeaders"]
    );
  }

  // 2. User-Agent 수정을 위한 리스너 (onBeforeSendHeaders)
  if (chrome.webRequest && chrome.webRequest.onBeforeSendHeaders) {
    const uaPatterns = USER_AGENT_RULES.map(r => r.urlPattern);

    chrome.webRequest.onBeforeSendHeaders.addListener(
      updateRequestUserAgent,
      {
        urls: uaPatterns,
        types: ["sub_frame"] // USER_AGENT_RULES의 resourceTypes를 참고
      },
      ["blocking", "requestHeaders"]
    );
  }
} catch (e) {
  console.warn('webRequest listener registration failed:', e && e.message);
}




// background.js 내 적절한 위치에 추가 가능
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error(error));
  } else if (chrome.sidebarAction && chrome.sidebarAction.setPanelBehavior) {
    chrome.sidebarAction.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error(error));
  }
});

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
  fetchAllData();
  fetchFeedsFromMnet();
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
  if (alarm.name === "refreshData") {
    fetchAllData();
  } else if (alarm.name === "fetchSocialFeeds") {
    fetchFeedsFromMnet();
  }
});

async function fetchAllData() {
  await fetchYouTubeVideos(OFFICIAL_CHANNEL_ID, "latestVideos", "공식 유튜브");
  await fetchYouTubePlaylist(OFFICIAL_PLAYLIST_ID, "officialPlaylistVideos", "공식 유튜브 재생목록");
  await fetchYouTubeVideos(WONI_CHANNEL_ID, "woniVideos", "원이 채널");
  await fetchAndMergeSchedules();
}

async function fetchYouTubeVideos(channelId, storageKey, channelName) {
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const response = await fetch(rssUrl);
    const xmlText = await response.text();
    const videos = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    let isLiveOnAir = false;

    while ((match = entryRegex.exec(xmlText)) !== null && videos.length < 10) {
      const entryContent = match[1];
      const videoIdMatch = entryContent.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
      const titleMatch = entryContent.match(/<title>(.*?)<\/title>/);
      const publishedMatch = entryContent.match(/<published>(.*?)<\/published>/);

      if (videoIdMatch && titleMatch) {
        const videoId = videoIdMatch[1];
        const title = titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        const published = publishedMatch ? publishedMatch[1].split('T')[0] : '';

        if (channelId === OFFICIAL_CHANNEL_ID && videos.length === 0 && (title.includes("LIVE") || title.includes("라이브") || entryContent.includes("liveStream"))) {
          isLiveOnAir = true;
        }

        videos.push({
          id: videoId,
          title: title,
          published: published,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
        });
      }
    }

    if (videos.length > 0) {
      let updateData = { [storageKey]: videos };
      if (channelId === OFFICIAL_CHANNEL_ID) {
        updateData.isLive = isLiveOnAir;
      }
      chrome.storage.local.set(updateData);

      if (channelId === OFFICIAL_CHANNEL_ID) {
        chrome.storage.local.get(["lastVideoId"], (result) => {
          if (result.lastVideoId !== videos[0].id) {
            const alertTitle = isLiveOnAir ? "🔴 [RESCENE ON AIR] 실시간 라이브 방송 시작!" : "🔔 [RESCENE] 새로운 공식 유튜브 영상 업로드!";
            sendNotification(alertTitle, videos[0].title, isLiveOnAir ? 'live' : 'youtube');
            chrome.storage.local.set({ lastVideoId: videos[0].id });
          }
        });
      }
    }
  } catch (error) {
    console.error(`${channelName} 갱신 실패:`, error);
  }
}

// 제공해주신 사용자님의 parseSafeDate 코드를 활용한 안전 파싱 함수
async function fetchYouTubePlaylist(playlistId, storageKey, playlistName) {
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
    const response = await fetch(rssUrl);
    const xmlText = await response.text();
    const videos = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xmlText)) !== null && videos.length < 10) {
      const entryContent = match[1];
      const videoIdMatch = entryContent.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
      const titleMatch = entryContent.match(/<title>(.*?)<\/title>/);
      const publishedMatch = entryContent.match(/<published>(.*?)<\/published>/);

      if (videoIdMatch && titleMatch) {
        const videoId = videoIdMatch[1];
        const title = titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        const published = publishedMatch ? publishedMatch[1].split('T')[0] : '';

        videos.push({
          id: videoId,
          title: title,
          published: published,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
        });
      }
    }

    if (videos.length > 0) {
      chrome.storage.local.set({ [storageKey]: videos });
    }
  } catch (error) {
    console.error(`${playlistName} 갱신 실패:`, error);
  }
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

// 2024년부터 향후 1년치 스케줄 다중 월 수집 및 병합 함수
async function fetchAndMergeSchedules() {
  try {
    let rawSchedules = [];

    const startDate = new Date(2024, 0, 1); // 2024년 1월 1일 시작
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1); // 향후 1년 뒤까지

    let loopDate = new Date(startDate);

    // 2024년부터 내년 이맘때까지의 모든 월(Month)을 순회하며 일괄 수집
    while (loopDate <= endDate) {
      const year = loopDate.getFullYear();
      const month = loopDate.getMonth() + 1;
      const paddedMonth = String(month).padStart(2, '0');

      // [A] 엠넷플러스(Mnet Plus) 월별 수집 (공식 마스터 소스)
      try {
        const lastDay = new Date(year, month, 0).getDate();
        const mnetUrl = `https://artist.mnetplus.world/svc/stg/rescene-official/space/api/v1/calendar?endAt=${year}-${paddedMonth}-${lastDay}T23:59:59Z&endAtForAllDay=${year}-${paddedMonth}-${lastDay}&startAt=${year}-${paddedMonth}-01T00:00:00Z&startAtForAllDay=${year}-${paddedMonth}-01`;
        const mnetRes = await fetch(mnetUrl, {
          headers: { 'accept': '*/*', 'x-bmf-country': 'KR', 'x-bmf-currency': 'KRW', 'x-bmf-language': 'ko', 'x-bmf-shop-id': '33' }
        });
        if (mnetRes.ok) {
          const mnetJson = await mnetRes.json();
          if (mnetJson && Array.isArray(mnetJson.events)) {
            rawSchedules.push(...mnetJson.events.map(ev => ({
              title: ev.title ? ev.title.trim() : "",
              startTime: ev.startAt || `${ev.startAtAllDay}T00:00:00Z`,
              endTime: ev.endAt || (ev.endAtForAllDay ? `${ev.endAtForAllDay}T23:59:59Z` : (ev.startAt || `${ev.startAtAllDay}T00:00:00Z`)),
              message: `[${ev.label ? ev.label.name : '일정'}] ${ev.title}`,
              typeText: ev.label ? ev.label.name : null,
              source: 'mnet',
              extField: null
            })));
          }
        }
      } catch (e) {}

      // [B] 블립(Blip) 월별 수집 (상세 보완 및 추가 일정 소스)
      try {
        const blipUrl = `https://blip.kr/old-api/homepage/schedules?year=${year}&month=${month}&types=1&types=2&types=3&types=4&types=5&types=6&types=7&unitId=133`;
        const blipRes = await fetch(blipUrl, {
          headers: {
            'accept': 'application/json',
            'x-blip-agent': 'BLIP WEB',
            'x-blip-device-lang': 'ko',
            'x-blip-s2s-api-key': 'c95b9a274f67c09a47638bf92632cea9'
          }
        });
        if (blipRes.ok) {
          const blipJson = await blipRes.json();
          const blipData = Array.isArray(blipJson) ? blipJson : (blipJson.data || []);
          rawSchedules.push(...blipData.map(item => ({
            title: item.title ? item.title.trim() : "",
            startTime: item.startTime,
            endTime: item.endTime || item.startTime,
            message: item.message || "",
            typeId: item.typeId || null,
            source: 'blip',
            extField: item.extField || null
          })));
        }
      } catch (e) {}

      // 다음 달로 이동
      loopDate.setMonth(loopDate.getMonth() + 1);
    }

    // 직캠, 투표, 포스터/응모/증정/공지 이벤트 정밀 필터링
    const exactExcludePatterns = [
      /직캠/i, /풀캠/i, /팬캠/i, /페이스캠/i, /입덕직캠/i, /최애직캠/i, /팔로우캠/i, /안방1열/i, /음중직캠/i, /음중풀캠/i, /음중팔로우캠/i,
      /fan\W*cam/i, /k\W*fancam/i, /choreo/i, /fancam/i, /\bcam\b/i,
      // 투표 관련 일정 제외
      /투표/i, /사전투표/i, /실시간투표/i, /\bvote\b/i, /\bvoting\b/i, /\bpoll\b/i,
      /덕애드/i, /스타패스/i, /아이돌챔프/i, /뮤빗/i, /팬플러스/i, /포도알/i, /케이돌/i, /엠넷플러스\s*투표/i,
      // 포스터/응모/증정/빅크/특전 이벤트 및 단순 공지 제외
      /포스터\s*이벤트/i, /사인\s*.*이벤트/i, /싸인\s*.*이벤트/i, /이벤트\s*안내/i, /안내\s*\(Notice\)/i,
      /\[빅크/i, /\bBIGC\b/i, /응모\s*이벤트/i, /증정\s*이벤트/i, /특전\s*이벤트/i, /구매자\s*이벤트/i,
      /럭키드로우/i, /\b럭드\b/i
    ];

    const filteredSchedules = rawSchedules.filter(item => {
      const targetText = (item.title || "") + " " + (item.message || "");
      for (let pattern of exactExcludePatterns) {
        if (pattern.test(targetText)) return false;
      }
      return true;
    });

    // 지능형 중복 병합 및 정렬 (Mnet 우선 마스터 & Blip 상세 정보 보완)
    const mergedList = [];

    filteredSchedules.forEach(newItem => {
      const newD = parseSafeDate(newItem.startTime);
      const newDateStr = `${newD.getFullYear()}-${String(newD.getMonth() + 1).padStart(2, '0')}-${String(newD.getDate()).padStart(2, '0')}`;

      let matchedIndex = -1;

      for (let i = 0; i < mergedList.length; i++) {
        const existing = mergedList[i];
        const existD = parseSafeDate(existing.startTime);
        const existDateStr = `${existD.getFullYear()}-${String(existD.getMonth() + 1).padStart(2, '0')}-${String(existD.getDate()).padStart(2, '0')}`;

        // ★ 같은 날짜(YYYY-MM-DD) 내 중복 판별
        if (newDateStr === existDateStr && areSchedulesDuplicate(existing, newItem)) {
          matchedIndex = i;
          break;
        }
      }

      if (matchedIndex !== -1) {
        const target = mergedList[matchedIndex];

        // Mnet 출처 우선순위 적용 (새로 들어온 항목이 Mnet이면 공식 정보 우선 반영)
        if (newItem.source === 'mnet') {
          target.source = 'mnet';
          if (newItem.typeText) target.typeText = newItem.typeText;
          if (newItem.startTime) target.startTime = newItem.startTime;
          if (newItem.endTime) target.endTime = newItem.endTime;
        }

        // 제목은 더 완성도 높고 구체적인 쪽으로 보완 (예: Blip의 <KCON LA 2026> SHOWCASE 등)
        target.title = pickBestTitle(target.title, newItem.title);

        // 상세 설명(message)은 더 상세한 쪽으로 보완
        if (newItem.message && newItem.message.length > (target.message ? target.message.length : 0)) {
          target.message = newItem.message;
        }
        if (!target.typeId && newItem.typeId) {
          target.typeId = newItem.typeId;
        }
        if (!target.typeText && newItem.typeText) {
          target.typeText = newItem.typeText;
        }
        if (!target.endTime && newItem.endTime) {
          target.endTime = newItem.endTime;
        }
        if (!target.extField && newItem.extField) {
          target.extField = newItem.extField;
        }
      } else {
        mergedList.push({ ...newItem });
      }
    });

    // 백그라운드 단에서 시간순(오름차순) 정렬 완료
    mergedList.sort((a, b) => parseSafeDate(a.startTime).getTime() - parseSafeDate(b.startTime).getTime());

    chrome.storage.local.set({ blipSchedules: mergedList });

    // 스케줄 시작 전 임박 알림 (방송/영상/공연 시작 30분 이내 감지)
    checkUpcomingScheduleAlerts(mergedList);

    // 당일 스케줄 푸시 알림 발송 (하루 1회 발송 제한)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    chrome.storage.local.get(['lastScheduleNotiDate'], (res) => {
      const lastNotiDate = res && res.lastScheduleNotiDate;
      if (lastNotiDate !== todayStr) {
        const todaySchedules = mergedList.filter(item => {
          const d = parseSafeDate(item.startTime);
          const itemDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          return itemDateStr === todayStr;
        });

        if (todaySchedules.length > 0) {
          // 시작 시간 순 정렬
          todaySchedules.sort((a, b) => {
            const tA = a.startTime ? parseSafeDate(a.startTime).getTime() : 0;
            const tB = b.startTime ? parseSafeDate(b.startTime).getTime() : 0;
            return tA - tB;
          });

          // 각 일정 상세 목록 줄바꿈 구성 (최대 5건까지 명시 후 초과 시 외 N건)
          const scheduleLines = todaySchedules.slice(0, 5).map(item => {
            const cleanTitle = cleanDisplayTitle(item.title);
            let timePrefix = '';
            if (item.startTime && !item.isAllday && item.startTime.includes('T')) {
              const d = parseSafeDate(item.startTime);
              timePrefix = `[${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}] `;
            }
            return `• ${timePrefix}${cleanTitle}`;
          });

          if (todaySchedules.length > 5) {
            scheduleLines.push(`• ...외 ${todaySchedules.length - 5}건`);
          }

          sendNotification(
            `📅 오늘 예정된 RESCENE 스케줄 (${todaySchedules.length}건)`,
            scheduleLines.join('\n'),
            'schedule'
          );
          chrome.storage.local.set({ lastScheduleNotiDate: todayStr });
        }
      }
    });
  } catch (error) {
    console.error("장기 스케줄 수집 및 병합 오류:", error);
  }
}

// 스케줄 제목 앞단 불필요한 대괄호 태그 정돈
function cleanDisplayTitle(title) {
  if (!title) return "";
  return title
    .replace(/^\[(?:🎬|🎉|🎤|💿|📺|📻|방송|공연|행사|릴리즈|기념일|팬사인회|팬이벤트|일정)\]\s*/gi, '')
    .trim();
}

// 스케줄 카테고리명 판별
function getScheduleCategoryName(item) {
  if (item.typeText) return item.typeText;
  const combined = `${item.title || ""} ${item.message || ""}`.toLowerCase();
  if (/안녕하세요원이입니다|안원잘부|@helloiamwoninicetomeetyou|자컨|비하인드|vlog|브이로그|shorts|쇼츠/i.test(combined)) return "영상";
  if (/쇼챔피언|엠카운트다운|뮤직뱅크|인기가요|더쇼|음악중심|방송|라디오|예능|tv/i.test(combined)) return "방송";
  if (/kcon|케이콘|어워즈|쇼케이스|페스티벌|콘서트|행사|공연/i.test(combined)) return "행사";
  if (/팬사인회|팬싸|팬미팅/i.test(combined)) return "팬이벤트";
  if (/생일|기념일/i.test(combined)) return "기념일";
  if (/릴리즈|발매|album|mv/i.test(combined)) return "릴리즈";
  return "스케줄";
}

// 스케줄 시작 전 임박 알림 (방송/영상/공연 시작 1분 ~ 30분 전)
function checkUpcomingScheduleAlerts(schedules) {
  if (!Array.isArray(schedules) || schedules.length === 0) return;

  chrome.storage.local.get(['sentUpcomingScheduleIds'], (res) => {
    const sentMap = res && res.sentUpcomingScheduleIds ? res.sentUpcomingScheduleIds : {};
    const now = new Date();
    const nowMs = now.getTime();
    let updated = false;

    schedules.forEach(item => {
      if (!item.startTime) return;
      if (item.isAllday) return;

      const startD = parseSafeDate(item.startTime);
      const startMs = startD.getTime();
      const diffMs = startMs - nowMs;
      const diffMin = Math.floor(diffMs / 60000);

      // 시작 0분 전 ~ 30분 전 사이의 일정 감지
      if (diffMin >= 0 && diffMin <= 30) {
        const uniqueKey = `${item.scheduleId || item.title}_${item.startTime}`;
        if (!sentMap[uniqueKey]) {
          sentMap[uniqueKey] = nowMs;
          updated = true;

          const cleanTitle = cleanDisplayTitle(item.title);
          const catName = getScheduleCategoryName(item);
          const timeStr = `${startD.getHours()}:${String(startD.getMinutes()).padStart(2, '0')}`;
          
          let alertHeader = `⏰ [${catName} 시작 ${diffMin}분 전]`;
          if (diffMin <= 5) alertHeader = `⏰ [곧 시작!] ${catName}`;

          let alertBody = `${cleanTitle} (시작 시간: ${timeStr})`;
          if (item.extField && item.extField.value) {
            alertBody += `\n📍 ${item.extField.value}`;
          }

          sendNotification(
            alertHeader,
            alertBody,
            'schedule'
          );
        }
      }
    });

    // 24시간 지난 과거 알림 기록 정리
    for (let key in sentMap) {
      if (nowMs - sentMap[key] > 24 * 60 * 60 * 1000) {
        delete sentMap[key];
        updated = true;
      }
    }

    if (updated) {
      chrome.storage.local.set({ sentUpcomingScheduleIds: sentMap });
    }
  });
}

// 순수 텍스트 정규화 (이모지, 꺽쇠, 특수기호 제거 및 소문자화)
function cleanScheduleText(text) {
  if (!text) return "";
  return text
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]/gu, '')
    .replace(/[<>\[\]{}()_!?,.~`'"•\-\/]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// 동의어/음차 사전 정규화
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

// 괄호 분리 및 다각도 중복 매칭 엔진
function areSchedulesDuplicate(item1, item2) {
  const t1 = item1.title || item1.message || "";
  const t2 = item2.title || item2.message || "";

  // 1단계: 정규화 텍스트 완전 일치 및 포함 관계
  const n1 = normalizeTitle(t1);
  const n2 = normalizeTitle(t2);
  if (n1 && n2) {
    if (n1 === n2) return true;
    if ((n1.includes(n2) || n2.includes(n1)) && Math.min(n1.length, n2.length) >= 3) {
      return true;
    }
  }

  // 2단계: 괄호 안팎 한/영 분리 매칭
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
      if (p1 && p2 && p1.length >= 3 && p2.length >= 3) {
        if (p1 === p2 || p1.includes(p2) || p2.includes(p1)) {
          return true;
        }
      }
    }
  }

  // 3단계: 단어 교집합 유사도
  const words1 = cleanScheduleText(t1).split(' ').filter(w => w.length >= 2);
  const words2 = cleanScheduleText(t2).split(' ').filter(w => w.length >= 2);
  if (words1.length > 0 && words2.length > 0) {
    const intersection = words1.filter(w => words2.includes(w));
    if (intersection.length >= 2 || (words1.length === 1 && words2.length === 1 && words1[0] === words2[0])) {
      return true;
    }
  }

  return false;
}

// 더 구체적이거나 이모지/포맷이 잘 갖춰진 대표 제목 선택
function pickBestTitle(title1, title2) {
  if (!title1) return title2 || "";
  if (!title2) return title1 || "";
  if (title1.includes('(') && !title2.includes('(')) return title1;
  if (title2.includes('(') && !title1.includes('(')) return title2;
  return title1.length >= title2.length ? title1 : title2;
}

function sendNotification(title, message, category = 'all') {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    const storageArea = chrome.storage.sync || chrome.storage.local;
    storageArea.get(['userSettings'], (res) => {
      const noti = res && res.userSettings && res.userSettings.notifications;
      if (noti) {
        if (noti.enabled === false) return; // 알림 마스터 OFF
        if (category === 'youtube' && noti.youtube === false) return;
        if (category === 'live' && noti.live === false) return;
        if (category === 'schedule' && noti.schedule === false) return;
      }
      if (chrome.notifications && chrome.notifications.create) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/rescene-logo.png",
          title: title,
          message: message,
          priority: 2
        });
      }
    });
  }
}

// =========================================================================
// 인스타그램 공식 계정(rescene_official) Web Profile Info API 직접 수집 엔진
// =========================================================================
async function fetchInstagramDirect() {
  try {
    const res = await fetch("https://www.instagram.com/api/v1/users/web_profile_info/?username=rescene_official", {
      headers: {
        "X-IG-App-ID": "936619743392459",
        "Referer": "https://www.instagram.com/rescene_official/",
        "Sec-Fetch-Site": "same-origin"
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const edges = json?.data?.user?.edge_owner_to_timeline_media?.edges || [];
    if (edges.length === 0) return null;

    const feeds = edges.slice(0, 10).map(edge => {
      const node = edge.node;
      const shortcode = node.shortcode;
      const isVideo = node.is_video || node.__typename === "GraphVideo";
      const type = isVideo ? "reel" : "p";
      const caption = node.edge_media_to_caption?.edges?.[0]?.node?.text || "내용 없음";
      const thumb = node.display_url || (node.thumbnail_resources && node.thumbnail_resources[0]?.src) || "icons/rescene-logo.png";

      return {
        id: node.id,
        shortcode: shortcode,
        type: type,
        link: `https://www.instagram.com/${type}/${shortcode}/`,
        desc: caption,
        thumb: thumb,
        taken_at: node.taken_at_timestamp,
        author: "rescene_official"
      };
    });

    console.log("📸 인스타그램 공식 API 직접 수집 성공 (최신 게시물):", feeds.length);
    return feeds;
  } catch (err) {
    console.warn("⚠️ 인스타그램 직접 수집 지연 (Mnet 백업 사용):", err.message);
    return null;
  }
}

// =========================================================================
// 틱톡 공식 프로필(@rescene_official) Embed SSR 비디오 목록 직접 수집 엔진
// =========================================================================
async function fetchTikTokDirect() {
  try {
    const res = await fetch("https://www.tiktok.com/embed/@rescene_official", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
    for (let s of scripts) {
      if (s[1].includes("videoList")) {
        const data = JSON.parse(s[1]);
        const videoList = data?.source?.data?.["/embed/@rescene_official"]?.videoList || [];
        if (videoList.length > 0) {
          const feeds = videoList.map(v => ({
            id: v.id,
            title: v.desc || v.title || "TikTok Video",
            link: `https://www.tiktok.com/@rescene_official/video/${v.id}`,
            cover: v.coverUrl || v.dynamicCoverUrl || v.originCoverUrl || "icons/rescene-logo.png",
            playCount: v.playCount || 0,
            author: v.authorUniqueId || "rescene_official"
          }));
          console.log("🎵 틱톡 공식 피드 직접 수집 성공 (최신 비디오):", feeds.length);
          return feeds;
        }
      }
    }
    return null;
  } catch (err) {
    console.warn("⚠️ 틱톡 직접 수집 지연:", err.message);
    return null;
  }
}

// background.js - Mnet Plus (b.stage) 및 공식 API 하이브리드 피드 수집
async function fetchFeedsFromMnet() {
  try {
    // 0️⃣ 공식 API 직접 수집 우선 시도 (인스타그램 & 틱톡)
    let [directInstaFeeds, directTikTokFeeds] = await Promise.all([
      fetchInstagramDirect(),
      fetchTikTokDirect()
    ]);

    const fetchOptions = {
      method: "GET",
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://artist.mnetplus.world/main/stg/rescene-official",
        "Sec-Fetch-Site": "same-origin"
      }
    };

    // 1️⃣ 메인 레이아웃 API를 호출하여 최신 datasetId 동적 추출
    const indexUrl = "https://artist.mnetplus.world/svc/stg/rescene-official/home/api/v1/pages/index?version=V2";
    const indexRes = await fetch(indexUrl, fetchOptions);
    const indexData = await indexRes.json();

    let xDatasetId = null;
    let instaDatasetId = null;

    // JSON 구조를 순회하며 X와 INSTAGRAM의 datasetId 찾기
    if (indexData.sections) {
      for (const section of indexData.sections) {
        const sectionType = section.metadata?.base?.type;

        if (sectionType === "X" || sectionType === "INSTAGRAM") {
          const components = section.components || [];
          for (const comp of components) {
            const groups = comp.metadata?.base?.groups || [];
            for (const group of groups) {
              if (group.datasetId) {
                if (sectionType === "X") xDatasetId = group.datasetId;
                if (sectionType === "INSTAGRAM") instaDatasetId = group.datasetId;
              }
            }
          }
        }
      }
    }

    console.log("🔍 동적 추출된 Dataset IDs:", { X: xDatasetId, INSTA: instaDatasetId });

    // 2️⃣ 추출된 ID가 있다면 X 피드 가져오기
    let xFeeds = [];
    if (xDatasetId) {
      const xApiUrl = `https://artist.mnetplus.world/svc/stg/rescene-official/home/api/v1/datasets/${xDatasetId}?pageSize=10&startIndex=0&listProperties=DESCRIPTION&listProperties=LINK&listProperties=THUMBNAIL`;
      const xRes = await fetch(xApiUrl, fetchOptions);
      const xData = await xRes.json();
      xFeeds = (xData.items || []).map(item => ({
        id: item.typeId,
        link: item.link,
        desc: item.description || "내용 없음",
        thumb: item.thumbnails && item.thumbnails.length > 0 ? item.thumbnails[0].url : "icons/rescene-logo.png",
        profile: item.userProfile?.url || "",
        author: item.userName || "X User"
      }));
    }

    // 3️⃣ 인스타그램 피드: 직접 수집 데이터 우선 사용, 실패 시 Mnet 백업 사용
    let instaFeeds = directInstaFeeds || [];
    if (instaFeeds.length === 0 && instaDatasetId) {
      const instaApiUrl = `https://artist.mnetplus.world/svc/stg/rescene-official/home/api/v1/datasets/${instaDatasetId}?pageSize=10&startIndex=0&listProperties=DESCRIPTION&listProperties=LINK&listProperties=THUMBNAIL`;
      const instaRes = await fetch(instaApiUrl, fetchOptions);
      const instaData = await instaRes.json();
      instaFeeds = (instaData.items || []).map(item => ({
        id: item.typeId,
        link: item.link,
        desc: item.description || "내용 없음",
        thumb: item.thumbnails && item.thumbnails.length > 0 ? item.thumbnails[0].url : "icons/rescene-logo.png",
        profile: item.userProfile?.url || "",
        author: item.userName || "Instagram User"
      }));
    }

    // 4️⃣ 틱톡 피드
    let tiktokFeeds = directTikTokFeeds || [];

    // 5️⃣ 추출한 객체 배열을 스토리지에 통합 저장!
    chrome.storage.local.set({ xFeeds, instaFeeds, tiktokFeeds });
    console.log("✅ SNS 피드 최신화 완료!", { xCount: xFeeds.length, instaCount: instaFeeds.length, tiktokCount: tiktokFeeds.length });

  } catch (error) {
    console.error("❌ 피드 수집 실패:", error);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "UPDATE_REFRESH_INTERVAL") {
    const minutes = parseInt(request.intervalMinutes, 10) || 15;
    setupRefreshAlarms(minutes);
    fetchAllData();
    fetchFeedsFromMnet();
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
