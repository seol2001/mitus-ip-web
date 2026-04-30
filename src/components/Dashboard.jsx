import React, { useState } from 'react';
import { FileUp, Plus, Clock, Settings, Archive, ArchiveRestore, Trash2, AlertTriangle, X } from 'lucide-react';

export default function Dashboard({ projects, currentUser, isDemoMode, isDbConnected, referenceProjectId, handleNewProject, handleLoadProjectClick, openWorkspace, handleToggleArchive, handlePermanentDelete, handleResetReference }) {
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [openSettingsId, setOpenSettingsId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  
  // 영구 삭제 모달 상태
  const [deleteModalProj, setDeleteModalProj] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const filteredProjects = projects.filter(p => showArchived || !p.is_archived);

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6 mt-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 tracking-tight">
            Mitus IP Web Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            진행 중인 모든 프로젝트 현황 및 차수 관리
          </p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={handleLoadProjectClick}
            title="외부 백업 파일(.json)을 시스템으로 가져옵니다."
            className="flex-1 whitespace-nowrap min-w-max flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm border border-slate-200 shadow-sm transition-all"
          >
            <FileUp size={18} /> Import from File
          </button>
          <button
            onClick={handleNewProject}
            className="flex-1 whitespace-nowrap min-w-max flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm"
          >
            <Plus size={18} /> New Project
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4 px-2 bg-slate-50/50 p-3 rounded-xl border border-slate-200/60">
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
        <label 
          className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
          title="로컬 데이터베이스(LocalStorage)에 이미 저장된 프로젝트 중 '보관(Archive)' 처리된 항목들을 표시합니다."
        >
          <input 
            type="checkbox" 
            checked={showArchived} 
            onChange={(e) => setShowArchived(e.target.checked)} 
            className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
          />
          View Archived Projects
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map(proj => {
          const isLockedByOther = proj.is_locked && proj.locked_by !== currentUser;
          const isArchived = proj.is_archived;
          const isReference = proj.id === referenceProjectId;

          return (
          <div
            key={proj.id}
            className={`relative group rounded-2xl shadow-sm border p-6 transition-all ${isArchived ? 'bg-slate-50 border-slate-200 opacity-80' : 'bg-white'} ${isLockedByOther ? 'opacity-70 border-rose-200 cursor-not-allowed' : 'border-slate-200/80 hover:shadow-md hover:border-blue-200'}`}
          >
            {/* 상단 배지 영역 */}
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
              {isReference && (
                <div className="bg-amber-100 border border-amber-400 text-amber-800 text-[11px] font-extrabold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm whitespace-nowrap">
                  <span>⭐</span> Reference
                </div>
              )}
              {proj.is_locked && (
                <div className="bg-rose-100 border border-rose-300 text-rose-800 text-[11px] font-extrabold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm whitespace-nowrap">
                  <span>🔒</span> {proj.locked_by}님이 편집 중
                </div>
              )}
              {isArchived && (
                <div className="bg-slate-200 border border-slate-300 text-slate-700 text-[11px] font-extrabold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm whitespace-nowrap">
                  <Archive size={12}/> Archived
                </div>
              )}
            </div>

            <div className="flex justify-between items-start mb-4 mt-2">
              <div className="flex-1 pr-4">
                <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                  {proj.name}
                </h3>
                <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-1">
                  <Clock size={12} /> {proj.updated} 업데이트됨
                </p>
              </div>
              
              <div className="flex flex-col items-end gap-2 relative">
                <button 
                  onClick={() => setOpenSettingsId(openSettingsId === proj.id ? null : proj.id)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Settings size={18} />
                </button>
                
                {openSettingsId === proj.id && (
                  <div className="absolute top-8 right-0 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-30 py-1 overflow-hidden">
                    {/* 보관 / 해제 — 레퍼런스 프로젝트는 표시 안 함 */}
                    {!isReference && (
                      <button 
                        onClick={() => {
                          setOpenSettingsId(null);
                          handleToggleArchive(proj.id, !isArchived);
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                      >
                        {isArchived ? <><ArchiveRestore size={14}/> 보관 해제</> : <><Archive size={14}/> 프로젝트 보관</>}
                      </button>
                    )}

                    {/* 레퍼런스 복구 버튼 (SM5718 전용) */}
                    {isReference && handleResetReference && (
                      <button
                        onClick={() => {
                          setOpenSettingsId(null);
                          handleResetReference();
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-amber-50 flex items-center gap-2 text-amber-700 border-t border-slate-100"
                      >
                        <span>🔄</span> 초기 시드 데이터로 복구
                      </button>
                    )}

                    {/* 삭제 버튼: 레퍼런스는 비활성화 */}
                    <button 
                      onClick={() => {
                        setOpenSettingsId(null);
                        if (isReference) {
                          alert('⛔ 시스템 레퍼런스 프로젝트는 삭제할 수 없습니다.\n대신 "초기 시드 데이터로 복구" 기능을 사용하세요.');
                          return;
                        }
                        setDeleteModalProj(proj);
                        setDeleteConfirmText('');
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-t border-slate-100 ${
                        isReference
                          ? 'text-slate-300 cursor-not-allowed bg-slate-50'
                          : 'hover:bg-rose-50 text-rose-600'
                      }`}
                    >
                      <Trash2 size={14}/>
                      {isReference ? '영구 삭제 (보호됨)' : '영구 삭제'}
                    </button>
                  </div>
                )}

                <span className="bg-indigo-50 text-indigo-700 font-bold px-3 py-1 rounded-full text-xs font-mono border border-indigo-100">
                  Working: {proj.latest_evt}
                </span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => {
                  if (isLockedByOther && openDropdownId !== proj.id) {
                    alert("현재 다른 사용자가 편집 중입니다. 읽기 전용(관찰자) 모드로 접속 가능합니다.");
                  }
                  setOpenDropdownId(openDropdownId === proj.id ? null : proj.id);
                }}
                className={`w-full relative flex items-center justify-between text-sm font-bold px-4 py-2.5 rounded-xl border ${isLockedByOther ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' : 'text-slate-700 bg-slate-50 hover:bg-slate-100 border-slate-200'}`}
              >
                <span>{isLockedByOther ? '읽기 전용으로 차수 선택' : '작업할 차수(EVT) 선택 접속'}</span>
                <svg
                  className={`w-4 h-4 transition-transform ${openDropdownId === proj.id ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {openDropdownId === proj.id && (
              <div className="absolute left-6 right-6 top-[calc(100%-1.5rem)] mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-2 max-h-48 overflow-y-auto">
                {proj.phases.slice().reverse().map(phase => {
                  const isLatest = (phase === proj.latest_evt);
                  return (
                    <button
                      key={phase}
                      onClick={() => openWorkspace(proj.id, phase)}
                      className="w-full text-left px-4 py-2.5 text-sm font-mono hover:bg-slate-50 flex items-center justify-between"
                    >
                      <span className={`font-bold ${isLatest ? 'text-blue-700' : 'text-slate-600'}`}>{phase}</span>
                      {isLatest && !proj.is_archived ? (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">최신 (Draft)</span>
                      ) : (
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">ReadOnly (Archived)</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          );
        })}

        {filteredProjects.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400">
            <p>표시할 프로젝트가 없습니다. 'New Project'를 클릭하여 시작하세요.</p>
          </div>
        )}
      </div>

      {/* 영구 삭제 확인 모달 */}
      {deleteModalProj && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-rose-50/50">
              <h2 className="text-lg font-extrabold text-rose-700 flex items-center gap-2">
                <AlertTriangle size={20} />
                프로젝트 영구 삭제
              </h2>
              <button 
                onClick={() => setDeleteModalProj(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-800">
                <p className="font-bold mb-1">정말 삭제하시겠습니까?</p>
                <p>삭제를 원하시면 프로젝트 이름 <strong className="font-mono bg-white px-1 py-0.5 rounded border border-rose-200 select-all">{deleteModalProj.id}</strong> 을(를) 아래에 정확히 입력하세요.</p>
                <p className="mt-2 text-rose-600 text-xs">⚠️ 연관된 모든 상세 데이터와 FA 리포트 등이 영구적으로 삭제되며 복구할 수 없습니다.</p>
              </div>
              
              <div>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="프로젝트 이름을 입력하세요"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all font-mono text-sm"
                  autoFocus
                />
              </div>
            </div>
            
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setDeleteModalProj(null)}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                disabled={deleteConfirmText !== deleteModalProj.id}
                onClick={() => {
                  handlePermanentDelete(deleteModalProj.id);
                  setDeleteModalProj(null);
                }}
                className={`px-4 py-2 text-sm font-bold rounded-xl transition-colors flex items-center gap-2
                  ${deleteConfirmText === deleteModalProj.id 
                    ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
              >
                <Trash2 size={16} />
                Confirm Permanent Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
