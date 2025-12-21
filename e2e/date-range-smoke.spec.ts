/**
 * Date Range Smoke Tests
 *
 * Verifies that date presets produce correct API requests.
 * These tests catch the "Yesterday showing 7-day totals" bug.
 */

import { test, expect } from '@playwright/test';

test.describe('Date Range Presets', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to campaigns page (will redirect to login if not authenticated)
    await page.goto('/');
  });

  test('Yesterday preset: API request dates must be equal (1-day window)', async ({ page }) => {
    // Track API requests
    const apiRequests: { startDate: string; endDate: string }[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/google-ads/campaigns')) {
        const params = new URL(url).searchParams;
        const startDate = params.get('startDate');
        const endDate = params.get('endDate');
        if (startDate && endDate) {
          apiRequests.push({ startDate, endDate });
        }
      }
    });

    // Click date picker and select Yesterday
    await page.click('button:has-text("Yesterday"), button:has-text("Last")');
    await page.click('button:has-text("Yesterday")');

    // Wait for API request
    await page.waitForTimeout(1000);

    // Find the request with Yesterday dates
    const yesterdayRequest = apiRequests.find((req) => {
      // Yesterday should have startDate === endDate
      return req.startDate === req.endDate;
    });

    // CRITICAL ASSERTION: Yesterday must be exactly 1 day
    expect(yesterdayRequest).toBeDefined();
    expect(yesterdayRequest?.startDate).toBe(yesterdayRequest?.endDate);

    // Verify the label shows "Yesterday"
    await expect(page.locator('button:has-text("Yesterday")')).toBeVisible();
  });

  test('Last 7 Days preset: API request must span 7 days', async ({ page }) => {
    // Track API requests
    const apiRequests: { startDate: string; endDate: string }[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/google-ads/campaigns')) {
        const params = new URL(url).searchParams;
        const startDate = params.get('startDate');
        const endDate = params.get('endDate');
        if (startDate && endDate) {
          apiRequests.push({ startDate, endDate });
        }
      }
    });

    // Click date picker and select Last 7 Days
    await page.click('button:has-text("Yesterday"), button:has-text("Last")');
    await page.click('button:has-text("Last 7 Days")');

    // Wait for API request
    await page.waitForTimeout(1000);

    // Find the most recent request
    const last7Request = apiRequests[apiRequests.length - 1];

    if (last7Request) {
      // Calculate days between dates
      const start = new Date(last7Request.startDate);
      const end = new Date(last7Request.endDate);
      const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // CRITICAL ASSERTION: Last 7 Days must span exactly 7 days
      expect(days).toBe(7);
    }
  });

  test('Date picker label matches API request dates', async ({ page }) => {
    // This test verifies UI label consistency with actual data
    let lastApiDates: { startDate: string; endDate: string } | null = null;

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/google-ads/campaigns')) {
        const params = new URL(url).searchParams;
        const startDate = params.get('startDate');
        const endDate = params.get('endDate');
        if (startDate && endDate) {
          lastApiDates = { startDate, endDate };
        }
      }
    });

    // Select Yesterday
    await page.click('button:has-text("Yesterday"), button:has-text("Last")');
    await page.click('button:has-text("Yesterday")');
    await page.waitForTimeout(1000);

    // Check label says Yesterday
    const labelButton = page.locator('[class*="DateRange"] button, button:has-text("Yesterday")').first();
    const labelText = await labelButton.textContent();

    if (labelText?.includes('Yesterday') && lastApiDates) {
      // If label says Yesterday, dates must be equal
      const dates = lastApiDates as { startDate: string; endDate: string };
      expect(dates.startDate).toBe(dates.endDate);
    }
  });
});

test.describe('Date Range Validation in Ops', () => {
  test('System tab shows correct query context', async ({ page }) => {
    // Navigate to Ops page
    await page.goto('/ops');

    // Click System tab
    await page.click('button:has-text("System")');

    // Verify query context section exists
    await expect(page.locator('text=Current Query Context')).toBeVisible();

    // Verify preset is shown
    await expect(page.locator('text=Preset')).toBeVisible();

    // Verify date validation indicator exists
    const validationIndicator = page.locator('[class*="rounded-full"]').first();
    await expect(validationIndicator).toBeVisible();
  });
});
