# workspace-fragmentation - Plan Document

> Version: 1.0.0 | Date: 2026-05-06 | Status: Draft
> Level: Dynamic

---

## 1. Overview

### 1.1 Purpose
`WorkspaceView.jsx` 컴포넌트를 기능적 책임에 따라 3개의 하위 컴포넌트로 분리하여 가독성과 유지보수성을 향상시킴.

### 1.2 Background
App.jsx에서 추출된 WorkspaceView는 현재 헤더, 탭 관리, 콘텐츠 렌더링이 하나의 파일에 섞여 있어 부피가 크고 Prop Drilling 분석이 어려움.

## 2. Goals

### 2.1 Primary Goals
- [ ] `WorkspaceHeader` 분리: 글로벌 액션 및 상태 표시 로직 격리.
- [ ] `WorkspaceTabs` 분리: 네비게이션 UI 로직 격리.
- [ ] `WorkspaceContent` 분리: 탭별 조건부 렌더링 로직 격리.
- [ ] 디자인 무결성 100% 유지.

### 2.2 Non-Goals
- 새로운 기능 추가.
- UI 디자인 수정.
- 전역 상태 관리 방식 변경 (Unit C에서 별도 진행).

## 3. Scope

### 3.1 In Scope
- `WorkspaceView.jsx` 리팩토링.
- `src/components/workspace/` 하위 신규 컴포넌트 생성.

### 3.2 Out of Scope
- 하위 탭 컴포넌트(`IpIndexTab` 등) 내부 로직 수정.
- Supabase DB 스키마 변경.

## 4. Success Criteria
- [ ] `WorkspaceView.jsx` 파일 크기가 50% 이상 감소.
- [ ] 리팩토링 후에도 기존 워크스페이스 기능(저장, 잠금, 탭 전환)이 완벽하게 동작.

## 5. Schedule

| Phase | Target Date | Status |
|-------|------------|--------|
| Plan | 2026-05-06 | In Progress |
| Design | 2026-05-06 | Pending |
| Implementation | 2026-05-06 | Pending |
| Review | 2026-05-06 | Pending |

## 6. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Props 누락 | High | Medium | MLX 분석 및 bkit_memory 대조 |
| 탭 전환 성능 저하 | Medium | Low | 메모이제이션(React.memo) 고려 |

## 7. References
- [UNIT B 구현 계획서](../../../APP_ImplementationPlan_Unit_B.md)
- [Props 분석 메모리](../../../docs/.bkit-memory.json)
