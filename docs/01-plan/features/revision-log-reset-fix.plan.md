# revision-log-reset-fix - Plan Document

> Version: 1.0.0 | Date: 2026-05-19 | Status: Active
> Level: Dynamic

---

## 1. Overview

### 1.1 Purpose
Mitus IP Web의 Revision Log 시스템에서 "판정 초기화" 버튼을 클릭했을 때 발생하는 무반응 결함을 해결하고, 안정적인 트랜잭션 흐름을 구축합니다.

### 1.2 Background
`src/components/IssueForm.jsx`의 "판정 초기화" 버튼은 `onReset(formData.id)` 콜백 함수를 실행하려고 시도하나, 이를 호출하는 부모 컴포넌트인 `src/components/tabs/RevisionLogTab.jsx`에서 `onReset` Prop을 전달하지 않아 결함이 발생하고 있습니다. 이는 컴포넌트 간의 인터페이스 계약 위반(Interface Contract Violation)에 해당하며, SSoT(Single Source of Truth) 원칙 및 RLS(Row Level Security) 검증 흐름과의 온전한 결합이 필요합니다.

## 2. Goals

### 2.1 Primary Goals
- [x] `RevisionLogTab.jsx`에서 `IssueForm` 컴포넌트로 `onReset` Prop을 바인딩하여 인터페이스 계약 복구.
- [x] 단순한 UI 폼 초기화가 아닌, 데이터 무결성 및 Supabase RLS 검증을 보장하기 위해 기존의 `handleDeleteRequest` 비동기 흐름과 연계하여 DB 동기화(조치 내용 초기화)를 보장.
- [x] `executeSafe` 파이프라인 및 `AbortSignal` 가드를 적용하여 메모리 누수 및 레이스 컨디션 완벽 차단.

### 2.2 Non-Goals
- UI 레이아웃, CSS 스타일 또는 픽셀 단위의 디자인 변경을 하지 않음 (Main Principles의 UI/UX Preservation 원칙 준수).

## 3. Scope

### 3.1 In Scope
- `src/components/tabs/RevisionLogTab.jsx` 파일 수정
  - `handleReset` 콜백 함수 구현
  - `IssueForm`에 `onReset={handleReset}` Prop 전달

### 3.2 Out of Scope
- DB 스키마 수정이나 별도의 supabase RLS 정책 신설 (기존 검증된 RLS & onSubmit API 계약 활용).

## 4. Success Criteria

- [ ] 판정 완료 혹은 이월 조치 항목이 있는 수정 모드에서 "판정 초기화" 버튼 클릭 시, 안내 컨펌 모달이 기동함.
- [ ] 컨펌 확인 시, DB(Supabase) 및 전역 Context API 상태에 해당 조치 내용이 올바르게 초기화(삭제)되고 폼이 정상 초기화됨.
- [ ] 에러 발생 혹은 취소 시 이전 스냅샷 상태로 안전하게 복구(Rollback) 및 가용성 유지.

## 5. Schedule

| Phase | Target Date | Status |
|-------|------------|--------|
| Plan | 2026-05-19 | Completed |
| Design | 2026-05-19 | In Progress |
| Implementation | 2026-05-19 | Pending |
| Review | 2026-05-19 | Pending |

## 6. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| 클라이언트 상태만 초기화 시 DB와 불일치 | High | Low | DB 동기화를 보장하는 `handleDeleteRequest`와 결합하여 온전한 트랜잭션 완결 |
| 비동기 네트워크 에러로 상태 꼬임 | High | Medium | `executeSafe` 비동기 가드와 낙관적 롤백 흐름을 태워 트랜잭션 안전성 보장 |

## 7. References

- `docs/MAIN_PRINCIPLES.md` (Project Constitution)
- `.cursorrules` (AI Agent System Rules)
