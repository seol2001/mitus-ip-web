# Bug Fix Implementation Plan: Unsaved Badge Recovery

> Version: 1.1.0 | Date: 2026-05-06 | Status: Approved
> Feature: Unit B - Workspace UI Enhancement (Bug Fix)

---

## 1. 문제 분석 (Root Cause Analysis)

### 1.1 현상
- 워크스페이스 내에서 데이터를 수정(타이핑) 중임에도 헤더에 "Unsaved" 배지가 나타나지 않음.
- 탭 저장을 눌러도 배지가 즉시 나타나지 않으며, 다른 UI 이벤트 발생 시에만 간헐적으로 노출됨.

### 1.2 핵심 원인
- **상태 미연동**: `WorkspaceHeader`가 UI 업데이트를 유발하지 않는 `isDirtyRef.current`에만 의존함.
- **반응형 상태 누락**: 실시간 입력 상태인 `isFormDirty` (useState) 값이 하위 컴포넌트까지 전달되지 않음.
- **비정상적 조건문**: `useRef`를 렌더링 조건문(`{isDirtyRef.current && ...}`)에 사용하여 React의 상태 추적 메커니즘을 우회함.

## 2. 핵심 원칙 준수 (Core Principles)

- **No-Pixel-Change**: 기존에 정의된 "Unsaved" 배지의 스타일(Amber color, animate-pulse)을 100% 유지.
- **Data Integrity**: `isFormDirty` 상태를 Props 체인에 추가하여 데이터 흐름의 일관성 확보.
- **SRP**: `App.jsx`는 상태를 공급하고, `WorkspaceHeader`는 상태를 소비하여 렌더링하는 책임을 명확히 분리.

## 3. 수정 설계 (MLX-Qwen 기반 분석 반영)

### 3.1 Props 매핑 업데이트
| Component | New Prop | Source | Description |
|-----------|----------|--------|-------------|
| WorkspaceView | `isFormDirty` | `App.jsx (State)` | 실시간 폼 수정 상태 |
| WorkspaceHeader | `isFormDirty` | `WorkspaceView` | 배지 노출 트리거 |

### 3.2 로직 변경
- **WorkspaceHeader.jsx**: 
  - 기존: `isDirtyRef.current`
  - 변경: `isFormDirty || isDirtyRef.current` (타이핑 중이거나 전역 저장 보류 중일 때 모두 노출)

## 4. 구현 단계 (Execution Steps)

1. **[App.jsx]**: `WorkspaceView` 호출부에 `isFormDirty={isFormDirty}` 추가.
2. **[WorkspaceView.jsx]**: Props로 `isFormDirty`를 받고, `WorkspaceHeader`로 전달.
3. **[WorkspaceHeader.jsx]**: 배지 렌더링 조건을 반응형 상태값(`isFormDirty`)을 포함하도록 수정.

## 5. 검증 계획 (Verification)

### 5.1 브라우저 검증
- [ ] Revision Log 탭에서 텍스트 입력 즉시 헤더에 "Unsaved" 배지 등장 여부.
- [ ] 입력 내용을 지우거나 "Cancel" 클릭 시 배지 즉시 소멸 여부.
- [ ] "Save" 클릭 후 전역 저장 대기 상태에서 배지 유지 여부.
- [ ] 다른 탭(Overview, FA Report 등)에서도 동일하게 동작하는지 확인.
