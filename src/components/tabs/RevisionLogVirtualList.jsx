import React, { useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight, AlertCircle, Sparkles, Activity, CheckCircle, Clock, ArrowRightCircle, ShieldCheck } from 'lucide-react';
import IssueSummaryCard from '../IssueSummaryCard';
import { getIssueStatus } from '../../logic/revisionLogLogic';

// ── 섹션 헤더 컴포넌트 ──
const SectionHeader = ({ section, title, icon, count, colorClass, textColorClass, iconColorClass, badgeClass, isExpanded, onToggle }) => (
  <div
    onClick={() => onToggle(section)}
    className="flex flex-col items-center justify-center cursor-pointer group mb-1 select-none"
  >
    <div className={`flex items-center gap-2 px-3.5 py-1 rounded-full border shadow-sm transition-all duration-200 hover:shadow-md ${colorClass}`}>
      <h3 className={`text-xs font-bold tracking-[0.1em] flex items-center gap-1.5 ${textColorClass}`}>
        <span className={`transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'} ${iconColorClass}`}>
          <ChevronDown size={14} />
        </span>
        {icon}
        <span>{title}</span>
      </h3>
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badgeClass}`}>
        {count}건
      </span>
    </div>
    {/* 중앙 장식 구분선 (앵커 효과) */}
    <div className="w-12 h-[2px] bg-slate-200 mt-2.5 rounded-full group-hover:bg-slate-300 transition-colors" />
  </div>
);

const RevisionLogVirtualList = ({
  issues,
  safeData,
  onShowHistoryReport,
  project,
  ipDropdown,
  statusFilter,
  needsEvalSet,
  carryoverCandidateSet,
  sortedIssues,
  historyBlocks,
  isReadOnly,
  editingId,
  activeTargetIssue = null,
  stage,
  handlers,
  latestIssueStates
}) => {
  const [expandedItems, setExpandedItems] = useState({});
  const [expandedSections, setExpandedSections] = useState({
    actionRequired: true,
    carryoverReview: true,
    newFindings: true,
    stillOpen: true,
    resolved: false,
    deferred: true,
  });

  const toggleSection = useCallback((key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleExpand = useCallback((id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // 히스토리에서 원본 이슈 메타 조회 (공통 헬퍼)
  const findOriginItem = useCallback((id) => {
    for (const blk of (historyBlocks || [])) {
      const found = blk.issues?.find(i => {
        const iId = i.entryMode === 'new' ? `${i.ipBlock}.${project}.${i.issueNum}` : i.targetIssue;
        return iId === id;
      });
      if (found) return found;
    }
    return null;
  }, [historyBlocks, project]);

  // 특정 이슈의 차수별 이력 타임라인 생성 (Derived State)
  const getIssueTimeline = useCallback((issueId) => {
    if (!issueId) return [];
    
    const timeline = [];
    const STAGES = ['EVT0', 'EVT1', 'EVT2', 'EVT3', 'EVT4', 'EVT5', 'DVT', 'PVT', 'MP'];
    
    // 1. 과거 차수(historyBlocks) 탐색
    if (historyBlocks && historyBlocks.length > 0) {
      historyBlocks.forEach(block => {
        const stageName = block.stageName;
        const found = block.issues?.find(i => {
          const id = i.entryMode === 'new' ? `${i.ipBlock}.${project}.${i.issueNum}` : i.targetIssue;
          return id === issueId;
        });
        
        if (found) {
          timeline.push({
            stage: stageName,
            data: { ...found, stage: stageName }
          });
        }
      });
    }
    
    // 2. 현재 차수(sortedIssues) 탐색
    const foundCurrent = sortedIssues?.find(i => {
      const id = i.entryMode === 'new' ? `${i.ipBlock}.${project}.${i.issueNum}` : i.targetIssue;
      return id === issueId;
    });
    
    if (foundCurrent) {
      timeline.push({
        stage: stage,
        data: { ...foundCurrent, stage: stage }
      });
    }
    
    // 3. 차수 순서대로 정렬
    timeline.sort((a, b) => {
      const idxA = STAGES.indexOf(a.stage);
      const idxB = STAGES.indexOf(b.stage);
      return idxA - idxB;
    });
    
    return timeline;
  }, [historyBlocks, sortedIssues, project, stage]);

  // 데이터 분류
  const {
    pendingEvalItems,
    pendingCarryoverItems,
    newFindings,
    stillOpenIssues,
    resolvedIssues,
    deferredIssues,
    actedThisStage,
  } = useMemo(() => {
    const actedThisStage = {};
    (issues || []).forEach(i => {
      const id = (i.entryMode === 'new' || i.entryMode === 'fa')
        ? `${i.ipBlock}.${project}.${i.issueNum}`
        : i.targetIssue;
      if (!id) return;

      // [보안/렌더 가드]: 이월 검토(carryover) 건인데 아직 아무 심사 결정(carryoverAction)을 내리지 않은 미결 상태라면,
      // 현재 차수에서 "조치/심사가 완료된 액션(acted)"으로 취급해서는 안 됩니다!
      if (i.entryMode === 'carryover') {
        const actionEmpty = !i.carryoverAction || i.carryoverAction.trim() === '';
        if (i.carryoverStatus === 'OPEN' && actionEmpty) {
          return; // 맵에 등록하지 않고 건너뜀 (미결 상태 유지)
        }
      }

      actedThisStage[id] = i; // 조치가 완료된 액션 객체만 매핑
    });

    const pendingEvalItems = (safeData.loadedIssues || [])
      .filter(id => {
        if (!needsEvalSet[id]) return false;
        return true;
      })
      .filter(id => {
        const ip = id.split('.')[0];
        return ipDropdown === 'All' ? true : ip === ipDropdown;
      });

    const pendingCarryoverItems = Object.keys(carryoverCandidateSet || {})
      .filter(id => {
        const ip = id.split('.')[0];
        return ipDropdown === 'All' ? true : ip === ipDropdown;
      });

    const curFiltered = (sortedIssues || [])
      .filter(i => {
        if (ipDropdown === 'All') return true;
        if (i.entryMode === 'new' || i.entryMode === 'fa') return (i.ipBlock || '') === ipDropdown;
        const ipFromTarget = i.targetIssue ? i.targetIssue.split('.')[0] : '';
        return ipFromTarget === ipDropdown;
      });

    // ── [정합성 설계] 이슈 종결(CLOSED) 추출 ──
    const allResolved = Object.values(latestIssueStates || {})
      .filter(item => {
        // IP 필터링
        const ip = item.entryMode === 'new' || item.entryMode === 'fa'
          ? item.ipBlock
          : (item.targetIssue ? item.targetIssue.split('.')[0] : '');
        if (ipDropdown !== 'All' && ip !== ipDropdown) return false;

        const isNewLike = item.entryMode === 'new' || item.entryMode === 'fa';
        const id = isNewLike ? `${item.ipBlock}.${project}.${item.issueNum}` : item.targetIssue;

        // 상태 필터링 (최종 상태가 CLOSED인 것)
        const st = getIssueStatus(item);

        // [중복 제거] 유지 심사 대상 및 이월 검토 대상은 위쪽 독립 섹션에만 노출되므로 하단 조치 완료에서 배제!
        // 단, 이번 차수에서 종결(CLOSED)로 완결된 카드는 종결 리스트에도 복수 노출되도록 허용합니다.
        const isCarryoverTarget = !!carryoverCandidateSet?.[id];
        if (isCarryoverTarget && st !== 'CLOSED') return false;

        const isLoadedIssue = (safeData.loadedIssues || []).includes(id);
        if (isLoadedIssue && st !== 'CLOSED') return false;

        if (statusFilter === 'ALL' || statusFilter === 'CLOSED') return st === 'CLOSED';
        return false;
      });

    // ── [정합성 설계] 평가 유보(DEFERRED) 이슈 추출 ──
    const allDeferred = Object.values(latestIssueStates || {})
      .filter(item => {
        // IP 필터링
        const ip = item.entryMode === 'new' || item.entryMode === 'fa'
          ? item.ipBlock
          : (item.targetIssue ? item.targetIssue.split('.')[0] : '');
        if (ipDropdown !== 'All' && ip !== ipDropdown) return false;

        const isNewLike = item.entryMode === 'new' || item.entryMode === 'fa';
        const id = isNewLike ? `${item.ipBlock}.${project}.${item.issueNum}` : item.targetIssue;

        // [중복 제거] 유지 심사 대상 및 이월 검토 대상은 배제!
        const isCarryoverTarget = !!carryoverCandidateSet?.[id];
        if (isCarryoverTarget) return false;

        const isLoadedIssue = (safeData.loadedIssues || []).includes(id);
        if (isLoadedIssue) return false;
        
        // 차수(Stage) 필터링: 현재 차수에서 직접 유보된 건만 노출
        const isCurrentStage = !item.stage || item.stage === stage;
        if (!isCurrentStage) return false;

        // 상태 필터링 (최종 상태가 DEFERRED인 것)
        const st = getIssueStatus(item);
        if (statusFilter === 'ALL' || statusFilter === 'DEF') return st === 'DEFERRED';
        return false;
      });

    const sortFn = (a, b) => {
      const isNewLike = (m) => m === 'new' || m === 'fa';
      const idA = isNewLike(a?.entryMode) ? `${a?.ipBlock}.${project}.${a?.issueNum}` : a?.targetIssue;
      const idB = isNewLike(b?.entryMode) ? `${b?.ipBlock}.${project}.${b?.issueNum}` : b?.targetIssue;
      return (idA || '').localeCompare(idB || '');
    };

    allResolved.sort(sortFn);
    allDeferred.sort(sortFn);

    // ── [정합성 설계] 관리 중인 기술 부채는 현재 차점 기준 OPEN 상태인 모든 누적 이슈에서 추출 ──
    const allStillOpen = Object.values(latestIssueStates || {})
      .filter(item => {
        // IP 필터링
        const ip = item.entryMode === 'new' || item.entryMode === 'fa'
          ? item.ipBlock
          : (item.targetIssue ? item.targetIssue.split('.')[0] : '');
        if (ipDropdown !== 'All' && ip !== ipDropdown) return false;

        const isNewLike = item.entryMode === 'new' || item.entryMode === 'fa';
        const id = isNewLike ? `${item.ipBlock}.${project}.${item.issueNum}` : item.targetIssue;
        
        // [중복 제거] 이전 차수 이월 수정 평가 대상(eval)은 '이월 검토 항목' 섹션에만 노출
        const isLoadedIssue = (safeData.loadedIssues || []).includes(id);
        if (isLoadedIssue) return false;

        // [중복 제거 2] 이번 차수 신규 오픈 건도 '조치 필요'에 뜨므로 제외
        const isNewFinding = isNewLike && item.stage === stage;
        if (isNewFinding) return false;

        // 상태 필터링 및 유지 심사 대상 영구 존속 가드
        const st = getIssueStatus(item);
        const isCarryoverTarget = !!carryoverCandidateSet?.[id];
        
        if (isCarryoverTarget) {
          return true; // 유지 심사 대상은 판정(Close 등) 여부와 상관없이 무조건 관리형 부채에 존속!
        }

        if (st !== 'OPEN') return false;
        if (statusFilter !== 'ALL' && statusFilter !== 'OPEN') return false;

        return true;
      });

    // ID 순으로 정렬
    allStillOpen.sort((a, b) => {
      const isNewLike = (m) => m === 'new' || m === 'fa';
      const idA = isNewLike(a?.entryMode) ? `${a?.ipBlock}.${project}.${a?.issueNum}` : a?.targetIssue;
      const idB = isNewLike(b?.entryMode) ? `${b?.ipBlock}.${project}.${b?.issueNum}` : b?.targetIssue;
      return (idA || '').localeCompare(idB || '');
    });

    return {
      pendingEvalItems,
      pendingCarryoverItems,
      newFindings: curFiltered.filter(item => (item.entryMode === 'new' || item.entryMode === 'fa') && item.stage === stage),
      stillOpenIssues: allStillOpen,
      resolvedIssues: allResolved,
      deferredIssues: allDeferred,
      actedThisStage,
    };
  }, [issues, safeData, project, ipDropdown, statusFilter, needsEvalSet, carryoverCandidateSet, sortedIssues, latestIssueStates, stage]);

  const hasAny = pendingEvalItems.length + pendingCarryoverItems.length + newFindings.length + stillOpenIssues.length + resolvedIssues.length + deferredIssues.length > 0;

  if (!hasAny) {
    return (
      <div className="text-center text-gray-400 py-8 bg-white rounded-lg border border-dashed border-gray-300">
        <p>해당 상태의 이슈가 없습니다.</p>
      </div>
    );
  }

  const resolvedHandlers = {
    ...handlers,
    toggleSection,
    toggleExpand,
  };

  return (
    <div className="space-y-4">
      {/* 1. 이월 검토 항목 (Evaluation Pending) - 오직 pendingEvalItems 만! */}
      {pendingEvalItems.length > 0 && (
        <div className="bg-amber-50/10 border border-amber-100 rounded-xl p-4">
          <SectionHeader
            section="actionRequired"
            title="이월 검토 항목"
            icon={<ArrowRightCircle size={15} />}
            count={pendingEvalItems.length}
            colorClass="border-amber-100 bg-amber-50/20 hover:bg-amber-50/50"
            textColorClass="text-amber-700"
            iconColorClass="text-amber-400 group-hover:text-amber-700"
            badgeClass="text-amber-700 bg-amber-50/80"
            isExpanded={expandedSections.actionRequired}
            onToggle={toggleSection}
          />
          {expandedSections.actionRequired && (
            <div className="space-y-2 mt-2">
              {pendingEvalItems.map(id => {
                const actedAction = actedThisStage[id];
                const item = actedAction || latestIssueStates[id] || findOriginItem(id);
                if (!item) return null;
                return (
                  <IssueSummaryCard
                    key={`eval-${id}`}
                    item={item}
                    project={project}
                    isReadOnly={isReadOnly}
                    editingId={editingId}
                    activeTargetIssue={activeTargetIssue}
                    onEdit={actedAction ? () => handlers.handleEdit(item) : () => handlers.handleHistoryCardClick(item)}
                    onDelete={isReadOnly ? undefined : (actedAction ? () => handlers.handleDeleteRequest(actedAction) : undefined)}
                    currentStage={stage}
                    needsEval={!actedAction}
                    isAssessed={!!actedAction}
                    expandable={true}
                    expanded={!!expandedItems[item.id || id]}
                    onToggleExpand={() => toggleExpand(item.id || id)}
                    onShowHistoryReport={onShowHistoryReport}
                    timeline={getIssueTimeline(id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}


      {/* 2. 신규 등록 리스트 */}
      {newFindings.length > 0 && (
        <div className="bg-indigo-50/10 border border-indigo-100 rounded-xl p-4">
          <SectionHeader
            section="newFindings"
            title="신규 등록 리스트"
            icon={<Sparkles size={15} />}
            count={newFindings.length}
            colorClass="border-indigo-100 bg-indigo-50/20 hover:bg-indigo-50/50"
            textColorClass="text-indigo-700"
            iconColorClass="text-indigo-400 group-hover:text-indigo-700"
            badgeClass="text-indigo-700 bg-indigo-50/80"
            isExpanded={expandedSections.newFindings}
            onToggle={toggleSection}
          />
          {expandedSections.newFindings && (
            <div className="space-y-2 mt-2">
              {newFindings.map(item => {
                const id = item.entryMode === 'new' ? `${item.ipBlock}.${project}.${item.issueNum}` : item.targetIssue;
                return (
                  <IssueSummaryCard
                    key={item.id}
                    item={item}
                    project={project}
                    isReadOnly={isReadOnly}
                    editingId={editingId}
                    activeTargetIssue={activeTargetIssue}
                    onEdit={isReadOnly ? handlers.handleView : handlers.handleEdit}
                    onDelete={isReadOnly ? undefined : handlers.handleDeleteRequest}
                    currentStage={stage}
                    needsEval={false}
                    expandable={true}
                    expanded={!!expandedItems[item.id]}
                    onToggleExpand={() => toggleExpand(item.id)}
                    onShowHistoryReport={onShowHistoryReport}
                    timeline={getIssueTimeline(id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. 관리형 부채 */}
      {stillOpenIssues.length > 0 && (
        <div className="bg-indigo-50/10 border border-indigo-100 rounded-xl p-4">
          <SectionHeader
            section="stillOpen"
            title="관리형 부채"
            icon={<ShieldCheck size={15} />}
            count={stillOpenIssues.length}
            colorClass="border-indigo-100 bg-indigo-50/20 hover:bg-indigo-50/50"
            textColorClass="text-indigo-700"
            iconColorClass="text-indigo-400 group-hover:text-indigo-700"
            badgeClass="text-indigo-700 bg-indigo-50/80"
            isExpanded={expandedSections.stillOpen}
            onToggle={toggleSection}
          />
          {expandedSections.stillOpen && (
            <div className="space-y-2 mt-2">
              {stillOpenIssues.map(item => {
                const itemIssueId = item.entryMode === 'new' ? `${item.ipBlock}.${project}.${item.issueNum}` : item.targetIssue;
                const isPendingTarget = !!(needsEvalSet?.[itemIssueId] || carryoverCandidateSet?.[itemIssueId]);
                const isItemReadOnly = isReadOnly || (!isPendingTarget && !issues.some(x => x.id === item.id));
                return (
                  <IssueSummaryCard
                    key={item.id}
                    item={item}
                    project={project}
                    isReadOnly={isItemReadOnly}
                    editingId={editingId}
                    activeTargetIssue={activeTargetIssue}
                    onEdit={isItemReadOnly ? handlers.handleView : handlers.handleEdit}
                    onDelete={isItemReadOnly ? undefined : handlers.handleDeleteRequest}
                    currentStage={stage}
                    isCarryover={!!carryoverCandidateSet?.[itemIssueId]}
                    needsEval={!!(carryoverCandidateSet?.[itemIssueId] && !actedThisStage?.[itemIssueId])}
                    isAssessed={!!(carryoverCandidateSet?.[itemIssueId] && actedThisStage?.[itemIssueId])}
                    expandable={true}
                    expanded={!!expandedItems[item.id]}
                    onToggleExpand={() => toggleExpand(item.id)}
                    onShowHistoryReport={onShowHistoryReport}
                    timeline={getIssueTimeline(itemIssueId)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. 평가 유보 (Deferred) */}
      {deferredIssues.length > 0 && (
        <div className="bg-blue-50/10 border border-blue-100 rounded-xl p-4">
          <SectionHeader
            section="deferred"
            title="평가 유보 (Deferred)"
            icon={<Clock size={15} />}
            count={deferredIssues.length}
            colorClass="border-blue-100 bg-blue-50/20 hover:bg-blue-50/50"
            textColorClass="text-blue-700"
            iconColorClass="text-blue-400 group-hover:text-blue-700"
            badgeClass="text-blue-700 bg-blue-50/80"
            isExpanded={expandedSections.deferred}
            onToggle={toggleSection}
          />
          {expandedSections.deferred && (
            <div className="space-y-2 mt-2">
              {deferredIssues.map(item => {
                const itemIssueId = item.entryMode === 'new' ? `${item.ipBlock}.${project}.${item.issueNum}` : item.targetIssue;
                const isPendingTarget = !!(needsEvalSet?.[itemIssueId] || carryoverCandidateSet?.[itemIssueId]);
                const isItemReadOnly = isReadOnly || (!isPendingTarget && !issues.some(x => x.id === item.id));
                return (
                  <IssueSummaryCard
                    key={item.id}
                    item={item}
                    project={project}
                    isReadOnly={isItemReadOnly}
                    editingId={editingId}
                    activeTargetIssue={activeTargetIssue}
                    onEdit={isItemReadOnly ? handlers.handleView : handlers.handleEdit}
                    onDelete={isItemReadOnly ? undefined : handlers.handleDeleteRequest}
                    needsEval={false}
                    isAssessed={false}
                    expandable={true}
                    expanded={!!expandedItems[item.id]}
                    onToggleExpand={() => toggleExpand(item.id)}
                    onShowHistoryReport={onShowHistoryReport}
                    timeline={getIssueTimeline(itemIssueId)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. 종결 (Closed) */}
      {resolvedIssues.length > 0 && (
        <div className="bg-green-50/10 border border-green-100 rounded-xl p-4">
          <SectionHeader
            section="resolved"
            title="종결 (Closed)"
            icon={<CheckCircle size={15} />}
            count={resolvedIssues.length}
            colorClass="border-green-100 bg-green-50/20 hover:bg-green-50/50"
            textColorClass="text-green-700"
            iconColorClass="text-green-400 group-hover:text-green-700"
            badgeClass="text-green-700 bg-green-50/80"
            isExpanded={expandedSections.resolved}
            onToggle={toggleSection}
          />
          {expandedSections.resolved && (
            <div className="space-y-2 mt-2">
              {resolvedIssues.map(item => {
                const itemIssueId = item.entryMode === 'new' ? `${item.ipBlock}.${project}.${item.issueNum}` : item.targetIssue;
                const isPendingTarget = !!(needsEvalSet?.[itemIssueId] || carryoverCandidateSet?.[itemIssueId]);
                const isItemReadOnly = isReadOnly || (!isPendingTarget && !issues.some(x => x.id === item.id));
                return (
                  <IssueSummaryCard
                    key={item.id}
                    item={item}
                    project={project}
                    isReadOnly={isItemReadOnly}
                    editingId={editingId}
                    activeTargetIssue={activeTargetIssue}
                    onEdit={isItemReadOnly ? handlers.handleView : handlers.handleEdit}
                    onDelete={isItemReadOnly ? undefined : handlers.handleDeleteRequest}
                    needsEval={false}
                    isAssessed={false}
                    expandable={true}
                    expanded={!!expandedItems[item.id]}
                    onToggleExpand={() => toggleExpand(item.id)}
                    onShowHistoryReport={onShowHistoryReport}
                    timeline={getIssueTimeline(itemIssueId)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RevisionLogVirtualList;
