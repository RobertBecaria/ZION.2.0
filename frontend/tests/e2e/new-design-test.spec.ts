import { test, expect } from '@playwright/test';

test.describe('New Design Tests', () => {
  test('Login page with new design', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Take screenshot
    await page.screenshot({ path: 'tests/e2e/screenshots/new-design-login.png', fullPage: true });

    // Verify auth card is visible
    const authCard = page.locator('.auth-card');
    await expect(authCard).toBeVisible();
  });

  test('Dashboard with new design', async ({ page }) => {
    const timestamp = Date.now();
    const testEmail = `design${timestamp}@test.com`;
    const testPassword = 'Test123Pass';

    // Register new user
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Switch to registration
    await page.click('text=Зарегистрироваться');
    await page.waitForTimeout(500);

    // Fill form
    await page.fill('input[type="email"], input[name="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);

    const confirmPass = page.locator('input[type="password"]').nth(1);
    if (await confirmPass.count() > 0) {
      await confirmPass.fill(testPassword);
    }

    const firstName = page.locator('input[name="first_name"]');
    if (await firstName.count() > 0) {
      await firstName.fill('Design');
    }

    const lastName = page.locator('input[name="last_name"]');
    if (await lastName.count() > 0) {
      await lastName.fill('Test');
    }

    // Submit
    await page.click('button[type="submit"], .auth-button');
    await page.waitForTimeout(2000);

    // Complete onboarding
    const genderOption = page.getByText('Мужчина').first();
    if (await genderOption.count() > 0) {
      await genderOption.click();
      await page.waitForTimeout(500);
      const continueBtn = page.getByRole('button', { name: /Продолжить|Continue/i }).first();
      if (await continueBtn.count() > 0) {
        await continueBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // Take dashboard screenshot
    await page.screenshot({ path: 'tests/e2e/screenshots/new-design-dashboard.png', fullPage: true });

    // Click through modules
    const moduleButtons = page.locator('.nav-module');
    const moduleCount = await moduleButtons.count();

    if (moduleCount > 0) {
      // Family module
      await moduleButtons.first().click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: 'tests/e2e/screenshots/new-design-family.png', fullPage: true });

      // News module
      if (moduleCount > 1) {
        await moduleButtons.nth(1).click();
        await page.waitForTimeout(800);
        await page.screenshot({ path: 'tests/e2e/screenshots/new-design-news.png', fullPage: true });
      }

      // Journal module
      if (moduleCount > 2) {
        await moduleButtons.nth(2).click();
        await page.waitForTimeout(800);
        await page.screenshot({ path: 'tests/e2e/screenshots/new-design-journal.png', fullPage: true });
      }
    }

    // Test sidebar interaction
    const sidebarButtons = page.locator('.profile-btn').first();
    if (await sidebarButtons.count() > 0) {
      await sidebarButtons.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/e2e/screenshots/new-design-sidebar-click.png', fullPage: true });
    }

    // Test header buttons
    const searchBtn = page.locator('.header-action-btn').first();
    if (await searchBtn.count() > 0) {
      await searchBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/e2e/screenshots/new-design-search.png', fullPage: true });

      // Close search
      const closeBtn = page.locator('.global-search-close');
      if (await closeBtn.count() > 0) {
        await closeBtn.click();
      }
    }

    console.log('New design tests completed successfully!');
  });
});
