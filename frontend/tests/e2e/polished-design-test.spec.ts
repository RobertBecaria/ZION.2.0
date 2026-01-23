import { test, expect } from '@playwright/test';

test.describe('Polished Design System Tests', () => {
  test('Login page - Light Mode', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Capture console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Take screenshot
    await page.screenshot({
      path: 'tests/e2e/screenshots/polished-login-light.png',
      fullPage: true
    });

    // Verify auth card is visible and styled
    const authCard = page.locator('.auth-card');
    await expect(authCard).toBeVisible();

    // Check for proper styling - card should have background
    const cardBackground = await authCard.evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(cardBackground).not.toBe('rgba(0, 0, 0, 0)');

    // Log any console errors
    if (errors.length > 0) {
      console.log('Console errors:', errors);
    }
    expect(errors.length).toBe(0);

    console.log('Login page light mode test passed!');
  });

  test('Dashboard - Light and Dark Mode', async ({ page }) => {
    const timestamp = Date.now();
    const testEmail = `polished${timestamp}@test.com`;
    const testPassword = 'Test123Pass';

    // Register new user
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Switch to registration
    await page.click('text=Зарегистрироваться');
    await page.waitForTimeout(500);

    // Fill registration form
    await page.fill('input[type="email"], input[name="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);

    const confirmPass = page.locator('input[type="password"]').nth(1);
    if (await confirmPass.count() > 0) {
      await confirmPass.fill(testPassword);
    }

    const firstName = page.locator('input[name="first_name"]');
    if (await firstName.count() > 0) {
      await firstName.fill('Polished');
    }

    const lastName = page.locator('input[name="last_name"]');
    if (await lastName.count() > 0) {
      await lastName.fill('Test');
    }

    // Submit registration
    await page.click('button[type="submit"], .auth-button');
    await page.waitForTimeout(2000);

    // Complete onboarding if present
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

    // Take LIGHT MODE dashboard screenshot
    await page.screenshot({
      path: 'tests/e2e/screenshots/polished-dashboard-light.png',
      fullPage: true
    });

    // Test sidebar navigation (light mode)
    const sidebarButtons = page.locator('.profile-btn').first();
    if (await sidebarButtons.count() > 0) {
      await sidebarButtons.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: 'tests/e2e/screenshots/polished-sidebar-light.png',
        fullPage: true
      });
    }

    // Test module navigation
    const moduleButtons = page.locator('.nav-module');
    const moduleCount = await moduleButtons.count();
    if (moduleCount > 1) {
      await moduleButtons.nth(1).click();
      await page.waitForTimeout(800);
      await page.screenshot({
        path: 'tests/e2e/screenshots/polished-module-light.png',
        fullPage: true
      });
    }

    // Click theme toggle to switch to DARK MODE
    const themeToggle = page.locator('.theme-toggle-btn');
    if (await themeToggle.count() > 0 && await themeToggle.isVisible()) {
      await themeToggle.click();
      await page.waitForTimeout(500);

      // Verify dark class is applied
      const isDark = await page.evaluate(() =>
        document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark')
      );
      expect(isDark).toBe(true);

      // Take DARK MODE dashboard screenshot
      await page.screenshot({
        path: 'tests/e2e/screenshots/polished-dashboard-dark.png',
        fullPage: true
      });

      // Test module navigation in dark mode
      if (moduleCount > 0) {
        await moduleButtons.first().click();
        await page.waitForTimeout(800);
        await page.screenshot({
          path: 'tests/e2e/screenshots/polished-module-dark.png',
          fullPage: true
        });
      }

      // Test sidebar in dark mode
      if (await sidebarButtons.count() > 0) {
        await sidebarButtons.click();
        await page.waitForTimeout(500);
        await page.screenshot({
          path: 'tests/e2e/screenshots/polished-sidebar-dark.png',
          fullPage: true
        });
      }

      // Toggle back to light mode
      await themeToggle.click();
      await page.waitForTimeout(500);

      const isLight = await page.evaluate(() =>
        !document.documentElement.classList.contains('dark') &&
        !document.body.classList.contains('dark')
      );
      expect(isLight).toBe(true);
    }

    // Test search overlay
    const searchBtn = page.locator('.header-action-btn').first();
    if (await searchBtn.count() > 0) {
      await searchBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: 'tests/e2e/screenshots/polished-search.png',
        fullPage: true
      });

      // Close search
      const closeBtn = page.locator('.global-search-close');
      if (await closeBtn.count() > 0) {
        await closeBtn.click();
        await page.waitForTimeout(300);
      }
    }

    // Test quick create menu
    const quickCreateBtn = page.locator('.header-action-btn').nth(1);
    if (await quickCreateBtn.count() > 0 && await quickCreateBtn.isVisible()) {
      await quickCreateBtn.click();
      await page.waitForTimeout(500);

      const quickCreateMenu = page.locator('.quick-create-menu');
      if (await quickCreateMenu.count() > 0) {
        await page.screenshot({
          path: 'tests/e2e/screenshots/polished-quickcreate.png',
          fullPage: true
        });
      }

      // Close by clicking backdrop
      const backdrop = page.locator('.quick-create-backdrop');
      if (await backdrop.count() > 0) {
        await backdrop.click();
        await page.waitForTimeout(300);
      }
    }

    console.log('Polished design tests completed successfully!');
    console.log(`Screenshots saved to tests/e2e/screenshots/`);
  });

  test('Button sizing and spacing verification', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Verify auth button has correct sizing
    const authButton = page.locator('.auth-button, button[type="submit"]').first();
    if (await authButton.count() > 0) {
      const buttonHeight = await authButton.evaluate(el =>
        parseInt(window.getComputedStyle(el).height)
      );

      // Button should be at least 40px tall (standard medium button)
      expect(buttonHeight).toBeGreaterThanOrEqual(40);

      // Check font weight is semibold (600)
      const fontWeight = await authButton.evaluate(el =>
        window.getComputedStyle(el).fontWeight
      );
      expect(parseInt(fontWeight)).toBeGreaterThanOrEqual(600);
    }

    console.log('Button sizing verification passed!');
  });
});
