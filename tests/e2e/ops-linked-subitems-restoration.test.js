// tests/e2e/ops-linked-subitems-restoration.test.js
import { test, expect } from '@playwright/test';
import path from 'path';

const opsPagePath = path.resolve(process.cwd(), 'docs', 'ops-m7k2x9.html');
const opsPageUrl = `file://${opsPagePath}`;

test.describe('Ops Management Tool - Linked Sub-Items Restoration & Sub-Stack UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(opsPageUrl);
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(() => {
      localStorage.setItem('RESCENE_OPS_TOKEN', 'mock_test_token_123');

      // 1. schedules.json에 존재하는 대표 일정 (Mnet 수집본)
      // 배포용 schedules.json에는 synthetic으로 흡수되어 파트너(blip_1102873)는 baseItems에 없음!
      const primaryItem = {
        id: '6a48c48ac78482055163f5a9',
        title: 'KBS <키스 더 라디오>',
        startTime: '2026-08-20T22:00:00+09:00',
        endTime: '2026-08-20T23:00:00+09:00',
        typeText: '라디오',
        channel: 'KBS Cool FM',
        source: 'mnet',
        linkedScheduleIds: ['6a48c48ac78482055163f5a9', 'blip_1102873']
      };

      // 2. 다른 독립 일반 일정 (연관 일정 없음)
      const independentItem = {
        id: 'blip_999999',
        title: '독립 공식 일정 E',
        startTime: '2026-08-22T15:00:00+09:00',
        endTime: '2026-08-22T16:00:00+09:00',
        typeText: '방송',
        source: 'blip'
      };

      window.rawBaseSchedules = [JSON.parse(JSON.stringify(primaryItem)), JSON.parse(JSON.stringify(independentItem))];
      window.allSchedules = [JSON.parse(JSON.stringify(primaryItem)), JSON.parse(JSON.stringify(independentItem))];

      // 3. Gist의 sourceOverrides에는 상대방(blip_1102873)이 제목/시간 없이 오직 id와 linkedScheduleIds만 들어있음!
      const mockOverrides = {
        sourceOverrides: {
          '6a48c48ac78482055163f5a9': {
            id: '6a48c48ac78482055163f5a9',
            linkedScheduleIds: ['blip_1102873']
          },
          'blip_1102873': {
            id: 'blip_1102873',
            linkedScheduleIds: ['6a48c48ac78482055163f5a9']
          }
        }
      };

      if (window.appliedOverrides) {
        window.appliedOverrides.modified = mockOverrides.sourceOverrides;
      }

      if (typeof window.showApp === 'function') window.showApp();
      window.currentViewDate = new Date(2026, 7, 1);
      if (typeof window.renderSchedules === 'function') window.renderSchedules();
    });

    await page.waitForSelector('.date-group', { state: 'attached' });
  });

  test('1. should restore missing secondary items and render "🔗 연관 1건 합성" badge and sub-stack UI', async ({ page }) => {
    // 키스 더 라디오 카드 찾기
    const primaryCard = page.locator('.schedule-card', { hasText: 'KBS <키스 더 라디오>' });
    await expect(primaryCard).toBeVisible();

    // 1) 대표 카드에 "🔗 연관 1건 합성" 뱃지가 부착되어야 함
    const linkedBadge = primaryCard.locator('.state-badge:has-text("연관 1건 합성")');
    await expect(linkedBadge).toBeVisible();

    // 2) 카드 하단에 점선 테두리의 .linked-sub-stack이 존재해야 함
    const subStack = primaryCard.locator('.linked-sub-stack');
    await expect(subStack).toBeVisible();
    await expect(subStack).toContainText('함께 합성된 연관 일정 (1건)');

    // 3) 서브 카드 내부에 블립 출처 뱃지와 연계 제목, 수정 및 해제 버튼이 있어야 함
    const subCard = subStack.locator('.linked-sub-card');
    await expect(subCard).toHaveCount(1);
    await expect(subCard).toContainText('Blip');
    await expect(subCard.locator('button:has-text("✏️ 수정")')).toBeVisible();
    await expect(subCard.locator('button:has-text("🔗 해제")')).toBeVisible();
  });

  test('2. should unlink schedule pair when clicking [🔗 해제] button on sub-card', async ({ page }) => {
    const primaryCard = page.locator('.schedule-card', { hasText: 'KBS <키스 더 라디오>' });
    await expect(primaryCard).toBeVisible();

    // dialog confirm 자동 수락 핸들러 설정
    page.on('dialog', dialog => dialog.accept());

    // 서브 카드의 [🔗 해제] 버튼 클릭
    const unlinkBtn = primaryCard.locator('.linked-sub-stack .linked-sub-card button:has-text("🔗 해제")');
    await unlinkBtn.click();
    await page.waitForTimeout(400);

    // 연결 해제 후: 하단 스테이징 바가 나타나야 함
    const stagingBar = page.locator('#stagingBar');
    await expect(stagingBar).toBeVisible();

    // 연결이 해제되었으므로 대표 카드의 서브 스택 UI는 사라져야 함
    await expect(primaryCard.locator('.linked-sub-stack')).toHaveCount(0);
  });
});
