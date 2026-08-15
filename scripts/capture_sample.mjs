import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const projectRoot = process.cwd();
const extDir = path.join(projectRoot, 'remine-helper');
const outDir = path.join(projectRoot, 'docs/screenshots');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/sidepanel.html';
  const filePath = path.join(extDir, reqPath);

  if (!filePath.startsWith(extDir)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(8089);

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chromeProc = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9223',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  '--window-size=360,500'
]);

await new Promise(r => setTimeout(r, 1200));

const newTabRes = await fetch('http://127.0.0.1:9223/json/new', { method: 'PUT' });
const tabData = await newTabRes.json();
const ws = new WebSocket(tabData.webSocketDebuggerUrl);

await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve);
  ws.addEventListener('error', reject);
});

let msgId = 1;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    const handler = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

// 1. 실시간 유튜브 & 블립 데이터 수집
const RSS_OFFICIAL = 'https://www.youtube.com/feeds/videos.xml?channel_id=UC6zcb_lIeZq2b6_c8Q_e2_A';
const RSS_WONI = 'https://www.youtube.com/feeds/videos.xml?channel_id=UCs_f7qXm6j7d-n7M5Iq8O_w';

async function fetchRssVideos(feedUrl, channelName) {
  try {
    const res = await fetch(feedUrl);
    const xml = await res.text();
    const entries = xml.split('<entry>').slice(1);
    return entries.map(entry => {
      const idMatch = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
      const titleMatch = entry.match(/<title>(.*?)<\/title>/);
      const publishedMatch = entry.match(/<published>(.*?)<\/published>/);
      const id = idMatch ? idMatch[1] : '';
      const title = titleMatch ? titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : '';
      const publishedAt = publishedMatch ? publishedMatch[1] : '';
      return {
        id,
        videoId: id,
        title,
        publishedAt,
        channelName,
        thumbnail: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${id}`
      };
    }).filter(v => v.id);
  } catch {
    return [];
  }
}

const [latestVideos, woniVideos] = await Promise.all([
  fetchRssVideos(RSS_OFFICIAL, 'RESCENE official'),
  fetchRssVideos(RSS_WONI, '안녕하세요원이입니다잘부탁드립니다')
]);

let blipRaw = [];
try {
  const blipRes = await fetch('https://api.blip.kr/v1/artists/241/schedules?from=2026-08-01T00:00:00Z&to=2026-09-30T23:59:59Z');
  const blipData = await blipRes.json();
  blipRaw = blipData.data || [];
} catch {}

const blipFiltered = blipRaw.map(item => {
  let ch = item.channel || "";
  let loc = item.location || "";
  let ext = item.extField || "";
  const members = Array.isArray(item.members) ? item.members.map(m => ({
    id: m.memberId || m.id,
    nickname: m.name || m.nickname,
    avatarImgPath: m.profileImg || m.avatarImgPath || ''
  })) : [];

  let typeText = '일정';
  if (item.typeId === 1) typeText = '방송';
  else if (item.typeId === 2) typeText = '발매';
  else if (item.typeId === 3) typeText = '기념일';
  else if (item.typeId === 4) typeText = '행사';
  else if (item.typeId === 5) typeText = '공연';
  else if (item.typeId === 6) typeText = '기타';

  return {
    id: item.scheduleId || item.id,
    title: item.title ? item.title.trim() : "",
    startTime: item.startTime,
    endTime: item.endTime || item.startTime,
    isAllday: Boolean(item.isAllday),
    message: item.message || "",
    typeText: typeText,
    typeId: item.typeId || null,
    location: loc,
    channel: ch,
    source: 'blip',
    starAttendees: members,
    extField: ext
  };
});

const ytScheduleItems = [];
const seenYt = new Set();
[...latestVideos.map(v => ({ ...v, isOfficialYoutube: true })), ...woniVideos.map(v => ({ ...v, isWoniYoutube: true }))].forEach(v => {
  if (!v.id || seenYt.has(v.id) || v.isShorts) return;
  seenYt.add(v.id);
  const startTime = v.publishedAt || new Date().toISOString();
  ytScheduleItems.push({
    id: v.id,
    videoId: v.id,
    title: v.title,
    startTime: startTime,
    endTime: startTime,
    message: v.isWoniYoutube ? `[원이 영상] ${v.title}` : `[공식 영상] ${v.title}`,
    typeText: "영상",
    channel: v.channelName,
    source: "youtube",
    url: v.url,
    thumbnail: v.thumbnail,
    isOfficialYoutube: Boolean(v.isOfficialYoutube),
    isWoniYoutube: Boolean(v.isWoniYoutube)
  });
});

const allSchedules = [...blipFiltered, ...ytScheduleItems].sort((a, b) => {
  const tA = (a.startTime || a.date) ? new Date(a.startTime || a.date).getTime() : 0;
  const tB = (b.startTime || b.date) ? new Date(b.startTime || b.date).getTime() : 0;
  return tA - tB;
});

const PLAYLIST_ID = 'PLtgl0k04rWl_nLwz91a27eQ3K96XnO93X';
let officialPlaylistVideos = [];
try {
  const plRes = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${PLAYLIST_ID}`);
  const plXml = await plRes.text();
  const plEntries = plXml.split('<entry>').slice(1);
  officialPlaylistVideos = plEntries.map(entry => {
    const idMatch = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
    const titleMatch = entry.match(/<title>(.*?)<\/title>/);
    const id = idMatch ? idMatch[1] : '';
    const title = titleMatch ? titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : '';
    return {
      id,
      videoId: id,
      title,
      publishedAt: new Date().toISOString(),
      channelName: 'RESCENE Archive',
      thumbnail: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${id}`
    };
  }).filter(v => v.id);
} catch {}

const shimScript = `
  const store = {
    themeMode: 'light',
    userSettings: {
      sidebarPosition: 'left',
      autoRefreshInterval: 15,
      autoMuteEmbeds: false,
      visibleTabs: ['tabSchedule', 'tabInsta', 'tabX', 'tabTiktok', 'tabClip', 'tabSceneFlix'],
      enabledFanpages: ['fp_todo', 'fp_muzip', 'fp_love', 'fp_fan']
    },
    latestVideos: ${JSON.stringify(latestVideos)},
    officialPlaylistVideos: ${JSON.stringify(officialPlaylistVideos)},
    woniVideos: ${JSON.stringify(woniVideos)},
    blipSchedules: ${JSON.stringify(allSchedules)}
  };

  window.chrome = {
    storage: {
      local: {
        get: (keys, callback) => {
          let result = {};
          if (typeof keys === 'string') result[keys] = store[keys];
          else if (Array.isArray(keys)) keys.forEach(k => result[k] = store[k]);
          else if (typeof keys === 'object' && keys !== null) Object.keys(keys).forEach(k => result[k] = store[k] !== undefined ? store[k] : keys[k]);
          else result = { ...store };
          if (callback) callback(result);
          return Promise.resolve(result);
        },
        set: (items, callback) => {
          Object.assign(store, items);
          if (callback) callback();
          return Promise.resolve();
        }
      }
    },
    runtime: {
      sendMessage: (msg, callback) => {
        if (callback) callback({ status: 'ok' });
        return Promise.resolve({ status: 'ok' });
      },
      onMessage: { addListener: () => {} },
      getURL: (p) => p
    }
  };
`;
await send('Page.addScriptToEvaluateOnNewDocument', { source: shimScript });

const width = 360;
const height = 500;
const scale = 2.0;

await send('Emulation.setDeviceMetricsOverride', {
  width,
  height,
  deviceScaleFactor: scale,
  mobile: true
});

await send('Page.navigate', { url: 'http://localhost:8089/sidepanel.html' });
await new Promise(r => setTimeout(r, 2500));

await send('Runtime.evaluate', {
  expression: `
    document.documentElement.classList.remove('dark-mode');
    document.body.classList.remove('dark-mode');
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('remine_theme', 'light');
    if (typeof loadAllData === 'function') loadAllData();
  `
});
await new Promise(r => setTimeout(r, 1200));

const { data } = await send('Page.captureScreenshot', {
  format: 'png',
  clip: {
    x: 0,
    y: 0,
    width,
    height,
    scale: 1
  },
  captureBeyondViewport: false
});

const buffer = Buffer.from(data, 'base64');
fs.writeFileSync(path.join(outDir, 'sidepanel_sample_360x500.png'), buffer);
console.log('✅ sample 360x500 캡처 완료');

ws.close();
chromeProc.kill();
server.close();
