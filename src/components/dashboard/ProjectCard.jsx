import React from 'react';
import { Clock, Settings, Download, Edit3, Copy, Archive, ArchiveRestore, Trash2, History, ChevronDown, Unlock as UnlockIcon, Cpu, AlertCircle, Link2 } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { getIssueStatus } from '../../logic/revisionLogLogic';

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
      // 대폭 축소한 영문 문구로 카드 너비 내에 완벽히 맞춤
      text: isStale 
        ? `Stale: ${project.locked_by} (${diffMins}m)`
        : `Locked: ${project.locked_by} (${diffMins}m)`,
      // 호버 시 노출되는 디테일한 다국어 툴팁
      tooltip: isStale
        ? `${project.locked_by}님 활동 없음 (${diffMins}분 경과) - 클릭 시 편집 잠금을 강제 해제할 수 있습니다.`
        : `${project.locked_by}님이 편집 중입니다 (마지막 활동 ${diffMins}분 전).`
    };
  }, [project.is_locked, project.locked_at, project.locked_by, currentUser]);

  // 대시보드 카드용 핵심 엔지니어링 메트릭 동적 계산
  const metrics = React.useMemo(() => {
    const latestEvt = project.latest_evt;
    const revisionData = project.project_data?.revisions?.[latestEvt] || project.project_data || {};
    
    // 1. 총 IP 수 계산 (선언된 IP_Blocks를 우선시하고, 없을 경우 ipIndex 키 개수로 대체)
    const ipBlocks = (revisionData.projectOverview?.IP_Blocks && revisionData.projectOverview.IP_Blocks.length > 0)
      ? revisionData.projectOverview.IP_Blocks
      : (revisionData.ipIndex ? Object.keys(revisionData.ipIndex) : []);
    const ipCount = ipBlocks.length;
    
    // 2. 최신 이슈 상태 맵 도출 (historyBlocks와 issues를 모두 누적 및 최신 갱신하여 덮어씀)
    const issues = revisionData.revisionLog?.issues || [];
    const historyBlocks = revisionData.revisionLog?.historyBlocks || [];
    const projectName = revisionData.projectOverview?.Project_Name || project.name || 'Proj';
    
    const latestIssueStates = {};
    const allHistoricalIssues = [...historyBlocks].flatMap(b => b.issues || []);
    
    [...allHistoricalIssues, ...issues].forEach(item => {
      if (!item) return;
      const isNewLike = item.entryMode === 'new' || item.entryMode === 'fa';
      const id = isNewLike 
        ? `${item.ipBlock}.${projectName}.${item.issueNum}` 
        : item?.targetIssue;
      if (id) latestIssueStates[id] = item;
    });

    // 3. 이슈 개수 계산 (getIssueStatus를 이용한 정교한 판정)
    // - totalIssues: latestIssueStates의 전체 고유 이슈 개수
    // - openIssues: getIssueStatus(item) === 'OPEN'인 미해결 기술 부채 개수
    let totalIssues = 0;
    let openIssues = 0;
    
    const ipOpenIssuesMap = {};
    ipBlocks.forEach(ip => {
      ipOpenIssuesMap[ip] = 0;
    });
    
    Object.values(latestIssueStates).forEach(item => {
      totalIssues++;
      
      const status = getIssueStatus(item);
      const isOpen = status === 'OPEN';
      
      if (isOpen) {
        openIssues++;
        
        const isNewLike = item.entryMode === 'new' || item.entryMode === 'fa';
        let ipName = isNewLike 
          ? item.ipBlock 
          : (item.targetIssue ? item.targetIssue.split('.')[0] : '');
          
        if (ipName) {
          const matchedIp = ipBlocks.find(ip => ip.toLowerCase() === ipName.toLowerCase());
          if (matchedIp) {
            ipOpenIssuesMap[matchedIp] += 1;
          }
        }
      }
    });
    
    // 4. 연동된 FA 리포트 수 계산
    const faCount = revisionData.faReport?.faReports?.length || 0;
    
    return {
      ipBlocks,
      ipCount,
      totalIssues,
      openIssues,
      ipOpenIssuesMap,
      faCount
    };
  }, [project.latest_evt, project.project_data, project.name]);

  return (
    <div
      className={`relative group rounded-xl shadow-sm border p-4 transition-all h-full flex flex-col ${isArchived ? 'bg-slate-50 border-slate-200 opacity-80' : 'bg-white'} ${isLockedByOther ? 'opacity-70 border-rose-200 cursor-not-allowed' : 'border-slate-200/80 hover:shadow-md hover:border-blue-200'}`}
    >
      {/* 상단 배지 영역 */}
      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
        {lockInfo.show && (
          <div 
            className={`border text-[11px] font-extrabold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm whitespace-nowrap ${lockInfo.isStale ? 'bg-amber-100 border-amber-400 text-amber-800' : 'bg-rose-100 border-rose-300 text-rose-800'}`}
            title={lockInfo.tooltip}
          >
            <span>{lockInfo.isStale ? '⚠️' : '🔒'}</span> 
            {lockInfo.text}
          </div>
        )}
        {isArchived && (
          <div className="bg-slate-700 border border-slate-600 text-slate-100 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm whitespace-nowrap transition-all duration-300">
            <Archive size={10}/> Archived
          </div>
        )}
      </div>

      {/* Row 1: Title/Ref (Left) & Settings Gear (Right) */}
      <div className="flex justify-between items-center mb-1.5">
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <h3 className="text-base font-bold text-slate-800 truncate" title={project.name}>
            {project.name}
          </h3>
          {isReference && (
            <span className="bg-amber-50 border border-amber-200 text-amber-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-0.5 shadow-sm">
              ⭐ Ref
            </span>
          )}
        </div>
        
        <div className="relative shrink-0">
          <button 
            onClick={() => setOpenSettingsId(openSettingsId === project.id ? null : project.id)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors dropdown-trigger"
            title="Project Settings"
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

      {/* Row 2: Issues statistics badge centered with elegant divider lines */}
      <div className="flex items-center w-full mb-1">
        <div className="flex-grow border-t border-slate-200/60"></div>
        {metrics.openIssues > 0 ? (
          <span 
            className="mx-3 bg-amber-50/50 border border-amber-200/40 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1.5 shadow-sm transition-all"
            title={`Open Issues: ${metrics.openIssues} / Total: ${metrics.totalIssues}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Issues: {metrics.openIssues}/{metrics.totalIssues}
          </span>
        ) : (
          <span 
            className="mx-3 bg-slate-50 border border-slate-200/60 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1.5 shadow-sm transition-all"
            title="All issues resolved"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
            Issues: Clear
          </span>
        )}
        <div className="flex-grow border-t border-slate-200/60"></div>
      </div>

      {/* [Gemma4 & Qwen 27B] 바둑판 격자형 IP 블록 태그 리스트 */}
      <div className="mt-1.5 mb-4">
        {metrics.ipBlocks && metrics.ipBlocks.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 w-full">
            {[...metrics.ipBlocks]
              .sort((a, b) => {
                const countA = metrics.ipOpenIssuesMap[a] || 0;
                const countB = metrics.ipOpenIssuesMap[b] || 0;
                // 1. 이슈 개수가 많은 것 우선 배치 (이슈 보유 IP 최상단 노출)
                if (countA !== countB) {
                  return countB - countA;
                }
                // 2. 이슈 개수가 같으면, 글자 수가 짧은 순서대로 배치 (좁은 공간 짤림 방지 최적화)
                return a.length - b.length;
              })
              .map(ip => {
                const openCount = metrics.ipOpenIssuesMap[ip] || 0;
                return (
                  <div 
                    key={ip} 
                    className={`text-[10px] font-mono font-bold py-1.5 px-2 rounded-lg border transition-all duration-300 hover:shadow-sm hover:-translate-y-[0.5px] cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${isArchived ? 'bg-slate-100/80 text-slate-500 border-slate-200/50 hover:bg-slate-200/80 hover:border-slate-300/80 hover:text-slate-700' : 'bg-slate-50/70 text-slate-700 border-slate-200/60 hover:bg-blue-50/40 hover:text-blue-600 hover:border-blue-200/80'}`}
                    title={`${ip}${openCount > 0 ? ` (${openCount} Open Issues)` : ' (No Open Issues)'} - 클릭 시 Revision Log로 이동하여 필터링`}
                    onClick={() => onOpenWorkspace(project.id, project.latest_evt, 'Revision_Log', ip, isArchived ? 'readonly' : 'edit')}
                  >
                    <div className="flex items-center justify-between gap-1 w-full">
                      <span className="truncate text-left flex-1" style={{ minWidth: 0 }}>
                        {ip}
                      </span>
                      {openCount > 0 && (
                        <span className="text-amber-600 font-bold shrink-0 pl-0.5">
                          ({openCount})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="text-center py-2 text-[10px] font-bold text-slate-400 font-mono border border-dashed border-slate-200 rounded-lg">
            No IP Blocks
          </div>
        )}
      </div>

      <div className="mt-auto pt-3 border-t border-slate-100/80">
        {/* 주요 액션 버튼 영역 */}
        <div className="flex items-center gap-2">
          {isLockedByOther ? (
            // [UX 하드닝] 타인이 점유 중일 때: 목록에서 권한을 탈취하는 대신 '접속 시도'로 유도 (진입 시 모달에서 결정)
            <button
              onClick={() => onOpenWorkspace(project.id, project.latest_evt, 'Project_Overview', null, 'edit')}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-bold py-1.5 px-3 rounded-lg bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition-all shadow-sm active:scale-95"
            >
              <Clock size={12} /> {project.latest_evt} 접속 시도 (잠김)
            </button>
          ) : (
            // 2. 점유 중이지 않을 때: 바로 최신 차수 편집 진입
            <>
              <button
                onClick={() => onOpenWorkspace(project.id, project.latest_evt, 'Project_Overview', null, isArchived ? 'readonly' : 'edit')}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-1.5 px-3 rounded-lg transition-all active:scale-95 shadow-sm ${isArchived ? 'bg-slate-50/50 text-slate-500 border border-slate-200/60 hover:bg-slate-100/60' : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100/80 hover:text-blue-700 hover:border-blue-300'}`}
              >
                {isArchived ? <Clock size={12} /> : <UnlockIcon size={12} />}
                {project.latest_evt} {isArchived ? '관찰' : '편집'} 접속
              </button>
              
              {/* 과거 차수 선택 (드롭다운) */}
              <button
                onClick={() => setOpenDropdownId(openDropdownId === project.id ? null : project.id)}
                className="py-1.5 px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 transition-all flex items-center gap-0.5 dropdown-trigger"
                title="다른 차수(History) 선택"
              >
                <History size={13} />
                <ChevronDown size={11} />
              </button>
            </>
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
