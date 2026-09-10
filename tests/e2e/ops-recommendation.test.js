// tests/e2e/ops-recommendation.test.js
import { test, expect } from '@playwright/test';
import path from 'path';

// Helper: absolute file URL for the ops page
const opsPagePath = path.resolve(process.cwd(), 'docs', 'ops-m7k2x9.html');
const opsPageUrl = `file://${opsPagePath}`;

// Sample meta data used for rendering suggestion chips
const sampleMeta = {
  title: 'Test Title',
  date: '2023-01-01',
  type: '방송',
  channel: 'TestChannel',
  location: 'Seoul',
  message: 'Test Message'
};

test.describe('Ops Management Tool - Recommendation Chips', () => {
  test.beforeEach(async ({ page }) => {
    // Load the ops page
    await page.goto(opsPageUrl);
    // Ensure the page is fully loaded
    await page.waitForLoadState('domcontentloaded');
    // Inject meta data and render the preview panel
    await page.evaluate((meta) => {
      // 모달을 먼저 활성화하여 내부 요소가 visible 상태가 되도록 함
      const overlay = document.getElementById('editModalOverlay');
      if (overlay) overlay.classList.add('active');
      // The script defines renderMetaPreviewPanel globally
      if (typeof window.renderMetaPreviewPanel === 'function') {
        window.renderMetaPreviewPanel(meta);
      }
    }, sampleMeta);
    // Wait for suggestion chips to appear (state:attached: DOM에 존재하면 통과)
    await page.waitForSelector('.suggest-chip', { state: 'attached' });
  });

  test('should display suggestion chips for each field', async ({ page }) => {
    const chips = await page.$$('.suggest-chip');
    // Expect chips for title, date, type, channel, location, message
    expect(chips.length).toBeGreaterThanOrEqual(6);
  });

  test('clicking a chip applies its value to the corresponding form field and does not submit/close modal', async ({ page }) => {
    // Click the title suggestion chip (first chip)
    const titleChip = await page.$('#suggestTitle .suggest-chip');
    expect(titleChip).not.toBeNull();
    await titleChip.click();
    // Verify the title input now contains the meta title
    const titleValue = await page.$eval('#formTitle', el => el.value);
    expect(titleValue).toBe(sampleMeta.title);
    // Verify modal overlay is still active (not closed by form submission)
    const isModalActive = await page.$eval('#editModalOverlay', el => el.classList.contains('active'));
    expect(isModalActive).toBe(true);
  });

  test('apply all button fills all empty fields, respects existing input, and does not close modal', async ({ page }) => {
    // Pre-fill the title field with custom value
    await page.fill('#formTitle', 'Custom Title');
    // Click the "전체 적용" button (apply-all-btn)
    const applyAllBtn = await page.$('.apply-all-btn');
    expect(applyAllBtn).not.toBeNull();
    await applyAllBtn.click();
    // Title should remain the custom value
    const titleAfter = await page.$eval('#formTitle', el => el.value);
    expect(titleAfter).toBe('Custom Title');
    // Other fields should now be populated from meta
    const dateValue = await page.$eval('#formDate', el => el.value);
    expect(dateValue).toBe(sampleMeta.date);
    const typeValue = await page.$eval('#formType', el => el.value);
    expect(typeValue).toBe(sampleMeta.type);
    const channelValue = await page.$eval('#formChannel', el => el.value);
    expect(channelValue).toBe(sampleMeta.channel);
    const locationValue = await page.$eval('#formLocation', el => el.value);
    expect(locationValue).toBe(sampleMeta.location);
    const messageValue = await page.$eval('#formMessage', el => el.value);
    expect(messageValue).toBe(sampleMeta.message);
    // Verify modal overlay is still active
    const isModalActive = await page.$eval('#editModalOverlay', el => el.classList.contains('active'));
    expect(isModalActive).toBe(true);
  });

  test('should clear suggestion chips when clearUrlMetaPreview is called', async ({ page }) => {
    // Call clearUrlMetaPreview
    await page.evaluate(() => {
      if (typeof window.clearUrlMetaPreview === 'function') {
        window.clearUrlMetaPreview();
      }
    });
    // Check that all suggest containers are empty or hidden
    const count = await page.$$eval('.suggest-chip', chips => chips.length);
    expect(count).toBe(0);
  });

  test('clicking live preview card opens detail preview popup', async ({ page }) => {
    // Fill title
    await page.fill('#formTitle', 'Preview Test Title');
    await page.locator('#formLivePreviewCard').dispatchEvent('click');
    await page.waitForSelector('#userPreviewDetailLayer', { state: 'visible' });
    const detailTitle = await page.$eval('#updTitle', el => el.textContent);
    expect(detailTitle).toBe('Preview Test Title');
  });
});
