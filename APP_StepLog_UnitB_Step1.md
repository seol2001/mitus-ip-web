# APP_StepLog_UnitB_Step1 (AppExitModal 분리)

## 📌 1. 작업 개요
- **작업 목표**: `App.jsx` 하단에 인라인으로 정의되어 있던 '앱 종료 확인 모달' JSX 블록을 독립된 컴포넌트(`AppExitModal.jsx`)로 분리하여 코드 가독성 향상 및 관심사 분리.
- **수정된 파일**:
  - `src/components/modals/AppExitModal.jsx` (신규 생성)
  - `src/App.jsx` (인라인 JSX 제거 및 컴포넌트 주입)

## 📌 2. 상세 변경 내역 (Before / After)

### [Before] `App.jsx` (인라인 JSX)
- **위치**: Line 1641 ~ 1669
- **특징**: `showAppExitWarning` 상태에 따라 조건부 렌더링되며, 테일윈드 클래스가 직접 선언되어 있어 파일 하단부 부피를 차지함.

### [After] `AppExitModal.jsx` 독립 컴포넌트
- **위치**: `src/components/modals/AppExitModal.jsx`
- **로직 요약**:
  - MLX 분석 결과에 따라 `isOpen`, `onClose`, `onConfirm` Props 인터페이스 정의.
  - 기존 디자인(배경 블러, 애니메이션, 컬러)을 100% 보존.
  - 스크린 리더 접근성을 위해 `role="dialog"`, `aria-modal="true"` 속성 추가.
- **App.jsx 연동**:
  ```javascript
  <AppExitModal 
    isOpen={showAppExitWarning}
    onClose={() => setShowAppExitWarning(false)}
    onConfirm={() => {
      isExitingAppRef.current = true;
      setShowAppExitWarning(false);
      window.history.go(-2);
    }}
  />
  ```

## 📌 3. MLX 안티패턴 분석 결과 반영
- **사이드 이펙트 격리**: `window.history.go(-2)`와 `isExitingAppRef` 조작 로직을 컴포넌트 내부가 아닌 부모(`App.jsx`)에서 `onConfirm` 콜백으로 전달받아 처리하도록 설계하여 컴포넌트의 순수성 유지.
- **접근성 개선**: 기존 코드에 없던 기본 ARIA 속성을 추가하여 품질 향상.

## 📌 4. 다음 액션 (사용자 검증 필요)
로컬 MLX가 제안한 Edge Case 시나리오를 바탕으로 다음 사항을 확인해 주세요.
1. **디자인 확인**: 대시보드에서 브라우저 뒤로가기 시 발생하는 모달의 디자인(블러, 애니메이션)이 이전과 동일한지 확인.
2. **동작 확인**: '아니요' 클릭 시 모달이 닫히는지, '네' 클릭 시 정상적으로 이전 페이지(또는 앱 종료)로 이동하는지 확인.
3. **엣지 케이스**: 모달이 뜬 상태에서 배경의 대시보드 요소들이 클릭되지 않는지(격리 여부) 확인.
