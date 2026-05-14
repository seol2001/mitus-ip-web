import { useState, useCallback, useRef, useEffect } from 'react';
import { makeDefaultForm } from '../../logic/revisionLogLogic';

/**
 * Revision Log의 폼 상태 및 무결성(Dirty) 체크를 관리하는 훅
 */
export const useLogForm = (currentSelectedIp, onFormDirtyChange) => {
  const [formData, setFormData] = useState(makeDefaultForm(currentSelectedIp));
  const [editingId, setEditingId] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);
  const [selectedFaForPull, setSelectedFaForPull] = useState(null);

  // Dirty 판별 로직
  const checkIfDirty = (data, eid, initialData = null) => {
    // 1. 신규 등록 모드 (eid 없음)
    if (!eid) {
      return !!(
        (data.phenomenon || '').trim() || 
        (data.rootCause || '').trim() || 
        (data.comment || '').trim() || 
        (data.reopenReason || '').trim() ||
        (data.targetIssue || '') ||
        data.faId ||
        (data.types && data.types.length > 1) ||
        data.subBlock
      );
    }

    // 2. 수정 모드 (eid 존재): 원본(initialData)과 현재(data)의 실질적 차이 비교
    if (!initialData) return false;

    const fieldsToCompare = [
      'phenomenon', 'rootCause', 'comment', 'reopenReason', 
      'severity', 'disposition', 'assignee', 'subBlock', 'targetIssue'
    ];

    // 필드 값 비교 (null/undefined/공백 정규화)
    const hasFieldChange = fieldsToCompare.some(field => {
      const val1 = (data[field] || '').toString().trim();
      const val2 = (initialData[field] || '').toString().trim();
      return val1 !== val2;
    });

    // Types(배열) 비교
    const types1 = [...(data.types || [])].sort().join(',');
    const types2 = [...(initialData.types || [])].sort().join(',');
    const hasTypesChange = types1 !== types2;

    return hasFieldChange || hasTypesChange;
  };

  const handleFormChange = useCallback((newData, initialData = null) => {
    setFormData(newData);
    const newDirty = checkIfDirty(newData, editingId, initialData);
    setIsDirty(newDirty);
    if (onFormDirtyChange) onFormDirtyChange(newDirty);
  }, [editingId, onFormDirtyChange]);

  const resetForm = useCallback((nextNum = null) => {
    setEditingId(null);
    setSelectedFaForPull(null);
    setFormData(makeDefaultForm(currentSelectedIp, nextNum));
    setIsDirty(false);
    if (onFormDirtyChange) onFormDirtyChange(false);
    setFormResetKey(prev => prev + 1);
  }, [currentSelectedIp, onFormDirtyChange]);

  // isDirtyRef를 통한 클로저 문제 해결 (Imperative Handle용)
  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  return {
    formData,
    editingId,
    isDirty,
    isDirtyRef,
    formResetKey,
    selectedFaForPull,
    setFormData,
    setEditingId,
    setIsDirty,
    setSelectedFaForPull,
    handleFormChange,
    resetForm
  };
};
