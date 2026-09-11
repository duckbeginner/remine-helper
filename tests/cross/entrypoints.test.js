// tests/cross/entrypoints.test.js
// 클라이언트 엔트리포인트(HTML/JS) 실존성 및 스크립트 연결 무결성 검증

import { TestRunner, assert } from '../test-helper.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

export async function run() {
  const runner = new TestRunner('Cross - Client Entrypoints & Wiring Integrity');
  runner.run();

  // 1. Chrome & Firefox Sidepanel & Dashboard 엔트리포인트 실존성
  runner.test('Entrypoints: Chrome 및 Firefox의 주요 HTML/JS 엔트리포인트 실존성', () => {
    const targets = [
      'remine-helper/sidepanel.html',
      'remine-helper/sidepanel.js',
      'remine-helper/dashboard.html',
      'remine-helper/dashboard.js',
      'remine-helper/common/common.html',
      'remine-helper/common/common.js',
      'remine-helper/common/theme-preload.js',
      'manifests/manifest.firefox.json',
      'scripts/data-hub/fetch-all.js'
    ];

    for (const relPath of targets) {
      const fullPath = path.join(ROOT_DIR, relPath);
      assert(fs.existsSync(fullPath), `엔트리포인트 파일 누락: ${relPath}`);
      const stat = fs.statSync(fullPath);
      assert(stat.size > 0, `엔트리포인트 파일 내용이 비어있음: ${relPath}`);
    }
  });

  // 2. sidepanel.html 마크업 내 필수 스크립트 모듈 로드 검증
  runner.test('sidepanel.html: 테마 프리로드 및 sidepanel.js 모듈 로드 태그 검증', () => {
    const html = fs.readFileSync(path.join(ROOT_DIR, 'remine-helper/sidepanel.html'), 'utf-8');
    assert(html.includes('theme-preload.js'), 'theme-preload.js 연결 누락');
    assert(html.includes('src="sidepanel.js"'), 'sidepanel.js 스크립트 연결 누락');
    assert(html.includes('rel="stylesheet"'), 'CSS 스타일시트 연결 누락');
  });

  // 3. dashboard.html 마크업 내 필수 스크립트 모듈 로드 검증
  runner.test('dashboard.html: 테마 프리로드 및 dashboard.js 모듈 로드 태그 검증', () => {
    const html = fs.readFileSync(path.join(ROOT_DIR, 'remine-helper/dashboard.html'), 'utf-8');
    assert(html.includes('theme-preload.js'), 'theme-preload.js 연결 누락');
    assert(html.includes('src="dashboard.js"'), 'dashboard.js 스크립트 연결 누락');
    assert(html.includes('rel="stylesheet"'), 'CSS 스타일시트 연결 누락');
  });

  // 4. scripts/data-hub/fetch-all.js 마스터 러너 무결성
  runner.test('fetch-all.js: 모든 데이터 수집기 모듈 임포트 및 실행 체인 구성 검증', () => {
    const code = fs.readFileSync(path.join(ROOT_DIR, 'scripts/data-hub/fetch-all.js'), 'utf-8');
    assert(code.includes('collectYouTubeData'), 'collectYouTubeData 임포트/호출 누락');
    assert(code.includes('collectScheduleData'), 'collectScheduleData 임포트/호출 누락');
    assert(code.includes('collectSnsData'), 'collectSnsData 임포트/호출 누락');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('entrypoints.test.js')) {
  run();
}
