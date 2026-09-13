import { chromium } from '@playwright/test';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('docs/store-assets');
const screenDir = path.resolve('docs/screenshots');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
if (!fs.existsSync(screenDir)) fs.mkdirSync(screenDir, { recursive: true });

function toBase64Url(relPath) {
  const absPath = path.resolve(relPath);
  if (!fs.existsSync(absPath)) return '';
  const buf = fs.readFileSync(absPath);
  const ext = path.extname(absPath).slice(1);
  return `data:image/${ext === 'png' ? 'png' : 'jpeg'};base64,${buf.toString('base64')}`;
}

const extIconBase64 = toBase64Url('remine-helper/icons/logo128.png');
const sideHomeBase64 = toBase64Url('docs/screenshots/sidepanel_02_dark.png');
const spotifyReelThumb = toBase64Url('docs/screenshots/spotify_reel_thumb.jpg');
const spotifyAvatar = toBase64Url('docs/screenshots/spotifykr_avatar.jpg');

// 1. 실제 데이터 로드
const coreData = JSON.parse(fs.readFileSync('docs/api/v1/core.json', 'utf8'));
const masterData = JSON.parse(fs.readFileSync('docs/api/v1/schedules.json', 'utf8'));
const realSchedules = masterData.items || coreData.schedules.activeItems;
const latestVideos = coreData.youtube.officialVideos || [];
const playlistVideos = coreData.youtube.playlistVideos || [];
const woniVideos = coreData.youtube.woniVideos || [];
const xFeeds = coreData.sns.x || [];
const instaFeeds = coreData.sns.instagram || [];
const tiktokFeeds = coreData.sns.tiktok || [];

// 실제 Spotify House Seoul 스케줄 선택
const realInstaSched = realSchedules.find(s => s.id === '6a755022aba59a5a7ffad756') ||
                       realSchedules.find(s => s.title && s.title.includes('Spotify House Seoul'));

console.log('📌 실제 Spotify House Seoul 스케줄 선택:', realInstaSched.title, `(${realInstaSched.startTime})`);

// 2. 로컬 웹서버 구동
const PORT = 8096;
const webProc = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', 'remine-helper'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));

console.log('🎨 Launching Chrome for real-data asset generation...');
const browser = await chromium.launch({ channel: 'chrome', headless: true });

// Chrome Storage Shim 주입 함수
async function setupPageWithRealData(page, theme = 'dark') {
  await page.addInitScript(({ scheds, vids, plVids, woniVids, x, insta, tiktok, themeMode }) => {
    const store = {
      themeMode: themeMode,
      userSettings: {
        sidebarPosition: 'left',
        autoRefreshInterval: 15,
        autoMuteEmbeds: false,
        visibleTabs: ['tabSchedule', 'tabInsta', 'tabX', 'tabTiktok', 'tabClip', 'tabSceneFlix'],
        enabledFanpages: ['fp_todo', 'fp_muzip', 'fp_love', 'fp_fan']
      },
      latestVideos: vids.slice(0, 10),
      officialPlaylistVideos: plVids.slice(0, 10),
      woniVideos: woniVids.slice(0, 10),
      blipSchedules: scheds,
      xFeeds: x,
      instaFeeds: insta,
      tiktokFeeds: tiktok
    };

    window.chrome = {
      storage: {
        local: {
          get: (keys, cb) => {
            let res = {};
            if (Array.isArray(keys)) keys.forEach(k => res[k] = store[k]);
            else if (typeof keys === 'string') res[keys] = store[keys];
            else res = { ...store };
            if (cb) cb(res);
            return Promise.resolve(res);
          },
          set: (items, cb) => {
            Object.assign(store, items);
            if (cb) cb();
            return Promise.resolve();
          }
        },
        onChanged: {
          addListener: () => {}
        }
      },
      runtime: {
        sendMessage: (msg, cb) => { if (cb) cb({ status: 'ok' }); return Promise.resolve({ status: 'ok' }); },
        onMessage: { addListener: () => {} }
      },
      sidePanel: { open: () => {} }
    };
  }, {
    scheds: realSchedules,
    vids: latestVideos,
    plVids: playlistVideos,
    woniVids: woniVideos,
    x: xFeeds,
    insta: instaFeeds,
    tiktok: tiktokFeeds,
    themeMode: theme
  });
}

// -------------------------------------------------------------
// A. 캡처 1: 대시보드 캘린더 (라이트 모드, 실제 일정 100% 로드)
// -------------------------------------------------------------
console.log('📸 A. 대시보드 캘린더 (라이트 모드) 촬영 중...');
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await setupPageWithRealData(page, 'light');
  await page.goto(`http://localhost:${PORT}/dashboard.html`);
  await page.waitForTimeout(1400);

  const shotPath1 = path.join(outDir, 'screenshot_01_dashboard_light_1280x800.png');
  await page.screenshot({ path: shotPath1 });
  fs.copyFileSync(shotPath1, path.join(screenDir, '01_dashboard_main.png'));
  fs.copyFileSync(shotPath1, path.join(screenDir, 'dashboard_01_light.png'));
  await page.close();
}

// -------------------------------------------------------------
// B. 캡처 2: 대시보드 스케줄 목록 (실제 일정 100% 로드)
// -------------------------------------------------------------
console.log('📸 B. 대시보드 스케줄 목록 리스트 뷰 촬영 중...');
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await setupPageWithRealData(page, 'light');
  await page.goto(`http://localhost:${PORT}/dashboard.html`);
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    const listBtn = document.getElementById('spViewListBtn');
    if (listBtn) listBtn.click();
  });
  await page.waitForTimeout(600);

  const shotPath2 = path.join(outDir, 'screenshot_02_schedule_list_1280x800.png');
  await page.screenshot({ path: shotPath2 });
  fs.copyFileSync(shotPath2, path.join(screenDir, '02_schedule_list.png'));
  fs.copyFileSync(shotPath2, path.join(screenDir, 'dashboard_03_list.png'));
  await page.close();
}

// -------------------------------------------------------------
// C. 캡처 3: 대시보드 캘린더 (다크 모드, 실제 일정 100% 로드)
// -------------------------------------------------------------
console.log('📸 C. 대시보드 캘린더 (다크 모드) 촬영 중...');
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await setupPageWithRealData(page, 'dark');
  await page.goto(`http://localhost:${PORT}/dashboard.html`);
  await page.waitForTimeout(1400);

  const shotPath3 = path.join(outDir, 'screenshot_03_dashboard_dark_1280x800.png');
  await page.screenshot({ path: shotPath3 });
  fs.copyFileSync(shotPath3, path.join(screenDir, '03_dark_mode.png'));
  fs.copyFileSync(shotPath3, path.join(screenDir, 'dashboard_02_dark.png'));
  await page.close();
}

// -------------------------------------------------------------
// D. 캡처 4: 대시보드 인스타그램 연동 일정 상세 모달 (실제 스케줄)
// -------------------------------------------------------------
console.log('📸 D. 대시보드 일정 상세 모달 (인스타그램 미디어 연동) 촬영 중...');
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await setupPageWithRealData(page, 'dark');
  await page.goto(`http://localhost:${PORT}/dashboard.html`);
  await page.waitForTimeout(1200);

  await page.evaluate(({ sched, reelThumb, avatarImg }) => {
    import('./common/modules/modals.js').then(m => {
      const d = new Date(sched.startTime);
      const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} (목)`;

      m.showScheduleModal({
        ...sched,
        date: dateStr,
        time: sched.isAllday ? '하루 종일' : '오후 6:00'
      });

      setTimeout(() => {
        const embedBody = document.getElementById('modalEmbedBodyContent');
        if (embedBody) {
          embedBody.innerHTML = `
            <div style="border-radius:12px; overflow:hidden; border:1px solid rgba(255,255,255,0.15); background:#14121e; box-shadow:0 6px 24px rgba(0,0,0,0.5);">
              <div style="display:flex; align-items:center; gap:10px; padding:10px 14px; background:rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.08);">
                <img src="${avatarImg}" style="width:28px; height:28px; border-radius:50%; object-fit:cover; border:1px solid #1ed760;">
                <div>
                  <div style="font-size:12px; font-weight:700; color:#fff; display:flex; align-items:center; gap:4px;">
                    spotifykr
                    <span style="color:#1ed760; font-size:11px;">●</span>
                  </div>
                  <div style="font-size:10px; color:#aaa;">Spotify Korea 공식 인스타그램</div>
                </div>
                <div style="margin-left:auto; font-size:11px; color:#ff75c3; font-weight:600; display:flex; align-items:center; gap:4px;">
                  Instagram 릴스 ↗
                </div>
              </div>
              <div style="width:100%; height:320px; overflow:hidden; position:relative; background:#000;">
                <img src="${reelThumb}" style="width:100%; height:100%; object-fit:cover; object-position:center;">
                <div style="position:absolute; bottom:12px; right:12px; background:rgba(0,0,0,0.65); backdrop-filter:blur(6px); padding:4px 10px; border-radius:14px; font-size:11px; color:#fff; display:flex; align-items:center; gap:4px; border:1px solid rgba(255,255,255,0.2);">
                  ▶ Reels
                </div>
              </div>
              <div style="padding:12px 14px; font-size:12px; color:#d1c8e8; line-height:1.5;">
                <div style="font-weight:700; color:#fff; margin-bottom:4px;">Spotify House Seoul 공식 안내</div>
                <b>spotifykr</b> 이렇게 귀여운 딸이 Spotify House 서울 기대해달라고 하면 기대할 수밖에 @rescene_official
              </div>
            </div>
          `;
        }
      }, 200);
    });
  }, { sched: realInstaSched, reelThumb: spotifyReelThumb, avatarImg: spotifyAvatar });

  await page.waitForTimeout(800);
  const shotPath4 = path.join(outDir, 'screenshot_04_dashboard_modal_insta_1280x800.png');
  await page.screenshot({ path: shotPath4 });
  fs.copyFileSync(shotPath4, path.join(screenDir, 'dashboard_06_insta_modal.png'));
  await page.close();
}

// -------------------------------------------------------------
// E. 캡처 5: 웹 브라우징 + 사이드패널 홈 피드 (최신 공식 영상 & 다가오는 일정)
// -------------------------------------------------------------
console.log('📸 E. 웹 브라우징 중 사이드패널 홈 피드 촬영 중...');
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Pretendard:wght@400;500;600;700&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
      body {
        width: 1280px;
        height: 800px;
        overflow: hidden;
        background: #1e1e24;
        font-family: 'Pretendard', -apple-system, sans-serif;
        display: flex;
        flex-direction: column;
      }
      .chrome-header {
        height: 72px;
        background: #2b2a33;
        display: flex;
        flex-direction: column;
        border-bottom: 1px solid #18181f;
      }
      .tab-bar {
        height: 38px;
        display: flex;
        align-items: flex-end;
        padding: 0 12px;
        gap: 6px;
      }
      .window-controls {
        display: flex;
        gap: 8px;
        padding-right: 14px;
        padding-bottom: 10px;
      }
      .win-btn { width: 12px; height: 12px; border-radius: 50%; }
      .win-close { background: #ff5f56; }
      .win-min { background: #ffbd2e; }
      .win-max { background: #27c93f; }
      .tab {
        height: 32px;
        background: #1c1b22;
        border-radius: 8px 8px 0 0;
        padding: 0 16px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #fbfbfe;
        max-width: 240px;
      }
      .tab-icon { width: 16px; height: 16px; border-radius: 4px; }
      .nav-bar {
        height: 34px;
        display: flex;
        align-items: center;
        padding: 0 12px;
        gap: 10px;
      }
      .nav-arrow { color: #8f8f9d; font-size: 14px; }
      .omnibox {
        flex: 1;
        height: 26px;
        background: #1c1b22;
        border-radius: 13px;
        display: flex;
        align-items: center;
        padding: 0 12px;
        gap: 8px;
        font-size: 12px;
        color: #cfcfd8;
      }
      .omni-lock { color: #27c93f; font-size: 11px; }
      .sidepanel-toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 0, 122, 0.2);
        border: 1px solid rgba(255, 0, 122, 0.5);
        color: #ff75c3;
        font-size: 11px;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 6px;
      }
      .viewport-area {
        flex: 1;
        display: flex;
        overflow: hidden;
      }
      .browser-main {
        flex: 1;
        background: linear-gradient(135deg, #181528 0%, #0f0c1b 100%);
        padding: 44px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        position: relative;
        overflow: hidden;
      }
      .browser-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 13px;
        color: #ff75c3;
        font-weight: 600;
        margin-bottom: 20px;
        align-self: flex-start;
      }
      .browser-heading {
        font-size: 38px;
        font-weight: 800;
        color: #ffffff;
        line-height: 1.3;
        margin-bottom: 16px;
      }
      .browser-heading span {
        color: #ff007a;
      }
      .browser-text {
        font-size: 16px;
        color: #b0a6c9;
        line-height: 1.6;
        max-width: 600px;
        margin-bottom: 28px;
      }
      .feature-callout {
        background: rgba(255, 0, 122, 0.1);
        border-left: 4px solid #ff007a;
        padding: 16px 20px;
        border-radius: 0 12px 12px 0;
        max-width: 620px;
      }
      .feature-callout-title {
        font-size: 15px;
        font-weight: 700;
        color: #ffffff;
        margin-bottom: 4px;
      }
      .feature-callout-desc {
        font-size: 13px;
        color: #d1c8e8;
        line-height: 1.5;
      }
      .sidepanel-container {
        width: 440px;
        background: #120e20;
        border-left: 1px solid #2f2b42;
        display: flex;
        flex-direction: column;
        box-shadow: -10px 0 30px rgba(0,0,0,0.5);
      }
      .sp-header {
        height: 40px;
        background: #1a152d;
        border-bottom: 1px solid #2f2b42;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        font-size: 13px;
        font-weight: 600;
        color: #e2daf0;
      }
      .sp-header-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .sp-content {
        flex: 1;
        overflow: hidden;
        position: relative;
      }
      .sp-content img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: top center;
      }
    </style>
  </head>
  <body>
    <div class="chrome-header">
      <div class="tab-bar">
        <div class="window-controls">
          <div class="win-btn win-close"></div>
          <div class="win-btn win-min"></div>
          <div class="win-btn win-max"></div>
        </div>
        <div class="tab">
          <img src="${extIconBase64}" class="tab-icon" alt="">
          <span>Remine Helper 소개 페이지</span>
        </div>
      </div>
      <div class="nav-bar">
        <span class="nav-arrow">◀ ▶ ↻</span>
        <div class="omnibox">
          <span class="omni-lock">🔒</span>
          <span>https://duckbeginner.github.io/remine-helper/</span>
        </div>
        <div class="sidepanel-toggle">
          <span>📌 사이드 패널 활성화</span>
        </div>
      </div>
    </div>

    <div class="viewport-area">
      <div class="browser-main">
        <div class="browser-badge">💡 사이드패널 홈 피드</div>
        <div class="browser-heading">
          웹 서핑 중에도 사이드패널에서<br>
          <span>최신 영상 & 다가오는 일정</span> 확인
        </div>
        <div class="browser-text">
          웹 브라우징을 하면서 브라우저 우측 창에서 리센느의 최신 공식 영상과<br>
          다가오는 방송/행사 일정을 편리하게 확인하세요.<br>
          공식 SNS 및 팬 커뮤니티로의 원클릭 바로가기도 지원합니다.
        </div>
        <div class="feature-callout">
          <div class="feature-callout-title">📱 공식 SNS & 채널 바로가기 허브</div>
          <div class="feature-callout-desc">유튜브, 인스타그램, X, 틱톡 등 공식 채널의 새로운 소식과 미디어를 사이드패널에서 빠르게 이동하며 즐길 수 있습니다.</div>
        </div>
      </div>

      <div class="sidepanel-container">
        <div class="sp-header">
          <div class="sp-header-left">
            <img src="${extIconBase64}" style="width:18px; height:18px; border-radius:4px;" alt="">
            <span>사이드 패널 | Remine Helper</span>
          </div>
          <span style="color:#a89fc0; font-size:16px;">✕</span>
        </div>
        <div class="sp-content">
          <img src="${sideHomeBase64}" alt="Sidepanel Home Feed">
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
  await page.setContent(html);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'screenshot_05_sidepanel_home_1280x800.png') });
  await page.close();
}

// -------------------------------------------------------------
// F. 작은 프로모션 타일 (440 x 280)
// -------------------------------------------------------------
console.log('🖼️ F. small_promo_440x280.png 생성 중...');
{
  const page = await browser.newPage({ viewport: { width: 440, height: 280 }, deviceScaleFactor: 1 });
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@700;800&family=Pretendard:wght@500;600;700&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
      body {
        width: 440px;
        height: 280px;
        overflow: hidden;
        background: radial-gradient(circle at 50% 15%, rgba(255, 0, 122, 0.35) 0%, transparent 65%),
                    radial-gradient(circle at 10% 85%, rgba(138, 43, 226, 0.25) 0%, transparent 50%),
                    linear-gradient(145deg, #0e0a1a 0%, #1a0b26 50%, #0d0618 100%);
        font-family: 'Pretendard', -apple-system, sans-serif;
        color: #ffffff;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        position: relative;
      }
      .glow-border {
        position: absolute;
        inset: 0;
        border: 1.5px solid rgba(255, 255, 255, 0.12);
        pointer-events: none;
      }
      .logo-box {
        width: 68px;
        height: 68px;
        border-radius: 18px;
        background: linear-gradient(135deg, rgba(255, 0, 122, 0.3) 0%, rgba(255, 117, 195, 0.15) 100%);
        border: 1.5px solid rgba(255, 255, 255, 0.25);
        box-shadow: 0 8px 24px rgba(255, 0, 122, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 12px;
      }
      .logo-box img {
        width: 50px;
        height: 50px;
        object-fit: contain;
        filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4));
      }
      .title {
        font-family: 'Outfit', sans-serif;
        font-size: 28px;
        font-weight: 800;
        letter-spacing: -0.5px;
        background: linear-gradient(135deg, #ffffff 30%, #ffc0e0 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 4px;
        filter: drop-shadow(0 2px 8px rgba(0,0,0,0.5));
      }
      .subtitle {
        font-size: 13px;
        font-weight: 600;
        color: #ff75c3;
        margin-bottom: 16px;
        letter-spacing: 0.2px;
        text-shadow: 0 1px 4px rgba(0,0,0,0.6);
      }
      .pills {
        display: flex;
        gap: 6px;
        margin-bottom: 12px;
      }
      .pill {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(8px);
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 600;
        color: #e2daf0;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .footer {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.5);
        letter-spacing: 0.5px;
      }
    </style>
  </head>
  <body>
    <div class="glow-border"></div>
    <div class="logo-box">
      <img src="${extIconBase64}" alt="Remine Helper Icon">
    </div>
    <div class="title">Remine Helper</div>
    <div class="subtitle">리센느(RESCENE) 스케줄 & 미디어 도우미</div>
    <div class="pills">
      <div class="pill">🗓️ 캘린더</div>
      <div class="pill">📱 공식 미디어</div>
      <div class="pill">🔔 실시간 알림</div>
      <div class="pill">📌 사이드패널</div>
    </div>
    <div class="footer">사이드패널 & 대시보드 뷰 지원 • v1.0.4</div>
  </body>
  </html>
  `;
  await page.setContent(html);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'small_promo_440x280.png') });
  await page.close();
}

// -------------------------------------------------------------
// G. 마키 프로모션 타일 (1400 x 560, 실제 캘린더 & 사이드패널 반영)
// -------------------------------------------------------------
console.log('🖼️ G. marquee_promo_1400x560.png 생성 중...');
{
  const realDashLightBase64 = toBase64Url('docs/store-assets/screenshot_01_dashboard_light_1280x800.png');
  const page = await browser.newPage({ viewport: { width: 1400, height: 560 }, deviceScaleFactor: 1 });
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@700;800;900&family=Pretendard:wght@400;500;600;700;800&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
      body {
        width: 1400px;
        height: 560px;
        overflow: hidden;
        background: radial-gradient(circle at 75% 35%, rgba(255, 0, 122, 0.28) 0%, transparent 55%),
                    radial-gradient(circle at 25% 75%, rgba(138, 43, 226, 0.25) 0%, transparent 50%),
                    linear-gradient(135deg, #0b0716 0%, #150924 50%, #0d0618 100%);
        font-family: 'Pretendard', -apple-system, sans-serif;
        color: #ffffff;
        display: flex;
        align-items: center;
        position: relative;
        padding: 0 80px;
      }
      .border-line {
        position: absolute;
        inset: 0;
        border: 2px solid rgba(255, 255, 255, 0.08);
        pointer-events: none;
      }
      .left-col {
        width: 620px;
        display: flex;
        flex-direction: column;
        z-index: 2;
      }
      .badge-pill {
        align-self: flex-start;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 0, 122, 0.15);
        border: 1px solid rgba(255, 0, 122, 0.4);
        padding: 6px 14px;
        border-radius: 30px;
        font-size: 13px;
        font-weight: 700;
        color: #ff75c3;
        margin-bottom: 20px;
        letter-spacing: 0.5px;
      }
      .hero-title {
        font-family: 'Outfit', 'Pretendard', sans-serif;
        font-size: 50px;
        font-weight: 900;
        line-height: 1.18;
        letter-spacing: -1px;
        margin-bottom: 16px;
      }
      .hero-title span {
        background: linear-gradient(135deg, #ff007a 0%, #ff75c3 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .hero-desc {
        font-size: 17px;
        line-height: 1.6;
        color: #c8bee0;
        margin-bottom: 26px;
      }
      .features-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 28px;
      }
      .feat-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 600;
        color: #ede7f6;
        background: rgba(255, 255, 255, 0.05);
        padding: 8px 12px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .meta-footer {
        font-size: 13px;
        color: #9287af;
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .meta-tag {
        background: rgba(255, 255, 255, 0.08);
        padding: 3px 10px;
        border-radius: 6px;
        color: #ffffff;
        font-weight: 600;
      }
      .right-col {
        position: absolute;
        right: 40px;
        width: 660px;
        height: 480px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .back-mockup {
        position: absolute;
        right: 180px;
        top: 40px;
        width: 440px;
        height: 290px;
        border-radius: 14px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.15);
        box-shadow: 0 20px 50px rgba(0,0,0,0.7);
        transform: perspective(1000px) rotateY(-8deg) rotateX(4deg);
        filter: brightness(0.9);
      }
      .back-mockup img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .front-mockup {
        position: absolute;
        right: 40px;
        top: 25px;
        width: 270px;
        height: 440px;
        border-radius: 18px;
        overflow: hidden;
        border: 1.5px solid rgba(255, 0, 122, 0.4);
        box-shadow: 0 24px 60px rgba(0,0,0,0.85), 0 0 40px rgba(255, 0, 122, 0.3);
        transform: perspective(1000px) rotateY(-5deg);
        background: #141124;
      }
      .front-mockup img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .floating-tag {
        position: absolute;
        right: 230px;
        bottom: 70px;
        background: linear-gradient(135deg, #ff007a, #ff1493);
        color: white;
        font-size: 13px;
        font-weight: 700;
        padding: 8px 16px;
        border-radius: 20px;
        box-shadow: 0 8px 20px rgba(255, 0, 122, 0.6);
        display: flex;
        align-items: center;
        gap: 6px;
        z-index: 10;
      }
    </style>
  </head>
  <body>
    <div class="border-line"></div>
    <div class="left-col">
      <div class="badge-pill">
        <img src="${extIconBase64}" style="width:16px; height:16px; border-radius:4px; vertical-align:middle;">
        <span style="font-weight:700;">Remine Helper</span>
        <span>•</span>
        <span>리센느 스케줄 & 미디어 도우미 • v1.0.4</span>
      </div>
      <div class="hero-title">
        <span>Remine Helper</span><br>
        리센느 스케줄 & 미디어 도우미
      </div>
      <div class="hero-desc">
        공식 스케줄 캘린더부터 유튜브, SNS 최신 미디어까지<br>
        웹 서핑 중에도 사이드패널에서 한눈에 바로 확인하세요.
      </div>
      <div class="features-grid">
        <div class="feat-item">🗓️ 공식 스케줄 캘린더 & 안내</div>
        <div class="feat-item">📱 공식 SNS & 미디어 바로보기</div>
        <div class="feat-item">🔴 실시간 라이브 감지 & 알림</div>
        <div class="feat-item">📌 사이드패널 & 대시보드 뷰</div>
      </div>
      <div class="meta-footer">
        <span class="meta-tag">Chrome & Firefox</span>
        <span>다크/라이트 모드 지원</span>
        <span>•</span>
        <span>팬메이드 편의 확장 프로그램</span>
      </div>
    </div>

    <div class="right-col">
      <div class="back-mockup">
        <img src="${realDashLightBase64}" alt="Real Dashboard Calendar">
      </div>
      <div class="front-mockup">
        <img src="${sideHomeBase64}" alt="Sidepanel Home Feed">
      </div>
      <div class="floating-tag">
        <span>📱 공식 SNS & 미디어 바로보기</span>
      </div>
    </div>
  </body>
  </html>
  `;
  await page.setContent(html);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'marquee_promo_1400x560.png') });
  await page.close();
}

await browser.close();
webProc.kill();
console.log('🎉 모든 100% 실제 데이터 기반 스토어 에셋 재생성 완료!');
