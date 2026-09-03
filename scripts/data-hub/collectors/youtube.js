// scripts/data-hub/collectors/youtube.js
// YouTube 공식 채널, 재생목록, 원이 채널, Shorts 판별 및 라이브 On-Air 실시간 감지 엔진

import { OFFICIAL_CHANNEL_ID, OFFICIAL_PLAYLIST_ID, WONI_CHANNEL_ID } from '../constants.js';

// XML 엔티티 디코딩
function decodeXml(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// 개별 영상이 쇼츠인지 정밀 판별
async function isVideoShorts(videoId, title, entryXml) {
  if (!videoId) return false;
  // 1차: 제목 또는 XML 내용 내 쇼츠 키워드/링크 검사
  if (entryXml.includes('/shorts/') || /shorts|#shorts|#Shorts|\[shorts\]|\(shorts\)|#쇼츠|#short\b/i.test(title + ' ' + entryXml)) {
    return true;
  }
  // 2차: YouTube Shorts 엔드포인트 응답 상태 검사 (쇼츠: 200 OK, 일반 영상: 303 Redirect)
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${videoId}`, {
      method: 'HEAD',
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      redirect: 'manual'
    });
    return res.status === 200;
  } catch (e) {
    return false;
  }
}

// YouTube RSS XML 파싱
async function parseYouTubeRss(xmlText, channelName = "") {
  const rawEntries = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xmlText)) !== null) {
    const entryXml = match[1];

    const idMatch = entryXml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const videoId = idMatch ? idMatch[1] : null;

    const titleMatch = entryXml.match(/<title>([^<]+)<\/title>/);
    const rawTitle = titleMatch ? titleMatch[1] : "";
    const title = decodeXml(rawTitle);

    const pubMatch = entryXml.match(/<published>([^<]+)<\/published>/);
    const publishedAt = pubMatch ? pubMatch[1] : null;
    const published = publishedAt ? publishedAt.split('T')[0] : "";

    const linkMatch = entryXml.match(/<link rel="alternate" href="(.*?)"\s*\/?>/);
    const rawUrl = linkMatch ? linkMatch[1] : `https://www.youtube.com/watch?v=${videoId}`;

    if (videoId && title) {
      rawEntries.push({
        videoId,
        title,
        publishedAt,
        published,
        rawUrl,
        entryXml
      });
    }
  }

  // 쇼츠 여부 병렬 판별
  const videos = await Promise.all(rawEntries.map(async (entry) => {
    const isShort = await isVideoShorts(entry.videoId, entry.title, entry.entryXml);
    const finalUrl = isShort ? `https://www.youtube.com/shorts/${entry.videoId}` : entry.rawUrl;

    return {
      id: entry.videoId,
      title: entry.title,
      published: entry.published,
      publishedAt: entry.publishedAt,
      url: finalUrl,
      thumbnail: `https://i.ytimg.com/vi/${entry.videoId}/hqdefault.jpg`,
      channelName: channelName,
      isShorts: isShort,
      isLive: false
    };
  }));

  return videos;
}

// RSS 피드 가져오기 (최대 2회 재시도)
async function fetchRssFeed(url, channelName = "", retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      const videos = await parseYouTubeRss(xml, channelName);
      if (videos.length > 0) return videos;
    } catch (err) {
      if (attempt === retries) {
        console.warn(`[YouTube] RSS Fetch failed after ${retries} attempts (${url}):`, err.message);
        return [];
      }
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  return [];
}

// 실시간 라이브 방송 On-Air 감지
async function checkLiveStream(channelId) {
  const urlsToTry = [
    `https://www.youtube.com/@RESCENE_official/live`,
    `https://www.youtube.com/channel/${channelId}/live`
  ];

  for (const url of urlsToTry) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cookie": "CONSENT=YES+cb.20210328-17-p0.en+FX+100; SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg"
        },
        redirect: 'follow'
      });
      if (!res.ok) continue;

      const finalUrl = res.url || "";
      const html = await res.text();

      // 라이브 판별: 리다이렉트 URL이 watch?v= 형식이거나 HTML 내 라이브 시그널 존재
      const hasWatchRedirect = finalUrl.includes('/watch?v=');
      const isLiveSignal = html.includes('"isLive":true') || 
                           html.includes('"isLiveNow":true') || 
                           html.includes('"status":"LIVE"') || 
                           html.includes('"liveStreamability"');

      if (hasWatchRedirect || isLiveSignal) {
        // 1. videoId 정밀 추출
        let videoId = null;
        if (hasWatchRedirect) {
          const vMatch = finalUrl.match(/[?&]v=([^&#]+)/);
          if (vMatch) videoId = vMatch[1];
        }
        if (!videoId) {
          const ogUrlMatch = html.match(/<meta property="og:url" content="([^"]+)"/i) || html.match(/<link rel="canonical" href="([^"]+)"/i);
          if (ogUrlMatch) {
            const vMatch = ogUrlMatch[1].match(/[?&]v=([^&#]+)/);
            if (vMatch) videoId = vMatch[1];
          }
        }
        if (!videoId) {
          const liveVideoMatch = html.match(/"liveStreamability"[\s\S]*?"videoId":"([a-zA-Z0-9_-]{11})"/);
          if (liveVideoMatch) videoId = liveVideoMatch[1];
        }

        // 2. 제목 정밀 추출
        let title = "RESCENE 실시간 라이브";
        const ogTitleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i) || html.match(/<meta name="title" content="([^"]+)"/i);
        if (ogTitleMatch) {
          title = decodeXml(ogTitleMatch[1]);
        } else {
          const titleTagMatch = html.match(/<title>(.*?)<\/title>/i);
          if (titleTagMatch) {
            title = decodeXml(titleTagMatch[1].replace(/ - YouTube$/i, '').trim());
          }
        }

        if (videoId) {
          return {
            isLive: true,
            liveInfo: {
              id: videoId,
              title: title,
              url: `https://www.youtube.com/watch?v=${videoId}`,
              thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              isShorts: false,
              isLive: true
            }
          };
        }
      }
    } catch (err) {
      console.warn(`[YouTube] Live check failed for ${url}:`, err.message);
    }
  }

  return { isLive: false, liveInfo: null };
}

// 전체 유튜브 데이터 수집 진입점
export async function collectYouTubeData() {
  console.log("▶ [YouTube] 데이터 수집 시작 (Shorts 자동 판별 포함)...");

  const officialRssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${OFFICIAL_CHANNEL_ID}`;
  const playlistRssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${OFFICIAL_PLAYLIST_ID}`;
  const woniRssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${WONI_CHANNEL_ID}`;

  const [officialVideos, playlistVideos, woniVideos, liveStatus] = await Promise.all([
    fetchRssFeed(officialRssUrl, "공식 유튜브"),
    fetchRssFeed(playlistRssUrl, "RESCENE Archive"),
    fetchRssFeed(woniRssUrl, "안녕하세요원이입니다잘부탁드립니다"),
    checkLiveStream(OFFICIAL_CHANNEL_ID)
  ]);

  const allShorts = [...officialVideos, ...playlistVideos, ...woniVideos].filter(v => v.isShorts);
  console.log(`✓ [YouTube] 완료: 공식 ${officialVideos.length}건, 재생목록 ${playlistVideos.length}건, 원이 ${woniVideos.length}건 (쇼츠 총 ${allShorts.length}건 감지), 라이브: ${liveStatus.isLive ? '🔴 ON AIR' : 'OFF'}`);

  return {
    isLive: liveStatus.isLive,
    liveInfo: liveStatus.liveInfo,
    officialVideos,
    playlistVideos,
    woniVideos
  };
}
