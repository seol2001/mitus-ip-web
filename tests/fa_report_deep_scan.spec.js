import { test, expect } from '@playwright/test';
import { login } from './test-utils';

test.describe('FA Report Tab Deep Scan (FA 리포트 정밀 검증)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // 프로젝트 카드 클릭 (첫 번째 프로젝트)
    await page.locator('.group.bg-white.rounded-3xl').first().click();
    
    // FA Report 탭 클릭
    const faTab = page.getByRole('button', { name: 'FA Report', exact: true });
    await faTab.click();
    
    // 타이틀 로딩 대기
    await expect(page.locator('h1')).toContainText('FA Reports', { timeout: 15000 });
  });

  test('1. 리포트 필수 필드 검증 및 등록 버튼 활성화', async ({ page }) => {
    await page.getByText('Edit', { exact: true }).click();
    
    // 초기에는 등록 버튼 비활성화 확인
    const saveBtn = page.getByText('리포트 등록');
    await expect(saveBtn).toBeDisabled();
    
    // 필수 필드 채우기
    await page.locator('select[name="ipBlock"]').selectOption({ index: 1 });
    await page.locator('textarea[name="phenomenon"]').fill('Test Phenomenon');
    await page.locator('textarea[name="rootCause"]').fill('Test Root Cause');
    await page.locator('select[name="sampleSourceVer"]').selectOption('EVT0');
    
    // 등록 버튼 활성화 확인
    await expect(saveBtn).toBeEnabled();
  });

  test('2. 지능형 버전 분석 (Version Gap) 계산 로직 검증', async ({ page }) => {
    await page.getByText('Edit', { exact: true }).click();
    
    // Sample Source: EVT0, Reported In: EVT1 (EVT0 < EVT1 이므로 Risk 예상)
    await page.locator('select[name="sampleSourceVer"]').selectOption('EVT0');
    await page.locator('select[name="reportedInStage"]').selectOption('EVT1');
    
    // 실시간 배지 텍스트 확인
    await expect(page.locator('text=Version Gap: Potential Risk')).toBeVisible();
    
    // Sample Source: EVT2, Reported In: EVT1 (EVT2 > EVT1 이므로 OK 예상)
    await page.locator('select[name="sampleSourceVer"]').selectOption('EVT2');
    await page.locator('select[name="reportedInStage"]').selectOption('EVT1');
    
    await expect(page.locator('text=Version Gap: Fixed in Latest')).toBeVisible();
  });

  test('3. Severity 필터링 및 통계 숫자 연동 검증', async ({ page }) => {
    // S1 필터 버튼 클릭
    const s1Filter = page.locator('button:has-text("S1")').first();
    const s1CountText = await s1Filter.locator('span').last().textContent();
    const s1Count = parseInt(s1CountText || '0');
    
    await s1Filter.click();
    
    // 리스트에 노출된 카드 개수가 통계와 일치하는지 확인
    const visibleCards = page.locator('.border-l-red-500'); // S1 카드의 특징적인 클래스
    if (s1Count > 0) {
      await expect(visibleCards).toHaveCount(s1Count);
    }
  });

  test('4. 연동 완료(Linked) 카드의 삭제 차단 검증', async ({ page }) => {
    await page.getByText('Edit', { exact: true }).click();
    
    // '연동 완료' 배지가 있는 카드 찾기
    const linkedCard = page.locator('div:has-text("연동 완료")').filter({ has: page.locator('button') }).first();
    if (await linkedCard.isVisible()) {
      const deleteBtn = linkedCard.locator('button').filter({ has: page.locator('svg.lucide-trash2') });
      // 연동된 카드는 삭제 버튼이 비활성화되거나 보이지 않아야 함
      await expect(deleteBtn).toBeDisabled();
    }
  });

  test('5. ReadOnly 모드 보안 검증', async ({ page }) => {
    // Edit 모드가 아닐 때 (기본 상태)
    const ipSelect = page.locator('select[name="ipBlock"]');
    await expect(ipSelect).toBeDisabled();
    
    const phenomenonText = page.locator('textarea[name="phenomenon"]');
    await expect(phenomenonText).toBeDisabled();
  });
});
