import React, { useState, useMemo, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import { FileText, AlertCircle, Edit2, Trash2, CheckCircle, FolderOpen, Activity, Plus, X, Eye, RefreshCw, Lock, Link, AlertTriangle, ChevronDown, ChevronRight, Archive, Check } from 'lucide-react';
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

// ── [보안/성능] Milestone Quality Table Imports ──
import { resolveCanonicalState } from '../../utils/stateResolvers';
import MilestoneMetricsTable from './MilestoneMetricsTable';
import DebtDetailsPopover from './DebtDetailsPopover';

const InitialEmptyDashboard = ({ stats, stage }) => {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-8 flex flex-col items-center justify-center text-center h-full min-h-[500px] shadow-sm transition-all duration-300">
      {/* 상단 A: 미선택 가이드 */}
      <div className="w-16 h-16 rounded-full bg-blue-50/70 border border-blue-100 flex items-center justify-center mb-5 shadow-inner">
        <FolderOpen size={28} className="text-blue-500/90" />
      </div>
      <h3 className="text-base font-black text-slate-800 mb-2 tracking-tight">조회할 이슈를 선택해 주세요</h3>
      <p className="text-xs text-slate-400 max-w-[340px] leading-relaxed mb-8">
        상세 내역을 보시려면 왼쪽 목록에서 이슈 카드를 선택해 주세요.<br />
        <span className="text-[10px] text-slate-400 font-semibold block mt-1.5 bg-slate-50 border border-slate-100/60 rounded px-2 py-0.5 inline-block">
          🔒 새로운 이슈 등록이나 조치는 상단 '편집 시작' 클릭 필요
        </span>
      </p>

      {/* 구분선 */}
      <div className="w-full max-w-[380px] h-[1px] bg-slate-100 mb-8" />

      {/* 하단 B: 현황 요약 통계 대시보드 */}
      <div className="w-full max-w-[420px]">
        <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4">현재 차수 ({stage}) 이슈 요약</h4>
        <div className="grid grid-cols-3 gap-3">
          {/* 총 이슈 */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-center shadow-sm">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Total</span>
            <span className="text-xl font-black text-slate-700 mt-1">{stats?.total || 0}</span>
          </div>

          {/* Open */}
          <div className="bg-orange-50/50 border border-orange-100/60 rounded-xl p-3.5 flex flex-col justify-center shadow-sm">
            <span className="text-[9px] font-bold text-orange-500 uppercase">Open</span>
            <span className="text-xl font-black text-orange-600 mt-1">{stats?.open || 0}</span>
          </div>

          {/* Closed */}
          <div className="bg-green-50/40 border border-green-100/60 rounded-xl p-3.5 flex flex-col justify-center shadow-sm">
            <span className="text-[9px] font-bold text-green-600 uppercase">Closed</span>
            <span className="text-xl font-black text-green-700 mt-1">{stats?.closed || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const RevisionLogTab = forwardRef(({ data, overviewData, ipIndexData, currentRevision, isArchived, lockReason, projectId, dbUpdatedAt, onSubmit, onImmediateUpdate, faReportData, onFaReportUpdate, onEditingStateChange, onFormDirtyChange, onForceUnlock, selectedIp }, ref) => {
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
  const STAGES = ['EVT0', 'EVT1', 'EVT2', 'EVT3', 'EVT4', 'EVT5', 'DVT', 'PVT', 'MP'];

  // 2. Custom Hooks (The Granular Architecture)
  const { 
    ipDropdown, setIpDropdown, statusFilter, setStatusFilter, mode, setMode
  } = useLogFilter(selectedIp || 'All', safeData.initialMode || 'new');

  // ── [보안/성능] selectedIp 변경 시 ipDropdown 동기화 ──
  useEffect(() => {
    if (selectedIp) {
      setIpDropdown(selectedIp);
    }
  }, [selectedIp, setIpDropdown]);

  const { 
    latestIssueStates, stats, sortedIssues, issues, historyBlocks 
  } = useLogData(safeData, ipDropdown, validIps, project, stage);

  const allStats = useMemo(() => {
    // 1. 과거 차수(historyBlocks)
    const pastStats = (historyBlocks || []).map(block => {
      const blockIssues = block.issues || [];
      let total = 0;
      let newCount = 0;
      let closed = 0;
      let debt = 0;
      let carryover = 0;
      let revision = 0;

      const blockDebtDetails = {
        Revision: 0,
        Deferred: 0,
        'SW Workaround': 0,
        'Test Screening': 0,
        'System Mitigation': 0,
        'Other/TBD': 0
      };

      blockIssues.forEach(item => {
        if (!item) return;
        total++;
        if (item.entryMode === 'new' || item.entryMode === 'fa' || (!item.entryMode && !item.carryoverStatus)) {
          newCount++;
        }
        
        // Revision 건수 집계
        if (item.disposition === 'Revision') {
          revision++;
        }

        // Closed/Debt/Carryover 상태 산정 (getIssueStatus 기준)
        const status = getIssueStatus(item);
        if (status === 'CLOSED') {
          closed++;
        } else if (status === 'DEFERRED') {
          carryover++;
        } else {
          // OPEN인 상태는 관리형 부채(Debt)로 산정
          debt++;
          const disp = item.disposition;
          if (disp === 'Revision') {
            blockDebtDetails['Revision']++;
          } else if (disp === 'SW Workaround') {
            blockDebtDetails['SW Workaround']++;
          } else if (disp === 'Test Screening') {
            blockDebtDetails['Test Screening']++;
          } else if (disp === 'System Mitigation') {
            blockDebtDetails['System Mitigation']++;
          } else {
            blockDebtDetails['Other/TBD']++;
          }
        }
      });

      const rate = total > 0 ? ((closed / total) * 100).toFixed(1) : '0.0';

      return {
        milestone: block.stageName,
        total,
        new: newCount,
        closed,
        debt,
        revision,
        carryover,
        resolutionRate: `${rate}%`,
        isCurrent: false,
        debtDetails: blockDebtDetails
      };
    });

    // 2. 현재 차수(latestIssueStates)
    let currTotal = 0;
    let currNew = 0;
    let currClosed = 0;
    let currDebt = 0;
    let currCarryover = 0;
    let currRevision = 0;

    const currDebtDetails = {
      Revision: 0,
      Deferred: 0,
      'SW Workaround': 0,
      'Test Screening': 0,
      'System Mitigation': 0,
      'Other/TBD': 0
    };

    Object.values(latestIssueStates || {}).forEach(item => {
      if (!item) return;
      currTotal++;
      
      const isNewLike = item.entryMode === 'new' || item.entryMode === 'fa';
      // 이번 차수 신규 등록 건
      if (isNewLike && item.stage === stage) {
        currNew++;
      }

      // 이번 차수 결정된 Revision 판정 건
      if (item.stage === stage && item.disposition === 'Revision') {
        currRevision++;
      }

      // 상태 산정 (getIssueStatus 기준)
      const status = getIssueStatus(item);
      if (status === 'CLOSED') {
        currClosed++;
      } else if (status === 'DEFERRED') {
        // 이번 차수에서 명시적으로 유보 결정된 경우
        if (item.stage === stage) {
          currCarryover++;
        } else {
          // 이전 차수 유보 상태로 아직 평가 대기 중인 경우 Open(Debt)로 산입
          currDebt++;
          currDebtDetails['Deferred']++;
        }
      } else {
        currDebt++;
        const disp = item.disposition;
        if (disp === 'Revision') {
          currDebtDetails['Revision']++;
        } else if (disp === 'SW Workaround') {
          currDebtDetails['SW Workaround']++;
        } else if (disp === 'Test Screening') {
          currDebtDetails['Test Screening']++;
        } else if (disp === 'System Mitigation') {
          currDebtDetails['System Mitigation']++;
        } else {
          currDebtDetails['Other/TBD']++;
        }
      }
    });

    const currRate = currTotal > 0 ? ((currClosed / currTotal) * 100).toFixed(1) : '0.0';
    const cappedRate = parseFloat(currRate) > 100 ? '100.0' : currRate;

    const currentStat = {
      milestone: stage,
      total: currTotal,
      new: currNew,
      closed: currClosed,
      debt: currDebt,
      revision: currRevision,
      carryover: currCarryover,
      resolutionRate: `${cappedRate}%`,
      isCurrent: true,
      debtDetails: currDebtDetails
    };

    return [...pastStats, currentStat];
  }, [historyBlocks, stage, latestIssueStates]);

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
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  const handleShowHistoryReport = useCallback((issueId) => {
    setHistoryTargetId(issueId);
    setHistoryModalOpen(true);
  }, []);

  const [isTabEditing, setIsTabEditing] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState(null);
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
  const getIssueTimeline = useCallback((issueId) => {
    if (!issueId) return [];
    
    const timeline = [];
    
    // 1. 과거 차수(historyBlocks) 탐색
    if (historyBlocks && historyBlocks.length > 0) {
      historyBlocks.forEach(block => {
        const stageName = block.stageName;
        const found = block.issues?.find(i => {
          const id = i.entryMode === 'new' ? `${i.ipBlock}.${project}.${i.issueNum}` : i.targetIssue;
          return id === issueId;
        });
        
        if (found) {
          timeline.push({
            stage: stageName,
            data: { ...found, stage: stageName }
          });
        }
      });
    }
    
    // 2. 현재 차수(issues) 탐색
    const foundCurrent = issues?.find(i => {
      const id = i.entryMode === 'new' ? `${i.ipBlock}.${project}.${i.issueNum}` : i.targetIssue;
      return id === issueId;
    });
    
    if (foundCurrent) {
      timeline.push({
        stage: stage,
        data: { ...foundCurrent, stage: stage }
      });
    }
    
    // 3. 차수 순서대로 정렬
    timeline.sort((a, b) => {
      const idxA = STAGES.indexOf(a.stage);
      const idxB = STAGES.indexOf(b.stage);
      return idxA - idxB;
    });
    
    return timeline;
  }, [historyBlocks, issues, project, stage, STAGES]);

  const availOrigins = useMemo(() => {
    const idx = STAGES.indexOf(stage);
    return idx > 0 ? STAGES.slice(0, idx) : [];
  }, [stage, STAGES]);

  const sortedLoadedIssues = useMemo(() => [...(safeData.loadedIssues || [])].sort(), [safeData.loadedIssues]);
  const sortedAllIds = useMemo(() => Object.keys(latestIssueStates).sort(), [latestIssueStates]);

  const needsEvalSet = useMemo(() => {
    const result = {};
    (safeData.loadedIssues || []).forEach(id => {
      result[id] = true;
    });
    return result;
  }, [safeData.loadedIssues]);

  const carryoverCandidateSet = useMemo(() => {
    const loadedMap = {};
    (safeData.loadedIssues || []).forEach(id => loadedMap[id] = true);
    
    const candidates = {};
    
    // 1. 이번 차수의 조치 사항들(issues)을 제외한, 순수한 이전 차수까지의 최종 상태 맵을 구성
    const prevIssueStates = {};
    const allHistoricalIssues = [...historyBlocks].flatMap(b => b.issues || []);
    
    allHistoricalIssues.forEach(item => {
      if (!item) return;
      const isNewLike = item.entryMode === 'new' || item.entryMode === 'fa';
      const id = isNewLike 
        ? `${item.ipBlock}.${project}.${item.issueNum}` 
        : item.targetIssue;
      if (id) prevIssueStates[id] = item;
    });

    // 2. 이전 차수 최종 상태 기준으로 OPEN/DEFERRED 이고 이번 차수 평가 대상이 아닌 것들을 골라냅니다.
    Object.entries(prevIssueStates).forEach(([id, item]) => {
      const status = getIssueStatus(item);
      if ((status === 'OPEN' || status === 'DEFERRED') && !loadedMap[id]) {
        candidates[id] = true;
      }
    });
    
    return candidates;
  }, [historyBlocks, safeData.loadedIssues, project]);

  const curStageNums = useMemo(() => {
    return issues.filter(i => i.entryMode === 'new' && i.ipBlock === formData.ipBlock).map(i => i.issueNum).sort((a,b)=>a.localeCompare(b));
  }, [issues, formData.ipBlock]);

  // ── IP 변경 시 폼 동기화 (Effect) ──
  useEffect(() => {
    if (!editingId && mode === 'new') {
      const defaultIp = ipDropdown === 'All' ? (overviewData?.IP_Blocks?.[0] || '') : ipDropdown;
      const nextNum = calcNextNum(defaultIp, latestIssueStates);
      setFormData(prev => ({ 
        ...prev, 
        ipBlock: defaultIp,
        issueNum: (prev.ipBlock !== defaultIp || !prev.issueNum) ? nextNum : prev.issueNum
      }));
    }
  }, [ipDropdown, editingId, mode, latestIssueStates, overviewData?.IP_Blocks, setFormData]);


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

      let currentIp = finalData.ipBlock || ipDropdown;
      if (currentIp === 'All') {
        currentIp = overviewData?.IP_Blocks?.[0] || '';
      }
      
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
      const strEditingId = effectiveEditingId ? String(effectiveEditingId) : null;
      
      // [보안/정합성 오디트 반영] 동일 ID의 기존 노드가 있거나, 
      // carryover 또는 eval 모드일 때 동일 targetIssue를 처리하는 다른 노드가 이미 존재한다면 중복 생성을 방지하고 기존 노드를 안전하게 덮어씀 (불변 업데이트)
      let duplicateIndex = -1;
      if (strEditingId) {
        duplicateIndex = issues.findIndex(it => String(it.id) === strEditingId);
      } else if (entry.entryMode === 'carryover' && entry.targetIssue) {
        duplicateIndex = issues.findIndex(it => it.entryMode === 'carryover' && it.targetIssue === entry.targetIssue);
      } else if (entry.entryMode === 'eval' && entry.targetIssue) {
        duplicateIndex = issues.findIndex(it => it.entryMode === 'eval' && it.targetIssue === entry.targetIssue);
      }

      if (duplicateIndex !== -1) {
        const targetNode = issues[duplicateIndex];
        newIssues = newIssues.map((it, idx) => 
          idx === duplicateIndex ? { ...it, ...entry, id: targetNode.id } : it
        );
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
    setSelectedIssueId(null);
    baseResetForm(ipDropdown, calcNextNum(ipDropdown, latestIssueStates));
  }, [showConfirm, ipDropdown, latestIssueStates, baseResetForm, setSelectedIssueId]);


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
    setSelectedIssueId(item.id || issueId);
    initialFormDataRef.current = null;

    if (isEvalTarget) {
      setMode('eval');
      setFormData({
        ...commonFormData,
        entryMode: 'eval',
      });
    } else if (finalStatus === 'CLOSED') {
      setMode('reopen');
      setFormData({
        ...commonFormData,
        entryMode: 'reopen',
        phenomenon: item.phenomenon || '',
        rootCause: item.rootCause || '',
        disposition: 'Revision',
      });
    } else {
      setMode('carryover');
      setFormData({
        ...commonFormData,
        entryMode: 'carryover',
      });
    }
  }, [project, safeData.loadedIssues, ipDropdown, latestIssueStates, setEditingId, setMode, setFormData, setSelectedIssueId]);

  const handleView = useCallback((item) => {
    const isCurrentStage = !item.stage || item.stage === stage;
    const isNewLike = item.entryMode === 'new' || item.entryMode === 'fa';
    const itemIssueId = isNewLike 
      ? `${item.ipBlock}.${project}.${item.issueNum}` 
      : item.targetIssue;

    // [보안/감리]: 과거 차수의 원본 이슈 카드를 상세조회하려고 시도할 때의 리다이렉션 정합성 수립
    if (!isCurrentStage) {
      const isEvalTarget = (safeData.loadedIssues || []).includes(itemIssueId);
      const isCarryoverTarget = !!(carryoverCandidateSet?.[itemIssueId]);
      
      if (isEvalTarget || isCarryoverTarget) {
        handleHistoryCardClick(item);
        return;
      }
    }

    // [버그 수정/헌장 준수]: faId 매칭 조건은 오직 신규 등록군(new/fa)에만 제한 적용함.
    // carryover, eval, reopen과 같은 전용 비즈니스 조치 카드는 faId 보유 여부와 무관하게 본래 탭 모드를 유지함.
    const VALID_MODES = ['eval', 'carryover', 'new', 'fa', 'reopen'];
    const rawMode = item.entryMode;
    const hasValidFa = item.faId && (rawMode === 'new' || rawMode === 'fa');
    const targetMode = (hasValidFa && isCurrentStage) ? 'fa' : rawMode;
    const safeMode = VALID_MODES.includes(targetMode) ? targetMode : 'new';

    setMode(safeMode);
    setEditingId(item.id);
    setSelectedIssueId(item.id || itemIssueId);
    initialFormDataRef.current = { ...item };
    setFormData({ ...item });
  }, [setMode, setEditingId, setFormData, stage, project, safeData.loadedIssues, carryoverCandidateSet, handleHistoryCardClick, setSelectedIssueId]);

  const handleEdit = useCallback((item) => {
    const isCurrentStage = !item.stage || item.stage === stage;
    const isNewLike = item.entryMode === 'new' || item.entryMode === 'fa';
    const itemIssueId = isNewLike 
      ? `${item.ipBlock}.${project}.${item.issueNum}` 
      : item.targetIssue;

    // [보안/감리]: 과거 차수의 원본 이슈 카드를 편집하려고 시도할 때의 리다이렉션 정합성 수립
    if (!isCurrentStage) {
      const isEvalTarget = (safeData.loadedIssues || []).includes(itemIssueId);
      const isCarryoverTarget = !!(carryoverCandidateSet?.[itemIssueId]);
      
      if (isEvalTarget || isCarryoverTarget) {
        handleHistoryCardClick(item);
      } else {
        handleView(item);
      }
      return;
    }

    // [버그 수정/헌장 준수]: faId 매칭 조건은 오직 신규 등록군(new/fa)에만 제한 적용함.
    // carryover, eval, reopen과 같은 전용 비즈니스 조치 카드는 faId 보유 여부와 무관하게 본래 탭 모드를 유지함.
    const VALID_MODES = ['eval', 'carryover', 'new', 'fa', 'reopen'];
    const rawMode = item.entryMode;
    const hasValidFa = item.faId && (rawMode === 'new' || rawMode === 'fa');
    const targetMode = (hasValidFa && isCurrentStage) ? 'fa' : rawMode;
    const safeMode = VALID_MODES.includes(targetMode) ? targetMode : 'new';
    
    setMode(safeMode);
    setEditingId(item.id);
    setSelectedIssueId(item.id || itemIssueId);
    initialFormDataRef.current = { ...item };
    setFormData({ ...item });
  }, [setMode, setEditingId, setFormData, stage, project, safeData.loadedIssues, carryoverCandidateSet, handleHistoryCardClick, handleView, setSelectedIssueId]);



  const handleTabSwitch = useCallback(async (newMode) => {
    if (mode === newMode) return;
    
    // [보안/감리] 수정 중이던 신규 작성 중이던 폼에 변경사항(Dirty)이 있으면 반드시 작성 취소 확인창 기동
    if (isDirtyRef.current) {
      const confirmed = await showConfirm({
        title: "작성 취소",
        message: "작성 중인 내용이 있습니다. 저장하지 않고 정말 취소하시겠습니까?",
        type: "warning"
      });
      if (!confirmed) return;
    }
    
    // 탭 전환 시 폼 상태 및 editingId를 완벽히 씻어내어 신규 등록 목록 Overwrite 버그를 근본적으로 차단
    baseResetForm(ipDropdown, calcNextNum(ipDropdown, latestIssueStates));
    setSelectedIssueId(null);
    initialFormDataRef.current = null;

    setMode(newMode);
  }, [mode, showConfirm, ipDropdown, latestIssueStates, baseResetForm, setMode, setSelectedIssueId]);

  const handleIpChange = useCallback(async (newIp) => {
    if (ipDropdown === newIp) return;
    setIpDropdown(newIp);
    setSelectedIssueId(null);
    baseResetForm(newIp, calcNextNum(newIp, latestIssueStates));
  }, [ipDropdown, setIpDropdown, setSelectedIssueId, baseResetForm, latestIssueStates]);

  const handleDeleteRequest = useCallback(async (item) => {
    // [보안 가드] 삭제 작업도 executeSafe로 관리
    await executeSafe(async (signal) => {
      const isSpecialMode = item.entryMode === 'eval' || item.entryMode === 'carryover' || item.entryMode === 'reopen';
      // 🚨 [보안/정합성] 이전 차수에서 연동되어 이월된 이슈는 이번 차수에서 'FA 연동 해제'를 시도할 수 없음!
      const isCurrentStage = !item.stage || item.stage === stage;
      
      // [버그 수정/헌장 준수]: faId 매칭을 통한 해제 대상은 이번 차수 신규/FA 등록군에 한함.
      // carryover나 eval 조치 카드는 faId가 존재하더라도 연동 해제 대상이 아니라 판정(조치) 초기화 대상임!
      const isFaLinkDeletable = item.faId && isCurrentStage && (item.entryMode === 'new' || item.entryMode === 'fa');

      const confirmed = await showConfirm({
        title: isFaLinkDeletable ? "FA 연동 해제" : (isSpecialMode ? "조치 내용 초기화" : "이슈 삭제"),
        message: isFaLinkDeletable ? "연동을 해제하고 FA 리포트를 미연동 상태로 되돌리시겠습니까?" : (isSpecialMode ? "평가 및 대응 방안을 초기화하시겠습니까?" : "등록된 신규 이슈를 삭제하시겠습니까?"),
        type: "danger",
        confirmText: isFaLinkDeletable ? "FA 연동 해제" : (isSpecialMode ? "조치 초기화" : "완전 삭제")
      });

      if (confirmed) {
        const newIssues = issues.filter(it => String(it.id) !== String(item.id));
        
        if (onSubmit) await onSubmit({ ...safeData, issues: newIssues }, signal);
        
        // 이번 차수에서 새로 등록된 FA 연동 건만 실제 미연동 상태로 복귀시킴
        if (isFaLinkDeletable) {
          markFaLinkState(item.faId, false);
        }
        
        if (editingId && String(editingId) === String(item.id)) cancelEdit(true);
      }
    });
  }, [showConfirm, project, issues, onSubmit, safeData, markFaLinkState, editingId, cancelEdit, executeSafe, stage]);

  const handleReset = useCallback(async (id) => {
    const item = issues.find(it => String(it.id) === String(id));
    if (item) {
      await handleDeleteRequest(item);
    }
  }, [issues, handleDeleteRequest]);


  const confirmAssigneeChange = () => {
    if (assigneeModal.newAssignee) {
      const val = formData.assignee ? `${formData.assignee}, ${assigneeModal.newAssignee}` : assigneeModal.newAssignee;
      handleFormChange({ ...formData, assignee: val }, initialFormDataRef.current);
    }
    setAssigneeModal({ open: false, newAssignee: '' });
  };


  const handleLock = async () => {
    const unmanagedEvals = (safeData.loadedIssues || []).filter(id => !issues.some(i => i.entryMode === 'eval' && i.targetIssue === id));
    const unmanagedCarryovers = issues.filter(i => i.entryMode === 'carryover' && i.carryoverStatus === 'OPEN');
    
    if (unmanagedEvals.length > 0 || unmanagedCarryovers.length > 0) {
      let msg = "";
      if (unmanagedEvals.length > 0) msg += `• 평가되지 않은 이전 차수 유보 건: ${unmanagedEvals.length}건\n`;
      if (unmanagedCarryovers.length > 0) msg += `• 조치되지 않은 자동 이월 건: ${unmanagedCarryovers.length}건\n`;
      msg += "\n아직 평가/조치가 완료되지 않은 항목이 있습니다. 이대로 편집을 완료하고 저장 및 잠금 처리하시겠습니까?";

      const confirmed = await showConfirm({
        title: "미완료 조치 항목 존재",
        message: msg,
        type: "warning",
        confirmText: "저장 및 잠금",
        cancelText: "편집 계속하기"
      });

      if (!confirmed) return; // 저장 취소
    }

    if (onSubmit) onSubmit(safeData);
    clearAutoSave(projectId, 'Revision_Log');
    setIsTabEditing(false);
    setSelectedIssueId(null);
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
          <ActionBar
            isGlobalArchived={isArchived}
            isEditing={isTabEditing}
            onEdit={() => setIsTabEditing(true)}
            onLock={handleLock}
            disableLock={false}
            disableReason=""
            lockReason={lockReason}
            onForceUnlock={onForceUnlock}
          />
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 items-stretch">
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-center h-full">
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

        <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center overflow-x-auto whitespace-nowrap h-full scrollbar-hide">
          <div className="flex flex-row items-center gap-2 w-full">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1.5">IP 선택</span>
            <button
              onClick={() => handleIpChange('All')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 shrink-0 border ${
                ipDropdown === 'All'
                  ? 'bg-blue-50 text-blue-600 border-blue-200 font-bold shadow-sm'
                  : 'bg-slate-50/50 text-slate-600 border-slate-200/80 hover:bg-slate-100/50 hover:border-slate-300'
              }`}
            >
              <span>All</span>
              <span className={`w-1.5 h-1.5 rounded-full ${ipDropdown === 'All' ? 'bg-blue-500' : 'border border-slate-400'}`} />
            </button>
            {availableIps.filter(ip => ip !== 'All' && ip !== 'Common').map(ip => {
              const isSelected = ipDropdown === ip;
              const hasIssues = issues.some(i => i.entryMode === 'new' && i.ipBlock === ip);
              return (
                <button
                  key={ip}
                  onClick={() => handleIpChange(ip)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 shrink-0 border ${
                    isSelected
                      ? 'bg-blue-50 text-blue-600 border-blue-200 font-bold shadow-sm'
                      : 'bg-slate-50/50 text-slate-600 border-slate-200/80 hover:bg-slate-100/50 hover:border-slate-300'
                  }`}
                >
                  <span>{ip}</span>
                  {hasIssues ? (
                    <Check size={11} className={isSelected ? 'text-blue-500' : 'text-slate-400'} />
                  ) : (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-blue-500' : 'border border-slate-400'}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="min-w-0 overflow-hidden">
          {(!selectedIssueId && !editingId && !isTabEditing) ? (
            <InitialEmptyDashboard stats={stats} stage={stage} />
          ) : (!selectedIssueId && !isTabEditing && (mode === 'eval' || mode === 'carryover' || mode === 'new' || mode === 'fa' || mode === 'reopen')) ? (
            <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center h-full min-h-[400px] transition-all duration-300">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                <Lock size={20} className="text-blue-500 animate-pulse" />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-2">편집 모드 활성화 필요</h3>
              <p className="text-sm text-slate-500 max-w-[320px] leading-relaxed mb-6">
                선택하신 기능은 읽기 전용 상태입니다.<br />
                신규 이슈 등록이나 조치/평가 내역을 작성하시려면 상단의 <strong>'편집 시작'</strong> 버튼을 클릭해 주세요.
              </p>
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-50/50 border border-blue-100 text-xs font-semibold text-blue-600">
                <span>🔒 상단의 '편집 시작' 버튼을 먼저 클릭해 주세요</span>
              </div>
            </div>
          ) : (
            <IssueForm
              key={mode + (editingId || 'new') + (formData.faId || '') + formResetKey}
              initialData={formData}
              mode={mode}
              editingId={editingId}
              isReadOnly={isReadOnly || (formData && formData.stage && formData.stage !== stage)}
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
              onReset={handleReset}
            />
          )}
        </div>

        <div className="bg-gray-50 rounded-xl border border-gray-200 flex flex-col h-[calc(100vh-12rem)] overflow-y-auto">
          <div className="sticky top-0 z-20 bg-gray-50 rounded-t-xl px-5 pt-5 pb-3 mb-3 border-b border-gray-200 flex flex-row items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-gray-800 m-0 whitespace-nowrap shrink-0">
              <FileText size={16} className="text-gray-600" /> Current - {stage}
            </h2>
            <div className="flex flex-row items-center gap-2 shrink-0 overflow-x-auto ml-6 p-0.5 select-none">
              {[
                {
                  key: 'ALL',
                  label: 'Total',
                  value: stats.total,
                  activeClass: 'border-slate-300 bg-slate-100 text-slate-800 font-bold',
                  inactiveClass: 'border-slate-200/80 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700',
                  labelActiveColor: 'text-slate-500',
                  valueActiveColor: 'text-slate-800'
                },
                {
                  key: 'OPEN',
                  label: 'Open',
                  value: stats.open,
                  activeClass: 'border-orange-300 bg-orange-50 text-orange-700 font-bold',
                  inactiveClass: 'border-slate-200/80 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700',
                  labelActiveColor: 'text-orange-500',
                  valueActiveColor: 'text-orange-700'
                },
                {
                  key: 'DEF',
                  label: 'Def',
                  value: stats.deferred,
                  activeClass: 'border-blue-300 bg-blue-50 text-blue-700 font-bold',
                  inactiveClass: 'border-slate-200/80 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700',
                  labelActiveColor: 'text-blue-500',
                  valueActiveColor: 'text-blue-700'
                },
                {
                  key: 'CLOSED',
                  label: 'Closed',
                  value: stats.closed,
                  activeClass: 'border-green-300 bg-green-50 text-green-700 font-bold',
                  inactiveClass: 'border-slate-200/80 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700',
                  labelActiveColor: 'text-green-600',
                  valueActiveColor: 'text-green-700'
                }
              ].map((item) => {
                const isSelected = statusFilter === item.key;
                const isOpenDebtBadge = item.key === 'OPEN';
                return (
                  <button
                    key={item.key}
                    onClick={() => setStatusFilter(item.key)}
                    className={`group h-8 inline-flex items-center px-3 py-1 rounded-lg border shadow-sm transition-all duration-150 text-xs shrink-0 select-none cursor-pointer ${
                      isOpenDebtBadge ? 'relative cursor-help' : ''
                    } ${
                      isSelected ? item.activeClass : item.inactiveClass
                    }`}
                  >
                    <span
                      className={`text-[10px] tracking-widest uppercase font-bold transition-colors duration-150 ${
                        isSelected ? item.labelActiveColor : 'text-slate-400 group-hover:text-slate-600'
                      }`}
                    >
                      {item.label}
                    </span>
                    <span
                      className={`font-mono text-xs font-bold ml-1.5 transition-colors duration-150 ${
                        isSelected ? item.valueActiveColor : 'text-slate-600 group-hover:text-slate-800'
                      }`}
                    >
                      {item.value}
                    </span>
                    {isOpenDebtBadge && (
                      <DebtDetailsPopover details={stats.debtDetails} totalDebt={stats.open} />
                    )}
                  </button>
                );
              })}
              <div className="w-px h-3.5 bg-slate-200 mx-1.5 shrink-0" />
              <button
                onClick={() => setHistoryModalOpen(true)}
                className="flex items-center h-8 gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3.5 rounded-lg font-semibold text-xs transition-colors shadow-sm shrink-0"
              >
                <Activity size={12} />
                <span>리포트</span>
              </button>
            </div>
          </div>
          <div className="px-5 pb-5 flex-1">
            <div className="space-y-2">
              <RevisionLogVirtualList
                issues={issues}
                safeData={safeData}
                onShowHistoryReport={handleShowHistoryReport}
                project={project}
                ipDropdown={ipDropdown}
                statusFilter={statusFilter}
                needsEvalSet={needsEvalSet}
                carryoverCandidateSet={carryoverCandidateSet}
                sortedIssues={sortedIssues}
                historyBlocks={historyBlocks}
                isReadOnly={isReadOnly}
                editingId={editingId}
                activeTargetIssue={formData?.targetIssue || null}
                stage={stage}
                handlers={{
                  handleHistoryCardClick,
                  handleView,
                  handleEdit,
                  handleDeleteRequest
                }}
                latestIssueStates={latestIssueStates}
              />
          </div>

          {/* 마일스톤 품질 리포트 요약 테이블 연동 */}
          <MilestoneMetricsTable stats={allStats} />
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
