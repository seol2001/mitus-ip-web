# Revision Log Tab Bugfix Implementation Plan

본 계획은 `App.jsx`의 거대한 렌더링 블록을 독립된 컴포넌트로 분리하여 UI 구조를 체계화하고 파일 부피를 획기적으로 줄이는 상세 로드맵입니다. 각 단계마다 UI 무결성을 검증하고 수정 사항을 기록합니다.

## 📌 핵심 원칙
1. **디자인 유지**: UI 디자인, CSS 클래스, 레이아웃 구조는 1%도 수정하지 않습니다.
2. **MLX 전담**: 컴포넌트 분리 설계 및 코드 이전 작업은 전적으로 로컬 MLX 모델을 사용합니다.
3. **무결성 보장**: 프롭스(Props) 전달 과정에서 데이터나 핸들러가 누락되지 않도록 엄격히 관리합니다.
4. **D2C 프롬프팅 적용**: MLX 추론 시 '생각 과정'을 생략하고 '코드 결과물'에 집중하는 구조화된 프롬프트를 사용하여 토큰 유실을 방지합니다.
5. **MLX + bkit 중심의 4단계 협업 고도화**: 
   - **1단계 (분석 - MLX)**: 컴포넌트 설계 및 Props 인터페이스 사전 정의, 안티패턴 정밀 분석. 결과를 `bkit_memory`에 영구 저장.
   - **2단계 (검증 - bkit)**: `bkit_pre_write_check`를 통해 설계 문서와 구현 방향의 일치 여부 확인.
   - **3단계 (구현 - Cloud Gemini)**: MLX 설계와 bkit 검증 결과를 기반으로 코드 생성 및 `App.jsx` 주입.
   - **4단계 (사후 분석 - bkit)**: `bkit_pdca_analyze`를 사용하여 설계와 구현 사이의 간극(Gap) 분석 및 사용자 QA.


## 💡 로컬 모델(MLX-Qwen) 활용 가이드라인 및 레슨런

1. **프롬프팅 전략: 억압 대신 분리 유도 (Structured Output)**
   - **문제**: "생각하지 마(No thinking)", "JSON만 출력해"와 같은 강력한 부정어 제약(Negative Prompting)은 추론형 모델에서 쉽게 무시되며, 오히려 불필요한 텍스트 출력으로 이어집니다.
   - **해결**: 모델의 본능적인 '단계별 추론(Chain-of-Thought)'을 허용하되, `<think>생각 과정</think>`와 같이 별도 태그로 격리시키고 최종 결과물만 `<json>결과</json>` 등에 담도록 구조화된 출력을 요구해야 합니다.
2. **토큰 자원 할당: `max_tokens`의 여유로운 설정**
   - **문제**: 복잡한 코드 블록 분석 시, 모델이 추론을 작성하다가 `max_tokens`(예: 1200) 제한에 걸려 실제 결과물 출력이 중간에 잘리는 현상(Truncation)이 발생합니다.
   - **해결**: 코드 구조 분석이나 컴포넌트 Props 추출과 같은 고부하 태스크에서는 `max_tokens`를 최소 2000~4000 이상으로 넉넉하게 설정하여 모델이 작업을 끝마칠 수 있는 환경을 보장해야 합니다.
3. **태스크 세분화 (Single-Purpose Prompting)**
   - 한 번의 프롬프트로 "분석하고, 코드 짜고, JSON으로 포맷팅해"라고 요구하는 대신, "1. 상태만 추출해", "2. 함수만 추출해"처럼 로컬 모델의 처리 한계에 맞춰 지시를 잘게 쪼개는 것이 정확도를 높이는 지름길입니다.

---

## 🐞 Bug Tracking & Fix Log

### Bug #1: 편집 모드가 아님에도 탭 이동 시 '작성 취소' 경고 발생
- **현상**: Revision log tab 내에서 편집 모드가 활성화되지 않은 상태에서도 탭 간 이동(예: All Logs <-> My Logs) 시 "작성 중인 내용이 있습니다. 저장하지 않고 정말 취소하시겠습니까?" 모달이 발생함.
- **원인 분석**: 
    - `handleTabSwitch` 및 `handleIpChange` 함수에서 `isDirtyRef.current` 상태만으로 경고 모달 노출 여부를 결정함.
    - `eval`, `reopen`, `carryover` 모드는 폼 초기화 시 `targetIssue` 필드를 채우는데, `checkIfDirty` 함수는 이 필드가 존재하면 '수정 중(Dirty)'으로 판단함.
    - 결과적으로 사용자가 '편집' 버튼을 눌러 편집 모드(`isTabEditing`)에 진입하지 않았음에도, 내부적으로 폼이 Dirty 상태로 인식되어 탭 전환 시 경고가 발생함.
- **수정 방향**: 
    - `handleTabSwitch`와 `handleIpChange` 내의 조건문에 `isTabEditing` 상태 확인을 추가하여, 실제 편집 모드일 때만 Dirty 체크를 수행하도록 수정.
- **조치 결과**: 
    - **1단계 (분석 - MLX)**: MLX-Qwen을 통해 `isDirtyRef.current`가 읽기 전용 모드에서도 유지되는 근본 원인 분석 완료. 
    - **2단계 (검증 - bkit)**: `bkit_pre_write_check`를 통해 구현 전 무결성 확인.
    - **3단계 (구현 - Cloud Gemini)**: 
        - `handleTabSwitch` 및 `handleIpChange` 조건문에 `isTabEditing` 추가.
        - `handleIpChange` 의존성 배열에 `isTabEditing` 추가.
        - `isDirtyRef` 업데이트 로직에 `isTabEditing` 조건을 추가하여 읽기 전용 모드 시 강제 초기화(MLX 권장사항 반영).
    - **4단계 (사후 분석 - bkit)**: 구현 결과 최종 검증 완료.

### Bug #2: 이슈 카드 클릭 시 좌측 폼에 내용이 표시되지 않는 현상
- **현상**: 우측 리스트에서 이슈 카드를 클릭하면 좌측의 `IssueForm`에 해당 이슈의 상세 내용이 채워져야 하나, 일부 이슈의 경우 클릭해도 아무런 반응이 없거나 내용이 표시되지 않음.
- **원인 분석**: 
    - `IssueForm.jsx`에서 `initialData` 변경을 감지할 때 사용하는 `currentId`가 `editingId || initialData.issueNum || 'new'`로 구성됨.
    - [ACTION REQUIRED] 섹션의 항목들은 아직 저장되지 않은 상태라 `editingId`가 `null`이며, 동일 IP의 경우 `makeDefaultForm`이 제안하는 `issueNum`이 동일하게 중복됨.
    - 결과적으로 서로 다른 항목을 클릭해도 `currentId`가 변하지 않은 것으로 오판하여 `setFormData`가 실행되지 않음.
- **수정 방향**: 
    - `currentId` 계산 로직에 고유값이 보장되는 `targetIssue` 필드를 추가하여 개별 항목을 정확히 식별하도록 수정.
- **조치 결과**: 
    - **1단계 (분석 - MLX)**: MLX-Qwen을 통해 `IssueForm`의 `useEffect` 내 식별자 중복 문제 분석 완료.
    - **2단계 (검증 - bkit)**: `bkit_pre_write_check` 수행.
    - **3단계 (구현 - Cloud Gemini)**: `IssueForm.jsx`의 `currentId` 생성 로직 수정 완료.
    - **4단계 (사후 분석 - bkit)**: 프로세스 준수 확인 및 기록 완료.

### Bug #3: 기존 이슈 수정 시 중복 데이터 생성 현상
- **현상**: 기존 이슈(예: ISSUE#1)를 불러와서 수정을 완료하고 '리스트에 추가' 또는 '수정 사항 저장'을 클릭하면, 기존 항목이 업데이트되는 대신 동일한 Issue #를 가진 새로운 카드가 중복으로 생성됨.
- **원인 분석**: 
    - `IssueForm` 내부의 드롭다운(eval, carryover, reopen, new)에서 기존 이슈를 선택할 때, 폼 데이터는 업데이트되지만 부모 컴포넌트(`RevisionLogTab`)의 `editingId` 상태가 `null`로 유지되는 구간이 다수 존재함.
    - 특히 이전 작업에서 `new` 모드만 수정하고 `eval`, `carryover`, `reopen` 모드의 드롭다운 핸들러 수정을 누락하여, 평가 작업 등에서 중복이 계속 발생함.
    - `handleSave` 로직이 부모의 `editingId`에만 의존하며, 전달된 데이터의 `id`를 참고하여 자동으로 수정 모드로 전환하는 가드 로직이 부재함.
- **수정 방향**: 
    - `IssueForm`의 모든 모드별 드롭다운 `onChange` 핸들러에 `onSetEditingId` 호출을 추가하여 상태를 완벽히 동기화함.
    - `RevisionLogTab`의 `handleSave`에서 `editingId`가 없더라도 데이터에 `id`가 포함된 경우 이를 존중하거나, 동기화가 확실히 이루어지도록 보강.
- **조치 결과**: 
    - **1단계 (분석 - MLX)**: (재분석 완료) `eval`, `carryover`, `reopen` 모드의 드롭다운에서 `onSetEditingId` 호출 누락 확인.
    - **2단계 (검증 - bkit)**: `bkit_pre_write_check` 수행.
    - **3단계 (구현 - Cloud Gemini)**: 
        - `IssueForm.jsx`: 모든 모드별 드롭다운 `onChange`에 `onSetEditingId` 호출 추가 및 ID 초기화 가드 보강.
        - `RevisionLogTab.jsx`: `handleSave`에서 `editingId`가 누락되더라도 데이터 내 `id`가 존재하면 수성 모드로 자동 인식하도록 `effectiveEditingId` 가드 추가 (이중 방어 로직).
    - **4단계 (사후 분석 - bkit)**: 모든 경로에서 중복 생성 가능성 차단 완료.


### Bug #4: FA 리포트 연동 시 데이터 누락 현상
- **현상**: FA 리포트에서 '데이터 가져오기'를 통해 이슈를 등록할 때, FA 리포트의 'Phenomenon(현상)' 및 'Root Cause(원인)' 내용이 Revision Log의 폼으로 정상적으로 전달되지 않고 빈 칸으로 표시됨.
- **원인 분석**: 
    - `IssueForm.jsx`의 `useEffect` 내에서 `initialData` 변경을 감지하는 `currentId` 계산 로직에 `faId`가 누락되어 있었음.
    - FA 연동 시 새로운 이슈(id 없음)를 생성하려 할 때, 제안되는 `issueNum`이 이전의 빈 "New" 상태와 동일하면 `currentId`가 변하지 않은 것으로 인식되어 `setFormData`가 실행되지 않음.
- **수정 방향**: 
    - `IssueForm.jsx`의 `currentId` 식별 로직에 `faId`를 추가하여 FA 연동 시 데이터가 즉시 반영되도록 수정.
    - 부모인 `RevisionLogTab.jsx`에서 `IssueForm` 호출 시 `key` 속성에 `faId`를 추가하여 데이터 소스 변경 시 컴포넌트 강제 리마운트를 보장함.
- **조치 결과**: 
    - **1단계 (분석 - MLX)**: MLX-Qwen을 통해 `currentId` 식별 로직의 충돌 문제 및 `faId` 누락 원인 규명 완료.
    - **2단계 (검증 - bkit)**: `bkit_pre_write_check` 수행 및 설계 무결성 확인.
    - **3단계 (구현 - Cloud Gemini)**: 
        - `IssueForm.jsx`: `currentId`에 `initialData.faId` 추가.
        - `RevisionLogTab.jsx`: `IssueForm`의 `key` 프롭에 `formData.faId` 추가.
    - **4단계 (사후 분석 - bkit)**: FA 연동 시 데이터가 정상적으로 폼에 로딩되는 구조 확보 완료.

### Bug #5: FA 리포트 저장 후 탭 자동 전환 현상
- **현상**: 'FA 리포트 연동' 모드에서 이슈를 저장하면, 사용자의 의도와 상관없이 탭이 '신규 이슈 등록'으로 강제 전환됨.
- **원인 분석**: `RevisionLogTab.jsx`의 `handleSave` 함수 내에 `mode === 'fa'`일 경우 강제로 `setMode('new')`를 호출하는 코드가 포함되어 있었음.
- **수정 방향**: 해당 자동 전환 로직을 제거하여 사용자가 현재 작업 중인 'FA 리포트 연동' 워크플로우를 유지할 수 있도록 수정.
- **조치 결과**: 
    - **1단계 (분석 - Cloud Gemini)**: `handleSave` 내의 불필요한 `setTimeout` 기반 모드 전환 로직 확인.
    - **2단계 (구현 - Cloud Gemini)**: 해당 코드 블록 삭제 완료.
    - **3단계 (사후 분석 - bkit)**: 저장 후에도 'FA 리포트 연동' 탭이 유지되며, 폼이 정상적으로 초기화되어 다음 FA 연동 작업을 즉시 수행할 수 있는 환경 확인.

### Bug #6: Revision Log 데이터 저장 후 대시보드 이탈 시 유실 현상
- **현상**: Revision Log에서 저장을 완료하고 대시보드로 나갔다가 다시 들어오면, 마지막으로 수정한 내용이 반영되어 있지 않음. (다른 탭으로 이동 시에는 유지됨)
- **원인 분석**: 
    - `App.jsx`의 `handleTabSubmit`이 `setTimeout(..., 0)`을 사용하여 비동기로 DB 저장을 수행함.
    - 사용자가 '저장' 후 즉시 'Dashboard'를 클릭하면, `executeExit`이 실행되어 DB의 프로젝트 잠금(`locked_by`)을 즉시 해제함.
    - 뒤늦게 실행된 DB 저장 요청(`updateProjectData`)은 `.eq('locked_by', userId)` 조건에 의해 권한 없음으로 처리되어 저장이 무산됨 (레이스 컨디션).
- **수정 방향**: 
    - `App.jsx`의 저장 로직을 `async/await` 구조로 변경하고 진행 중인 저장 작업을 추적하는 `pendingSavesRef` 도입.
    - 대시보드 이탈(`executeExit`) 시, 진행 중인 저장 작업이 있다면 완료될 때까지 대기한 후 잠금을 해제하도록 시퀀스 보장.
- **조치 결과**: 
    - **1단계 (분석 - Cloud Gemini)**: 저장 비동기 틱과 잠금 해제 간의 레이스 컨디션 정밀 진단.
    - **2단계 (구현 - Cloud Gemini)**: 
        - `App.jsx`: `pendingSavesRef` 추가, `handleTabSubmit` 안정화, `executeExit` 대기 로직 추가.
        - `App.jsx`: 초기 로딩 레이스 컨디션 해결 (loading 상태 체크 추가).
        - `RevisionLogTab.jsx`: `handleSave`에서 불필요한 `handleUpdate` 호출 제거(중복 저장 방지).
    - **3단계 (사후 분석 - bkit)**: 저장 직후 이탈 시에도 데이터 정합성이 완벽히 유지됨을 확인.

### Bug #7: FA 리포트 연동 탭의 비일관적인 자동 편집 모드 전환
- **현상**: Revision Log 진입 시 기본적으로 읽기 전용 모드이나, 'FA 리포트 연동' 서브 탭을 클릭하면 프로젝트가 잠겨있거나 아카이브된 상태임에도 불구하고 자동으로 편집 모드(ActionBar의 저장/취소 버튼 활성화)로 전환됨.
- **원인 분석**: `RevisionLogTab.jsx`의 `handleTabSwitch` 함수 내에 `mode === 'fa'`일 때 무조건 `setIsTabEditing(true)`를 호출하는 강제 로직이 포함되어 있었음. 이는 다른 서브 탭들의 동작과 일관성이 없으며 보안 가드를 우회함.
- **수정 방향**: 
    - `handleTabSwitch`에서 `fa` 탭으로 전환 시 자동으로 편집 모드를 활성화하는 로직을 제거하여 다른 탭들과 일관성을 맞춤.
    - `IssueForm.jsx`의 'FA 리포트에서 데이터 가져오기' 버튼의 비활성화 조건을 `isArchived`에서 `isReadOnly`로 강화하여 탭 편집 상태를 준수하도록 수정.
- **조치 결과**: 
    - **1단계 (분석 - Cloud Gemini)**: 서브 탭 전환 로직의 비일관성 및 전역 잠금 상태 무시 문제 확인.
    - **2단계 (구현 - Cloud Gemini)**: 
        - `RevisionLogTab.jsx`: `handleTabSwitch` 내 자동 `setIsTabEditing(true)` 로직 제거.
        - `IssueForm.jsx`: FA Pull 버튼의 `disabled` 속성을 `isReadOnly`로 업데이트.
    - **3단계 (사후 분석 - bkit)**: 모든 서브 탭이 일관되게 초기 읽기 전용 상태를 유지하며, 사용자가 명시적으로 '수정'을 눌렀을 때만 편집이 가능해짐.

### Bug #8: FA 연동 해제 시 이슈 카드 잔존 현상
- **현상**: 이슈 카드(우측)에서 삭제를 누르면 카드도 사라지고 FA 연동도 정상 해제되지만, 폼(좌측)에서 '연동 해제'를 누르면 FA 연동만 해제될 뿐 이슈 카드가 우측 리스트에 그대로 남아 있음.
- **원인 분석**: `handleUnlinkFa` 함수가 단순히 폼의 `faId` 필드만 초기화하고, 실제 이슈 리스트(`issues`)를 업데이트하는 로직이 누락되어 있었음. 반면 카드에서 사용하는 `handleDeleteRequest`는 리스트에서 항목을 제거하는 로직이 포함되어 있어 동작의 불일치가 발생함.
- **수정 방향**: `handleUnlinkFa`를 고도화하여, 이미 리스트에 등록된 이슈(`editingId` 존재)인 경우 `handleDeleteRequest`와 동일한 삭제/해제 통합 프로세스를 거치도록 수정하여 정합성 확보.
- **조치 결과**: 
    - **1단계 (분석 - Cloud Gemini)**: 폼의 연동 해제와 카드의 삭제 기능 간의 데이터 처리 시퀀스 불일치 확인.
    - **2단계 (구현 - Cloud Gemini)**: `RevisionLogTab.jsx`의 `handleUnlinkFa`를 비동기(`async`)로 변경하고, `editingId` 존재 시 `handleDeleteRequest`를 호출하도록 로직 통합.
    - **3단계 (사후 분석 - bkit)**: 폼에서 연동 해제 시에도 카드가 정상적으로 제거되며, FA 리포트 상태가 미연동으로 정확히 동기화됨을 확인.

### Bug #9: FA 연동 해제 시 중복 컨펌 모달 발생 현상
- **현상**: FA 연동 해제(또는 삭제)를 선택하면 "FA 연동 해제" 컨펌 모달이 뜨고, 이를 수락하면 연이어 "작성 취소" 컨펌 모달이 한 번 더 발생함.
- **원인 분석**: `handleDeleteRequest`에서 사용자의 확답을 받은 후 `cancelEdit()`를 호출하는데, `cancelEdit` 내부에서 다시 한번 `isDirty` 상태를 체크하여 컨펌 모달을 띄우는 중복 로직이 작동함.
- **수정 방향**: `cancelEdit` 함수에 `skipConfirm` 파라미터를 추가하여, 이미 상위 로직에서 사용자 동의를 얻은 경우에는 중복된 컨펌 없이 즉시 폼을 초기화하도록 수정.
- **조치 결과**: 
    - **1단계 (분석 - bkit/PDCA)**: `handleDeleteRequest`와 `cancelEdit` 간의 호출 체인 및 상태 제어 흐름 분석.
    - **2단계 (구현 - Cloud Gemini)**: 
        - `cancelEdit`: `skipConfirm` 인자 추가 및 조건부 모달 로직 적용.
        - `handleDeleteRequest`: 연동 해제 확정 시 `cancelEdit(true)`를 호출하여 시퀀스 최적화.
    - **3단계 (사후 분석 - bkit)**: 연동 해제 시 단 한 번의 컨펌으로 작업이 완료되며, 사용자 경험(UX)이 개선됨을 확인.
