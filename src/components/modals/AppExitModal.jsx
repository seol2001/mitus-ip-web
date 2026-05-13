import React from 'react';

/**
 * AppExitModal - 앱 종료 확인 모달
 * @param {Object} props
 * @param {boolean} props.isOpen - 모달 표시 여부
 * @param {Function} props.onClose - '아니오' 클릭 시 실행될 함수
 * @param {Function} props.onConfirm - '네' 클릭 시 실행될 함수
 */
const AppExitModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/25 backdrop-blur-[2px] animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden p-8 text-center space-y-6 border border-white/20 animate-in zoom-in-95 duration-300">
        <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center text-3xl shadow-inner my-2">🚪</div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 mb-2">서비스 종료 확인</h2>
          <p className="text-sm text-slate-500 font-medium">정말 mitus-ip-web을 <strong>종료하시겠습니까?</strong></p>
        </div>
        <div className="flex flex-col gap-1.5 pt-2">
          <button 
            onClick={onClose} 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3.5 rounded-2xl transition-all shadow-lg shadow-indigo-100 text-[13px]"
          >
            아니요, 더 머무를게요
          </button>
          <button 
            onClick={onConfirm} 
            className="w-full text-slate-400 hover:text-slate-600 font-bold py-2.5 text-[12px] transition-colors"
          >
            네, 종료합니다
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppExitModal;
