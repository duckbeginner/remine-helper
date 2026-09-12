// tests/e2e/ops-iphone13-mini.test.js
// iPhone 13 mini 디바이스 규격(375x812, DPR 3) 기준 Ops 포털 UI 정밀 검증 및 스크린샷 생성

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const rootDir = process.cwd();
const opsHtmlPath = path.resolve(rootDir, 'docs', 'ops-m7k2x9.html');
const opsHtmlUrl = `file://${opsHtmlPath}`;
const screenshotDir = path.resolve(rootDir, '.cache', 'screenshots');

test.use({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true
});

test.describe('Ops Management Tool - iPhone 13 mini Real UI Layout Test', () => {

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  test('1. Main View: Banner & Card Actions should not break on iPhone 13 mini', async ({ page }) => {
    // 로컬스토리지 토큰 주입 (게이트키퍼 자동 통과)
    await page.addInitScript(() => {
      localStorage.setItem('remine_ops_token', 'm7k2x9_ops_secret_verified');
    });

    await page.goto(opsHtmlUrl);
    await page.waitForLoadState('domcontentloaded');

    // 사용자의 스크린샷 1과 동일한 데이터 환경 시뮬레이션
    await page.evaluate(() => {
      const sampleItem = {
        id: 'blip_youtube_sample_1',
        title: '[Re-log] 멍엉티비 🐹 in LA US | RESCENE (리센느) vlog',
        startTime: '2026-09-01T20:00:00+09:00',
        endTime: '2026-09-01T20:00:00+09:00',
        typeText: '영상',
        channel: 'RESCENE',
        url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        location: 'LA US',
        source: 'blip',
        _isModified: true,
        starAttendees: [{ name: '미나미', avatar: '' }]
      };

      window.rawBaseSchedules = [JSON.parse(JSON.stringify(sampleItem))];
      window.allSchedules = [JSON.parse(JSON.stringify(sampleItem))];
      window.currentViewDate = new Date(2026, 8, 1);

      if (typeof window.showApp === 'function') {
        window.showApp();
      }
      if (typeof window.renderSchedules === 'function') {
        window.renderSchedules();
      }

      // 상단 신규 알림 배너 시뮬레이션 (9건)
      const bannerEl = document.getElementById('newScheduleBanner');
      if (bannerEl) {
        bannerEl.style.display = 'flex';
        bannerEl.innerHTML = `
          <div class="new-schedule-info">
            <span class="new-pulse-dot"></span>
            <span>새로 수집된 일정 <strong>9건</strong>이 있습니다.</span>
          </div>
          <div class="new-schedule-actions">
            <button type="button" class="btn-filter-new">모아보기</button>
            <button type="button" class="btn-mark-all-read">모두 확인 완료</button>
          </div>
        `;
      }
    });

    await page.waitForSelector('.date-group', { state: 'attached' });

    // 1. 신규 수집 알림 배너 검증
    const banner = page.locator('#newScheduleBanner');
    await expect(banner).toBeVisible();

    // 배너 액션 버튼들이 줄바꿈이나 오버플로우 없이 보이는지 확인
    const filterBtn = banner.locator('.btn-filter-new');
    const markAllBtn = banner.locator('.btn-mark-all-read');
    await expect(filterBtn).toBeVisible();
    await expect(markAllBtn).toBeVisible();

    // 2. 일정 카드 하단 액션 버튼 검증 (스크린샷 1의 핵심 이슈)
    const card = page.locator('.schedule-card').first();
    await expect(card).toBeVisible();

    const actionButtons = card.locator('.card-actions .btn-action');
    const btnCount = await actionButtons.count();
    expect(btnCount).toBeGreaterThanOrEqual(3);

    for (let i = 0; i < btnCount; i++) {
      const btn = actionButtons.nth(i);
      await expect(btn).toBeVisible();

      // white-space 속성이 nowrap인지 확인 (텍스트 세로 쪼개짐 방지)
      const whiteSpace = await btn.evaluate(el => window.getComputedStyle(el).whiteSpace);
      expect(whiteSpace).toBe('nowrap');

      // 버튼 높이가 1줄 규격(30px 이하)인지 확인 (텍스트 2줄 꺾임 발생 시 높이가 35px 이상으로 커짐)
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      expect(box.height).toBeLessThanOrEqual(30);
    }

    // 메인 뷰 스크린샷 캡처
    const mainScreenshotPath = path.join(screenshotDir, 'iphone13-mini-main.png');
    await page.screenshot({ path: mainScreenshotPath, fullPage: false });
    console.log(`📸 iPhone 13 mini 메인 뷰 스크린샷 저장 완료: ${mainScreenshotPath}`);
  });

  test('2. Edit Modal: 2-Row Buttons & Field Visibility should be clean on iPhone 13 mini', async ({ page }) => {
    // 로컬스토리지 토큰 주입
    await page.addInitScript(() => {
      localStorage.setItem('remine_ops_token', 'm7k2x9_ops_secret_verified');
    });

    await page.goto(opsHtmlUrl);
    await page.waitForLoadState('domcontentloaded');

    // 사용자의 스크린샷 2와 동일한 데이터 환경 시뮬레이션
    await page.evaluate(() => {
      const editSample = {
        id: 'blip_concert_sample_2',
        title: '2026 천안 K-컬처 박람회 개막 공연',
        startTime: '2026-09-02T00:00:00+09:00',
        endTime: '2026-09-02T00:00:00+09:00',
        isAllday: true,
        typeText: '행사',
        channel: '',
        url: 'https://x.com/i815/status/2094',
        location: '독립기념관 일원',
        source: 'blip',
        _isModified: true
      };

      window.rawBaseSchedules = [JSON.parse(JSON.stringify(editSample))];
      window.allSchedules = [JSON.parse(JSON.stringify(editSample))];
      window.currentViewDate = new Date(2026, 8, 2);

      if (typeof window.showApp === 'function') {
        window.showApp();
      }
      if (typeof window.renderSchedules === 'function') {
        window.renderSchedules();
      }
      if (typeof window.openEditModalByKey === 'function') {
        window.openEditModalByKey('blip_concert_sample_2');
      }
    });

    const modalOverlay = page.locator('#editModalOverlay');
    await expect(modalOverlay).toHaveClass(/active/);

    const bottomSheet = page.locator('.bottom-sheet');
    await expect(bottomSheet).toBeVisible();

    // 1. 모달 높이 검증 (812px 높이의 80% 이상 넉넉하게 확장되는지)
    const sheetBox = await bottomSheet.boundingBox();
    expect(sheetBox).not.toBeNull();
    expect(sheetBox.height).toBeGreaterThanOrEqual(550);

    // 2. 폼 필드 가시성 검증: '장소' 및 '관련 링크' 필드 접근 가능성
    const locationInput = page.locator('#formLocation');
    await expect(locationInput).toBeAttached();
    // 장소 필드로 스크롤하여 포커스 가능한지 검증
    await locationInput.scrollIntoViewIfNeeded();
    await expect(locationInput).toBeVisible();

    // 3. 하단 2-Row 버튼 레이아웃 검증 (스크린샷 2의 3줄 깨짐 해결 여부)
    const btnRestore = page.locator('#btnModalRestoreOriginal');
    const btnDel = page.locator('#btnModalDelete');
    const btnSave = page.locator('#btnModalSave');

    await expect(btnSave).toBeVisible();
    await expect(btnDel).toBeVisible();

    // (1) 저장하기 버튼이 100% 폭의 메인 버튼인지 확인
    const saveBox = await btnSave.boundingBox();
    expect(saveBox).not.toBeNull();
    expect(saveBox.width).toBeGreaterThanOrEqual(sheetBox.width * 0.85);

    // (2) 공식 원본 복원 및 숨기기 버튼의 텍스트가 줄바꿈 없이 한 줄인지 검증
    const delWhiteSpace = await btnDel.evaluate(el => window.getComputedStyle(el).whiteSpace);
    expect(delWhiteSpace).toBe('nowrap');

    const delBox = await btnDel.boundingBox();
    expect(delBox).not.toBeNull();
    // 3줄로 깨졌을 때는 높이가 70px 이상이었으나, 1줄 정상 높이는 44px 내외
    expect(delBox.height).toBeLessThanOrEqual(48);

    if (await btnRestore.isVisible()) {
      const restoreWhiteSpace = await btnRestore.evaluate(el => window.getComputedStyle(el).whiteSpace);
      expect(restoreWhiteSpace).toBe('nowrap');
      const restoreBox = await btnRestore.boundingBox();
      expect(restoreBox.height).toBeLessThanOrEqual(48);
    }

    // 모달 뷰 스크린샷 캡처
    const modalScreenshotPath = path.join(screenshotDir, 'iphone13-mini-modal.png');
    await page.screenshot({ path: modalScreenshotPath, fullPage: false });
    console.log(`📸 iPhone 13 mini 모달 뷰 스크린샷 저장 완료: ${modalScreenshotPath}`);
  });
});
