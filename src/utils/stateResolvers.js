/**
 * [Mitus IP Web] Canonical State Resolver
 * 
 * 과거 차수의 결정 완료된 역사적 스냅샷과 현재 차수의 조치 진행 사항을 아울러
 * 각 이슈별 정규화된 4대 표준 상태('CLOSED', 'DEBT', 'CARRYOVER', 'PENDING')를 판정합니다.
 */

export const resolveCanonicalState = (item, isCurrentStage, isActionInCurrentStage) => {
  if (!item) return 'PENDING';
  
  // 1. carryoverStatus 명시적 프로퍼티 검증 (Modern 구조)
  if (item.carryoverStatus) {
    if (item.carryoverStatus === 'CLOSED') return 'CLOSED';
    if (item.carryoverStatus === 'DEBT') return 'DEBT';
    if (item.carryoverStatus === 'REVISED' || item.carryoverStatus === 'DEFERRED') {
      if (isCurrentStage && !isActionInCurrentStage) return 'PENDING';
      return 'CARRYOVER';
    }
    if (item.carryoverStatus === 'OPEN') {
      if (item.entryMode === 'carryover') return 'DEBT';
      return 'PENDING';
    }
  }

  // 2. legacy 필드 및 entryMode 기반 폴백 검증
  const entry = item.entryMode;
  const disp = item.disposition;
  const assess = item.assessment;

  if (entry === 'eval') {
    if (assess === 'Fixed') return 'CLOSED';
    if (assess === 'Deferred') {
      if (isCurrentStage && !isActionInCurrentStage) return 'PENDING';
      return 'CARRYOVER';
    }
    if (disp === 'Revision') {
      if (isCurrentStage && !isActionInCurrentStage) return 'PENDING';
      return 'CARRYOVER';
    }
    if (['SW Workaround', 'Test Screening', 'System Mitigation', 'SW Workaround 필요', '유지 심사 필요'].includes(disp)) {
      return 'DEBT';
    }
    return 'PENDING';
  }
  
  if (entry === 'reopen') {
    if (disp === 'Acceptable' || disp === 'Waived' || disp === 'Closed') return 'CLOSED';
    if (disp === 'Revision') {
      if (isCurrentStage && !isActionInCurrentStage) return 'PENDING';
      return 'CARRYOVER';
    }
    if (['SW Workaround', 'Test Screening', 'System Mitigation', 'SW Workaround 필요', '유지 심사 필요'].includes(disp)) {
      return 'DEBT';
    }
    return 'PENDING';
  }

  if (entry === 'carryover') {
    if (item.carryoverAction === 'Close') return 'CLOSED';
    return 'PENDING';
  }

  // new / fa / undefined
  if (disp === 'Acceptable' || disp === 'Waived' || disp === 'Closed') return 'CLOSED';
  if (disp === 'Revision') {
    if (isCurrentStage && !isActionInCurrentStage) return 'PENDING';
    return 'CARRYOVER';
  }
  if (['SW Workaround', 'Test Screening', 'System Mitigation', 'SW Workaround 필요', '유지 심사 필요'].includes(disp)) {
    return 'DEBT';
  }

  return 'PENDING';
};
