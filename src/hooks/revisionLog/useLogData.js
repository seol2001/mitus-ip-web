import { useMemo } from 'react';
import { getIssueStatus } from '../../logic/revisionLogLogic';

/**
 * Revision Log의 데이터(이슈 리스트, 통계)를 관리하는 훅
 */
export const useLogData = (safeData, ipDropdown, validIps, project, stage) => {
  const issues = safeData?.issues || [];
  const historyBlocks = safeData?.historyBlocks || [];

  // 1. 최신 이슈 상태 맵 (ID 기반)
  const latestIssueStates = useMemo(() => {
    const states = {};
    // 히스토리 블록부터 현재 이슈 순으로 덮어씀
    const allHistoricalIssues = [...historyBlocks]
      .flatMap(b => b.issues || []);

    [...allHistoricalIssues, ...issues].forEach(item => {
      if (!item) return;
      const isNewLike = item.entryMode === 'new' || item.entryMode === 'fa';
      const id = isNewLike 
        ? `${item.ipBlock}.${project}.${item.issueNum}` 
        : item?.targetIssue;
      if (id) states[id] = item;
    });
    return states;
  }, [historyBlocks, issues, project]);

  // 2. 통계 계산 (Memoized)
  const stats = useMemo(() => {
    let total = 0, open = 0, closed = 0, deferred = 0;
    
    // 신규 세부 집계 객체
    const debtDetails = {
      Revision: 0,
      Deferred: 0,
      'SW Workaround': 0,
      'Test Screening': 0,
      'System Mitigation': 0,
      'Other/TBD': 0
    };
    
    Object.values(latestIssueStates).forEach(item => {
      const isNewLike = item?.entryMode === 'new' || item?.entryMode === 'fa';
      const ip = isNewLike 
        ? item?.ipBlock 
        : (item?.targetIssue ? item.targetIssue.split('.')[0] : '');
      
      const mappedIp = validIps[ip] ? ip : 'Deleted IP (Orphan)';
      
      if (ipDropdown === 'All' || mappedIp === ipDropdown) {
        total++;
        const status = getIssueStatus(item);
        if (status === 'DEFERRED') {
          // 평가 유보는 해당 차수(Stage)에서 직접 유보 선언된 건만 뱃지 개수 카운트
          if (!item.stage || item.stage === stage) {
            deferred++;
          } else {
            // 이전 차수에서 유보되었으나 현재 차수에서 아직 최종 판정이 대기 중인 건은 OPEN으로 합산
            open++;
            debtDetails['Deferred']++;
          }
        }
        else if (status === 'OPEN') {
          open++;
          const disp = item?.disposition;
          if (disp === 'Revision') {
            debtDetails['Revision']++;
          } else if (disp === 'SW Workaround') {
            debtDetails['SW Workaround']++;
          } else if (disp === 'Test Screening') {
            debtDetails['Test Screening']++;
          } else if (disp === 'System Mitigation') {
            debtDetails['System Mitigation']++;
          } else {
            debtDetails['Other/TBD']++;
          }
        }
        else if (status === 'CLOSED') closed++;
      }
    });
    
    return { total, open, closed, deferred, debtDetails };
  }, [latestIssueStates, ipDropdown, validIps, stage]);

  // 3. 정렬된 이슈 리스트 (Memoized)
  const sortedIssues = useMemo(() => {
    return [...issues].sort((a, b) => {
      const isNewLike = (m) => m === 'new' || m === 'fa';
      const idA = isNewLike(a?.entryMode) ? `${a?.ipBlock}.${project}.${a?.issueNum}` : a?.targetIssue;
      const idB = isNewLike(b?.entryMode) ? `${b?.ipBlock}.${project}.${b?.issueNum}` : b?.targetIssue;
      
      const ipA = isNewLike(a?.entryMode) ? a?.ipBlock : (a?.targetIssue ? a.targetIssue.split('.')[0] : '');
      const ipB = isNewLike(b?.entryMode) ? b?.ipBlock : (b?.targetIssue ? b.targetIssue.split('.')[0] : '');

      const mappedIpA = validIps[ipA] ? ipA : 'Deleted IP (Orphan)';
      const mappedIpB = validIps[ipB] ? ipB : 'Deleted IP (Orphan)';

      if (ipDropdown === 'All') {
        if (mappedIpA !== mappedIpB) return mappedIpA.localeCompare(mappedIpB);
      }

      if (a.entryMode !== b.entryMode) {
        return a.entryMode === 'eval' ? -1 : (a.entryMode === 'new' ? 0 : 1);
      }
      return (idA || '').localeCompare(idB || '');
    });
  }, [issues, project, ipDropdown, validIps]);

  return {
    latestIssueStates,
    stats,
    sortedIssues,
    issues,
    historyBlocks
  };
};
