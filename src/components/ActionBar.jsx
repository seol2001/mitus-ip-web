import React from 'react';
import { Lock as LockIcon, Unlock as UnlockIcon } from 'lucide-react';

const ActionBar = ({ isGlobalArchived, isEditing, onEdit, onLock, disableLock, disableReason }) => {
  if (isGlobalArchived) return null;

  return (
    <div className="flex justify-end mb-2 z-10">
      {!isEditing ? (
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 shadow-sm"
        >
          <UnlockIcon size={14} /> 편집 활성화
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
