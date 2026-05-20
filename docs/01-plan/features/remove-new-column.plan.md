# remove-new-column - Plan Document

> Version: 1.0.0 | Date: 2026-05-20 | Status: Draft
> Level: Dynamic

---

## 1. Overview

### 1.1 Purpose
- MilestoneMetricsTable 내에서 불필요하게 단독 칼럼으로 존재하며 전체 합산 집계 구조(`TOTAL = CLOSED + OPEN + DEFERRED`)에 혼동을 주는 `NEW` 칼럼을 완벽하게 제거합니다.
- 대신 신규 이슈 개수(`NEW` 수치)를 `TOTAL` 또는 `OPEN` 지표 내부로 자연스럽게 병합하는 **인라인(Inline) 데이터 표시 레이아웃**을 수립하여 가독성과 의미적 명확성을 극대화합니다.

### 1.2 Background
- 현재 `TOTAL`에 집계되는 수치는 `CLOSED + OPEN + DEFERRED`입니다.
- 그러나 `NEW` 칼럼이 `TOTAL` 바로 오른쪽에 하나의 완전한 칼럼으로 노출되고 있어, 사용자로 하여금 "TOTAL에 NEW가 더해지는 것인가?" 또는 "NEW와 OPEN은 별개인가?"와 같은 구조적 인지 혼동을 초래하고 있습니다.
- UI 디자인은 우아하게 유지하되, 데이터가 가지는 의미를 왜곡 없이 직관적으로 읽을 수 있도록 데이터 표시 방식을 개편할 필요가 있습니다.

---

## 2. Goals

### 2.1 Primary Goals
- [x] MilestoneMetricsTable 컴포넌트에서 `NEW` 칼럼 완전 제거.
- [x] `TOTAL`, `CLOSED`, `OPEN`, `DEFERRED` 등 기존 칼럼 셀에 당일/금차에 발생한 신규 유입 이슈 수치를 괄호 `(+N)` 형태로 병합하여 표시하는 기획안 도출.
- [x] 신규 이슈가 `REV` 인지 `DEBT` 인지 성격에 맞춰 특정 칼럼(예: `OPEN`)에 알맞게 타게팅 표시하는 인라인 로직 구현.
- [x] 은은하고 트렌디한 **Premium Light Glassmorphism** 디자인을 손상시키지 않고, 괄호 표시부의 타이포그래피 및 강조색 스킨 조화 유지.

### 2.2 Non-Goals
- Supabase DB 스키마 또는 API 호출 비즈니스 구조를 수정하는 일.
- MilestoneMetricsTable 외부의 다른 탭이나 레이아웃의 구조를 변경하는 일.

---

## 3. Scope

### 3.1 In Scope
- `src/components/tabs/MilestoneMetricsTable.jsx`의 테이블 헤더 및 바디 셀 구조 개편.
- `useLogData.js` 등에서 집계되는 `NEW` 관련 데이터 모델 추출 흐름 및 병합 렌더링 로직.
- 인라인 병합에 따른 신규 건수 `(+N)`의 텍스트 색상 스킨 지정(강조 붉은색 또는 소프트 틴트 테마).

### 3.2 Out of Scope
- DB RLS 정책 및 권한 계층 변경.
- 새로운 페이지 라우팅 신설.

---

## 4. Success Criteria

- [ ] MilestoneMetricsTable 내에서 `NEW` 헤더와 셀 칼럼이 눈에 띄지 않게 완벽히 정리됨.
- [ ] 신규 유입 이슈가 존재할 때, 사용자 지정 칼럼(TOTAL 또는 OPEN 등)에 인라인 형태로 `8 (+1)`과 같이 명확히 렌더링됨.
- [ ] 빌드(`npm run build`) 결과가 에러나 경고 없이 성공적으로 컴파일됨.
- [ ] 로컬 모델(gemma4, 27b)의 2중 설계 및 감리 검증 통과.

---

## 5. Schedule

| Phase | Target Date | Status |
|-------|------------|--------|
| Plan | 2026-05-20 | In Progress |
| Design | 2026-05-20 | Pending |
| Implementation | 2026-05-20 | Pending |
| Review | 2026-05-20 | Pending |

---

## 6. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| 가로폭 축소 시 괄호 표기로 인한 텍스트 줄바꿈 현상 재발 | High | Low | `whitespace-nowrap` 속성을 다시 명시하고 글꼴 크기를 살짝 축소하여 방지 |
