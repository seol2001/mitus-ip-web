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
    // 1. 보안 격리: Null/Undefined 유입 방지를 위한 값 정규화
    const assessment = typeof st.assessment === 'string' ? st.assessment.trim() : null;
    const disposition = typeof st.disposition === 'string' ? st.disposition.trim() : 'Revision';
    const carryoverAction = typeof st.carryoverAction === 'string' ? st.carryoverAction.trim() : null;
    const entryMode = typeof st.entryMode === 'string' ? st.entryMode.trim() : null;

    // 2. Strict Priority Ladder & O(1) Single-Path Dispatch

    // [P1] 명시적 닫기/유지 액션 (최우선 순위 - Absolute Override)
    if (carryoverAction === 'Close') {
      // CLOSED: 완전 종결 처리로 다음 차수 이월 제외
      return;
    }
    if (carryoverAction === 'Keep Open') {
      // MANAGED DEBT: 관리형 부채로 잔류시키며 이월 및 판정 리스트 양쪽에서 배제
      return;
    }

    // [P2] Assessment (평가 결과) 기반 상태 천이
    if (assessment === 'Fixed') {
      // CLOSED: 완벽 종결 처리로 다음 차수 이월 제외
      return;
    }

    // assessment가 Partial 또는 Unresolved인 경우
    if (assessment === 'Partial' || assessment === 'Unresolved') {
      if (disposition === 'Revision') {
        loadedIssuesIDs.push(issueId); // PENDING EVALUATION: 평가 대기
        return;
      }
      // disposition이 Revision이 아니면 '유지 심사 대기 (Carryover Review)'로 폴백 (물리적 유효성 재평가)
    }

    // assessment가 Deferred, Acceptable, Waived 인 모든 건은 '유지 심사 대기 (Carryover Review)'
    if (assessment === 'Deferred' || assessment === 'Acceptable' || assessment === 'Waived') {
      carryOverIssues.push({
        ...st,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // ID 충돌 방지 고유 식별자 규칙
        entryMode: 'carryover',
        carryoverStatus: 'OPEN',
        targetIssue: issueId,
        // 새 차수에서 새로운 유효성 심사를 받아야 하므로, 이전 차수의 결정 필드들은 안전하게 리셋!
        carryoverAction: undefined,
        assessment: undefined,
        comment: '',
        deferReason: '',
        deferDate: undefined,
        actionDate: undefined,
      });
      return;
    }

    // [P3] Entry Mode 및 Disposition 교차 기반 판정 필요 조건
    if (entryMode === 'eval' && disposition === 'Revision') {
      loadedIssuesIDs.push(issueId); // PENDING EVALUATION: 평가 대기
      return;
    }

    // [P4] Catch-all 격리 (disposition !== 'Revision' 조건 대체)
    // disposition이 'Revision'이 아닌 다른 모든 조치 판정 건 (예: SW Workaround, Test Screening 등)은
    // 물리적 유효성 재검증 철학에 의해 '유지 심사 대기 (Carryover Review)'로 안전 이월
    if (disposition !== 'Revision') {
      carryOverIssues.push({
        ...st,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // ID 충돌 방지
        entryMode: 'carryover',
        carryoverStatus: 'OPEN',
        targetIssue: issueId,
        carryoverAction: undefined,
        assessment: undefined,
        comment: '',
        deferReason: '',
        deferDate: undefined,
        actionDate: undefined,
      });
      return;
    }

    // [P5] Default 격리 (Fallback): 명시적 Revision 이고 아무 평가가 없는 경우
    // 다음 차수에서 신규 평가 대상으로 유도하기 위해 '평가 대기'로 강제 분류
    loadedIssuesIDs.push(issueId);
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
