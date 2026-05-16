import React from 'react';
import { Clock, Settings, Download, Edit3, Copy, Archive, ArchiveRestore, Trash2, History, ChevronDown, Unlock as UnlockIcon } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';

const ProjectCard = React.memo(({
  project,
  referenceProjectId,
  openSettingsId,
  setOpenSettingsId,
  openDropdownId,
  setOpenDropdownId,
  onExport,
  onManage,
  onToggleArchive,
  onResetReference,
  onDelete,
  onUnlock,
  onOpenWorkspace,
  showConfirm
}) => {
  const { currentUser } = useAuth();
  const isLockedByOther = project.is_locked && project.locked_by !== currentUser;
  const isArchived = project.is_archived;
  const isReference = project.id === referenceProjectId;

  // 헬퍼 함수: 날짜 포맷팅
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

  // [Bug #5 Fix] 잠금 정보 메모이제이션 및 시각적 노이즈 제거
  const lockInfo = React.useMemo(() => {
    if (!project.is_locked || !project.locked_at) return { show: false, isStale: false };
    
    const lockTime = new Date(project.locked_at).getTime();
    const diffMins = Math.floor((Date.now() - lockTime) / (1000 * 60));
    const isStale = diffMins >= 10;
    
    // 본인이 점유한 경우 대시보드에서는 배너를 숨김 (사용자 요청: 논리적 명확성 확보)
    const show = (project.locked_by !== currentUser);
    
    return {
      show,
      isStale,
      minutes: diffMins,
      // 문구 개선: "마지막 활동" 명시 및 권한 회수 안내
      text: isStale 
        ? `${project.locked_by}님 활동 없음 (마지막 활동 ${diffMins}분 전) - 권한 회수 가능`
        : `${project.locked_by}님 편집 중 (마지막 활동 ${diffMins}분 전)`
    };
  }, [project.is_locked, project.locked_at, project.locked_by, currentUser]);

  return (
    <div
      className={`relative group rounded-xl shadow-sm border p-4 transition-all ${isArchived ? 'bg-slate-50 border-slate-200 opacity-80' : 'bg-white'} ${isLockedByOther ? 'opacity-70 border-rose-200 cursor-not-allowed' : 'border-slate-200/80 hover:shadow-md hover:border-blue-200'}`}
    >
      {/* 상단 배지 영역 */}
      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
        {isReference && (
          <div className="bg-amber-100 border border-amber-400 text-amber-800 text-[11px] font-extrabold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm whitespace-nowrap">
            <span>⭐</span> Reference
          </div>
        )}
        {lockInfo.show && (
          <div className={`border text-[11px] font-extrabold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm whitespace-nowrap ${lockInfo.isStale ? 'bg-amber-100 border-amber-400 text-amber-800' : 'bg-rose-100 border-rose-300 text-rose-800'}`}>
            <span>{lockInfo.isStale ? '⚠️' : '🔒'}</span> 
            {lockInfo.text}
          </div>
        )}
        {isArchived && (
          <div className="bg-slate-200 border border-slate-300 text-slate-700 text-[11px] font-extrabold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm whitespace-nowrap">
            <Archive size={12}/> Archived
          </div>
        )}
      </div>

      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-slate-800 truncate">
              {project.name}
            </h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${isArchived ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
              {isArchived ? 'Archived' : 'Active'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis" title={`${formatDate(project.updated)} 업데이트됨`}>
            <Clock size={10} className="shrink-0" /> {formatDate(project.updated)}
          </p>
        </div>
        
        <div className="flex flex-col items-end gap-2 relative">
          <button 
            onClick={() => setOpenSettingsId(openSettingsId === project.id ? null : project.id)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors dropdown-trigger"
          >
            <Settings size={18} />
          </button>
          
          {openSettingsId === project.id && (
            <div className="absolute top-8 right-0 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-30 py-1 overflow-hidden dropdown-menu">
              <button 
                onClick={() => {
                  setOpenSettingsId(null);
                  onExport(project.id);
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-slate-50 flex items-center gap-2 text-slate-700"
              >
                <Download size={14} className="text-blue-500" /> Export Data (.json)
              </button>

              <div className="h-[1px] bg-slate-100 mx-2 my-1" />

              <button 
                onClick={() => {
                  setOpenSettingsId(null);
                  if (project.is_locked) {
                    showConfirm({
                      title: "이름 변경 불가",
                      message: "현재 작업 중인(열려있는) 프로젝트의 이름은 변경할 수 없습니다. 먼저 프로젝트를 닫아주세요.",
                      type: "warning",
                      showCancel: false
                    });
                    return;
                  }
                  onManage('rename', project);
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-slate-50 flex items-center gap-2 text-slate-700"
              >
                <Edit3 size={14} className="text-amber-500" /> Rename Identity
              </button>

              <button 
                onClick={() => {
                  setOpenSettingsId(null);
                  onManage('copy', project);
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-slate-50 flex items-center gap-2 text-slate-700"
              >
                <Copy size={14} className="text-indigo-500" /> Duplicate Project (Clone)
              </button>

              {!isReference && (
                <button 
                  onClick={() => {
                    setOpenSettingsId(null);
                    onToggleArchive(project.id, !isArchived);
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                >
                  {isArchived ? <><ArchiveRestore size={14}/> 보관 해제</> : <><Archive size={14}/> 프로젝트 보관</>}
                </button>
              )}

              {isReference && onResetReference && (
                <button
                  onClick={() => {
                    setOpenSettingsId(null);
                    onResetReference();
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-amber-50 flex items-center gap-2 text-amber-700 border-t border-slate-100"
                >
                  <span>🔄</span> 초기 시드 데이터로 복구
                </button>
              )}

              <button 
                onClick={() => {
                  setOpenSettingsId(null);
                  if (project.is_locked) {
                    showConfirm({
                      title: "삭제 불가",
                      message: "현재 작업 중인(열려있는) 프로젝트는 삭제할 수 없습니다. 먼저 프로젝트를 닫아주세요.",
                      type: "warning",
                      showCancel: false
                    });
                    return;
                  }
                  if (isReference) {
                    showConfirm({
                      title: "삭제 불가",
                      message: '시스템 레퍼런스 프로젝트는 삭제할 수 없습니다.\n대신 "초기 시드 데이터로 복구" 기능을 사용하세요.',
                      type: "warning",
                      showCancel: false
                    });
                    return;
                  }
                  onDelete(project);
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

              {project.is_locked && (
                <button 
                  onClick={() => {
                    setOpenSettingsId(null);
                    onUnlock(project);
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-amber-50 flex items-center gap-2 text-amber-600 border-t border-slate-100"
                >
                  <UnlockIcon size={14}/> {lockInfo.isStale ? '정체된 잠금 강제 해제' : '편집 잠금 강제 해제'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-50">
        {/* 주요 액션 버튼 영역 */}
        <div className="flex flex-col gap-2">
          {isLockedByOther ? (
            // [UX 하드닝] 타인이 점유 중일 때: 목록에서 권한을 탈취하는 대신 '접속 시도'로 유도 (진입 시 모달에서 결정)
            <div className="flex flex-col gap-2">
              <button
                onClick={() => onOpenWorkspace(project.id, project.latest_evt, 'Project_Overview', null, 'edit')}
                className="w-full flex items-center justify-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition-all shadow-sm active:scale-95"
              >
                <Clock size={16} /> {project.latest_evt} 접속 시도 (잠김)
              </button>
            </div>
          ) : (
            // 2. 점유 중이지 않을 때: 바로 최신 차수 편집 진입
            <div className="flex gap-2">
              <button
                onClick={() => onOpenWorkspace(project.id, project.latest_evt, 'Project_Overview', null, isArchived ? 'readonly' : 'edit')}
                className={`flex-1 flex items-center justify-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl transition-all ${isArchived ? 'bg-slate-50 text-slate-500 border border-slate-100' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-100 shadow-sm active:scale-95'}`}
              >
                {isArchived ? <Clock size={16} /> : <UnlockIcon size={16} />}
                {project.latest_evt} {isArchived ? '관찰' : '편집'} 접속
              </button>
              
              {/* 과거 차수 선택 (드롭다운) */}
              <button
                onClick={() => setOpenDropdownId(openDropdownId === project.id ? null : project.id)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 transition-all flex items-center gap-1 dropdown-trigger"
                title="다른 차수(History) 선택"
              >
                <History size={18} />
                <ChevronDown size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {openDropdownId === project.id && (
        <div className="absolute left-6 right-6 top-[calc(100%-1.5rem)] mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-2 max-h-48 overflow-y-auto dropdown-menu">
          {project.phases.slice().reverse().map(phase => {
            const isLatest = (phase === project.latest_evt);
            return (
              <button
                key={phase}
                onClick={() => onOpenWorkspace(project.id, phase, 'Project_Overview', null, 'readonly')}
                className="w-full text-left px-4 py-2.5 text-sm font-mono hover:bg-slate-50 flex items-center justify-between"
              >
                <span className={`font-bold ${isLatest ? 'text-blue-700' : 'text-slate-600'}`}>{phase}</span>
                {isLatest && !project.is_archived ? (
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
});

export default ProjectCard;
