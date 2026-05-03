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
// ─── 세션 레벨 체크 기록 (탭 전환 시 중복 모달 방지) ───
const sessionCheckedRegistry = new Set();

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

  const storageKey = `autosave_${projectId}_${tabName}`;
  const registryKey = `${projectId}_${tabName}`;

  // ─── 1. Recovery Logic: Check on entry ───
  useEffect(() => {
    // 서버 시간이 로드될 때까지 대기
    if (!dbUpdatedAt) return;

    // 이번 세션에서 이미 체크(모달 표시 혹은 스킵)했다면 중단
    if (sessionCheckedRegistry.has(registryKey)) return;

    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const cloudTime = new Date(dbUpdatedAt).getTime();
        const localTime = parsed.last_updated_at || 0;

        // [핵심 개선] 데이터가 현재 상태와 완벽히 동일하면 복구할 필요 없음
        const isDataIdentical = JSON.stringify(parsed.data) === JSON.stringify(data);

        if (isDataIdentical) {
          console.log(`[AutoSave] 로컬 데이터가 현재 서버 데이터와 동일하여 캐시를 정리합니다: ${tabName}`);
          localStorage.removeItem(storageKey);
          sessionCheckedRegistry.add(registryKey);
          return;
        }

        // 로컬 데이터가 서버 데이터보다 확실히 최신인 경우에만 모달 표시 (1초 버퍼)
        if (localTime > cloudTime + 1000) {
          console.log(`[AutoSave] 복구 대상 발견: ${tabName}`, { localTime, cloudTime });
          setRecoveredData(parsed);
          setShowRecoveryModal(true);
        } else {
          // 서버 데이터가 같거나 더 최신이면 로컬 캐시 삭제
          localStorage.removeItem(storageKey);
        }
      } catch (e) {
        console.error('AutoSave Recovery Error:', e);
        localStorage.removeItem(storageKey);
      }
    }

    // 체크 완료 기록 (모달이 떴든, 조용히 삭제됐든 이 프로젝트/탭은 이번 세션에서 더 이상 묻지 않음)
    sessionCheckedRegistry.add(registryKey);
  }, [projectId, tabName, dbUpdatedAt, storageKey, data]);

  // ─── 2. Save Logic: Debounce save ───
  useEffect(() => {
    // 편집 중일 때만 자동 저장
    if (isEditing && data) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      saveTimerRef.current = setTimeout(() => {
        // [추가 개선] 저장 전 현재 데이터와 최종 저장 데이터가 같은지 확인하면 IO 낭비 줄일 수 있음
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

  // ─── 3. Restore Handler ───
  const handleRestore = () => {
    if (recoveredData) {
      if (setIsEditing) setIsEditing(true);
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
