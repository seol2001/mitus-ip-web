# ui-fragmentation - Design Document

> Version: 1.0.0 | Date: 2026-05-06 | Status: In Progress
> Level: Dynamic | Plan: docs/01-plan/features/ui-fragmentation.plan.md

---

## 1. Overview

### 1.1 Purpose
`App.jsx`에 집중된 거대 렌더링 로직을 컴포넌트 단위로 분리하여 코드의 모듈화와 재사용성을 높임.

### 1.2 Design Goals
- `App.jsx`의 복잡도 낮추기
- 컴포넌트 간 명확한 Props 인터페이스 정의
- UI 무결성(기존 디자인 및 스타일) 100% 보존

## 2. Architecture

### 2.1 System Architecture
React 기반의 컴포넌트 계층 구조로, `App.jsx`는 상태 관리와 라우팅만 담당하고 실제 UI 렌더링은 하위 컴포넌트로 위임함.

### 2.2 Component Design
- **AppExitModal**: 앱 종료 확인을 위한 모달 (Step 1 완료)
- **WorkspaceView**: 워크스페이스 메인 뷰 및 탭 전환 관리 (Step 2 예정)
- **DashboardNav**: 대시보드 내비게이션 및 사이드바 (Step 3 예정)

### 2.3 Data Flow
- `App.jsx`에서 전역 상태(state)를 관리하고, 이를 Props를 통해 하위 컴포넌트로 전달(Prop Drilling 최소화 및 Context 활용 고려).

## 3. Data Model
(해당 작업은 UI 구조 조각화이므로 신규 데이터 모델은 없음)

## 4. API Specification
(해당 작업은 UI 구조 조각화이므로 신규 API는 없음)

## 5. Implementation Plan

### 5.1 File Structure
```
src/
  components/
    modals/
      AppExitModal.jsx [NEW]
    workspace/
      WorkspaceView.jsx [TODO]
      TabOverview.jsx [TODO]
      TabIpIndex.jsx [TODO]
      ...
```

### 5.2 Implementation Order
1. **Step 1**: `AppExitModal` 분리 (완료)
2. **Step 2**: `WorkspaceView` 분리 및 거대 Props 매핑
3. **Step 3**: 나머지 UI 블록(내비게이션 등) 분리

## 6. Test Plan

### 6.1 Unit Tests
- `AppExitModal`: `isOpen` 상태에 따른 렌더링 및 `onClose`/`onConfirm` 콜백 호출 여부 확인

### 6.2 Integration Tests
- `App.jsx`에서 컴포넌트 교체 후 기존 기능(뒤로가기 가드, 워크스페이스 진입 등) 정상 작동 여부 확인

## 7. Security Considerations
- 컴포넌트 분리 과정에서 인증(`isAuthorized`) 및 권한 체크가 우회되지 않도록 주의함.
