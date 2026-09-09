// common/modules/modals.js - 설정 모달, 스케줄 상세 모달, 미디어 파서
import { DEFAULT_USER_SETTINGS, FANPAGE_LIST, TAB_CONFIG_LIST, CHANNEL_DATA_MAP } from '../../constants.js';
import { escapeHtml, createScheduleModalHTML, createSettingsModalHTML } from '../templates.js';
import { getChannelIconHTML } from './calendar.js';
import { initNavPosition, enableIframeScrollGuard, stopAllIframeMedia } from './tabs.js';
import { getMemberDisplayName, getMemberAvatarUrl } from './storage.js';
import { setupIframeAutoHeight } from './sns-embeds.js';

export function decodeHtmlEntities(str) {
  if (!str) return '';
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}

export function linkifyMessage(text) {
  if (!text) return '';
  // 1. 기존 엔티티(&lt;, &gt;, &amp;) 디코딩
  const rawText = decodeHtmlEntities(text);
  // 2. 안전하게 다시 escape
  let safeText = escapeHtml(rawText);

  // 3. 스케줄 본문에 포함된 다양한 이모지들을 모던 심플 SVG 아이콘으로 치환
  const svgIcons = {
    link: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block; color:var(--primary-color, #ff007a);"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`,
    twitter: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
    news: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>`,
    notice: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>`,
    video: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`,
    tv: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>`,
    radio: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><circle cx="16" cy="14" r="3"/><path d="M4 18h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2Z"/><path d="M7 12v-2"/><path d="m17 4-5 2"/></svg>`,
    camera: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`,
    calendar: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
    clock: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    pin: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
    music: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`,
    sparkle: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`,
    birthday: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/></svg>`,
    mail: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block;"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
    arrow: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1.5px; margin-right:3px; display:inline-block;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="19 12 12 19 19 12 12 5"></polyline></svg>`
  };

  // 손가락/화살표/재생/링크 이모지와 '보러 가기' / '보러가기' / '바로 가기' / '바로가기' 패턴을 '관련 링크'로 통일 치환
  safeText = safeText.replace(/(?:(?:[👉👇👈👆🔗📎]|▶️)+\s*)?(?:[가-힣a-zA-Z0-9\s]*?)?(?:보러\s*가기|바로\s*가기)/gu, `${svgIcons.link} 관련 링크`);
  // 손가락/화살표/재생 이모지 바로 뒤에 링크가 오는 경우 링크 아이콘으로 치환
  safeText = safeText.replace(/(?:👉|👇|👈|👆|👉🏻|👉🏼|👉🏽|👉🏾|👉🏿|👇🏻|👇🏼|👇🏽|👇🏾|👇🏿|➡️|▶️?)\s*(?=https?:\/\/)/g, `${svgIcons.link} `);
  // 남은 단독 링크 이모지 치환 (🔗, 📎)
  safeText = safeText.replace(/🔗|📎/g, svgIcons.link);
  // 트위터 / 소셜
  safeText = safeText.replace(/\[🐦\]|🐦/g, svgIcons.twitter);
  // 기사 / 뉴스
  safeText = safeText.replace(/\[📰\]|📰/g, svgIcons.news);
  // 공지 / 확성기
  safeText = safeText.replace(/\[📢\]|📢|📣/g, svgIcons.notice);
  // 영상 / 필름
  safeText = safeText.replace(/\[🎬\]|🎬|▶️|🎥/g, svgIcons.video);
  // TV / 방송
  safeText = safeText.replace(/\[📺\]|📺/g, svgIcons.tv);
  // 라디오
  safeText = safeText.replace(/\[📻\]|📻/g, svgIcons.radio);
  // 사진 / 카메라
  safeText = safeText.replace(/\[📸\]|📸|📷/g, svgIcons.camera);
  // 달력 / 일정
  safeText = safeText.replace(/\[📅\]|📅|📆|🗓️?/g, svgIcons.calendar);
  // 시계 / 알림
  safeText = safeText.replace(/\[⏰\]|⏰|⏱️|⏳/g, svgIcons.clock);
  // 핀 / 장소
  safeText = safeText.replace(/\[📍\]|📍|🗺️/g, svgIcons.pin);
  // 음악 / 음원
  safeText = safeText.replace(/\[🎵\]|\[🎶\]|🎵|🎶|🎧/g, svgIcons.music);
  // 반짝임 / 스파클
  safeText = safeText.replace(/\[✨\]|✨|🌟|💫/g, svgIcons.sparkle);
  // 생일 / 파티
  safeText = safeText.replace(/\[🎂\]|🎂|🎉|🥳/g, svgIcons.birthday);
  // 편지 / 메일
  safeText = safeText.replace(/\[💌\]|💌|✉️/g, svgIcons.mail);
  // 기타 일반 화살표
  safeText = safeText.replace(/👉|👉🏻|👉🏼|👉🏽|👉🏾|👉🏿|➡️/g, svgIcons.arrow);

  // 4. 개별 URL 링크화 (링크 바로 앞에 별도의 아이콘이 없는 경우 링크 열기 아이콘 자동 추가)
  const openLinkIcon = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1.5px; margin-right:3px; display:inline-block; flex-shrink:0;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;

  safeText = safeText.replace(/((?:<svg[^>]*>[\s\S]*?<\/svg>\s*)?)(https?:\/\/[^\s<]+)/g, (match, prefix, url) => {
    if (prefix && prefix.trim().length > 0) {
      return `${prefix}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    } else {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; word-break:break-all;">${openLinkIcon}<span>${url}</span></a>`;
    }
  });

  // 5. 줄바꿈 처리 (\n -> <br>)
  safeText = safeText.replace(/\r?\n/g, '<br>');

  return safeText;
}

export function parseMediaEmbeds(sources = [], isDark = false) {
  const allText = sources.filter(Boolean).join(' ');
  if (!allText) return '';

  const themeStr = isDark ? 'dark' : 'light';
  const embedHtmls = [];
  const processedUrls = new Set();

  // 1. YouTube (watch, youtu.be, shorts) - 크롬 확장프로그램 iframe JS 차단 회피 및 원클릭 스마트 플레이어
  const ytRegex = /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
  let ytMatch;
  while ((ytMatch = ytRegex.exec(allText)) !== null) {
    const videoId = ytMatch[1];
    if (!processedUrls.has(videoId)) {
      processedUrls.add(videoId);
      embedHtmls.push(`
        <div class="youtube-preview-card" data-video-id="${videoId}" style="margin-bottom: 12px; border-radius: 12px; overflow: hidden; aspect-ratio: 16/9; position: relative; cursor: pointer; background: #000; box-shadow: 0 4px 16px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15);">
          <img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.35s ease;" alt="YouTube Thumbnail" loading="lazy">
          <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.5) 100%); display: flex; flex-direction: column; justify-content: space-between; padding: 12px; box-sizing: border-box;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="background: #ff0000; color: #fff; font-size: 10.5px; font-weight: bold; padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 2px 6px rgba(255,0,0,0.4);">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                YouTube
              </span>
              <span style="color: rgba(255,255,255,0.9); font-size: 11px; font-weight: 500; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">영상 바로보기 ↗</span>
            </div>
            <div style="align-self: center;">
              <div class="yt-play-btn" style="width: 50px; height: 50px; background: rgba(255,0,0,0.95); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 18px rgba(255,0,0,0.55); transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s ease;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white" style="margin-left: 3px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              </div>
            </div>
            <div style="color: #fff; font-size: 11.5px; font-weight: 600; text-shadow: 0 1px 4px rgba(0,0,0,0.9); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              클릭하여 YouTube에서 최고화질로 감상하기
            </div>
          </div>
        </div>
      `);
    }
  }

  // 2. Instagram (p, reel, tv 등 계정명 포함 URL 지원)
  const instaRegex = /https?:\/\/(?:www\.)?instagram\.com\/(?:[a-zA-Z0-9_.]+\/)?(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/g;
  let instaMatch;
  while ((instaMatch = instaRegex.exec(allText)) !== null) {
    const postId = instaMatch[1];
    if (!processedUrls.has(postId)) {
      processedUrls.add(postId);
      embedHtmls.push(`
        <div class="modal-embed-card" style="margin-bottom: 10px; border-radius: 10px; overflow: hidden; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15);">
          <iframe credentialless src="https://www.instagram.com/p/${postId}/embed/captioned/?theme=${themeStr}" style="width: 100%; height: 500px; min-height: 380px; border: none; transition: height 0.25s ease;" scrolling="no" frameborder="0"></iframe>
        </div>
      `);
    }
  }

  // 3. X (Twitter)
  const xRegex = /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/([0-9]+)/g;
  let xMatch;
  while ((xMatch = xRegex.exec(allText)) !== null) {
    const tweetId = xMatch[1];
    if (!processedUrls.has(tweetId)) {
      processedUrls.add(tweetId);
      embedHtmls.push(`
        <div class="modal-embed-card" style="margin-bottom: 10px; border-radius: 10px; overflow: hidden;">
          <iframe credentialless src="https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=${themeStr}" style="width: 100%; height: 260px; border: none;" scrolling="no" frameborder="0"></iframe>
        </div>
      `);
    }
  }

  // 4. TikTok (일반 영상)
  const ttRegex = /https?:\/\/(?:www\.)?tiktok\.com\/@[a-zA-Z0-9_.]+\/video\/([0-9]+)/g;
  let ttMatch;
  while ((ttMatch = ttRegex.exec(allText)) !== null) {
    const videoId = ttMatch[1];
    if (!processedUrls.has(videoId)) {
      processedUrls.add(videoId);
      embedHtmls.push(`
        <div class="modal-embed-card" style="margin-bottom: 10px; border-radius: 10px; overflow: hidden;">
          <iframe credentialless src="https://www.tiktok.com/embed/v2/${videoId}" style="width: 100%; height: 460px; border: none;" scrolling="no" frameborder="0"></iframe>
        </div>
      `);
    }
  }

  // 5. TikTok 단축 URL (vt.tiktok.com)
  const vtTtRegex = /https?:\/\/vt\.tiktok\.com\/([a-zA-Z0-9_-]+)/g;
  let vtMatch;
  while ((vtMatch = vtTtRegex.exec(allText)) !== null) {
    const shortCode = vtMatch[1];
    const fullUrl = `https://vt.tiktok.com/${shortCode}/`;
    if (!processedUrls.has(fullUrl)) {
      processedUrls.add(fullUrl);
      embedHtmls.push(`
        <div class="tiktok-short-preview-card" data-url="${fullUrl}">
          <div class="tiktok-card-left">
            <div class="tiktok-icon-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#fe2c55"><path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.068-.102a2.895 2.895 0 0 1 2.37-4.498c.312 0 .614.05.897.143V9.41a6.34 6.34 0 0 0-.897-.064 6.341 6.341 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34c3.483 0 6.315-2.81 6.34-6.287V9.32a8.217 8.217 0 0 0 4.764 1.517V7.392a4.814 4.814 0 0 1-.99-.706z"/></svg>
            </div>
            <div class="tiktok-card-info">
              <div class="tiktok-card-title">TikTok 숏폼 영상</div>
              <div class="tiktok-card-desc">클릭하여 틱톡에서 바로 감상하기</div>
            </div>
          </div>
          <div class="tiktok-card-btn">
            보러가기 ↗
          </div>
        </div>
      `);
    }
  }

  if (embedHtmls.length === 0) return '';
  return embedHtmls.join('');
}

export function showScheduleModal(scheduleData) {
  let overlay = document.getElementById('scheduleModalOverlay');
  let bodyContent = document.getElementById('modalBodyContent');

  if (!overlay || !bodyContent) {
    const modalMount = document.getElementById('modalMount') || document.body;
    modalMount.insertAdjacentHTML('beforeend', createScheduleModalHTML());
    initScheduleModal();
    overlay = document.getElementById('scheduleModalOverlay');
    bodyContent = document.getElementById('modalBodyContent');
    if (!overlay || !bodyContent) return;
  }

  const modalTitle = document.getElementById('modalTitle');
  const embedCard = document.getElementById('modalEmbedCard');
  const embedBody = document.getElementById('modalEmbedBodyContent');

  if (modalTitle) {
    const rawTitle = decodeHtmlEntities(scheduleData.title || '스케줄 상세 정보');
    const chIcon = scheduleData.channelIconHtml || getChannelIconHTML(scheduleData);
    modalTitle.innerHTML = `${chIcon}<span>${escapeHtml(rawTitle)}</span>`;
  }

  const isDark = document.body.classList.contains('dark-mode');

  let html = '';
  if (scheduleData.date) {
    const timeStr = scheduleData.time ? ` ${scheduleData.time}` : '';
    html += `<span class="detail-time"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>일시: ${escapeHtml(scheduleData.date)}${escapeHtml(timeStr)}</span>`;
  }

  const ext = scheduleData.extField;
  const location = scheduleData.location || (ext && ext.key === '장소' ? ext.value : (scheduleData.place || scheduleData.venue));
  const channel = scheduleData.channel || (ext && (ext.key === '채널' || ext.key === '방송사') ? ext.value : null);

  if (location && String(location).trim()) {
    html += `<span class="detail-time"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>장소: ${escapeHtml(String(location).trim())}</span>`;
  }
  if (channel && String(channel).trim()) {
    html += `<span class="detail-time"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:4px;"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>채널: ${escapeHtml(String(channel).trim())}</span>`;
  }
  if (ext && ext.key && ext.value && ext.key !== '장소' && ext.key !== '채널' && ext.key !== '방송사') {
    html += `<span class="detail-time"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:4px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>${escapeHtml(ext.key)}: ${escapeHtml(String(ext.value).trim())}</span>`;
  }

  // Mnet / Blip 참석 멤버 정보 렌더링 (동일 멤버는 항상 동일한 대표 프로필 아이콘 및 활동명 렌더링)
  const attendees = scheduleData.starAttendees || scheduleData.members || [];
  if (Array.isArray(attendees) && attendees.length > 0) {
    const attendeesHtml = attendees.map(a => {
      const realName = getMemberDisplayName(a.nickname || a.name);
      const avatarUrl = getMemberAvatarUrl(realName, a.avatarImgPath || a.profileImg);
      const avatar = avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" style="width:16px; height:16px; border-radius:50%; object-fit:cover; vertical-align:-2px; margin-right:4px; border:1px solid rgba(255,105,180,0.4);" alt="${escapeHtml(realName)}">` : '';
      const rawNick = a.nickname || a.name || '';
      const isCustomNick = rawNick && rawNick !== realName;
      const nickTitle = isCustomNick ? ` title="닉네임: ${escapeHtml(rawNick)}"` : '';
      return `<span style="display:inline-flex; align-items:center; background:rgba(255,105,180,0.1); border:1px solid rgba(255,105,180,0.25); border-radius:12px; padding:1px 7px; font-size:11px; font-weight:600; color:#d63384; margin:1px 2px;"${nickTitle}>${avatar}${escapeHtml(realName)}</span>`;
    }).join(' ');
    html += `<div style="display:flex; flex-wrap:wrap; align-items:center; margin:3px 0;"><span class="detail-time" style="display:inline-flex; align-items:center; margin:0; margin-right:4px; flex-shrink:0; border-bottom:none !important; padding-bottom:0 !important;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:4px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>참석 멤버:</span><div style="display:inline-flex; flex-wrap:wrap; align-items:center; gap:2px;">${attendeesHtml}</div></div>`;
  }

  let hasRenderedLinkInBody = false;
  if (scheduleData.detail || scheduleData.description) {
    const detailContent = linkifyMessage(scheduleData.detail || scheduleData.description);
    if (detailContent.includes('<a href=')) {
      hasRenderedLinkInBody = true;
    }
    html += `<div style="margin-top: 8px;">${detailContent}</div>`;
  }

  // 본문에 이미 링크가 렌더링되었거나 공식 유튜브 항목인 경우 하단 중복 링크 버튼 생략
  if (!hasRenderedLinkInBody && scheduleData.source !== 'youtube' && (scheduleData.link || scheduleData.url)) {
    const link = scheduleData.link || scheduleData.url;
    html += `<p style="margin-top: 10px;"><a href="${link}" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; gap:4px; font-weight:600;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; flex-shrink:0;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg><span>관련 링크 바로가기</span> <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-left:1px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a></p>`;
  }

  bodyContent.innerHTML = html;

  // 유튜브, 인스타, X, 틱톡 미디어 링크 자동 추출 및 세컨더리 카드 렌더링
  let mediaSources = [];
  if (scheduleData.source === 'youtube') {
    // 공식 유튜브 영상 항목인 경우 해당 유튜브 링크만 정확하게 미디어 카드로 렌더링
    mediaSources = [scheduleData.url, scheduleData.link].filter(Boolean);
  } else {
    // 일반 스케줄인 경우 상세 본문 및 링크에서 미디어 추출
    mediaSources = [
      scheduleData.detail,
      scheduleData.description,
      scheduleData.link,
      scheduleData.url,
      ...(scheduleData.resolvedMediaUrls || [])
    ].filter(Boolean);
  }

  let embedsHtml = parseMediaEmbeds(mediaSources, isDark);

  function applyEmbeds(htmlContent) {
    if (!embedCard || !embedBody) return;
    if (htmlContent) {
      embedBody.innerHTML = htmlContent;
      embedCard.style.display = 'flex';
      embedCard.style.flexDirection = 'column';

      // 유튜브 프리뷰 카드 클릭 이벤트
      embedBody.querySelectorAll('.youtube-preview-card').forEach(card => {
        card.addEventListener('click', () => {
          const videoId = card.getAttribute('data-video-id');
          if (videoId) {
            const url = `https://www.youtube.com/watch?v=${videoId}`;
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
              chrome.tabs.create({ url });
            } else {
              window.open(url, '_blank');
            }
          }
        });
      });

      // 틱톡 숏폼 카드 클릭 이벤트
      embedBody.querySelectorAll('.tiktok-short-preview-card').forEach(card => {
        card.addEventListener('click', () => {
          const url = card.getAttribute('data-url');
          if (url) {
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
              chrome.tabs.create({ url });
            } else {
              window.open(url, '_blank');
            }
          }
        });
      });

      // 모달 내부 iframe 휠 스크롤 인터랙션 가드 활성화
      enableIframeScrollGuard(embedBody);
    } else {
      embedBody.innerHTML = '';
      embedCard.style.display = 'none';
    }
  }

  applyEmbeds(embedsHtml);
  overlay.style.display = 'flex';
}

export function initScheduleModal() {
  const overlay = document.getElementById('scheduleModalOverlay');
  const closeBtn = document.getElementById('modalCloseBtn');

  function closeModal() {
    if (!overlay) return;
    overlay.style.display = 'none';
    stopAllIframeMedia(overlay);
    const embedBody = document.getElementById('embedBodyContent');
    const embedCard = document.getElementById('modalEmbedCard');
    if (embedBody) embedBody.innerHTML = '';
    if (embedCard) embedCard.style.display = 'none';
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      // 모달 카드 및 추가 미디어 카드 바깥의 모든 빈 영역 클릭 시 닫기
      if (!e.target.closest('.schedule-modal-card') && !e.target.closest('.schedule-embed-card')) {
        closeModal();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });

  // iframe 자동 높이 조절 엔진 활성화
  setupIframeAutoHeight();
}

/* =========================================================================
   9. 인스타 & X 공식 위젯 자동 높이 조절 (postMessage Auto-Height Engine)
   ========================================================================= */

export function parseUserSettings(savedSettings) {
  const baseTabMap = {};
  TAB_CONFIG_LIST.forEach(t => { baseTabMap[t.id] = t; });

  if (!savedSettings || typeof savedSettings !== 'object') {
    return JSON.parse(JSON.stringify(DEFAULT_USER_SETTINGS));
  }

  let mergedTabs = [];
  if (Array.isArray(savedSettings.tabList) && savedSettings.tabList.length > 0) {
    savedSettings.tabList.forEach(savedTab => {
      const baseTab = baseTabMap[savedTab.id];
      if (baseTab) {
        mergedTabs.push({
          ...savedTab,
          ...baseTab,
          enabled: savedTab.enabled !== false
        });
      }
    });
    TAB_CONFIG_LIST.forEach(baseTab => {
      if (!mergedTabs.some(t => t.id === baseTab.id)) {
        mergedTabs.push({ ...baseTab, enabled: baseTab.enabled !== false });
      }
    });
  } else {
    mergedTabs = JSON.parse(JSON.stringify(DEFAULT_USER_SETTINGS.tabList));
  }

  // 팬페이지 스마트 마이그레이션:
  // 1. 기존 사용자가 설정한 fanpages 목록 온전히 보존
  // 2. 기본값(FANPAGE_LIST)에 새롭게 추가된 항목 중, 아직 없고 사용자가 삭제(dismissed)한 적도 없는 항목은 목록 끝에 1회 자동 추가
  const dismissedFanpages = Array.isArray(savedSettings.dismissedFanpages) ? [...savedSettings.dismissedFanpages] : [];
  let mergedFanpages = [];

  if (Array.isArray(savedSettings.fanpages) && savedSettings.fanpages.length > 0) {
    mergedFanpages = [...savedSettings.fanpages];
    FANPAGE_LIST.forEach(baseFp => {
      const exists = mergedFanpages.some(fp => fp.id === baseFp.id || (fp.url && baseFp.url && fp.url.replace(/\/$/, '') === baseFp.url.replace(/\/$/, '')));
      const isDismissed = dismissedFanpages.includes(baseFp.id);
      if (!exists && !isDismissed) {
        mergedFanpages.push({ ...baseFp });
      }
    });
  } else {
    mergedFanpages = JSON.parse(JSON.stringify(DEFAULT_USER_SETTINGS.fanpages));
  }

  return {
    navPosition: savedSettings.navPosition || DEFAULT_USER_SETTINGS.navPosition,
    refreshInterval: savedSettings.refreshInterval || DEFAULT_USER_SETTINGS.refreshInterval,
    notifications: { ...DEFAULT_USER_SETTINGS.notifications, ...savedSettings.notifications },
    sound: { ...DEFAULT_USER_SETTINGS.sound, ...savedSettings.sound },
    tabList: mergedTabs,
    fanpages: mergedFanpages,
    dismissedFanpages: dismissedFanpages
  };
}

// 1. 사용자 설정 로드 (기본값 및 원본 메타데이터 안전 병합)
export function loadUserSettings(callback) {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['userSettings'], (res) => {
      const settings = parseUserSettings(res.userSettings);
      try {
        localStorage.setItem('userSettings', JSON.stringify(settings));
      } catch (e) { }
      if (typeof callback === 'function') callback(settings);
    });
  } else {
    if (typeof callback === 'function') callback(JSON.parse(JSON.stringify(DEFAULT_USER_SETTINGS)));
  }
}

// 2. 사용자 설정 저장
export function saveUserSettings(newSettings, callback) {
  try {
    localStorage.setItem('userSettings', JSON.stringify(newSettings));
  } catch (e) { }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ userSettings: newSettings }, () => {
      if (typeof callback === 'function') callback(newSettings);
    });
  } else {
    if (typeof callback === 'function') callback(newSettings);
  }
}

// 3. 네비게이션 위치 적용 (좌측 vs 우측)

export function openSettingsModal() {
  let currentOverlay = document.getElementById('settingsModalOverlay');
  if (!currentOverlay) {
    const modalMount = document.getElementById('modalMount') || document.body;
    modalMount.insertAdjacentHTML('beforeend', createSettingsModalHTML());
    initSettingsModal();
    currentOverlay = document.getElementById('settingsModalOverlay');
    if (!currentOverlay) return;
  }
  const openBtn = document.getElementById('openSettingsBtn');
  if (openBtn) {
    openBtn.click();
  } else {
    loadUserSettings(() => {
      currentOverlay.classList.add('active');
    });
  }
}

export function closeSettingsModal() {
  const currentOverlay = document.getElementById('settingsModalOverlay');
  if (currentOverlay) currentOverlay.classList.remove('active');
}

// 4. 설정 모달 및 인터랙션 전체 초기화
export function initSettingsModal({ onTabsChanged, onFanpagesChanged, onNavPositionChanged } = {}) {
  const modalOverlay = document.getElementById('settingsModalOverlay');
  const saveNotice = document.getElementById('settingsSaveNotice');
  const resetBtn = document.getElementById('resetSettingsBtn');

  if (!modalOverlay) return;

  let currentSettings = JSON.parse(JSON.stringify(DEFAULT_USER_SETTINGS));

  function showSaveNotice(msg = '저장되었습니다.') {
    if (saveNotice) {
      const text = (typeof msg === 'string' && msg.trim()) ? msg : '저장되었습니다.';
      saveNotice.textContent = text;
      saveNotice.classList.add('visible');
      setTimeout(() => saveNotice.classList.remove('visible'), 2000);
    }
  }

  // 모달 열릴 때 폼 채우기
  function openModal() {
    loadUserSettings((loaded) => {
      currentSettings = loaded;
      populateSettingsForm(currentSettings);
      modalOverlay.classList.add('active');
    });
  }

  function closeModal() {
    modalOverlay.classList.remove('active');
  }

  // 전역 이벤트 위임 (어떤 #openSettingsBtn이든 항상 열림 보장)
  if (!window.__settingsDelegationInitialized) {
    window.__settingsDelegationInitialized = true;
    document.addEventListener('click', (e) => {
      if (e.target.closest('#openSettingsBtn')) {
        openModal();
      } else if (e.target.closest('#settingsCloseBtn') || e.target.closest('#saveSettingsDoneBtn')) {
        closeModal();
      } else if (e.target.id === 'settingsModalOverlay') {
        closeModal();
      }
    });
  }

  // 서브 탭 전환 (모달 내부 클릭 위임)
  modalOverlay.addEventListener('click', (e) => {
    const navBtn = e.target.closest('.settings-nav-btn');
    if (navBtn) {
      const targetTab = navBtn.getAttribute('data-tab');
      const navBtns = modalOverlay.querySelectorAll('.settings-nav-btn');
      const sections = modalOverlay.querySelectorAll('.settings-section');
      navBtns.forEach(b => b.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));
      navBtn.classList.add('active');
      const targetSection = document.getElementById(targetTab);
      if (targetSection) targetSection.classList.add('active');
    }
  });

  // 폼 채우기 및 리스너 바인딩
  function populateSettingsForm(settings) {
    // 1. 사이드바 위치 라디오
    const navPos = settings.navPosition || 'left';
    const radioLeft = document.getElementById('navPosLeft');
    const radioRight = document.getElementById('navPosRight');
    if (radioLeft && radioRight) {
      if (navPos === 'right') radioRight.checked = true;
      else radioLeft.checked = true;
    }

    // 2. 새로고침 주기 셀렉트
    const intervalSelect = document.getElementById('settingRefreshInterval');
    if (intervalSelect) {
      intervalSelect.value = String(settings.refreshInterval || 15);
    }

    // 3. 미디어 음소거
    const muteSwitch = document.getElementById('settingMuteOnLoad');
    if (muteSwitch) {
      muteSwitch.checked = !!(settings.sound && settings.sound.muteOnLoad);
    }

    // 4. 알림 스위치
    const noti = settings.notifications || DEFAULT_USER_SETTINGS.notifications;
    const notiMaster = document.getElementById('settingNotiMaster');
    const notiYoutube = document.getElementById('settingNotiYoutube');
    const notiLive = document.getElementById('settingNotiLive');
    const notiSchedule = document.getElementById('settingNotiSchedule');
    const dailyScheduleTimeSelect = document.getElementById('settingDailyScheduleTime');
    const dailyScheduleTimeRow = document.getElementById('dailyScheduleTimeRow');
    const subOpts = document.getElementById('notiSubOptions');

    if (notiMaster) notiMaster.checked = noti.enabled !== false;
    if (notiYoutube) notiYoutube.checked = noti.youtube !== false;
    if (notiLive) notiLive.checked = noti.live !== false;
    if (notiSchedule) notiSchedule.checked = noti.schedule !== false;
    if (dailyScheduleTimeSelect) dailyScheduleTimeSelect.value = noti.dailyScheduleTime || "09:00";
    if (dailyScheduleTimeRow) dailyScheduleTimeRow.style.opacity = (noti.schedule !== false && noti.enabled !== false) ? '1' : '0.4';
    if (subOpts) subOpts.style.opacity = notiMaster && notiMaster.checked ? '1' : '0.4';

    // 4. 탭 순서 & 활성화 목록
    renderTabReorderList(settings.tabList);

    // 5. 팬페이지 목록
    renderFanpageReorderList(settings.fanpages);
  }

  // 드래그 앤 드롭 순서 변경 바인딩 헬퍼
  function setupReorderListDragAndDrop(listEl, getList, onReorder) {
    if (!listEl) return;
    let draggedItem = null;
    let draggedIndex = -1;

    const rows = listEl.querySelectorAll('.reorder-item-row');
    rows.forEach(row => {
      row.setAttribute('draggable', 'true');

      row.addEventListener('dragstart', (e) => {
        draggedItem = row;
        draggedIndex = parseInt(row.getAttribute('data-index'), 10);
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(draggedIndex));
      });

      row.addEventListener('dragend', () => {
        draggedItem = null;
        draggedIndex = -1;
        listEl.querySelectorAll('.reorder-item-row').forEach(r => {
          r.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
        });
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!draggedItem || draggedItem === row) return;

        const rect = row.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          row.classList.add('drag-over-top');
          row.classList.remove('drag-over-bottom');
        } else {
          row.classList.add('drag-over-bottom');
          row.classList.remove('drag-over-top');
        }
      });

      row.addEventListener('dragleave', () => {
        row.classList.remove('drag-over-top', 'drag-over-bottom');
      });

      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drag-over-top', 'drag-over-bottom');
        if (!draggedItem || draggedItem === row) return;

        const fromIdx = draggedIndex;
        let toIdx = parseInt(row.getAttribute('data-index'), 10);
        const rect = row.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const isBelow = e.clientY >= midY;

        if (fromIdx < toIdx && !isBelow) {
          toIdx -= 1;
        } else if (fromIdx > toIdx && isBelow) {
          toIdx += 1;
        }

        const list = getList();
        if (fromIdx >= 0 && fromIdx < list.length && toIdx >= 0 && toIdx < list.length && fromIdx !== toIdx) {
          const item = list.splice(fromIdx, 1)[0];
          list.splice(toIdx, 0, item);
          onReorder(list);
        }
      });
    });
  }

  // 탭 목록 UI 렌더링
  function renderTabReorderList(tabList = []) {
    const listEl = document.getElementById('tabReorderList');
    if (!listEl) return;
    listEl.innerHTML = '';

    const dragHandleSvg = `
      <span class="reorder-drag-handle" title="드래그하여 순서 변경">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <circle cx="9" cy="5" r="1.2"></circle>
          <circle cx="9" cy="12" r="1.2"></circle>
          <circle cx="9" cy="19" r="1.2"></circle>
          <circle cx="15" cy="5" r="1.2"></circle>
          <circle cx="15" cy="12" r="1.2"></circle>
          <circle cx="15" cy="19" r="1.2"></circle>
        </svg>
      </span>
    `;

    const baseTabMap = {};
    TAB_CONFIG_LIST.forEach(t => { baseTabMap[t.id] = t; });

    tabList.forEach((tab, index) => {
      const baseTab = baseTabMap[tab.id] || tab;
      let iconHtml = '';
      if (baseTab.channelKey && CHANNEL_DATA_MAP[baseTab.channelKey]) {
        const ch = CHANNEL_DATA_MAP[baseTab.channelKey];
        if (ch.svg) iconHtml = `<span class="reorder-icon-mini">${ch.svg}</span>`;
        else if (ch.img) iconHtml = `<img class="reorder-icon-mini-img" src="${ch.img}" alt="">`;
      } else if (baseTab.svg) {
        iconHtml = `<span class="reorder-icon-mini">${baseTab.svg}</span>`;
      } else if (baseTab.icon) {
        iconHtml = `<span class="reorder-icon-mini-emoji">${baseTab.icon}</span>`;
      }

      const row = document.createElement('div');
      row.className = 'reorder-item-row';
      row.setAttribute('data-index', String(index));
      row.innerHTML = `
        <div class="reorder-item-left">
          ${dragHandleSvg}
          <label class="setting-switch small">
            <input type="checkbox" class="tab-toggle-cb" data-id="${tab.id}" ${tab.enabled !== false ? 'checked' : ''}>
            <span class="slider round"></span>
          </label>
          <span class="reorder-item-label">${iconHtml}<span>${escapeHtml(tab.label || tab.id)}</span></span>
        </div>
      `;
      listEl.appendChild(row);
    });

    // 드래그 앤 드롭 활성화
    setupReorderListDragAndDrop(
      listEl,
      () => currentSettings.tabList,
      (newList) => {
        currentSettings.tabList = newList;
        renderTabReorderList(currentSettings.tabList);
        saveUserSettings(currentSettings, () => {
          showSaveNotice();
          if (typeof onTabsChanged === 'function') onTabsChanged(currentSettings.tabList);
        });
      }
    );

    // 탭 활성/비활성 토글 리스너
    listEl.querySelectorAll('.tab-toggle-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        const target = currentSettings.tabList.find(t => t.id === id);
        if (target) {
          target.enabled = e.target.checked;
          saveUserSettings(currentSettings, () => {
            showSaveNotice();
            if (typeof onTabsChanged === 'function') onTabsChanged(currentSettings.tabList);
          });
        }
      });
    });
  }

  // 팬페이지 목록 UI 렌더링
  function renderFanpageReorderList(fanpages = []) {
    const listEl = document.getElementById('fanpageReorderList');
    if (!listEl) return;
    listEl.innerHTML = '';

    const dragHandleSvg = `
      <span class="reorder-drag-handle" title="드래그하여 순서 변경">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <circle cx="9" cy="5" r="1.2"></circle>
          <circle cx="9" cy="12" r="1.2"></circle>
          <circle cx="9" cy="19" r="1.2"></circle>
          <circle cx="15" cy="5" r="1.2"></circle>
          <circle cx="15" cy="12" r="1.2"></circle>
          <circle cx="15" cy="19" r="1.2"></circle>
        </svg>
      </span>
    `;

    fanpages.forEach((fp, index) => {
      const row = document.createElement('div');
      row.className = 'reorder-item-row';
      row.setAttribute('data-index', String(index));
      let iconHtml = '';
      if (fp.icon) {
        if (fp.icon.startsWith('icons/') || fp.icon.startsWith('http') || /\.(png|svg|ico|jpg)/i.test(fp.icon)) {
          iconHtml = `<img src="${escapeHtml(fp.icon)}" alt="" style="width: 14px; height: 14px; vertical-align: -2px; margin-right: 4px; border-radius: 3px; display: inline-block;">`;
        } else {
          iconHtml = `${fp.icon} `;
        }
      }
      row.innerHTML = `
        <div class="reorder-item-left">
          ${dragHandleSvg}
          <label class="setting-switch small">
            <input type="checkbox" class="fp-toggle-cb" data-id="${fp.id}" ${fp.enabled !== false ? 'checked' : ''}>
            <span class="slider round"></span>
          </label>
          <span class="reorder-item-label">${iconHtml}<strong>${escapeHtml(fp.name)}</strong></span>
          <span class="reorder-item-sub">${escapeHtml(fp.url)}</span>
        </div>
        <div class="reorder-btn-group">
          <button class="reorder-edit-btn" data-id="${fp.id}" title="수정">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="reorder-delete-btn" data-id="${fp.id}" title="삭제">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;
      listEl.appendChild(row);
    });

    // 드래그 앤 드롭 활성화
    setupReorderListDragAndDrop(
      listEl,
      () => currentSettings.fanpages,
      (newList) => {
        currentSettings.fanpages = newList;
        renderFanpageReorderList(currentSettings.fanpages);
        saveUserSettings(currentSettings, () => {
          showSaveNotice();
          if (typeof onFanpagesChanged === 'function') onFanpagesChanged(currentSettings.fanpages);
        });
      }
    );

    // 팬페이지 토글 리스너
    listEl.querySelectorAll('.fp-toggle-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        const target = currentSettings.fanpages.find(f => f.id === id);
        if (target) {
          target.enabled = e.target.checked;
          saveUserSettings(currentSettings, () => {
            showSaveNotice();
            if (typeof onFanpagesChanged === 'function') onFanpagesChanged(currentSettings.fanpages);
          });
        }
      });
    });

    // 팬페이지 인라인 수정 리스너
    listEl.querySelectorAll('.reorder-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const fp = currentSettings.fanpages.find(f => f.id === id);
        if (!fp) return;

        const row = btn.closest('.reorder-item-row');
        if (!row) return;

        row.innerHTML = `
          <div class="reorder-item-edit-form">
            <div class="reorder-item-edit-row">
              <input type="text" class="edit-fp-icon" value="${escapeHtml(fp.icon || '')}" placeholder="이모지" maxlength="4" style="width: 52px; text-align: center;">
              <input type="text" class="edit-fp-name" value="${escapeHtml(fp.name || '')}" placeholder="팬페이지 이름" style="flex: 1;">
            </div>
            <div class="reorder-item-edit-row">
              <input type="url" class="edit-fp-url" value="${escapeHtml(fp.url || '')}" placeholder="https://..." style="flex: 1;">
              <button class="reorder-inline-btn save edit-fp-save-btn" data-id="${fp.id}">저장</button>
              <button class="reorder-inline-btn cancel edit-fp-cancel-btn">취소</button>
            </div>
          </div>
        `;

        const nameInput = row.querySelector('.edit-fp-name');
        const urlInput = row.querySelector('.edit-fp-url');
        const iconInput = row.querySelector('.edit-fp-icon');
        const saveBtn = row.querySelector('.edit-fp-save-btn');
        const cancelBtn = row.querySelector('.edit-fp-cancel-btn');

        if (nameInput) nameInput.focus();

        const doSave = () => {
          const newName = (nameInput.value || '').trim();
          const newUrl = (urlInput.value || '').trim();
          const newIcon = (iconInput.value || '').trim() || '🌐';

          if (!newName || !newUrl) {
            alert('팬페이지 이름과 URL을 모두 입력해주세요.');
            return;
          }

          fp.name = newName;
          fp.url = newUrl;
          fp.icon = newIcon;

          saveUserSettings(currentSettings, () => {
            showSaveNotice('팬페이지가 수정되었습니다.');
            renderFanpageReorderList(currentSettings.fanpages);
            if (typeof onFanpagesChanged === 'function') onFanpagesChanged(currentSettings.fanpages);
          });
        };

        if (saveBtn) saveBtn.addEventListener('click', doSave);
        if (cancelBtn) {
          cancelBtn.addEventListener('click', () => {
            renderFanpageReorderList(currentSettings.fanpages);
          });
        }

        row.querySelectorAll('input').forEach(input => {
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              doSave();
            } else if (e.key === 'Escape') {
              renderFanpageReorderList(currentSettings.fanpages);
            }
          });
        });
      });
    });

    // 팬페이지 삭제 리스너
    listEl.querySelectorAll('.reorder-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (confirm('이 팬페이지 바로가기를 삭제하시겠습니까?')) {
          currentSettings.fanpages = currentSettings.fanpages.filter(f => f.id !== id);
          if (!Array.isArray(currentSettings.dismissedFanpages)) {
            currentSettings.dismissedFanpages = [];
          }
          if (!currentSettings.dismissedFanpages.includes(id)) {
            currentSettings.dismissedFanpages.push(id);
          }
          renderFanpageReorderList(currentSettings.fanpages);
          saveUserSettings(currentSettings, () => {
            showSaveNotice();
            if (typeof onFanpagesChanged === 'function') onFanpagesChanged(currentSettings.fanpages);
          });
        }
      });
    });
  }

  // 사이드바 위치 라디오 체인지 이벤트
  modalOverlay.querySelectorAll('input[name="navPosition"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        currentSettings.navPosition = e.target.value;
        initNavPosition(currentSettings.navPosition);
        saveUserSettings(currentSettings, () => {
          showSaveNotice('사이드바 위치가 변경되었습니다.');
          if (typeof onNavPositionChanged === 'function') onNavPositionChanged(currentSettings.navPosition);
        });
      }
    });
  });

  // 새로고침 주기 셀렉트 체인지 이벤트
  const intervalSelect = document.getElementById('settingRefreshInterval');
  if (intervalSelect) {
    intervalSelect.addEventListener('change', (e) => {
      currentSettings.refreshInterval = parseInt(e.target.value, 10) || 15;
      saveUserSettings(currentSettings, () => {
        showSaveNotice('새로고침 주기가 변경되었습니다.');
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            action: "UPDATE_REFRESH_INTERVAL",
            intervalMinutes: currentSettings.refreshInterval
          });
        }
      });
    });
  }

  // 음소거 스위치 체인지
  const muteSwitch = document.getElementById('settingMuteOnLoad');
  if (muteSwitch) {
    muteSwitch.addEventListener('change', (e) => {
      currentSettings.sound = currentSettings.sound || {};
      currentSettings.sound.muteOnLoad = e.target.checked;
      saveUserSettings(currentSettings, () => showSaveNotice());

      const iframe = document.getElementById('shortsTabFrame');
      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage({
            type: 'SET_MUTE_SETTING',
            muteOnLoad: e.target.checked
          }, '*');
        } catch (err) { }
      }
    });
  }

  // 알림 스위치 체인지
  const notiMaster = document.getElementById('settingNotiMaster');
  const notiYoutube = document.getElementById('settingNotiYoutube');
  const notiLive = document.getElementById('settingNotiLive');
  const notiSchedule = document.getElementById('settingNotiSchedule');
  const dailyScheduleTimeSelect = document.getElementById('settingDailyScheduleTime');
  const dailyScheduleTimeRow = document.getElementById('dailyScheduleTimeRow');
  const subOpts = document.getElementById('notiSubOptions');

  function syncNotiSettings() {
    currentSettings.notifications = {
      enabled: notiMaster ? notiMaster.checked : true,
      youtube: notiYoutube ? notiYoutube.checked : true,
      live: notiLive ? notiLive.checked : true,
      schedule: notiSchedule ? notiSchedule.checked : true,
      dailyScheduleTime: dailyScheduleTimeSelect ? dailyScheduleTimeSelect.value : "09:00"
    };
    if (subOpts) subOpts.style.opacity = currentSettings.notifications.enabled ? '1' : '0.4';
    if (dailyScheduleTimeRow) dailyScheduleTimeRow.style.opacity = (currentSettings.notifications.schedule && currentSettings.notifications.enabled) ? '1' : '0.4';
    saveUserSettings(currentSettings, () => {
      showSaveNotice();
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: "UPDATE_DAILY_SCHEDULE_TIME",
          dailyScheduleTime: currentSettings.notifications.dailyScheduleTime
        }).catch(() => {});
      }
    });
  }

  if (notiMaster) notiMaster.addEventListener('change', syncNotiSettings);
  if (notiYoutube) notiYoutube.addEventListener('change', syncNotiSettings);
  if (notiLive) notiLive.addEventListener('change', syncNotiSettings);
  if (notiSchedule) notiSchedule.addEventListener('change', syncNotiSettings);
  if (dailyScheduleTimeSelect) dailyScheduleTimeSelect.addEventListener('change', syncNotiSettings);

  // 신규 팬페이지 추가 버튼
  const addFpBtn = document.getElementById('addNewFanpageBtn');
  if (addFpBtn) {
    addFpBtn.addEventListener('click', () => {
      const iconInput = document.getElementById('newFpIcon');
      const nameInput = document.getElementById('newFpName');
      const urlInput = document.getElementById('newFpUrl');

      const name = (nameInput.value || '').trim();
      const url = (urlInput.value || '').trim();
      const icon = (iconInput.value || '').trim() || '🌐';

      if (!name || !url) {
        alert('팬페이지 이름과 URL을 모두 입력해주세요.');
        return;
      }

      const newId = 'fp_' + Date.now();
      currentSettings.fanpages.push({
        id: newId,
        name: name,
        url: url,
        icon: icon,
        enabled: true
      });

      nameInput.value = '';
      urlInput.value = '';
      iconInput.value = '';

      renderFanpageReorderList(currentSettings.fanpages);
      saveUserSettings(currentSettings, () => {
        showSaveNotice('팬페이지가 추가되었습니다.');
        if (typeof onFanpagesChanged === 'function') onFanpagesChanged(currentSettings.fanpages);
      });
    });
  }

  // 기본값 복원 버튼
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('모든 사용자 설정을 기본값으로 초기화하시겠습니까?')) {
        currentSettings = JSON.parse(JSON.stringify(DEFAULT_USER_SETTINGS));
        populateSettingsForm(currentSettings);
        initNavPosition(currentSettings.navPosition);
        saveUserSettings(currentSettings, () => {
          showSaveNotice('기본값으로 복원되었습니다.');
          if (typeof onTabsChanged === 'function') onTabsChanged(currentSettings.tabList);
          if (typeof onFanpagesChanged === 'function') onFanpagesChanged(currentSettings.fanpages);
          if (typeof onNavPositionChanged === 'function') onNavPositionChanged(currentSettings.navPosition);
        });
      }
    });
  }

  // 다른 창(사이드패널 <-> 대시보드) 간 실시간 설정 동기화 감지 (불필요한 리렌더링 방지)
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.userSettings && changes.userSettings.newValue) {
        const updated = changes.userSettings.newValue;
        const old = changes.userSettings.oldValue || {};

        if (updated.navPosition && updated.navPosition !== old.navPosition) {
          initNavPosition(updated.navPosition);
        }
        if (typeof onTabsChanged === 'function' && updated.tabList && JSON.stringify(updated.tabList) !== JSON.stringify(old.tabList)) {
          onTabsChanged(updated.tabList);
        }
        if (typeof onFanpagesChanged === 'function' && updated.fanpages && JSON.stringify(updated.fanpages) !== JSON.stringify(old.fanpages)) {
          onFanpagesChanged(updated.fanpages);
        }
      }
    });
  }
}

/**
 * 사이드패널 또는 보드(대시보드) 진입 시 백그라운드 데이터 1회 갱신 요청
 */
