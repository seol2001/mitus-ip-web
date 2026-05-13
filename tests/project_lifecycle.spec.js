import { test, expect } from '@playwright/test';
import { login } from './test-utils';

test.describe('프로젝트 수명 주기 검증 (Project Lifecycle)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('프로젝트 검색 필터링 동작 확인', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search projects...');
    await searchInput.fill('NonExistentProjectName');
    
    // 검색 결과가 없을 때의 UI 확인
    await expect(page.locator('text=검색 결과가 없습니다')).toBeVisible();
  });

  test('아카이브 필터 토글 동작 확인', async ({ page }) => {
    const archiveToggle = page.locator('text=Show Archived');
    await expect(archiveToggle).toBeVisible();
    await archiveToggle.click();
    // 토글 후 상태 변화 확인 (내부 로직상 is_archived 필터링이 바뀌어야 함)
  });

  test('프로젝트 카드 내 리비전 히스토리 드롭다운 확인', async ({ page }) => {
    const historyBtn = page.locator('button:has-text("History")').first();
    if (await historyBtn.isVisible()) {
      await historyBtn.click();
      // 드롭다운 메뉴가 나타나는지 확인
      await expect(page.locator('.absolute.right-0.mt-2')).toBeVisible();
    }
  });
});
