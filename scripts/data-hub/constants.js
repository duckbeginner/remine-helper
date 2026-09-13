// scripts/data-hub/constants.js
// 중앙 데이터 허브 메타데이터 및 상수 정의 (SSOT)

export const OFFICIAL_CHANNEL_ID = "UCtKtCiaWRz-d3EZn2xd1mdA";
export const OFFICIAL_PLAYLIST_ID = "PL7zZDePsdYwPNu51o8b9MKQ_eGk520SFt";
export const WONI_CHANNEL_ID = "UCWpY0eSJtyO-qNAPbKFRSSg";

export const BLIP_ARTIST_ID = "152"; // RESCENE
export const BLIP_API_BASE = "https://space.blip.kr/v1";
export const MNET_API_BASE = "https://artist.mnetplus.world/svc/stg/rescene-official";

// 공식 채널 메타데이터
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
  { key: "blip", name: "blip", url: "https://blip.kr/artists/RESCENE" },
  { key: "themuze", name: "THE MUZE", url: "https://themuze.kr/" }
];

// 추천 팬페이지 목록
export const FANPAGE_LIST = [
  { id: "fp_remine_helper", name: "리마인헬퍼", url: "https://duckbeginner.github.io/remine-helper/", icon: "icons/logo16.png", enabled: true }
];

// 멤버 ID 매핑
export const MEMBER_ID_MAP = {
  '67a59215db2769150bfbf5df': '원이',
  '6a85595d92c2d65318a474de': '원이',
  '67a5924253c0ed13ba18b38a': '리브',
  '67a5927866121779ad93d317': '제나',
  '67a4ddac2248254b7dd6d9a7': '메이',
  '67a5925e0425fa520d4fbf81': '미나미'
};

// 멤버 닉네임 매핑
export const MEMBER_NICKNAME_MAP = {
  '별이빛나는맘': '원이',
  '원이입니다': '원이',
  '올리브🫒': '리브',
  '올리브': '리브',
  '김깨구리제로천사': '제나',
  '메2': '메이',
  '𝕞𝕚𝕟𝕒𝕞𝕚': '미나미',
  'minami': '미나미'
};
