// tests/e2e/ops-deleted-retention-and-scroll.test.js
import { test, expect } from '@playwright/test';
import path from 'path';

const opsPagePath = path.resolve(process.cwd(), 'docs', 'ops-m7k2x9.html');
const opsPageUrl = `file://${opsPagePath}`;

test.describe('Ops Management Tool - Deleted Retention, Linked UI & Scroll Stability', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(opsPageUrl);
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(() => {
      localStorage.setItem('RESCENE_OPS_TOKEN', 'mock_test_token_123');
      // Mock base schedule items across 2026 and 2027
      const item1 = {
        id: 'blip_2001',
        title: '2026 공식 방송 일정 A',
        startTime: '2026-08-15T18:00:00+09:00',
        endTime: '2026-08-15T18:00:00+09:00',
        typeText: '방송',
        channel: 'KBS',
        location: '여의도 KBS 신관',
        source: 'blip',
        linkedScheduleIds: ['blip_2001', 'blip_2002']
      };

      const item2 = {
        id: 'blip_2002',
        title: '2026 연관 행사 일정 B',
        startTime: '2026-08-15T19:30:00+09:00',
        endTime: '2026-08-15T19:30:00+09:00',
        typeText: '행사',
        location: 'KBS 오픈홀',
        source: 'blip',
        linkedScheduleIds: ['blip_2001', 'blip_2002']
      };

      const itemDeletedOfficial = {
        id: 'blip_3001',
        title: '과거에 숨김 처리한 공식 일정 C',
        startTime: '2026-08-20T12:00:00+09:00',
        endTime: '2026-08-20T12:00:00+09:00',
        typeText: '공연',
        source: 'blip',
        _isDeleted: true
      };

      const itemDeletedCustom = {
        id: 'custom_260825_del123',
        title: '과거에 숨김 처리한 수동 등록 일정 D',
        startTime: '2026-08-25T14:00:00+09:00',
        endTime: '2026-08-25T14:00:00+09:00',
        typeText: '기타',
        _isCustom: true,
        _isDeleted: true
      };

      const item2027 = {
        id: 'custom_270815_anniv',
        title: '2027년 8월 리센느 앨범 발매 3주년 기념일',
        startTime: '2027-08-15T00:00:00+09:00',
        endTime: '2027-08-15T00:00:00+09:00',
        isAllday: true,
        typeText: '기념일',
        _isCustom: true
      };

      window.rawBaseSchedules = [JSON.parse(JSON.stringify(item1)), JSON.parse(JSON.stringify(item2)), JSON.parse(JSON.stringify(itemDeletedOfficial))];
      window.allSchedules = [
        JSON.parse(JSON.stringify(item1)),
        JSON.parse(JSON.stringify(item2)),
        JSON.parse(JSON.stringify(itemDeletedOfficial)),
        JSON.parse(JSON.stringify(itemDeletedCustom)),
        JSON.parse(JSON.stringify(item2027))
      ];

      // Gist에서 이미 삭제된 것으로 등록된 키 주입
      if (window.appliedOverrides) {
        window.appliedOverrides.deleted.add('blip_3001');
        window.appliedOverrides.deleted.add('custom_260825_del123');
      }

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

  test('1. should display existing deleted items with [삭제됨] badge and [복구] button, and allow restoring them', async ({ page }) => {
    // Both official and custom deleted items should be visible as status-excluded cards with [삭제됨] badge
    const delCardOfficial = page.locator('.schedule-card', { hasText: '과거에 숨김 처리한 공식 일정 C' });
    await expect(delCardOfficial).toBeVisible();
    await expect(delCardOfficial.locator('.state-badge')).toContainText('삭제됨');
    const restoreBtnOfficial = delCardOfficial.locator('.btn-restore, button:has-text("복구")');
    await expect(restoreBtnOfficial).toBeVisible();

    const delCardCustom = page.locator('.schedule-card', { hasText: '과거에 숨김 처리한 수동 등록 일정 D' });
    await expect(delCardCustom).toBeVisible();
    await expect(delCardCustom.locator('.state-badge')).toContainText('삭제됨');
    const restoreBtnCustom = delCardCustom.locator('.btn-restore, button:has-text("복구")');
    await expect(restoreBtnCustom).toBeVisible();

    // Clicking restore on official deleted item recovers it
    await restoreBtnOfficial.click();
    await page.waitForTimeout(300);

    // [삭제됨] badge should be removed from delCardOfficial
    await expect(delCardOfficial.locator('.state-badge:has-text("삭제됨")')).toHaveCount(0);
    await expect(delCardOfficial.locator('.btn-action:has-text("✏️ 수정")')).toBeVisible();
  });

  test('2. should support filtering only deleted items using the [🗑️ 숨김 일정] chip', async ({ page }) => {
    // Click the [🗑️ 숨김 일정] filter chip
    const hideChip = page.locator('.chip:has-text("숨김"), button:has-text("숨김 일정")').first();
    await expect(hideChip).toBeVisible();
    await hideChip.click();
    await page.waitForTimeout(300);

    // In deleted-only filter mode, only deleted items should be visible
    await expect(page.locator('.schedule-card', { hasText: '과거에 숨김 처리한 공식 일정 C' })).toBeVisible();
    await expect(page.locator('.schedule-card', { hasText: '과거에 숨김 처리한 수동 등록 일정 D' })).toBeVisible();
    await expect(page.locator('.schedule-card', { hasText: '2026 공식 방송 일정 A' })).toHaveCount(0);

    // Clicking [전체] chip returns to all schedules
    await page.click('.chip:has-text("전체")');
    await page.waitForTimeout(300);
    await expect(page.locator('.schedule-card', { hasText: '2026 공식 방송 일정 A' })).toBeVisible();
  });

  test('3. should display linked sub-card stack UI (.linked-sub-stack) for paired schedules', async ({ page }) => {
    // item1 and item2 are linked together. item1 should be primary and contain sub-stack for item2
    const primaryCard = page.locator('.schedule-card', { hasText: '2026 공식 방송 일정 A' });
    await expect(primaryCard).toBeVisible();

    // Check composite badge
    await expect(primaryCard.locator('.state-badge:has-text("합성")')).toBeVisible();

    // Check sub-stack container and sub-item
    const subStack = primaryCard.locator('.linked-sub-stack');
    await expect(subStack).toBeVisible();
    await expect(subStack).toContainText('2026 연관 행사 일정 B');
    await expect(subStack.locator('button:has-text("🔗 해제")')).toBeVisible();

    // item2 should NOT be rendered as an independent primary card (its key is blip_2002)
    const independentItem2 = page.locator('.schedule-card[data-key="blip_2002"]');
    await expect(independentItem2).toHaveCount(0);
  });

  test('4. should keep 2027 month section and card visible after clicking hide, avoiding jumping to April 2027', async ({ page }) => {
    // Navigate directly to 2027.08
    await page.evaluate(() => {
      window.currentViewDate = new Date(2027, 7, 1);
      window.loadedMonths = ['2027-08'];
      window.renderSchedules();
    });
    await page.waitForTimeout(300);

    const card2027 = page.locator('.schedule-card', { hasText: '2027년 8월 리센느 앨범 발매 3주년 기념일' });
    await expect(card2027).toBeVisible();

    // Click [🗑️ 숨김] on the 2027 card
    await card2027.locator('.card-actions button:has-text("🗑️ 숨김")').click();
    await page.waitForTimeout(300);

    // The card should STILL BE VISIBLE in 2027.08, now with [삭제됨] badge and [복구] button
    await expect(card2027).toBeVisible();
    await expect(card2027.locator('.state-badge')).toContainText('삭제됨');
    await expect(card2027.locator('.btn-restore, button:has-text("복구")')).toBeVisible();

    // The header text should still show 2027. 08, not jump to 2027. 04
    const monthText = await page.locator('#currentMonthText').textContent();
    expect(monthText).toContain('2027');
    expect(monthText).toContain('08');
  });

  test('5. should show custom confirm dialog modal (#confirmModalOverlay) instead of browser confirm when clicking save', async ({ page }) => {
    // Stage a change (hide an item)
    const card = page.locator('.schedule-card', { hasText: '2026 공식 방송 일정 A' });
    await card.locator('.card-actions button:has-text("🗑️ 숨김")').click();
    await page.waitForTimeout(300);

    // Staging bar should be visible
    const stagingBar = page.locator('#stagingBar');
    await expect(stagingBar).toBeVisible();

    // Click [저장 적용]
    await page.click('#btnSaveToGist');
    await page.waitForTimeout(300);

    // Custom confirm dialog should open
    const confirmModal = page.locator('#confirmModalOverlay');
    await expect(confirmModal).toBeVisible();
    await expect(confirmModal).toContainText('Gist');
    await expect(confirmModal).toContainText('저장 적용');

    // Verify detailed changes list contains the item
    const changesList = confirmModal.locator('#confirmChangesList');
    await expect(changesList).toBeVisible();
    await expect(changesList.locator('.confirm-change-item')).toHaveCount(1);
    await expect(changesList).toContainText('2026 공식 방송 일정 A');
    await expect(changesList).toContainText('숨김');

    // Click cancel button inside modal
    await page.click('#btnCancelConfirmModal');
    await page.waitForTimeout(300);
    await expect(confirmModal).not.toBeVisible();
  });
});
