import { useEffect, useRef } from 'react';

export const useNavigationGuard = ({
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
  isFormDirtySyncRef,
  executeExitRef
}) => {
  // 내부 참조를 통해 최신 상태를 유지 (Stale Closure 방지)
  const viewStateRef = useRef(viewState);
  const showConfirmRef = useRef(showConfirm);

  useEffect(() => {
    viewStateRef.current = viewState;
  }, [viewState]);

  useEffect(() => {
    showConfirmRef.current = showConfirm;
  }, [showConfirm]);

  useEffect(() => {
    if (!isAuthorized) return;

    // 1. 초기 대시보드 히스토리 스택 구축 및 유지
    const initDashboardHistory = () => {
      const currentHash = window.location.hash;
      if (viewStateRef.current === 'DASHBOARD' && (currentHash === '' || currentHash === '#')) {
        // 대시보드 초기 진입 시 트랩 설치: [ROOT] -> [#dashboard]
        window.history.replaceState({ type: 'ROOT' }, '', ' ');
        window.history.pushState({ type: 'DASHBOARD' }, '', '#dashboard');
      }
    };
    initDashboardHistory();

    // 2. 통합 경로 기반 내비게이션 가드 핸들러
    const handlePopState = async (event) => {
      if (isExitingAppRef.current) {
        // 프로그래매틱한 뒤로가기(예: 앱 내 버튼으로 이탈)로 인한 이벤트 무시 후 플래그 초기화
        isExitingAppRef.current = false;
        return;
      }

      const currentHash = window.location.hash;
      const vState = viewStateRef.current;

      // 워크스페이스에서 이탈 시도 시
      if (vState === 'WORKSPACE' && (currentHash === '#dashboard' || currentHash === '' || currentHash === '#')) {
        let canProceed = true;

        // [2중 가드] 탭 내부 상태 OR 전역 플래그 체크
        const isInternalDirty = tabRef.current?.canNavigate?.() === false;
        if (isInternalDirty || isFormDirtySyncRef.current) {
          canProceed = await showConfirmRef.current({
            title: "입력 내용 초기화",
            message: "작성 중인 내용이 모두 사라집니다. 초기화할까요?",
            confirmText: "초기화",
            cancelText: "취소",
            type: "warning"
          });
        }

        if (canProceed) {
          // [추가] 초기화 승인 시 탭 내부 폼 데이터 명시적 리셋
          tabRef.current?.resetForm?.();
          
          // [Bug #3 Fix] 중앙 집중식 종료 로직 호출 (잠금 해제 및 상태 초기화 포함)
          // App.jsx의 executeExit가 Drain Pattern(저장 대기)을 수행함
          if (executeExitRef.current) {
            executeExitRef.current(true); 
          }
        } else {
          // 이탈 거부 시 히스토리 복구
          window.history.pushState({ type: 'WORKSPACE' }, '', '#workspace');
        }
      }
      // 대시보드에서 앱 종료 시도 시 (해시가 없거나 '#'인 경우)
      else if (vState === 'DASHBOARD' && (currentHash === '' || currentHash === '#')) {
        // 히스토리 원복 (트랩 유지)
        window.history.pushState({ type: 'DASHBOARD' }, '', '#dashboard');
        // 종료 확인 모달 표시
        setShowAppExitWarning(true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    isAuthorized,
    viewState,
    showConfirm,
    isExitingAppRef,
    tabRef,
    isDirtyRef,
    isFormDirtySyncRef,
    setIsGloballyEditing,
    setIsFormDirty,
    setViewState,
    setShowAppExitWarning,
    executeExitRef
  ]); // viewState 추가로 상태 변경 시 가드 재설정 보장
};
