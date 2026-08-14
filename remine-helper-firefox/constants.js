export const DEFAULT_CHANNEL_ORDER = ['youtube', 'helloiamwoni', 'instagram', 'x', 'tiktok', 'clip', 'facebook', 'mnet', 'blip'];

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
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#E1306C" d="M10.2 2.1c-1.5.1-2.5.3-3.4.7-.9.4-1.7.8-2.5 1.6-.8.8-1.3 1.6-1.6 2.5-.3.9-.6 1.9-.6 3.4-.1 1.5-.1 2-.1 5.8s0 4.3.1 5.8c.1 1.5.3 2.5.7 3.4.4.9.8 1.7 1.6 2.5.8.8 1.6 1.3 2.5 1.6.9.3 1.9.6 3.4.6 1.5.1 2 .1 5.8.1 3.8 0 4.3 0 5.8-.1 1.5-.1 2.5-.3 3.4-.7.9-.4 1.7-.8 2.5-1.6.8-.8 1.3-1.6 1.6-2.5.3-.9.6-1.9.6-3.4.1-1.5.1-2 .1-5.8s0-4.3-.1-5.8c-.1-1.5-.3-2.5-.7-3.4-.4-.9-.8-1.7-1.6-2.5-.8-.8-1.6-1.3-2.5-1.6-.9-.3-1.9-.6-3.4-.6-1.5-.1-2-.1-5.8-.1-3.8 0-4.3 0-5.8.1zm.2 25.3c-1.4-.1-2.1-.3-2.6-.5-.7-.3-1.1-.6-1.6-1s-.8-1-1.1-1.6c-.2-.5-.4-1.2-.5-2.6-.1-1.5-.1-1.9-.1-5.7s0-4.2.1-5.7c.1-1.4.3-2.1.5-2.6.3-.7.6-1.1 1-1.6s1-.8 1.6-1.1c.5-.2 1.2-.4 2.6-.5 1.5-.1 1.9-.1 5.7-.1 3.7 0 4.2 0 5.7.1 1.4.1 2.1.3 2.6.5.7.3 1.1.6 1.6 1s.8 1 1.1 1.6c.2.5.4 1.2.5 2.6.1 1.5.1 1.9.1 5.7 0 3.7 0 4.2-.1 5.7-.1 1.4-.3 2.1-.5 2.6-.3.7-.6 1.1-1 1.6s-1 .8-1.6 1.1c-.5.2-1.2.4-2.6.5-1.5.1-1.9.1-5.7.1s-4.2 0-5.7-.1zm11.4-19c0 .9.8 1.7 1.7 1.7s1.7-.8 1.7-1.7c0-.9-.8-1.7-1.7-1.7s-1.7.8-1.7 1.7zm-13 7.5c0 4 3.2 7.2 7.2 7.2s7.2-3.2 7.2-7.2-3.2-7.2-7.2-7.2-7.2 3.2-7.2 7.2zm2.5 0c0-2.6 2.1-4.7 4.7-4.7s4.7 2.1 4.7 4.7-2.1 4.7-4.7 4.7-4.7-2.1-4.7-4.7z"/></svg>'
  },
  x: {
    name: 'X.com',
    url: 'https://x.com/resceneofficial',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#000" d="M18.4 14l9.5-11h-2.2l-8.2 9.6L10.9 3H3.3l9.9 14.5L3.3 29h2.2l8.7-10.1L21 29h7.6l-10.3-15zm-3.1 3.6l-1-1.4L6.3 4.7h3.4l6.5 9.2 1 1.4 8.4 12h-3.4l-6.9-9.8z"/></svg>'
  },
  facebook: {
    name: 'Facebook',
    url: 'https://www.facebook.com/RESCENE.official',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><g clip-path="url(#clip0_790_17854)"><path d="M22.4 39.9C32.3 38.7 40 30.2 40 20 40 9 31 0 20 0 9 0 0 9 0 20c0 9.4 6.5 17.3 15.2 19.4l.4-1.6h6.1l.8 2.1z" fill="#0866FF"/><path d="M15.2 39.4V26.1H11v-6.1h4.2v-2.6c0-6.8 3.1-10 9.8-10 1.3 0 3.5.2 4.4.5v5.5c-.5-.1-1.3-.1-2.3-.1-3.3 0-4.6 1.2-4.6 4.5v2.2h6.5l-1.1 6.1h-5.4v13.7c-2.4.3-4.9.2-7.3-.4z" fill="#FFF"/></g><defs><clipPath id="clip0_790_17854"><rect width="40" height="40" fill="#FFF"/></clipPath></defs></svg>'
  },
  tiktok: {
    name: 'TikTok',
    url: 'https://www.tiktok.com/@rescene_official',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#FE2C55" d="M24.6 7.6c-1.5-1-2.6-2.6-2.9-4.4-.1-.4-.1-.8-.1-1.2h-4.8v19.3c-.1 2.2-1.9 3.9-4 3.9-.7 0-1.3-.2-1.9-.5-1.3-.7-2.2-2-2.2-3.6 0-2.2 1.8-4 4-4 .4 0 .8.1 1.2.2v-4.9c-.4-.1-.8-.1-1.2-.1-4.9 0-8.9 4-8.9 8.9 0 3 1.5 5.7 3.8 7.3 1.4 1 3.2 1.6 5.1 1.6 4.9 0 8.9-4 8.9-8.9V11.4c1.9 1.4 4.2 2.2 6.7 2.2V8.8c-1.3 0-2.6-.4-3.6-1.2z"/></svg>'
  },
  mnet: {
    name: 'Mnet Plus',
    url: 'https://artist.mnetplus.world/main/stg/rescene-official',
    svg: '<svg viewBox="0 0 32 23" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_12_135)"><path d="M21.3 6.1c-.8 0-1.5.2-2.1.5-.6.4-1.1.9-1.3 1.6L15.4 16.2c-.1.3-.3.5-.6.5h-.1c-.3 0-.5-.2-.6-.5L11.5 8.2c-.2-.7-.6-1.2-1.3-1.6-.6-.4-1.3-.5-2.1-.5-.9 0-1.7.3-2.4.7-.7.5-1.1 1.2-1.1 2.1v7.8h2.9V9.6c0-.4.2-.7.5-.7.3 0 .5.2.6.6l2.4 7.2c.2.8.7 1.4 1.4 1.8.6.4 1.3.6 2.1.6.8 0 1.5-.2 2.1-.6.7-.4 1.2-1 1.4-1.8l2.4-7.2c.2-.4.4-.6.7-.6.3 0 .5.2.5.6v7.1h2.9V8.9c0-.9-.4-1.6-1.1-2.1-.6-.5-1.4-.7-2.3-.7z" fill="#EC0C6E"/><path d="M31.2 2.5h-1.7V.8c0-.4-.4-.8-.8-.8s-.8.4-.8.8v1.7h-1.7c-.4 0-.8.4-.8.8 0 .4.4.8.8.8h1.7v1.7c0 .4.4.8.8.8s.8-.4.8-.8V4.1h1.7c.4 0 .8-.4.8-.8 0 .4-.4-.8-.8-.8z" fill="#EC0C6E"/><path d="M28.7 8.2c-.4 0-.8.4-.8.8v6.7c0 3.4-1.8 5.1-5.3 5.1H6.9C3.4 20.9 1.6 19.1 1.6 15.7V9.2c0-1.6.4-2.9 1.3-3.7.9-.9 2.2-1.3 4-1.3h16.1c.4 0 .8-.4.8-.8 0-.4-.4-.8-.8-.8H6.9c-2.2 0-3.9.6-5.1 1.8C.6 5.5 0 7.1 0 9.2v6.6c0 2.1.6 3.8 1.8 4.9 1.2 1.2 2.9 1.8 5.1 1.8h15.7c.1 0 .3 0 .5 0 .1 0 .2 0 .4 0 .6-.1 1.2-.2 1.7-.3.1 0 .2-.1.3-.1 0 0 0 0 0 0 .1 0 .2-.1.3-.1.1 0 .2-.1.3-.1.1 0 .2-.1.3-.1.2-.1.4-.2.6-.3.2-.2.4-.4.6-.6.2-.2.4-.4.5-.7 0 0 0 0 .1 0 .7-1.1 1-2.6 1-4.2V9c0-.4-.4-.8-.8-.8z" fill="url(#paint0_linear_12_135)"/></g><defs><linearGradient id="paint0_linear_12_135" x1="-4" y1="25.4" x2="25.5" y2="5.2" gradientUnits="userSpaceOnUse"><stop offset=".59" stop-color="#EC0C6E"/><stop offset=".63" stop-color="#E4197B"/><stop offset=".69" stop-color="#D13CA0"/><stop offset=".78" stop-color="#B375DB"/><stop offset=".83" stop-color="#A198FF"/><stop offset=".86" stop-color="#98A6FF"/><stop offset=".93" stop-color="#82CBFF"/><stop offset="1" stop-color="#64FFFF"/></linearGradient><clipPath id="clip0_12_135"><rect width="32" height="23" fill="white"/></clipPath></defs></svg>'
  },
  blip: {
    name: 'blip',
    url: 'https://blip.kr/artists/RESCENE',
    svg: '<svg viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="256" height="256" rx="64" fill="#FF002E"/><path d="M215.7 133.6c-.1-1.1-.2-2.2-.3-3.3-.2-2.1-.5-4.1-1-6.2-.1-.2-.2-.5-.3-.7-6.7-31.1-34.5-54.5-67.6-54.5-1.2 0-2.4 0-3.6.1-6.7-17.6-23.9-30.2-44-30.2-14.6 0-27.7 6.7-36.3 17.1-24.5 28.6-26.4 83.6-18.5 106.8 10 29.3 39.8 55 87.4 55h-.2c43.4-.4 88.7-21.7 84-84z" fill="#FFF"/><path d="M107.2 120.7c-3.7 0-6.6 3-6.6 6.7v2.9c0 3.6 3 6.6 6.6 6.6h.1c3.6 0 6.6-3 6.6-6.6v-2.9c-.1-3.7-3.1-6.7-6.7-6.7zM148.8 120.7c-3.7 0-6.6 3-6.6 6.7v2.9c0 3.6 3 6.6 6.6 6.6h.1c3.6 0 6.6-3 6.6-6.6v-2.9c0-3.7-3-6.7-6.7-6.7z" fill="#212121"/><path d="M141.3 154.2c1.4-1.4 1.4-3.7 0-5.1-1.4-1.4-3.7-1.4-5.1 0-1.6 1.6-5.8 2.5-8.2 2.5-2.4 0-6.5-1-8.2-2.5-1.4-1.4-3.7-1.4-5.1 0-1.4 1.4-1.4 3.7 0 5.1 3.4 3.4 9.6 4.7 13.3 4.7 3.7 0 9.9-1.3 13.3-4.7z" fill="#212121"/></svg>'
  },
  clip: {
    name: 'Naver Clip',
    url: 'https://clip.naver.com/@themuzeent',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" fill="#03C75A"><path d="M25.73 18.02c.68.5.92 1.43.56 2.2A12.5 12.5 0 0 1 15 27.44h-.3A12.4 12.4 0 0 1 2.59 15.57a12.3 12.3 0 0 1 3.43-9.15 12.3 12.3 0 0 1 8.99-3.84 12.4 12.4 0 0 1 11.28 7.2c.38.82.1 1.8-.67 2.28l-2.41 1.55-2.23 1.4-7.94 5.07a.6.6 0 0 1-.57.02.6.6 0 0 1-.29-.49v-9.2c0-.3.2-.45.3-.5a.55.55 0 0 1 .57.02l3.99 2.56 2.16-1.44-4.88-3.12a2.94 2.94 0 0 0-4.52 2.54v9.07a2.93 2.93 0 0 0 4.52 2.54l8.89-5.67 2.22-1.4 1.47-.94a4.2 4.2 0 0 0 1.54-5.29A14.8 14.8 0 0 0 15.01.2C10.93.2 7.13 1.82 4.3 4.77a14.7 14.7 0 0 0-4.1 10.9 14.74 14.74 0 0 0 14.45 14.14H15a14.8 14.8 0 0 0 13.44-8.58 4.2 4.2 0 0 0-.6-4.47z"/><path d="m27.27 16.2-.37-.26-1.47-.94-2.22 1.4 2.41 1.54.11.08 2.1-1.27q-.24-.3-.56-.54"/><path d="m19.2 11.05-2.16 1.43L20.98 15l2.22-1.4z"/></svg>'
  }
};

// 1. 완결형 탭 네비게이션 메타데이터 목록
export const TAB_CONFIG_LIST = [
  {
    id: "tabHome",
    label: "홈",
    svg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'></path><polyline points='9 22 9 12 15 12 15 22'></polyline></svg>",
    type: "home",
    defaultActive: true,
    scrollable: true
  },
  {
    id: "tabSchedule",
    label: "스케줄",
    svg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='4' width='18' height='18' rx='2' ry='2'></rect><line x1='16' y1='2' x2='16' y2='6'></line><line x1='8' y1='2' x2='8' y2='6'></line><line x1='3' y1='10' x2='21' y2='10'></line></svg>",
    type: "schedule",
    scrollable: false
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
    svg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='2' y='4' width='20' height='16' rx='2.5'></rect><polygon points='10 8.5 16 12 10 15.5 10 8.5' fill='currentColor'></polygon></svg>",
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
  { key: "x", name: "X", url: "https://x.com/resceneofficial" },
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

// 6. 기본 사용자 설정 (User Settings Default)
export const DEFAULT_USER_SETTINGS = {
  navPosition: 'left', // 'left' | 'right'
  refreshInterval: 15, // 분 단위 (기본 15분)
  notifications: {
    enabled: true,     // 푸시 알림 전체
    youtube: true,     // 유튜브 새 영상
    live: true,        // 실시간 라이브 감지
    schedule: true     // 스케줄 알림
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
