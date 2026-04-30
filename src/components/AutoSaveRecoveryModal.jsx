import React from 'react';
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';

const AutoSaveRecoveryModal = ({ isOpen, timestamp, onRestore, onDiscard }) => {
  if (!isOpen) return null;

  const formattedTime = timestamp 
    ? new Date(timestamp).toLocaleString('ko-KR', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      })
    : '알 수 없는 시간';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-amber-200 w-full max-w-md overflow-hidden transform scale-100 transition-transform">
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 to-orange-400" />
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-2xl shadow-inner">
              <AlertTriangle className="text-amber-600" size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-0.5">데이터 복구 알림</p>
              <h2 className="text-lg font-extrabold text-slate-800">편집 중인 데이터 발견</h2>
            </div>
          </div>
          
          <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 mb-6">
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              이전에 브라우저에 저장된 작업 내용이 발견되었습니다. <br/>
              서버에 저장된 데이터보다 최신입니다.
            </p>
            <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-amber-700 bg-white border border-amber-200 px-3 py-1.5 rounded-lg w-fit">
              <span className="opacity-60">마지막 편집:</span>
              <span>{formattedTime}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <button 
              onClick={onRestore} 
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.98]"
            >
              <RotateCcw size={18} />
              편집본 불러오기 (복구)
            </button>
            <button 
              onClick={onDiscard} 
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 font-bold rounded-xl border border-transparent hover:border-red-200 transition-all"
            >
              <Trash2 size={18} />
              편집본 삭제 (서버 데이터 유지)
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes modal-pop {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-in {
          animation: modal-pop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>
    </div>
  );
};

export default AutoSaveRecoveryModal;
