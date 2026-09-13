// tests/docs/pages.test.js
// GitHub Pages 배포 웹 문서 무결성 테스트

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const DOCS_DIR = path.join(ROOT_DIR, 'docs');

export async function run() {
  const runner = new TestRunner('Docs - GitHub Pages Integrity');
  runner.run();

  runner.test('Main Web App (docs/index.html & main.js): 파일 존재 및 쇼케이스 로직 확인', () => {
    const htmlPath = path.join(DOCS_DIR, 'index.html');
    const jsPath = path.join(DOCS_DIR, 'main.js');
    assert(fs.existsSync(htmlPath), 'docs/index.html이 존재해야 합니다.');
    assert(fs.existsSync(jsPath), 'docs/main.js가 존재해야 합니다.');

    const jsContent = fs.readFileSync(jsPath, 'utf8');
    assert(jsContent.includes('initTheme'), 'main.js가 테마 초기화 로직을 포함해야 합니다.');
    assert(jsContent.includes('initShowcaseTabs'), 'main.js가 쇼케이스 탭 로직을 포함해야 합니다.');
  });

  runner.test('API Distribution Files: 배포용 docs/api/v1 데이터 파일 실존성 검증', () => {
    const coreApi = path.join(DOCS_DIR, 'api/v1/core.json');
    const schedulesApi = path.join(DOCS_DIR, 'api/v1/schedules.json');
    assert(fs.existsSync(coreApi), 'docs/api/v1/core.json이 존재해야 합니다.');
    assert(fs.existsSync(schedulesApi), 'docs/api/v1/schedules.json이 존재해야 합니다.');
  });

  runner.test('Shorts Subpage: 서브페이지 존재 확인', () => {
    const shortsHtml = path.join(DOCS_DIR, 'shorts/index.html');
    assert(fs.existsSync(shortsHtml), 'docs/shorts/index.html이 존재해야 합니다.');
  });

  runner.test('v1.0.4 Updates & Screenshots: v1.0.4 버전 표기 및 사이드패널 스크린샷 실존성 검증', () => {
    const htmlPath = path.join(DOCS_DIR, 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    assert(htmlContent.includes('v1.0.4'), 'docs/index.html에 v1.0.4 버전 표기가 포함되어야 합니다.');
    assert(htmlContent.includes('v1.0.4 업데이트 내역'), 'docs/index.html에 v1.0.4 업데이트 내역 제목이 포함되어야 합니다.');

    const screenshots = [
      'sidepanel_01_light.png',
      'sidepanel_02_dark.png',
      'sidepanel_03_list.png',
      'sidepanel_04_modal.png',
      'sidepanel_10_calendar_nav.png',
      'sidepanel_12_shorts_view.png'
    ];

    for (const file of screenshots) {
      const filePath = path.join(DOCS_DIR, 'screenshots', file);
      assert(fs.existsSync(filePath), `스크린샷 docs/screenshots/${file}이 존재해야 합니다.`);
      assert(htmlContent.includes(file), `docs/index.html에 스크린샷 ${file} 참조가 포함되어야 합니다.`);
    }

    assert(!htmlContent.includes('sidepanel_09_member_badges.png'), '구조 불일치 sidepanel_09_member_badges.png는 참조되지 않아야 합니다.');
    assert(!htmlContent.includes('sidepanel_11_sns_multitab.png'), '품질 불량인 sidepanel_11_sns_multitab.png는 참조되지 않아야 합니다.');
    assert(!htmlContent.includes('rescene.kr'), '가상 도메인 rescene.kr은 docs/index.html에 참조되지 않아야 합니다.');
    assert(htmlContent.includes('https://duckbeginner.github.io/remine-helper'), '공식 도메인 https://duckbeginner.github.io/remine-helper가 참조되어야 합니다.');
  });

  runner.test('Brand Assets & Favicon Integrity: 파비콘 및 브랜드 로고 에셋/CSS 무결성 검증', () => {
    const htmlPath = path.join(DOCS_DIR, 'index.html');
    const cssPath = path.join(DOCS_DIR, 'style.css');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // 1. docs/index.html 파비콘 검증
    assert(htmlContent.includes('icons/svg/remine-helper-gradient.svg'), 'docs/index.html에 remine-helper-gradient.svg 파비콘 또는 아이콘이 지정되어야 합니다.');
    assert(htmlContent.includes('type="image/svg+xml"'), 'docs/index.html에 SVG 파비콘 타입(image/svg+xml)이 지정되어야 합니다.');

    // 2. docs/style.css 브랜드 로고 필터 버그 방지 검증 (다크 모드에서 하얗게 뭉개지는 현상 방지)
    assert(!cssContent.includes('.brand-logo { filter: brightness(0) invert(1); }') &&
           !cssContent.includes('invert(1)'), 'docs/style.css에 브랜드 로고를 하얗게 뭉개는 invert(1) 필터가 없어야 합니다.');

    // 3. 확장 프로그램 본체(sidepanel.html, dashboard.html) 파비콘 무결성 검증
    const sidepanelHtml = fs.readFileSync(path.join(ROOT_DIR, 'remine-helper/sidepanel.html'), 'utf8');
    const dashboardHtml = fs.readFileSync(path.join(ROOT_DIR, 'remine-helper/dashboard.html'), 'utf8');
    assert(sidepanelHtml.includes('icons/svg/remine-helper-gradient.svg'), 'sidepanel.html에 SVG 파비콘이 지정되어야 합니다.');
    assert(dashboardHtml.includes('icons/svg/remine-helper-gradient.svg'), 'dashboard.html에 SVG 파비콘이 지정되어야 합니다.');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('pages.test.js')) {
  run();
}
