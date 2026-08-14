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

chrome.runtime.onInstalled.addListener(() => {
  fetchAllData();
  chrome.alarms.create("refreshData", { periodInMinutes: 5 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "refreshData") {
    fetchAllData();
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
            sendNotification(alertTitle, videos[0].title);
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

      // [A] 블립 월별 수집
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
            message: item.message || "",
            extField: item.extField || null
          })));
        }
      } catch (e) {}

      // [B] 엠넷플러스 월별 수집
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
              message: `[${ev.label ? ev.label.name : '일정'}] ${ev.title}`,
              extField: null
            })));
          }
        }
      } catch (e) {}

      // 다음 달로 이동
      loopDate.setMonth(loopDate.getMonth() + 1);
    }

    // 직캠류 정밀 필터링
    const exactExcludePatterns = [
      /직캠/i, /풀캠/i, /팬캠/i, /페이스캠/i, /입덕직캠/i, /최애직캠/i, /팔로우캠/i, /안방1열/i, /음중직캠/i, /음중풀캠/i, /음중팔로우캠/i,
      /fan\W*cam/i, /k\W*fancam/i, /choreo/i, /fancam/i, /\bcam\b/i
    ];

    const filteredSchedules = rawSchedules.filter(item => {
      const targetText = item.title + " " + item.message;
      for (let pattern of exactExcludePatterns) {
        if (pattern.test(targetText)) return false;
      }
      return true;
    });

    // 지능형 병합 및 정렬
    const mergedList = [];

    filteredSchedules.forEach(newItem => {
      const newItemTimeMs = parseSafeDate(newItem.startTime).getTime();
      const newCleanTitle = normalizeTitle(newItem.title);

      let matchedIndex = -1;

      for (let i = 0; i < mergedList.length; i++) {
        const existing = mergedList[i];
        const existItemTimeMs = parseSafeDate(existing.startTime).getTime();
        const existCleanTitle = normalizeTitle(existing.title);

        const timeDiff = Math.abs(newItemTimeMs - existItemTimeMs);
        const isWithin1Hour = timeDiff <= 60 * 60 * 1000;

        const isTitleMatched = (
          existCleanTitle.includes(newCleanTitle) ||
          newCleanTitle.includes(existCleanTitle) ||
          areTitlesSimilar(existCleanTitle, newCleanTitle)
        );

        if (isWithin1Hour && isTitleMatched) {
          matchedIndex = i;
          break;
        }
      }

      if (matchedIndex !== -1) {
        const target = mergedList[matchedIndex];
        if (newItem.title.length > target.title.length) {
          target.title = newItem.title;
        }
        if (newItem.message && newItem.message.length > (target.message ? target.message.length : 0)) {
          target.message = newItem.message;
        }
        if (!target.extField && newItem.extField) {
          target.extField = newItem.extField;
        }
      } else {
        mergedList.push(newItem);
      }
    });

    // 백그라운드 단에서 시간순(오름차순) 정렬 완료
    mergedList.sort((a, b) => parseSafeDate(a.startTime).getTime() - parseSafeDate(b.startTime).getTime());

    chrome.storage.local.set({ blipSchedules: mergedList });
  } catch (error) {
    console.error("장기 스케줄 수집 및 병합 오류:", error);
  }
}

function normalizeTitle(title) {
  let clean = title.replace(/<[^>]*>?/gm, '').toLowerCase();
  const synonyms = {
    'show champion': '쇼챔피언',
    'm countdown': '엠카운트다운',
    'music bank': '뮤직뱅크',
    'inkigayo': '인기가요',
    'the show': '더쇼',
    'music core': '음악중심'
  };

  for (let [en, ko] of Object.entries(synonyms)) {
    if (clean.includes(en)) {
      clean = clean.replace(en, ko);
    }
  }
  return clean.replace(/[\s\[\]<>(){}#]/g, '');
}

function areTitlesSimilar(t1, t2) {
  if (t1.length < 2 || t2.length < 2) return false;
  return t1.includes(t2) || t2.includes(t1);
}

function sendNotification(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/rescene-logo.png",
    title: title,
    message: message,
    priority: 2
  });
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

// 확장 프로그램 로드 시 최초 1회 실행
fetchFeedsFromMnet();

// 1시간 주기로 알람 실행하여 데이터 최신화 유지
chrome.alarms.create("fetchSocialFeeds", { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "fetchSocialFeeds") fetchFeedsFromMnet();
});

// chrome.declarativeNetRequest.updateDynamicRules({
//   addRules: [{
//     "id": 1,
//     "priority": 1,
//     "action": {
//       "type": "modifyHeaders",
//       "requestHeaders": [
//         // 이 부분에서 기존 브라우저에 저장된 진짜 Cookie 값을
//         // 런타임에 가로채서 넣어주는 규칙이나 스크립트를 결합합니다.
//         { "header": "Cookie", "operation": "set", "value": "실제쿠키값" }
//       ]
//     },
//     "condition": {
//       "urlFilter": "https://*.mnetplus.world/*",
//       "resourceTypes": ["sub_frame", "xmlhttprequest"]
//     }
//   }],
//   removeRuleIds: [1]
// });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
