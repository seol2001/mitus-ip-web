# revision-log-stabilization-v2 - Plan Document

> Version: 1.1.0 | Date: 2026-05-08 | Status: Draft
> Level: Dynamic

---

## 1. Overview

### 1.1 Purpose
UnitB_Step5의 세 가지 핵심 안정화 작업을 순차적으로 수행하여 Revision Log의 논리적 무결성과 UX 일관성을 확보합니다.

### 1.2 Background
이전 작업 시 UI 디자인의 과도한 변경으로 인해 파일이 복원되었습니다. 이에 따라 UI 수정을 배제하고, 로직 안정화에만 집중하여 세 가지 작업을 하나씩 단계별로 재수행하고자 합니다.

## 2. Goals

### 2.1 Primary Goals
- [ ] **Step 5-1**: FA 탭 진입 시 비일관적인 자동 편집 모드 활성화 로직 제거.
- [ ] **Step 5-2**: FA 연동 해제(Unlink)와 이슈 삭제(Delete) 로직을 통합하여 데이터 정합성 확보.
- [ ] **Step 5-3**: FA 연동 해제 시 발생하는 중복 컨펌 모달 제거를 통한 UX 최적화.

### 2.2 Non-Goals
- **UI/CSS 수정 금지**: 기존 UI 디자인, 레이아웃, 스타일은 절대 수정하지 않습니다.
- **기능 확장 금지**: 안정화 외의 새로운 기능 추가는 수행하지 않습니다.

## 3. Scope

### 3.1 In Scope
- `RevisionLogTab.jsx`: `handleTabSwitch`, `handleUnlinkFa`, `handleDeleteRequest`, `cancelEdit` 함수 로직.

### 3.2 Out of Scope
- `IssueForm.jsx`, `ActionBar.jsx` 등 컴포넌트의 스타일 및 구조 변경.

## 4. Success Criteria
- [ ] 모든 서브 탭 진입 시 초기 상태는 '읽기 전용'을 유지함.
- [ ] 폼에서의 FA 연동 해제가 카드 리스트에서의 삭제와 동일한 데이터 시퀀스를 따름.
- [ ] FA 연동 해제 시 "작성 취소" 모달이 중복으로 뜨지 않음.

## 5. Schedule

| Phase | Target Date | Status |
|-------|------------|--------|
| Plan | 2026-05-08 | Completed |
| Step 5-1 (Do) | 2026-05-08 | Pending |
| Step 5-2 (Do) | 2026-05-08 | Pending |
| Step 5-3 (Do) | 2026-05-08 | Pending |

## 6. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| 로직 수정 중 UI 사이드 이펙트 | Medium | Low | `bkit_pre_write_check`를 통한 엄격한 코드 가이드 준수 |

## 7. References
- [Unit B Step 5 Log (Restore 전)](./APP_StepLog_UnitB_Step5.md)
