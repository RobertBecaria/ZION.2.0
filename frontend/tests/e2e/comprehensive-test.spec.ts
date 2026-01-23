import { test, expect } from '@playwright/test';

// Collect all console messages
const consoleMessages: { type: string; text: string }[] = [];
const pageErrors: string[] = [];
const networkErrors: string[] = [];

test.describe('Comprehensive Frontend Tests', () => {
  test.beforeEach(async ({ page }) => {
    consoleMessages.length = 0;
    pageErrors.length = 0;
    networkErrors.length = 0;

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // Monitor network failures
    page.on('requestfailed', request => {
      networkErrors.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
    });
  });

  test('Complete user registration and dashboard test', async ({ page }) => {
    const timestamp = Date.now();
    const testEmail = `e2etest${timestamp}@example.com`;
    const testPassword = 'Test123Pass';

    // Step 1: Navigate to app
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    console.log('Step 1: Loaded login page');

    // Step 2: Switch to registration
    await page.click('text=Зарегистрироваться');
    await page.waitForTimeout(500);
    console.log('Step 2: Switched to registration form');

    // Step 3: Fill registration form
    await page.fill('input[name="email"], input[type="email"]', testEmail);
    await page.fill('input[name="password"], input[type="password"]', testPassword);

    // Fill confirm password if exists
    const confirmPass = page.locator('input[type="password"]').nth(1);
    if (await confirmPass.count() > 0) {
      await confirmPass.fill(testPassword);
    }

    // Fill first name
    const firstName = page.locator('input[name="first_name"]');
    if (await firstName.count() > 0) {
      await firstName.fill('E2E');
    }

    // Fill last name
    const lastName = page.locator('input[name="last_name"]');
    if (await lastName.count() > 0) {
      await lastName.fill('TestUser');
    }
    console.log('Step 3: Filled registration form');

    // Step 4: Submit registration
    await page.click('button[type="submit"], .auth-button');
    await page.waitForTimeout(2000);
    console.log('Step 4: Submitted registration');

    // Step 5: Check if we're past the login page
    const onboardingOrDashboard = page.locator('.onboarding-container, .dashboard, .main-container, .gender-modal');
    await page.screenshot({ path: 'tests/e2e/screenshots/step5-after-reg.png', fullPage: true });

    // Step 6: Complete onboarding if present
    const genderModal = page.locator('.gender-modal').or(page.getByText('Укажите ваш пол'));
    if (await genderModal.count() > 0) {
      console.log('Step 6: Gender selection modal found');
      // Select male option
      const maleOption = page.getByText('Мужчина').first();
      if (await maleOption.count() > 0) {
        await maleOption.click();
        await page.waitForTimeout(500);
      }
      // Click continue
      const continueBtn = page.getByRole('button', { name: /Продолжить|Continue/i }).first();
      if (await continueBtn.count() > 0) {
        await continueBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // Step 7: Continue through any remaining onboarding
    const onboardingNext = page.locator('.onboarding-actions button').or(page.getByRole('button', { name: /Далее|Next/i }));
    let attempts = 0;
    while (await onboardingNext.count() > 0 && attempts < 5) {
      await onboardingNext.first().click();
      await page.waitForTimeout(1000);
      attempts++;
      console.log(`Step 7: Clicked onboarding next (attempt ${attempts})`);
    }

    await page.screenshot({ path: 'tests/e2e/screenshots/step7-dashboard.png', fullPage: true });

    // Step 8: Verify dashboard elements
    const leftSidebar = page.locator('.left-sidebar');
    const mainContent = page.locator('.main-content-area, .content-area');

    if (await leftSidebar.count() > 0) {
      console.log('Step 8: Left sidebar visible');
    }
    if (await mainContent.count() > 0) {
      console.log('Step 8: Main content visible');
    }

    // Step 9: Test module navigation buttons
    const moduleButtons = page.locator('.nav-module, .module-navigation button');
    const moduleCount = await moduleButtons.count();
    console.log(`Step 9: Found ${moduleCount} module buttons`);

    if (moduleCount > 0) {
      // Click through first 3 modules
      for (let i = 0; i < Math.min(3, moduleCount); i++) {
        await moduleButtons.nth(i).click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: `tests/e2e/screenshots/module-${i}.png`, fullPage: true });
        console.log(`Clicked module ${i}`);
      }
    }

    // Step 10: Test sidebar buttons
    const sidebarButtons = page.locator('.left-sidebar .profile-btn, .sidebar-nav button');
    const sidebarBtnCount = await sidebarButtons.count();
    console.log(`Step 10: Found ${sidebarBtnCount} sidebar buttons`);

    if (sidebarBtnCount > 0) {
      await sidebarButtons.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/e2e/screenshots/sidebar-click-1.png' });
    }

    // Step 11: Print error summary
    console.log('\n=== Error Summary ===');
    const errors = consoleMessages.filter(m => m.type === 'error');
    console.log(`Console errors: ${errors.length}`);
    if (errors.length > 0) {
      errors.slice(0, 5).forEach(e => console.log(`  - ${e.text.substring(0, 100)}`));
    }
    console.log(`Page errors: ${pageErrors.length}`);
    pageErrors.slice(0, 5).forEach(e => console.log(`  - ${e.substring(0, 100)}`));
    console.log(`Network errors: ${networkErrors.length}`);
    networkErrors.slice(0, 5).forEach(e => console.log(`  - ${e}`));

    // Assert no critical errors
    expect(pageErrors.length).toBeLessThan(3);
  });
});
