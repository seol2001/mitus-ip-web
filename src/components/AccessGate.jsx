import React, { useState } from 'react';
import { Lock, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';

const AccessGate = ({ onAuthorized }) => {
  const [key, setKey] = useState('');
  const [error, setError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // POC용 마스터 키 (실제 운영 시에는 환경 변수로 관리 권장)
  const MASTER_KEY = 'mitus2026';

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // 심플한 검증 로직 (RFP/POC용 최소 방어)
    setTimeout(() => {
      if (key === MASTER_KEY) {
        setError(false);
        onAuthorized();
      } else {
        setError(true);
        setKey('');
      }
      setIsSubmitting(false);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900 font-sans">
      {/* 배경 장식 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md px-6 animate-fid">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/20 mb-6 border border-blue-500/30">
            <Lock className="text-blue-400" size={32} />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Project Mitus Access</h1>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            이 프로젝트는 POC/RFP 검토용으로 공개되었습니다.<br />
            제공받은 <span className="text-blue-400 font-bold">Access Key</span>를 입력해 주세요.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative group">
              <input
                autoFocus
                type="password"
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  if (error) setError(false);
                }}
                placeholder="Access Key 입력"
                className={`w-full h-12 bg-white/5 border ${
                  error ? 'border-red-500/50' : 'border-white/10'
                } group-focus-within:border-blue-500/50 rounded-xl px-4 py-2 text-white text-center text-lg placeholder:text-slate-600 outline-none transition-all`}
              />
              {error && (
                <div className="absolute top-full left-0 right-0 mt-2 flex items-center justify-center gap-1.5 text-red-400 text-xs font-medium animate-bounce">
                  <AlertCircle size={14} />
                  <span>잘못된 키입니다. 다시 확인해 주세요.</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !key}
              className={`w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                isSubmitting || !key
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 active:scale-[0.98]'
              }`}
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck size={18} />
                  <span>시스템 접속</span>
                  <ArrowRight size={16} className="ml-1" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-6 border-t border-white/5">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
              Proprietary & Confidential · Mitus Design Group
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccessGate;
