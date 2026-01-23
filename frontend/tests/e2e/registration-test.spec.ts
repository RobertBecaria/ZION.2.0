import { test, expect } from '@playwright/test';

// Store messages for analysis
const consoleMessages: { type: string; text: string }[] = [];
const pageErrors: string[] = [];

test.describe('Registration and Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });
  });

  test('Switch to registration form', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Look for registration link/button
    const regButton = page.locator('text=Зарегистрироваться, text=Register, button:has-text("рег")').first();

    if (await regButton.count() > 0) {
      await regButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'tests/e2e/screenshots/registration-form.png', fullPage: true });
    }

    // Print any errors
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

  test('Register new user', async ({ page }) => {
    const timestamp = Date.now();
    const testEmail = `test${timestamp}@example.com`;
    const testPassword = 'TestPass123';

    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Click on registration link
    const regLink = page.locator('text=Зарегистрироваться').first();
    if (await regLink.count() > 0) {
      await regLink.click();
      await page.waitForTimeout(500);
    }

    // Fill registration form
    // Check for email field
    const emailField = page.locator('input[type="email"], input[name="email"]').first();
    if (await emailField.count() > 0) {
      await emailField.fill(testEmail);
    }

    // Check for password field
    const passwordField = page.locator('input[type="password"]').first();
    if (await passwordField.count() > 0) {
      await passwordField.fill(testPassword);
    }

    // Check for confirm password field
    const confirmPassword = page.locator('input[type="password"]').nth(1);
    if (await confirmPassword.count() > 0) {
      await confirmPassword.fill(testPassword);
    }

    // Check for first name
    const firstName = page.locator('input[name="first_name"], input[placeholder*="мя"]').first();
    if (await firstName.count() > 0) {
      await firstName.fill('Test');
    }

    // Check for last name
    const lastName = page.locator('input[name="last_name"], input[placeholder*="амил"]').first();
    if (await lastName.count() > 0) {
      await lastName.fill('User');
    }

    await page.screenshot({ path: 'tests/e2e/screenshots/registration-filled.png', fullPage: true });

    // Submit registration
    const submitBtn = page.locator('button[type="submit"], .auth-button').first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'tests/e2e/screenshots/after-registration.png', fullPage: true });
    }

    // Check for success or error
    const errorMsg = page.locator('.error-message, .error');
    if (await errorMsg.count() > 0) {
      console.log('Registration error:', await errorMsg.first().textContent());
    }

    // Print errors
    const errors = consoleMessages.filter(m => m.type === 'error');
    if (errors.length > 0) {
      console.log('\n=== Console Errors ===');
      errors.forEach(e => console.log(e.text));
    }
  });
});
