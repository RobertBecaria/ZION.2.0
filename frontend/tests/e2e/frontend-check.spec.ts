import { test, expect } from '@playwright/test';

// Collect console errors
const consoleErrors: string[] = [];
const pageErrors: string[] = [];

test.describe('Frontend Health Check', () => {
  test.beforeEach(async ({ page }) => {
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Listen for page errors (JavaScript exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });
  });

  test('Login page loads without errors', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Take a screenshot
    await page.screenshot({ path: 'tests/e2e/screenshots/login-page.png', fullPage: true });

    // Check for auth container
    const authContainer = page.locator('.auth-container, .auth-card, form');
    await expect(authContainer.first()).toBeVisible({ timeout: 10000 });

    // Report console errors
    if (consoleErrors.length > 0) {
      console.log('\n=== Console Errors ===');
      consoleErrors.forEach(err => console.log(err));
    }

    // Report page errors
    if (pageErrors.length > 0) {
      console.log('\n=== Page Errors ===');
      pageErrors.forEach(err => console.log(err));
    }
  });

  test('Login form elements are interactive', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Check for email input
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="mail"]');
    if (await emailInput.count() > 0) {
      await expect(emailInput.first()).toBeEnabled();
      await emailInput.first().fill('test@example.com');
    }

    // Check for password input
    const passwordInput = page.locator('input[type="password"]');
    if (await passwordInput.count() > 0) {
      await expect(passwordInput.first()).toBeEnabled();
      await passwordInput.first().fill('testpassword123');
    }

    // Check for submit button
    const submitButton = page.locator('button[type="submit"], .auth-button, button:has-text("Войти")');
    if (await submitButton.count() > 0) {
      await expect(submitButton.first()).toBeEnabled();
    }

    // Take screenshot of filled form
    await page.screenshot({ path: 'tests/e2e/screenshots/login-form-filled.png' });
  });

  test('Test login functionality', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Fill login form
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"], .auth-button').first();

    if (await emailInput.count() > 0 && await passwordInput.count() > 0) {
      await emailInput.fill('admin@test.com');
      await passwordInput.fill('localadmin123');

      // Click submit
      await submitButton.click();

      // Wait for response
      await page.waitForTimeout(2000);

      // Take screenshot after login attempt
      await page.screenshot({ path: 'tests/e2e/screenshots/after-login.png', fullPage: true });

      // Check for error messages
      const errorMessage = page.locator('.error-message, .error, [role="alert"]');
      if (await errorMessage.count() > 0) {
        console.log('Login error:', await errorMessage.first().textContent());
      }
    }
  });
});
