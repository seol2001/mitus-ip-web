import { getIssueStatus } from '../logic/revisionLogLogic';

/**
 * Calculates cumulative statistics across all stages (past stages and the current stage).
 * This is a pure function extracted for better performance, clean separation of concerns, and ease of unit testing.
 * 
 * @param {Array} historyBlocks Past stage information containing historical issues.
 * @param {Object} latestIssueStates Map of the latest state of each unique issue.
 * @param {string} stage Current active stage name (e.g., 'EVT0', 'EVT1', etc.).
 * @returns {Array} List of statistics for each milestone stage.
 */
export function calculateRevisionStats(historyBlocks, latestIssueStates, stage) {
  // 1. 과거 차수(historyBlocks) 집계
  const pastStats = (historyBlocks || []).map(block => {
    const blockIssues = block.issues || [];
    let total = 0;
    let newCount = 0;
    let closed = 0;
    let debt = 0;
    let carryover = 0;
    let revision = 0;

    const blockDebtDetails = {
      Revision: 0,
      Deferred: 0,
      'SW Workaround': 0,
      'Test Screening': 0,
      'System Mitigation': 0,
      'Other/TBD': 0
    };

    blockIssues.forEach(item => {
      if (!item) return;
      total++;
      if (item.entryMode === 'new' || item.entryMode === 'fa' || (!item.entryMode && !item.carryoverStatus)) {
        newCount++;
      }
      
      // Revision 건수 집계
      if (item.disposition === 'Revision') {
        revision++;
      }

      // Closed/Debt/Carryover 상태 산정 (getIssueStatus 기준)
      const status = getIssueStatus(item);
      if (status === 'CLOSED') {
        closed++;
      } else if (status === 'DEFERRED') {
        carryover++;
      } else {
        // OPEN인 상태는 관리형 부채(Debt)로 산정
        debt++;
        const disp = item.disposition;
        if (disp === 'Revision') {
          blockDebtDetails['Revision']++;
        } else if (disp === 'SW Workaround') {
          blockDebtDetails['SW Workaround']++;
        } else if (disp === 'Test Screening') {
          blockDebtDetails['Test Screening']++;
        } else if (disp === 'System Mitigation') {
          blockDebtDetails['System Mitigation']++;
        } else {
          blockDebtDetails['Other/TBD']++;
        }
      }
    });

    const rate = total > 0 ? ((closed / total) * 100).toFixed(1) : '0.0';

    return {
      milestone: block.stageName,
      total,
      new: newCount,
      closed,
      debt,
      revision,
      carryover,
      resolutionRate: `${rate}%`,
      isCurrent: false,
      debtDetails: blockDebtDetails
    };
  });

  // 2. 현재 차수(latestIssueStates) 집계
  let currTotal = 0;
  let currNew = 0;
  let currClosed = 0;
  let currDebt = 0;
  let currCarryover = 0;
  let currRevision = 0;

  const currDebtDetails = {
    Revision: 0,
    Deferred: 0,
    'SW Workaround': 0,
    'Test Screening': 0,
    'System Mitigation': 0,
    'Other/TBD': 0
  };

  Object.values(latestIssueStates || {}).forEach(item => {
    if (!item) return;
    currTotal++;
    
    const isNewLike = item.entryMode === 'new' || item.entryMode === 'fa';
    // 이번 차수 신규 등록 건
    if (isNewLike && item.stage === stage) {
      currNew++;
    }

    // 이번 차수 결정된 Revision 판정 건
    if (item.stage === stage && item.disposition === 'Revision') {
      currRevision++;
    }

    // 상태 산정 (getIssueStatus 기준)
    const status = getIssueStatus(item);
    if (status === 'CLOSED') {
      currClosed++;
    } else if (status === 'DEFERRED') {
      // 이번 차수에서 명시적으로 유보 결정된 경우
      if (item.stage === stage) {
        currCarryover++;
      } else {
        // 이전 차수 유보 상태로 아직 평가 대기 중인 경우 Open(Debt)로 산입
        currDebt++;
        currDebtDetails['Deferred']++;
      }
    } else {
      currDebt++;
      const disp = item.disposition;
      if (disp === 'Revision') {
        currDebtDetails['Revision']++;
      } else if (disp === 'SW Workaround') {
        currDebtDetails['SW Workaround']++;
      } else if (disp === 'Test Screening') {
        currDebtDetails['Test Screening']++;
      } else if (disp === 'System Mitigation') {
        currDebtDetails['System Mitigation']++;
      } else {
        currDebtDetails['Other/TBD']++;
      }
    }
  });

  const currRate = currTotal > 0 ? ((currClosed / currTotal) * 100).toFixed(1) : '0.0';
  const cappedRate = parseFloat(currRate) > 100 ? '100.0' : currRate;

  const currentStat = {
    milestone: stage,
    total: currTotal,
    new: currNew,
    closed: currClosed,
    debt: currDebt,
    revision: currRevision,
    carryover: currCarryover,
    resolutionRate: `${cappedRate}%`,
    isCurrent: true,
    debtDetails: currDebtDetails
  };

  return [...pastStats, currentStat];
}
