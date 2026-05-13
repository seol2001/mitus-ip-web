/**
 * 프로젝트 관련 순수 비즈니스 로직
 */

/**
 * 다음 차수(Revision) 데이터를 생성하는 로직
 */
export const deriveNextRevisionData = (currentData, currentViewedRevision, activeProject, projectsList) => {
  const evtNumMatch = currentViewedRevision.match(/\d+$/);
  const nextEvtNum = evtNumMatch ? parseInt(evtNumMatch[0]) + 1 : 1;
  const nextEvtName = currentViewedRevision.replace(/\d+$/, '') + nextEvtNum;

  const projMeta = projectsList.find(p => p.id === activeProject.id);
  const currentPhases = projMeta ? projMeta.phases : (activeProject.phases || []);

  if (currentPhases.includes(nextEvtName)) {
    throw new Error("다음 차수가 이미 존재합니다.");
  }

  const prevRevLog = currentData.revisionLog || {};
  const prevLogIssues = prevRevLog.issues || [];
  const historyBlocks = prevRevLog.historyBlocks || [];

  const allChronological = [...historyBlocks.flatMap(b => b.issues || []), ...prevLogIssues].filter(Boolean);
  const latestIssueStates = {};
  allChronological.forEach(item => {
    const id = item.entryMode === 'new' ? `${item.ipBlock}.${activeProject.id}.${item.issueNum}` : item.targetIssue;
    if (!id) return;
    latestIssueStates[id] = item;
  });

  const loadedIssuesIDs = [];
  const carryOverIssues = [];

  Object.entries(latestIssueStates).forEach(([issueId, st]) => {
    const disposition = st.entryMode === 'eval' && st.assessment === 'Fixed' ? 'Fixed' : (st.disposition || 'Revision');
    const isFixedOrClosed = disposition === 'Fixed' || disposition === 'Acceptable' || disposition === 'Waived' || disposition === 'Closed';

    if (isFixedOrClosed) return;

    if (disposition === 'Revision') {
      loadedIssuesIDs.push(issueId);
    } else {
      carryOverIssues.push({
        ...st,
        id: Date.now() + Math.random(),
        entryMode: 'carryover',
        carryoverStatus: 'OPEN',
        targetIssue: issueId,
      });
    }
  });

  const newRevisionLog = {
    initialMode: 'eval',
    loadedIssues: loadedIssuesIDs,
    issues: carryOverIssues,
    historyBlocks: [
      ...historyBlocks,
      {
        stageName: currentViewedRevision,
        issues: prevLogIssues
      }
    ]
  };

  const prevFaReports = currentData.faReport?.faReports || [];
  // 이전 차수에서 Revision 판정을 받아 연동 대기 중인(isLinkedToLog === false) FA 리포트를 다음 차수로 자동 이월
  const carryOverFaReports = prevFaReports.filter(f => !f.isLinkedToLog && f.disposition === 'Revision');
  const newFaReport = { faReports: carryOverFaReports };

  const newRevisionData = {
    status: "draft",
    projectOverview: JSON.parse(JSON.stringify(currentData.projectOverview)),
    ipIndex: JSON.parse(JSON.stringify(currentData.ipIndex)),
    revisionLog: newRevisionLog,
    faReport: newFaReport
  };

  const newPhases = projMeta ? [...projMeta.phases, nextEvtName] : [nextEvtName];

  return { nextEvtName, newRevisionData, newPhases };
};
