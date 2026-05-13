import { test, expect } from '@playwright/test';
import { login } from './test-utils';

test.describe('인증 및 보안 검증 (Auth & Security)', () => {
  test('올바른 마스터 키 입력 시 대시보드 진입 확인', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('비정상적인 키 입력 시 오류 메시지 확인', async ({ page }) => {
    await page.goto('/');
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('wrong_key');
    await page.keyboard.press('Enter');
    
    await expect(page.locator('text=잘못된 키입니다')).toBeVisible();
  });

  test('인증 없이 워크스페이스 직접 접근 시 차단 확인', async ({ page }) => {
    // 로컬 스토리지 초기화로 인증 정보 제거
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    
    // 워크스페이스 URL로 직접 이동 시도
    await page.goto('/#workspace'); 
    
    // 다시 로그인(AccessGate) 화면이 보이는지 확인
    await expect(page.locator('text=Project Mitus Access')).toBeVisible();
  });
});
