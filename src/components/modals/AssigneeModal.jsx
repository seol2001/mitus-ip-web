import React from 'react';
import { Edit2 } from 'lucide-react';

const AssigneeModal = React.memo(({ isOpen, value, onChange, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-600">
          <Edit2 size={19} /> 담당자 변경
        </h3>
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4"
          placeholder="이름 입력"
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirm();
          }}
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-100 rounded-md text-sm"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
});

AssigneeModal.displayName = 'AssigneeModal';

export default AssigneeModal;
