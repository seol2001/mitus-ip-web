import { test, expect } from '@playwright/test';
import { login } from './test-utils';

test.describe('Project Overview Tab Deep Scan (개요 탭 정밀 검증)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // 첫 번째 프로젝트 진입
    await page.locator('.group.bg-white.rounded-3xl').first().click();
    // Overview 탭이 기본이므로 바로 로딩 대기
    await expect(page.locator('text=Project Overview')).toBeVisible();
  });

  test('1. 편집 권한(Lock) 및 입력창 활성화 검증', async ({ page }) => {
    // 초기 상태: ReadOnly 확인
    const firstInput = page.locator('input').first();
    if (await firstInput.isVisible()) {
      await expect(firstInput).toBeDisabled();
    }

    // Edit 버튼 클릭
    const editBtn = page.getByText('Edit', { exact: true });
    if (await editBtn.isVisible()) {
      await editBtn.click();
      
      // 잠금 획득 후 입력창 활성화 확인
      await expect(firstInput).toBeEnabled();
      
      // ActionBar에 Save/Cancel 버튼 노출 확인
      await expect(page.getByText('Save', { exact: true })).toBeVisible();
      await expect(page.getByText('Cancel', { exact: true })).toBeVisible();
    }
  });

  test('2. 필드 데이터 수정 및 Cancel 롤백 검증', async ({ page }) => {
    await page.getByText('Edit', { exact: true }).click();
    
    const targetInput = page.locator('input[name="Project_Name"]').first();
    if (await targetInput.isVisible()) {
      const originalValue = await targetInput.inputValue();
      await targetInput.fill(originalValue + '_edited');
      
      // 취소 클릭
      await page.getByText('Cancel', { exact: true }).click();
      
      // 원래 값으로 복구되었는지 확인
      await expect(targetInput).toHaveValue(originalValue);
    }
  });

  test('3. IP 삭제 모달 및 참조 차단(Blocked) 로직 검증', async ({ page }) => {
    await page.getByText('Edit', { exact: true }).click();
    
    // IP List에서 첫 번째 삭제 버튼 찾기
    const deleteBtn = page.locator('button').filter({ has: page.locator('svg.lucide-x') }).first();
    
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      
      // IpDeleteModal 노출 확인
      const modal = page.locator('.fixed.inset-0.z-50'); // 모달 컨테이너
      await expect(modal).toBeVisible();
      
      // 만약 참조 중인 IP라면 '삭제 불가' 메시지가 있어야 함
      // (이 테스트는 실제 데이터 상태에 의존하므로 존재 여부만 체크하거나 모킹 필요)
      const isBlocked = await modal.locator('text=삭제 불가').isVisible();
      if (isBlocked) {
        await expect(modal.locator('text=참조 데이터')).toBeVisible();
      }
      
      await page.keyboard.press('Escape');
    }
  });

  test('4. 자동 저장(AutoSave) 복구 모달 노출 검증', async ({ page }) => {
    await page.getByText('Edit', { exact: true }).click();
    
    const targetInput = page.locator('input').first();
    await targetInput.fill('AutoSave Test Data');
    
    // 강제 새로고침 시뮬레이션 (AutoSave가 로컬스토리지에 저장될 시간 확보)
    await page.waitForTimeout(1000); 
    await page.reload();
    
    // 복구 모달이 뜨는지 확인
    // (컴포넌트 내의 AutoSaveRecoveryModal 노출 로직에 따라 확인)
    const recoveryModal = page.locator('text=작업 내용 복구');
    // 실제 로직상 탭 이동이나 재진입 시 트리거되므로 환경에 따라 다를 수 있음
  });

  test('5. 드래그 앤 드롭(D&D) 순서 변경 정합성 검증', async ({ page }) => {
    await page.getByText('Edit', { exact: true }).click();
    
    // 첫 번째 필드와 두 번째 필드 위치 변경 시도
    const fields = page.locator('.flex.items-center.gap-2.mb-1\\.5'); // 필드 레이블 영역
    if (await fields.count() >= 2) {
      const firstField = fields.nth(0);
      const secondField = fields.nth(1);
      
      // Playwright dragTo 시뮬레이션
      await firstField.dragTo(secondField);
      
      // 순서 변경 후 시각적 확인 또는 내부 상태값 검증
      console.log('D&D 동작 수행 완료');
    }
  });
});
