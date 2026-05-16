# Mitus IP Web Revision Log Mock Data Generation Instruction

이 문서는 Mitus IP Web 시스템의 정합성 테스트 및 데모를 위한 고품질 Mock Data를 생성할 때 사용하는 Gemini/LLM용 Instruction입니다.

---

## [Instruction Prompt]

너는 반도체 설계(System IC) 프로젝트 매니저이자 시스템 아키텍트야. 
현재 'Mitus IP Web' 이라는 사내 Revision Log 시스템의 Mock Data를 생성하려고 해. 
프로젝트 라이프사이클은 'EVT0(Baseline)'부터 시작하여 여러 단계의 '진행 차수(EVT1, EVT2...)'를 거쳐 '최종 차수'로 마무리되는 흐름으로 구성되어 있어.

아래의 Ground Rule과 허용된 Field 값을 엄격하게 준수해서 전체 흐름이 완벽하게 이어지는 JSON 데이터를 작성해 줘. 

### 1. Ground Rules & Constraints

#### 1-1. 차수 간 데이터 정합성 (Stage Transition Integrity) - ⭐️ 가장 중요
- 각 차수는 독립된 데이터가 아니며, 이전 차수의 결과가 다음 차수의 원인이 되어야 함.
- **필수 추적**: 이전 차수에서 'Revision'으로 대책을 세운 이슈는 👉 다음 차수에서 무조건 `entryMode: 'eval'`로 등장해서 검증(`assessment: 'Fixed' | 'Partial'`)을 받아야 함.
- **이월 규칙**: 이전 차수에서 미해결('OPEN')이거나 보류('Deferred')된 이슈는 👉 다음 차수에서 무조건 `entryMode: 'carryover'`로 이관되어야 함.
- **누락 금지**: 이전 차수의 미종결 이슈 리스트와 다음 차수의 `loadedIssues` 및 `targetIssue` 매핑 리스트는 100% 일치해야 함.

#### 1-2. 이슈 번호 및 ID 정합성 규칙 (ID Consistency) - ⭐️ 중요
- **프로젝트 이름 일치**: `projectId`, `Project_Name` 그리고 이슈 ID에 포함되는 `{projectId}` 문자열은 **모두 100% 동일**해야 함. (예: 프로젝트명이 `SM5720_MOCK`이면 이슈 ID도 `Buck.SM5720_MOCK.ISSUE#1`이어야 함. `SM5720`으로 혼용 절대 금지)
- **ID 명명 규칙**: `{ipBlock}.{projectId}.{issueNum}` 포맷을 반드시 준수할 것.
- **채번 규칙**: `issueNum` 필드는 각 `ipBlock` 단위로 1부터 누적 채번함. (예: EVT0에서 ISSUE#1, ISSUE#2 생성 -> EVT1에서 해당 IP 신규 생성 시 ISSUE#3부터 시작)
- **참조 규칙**: 다음 차수에서 이전 이슈를 참조(`eval`, `reopen`, `carryover`)할 때 `targetIssue` 필드에 위 고유 ID를 토씨 하나 안 틀리고 정확히 기재할 것.

### 2. 차수별 작성 규칙

#### 2-1. EVT0 (Baseline 단계)
- 최초 단계이므로 모든 이슈의 `entryMode`는 무조건 'new'임.
- 하드웨어 수정이 불가능한 Baseline 평가이므로 **`disposition`은 절대로 'Revision'이 될 수 없음.** ('SW Workaround', 'Test Screening', 'Acceptable' 등만 가능)

#### 2-2. 중간 차수 (EVT1, EVT2...)
- 이전 차수의 이슈들을 추적해서 `eval` 또는 `carryover`로 먼저 채운 뒤, 신규 이슈(`new`)를 추가함.
- 이 단계부터는 칩 수정을 의미하는 `disposition: 'Revision'`을 사용할 수 있음.

#### 2-3. 최종 차수 (Final Stage)
- 모든 과거 이슈의 종결 여부를 확인하는 단계임.
- **Reopen 시나리오**: 과거에 'SW Workaround'로 임시 종결했던 이슈가 양산 검증에서 수율 문제를 일으켜 `entryMode: 'reopen'` 되는 케이스를 1개 포함할 것. (`previousStateSummary`, `reopenReason` 필드 필수)
- 모든 이슈가 양산 가능('Acceptable') 하거나 확실한 우회 대책('SW Workaround')으로 종결 처리되도록 스토리를 구성할 것.

#### 2-4. Project Overview & IP Index 작성 규칙
- 모든 차수(Stage)의 JSON 데이터에는 `projectOverview` 객체가 포함되어야 함.
- **필수 필드**: `Project_Name`, `Process`, **`IP_Blocks` (중요)**
- **`IP_Blocks`**: 프로젝트에 포함된 모든 IP 이름의 문자열 배열임. (예: `["Buck", "LDO", "Boost"]`)
- **주의**: 이 배열이 누락되거나 `undefined`일 경우 UI에서 `.length` 에러가 발생하므로 반드시 유효한 배열로 생성할 것.

### 3. 허용되는 Field 값 (Enum)

- `severity`: 'Fail', 'Major', 'Minor', 'Marginal'
- `disposition`: 'Revision' (EVT0 제외), 'SW Workaround', 'Test Screening', 'Acceptable', 'Waived', 'System Mitigation'
- `assessment` (eval 모드 시): 'Fixed', 'Partial', 'Deferred'
- `carryoverAction` (carryover 모드 시): 'Keep Open', 'Close', 'Revision'
- `verificationGap`: 아래 4번 가이드 참조

### 4. Verification Gap (검증 누락 분석) 필수 작성
신규(new), 이월(carryover), 재오픈(reopen) 이슈가 발생할 경우, 사전 검증 누락 원인을 분석하는 필드를 반드시 채워야 함.

- **`verificationGap` 허용 값**: 
  - `Verification Plan Omission`: 테스트 플랜 누락
  - `Model/PDK Mismatch`: 시뮬레이션 모델과 실리콘 특성 불일치
  - `Simulation Limitation`: 시뮬레이션 시간/인프라 한계
  - `Review Miss (Human Error)`: 리뷰 누락 및 인적 실수
  - `Spec Ambiguity`: 스펙 정의 모호성
  - `Etc.`: 기타 사유
- **`gapComment`**: 구체적인 엔지니어링 사유 기재 (예: "저온 가혹 환경에서의 다이내믹 로드 커플링 조건 시뮬레이션 항목 누락")
