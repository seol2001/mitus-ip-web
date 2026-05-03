import React, { useState } from 'react';
import { X, FileJson, AlertTriangle, CheckCircle2, History, ChevronRight, Save, Plus } from 'lucide-react';

export default function ImportModal({ data, onClose, onConfirm }) {
  const { project, existingProject } = data;
  
  // mode: 'new' | 'merge'
  const [mode, setMode] = useState(existingProject ? 'merge' : 'new');
  const [useBackup, setUseBackup] = useState(true);

  // 신규 프로젝트 정보
  const [newId, setNewId] = useState(project.id + "_Copy");
  const [newName, setNewName] = useState((project.name || project.id) + " (Copy)");
  
  // revActions: { EVT1: 'add' | 'overwrite', ... }
  const [revActions, setRevActions] = useState(
    Object.keys(project.project_data?.revisions || {}).reduce((acc, rev) => {
      acc[rev] = 'add';
      return acc;
    }, {})
  );

  const [selectedRevisions, setSelectedRevisions] = useState(
    Object.keys(project.project_data?.revisions || {})
  );

  const [confirmSafety, setConfirmSafety] = useState(false);

  const toggleRevision = (rev) => {
    if (selectedRevisions.includes(rev)) {
      setSelectedRevisions(prev => prev.filter(r => r !== rev));
    } else {
      setSelectedRevisions(prev => [...prev, rev]);
    }
  };

  const toggleAction = (rev) => {
    setRevActions(prev => ({
      ...prev,
      [rev]: prev[rev] === 'add' ? 'overwrite' : 'add'
    }));
  };

  const hasOverwrite = selectedRevisions.some(rev => revActions[rev] === 'overwrite') || mode === 'overwrite';

  const handleExecute = () => {
    if (selectedRevisions.length === 0) {
      alert('가져올 차수를 하나 이상 선택해주세요.');
      return;
    }
    if (hasOverwrite && !confirmSafety) {
      alert('덮어쓰기 경고를 확인하고 체크박스를 선택해주세요.');
      return;
    }
    if (mode === 'new' && (!newId.trim() || !newName.trim())) {
      alert('신규 프로젝트의 ID와 이름을 입력해주세요.');
      return;
    }
    onConfirm({
      mode,
      useBackup,
      selectedRevisions,
      revActions,
      newId: newId.trim(),
      newName: newName.trim()
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-slate-200">
        {/* Header */}
        <div className="bg-slate-50 p-7 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
              <FileJson size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Import Data Configuration</h2>
              <p className="text-sm text-slate-500 font-medium">데이터 유입 방식 및 충돌 방지 설정을 구성하세요.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row h-[500px]">
          {/* Left Panel: Mode Selection */}
          <div className="w-full md:w-2/5 p-8 border-r border-slate-100 space-y-8 overflow-y-auto bg-slate-50/50">
            <div className="space-y-4">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Import Strategy</label>
              
              {/* 신규 프로젝트 통합 컨테이너 */}
              <div className={`rounded-[24px] border-2 transition-all duration-300 overflow-hidden ${mode === 'new' ? 'border-indigo-500 shadow-xl shadow-indigo-100 bg-white' : 'border-transparent bg-slate-50/50'}`}>
                <button 
                  onClick={() => setMode('new')}
                  className={`w-full p-5 text-left transition-all ${mode === 'new' ? 'bg-indigo-50/30' : 'hover:bg-slate-100'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-base font-black ${mode === 'new' ? 'text-indigo-700' : 'text-slate-700'}`}>신규 프로젝트</span>
                    {mode === 'new' && <CheckCircle2 size={20} className="text-indigo-600" />}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">별도의 ID로 새로운 프로젝트를 생성합니다.</p>
                </button>

                {mode === 'new' && (
                  <div className="p-5 pt-0 animate-in slide-in-from-top-2 duration-300">
                    <div className="pt-4 border-t border-indigo-100 space-y-3">
                      <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">New Project Name</label>
                      <input 
                        type="text" 
                        value={newName} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewName(val);
                          setNewId(val.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, ''));
                        }}
                        placeholder="Project name..."
                        className="w-full bg-white border border-indigo-100 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all shadow-inner"
                      />
                    </div>
                  </div>
                )}
              </div>

              {existingProject && (
                <div className={`rounded-[24px] border-2 transition-all duration-300 overflow-hidden ${mode === 'merge' ? 'border-amber-500 shadow-xl shadow-amber-100 bg-white' : 'border-transparent bg-slate-50/50'}`}>
                  <button 
                    onClick={() => setMode('merge')}
                    className={`w-full p-5 text-left transition-all ${mode === 'merge' ? 'bg-amber-50/30' : 'hover:bg-slate-100'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-base font-black ${mode === 'merge' ? 'text-amber-700' : 'text-slate-700'}`}>기존 프로젝트에 병합</span>
                      {mode === 'merge' && <History size={20} className="text-amber-600" />}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">현재 프로젝트의 차수 리스트에 데이터를 추가/교체합니다.</p>
                  </button>

                  {mode === 'merge' && (
                    <div className="p-5 pt-0 animate-in slide-in-from-top-2 duration-300">
                      <div className="pt-4 border-t border-amber-100">
                        <label className="flex items-start gap-3 cursor-pointer group p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                          <input 
                            type="checkbox" 
                            checked={useBackup} 
                            onChange={(e) => setUseBackup(e.target.checked)} 
                            className="mt-1 w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-[11px] text-blue-700 font-bold leading-snug group-hover:text-blue-900 transition-colors">
                            실행 직전 현재 상태를 <strong>{project.id}_BAK</strong> 프로젝트로 복제하여 보존합니다. (강력 권장)
                          </span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Revision List & Action Toggle */}
          <div className="w-full md:w-3/5 p-8 overflow-y-auto">
            <div className="flex justify-between items-end mb-6">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Select Revisions & Actions</label>
              <div className="text-[10px] font-bold text-slate-400">Total {Object.keys(project.project_data?.revisions || {}).length} revisions found</div>
            </div>

            <div className="space-y-3">
              {Object.keys(project.project_data?.revisions || {}).map((rev) => {
                const isSelected = selectedRevisions.includes(rev);
                const action = revActions[rev];
                const isOverwrite = mode === 'merge' && action === 'overwrite' && isSelected;
                const isExisting = existingProject?.project_data?.revisions?.[rev];

                return (
                  <div 
                    key={rev}
                    className={`group relative flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${isSelected ? (isOverwrite ? 'bg-rose-50 border-rose-300 shadow-lg shadow-rose-100' : 'bg-white border-indigo-200 shadow-md') : 'bg-slate-50 border-transparent opacity-60'}`}
                  >
                    <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => toggleRevision(rev)}>
                      <div className={`w-3 h-3 rounded-full ${isSelected ? (isOverwrite ? 'bg-rose-500 animate-pulse' : 'bg-indigo-500') : 'bg-slate-300'}`}></div>
                      <div>
                        <span className={`text-sm font-black tracking-tight ${isSelected ? (isOverwrite ? 'text-rose-700' : 'text-slate-800') : 'text-slate-400'}`}>{rev}</span>
                        {isSelected && (
                          <div className={`text-[10px] font-bold mt-0.5 ${isOverwrite ? 'text-rose-500' : 'text-indigo-400'}`}>
                            {mode === 'new' ? 'New Project Entry' : (action === 'add' ? '→ Add as New Revision' : '⚠ OVERWRITE EXISTING')}
                          </div>
                        )}
                      </div>
                    </div>

                    {isSelected && mode === 'merge' && (
                      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button 
                          onClick={() => setRevActions(p => ({ ...p, [rev]: 'add' }))}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${action === 'add' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          Add as Copy
                        </button>
                        <button 
                          onClick={() => {
                            if (isExisting) setRevActions(p => ({ ...p, [rev]: 'overwrite' }));
                          }}
                          disabled={!isExisting}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${!isExisting ? 'opacity-30 cursor-not-allowed' : (action === 'overwrite' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-rose-400')}`}
                        >
                          Overwrite
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer with High-Visibility Warning */}
        <div className="p-8 border-t border-slate-100 bg-white">
          {hasOverwrite && (
            <div className="mb-6 p-5 bg-rose-50 border-2 border-rose-100 rounded-[24px] flex items-start gap-4 animate-in slide-in-from-bottom-2 duration-300">
              <div className="p-2 bg-rose-600 text-white rounded-xl">
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-black text-rose-800 mb-1">데이터 덮어쓰기 경고 (Critical Warning)</h4>
                <p className="text-[11px] text-rose-600 font-bold leading-relaxed">
                  일부 차수가 <strong>기존 데이터를 영구적으로 교체</strong>하도록 설정되었습니다. <br/>
                  실행 전 백업 옵션이 선택되어 있는지 다시 한번 확인하시기 바랍니다.
                </p>
                <label className="mt-3 flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={confirmSafety} 
                    onChange={(e) => setConfirmSafety(e.target.checked)}
                    className="w-4 h-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500" 
                  />
                  <span className="text-xs font-black text-rose-700">위 내용을 확인했으며 실행에 동의합니다.</span>
                </label>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-4">
            <button 
              onClick={onClose}
              className="px-6 py-3 text-sm font-black text-slate-500 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
            >
              Cancel
            </button>
            <button 
              onClick={handleExecute}
              className={`px-10 py-3 text-sm font-black text-white rounded-2xl shadow-xl transition-all active:scale-95 flex items-center gap-2 ${hasOverwrite ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
            >
              {hasOverwrite ? 'Confirm & Overwrite' : 'Execute Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
