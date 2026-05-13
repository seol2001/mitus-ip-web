# APP_StepLog_UnitA_Step1 (내비게이션 가드 엔진 구축)

## 📌 1. 작업 개요
- **작업 목표**: `App.jsx`에 존재하는 전역 브라우저 히스토리(`popstate`) 제어 로직을 독립된 Custom Hook(`useNavigationGuard.js`)으로 분리.
- **수정된 파일**:
  - `src/App.jsx` (로직 제거 및 Hook 호출부 추가)
  - `src/hooks/useNavigationGuard.js` (신규 생성)

## 📌 2. 상세 변경 내역 (Before / After)

### [Before] `App.jsx` (수정 전 약 100라인 차지)
- **위치**: `App.jsx` 내부 (Line 331 ~ 432)
- **로직 요약**: 
  - `viewState`, `showConfirm`, `isGloballyEditing` 등 여러 상태를 `useRef`로 캡처하여 이벤트 리스너 내의 Stale Closure 버그를 회피.
  - `popstate` 이벤트 리스너를 `useEffect` 내에서 직접 등록하고 해제.

### [After] `useNavigationGuard.js` 생성 및 호출
- **위치**: `src/hooks/useNavigationGuard.js` 생성 완료.
- **로직 요약**:
  - 기존 `App.jsx`에 있던 `popstate` 리스너 로직과 `useRef` 기반의 최신 상태 캡처 로직을 모두 훅 내부로 캡슐화.
  - `App.jsx`에서는 다음과 같이 간결하게 훅을 호출하도록 변경됨 (Line 332):
    ```javascript
    useNavigationGuard({
      isAuthorized,
      viewState,
      setViewState,
      showConfirm,
      setIsGloballyEditing,
      setIsFormDirty,
      tabRef,
      isExitingAppRef,
      setShowAppExitWarning,
      isDirtyRef,
      isFormDirtySyncRef
    });
    ```

## 📌 3. 해결된 기술적 이슈 (MLX 협업)

1. **React Strict Mode 클린업 검증**: 
   - `useEffect` 내에서 `window.addEventListener`와 `removeEventListener`가 쌍으로 완벽히 구성됨을 확인. 다중 렌더링 시에도 이벤트가 중복 등록되어 발생하는 메모리 누수를 방지.
2. **Stale Closure 방지 고도화**:
   - `viewState`와 `showConfirm` 같은 외부 상태와 함수를 훅 내부의 `useRef`로 다시 캡처하도록 구현하여, 이벤트 리스너 콜백 실행 시 항상 최신 상태를 참조하도록 보장.
3. **App.jsx 의존도(Lines of Code) 대폭 감소**:
   - 약 100줄에 달하던 라우팅 가드 로직을 단 12줄의 Hook 호출로 줄임.

## 📌 4. 다음 액션 (사용자 검증 필요)
- 브라우저를 열고 프로젝트에 진입(WORKSPACE)한 뒤, **브라우저의 뒤로가기 버튼**을 눌렀을 때 정상적으로 **초기화 경고 모달**이 표시되는지 확인 부탁드립니다.
- 대시보드(DASHBOARD)에서 뒤로가기 버튼을 누를 경우 **앱 종료 경고 모달**이 나오는지 확인해 주시면 됩니다.
