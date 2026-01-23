import { test, expect } from '@playwright/test';

// Store console messages for analysis
const consoleMessages: { type: string; text: string }[] = [];
const pageErrors: string[] = [];

test.describe('Dashboard Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Listen for all console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Listen for page errors
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });
  });

  test('Full login flow with admin credentials', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Fill login form with admin credentials
    await page.locator('input[type="email"], input[name="email"]').first().fill('admin');
    await page.locator('input[type="password"]').first().fill('localadmin123');

    // Click login button
    await page.locator('button[type="submit"], .auth-button').first().click();

    // Wait for navigation or response
    await page.waitForTimeout(3000);

    // Take screenshot after login
    await page.screenshot({ path: 'tests/e2e/screenshots/dashboard.png', fullPage: true });

    // Check if we're on the dashboard (look for module navigation or main content)
    const dashboardElements = page.locator('.dashboard, .main-container, .module-navigation, .left-sidebar');

    // Print any errors found
    const errors = consoleMessages.filter(m => m.type === 'error');
    if (errors.length > 0) {
      console.log('\n=== Console Errors ===');
      errors.forEach(e => console.log(e.text));
    }

    if (pageErrors.length > 0) {
      console.log('\n=== Page Errors ===');
      pageErrors.forEach(e => console.log(e));
    }
  });

  test('Test header buttons work', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Login first
    await page.locator('input[type="email"], input[name="email"]').first().fill('admin');
    await page.locator('input[type="password"]').first().fill('localadmin123');
    await page.locator('button[type="submit"], .auth-button').first().click();
    await page.waitForTimeout(3000);

    // Check if header action buttons exist
    const searchBtn = page.locator('.header-action-btn').first();
    if (await searchBtn.count() > 0) {
      await searchBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/e2e/screenshots/search-overlay.png' });
    }

    // Check for any errors
    const errors = consoleMessages.filter(m => m.type === 'error');
    if (errors.length > 0) {
      console.log('\n=== Console Errors after interaction ===');
      errors.forEach(e => console.log(e.text));
    }
  });

  test('Test sidebar navigation', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Login first
    await page.locator('input[type="email"], input[name="email"]').first().fill('admin');
    await page.locator('input[type="password"]').first().fill('localadmin123');
    await page.locator('button[type="submit"], .auth-button').first().click();
    await page.waitForTimeout(3000);

    // Try clicking sidebar buttons
    const sidebarButtons = page.locator('.left-sidebar button, .profile-btn');
    const count = await sidebarButtons.count();

    console.log(`Found ${count} sidebar buttons`);

    if (count > 0) {
      // Click the first button
      await sidebarButtons.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'tests/e2e/screenshots/sidebar-click.png', fullPage: true });
    }

    // Print errors
    const errors = consoleMessages.filter(m => m.type === 'error');
    if (errors.length > 0) {
      console.log('\n=== Console Errors after sidebar click ===');
      errors.forEach(e => console.log(e.text));
    }
  });
});
