import React, { useState, useMemo, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import { FileText, AlertCircle, Edit2, Trash2, CheckCircle, FolderOpen, Activity, Plus, X, Eye, RefreshCw, Lock, Link, AlertTriangle, ChevronDown, ChevronRight, Archive } from 'lucide-react';
import IssueSummaryCard from '../IssueSummaryCard';
import IssueForm from '../IssueForm';
import ActionBar from '../ActionBar';
import RevisionLogVirtualList from './RevisionLogVirtualList';
import { useAutoSave, clearAutoSave } from '../../hooks/useAutoSave';
import AutoSaveRecoveryModal from '../AutoSaveRecoveryModal';
import { useConfirm } from '../../contexts/ConfirmContext';
import { getIssueStatus, makeDefaultForm, calcNextNum, getHistory, DISPOSITION_OPTIONS } from '../../logic/revisionLogLogic';

// ── New Architecture Hooks ──
import { useLogFilter } from '../../hooks/revisionLog/useLogFilter';
import { useLogData } from '../../hooks/revisionLog/useLogData';
import { useLogForm } from '../../hooks/revisionLog/useLogForm';
import { useAsyncAction } from '../../hooks/revisionLog/useAsyncAction';

const RevisionLogTab = forwardRef(({ data, overviewData, ipIndexData, currentRevision, isArchived, lockReason, projectId, dbUpdatedAt, onSubmit, onImmediateUpdate, faReportData, onFaReportUpdate, onEditingStateChange, onFormDirtyChange, onForceUnlock }, ref) => {
  // 1. Logic & Utils
  const safeData = useMemo(() => data || { issues: [], historyBlocks: [], loadedIssues: [], initialMode: 'new' }, [data]);
  const project = overviewData?.Project_Name || 'Proj';
  const stage = currentRevision || 'EVT0';
  const showConfirm = useConfirm();
  const validIps = useMemo(() => {
    const map = {};
    (overviewData?.IP_Blocks || []).forEach(ip => map[ip] = true);
    return map;
  }, [overviewData?.IP_Blocks]);
  const STAGES = ['EVT0', 'EVT1', 'EVT2', 'EVT3', 'DVT', 'PVT', 'MP'];

  // 2. Custom Hooks (The Granular Architecture)
  const { 
    ipDropdown, setIpDropdown, statusFilter, setStatusFilter, mode, setMode
  } = useLogFilter('All', safeData.initialMode || 'new');

  const { 
    latestIssueStates, stats, sortedIssues, issues, historyBlocks 
  } = useLogData(safeData, ipDropdown, validIps, project);

  const { 
    formData, editingId, isDirtyRef, formResetKey,
    setFormData, setEditingId, setIsDirty, setSelectedFaForPull, handleFormChange, resetForm: baseResetForm
  } = useLogForm(ipDropdown, onFormDirtyChange);

  // ── [보안/성능] 27B 감리 반영: 원본 데이터는 useRef로 관리하여 리렌더링 차단 ──
  const initialFormDataRef = useRef(null);

  // ── [보안] 탭 언마운트 시 민감 데이터 클린업 ──
  useEffect(() => {
    return () => {
      initialFormDataRef.current = null;
    };
  }, []);

  const { executeSafe } = useAsyncAction();

  // 3. UI/Interaction State

  const [assigneeModal, setAssigneeModal] = useState({ open: false, newAssignee: '' });
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyTargetId, setHistoryTargetId] = useState('');
  const [pullFaModalOpen, setPullFaModalOpen] = useState(false);

  const [isTabEditing, setIsTabEditing] = useState(false);
  const isReadOnly = isArchived || !isTabEditing;

  // ── 탭 잠금 동기화 ──
  useEffect(() => {
    if (isArchived === true) setIsTabEditing(false);
  }, [isArchived]);

  useEffect(() => {
    if (onEditingStateChange) onEditingStateChange(isTabEditing);
  }, [isTabEditing, onEditingStateChange]);

  // ── 가용한 IP 목록 계산 ──
  const availableIps = useMemo(() => {
    const s = Object.keys(validIps);
    let hasOrphans = false;
    issues?.forEach(i => { if (i?.ipBlock && !validIps[i.ipBlock]) hasOrphans = true; });
    historyBlocks?.forEach(b => b?.issues?.forEach(i => { if (i?.ipBlock && !validIps[i.ipBlock]) hasOrphans = true; }));
    const arr = s.sort();
    if (hasOrphans) arr.push('Deleted IP (Orphan)');
    return arr;
  }, [validIps, issues, historyBlocks]);

  // ── 미연동 FA 목록 ──
  const unlinkedFasForCurrentIp = useMemo(() => {
    const reports = faReportData?.faReports || [];
    if (ipDropdown === 'All') {
      return reports.filter(f => !f.isLinkedToLog);
    }
    return reports.filter(f => f.ipBlock === ipDropdown && !f.isLinkedToLog);
  }, [faReportData, ipDropdown]);

  const hasUnlinkedFa = unlinkedFasForCurrentIp.length > 0;

  // ── Auto-Save ──
  const { showRecoveryModal, recoveredTime, handleRestore, handleDiscard } = useAutoSave({
    projectId,
    tabName: 'Revision_Log',
    data: safeData,
    isEditing: isTabEditing,
    onRestore: (recoveredData) => {
      if (onImmediateUpdate) onImmediateUpdate(recoveredData, true);
    },
    dbUpdatedAt,
    setIsEditing: setIsTabEditing
  });

  // ── 명령형 API 노출 ──
  useImperativeHandle(ref, () => ({
    canNavigate: () => !isDirtyRef.current,
    resetForm: () => baseResetForm(ipDropdown, calcNextNum(ipDropdown, latestIssueStates))
  }), [ipDropdown, latestIssueStates, baseResetForm]);

  // ── 파생 상태 (Derived States) ──
  const availOrigins = useMemo(() => {
    const idx = STAGES.indexOf(stage);
    return idx > 0 ? STAGES.slice(0, idx) : [];
  }, [stage, STAGES]);

  const sortedLoadedIssues = useMemo(() => [...(safeData.loadedIssues || [])].sort(), [safeData.loadedIssues]);
  const sortedAllIds = useMemo(() => Object.keys(latestIssueStates).sort(), [latestIssueStates]);

  const needsEvalSet = useMemo(() => {
    const evalledIds = {};
    issues.forEach(i => {
      if (i.entryMode === 'eval' && i.targetIssue) {
        evalledIds[i.targetIssue] = true;
      }
    });
    const result = {};
    (safeData.loadedIssues || []).forEach(id => {
      if (!evalledIds[id]) result[id] = true;
    });
    return result;
  }, [issues, safeData.loadedIssues]);

  const carryoverCandidateSet = useMemo(() => {
    const loadedMap = {};
    (safeData.loadedIssues || []).forEach(id => loadedMap[id] = true);
    
    const actedIds = {};
    issues.forEach(i => {
      if (i.entryMode === 'carryover' && i.targetIssue) {
        actedIds[i.targetIssue] = true;
      }
    });
    
    const candidates = {};
    if (historyBlocks.length === 0) return candidates;
    const lastBlk = historyBlocks[historyBlocks.length - 1];
    lastBlk.issues.forEach(item => {
      const id = item.entryMode === 'new' ? `${item.ipBlock}.${project}.${item.issueNum}` : item.targetIssue;
      if (!id) return;
      const status = getIssueStatus(item);
      if ((status === 'OPEN' || status === 'DEFERRED') && !loadedMap[id] && !actedIds[id]) {
        candidates[id] = true;
      }
    });
    return candidates;
  }, [historyBlocks, safeData.loadedIssues, issues, project]);

  const curStageNums = useMemo(() => {
    return issues.filter(i => i.entryMode === 'new' && i.ipBlock === formData.ipBlock).map(i => i.issueNum).sort((a,b)=>a.localeCompare(b));
  }, [issues, formData.ipBlock]);

  // ── IP 변경 시 폼 동기화 (Effect) ──
  useEffect(() => {
    if (!editingId && mode === 'new') {
      const nextNum = calcNextNum(ipDropdown, latestIssueStates);
      setFormData(prev => ({ 
        ...prev, 
        ipBlock: ipDropdown,
        issueNum: (prev.ipBlock !== ipDropdown || !prev.issueNum) ? nextNum : prev.issueNum
      }));
    }
  }, [ipDropdown, editingId, mode, latestIssueStates]);


  const SEVERITY_FA_MAP = { S1: 'Fail', S2: 'Major', S3: 'Minor' };


  const handlePullFa = async (fa) => {
    if (stage === 'EVT0' && fa.disposition === 'Revision') {
      await showConfirm({
        title: "차수 제한",
        message: "해당 이슈는 Hardware Revision이 필요하므로 EVT1 차수에서 등록해야 합니다. Revision Up을 먼저 진행해 주세요.",
        type: "warning",
        showCancel: false
      });
      return;
    }
    const phenText = `[FA 연동: ${fa.faId}]\n• Customer: ${fa.customer || ''}${fa.custStage ? ` (${fa.custStage})` : ''}\n• Phenomenon: ${fa.phenomenon || ''}`;

    const fillData = {
      ...makeDefaultForm(fa.ipBlock),
      ipBlock: fa.ipBlock,
      entryMode: 'fa',
      issueNum: calcNextNum(fa.ipBlock, latestIssueStates),
      types: ['Initial'],
      severity: SEVERITY_FA_MAP[fa.severity] || 'Major',
      disposition: fa.disposition === 'Revision' ? 'Revision' :
                   fa.disposition === 'Workaround' ? 'SW Workaround' : 'Test Screening',
      phenomenon: phenText,
      rootCause: fa.rootCause || '',
      assignee: fa.assignee || '',
      faId: fa.faId,
      faReportId: fa.faId,
      faCustomer: fa.customer ? `${fa.customer}${fa.custStage ? ` (${fa.custStage})` : ''}` : '',
      subBlock: fa.subBlock || null,
    };

    if (fa.ipBlock && fa.ipBlock !== ipDropdown) {
      setIpDropdown(fa.ipBlock);
    }
    setEditingId(null);
    setSelectedFaForPull(fa);
    setFormData(fillData);
    setMode('fa');
    setPullFaModalOpen(false);
  };

  const markFaLinkState = useCallback((faId, linked) => {
    if (!faReportData || !onFaReportUpdate) return;
    const updatedReports = (faReportData.faReports || []).map(f =>
      f.faId === faId ? { ...f, isLinkedToLog: linked } : f
    );
    onFaReportUpdate({ ...faReportData, faReports: updatedReports });
  }, [faReportData, onFaReportUpdate]);

  const handleUnlinkFa = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!formData.faId) return;

    if (editingId) {
      await handleDeleteRequest({ ...formData, id: editingId });
    } else {
      markFaLinkState(formData.faId, false);
      setFormData(p => ({
        ...p,
        faId: '',
        faReportId: '',
        faCustomer: ''
      }));
      setSelectedFaForPull(null);
    }
  };

  const handleSave = useCallback(async (dataToSave) => {
    // [보안 가드] executeSafe를 통한 AbortSignal 관리 및 레이스 컨디션 차단
    await executeSafe(async (signal) => {
      const finalData = dataToSave || formData;
      
      if (isArchived && editingId) {
        setEditingId(null);
        setFormData(makeDefaultForm(ipDropdown, calcNextNum(ipDropdown, latestIssueStates)));
        return;
      }

      const currentIp = finalData.ipBlock || ipDropdown;
      
      let entry = {
        ...finalData,
        entryMode: (mode === 'fa') ? 'new' : finalData.entryMode || mode,
        ipBlock: currentIp,
        stage: stage
      };

      if (entry.entryMode === 'carryover') {
        entry.carryoverStatus = 'RESOLVED';
      }

      let newIssues = [...issues];
      const effectiveEditingId = editingId || finalData.id;
      
      if (effectiveEditingId && issues.some(it => it.id === effectiveEditingId)) {
        newIssues = newIssues.map(it => it.id === effectiveEditingId ? { ...it, ...entry, id: effectiveEditingId } : it);
      } else {
        entry.id = Date.now();
        newIssues = [entry, ...issues];
      }

      // [보안] DB 저장 시 AbortSignal 전파
      if (onSubmit) await onSubmit({ ...safeData, issues: newIssues }, signal);

      if (finalData.faId) {
        markFaLinkState(finalData.faId, true);
      }

      setEditingId(null);
      initialFormDataRef.current = null;
      setFormData(makeDefaultForm(currentIp, calcNextNum(currentIp, latestIssueStates)));
      setIsDirty(false);
      if (onFormDirtyChange) onFormDirtyChange(false);
    });
  }, [isArchived, editingId, ipDropdown, latestIssueStates, mode, stage, issues, onSubmit, safeData, markFaLinkState, formData, executeSafe, onFormDirtyChange, setIsDirty, setEditingId, setFormData]);

  const cancelEdit = useCallback(async (skipConfirm = false) => {
    if (!skipConfirm && isDirtyRef.current) {
      const confirmed = await showConfirm({
        title: "작성 취소",
        message: "작성 중인 내용이 있습니다. 저장하지 않고 정말 취소하시겠습니까?",
        type: "warning"
      });
      if (!confirmed) return;
    }
    initialFormDataRef.current = null;
    baseResetForm(ipDropdown, calcNextNum(ipDropdown, latestIssueStates));
  }, [showConfirm, ipDropdown, latestIssueStates, baseResetForm]);


  const handleEdit = useCallback((item) => {
    setMode(item.faId ? 'fa' : item.entryMode);
    setEditingId(item.id);
    initialFormDataRef.current = { ...item };
    setFormData({ ...item });
  }, [setMode, setEditingId, setFormData]);

  const handleView = useCallback((item) => {
    setMode(item.faId ? 'fa' : item.entryMode);
    setEditingId(item.id);
    initialFormDataRef.current = { ...item };
    setFormData({ ...item });
  }, [setMode, setEditingId, setFormData]);

  const handleHistoryCardClick = useCallback((item) => {
    const issueId = item.entryMode === 'new'
      ? `${item.ipBlock}.${project}.${item.issueNum}`
      : item.targetIssue;
    const finalStatus = getIssueStatus(item);
    const isEvalTarget = (safeData.loadedIssues || []).includes(issueId);

    const commonFormData = {
      ...makeDefaultForm(item.ipBlock || ipDropdown, calcNextNum(item.ipBlock || ipDropdown, latestIssueStates)),
      targetIssue: issueId,
      ipBlock: item.ipBlock || ipDropdown,
      severity: item.severity || 'Major',
      subBlock: item.subBlock || null,
    };

    setEditingId(null);
    initialFormDataRef.current = null;

    if (finalStatus === 'CLOSED') {
      setMode('reopen');
      setFormData({
        ...commonFormData,
        entryMode: 'reopen',
        phenomenon: item.phenomenon || '',
        rootCause: item.rootCause || '',
        disposition: 'Revision',
      });
    } else if (isEvalTarget) {
      setMode('eval');
      setFormData({
        ...commonFormData,
        entryMode: 'eval',
      });
    } else {
      setMode('carryover');
      setFormData({
        ...commonFormData,
        entryMode: 'carryover',
      });
    }
  }, [project, safeData.loadedIssues, ipDropdown, latestIssueStates, setEditingId, setMode, setFormData]);

  const handleTabSwitch = useCallback(async (newMode) => {
    if (mode === newMode) return;
    
    // [27B 감리] Dirty 상태일 때만 확인 다이얼로그 (기존 로직 유지)
    if (isTabEditing && isDirtyRef.current && !editingId) {
      const confirmed = await showConfirm({
        title: "작성 취소",
        message: "작성 중인 내용이 있습니다. 저장하지 않고 정말 취소하시겠습니까?",
        type: "warning"
      });
      if (!confirmed) return;
    }
    
    // [27B 감리] 편집 모드 유지 중에는 폼 초기화 생략 (데이터 손실 방지)
    // 편집 중이 아닐 때만 폼을 초기화하여 깨끗한 상태로 전환
    if (!isTabEditing) {
      baseResetForm(ipDropdown, calcNextNum(ipDropdown, latestIssueStates));
      initialFormDataRef.current = null;
    }

    // [핵심 수정] setIsTabEditing(false) 제거 → 탭 전환 시에도 편집 모드 유지
    setMode(newMode);
  }, [mode, editingId, showConfirm, ipDropdown, latestIssueStates, isTabEditing, baseResetForm, setMode]);

  const handleIpChange = useCallback(async (newIp) => {
    if (ipDropdown === newIp) return;
    setIpDropdown(newIp);
  }, [ipDropdown, setIpDropdown]);

  const handleDeleteRequest = useCallback(async (item) => {
    // [보안 가드] 삭제 작업도 executeSafe로 관리
    await executeSafe(async (signal) => {
      const isSpecialMode = item.entryMode === 'eval' || item.entryMode === 'carryover' || item.entryMode === 'reopen';

      const confirmed = await showConfirm({
        title: item.faId ? "FA 연동 해제" : (isSpecialMode ? "조치 내용 초기화" : "이슈 삭제"),
        message: item.faId ? "연동을 해제하고 FA 리포트를 미연동 상태로 되돌리시겠습니까?" : (isSpecialMode ? "평가 및 대응 방안을 초기화하시겠습니까?" : "등록된 신규 이슈를 삭제하시겠습니까?"),
        type: "danger",
        confirmText: item.faId ? "FA 연동 해제" : (isSpecialMode ? "조치 초기화" : "완전 삭제")
      });

      if (confirmed) {
        const newIssues = issues.filter(it => it.id !== item.id);
        
        if (onSubmit) await onSubmit({ ...safeData, issues: newIssues }, signal);
        
        if (item.faId) {
          markFaLinkState(item.faId, false);
        }
        
        if (editingId === item.id) cancelEdit(true);
      }
    });
  }, [showConfirm, project, issues, onSubmit, safeData, markFaLinkState, editingId, cancelEdit, executeSafe]);


  const confirmAssigneeChange = () => {
    if (assigneeModal.newAssignee) {
      const val = formData.assignee ? `${formData.assignee}, ${assigneeModal.newAssignee}` : assigneeModal.newAssignee;
      handleFormChange({ ...formData, assignee: val }, initialFormDataRef.current);
    }
    setAssigneeModal({ open: false, newAssignee: '' });
  };


  const handleLock = () => {
    if (onSubmit) onSubmit(safeData);
    clearAutoSave(projectId, 'Revision_Log');
    setIsTabEditing(false);
    baseResetForm(ipDropdown, calcNextNum(ipDropdown, latestIssueStates));
  };

  return (
    <div className="space-y-4 max-w-full">
      <AutoSaveRecoveryModal 
        isOpen={showRecoveryModal} 
        timestamp={recoveredTime} 
        onRestore={handleRestore} 
        onDiscard={handleDiscard} 
      />
      <div className="flex items-center gap-6 pb-4 border-b border-slate-200 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
            <FileText size={28} className="text-blue-600" />
            Revision Log
          </h1>
          {isArchived && <span className="text-xs px-2 py-1 bg-slate-100 text-slate-500 rounded font-bold flex items-center gap-1"><Lock size={11} />Read-Only</span>}
        </div>

        <div className="shrink-0 border-l pl-3 border-slate-200">
          {(() => {
            const unmanagedEvals = (safeData.loadedIssues || []).filter(id => !issues.some(i => i.entryMode === 'eval' && i.targetIssue === id));
            const unmanagedCarryovers = issues.filter(i => i.entryMode === 'carryover' && i.carryoverStatus === 'OPEN');
            const disableLock = unmanagedEvals.length > 0 || unmanagedCarryovers.length > 0;
            let disableReason = "";
            if (disableLock) {
              if (unmanagedEvals.length > 0) disableReason += "수정 평가(eval)가 완료되지 않았습니다. ";
              if (unmanagedCarryovers.length > 0) disableReason += "자동 이월된 OPEN 이슈에 조치가 필요합니다.";
            }
            return (
              <ActionBar
                isGlobalArchived={isArchived}
                isEditing={isTabEditing}
                onEdit={() => setIsTabEditing(true)}
                onLock={handleLock}
                disableLock={disableLock}
                disableReason={disableReason}
                lockReason={lockReason}
                onForceUnlock={onForceUnlock}
              />
            );
          })()}
        </div>
      </div>



      {stats.deferred > 0 && !isArchived && (
         <div className="mb-4 bg-blue-50 border-2 border-dashed border-blue-300 rounded-xl p-4 flex items-start gap-3">
           <span className="text-xl">🔵</span>
           <div>
             <p className="text-sm font-bold text-blue-800">유보(Deferred) 이슈가 {stats.deferred}건 있습니다.</p>
             <p className="text-xs text-blue-700 mt-1">이 이슈들은 다음 차수로 자동 Carry-forward 되며 반드시 종합 판단이 이루어져야 합니다.</p>
           </div>
         </div>
       )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-center">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-1 bg-gray-100 p-1 rounded-lg m-0">
              <button onClick={() => handleTabSwitch('eval')} disabled={stage === 'EVT0'} className={`flex-1 py-1.5 rounded-md font-medium text-sm transition-colors ${mode === 'eval' ? 'bg-white shadow text-blue-600 border-t-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'} ${stage === 'EVT0' ? 'opacity-50 cursor-not-allowed' : ''}`}>이전 차수 수정 평가</button>
              <button onClick={() => handleTabSwitch('carryover')} disabled={stage === 'EVT0'} className={`flex-1 py-1.5 rounded-md font-medium text-sm transition-colors ${mode === 'carryover' ? 'bg-white shadow text-purple-600 border-t-2 border-purple-500' : 'text-gray-500 hover:text-gray-700'} ${stage === 'EVT0' ? 'opacity-50 cursor-not-allowed' : ''}`}>자동 이월 이슈 관리</button>
              <button onClick={() => handleTabSwitch('new')} className={`flex-1 py-1.5 rounded-md font-medium text-sm transition-colors ${mode === 'new' ? 'bg-white shadow text-blue-600 border-t-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'}`}>신규/잠재 이슈 등록</button>
              <button onClick={() => handleTabSwitch('fa')} className={`flex-1 py-1.5 rounded-md font-medium text-xs transition-colors flex items-center justify-center gap-1 whitespace-nowrap overflow-hidden ${mode === 'fa' ? 'bg-white shadow text-amber-600 border-t-2 border-amber-500' : 'text-gray-500 hover:text-gray-700'}`}>
                <span className="truncate">FA 리포트 연동</span>
                {hasUnlinkedFa && (<span className="bg-red-500 text-white text-[9px] font-extrabold px-1 py-0.5 rounded-full shadow-sm shrink-0">{unlinkedFasForCurrentIp.length}건</span>)}
              </button>
              <button onClick={() => handleTabSwitch('reopen')} disabled={stage === 'EVT0'} className={`flex-1 py-1.5 rounded-md font-medium text-sm transition-colors ${mode === 'reopen' ? 'bg-white shadow text-blue-600 border-t-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'} ${stage === 'EVT0' ? 'opacity-50 cursor-not-allowed' : ''}`}>이슈 재오픈</button>
            </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center overflow-x-auto whitespace-nowrap">
          <div className="flex flex-row items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">IP 선택</span>
            <button onClick={() => handleIpChange('All')} className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all shrink-0 ${ipDropdown === 'All' ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300'}`}>
              All<span className="ml-1.5 text-[10px] opacity-40">○</span>
            </button>
            {availableIps.filter(ip => ip !== 'All' && ip !== 'Common').map(ip => (
              <button key={ip} onClick={() => handleIpChange(ip)} className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all shrink-0 ${ipDropdown === ip ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300'}`}>
                {ip}
                {issues.some(i => i.entryMode === 'new' && i.ipBlock === ip) ? <span className="ml-1.5 text-[10px] opacity-80">✓</span> : <span className="ml-1.5 text-[10px] opacity-40">○</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <IssueForm
          key={mode + (editingId || 'new') + (formData.faId || '') + formResetKey}
          initialData={formData}
          mode={mode}
          editingId={editingId}
          isReadOnly={isReadOnly}
          isArchived={isArchived}
          stage={stage}
          project={project}
          currentSelectedIp={ipDropdown}
          availableIps={availableIps}
          latestIssueStates={latestIssueStates}
          historyBlocks={historyBlocks}
          issues={issues}
          ipIndexData={ipIndexData}
          curStageNums={curStageNums}
          carryoverCandidateSet={carryoverCandidateSet}
          sortedLoadedIssues={sortedLoadedIssues}
          availOrigins={availOrigins}
          sortedRevIds={sortedAllIds}
          onSave={handleSave}
          onCancel={cancelEdit}
          onChange={handleFormChange}
          onPullFaClick={() => setPullFaModalOpen(true)}
          onUnlinkFa={handleUnlinkFa}
          onOpenAssigneeModal={() => setAssigneeModal({ open: true, newAssignee: formData.assignee || '' })}
          onSetEditingId={setEditingId}
        />

        <div className="bg-gray-50 rounded-xl border border-gray-200 flex flex-col h-[calc(100vh-12rem)] overflow-y-auto">
          <div className="sticky top-0 z-10 bg-gray-50 rounded-t-xl px-5 pt-5 pb-3 mb-3 border-b border-gray-200 flex flex-row items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-gray-800 m-0 whitespace-nowrap shrink-0">
              <FileText size={16} className="text-gray-600" /> Current - {stage}
            </h2>
            <div className="flex flex-row items-center gap-2.5 shrink-0 overflow-x-auto ml-6 p-1">
              <button onClick={() => setStatusFilter('ALL')} className={`flex items-center gap-2 px-4 py-1 rounded-lg shadow-sm transition-all ${statusFilter === 'ALL' ? 'border-2 border-slate-400 bg-slate-100 scale-105 font-semibold' : 'border border-slate-200 bg-white opacity-60 hover:opacity-100'}`}>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Total</span><span className="font-mono font-semibold text-slate-700">{stats.total}</span>
              </button>
              <button onClick={() => setStatusFilter('OPEN')} className={`flex items-center gap-2 px-4 py-1 rounded-lg shadow-sm transition-all ${statusFilter === 'OPEN' ? 'border-2 border-orange-400 bg-orange-100 scale-105 font-semibold' : 'border border-orange-200 bg-orange-50 opacity-60 hover:opacity-100'}`}>
                <span className="text-[10px] font-semibold text-orange-500 uppercase tracking-widest">Open</span><span className="font-mono font-semibold text-orange-700">{stats.open}</span>
              </button>
              <button onClick={() => setStatusFilter('DEF')} className={`flex items-center gap-2 px-4 py-1 rounded-lg shadow-sm transition-all ${statusFilter === 'DEF' ? 'border-2 border-blue-400 bg-blue-100 scale-105 font-semibold' : 'border border-blue-200 bg-blue-50 opacity-60 hover:opacity-100'}`}>
                 <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-widest">Def</span><span className="font-mono font-semibold text-blue-700">{stats.deferred}</span>
              </button>
              <button onClick={() => setStatusFilter('CLOSED')} className={`flex items-center gap-2 px-4 py-1 rounded-lg shadow-sm transition-all ${statusFilter === 'CLOSED' ? 'border-2 border-green-400 bg-green-100 scale-105 font-semibold' : 'border border-green-200 bg-green-50 opacity-60 hover:opacity-100'}`}>
                <span className="text-[10px] font-semibold text-green-500 uppercase tracking-widest">Closed</span><span className="font-mono font-semibold text-green-700">{stats.closed}</span>
              </button>
              <div className="w-px h-5 bg-slate-300 mx-2 shrink-0"></div>
              <button onClick={() => setHistoryModalOpen(true)} className="flex items-center h-7 gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-4 rounded-lg font-semibold text-[11px] transition-colors shadow-sm shrink-0">
                <Activity size={12} /> 리포트
              </button>
            </div>
          </div>
          <div className="px-5 pb-5 flex-1">
            <div className="space-y-2">
              <RevisionLogVirtualList
                issues={issues}
                safeData={safeData}
                project={project}
                ipDropdown={ipDropdown}
                statusFilter={statusFilter}
                needsEvalSet={needsEvalSet}
                carryoverCandidateSet={carryoverCandidateSet}
                sortedIssues={sortedIssues}
                historyBlocks={historyBlocks}
                isReadOnly={isReadOnly}
                editingId={editingId}
                stage={stage}
                handlers={{
                  handleHistoryCardClick,
                  handleView,
                  handleEdit,
                  handleDeleteRequest
                }}
              />
          </div>

          {historyBlocks.length > 0 && (
            <div className="mt-8 space-y-3">
               <h3 className="text-sm font-bold border-b border-gray-200 pb-2 text-gray-700 flex items-center gap-2">
                 <FolderOpen size={15} /> Previous Stages History
               </h3>
              {historyBlocks.map((block, idx) => {
                const filteredHits = block.issues.filter(i => ipDropdown === 'All' ? true : (i.ipBlock || (i.targetIssue ? i.targetIssue.split('.')[0] : '')) === ipDropdown);
                if (filteredHits.length === 0) return null;
                return (
                  <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 opacity-80 mt-3">
                    <h4 className="text-sm font-bold mb-3 flex items-center gap-2 border-b border-gray-100 pb-2 text-gray-600">
                      <FolderOpen size={14} /> Stage: {block.stageName}
                    </h4>
                    <div className="space-y-2">
                      {filteredHits.map(item => (
                        <IssueSummaryCard
                          key={item.id}
                          item={item}
                          project={project}
                          isReadOnly={true}
                          expandable
                          onEdit={handleHistoryCardClick}
                          historyStage={block.stageName}
                          needsEval={false}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>

        </div>
      </div>

      {/* MODALS SECTION - Local Modals for specialized flows */}

      {/* FA Pull 모달 */}
      {pullFaModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b bg-gray-50 rounded-t-xl">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Link size={17} className="text-yellow-600"/>
                FA 리포트에서 데이터 가져오기
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{ipDropdown}</span>
              </h3>
              <button onClick={() => setPullFaModalOpen(false)} className="text-gray-500 hover:text-gray-800 p-1.5 rounded hover:bg-gray-200">
                <X size={18}/>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {unlinkedFasForCurrentIp.length === 0 ? (
                <div className="text-center text-gray-400 py-10">
                  <AlertTriangle size={28} className="mx-auto mb-2 opacity-40"/>
                  <p className="text-sm">미연동된 FA 리포트가 없습니다.</p>
                </div>
              ) : unlinkedFasForCurrentIp.map(fa => (
                <button
                  key={fa.faId}
                  onClick={() => handlePullFa(fa)}
                  className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-yellow-400 hover:bg-yellow-50 transition-all group"
                >
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="font-bold text-sm font-mono text-gray-800">{fa.faId}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                      fa.severity === 'S1' ? 'bg-red-100 text-red-700 border-red-300' :
                      fa.severity === 'S2' ? 'bg-orange-100 text-orange-700 border-orange-300' :
                      'bg-yellow-100 text-yellow-700 border-yellow-300'
                    }`}>{fa.severity}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                      fa.disposition === 'Revision' ? 'bg-red-50 text-red-700 border-red-300' :
                      fa.disposition === 'Workaround' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                      'bg-purple-50 text-purple-700 border-purple-300'
                    }`}>{fa.disposition}</span>
                    {fa.versionGap === 'Potential Risk' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-300 flex items-center gap-0.5">
                        <AlertTriangle size={9}/>Potential Risk
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-1">
                    <span className="font-semibold">Customer:</span> {fa.customer} ({fa.custStage}) &nbsp;|&nbsp;
                    <span className="font-semibold">Source:</span> {fa.sampleSourceVer} → {fa.reportedInStage}
                  </p>
                  <p className="text-sm text-gray-700 line-clamp-2">{fa.phenomenon}</p>
                  <p className="text-xs text-gray-400 mt-1 group-hover:text-yellow-700 font-semibold">클릭하여 폼에 자동 입력 →</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {assigneeModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full"><h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-600"><Edit2 size={19} /> 담당자 변경</h3><input autoFocus type="text" value={assigneeModal.newAssignee} onChange={(e) => setAssigneeModal(p => ({ ...p, newAssignee: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4" placeholder="이름 입력" onKeyDown={(e) => { if(e.key==='Enter') confirmAssigneeChange() }}/><div className="flex justify-end gap-2"><button onClick={() => setAssigneeModal({open:false, newAssignee:''})} className="px-4 py-2 bg-gray-100 rounded-md text-sm">취소</button><button onClick={confirmAssigneeChange} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm">확인</button></div></div></div>
      )}
      {historyModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b bg-gray-50 rounded-t-xl">
              <h3 className="text-lg font-bold flex items-center gap-2"><Activity size={20} className="text-slate-600" /> 이슈 이력(History) 리포트</h3>
              <button onClick={() => { setHistoryModalOpen(false); setHistoryTargetId(''); }} className="text-gray-500 hover:text-gray-800 hover:bg-gray-200 p-1.5 rounded"><X size={20} /></button>
            </div>
            <div className="p-4 border-b">
              <label className="block text-sm font-bold text-gray-700 mb-2">조회할 이슈 ID 선택</label>
              <select value={historyTargetId} onChange={(e) => setHistoryTargetId(e.target.value)} className="w-full h-11 px-4 border border-gray-300 rounded-md bg-white text-sm text-gray-800">
                <option value="">이슈를 선택하세요...</option>
                {sortedAllIds.map(id => <option key={id} value={id}>{id}</option>)}
              </select>
            </div>
            <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
              {historyTargetId ? (
                <div className="space-y-4 ml-4">
                  {getHistory(historyTargetId, historyBlocks, issues, project, stage).map((h, i) => (
                    <div key={i} className="relative pl-5 border-l-2 border-slate-300 pb-4">
                       <div className="absolute w-3 h-3 bg-slate-500 rounded-full -left-[7px] top-1 border-2 border-white"></div>
                       <h4 className="font-bold text-slate-800 mb-2">{h.stage} <span className="text-xs bg-slate-200 px-1.5 py-0.5 rounded">{h.data.entryMode}</span></h4>
                       <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm text-sm">
                         {h.data.disposition && <div><strong>Disp: </strong> {h.data.disposition}</div>}
                         {h.data.assessment && <div><strong>Assmt: </strong> {h.data.assessment}</div>}
                         {h.data.comment && <div><strong>Cmt: </strong> {h.data.comment}</div>}
                         {h.data.phenomenon && <div><strong>Phen: </strong> {h.data.phenomenon}</div>}
                       </div>
                    </div>
                  ))}
                </div>
              ) : <div className="text-center text-gray-500 mt-10">조회할 이슈를 선택하세요.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default RevisionLogTab;
