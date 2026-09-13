// scripts/generate-store-metadata.mjs
// 크롬 웹스토어 개발자 콘솔 등록용 메타데이터 및 버전 업데이트 안내 텍스트 자동 생성기

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const STORE_ASSETS_DIR = path.join(ROOT_DIR, 'docs/store-assets');

export function generateStoreMetadata(targetVersion = '1.0.5') {
  const manifestPath = path.join(ROOT_DIR, 'remine-helper/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const version = targetVersion || manifest.version;

  const content = `================================================================================
🌸 Remine Helper v${version} 크롬 웹스토어 개발자 콘솔 제출 가이드 & 메타데이터
================================================================================

[1] 버전 업데이트 정보 (심사 제출 시 '테스터/사용자 안내' 입력란에 복사-붙여넣기)
--------------------------------------------------------------------------------
[v${version} 주요 업데이트 내역]
1. 파이어폭스(Firefox) 및 크로스 브라우저 비동기 스토리지 호환성 강화
   - 브라우저 스토리지 데이터 접근 안정화 및 초기 기동 시 자동 데이터 즉시 동기화 적용
2. 캘린더 연월 점프 이동 및 '오늘' 원클릭 빠른 복귀 지원
3. 스케줄 참석 멤버(원이, 리브, 미나미, 메이, 제나) 14px 미니 프로필 아바타 뱃지 표시
4. 공식 SNS(인스타그램, X) 다중 계정 탭 분리 및 클린 피드 제공
5. 공식 유튜브 쇼츠(Shorts) 전용 플레이어 및 바로보기 지원
6. 모바일 및 소형 뷰포트 레이아웃 반응형 최적화

--------------------------------------------------------------------------------
[2] 웹스토어 상세 설명 (Description) - 전체 소개 문구 (수정 필요 시 사용)
--------------------------------------------------------------------------------
리센느(RESCENE) 팬들을 위한 올인원 브라우저 도우미, Remine Helper!

리센느의 방송·공연·행사 스케줄과 공식 유튜브 새 영상, SNS 소식을 
브라우저 사이드패널과 풀 대시보드에서 편하고 빠르게 모아보세요.

✨ 주요 핵심 기능
- 📅 스마트 스케줄 캘린더: 월간 달력 및 타임라인 목록, 연월 점프 이동, 오늘 복귀
- 👥 출연 멤버 아바타 뱃지: 원이, 리브, 미나미, 메이, 제나 참석 여부 한눈에 파악
- 🎥 실시간 미디어 허브: 공식 유튜브 최신 VOD, 라이브 스트리밍, 쇼츠(Shorts) 전용 플레이어
- 📱 공식 SNS 멀티 피드: 인스타그램, X(Twitter) 공식 & 멤버별 소셜 피드 연동
- 🔔 스마트 브라우저 알림: 놓치기 쉬운 주요 일정 및 새 영상 발행 시 데스크톱 알림
- 🌓 다크 / 라이트 모드: 눈이 편안한 글래스모피즘 테마 디자인
- ⚙️ 사용자 맞춤 설정: 사이드바 좌우 위치, 탭 노출 및 순서 드래그 앤 드롭 커스텀

※ 본 확장 프로그램은 팬들을 위해 비영리로 제작된 오픈소스 도구입니다.

--------------------------------------------------------------------------------
[3] 스토어 그래픽 에셋 (store-assets/ 디렉터리에 준비됨)
--------------------------------------------------------------------------------
1. 소형 프로모션 타일 (440x280): store-assets/small_promo_440x280.png
2. 스크린샷 1 (사이드패널 홈): store-assets/screenshot_05_sidepanel_home_1280x800.png
3. 스크린샷 2 (스케줄 달력): store-assets/screenshot_01_calendar_1280x800.png
4. 스크린샷 3 (일정 목록): store-assets/screenshot_02_schedule_list_1280x800.png
5. 스크린샷 4 (대시보드 다크): store-assets/screenshot_03_dashboard_dark_1280x800.png
6. 스크린샷 5 (SNS 모달): store-assets/screenshot_04_dashboard_modal_insta_1280x800.png

================================================================================
`;

  if (!fs.existsSync(STORE_ASSETS_DIR)) {
    fs.mkdirSync(STORE_ASSETS_DIR, { recursive: true });
  }

  const outputPath = path.join(STORE_ASSETS_DIR, `store_description_v${version}.txt`);
  fs.writeFileSync(outputPath, content, 'utf8');
  console.log(`✓ 스토어 등록 메타데이터가 생성되었습니다: ${outputPath}`);
  return outputPath;
}

if (process.argv[1] && process.argv[1].endsWith('generate-store-metadata.mjs')) {
  generateStoreMetadata();
}
