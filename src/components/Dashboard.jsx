import React, { useState, useRef } from 'react';
import { FileUp, Plus, Clock, Settings, Archive, ArchiveRestore, Trash2, AlertTriangle, X, Unlock as UnlockIcon, History, ChevronDown, Search, Layout, Download, Edit3, Copy } from 'lucide-react';
import { useConfirm } from '../contexts/ConfirmContext';

export default function Dashboard({ projects, currentUser, isDemoMode, isDbConnected, referenceProjectId, handleNewProject, handleLoadProjectClick, openWorkspace, handleToggleArchive, handlePermanentDelete, handleResetReference, handleForceUnlock, globalIpDictionary, customIpDictionary, customIpDetails, handleEditCustomIp, handleDeleteCustomIp, handleAddCustomIp, handleExportProject, onManageProject }) {
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [openSettingsId, setOpenSettingsId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const showConfirm = useConfirm();
  const fileInputRef = useRef(null);

  const [isIpDictOpen, setIsIpDictOpen] = useState(false);
  const [isSubBlockOpen, setIsSubBlockOpen] = useState(false);
  
  // Usage Modal States
  const [usageModalIp, setUsageModalIp] = useState(null); 
  const [usageModalSubBlock, setUsageModalSubBlock] = useState(null); // { name: 'Gate_Driver', occurrences: [...] }
  
  // Custom IP Edit Modal State
  const [editModalIp, setEditModalIp] = useState(null);
  const [editIpForm, setEditIpForm] = useState({ category: '', name: '', description: '' });
  const [isEditIpInUse, setIsEditIpInUse] = useState(false);

  // Custom IP Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addIpForm, setAddIpForm] = useState({ category: '', name: '', description: '' });
  const [isCategoryLocked, setIsCategoryLocked] = useState(false);

  const openAddModal = (category = '') => {
    setAddIpForm({ category, name: '', description: '' });
    setIsCategoryLocked(!!category);
    setIsAddModalOpen(true);
  };

  const submitAddCustomIp = async () => {
    if (!addIpForm.category || !addIpForm.name || !addIpForm.description) {
      alert('필수 입력값을 확인해주세요.');
      return;
    }
    const success = await handleAddCustomIp(addIpForm.category, addIpForm.name, addIpForm.description);
    if (success) setIsAddModalOpen(false);
  };

  const checkIfIpInUse = (ipName) => {
    return projects.some(p => {
      const blocks = p.project_data?.projectOverview?.IP_Blocks || [];
      return blocks.includes(ipName);
    });
  };

  const openEditModal = (customDetail) => {
    const inUse = checkIfIpInUse(customDetail.name);
    setIsEditIpInUse(inUse);
    setEditIpForm({ category: customDetail.category, name: customDetail.name, description: customDetail.description });
    setEditModalIp(customDetail);
  };

  const submitEditCustomIp = async () => {
    if (!editIpForm.category || !editIpForm.name || !editIpForm.description) {
      alert('필수 입력값을 확인해주세요.');
      return;
    }
    const success = await handleEditCustomIp(editModalIp.id, editIpForm);
    if (success) setEditModalIp(null);
  };

  const submitDeleteCustomIp = async () => {
    if (isEditIpInUse) return;
    const confirmed = await showConfirm({
      title: "커스텀 IP 삭제",
      message: `'${editModalIp.name}' 항목을 영구적으로 삭제하시겠습니까?`,
      type: "danger",
      confirmText: "삭제"
    });
    if (confirmed) {
      const success = await handleDeleteCustomIp(editModalIp.id);
      if (success) setEditModalIp(null);
    }
  };

  // 날짜 포맷팅 (KST 기준, 분까지만 표시)
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Seoul'
      }).format(date).replace(/\. /g, '-').replace(/\.$/, '');
    } catch (e) {
      return dateStr;
    }
  };
  
  // 영구 삭제 모달 상태
  const [deleteModalProj, setDeleteModalProj] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // 잠금 강제 해제 모달 상태
  const [unlockModalProj, setUnlockModalProj] = useState(null);

  const filteredProjects = projects.filter(p => showArchived || !p.is_archived);

  // 잠금 상태 분석 헬퍼
  // --- Sub-Block Catalog 추출 로직 ---
  const [subBlockSearch, setSubBlockSearch] = useState('');
  const allSubBlocks = projects.flatMap(p => {
    // p.project_data가 있는 경우에만 처리 (리스트 조회 시에는 없을 수 있음)
    if (!p.project_data) return [];
    
    // 최신 차수의 데이터 가져오기
    const latestEvt = p.latest_evt;
    const revisionData = p.project_data.revisions?.[latestEvt] || p.project_data;
    const ipIndex = revisionData.ipIndex || {};

    return Object.entries(ipIndex).flatMap(([ipName, ipData]) => {
      const subBlocks = ipData.Sub_Blocks || [];
      return subBlocks.map(sb => ({
        ...sb,
        parentIp: ipName,
        projectId: p.id,
        projectName: p.name,
        evt: latestEvt
      }));
    });
  });

  const filteredSubBlocks = allSubBlocks.filter(sb => 
    sb.name.toLowerCase().includes(subBlockSearch.toLowerCase()) ||
    sb.parentIp.toLowerCase().includes(subBlockSearch.toLowerCase()) ||
    sb.keyFeatures?.toLowerCase().includes(subBlockSearch.toLowerCase()) ||
    sb.motherIpName?.toLowerCase().includes(subBlockSearch.toLowerCase())
  );

  // 이름별 그룹화 로직
  const groupedSubBlocks = filteredSubBlocks.reduce((acc, sb) => {
    if (!acc[sb.name]) {
      acc[sb.name] = {
        name: sb.name,
        occurrences: [],
        latestFeatures: sb.keyFeatures // 가장 최근 데이터 기준 특징 (필요시 정렬 로직 추가 가능)
      };
    }
    acc[sb.name].occurrences.push(sb);
    return acc;
  }, {});

  const sortedSubBlockGroups = Object.values(groupedSubBlocks).sort((a, b) => a.name.localeCompare(b.name));

  const [expandedSubBlockName, setExpandedSubBlockName] = useState(null);

  const getIpUsage = (ipName) => {
    return projects.filter(p => {
      const latestEvt = p.latest_evt;
      const revisionData = p.project_data?.revisions?.[latestEvt] || p.project_data || {};
      const ipBlocks = revisionData.projectOverview?.IP_Blocks || [];
      return ipBlocks.includes(ipName);
    });
  };

  const getLockStatus = (proj) => {
    if (!proj.is_locked || !proj.locked_at) return { isStale: false, minutes: 0 };
    const lockTime = new Date(proj.locked_at).getTime();
    const diffMins = Math.floor((Date.now() - lockTime) / (1000 * 60));
    return {
      isStale: diffMins >= 10, // 10분 이상이면 정체(Stale)로 간주
      minutes: diffMins
    };
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6 mt-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 tracking-tight">
            Mitus IP Web Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            모든 프로젝트 현황 및 차수 관리
          </p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => {
              const file = e.target.files[0];
              if (file) handleLoadProjectClick(file);
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
            onClick={handleNewProject}
            className="flex-1 whitespace-nowrap min-w-max flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-5 py-2.5 rounded-xl font-bold text-sm border border-indigo-100 shadow-sm transition-all"
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
          title="시스템 데이터베이스에 저장된 프로젝트 중 '보관(Archive)' 처리된 항목들을 표시합니다."
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
                <div className={`border text-[11px] font-extrabold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm whitespace-nowrap ${getLockStatus(proj).isStale ? 'bg-amber-100 border-amber-400 text-amber-800' : 'bg-rose-100 border-rose-300 text-rose-800'}`}>
                  <span>{getLockStatus(proj).isStale ? '⚠️' : '🔒'}</span> 
                  {proj.locked_by}님이 편집 중 ({getLockStatus(proj).minutes}분 전)
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
                <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-1 whitespace-nowrap overflow-hidden text-ellipsis" title={`${formatDate(proj.updated)} 업데이트됨`}>
                  <Clock size={12} className="shrink-0" /> {formatDate(proj.updated)} 업데이트됨
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
                    <button 
                      onClick={() => {
                        setOpenSettingsId(null);
                        handleExportProject(proj.id);
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                    >
                      <Download size={14} className="text-blue-500" /> Export Data (.json)
                    </button>

                    <div className="h-[1px] bg-slate-100 mx-2 my-1" />

                    <button 
                      onClick={() => {
                        setOpenSettingsId(null);
                        onManageProject('rename', proj);
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                    >
                      <Edit3 size={14} className="text-amber-500" /> Rename Identity
                    </button>

                    <button 
                      onClick={() => {
                        setOpenSettingsId(null);
                        onManageProject('copy', proj);
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                    >
                      <Copy size={14} className="text-indigo-500" /> Duplicate Project (Clone)
                    </button>

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

                    <button 
                      onClick={() => {
                        setOpenSettingsId(null);
                        if (isReference) {
                          showConfirm({
                            title: "삭제 불가",
                            message: '시스템 레퍼런스 프로젝트는 삭제할 수 없습니다.\n대신 "초기 시드 데이터로 복구" 기능을 사용하세요.',
                            type: "warning",
                            showCancel: false
                          });
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

                    {proj.is_locked && (
                      <button 
                        onClick={() => {
                          setOpenSettingsId(null);
                          setUnlockModalProj(proj);
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-amber-50 flex items-center gap-2 text-amber-600 border-t border-slate-100"
                      >
                        <UnlockIcon size={14}/> {getLockStatus(proj).isStale ? '정체된 잠금 강제 해제' : '편집 잠금 강제 해제'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 space-y-4">
              {/* 차수 정보 및 상태 배지 */}
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Status</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${isArchived ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-green-50 text-green-700 border-green-200 animate-pulse'}`}>
                  {isArchived ? 'Project Archived' : 'Active (Draft)'}
                </span>
              </div>

              {/* 주요 액션 버튼 영역 */}
              <div className="flex flex-col gap-2">
                {isLockedByOther ? (
                  // 1. 타인이 점유 중일 때: 읽기 전용 진입 + 권한 가져오기(Takeover)
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => openWorkspace(proj.id, proj.latest_evt)}
                      className="w-full flex items-center justify-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-all"
                    >
                      <Clock size={16} /> {proj.latest_evt} 읽기 전용 접속
                    </button>
                    <button
                      onClick={() => setUnlockModalProj(proj)}
                      className="w-full flex items-center justify-center gap-2 text-[11px] font-extrabold px-4 py-2 text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-xl transition-all shadow-sm"
                    >
                      <UnlockIcon size={14} /> 편집 권한 가져오기 (Takeover)
                    </button>
                  </div>
                ) : (
                  // 2. 점유 중이지 않을 때: 바로 최신 차수 편집 진입
                  <div className="flex gap-2">
                    <button
                      onClick={() => openWorkspace(proj.id, proj.latest_evt)}
                      className={`flex-1 flex items-center justify-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl transition-all ${isArchived ? 'bg-slate-50 text-slate-500 border border-slate-100' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-100 shadow-sm active:scale-95'}`}
                    >
                      {isArchived ? <Clock size={16} /> : <UnlockIcon size={16} />}
                      {proj.latest_evt} {isArchived ? '관찰' : '편집'} 접속
                    </button>
                    
                    {/* 과거 차수 선택 (드롭다운) */}
                    <button
                      onClick={() => setOpenDropdownId(openDropdownId === proj.id ? null : proj.id)}
                      className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 transition-all flex items-center gap-1"
                      title="다른 차수(History) 선택"
                    >
                      <History size={18} />
                      <ChevronDown size={14} />
                    </button>
                  </div>
                )}
              </div>
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


      {/* ── Global IP Dictionary 영역 ── */}
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

      {/* ── Sub-Block Reference Catalog (BOM Explorer) ── */}
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
          </div>
        </div>

        {isSubBlockOpen && (
          <div className="p-8 border-t border-slate-100 animate-in fade-in duration-300">
            {/* Search Bar */}
            <div className="mb-8 flex justify-end">
              <div className="relative">
                <input 
                  type="text" 
                  value={subBlockSearch}
                  onChange={(e) => setSubBlockSearch(e.target.value)}
                  placeholder="서브 블록명, 특징 검색..."
                  className="w-full md:w-64 pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-sm"
                />
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
              </div>
            </div>

            {/* Tags Grid */}
            <div className="flex flex-wrap gap-3">
              {sortedSubBlockGroups.length > 0 ? sortedSubBlockGroups.map((group) => (
                <div key={group.name} className="relative group">
                  <button 
                    onClick={() => setUsageModalSubBlock(group)}
                    className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95 flex items-center gap-2"
                  >
                    🧩 {group.name}
                    {group.occurrences.length > 0 && (
                      <span className="absolute top-1 right-1.5 text-emerald-600 text-[10px] font-black">
                        {group.occurrences.length}
                      </span>
                    )}
                  </button>
                  {/* Tooltip for features */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-56 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl z-20 pointer-events-none">
                    <p className="font-bold text-blue-300 mb-1">{group.name}</p>
                    <p className="text-slate-300 leading-relaxed italic">{group.latestFeatures || 'No description available'}</p>
                    <p className="mt-2 text-[10px] text-slate-400 border-t border-slate-700 pt-2">Click to see {group.occurrences.length} locations</p>
                  </div>
                </div>
              )) : (
                <div className="w-full py-12 text-center text-slate-400 text-sm">
                  {subBlockSearch ? '검색 결과와 일치하는 서브 블록이 없습니다.' : '등록된 서브 블록 정보가 없습니다.'}
                </div>
              )}
            </div>
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
      {/* 잠금 강제 해제 확인 모달 */}
      {unlockModalProj && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-amber-50/50">
              <h2 className="text-lg font-extrabold text-amber-700 flex items-center gap-2">
                <AlertTriangle size={20} />
                잠금 강제 해제 (Takeover)
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
              <button 
                onClick={() => {
                  handleForceUnlock(unlockModalProj.id);
                  setUnlockModalProj(null);
                }}
                className="px-4 py-2 text-sm font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm transition-colors"
              >
                잠금 해제 후 권한 가져오기
              </button>
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
                {isEditIpInUse ? <AlertTriangle size={20} /> : <Settings size={20} />}
                커스텀 IP 관리
              </h2>
              <button onClick={() => setEditModalIp(null)} className="text-slate-400 hover:text-slate-600 transition-colors p-1"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-4">
              {isEditIpInUse ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                  <p className="font-bold mb-1">사용 중인 IP입니다.</p>
                  <p className="text-xs">이 IP는 이미 한 개 이상의 프로젝트에 등록되어 있습니다. 데이터 파편화를 방지하기 위해 <strong>이름과 카테고리는 변경할 수 없으며 삭제도 불가능</strong>합니다. 설명(Description)만 수정 가능합니다.</p>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
                  <p className="font-bold mb-1">미사용 IP입니다.</p>
                  <p className="text-xs">아직 어떠한 프로젝트에서도 사용되지 않았습니다. 이름, 카테고리 변경 및 삭제가 자유롭게 가능합니다.</p>
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">카테고리</label>
                <input type="text" value={editIpForm.category} onChange={e => setEditIpForm({...editIpForm, category: e.target.value})} disabled={isEditIpInUse} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:border-blue-400 disabled:opacity-60 disabled:cursor-not-allowed font-medium text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">IP 이름</label>
                <input type="text" value={editIpForm.name} onChange={e => setEditIpForm({...editIpForm, name: e.target.value})} disabled={isEditIpInUse} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:border-blue-400 disabled:opacity-60 disabled:cursor-not-allowed font-medium text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">상세 설명</label>
                <textarea value={editIpForm.description} onChange={e => setEditIpForm({...editIpForm, description: e.target.value})} rows={3} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:border-blue-400 font-medium text-sm" />
              </div>
              <p className="text-[10px] text-slate-400 text-right">Created by: {editModalIp.created_by}</p>
            </div>
            
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                {!isEditIpInUse && (
                  <button onClick={submitDeleteCustomIp} className="px-4 py-2 text-sm font-bold text-rose-600 bg-white border border-rose-200 rounded-xl hover:bg-rose-50 hover:border-rose-300 transition-colors flex items-center gap-1">
                    <Trash2 size={16} /> 영구 삭제
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditModalIp(null)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">취소</button>
                <button onClick={submitEditCustomIp} className="px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-colors">변경사항 저장</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 커스텀 IP 추가 모달 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-blue-50/50">
              <h2 className="text-lg font-extrabold flex items-center gap-2 text-blue-700">
                <Plus size={20} />
                {isCategoryLocked ? '새 IP 직접 입력 (Custom)' : '새 카테고리 및 IP 생성'}
              </h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
                <p className="font-bold mb-1">커스텀 IP 등록</p>
                <p className="text-xs">
                  {isCategoryLocked 
                    ? `'${addIpForm.category}' 카테고리에 새로운 IP를 등록합니다.` 
                    : '새로운 카테고리 이름을 입력하면 시스템에 해당 카테고리가 자동으로 생성됩니다.'}
                </p>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">카테고리 (Category)</label>
                <input 
                  type="text" 
                  value={addIpForm.category} 
                  onChange={e => setAddIpForm({...addIpForm, category: e.target.value})} 
                  disabled={isCategoryLocked} 
                  placeholder="예: Power_Regulation, Custom_Block..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:border-blue-400 disabled:opacity-60 disabled:cursor-not-allowed font-medium text-sm" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">IP 이름 (Name)</label>
                <input 
                  type="text" 
                  value={addIpForm.name} 
                  onChange={e => setAddIpForm({...addIpForm, name: e.target.value})} 
                  placeholder="예: LDO_1V8_CUSTOM"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:border-blue-400 font-medium text-sm" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">상세 설명 (Description)</label>
                <textarea 
                  value={addIpForm.description} 
                  onChange={e => setAddIpForm({...addIpForm, description: e.target.value})} 
                  rows={3} 
                  placeholder="이 IP의 특징, 버전, 호환 공정 등을 간략히 기재하세요."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:border-blue-400 font-medium text-sm" 
                />
              </div>
            </div>
            
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">취소</button>
              <button onClick={submitAddCustomIp} className="px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-colors flex items-center gap-1">
                <Plus size={16} /> 추가하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IP Usage 상세 모달 */}
      {usageModalIp && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-blue-50/50">
              <h2 className="text-lg font-extrabold flex items-center gap-2 text-blue-700">
                <Archive size={20} />
                '{usageModalIp.name}' IP Usage History
              </h2>
              <button onClick={() => setUsageModalIp(null)} className="text-slate-400 hover:text-slate-600 transition-colors p-1"><X size={20} /></button>
            </div>
            
            <div className="p-0 max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Project Name</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Latest Rev</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Updated</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usageModalIp.projects.map(proj => (
                    <tr key={proj.id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-slate-800">{proj.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{proj.id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100">
                          {proj.latest_evt}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {formatDate(proj.updated)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => {
                            setUsageModalIp(null);
                            openWorkspace(proj.id, proj.latest_evt);
                          }}
                          className="text-blue-600 hover:underline text-xs font-bold"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
              <p className="text-[10px] text-slate-400 font-medium italic">
                해당 IP가 공식적으로 등록된 프로젝트 리스트입니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Block Usage 상세 모달 */}
      {usageModalSubBlock && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-indigo-50/50">
              <h2 className="text-lg font-extrabold flex items-center gap-2 text-indigo-700">
                <Layout size={20} />
                '{usageModalSubBlock.name}' Sub-Block Usage History
              </h2>
              <button onClick={() => setUsageModalSubBlock(null)} className="text-slate-400 hover:text-slate-600 transition-colors p-1"><X size={20} /></button>
            </div>
            
            <div className="p-0 max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Project / Rev</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Parent IP</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mother IP / Block</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mod Level</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usageModalSubBlock.occurrences.map((sb, idx) => (
                    <tr key={`${sb.projectId}-${idx}`} className="hover:bg-indigo-50/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-slate-800">{sb.projectName}</div>
                        <div className="text-[10px] text-indigo-600 font-bold">{sb.evt}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100">
                          {sb.parentIp}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-semibold text-slate-600">{sb.motherIpName || '-'}</div>
                        <div className="text-[10px] text-slate-400">{sb.motherProject}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          sb.modificationLevel === 'New' ? 'bg-green-50 text-green-700 border-green-100' :
                          sb.modificationLevel === 'Major' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                          'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {sb.modificationLevel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => {
                            setUsageModalSubBlock(null);
                            openWorkspace(sb.projectId, sb.evt);
                          }}
                          className="text-blue-600 hover:underline text-xs font-bold"
                        >
                          Go to IP
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <p className="text-[10px] text-slate-400 font-medium italic">
                해당 서브 블록이 포함된 모든 프로젝트 리스트입니다.
              </p>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                Total {usageModalSubBlock.occurrences.length} Locations
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
