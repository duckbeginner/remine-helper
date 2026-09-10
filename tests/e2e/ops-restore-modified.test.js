// tests/e2e/ops-restore-modified.test.js
import { test, expect } from '@playwright/test';
import path from 'path';

const opsPagePath = path.resolve(process.cwd(), 'docs', 'ops-m7k2x9.html');
const opsPageUrl = `file://${opsPagePath}`;

test.describe('Ops Management Tool - Restore Modified Schedule to Original', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(opsPageUrl);
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(() => {
      // Mock raw base schedules (official unmodified originals)
      const officialItem = {
        id: 'blip_1001',
        title: '공식 원본 음악방송 제목',
        startTime: '2026-08-15T18:00:00',
        endTime: '2026-08-15T18:00:00',
        typeText: '방송',
        channel: 'KBS',
        location: '여의도 KBS 신관',
        url: 'https://kbs.co.kr/music',
        source: 'blip'
      };

      window.rawBaseSchedules = [JSON.parse(JSON.stringify(officialItem))];
      window.allSchedules = [JSON.parse(JSON.stringify(officialItem))];

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

  test('should allow modifying an item and then restoring it back to official original from card action', async ({ page }) => {
    // 1. Initially card has official title and NO restore button
    await expect(page.locator('.schedule-card', { hasText: '공식 원본 음악방송 제목' })).toBeVisible();
    await expect(page.locator('.btn-restore-mod, button:has-text("원본 복구")')).toHaveCount(0);

    // 2. Click edit button to modify
    await page.click('.btn-action:has-text("✏️ 수정")');
    await page.waitForSelector('#editModalOverlay.active');

    // Change title and location
    await page.fill('#formTitle', '운영자가 임의 수정한 제목');
    await page.fill('#formLocation', '수정된 장소');
    await page.click('#btnModalSave');
    await page.waitForTimeout(300);

    // 3. Card should now show modified title and "수정 대기" badge
    const modifiedCard = page.locator('.schedule-card', { hasText: '운영자가 임의 수정한 제목' });
    await expect(modifiedCard).toBeVisible();
    await expect(modifiedCard.locator('.state-badge')).toContainText('수정 대기');

    // 4. "↩️ 원본 복구" button should now be visible on the card
    const restoreBtn = modifiedCard.locator('.btn-restore-mod, button:has-text("원본 복구")').first();
    await expect(restoreBtn).toBeVisible();

    // 5. Click "↩️ 원본 복구" button
    await restoreBtn.click();
    await page.waitForTimeout(300);

    // 6. Card should be restored back to official original title and location
    const restoredCard = page.locator('.schedule-card', { hasText: '공식 원본 음악방송 제목' });
    await expect(restoredCard).toBeVisible();
    await expect(restoredCard).toContainText('여의도 KBS 신관');
    await expect(page.locator('text=운영자가 임의 수정한 제목')).toHaveCount(0);

    // "수정 대기" badge should be gone
    await expect(restoredCard.locator('.state-badge:has-text("수정 대기")')).toHaveCount(0);
  });

  test('should support restoring to original directly inside the edit modal', async ({ page }) => {
    // 1. Modify item first
    await page.click('.btn-action:has-text("✏️ 수정")');
    await page.fill('#formTitle', '모달 안에서 변경된 제목');
    await page.click('#btnModalSave');
    await page.waitForTimeout(300);

    // 2. Open edit modal again for this modified item
    await page.click('.btn-action:has-text("✏️ 수정")');
    await page.waitForSelector('#editModalOverlay.active');

    // 3. Click "↩️ 원본 복원" inside the modal
    const modalRestoreBtn = page.locator('#btnModalRestoreOriginal, button:has-text("공식 원본 복원"), button:has-text("원본 복원")');
    await expect(modalRestoreBtn).toBeVisible();
    await modalRestoreBtn.click();
    await page.waitForTimeout(300);

    // 4. Form inputs should be restored to official original values
    const restoredFormTitle = await page.$eval('#formTitle', el => el.value);
    expect(restoredFormTitle).toBe('공식 원본 음악방송 제목');

    const restoredFormLoc = await page.$eval('#formLocation', el => el.value);
    expect(restoredFormLoc).toBe('여의도 KBS 신관');

    // 5. Save the modal and check card is back to official original
    await page.click('#btnModalSave');
    await page.waitForTimeout(300);

    const finalCard = page.locator('.schedule-card', { hasText: '공식 원본 음악방송 제목' });
    await expect(finalCard).toBeVisible();
  });
});
