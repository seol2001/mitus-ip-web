# APP_StepLog_UnitA_Step2 (프로젝트 관리 서비스 통합)

## 📌 1. 작업 개요
- **작업 목표**: `App.jsx` 내부에 존재하던 프로젝트 아카이브, 영구 삭제, 강제 잠금 해제와 관련된 비즈니스 로직과 Supabase API 연동 코드를 별도의 커스텀 훅(`useProjectService.js`)으로 분리.
- **수정된 파일**:
  - `src/App.jsx` (기존 인라인 함수 제거 및 훅 도입)
  - `src/hooks/useProjectService.js` (신규 훅 생성)

## 📌 2. 상세 변경 내역 (Before / After)

### [Before] `App.jsx` (수정 전 코드)
- **위치**: 
  - `handleToggleArchive`: Line 622 ~ 660
  - `handlePermanentDelete`: Line 662 ~ 689
  - `handleForceUnlock`: Line 728 ~ 751
- **로직 요약**: 
  - `App.jsx` 컴포넌트 내부에서 직접 `showConfirm` 모달을 띄우고, `projectService` 객체를 통해 Supabase 통신을 수행한 후 결과에 따라 `setProjectsList`를 호출하여 UI 상태를 업데이트.
  - 전역 상수 `REFERENCE_PROJECT_ID`가 컴포넌트 내부 하단에 정의되어 있었음.

### [After] `useProjectService.js` 생성 및 도입
- **위치**: 
  - `src/hooks/useProjectService.js` 생성
  - `src/App.jsx` 상단으로 `REFERENCE_PROJECT_ID` 이동 및 훅 연동부 추가 (Line 349)
- **로직 요약**:
  - `projectService`의 순수 비동기 통신 코드는 유지하되, 상태 참조(`isDemoMode`, `activeProject`), 상태 변경(`setProjectsList`), 피드백 모달(`showConfirm`) 등의 **React 상태/사이드 이펙트** 로직을 훅 내부로 캡슐화.
  - 각 함수를 `useCallback`으로 감싸고 명확한 의존성 배열(Dependency Array)을 설정하여, 메모리 최적화 및 불필요한 리렌더링 방지.
  - `App.jsx`에서는 훅을 통해 로직만 가져오도록 깔끔하게 분리:
    ```javascript
    const {
      handleToggleArchive,
      handlePermanentDelete,
      handleForceUnlock
    } = useProjectService({ ... });
    ```

## 📌 3. 해결된 기술적 이슈 (MLX 협업)

1. **상태 참조 누락 및 Stale Closure 방지**:
   - `handleToggleArchive` 내에서 현재 활성화된 프로젝트(`activeProject`)를 닫아야 할 때, 최신의 `executeExit` 함수를 참조하기 위해 `executeExitRef.current`를 주입받아 안전하게 콜백을 호출하도록 설계.
2. **로직/상태 완전 분리 (SoC)**:
   - 순수 백엔드 통신은 `projectService.js`가, React 생태계와 맞물리는 모달 및 상태 반영은 `useProjectService.js`가 담당하는 이중 분리 구조 완성.
3. **App.jsx 부피 감소**:
   - 약 90줄에 달하던 프로젝트 상태 전이(아카이브/삭제/잠금해제) 코드가 하나의 훅 호출로 압축됨.

## 📌 4. 다음 액션 (사용자 검증 필요)
브라우저에서 다음 기능들이 **기존과 동일하게, 오류 없이 작동하는지** 확인 부탁드립니다.
1. 임의의 프로젝트(예: TEST_PROJECT) 설정(톱니바퀴)을 눌러 **'프로젝트 아카이브(보관)'**가 잘 되는지.
2. 아카이브 뷰(View Archived Projects)로 들어가서 프로젝트를 **'아카이브에서 복구'**하거나 **'영구 삭제'**했을 때 문제가 없는지. (영구 삭제 시 실제 리스트에서 사라지는지 확인)
3. 만약 잠겨있는 프로젝트가 있다면 **'잠금 강제 해제(Force Unlock)'**가 정상 작동하는지.
