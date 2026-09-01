export const DEFAULT_CHANNEL_ORDER = ['youtube', 'helloiamwoni', 'instagram', 'x', 'x_twt', 'tiktok', 'clip', 'facebook', 'mnet', 'blip'];

// Mnet Plus / Bstage 스타 닉네임 -> 실제 멤버 활동명 매핑 테이블
export const MEMBER_NICKNAME_MAP = {
  '별이빛나는맘': '원이',
  '올리브🫒': '리브',
  '올리브': '리브',
  '김깨구리제로천사': '제나',
  '메2': '메이',
  '𝕞𝕚𝕟𝕒𝕞𝕚': '미나미',
  'minami': '미나미'
};

// 멤버별 대표 프로필 아이콘 매핑 테이블 (로컬 패키지 이미지 파일 사용)
export const MEMBER_AVATAR_MAP = {
  '원이': 'icons/member_woni.jpeg',
  '리브': 'icons/member_liv.jpeg',
  '제나': 'icons/member_zena.jpeg',
  '메이': 'icons/member_may.jpeg',
  '미나미': 'icons/member_minami.jpeg'
};

// =========================================================================
// 공통 SVG 아이콘 통합 관리 맵 (Single Source of Truth)
// =========================================================================
export const ICONS = {
  // 1. 네비게이션 & 탭
  home: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
  schedule: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
  shorts: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill-rule="evenodd" clip-rule="evenodd" d="m19.45,3.88c1.12,1.82.48,4.15-1.42,5.22l-1.32.74.94.41c1.36.58,2.27,1.85,2.35,3.27.08,1.43-.68,2.77-1.97,3.49l-8,4.47c-1.91,1.06-4.35.46-5.48-1.35-1.12-1.82-.48-4.15,1.42-5.22l1.33-.74-.94-.41c-1.36-.58-2.27-1.85-2.35-3.27-.08-1.43.68-2.77,1.97-3.49l8-4.47c1.91-1.06,4.35-.46,5.48,1.35ZM10,9v6l5-3-5-3Z" fill="#f03"></path></svg>`,
  sceneflix: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2.5"></rect><polygon points="10 8.5 16 12 10 15.5 10 8.5" fill="currentColor"></polygon></svg>`,

  // 2. 공식 채널 & SNS 브랜드
  instagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#E1306C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>`,
  x: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="currentColor" d="M18.4 14l9.5-11h-2.2l-8.2 9.6L10.9 3H3.3l9.9 14.5L3.3 29h2.2l8.7-10.1L21 29h7.6l-10.3-15zm-3.1 3.6l-1-1.4L6.3 4.7h3.4l6.5 9.2 1 1.4 8.4 12h-3.4l-6.9-9.8z"/></svg>`,
  x_twt: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="currentColor" d="M18.4 14l9.5-11h-2.2l-8.2 9.6L10.9 3H3.3l9.9 14.5L3.3 29h2.2l8.7-10.1L21 29h7.6l-10.3-15zm-3.1 3.6l-1-1.4L6.3 4.7h3.4l6.5 9.2 1 1.4 8.4 12h-3.4l-6.9-9.8z"/></svg>`,
  facebook: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><g clip-path="url(#clip0_790_17854)"><path d="M22.4 39.9C32.3 38.7 40 30.2 40 20 40 9 31 0 20 0 9 0 0 9 0 20c0 9.4 6.5 17.3 15.2 19.4l.4-1.6h6.1l.8 2.1z" fill="#0866FF"/><path d="M15.2 39.4V26.1H11v-6.1h4.2v-2.6c0-6.8 3.1-10 9.8-10 1.3 0 3.5.2 4.4.5v5.5c-.5-.1-1.3-.1-2.3-.1-3.3 0-4.6 1.2-4.6 4.5v2.2h6.5l-1.1 6.1h-5.4v13.7c-2.4.3-4.9.2-7.3-.4z" fill="#FFF"/></g><defs><clipPath id="clip0_790_17854"><rect width="40" height="40" fill="#FFF"/></clipPath></defs></svg>`,
  tiktok: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#FE2C55" d="M24.6 7.6c-1.5-1-2.6-2.6-2.9-4.4-.1-.4-.1-.8-.1-1.2h-4.8v19.3c-.1 2.2-1.9 3.9-4 3.9-.7 0-1.3-.2-1.9-.5-1.3-.7-2.2-2-2.2-3.6 0-2.2 1.8-4 4-4 .4 0 .8.1 1.2.2v-4.9c-.4-.1-.8-.1-1.2-.1-4.9 0-8.9 4-8.9 8.9 0 3 1.5 5.7 3.8 7.3 1.4 1 3.2 1.6 5.1 1.6 4.9 0 8.9-4 8.9-8.9V11.4c1.9 1.4 4.2 2.2 6.7 2.2V8.8c-1.3 0-2.6-.4-3.6-1.2z"/></svg>`,
  mnet: `<svg viewBox="0 0 32 23" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_12_135)"><path d="M21.3 6.1c-.8 0-1.5.2-2.1.5-.6.4-1.1.9-1.3 1.6L15.4 16.2c-.1.3-.3.5-.6.5h-.1c-.3 0-.5-.2-.6-.5L11.5 8.2c-.2-.7-.6-1.2-1.3-1.6-.6-.4-1.3-.5-2.1-.5-.9 0-1.7.3-2.4.7-.7.5-1.1 1.2-1.1 2.1v7.8h2.9V9.6c0-.4.2-.7.5-.7.3 0 .5.2.6.6l2.4 7.2c.2.8.7 1.4 1.4 1.8.6.4 1.3.6 2.1.6.8 0 1.5-.2 2.1-.6.7-.4 1.2-1 1.4-1.8l2.4-7.2c.2-.4.4-.6.7-.6.3 0 .5.2.5.6v7.1h2.9V8.9c0-.9-.4-1.6-1.1-2.1-.6-.5-1.4-.7-2.3-.7z" fill="#EC0C6E"/><path d="M31.2 2.5h-1.7V.8c0-.4-.4-.8-.8-.8s-.8.4-.8.8v1.7h-1.7c-.4 0-.8.4-.8.8 0 .4.4.8.8.8h1.7v1.7c0 .4.4.8.8.8s.8-.4.8-.8V4.1h1.7c.4 0 .8-.4.8-.8 0 .4-.4-.8-.8-.8z" fill="#EC0C6E"/><path d="M28.7 8.2c-.4 0-.8.4-.8.8v6.7c0 3.4-1.8 5.1-5.3 5.1H6.9C3.4 20.9 1.6 19.1 1.6 15.7V9.2c0-1.6.4-2.9 1.3-3.7.9-.9 2.2-1.3 4-1.3h16.1c.4 0 .8-.4.8-.8 0-.4-.4-.8-.8-.8H6.9c-2.2 0-3.9.6-5.1 1.8C.6 5.5 0 7.1 0 9.2v6.6c0 2.1.6 3.8 1.8 4.9 1.2 1.2 2.9 1.8 5.1 1.8h15.7c.1 0 .3 0 .5 0 .1 0 .2 0 .4 0 .6-.1 1.2-.2 1.7-.3.1 0 .2-.1.3-.1 0 0 0 0 0 0 .1 0 .2-.1.3-.1.1 0 .2-.1.3-.1.1 0 .2-.1.3-.1.1 0 .2-.1.3-.1.2-.1.4-.2.6-.3.2-.2.4-.4.6-.6.2-.2.4-.4.5-.7 0 0 0 0 .1 0 .7-1.1 1-2.6 1-4.2V9c0-.4-.4-.8-.8-.8z" fill="url(#paint0_linear_12_135)"/></g><defs><linearGradient id="paint0_linear_12_135" x1="-4" y1="25.4" x2="25.5" y2="5.2" gradientUnits="userSpaceOnUse"><stop offset=".59" stop-color="#EC0C6E"/><stop offset=".63" stop-color="#E4197B"/><stop offset=".69" stop-color="#D13CA0"/><stop offset=".78" stop-color="#B375DB"/><stop offset=".83" stop-color="#A198FF"/><stop offset=".86" stop-color="#98A6FF"/><stop offset=".93" stop-color="#82CBFF"/><stop offset="1" stop-color="#64FFFF"/></linearGradient><clipPath id="clip0_12_135"><rect width="32" height="23" fill="white"/></clipPath></defs></svg>`,
  blip: `<svg viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="256" height="256" rx="64" fill="#FF002E"/><path d="M215.7 133.6c-.1-1.1-.2-2.2-.3-3.3-.2-2.1-.5-4.1-1-6.2-.1-.2-.2-.5-.3-.7-6.7-31.1-34.5-54.5-67.6-54.5-1.2 0-2.4 0-3.6.1-6.7-17.6-23.9-30.2-44-30.2-14.6 0-27.7 6.7-36.3 17.1-24.5 28.6-26.4 83.6-18.5 106.8 10 29.3 39.8 55 87.4 55h-.2c43.4-.4 88.7-21.7 84-84z" fill="#FFF"/><path d="M107.2 120.7c-3.7 0-6.6 3-6.6 6.7v2.9c0 3.6 3 6.6 6.6 6.6h.1c3.6 0 6.6-3 6.6-6.6v-2.9c-.1-3.7-3.1-6.7-6.7-6.7zM148.8 120.7c-3.7 0-6.6 3-6.6 6.7v2.9c0 3.6 3 6.6 6.6 6.6h.1c3.6 0 6.6-3 6.6-6.6v-2.9c0-3.7-3-6.7-6.7-6.7z" fill="#212121"/><path d="M141.3 154.2c1.4-1.4 1.4-3.7 0-5.1-1.4-1.4-3.7-1.4-5.1 0-1.6 1.6-5.8 2.5-8.2 2.5-2.4 0-6.5-1-8.2-2.5-1.4-1.4-3.7-1.4-5.1 0-1.4 1.4-1.4 3.7 0 5.1 3.4 3.4 9.6 4.7 13.3 4.7 3.7 0 9.9-1.3 13.3-4.7z" fill="#212121"/></svg>`,
  clip: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" fill="#03C75A"><path d="M25.73 18.02c.68.5.92 1.43.56 2.2A12.5 12.5 0 0 1 15 27.44h-.3A12.4 12.4 0 0 1 2.59 15.57a12.3 12.3 0 0 1 3.43-9.15 12.3 12.3 0 0 1 8.99-3.84 12.4 12.4 0 0 1 11.28 7.2c.38.82.1 1.8-.67 2.28l-2.41 1.55-2.23 1.4-7.94 5.07a.6.6 0 0 1-.57.02.6.6 0 0 1-.29-.49v-9.2c0-.3.2-.45.3-.5a.55.55 0 0 1 .57.02l3.99 2.56 2.16-1.44-4.88-3.12a2.94 2.94 0 0 0-4.52 2.54v9.07a2.93 2.93 0 0 0 4.52 2.54l8.89-5.67 2.22-1.4 1.47-.94a4.2 4.2 0 0 0 1.54-5.29A14.8 14.8 0 0 0 15.01.2C10.93.2 7.13 1.82 4.3 4.77a14.7 14.7 0 0 0-4.1 10.9 14.74 14.74 0 0 0 14.45 14.14H15a14.8 14.8 0 0 0 13.44-8.58 4.2 4.2 0 0 0-.6-4.47z"/><path d="m27.27 16.2-.37-.26-1.47-.94-2.22 1.4 2.41 1.54.11.08 2.1-1.27q-.24-.3-.56-.54"/><path d="m19.2 11.05-2.16 1.43L20.98 15l2.22-1.4z"/></svg>`,

  // 3. UI 액션 & 컨트롤
  theme: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor"></path></svg>`,
  settings: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
  dashboard: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:3px;"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect></svg>`,
  hscrollLeft: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`,
  hscrollRight: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`,
  prevMonth: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`,
  nextMonth: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`,
  today: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:2px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
  viewCalendar: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
  viewList: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`,
  maximize: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:2px;"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`,
  minimize: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:2px;"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/></svg>`,
  close: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
  link: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px; display:inline-block; color:var(--primary-color, #ff007a);"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`,
  media: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:4px;"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`
};

export const CHANNEL_DATA_MAP = {
  youtube: {
    name: 'Rescene Official',
    url: 'https://www.youtube.com/@RESCENE_official',
    img: 'icons/rescene_official_profile.jpg'
  },
  helloiamwoni: {
    name: '안녕하세요원이입니다잘부탁드립니다',
    url: 'https://www.youtube.com/@helloiamwoninicetomeetyou', // [수정] 최신 핸들 주소로 변경
    img: 'icons/hellowoni_profile.jpg'
  },
  dcinside: {
    name: 'dcinside',
    url: 'https://m.dcinside.com/board/rescene1',
    img: 'icons/dc_logo.png'
  },
  instagram: {
    name: 'Instagram',
    url: 'https://www.instagram.com/rescene_official',
    svg: ICONS.instagram
  },
  x: {
    name: 'X (Official)',
    url: 'https://x.com/resceneofficial',
    svg: ICONS.x
  },
  x_twt: {
    name: 'X (Members)',
    url: 'https://x.com/RESCENE_twt',
    svg: ICONS.x_twt
  },
  facebook: {
    name: 'Facebook',
    url: 'https://www.facebook.com/RESCENE.official',
    svg: ICONS.facebook
  },
  tiktok: {
    name: 'TikTok',
    url: 'https://www.tiktok.com/@rescene_official',
    svg: ICONS.tiktok
  },
  mnet: {
    name: 'Mnet Plus',
    url: 'https://artist.mnetplus.world/main/stg/rescene-official',
    svg: ICONS.mnet
  },
  blip: {
    name: 'blip',
    url: 'https://blip.kr/artists/RESCENE',
    svg: ICONS.blip
  },
  clip: {
    name: 'Naver Clip',
    url: 'https://clip.naver.com/@themuzeent',
    svg: ICONS.clip
  }
};

// 1. 완결형 탭 네비게이션 메타데이터 목록
export const TAB_CONFIG_LIST = [
  {
    id: "tabHome",
    label: "홈",
    svg: ICONS.home,
    type: "home",
    defaultActive: true,
    scrollable: true
  },
  {
    id: "tabSchedule",
    label: "스케줄",
    svg: ICONS.schedule,
    type: "schedule",
    scrollable: false
  },
  {
    id: "tabShorts",
    label: "Shorts",
    svg: ICONS.shorts,
    type: "shorts",
    scrollable: true
  },
  {
    id: "tabInsta",
    label: "Instagram",
    channelKey: "instagram",
    type: "embed-list",
    feedSource: "instagram",
    scrollable: true
  },
  {
    id: "tabX",
    label: "X.com",
    channelKey: "x",
    type: "embed-list",
    feedSource: "x",
    scrollable: true
  },
  {
    id: "tabTiktok",
    label: "Tiktok",
    channelKey: "tiktok",
    type: "embed-list",
    feedSource: "tiktok",
    scrollable: true
  },
  {
    id: "tabClip",
    label: "Clip",
    channelKey: "clip",
    type: "iframe",
    iframeUrl: "https://clip.naver.com/@themuzeent?tab=all&filter=all&theme={theme}",
    sandbox: "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-presentation",
    height: "100%",
    scrollable: false
  },
  {
    id: "tabSceneFlix",
    label: "SceneFlix",
    svg: ICONS.sceneflix,
    type: "iframe",
    iframeUrl: "https://adam-yam.github.io/SCENE-FLIX/?tab=allvideos&theme={theme}",
    sandbox: "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-presentation",
    height: "100%",
    scrollable: false
  }
];

// 4. 틱톡 기본 최신 피드 목록 (테스트 및 폴백용)
export const DEFAULT_TIKTOK_FEEDS = [];

// 2. 공식 채널 메타데이터 목록 (기본 노출 순서)
export const OFFICIAL_CHANNELS = [
  { key: "youtube", name: "YouTube", url: "https://www.youtube.com/@RESCENE_official" },
  { key: "helloiamwoni", name: "안녕하세요원이입니다잘부탁드립니다", url: "https://www.youtube.com/@helloiamwoninicetomeetyou" },
  { key: "instagram", name: "Instagram", url: "https://www.instagram.com/rescene_official" },
  { key: "x", name: "X (Official)", url: "https://x.com/resceneofficial" },
  { key: "x_twt", name: "X (Members)", url: "https://x.com/RESCENE_twt" },
  { key: "tiktok", name: "TikTok", url: "https://www.tiktok.com/@rescene_official" },
  { key: "clip", name: "Naver Clip", url: "https://clip.naver.com/@themuzeent" },
  { key: "facebook", name: "Facebook", url: "https://www.facebook.com/RESCENE.official" },
  { key: "mnet", name: "Mnet Plus", url: "https://artist.mnetplus.world/main/stg/rescene-official" },
  { key: "blip", name: "blip", url: "https://blip.kr/artists/RESCENE" }
];

// 3. 팬페이지 바로가기 메타데이터 목록
export const FANPAGE_LIST = [
  { id: "fp_todo", name: "To DO", url: "https://rescenefan.com/", icon: "📝", enabled: true },
  { id: "fp_muzip", name: "muzip chart", url: "https://rescene.muzip.link/chart/", icon: "📊", enabled: true },
  { id: "fp_love", name: "rescene.love", url: "https://rescene.love/", icon: "💖", enabled: true },
  { id: "fp_fan", name: "rescene.fan", url: "https://rescene.fan/", icon: "🌸", enabled: true }
];

// 5. 새로고침 주기 옵션 (분 단위)
export const REFRESH_INTERVAL_OPTIONS = [
  { value: 5, label: "5분마다" },
  { value: 15, label: "15분마다 (권장)" },
  { value: 30, label: "30분마다" },
  { value: 60, label: "1시간마다" },
  { value: 120, label: "2시간마다" },
  { value: 360, label: "6시간마다" }
];

export const DAILY_SCHEDULE_TIME_OPTIONS = [
  { value: "06:00", label: "오전 06:00" },
  { value: "07:00", label: "오전 07:00" },
  { value: "08:00", label: "오전 08:00" },
  { value: "09:00", label: "오전 09:00 (기본값)" },
  { value: "10:00", label: "오전 10:00" },
  { value: "11:00", label: "오전 11:00" },
  { value: "12:00", label: "오후 12:00 (정오)" },
  { value: "13:00", label: "오후 01:00" },
  { value: "14:00", label: "오후 02:00" }
];

// 6. 기본 사용자 설정 (User Settings Default)
export const DEFAULT_USER_SETTINGS = {
  navPosition: 'left', // 'left' | 'right'
  refreshInterval: 15, // 분 단위 (기본 15분)
  notifications: {
    enabled: true,               // 푸시 알림 전체
    youtube: true,               // 유튜브 새 영상
    live: true,                  // 실시간 라이브 감지
    schedule: true,              // 스케줄 알림
    dailyScheduleTime: "09:00"   // 당일 종합 스케줄 알림 기준 시각
  },
  sound: {
    muteOnLoad: false  // 임베드 로드 시 자동 음소거
  },
  tabList: TAB_CONFIG_LIST.map(tab => ({
    ...tab,
    enabled: tab.enabled !== false
  })),
  fanpages: [
    { id: "fp_todo", name: "To DO", url: "https://rescenefan.com/", icon: "📝", enabled: true },
    { id: "fp_muzip", name: "muzip chart", url: "https://rescene.muzip.link/chart/", icon: "📊", enabled: true },
    { id: "fp_love", name: "rescene.love", url: "https://rescene.love/", icon: "💖", enabled: true },
    { id: "fp_fan", name: "rescene.fan", url: "https://rescene.fan/", icon: "🌸", enabled: true }
  ]
};
