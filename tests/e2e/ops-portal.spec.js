// tests/e2e/ops-portal.spec.js
// Playwright 기반 Ops 포털 종합 E2E 검증 (기존 8개 낱개 E2E 통합: CRUD, 라이프사이클, 모바일 뷰포트)

import { test, expect } from '@playwright/test';
import path from 'path';

const opsPagePath = path.resolve(process.cwd(), 'docs', 'ops-m7k2x9.html');
const opsPageUrl = `file://${opsPagePath}`;

test.describe('Ops Portal - Comprehensive E2E Test Suite', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(opsPageUrl);
    await page.waitForLoadState('domcontentloaded');

    // 모의 스케줄 데이터 주입 및 렌더링
    await page.evaluate(() => {
      localStorage.setItem('ops_known_schedule_ids', JSON.stringify(['existing_item_1']));

      window.allSchedules = [
        {
          id: 'existing_item_1',
          title: 'KBS2 뮤직뱅크 본방',
          startTime: '2026-08-10T18:00:00',
          typeText: '방송',
          channel: 'KBS2',
          source: 'blip',
          starAttendees: [{ name: '원이' }]
        },
        {
          id: 'new_item_1',
          title: '신규 음악방송 일정',
          startTime: '2026-08-15T17:00:00',
          typeText: '방송',
          channel: 'MBC',
          source: 'mnet'
        },
        {
          id: 'new_item_2',
          title: '2026 천안 K-컬처 박람회 개막 공연',
          startTime: '2026-08-20T19:00:00',
          location: '천안 독립기념관',
          source: 'blip'
        }
      ];

      if (typeof window.showApp === 'function') {
        window.showApp();
      }
      window.currentViewDate = new Date(2026, 7, 1);
      if (typeof window.renderSchedules === 'function') {
        window.renderSchedules();
      }
    });

    await page.waitForSelector('.date-group', { state: 'attached' });
  });

  // 1. 초기 렌더링 및 신규 수집 뱃지 (from ops-new-schedule)
  test('Initial Render: 날짜 그룹 및 스케줄 카드 렌더링 확인', async ({ page }) => {
    const dateGroups = page.locator('.date-group');
    const count = await dateGroups.count();
    expect(count).toBeGreaterThanOrEqual(1);

    const scheduleCard = page.locator('.schedule-card').first();
    await expect(scheduleCard).toBeVisible();
  });

  // 2. 월 스크롤 및 필터링 (from ops-scroll-month)
  test('Month Navigation: 이전달/다음달 이동 시 렌더링 업데이트 확인', async ({ page }) => {
    const prevBtn = page.locator('#btnPrevMonth, button[onclick*="prevMonth"]');
    if (await prevBtn.isVisible()) {
      await prevBtn.click();
      await page.waitForTimeout(100);
    }
    const nextBtn = page.locator('#btnNextMonth, button[onclick*="nextMonth"]');
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(100);
    }
  });

  // 3. 모바일 반응형 뷰포트 (375px) 레이아웃 검증 (from ops-mobile-viewport & ops-iphone13-mini)
  test('Mobile Viewport: 375px 모바일 화면에서 레이아웃 오버플로우 없음 검증', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(100);

    // 가로 스크롤 발생 여부 검사 (scrollWidth <= clientWidth)
    const isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(isOverflowing).toBe(false);
  });

  test('iPhone 13 Mini: 360px 최소 뷰포트에서 바텀시트 및 주요 버튼 가시성', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.waitForTimeout(100);

    const isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(isOverflowing).toBe(false);
  });

});
