// tests/e2e/ops-mobile-viewport.test.js
// 모바일 소형 뷰포트(375x667)에서 Ops 도구 카드 액션 버튼 및 수정 모달 2-Row 레이아웃 E2E 검증

import { test, expect } from '@playwright/test';
import path from 'path';

const rootDir = process.cwd();
const opsHtmlPath = path.resolve(rootDir, 'docs', 'ops-m7k2x9.html');
const opsHtmlUrl = `file://${opsHtmlPath}`;

test.describe('Ops Management Tool - Mobile Viewport Responsive UI', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should render cards and modal without text break or layout overflow on small mobile viewport', async ({ page }) => {
    // 1. 게이트웨이 우회용 로컬스토리지 주입 및 페이지 로드
    await page.addInitScript(() => {
      localStorage.setItem('remine_ops_token', 'm7k2x9_ops_secret_verified');
    });

    await page.goto(opsHtmlUrl);
    await page.waitForLoadState('domcontentloaded');

    // 2. 가상 일정 데이터 주입하여 일정 카드 및 모달 테스트 환경 구성
    await page.evaluate(() => {
      const testItem = {
        id: 'test_mobile_card_1',
        title: '[Re-log] 멍멍티비 in LA US | RESCENE vlog',
        startTime: '2026-09-01T20:00:00+09:00',
        endTime: '2026-09-01T20:00:00+09:00',
        typeText: '영상',
        channel: 'RESCENE',
        url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        location: 'LA US',
        source: 'blip',
        _isModified: true
      };

      window.rawBaseSchedules = [JSON.parse(JSON.stringify(testItem))];
      window.allSchedules = [JSON.parse(JSON.stringify(testItem))];
      window.currentViewDate = new Date(2026, 8, 1);

      if (typeof window.showApp === 'function') {
        window.showApp();
      }
      if (typeof window.renderSchedules === 'function') {
        window.renderSchedules();
      }
    });

    await page.waitForSelector('.date-group', { state: 'attached' });

    // 3. 카드 하단 액션 버튼 렌더링 확인
    const btnAction = page.locator('.btn-action').first();
    await expect(btnAction).toBeVisible();

    // 4. .btn-action의 white-space 계산 스타일이 'nowrap'인지 검증 (텍스트 세로 꺾임 방지)
    const whiteSpaceVal = await btnAction.evaluate(el => window.getComputedStyle(el).whiteSpace);
    expect(whiteSpaceVal).toBe('nowrap');

    // 5. 수정 모달 열기
    await page.evaluate(() => {
      if (typeof window.openEditModalByKey === 'function') {
        window.openEditModalByKey('test_mobile_card_1');
      }
    });

    const editModal = page.locator('#editModalOverlay');
    await expect(editModal).toHaveClass(/active/);

    // 6. 모달 하단 버튼(.sheet-buttons) 스타일 검증: 모바일 2-Row 레이아웃
    const btnSave = page.locator('#btnModalSave');
    await expect(btnSave).toBeVisible();

    // 저장하기 버튼 폭이 모달 내부 너비의 85% 이상(풀 폭 단독) 차지하는지 검증
    const btnSaveBox = await btnSave.boundingBox();
    const sheetBox = await page.locator('.bottom-sheet').boundingBox();
    expect(btnSaveBox).not.toBeNull();
    expect(sheetBox).not.toBeNull();
    expect(btnSaveBox.width).toBeGreaterThan(sheetBox.width * 0.85);

    // 7. 공식 원본 복원 버튼 및 숨기기 버튼의 텍스트가 줄바꿈 없이 한 줄로 유지되는지 확인
    const btnDel = page.locator('#btnModalDelete');
    const delWhiteSpace = await btnDel.evaluate(el => window.getComputedStyle(el).whiteSpace);
    expect(delWhiteSpace).toBe('nowrap');
  });
});
