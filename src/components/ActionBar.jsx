import React from 'react';
import { Lock as LockIcon, Unlock as UnlockIcon } from 'lucide-react';
import { useConfirm } from '../contexts/ConfirmContext';

const ActionBar = ({ isGlobalArchived, isEditing, onEdit, onLock, disableLock, disableReason, lockReason, onForceUnlock }) => {
  const showConfirm = useConfirm();
  
  if (isGlobalArchived) {
    if (lockReason && lockReason.includes("Locked by")) {
      return (
        <div className="flex flex-col items-end gap-1 mb-2">
          <div className="flex items-center gap-2 text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded border border-rose-200">
             <span>🔒 {lockReason}</span>
          </div>
          <button 
            onClick={async () => {
              const confirmed = await showConfirm({
                title: "권한 강제 가져오기",
                message: "타인이 편집 중인 잠금을 강제로 해제하시겠습니까?\n저장되지 않은 상대방의 데이터가 유실될 수 있습니다.",
                type: "danger",
                confirmText: "가져오기"
              });
              if (confirmed) onForceUnlock();
            }}
            className="text-[10px] font-extrabold text-rose-500 hover:text-rose-700 underline decoration-rose-300"
          >
            편집 권한 강제 가져오기 (Takeover)
          </button>
        </div>
      );
    }
    return (
      <div className="mb-2 px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[11px] font-bold text-slate-500">
        🔒 {lockReason || "Read-Only Mode"}
      </div>
    );
  }

  return (
    <div className="flex justify-end mb-2 z-10">
      {!isEditing ? (
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 shadow-sm"
        >
          <UnlockIcon size={14} /> 편집 시작
        </button>
      ) : (
        <button
          onClick={disableLock ? undefined : onLock}
          disabled={disableLock}
          title={disableLock ? disableReason : ''}
          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all shadow-sm ${
            disableLock 
            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700'
          }`}
        >
          <LockIcon size={14} /> 변경사항 저장 및 잠금
        </button>
      )}
    </div>
  );
};

export default ActionBar;
