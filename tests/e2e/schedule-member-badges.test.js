// tests/e2e/schedule-member-badges.test.js
// 클라이언트 캘린더 UI에서 starAttendees 멤버 14px 미니 아바타 뱃지 실제 DOM 렌더링 E2E 검증

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { createScheduleItemHTML } from '../../remine-helper/common/modules/calendar.js';

const rootDir = process.cwd();
const commonHtmlPath = path.resolve(rootDir, 'remine-helper', 'common', 'common.html');
const commonHtmlUrl = `file://${commonHtmlPath}`;
const schedulesJsonPath = path.resolve(rootDir, 'docs', 'api', 'v1', 'schedules.json');

test.describe('Schedule UI - starAttendees 14px Mini Avatar Badges', () => {
  test('should render 14px member avatar badges for schedules with starAttendees', async ({ page }) => {
    // 1. 실제 복원된 schedules.json 로드
    const schedulesData = JSON.parse(fs.readFileSync(schedulesJsonPath, 'utf8'));
    const itemWithAttendees = schedulesData.items.find(x => x.starAttendees && x.starAttendees.length >= 2);
    expect(itemWithAttendees).toBeDefined();

    // 2. 브라우저에서 common.html 로드
    await page.goto(commonHtmlUrl);
    await page.waitForLoadState('domcontentloaded');

    // 3. Node에서 calendar 엔진을 통해 HTML 생성 후 브라우저 DOM에 주입
    const cardHtml = createScheduleItemHTML(itemWithAttendees, 0);
    await page.evaluate((html) => {
      const container = document.getElementById('scheduleList');
      if (container) {
        container.innerHTML = html;
      }
    }, cardHtml);

    // 4. 스케줄 카드 렌더링 확인
    const scheduleItem = page.locator('.schedule-item').first();
    await expect(scheduleItem).toBeVisible();

    // 5. 참석 멤버 14px 미니 아바타 뱃지 DOM 검증 (.attendee-mini-avatar)
    const attendeeAvatars = page.locator('.attendee-mini-avatar');
    const badgeCount = await attendeeAvatars.count();
    expect(badgeCount).toBeGreaterThanOrEqual(2);

    // 각 참석 멤버별 아바타 이미지 및 title 속성 검증
    for (const attendee of itemWithAttendees.starAttendees) {
      const avatarImg = page.locator(`.attendee-mini-avatar[title="${attendee.name}"]`);
      await expect(avatarImg).toBeVisible();

      // 14px 너비/높이 인라인/계산 스타일 검증
      const imgWidth = await avatarImg.evaluate(el => window.getComputedStyle(el).width);
      const imgHeight = await avatarImg.evaluate(el => window.getComputedStyle(el).height);
      expect(imgWidth).toBe('14px');
      expect(imgHeight).toBe('14px');
    }
  });

  test('should render clean schedule card when starAttendees is empty or undefined', async ({ page }) => {
    await page.goto(commonHtmlUrl);
    await page.waitForLoadState('domcontentloaded');

    const itemWithoutAttendees = {
      id: 'test-no-attendees',
      title: '일반 스케줄 테스트 (참석자 없음)',
      startTime: '2026-09-20T10:00:00.000Z',
      channel: '유튜브'
    };

    const cardHtml = createScheduleItemHTML(itemWithoutAttendees, 0);
    await page.evaluate((html) => {
      const container = document.getElementById('scheduleList');
      if (container) {
        container.innerHTML = html;
      }
    }, cardHtml);

    // 멤버 뱃지가 생성되지 않고 카드만 깔끔하게 렌더링되는지 확인
    const attendeeAvatars = page.locator('.attendee-mini-avatar');
    expect(await attendeeAvatars.count()).toBe(0);
  });
});
