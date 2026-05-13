import React from 'react';
import { ChevronDown, Plus } from 'lucide-react';

export default function IpDictionarySection({
  isIpDictOpen,
  setIsIpDictOpen,
  globalIpDictionary,
  customIpDetails,
  projects,
  openAddModal,
  setUsageModalIp,
  openEditModal
}) {
  // 헬퍼 함수: IP 사용처 조회
  const getIpUsage = (ipName) => {
    return projects.filter(p => {
      const latestEvt = p.latest_evt;
      const revisionData = p.project_data?.revisions?.[latestEvt] || p.project_data || {};
      const ipBlocks = revisionData.projectOverview?.IP_Blocks || [];
      return ipBlocks.includes(ipName);
    });
  };

  return (
    <div className="mt-12 bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
      <div 
        onClick={() => setIsIpDictOpen(!isIpDictOpen)}
        className="flex justify-between items-center p-6 cursor-pointer hover:bg-slate-50 transition-colors"
      >
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <span className="text-indigo-600">📚</span> Global IP Dictionary
            <ChevronDown size={20} className={`text-slate-400 transition-transform duration-300 ${isIpDictOpen ? 'rotate-180' : ''}`} />
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">전사적으로 관리되는 표준 및 커스텀 IP 카탈로그입니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={(e) => { e.stopPropagation(); openAddModal(); setIsIpDictOpen(true); }}
            className="px-3 py-1.5 text-indigo-600 hover:bg-indigo-50 border border-indigo-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 bg-white"
          >
            <Plus size={14} /> New Category & IP
          </button>
          <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-100 shadow-sm">
            Total Categories: {Object.keys(globalIpDictionary || {}).length}
          </span>
          <span className="px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg border border-amber-100 shadow-sm">
            Custom IPs: {(customIpDetails || []).length}
          </span>
        </div>
      </div>

      {isIpDictOpen && (
        <div className="p-6 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-slate-100 mt-2">
        {Object.entries(globalIpDictionary || {}).map(([category, ips]) => (
          <div key={category} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 border-b border-slate-200/60 pb-2">
              <h3 className="font-extrabold text-slate-700 text-sm flex items-center gap-2">
                {category}
                <span className="bg-white text-slate-400 text-[10px] px-2 py-0.5 rounded-full border">{ips.length}</span>
              </h3>
              <button 
                onClick={() => openAddModal(category)}
                className="text-slate-400 hover:text-blue-600 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded p-1 transition-colors shadow-sm"
                title="해당 카테고리에 새 커스텀 IP 추가"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
                {ips.map(ip => {
                  const usage = getIpUsage(ip);
                  const customDetail = (customIpDetails || []).find(c => c.name === ip && c.category === category);
                  
                  const tagClass = customDetail 
                    ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200" 
                    : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200";

                  return (
                    <div key={ip} className="group relative">
                      <div 
                        onClick={() => usage.length > 0 ? setUsageModalIp({ name: ip, projects: usage }) : openEditModal(customDetail)}
                        className={`${tagClass} border px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer flex items-center gap-2 shadow-sm transition-all active:scale-95`}
                      >
                        {customDetail ? `✨ ${ip}` : ip}
                        {usage.length > 0 && (
                          <span className="absolute top-0.5 right-1 text-emerald-600 text-[9px] font-black z-10">
                            {usage.length}
                          </span>
                        )}
                      </div>
                      {/* Tooltip for Custom IP Description if exists */}
                      {customDetail && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-48 bg-slate-800 text-white text-xs rounded-lg p-2.5 shadow-xl z-10 pointer-events-none">
                          <p className="font-bold text-amber-300 mb-1">{ip} (Custom)</p>
                          <p className="font-medium text-slate-300 leading-tight mb-2">{customDetail.description}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
