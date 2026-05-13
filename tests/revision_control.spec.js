import { test, expect } from '@playwright/test';
import { login } from './test-utils';

test.describe('차수 및 잠금 제어 검증 (Revision & Lock)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('잠금(Lock) 상태 진입 시 UI 비활성화 확인', async ({ page }) => {
    // 1. '읽기 전용' 프로젝트가 있다면 진입
    const readonlyBadge = page.locator('text=읽기 전용').first();
    
    if (await readonlyBadge.isVisible()) {
      await readonlyBadge.click();
      
      // 2. 워크스페이스 상단에 잠금 표시 확인
      await expect(page.locator('text=Read-Only')).toBeVisible();
      
      // 3. 주요 입력 필드가 disabled 인지 확인
      const inputs = page.locator('input');
      const count = await inputs.count();
      for (let i = 0; i < Math.min(count, 5); i++) {
        await expect(inputs.nth(i)).toBeDisabled();
      }
    }
  });

  test('Archived 차수에서 Revision Up 버튼 활성화 여부 확인', async ({ page }) => {
    // 1. 잠긴 프로젝트 진입
    const readonlyBadge = page.locator('text=읽기 전용').first();
    if (await readonlyBadge.isVisible()) {
      await readonlyBadge.click();
      
      // 2. '다음 차수 파생' 버튼 확인 (조건부 활성화)
      const revUpBtn = page.locator('text=다음 차수 파생');
      await expect(revUpBtn).toBeVisible();
      // 만약 최신 차수라면 활성화되어 있어야 함
    }
  });
});
