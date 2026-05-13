import { expect } from '@playwright/test';

export async function login(page) {
  await page.goto('/');
  const passwordInput = page.locator('input[type="password"]');
  if (await passwordInput.isVisible()) {
    await passwordInput.fill('mitus2026');
    await page.keyboard.press('Enter');
  }
  // Wait for dashboard to load
  await expect(page.locator('h1')).toContainText('Mitus IP Web Dashboard', { timeout: 10000 });
}
