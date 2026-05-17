import React, { useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight, AlertCircle, Plus, Activity, CheckCircle } from 'lucide-react';
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
  project,
  ipDropdown,
  statusFilter,
  needsEvalSet,
  carryoverCandidateSet,
  sortedIssues,
  historyBlocks,
  isReadOnly,
  editingId,
  stage,
  handlers
}) => {
  const [expandedItems, setExpandedItems] = useState({});
  const [expandedSections, setExpandedSections] = useState({
    actionRequired: true,
    newFindings: true,
    stillOpen: true,
    resolved: false,
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

  // 데이터 분류
  const {
    pendingEvalItems,
    pendingCarryoverItems,
    newFindings,
    stillOpenIssues,
    resolvedDeferredIssues,
  } = useMemo(() => {
    const actedThisStage = {};
    (issues || []).forEach(i => {
      const id = (i.entryMode === 'new' || i.entryMode === 'fa')
        ? `${i.ipBlock}.${project}.${i.issueNum}`
        : i.targetIssue;
      if (id) actedThisStage[id] = true;
    });

    const pendingEvalItems = (safeData.loadedIssues || [])
      .filter(id => needsEvalSet[id] && !actedThisStage[id])
      .filter(id => {
        const ip = id.split('.')[0];
        return ipDropdown === 'All' ? true : ip === ipDropdown;
      })
      .filter(() => statusFilter === 'ALL' || statusFilter === 'OPEN');

    const pendingCarryoverItems = Object.keys(carryoverCandidateSet || {})
      .filter(id => !actedThisStage[id])
      .filter(id => {
        const ip = id.split('.')[0];
        return ipDropdown === 'All' ? true : ip === ipDropdown;
      })
      .filter(() => statusFilter === 'ALL' || statusFilter === 'OPEN');

    const curFiltered = (sortedIssues || [])
      .filter(i => {
        if (ipDropdown === 'All') return true;
        if (i.entryMode === 'new' || i.entryMode === 'fa') return (i.ipBlock || '') === ipDropdown;
        const ipFromTarget = i.targetIssue ? i.targetIssue.split('.')[0] : '';
        return ipFromTarget === ipDropdown;
      })
      .filter(i => {
        if (statusFilter === 'ALL') return true;
        const st = getIssueStatus(i);
        if (statusFilter === 'OPEN' && st === 'OPEN') return true;
        if (statusFilter === 'DEF' && st === 'DEFERRED') return true;
        if (statusFilter === 'CLOSED' && st === 'CLOSED') return true;
        return false;
      });

    return {
      pendingEvalItems,
      pendingCarryoverItems,
      newFindings: curFiltered.filter(item => getIssueStatus(item) === 'OPEN' && (item.entryMode === 'new' || item.entryMode === 'fa')),
      stillOpenIssues: curFiltered.filter(item => getIssueStatus(item) === 'OPEN' && item.entryMode !== 'new' && item.entryMode !== 'fa'),
      resolvedDeferredIssues: curFiltered.filter(item => {
        const st = getIssueStatus(item);
        return st === 'CLOSED' || st === 'DEFERRED';
      }),
    };
  }, [issues, safeData, project, ipDropdown, statusFilter, needsEvalSet, carryoverCandidateSet, sortedIssues]);

  const hasAny = pendingEvalItems.length + pendingCarryoverItems.length + newFindings.length + stillOpenIssues.length + resolvedDeferredIssues.length > 0;

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
    expandedSections,
  };

  return (
    <div className="flex flex-col gap-7">

      {/* Section 1: ACTION REQUIRED */}
      {(pendingEvalItems.length + pendingCarryoverItems.length) > 0 && (
        <div>
          <SectionHeader
            section="actionRequired"
            title="조치 필요 항목"
            icon={<AlertCircle size={15} />}
            count={pendingEvalItems.length + pendingCarryoverItems.length}
            colorClass="border-red-100 bg-red-50/20 hover:bg-red-50/50"
            textColorClass="text-red-600"
            iconColorClass="text-red-400 group-hover:text-red-600"
            badgeClass="text-red-600 bg-red-50/80"
            isExpanded={expandedSections.actionRequired}
            onToggle={toggleSection}
          />
          {expandedSections.actionRequired && (
            <div className="space-y-2 mt-2">
              {pendingEvalItems.map(id => {
                const originItem = findOriginItem(id);
                const virtualItem = originItem
                  ? { ...originItem, id: `pending-eval-${id}`, _isPendingEval: true }
                  : { id: `pending-eval-${id}`, entryMode: 'new', ipBlock: id.split('.')[0], issueNum: id.split('#')[1] ? `ISSUE#${id.split('#')[1]}` : id, _isPendingEval: true };
                return (
                  <IssueSummaryCard
                    key={virtualItem.id}
                    item={virtualItem}
                    project={project}
                    isReadOnly={true}
                    editingId={editingId}
                    onEdit={handlers.handleHistoryCardClick}
                    currentStage={stage}
                    historyStage={historyBlocks?.[historyBlocks.length - 1]?.stageName}
                    needsEval={true}
                    expandable={true}
                    expanded={!!expandedItems[virtualItem.id]}
                    onToggleExpand={() => toggleExpand(virtualItem.id)}
                  />
                );
              })}
              {pendingCarryoverItems.map(id => {
                const originItem = findOriginItem(id);
                const coVirtual = originItem
                  ? { ...originItem, id: `pending-co-${id}`, _isCarryover: true }
                  : { id: `pending-co-${id}`, entryMode: 'new', ipBlock: id.split('.')[0], issueNum: id.split('#')[1] ? `ISSUE#${id.split('#')[1]}` : id, _isCarryover: true };
                return (
                  <IssueSummaryCard
                    key={coVirtual.id}
                    item={coVirtual}
                    project={project}
                    isReadOnly={true}
                    editingId={editingId}
                    onEdit={handlers.handleHistoryCardClick}
                    currentStage={stage}
                    historyStage={historyBlocks?.[historyBlocks.length - 1]?.stageName}
                    needsEval={false}
                    expandable={true}
                    expanded={!!expandedItems[coVirtual.id]}
                    onToggleExpand={() => toggleExpand(coVirtual.id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Section 2: NEW FINDINGS */}
      {newFindings.length > 0 && (
        <div>
          <SectionHeader
            section="newFindings"
            title="신규 등록 리스트"
            icon={<Plus size={15} />}
            count={newFindings.length}
            colorClass="border-blue-100 bg-blue-50/20 hover:bg-blue-50/50"
            textColorClass="text-blue-700"
            iconColorClass="text-blue-400 group-hover:text-blue-700"
            badgeClass="text-blue-700 bg-blue-50/80"
            isExpanded={expandedSections.newFindings}
            onToggle={toggleSection}
          />
          {expandedSections.newFindings && (
            <div className="space-y-2 mt-2">
              {newFindings.map(item => {
                const itemIssueId = item.entryMode === 'new' ? `${item.ipBlock}.${project}.${item.issueNum}` : item.targetIssue;
                return (
                  <IssueSummaryCard
                    key={item.id}
                    item={item}
                    project={project}
                    isReadOnly={isReadOnly}
                    editingId={editingId}
                    onEdit={isReadOnly ? handlers.handleView : handlers.handleEdit}
                    onDelete={isReadOnly ? undefined : handlers.handleDeleteRequest}
                    currentStage={stage}
                    needsEval={!!needsEvalSet[itemIssueId]}
                    expandable={true}
                    expanded={!!expandedItems[item.id]}
                    onToggleExpand={() => toggleExpand(item.id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Section 3: STILL OPEN */}
      {stillOpenIssues.length > 0 && (
        <div>
          <SectionHeader
            section="stillOpen"
            title="관리 중인 기술 부채"
            icon={<Activity size={15} />}
            count={stillOpenIssues.length}
            colorClass="border-orange-200 bg-orange-50/20 hover:bg-orange-50/50"
            textColorClass="text-orange-700"
            iconColorClass="text-orange-400 group-hover:text-orange-700"
            badgeClass="text-orange-700 bg-orange-50/80"
            isExpanded={expandedSections.stillOpen}
            onToggle={toggleSection}
          />
          {expandedSections.stillOpen && (
            <div className="space-y-2 mt-2">
              {stillOpenIssues.map(item => {
                const itemIssueId = item.entryMode === 'new' ? `${item.ipBlock}.${project}.${item.issueNum}` : item.targetIssue;
                return (
                  <IssueSummaryCard
                    key={item.id}
                    item={item}
                    project={project}
                    isReadOnly={isReadOnly}
                    editingId={editingId}
                    onEdit={isReadOnly ? handlers.handleView : handlers.handleEdit}
                    onDelete={isReadOnly ? undefined : handlers.handleDeleteRequest}
                    currentStage={stage}
                    needsEval={!!needsEvalSet[itemIssueId]}
                    expandable={true}
                    expanded={!!expandedItems[item.id]}
                    onToggleExpand={() => toggleExpand(item.id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Section 4: RESOLVED / DEFERRED */}
      {resolvedDeferredIssues.length > 0 && (
        <div>
          <SectionHeader
            section="resolved"
            title="조치 완료 및 유보"
            icon={<CheckCircle size={15} />}
            count={resolvedDeferredIssues.length}
            colorClass="border-gray-200 bg-gray-50/50 hover:bg-gray-100/50 opacity-80 hover:opacity-100"
            textColorClass="text-gray-600"
            iconColorClass="text-gray-400 group-hover:text-gray-600"
            badgeClass="text-gray-600 bg-gray-100/80"
            isExpanded={expandedSections.resolved}
            onToggle={toggleSection}
          />
          {expandedSections.resolved && (
            <div className="space-y-2 mt-2">
              {resolvedDeferredIssues.map(item => {
                const itemIssueId = item.entryMode === 'new' ? `${item.ipBlock}.${project}.${item.issueNum}` : item.targetIssue;
                return (
                  <IssueSummaryCard
                    key={item.id}
                    item={item}
                    project={project}
                    isReadOnly={isReadOnly}
                    editingId={editingId}
                    onEdit={isReadOnly ? handlers.handleView : handlers.handleEdit}
                    onDelete={isReadOnly ? undefined : handlers.handleDeleteRequest}
                    currentStage={stage}
                    needsEval={!!needsEvalSet[itemIssueId]}
                    expandable={true}
                    expanded={!!expandedItems[item.id]}
                    onToggleExpand={() => toggleExpand(item.id)}
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
