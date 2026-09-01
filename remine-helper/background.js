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
// const OFFICIAL_CHANNEL_ID = "UCQKQTgZJo3PlxA-9V1Z51XA"; //for live test
const OFFICIAL_PLAYLIST_ID = "PL7zZDePsdYwPNu51o8b9MKQ_eGk520SFt";
const WONI_CHANNEL_ID = "UCWpY0eSJtyO-qNAPbKFRSSg";

// Firefox/older browsers에서 DNR 대신 webRequest로 CSP를 조정하는 처리
const FIREFOX_FRAME_ANCESTORS = "frame-ancestors https: http: moz-extension:";
const CSP_URL_PATTERNS = [
  "*://*.mnetplus.world/*",
  "*://adam-yam.github.io/*",
  "*://clip.naver.com/*"
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
  await fetchYouTubeVideos(OFFICIAL_CHANNEL_ID, "latestVideos", "공식 유튜브", "@RESCENE_official");
  // await fetchYouTubeVideos(OFFICIAL_CHANNEL_ID, "latestVideos", "공식 유튜브", "@DailySeoul"); //for live test
  await fetchYouTubePlaylist(OFFICIAL_PLAYLIST_ID, "officialPlaylistVideos", "RESCENE Archive", "@RESCENE_official");
  await fetchYouTubeVideos(WONI_CHANNEL_ID, "woniVideos", "안녕하세요원이입니다잘부탁드립니다", "@helloiamwoninicetomeetyou");
  await fetchAndMergeSchedules();
}

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, '&'); // &amp;는 마지막에 디코딩하여 이중 디코딩 방지
}

async function fetchYouTubeVideos(channelId, storageKey, channelName, channelHandle) {
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const response = await fetch(rssUrl);
    const xmlText = await response.text();
    const videos = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    let isLiveOnAir = false;
    let liveVideoInfo = null;

    // 라이브 온에어 여부 및 실제 라이브 영상 메타데이터 파싱
    if (channelHandle) {
      try {
        const liveResponse = await fetch(`https://www.youtube.com/${channelHandle}/live`);
        if (liveResponse.ok) {
          const liveText = await liveResponse.text();
          if (liveText.includes('"isLiveNow":true') || liveText.includes('"isLive":true')) {
            isLiveOnAir = true;

            // 1. 실제 라이브 videoId 추출
            let liveVideoId = null;
            const ogUrlMatch = liveText.match(/<meta property="og:url" content="([^"]+)"/i);
            if (ogUrlMatch) {
              const vMatch = ogUrlMatch[1].match(/[?&]v=([^&#]+)/);
              if (vMatch) liveVideoId = vMatch[1];
            }
            if (!liveVideoId) {
              const videoIdMatch = liveText.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
              if (videoIdMatch) liveVideoId = videoIdMatch[1];
            }

            // 2. 실제 라이브 제목 추출
            let liveTitle = '';
            const ogTitleMatch = liveText.match(/<meta property="og:title" content="([^"]+)"/i);
            if (ogTitleMatch) {
              liveTitle = decodeHtmlEntities(ogTitleMatch[1]);
            } else {
              const titleTagMatch = liveText.match(/<title>(.*?)<\/title>/i);
              if (titleTagMatch) {
                liveTitle = decodeHtmlEntities(titleTagMatch[1].replace(/ - YouTube$/i, '').trim());
              }
            }

            // 3. 실제 라이브 썸네일 추출
            let liveThumbnail = '';
            const ogImageMatch = liveText.match(/<meta property="og:image" content="([^"]+)"/i);
            if (ogImageMatch) {
              liveThumbnail = ogImageMatch[1];
            } else if (liveVideoId) {
              liveThumbnail = `https://img.youtube.com/vi/${liveVideoId}/hqdefault.jpg`;
            }

            if (liveVideoId && liveTitle) {
              liveVideoInfo = {
                id: liveVideoId,
                title: liveTitle,
                published: new Date().toISOString().split('T')[0],
                publishedAt: new Date().toISOString(),
                url: `https://www.youtube.com/watch?v=${liveVideoId}`,
                thumbnail: liveThumbnail || `https://img.youtube.com/vi/${liveVideoId}/hqdefault.jpg`,
                channelName: channelName,
                isShorts: false,
                isLive: true
              };
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch live status:', err);
      }
    }

    while ((match = entryRegex.exec(xmlText)) !== null && videos.length < 25) {
      const entryContent = match[1];
      const videoIdMatch = entryContent.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
      const titleMatch = entryContent.match(/<title>(.*?)<\/title>/);
      const publishedMatch = entryContent.match(/<published>(.*?)<\/published>/);
      const linkMatch = entryContent.match(/<link rel="alternate" href="(.*?)"\s*\/?>/);

      if (videoIdMatch && titleMatch) {
        const videoId = videoIdMatch[1];
        const title = decodeHtmlEntities(titleMatch[1]);
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
          channelName: channelName,
          isShorts: isShorts
        });
      }
    }

    // 라이브 방송 중인 경우 최상단에 실제 라이브 영상 객체 배치 (중복 방지)
    if (liveVideoInfo) {
      const existingIdx = videos.findIndex(v => v.id === liveVideoInfo.id);
      if (existingIdx >= 0) {
        videos[existingIdx] = { ...videos[existingIdx], ...liveVideoInfo };
      } else {
        videos.unshift(liveVideoInfo);
      }
    }

    if (videos.length > 0) {
      let updateData = { [storageKey]: videos };
      if (channelId === OFFICIAL_CHANNEL_ID) {
        updateData.isLive = isLiveOnAir;
      }
      await new Promise(resolve => chrome.storage.local.set(updateData, resolve));

      if (channelId === OFFICIAL_CHANNEL_ID) {
        chrome.storage.local.get(["notifiedVideoIds", "viewedVideoIds"], (result) => {
          let notifiedMap = result.notifiedVideoIds;
          const viewedMap = result.viewedVideoIds || {};

          // 최초 설치/실행 시점: 기존 영상들은 알림 없이 이력에만 등록하여 불필요한 알림 방지
          if (!notifiedMap) {
            notifiedMap = {};
            videos.forEach(v => {
              notifiedMap[v.id] = Date.now();
            });
            if (liveVideoInfo) {
              notifiedMap['live_' + liveVideoInfo.id] = Date.now();
            }
            chrome.storage.local.set({ notifiedVideoIds: notifiedMap });
            return;
          }

          let hasNewNotification = false;

          // 1. 실시간 라이브 방송 알림 (실제 라이브 영상 메타데이터로 1회 발송)
          if (isLiveOnAir) {
            const targetLive = liveVideoInfo || videos[0];
            const liveKey = 'live_' + targetLive.id;
            if (!notifiedMap[liveKey]) {
              notifiedMap[liveKey] = Date.now();
              hasNewNotification = true;
              sendNotification(
                "🔴 [RESCENE ON AIR] 실시간 라이브 방송 시작!",
                targetLive.title,
                'live',
                targetLive.thumbnail,
                targetLive.id
              );
            }
          }

          // 2. 신규 영상 업로드 알림 (알림 보낸 적 없고 사용자가 아직 브라우저에서 보지 않은 VOD 대상)
          videos.slice(0, 3).forEach((video) => {
            // 라이브 방송 영상은 별도 라이브 알림으로 처리되므로 일반 업로드 알림에서는 제외
            if (!video.isLive && !notifiedMap[video.id] && !viewedMap[video.id]) {
              notifiedMap[video.id] = Date.now();
              hasNewNotification = true;
              sendNotification(
                "🔔 [RESCENE] 새로운 공식 유튜브 영상 업로드!",
                video.title,
                'youtube',
                null,
                video.id
              );
            }
          });

          // 3. 30일 지난 오래된 이력 정리 및 저장
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
        const title = decodeHtmlEntities(titleMatch[1]);
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

// 단일 월(Year, Month)의 Mnet 및 Blip 스케줄 병렬 수집 함수
async function fetchMonthRawSchedules(year, month) {
  const paddedMonth = String(month).padStart(2, '0');

  // [A] 엠넷플러스(Mnet Plus) 월별 수집
  const fetchMnet = async () => {
    try {
      const lastDay = new Date(year, month, 0).getDate();
      const mnetUrl = `https://artist.mnetplus.world/svc/stg/rescene-official/space/api/v1/calendar?endAt=${year}-${paddedMonth}-${lastDay}T23:59:59Z&endAtForAllDay=${year}-${paddedMonth}-${lastDay}&startAt=${year}-${paddedMonth}-01T00:00:00Z&startAtForAllDay=${year}-${paddedMonth}-01`;
      const mnetRes = await fetch(mnetUrl, {
        headers: { 'accept': '*/*', 'x-bmf-country': 'KR', 'x-bmf-currency': 'KRW', 'x-bmf-language': 'ko', 'x-bmf-shop-id': '33' }
      });
      if (mnetRes.ok) {
        const mnetJson = await mnetRes.json();
        if (mnetJson && Array.isArray(mnetJson.events)) {
          return mnetJson.events.map(ev => {
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

  // [B] 블립(Blip) 월별 수집
  const fetchBlip = async () => {
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
        return blipData.map(item => {
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

// 스케줄 원본 데이터 필터링, 공식 유튜브 결합, 중복 병합 및 oEmbed 처리 공통 함수
async function processAndMergeScheduleList(rawSchedules) {
  let shortsVideoIdSet = new Set();
  let youtubeScheduleItems = [];
  try {
    const ytData = await new Promise(resolve => {
      chrome.storage.local.get(["latestVideos", "woniVideos", "officialPlaylistVideos"], resolve);
    });
    const allYtVideos = [
      ...(ytData.latestVideos || []),
      ...(ytData.woniVideos || []),
      ...(ytData.officialPlaylistVideos || [])
    ];

    allYtVideos.forEach(v => {
      if (!v.id) return;
      const isShorts = v.isShorts || (v.url && v.url.includes('/shorts/')) || /shorts|#shorts|#Shorts|\[shorts\]|\(shorts\)|#쇼츠|#short\b/i.test(v.title || '');
      if (isShorts) shortsVideoIdSet.add(v.id);
    });

    const officialYtIdSet = new Set((ytData.latestVideos || []).map(v => v.id).filter(Boolean));
    const woniYtIdSet = new Set((ytData.woniVideos || []).map(v => v.id).filter(Boolean));

    const targetScheduleVideos = [
      ...(ytData.latestVideos || []).map(v => ({ ...v, isOfficialYoutube: true })),
      ...(ytData.woniVideos || []).map(v => ({ ...v, isWoniYoutube: true }))
    ];

    const seenYt = new Set();
    targetScheduleVideos.forEach(v => {
      if (!v.id || seenYt.has(v.id)) return;
      if (shortsVideoIdSet.has(v.id)) return;

      seenYt.add(v.id);
      const startTime = v.publishedAt || (v.published ? `${v.published}T00:00:00Z` : new Date().toISOString());
      youtubeScheduleItems.push({
        id: v.id,
        videoId: v.id,
        title: v.title,
        startTime: startTime,
        endTime: startTime,
        message: v.isWoniYoutube ? `[원이 영상] ${v.title}` : `[공식 영상] ${v.title}`,
        typeText: "영상",
        location: null,
        channel: v.channelName || (v.isWoniYoutube ? "안녕하세요원이입니다잘부탁드립니다" : "공식 유튜브"),
        source: "youtube",
        url: v.url,
        link: v.url,
        thumbnail: v.thumbnail,
        isOfficialYoutube: Boolean(v.isOfficialYoutube),
        isWoniYoutube: Boolean(v.isWoniYoutube),
        extField: { key: "채널", value: v.channelName || (v.isWoniYoutube ? "안녕하세요원이입니다잘부탁드립니다" : "공식 유튜브") }
      });
    });
  } catch (e) { }

  const exactExcludePatterns = [
    /직캠/i, /풀캠/i, /팬캠/i, /페이스캠/i, /입덕직캠/i, /최애직캠/i, /팔로우캠/i, /안방1열/i, /음중직캠/i, /음중풀캠/i, /음중팔로우캠/i,
    /fan\W*cam/i, /k\W*fancam/i, /choreo/i, /fancam/i, /\bcam\b/i,
    /shorts/i, /#shorts/i, /#쇼츠/i, /\/shorts\//i,
    /투표/i, /사전투표/i, /실시간투표/i, /\bvote\b/i, /\bvoting\b/i, /\bpoll\b/i,
    /덕애드/i, /스타패스/i, /아이돌챔프/i, /뮤빗/i, /팬플러스/i, /포도알/i, /케이돌/i, /엠넷플러스\s*투표/i,
    /포스터\s*이벤트/i, /사인\s*.*이벤트/i, /싸인\s*.*이벤트/i, /이벤트\s*안내/i, /안내\s*\(Notice\)/i,
    /\[빅크/i, /\bBIGC\b/i, /응모\s*이벤트/i, /증정\s*이벤트/i, /특전\s*이벤트/i, /구매자\s*이벤트/i,
    /럭키드로우/i, /\b럭드\b/i, /UCWpY0eSJtyO-qNAPbKFRSSg/i, /UCtKtCiaWRz-d3EZn2xd1mdA/i, /tiktok/i, /youtube.com\/@rescene_official/i, /아티스트 공식 채널에 올라온 콘텐츠입니다/i
  ];

  const filteredSchedules = rawSchedules.filter(item => {
    const targetText = [item.title, item.message, item.url, item.link, item.description].filter(Boolean).join(" ");
    for (let pattern of exactExcludePatterns) {
      if (pattern.test(targetText)) return false;
    }

    const ytIdMatches = targetText.matchAll(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/g);
    for (const m of ytIdMatches) {
      if (shortsVideoIdSet.has(m[1])) return false;
    }

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

  const mergedList = [];
  filteredSchedules.forEach(newItem => {
    const newD = parseSafeDate(newItem.startTime);
    const newDateStr = `${newD.getFullYear()}-${String(newD.getMonth() + 1).padStart(2, '0')}-${String(newD.getDate()).padStart(2, '0')}`;

    let matchedIndex = -1;
    for (let i = 0; i < mergedList.length; i++) {
      const existing = mergedList[i];
      const existD = parseSafeDate(existing.startTime);
      const existDateStr = `${existD.getFullYear()}-${String(existD.getMonth() + 1).padStart(2, '0')}-${String(existD.getDate()).padStart(2, '0')}`;

      if (newDateStr === existDateStr && areSchedulesDuplicate(existing, newItem)) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex !== -1) {
      const target = mergedList[matchedIndex];
      if (newItem.source === 'mnet') {
        target.source = 'mnet';
        if (newItem.typeText) target.typeText = newItem.typeText;
        if (newItem.startTime) target.startTime = newItem.startTime;
        if (newItem.endTime) target.endTime = newItem.endTime;
        if (newItem.location) target.location = newItem.location;
        target.title = pickBestTitle(target.title, newItem.title);
      } else {
        target.title = pickBestTitle(target.title, newItem.title);
      }

      if (newItem.message && newItem.message.length > (target.message ? target.message.length : 0)) {
        target.message = newItem.message;
      }
      if (!target.typeId && newItem.typeId) target.typeId = newItem.typeId;
      if (!target.typeText && newItem.typeText) target.typeText = newItem.typeText;
      if (!target.endTime && newItem.endTime) target.endTime = newItem.endTime;
      if (!target.location && newItem.location) target.location = newItem.location;
      if (!target.channel && newItem.channel) target.channel = newItem.channel;
      if (!target.extField && newItem.extField) target.extField = newItem.extField;
      if ((!target.starAttendees || target.starAttendees.length === 0) && (newItem.starAttendees && newItem.starAttendees.length > 0)) {
        target.starAttendees = newItem.starAttendees;
      }
    } else {
      mergedList.push({ ...newItem });
    }
  });

  youtubeScheduleItems.forEach(ytItem => {
    const ytD = parseSafeDate(ytItem.startTime);
    const ytDateStr = `${ytD.getFullYear()}-${String(ytD.getMonth() + 1).padStart(2, '0')}-${String(ytD.getDate()).padStart(2, '0')}`;
    let matchIdx = -1;
    for (let i = 0; i < mergedList.length; i++) {
      const existD = parseSafeDate(mergedList[i].startTime);
      const existDateStr = `${existD.getFullYear()}-${String(existD.getMonth() + 1).padStart(2, '0')}-${String(existD.getDate()).padStart(2, '0')}`;
      if (ytDateStr === existDateStr && areSchedulesDuplicate(mergedList[i], ytItem)) {
        matchIdx = i;
        break;
      }
    }
    if (matchIdx !== -1) {
      mergedList[matchIdx].title = pickBestTitle(mergedList[matchIdx].title, ytItem.title);
      if (!mergedList[matchIdx].url && ytItem.url) mergedList[matchIdx].url = ytItem.url;
    } else {
      mergedList.push(ytItem);
    }
  });

  await enrichSchedulesWithYouTubeOEmbed(mergedList);
  mergedList.sort((a, b) => parseSafeDate(a.startTime).getTime() - parseSafeDate(b.startTime).getTime());
  return mergedList;
}

// 스케줄 항목이 유튜브/영상 관련 일정인지 판별
function isVideoSchedule(item) {
  if (!item) return false;
  if (item.source === 'youtube' || item.typeText === '영상') return true;
  const combined = `${item.title || ""} ${item.message || ""} ${item.url || ""} ${item.link || ""}`.toLowerCase();
  return (
    /youtu\.be|youtube\.com|shorts|쇼츠|자컨|비하인드|vlog|브이로그|릴리즈|m\/v|mv|뮤비|teaser|티저|ep\.\d+/i.test(combined) ||
    /안녕하세요원이입니다|안원잘부|@helloiamwoninicetomeetyou/i.test(combined)
  );
}

// 당일 푸시 알림 발송 헬퍼 함수 (설정 시각 도달/경과 시 발송 + 남은/지난 일정 지능형 분기)
function checkDailyScheduleNotification(schedules) {
  if (!Array.isArray(schedules) || schedules.length === 0) return;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  chrome.storage.local.get(['lastScheduleNotiDate', 'userSettings'], (res) => {
    const lastNotiDate = res && res.lastScheduleNotiDate;
    if (lastNotiDate === todayStr) return; // 오늘 이미 발송함

    const notiSettings = (res && res.userSettings && res.userSettings.notifications) || {};
    if (notiSettings.enabled === false || notiSettings.schedule === false) return;

    // 1. 설정된 알림 시각 확인 (기본값 "09:00")
    const targetTimeStr = notiSettings.dailyScheduleTime || "09:00";
    const [targetHour, targetMinute] = targetTimeStr.split(':').map(val => parseInt(val, 10) || 0);
    const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetHour, targetMinute, 0);

    // 아직 설정 시각에 도달하지 않았으면 대기 (해당 시각 이후 백그라운드 주기에서 발송)
    if (now.getTime() < targetDate.getTime()) {
      return;
    }

    // 2. 오늘 날짜의 스케줄 필터링
    const todaySchedules = schedules.filter(item => {
      const d = parseSafeDate(item.startTime);
      const itemDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return itemDateStr === todayStr;
    });

    if (todaySchedules.length === 0) return;

    // 시간 순 정렬
    todaySchedules.sort((a, b) => {
      const tA = a.startTime ? parseSafeDate(a.startTime).getTime() : 0;
      const tB = b.startTime ? parseSafeDate(b.startTime).getTime() : 0;
      return tA - tB;
    });

    // 3. 남은 일정 vs 지난 일정 분리
    const nowMs = now.getTime();
    const remainingSchedules = [];
    const pastSchedules = [];

    todaySchedules.forEach(item => {
      if (item.isAllday || !item.startTime || !item.startTime.includes('T')) {
        // 종일 일정이거나 시간이 없는 일정은 하루 종일 유효하므로 남은 일정에 포함
        remainingSchedules.push(item);
      } else {
        const itemTimeMs = parseSafeDate(item.startTime).getTime();
        if (itemTimeMs < nowMs) {
          // 영상 일정 중 이미 시간이 지난 것은 유튜브 게시 이후에 등록된 일정이므로 종합 알림의 지난 일정에서 제외
          if (!isVideoSchedule(item)) {
            pastSchedules.push(item);
          }
        } else {
          remainingSchedules.push(item);
        }
      }
    });

    // 오늘 알림으로 보낼 남은 일정이나 의미 있는 지난 일정이 없으면 알림 발송 생략
    if (remainingSchedules.length === 0 && pastSchedules.length === 0) {
      chrome.storage.local.set({ lastScheduleNotiDate: todayStr });
      return;
    }

    const formatLine = (item, isPast = false) => {
      const cleanTitle = cleanDisplayTitle(item.title);
      let timePrefix = '';
      if (item.startTime && !item.isAllday && item.startTime.includes('T')) {
        const d = parseSafeDate(item.startTime);
        timePrefix = `[${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}] `;
      } else if (item.isAllday) {
        timePrefix = `[종일] `;
      }
      return `• ${timePrefix}${cleanTitle}${isPast ? ' (종료)' : ''}`;
    };

    let notificationTitle = '';
    const bodyLines = [];

    // [케이스 1] 남은 일정이 있고 지난 일정이 없는 경우 (정상 아침/낮 시간대)
    if (remainingSchedules.length > 0 && pastSchedules.length === 0) {
      notificationTitle = `📅 오늘 예정된 RESCENE 스케줄 (${remainingSchedules.length}건)`;
      remainingSchedules.slice(0, 5).forEach(item => {
        bodyLines.push(formatLine(item, false));
      });
      if (remainingSchedules.length > 5) {
        bodyLines.push(`• ...외 ${remainingSchedules.length - 5}건`);
      }
    }
    // [케이스 2] 남은 일정과 지난 일정이 둘 다 있는 경우 (중간 시간대에 켰을 때)
    else if (remainingSchedules.length > 0 && pastSchedules.length > 0) {
      const totalCount = remainingSchedules.length + pastSchedules.length;
      notificationTitle = `📅 오늘 RESCENE 스케줄 요약 (총 ${totalCount}건)`;

      bodyLines.push(`[남은 일정 ${remainingSchedules.length}건]`);
      remainingSchedules.slice(0, 3).forEach(item => {
        bodyLines.push(formatLine(item, false));
      });
      if (remainingSchedules.length > 3) {
        bodyLines.push(`• ...외 ${remainingSchedules.length - 3}건`);
      }

      bodyLines.push('');
      bodyLines.push(`[지난 일정 ${pastSchedules.length}건]`);
      pastSchedules.slice(0, 2).forEach(item => {
        bodyLines.push(formatLine(item, true));
      });
      if (pastSchedules.length > 2) {
        bodyLines.push(`• ...외 ${pastSchedules.length - 2}건`);
      }
    }
    // [케이스 3] 남은 일정은 없고 지난 일정(방송/행사 등)만 있는 경우 (밤 늦게 켰을 때)
    else if (remainingSchedules.length === 0 && pastSchedules.length > 0) {
      notificationTitle = `📅 오늘 RESCENE 스케줄 요약 (총 ${pastSchedules.length}건)`;
      bodyLines.push(`[오늘 예정되었던 일정 - 모두 종료]`);
      pastSchedules.slice(0, 3).forEach(item => {
        bodyLines.push(formatLine(item, true));
      });
      if (pastSchedules.length > 3) {
        bodyLines.push(`• ...외 ${pastSchedules.length - 3}건`);
      }
    }

    sendNotification(
      notificationTitle,
      bodyLines.join('\n'),
      'schedule',
      null,
      `sched_daily_${todayStr}`
    );
    chrome.storage.local.set({ lastScheduleNotiDate: todayStr });
  });
}

// 2단계 우선순위(이번달/다음달/전달 우선 -> 배경 백필) 스케줄 수집 및 병합 함수
async function fetchAndMergeSchedules() {
  try {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;

    // 1단계: 핵심 우선순위 월 (이번달, 다음달, 지난달, 다다음달)
    const nextM = curMonth === 12 ? 1 : curMonth + 1;
    const nextY = curMonth === 12 ? curYear + 1 : curYear;
    const prevM = curMonth === 1 ? 12 : curMonth - 1;
    const prevY = curMonth === 1 ? curYear - 1 : curYear;
    const next2M = curMonth >= 11 ? (curMonth === 11 ? 1 : 2) : curMonth + 2;
    const next2Y = curMonth >= 11 ? curYear + 1 : curYear;

    const priorityMonths = [
      { year: curYear, month: curMonth }, // 이번달
      { year: nextY, month: nextM },       // 다음달
      { year: prevY, month: prevM },       // 지난달
      { year: next2Y, month: next2M }      // 다다음달
    ];

    const priorityKeySet = new Set(priorityMonths.map(m => `${m.year}-${m.month}`));

    // [Phase 1] 핵심 4개 월 초고속 병렬 페치 (0.3초 이내 완료)
    const priorityResults = await Promise.all(
      priorityMonths.map(m => fetchMonthRawSchedules(m.year, m.month))
    );
    let allRaw = priorityResults.flat();

    // 1단계 핵심 스케줄 즉시 처리 및 1차 스토리지 저장 (0ms 즉각 노출)
    const phase1Merged = await processAndMergeScheduleList(allRaw);
    if (phase1Merged.length > 0) {
      await chrome.storage.local.set({ blipSchedules: phase1Merged });
      checkUpcomingScheduleAlerts(phase1Merged);
      checkDailyScheduleNotification(phase1Merged);
    }

    // [Phase 2] 나머지 월 백그라운드 백필 (과거 2024.01 ~ 향후 1년 뒤까지)
    const otherMonths = [];
    const startDate = new Date(2024, 0, 1);
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);

    let loopDate = new Date(startDate);
    while (loopDate <= endDate) {
      const y = loopDate.getFullYear();
      const m = loopDate.getMonth() + 1;
      if (!priorityKeySet.has(`${y}-${m}`)) {
        otherMonths.push({ year: y, month: m });
      }
      loopDate.setMonth(loopDate.getMonth() + 1);
    }

    // 4개월씩 병렬 청크로 수집하여 부하 분산 및 빠른 백필
    const CHUNK_SIZE = 4;
    for (let i = 0; i < otherMonths.length; i += CHUNK_SIZE) {
      const chunk = otherMonths.slice(i, i + CHUNK_SIZE);
      const chunkResults = await Promise.all(
        chunk.map(m => fetchMonthRawSchedules(m.year, m.month))
      );
      allRaw.push(...chunkResults.flat());
    }

    // 전체 데이터 최종 병합 및 스토리지 갱신
    const fullMerged = await processAndMergeScheduleList(allRaw);
    await chrome.storage.local.set({ blipSchedules: fullMerged });
    checkUpcomingScheduleAlerts(fullMerged);

  } catch (error) {
    console.error("스케줄 수집 및 병합 오류:", error);
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

      // 5) 비디오 ID 기준 공식/원이 채널 플래그 매핑
      if (!item.isOfficialYoutube && !item.isWoniYoutube) {
        try {
          const ytIds = await new Promise(r => chrome.storage.local.get(['latestVideos', 'woniVideos'], r));
          if (ytIds && ytIds.latestVideos && ytIds.latestVideos.some(v => v.id === vid)) {
            item.isOfficialYoutube = true;
          } else if (ytIds && ytIds.woniVideos && ytIds.woniVideos.some(v => v.id === vid)) {
            item.isWoniYoutube = true;
          }
        } catch (e) { }
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
              'schedule',
              null,
              `sched_upcoming_${id}`
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

chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.notifications.clear(notificationId);
  if (!notificationId) return;

  // 1. 유튜브 / 라이브 영상 알림인지 명확하게 판별 (yt_ 접두사, live_ 접두사, 또는 11자리 유튜브 ID)
  const isYoutube = notificationId.startsWith('yt_') ||
    notificationId.startsWith('live_') ||
    (!notificationId.startsWith('sched_') && !notificationId.includes('schedule') && /^[a-zA-Z0-9_-]{11}$/.test(notificationId));

  if (isYoutube) {
    let targetVideoId = notificationId;
    if (targetVideoId.startsWith('yt_')) targetVideoId = targetVideoId.replace('yt_', '');
    else if (targetVideoId.startsWith('live_')) targetVideoId = targetVideoId.replace('live_', '');

    // 알림 클릭 시 시청/열람 이력에 기록
    chrome.storage.local.get(['viewedVideoIds'], (res) => {
      const viewed = res.viewedVideoIds || {};
      viewed[targetVideoId] = Date.now();
      chrome.storage.local.set({ viewedVideoIds: viewed });
    });

    // URL 형태인 경우 바로 브라우저 새 탭으로 오픈
    if (targetVideoId.startsWith('http')) {
      chrome.tabs.create({ url: targetVideoId });
      return;
    }

    // 이미 열린 유튜브 탭이 있으면 해당 탭으로 전환, 없으면 새 탭 오픈
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

  // 2. 그 외 모든 알림(스케줄 종합 요약, 스케줄 임박 알림 등) 클릭 시: 사이드패널 오픈 (또는 대시보드 탭)
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

// 브라우저 탭에서 사용자가 직접 유튜브 영상을 열었을 때 실시간 감지 (추가 permission 없이 tabs 권한 활용)
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

        // 크롬 웹스토어 배포본이 아닌 로컬 개발/테스트 로드 환경인지 자동 감지
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
            // 이미지 로드 실패 시 basic 알림으로 fallback 재시도
            chrome.notifications.create(finalNotiId, {
              type: "basic",
              iconUrl: defaultLogo,
              title: displayTitle,
              message: message,
              priority: 2
            }, (fallbackId) => {
              void chrome.runtime.lastError; // lastError 소모하여 Unchecked 에러 방지
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

// =========================================================================
// 인스타그램 공식 계정(rescene_official) Web Profile Info API 직접 수집 엔진
// =========================================================================
async function fetchInstagramDirect() {
  try {
    const res = await fetch("https://www.instagram.com/api/v1/users/web_profile_info/?username=rescene_official", {
      headers: {
        "X-IG-App-ID": "936619743392459",
        "X-ASBD-ID": "129477",
        "X-IG-WWW-Claim": "0",
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "*/*",
        "Referer": "https://www.instagram.com/rescene_official/",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty"
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

    return feeds;
  } catch (err) {
    console.warn("⚠️ 인스타그램 직접 수집 지연 (Mnet 백업과 병합):", err.message);
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
          // console.log("🎵 틱톡 공식 피드 직접 수집 성공 (최신 비디오):", feeds.length);
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

    // console.log("🔍 동적 추출된 Dataset IDs:", { X: xDatasetId, INSTA: instaDatasetId });

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

    // 3️⃣ 인스타그램 피드: 직접 수집 데이터 최우선 + Mnet 백업 데이터 하이브리드 병합
    let instaFeeds = directInstaFeeds || [];
    if (instaDatasetId) {
      try {
        const instaApiUrl = `https://artist.mnetplus.world/svc/stg/rescene-official/home/api/v1/datasets/${instaDatasetId}?pageSize=10&startIndex=0&listProperties=DESCRIPTION&listProperties=LINK&listProperties=THUMBNAIL`;
        const instaRes = await fetch(instaApiUrl, fetchOptions);
        if (instaRes.ok) {
          const instaData = await instaRes.json();
          const mnetInstaItems = (instaData.items || []).map(item => ({
            id: item.typeId,
            link: item.link,
            desc: item.description || "내용 없음",
            thumb: item.thumbnails && item.thumbnails.length > 0 ? item.thumbnails[0].url : "icons/rescene-logo.png",
            profile: item.userProfile?.url || "",
            author: item.userName || "Instagram User"
          }));

          if (instaFeeds.length === 0) {
            instaFeeds = mnetInstaItems;
          } else {
            const existingShortcodes = new Set(instaFeeds.map(f => {
              const m = (f.link || '').match(/\/(?:p|reel|reels)\/([^\/?#]+)/i);
              return m ? m[1] : (f.shortcode || f.id);
            }));

            mnetInstaItems.forEach(mItem => {
              const m = (mItem.link || '').match(/\/(?:p|reel|reels)\/([^\/?#]+)/i);
              const code = m ? m[1] : mItem.id;
              if (code && !existingShortcodes.has(code)) {
                instaFeeds.push(mItem);
                existingShortcodes.add(code);
              }
            });
          }
        }
      } catch (mErr) {
        console.warn("Mnet 인스타 백업 수집 실패:", mErr);
      }
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

let lastBackgroundRefreshTime = 0;
let backgroundRefreshPromise = null;

async function executeAllBackgroundRefreshes() {
  if (backgroundRefreshPromise) {
    return backgroundRefreshPromise;
  }
  backgroundRefreshPromise = (async () => {
    try {
      await Promise.allSettled([
        fetchAllData(),
        fetchFeedsFromMnet()
      ]);
      lastBackgroundRefreshTime = Date.now();
    } finally {
      backgroundRefreshPromise = null;
    }
  })();
  return backgroundRefreshPromise;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "REFRESH_ALL_DATA" || request.action === "FORCE_REFRESH") {
    const force = request.action === "FORCE_REFRESH" || request.force === true;
    const now = Date.now();

    // 강제 새로고침이 아니고 30초 이내에 이미 조회가 수행되었으며 진행 중인 요청도 없다면 스킵
    if (!force && !backgroundRefreshPromise && (now - lastBackgroundRefreshTime < 30000)) {
      sendResponse({ success: true, skipped: true });
      return true;
    }

    executeAllBackgroundRefreshes().then(() => {
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
    chrome.storage.local.get(['blipSchedules'], (res) => {
      if (res && res.blipSchedules) {
        checkDailyScheduleNotification(res.blipSchedules);
        sendResponse({ success: true, count: res.blipSchedules.length });
      } else {
        sendResponse({ success: false, reason: "No schedules found" });
      }
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
export { sendNotification, checkUpcomingScheduleAlerts };