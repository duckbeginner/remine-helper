// tests/docs/pages.test.js
// GitHub Pages 배포 웹 문서 무결성 테스트

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCS_DIR = path.resolve(__dirname, '../../docs');

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

  runner.test('Shorts & Geombang Subpages: 서브페이지 존재 및 Iframe 임베드 준비성', () => {
    const shortsHtml = path.join(DOCS_DIR, 'shorts/index.html');
    const geombangHtml = path.join(DOCS_DIR, 'geombang/index.html');
    assert(fs.existsSync(shortsHtml), 'docs/shorts/index.html이 존재해야 합니다.');
    assert(fs.existsSync(geombangHtml), 'docs/geombang/index.html이 존재해야 합니다.');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('pages.test.js')) {
  run();
}
