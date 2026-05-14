import { useMemo } from 'react';
import { getIssueStatus } from '../../logic/revisionLogLogic';

/**
 * Revision Log의 데이터(이슈 리스트, 통계)를 관리하는 훅
 */
export const useLogData = (safeData, ipDropdown, validIps, project) => {
  const issues = safeData?.issues || [];
  const historyBlocks = safeData?.historyBlocks || [];

  // 1. 최신 이슈 상태 맵 (ID 기반)
  const latestIssueStates = useMemo(() => {
    const states = {};
    // 히스토리 블록부터 현재 이슈 순으로 덮어씀
    [...historyBlocks].flatMap(b => b.issues).concat(issues).forEach(item => {
      const id = item?.entryMode === 'new' 
        ? `${item.ipBlock}.${project}.${item.issueNum}` 
        : item?.targetIssue;
      if (id) states[id] = item;
    });
    return states;
  }, [historyBlocks, issues, project]);

  // 2. 통계 계산 (Memoized)
  const stats = useMemo(() => {
    let total = 0, open = 0, closed = 0, deferred = 0;
    
    Object.values(latestIssueStates).forEach(item => {
      const ip = item?.entryMode === 'new' 
        ? item?.ipBlock 
        : (item?.targetIssue ? item.targetIssue.split('.')[0] : '');
      
      const mappedIp = validIps.has(ip) ? ip : 'Deleted IP (Orphan)';
      
      if (ipDropdown === 'All' || mappedIp === ipDropdown) {
        total++;
        const status = getIssueStatus(item);
        if (status === 'DEFERRED') deferred++;
        else if (status === 'OPEN') open++;
        else if (status === 'CLOSED') closed++;
      }
    });
    
    return { total, open, closed, deferred };
  }, [latestIssueStates, ipDropdown, validIps]);

  // 3. 정렬된 이슈 리스트 (Memoized)
  const sortedIssues = useMemo(() => {
    return [...issues].sort((a, b) => {
      const isNewLike = (m) => m === 'new' || m === 'fa';
      const idA = isNewLike(a?.entryMode) ? `${a?.ipBlock}.${project}.${a?.issueNum}` : a?.targetIssue;
      const idB = isNewLike(b?.entryMode) ? `${b?.ipBlock}.${project}.${b?.issueNum}` : b?.targetIssue;
      
      const ipA = isNewLike(a?.entryMode) ? a?.ipBlock : (a?.targetIssue ? a.targetIssue.split('.')[0] : '');
      const ipB = isNewLike(b?.entryMode) ? b?.ipBlock : (b?.targetIssue ? b.targetIssue.split('.')[0] : '');

      const mappedIpA = validIps.has(ipA) ? ipA : 'Deleted IP (Orphan)';
      const mappedIpB = validIps.has(ipB) ? ipB : 'Deleted IP (Orphan)';

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
