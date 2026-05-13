import React from 'react';
import { ChevronDown, Search, Layout } from 'lucide-react';

export default function SubBlockCatalogSection({
  isSubBlockOpen,
  setIsSubBlockOpen,
  subBlockSearch,
  setSubBlockSearch,
  allSubBlocks,
  sortedSubBlockGroups,
  expandedSubBlockName,
  setExpandedSubBlockName,
  setUsageModalSubBlock,
  openWorkspace
}) {
  return (
    <div className="mt-12 bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
      <div 
        onClick={() => setIsSubBlockOpen(!isSubBlockOpen)}
        className="flex justify-between items-center p-6 cursor-pointer hover:bg-slate-50 transition-colors"
      >
        <div className="flex-1">
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <span className="text-blue-600">🧩</span> Sub-Block Reference Catalog
            <ChevronDown size={20} className={`text-slate-400 transition-transform duration-300 ${isSubBlockOpen ? 'rotate-180' : ''}`} />
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">모든 IP 내부에 구성된 서브 블록(BOM)들을 통합 검색하고 참조합니다.</p>
        </div>
        
        <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
          <span className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg border border-slate-200 whitespace-nowrap">
            Total Blocks: {allSubBlocks.length}
          </span>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search sub-blocks..."
              value={subBlockSearch}
              onChange={(e) => {
                setSubBlockSearch(e.target.value);
                setIsSubBlockOpen(true);
              }}
              className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all w-64"
            />
          </div>
        </div>
      </div>

      {isSubBlockOpen && (
        <div className="p-6 pt-2 border-t border-slate-100 bg-slate-50/30">
          {sortedSubBlockGroups.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
              검색 결과가 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {sortedSubBlockGroups.map(group => (
                <div 
                  key={group.name} 
                  className={`bg-white border rounded-xl overflow-hidden transition-all hover:shadow-md ${expandedSubBlockName === group.name ? 'ring-2 ring-blue-500/20 border-blue-200' : 'border-slate-200'}`}
                >
                  <div 
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedSubBlockName(expandedSubBlockName === group.name ? null : group.name)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-extrabold text-slate-800 text-sm">{group.name}</h3>
                      <span className="bg-blue-50 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-blue-100">
                        {group.occurrences.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 font-medium leading-relaxed">
                      {group.latestFeatures || 'No description available.'}
                    </p>
                  </div>
                  
                  <div className="px-4 pb-4">
                    <button 
                      onClick={() => setUsageModalSubBlock(group)}
                      className="w-full py-2 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 text-[11px] font-bold rounded-lg border border-slate-200 hover:border-blue-200 transition-all flex items-center justify-center gap-2"
                    >
                      <Layout size={14} /> Usage Explorer
                    </button>
                  </div>

                  {expandedSubBlockName === group.name && (
                    <div className="border-t border-slate-100 bg-slate-50/50 p-3 space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-2">Recent Appearances</p>
                      {group.occurrences.slice(0, 5).map((occ, idx) => (
                        <div 
                          key={`${occ.projectId}-${idx}`}
                          onClick={() => openWorkspace(occ.projectId, occ.evt, 'IP_Index', occ.parentIp)}
                          className="bg-white p-2 rounded border border-slate-200 text-[10px] cursor-pointer hover:border-blue-400 transition-colors shadow-sm"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-slate-700 truncate mr-2">{occ.projectName}</span>
                            <span className="text-blue-600 font-black shrink-0">{occ.evt}</span>
                          </div>
                          <div className="text-slate-400 truncate">in {occ.parentIp}</div>
                        </div>
                      ))}
                      {group.occurrences.length > 5 && (
                        <p className="text-[10px] text-center text-slate-400 font-bold pt-1">
                          + {group.occurrences.length - 5} more projects
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
