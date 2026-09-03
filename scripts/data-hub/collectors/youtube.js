// scripts/data-hub/collectors/youtube.js
// YouTube 공식 채널, 재생목록, 원이 채널, 라이브 On-Air 실시간 감지 엔진

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

// YouTube RSS XML 파싱
function parseYouTubeRss(xmlText) {
  const videos = [];
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

    if (videoId && title) {
      videos.push({
        id: videoId,
        title: title,
        publishedAt: publishedAt,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        isLive: false
      });
    }
  }

  return videos;
}

// RSS 피드 가져오기
async function fetchRssFeed(url) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseYouTubeRss(xml);
  } catch (err) {
    console.warn(`[YouTube] RSS Fetch failed (${url}):`, err.message);
    return [];
  }
}

// 실시간 라이브 방송 On-Air 감지
async function checkLiveStream(channelId) {
  try {
    const res = await fetch(`https://www.youtube.com/channel/${channelId}/live`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"
      },
      redirect: 'follow'
    });
    if (!res.ok) return { isLive: false, liveInfo: null };

    const html = await res.text();
    const isLiveOnAir = html.includes('"isLive":true') || html.includes('"status":"LIVE"') || html.includes('"liveStreamability"');

    if (isLiveOnAir) {
      const vidMatch = html.match(/"videoId":"([^"]+)"/) || html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([^"]+)">/);
      const titleMatch = html.match(/<meta name="title" content="([^"]+)">/) || html.match(/"title":{"runs":\[{"text":"([^"]+)"}\]/);
      const videoId = vidMatch ? vidMatch[1] : null;
      const title = titleMatch ? decodeXml(titleMatch[1]) : "RESCENE 실시간 라이브";

      if (videoId) {
        return {
          isLive: true,
          liveInfo: {
            id: videoId,
            title: title,
            thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            isLive: true
          }
        };
      }
    }

    return { isLive: false, liveInfo: null };
  } catch (err) {
    console.warn(`[YouTube] Live check failed:`, err.message);
    return { isLive: false, liveInfo: null };
  }
}

// 전체 유튜브 데이터 수집 진입점
export async function collectYouTubeData() {
  console.log("▶ [YouTube] 데이터 수집 시작...");

  const officialRssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${OFFICIAL_CHANNEL_ID}`;
  const playlistRssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${OFFICIAL_PLAYLIST_ID}`;
  const woniRssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${WONI_CHANNEL_ID}`;

  const [officialVideos, playlistVideos, woniVideos, liveStatus] = await Promise.all([
    fetchRssFeed(officialRssUrl),
    fetchRssFeed(playlistRssUrl),
    fetchRssFeed(woniRssUrl),
    checkLiveStream(OFFICIAL_CHANNEL_ID)
  ]);

  console.log(`✓ [YouTube] 완료: 공식 ${officialVideos.length}건, 재생목록 ${playlistVideos.length}건, 원이 ${woniVideos.length}건, 라이브: ${liveStatus.isLive ? '🔴 ON AIR' : 'OFF'}`);

  return {
    isLive: liveStatus.isLive,
    liveInfo: liveStatus.liveInfo,
    officialVideos,
    playlistVideos,
    woniVideos
  };
}
