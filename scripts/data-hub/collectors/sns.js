// scripts/data-hub/collectors/sns.js
// Instagram, TikTok, X (Twitter) 공식 SNS 피드 수집 및 정제 엔진

import { MNET_API_BASE } from '../constants.js';

// 1. 인스타그램 공식 직접 수집
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
        "Sec-Fetch-Dest": "empty",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const edges = json?.data?.user?.edge_owner_to_timeline_media?.edges || [];
    if (edges.length === 0) return [];

    return edges.slice(0, 12).map(edge => {
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
  } catch (err) {
    console.warn("[SNS] Instagram direct fetch failed:", err.message);
    return [];
  }
}

// 2. 틱톡 직접 수집
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
          return videoList.map(v => ({
            id: v.id,
            title: v.desc || v.title || "TikTok Video",
            link: `https://www.tiktok.com/@rescene_official/video/${v.id}`,
            cover: v.coverUrl || v.dynamicCoverUrl || v.originCoverUrl || "icons/rescene-logo.png",
            playCount: v.playCount || 0,
            author: v.authorUniqueId || "rescene_official"
          }));
        }
      }
    }
    return [];
  } catch (err) {
    console.warn("[SNS] TikTok direct fetch failed:", err.message);
    return [];
  }
}

// 3. Mnet Plus SNS 피드 수집 (X, Insta Backup)
async function fetchMnetSnsFeeds() {
  try {
    const fetchOptions = {
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://artist.mnetplus.world/main/stg/rescene-official"
      }
    };

    const indexRes = await fetch(`${MNET_API_BASE}/home/api/v1/pages/index?version=V2`, fetchOptions);
    if (!indexRes.ok) return { xFeeds: [], instaFeeds: [] };
    const indexData = await indexRes.json();

    let xDatasetId = null;
    let instaDatasetId = null;

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

    let xFeeds = [];
    if (xDatasetId) {
      const xRes = await fetch(`${MNET_API_BASE}/home/api/v1/datasets/${xDatasetId}?pageSize=24&startIndex=0&listProperties=DESCRIPTION&listProperties=LINK&listProperties=THUMBNAIL`, fetchOptions);
      if (xRes.ok) {
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
    }

    let instaFeeds = [];
    if (instaDatasetId) {
      const instaRes = await fetch(`${MNET_API_BASE}/home/api/v1/datasets/${instaDatasetId}?pageSize=24&startIndex=0&listProperties=DESCRIPTION&listProperties=LINK&listProperties=THUMBNAIL`, fetchOptions);
      if (instaRes.ok) {
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
    }

    return { xFeeds, instaFeeds };
  } catch (err) {
    console.warn("[SNS] Mnet SNS fetch failed:", err.message);
    return { xFeeds: [], instaFeeds: [] };
  }
}

// 전체 SNS 피드 수집 & 병합 진입점
export async function collectSnsData() {
  console.log("▶ [SNS] 데이터 수집 시작 (Instagram, TikTok, X)...");

  const [directInsta, directTikTok, mnetSns] = await Promise.all([
    fetchInstagramDirect(),
    fetchTikTokDirect(),
    fetchMnetSnsFeeds()
  ]);

  // 이전 피드 로드 (docs/api/v1/core.json 또는 data.json)하여 누적 아카이빙 (최대 36건 유지)
  let prevInstagram = [];
  let prevTiktok = [];
  let prevX = [];
  let seedFeeds = { x: [], instagram: [], tiktok: [] };
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const curDir = path.dirname(fileURLToPath(import.meta.url));
    const corePath = path.resolve(curDir, '../../../docs/api/v1/core.json');
    const dataPath = path.resolve(curDir, '../../../docs/api/v1/data.json');
    const targetPath = fs.existsSync(corePath) ? corePath : (fs.existsSync(dataPath) ? dataPath : null);
    if (targetPath) {
      const prev = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
      prevInstagram = prev.sns?.instagram || [];
      prevTiktok = prev.sns?.tiktok || [];
      prevX = prev.sns?.x || [];
    }

    // 과거 피드 시드 데이터 (과거 스케줄에서 마이닝한 X 122건, Insta 74건) 로드
    const seedPath = path.resolve(curDir, '../seeds/past-feeds.json');
    if (fs.existsSync(seedPath)) {
      seedFeeds = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    }
  } catch (e) {}

  function getInstaKey(item) {
    if (!item) return '';
    if (item.shortcode) return item.shortcode;
    const link = item.link || item.permalink || item.url || '';
    const m = link.match(/\/(?:p|reel|reels)\/([^\/?#]+)/i);
    if (m) return m[1];
    return String(item.id || '');
  }

  // 1. Instagram 병합 (최신 Mnet 20건 + 이전 누적분 + 과거 시드 아카이브 74건)
  let instagram = directInsta;
  if (instagram.length === 0) {
    instagram = mnetSns.instaFeeds;
  } else if (mnetSns.instaFeeds.length > 0) {
    const existingCodes = new Set(instagram.map(f => getInstaKey(f)).filter(Boolean));
    mnetSns.instaFeeds.forEach(mItem => {
      const code = getInstaKey(mItem);
      if (code && !existingCodes.has(code)) {
        instagram.push(mItem);
        existingCodes.add(code);
      }
    });
  }
  // 이전 Instagram 피드 및 과거 시드 누적 보강 (동일 게시물 완벽 중복 제거)
  const instaCodeSet = new Set(instagram.map(f => getInstaKey(f)).filter(Boolean));
  [...prevInstagram, ...(seedFeeds?.instagram || [])].forEach(pItem => {
    const code = getInstaKey(pItem);
    if (code && !instaCodeSet.has(code)) {
      instagram.push(pItem);
      instaCodeSet.add(code);
    }
  });

  // 2. TikTok 병합 (최신 10건 + 이전 누적분 + 과거 시드)
  let tiktok = [...directTikTok];
  const tiktokIdSet = new Set(tiktok.map(t => t.id));
  [...prevTiktok, ...(seedFeeds?.tiktok || [])].forEach(pItem => {
    if (pItem.id && !tiktokIdSet.has(pItem.id)) {
      tiktok.push(pItem);
      tiktokIdSet.add(pItem.id);
    }
  });

  // 3. X 병합 (최신 Mnet 20건 + 이전 누적분 + 과거 시드 아카이브 122건)
  let x = [...mnetSns.xFeeds];
  const xIdSet = new Set(x.map(item => item.id));
  [...prevX, ...(seedFeeds?.x || [])].forEach(pItem => {
    if (pItem.id && !xIdSet.has(pItem.id)) {
      x.push(pItem);
      xIdSet.add(pItem.id);
    }
  });

  // 불필요한 대형 텍스트 필드를 정제하여 경량 슬림화 (1건당 수십 바이트로 수백 건 무한 누적 가능)
  function slimFeed(f, platform) {
    if (platform === 'x') {
      return { id: f.id };
    }
    if (platform === 'instagram') {
      const link = f.link || (f.shortcode ? `https://www.instagram.com/p/${f.shortcode}/` : '') || '';
      const m = link.match(/\/(p|reel|reels)\/([^\/?#]+)/i);
      return {
        id: f.id,
        shortcode: m ? m[2] : (f.shortcode || f.id),
        type: m ? m[1].toLowerCase() : (f.type || 'p')
      };
    }
    if (platform === 'tiktok') {
      return {
        id: f.id,
        title: f.title ? String(f.title).slice(0, 50) : undefined
      };
    }
    return f;
  }

  instagram = instagram.map(f => slimFeed(f, 'instagram'));
  tiktok = tiktok.map(f => slimFeed(f, 'tiktok'));
  x = x.map(f => slimFeed(f, 'x'));

  console.log(`✓ [SNS] 완료: Instagram ${instagram.length}건, TikTok ${tiktok.length}건, X ${x.length}건 (영구 누적 보존)`);

  return {
    instagram,
    tiktok,
    x
  };
}
