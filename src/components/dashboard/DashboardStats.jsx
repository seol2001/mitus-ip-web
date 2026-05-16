import React from 'react';

export default function DashboardStats({ 
  isDemoMode, 
  isDbConnected, 
  showArchived, 
  onShowArchivedChange,
  sortOrder,
  onSortOrderChange
}) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mb-4 px-2 bg-slate-50/50 p-3 rounded-xl border border-slate-200/60 gap-3">
      <div className="text-xs font-bold flex items-center gap-2">
        {isDemoMode ? (
          <>
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
            <span className="text-amber-700">Demo Mode — DB Disconnected</span>
          </>
        ) : isDbConnected ? (
          <>
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-green-700">Cloud Database Connected</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></span>
            <span className="text-slate-500">Connecting...</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sort by:</span>
          <select 
            value={sortOrder}
            onChange={(e) => onSortOrderChange(e.target.value)}
            className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-slate-700 cursor-pointer hover:border-slate-300"
          >
            <option value="updated_desc">최근 업데이트순</option>
            <option value="recently_accessed">최근 방문순</option>
            <option value="most_accessed">자주 방문순</option>
            <option value="name_asc">프로젝트 이름순 (A-Z)</option>
            <option value="name_desc">프로젝트 이름순 (Z-A)</option>
          </select>
        </div>

        <label 
          className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
          title="시스템 데이터베이스에 저장된 프로젝트 중 '보관(Archive)' 처리된 항목들을 표시합니다."
        >
          <input 
            type="checkbox" 
            checked={showArchived} 
            onChange={(e) => onShowArchivedChange(e.target.checked)} 
            className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
          />
          View Archived Projects
        </label>
      </div>
    </div>
  );
}
