# remove-new-column - Design Document

> Version: 1.0.0 | Date: 2026-05-20 | Status: Draft
> Level: Dynamic | Plan: docs/01-plan/features/remove-new-column.plan.md

---

## 1. Overview

### 1.1 Purpose
- `MilestoneMetricsTable` 내의 불필요하고 혼동을 주는 `NEW` 칼럼을 삭제합니다.
- 신규 등록 건수(`NEW` 수치)를 데이터 무결성(SSoT)과 수학적 공식에 모순을 주지 않도록 **`OPEN` 칼럼 내부에 인라인 병합**합니다.

### 1.2 Design Goals
- **수학적 정합성 보존**: `TOTAL = CLOSED + OPEN + DEFERRED` 공식을 절대 훼손하지 않음.
- **CLS (Cumulative Layout Shift) 0% 달성**: 신규 건수가 0건일 때도 레이아웃 흔들림(CLS)이 발생하지 않도록 공간 예약식 방어 스킨 도입.
- **프리미엄 소프트 틴트 테마**: 쨍하지 않은 은은하고 트렌디한 `Rose-500/10` 틴트 및 상첨자(Superscript) 폰트 조화.

---

## 2. Architecture & Data Flow

### 2.1 System Architecture
- 하위 렌더링 컴포넌트인 `MilestoneMetricsTable.jsx` 단독 리팩토링.
- 기존 SSoT 상태 데이터를 공급하는 `useLogData.js` 및 `RevisionLogTab.jsx` 프로토콜과의 구조적 100% 호환성 유지.

### 2.2 Component Design
- **기존 구조 (Columns)**: Milestone | Total | New | Closed | Open (REV / DEBT) | Deferred | Resolution Rate
- **개편 후 구조 (Columns)**: Milestone | Total | Closed | Open (REV / DEBT) | Deferred | Resolution Rate
- **인라인 데이터 병합 규칙**:
  - `TOTAL`은 이중 계산(Double Counting) 오해 방지를 위해 깨끗하게 총량만 유지 (`row.total`).
  - `OPEN` 칼럼 내에서 미결 부채 총합 뱃지 우측 상단 또는 옆에 `(+N)` 상첨자 형태로 병합.
  - 예: OPEN이 4건이고 이번 차수 신규 유입 건이 1건이면, `4 (+1)` 형태로 렌더링.

### 2.3 Data Flow
1. `useLogData` 훅이 DB 데이터(이월 미판정 + 신규 유입)를 계산하여 `stats` 배열로 리턴.
2. `MilestoneMetricsTable`이 `stats` 배열을 받아 순회 렌더링.
3. 셀 렌더링 시 `row.new === 0` 인 경우, CLS 방지를 위해 마크업의 공간은 확보하되 `visibility: hidden` 스타일을 적용해 시각적 노이즈를 완전 제거함.

---

## 3. Data Model & Math Rationale

### 3.1 Mathematical Rationale (Qwen 27B Audit)
- **공식**: `TOTAL = CLOSED + OPEN + DEFERRED`
- `NEW`는 현재 기간(금차)에 유입된 변동량(Flow Metric)으로, 아직 조치되지 않은 부채이므로 본질적으로 `OPEN` 범주에 이미 합산되어 있음.
- **TOTAL에 병합 시 리스크**: `TOTAL(+1)`로 표시하면 사용자가 `TOTAL = CLOSED + OPEN + DEFERRED + NEW`로 이중 합산(Double Counting) 오해를 함.
- **OPEN에 병합 시 가치**: `OPEN(+1)`은 `현재 오픈 부채 (그 중 신규 유입분)`로 인식되어 워크플로우 전이 모델과 정확히 일치함.

---

## 4. Technical Specifications & Tailwind CSS

### 4.1 Layout Constraints & CSS Grid
- 칼럼 폭 백분율 비율 재배치로 CLS 차단:
  - `Milestone`: `w-[20%]`
  - `Total`: `w-[10%]` (NEW가 빠진 12% 여분을 기존 셀에 재분배)
  - `Closed`: `w-[15%]`
  - `Open`: `w-[22%]` (인라인 상첨자 괄호 표기를 위한 충분한 가로폭 확보)
  - `Deferred`: `w-[15%]`
  - `Resolution Rate`: `w-[18%]`
- **상첨자 괄호 텍스트 스타일**:
  - `text-rose-500 bg-rose-50/70 border-rose-100/50 rounded px-1 py-0.5 ml-1 text-[10px] font-black`
  - `whitespace-nowrap`을 강제하여 가로폭 축소 시 텍스트 깨짐 차단.

---

## 5. Implementation Plan

### 5.1 File Structure
- [MODIFY] [MilestoneMetricsTable.jsx](file:///Users/jacobseol/Library/CloudStorage/SynologyDrive-DS716p/Antigravity/Mitus_IP_Web/mitus-ip-web/src/components/tabs/MilestoneMetricsTable.jsx)

### 5.2 Implementation Order
1. `MilestoneMetricsTable.jsx` 헤더의 `New` 칼럼 `<th>` 삭제 및 전체 열 너비 비율(`w-[%]`) 미세 조정.
2. 바디 영역의 `row.new` 단독 뱃지 td 삭제.
3. `OPEN` 데이터 렌더링 td 셀 내부에 `row.new > 0`인 경우 `(+N)` 형태의 뱃지를 인라인 렌더링하되, `row.new === 0`일 때는 CLS 방지를 위해 보이지 않는 격리 스페이서 또는 숨김 속성 적용.
4. Vite 프로덕션 빌드 테스트 및 모바일 뷰 크로스 검증.

---

## 6. Security Considerations
- **XSS 차단**: `{row.new}` 표현식은 React의 기본 Escaping 기작을 따르며, 인라인 병합 시 어떠한 위험한 동적 마크업 주입도 허용하지 않음.
- **RLS 연동**: 탭 데이터 추출 시 Supabase RLS 정책에 의해 승인된 데이터셋 범위만을 표시하며, 병합 처리가 RLS 보안 계층을 우회하지 않음.
