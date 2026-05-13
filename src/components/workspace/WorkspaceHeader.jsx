import React from 'react';
import { ArrowLeft, Download, ChevronsRight, Lock as LockIcon } from 'lucide-react';

const WorkspaceHeader = ({
  activeProject,
  currentViewedRevision,
  isDirtyRef,
  isArchived,
  isSessionLockedByOther,
  currentProjMeta,
  lockDetail,
  isFormDirty,
  currentData,
  requestBackToDashboard,
  handleGlobalLock,
  handleGlobalUnlock,
  handleSaveMD,
  handleGenerateNextRevision,
  handleDebugRollback,
  handleForceUnlock,
  showConfirm
}) => {
  return (
    <div className="bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-[20] px-4 py-2.5">
      <div className="flex items-center gap-3">
        <button onClick={requestBackToDashboard} className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 px-3 py-2 rounded-xl border border-slate-100 transition-colors shrink-0">
          <ArrowLeft size={14} /> <span className="hidden lg:inline">Dashboard</span>
        </button>
        
        <div className="h-5 w-[1px] bg-slate-200 mx-1 hidden sm:block"></div>
        
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-extrabold px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 shadow-sm shrink-0">{activeProject.name}</span>
          <span className={`font-mono text-[10px] font-bold px-2 py-0.5 border rounded-full shrink-0 ${activeProject.isLatest ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : 'bg-slate-200 text-slate-600 border-slate-300'}`}>{currentViewedRevision}</span>
          {(isFormDirty || isDirtyRef.current) && <span className="text-[10px] font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 animate-pulse shrink-0">Unsaved</span>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* ── 글로벌 상태 및 Lock 액션 영역 ── */}
        <div className="flex items-center gap-2">
          {!isArchived ? (
            <div className="flex items-center gap-2 text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 shadow-inner">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-[11px] font-bold text-slate-500">작성 중</span>
              <span className="text-slate-200 mx-1">|</span>
              <button onClick={handleGlobalLock} className="text-blue-600 hover:text-blue-800 text-[11px] font-bold flex items-center gap-1 transition-colors">
                <LockIcon size={12} /> 현재 차수 확정 (Lock)
              </button>
            </div>
          ) : isSessionLockedByOther ? (
            <div className="flex items-center gap-2 text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 font-bold text-[11px] shadow-sm">
              <LockIcon size={12} className="text-rose-500" />
              읽기 전용 ({currentProjMeta?.locked_by})
            </div>
          ) : (lockDetail.isLocked && !lockDetail.isByMe && lockDetail.isStale) ? (
            <div className="flex items-center gap-2 text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 font-bold text-[10px] shadow-sm">
              <span>정체된 잠금 ({lockDetail.minutesAgo}분 전)</span>
              <button onClick={async () => {
                const confirmed = await showConfirm({
                  title: "편집 권한 가져오기 (Takeover)",
                  message: "타인이 편집 중인 잠금을 해제하고 편집 권한을 가져오시겠습니까?\n상대방의 저장되지 않은 데이터가 유실될 수 있습니다.",
                  type: "warning",
                  confirmText: "권한 가져오기"
                });
                if (confirmed) handleForceUnlock(activeProject.id);
              }} className="bg-amber-600 hover:bg-amber-700 text-white px-2 py-0.5 rounded transition-colors">Takeover</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold">
              <LockIcon size={12} /> Read-Only
              {!currentProjMeta?.is_archived && <button onClick={handleGlobalUnlock} className="text-red-500 ml-2 hover:underline">Unlock</button>}
            </div>
          )}
        </div>

        <div className="h-5 w-[1px] bg-slate-200 mx-1 hidden md:block"></div>

        {/* ── 글로벌 유틸리티 영역 ── */}
        <div className="flex gap-2">
          {activeProject && (
            <button onClick={handleSaveMD} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs text-white bg-slate-800 hover:bg-slate-900 transition-colors shadow-sm">
              <Download size={14} /> Download Report (.md)
            </button>
          )}
          { (() => {
              const canGenerate = activeProject.isLatest && currentData?.status === 'archived';
              return (
                <button onClick={handleGenerateNextRevision} disabled={!canGenerate} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition-all ${canGenerate ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200'}`}>
                  <ChevronsRight size={14} /> 다음 차수 파생
                </button>
              );
          })() }
          {activeProject.isLatest && activeProject.evt !== 'EVT0' && !isSessionLockedByOther && (() => {
            const currentNum = parseInt(activeProject.evt.match(/\d+/)?.[0] || "0");
            const prevEvt = activeProject.evt.replace(/\d+/, currentNum - 1);
            return (
              <button onClick={handleDebugRollback} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs text-rose-400/80 hover:text-rose-600 bg-rose-50/30 hover:bg-rose-50 border border-rose-100 transition-all shadow-sm">
                Data reset to {prevEvt}
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default WorkspaceHeader;
