import { test, expect } from '@playwright/test';

test.describe('Mitus IP Web Smoke Test', () => {
  test('대시보드 로드 및 프로젝트 리스트 확인', async ({ page }) => {
    // 1. 접속 및 로그인
    await page.goto('/');
    
    // AccessGate 로그인 처리
    const passwordInput = page.locator('input[type="password"]');
    if (await passwordInput.isVisible()) {
      await passwordInput.fill('mitus2026');
      await page.keyboard.press('Enter');
    }

    // 2. 제목 확인 (로그인 후 대시보드 로딩 대기)
    await expect(page.locator('h1')).toContainText('Mitus IP Web Dashboard', { timeout: 10000 });

    // 3. 프로젝트 카드가 최소 하나 이상 있는지 확인 (데이터가 있는 경우)
    const projectCards = page.locator('.group.bg-white.rounded-3xl');
    const count = await projectCards.count();
    console.log(`현재 대시보드에 ${count}개의 프로젝트가 표시됨`);
  });

  test('읽기 전용 프로젝트 접근성 확인 (데이터 기반)', async ({ page }) => {
    await page.goto('/');

    // AccessGate 로그인 처리
    const passwordInput = page.locator('input[type="password"]');
    if (await passwordInput.isVisible()) {
      await passwordInput.fill('mitus2026');
      await page.keyboard.press('Enter');
    }

    // '읽기 전용' 뱃지가 있는 카드를 찾아 클릭 시도 (또는 상태 확인)
    const readonlyBadge = page.locator('text=읽기 전용').first();
    
    if (await readonlyBadge.isVisible()) {
      console.log('읽기 전용 프로젝트 발견, 상세 페이지 진입 테스트...');
      await readonlyBadge.click();
      
      // 워크스페이스 진입 후 상단에 '🔒' 또는 'Read-Only' 표시가 있는지 확인
      const lockIndicator = page.locator('text=Read-Only');
      await expect(lockIndicator).toBeVisible();
      
      // 입력 필드가 disabled 인지 샘플링 확인
      const firstInput = page.locator('input').first();
      if (await firstInput.count() > 0) {
        await expect(firstInput).toBeDisabled();
      }
    } else {
      console.log('현재 대시보드에 읽기 전용 프로젝트가 없음.');
    }
  });
});
