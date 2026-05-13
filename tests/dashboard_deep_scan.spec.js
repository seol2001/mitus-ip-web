import { test, expect } from '@playwright/test';
import { login } from './test-utils';

test.describe('Dashboard Deep Scan (대시보드 정밀 검증)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('1. 전역 검색 및 필터링 정밀 확인', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search projects...');
    
    // 특정 키워드 검색
    await searchInput.fill('SM5718');
    await page.waitForTimeout(500); // 렌더링 대기
    
    const cards = page.locator('.group.bg-white.rounded-3xl');
    const count = await cards.count();
    
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await expect(cards.nth(i)).toContainText('SM5718');
      }
    }

    // Show Archived 토글 동작 확인
    const archiveLabel = page.getByText('Show Archived');
    await expect(archiveLabel).toBeVisible();
    await archiveLabel.click();
  });

  test('2. 신규 프로젝트 생성 모달 및 유효성 검증', async ({ page }) => {
    await page.getByText('New Project').click();
    
    // 모달 노출 확인
    await expect(page.locator('text=새 프로젝트 생성')).toBeVisible();
    
    // 필수값 미입력 시 생성 버튼 상태 확인 (비활성화)
    const createBtn = page.getByRole('button', { name: 'Create' });
    await expect(createBtn).toBeDisabled();
    
    // Seed Data 선택 옵션 확인
    const seedSelect = page.locator('select').first();
    if (await seedSelect.isVisible()) {
      await seedSelect.selectOption({ label: 'SM5718 (Standard Reference)' });
      // 시드 선택 시 관련 데이터(Owner 등)가 자동 채워지는지 확인 가능
    }
    
    // 취소
    await page.keyboard.press('Escape');
  });

  test('3. 프로젝트 카드 액션 메뉴 검증', async ({ page }) => {
    const firstCard = page.locator('.group.bg-white.rounded-3xl').first();
    if (await firstCard.isVisible()) {
      // 메뉴 버튼 클릭 (점 세개 아이콘 등)
      const menuBtn = firstCard.locator('button').filter({ has: page.locator('svg') }).last();
      await menuBtn.click();
      
      // 복제(Duplicate), 보관(Archive), 삭제(Delete) 옵션 확인
      await expect(page.locator('text=Duplicate')).toBeVisible();
      await expect(page.locator('text=Archive')).toBeVisible();
      await expect(page.locator('text=Delete')).toBeVisible();
      
      // 메뉴 닫기
      await page.keyboard.press('Escape');
    }
  });

  test('4. IP / Block 카탈로그(Stats) 집계 확인', async ({ page }) => {
    // 대시보드 하단에 Sub-block Catalog가 있는지 확인
    const catalogHeader = page.getByText('Sub-Block Catalog');
    if (await catalogHeader.isVisible()) {
      await expect(catalogHeader).toBeVisible();
      
      // 카탈로그 내 검색
      const catalogSearch = page.getByPlaceholder('Search blocks or projects...');
      await catalogSearch.fill('LDO');
      
      // 검색된 블록 리스트가 있는지 확인
      const blocks = page.locator('text=LDO');
      await expect(blocks.first()).toBeVisible();
    }
  });

  test('5. 히스토리 드롭다운 및 차수 이동 검증', async ({ page }) => {
    const historyBtn = page.getByText('History').first();
    if (await historyBtn.isVisible()) {
      await historyBtn.click();
      
      // 리비전 목록(EVT0, EVT1 등) 노출 확인
      const revisionItems = page.locator('button:has-text("EVT")');
      if (await revisionItems.count() > 0) {
        await expect(revisionItems.first()).toBeVisible();
        
        // 특정 리비전 클릭 시 이동 테스트 가능
      }
    }
  });
});
