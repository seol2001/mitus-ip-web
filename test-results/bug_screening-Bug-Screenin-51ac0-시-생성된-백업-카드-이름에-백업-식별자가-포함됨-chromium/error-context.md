# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bug_screening.spec.js >> Bug Screening - Bug #2: 백업 프로젝트 이름 식별 가능 여부 >> Bug #2: useBackup=true 시 생성된 백업 카드 이름에 "백업" 식별자가 포함됨
- Location: tests/bug_screening.spec.js:171:3

# Error details

```
Error: locator.check: Clicking the checkbox did not change its state
Call log:
  - waiting for locator('input[type="checkbox"]').first()
    - locator resolved to <input type="checkbox" class="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"/>
  - attempting click action
    - scrolling into view if needed
    - done scrolling
    - forcing action
    - performing click action
    - click action done
    - waiting for scheduled navigations to finish
    - navigations have finished

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - heading "Mitus IP Web Dashboard" [level=1] [ref=e7]
        - paragraph [ref=e8]: 모든 프로젝트 현황 및 차수 관리
      - generic [ref=e9]:
        - button "Import from File" [ref=e10] [cursor=pointer]:
          - img [ref=e11]
          - text: Import from File
        - button "New Project" [ref=e15] [cursor=pointer]:
          - img [ref=e16]
          - text: New Project
    - generic [ref=e17]:
      - generic [ref=e20]: Cloud Database Connected
      - generic "시스템 데이터베이스에 저장된 프로젝트 중 '보관(Archive)' 처리된 항목들을 표시합니다." [ref=e21] [cursor=pointer]:
        - checkbox "View Archived Projects" [ref=e22]
        - text: View Archived Projects
    - generic [ref=e23]:
      - generic [ref=e24]:
        - generic [ref=e25]:
          - generic [ref=e26]:
            - heading "SM5718 (Copy)" [level=3] [ref=e27]
            - paragraph [ref=e28]:
              - img [ref=e29]
              - text: 2026-05-13-08:35 업데이트됨
          - button [ref=e33] [cursor=pointer]:
            - img [ref=e34]
        - generic [ref=e37]:
          - generic [ref=e38]:
            - generic [ref=e39]: Current Status
            - generic [ref=e40]: Active (Draft)
          - generic [ref=e42]:
            - button "EVT2 편집 접속" [ref=e43] [cursor=pointer]:
              - img [ref=e44]
              - text: EVT2 편집 접속
            - button "다른 차수(History) 선택" [ref=e47] [cursor=pointer]:
              - img [ref=e48]
              - img [ref=e52]
      - generic [ref=e54]:
        - generic [ref=e55]:
          - generic [ref=e56]:
            - heading "TEST_copy" [level=3] [ref=e57]
            - paragraph [ref=e58]:
              - img [ref=e59]
              - text: 2026-05-10-10:34 업데이트됨
          - button [ref=e63] [cursor=pointer]:
            - img [ref=e64]
        - generic [ref=e67]:
          - generic [ref=e68]:
            - generic [ref=e69]: Current Status
            - generic [ref=e70]: Active (Draft)
          - generic [ref=e72]:
            - button "EVT1 편집 접속" [ref=e73] [cursor=pointer]:
              - img [ref=e74]
              - text: EVT1 편집 접속
            - button "다른 차수(History) 선택" [ref=e77] [cursor=pointer]:
              - img [ref=e78]
              - img [ref=e82]
      - generic [ref=e84]:
        - generic [ref=e86]:
          - generic [ref=e87]: ⭐
          - text: Reference
        - generic [ref=e88]:
          - generic [ref=e89]:
            - heading "SM5718" [level=3] [ref=e90]
            - paragraph [ref=e91]:
              - img [ref=e92]
              - text: 2026-05-09-07:04 업데이트됨
          - button [ref=e96] [cursor=pointer]:
            - img [ref=e97]
        - generic [ref=e100]:
          - generic [ref=e101]:
            - generic [ref=e102]: Current Status
            - generic [ref=e103]: Active (Draft)
          - generic [ref=e105]:
            - button "EVT2 편집 접속" [ref=e106] [cursor=pointer]:
              - img [ref=e107]
              - text: EVT2 편집 접속
            - button "다른 차수(History) 선택" [ref=e110] [cursor=pointer]:
              - img [ref=e111]
              - img [ref=e115]
      - generic [ref=e117]:
        - generic [ref=e118]:
          - generic [ref=e119]:
            - heading "SM5721" [level=3] [ref=e120]
            - paragraph [ref=e121]:
              - img [ref=e122]
              - text: 2026-05-08-13:13 업데이트됨
          - button [ref=e126] [cursor=pointer]:
            - img [ref=e127]
        - generic [ref=e130]:
          - generic [ref=e131]:
            - generic [ref=e132]: Current Status
            - generic [ref=e133]: Active (Draft)
          - generic [ref=e135]:
            - button "EVT0 편집 접속" [ref=e136] [cursor=pointer]:
              - img [ref=e137]
              - text: EVT0 편집 접속
            - button "다른 차수(History) 선택" [ref=e140] [cursor=pointer]:
              - img [ref=e141]
              - img [ref=e145]
      - generic [ref=e147]:
        - generic [ref=e148]:
          - generic [ref=e149]:
            - heading "SM5719" [level=3] [ref=e150]
            - paragraph [ref=e151]:
              - img [ref=e152]
              - text: 2026-05-07-16:30 업데이트됨
          - button [ref=e156] [cursor=pointer]:
            - img [ref=e157]
        - generic [ref=e160]:
          - generic [ref=e161]:
            - generic [ref=e162]: Current Status
            - generic [ref=e163]: Active (Draft)
          - generic [ref=e165]:
            - button "EVT1 편집 접속" [ref=e166] [cursor=pointer]:
              - img [ref=e167]
              - text: EVT1 편집 접속
            - button "다른 차수(History) 선택" [ref=e170] [cursor=pointer]:
              - img [ref=e171]
              - img [ref=e175]
      - generic [ref=e177]:
        - generic [ref=e178]:
          - generic [ref=e179]:
            - heading "SM5720" [level=3] [ref=e180]
            - paragraph [ref=e181]:
              - img [ref=e182]
              - text: 2026-05-04-00:02 업데이트됨
          - button [ref=e186] [cursor=pointer]:
            - img [ref=e187]
        - generic [ref=e190]:
          - generic [ref=e191]:
            - generic [ref=e192]: Current Status
            - generic [ref=e193]: Active (Draft)
          - generic [ref=e195]:
            - button "EVT1 편집 접속" [ref=e196] [cursor=pointer]:
              - img [ref=e197]
              - text: EVT1 편집 접속
            - button "다른 차수(History) 선택" [ref=e200] [cursor=pointer]:
              - img [ref=e201]
              - img [ref=e205]
    - generic [ref=e208] [cursor=pointer]:
      - generic [ref=e209]:
        - heading "📚 Global IP Dictionary" [level=2] [ref=e210]:
          - generic [ref=e211]: 📚
          - text: Global IP Dictionary
          - img [ref=e212]
        - paragraph [ref=e214]: 전사적으로 관리되는 표준 및 커스텀 IP 카탈로그입니다.
      - generic [ref=e215]:
        - button "New Category & IP" [ref=e216]:
          - img [ref=e217]
          - text: New Category & IP
        - generic [ref=e218]: "Total Categories: 8"
        - generic [ref=e219]: "Custom IPs: 1"
    - generic [ref=e221] [cursor=pointer]:
      - generic [ref=e222]:
        - heading "🧩 Sub-Block Reference Catalog" [level=2] [ref=e223]:
          - generic [ref=e224]: 🧩
          - text: Sub-Block Reference Catalog
          - img [ref=e225]
        - paragraph [ref=e227]: 모든 IP 내부에 구성된 서브 블록(BOM)들을 통합 검색하고 참조합니다.
      - generic [ref=e228]:
        - generic [ref=e229]: "Total Blocks: 20"
        - generic [ref=e230]:
          - img [ref=e231]
          - textbox "Search sub-blocks..." [ref=e234]
  - generic [ref=e236]:
    - generic [ref=e237]:
      - generic [ref=e238]:
        - img [ref=e240]
        - generic [ref=e245]:
          - heading "Import Data Configuration" [level=2] [ref=e246]
          - paragraph [ref=e247]: 데이터 유입 방식 및 충돌 방지 설정을 구성하세요.
      - button [ref=e248] [cursor=pointer]:
        - img [ref=e249]
    - generic [ref=e252]:
      - generic [ref=e254]:
        - generic [ref=e255]: Import Strategy
        - button "신규 프로젝트 별도의 ID로 새로운 프로젝트를 생성합니다." [ref=e257] [cursor=pointer]:
          - generic [ref=e259]: 신규 프로젝트
          - paragraph [ref=e260]: 별도의 ID로 새로운 프로젝트를 생성합니다.
        - generic [ref=e261]:
          - button "기존 프로젝트에 병합 현재 프로젝트의 차수 리스트에 데이터를 추가/교체합니다." [ref=e262] [cursor=pointer]:
            - generic [ref=e263]:
              - generic [ref=e264]: 기존 프로젝트에 병합
              - img [ref=e265]
            - paragraph [ref=e269]: 현재 프로젝트의 차수 리스트에 데이터를 추가/교체합니다.
          - generic [ref=e272] [cursor=pointer]:
            - checkbox "실행 직전 현재 상태를 SM5718_BAK 프로젝트로 복제하여 보존합니다. (강력 권장)" [checked] [ref=e273]
            - generic [ref=e274]:
              - text: 실행 직전 현재 상태를
              - strong [ref=e275]: SM5718_BAK
              - text: 프로젝트로 복제하여 보존합니다. (강력 권장)
      - generic [ref=e276]:
        - generic [ref=e277]:
          - generic [ref=e278]: Select Revisions & Actions
          - generic [ref=e279]: Total 1 revisions found
        - generic [ref=e281]:
          - generic [ref=e284] [cursor=pointer]:
            - text: EVT1
            - generic [ref=e285]: → Add as New Revision
          - generic [ref=e286]:
            - button "Add as Copy" [ref=e287] [cursor=pointer]
            - button "Overwrite" [ref=e288] [cursor=pointer]
    - generic [ref=e290]:
      - button "Cancel" [ref=e291] [cursor=pointer]
      - button "Execute Import" [ref=e292] [cursor=pointer]
```

# Test source

```ts
  86  |    */
  87  |   test('Bug #1: ADD AS COPY 병합 후 _Imported 리비전이 히스토리 드롭다운에 표시됨', async ({ page }) => {
  88  |     const mockFile = makeMockImportFile();
  89  | 
  90  |     // ── Step 1: Import 모달 열기 ──
  91  |     await openImportModal(page, mockFile);
  92  | 
  93  |     // ── Step 2: merge 모드가 기본값으로 선택되어 있는지 확인 (동일 ID) ──
  94  |     const mergeSection = page.getByText('기존 프로젝트에 병합');
  95  |     await expect(mergeSection).toBeVisible();
  96  | 
  97  |     // EVT1 리비전 행에 'Add as Copy' 버튼이 활성화 상태인지 확인
  98  |     const addAsCopyBtn = page.getByRole('button', { name: /add as copy/i }).first();
  99  |     await expect(addAsCopyBtn).toBeVisible();
  100 | 
  101 |     // ── Step 3: Execute Import 실행 ──
  102 |     const executeBtn = page.getByRole('button', { name: /execute import/i });
  103 |     await expect(executeBtn).toBeVisible();
  104 |     await executeBtn.scrollIntoViewIfNeeded();
  105 |     await executeBtn.click();
  106 | 
  107 |     await dismissSuccessModal(page);
  108 | 
  109 |     // ── Step 4: [핵심 검증] History 드롭다운에 EVT1_Imported 표시 여부 ──
  110 |     // History 버튼: button[title='다른 차수(History) 선택']
  111 |     await expect(page.locator('text=Mitus IP Web Dashboard')).toBeVisible({ timeout: 5000 });
  112 | 
  113 |     const historyBtn = page.locator('button[title*="History"], button[title*="차수"]').first();
  114 |     if (await historyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  115 |       await historyBtn.click();
  116 |     } else {
  117 |       // fallback: 텍스트로 찾기
  118 |       await page.getByText('History').first().click();
  119 |     }
  120 | 
  121 |     // 수정 전: EVT1_Imported가 phases에 없어서 드롭다운 미표시 → FAIL
  122 |     // 수정 후: phases 동기화 후 표시됨 → PASS
  123 |     const importedItem = page.locator('button:has-text("EVT1_Imported"), [role="option"]:has-text("EVT1_Imported"), li:has-text("EVT1_Imported")');
  124 |     await expect(importedItem.first()).toBeVisible({ timeout: 5000 });
  125 |   });
  126 | 
  127 |   /**
  128 |    * [보조 검증] overwrite 액션 후에도 해당 revision이 phases에 유지되어야 한다.
  129 |    * (27b 크로스 체크 지적: overwrite 케이스도 phases에 포함해야 함)
  130 |    */
  131 |   test('Bug #1 보조: overwrite 액션 후에도 revision이 History 드롭다운에 유지됨', async ({ page }) => {
  132 |     const mockFile = makeMockImportFile();
  133 |     await openImportModal(page, mockFile);
  134 | 
  135 |     // Overwrite 버튼 클릭 (EVT1이 이미 존재하므로 활성화)
  136 |     const overwriteBtn = page.getByRole('button', { name: /overwrite/i }).first();
  137 |     if (await overwriteBtn.isEnabled({ timeout: 3000 }).catch(() => false)) {
  138 |       await overwriteBtn.click();
  139 |       // 덮어쓰기 경고 동의 체크박스
  140 |       const safetyCheckbox = page.locator('input[type="checkbox"]').last();
  141 |       await safetyCheckbox.check();
  142 |     }
  143 | 
  144 |     const executeBtn = page.getByRole('button', { name: /confirm.*overwrite|execute import/i });
  145 |     await executeBtn.scrollIntoViewIfNeeded();
  146 |     await executeBtn.click({ force: true });
  147 | 
  148 |     await dismissSuccessModal(page);
  149 | 
  150 |     // History 드롭다운에 EVT1이 계속 존재해야 함
  151 |     await expect(page.locator('text=Mitus IP Web Dashboard')).toBeVisible({ timeout: 5000 });
  152 | 
  153 |     const historyBtn = page.locator('button[title*="History"], button[title*="차수"]').first();
  154 |     if (await historyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  155 |       await historyBtn.click();
  156 |     } else {
  157 |       await page.getByText('History').first().click();
  158 |     }
  159 | 
  160 |     const evt1Item = page.locator('button:has-text("EVT1"), [role="option"]:has-text("EVT1"), li:has-text("EVT1")');
  161 |     await expect(evt1Item.first()).toBeVisible({ timeout: 5000 });
  162 |   });
  163 | });
  164 | 
  165 | // ─────────────────────────────────────────────────────────────────────────────
  166 | test.describe('Bug Screening - Bug #2: 백업 프로젝트 이름 식별 가능 여부', () => {
  167 |   test.beforeEach(async ({ page }) => {
  168 |     await login(page);
  169 |   });
  170 | 
  171 |   test('Bug #2: useBackup=true 시 생성된 백업 카드 이름에 "백업" 식별자가 포함됨', async ({ page }) => {
  172 |     const mockFile = makeMockImportFile();
  173 |     await openImportModal(page, mockFile);
  174 | 
  175 |     // '기존 프로젝트에 병합' 섹션이 있는지 확인하고 클릭 (이미 선택되어 있더라도 안전하게)
  176 |     const mergeSection = page.getByText('기존 프로젝트에 병합');
  177 |     await expect(mergeSection).toBeVisible();
  178 |     await mergeSection.click();
  179 | 
  180 |     // useBackup 체크박스가 나타날 때까지 대기 및 확인
  181 |     const backupCheckbox = page.locator('input[type="checkbox"]').first();
  182 |     await expect(backupCheckbox).toBeVisible({ timeout: 5000 });
  183 |     
  184 |     // 만약 체크되어 있지 않다면 체크 (기본값이 true여야 함)
  185 |     if (!(await backupCheckbox.isChecked())) {
> 186 |       await backupCheckbox.check({ force: true });
      |                            ^ Error: locator.check: Clicking the checkbox did not change its state
  187 |     }
  188 | 
  189 |     const executeBtn = page.getByRole('button', { name: /execute import/i });
  190 |     await executeBtn.scrollIntoViewIfNeeded();
  191 |     await executeBtn.click();
  192 | 
  193 |     await dismissSuccessModal(page);
  194 |     await expect(page.locator('text=Mitus IP Web Dashboard')).toBeVisible({ timeout: 5000 });
  195 | 
  196 |     // 백업 카드 이름에 '백업' 또는 '_BAK' 포함 여부 검사
  197 |     const allH3 = page.locator('h3');
  198 |     const count = await allH3.count();
  199 | 
  200 |     let backupFound = false;
  201 |     for (let i = 0; i < count; i++) {
  202 |       const name = await allH3.nth(i).textContent().catch(() => '');
  203 |       if (name && (name.includes('백업') || name.includes('_BAK'))) {
  204 |         backupFound = true;
  205 |         break;
  206 |       }
  207 |     }
  208 | 
  209 |     // 수정 전: 백업 이름 = 원본과 동일 (name 필드 미변경) → FAIL
  210 |     // 수정 후: ' (백업_timestamp)' 접미사 포함 → PASS
  211 |     expect(backupFound).toBe(true);
  212 |   });
  213 | });
  214 | 
  215 | // ─────────────────────────────────────────────────────────────────────────────
  216 | test.describe('Bug Screening - Bug #3: 브라우저 뒤로가기 시 프로젝트 잠금 해제 여부', () => {
  217 |   test.beforeEach(async ({ page }) => {
  218 |     await login(page);
  219 |   });
  220 | 
  221 |   test('Bug #3: 브라우저 뒤로가기 시 프로젝트 잠금이 해제되어야 함', async ({ page }) => {
  222 |     // 첫 번째 프로젝트 카드 클릭 (워크스페이스 진입 → Lock 발생)
  223 |     const firstCard = page.locator('[class*="bg-white"][class*="rounded"]').first();
  224 |     await expect(firstCard).toBeVisible({ timeout: 10000 });
  225 |     await firstCard.click();
  226 | 
  227 |     // 워크스페이스 진입 확인
  228 |     const workspaceIndicator = page.locator('text=Project_Overview, text=Workspace, [data-testid="workspace"]').first();
  229 |     await expect(workspaceIndicator.or(page.getByText('Project_Overview'))).toBeVisible({ timeout: 10000 });
  230 | 
  231 |     // 브라우저 뒤로가기
  232 |     await page.goBack();
  233 | 
  234 |     // 대시보드 복귀 확인
  235 |     await expect(page.locator('text=Mitus IP Web Dashboard')).toBeVisible({ timeout: 8000 });
  236 |     await page.waitForTimeout(1500); // 잠금 해제 API 호출 대기
  237 | 
  238 |     // Lock 아이콘이 사라졌는지 확인 (본인이 나갔으므로 Lock 해제되어야 함)
  239 |     // 수정 전: Lock 아이콘이 남아 있음 → FAIL
  240 |     // 수정 후: Lock 해제됨 → PASS
  241 |     const lockIcon = page.locator('[class*="bg-white"][class*="rounded"]').first().locator('svg[class*="lucide-lock"], [data-lucide="lock"]');
  242 |     await expect(lockIcon).not.toBeVisible({ timeout: 5000 });
  243 |   });
  244 | });
  245 | 
```