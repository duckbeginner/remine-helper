// tests/docs/ops-mobile-responsive.test.js
// Ops 관리자 포털 모바일 뷰(소형 화면 480px 이하) 반응형 UI 규칙 검증

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const OPS_HTML_PATH = path.join(ROOT_DIR, 'docs/ops-m7k2x9.html');

export async function run() {
  console.log('\n▶ [Docs - Ops Tool Mobile Responsive UI] 테스트 실행');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ 통과: ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ❌ 실패: ${name}`);
      console.error(`     이유: ${e.message}`);
      failed++;
    }
  }

  assert.ok(fs.existsSync(OPS_HTML_PATH), 'ops-m7k2x9.html 파일이 존재해야 함');
  const content = fs.readFileSync(OPS_HTML_PATH, 'utf8');

  // 1. .btn-action 에 white-space: nowrap 적용 검증
  test('ops-m7k2x9.html: .btn-action 에 white-space: nowrap 적용 확인 (카드 액션 버튼 텍스트 쪼개짐 방지)', () => {
    assert.ok(
      /\.btn-action\s*\{[^}]*white-space:\s*nowrap/i.test(content),
      '.btn-action 에 white-space: nowrap 속성이 명시되어야 함'
    );
  });

  // 2. 모바일 반응형 미디어 쿼리 (@media (max-width: 480px)) 존재 검증
  test('ops-m7k2x9.html: @media (max-width: 480px) 모바일 미디어 쿼리 존재 확인', () => {
    assert.ok(
      /@media\s*\(\s*max-width:\s*480px\s*\)/i.test(content),
      '모바일 기기를 위한 @media (max-width: 480px) 미디어 쿼리가 정의되어 있어야 함'
    );
  });

  function getMobileMediaBlock() {
    const startIdx = content.indexOf('@media (max-width: 480px)');
    if (startIdx === -1) return '';
    const endIdx = content.indexOf('</style>', startIdx);
    return endIdx !== -1 ? content.slice(startIdx, endIdx) : content.slice(startIdx);
  }

  // 3. 모바일 미디어 쿼리 내 모달 바텀 시트 버튼(.sheet-buttons) 2-Row / flex-wrap 레이아웃 검증
  test('ops-m7k2x9.html: 모바일 미디어 쿼리에서 .sheet-buttons 가 flex-wrap 또는 2단 배치 적용 확인', () => {
    const mobileMedia = getMobileMediaBlock();
    assert.ok(
      mobileMedia.includes('.sheet-buttons') && (mobileMedia.includes('flex-wrap') || mobileMedia.includes('grid') || mobileMedia.includes('flex-direction')),
      '모바일 미디어 쿼리에서 .sheet-buttons 가 flex-wrap 또는 다단 배치가 정의되어야 함'
    );
  });

  // 4. 모바일 미디어 쿼리 내 저장하기 버튼(.btn-sheet-save)의 풀 폭(100%) 단독 CTA 배치 검증
  test('ops-m7k2x9.html: 모바일 미디어 쿼리에서 저장하기 버튼(.btn-sheet-save) 100% 너비 단독 배치 확인', () => {
    const mobileMedia = getMobileMediaBlock();
    assert.ok(
      mobileMedia.includes('.btn-sheet-save') && (mobileMedia.includes('100%') || mobileMedia.includes('order')),
      '모바일 미디어 쿼리에서 저장하기 버튼(.btn-sheet-save)이 100% 너비 또는 order로 하단 전체 폭 배치되어야 함'
    );
  });

  // 5. 모바일 미디어 쿼리 내 .bottom-sheet 높이 및 여백 최적화 검증
  test('ops-m7k2x9.html: 모바일 미디어 쿼리에서 .bottom-sheet 높이(vh/dvh) 최적화 확인', () => {
    const mobileMedia = getMobileMediaBlock();
    assert.ok(
      mobileMedia.includes('.bottom-sheet') && (mobileMedia.includes('vh') || mobileMedia.includes('dvh')),
      '모바일 미디어 쿼리에서 .bottom-sheet 의 세로 높이(vh/dvh)가 작은 화면에 맞게 최적화되어야 함'
    );
  });

  // 6. 모바일 미디어 쿼리 내 .new-schedule-banner 반응형 배치 검증
  test('ops-m7k2x9.html: 모바일 미디어 쿼리에서 새로 수집된 일정 알림 배너(.new-schedule-banner) 반응형 배치 확인', () => {
    const mobileMedia = getMobileMediaBlock();
    assert.ok(
      mobileMedia.includes('.new-schedule-banner'),
      '모바일 미디어 쿼리에서 새로 수집된 일정 알림 배너(.new-schedule-banner)가 반응형으로 처리되어야 함'
    );
  });

  // 7. 모바일 미디어 쿼리 내 상단 헤더(.header-top-bar, .brand-badge) 컴팩트 슬림화 검증
  test('ops-m7k2x9.html: 모바일 미디어 쿼리에서 .header-top-bar 슬림화 및 .brand-badge 숨김 확인', () => {
    const mobileMedia = getMobileMediaBlock();
    assert.ok(
      mobileMedia.includes('.header-top-bar') && mobileMedia.includes('.brand-badge'),
      '모바일 미디어 쿼리에서 .header-top-bar 패딩 및 .brand-badge 숨김이 정의되어야 함'
    );
  });

  // 8. 모바일 미디어 쿼리 내 [➕ 새 일정] 버튼(.btn-add-schedule) 최적화 검증
  test('ops-m7k2x9.html: 모바일 미디어 쿼리에서 .btn-add-schedule 가로폭 최적화 및 노출 보장 확인', () => {
    const mobileMedia = getMobileMediaBlock();
    assert.ok(
      mobileMedia.includes('.btn-add-schedule') && mobileMedia.includes('padding'),
      '모바일 미디어 쿼리에서 .btn-add-schedule 패딩 및 폰트 최적화가 정의되어야 함'
    );
  });

  return { passed, failed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().then(({ passed, failed }) => {
    console.log(`\n결과: ${passed} 통과 / ${failed} 실패`);
    if (failed > 0) process.exit(1);
  });
}
