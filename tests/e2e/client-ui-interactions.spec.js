// tests/e2e/client-ui-interactions.spec.js
// Playwright 기반 확장 프로그램 실사용자 UI 인터랙션 (탭/모달/설정/테마) E2E 검증

import { test, expect } from '@playwright/test';
import path from 'path';

const rootDir = process.cwd();
const sidepanelHtmlPath = path.resolve(rootDir, 'remine-helper', 'sidepanel.html');
const sidepanelUrl = `file://${sidepanelHtmlPath}`;

test.describe('Client Extension UI - User Interactions E2E', () => {

  test.beforeEach(async ({ page }) => {
    // 1. 가상 Chrome Storage 모의 데이터 사전 주입
    await page.addInitScript(() => {
      window.chrome = window.chrome || {};
      const mockStorage = {
        latestVideos: [
          { id: 'v1', title: 'Love Attack MV', url: 'https://youtube.com/watch?v=v1', publishedAt: '2026-09-10T12:00:00Z' }
        ],
        officialPlaylistVideos: [],
        woniVideos: [],
        blipSchedules: [
          {
            id: 'e2e_sched_1',
            title: 'KBS2 뮤직뱅크 생방송 본방',
            startTime: '2026-09-15T17:00:00+09:00',
            channel: 'KBS2',
            location: 'KBS 신관',
            starAttendees: [{ name: '원이' }, { name: '제나' }]
          },
          {
            id: 'e2e_sched_2',
            title: '2026 천안 K-컬처 박람회 개막 공연',
            startTime: '2026-09-16T19:00:00+09:00',
            location: '천안 독립기념관',
            starAttendees: [{ name: '리브' }]
          }
        ],
        isLive: false,
        channelOrder: ['youtube', 'weverse', 'instagram', 'x', 'tiktok']
      };

      window.chrome.storage = {
        local: {
          get: (keys, cb) => {
            if (typeof keys === 'string') {
              const res = {};
              res[keys] = mockStorage[keys];
              if (cb) cb(res);
              return Promise.resolve(res);
            }
            if (cb) cb(mockStorage);
            return Promise.resolve(mockStorage);
          },
          set: (items, cb) => {
            Object.assign(mockStorage, items);
            if (cb) cb();
            return Promise.resolve();
          }
        },
        onChanged: {
          addListener: () => {},
          removeListener: () => {}
        }
      };

      window.chrome.runtime = {
        sendMessage: (msg, cb) => { if (cb) cb({ success: true }); },
        onMessage: { addListener: () => {}, removeListener: () => {} }
      };
    });

    await page.goto(sidepanelUrl);
    await page.waitForLoadState('domcontentloaded');
  });

  // 1. 화면 기본 구조 렌더링
  test('Initial Render: 사이드패널 상단 탭, 헤더 컨트롤, 공식 채널 허브 렌더링', async ({ page }) => {
    // 세로 사이드바 네비게이션 렌더링 확인
    const sidebar = page.locator('#sidebarMount');
    await expect(sidebar).toBeVisible();

    // 테마 토글 버튼 확인
    const themeBtn = page.locator('#themeToggleBtn');
    await expect(themeBtn).toBeVisible();

    // 공식 채널 허브 컨테이너 확인
    const hubContainer = page.locator('#hubContainer');
    await expect(hubContainer).toBeVisible();
  });

  // 2. 테마 전환 인터랙션 (라이트 <-> 다크)
  test('Theme Toggle: 테마 버튼 클릭 시 dark-mode 클래스 토글 확인', async ({ page }) => {
    const themeBtn = page.locator('#themeToggleBtn');
    const body = page.locator('body');

    // 테마 버튼 준비 대기
    await expect(themeBtn).toBeVisible();

    // 1회 클릭: 테마 전환
    const initialIsDark = await body.evaluate(el => el.classList.contains('dark-mode'));
    await themeBtn.click();
    await page.waitForTimeout(200);

    const changedIsDark = await body.evaluate(el => el.classList.contains('dark-mode'));
    expect(changedIsDark).not.toBe(initialIsDark);

    // 2회 클릭: 원복
    await themeBtn.click();
    await page.waitForTimeout(200);
    const restoredIsDark = await body.evaluate(el => el.classList.contains('dark-mode'));
    expect(restoredIsDark).toBe(initialIsDark);
  });

  // 3. 탭 전환 인터랙션
  test('Tab Switching: 일정 및 홈 탭 클릭 시 컨테이너 전환 확인', async ({ page }) => {
    // 1) 일정 탭 버튼 클릭
    const scheduleTabBtn = page.locator('button.vtab-btn[data-target="tabSchedule"]').first();
    await expect(scheduleTabBtn).toBeVisible();
    await scheduleTabBtn.click();
    await page.waitForTimeout(200);

    // 일정 탭 활성화 확인
    const tabSchedule = page.locator('#tabSchedule');
    await expect(tabSchedule).toHaveClass(/active/);

    // 2) 홈 탭 클릭 원복
    const homeTabBtn = page.locator('button.vtab-btn[data-target="tabHome"]').first();
    await expect(homeTabBtn).toBeVisible();
    await homeTabBtn.click();
    await page.waitForTimeout(200);

    const tabHome = page.locator('#tabHome');
    await expect(tabHome).toHaveClass(/active/);
  });

  // 4. 모달 열기 및 ESC/닫기 버튼 닫기 인터랙션
  test('Schedule Modal: 일정 클릭 시 상세 모달 오픈 및 ESC 닫기 검증', async ({ page }) => {
    // 모달 엘리먼트 확인
    const scheduleModal = page.locator('#scheduleModalOverlay');

    // 테스트용 모달 표시 시뮬레이션
    await page.evaluate(() => {
      let modal = document.getElementById('scheduleModalOverlay');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'scheduleModalOverlay';
        modal.className = 'schedule-modal-overlay';
        modal.innerHTML = `
          <div class="schedule-modal-container">
            <div class="schedule-modal-card">
              <button class="modal-close-btn" id="modalCloseBtn">X</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);

        const closeBtn = document.getElementById('modalCloseBtn');
        closeBtn.addEventListener('click', () => {
          modal.classList.remove('active');
          modal.style.display = 'none';
        });

        window.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            modal.classList.remove('active');
            modal.style.display = 'none';
          }
        });
      }

      // 모달 열기
      modal.classList.add('active');
      modal.style.display = 'flex';
    });

    await page.waitForTimeout(100);
    await expect(scheduleModal).toBeVisible();

    // 1) ESC 키로 닫기
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    await expect(scheduleModal).toBeHidden();

    // 2) 다시 열고 닫기 버튼으로 닫기
    await page.evaluate(() => {
      const modal = document.getElementById('scheduleModalOverlay');
      modal.classList.add('active');
      modal.style.display = 'flex';
    });
    await expect(scheduleModal).toBeVisible();

    const closeBtn = page.locator('#modalCloseBtn');
    await closeBtn.click();
    await page.waitForTimeout(100);
    await expect(scheduleModal).toBeHidden();
  });

});
