import React, { useState, useEffect } from 'react';
import { X, Edit3, Copy, CheckCircle2, AlertTriangle, ChevronRight, Hash, Type } from 'lucide-react';

export default function ProjectManageModal({ mode, project, existingIds, onClose, onConfirm }) {
  const [newName, setNewName] = useState(mode === 'rename' ? project.name : project.name + " (Copy)");
  const [newId, setNewId] = useState(mode === 'rename' ? project.id : project.id + "_Copy");
  
  // For Copy mode: selection of revisions
  const [selectedRevisions, setSelectedRevisions] = useState(
    mode === 'copy' ? Object.keys(project.project_data?.revisions || {}) : []
  );

  const [error, setError] = useState('');

  useEffect(() => {
    // ID 중복 체크 (본인 제외)
    const isDuplicate = existingIds.some(id => id === newId && (mode === 'copy' || id !== project.id));
    if (isDuplicate) {
      setError('이미 존재하는 프로젝트 ID입니다. 다른 이름을 사용해주세요.');
    } else {
      setError('');
    }
  }, [newId, existingIds, mode, project.id]);

  const handleNameChange = (val) => {
    setNewName(val);
    const generatedId = val.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    setNewId(generatedId);
  };

  const toggleRevision = (rev) => {
    if (selectedRevisions.includes(rev)) {
      setSelectedRevisions(prev => prev.filter(r => r !== rev));
    } else {
      setSelectedRevisions(prev => [...prev, rev]);
    }
  };

  const handleExecute = () => {
    if (!newName.trim() || !newId.trim()) {
      alert('프로젝트 이름과 ID를 입력해주세요.');
      return;
    }
    if (error) {
      alert(error);
      return;
    }
    if (mode === 'copy' && selectedRevisions.length === 0) {
      alert('복제할 차수를 하나 이상 선택해주세요.');
      return;
    }

    onConfirm({
      newId: newId.trim(),
      newName: newName.trim(),
      selectedRevisions: mode === 'copy' ? selectedRevisions : null
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-slate-200">
        {/* Header */}
        <div className="bg-slate-50 p-7 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl shadow-lg ${mode === 'rename' ? 'bg-amber-500 text-white shadow-amber-200' : 'bg-indigo-600 text-white shadow-indigo-200'}`}>
              {mode === 'rename' ? <Edit3 size={24} /> : <Copy size={24} />}
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                {mode === 'rename' ? 'Rename Project Identity' : 'Duplicate Project (Clone)'}
              </h2>
              <p className="text-sm text-slate-500 font-medium">프로젝트 식별자 정보를 변경하거나 독립적인 복제본을 생성합니다.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {/* Identity Section */}
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                <Type size={14} className="text-slate-300" /> {mode === 'rename' ? 'New Project Name' : 'Duplicate Project Name'}
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  value={newName} 
                  onChange={(e) => handleNameChange(e.target.value)}
                  autoFocus
                  className={`w-full bg-slate-50 border-2 rounded-2xl px-5 py-4 text-lg font-bold text-slate-700 outline-none transition-all ${error ? 'border-rose-200 focus:border-rose-400 bg-rose-50/30' : 'border-slate-100 focus:border-indigo-500 focus:bg-white shadow-sm'}`}
                  placeholder="Enter project name..."
                />
                {error && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-rose-500 animate-in fade-in slide-in-from-top-1">
                    <AlertTriangle size={12} /> {error}
                  </div>
                )}
              </div>
            </div>

            {mode === 'rename' && (
              <div className="p-5 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-amber-800 mb-1">Deep Metadata Replacement</h4>
                  <p className="text-[11px] text-amber-600 font-bold leading-relaxed">
                    프로젝트 명칭 변경 시, 내부 데이터(Project Overview 등)에 포함된 모든 구형 이름 정보가 새로운 이름으로 자동 치환됩니다.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Revision Selection (Only for Copy mode) */}
          {mode === 'copy' && (
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Select Revisions to Clone</label>
                <span className="text-[10px] font-bold text-slate-400">{selectedRevisions.length} selected</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {Object.keys(project.project_data?.revisions || {}).map((rev) => (
                  <div 
                    key={rev}
                    onClick={() => toggleRevision(rev)}
                    className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedRevisions.includes(rev) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                  >
                    <span className="text-xs font-black tracking-tight">{rev}</span>
                    {selectedRevisions.includes(rev) && <CheckCircle2 size={16} className="text-indigo-500" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-4">
          <button 
            onClick={onClose}
            className="px-6 py-3 text-sm font-black text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleExecute}
            disabled={!!error}
            className={`px-10 py-3 text-sm font-black text-white rounded-2xl shadow-xl transition-all active:scale-95 flex items-center gap-2 ${error ? 'bg-slate-300 cursor-not-allowed' : (mode === 'rename' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200')}`}
          >
            {mode === 'rename' ? 'Apply Rename' : 'Duplicate Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
