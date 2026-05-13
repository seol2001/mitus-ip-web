import { test, expect } from '@playwright/test';
import { login } from './test-utils';

// ─── Bug #1 검증용 픽스처 ───────────────────────────────────────────────────
// 기존 프로젝트(SM5718)와 동일 ID의 Import 파일을 병합하면:
// EVT1이 이미 존재 → ADD AS COPY → EVT1_Imported 키가 revisions에 추가됨
// 수정 전: phases 배열 미동기화 → 히스토리 드롭다운에 미표시 (FAIL)
// 수정 후: phases 배열 동기화  → 히스토리 드롭다운에 표시됨  (PASS)
const makeMockImportFile = (existingProjectName = 'SM5718 (Demo Mode)') => ({
  app: 'Mitus-IP-Web',
  exportedAt: new Date().toISOString(),
  project: {
    id: 'SM5718',
    name: existingProjectName,
    latest_evt: 'EVT1',
    phases: ['EVT1'],
    updated: new Date().toISOString(),
    is_locked: false,
    project_data: {
      projectId: 'SM5718',
      revisions: {
        EVT1: {
          status: 'draft',
          projectOverview: { Project_Name: 'SM5718', Owner: 'Test' },
          ipIndex: {},
          revisionLog: { initialMode: 'new', loadedIssues: [], historyBlocks: [], issues: [] },
          faReport: { faReports: [] }
        }
      }
    }
  }
});

// ─── 공통 헬퍼: Import 모달을 파일 주입으로 열기 ────────────────────────────
async function openImportModal(page, fileContent) {
  // 상단 공통 'Import from File' 버튼 클릭
  const importBtn = page.getByRole('button', { name: /import from file/i });
  await expect(importBtn).toBeVisible({ timeout: 8000 });

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 8000 }),
    importBtn.click()
  ]);

  await fileChooser.setFiles({
    name: 'mock_import.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fileContent))
  });

  // ImportModal 노출 확인
  await expect(page.locator('text=Import Data Configuration')).toBeVisible({ timeout: 8000 });
}

// ─── 공통 헬퍼: 완료 모달 닫기 ──────────────────────────────────────────────
async function dismissSuccessModal(page) {
  const successMsg = page.getByText('가져오기 완료');
  const isVisible = await successMsg.isVisible({ timeout: 4000 }).catch(() => false);
  if (isVisible) {
    const confirmBtn = page.getByRole('button', { name: /확인|ok/i });
    if (await confirmBtn.isVisible()) await confirmBtn.click();
  }
}

// ─── 공통 헬퍼: 프로젝트 카드 첫 번째 이름 가져오기 ─────────────────────────
async function getFirstCardName(page) {
  // 실제 카드 셀렉터: bg-white + rounded-xl (서버 DOM 기반)
  const card = page.locator('[class*="bg-white"][class*="rounded"]').first();
  return card.locator('h3').textContent().catch(() => '');
}

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Bug Screening - Bug #1: ADD AS COPY 병합 후 히스토리 드롭다운 노출', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  /**
   * [핵심 검증] ADD AS COPY 병합 후 _Imported 리비전이 히스토리 드롭다운에 표시되어야 한다.
   *
   * 시나리오:
   * 1. 'Import from File' 버튼 클릭 → 파일 주입 (EVT1이 이미 존재하는 프로젝트)
   * 2. ImportModal: merge 모드 + Add as Copy (기본값) 확인
   * 3. Execute Import 실행
   * 4. SM5718 카드의 History 드롭다운에서 EVT1_Imported 표시 여부 검증
   */
  test('Bug #1: ADD AS COPY 병합 후 _Imported 리비전이 히스토리 드롭다운에 표시됨', async ({ page }) => {
    const mockFile = makeMockImportFile();

    // ── Step 1: Import 모달 열기 ──
    await openImportModal(page, mockFile);

    // ── Step 2: merge 모드가 기본값으로 선택되어 있는지 확인 (동일 ID) ──
    const mergeSection = page.getByText('기존 프로젝트에 병합');
    await expect(mergeSection).toBeVisible();

    // EVT1 리비전 행에 'Add as Copy' 버튼이 활성화 상태인지 확인
    const addAsCopyBtn = page.getByRole('button', { name: /add as copy/i }).first();
    await expect(addAsCopyBtn).toBeVisible();

    // ── Step 3: Execute Import 실행 ──
    const executeBtn = page.getByRole('button', { name: /execute import/i });
    await expect(executeBtn).toBeVisible();
    await executeBtn.scrollIntoViewIfNeeded();
    await executeBtn.click();

    await dismissSuccessModal(page);

    // ── Step 4: [핵심 검증] History 드롭다운에 EVT1_Imported 표시 여부 ──
    // History 버튼: button[title='다른 차수(History) 선택']
    await expect(page.locator('text=Mitus IP Web Dashboard')).toBeVisible({ timeout: 5000 });

    const historyBtn = page.locator('button[title*="History"], button[title*="차수"]').first();
    if (await historyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await historyBtn.click();
    } else {
      // fallback: 텍스트로 찾기
      await page.getByText('History').first().click();
    }

    // 수정 전: EVT1_Imported가 phases에 없어서 드롭다운 미표시 → FAIL
    // 수정 후: phases 동기화 후 표시됨 → PASS
    const importedItem = page.locator('button:has-text("EVT1_Imported"), [role="option"]:has-text("EVT1_Imported"), li:has-text("EVT1_Imported")');
    await expect(importedItem.first()).toBeVisible({ timeout: 5000 });
  });

  /**
   * [보조 검증] overwrite 액션 후에도 해당 revision이 phases에 유지되어야 한다.
   * (27b 크로스 체크 지적: overwrite 케이스도 phases에 포함해야 함)
   */
  test('Bug #1 보조: overwrite 액션 후에도 revision이 History 드롭다운에 유지됨', async ({ page }) => {
    const mockFile = makeMockImportFile();
    await openImportModal(page, mockFile);

    // Overwrite 버튼 클릭 (EVT1이 이미 존재하므로 활성화)
    const overwriteBtn = page.getByRole('button', { name: /overwrite/i }).first();
    if (await overwriteBtn.isEnabled({ timeout: 3000 }).catch(() => false)) {
      await overwriteBtn.click();
      // 덮어쓰기 경고 동의 체크박스
      const safetyCheckbox = page.locator('input[type="checkbox"]').last();
      await safetyCheckbox.check();
    }

    const executeBtn = page.getByRole('button', { name: /confirm.*overwrite|execute import/i });
    await executeBtn.scrollIntoViewIfNeeded();
    await executeBtn.click({ force: true });

    await dismissSuccessModal(page);

    // History 드롭다운에 EVT1이 계속 존재해야 함
    await expect(page.locator('text=Mitus IP Web Dashboard')).toBeVisible({ timeout: 5000 });

    const historyBtn = page.locator('button[title*="History"], button[title*="차수"]').first();
    if (await historyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await historyBtn.click();
    } else {
      await page.getByText('History').first().click();
    }

    const evt1Item = page.locator('button:has-text("EVT1"), [role="option"]:has-text("EVT1"), li:has-text("EVT1")');
    await expect(evt1Item.first()).toBeVisible({ timeout: 5000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Bug Screening - Bug #2: 백업 프로젝트 이름 식별 가능 여부', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Bug #2: useBackup=true 시 생성된 백업 카드 이름에 "백업" 식별자가 포함됨', async ({ page }) => {
    const mockFile = makeMockImportFile();
    await openImportModal(page, mockFile);

    // '기존 프로젝트에 병합' 섹션이 있는지 확인하고 클릭 (이미 선택되어 있더라도 안전하게)
    const mergeSection = page.getByText('기존 프로젝트에 병합');
    await expect(mergeSection).toBeVisible();
    await mergeSection.click();

    // useBackup 체크박스가 나타날 때까지 대기 및 확인
    const backupCheckbox = page.locator('input[type="checkbox"]').first();
    await expect(backupCheckbox).toBeVisible({ timeout: 5000 });
    
    // 만약 체크되어 있지 않다면 체크 (기본값이 true여야 함)
    if (!(await backupCheckbox.isChecked())) {
      await backupCheckbox.check({ force: true });
    }

    const executeBtn = page.getByRole('button', { name: /execute import/i });
    await executeBtn.scrollIntoViewIfNeeded();
    await executeBtn.click();

    await dismissSuccessModal(page);
    await expect(page.locator('text=Mitus IP Web Dashboard')).toBeVisible({ timeout: 5000 });

    // 백업 카드 이름에 '백업' 또는 '_BAK' 포함 여부 검사
    const allH3 = page.locator('h3');
    const count = await allH3.count();

    let backupFound = false;
    for (let i = 0; i < count; i++) {
      const name = await allH3.nth(i).textContent().catch(() => '');
      if (name && (name.includes('백업') || name.includes('_BAK'))) {
        backupFound = true;
        break;
      }
    }

    // 수정 전: 백업 이름 = 원본과 동일 (name 필드 미변경) → FAIL
    // 수정 후: ' (백업_timestamp)' 접미사 포함 → PASS
    expect(backupFound).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Bug Screening - Bug #3: 브라우저 뒤로가기 시 프로젝트 잠금 해제 여부', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Bug #3: 브라우저 뒤로가기 시 프로젝트 잠금이 해제되어야 함', async ({ page }) => {
    // 첫 번째 프로젝트 카드 클릭 (워크스페이스 진입 → Lock 발생)
    const firstCard = page.locator('[class*="bg-white"][class*="rounded"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });
    await firstCard.click();

    // 워크스페이스 진입 확인
    const workspaceIndicator = page.locator('text=Project_Overview, text=Workspace, [data-testid="workspace"]').first();
    await expect(workspaceIndicator.or(page.getByText('Project_Overview'))).toBeVisible({ timeout: 10000 });

    // 브라우저 뒤로가기
    await page.goBack();

    // 대시보드 복귀 확인
    await expect(page.locator('text=Mitus IP Web Dashboard')).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(1500); // 잠금 해제 API 호출 대기

    // Lock 아이콘이 사라졌는지 확인 (본인이 나갔으므로 Lock 해제되어야 함)
    // 수정 전: Lock 아이콘이 남아 있음 → FAIL
    // 수정 후: Lock 해제됨 → PASS
    const lockIcon = page.locator('[class*="bg-white"][class*="rounded"]').first().locator('svg[class*="lucide-lock"], [data-lucide="lock"]');
    await expect(lockIcon).not.toBeVisible({ timeout: 5000 });
  });
});
