import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { projectService } from '../services/projectService';

const LOCK_STALE_THRESHOLD_MIN = 10;
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5분

/**
 * 프로젝트 잠금 및 하트비트 관리 훅
 */
export function useProjectLock({ activeProject, currentUser, projectsList, isDemoMode, showConfirm }) {
  // Refs for stable closure in interval/event listeners
  const activeProjectRef = useRef(activeProject);
  const currentUserRef = useRef(currentUser);
  const projectsListRef = useRef(projectsList);
  const isDemoModeRef = useRef(isDemoMode);
  const showConfirmRef = useRef(showConfirm);

  useEffect(() => { activeProjectRef.current = activeProject; }, [activeProject]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { projectsListRef.current = projectsList; }, [projectsList]);
  useEffect(() => { isDemoModeRef.current = isDemoMode; }, [isDemoMode]);
  useEffect(() => { showConfirmRef.current = showConfirm; }, [showConfirm]);

  /**
   * 잠금 상태 상세 분석 함수 (순수 함수)
   */
  const getLockDetail = useCallback((meta) => {
    if (!meta?.is_locked || !meta?.locked_at) return { isLocked: false, isStale: false, isByMe: false };
    const lockTime = new Date(meta.locked_at).getTime();
    const diffMins = (Date.now() - lockTime) / (1000 * 60);
    const isStale = diffMins >= LOCK_STALE_THRESHOLD_MIN;
    const isByMe = meta.locked_by === currentUserRef.current;
    return { 
      isLocked: true, 
      isStale, 
      isByMe, 
      lockedBy: meta.locked_by, 
      minutesAgo: Math.floor(diffMins) 
    };
  }, []);

  const currentProjMeta = useMemo(() => 
    projectsList.find(p => p.id === activeProject?.id),
    [projectsList, activeProject?.id]
  );

  const lockDetail = useMemo(() => getLockDetail(currentProjMeta), [currentProjMeta, getLockDetail]);

  // 타인이 점유 중이고, 아직 정체(Stale)되지 않은 경우에만 진정한 Lock으로 간주
  const isSessionLockedByOther = lockDetail.isLocked && !lockDetail.isByMe && !lockDetail.isStale;

  // 읽기 전용 사유 분석
  const lockReason = useMemo(() => {
    if (isSessionLockedByOther) return `Locked by ${currentProjMeta?.locked_by}`;
    if (lockDetail.isLocked && !lockDetail.isByMe && lockDetail.isStale) return `Stale Lock (${lockDetail.lockedBy})`;
    // isLatest가 명시적으로 false인 경우에만 Historical View 적용
    if (activeProject && activeProject.isLatest === false) return "Historical View";
    if (currentProjMeta?.is_archived) return "Project Archived";
    return null; // 빈 문자열 대신 null 반환 (!!null === false)
  }, [isSessionLockedByOther, lockDetail, activeProject, currentProjMeta]);

  /**
   * [핵심] 프로젝트 진입 시 자동 잠금 시도 (편집 모드일 때만)
   */
  useEffect(() => {
    if (!activeProject || isDemoMode || !currentUser) return;
    if (activeProject.mode !== 'edit') {
      console.log('📖 [Lock] 읽기 전용 모드로 진입하여 잠금을 시도하지 않습니다.');
      return;
    }

    const acquireLock = async () => {
      // 서버에서 최신 상태 다시 확인 (Double Check)
      const { data } = await projectService.fetchProjectDetail(activeProject.id);
      if (data) {
        const detail = getLockDetail(data);
        
        let lockAttempted = false;
        if (!detail.isLocked || detail.isByMe) {
          console.log('🔓 [Lock] 잠금 획득 시도 중...');
          lockAttempted = true;
        } else if (detail.isStale) {
          console.log('♻️ [Lock] 정체된 잠금 발견, Takeover 시도...');
          lockAttempted = true;
        } else {
          console.warn('🚫 [Lock] 타인이 이미 편집 중입니다. 편집 모드를 해제합니다.');
        }

        if (lockAttempted) {
          // [Bug #4 Fix] 원자적 업데이트 결과를 확인하여 Race Condition 방지
          const { count, error } = await projectService.acquireLock(activeProject.id, currentUser);
          if (error || count === 0) {
            console.error('🚫 [Lock] 원자적 잠금 획득 실패 (Race Condition 패배 또는 RLS 차단).', error);
            showConfirmRef.current({
              title: "잠금 획득 실패",
              message: "다른 사용자가 방금 편집 권한을 가져갔습니다. 읽기 전용 모드로 전환됩니다.",
              type: "danger",
              showCancel: false
            });
          } else {
            console.log('✅ [Lock] 원자적 잠금 획득 성공!');
          }
        }
      }
    };

    acquireLock();
  }, [activeProject?.id, activeProject?.mode, currentUser, isDemoMode, getLockDetail]);

  /**
   * 하트비트 로직
   */
  useEffect(() => {
    // 편집 모드가 아니면 하트비트를 보내지 않음
    if (!activeProject || isDemoMode || activeProject.mode !== 'edit') return;

    const interval = setInterval(async () => {
      // 탭이 활성화된 상태에서만 하트비트 전송
      if (document.visibilityState !== 'visible') return;

      const currentMeta = projectsListRef.current.find(p => p.id === activeProjectRef.current?.id);
      const detail = getLockDetail(currentMeta);
      
      if (detail.isLocked && detail.isByMe) {
        console.log('💓 [Heartbeat] 잠금 시간 갱신 중...');
        const { error, count } = await projectService.updateHeartbeat(activeProjectRef.current.id, currentUserRef.current);
        if (error || count === 0) {
          console.error('❌ Heartbeat Error or Lock Lost:', error);
          // 하트비트 갱신 실패 (DB에서 잠금이 해제되었거나 뺏김)
          showConfirmRef.current({
            title: "연결 불안정",
            message: "서버와의 연결 문제로 잠금 갱신에 실패했습니다. 작업 내용 보호를 위해 로컬에 임시 저장됩니다.",
            type: "warning",
            showCancel: false
          });
        }
      }
    }, 60 * 1000); // [Bug #4 Fix] 5분 -> 1분으로 단축하여 Fallback Polling 강화

    return () => clearInterval(interval);
  }, [activeProject?.id, activeProject?.mode, isDemoMode, getLockDetail]);

  /**
   * [Bug #4 Fix] 실시간 잠금 상실 즉각 대응 (Realtime 반응)
   */
  useEffect(() => {
    if (isSessionLockedByOther && activeProject?.mode === 'edit') {
      console.warn('⚠️ [Realtime] 잠금 권한이 상실되었습니다.');
      showConfirmRef.current({
        title: "편집 권한 상실",
        message: `다른 사용자(${lockDetail.lockedBy})가 편집 권한을 가져갔습니다.\n이후의 수정사항은 저장되지 않을 수 있으며, 현재 페이지는 읽기 전용으로 전환됩니다.`,
        type: "danger",
        showCancel: false
      });
    }
  }, [isSessionLockedByOther, activeProject?.mode, lockDetail.lockedBy]);

  /**
   * 브라우저 종료 시 잠금 해제 (Cleanup)
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      const activeProj = activeProjectRef.current;
      const curUser = currentUserRef.current;
      const demo = isDemoModeRef.current;
      
      if (activeProj && !demo) {
        const currentMeta = projectsListRef.current.find(p => p.id === activeProj.id);
        if (currentMeta?.locked_by === curUser) {
          // [Bug #3 Fix] fetch + keepalive 사용 시 소유자 확인 필터(locked_by=eq.) 명시
          const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/projects?id=eq.${activeProj.id}&locked_by=eq.${curUser}`;
          const headers = {
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          };
          const body = JSON.stringify({ is_locked: false, locked_by: null, locked_at: null });

          fetch(url, { method: 'PATCH', headers, body, keepalive: true }).catch(() => {});
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return {
    lockDetail,
    isSessionLockedByOther,
    lockReason,
    getLockDetail
  };
}
