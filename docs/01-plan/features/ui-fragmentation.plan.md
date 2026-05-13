# ui-fragmentation - Plan Document

> Version: 1.0.0 | Date: 2026-05-06 | Status: In Progress
> Level: Dynamic

---

## 1. Overview

### 1.1 Purpose
`App.jsx`의 거대한 렌더링 블록을 독립된 컴포넌트로 분리하여 UI 구조를 체계화하고 파일 부피를 획기적으로 줄임.

### 1.2 Background
`App.jsx`가 1,700줄이 넘어가는 비대해진 상태로, 유지보수가 어렵고 가독성이 떨어짐. 로직 고립(Unit A)에 이어 UI 구조를 조각화하여 아키텍처 완성도를 높임.

## 2. Goals

### 2.1 Primary Goals
- [x] **Step 1**: 앱 종료 확인 모달 분리 (`AppExitModal`) - 완료
- [ ] **Step 2**: 워크스페이스 뷰 독립 및 Props 매핑 (`WorkspaceView`)
- [ ] **Step 3**: 대시보드 내비게이션 및 사이드바 컴포넌트화

### 2.2 Non-Goals
- UI 디자인 변경 (1%도 수정하지 않음)
- CSS 클래스 또는 레이아웃 구조 변경

## 3. Scope

### 3.1 In Scope
- `App.jsx` 내부의 JSX 블록 추출
- Props 인터페이스 정의 및 데이터 흐름 최적화
- `src/components/modals` 및 `src/components/workspace` 디렉토리 구조 정리

### 3.2 Out of Scope
- 백엔드(Supabase) API 스키마 변경
- 신규 기능 추가

## 4. Success Criteria

- [ ] `App.jsx` 파일 크기가 1,000줄 이하로 감소
- [ ] 컴포넌트 분리 후에도 기존 디자인과 기능이 100% 동일하게 유지됨
- [ ] 모든 분리된 컴포넌트가 명확한 Props 인터페이스를 가짐

## 5. Schedule

| Phase | Target Date | Status |
|-------|------------|--------|
| Plan | 2026-05-06 | Completed |
| Design | 2026-05-06 | In Progress |
| Implementation | TBD | Pending |
| Review | TBD | Pending |

## 6. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Props 누락으로 인한 런타임 에러 | High | Medium | MLX를 이용한 Props 인터페이스 사전 분석 및 Gemini의 의존성 검증 |
| 디자인/스타일 깨짐 | Medium | Low | 테일윈드 클래스 100% 복사 및 브라우저 QA |

## 7. References

- [APP_ImplementationPlan_Unit_B.md](file:///Users/jacobseol/Library/CloudStorage/SynologyDrive-DS716p/Antigravity/Mitus_IP_Web/mitus-ip-web/APP_ImplementationPlan_Unit_B.md)
