import React from 'react';
import { AlertCircle, CheckCircle2, HelpCircle, XCircle, X } from 'lucide-react';

const CommonConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "확인", 
  message = "", 
  type = "info", // info, success, warning, danger
  confirmText = "확인",
  cancelText = "취소",
  showCancel = true
}) => {
  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle2 className="text-emerald-500" size={24} />,
          button: "bg-emerald-600 hover:bg-emerald-700 text-white",
          border: "border-emerald-100",
          bg: "bg-emerald-50"
        };
      case 'warning':
        return {
          icon: <HelpCircle className="text-amber-500" size={24} />,
          button: "bg-amber-600 hover:bg-amber-700 text-white",
          border: "border-amber-100",
          bg: "bg-amber-50"
        };
      case 'danger':
        return {
          icon: <XCircle className="text-rose-500" size={24} />,
          button: "bg-rose-600 hover:bg-rose-700 text-white",
          border: "border-rose-100",
          bg: "bg-rose-50"
        };
      default: // info
        return {
          icon: <AlertCircle className="text-blue-500" size={24} />,
          button: "bg-blue-600 hover:bg-blue-700 text-white",
          border: "border-blue-100",
          bg: "bg-blue-50"
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border ${styles.border} animate-in fade-in zoom-in duration-200`}>
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-2 rounded-xl ${styles.bg} shrink-0`}>
              {styles.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-slate-900 mb-1 leading-tight">{title}</h3>
              <p className="text-sm font-medium text-slate-500 leading-relaxed whitespace-pre-wrap">
                {message}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3">
          {showCancel && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={() => {
              onConfirm && onConfirm();
              onClose();
            }}
            className={`px-6 py-2 text-sm font-bold rounded-xl shadow-sm transition-all active:scale-95 ${styles.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommonConfirmModal;
