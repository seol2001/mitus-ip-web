import React from 'react';
import { X, CheckCircle, AlertTriangle, ArrowRight, FileSearch, FileText } from 'lucide-react';

export default function LockChecklistModal({ isOpen, onClose, checklist, onConfirm }) {
  if (!isOpen) return null;

  const isAllClear = checklist.every(item => item.isPassed);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <CheckCircle className="text-blue-600" size={20} />
            현재 차수 확정 체크리스트
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-sm text-slate-500 leading-relaxed">
            현재 차수({checklist[0]?.stage})를 마감하고 데이터를 확정하기 위해 다음 항목들을 확인해 주세요.
          </p>

          <div className="space-y-3">
            {checklist.map((item, idx) => (
              <div 
                key={idx} 
                className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${
                  item.isPassed 
                    ? 'bg-green-50 border-green-100 text-green-800' 
                    : 'bg-rose-50 border-rose-100 text-rose-800'
                }`}
              >
                <div className="mt-0.5">
                  {item.isPassed ? (
                    <CheckCircle size={18} className="text-green-500" />
                  ) : (
                    <AlertTriangle size={18} className="text-rose-500" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold">{item.title}</span>
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-tighter ${
                      item.isPassed ? 'bg-green-200/50' : 'bg-rose-200/50'
                    }`}>
                      {item.isPassed ? 'Passed' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-xs opacity-80 leading-normal">{item.description}</p>
                  
                  {!item.isPassed && item.pendingItems?.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-rose-200/30">
                      <div className="flex flex-wrap gap-1.5">
                        {item.pendingItems.map((p, i) => (
                          <span key={i} className="text-[10px] bg-white/60 px-1.5 py-0.5 rounded font-mono border border-rose-200/50">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
          {isAllClear ? (
            <>
              <div className="text-xs text-center text-blue-600 font-bold bg-blue-50 py-2 rounded-lg border border-blue-100">
                ✅ 모든 전제 조건이 충족되었습니다.
              </div>
              <button
                onClick={onConfirm}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                차수 확정 및 읽기 전용 전환 <ArrowRight size={18} />
              </button>
            </>
          ) : (
            <div className="text-xs text-center text-rose-600 font-bold bg-rose-50 py-3 rounded-lg border border-rose-100 flex items-center justify-center gap-2 px-4 leading-relaxed">
              <AlertTriangle size={14} className="shrink-0" />
              미결 항목이 남아있어 확정할 수 없습니다.<br/>위 내용을 확인 후 조치를 완료해 주세요.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
