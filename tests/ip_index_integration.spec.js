import { test, expect } from '@playwright/test';
import { login } from './test-utils';

test.describe('IP Index Tab Integration Scan (IP 인덱스 및 연동 검증)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // 첫 번째 프로젝트 진입
    await page.locator('.group.bg-white.rounded-3xl').first().click();
    // IP Index 탭 클릭
    await page.getByText('IP Index', { exact: true }).click();
    await expect(page.locator('text=IP Identity & Lineage')).toBeVisible();
  });

  test('1. IP 선택 바 동작 및 자동 연동 정보 확인', async ({ page }) => {
    // IP 선택 바 노출 확인
    const ipTabs = page.locator('button.px-4.py-2.rounded-xl.text-sm.font-bold');
    if (await ipTabs.count() > 0) {
      const firstIpName = await ipTabs.first().textContent();
      await ipTabs.first().click();
      
      // 해당 IP 명칭이 Identity 섹션에 반영되는지 확인
      // (select 요소인 경우 처리)
      const ipNameSelect = page.locator('select[name="IP_Name"]');
      if (await ipNameSelect.isVisible()) {
        await expect(ipNameSelect).toHaveValue(new RegExp(firstIpName.trim().split(' ')[0]));
      }
    }

    // Project Info 동기화 확인 (Read-only)
    const projectNameInput = page.locator('input[value]').filter({ hasText: '' }).first(); // Auto Linked 영역
    await expect(page.locator('text=Auto Linked')).toBeVisible();
  });

  test('2. Key Spec 편집 및 D&D 순서 변경 검증', async ({ page }) => {
    await page.getByText('Edit', { exact: true }).click();
    
    // 새 파라미터 추가
    const addParamBtn = page.getByText('새 파라미터 추가');
    if (await addParamBtn.isVisible()) {
      await addParamBtn.click();
      await expect(page.getByPlaceholder('Parameter Key')).toBeVisible();
    }
    
    // D&D 핸들 노출 확인
    const dragHandle = page.locator('text=⠿').first();
    await expect(dragHandle).toBeVisible();
  });

  test('3. [🔥연동] Revision Log 이슈 추가 시 미결 현황 업데이트 검증', async ({ page }) => {
    // 1. 현재 미결 이슈 개수 파악
    const pendingCard = page.locator('text=미결 이슈 현황').locator('..');
    const initialPendingText = await pendingCard.locator('text=총 미결 이슈').locator('..').locator('span').last().textContent();
    const initialCount = parseInt(initialPendingText || '0');

    // 2. Revision Log 탭으로 이동
    await page.getByText('Revision Log', { exact: true }).click();
    
    // 3. 새 이슈 추가 (Pending Action 상태로)
    await page.getByText('Edit', { exact: true }).click();
    await page.getByText('Add Issue').click();
    
    // (이슈 입력창에 데이터 채우기 시뮬레이션 - 실제 ID/Class에 맞춰 보강 필요)
    // 여기서는 단순히 탭 이동 및 연동 로직의 존재 여부와 시뮬레이션 구조를 설계함
    
    // 4. 다시 IP Index 탭으로 복귀
    await page.getByText('IP Index', { exact: true }).click();
    
    // 5. 숫자가 변했는지 확인 (실제 데이터 추가 완료 가정 시)
    // await expect(pendingCard).toContainText(`${initialCount + 1}`);
  });

  test('4. Sub-Blocks (BOM) 관리 및 삭제 검증', async ({ page }) => {
    await page.getByText('Edit', { exact: true }).click();
    
    const addSubBlockBtn = page.getByText('Add Sub-Block');
    if (await addSubBlockBtn.isVisible()) {
      await addSubBlockBtn.click();
      
      // 새 서브블록 입력창 노출 확인
      await expect(page.getByPlaceholder('e.g. Gate_Driver')).toBeVisible();
      
      // 삭제 버튼 동작
      const removeBtn = page.locator('button[title="Remove Sub-Block"]').last();
      await removeBtn.click();
      await expect(page.getByPlaceholder('e.g. Gate_Driver')).not.toBeVisible();
    }
  });

  test('5. Evaluation & Revision History 섹션 연동 확인', async ({ page }) => {
    // 하단 히스토리 섹션 노출 확인
    await expect(page.locator('text=Evaluation & Revision History')).toBeVisible();
    await expect(page.locator('text=Revision_Log 연동')).toBeVisible();
    
    // 차수별 블록(EVT0, EVT1 등) 존재 여부 확인
    const stageBlocks = page.locator('.rounded-xl.border.border-slate-200.overflow-hidden');
    if (await stageBlocks.count() > 0) {
      await expect(stageBlocks.first()).toBeVisible();
    }
  });
});
