import React, { useState } from 'react';
import { Edit2, Trash2, FolderOpen, User, AlertCircle, Tag, Link } from 'lucide-react';

// ── 좌측 Color Bar: severity / status 기반 ──────────────────────────
const getColorBar = (item) => {
  if (item.entryMode === 'carryover') return item.carryoverStatus === 'OPEN' ? 'border-l-4 border-l-purple-500' : 'border-l-4 border-l-gray-400';
  if (item.entryMode === 'reopen') return 'border-l-4 border-l-red-500';
  if (item.entryMode === 'eval') {
    if (item.assessment === 'Fixed')    return 'border-l-4 border-l-green-500';
    if (item.assessment === 'Deferred') return 'border-l-4 border-l-blue-400';
    return 'border-l-4 border-l-orange-500';
  }
  // entryMode === 'new'
  if (item.severity === 'Fail')                                     return 'border-l-4 border-l-red-500';
  if (item.disposition === 'Revision' || item.severity === 'Major') return 'border-l-4 border-l-orange-400';
  return 'border-l-4 border-l-green-400';
};

// ── 뱃지 동적 생성 로직 ─────────────────────────────────────────
const getLeftBadge = (item, currentStage, historyStage) => {
  // eval 모드는 항상 [Assessment]를 좌측에 표시
  if (item.entryMode === 'eval') {
    const isDeferred = item.assessment === 'Deferred';
    const isFixed = item.assessment === 'Fixed';
    const assStyle = isDeferred ? 'bg-blue-50 text-blue-700 border-blue-300 border-dashed font-bold' :
                     isFixed ? 'bg-green-100 text-green-800 border-green-200 font-bold' :
                     item.assessment === 'Partial' ? 'bg-orange-100 text-orange-800 border-orange-200 font-bold' :
                     'bg-red-100 text-red-800 border-red-200 font-bold';
    return { label: isDeferred ? '🔵 Deferred' : (item.assessment || 'Eval'), style: assStyle };
  }

  // 과거 이력 렌더링
  if (historyStage) {
    if (historyStage === 'EVT1') {
      const severityStyle = 
        item.severity === 'Fail' ? 'bg-red-100 text-red-700 border-red-200 font-bold' :
        item.severity === 'Major' ? 'bg-orange-100 text-orange-700 border-orange-200 font-bold' :
        item.severity === 'Minor' ? 'bg-gray-100 text-gray-700 border-gray-200 font-bold' :
        'bg-yellow-100 text-yellow-700 border-yellow-200 font-bold';
      return { label: item.severity || 'Minor', style: severityStyle };
    }
    if (item.entryMode === 'reopen') return { label: `${historyStage} 재오픈`, style: 'bg-red-50 text-red-700 border-red-200 font-bold' };
    if (item.entryMode === 'carryover') return { label: `${historyStage} 이월`, style: 'bg-purple-50 text-purple-700 border-purple-200 font-bold' };
    return { label: `${historyStage} 발굴`, style: 'bg-blue-50 text-blue-700 border-blue-200 font-bold' };
  }

  // 현재 차수 (EVT1) - New 안 띄우고 Severity 표시
  if (currentStage === 'EVT1' || currentStage === 'EVT0') {
    const severityStyle = 
      item.severity === 'Fail' ? 'bg-red-100 text-red-700 border-red-200 font-bold' :
      item.severity === 'Major' ? 'bg-orange-100 text-orange-700 border-orange-200 font-bold' :
      item.severity === 'Minor' ? 'bg-gray-100 text-gray-700 border-gray-200 font-bold' :
      'bg-yellow-100 text-yellow-700 border-yellow-200 font-bold';
    return { label: item.severity || 'Minor', style: severityStyle };
  }

  // 현재 차수 (EVT2 이상)
  switch (item.entryMode) {
    case 'new': return { label: '✨ New Issue', style: 'bg-blue-100 text-blue-700 border-blue-200 font-bold' };
    case 'carryover': return { label: '📦 Carry-over', style: 'bg-purple-100 text-purple-800 border-purple-200 font-bold' };
    case 'reopen': return { label: '🔥 Re-opened', style: 'bg-red-100 text-red-800 border-red-200 font-bold' };
    default: return { label: 'Issue', style: 'bg-gray-100 text-gray-700 border-gray-200 font-bold' };
  }
};

const getRightBadge = (item) => {
  if (item.entryMode === 'carryover') {
    const isClosed = item.carryoverStatus !== 'OPEN';
    return {
      label: isClosed ? `Closed (${item.carryoverAction})` : 'OPEN',
      style: isClosed ? 'text-gray-600 bg-gray-100 border-gray-200 font-bold' : 'text-purple-700 bg-purple-50 border-purple-300 font-bold animate-pulse'
    };
  }

  if (item.entryMode === 'eval') {
    const disp = item.assessment === 'Fixed' ? (item.disposition || 'Acceptable') : (item.disposition || 'Revision');
    return {
      label: disp,
      style: disp === 'Revision' ? 'text-orange-700 bg-orange-50 border-orange-200 font-bold' : 'text-gray-600 bg-gray-100 border-gray-200 font-bold'
    };
  }

  return {
    label: item.disposition || 'Revision',
    style: item.disposition === 'Revision' ? 'text-orange-700 bg-orange-50 border-orange-200 font-bold' : 'text-gray-600 bg-gray-100 border-gray-200 font-bold'
  };
};

const SEVERITY_COLOR = {
  Fail:     'text-red-600',
  Major:    'text-orange-600',
  Minor:    'text-gray-500',
  Marginal: 'text-yellow-600',
};

/**
 * IssueCard — RevisionLogTab 이슈 카드 공통 컴포넌트
 *
 * Props:
 *  item               — 이슈 데이터 객체
 *  project            — 프로젝트명 (ID 문자열 조합용)
 *  expandable         — true: 클릭으로 상세 펼치기 (Read-only 아코디언)
 *  showActions        — true: Edit / Delete 버튼 표시 (편집 모드 우측 패널)
 *  isCurrentlyEditing — 현재 이 카드를 편집 중인지 (파란 ring 강조)
 *  onEdit             — 편집 콜백 (item 전달)
 *  onDelete           — 삭제 콜백 (item 전달)
 */
const IssueCard = ({
  item,
  project,
  expandable      = false,
  showActions     = false,
  isCurrentlyEditing = false,
  onEdit,
  onDelete,
  currentStage,
  historyStage
}) => {
  const [expanded, setExpanded] = useState(false);

  const issueId = item.entryMode === 'new'
    ? `${item.ipBlock}.${project}.${item.issueNum}`
    : item.targetIssue;

  const isDeferred = item.entryMode === 'eval' && item.assessment === 'Deferred';
  
  const leftBadge = getLeftBadge(item, currentStage, historyStage);
  const rightBadge = getRightBadge(item);

  // 카드 프리뷰용 텍스트 (phenomenon → comment → reopenReason 순 우선)
  const previewText = item.phenomenon || item.comment || item.reopenReason || '';

  // 외곽선 클래스 계산
  const borderClass = isCurrentlyEditing
    ? 'ring-2 ring-blue-500 border-transparent'
    : isDeferred
      ? 'border-2 border-dashed border-blue-300'
      : 'border border-gray-200 hover:border-blue-200';

  return (
    <div className={`bg-white rounded-xl shadow-sm overflow-hidden transition-all ${getColorBar(item)} ${borderClass}`}>

      {/* ── 카드 헤더 영역 ─────────────────────────────────────── */}
      <div
        className={`px-4 py-3 ${expandable ? 'cursor-pointer hover:bg-slate-50' : ''} transition-colors`}
        onClick={expandable ? () => setExpanded(v => !v) : undefined}
      >
        <div className="flex items-start justify-between gap-2">

          {/* 왼쪽: ID + 뱃지 + 메타 */}
          <div className="flex-1 min-w-0">

            {/* Row 1: Issue ID (대형 Bold) + 상태 뱃지 */}
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span className="text-[15px] font-extrabold text-gray-900 tracking-tight leading-tight">
                {issueId}
              </span>
              
              {leftBadge && leftBadge.label !== item.severity && leftBadge.label !== (item.severity || 'Minor') && (
                <span className={`text-[10.5px] px-2 py-0.5 rounded-full border shadow-sm ${leftBadge.style}`}>
                  {leftBadge.label}
                </span>
              )}

              {item.severity && item.entryMode !== 'eval' && (
                <span className={`text-[10.5px] px-2 py-0.5 rounded-full border shadow-sm font-bold ${
                  item.severity === 'Fail' ? 'bg-red-100 text-red-700 border-red-200' :
                  item.severity === 'Major' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                  item.severity === 'Minor' ? 'bg-gray-100 text-gray-700 border-gray-200' :
                  'bg-yellow-100 text-yellow-700 border-yellow-200'
                }`}>
                  {item.severity}
                </span>
              )}

              {!(item.entryMode === 'eval' && item.assessment === 'Fixed') && rightBadge && (
                <span className={`text-[10.5px] px-2 py-0.5 rounded-full border shadow-sm ${rightBadge.style}`}>
                  {rightBadge.label}
                </span>
              )}

              {item.faId && (
                <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border bg-yellow-50 text-yellow-700 border-yellow-300">
                  <Link size={9} /> FA
                </span>
              )}
            </div>

            {/* Row 2: 메타데이터 2열 그리드 */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              {item.assignee && (
                <div className="flex items-center gap-1 text-xs text-gray-500 min-w-0">
                  <User size={10} className="shrink-0 text-gray-400" />
                  <span className="truncate">{item.assignee}</span>
                </div>
              )}
              {item.types?.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-gray-500 col-span-2 min-w-0">
                  <Tag size={10} className="shrink-0 text-gray-400" />
                  <span className="truncate">{item.types.join(', ')}</span>
                </div>
              )}
            </div>

            {/* Row 3: 현상/코멘트 (최대 3줄 말줄임) */}
            {previewText && (
              <p className="text-xs text-gray-600 mt-2 line-clamp-3 leading-relaxed whitespace-pre-wrap break-words">
                {previewText}
              </p>
            )}
          </div>

          {/* 오른쪽: 액션 버튼 / 펼치기 아이콘 */}
          <div className="flex items-center gap-0.5 shrink-0 ml-1 mt-0.5">
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
              <FolderOpen
                size={14}
                className={`text-gray-400 transition-transform ml-1 ${expanded ? 'rotate-180' : ''}`}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── 펼침 상세 영역 (Read-only 아코디언 전용) ──────────────── */}
      {expandable && expanded && (
        <div className="px-4 pb-4 pt-2 bg-slate-50 border-t border-gray-100">
          <div className="space-y-2 text-xs text-gray-600">

            {/* New 엔트리 상세 */}
            {item.entryMode === 'new' && (
              <>
                {item.phenomenon && (
                  <div>
                    <span className="font-semibold text-gray-700">Phenomenon: </span>
                    <span className="whitespace-pre-wrap">{item.phenomenon}</span>
                  </div>
                )}
                {item.rootCause && (
                  <div>
                    <span className="font-semibold text-gray-700">Root Cause: </span>
                    <span className="whitespace-pre-wrap">{item.rootCause}</span>
                  </div>
                )}
                {item.disposition && (
                  <div>
                    <span className={`font-semibold ${item.disposition === 'Revision' ? 'text-orange-600' : 'text-gray-700'}`}>
                      Disposition:{' '}
                    </span>
                    {item.disposition}
                  </div>
                )}
                {item.modPlan && (
                  <div>
                    <span className="font-semibold text-gray-700">Mod. Plan: </span>
                    <span className="whitespace-pre-wrap">{item.modPlan}</span>
                  </div>
                )}
                {item.justification && (
                  <div>
                    <span className="font-semibold text-gray-700">Justification: </span>
                    <span className="whitespace-pre-wrap">{item.justification}</span>
                  </div>
                )}
              </>
            )}

            {/* Eval 엔트리 상세 */}
            {item.entryMode === 'eval' && (
              <>
                <div>
                  <span className="font-semibold text-gray-700">Assessment: </span>
                  <span className={`font-bold ${
                    item.assessment === 'Fixed'    ? 'text-green-600' :
                    item.assessment === 'Deferred' ? 'text-blue-600'  : 'text-orange-600'
                  }`}>
                    {item.assessment === 'Deferred' ? '🔵 Deferred (유보)' : item.assessment}
                  </span>
                </div>
                {item.comment && (
                  <div>
                    <span className="font-semibold text-gray-700">Comment: </span>
                    <span className="whitespace-pre-wrap">{item.comment}</span>
                  </div>
                )}
                {item.assessment !== 'Fixed' && item.assessment !== 'Deferred' && (
                  <>
                    {item.rootCause && (
                      <div>
                        <span className="font-semibold text-gray-700">Root Cause: </span>
                        <span className="whitespace-pre-wrap">{item.rootCause}</span>
                      </div>
                    )}
                    {item.disposition && (
                      <div>
                        <span className="font-semibold text-gray-700">Disposition: </span>
                        {item.disposition}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Re-open 엔트리 상세 */}
            {item.entryMode === 'reopen' && (
              <>
                {item.reopenReason && (
                  <div>
                    <span className="font-semibold text-red-600">Re-open Reason: </span>
                    <span className="whitespace-pre-wrap">{item.reopenReason}</span>
                  </div>
                )}
                {item.rootCause && (
                  <div>
                    <span className="font-semibold text-gray-700">Root Cause: </span>
                    <span className="whitespace-pre-wrap">{item.rootCause}</span>
                  </div>
                )}
                {item.disposition && (
                  <div>
                    <span className="font-semibold text-gray-700">Disposition: </span>
                    {item.disposition}
                  </div>
                )}
              </>
            )}

            {/* Carryover 엔트리 상세 */}
            {item.entryMode === 'carryover' && (
              <>
                <div>
                  <span className="font-semibold text-purple-700">Carryover Action: </span>
                  <span className="font-bold">{item.carryoverAction || 'Pending'}</span>
                </div>
                {item.comment && (
                  <div>
                    <span className="font-semibold text-gray-700">Comment: </span>
                    <span className="whitespace-pre-wrap">{item.comment}</span>
                  </div>
                )}
                {item.modPlan && (
                  <div>
                    <span className="font-semibold text-gray-700">Mod Plan: </span>
                    <span className="whitespace-pre-wrap">{item.modPlan}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default IssueCard;
