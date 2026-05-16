import React from 'react';
import { FileUp, Plus } from 'lucide-react';

export default function DashboardHeader({ 
  fileInputRef, 
  onLoadProject, 
  onNewProject 
}) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 gap-4">
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 tracking-tight">
            Mitus IP Web Dashboard
          </h1>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100 font-black tracking-tighter shadow-sm">V1.5.3</span>
        </div>
        <p className="text-sm text-slate-500 mt-1 font-medium">
          모든 프로젝트 현황 및 차수 관리 (Atomic Lock System)
        </p>
      </div>
      <div className="flex gap-3 w-full md:w-auto">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) onLoadProject(file);
            e.target.value = ''; // Reset for same file selection
          }} 
          accept=".json,.mitus"
          className="hidden" 
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          title="외부 백업 파일(.json)을 시스템으로 가져옵니다."
          className="flex-1 whitespace-nowrap min-w-max flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm border border-slate-200 shadow-sm transition-all"
        >
          <FileUp size={18} /> Import from File
        </button>
        <button
          onClick={onNewProject}
          className="flex-1 whitespace-nowrap min-w-max flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-5 py-2.5 rounded-xl font-bold text-sm border border-indigo-100 shadow-sm transition-all"
        >
          <Plus size={18} /> New Project
        </button>
      </div>
    </div>
  );
}
