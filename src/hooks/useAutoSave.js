import { useState, useEffect, useRef } from 'react';

/**
 * Intelligent Auto-Save Hook
 *
 * @param {string} projectId - Current project ID
 * @param {string} tabName - Unique tab name (e.g., 'Revision_Log')
 * @param {object} data - Current data to save (편집 중인 최신 상태)
 * @param {boolean} isEditing - Whether the user is in editing mode
 * @param {function} onRestore - Callback to apply recovered data
 * @param {string} dbUpdatedAt - Last updated timestamp from cloud DB (ISO string)
 * @param {function} setIsEditing - State setter to enable editing mode on restore
 */
export const useAutoSave = ({
  projectId,
  tabName,
  data,
  isEditing,
  onRestore,
  dbUpdatedAt,
  setIsEditing
}) => {
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveredData, setRecoveredData] = useState(null);
  const saveTimerRef = useRef(null);
  const hasCheckedInitialRef = useRef(false);

  const storageKey = `autosave_${projectId}_${tabName}`;

  // ─── 1. Recovery Logic: Check on entry ───
  useEffect(() => {
    // [보안] 서버 시간이 로드될 때까지 대기하여 조기 체크 방지
    // dbUpdatedAt이 null인 상태에서 체크하면 hasCheckedInitialRef가 미리 설정되어 이후 체크가 건너뛰어짐
    if (!dbUpdatedAt) return;

    // 해당 프로젝트/탭에 대해 이미 체크를 완료했다면 중단
    if (
      hasCheckedInitialRef.current &&
      hasCheckedInitialRef.current.pid === projectId &&
      hasCheckedInitialRef.current.tid === tabName
    ) return;

    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const cloudTime = new Date(dbUpdatedAt).getTime();
        const localTime = parsed.last_updated_at || 0;

        console.log(`[AutoSave Check] ${tabName}`, { cloudTime, localTime, diff: localTime - cloudTime });

        // 로컬 데이터가 서버 데이터보다 1초 이상 최신인 경우에만 모달 표시
        // (타임스탬프 비교로 충분 — 데이터 내용 비교는 Race Condition 유발 가능)
        if (localTime > cloudTime + 1000) {
          console.log(`[AutoSave] 복구 대상 발견: ${tabName}`);
          setRecoveredData(parsed);
          setShowRecoveryModal(true);
        } else {
          // 서버 데이터가 더 최신이면 낡은 로컬 캐시 삭제
          localStorage.removeItem(storageKey);
        }
      } catch (e) {
        console.error('AutoSave Recovery Error:', e);
        localStorage.removeItem(storageKey);
      }
    }

    // 유효한 서버 시간이 있을 때만 체크 완료 기록
    hasCheckedInitialRef.current = { pid: projectId, tid: tabName };
  }, [projectId, tabName, dbUpdatedAt, storageKey]);

  // ─── 2. Save Logic: Debounce save ───
  useEffect(() => {
    if (isEditing && data) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      saveTimerRef.current = setTimeout(() => {
        const payload = {
          data,
          last_updated_at: Date.now()
        };
        localStorage.setItem(storageKey, JSON.stringify(payload));
        console.log(`💾 Auto-saved [${tabName}] to localStorage`);
      }, 2000);
    }

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [data, isEditing, storageKey, tabName]);

  // ─── 3. Restore Handler: 사용자 승인 후에만 데이터 반영 ───
  const handleRestore = () => {
    if (recoveredData) {
      // 편집 모드 강제 활성화 (Locked 상태여도 복구 시 편집 가능하게)
      if (setIsEditing) setIsEditing(true);
      // 데이터 복구 + forceDirty=true로 Unsaved Changes 배지 표시
      onRestore(recoveredData.data);
    }
    setShowRecoveryModal(false);
    setRecoveredData(null);
  };

  const handleDiscard = () => {
    localStorage.removeItem(storageKey);
    setShowRecoveryModal(false);
    setRecoveredData(null);
  };

  return {
    showRecoveryModal,
    recoveredTime: recoveredData?.last_updated_at,
    handleRestore,
    handleDiscard
  };
};

/**
 * 최종 저장(Lock) 성공 시 로컬 캐시를 삭제하는 유틸리티
 */
export const clearAutoSave = (projectId, tabName) => {
  const storageKey = `autosave_${projectId}_${tabName}`;
  localStorage.removeItem(storageKey);
};
