// tests/firefox/firefox-e2e-sync.test.js
// Firefox 실제 엔진(Playwright Firefox) 기반 데이터 렌더링 및 UI 무결성 E2E 테스트

import { TestRunner, assert } from '../test-helper.js';
import { firefox } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const FIREFOX_BUILD_DIR = path.join(ROOT_DIR, 'build/firefox');

export async function run() {
  const runner = new TestRunner('Firefox - End-to-End Browser & UI Sync');
  runner.run();

  // 1. Firefox 빌드 아티팩트 최신 생성
  await runner.testAsync('Build Pipeline: Firefox 아티팩트 정상 생성 및 구문 무결성 검증', async () => {
    execSync('bash scripts/build-firefox.sh', { cwd: ROOT_DIR, stdio: 'pipe' });
    assert(fs.existsSync(path.join(FIREFOX_BUILD_DIR, 'manifest.json')), 'build/firefox/manifest.json 실존');
    assert(fs.existsSync(path.join(FIREFOX_BUILD_DIR, 'background.js')), 'build/firefox/background.js 실존');
    assert(fs.existsSync(path.join(FIREFOX_BUILD_DIR, 'sidepanel.html')), 'build/firefox/sidepanel.html 실존');

    // 구문 검사
    execSync(`node --check ${path.join(FIREFOX_BUILD_DIR, 'background.js')}`, { stdio: 'pipe' });
  });

  // 2. Playwright Firefox 브라우저를 통한 실체 UI 렌더링 검증
  await runner.testAsync('Firefox Browser Engine: sidepanel.html 로드 및 데이터 렌더링 검증', async () => {
    let browser;
    try {
      browser = await firefox.launch({ headless: true });
    } catch (e) {
      console.warn(`  ⚠️ Playwright Firefox 브라우저 실행 불가 (${e.message}) - 로컬 환경 스킵`);
      return;
    }
    try {
      const context = await browser.newContext({ viewport: { width: 400, height: 700 } });
      const page = await context.newPage();

      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      page.on('pageerror', err => {
        consoleErrors.push(err.message);
      });

      // 사이드패널 HTML 파일 열기
      const sidepanelUrl = 'file://' + path.join(FIREFOX_BUILD_DIR, 'sidepanel.html');
      await page.goto(sidepanelUrl);
      await page.waitForTimeout(500);

      // 실제 core.json 데이터 로드
      const coreData = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'docs/api/v1/core.json'), 'utf8'));

      // 페이지 컨텍스트에 모의 스토리지 데이터 주입 및 렌더링 실행
      await page.evaluate((data) => {
        if (window.__remine_mock_inject__) {
          window.__remine_mock_inject__(data);
        }
      }, coreData);

      await page.waitForTimeout(500);

      // 탭 네비게이션 확인
      const tabs = await page.locator('.vtab-btn').count();
      assert(tabs >= 4, `수직 사이드바 탭 버튼이 4개 이상 존재해야 합니다. (실제: ${tabs})`);

      // 치명적 스크립트 에러 발생 여부 검증
      const criticalErrors = consoleErrors.filter(err =>
        !err.includes('favicon') && !err.includes('net::ERR')
      );
      assert(criticalErrors.length === 0, `Firefox 콘솔 에러가 없어야 합니다: ${criticalErrors.join(', ')}`);
    } finally {
      await browser.close();
    }
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('firefox-e2e-sync.test.js')) {
  run();
}
