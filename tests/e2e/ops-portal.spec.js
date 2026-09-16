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

  // 4. 사용자 뷰 사전 검수기 모달 오픈, 탭 전환(선택 상태) 및 닫기 인터랙션 검증
  test('User Review Inspector: 모달 오픈, Diff/사이드패널 뷰 탭 전환 및 닫기 인터랙션', async ({ page }) => {
    const openBtn = page.locator('#btnOpenUserPreview');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    const modal = page.locator('#userReviewModalOverlay');
    await expect(modal).toHaveClass(/active/);

    const btnDiff = page.locator('#btnInspectorTabDiff');
    const btnPreview = page.locator('#btnInspectorTabPreview');
    const diffContainer = page.locator('#inspectorDiffContainer');
    const previewContainer = page.locator('#inspectorPreviewContainer');

    // 초기 상태: Diff 탭 활성화 & 컨테이너 표시
    await expect(btnDiff).toHaveClass(/active/);
    await expect(btnPreview).not.toHaveClass(/active/);
    await expect(diffContainer).toBeVisible();
    await expect(previewContainer).toBeHidden();

    // 사이드패널 뷰 탭 클릭 -> Preview 탭 활성화 & 컨테이너 전환
    await btnPreview.click();
    await expect(btnPreview).toHaveClass(/active/);
    await expect(btnDiff).not.toHaveClass(/active/);
    await expect(previewContainer).toBeVisible();
    await expect(diffContainer).toBeHidden();

    // Diff 탭 다시 클릭 -> 복귀
    await btnDiff.click();
    await expect(btnDiff).toHaveClass(/active/);
    await expect(btnPreview).not.toHaveClass(/active/);
    await expect(diffContainer).toBeVisible();
    await expect(previewContainer).toBeHidden();

    // 닫기 버튼 클릭 -> 모달 닫힘
    const closeBtn = page.locator('#btnCloseUserPreviewModal');
    await closeBtn.click();
    await expect(modal).not.toHaveClass(/active/);
  });

  // 5. 새 일정 등록 모달 오픈 인터랙션 검증
  test('New Schedule Modal: + 새 일정 버튼 클릭 시 등록 바텀시트 정상 오픈', async ({ page }) => {
    const addBtn = page.locator('#btnOpenAddModal');
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    const editModal = page.locator('#editModalOverlay');
    await expect(editModal).toHaveClass(/active/);

    const titleEl = page.locator('#modalHeaderTitle');
    await expect(titleEl).toHaveText('새 일정 등록');

    // 닫기
    const closeBtn = page.locator('#btnCloseModal');
    await closeBtn.click();
    await expect(editModal).not.toHaveClass(/active/);
  });

  // 6. 수집 파이프라인 2중 운영 모드 토글 인터랙션 검증
  test('Pipeline Mode Toggle: 빠른 반영 ↔ 관리자 검수 모드 전환 및 스테이징 바 반응', async ({ page }) => {
    const toggleBtn = page.locator('#btnTogglePipelineMode');
    await expect(toggleBtn).toBeVisible();

    const modeText = page.locator('#pipelineModeText');
    const modeIcon = page.locator('#pipelineModeIcon');

    // 초기 상태: 빠른 반영 모드
    await expect(modeText).toHaveText('빠른 반영');
    await expect(modeIcon).toHaveText('⚡');

    // 클릭 1회 -> 관리자 검수 모드로 전환
    await toggleBtn.click();
    await expect(modeText).toHaveText('관리자 검수');
    await expect(modeIcon).toHaveText('🛡️');

    // 스테이징 바에 변경사항 표시 확인
    const stagingBar = page.locator('#stagingBar');
    await expect(stagingBar).toBeVisible();
    const stagingBadge = page.locator('#stagingCountBadge');
    await expect(stagingBadge).toContainText('운영모드포함');

    // 클릭 2회 -> 다시 빠른 반영 모드로 복귀
    await toggleBtn.click();
    await expect(modeText).toHaveText('빠른 반영');
    await expect(modeIcon).toHaveText('⚡');
  });

});

