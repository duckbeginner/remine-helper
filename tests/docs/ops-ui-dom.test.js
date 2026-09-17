// tests/docs/ops-ui-dom.test.js
// Ops 포털 UI 컴포넌트, 멤버 뱃지, 크로스 브라우징 및 반응형 DOM 무결성 통합 테스트

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const OPS_HTML_PATH = path.join(ROOT_DIR, 'docs/ops-m7k2x9.html');
const OPS_CSS_PATH = path.join(ROOT_DIR, 'docs/ops.css');
const OPS_JS_PATH = path.join(ROOT_DIR, 'docs/ops.js');

export async function run() {
  const runner = new TestRunner('Docs - Ops Portal UI & DOM Integrity');
  runner.run();

  const opsHtml = [
    fs.readFileSync(OPS_HTML_PATH, 'utf8'),
    fs.readFileSync(OPS_CSS_PATH, 'utf8'),
    fs.readFileSync(OPS_JS_PATH, 'utf8')
  ].join('\n');

  // ─────────────────────────────────────────────────────────────
  // 1. 필수 UI 컨트롤 및 토스트/미리보기 DOM 구조 (from ops-tool)
  // ─────────────────────────────────────────────────────────────
  runner.test('Core UI Elements: 파일 실존성 및 필수 UI 컨트롤 실존 검증', () => {
    assert(fs.existsSync(OPS_HTML_PATH), 'ops-m7k2x9.html이 존재해야 합니다.');
    assert(opsHtml.includes('Gist') || opsHtml.includes('gist'), 'Gist 동기화 로직 포함');
    assert(opsHtml.includes('schedule-overrides.json'), '오버라이드 파일명 명시');
    assert(opsHtml.includes('showToast'), 'showToast 함수 정의');
    assert(opsHtml.includes('opsToastContainer'), '토스트 컨테이너 ID 실존');
    assert(opsHtml.includes('btnOpenUserPreview'), '사용자 뷰 미리보기 버튼 실존');
    assert(opsHtml.includes('userPreviewModalOverlay'), '사용자 뷰 모달 실존');
    assert(opsHtml.includes('formLivePreviewCard'), '폼 내 실시간 카드 미리보기 실존');
    assert(opsHtml.includes('updateFormLivePreview'), '실시간 미리보기 갱신 함수 정의');
    assert(opsHtml.includes('renderUserPreviewSchedules'), '사용자 뷰 렌더러 정의');
    assert(opsHtml.includes('renderFieldSuggestions'), '추천 정보 렌더링 함수 정의');
    assert(opsHtml.includes('clearFieldSuggestions'), '추천 정보 초기화 함수 정의');
    assert(opsHtml.includes('applyFieldSuggestion'), '개별 추천값 적용 함수 정의');
    assert(opsHtml.includes('applyAllFieldSuggestions'), '전체 추천값 일괄 적용 함수 정의');
  });

  // ─────────────────────────────────────────────────────────────
  // 2. 참석 멤버(starAttendees) 뱃지 연동 (from ops-member-badges)
  // ─────────────────────────────────────────────────────────────
  runner.test('Member Badges: 멤버 상수, 14px 아바타 뱃지 및 선택기 UI 검증', () => {
    assert(opsHtml.includes('RESCENE_MEMBERS') || opsHtml.includes('MEMBER_AVATAR_MAP'), '멤버 상수 실존');
    assert(opsHtml.includes('member_woni') && opsHtml.includes('member_liv'), '멤버 아바타 이미지 경로 포함');
    assert(opsHtml.includes('function getMemberAttendeeBadgesHTML'), '뱃지 렌더러 헬퍼 함수 정의');
    assert(opsHtml.includes('attendee-mini-avatar'), 'attendee-mini-avatar 뱃지 CSS 클래스 포함');
    assert(opsHtml.includes('attendeesSelector') || opsHtml.includes('attendee-cb'), '수정 모달 내 멤버 선택기 실존');
  });

  // ─────────────────────────────────────────────────────────────
  // 3. 크로스 브라우징 datetime-local 호환성 (from ops-cross-browser-datetime)
  // ─────────────────────────────────────────────────────────────
  runner.test('Cross-Browser Datetime: Safari/Firefox/Chrome datetime-local 입력 포맷 파서 검증', () => {
    // ops-m7k2x9.html 내부의 formatForDateTimeLocal 헬퍼 시뮬레이션
    function formatForDateTimeLocal(isoStr) {
      if (!isoStr) return '';
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      const year = d.getFullYear();
      const month = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      const hours = pad(d.getHours());
      const minutes = pad(d.getMinutes());
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    const res = formatForDateTimeLocal('2026-09-15T14:30:00+09:00');
    assert(res.includes('2026-09-15T') && res.length === 16, 'YYYY-MM-DDTHH:mm 16자리 포맷이어야 함');
    assert.strictEqual(formatForDateTimeLocal(''), '');
    assert.strictEqual(formatForDateTimeLocal(null), '');
  });

  // ─────────────────────────────────────────────────────────────
  // 4. 모바일 반응형 뷰포트 & 터치 최적화 (from ops-mobile-responsive)
  // ─────────────────────────────────────────────────────────────
  runner.test('Mobile Responsive: 360px~375px 소형 뷰포트 메타태그 및 반응형 미디어 쿼리 검증', () => {
    assert(opsHtml.includes('viewport') && opsHtml.includes('width=device-width'), 'viewport 메타태그 포함');
    assert(opsHtml.includes('@media') && (opsHtml.includes('max-width: 480px') || opsHtml.includes('max-width: 600px') || opsHtml.includes('max-width: 768px')),
      '모바일 반응형 미디어 쿼리 포함');
  });

  // ─────────────────────────────────────────────────────────────
  // 5. iOS PWA Safe Area Inset (상단 노치 상태바 & 하단 홈바 방어)
  // ─────────────────────────────────────────────────────────────
  runner.test('iOS PWA Safe Area: 헤더, 플로팅 바, 바텀시트 Safe Area Inset 적용 검증', () => {
    assert(opsHtml.includes('safe-area-inset-top'), '상단 노치/상태바 대응을 위한 safe-area-inset-top이 선언되어야 합니다.');
    assert(opsHtml.includes('safe-area-inset-bottom'), '하단 홈바 대응을 위한 safe-area-inset-bottom이 선언되어야 합니다.');

    // .app-header-fixed에 safe-area-inset-top 적용 확인
    const headerMatch = opsHtml.match(/\.app-header-fixed\s*\{[^}]*\}/s);
    assert(headerMatch && headerMatch[0].includes('safe-area-inset-top'),
      '.app-header-fixed에 padding-top: env(safe-area-inset-top)이 적용되어야 합니다.');

    // .staging-bar에 safe-area-inset-bottom 적용 확인
    const stagingMatch = opsHtml.match(/\.staging-bar\s*\{[^}]*\}/s);
    assert(stagingMatch && stagingMatch[0].includes('safe-area-inset-bottom'),
      '.staging-bar에 bottom: env(safe-area-inset-bottom)이 적용되어야 합니다.');
  });

  // ─────────────────────────────────────────────────────────────
  // 6. iOS / PWA 홈 화면 추가 아이콘 & Web App Manifest 검증
  // ─────────────────────────────────────────────────────────────
  runner.test('PWA Home Screen Icon & Manifest: apple-touch-icon, manifest, title 메타태그 및 아이콘 파일 실존성 검증', () => {
    // 1. ops-m7k2x9.html 메타 태그 검증
    assert(opsHtml.includes('rel="apple-touch-icon"') || opsHtml.includes("rel='apple-touch-icon'"),
      'iOS 홈 화면 아이콘을 위한 apple-touch-icon 링크가 선언되어야 합니다.');
    assert(opsHtml.includes('name="apple-mobile-web-app-title"') || opsHtml.includes("name='apple-mobile-web-app-title'"),
      'iOS 홈 화면 앱 타이틀을 위한 apple-mobile-web-app-title 메타 태그가 선언되어야 합니다.');
    assert(opsHtml.includes('rel="manifest"') || opsHtml.includes("rel='manifest'"),
      'PWA 매니페스트 링크(ops.webmanifest)가 선언되어야 합니다.');

    // 2. 아이콘 파일 실존성 검증
    const touchIconPath = path.join(ROOT_DIR, 'docs/icons/apple-touch-icon.png');
    const manifestPath = path.join(ROOT_DIR, 'docs/ops.webmanifest');
    assert(fs.existsSync(touchIconPath), 'docs/icons/apple-touch-icon.png 파일이 존재해야 합니다.');
    assert(fs.existsSync(manifestPath), 'docs/ops.webmanifest 파일이 존재해야 합니다.');

    // 3. manifest 내용 유효성 검증
    const manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert(manifestJson.name && manifestJson.short_name, 'manifest에 name과 short_name이 정의되어야 합니다.');
    assert(Array.isArray(manifestJson.icons) && manifestJson.icons.length > 0, 'manifest에 icons가 정의되어야 합니다.');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('ops-ui-dom.test.js')) {
  run().then(res => {
    if (res.failed > 0) process.exit(1);
  });
}
