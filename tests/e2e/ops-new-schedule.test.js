// tests/e2e/ops-new-schedule.test.js
import { test, expect } from '@playwright/test';
import path from 'path';

const opsPagePath = path.resolve(process.cwd(), 'docs', 'ops-m7k2x9.html');
const opsPageUrl = `file://${opsPagePath}`;

test.describe('Ops Management Tool - Newly Collected Schedule Highlighting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(opsPageUrl);
    await page.waitForLoadState('domcontentloaded');

    // Setup mock schedules and simulated localStorage state
    await page.evaluate(() => {
      // Clear known ids and set existing seen schedule
      localStorage.setItem('ops_known_schedule_ids', JSON.stringify(['existing_item_1', 'existing_item_2']));

      window.allSchedules = [
        {
          id: 'existing_item_1',
          title: '기존 등록된 일정 1',
          startTime: '2026-08-10T18:00:00',
          typeText: '방송',
          channel: 'KBS',
          source: 'blip'
        },
        {
          id: 'new_item_1',
          title: '새로 수집된 음악방송 일정',
          startTime: '2026-08-15T17:00:00',
          typeText: '방송',
          channel: 'MBC',
          source: 'mnet'
        },
        {
          id: 'new_item_2',
          title: '새로 수집된 라디오 일정',
          startTime: '2026-08-18T20:00:00',
          typeText: '라디오',
          channel: 'SBS 파워FM',
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

  test('should display NEW badge and visual highlight for newly collected items', async ({ page }) => {
    // 1. Check for the NEW badge on newly collected schedules
    const newBadge = await page.locator('.badge-new-collected, .badge-new-item').first();
    await expect(newBadge).toBeVisible();
    await expect(newBadge).toContainText('NEW');

    // 2. Existing item should NOT have the NEW badge
    const existingCard = page.locator('.schedule-card', { hasText: '기존 등록된 일정 1' });
    const existingBadge = existingCard.locator('.badge-new-collected, .badge-new-item');
    await expect(existingBadge).toHaveCount(0);

    // 3. New card should have special highlight class (e.g. status-new-collected)
    const newCard = page.locator('.schedule-card', { hasText: '새로 수집된 음악방송 일정' });
    await expect(newCard).toHaveClass(/status-new-collected/);
  });

  test('clicking mark-as-read (확인) button on a card removes the NEW badge', async ({ page }) => {
    const newCard = page.locator('.schedule-card', { hasText: '새로 수집된 음악방송 일정' });
    await expect(newCard.locator('.badge-new-collected, .badge-new-item')).toBeVisible();

    // Click confirm/mark as read button
    const confirmBtn = newCard.locator('.btn-confirm-new, button:has-text("확인")').first();
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // After clicking confirm, NEW badge should disappear from this card
    await expect(newCard.locator('.badge-new-collected, .badge-new-item')).toHaveCount(0);
    await expect(newCard).not.toHaveClass(/status-new-collected/);
  });

  test('top new-schedule banner displays count and filters only newly collected items', async ({ page }) => {
    // Check top banner visibility and count
    const banner = page.locator('#newScheduleBanner, .new-schedule-chip');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('새로 수집된 일정');

    // Click filter button/chip to view only new items
    const filterBtn = banner.locator('button, .btn-filter-new').first();
    await filterBtn.click();
    await page.waitForTimeout(300);

    // Existing item should be hidden, new items should be visible
    const existingCard = page.locator('.schedule-card', { hasText: '기존 등록된 일정 1' });
    await expect(existingCard).toHaveCount(0);

    const newCard1 = page.locator('.schedule-card', { hasText: '새로 수집된 음악방송 일정' });
    await expect(newCard1).toBeVisible();

    const newCard2 = page.locator('.schedule-card', { hasText: '새로 수집된 라디오 일정' });
    await expect(newCard2).toBeVisible();

    // Click mark-all-as-read button
    const markAllBtn = page.locator('#btnMarkAllNewAsRead, button:has-text("모두 확인 완료")');
    if (await markAllBtn.count() > 0) {
      await markAllBtn.click();
      await page.waitForTimeout(300);
      // All NEW badges should disappear
      await expect(page.locator('.badge-new-collected, .badge-new-item')).toHaveCount(0);
    }
  });
});
