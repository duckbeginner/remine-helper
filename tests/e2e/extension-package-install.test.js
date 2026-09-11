// tests/e2e/extension-package-install.test.js
// 배포용 압축파일(publish/remine-helper-chrome-v1.0.3.zip) 실제 설치 및 구동 무결성 E2E 검증

import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const rootDir = process.cwd();
const chromeZipPath = path.resolve(rootDir, 'publish', 'remine-helper-chrome-v1.0.3.zip');
const firefoxZipPath = path.resolve(rootDir, 'publish', 'remine-helper-firefox-v1.0.3.zip');
const installTempDir = path.resolve(rootDir, 'build', 'test-install-chrome');
const userDataDir = path.resolve(rootDir, 'build', 'test-user-data');

test.describe('Extension Package Integrity & Real Installation Test', () => {
  test.beforeAll(() => {
    // 1. 배포 zip 파일 실존성 확인
    expect(fs.existsSync(chromeZipPath)).toBe(true);
    expect(fs.existsSync(firefoxZipPath)).toBe(true);

    // 2. 임시 설치 디렉터리에 Chrome zip 압축 해제
    if (fs.existsSync(installTempDir)) fs.rmSync(installTempDir, { recursive: true, force: true });
    if (fs.existsSync(userDataDir)) fs.rmSync(userDataDir, { recursive: true, force: true });
    fs.mkdirSync(installTempDir, { recursive: true });
    fs.mkdirSync(userDataDir, { recursive: true });

    execSync(`unzip -q "${chromeZipPath}" -d "${installTempDir}"`);
  });

  test.afterAll(() => {
    // 임시 디렉터리 정리
    if (fs.existsSync(installTempDir)) fs.rmSync(installTempDir, { recursive: true, force: true });
    if (fs.existsSync(userDataDir)) fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  test('1. Chrome 패키지 내부 파일 무결성 및 불순물 배제 검증', async () => {
    // 필수 파일 존재 확인
    const requiredFiles = [
      'manifest.json',
      'background.js',
      'constants.js',
      'sidepanel.html',
      'sidepanel.css',
      'sidepanel.js',
      'dashboard.html',
      'dashboard.css',
      'dashboard.js',
      'common/common.css',
      'common/common.html',
      'common/common.js',
      'common/templates.js',
      'common/theme-preload.js',
      'common/modules/calendar.js',
      'common/modules/theme.js',
      'icons/logo16.png',
      'icons/logo128.png',
      'icons/member_liv.jpeg',
      'icons/member_minami.jpeg'
    ];

    for (const file of requiredFiles) {
      const fullPath = path.join(installTempDir, file);
      expect(fs.existsSync(fullPath), `필수 파일 누락: ${file}`).toBe(true);
    }

    // 불순물 배제 확인 (test-sandbox, .git, .DS_Store 등)
    expect(fs.existsSync(path.join(installTempDir, 'test-sandbox.html'))).toBe(false);
    expect(fs.existsSync(path.join(installTempDir, 'test-sandbox.js'))).toBe(false);
    expect(fs.existsSync(path.join(installTempDir, '.git'))).toBe(false);
    expect(fs.existsSync(path.join(installTempDir, '.DS_Store'))).toBe(false);

    // 매니페스트 버전 및 권한 검증
    const manifest = JSON.parse(fs.readFileSync(path.join(installTempDir, 'manifest.json'), 'utf8'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.version).toBe('1.0.3');
    expect(manifest.permissions).toContain('sidePanel');
    expect(manifest.permissions).toContain('storage');
  });

  test('2. 실제 Chrome 브라우저에 압축파일 로드(설치) 및 사이드패널 정상 구동 검증', async () => {
    // 실제 Chrome 확장 프로그램 로드 환경 시작 (확장 프로그램 지원을 위해 headless: false 설정)
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${installTempDir}`,
        `--load-extension=${installTempDir}`,
        '--no-sandbox'
      ]
    });

    try {
      // 1. Service Worker 감지 및 Extension ID 추출
      let [backgroundWorker] = context.serviceWorkers();
      if (!backgroundWorker) {
        backgroundWorker = await context.waitForEvent('serviceworker', { timeout: 8000 });
      }
      expect(backgroundWorker).toBeDefined();

      const extensionUrl = backgroundWorker.url();
      const extensionId = new URL(extensionUrl).host;
      expect(extensionId).toBeTruthy();

      // 2. sidepanel.html 탭으로 열기
      const sidepanelPage = await context.newPage();
      const sidepanelUrl = `chrome-extension://${extensionId}/sidepanel.html`;
      
      const pageErrors = [];
      sidepanelPage.on('pageerror', err => pageErrors.push(err.message));

      await sidepanelPage.goto(sidepanelUrl);
      await sidepanelPage.waitForLoadState('domcontentloaded');

      // 주요 UI 요소 실존성 검증
      const sidebarNav = sidepanelPage.locator('#mainVerticalSidebar');
      await expect(sidebarNav).toBeVisible();

      const homeBtn = sidepanelPage.locator('.vtab-btn[data-target="tabHome"]');
      await expect(homeBtn).toBeVisible();

      const scheduleBtn = sidepanelPage.locator('.vtab-btn[data-target="tabSchedule"]');
      await expect(scheduleBtn).toBeVisible();

      // 테마 전환 버튼 인터랙션 검증
      const themeBtn = sidepanelPage.locator('#themeToggleBtn');
      await expect(themeBtn).toBeVisible();
      await themeBtn.click();

      // 치명적 스크립트 에러 발생 여부 검증
      const fatalErrors = pageErrors.filter(msg => !msg.includes('net::ERR') && !msg.includes('Failed to fetch'));
      expect(fatalErrors.length).toBe(0);

      // 3. dashboard.html 탭으로 열기
      const dashboardPage = await context.newPage();
      const dashboardUrl = `chrome-extension://${extensionId}/dashboard.html`;
      await dashboardPage.goto(dashboardUrl);
      await dashboardPage.waitForLoadState('domcontentloaded');

      const dashboardCard = dashboardPage.locator('.dashboard-container');
      await expect(dashboardCard).toBeVisible();

    } finally {
      await context.close();
    }
  });

  test('3. Firefox 패키지 내부 파일 무결성 및 MV2 규격 검증', async () => {
    const firefoxTempDir = path.resolve(rootDir, 'build', 'test-install-firefox');
    if (fs.existsSync(firefoxTempDir)) fs.rmSync(firefoxTempDir, { recursive: true, force: true });
    fs.mkdirSync(firefoxTempDir, { recursive: true });

    try {
      execSync(`unzip -q "${firefoxZipPath}" -d "${firefoxTempDir}"`);

      const ffManifest = JSON.parse(fs.readFileSync(path.join(firefoxTempDir, 'manifest.json'), 'utf8'));
      expect(ffManifest.manifest_version).toBe(2);
      expect(ffManifest.version).toBe('1.0.3');
      expect(ffManifest.sidebar_action.default_panel).toBe('sidepanel.html');
      expect(ffManifest.browser_specific_settings.gecko.id).toBeTruthy();

      // 불순물 배제 검증
      expect(fs.existsSync(path.join(firefoxTempDir, 'test-sandbox.html'))).toBe(false);
      expect(fs.existsSync(path.join(firefoxTempDir, '.git'))).toBe(false);
    } finally {
      if (fs.existsSync(firefoxTempDir)) fs.rmSync(firefoxTempDir, { recursive: true, force: true });
    }
  });
});
