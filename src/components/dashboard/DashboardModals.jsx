import React from 'react';
import { AlertTriangle, X, Trash2, Settings, Plus, Layout, ExternalLink } from 'lucide-react';

export default function DashboardModals({
  // Delete Modal
  deleteModalProj, setDeleteModalProj,
  deleteConfirmText, setDeleteConfirmText,
  handlePermanentDelete,

  // Unlock Modal
  unlockModalProj, setUnlockModalProj,
  handleForceUnlock,
  getLockStatus, // 헬퍼 함수

  // Edit IP Modal
  editModalIp, setEditModalIp,
  editIpForm, setEditIpForm,
  isEditIpInUse,
  submitEditCustomIp, submitDeleteCustomIp,

  // Add IP Modal
  isAddModalOpen, setIsAddModalOpen,
  addIpForm, setAddIpForm,
  isCategoryLocked,
  submitAddCustomIp,

  // Usage Modal (IP)
  usageModalIp, setUsageModalIp,

  // Usage Modal (SubBlock)
  usageModalSubBlock, setUsageModalSubBlock,

  // Utils
  openWorkspace
}) {
  return (
    <>
      {/* 영구 삭제 확인 모달 */}
      {deleteModalProj && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-rose-50/50">
              <h2 className="text-lg font-extrabold text-rose-700 flex items-center gap-2">
                <AlertTriangle size={20} />
                프로젝트 영구 삭제
              </h2>
              <button onClick={() => setDeleteModalProj(null)} className="text-slate-400 hover:text-slate-600 transition-colors p-1"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-800">
                <p className="font-bold mb-1">정말 삭제하시겠습니까?</p>
                <p>삭제를 원하시면 프로젝트 이름 <strong className="font-mono bg-white px-1 py-0.5 rounded border border-rose-200 select-all">{deleteModalProj.id}</strong> 을(를) 아래에 정확히 입력하세요.</p>
                <p className="mt-2 text-rose-600 text-xs">⚠️ 연관된 모든 상세 데이터와 FA 리포트 등이 영구적으로 삭제되며 복구할 수 없습니다.</p>
              </div>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="프로젝트 이름을 입력하세요"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all font-mono text-sm"
                autoFocus
              />
            </div>
            
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setDeleteModalProj(null)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">취소</button>
              <button
                disabled={deleteConfirmText !== deleteModalProj.id}
                onClick={() => { handlePermanentDelete(deleteModalProj.id); setDeleteModalProj(null); }}
                className={`px-4 py-2 text-sm font-bold rounded-xl transition-colors flex items-center gap-2 ${deleteConfirmText === deleteModalProj.id ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
              >
                <Trash2 size={16} /> Confirm Permanent Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 잠금 강제 해제 확인 모달 */}
      {unlockModalProj && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-amber-50/50">
              <h2 className="text-lg font-extrabold text-amber-700 flex items-center gap-2">
                <AlertTriangle size={20} /> 잠금 강제 해제 (Takeover)
              </h2>
              <button onClick={() => setUnlockModalProj(null)} className="text-slate-400 hover:text-slate-600 transition-colors p-1"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                현재 <strong className="text-slate-900">{unlockModalProj.locked_by}</strong>님이 편집 중입니다.
                {getLockStatus(unlockModalProj).isStale ? (
                  <span className="block mt-2 text-amber-700 font-bold">⚠️ 10분 이상 활동이 없어 정체된 것으로 보입니다. 해제해도 안전할 가능성이 높습니다.</span>
                ) : (
                  <span className="block mt-2 text-rose-600 font-bold">⚠️ 주의: 현재 작업 중일 수 있습니다. 강제로 해제하면 상대방의 수정 내용이 소실될 수 있습니다.</span>
                )}
              </p>
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setUnlockModalProj(null)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">취소</button>
              <button onClick={() => { handleForceUnlock(unlockModalProj.id); setUnlockModalProj(null); }} className="px-4 py-2 text-sm font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm transition-colors">잠금 해제 후 권한 가져오기</button>
            </div>
          </div>
        </div>
      )}

      {/* 커스텀 IP 수정/삭제 모달 */}
      {editModalIp && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className={`flex justify-between items-center p-5 border-b border-slate-100 ${isEditIpInUse ? 'bg-amber-50/50' : 'bg-blue-50/50'}`}>
              <h2 className={`text-lg font-extrabold flex items-center gap-2 ${isEditIpInUse ? 'text-amber-700' : 'text-blue-700'}`}>
                {isEditIpInUse ? <AlertTriangle size={20} /> : <Settings size={20} />} 커스텀 IP 관리
              </h2>
              <button onClick={() => setEditModalIp(null)} className="text-slate-400 hover:text-slate-600 transition-colors p-1"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              {isEditIpInUse && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 text-xs">
                  <p className="font-bold mb-1">사용 중인 IP입니다.</p>
                  이름과 카테고리는 변경할 수 없으며 설명만 수정 가능합니다.
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">카테고리</label>
                <input type="text" value={editIpForm.category} onChange={e => setEditIpForm({...editIpForm, category: e.target.value})} disabled={isEditIpInUse} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl disabled:opacity-60 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">IP 이름</label>
                <input type="text" value={editIpForm.name} onChange={e => setEditIpForm({...editIpForm, name: e.target.value})} disabled={isEditIpInUse} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl disabled:opacity-60 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">상세 설명</label>
                <textarea value={editIpForm.description} onChange={e => setEditIpForm({...editIpForm, description: e.target.value})} rows={3} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-between">
              {!isEditIpInUse ? <button onClick={submitDeleteCustomIp} className="px-4 py-2 text-sm font-bold text-rose-600 bg-white border border-rose-200 rounded-xl hover:bg-rose-50 flex items-center gap-1"><Trash2 size={16} /> 삭제</button> : <div />}
              <div className="flex gap-2">
                <button onClick={() => setEditModalIp(null)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">취소</button>
                <button onClick={submitEditCustomIp} className="px-6 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm">저장</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 새 커스텀 IP 추가 모달 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-indigo-50/50">
              <h2 className="text-lg font-extrabold text-indigo-700 flex items-center gap-2">
                <Plus size={20} /> 새 커스텀 IP 등록
              </h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">카테고리 {isCategoryLocked && '(고정됨)'}</label>
                <input type="text" value={addIpForm.category} onChange={e => setAddIpForm({...addIpForm, category: e.target.value})} disabled={isCategoryLocked} placeholder="예: Analog, Digital, Memory" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl disabled:opacity-60 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">IP 이름</label>
                <input type="text" value={addIpForm.name} onChange={e => setAddIpForm({...addIpForm, name: e.target.value})} placeholder="IP의 고유 이름을 입력하세요" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">상세 설명</label>
                <textarea value={addIpForm.description} onChange={e => setAddIpForm({...addIpForm, description: e.target.value})} rows={3} placeholder="해당 IP의 용도 및 특징을 기술하세요" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">취소</button>
              <button onClick={submitAddCustomIp} className="px-6 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm">등록</button>
            </div>
          </div>
        </div>
      )}

      {/* IP 사용처 모달 */}
      {usageModalIp && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-emerald-50/50">
              <h2 className="text-lg font-extrabold text-emerald-800 flex items-center gap-2">
                <Layout size={20} /> '{usageModalIp.name}' 사용처 분석
              </h2>
              <button onClick={() => setUsageModalIp(null)} className="text-slate-400 hover:text-slate-600 transition-colors p-1"><X size={20} /></button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
              <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">이 IP를 포함하고 있는 프로젝트 ({usageModalIp.projects.length})</p>
              {usageModalIp.projects.map(proj => (
                <div key={proj.id} className="group p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-emerald-400 hover:bg-white transition-all">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-extrabold text-slate-800">{proj.name}</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Project ID: {proj.id} | Latest: {proj.latest_evt}</p>
                    </div>
                    <button onClick={() => { openWorkspace(proj.id, proj.latest_evt, 'IP_Index', usageModalIp.name); setUsageModalIp(null); }} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200 flex items-center gap-1.5 transition-all">
                      <ExternalLink size={12} /> 이동하기
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 text-right"><button onClick={() => setUsageModalIp(null)} className="px-6 py-2 text-sm font-bold bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50">닫기</button></div>
          </div>
        </div>
      )}

      {/* Sub-Block 사용처 모달 */}
      {usageModalSubBlock && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-blue-50/50">
              <h2 className="text-lg font-extrabold text-blue-800 flex items-center gap-2">
                <Layout size={20} /> '{usageModalSubBlock.name}' Block 탐색
              </h2>
              <button onClick={() => setUsageModalSubBlock(null)} className="text-slate-400 hover:text-slate-600 transition-colors p-1"><X size={20} /></button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Key Features</p>
                <p className="text-sm font-medium text-blue-900 leading-relaxed">{usageModalSubBlock.latestFeatures || '정보 없음'}</p>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">사용된 IP 블록 리스트 ({usageModalSubBlock.occurrences.length})</p>
                {usageModalSubBlock.occurrences.map((occ, idx) => (
                  <div key={`${occ.projectId}-${idx}`} className="p-3 bg-white border border-slate-200 rounded-xl flex justify-between items-center hover:border-blue-300 transition-all shadow-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm">{occ.parentIp}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border">{occ.evt}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">{occ.projectName}</p>
                    </div>
                    <button onClick={() => { openWorkspace(occ.projectId, occ.evt, 'IP_Index', occ.parentIp); setUsageModalSubBlock(null); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><ExternalLink size={16} /></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 text-right"><button onClick={() => setUsageModalSubBlock(null)} className="px-6 py-2 text-sm font-bold bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50">닫기</button></div>
          </div>
        </div>
      )}
    </>
  );
}
