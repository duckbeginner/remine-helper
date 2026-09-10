// tests/e2e/ops-scroll-month.test.js
import { test, expect } from '@playwright/test';
import path from 'path';

const opsPagePath = path.resolve(process.cwd(), 'docs', 'ops-m7k2x9.html');
const opsPageUrl = `file://${opsPagePath}`;

test.describe('Ops Management Tool - Continuous Multi-Month Scroll', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(opsPageUrl);
    await page.waitForLoadState('domcontentloaded');

    // Mock schedules data covering August and September 2026 to ensure predictable testing
    await page.evaluate(() => {
      window.allSchedules = [
        {
          id: 'test_aug_1',
          title: '8월 15일 광복절 기념 방송',
          startTime: '2026-08-15T18:00:00',
          typeText: '방송',
          channel: 'KBS',
          location: '여의도'
        },
        {
          id: 'test_aug_2',
          title: '8월 28일 리센느 팬미팅',
          startTime: '2026-08-28T19:00:00',
          typeText: '행사',
          channel: '공식',
          location: '서울'
        },
        {
          id: 'test_sep_1',
          title: '9월 5일 음악중심 컴백 무대',
          startTime: '2026-09-05T15:30:00',
          typeText: '방송',
          channel: 'MBC',
          location: '상암'
        },
        {
          id: 'test_sep_2',
          title: '9월 20일 정규 앨범 팬사인회',
          startTime: '2026-09-20T17:00:00',
          typeText: '팬사인회',
          channel: '공식',
          location: '코엑스'
        },
        {
          id: 'test_oct_1',
          title: '10월 3일 개천절 특별 라이브',
          startTime: '2026-10-03T20:00:00',
          typeText: '영상',
          channel: 'YouTube',
          location: '스튜디오'
        }
      ];

      // Ensure app header and main view are visible
      if (typeof window.showApp === 'function') {
        window.showApp();
      } else {
        const gs = document.getElementById('gatekeeperScreen');
        if (gs) gs.style.display = 'none';
        const ah = document.getElementById('appHeader');
        if (ah) ah.style.display = 'block';
        const mc = document.getElementById('mainContent');
        if (mc) mc.style.display = 'block';
      }

      // Set initial view date to August 2026
      window.currentViewDate = new Date(2026, 7, 1); // 2026-08-01
      if (typeof window.renderSchedules === 'function') {
        window.renderSchedules();
      }
    });

    await page.waitForSelector('.date-group', { state: 'attached' });
  });

  test('should display initial month header and allow continuous scrolling into next month', async ({ page }) => {
    // Check initial month text
    const monthText = await page.$eval('#currentMonthText', el => el.textContent.trim());
    expect(monthText).toContain('2026. 08');

    // Verify August items are visible
    const augItem = await page.$('text=8월 15일 광복절 기념 방송');
    expect(augItem).not.toBeNull();

    // Scroll down to the bottom to trigger next month load
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    // Also trigger scroll handler if needed
    await page.waitForTimeout(500);

    // Verify September items are loaded in the same feed
    const sepItem = await page.$('text=9월 5일 음악중심 컴백 무대');
    expect(sepItem).not.toBeNull();
  });

  test('should update currentMonthText dynamically as user scrolls down to September', async ({ page }) => {
    // 1. Scroll down to trigger loading of next month (September)
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(400);

    // 2. Scroll into the loaded September section
    await page.evaluate(() => {
      const sepEl = document.querySelector('[data-month="2026-09"]');
      if (sepEl) {
        sepEl.scrollIntoView({ behavior: 'instant', block: 'start' });
        window.dispatchEvent(new Event('scroll'));
      }
    });
    await page.waitForTimeout(400);

    // Current month text should update to September
    const updatedMonthText = await page.$eval('#currentMonthText', el => el.textContent.trim());
    expect(updatedMonthText).toContain('2026. 09');
  });

  test('clicking next/prev month buttons smoothly scrolls or navigates between months', async ({ page }) => {
    // Click next month button
    await page.click('#btnNextMonth');
    await page.waitForTimeout(400);

    const monthAfterNext = await page.$eval('#currentMonthText', el => el.textContent.trim());
    expect(monthAfterNext).toContain('2026. 09');

    // Click prev month button
    await page.click('#btnPrevMonth');
    await page.waitForTimeout(400);

    const monthAfterPrev = await page.$eval('#currentMonthText', el => el.textContent.trim());
    expect(monthAfterPrev).toContain('2026. 08');
  });
});
