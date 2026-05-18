import React, { useState } from 'react';
import { Edit2, Trash2, ChevronDown, User, Tag, Link, Activity, ArrowRightCircle, ShieldCheck } from 'lucide-react';
import { getIssueStatus } from '../logic/revisionLogLogic';

export default React.memo(function IssueSummaryCard({
  item,
  project,
  isReadOnly = false,
  editingId = null,
  activeTargetIssue = null,
  onEdit,
  onDelete,
  expandable = false,
  currentStage,
  historyStage,
  needsEval = false,
  onShowHistoryReport,
  timeline = [],
}) {
  const [expanded, setExpanded] = useState(false);

  if (!item) return null;

  const isNewLike = item.entryMode === 'new' || item.entryMode === 'fa';
  const issueId = isNewLike
    ? `${item.ipBlock}.${project}.${item.issueNum}`
    : item.targetIssue;

  const showActions = !isReadOnly;
  // 카드 전체 클릭 가능 여부: onEdit이 있으면 언제나 클릭 가능 및 과거 차수 이월/평가 폼 활성화 매칭 반영
  const isCurrentlyEditing = (editingId === item.id) || (activeTargetIssue && activeTargetIssue === issueId);

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

  // 0. Sub-block Lineage Badge
  const ipName = item.ipBlock || (item.targetIssue ? item.targetIssue.split('.')[0] : 'Unknown');
  if (item.subBlock) {
    badges.push({ 
      label: `[${ipName} ➔ ${item.subBlock}]`, 
      style: 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold' 
    });
  } else {
    badges.push({ 
      label: `[${ipName}]`, 
      style: 'bg-slate-100 text-slate-600 border-slate-200' 
    });
  }

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

  // ── Actionable Decision Badge Injection (V1.7.3) ──
  if (needsEval) {
    badges.unshift({
      label: '⚠️ 판정 필요',
      style: 'bg-amber-100 text-amber-800 border-amber-300 font-extrabold animate-pulse shadow-sm'
    });
  } else if (item.entryMode === 'carryover' && item.carryoverStatus === 'OPEN') {
    badges.unshift({
      label: '🔍 유지 심사 필요',
      style: 'bg-indigo-100 text-indigo-800 border-indigo-300 font-extrabold shadow-sm'
    });
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

  const previewText = cleanPhenomenon 
    ? cleanPhenomenon 
    : item.comment 
      ? `[Comment] ${item.comment}`
      : item.reopenReason 
        ? `[Re-open Reason] ${item.reopenReason}`
        : '';

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
      className={`rounded-xl shadow-sm transition-all duration-200 mb-2 ${getColorBar()} ${borderClass} ${getBgTint()} ${
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
              <span className="text-[13px] font-semibold text-slate-800 tracking-tight leading-tight mr-1">
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
              (() => {
                const isCurrentStage = !item.stage || item.stage === currentStage;
                return (
                  <div className={`flex items-center gap-1.5 mb-1.5 text-[11px] font-medium ${
                    isCurrentStage ? 'text-amber-600' : 'text-slate-400'
                  }`}>
                    <Link size={10} className="shrink-0" />
                    <span>FA: {item.faReportId || item.faId}{item.faCustomer ? ` · ${item.faCustomer}` : ''} {!isCurrentStage && "(이월 연동)"}</span>
                  </div>
                );
              })()
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
                {item.verificationGap && <div className="col-span-full"><span className="font-bold text-slate-800 mr-1">Verification Gap:</span> <span className="whitespace-pre-wrap font-bold">{item.verificationGap}</span></div>}
                {item.gapComment && <div className="col-span-full"><span className="font-bold text-slate-800 mr-1">Gap Comment:</span> <span className="whitespace-pre-wrap font-bold">{item.gapComment}</span></div>}
                {item.entryMode === 'eval' && item.comment && <div className="col-span-full"><span className="font-semibold text-slate-600 mr-1">Eval Comment:</span> <span className="whitespace-pre-wrap">{item.comment}</span></div>}
              </div>
            )}

            {/* 이슈 차수 노선도 (Milestone Line) */}
            {timeline && timeline.length > 0 && (
              <div className="mt-3.5 pt-2.5 border-t border-gray-100/70 flex items-center gap-3">
                <span className="text-[9px] font-extrabold text-slate-400 select-none tracking-wider whitespace-nowrap">이력 노선도:</span>
                <div className="flex items-center flex-1 relative h-6">
                  {/* 가로 선 */}
                  <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-slate-100 rounded-full" />
                  
                  {/* 개별 노드들 */}
                  <div className="absolute left-0 right-0 top-0 bottom-0 flex justify-between items-center">
                    {timeline.map((node, index) => {
                      const isNodeCurrent = node.stage === currentStage;
                      const status = node.data ? getIssueStatus(node.data) : 'OPEN';
                      
                      // 노드 색상 & 테두리 스타일 지정 (미니멀 파스텔 Hollow Ring 디자인)
                      let nodeStyle = '';
                      
                      if (isCurrentlyEditing) {
                        // 1. 해당 이슈카드가 선택/활성화된 상태일 때만 본연의 선명한 상태 색상을 뿜어냄!
                        nodeStyle = 
                          status === 'CLOSED' ? 'border-2 border-green-500 bg-green-50/60 ring-2 ring-green-100' :
                          status === 'DEFERRED' ? 'border-2 border-blue-400 bg-blue-50/60 ring-2 ring-blue-100' :
                          'border-2 border-red-400 bg-red-50/60 ring-2 ring-red-100';
                      } else {
                        // 2. 평소(비활성화 카드)에는 아주 은은한 무채색 그레이 톤으로 통일하여 시각적 소음 0%화!
                        nodeStyle = 'border border-slate-300 bg-slate-100/70 text-slate-400';
                      }

                      // 1. 툴팁 위치 및 꼬리표 위치 지능적 산출 (index 기반 분기)
                      const isFirst = index === 0;
                      const isLast = index === timeline.length - 1;
                      
                      let tooltipAlignClass = 'left-1/2 -translate-x-1/2'; // 기본 중앙
                      let arrowAlignClass = 'left-1/2 -translate-x-1/2';
                      
                      if (isFirst) {
                        tooltipAlignClass = 'left-0 -translate-x-[12px]'; // 오른쪽으로 밀어서 왼쪽 잘림 차단
                        arrowAlignClass = 'left-[20px] -translate-x-0';
                      } else if (isLast) {
                        tooltipAlignClass = 'left-auto right-0 translate-x-[12px]'; // 왼쪽으로 밀어서 오른쪽 잘림 차단
                        arrowAlignClass = 'left-auto right-[20px] -translate-x-0';
                      }

                      return (
                        <div key={index} className="relative group/node flex items-center justify-center hover:z-50">
                          {/* 원형 노드: cursor-help ➔ cursor-pointer 교체 완료 및 쌓임 맥락 뚫림 완치를 위해 z-10 ➔ z-0 강등 */}
                          <div className={`w-2.5 h-2.5 rounded-full ${nodeStyle} cursor-pointer transition-all duration-200 hover:scale-125 z-0`} />
                          
                          {/* 미니 차수 레이블 */}
                          <span className="absolute -bottom-4 text-[9px] font-bold text-slate-400 select-none whitespace-nowrap">
                            {node.stage}
                          </span>

                          {/* 🎨 호버 툴팁 (CSS 및 Framer-like transition 효과 결합) */}
                          <div className={`absolute bottom-6 ${tooltipAlignClass} opacity-0 pointer-events-none group-hover/node:opacity-100 group-hover/node:pointer-events-auto transition-all duration-200 transform translate-y-1 hover:translate-y-0 z-50 min-w-[260px] max-w-[320px]`}>
                            {/* 화이트 글래스모피즘 스킨 도입 */}
                            <div className="bg-white/95 backdrop-blur-md text-slate-700 text-xs rounded-xl p-3 shadow-xl border border-slate-200/80 flex flex-col gap-2 relative">
                              {/* 말풍선 꼬리 */}
                              <div className={`absolute bottom-[-6px] ${arrowAlignClass} w-3 h-3 bg-white/95 rotate-45 border-r border-b border-slate-200/80`} />
                              
                              {/* 헤더 */}
                              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-0.5">
                                <span className="font-extrabold text-[10px] text-slate-800 tracking-wider">
                                  🎯 STAGE {node.stage} 스냅샷
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                  status === 'CLOSED' ? 'bg-green-50 text-green-600 border-green-200/80' :
                                  status === 'DEFERRED' ? 'bg-blue-50 text-blue-600 border-blue-200/80' :
                                  'bg-red-50 text-red-600 border-red-200/80'
                                }`}>
                                  {status}
                                </span>
                              </div>

                              {/* 툴팁 상세 항목 */}
                              <div className="space-y-1.5 text-[11px] text-slate-600">
                                <div>
                                  <span className="text-slate-400 font-bold mr-1">처분(Disposition):</span>
                                  <span className="font-semibold text-slate-700">{node.data?.disposition || '---'}</span>
                                </div>
                                {node.data?.assessment && (
                                  <div>
                                    <span className="text-slate-400 font-bold mr-1">평가결과:</span>
                                    <span className="font-semibold text-slate-700">{node.data.assessment}</span>
                                  </div>
                                )}
                                <div>
                                  <span className="text-slate-400 font-bold mr-1">담당자:</span>
                                  <span className="font-semibold text-slate-700">{node.data?.assignee || '미지정'}</span>
                                </div>
                                {/* 조치계획 (modPlan 또는 justification) */}
                                {(node.data?.modPlan || node.data?.justification) && (
                                  <div className="bg-slate-50/70 border border-slate-100 p-2 rounded-lg mt-1">
                                    <span className="text-slate-400 font-bold block mb-0.5">📋 조치계획 / Justification:</span>
                                    <p className="text-slate-600 leading-relaxed break-all whitespace-pre-line m-0 line-clamp-3">
                                      {node.data.modPlan || node.data.justification}
                                    </p>
                                  </div>
                                )}
                                {/* 코멘트 */}
                                {node.data?.comment && (
                                  <div className="bg-slate-50/70 border border-slate-100 p-2 rounded-lg mt-1">
                                    <span className="text-slate-400 font-bold block mb-0.5">💬 당사의견 (Comment):</span>
                                    <p className="text-slate-600 leading-relaxed break-all whitespace-pre-line m-0 line-clamp-3">
                                      {node.data.comment}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-0.5 shrink-0 ml-1 mt-0.5">
            {onShowHistoryReport && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onShowHistoryReport(issueId);
                }}
                className="flex items-center gap-1 bg-blue-50/50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 px-2.5 py-0.5 h-[22px] rounded-full border border-blue-200/60 text-[10px] font-bold transition-all shadow-sm shrink-0 select-none mr-1 hover:scale-105 active:scale-95 duration-150"
                title="이슈 과거 변경 이력 리포트 보기"
              >
                <Activity size={11} className="animate-pulse" />
                <span>이력 보기</span>
              </button>
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
              <ChevronDown size={14} className={`text-gray-400 transition-transform ml-1 ${expanded ? 'rotate-180' : ''}`} />
            )}
          </div>
        </div>
      </div>

      {expandable && expanded && (
        <div className="px-4 pb-4 pt-2 bg-slate-50 border-t border-gray-100">
          <div className="space-y-2 text-xs text-gray-600">
             {item.phenomenon && <div><span className="font-semibold text-gray-700">Phenomenon: </span><span className="whitespace-pre-wrap">{item.phenomenon}</span></div>}
             {item.rootCause && <div><span className="font-semibold text-gray-700">Root Cause: </span><span className="whitespace-pre-wrap">{item.rootCause}</span></div>}
             {item.verificationGap && <div><span className="font-bold text-gray-800">Verification Gap: </span><span className="whitespace-pre-wrap font-bold text-gray-900">{item.verificationGap}</span></div>}
             {item.gapComment && <div><span className="font-bold text-gray-800">Gap Comment: </span><span className="whitespace-pre-wrap font-bold text-gray-900">{item.gapComment}</span></div>}
             {item.modPlan && <div><span className="font-semibold text-gray-700">Mod Plan: </span><span className="whitespace-pre-wrap">{item.modPlan}</span></div>}
             {item.justification && <div><span className="font-semibold text-gray-700">Justification: </span><span className="whitespace-pre-wrap">{item.justification}</span></div>}
             {item.comment && <div><span className="font-semibold text-gray-700">Comment: </span><span className="whitespace-pre-wrap">{item.comment}</span></div>}
             {item.reopenReason && <div><span className="font-semibold text-red-600">Re-open Reason: </span><span className="whitespace-pre-wrap">{item.reopenReason}</span></div>}
             {item.entryMode === 'carryover' && item.carryoverAction && <div><span className="font-semibold text-purple-700">Carryover Action: </span><span className="font-bold">{item.carryoverAction}</span></div>}
          </div>
        </div>
      )}
    </div>
  );
});
