// common/common.js - 공통 UI 엔진 Facade 진입점 (도메인별 서브모듈 Re-export)

// 1. 테마 엔진 (3단계 순환 테마 시스템)
export * from './modules/theme.js';

// 2. 동적 탭 & 글래스 슬라이더 & Iframe 제어 & 네비게이션
export * from './modules/tabs.js';

// 3. 유튜브 공식/개인 채널 목록 & 쇼츠 렌더러
export * from './modules/youtube.js';

// 4. 스케줄 중복제거, 캘린더 매니저 및 뷰 렌더러
export * from './modules/calendar.js';

// 5. SNS(인스타그램, X, 틱톡) 임베드 렌더러 & 높이 동기화
export * from './modules/sns-embeds.js';

// 6. 설정 모달, 스케줄 상세 모달, 미디어 파서
export * from './modules/modals.js';

// 7. 스토리지 연동, 닉네임/아바타 매핑 및 백그라운드 갱신 요청
export * from './modules/storage.js';
