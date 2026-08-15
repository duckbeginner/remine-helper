const OFFICIAL_CHANNEL_ID = "UCtKtCiaWRz-d3EZn2xd1mdA";
const OFFICIAL_PLAYLIST_ID = "PL7zZDePsdYwPNu51o8b9MKQ_eGk520SFt";
const WONI_CHANNEL_ID = "UCWpY0eSJtyO-qNAPbKFRSSg";

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
  await fetchYouTubeVideos(WONI_CHANNEL_ID, "woniVideos", "안녕하세요원이입니다잘부탁드립니다");
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

    while ((match = entryRegex.exec(xmlText)) !== null && videos.length < 25) {
      const entryContent = match[1];
      const videoIdMatch = entryContent.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
      const titleMatch = entryContent.match(/<title>(.*?)<\/title>/);
      const publishedMatch = entryContent.match(/<published>(.*?)<\/published>/);
      const linkMatch = entryContent.match(/<link rel="alternate" href="(.*?)"\s*\/?>/);

      if (videoIdMatch && titleMatch) {
        const videoId = videoIdMatch[1];
        const title = titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        const publishedIso = publishedMatch ? publishedMatch[1] : '';
        const published = publishedIso ? publishedIso.split('T')[0] : '';
        const rawUrl = linkMatch ? linkMatch[1] : (entryContent.includes('/shorts/') ? `https://www.youtube.com/shorts/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`);
        const isShorts = entryContent.includes('/shorts/') || rawUrl.includes('/shorts/') || /shorts|#shorts|#Shorts|\[shorts\]|\(shorts\)|#쇼츠|#short\b/i.test(title + ' ' + entryContent);

        if (channelId === OFFICIAL_CHANNEL_ID && videos.length === 0 && (title.includes("LIVE") || title.includes("라이브") || entryContent.includes("liveStream"))) {
          isLiveOnAir = true;
        }

        videos.push({
          id: videoId,
          title: title,
          published: published,
          publishedAt: publishedIso,
          url: rawUrl,
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          channelName: channelName,
          isShorts: isShorts
        });
      }
    }

    if (videos.length > 0) {
      let updateData = { [storageKey]: videos };
      if (channelId === OFFICIAL_CHANNEL_ID) {
        updateData.isLive = isLiveOnAir;
      }
      await new Promise(resolve => chrome.storage.local.set(updateData, resolve));

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

    while ((match = entryRegex.exec(xmlText)) !== null && videos.length < 25) {
      const entryContent = match[1];
      const videoIdMatch = entryContent.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
      const titleMatch = entryContent.match(/<title>(.*?)<\/title>/);
      const publishedMatch = entryContent.match(/<published>(.*?)<\/published>/);
      const linkMatch = entryContent.match(/<link rel="alternate" href="(.*?)"\s*\/?>/);

      if (videoIdMatch && titleMatch) {
        const videoId = videoIdMatch[1];
        const title = titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        const publishedIso = publishedMatch ? publishedMatch[1] : '';
        const published = publishedIso ? publishedIso.split('T')[0] : '';
        const rawUrl = linkMatch ? linkMatch[1] : (entryContent.includes('/shorts/') ? `https://www.youtube.com/shorts/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`);
        const isShorts = entryContent.includes('/shorts/') || rawUrl.includes('/shorts/') || /shorts|#shorts|#Shorts|\[shorts\]|\(shorts\)|#쇼츠|#short\b/i.test(title + ' ' + entryContent);

        videos.push({
          id: videoId,
          title: title,
          published: published,
          publishedAt: publishedIso,
          url: rawUrl,
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          channelName: playlistName,
          isShorts: isShorts
        });
      }
    }

    if (videos.length > 0) {
      await new Promise(resolve => chrome.storage.local.set({ [storageKey]: videos }, resolve));
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
            rawSchedules.push(...mnetJson.events.map(ev => {
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
            }));
          }
        }
      } catch (e) { }

      // [B] 블립(Blip) 월별 수집 (공식 유튜브 영상과 매칭 시 공식 정보로 대체)
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
          rawSchedules.push(...blipData.map(item => {
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
          }));
        }
      } catch (e) { }

      // 다음 달로 이동
      loopDate.setMonth(loopDate.getMonth() + 1);
    }

    // [C] 직접 수집한 공식 유튜브 영상 피드 데이터에서 쇼츠 식별 및 롱폼 영상 일정 목록 생성 (archive 재생목록은 일정 생성 제외)
    let shortsVideoIdSet = new Set();
    let shortsVideoList = [];
    let youtubeScheduleItems = [];
    try {
      const ytData = await new Promise(resolve => {
        chrome.storage.local.get(["latestVideos", "woniVideos", "officialPlaylistVideos"], resolve);
      });
      // 쇼츠 식별용 전체 영상 풀
      const allYtVideos = [
        ...(ytData.latestVideos || []),
        ...(ytData.woniVideos || []),
        ...(ytData.officialPlaylistVideos || [])
      ];

      // 쇼츠 videoId 세트 및 쇼츠 영상 리스트 구축
      allYtVideos.forEach(v => {
        if (!v.id) return;
        const isShorts = v.isShorts || (v.url && v.url.includes('/shorts/')) || /shorts|#shorts|#Shorts|\[shorts\]|\(shorts\)|#쇼츠|#short\b/i.test(v.title || '');
        if (isShorts) {
          shortsVideoIdSet.add(v.id);
          shortsVideoList.push(v);
        }
      });

      // 일정 생성 대상 영상 풀 (공식 최신 영상 + 원이 채널 영상만 포함, archive 재생목록은 제외)
      const targetScheduleVideos = [
        ...(ytData.latestVideos || []),
        ...(ytData.woniVideos || [])
      ];

      // 공식 롱폼 영상 스케줄 생성 (병합 로직에서 제외하고 독립적으로 직접 추가)
      const seenYt = new Set();
      targetScheduleVideos.forEach(v => {
        if (!v.id || seenYt.has(v.id)) return;
        // 쇼츠(Shorts) 영상 제외
        if (shortsVideoIdSet.has(v.id)) return;

        seenYt.add(v.id);
        const startTime = v.publishedAt || (v.published ? `${v.published}T00:00:00Z` : new Date().toISOString());
        youtubeScheduleItems.push({
          title: v.title,
          startTime: startTime,
          endTime: startTime,
          message: `[공식 영상] ${v.title}`,
          typeText: "영상",
          location: null,
          channel: v.channelName || "유튜브",
          source: "youtube",
          url: v.url,
          link: v.url,
          thumbnail: v.thumbnail,
          extField: { key: "채널", value: v.channelName || "유튜브" }
        });
      });
    } catch (e) { }

    // 직캠, 투표, 쇼츠, 포스터/응모/증정/공지 이벤트 정밀 필터링
    const exactExcludePatterns = [
      /직캠/i, /풀캠/i, /팬캠/i, /페이스캠/i, /입덕직캠/i, /최애직캠/i, /팔로우캠/i, /안방1열/i, /음중직캠/i, /음중풀캠/i, /음중팔로우캠/i,
      /fan\W*cam/i, /k\W*fancam/i, /choreo/i, /fancam/i, /\bcam\b/i,
      // 쇼츠 제외
      /shorts/i, /#shorts/i, /#쇼츠/i, /\/shorts\//i,
      // 투표 관련 일정 제외
      /투표/i, /사전투표/i, /실시간투표/i, /\bvote\b/i, /\bvoting\b/i, /\bpoll\b/i,
      /덕애드/i, /스타패스/i, /아이돌챔프/i, /뮤빗/i, /팬플러스/i, /포도알/i, /케이돌/i, /엠넷플러스\s*투표/i,
      // 포스터/응모/증정/빅크/특전 이벤트 및 단순 공지 제외
      /포스터\s*이벤트/i, /사인\s*.*이벤트/i, /싸인\s*.*이벤트/i, /이벤트\s*안내/i, /안내\s*\(Notice\)/i,
      /\[빅크/i, /\bBIGC\b/i, /응모\s*이벤트/i, /증정\s*이벤트/i, /특전\s*이벤트/i, /구매자\s*이벤트/i,
      /럭키드로우/i, /\b럭드\b/i
    ];

    // 1) 공식 유튜브 영상 ID 매핑 테이블 구축
    const ytVideoIdMap = new Map();
    youtubeScheduleItems.forEach(ytItem => {
      const match = (ytItem.url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
      if (match) ytVideoIdMap.set(match[1], ytItem);
    });

    const filteredSchedules = rawSchedules.filter(item => {
      const targetText = [item.title, item.message, item.url, item.link, item.description].filter(Boolean).join(" ");
      for (let pattern of exactExcludePatterns) {
        if (pattern.test(targetText)) return false;
      }

      // 1) 쇼츠 영상 링크/ID를 포함하는 일정은 제외
      const ytIdMatches = targetText.matchAll(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/g);
      for (const m of ytIdMatches) {
        const vid = m[1];
        if (shortsVideoIdSet.has(vid)) return false;
      }

      // 2) 유튜브 채널 홈 URL만 있고 특정 영상 ID가 없는 유튜브 자컨/라이브 플레이스홀더 알림 일정만 선별 제외
      const hasSpecificVideoLink = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|live\/))([\w-]{11})/.test(targetText);
      const isYoutubeChannelHome = /youtube\.com\/@/i.test(targetText);
      const cleanTitle = (item.title || '').replace(/[<>]/g, '').trim();
      const isPlaceholderChannelOnly = !hasSpecificVideoLink && (
        (isYoutubeChannelHome && /^(?:안녕하세요\s*원이입니다.*|안원잘부.*|rescene\s*vlog.*|youtube\s*live|유튜브\s*라이브)$/i.test(cleanTitle)) ||
        (isYoutubeChannelHome && /공개\s*예정\s*채널|유튜브에서\s*만나요/i.test(targetText))
      );
      if (isPlaceholderChannelOnly) return false;

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

        // 같은 날짜(YYYY-MM-DD) 내 중복 판별
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
          if (newItem.location) target.location = newItem.location;
          target.title = pickBestTitle(target.title, newItem.title);
        } else {
          // 일반 제목 선택
          target.title = pickBestTitle(target.title, newItem.title);
        }

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
        if (!target.location && newItem.location) {
          target.location = newItem.location;
        }
        if (!target.channel && newItem.channel) {
          target.channel = newItem.channel;
        }
        if (!target.extField && newItem.extField) {
          target.extField = newItem.extField;
        }
        if ((!target.starAttendees || target.starAttendees.length === 0) && (newItem.starAttendees && newItem.starAttendees.length > 0)) {
          target.starAttendees = newItem.starAttendees;
        }
      } else {
        mergedList.push({ ...newItem });
      }
    });

    // 직접 수집한 공식 유튜브 롱폼 영상 일정들을 mergedList에 직접 추가 (병합 복잡도 없이 온전한 공식 정보 유지)
    youtubeScheduleItems.forEach(ytItem => {
      mergedList.push(ytItem);
    });

    // ★ 유튜브 링크가 포함된 일정 항목들을 YouTube oEmbed 실시간 데이터로 풍부하게 재구성 (방송사인 경우 방송사명 유지)
    await enrichSchedulesWithYouTubeOEmbed(mergedList);

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

// 방송사 명칭 판별 헬퍼 (공식 TV/라디오 방송사 및 주요 KPOP 방송 미디어)
function isBroadcasterName(name) {
  if (!name) return false;
  const n = String(name).trim();
  return /^(?:MBC|KBS|KBS2|SBS|Mnet|JTBC|tvN|ENA|EBS|TV조선|채널A|MBN|Arirang|아리랑|CJ\s*ENM|M2|SBSKPOP|MBCkpop|KBS\s*Kpop|스튜디오\s*춤|STUDIO\s*CHOOM|1theK|원더케이|it's\s*Live|잇츠라이브)/i.test(n);
}

// 실제 TV 정규 방송 프로그램 판별 (본방 제목 유지 대상)
function isTvMainBroadcast(item, channel) {
  const t = (item.title || '').replace(/[<>]/g, '').trim();
  const c = String(channel || '').trim();
  const isBroadcaster = /^(?:MBC|KBS|KBS2|SBS|Mnet|JTBC|tvN|ENA|EBS|TV조선|채널A|MBN)/i.test(c);
  if (!isBroadcaster) return false;

  // 웹 전용 클립, 미방분, 비하인드, 유튜브 전용 코너는 제외 (oEmbed 제목 적용)
  if (/미방분|비하인드|선공개|직캠|fancam|풀버전|클립|behind|up코노|코없코|우쥬레코드|웹예능|아이돌부스/i.test(t + ' ' + (item.message || ''))) {
    return false;
  }

  // 대표 정규 TV 프로그램 매칭
  if (/전지적\s*참견\s*시점|전참시|놀라운\s*토요일|놀토|복면가왕|아는\s*형님|뮤직뱅크|쇼!?\s*음악중심|인기가요|m\s*countdown|엠카운트다운|쇼!?\s*챔피언|더쇼|the\s*show|심플리\s*케이팝|simply\s*k-pop|식객\s*허영만의\s*백반기행|열혈농구단|최우수산|배성재의\s*텐|아이돌\s*라디오|친한친구/i.test(t)) {
    return true;
  }
  return false;
}

// 유튜브 링크가 있는 일정 항목들을 YouTube oEmbed API로 풍부하게 재구성
async function enrichSchedulesWithYouTubeOEmbed(schedules) {
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

// 스케줄 제목 앞단 불필요한 대괄호 태그, 끝단 해시태그/채널 접미사 정돈 및 길이 조정
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

// 스케줄 카테고리명 판별
function getScheduleCategoryName(item) {
  if (item.typeText) return item.typeText;
  const combined = `${item.title || ""} ${item.message || ""}`.toLowerCase();
  if (/안녕하세요원이입니다|안원잘부|@helloiamwoninicetomeetyou|자컨|비하인드|vlog|브이로그|shorts|쇼츠/i.test(combined)) return "영상";
  if (/쇼챔피언|엠카운트다운|뮤직뱅크|인기가요|더쇼|음악중심|방송|라디오|예능|tv/i.test(combined)) return "방송";
  if (/kcon|케이콘|어워즈|쇼케이스|콘서트|페스티벌|축제|팬미팅|공연|무대/i.test(combined)) return "공연";
  return "기타";
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
    'dream concert': '드림콘서트',
    '맨시티': '맨체스터시티',
    'man city': '맨체스터시티',
    'mancity': '맨체스터시티'
  };

  for (let [en, ko] of Object.entries(synonyms)) {
    if (clean.includes(en)) {
      clean = clean.replace(new RegExp(en, 'g'), ko);
    }
  }

  return clean.replace(/\s+/g, '');
}

// 제목 구조화 파서 (<메인 프로그램/대회명> 부제, [메인] 부제, 메인 - 부제 분해)
function parseTitleStructure(title) {
  if (!title) return { main: '', sub: '' };
  
  const bracketMatch = title.match(/^[<\[](.+?)[>\]]\s*(.*)$/);
  if (bracketMatch) {
    return {
      main: normalizeTitle(bracketMatch[1]),
      sub: normalizeTitle(bracketMatch[2])
    };
  }

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

// 지능형 스케줄 중복 판별 엔진 (하드코딩 0%, 구조적 메인-부제 및 카테고리 기반)
function areSchedulesDuplicate(item1, item2) {
  // 0단계: 유튜브 영상 ID 대조 (서로 다른 영상 ID를 가지고 있으면 100% 다른 일정이므로 병합 거부!)
  const extractYtId = (item) => {
    const text = [item.url, item.link, item.message, item.title].filter(Boolean).join(' ');
    const match = text.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
    return match ? match[1] : null;
  };

  const ytId1 = extractYtId(item1);
  const ytId2 = extractYtId(item2);
  if (ytId1 && ytId2) {
    if (ytId1 === ytId2) return true; // 동일 영상 ID면 무조건 동일 일정
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

  // 5단계: 단어 교집합 유사도 (순수 제목 기반)
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

// 더 구체적이거나 이모지/포맷이 잘 갖춰진 대표 제목 선택
function pickBestTitle(title1, title2) {
  if (!title1) return title2 || "";
  if (!title2) return title1 || "";
  if (title1.includes('(') && !title2.includes('(')) return title1;
  if (title2.includes('(') && !title1.includes('(')) return title2;
  return title1.length >= title2.length ? title1 : title2;
}

// 스케줄 시작 전 임박 알림 (방송/영상/공연 시작 30분 이내 감지)
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

        // 현재 시각 이후이며 30분 이내에 시작하는 스케줄
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
              'schedule'
            );
          }
        }
      });

      // 24시간 지난 오래된 알림 ID 정리 및 저장
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

function sendNotification(title, message, category = 'all') {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['userSettings'], (res) => {
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
  if (request.action === "REFRESH_ALL_DATA" || request.action === "FORCE_REFRESH") {
    fetchAllData().then(() => {
      fetchFeedsFromMnet();
      sendResponse({ success: true });
    }).catch(err => {
      sendResponse({ success: false, error: String(err) });
    });
    return true;
  }

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
