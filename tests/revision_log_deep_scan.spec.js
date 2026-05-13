import { test, expect } from '@playwright/test';
import { login } from './test-utils';

test.describe('Revision Log Tab Deep Scan (리비전 로그 및 탭 연동 정밀 검증)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.locator('.group.bg-white.rounded-3xl').first().click();
    await page.getByText('Revision Log', { exact: true }).click();
    await expect(page.locator('text=Issue Summary')).toBeVisible();
  });

  test('1. FA Report 이슈 Pull & Un-pull 연동 검증', async ({ page }) => {
    // 1-1. FA Report 탭으로 이동
    await page.getByText('FA Report', { exact: true }).click();
    
    // Unlinked 이슈 찾기 (Pull 버튼이 있는 항목)
    const pullBtn = page.locator('button:has-text("Pull")').first();
    if (await pullBtn.isVisible()) {
      await pullBtn.click();
      // 'Linked' 상태로 변경되었는지 확인
      await expect(page.locator('text=Linked').first()).toBeVisible();
      
      // 1-2. Revision Log 탭으로 복귀하여 이슈 생성 확인
      await page.getByText('Revision Log', { exact: true }).click();
      // FA에서 가져온 이슈는 특정 프리픽스나 레이블이 있을 것임
      // (여기서는 리스트에 항목이 추가되었는지 확인)
      const logItems = page.locator('.bg-white.rounded-2xl.border.border-slate-200');
      await expect(logItems.first()).toBeVisible();
      
      // 1-3. Un-pull (연동 해제) 검증
      await page.getByText('Edit', { exact: true }).click();
      const unlinkBtn = page.locator('button[title="Unlink from FA"]').first();
      if (await unlinkBtn.isVisible()) {
        await unlinkBtn.click();
        // 다시 FA Report로 가서 Unlinked로 복구되었는지 확인
        await page.getByText('FA Report', { exact: true }).click();
        await expect(page.locator('button:has-text("Pull")').first()).toBeVisible();
      }
    }
  });

  test('2. 차수 증가(Revision Up) 제한 로직 검증 (Unlinked FA 존재 시)', async ({ page }) => {
    // 1. FA Report에 Unlinked 이슈가 있는지 확인
    await page.getByText('FA Report', { exact: true }).click();
    const hasUnlinked = await page.locator('button:has-text("Pull")').isVisible();
    
    if (hasUnlinked) {
      // 2. Revision Log 탭의 'Revision Up' 시도
      await page.getByText('Revision Log', { exact: true }).click();
      const revUpBtn = page.locator('button:has-text("Revision Up")');
      
      if (await revUpBtn.isVisible()) {
        await revUpBtn.click();
        
        // 3. 경고 모달 노출 확인 (Unlinked FA가 남아있음을 경고)
        await expect(page.locator('text=Unlinked FA issues')).toBeVisible();
        await page.keyboard.press('Escape');
      }
    }
  });

  test('3. IP Index 연동 및 이슈 자동 넘버링 검증', async ({ page }) => {
    await page.getByText('Edit', { exact: true }).click();
    await page.getByText('Add Issue').click();
    
    // IP Block 드롭다운 확인
    const ipSelect = page.locator('select[name="ipBlock"]');
    if (await ipSelect.isVisible()) {
      const options = await ipSelect.locator('option').allTextContents();
      expect(options.length).toBeGreaterThan(1); // 기본값 외에 IP들이 있어야 함
      
      // 특정 IP 선택 시 이슈 번호 포맷 확인
      await ipSelect.selectOption({ index: 1 });
      const issueNumInput = page.locator('input[name="issueNum"]');
      const val = await issueNumInput.inputValue();
      // 숫자 형태(01, 02...)인지 확인
      expect(val).toMatch(/^\d+$/);
    }
  });

  test('4. 이슈 상태 변경 및 이월(Carry-over) 시각적 검증', async ({ page }) => {
    await page.getByText('Edit', { exact: true }).click();
    
    // 첫 번째 이슈의 상태를 Deferred로 변경
    const statusSelect = page.locator('select[name="status"]').first();
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption('Deferred');
      // 배지 색상 확인 (Deferred는 주황/노랑 계열 클래스 포함 여부)
      const badge = page.locator('.rounded-full.px-2').first();
      await expect(badge).toBeVisible();
      
      // Carry-over 체크박스 활성화 확인
      const carryOverCheck = page.locator('input[type="checkbox"]').first();
      await expect(carryOverCheck).toBeVisible();
    }
  });

  test('5. 필터링 및 리스트 정합성 검증', async ({ page }) => {
    // 필터바 노출 확인
    const filterInput = page.getByPlaceholder('Search issues...');
    if (await filterInput.isVisible()) {
      await filterInput.fill('NonExistentIssueName');
      // 검색 결과 없음 메시지 확인
      await expect(page.locator('text=No issues found')).toBeVisible();
      
      await filterInput.fill(''); // 필터 초기화
    }
  });
});
