import React, { useState } from 'react';
import { Edit2, Trash2, FolderOpen, User, Tag, Link } from 'lucide-react';

export const getIssueStatus = (item) => {
  if (!item) return 'OPEN';
  // eval 모드: Deferred → DEFERRED, Fixed만 → CLOSED, Partial/Unresolved → OPEN
  if (item.entryMode === 'eval') {
    if (item.assessment === 'Deferred') return 'DEFERRED';
    if (item.assessment === 'Fixed') return 'CLOSED';
    return 'OPEN';
  }
  // reopen 모드: 무조건 OPEN
  if (item.entryMode === 'reopen') return 'OPEN';
  // carryover 모드: Close 액션 시에만 CLOSED
  if (item.entryMode === 'carryover') {
    return item.carryoverAction === 'Close' ? 'CLOSED' : 'OPEN';
  }
  // new / fa 모드: 무조건 OPEN
  return 'OPEN';
};

export default function IssueSummaryCard({
  item,
  project,
  isReadOnly = false,
  editingId = null,
  onEdit,
  onDelete,
  expandable = false,
  currentStage,
  historyStage,
  needsEval = false,
}) {
  const [expanded, setExpanded] = useState(false);

  if (!item) return null;

  const showActions = !isReadOnly;
  // 카드 전체 클릭 가능 여부: onEdit이 있으면 언제나 클릭 가능
  const isCurrentlyEditing = editingId === item.id;

  const isNewLike = item.entryMode === 'new' || item.entryMode === 'fa';
  const issueId = isNewLike
    ? `${item.ipBlock}.${project}.${item.issueNum}`
    : item.targetIssue;

  // ── Overall Status Logic ──
  const overallStatus = getIssueStatus(item);

  const statusStyle =
    overallStatus === 'OPEN' ? 'border-red-200 bg-red-50/30 text-red-600' :
    overallStatus === 'DEFERRED' ? 'border-blue-200 bg-blue-50/30 text-blue-600' :
    'border-slate-200 bg-slate-50/50 text-slate-500';

  const dotStyle =
    overallStatus === 'OPEN' ? 'bg-red-500' :
    overallStatus === 'DEFERRED' ? 'bg-blue-500' :
    'bg-slate-300';

  // ── Badge Logic (Rule 1 & 2: Optimization & Focus) ──
  const badges = [];

  // 1. 이슈 유형 (Entry Mode)
  if (item.entryMode === 'eval') {
    const isDeferred = item.assessment === 'Deferred';
    const isFixed = item.assessment === 'Fixed';
    const assStyle = isDeferred ? 'bg-blue-50 text-blue-700 border-blue-300 border-dashed' :
                     isFixed ? 'bg-green-100 text-green-800 border-green-200' :
                     item.assessment === 'Partial' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                     'bg-red-100 text-red-800 border-red-200';
    badges.push({ label: isDeferred ? '🔵 Deferred' : (item.assessment || 'Eval'), style: assStyle });
  } else if (item.entryMode === 'carryover') {
    const actionTaken = item.carryoverStatus !== 'OPEN';
    if (actionTaken) {
      if (item.carryoverAction === 'Keep Open' || item.carryoverAction === 'Revision') {
        badges.push({ 
          label: item.carryoverAction === 'Keep Open' ? 'Keep Open' : 'Revision (Carryover)',
          style: 'bg-orange-100 text-orange-700 border-orange-200'
        });
      } else {
        badges.push({ 
          label: `Closed (${item.carryoverAction})`,
          style: 'text-gray-600 bg-gray-100 border-gray-200'
        });
      }
    } else {
      badges.push({ 
        label: 'Carryover',
        style: 'text-purple-700 bg-purple-50 border-purple-300 animate-pulse'
      });
    }
  } else if (item.entryMode === 'reopen') {
    badges.push({ label: '🔥 Re-opened', style: 'bg-red-100 text-red-800 border-red-200' });
  } else if (isNewLike) {
    if (item.faId || item.faReportId) {
      badges.push({ label: 'NEW(FA)', style: 'bg-amber-100 text-amber-700 border-amber-300', isFa: true });
    } else {
      badges.push({ label: '✨ NEW', style: 'bg-blue-100 text-blue-700 border-blue-200' });
    }
  }

  // 2. 심각도 (Severity)
  if (item.severity && item.entryMode !== 'eval') {
    const sevStyle = 
      item.severity === 'Fail' ? 'bg-red-100 text-red-700 border-red-200' :
      item.severity === 'Major' ? 'bg-orange-100 text-orange-700 border-orange-200' :
      item.severity === 'Minor' ? 'bg-gray-100 text-gray-700 border-gray-200' :
      'bg-yellow-100 text-yellow-700 border-yellow-200';
    badges.push({ label: item.severity, style: sevStyle });
  }

  // 3. 조치 사항 (Disposition)
  if (!(item.entryMode === 'eval' && item.assessment === 'Fixed')) {
    if (item.disposition) {
      const dispStyle = item.disposition === 'Revision' ? 'text-orange-700 bg-orange-50 border-orange-200' : 'text-gray-600 bg-gray-100 border-gray-200';
      badges.push({ label: item.disposition, style: dispStyle });
    }
  }

  // phenomenon에서 레거시 FA 헤더 제거 (이전 데이터 정규화)
  const cleanPhenomenon = (() => {
    const raw = item.phenomenon || '';
    if (raw.startsWith('[FA Report')) {
      const match = raw.match(/Phenomenon:\s*(.+?)(?:\n|$)/s);
      return match ? match[1].trim() : raw.split('\n').pop()?.trim() || '';
    }
    return raw;
  })();

  const previewText = cleanPhenomenon || item.comment || item.reopenReason || '';

  const getColorBar = () => {
    if (item.entryMode === 'carryover') {
      if (item.carryoverStatus === 'OPEN') return 'border-l-4 border-l-purple-500';
      if (item.carryoverAction === 'Close') return 'border-l-4 border-l-green-400';
      return 'border-l-4 border-l-orange-500';
    }
    if (item.entryMode === 'reopen') return 'border-l-4 border-l-red-500';
    if (item.entryMode === 'eval') {
      if (item.assessment === 'Fixed') return 'border-l-4 border-l-green-500';
      if (item.assessment === 'Deferred') return 'border-l-4 border-l-blue-400';
      return 'border-l-4 border-l-orange-500';
    }
    if (item.severity === 'Fail') return 'border-l-4 border-l-red-500';
    if (item.disposition === 'Revision' || item.severity === 'Major') return 'border-l-4 border-l-orange-400';
    return 'border-l-4 border-l-green-400';
  };

  const isDeferred = item.entryMode === 'eval' && item.assessment === 'Deferred';
  const borderClass = isCurrentlyEditing
    ? 'ring-2 ring-blue-500 border-transparent'
    : isDeferred
      ? 'border-2 border-dashed border-blue-300'
      : 'border border-gray-200';

  const getBgTint = () => {
    if (needsEval) return 'bg-red-50/40';
    if (overallStatus === 'CLOSED') return 'bg-green-50/30';
    if (overallStatus === 'DEFERRED') return 'bg-blue-50/30';
    return 'bg-orange-50/30';
  };

  // 카드 전체 클릭 핸들러
  const handleCardClick = () => {
    if (onEdit) {
      onEdit(item);
    } else if (expandable) {
      setExpanded(v => !v);
    }
  };

  return (
    <div
      className={`rounded-xl shadow-sm overflow-hidden transition-all duration-200 mb-2 ${getColorBar()} ${borderClass} ${getBgTint()} ${
        onEdit ? 'cursor-pointer hover:shadow-md hover:brightness-[0.98]' : ''
      }`}
      onClick={handleCardClick}
    >
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          {/* Rule 3: 바짝 붙여서 나란히 정렬 (Cluster) */}
          <div className="flex-1 min-w-0">
            {/* Status Pill (Overline) */}
            {overallStatus !== 'OPEN' && (
              <div className={`flex items-center w-fit border px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide mb-1.5 uppercase ${statusStyle}`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dotStyle}`}></span>
                {overallStatus}
              </div>
            )}

            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span className="text-[15px] font-semibold text-gray-900 tracking-tight leading-tight mr-1">
                {issueId}
              </span>
              {badges.map((b, i) => (
                <span key={i} className={`flex items-center gap-0.5 text-[10px] font-medium px-2 py-0.5 rounded-full border shadow-sm ${b.style}`}>
                  {b.isFa && <Link size={9} />}
                  {b.label}
                </span>
              ))}
            </div>

            {/* FA 메타 정보 전용 UI */}
            {(item.faReportId || item.faId) && (
              <div className="flex items-center gap-1.5 mb-1.5 text-[11px] text-blue-600 font-medium">
                <Link size={10} className="shrink-0" />
                <span>FA: {item.faReportId || item.faId}{item.faCustomer ? ` · ${item.faCustomer}` : ''}</span>
              </div>
            )}

            {(item.assignee || item.types?.length > 0) && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mb-1.5">
                {item.assignee && (
                  <div className="flex items-center gap-1 text-[11px] text-gray-400 font-normal min-w-0">
                    <User size={10} className="shrink-0 text-gray-300" />
                    <span className="truncate">{item.assignee}</span>
                  </div>
                )}
                {item.types?.length > 0 && (
                  <div className="flex items-center gap-1 text-[11px] text-gray-400 font-normal col-span-2 min-w-0">
                    <Tag size={10} className="shrink-0 text-gray-300" />
                    <span className="truncate">{(item.types || []).join(', ')}</span>
                  </div>
                )}
              </div>
            )}

            {/* Rule 4: 미리보기 (순수 텍스트만) */}
            {(!expandable || !expanded) && previewText && (
              <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed break-words">
                {previewText}
              </p>
            )}

            {!expandable && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                {cleanPhenomenon && <div className="col-span-full"><span className="font-semibold text-slate-600 mr-1">Phenomenon:</span> <span className="whitespace-pre-wrap">{cleanPhenomenon}</span></div>}
                {item.rootCause && <div className="col-span-full"><span className="font-semibold text-slate-600 mr-1">Root Cause:</span> <span className="whitespace-pre-wrap">{item.rootCause}</span></div>}
                {item.modPlan && <div className="col-span-full"><span className="font-semibold text-slate-600 mr-1">Mod. Plan:</span> <span className="whitespace-pre-wrap">{item.modPlan}</span></div>}
                {item.justification && <div className="col-span-full"><span className="font-semibold text-slate-600 mr-1">Justification:</span> <span className="whitespace-pre-wrap">{item.justification}</span></div>}
                {item.entryMode === 'eval' && item.comment && <div className="col-span-full"><span className="font-semibold text-slate-600 mr-1">Eval Comment:</span> <span className="whitespace-pre-wrap">{item.comment}</span></div>}
              </div>
            )}
          </div>

          <div className="flex items-center gap-0.5 shrink-0 ml-1 mt-0.5">
            {/* 평가 필요 뱃지 */}
            {needsEval && (
              <span
                onClick={(e) => { e.stopPropagation(); onEdit?.(item); }}
                className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full shadow-sm animate-pulse cursor-pointer select-none mr-1"
                title="평가 필요: 클릭하여 평가 입력"
              >
                🚨 평가 필요
              </span>
            )}
            {/* 편집 모드: 수정 / 삭제 버튼 (이벤트 버블링 방지 필수) */}
            {showActions && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit?.(item); }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="수정"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete?.(item); }}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="삭제"
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
            {expandable && (
              <FolderOpen size={14} className={`text-gray-400 transition-transform ml-1 ${expanded ? 'rotate-180' : ''}`} />
            )}
          </div>
        </div>
      </div>

      {expandable && expanded && (
        <div className="px-4 pb-4 pt-2 bg-slate-50 border-t border-gray-100">
          <div className="space-y-2 text-xs text-gray-600">
             {item.phenomenon && <div><span className="font-semibold text-gray-700">Phenomenon: </span><span className="whitespace-pre-wrap">{item.phenomenon}</span></div>}
             {item.rootCause && <div><span className="font-semibold text-gray-700">Root Cause: </span><span className="whitespace-pre-wrap">{item.rootCause}</span></div>}
             {item.modPlan && <div><span className="font-semibold text-gray-700">Mod Plan: </span><span className="whitespace-pre-wrap">{item.modPlan}</span></div>}
             {item.justification && <div><span className="font-semibold text-gray-700">Justification: </span><span className="whitespace-pre-wrap">{item.justification}</span></div>}
             {item.entryMode === 'eval' && item.comment && <div><span className="font-semibold text-gray-700">Comment: </span><span className="whitespace-pre-wrap">{item.comment}</span></div>}
             {item.entryMode === 'reopen' && item.reopenReason && <div><span className="font-semibold text-red-600">Re-open Reason: </span><span className="whitespace-pre-wrap">{item.reopenReason}</span></div>}
             {item.entryMode === 'carryover' && item.carryoverAction && <div><span className="font-semibold text-purple-700">Carryover Action: </span><span className="font-bold">{item.carryoverAction}</span></div>}
          </div>
        </div>
      )}
    </div>
  );
}
