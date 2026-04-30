import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { FileText, AlertCircle, Edit2, Trash2, CheckCircle, FolderOpen, Activity, Plus, X, Eye, RefreshCw, Lock, Link, AlertTriangle, ChevronDown, ChevronRight, Archive } from 'lucide-react';
import IssueSummaryCard, { getIssueStatus } from '../IssueSummaryCard';
import ActionBar from '../ActionBar';
import { useAutoSave, clearAutoSave } from '../../hooks/useAutoSave';
import AutoSaveRecoveryModal from '../AutoSaveRecoveryModal';

const lc = "block text-[13px] font-medium text-gray-600 mb-1.5";
const ic = "px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed";
const tc = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 resize-y focus:border-blue-500 focus:ring-1 outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed disabled:resize-none";

const DISPOSITION_OPTIONS = ['Waived', 'Acceptable', 'SW Workaround', 'Test Screening', 'System Mitigation', 'Revision'];

const CustomerAlignmentFields = ({ formData, handleInput, lc, ic, tc, disabled = false }) => (
  <div className="border border-indigo-100 rounded-xl p-4 bg-slate-50 space-y-3">
    <h3 className="text-sm font-bold text-indigo-900 border-b border-indigo-100 pb-2 flex items-center gap-1.5"><FolderOpen size={14} className="text-indigo-500" /> Customer Alignment</h3>
    <div><label className={lc}>Alignment Status</label><select name="customerAlignment" value={formData.customerAlignment} onChange={handleInput} disabled={disabled} className={`w-full ${ic}`}><option value="Internal Only">Internal Only (내부 이슈)</option><option value="Pending">Pending (고객 공유 대기/논의 중)</option><option value="Aligned">Aligned (고객 합의 완료)</option></select></div>
    {formData.customerAlignment !== 'Internal Only' && (
      <>
        <div className="flex gap-2">
          <div className="w-1/2"><label className={lc}>Report Type</label><select name="customerReportType" value={formData.customerReportType} onChange={handleInput} className={`w-full ${ic}`}><option value="N/A">N/A</option><option value="Transparent">Transparent</option><option value="Sanitized">Sanitized</option></select></div>
          <div className="w-1/2"><label className={lc}>Customer Report Doc Link</label><input type="text" name="customerFacingAttachments" value={formData.customerFacingAttachments} onChange={handleInput} className={`w-full ${ic}`} placeholder="고객 리포트 링크" /></div>
        </div>
        {formData.customerReportType === 'Sanitized' && <div><label className={lc}>Sanitized Story/Message</label><textarea name="sanitizedStory" value={formData.sanitizedStory} onChange={handleInput} className={tc} rows="2" placeholder="고객에게 제공할 마사지된 사유 기재"></textarea></div>}
        <div><label className={lc}>Customer Alignment Details / Notes</label><textarea name="customerAlignmentDetails" value={formData.customerAlignmentDetails} onChange={handleInput} className={tc} rows="2" placeholder="고객과의 합의 내용 요약 (메일/회의록 링크 포함)"></textarea></div>
      </>
    )}
  </div>
);

export default function RevisionLogTab({ data, overviewData, currentRevision, isArchived, projectId, dbUpdatedAt, onSubmit, onImmediateUpdate, faReportData, onFaReportUpdate, onEditingStateChange }) {
  // Safe defaults
  const safeData = data || { issues: [], historyBlocks: [], loadedIssues: [], initialMode: 'new' };
  const issues = safeData.issues || [];
  const historyBlocks = safeData.historyBlocks || [];
  const project = overviewData?.Project_Name || 'Proj';
  const stage = currentRevision || 'EVT0';

  const [mode, setMode] = useState(safeData.initialMode || 'new');
  const [editingId, setEditingId] = useState(null);
  
  const STAGES = ['EVT0', 'EVT1', 'EVT2', 'EVT3', 'DVT', 'PVT', 'MP'];

  const validIps = useMemo(() => new Set(overviewData?.IP_Blocks || []), [overviewData?.IP_Blocks]);
  const availableIps = useMemo(() => {
    const s = new Set(validIps);
    let hasOrphans = false;
    issues?.forEach(i => { if (i?.ipBlock && !validIps.has(i.ipBlock)) hasOrphans = true; });
    historyBlocks?.forEach(b => b?.issues?.forEach(i => { if (i?.ipBlock && !validIps.has(i.ipBlock)) hasOrphans = true; }));
    const arr = Array.from(s).sort();
    if (hasOrphans) arr.push('Deleted IP (Orphan)');
    return arr;
  }, [validIps, issues, historyBlocks]);

  const [ipDropdown, setIpDropdown] = useState(availableIps[0] || 'Buck');
  const currentSelectedIp = ipDropdown;
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [expandedSections, setExpandedSections] = useState({
    actionRequired: true,
    newFindings: true,
    stillOpen: true,
    resolved: false
  });
  const toggleSection = (key) => setExpandedSections(p => ({ ...p, [key]: !p[key] }));

const makeDefaultForm = (ip) => ({
  ipBlock: ip, entryMode: 'new', issueNum: '', types: ['Initial'], severity: 'Minor',
  phenomenon: '', rootCause: '', disposition: 'Revision', justification: '', modPlan: '',
  customerAlignment: 'Internal Only', customerReportType: 'N/A', sanitizedStory: '',
  customerFacingAttachments: '', customerAlignmentDetails: '', attachments: '', assignee: '',
  origin: '', escapeReason: '', sideEffectSource: ''
});

  const [formData, setFormData] = useState(makeDefaultForm(currentSelectedIp, stage));
  // expandedHistoryItems → IssueCard 내부 상태로 이전됨
  const [deleteModal, setDeleteModal] = useState(null);
  const [assigneeModal, setAssigneeModal] = useState({ open: false, newAssignee: '' });
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyTargetId, setHistoryTargetId] = useState('');
  const [pullFaModalOpen, setPullFaModalOpen] = useState(false);
  const [selectedFaForPull, setSelectedFaForPull] = useState(null);
  const [cancelConfirmModal, setCancelConfirmModal] = useState(false);

  // ── 탭 로컬 편집 상태 (ProjectOverviewTab의 unlockedOverview와 동일한 패턴) ──
  const [isTabEditing, setIsTabEditing] = useState(false);
  // isReadOnly: 전역 잠금(isArchived) 또는 로컬 잠금(!isTabEditing) 중 하나라도 true면 읽기 전용
  const isReadOnly = isArchived || !isTabEditing;

  useEffect(() => {
    if (onEditingStateChange) onEditingStateChange(isTabEditing);
  }, [isTabEditing, onEditingStateChange]);

  // FA Pull 시 useEffect의 폼 초기화를 막기 위한 ref
  const pendingFaPullDataRef = useRef(null);

  // 현재 IP에서 미연동 FA 목록
  const unlinkedFasForCurrentIp = useMemo(() => {
    const reports = faReportData?.faReports || [];
    return reports.filter(f => f.ipBlock === currentSelectedIp && !f.isLinkedToLog);
  }, [faReportData, currentSelectedIp]);

  const hasUnlinkedFa = unlinkedFasForCurrentIp.length > 0;

  // ─── 지능형 Auto-Save ───
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

  // Dropdown states for conditional rendering
  const [originSelVal, setOriginSelVal] = useState('');
  const [sideSelVal, setSideSelVal] = useState('');

  useEffect(() => {
    // IP 탭 선택 변경 시: 편집 중이 아니고 new 모드일 때만 ipBlock 업데이트
    if (!editingId && mode === 'new') {
      setFormData(prev => ({ ...prev, ipBlock: currentSelectedIp }));
    }
  }, [currentSelectedIp, editingId, mode]);

  // ── pendingFaPullDataRef: handlePullFa에서 직접 setFormData를 호출하므로 이 effect는 불필요
  // mode 변경 시 자동 초기화 useEffect를 제거하여 경쟁 조건(race condition)을 원천 차단합니다.
  // 폼 초기화는 각 액션(handleTabSwitch, handleSave, cancelEdit)에서 명시적으로 수행합니다.

  const latestIssueStates = useMemo(() => {
    const s = {};
    const chron = [...historyBlocks].flatMap(b => b.issues).concat(issues);
    chron.forEach(item => {
      const id = item?.entryMode === 'new' ? `${item.ipBlock}.${project}.${item.issueNum}` : item?.targetIssue;
      if (id) s[id] = item;
    });
    return s;
  }, [historyBlocks, issues, project]);

  const stats = useMemo(() => {
    let total = 0, open = 0, closed = 0, deferred = 0;
    Object.values(latestIssueStates || {}).forEach(item => {
      const ip = item?.entryMode === 'new' ? item?.ipBlock : (item?.targetIssue ? item.targetIssue.split('.')[0] : '');
      const mappedIp = validIps.has(ip) ? ip : 'Deleted IP (Orphan)';
      if (ipDropdown === 'All' || mappedIp === ipDropdown) {
        total++;
        const status = getIssueStatus(item);
        if (status === 'DEFERRED') deferred++;
        else if (status === 'OPEN') open++;
        else if (status === 'CLOSED') closed++;
      }
    });
    return { total, open, closed, deferred };
  }, [latestIssueStates, ipDropdown, validIps]);

  const closedIssues = useMemo(() => {
    const fixedThisStage = new Set(
      issues.filter(i => i.entryMode === 'eval' && i.assessment === 'Fixed').map(i => i.targetIssue)
    );
    const closed = [];
    Object.entries(latestIssueStates).forEach(([id, st]) => {
      if (getIssueStatus(st) === 'CLOSED' && !fixedThisStage.has(id)) closed.push(id);
    });
    return closed.sort();
  }, [latestIssueStates, issues]);

  const sortedRevIds = useMemo(() => {
    return Object.keys(latestIssueStates).sort();
  }, [latestIssueStates]);

  const availOrigins = useMemo(() => {
    const idx = STAGES.indexOf(stage);
    return idx > 0 ? STAGES.slice(0, idx) : [];
  }, [stage]);

  const sortedIssues = useMemo(() => {
    return [...issues].sort((a, b) => {
      const isNewLike = (m) => m === 'new' || m === 'fa';
      const idA = isNewLike(a?.entryMode) ? `${a?.ipBlock}.${project}.${a?.issueNum}` : a?.targetIssue;
      const idB = isNewLike(b?.entryMode) ? `${b?.ipBlock}.${project}.${b?.issueNum}` : b?.targetIssue;
      const ipA = isNewLike(a?.entryMode) ? a?.ipBlock : (a?.targetIssue ? a.targetIssue.split('.')[0] : '');
      const ipB = isNewLike(b?.entryMode) ? b?.ipBlock : (b?.targetIssue ? b.targetIssue.split('.')[0] : '');

      const mappedIpA = validIps.has(ipA) ? ipA : 'Deleted IP (Orphan)';
      const mappedIpB = validIps.has(ipB) ? ipB : 'Deleted IP (Orphan)';

      if (ipDropdown === 'All') {
        if (mappedIpA !== mappedIpB) return mappedIpA.localeCompare(mappedIpB);
      }

      if (a.entryMode !== b.entryMode) return a.entryMode === 'eval' ? -1 : (a.entryMode === 'new' ? 0 : 1);
      return idA.localeCompare(idB);
    });
  }, [issues, project, ipDropdown, validIps]);

  const sortedLoadedIssues = useMemo(() => [...(safeData.loadedIssues || [])].sort(), [safeData.loadedIssues]);
  const sortedAllIds = useMemo(() => Object.keys(latestIssueStates).sort(), [latestIssueStates]);

  const needsEvalSet = useMemo(() => {
    const evalledIds = new Set(issues.filter(i => i.entryMode === 'eval').map(i => i.targetIssue));
    return new Set((safeData.loadedIssues || []).filter(id => !evalledIds.has(id)));
  }, [issues, safeData.loadedIssues]);

  const carryoverCandidateSet = useMemo(() => {
    const loadedSet = new Set(safeData.loadedIssues || []);
    const actedIds = new Set(issues.filter(i => i.entryMode === 'carryover').map(i => i.targetIssue));
    const candidates = new Set();
    if (historyBlocks.length === 0) return candidates;
    const lastBlk = historyBlocks[historyBlocks.length - 1];
    lastBlk.issues.forEach(item => {
      const id = item.entryMode === 'new' ? `${item.ipBlock}.${project}.${item.issueNum}` : item.targetIssue;
      if (!id) return;
      const status = getIssueStatus(item);
      if ((status === 'OPEN' || status === 'DEFERRED') && !loadedSet.has(id) && !actedIds.has(id)) {
        candidates.add(id);
      }
    });
    return candidates;
  }, [historyBlocks, safeData.loadedIssues, issues, project]);

  const getHistory = (id) => {
    const list = [];
    historyBlocks.forEach(b => {
      b.issues.forEach(i => {
        const iId = i.entryMode === 'new' ? `${i.ipBlock}.${project}.${i.issueNum}` : i.targetIssue;
        if (iId === id) list.push({ stage: b.stageName, data: i });
      });
    });
    issues.forEach(i => {
      const iId = i.entryMode === 'new' ? `${i.ipBlock}.${project}.${i.issueNum}` : i.targetIssue;
      if (iId === id) list.push({ stage: stage, data: i });
    });
    return list;
  };

  const calcNextNum = (ip) => {
    let max = 0;
    const chk = (id) => { if (!id) return; const pts = id.split('.'); if (pts[0] === ip) { const m = id.match(/#(\d+)/); if (m) { const n = parseInt(m[1]); if (n > max) max = n; } } };
    Object.keys(latestIssueStates).forEach(id => chk(id));
    return `ISSUE#${max + 1}`;
  };

  const curStageNums = useMemo(() => {
    return issues.filter(i => i.entryMode === 'new' && i.ipBlock === formData.ipBlock).map(i => i.issueNum).sort((a,b)=>a.localeCompare(b));
  }, [issues, formData.ipBlock]);

  const isSaveDisabled = useMemo(() => {
     if (isArchived && !editingId) return true;
     if (mode === 'eval') return !formData.targetIssue || !formData.assessment || !(formData.comment?.trim());
     if (mode === 'carryover') {
       if (!formData.targetIssue || !formData.carryoverAction) return true;
       if (formData.carryoverAction === 'Close' && (!formData.comment || formData.comment.trim() === '')) return true;
       return false;
     }
     if (mode === 'reopen') return !formData.targetIssue || !formData.reopenReason;
     
     // [mode === 'new' 또는 'fa'] 공통 필수 필드 체크
     const hasRequiredFields = formData.ipBlock && formData.issueNum && formData.phenomenon?.trim() && formData.rootCause?.trim();
     return !hasRequiredFields;
  }, [mode, formData, isArchived, editingId]);

  const handleUpdate = useCallback((newIssues) => {
    const updatedData = { ...safeData, issues: newIssues };
    if (onImmediateUpdate) onImmediateUpdate(updatedData);
  }, [safeData, onImmediateUpdate]);

  const SEVERITY_FA_MAP = { S1: 'Fail', S2: 'Major', S3: 'Minor' };
  const handlePullFa = (fa) => {
    if (stage === 'EVT0' && fa.disposition === 'Revision') {
      alert("해당 이슈는 Hardware Revision이 필요하므로 EVT1 차수에서 등록해야 합니다. Revision Up을 먼저 진행해 주세요.");
      return;
    }
    const phenText = `[FA 연동: ${fa.faId}]\n• Customer: ${fa.customer || ''}${fa.custStage ? ` (${fa.custStage})` : ''}\n• Phenomenon: ${fa.phenomenon || ''}`;

    const fillData = {
      ...makeDefaultForm(fa.ipBlock),
      ipBlock: fa.ipBlock,
      entryMode: 'fa',
      issueNum: calcNextNum(fa.ipBlock),
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
    };

    // 경쟁 조건 방지: ref 방식 제거, 직접 상태 업데이트
    // IP 드롭다운을 FA의 IP로 먼저 동기화
    if (fa.ipBlock && fa.ipBlock !== ipDropdown) {
      setIpDropdown(fa.ipBlock);
    }
    setEditingId(null);
    setSelectedFaForPull(fa);
    setFormData(fillData);  // ← 직접 주입 (useEffect 경쟁 없음)
    setMode('fa');          // ← mode 마지막에 변경 (IP useEffect는 mode!=='new'라 무시)
    setPullFaModalOpen(false);
  };

  const markFaLinkState = useCallback((faId, linked) => {
    if (!faReportData || !onFaReportUpdate) return;
    const updatedReports = (faReportData.faReports || []).map(f =>
      f.faId === faId ? { ...f, isLinkedToLog: linked } : f
    );
    onFaReportUpdate({ ...faReportData, faReports: updatedReports });
  }, [faReportData, onFaReportUpdate]);

  const handleUnlinkFa = (e) => {
    e.preventDefault();
    if (!formData.faId) return;
    markFaLinkState(formData.faId, false);
    setFormData(p => ({
      ...p,
      faId: '',
      faReportId: '',
      faCustomer: ''
    }));
    setSelectedFaForPull(null);
  };

  const handleSave = () => {
    if (isArchived && editingId) {
      setEditingId(null);
      setFormData(makeDefaultForm(currentSelectedIp, stage));
      return;
    }

    if (!editingId && formData.faId) {
       const isDuplicate = issues.some(issue => issue.faId === formData.faId);
       if (isDuplicate) {
          alert("이미 연동된 FA 리포트입니다.");
          return;
       }
    }
    
    // FA에서 온 데이터의 entryMode를 'new'로 정제화
    // ipBlock은 formData에 이미 fa.ipBlock으로 설정되어 있음
    let entry = {
      ...formData,
      entryMode: (mode === 'fa') ? 'new' : mode,
      ipBlock: formData.ipBlock || currentSelectedIp,  // FA IP 보장
      stage: stage
    };
    
    if (mode === 'carryover') {
       entry.carryoverStatus = 'RESOLVED';
       if (entry.carryoverAction === 'Keep Open') {
       } else if (entry.carryoverAction === 'Revision') {
          entry.disposition = 'Revision';
       }
    }
    
    let newIssues = [...issues];
    
    if (editingId) {
      newIssues = newIssues.map(it => it.id === editingId ? { ...it, ...entry } : it);
    } else {
      entry.id = Date.now();
      newIssues.push(entry);
    }

    const currentIp = formData.ipBlock || currentSelectedIp;

    handleUpdate(newIssues);
    if (onSubmit) onSubmit({ ...safeData, issues: newIssues });

    if (selectedFaForPull) {
      markFaLinkState(selectedFaForPull.faId, true);
      setSelectedFaForPull(null);
    }

    // 폼 초기화: mode 변경 없이 직접 초기화하여 useEffect 트리거 방지
    setEditingId(null);
    setFormData(makeDefaultForm(currentIp));
    // mode는 'fa' 저장 후 'new'로 복구 (단, useEffect가 폼을 다시 초기화하지 않도록
    // makeDefaultForm을 먼저 호출한 뒤 mode를 변경)
    if (mode === 'fa') {
      // setTimeout으로 다음 렌더 사이클에 mode 변경 → 폼 초기화가 이미 완료된 상태
      setTimeout(() => setMode('new'), 0);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData(makeDefaultForm(currentSelectedIp));
  };

  const availableDispositions = stage === 'EVT0' && mode === 'new'
    ? DISPOSITION_OPTIONS.filter(opt => opt !== 'Revision')
    : DISPOSITION_OPTIONS;

  const handleEdit = (item) => {
    setMode(item.faId ? 'fa' : item.entryMode);
    setEditingId(item.id);
    setFormData({ ...item });
  };

  const handleView = (item) => {
    setMode(item.faId ? 'fa' : item.entryMode);
    setEditingId(item.id);
    setFormData({ ...item });
  };

  const handleHistoryCardClick = (item) => {
    const issueId = item.entryMode === 'new'
      ? `${item.ipBlock}.${project}.${item.issueNum}`
      : item.targetIssue;
    const finalStatus = getIssueStatus(item);
    const isEvalTarget = (safeData.loadedIssues || []).includes(issueId);

    if (finalStatus === 'CLOSED') {
      setMode('reopen');
      setEditingId(null);
      setFormData({
        ...makeDefaultForm(item.ipBlock || currentSelectedIp),
        entryMode: 'reopen',
        targetIssue: issueId,
        severity: item.severity || 'Major',
        phenomenon: item.phenomenon || '',
        rootCause: item.rootCause || '',
        disposition: 'Revision',
      });
    } else if (isEvalTarget) {
      setMode('eval');
      setEditingId(null);
      setFormData({
        ...makeDefaultForm(item.ipBlock || currentSelectedIp),
        entryMode: 'eval',
        targetIssue: issueId,
        ipBlock: item.ipBlock || currentSelectedIp,
        severity: item.severity,
      });
    } else {
      setMode('carryover');
      setEditingId(null);
      setFormData({
        ...makeDefaultForm(item.ipBlock || currentSelectedIp),
        entryMode: 'carryover',
        targetIssue: issueId,
      });
    }
  };

  const handleTabSwitch = (newMode) => {
    // 명시적 탭 전환: 폼 초기화 → mode 변경
    setEditingId(null);
    setSelectedFaForPull(null);
    setFormData(makeDefaultForm(currentSelectedIp));
    setMode(newMode);
    // FA 탭 진입 시 편집 모드 자동 활성화 (isReadOnly 차단 방지)
    if (newMode === 'fa' && !isTabEditing) {
      setIsTabEditing(true);
    }
  };

  const confirmDelete = () => {
    if (!deleteModal) return;
    const newIssues = issues.filter(it => it.id !== deleteModal.id);
    handleUpdate(newIssues);
    if (onSubmit) onSubmit({ ...safeData, issues: newIssues });
    if (deleteModal.faId) {
      markFaLinkState(deleteModal.faId, false);
    }
    setDeleteModal(null);
    if (editingId === deleteModal.id) cancelEdit();
  };

  const handleInput = (e) => {
    const { name, value } = e.target;
    setFormData(p => ({ ...p, [name]: value }));
  };

  const handleTypeToggle = (t) => {
    setFormData(p => {
      const cur = p.types || [];
      return { ...p, types: cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t] };
    });
  };

  const confirmAssigneeChange = () => {
    if (assigneeModal.newAssignee) {
      const val = formData.assignee ? `${formData.assignee}, ${assigneeModal.newAssignee}` : assigneeModal.newAssignee;
      setFormData(p => ({ ...p, assignee: val }));
    }
    setAssigneeModal({ open: false, newAssignee: '' });
  };



  const renderHistoricalContext = (id) => {
    const h = getHistory(id);
    if (h.length === 0) return null;
    const prev = h.length > 1 ? h[h.length - 2] : null;
    const cur = h[h.length - 1];
    
    return (
      <div className="mt-2 bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs space-y-1">
        <div className="font-bold text-slate-700 mb-1 flex items-center gap-1.5"><Activity size={12}/> Historical Context</div>
        {prev && <div className="text-slate-500 truncate"><span className="font-semibold">[{prev.stage}]</span> {prev.data.disposition || prev.data.assessment || 'N/A'} - {prev.data.phenomenon || prev.data.comment || 'N/A'}</div>}
        <div className="text-slate-800 font-medium truncate"><span className="font-semibold text-blue-600">[{cur.stage} - 최신]</span> {cur.data.disposition || cur.data.assessment || 'N/A'} - {cur.data.phenomenon || cur.data.comment || cur.data.reopenReason || 'N/A'}</div>
      </div>
    );
  };



  const handleLock = () => {
    if (onSubmit) onSubmit(safeData);
    clearAutoSave(projectId, 'Revision_Log');
    setIsTabEditing(false);
    setEditingId(null);
    setFormData(makeDefaultForm(currentSelectedIp));
  };

  return (
    <div className="space-y-4 max-w-full">
      <AutoSaveRecoveryModal 
        isOpen={showRecoveryModal} 
        timestamp={recoveredTime} 
        onRestore={handleRestore} 
        onDiscard={handleDiscard} 
      />
      <div className="flex justify-between items-center pb-4 border-b border-slate-200 mb-6">
        <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
          <FileText size={28} className="text-blue-600" />
          Revision Log
          {isArchived && <span className="text-xs px-2 py-1 bg-slate-100 text-slate-500 rounded font-bold ml-1">Read-Only</span>}
        </h1>
        <div className="shrink-0">
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
              <button onClick={() => handleTabSwitch('eval')} disabled={stage === 'EVT1'} className={`flex-1 py-1.5 rounded-md font-medium text-sm transition-colors ${mode === 'eval' ? 'bg-white shadow text-blue-600 border-t-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'} ${stage === 'EVT1' ? 'opacity-50 cursor-not-allowed' : ''}`}>이전 차수 수정 평가</button>
              <button onClick={() => handleTabSwitch('carryover')} disabled={stage === 'EVT1'} className={`flex-1 py-1.5 rounded-md font-medium text-sm transition-colors ${mode === 'carryover' ? 'bg-white shadow text-purple-600 border-t-2 border-purple-500' : 'text-gray-500 hover:text-gray-700'} ${stage === 'EVT1' ? 'opacity-50 cursor-not-allowed' : ''}`}>자동 이월 이슈 관리</button>
              <button onClick={() => handleTabSwitch('new')} className={`flex-1 py-1.5 rounded-md font-medium text-sm transition-colors ${mode === 'new' ? 'bg-white shadow text-blue-600 border-t-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'}`}>신규/잠재 이슈 등록</button>
              <button onClick={() => handleTabSwitch('fa')} className={`flex-1 py-1.5 rounded-md font-medium text-xs transition-colors flex items-center justify-center gap-1 whitespace-nowrap overflow-hidden ${mode === 'fa' ? 'bg-white shadow text-amber-600 border-t-2 border-amber-500' : 'text-gray-500 hover:text-gray-700'}`}>
                <span className="truncate">FA 리포트 연동</span>
                {hasUnlinkedFa && (<span className="bg-red-500 text-white text-[9px] font-extrabold px-1 py-0.5 rounded-full shadow-sm shrink-0">{unlinkedFasForCurrentIp.length}건</span>)}
              </button>
              <button onClick={() => handleTabSwitch('reopen')} disabled={stage === 'EVT1'} className={`flex-1 py-1.5 rounded-md font-medium text-sm transition-colors ${mode === 'reopen' ? 'bg-white shadow text-blue-600 border-t-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'} ${stage === 'EVT1' ? 'opacity-50 cursor-not-allowed' : ''}`}>이슈 재오픈</button>
            </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center overflow-x-auto whitespace-nowrap">
          <div className="flex flex-row items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">IP 선택</span>
            <button onClick={() => { setIpDropdown('All'); setFormData(p => ({ ...p, ipBlock: 'All' })); if (editingId) setEditingId(null); }} className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all shrink-0 ${ipDropdown === 'All' ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300'}`}>
              All<span className="ml-1.5 text-[10px] opacity-40">○</span>
            </button>
            {availableIps.filter(ip => ip !== 'All' && ip !== 'Common').map(ip => (
              <button key={ip} onClick={() => { setIpDropdown(ip); setFormData(p => ({ ...p, ipBlock: ip })); if (editingId) setEditingId(null); }} className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all shrink-0 ${ipDropdown === ip ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300'}`}>
                {ip}
                {issues.some(i => i.entryMode === 'new' && i.ipBlock === ip) ? <span className="ml-1.5 text-[10px] opacity-80">✓</span> : <span className="ml-1.5 text-[10px] opacity-40">○</span>}
              </button>
            ))}
          </div>
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <div className={`bg-white border border-slate-200 rounded-xl p-5 flex flex-col transition-all ${editingId && !isReadOnly ? 'ring-2 ring-blue-400' : ''} ${editingId && isReadOnly ? 'ring-2 ring-indigo-300 bg-indigo-50/10' : ''}`}>
           {editingId && (
             <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
               {isReadOnly ? (<><Lock size={14} className="text-slate-500" /><span className="text-sm font-bold text-slate-700">ReadOnly Mode <span className="text-xs font-normal text-slate-400 ml-1">(과거 차수 조회)</span></span></>) : (<><Edit2 size={14} className="text-blue-600" /><span className="text-sm font-bold text-blue-700">수정 모드</span></>)}
             </div>
           )}
           {stage === 'EVT0' && !isReadOnly && !editingId && (
             <div className="mb-4 bg-orange-50 border border-orange-200 p-3 rounded-lg flex items-start gap-2">
               <span className="text-orange-600 mt-0.5 shrink-0 font-bold">⚠️</span>
               <p className="text-sm text-orange-800 font-medium">
                 EVT0는 Baseline 단계입니다. 하드웨어 수정이 없는 평가 항목만 등록 가능하며, Revision 이슈는 EVT1부터 기록됩니다.
               </p>
             </div>
           )}
           <div className="mb-4">
             {mode === 'eval' && <div className="bg-green-50 border border-green-100 p-3 rounded-lg"><p className="text-sm text-green-800 font-medium">이전 차수에서 [Revision] 처리된 항목에 대한 현재 차수({stage})의 테스트 결과를 기록합니다.</p></div>}
             {mode === 'carryover' && <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg"><p className="text-sm text-purple-800 font-medium">직전 차수에서 미해결/유보되어 넘어온 OPEN 이슈에 대한 Action을 결정합니다.</p></div>}
             {mode === 'new' && <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg"><p className="text-sm text-blue-800 font-medium">새롭게 발견된 이슈나 잠재적인 위험 요소를 신규 엔트리로 등록합니다.</p></div>}
             {mode === 'reopen' && <div className="bg-red-50 border border-red-100 p-3 rounded-lg"><p className="text-sm text-red-800 font-medium">완료/보류된 이슈를 다시 오픈하여 새로운 대책을 수립합니다.</p></div>}
             {mode === 'fa' && <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg"><p className="text-sm text-amber-800 font-medium">분석이 완료된 FA 리포트의 데이터를 끌어와 신규 이슈로 등록합니다.</p></div>}
           </div>

           {mode === 'fa' && (
             <button onClick={() => setPullFaModalOpen(true)} disabled={isArchived} className={`w-full mb-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 border transition-all ${isArchived ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : hasUnlinkedFa ? 'bg-amber-50 text-amber-700 border-amber-400 hover:bg-amber-100 animate-pulse' : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100'}`}>
               <Link size={14}/> FA 리포트에서 데이터 가져오기
             </button>
           )}

          <fieldset disabled={isReadOnly} className="border-none p-0 m-0 flex-1">

          {mode === 'reopen' ? (
            <div className="space-y-4">
              <div>
                <label className={`${lc} flex justify-between`}><span>Target Issue to Re-open</span></label>
                <select name="targetIssue" value={formData.targetIssue} onChange={(e) => {
                  const val = e.target.value; 
                  const ex = issues.find(i => i.entryMode === 'reopen' && i.targetIssue === val);
                  if (ex) { setFormData(ex); setEditingId(ex.id); } 
                  else { 
                    const pv = latestIssueStates[val] || {}; 
                    setFormData({ ...makeDefaultForm(formData.ipBlock, stage), entryMode: 'reopen', targetIssue: val, severity: pv.severity || 'Major', phenomenon: pv.phenomenon || '', rootCause: pv.rootCause || '', disposition: 'Revision' }); 
                    setEditingId(null); 
                  }
                }} className={`w-full font-mono ${ic}`}>
                  <option value="">이슈 선택...</option>
                  {closedIssues.map(id => {
                    const isReopened = issues.some(it => it.entryMode === 'reopen' && it.targetIssue === id);
                    return (
                      <option
                        key={id}
                        value={id}
                        style={isReopened
                          ? { color: '#1e40af', fontWeight: '700' }
                          : { color: '#374151' }
                        }
                      >
                        {isReopened ? `🔵 [재오픈됨] ${id}` : `⚪ [재오픈가능] ${id}`}
                      </option>
                    );
                  })}
                </select>
                {formData.targetIssue && renderHistoricalContext(formData.targetIssue)}
              </div>
              {formData.targetIssue && (<>
                <div><label className={lc}>Re-open Reason</label><textarea name="reopenReason" value={formData.reopenReason} onChange={handleInput} className={`border-red-300 bg-red-50 ${tc}`} rows="2"></textarea></div>
                <div><label className={lc}>Severity</label><select name="severity" value={formData.severity} onChange={handleInput} className={`w-full ${ic}`}><option value="Marginal">Marginal</option><option value="Fail">Fail</option><option value="Major">Major</option><option value="Minor">Minor</option></select></div>
                <div><label className={lc}>Phenomenon</label><textarea name="phenomenon" value={formData.phenomenon} onChange={handleInput} className={tc} rows="2"></textarea></div>
                <div><label className={lc}>Root Cause</label><textarea name="rootCause" value={formData.rootCause} onChange={handleInput} className={tc} rows="2"></textarea></div>
                <div><label className={lc}>Disposition</label><select name="disposition" value={formData.disposition} onChange={handleInput} className={`w-full ${ic}`}>{availableDispositions.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
                <CustomerAlignmentFields formData={formData} handleInput={handleInput} lc={lc} ic={ic} tc={tc} disabled={isReadOnly} />
                <div><label className={lc}>Justification</label><textarea name="justification" value={formData.justification} onChange={handleInput} className={tc} rows="2"></textarea></div>
              </>)}
            </div>
          ) : (mode === 'new' || mode === 'fa') ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:w-[35%]">
                  <label className={lc}>IP Block (선택됨)</label>
                  <div className="h-10 px-3 flex items-center bg-blue-50 border border-blue-200 rounded-md text-sm font-bold text-blue-800">{currentSelectedIp}</div>
                </div>
                <div className="w-full sm:w-[65%]">
                  <label className={`${lc} flex justify-between`}><span>Issue Number</span></label>
                  <div className="flex gap-2">
                    <select value={issues.some(i => i.entryMode === 'new' && i.ipBlock === formData.ipBlock && i.issueNum === formData.issueNum) ? formData.issueNum : (formData.issueNum === calcNextNum(formData.ipBlock) ? 'NEW' : 'DIRECT')}
                      onChange={(e) => { 
                        const v = e.target.value; 
                        if (v === 'NEW') { setFormData({ ...makeDefaultForm(formData.ipBlock, stage), issueNum: calcNextNum(formData.ipBlock) }); setEditingId(null); } 
                        else if (v === 'DIRECT') { setFormData(p => ({ ...p, issueNum: '' })); setEditingId(null); } 
                        else { 
                          const ex = issues.find(i => i.entryMode === 'new' && i.ipBlock === formData.ipBlock && i.issueNum === v); 
                          if (ex) { setFormData({ ...ex, types: ex.types || [] }); setEditingId(ex.id); } 
                        } 
                      }} className={`w-[55%] ${ic}`}>
                      <option value="NEW">+ 자동 채번(새로 등록)</option>
                      {curStageNums.map(n => <option key={n} value={n}>✅ {n}(수정)</option>)}
                      <option value="DIRECT">직접 입력...</option>
                    </select>
                    <input type="text" name="issueNum" value={formData.issueNum} onChange={(e) => {
                       const v = e.target.value; 
                       const ex = issues.find(i => i.entryMode === 'new' && i.ipBlock === formData.ipBlock && i.issueNum === v); 
                       if (ex) { setFormData({ ...ex, types: ex.types || [] }); setEditingId(ex.id); } 
                       else { setFormData(p => ({ ...p, issueNum: v })); if (editingId) setEditingId(null); } 
                     }} className={`w-[45%] h-10 px-3 py-2 min-w-0 text-sm outline-none rounded-md ${editingId && mode === 'new' ? 'bg-blue-50 border border-blue-400 text-blue-700 font-bold' : 'bg-white text-gray-800 border border-gray-300 focus:border-blue-500'}`} placeholder="e.g. ISSUE#1" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Issue Type</label>
                <div className="flex flex-wrap gap-2">
                  {['Initial', 'Latent', 'Side effect', 'Customer request', 'Hidden', 'Internal Eval.'].map(type => {
                    const dis = (stage === 'EVT1' && (type === 'Latent' || type === 'Side effect')) || (stage !== 'EVT1' && type === 'Initial');
                    return (<label key={type} className={`border px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors ${dis ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400' : 'cursor-pointer'} ${!dis && (formData.types || []).includes(type) ? 'bg-blue-50 border-blue-200 text-blue-700' : (!dis ? 'bg-white text-gray-600 hover:bg-gray-50' : '')}`}>
                      <input type="checkbox" className="hidden" disabled={dis} checked={(formData.types || []).includes(type)} onChange={() => handleTypeToggle(type)} />
                      {(formData.types || []).includes(type) && <CheckCircle size={13} className={dis ? "text-gray-400" : "text-blue-600"} />}{type}
                    </label>);
                  })}
                </div>
              </div>
              {(formData.types || []).includes('Latent') && (
                <div className="bg-orange-50 border border-orange-100 p-4 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-orange-800 font-semibold text-sm"><AlertCircle size={14} /> Latent Issue Details</div>
                  <div><label className="block text-sm font-semibold mb-1 text-orange-900">Origin</label>
                    <div className="flex gap-2">
                      <select value={originSelVal} onChange={(e) => { const v = e.target.value; if (v !== 'Direct') setFormData(p => ({ ...p, origin: v })); else setFormData(p => ({ ...p, origin: '' })); setOriginSelVal(v); }} className={`${originSelVal === 'Direct' ? 'w-1/2' : 'w-full'} ${ic}`}>
                        <option value="">차수 선택</option>{availOrigins.map(s => <option key={s} value={s}>{s}</option>)}<option value="Direct">직접 입력</option>
                      </select>
                      {originSelVal === 'Direct' && <input type="text" name="origin" value={formData.origin} onChange={handleInput} className={`w-1/2 ${ic}`} placeholder="직접 입력" />}
                    </div>
                  </div>
                  <div><label className="block text-sm font-semibold mb-1 text-orange-900">Reason for Escape</label><textarea name="escapeReason" value={formData.escapeReason} onChange={handleInput} className={tc} rows="2"></textarea></div>
                </div>
              )}
              {(formData.types || []).includes('Side effect') && (
                <div className="bg-purple-50 border border-purple-100 p-4 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-purple-800 font-semibold text-sm"><AlertCircle size={14} /> Side Effect Details</div>
                  <div><label className="block text-sm font-semibold mb-1 text-purple-900">Source of side effect</label>
                    <div className="flex gap-2">
                      <select value={sideSelVal} onChange={(e) => { const v = e.target.value; if (v !== 'Direct') setFormData(p => ({ ...p, sideEffectSource: v })); else setFormData(p => ({ ...p, sideEffectSource: '' })); setSideSelVal(v); }} className={`${sideSelVal === 'Direct' ? 'w-1/2' : 'w-full'} ${ic}`}>
                        <option value="">이슈 선택(Revision 항목)</option>{sortedRevIds.map(id => <option key={id} value={id}>{id}</option>)}<option value="Direct">직접 입력</option>
                      </select>
                      {sideSelVal === 'Direct' && <input type="text" name="sideEffectSource" value={formData.sideEffectSource} onChange={handleInput} className={`w-1/2 ${ic}`} placeholder="직접 입력" />}
                    </div>
                  </div>
                </div>
              )}
              {selectedFaForPull ? (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-xs font-bold text-amber-800">
                  <Link size={12}/>
                  FA 연동 대기: {selectedFaForPull.faId} — 저장 시 자동 연동됩니다.
                  <button onClick={() => { setSelectedFaForPull(null); }} className="ml-auto text-amber-500 hover:text-amber-700"><X size={12}/></button>
                </div>
              ) : formData.faId ? (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-300 rounded-lg px-3 py-2 text-xs font-bold text-blue-800">
                  <Link size={12}/>
                  FA 연동 중: {formData.faId}
                  {!isReadOnly && (
                    <button onClick={handleUnlinkFa} className="ml-auto text-blue-600 hover:text-blue-800 bg-white border border-blue-200 px-2 py-1 rounded shadow-sm text-[10px] transition-colors">연동 해제</button>
                  )}
                </div>
              ) : null}
              <div><label className={lc}>Severity</label><select name="severity" value={formData.severity} onChange={handleInput} className={`w-full ${ic}`}><option value="Marginal">Marginal</option><option value="Fail">Fail</option><option value="Major">Major</option><option value="Minor">Minor</option></select></div>
              <div><label className={lc}>Phenomenon (현상)</label><textarea name="phenomenon" value={formData.phenomenon} onChange={handleInput} className={tc} rows="3"></textarea></div>
              <div><label className={lc}>Root Cause (원인)</label><textarea name="rootCause" value={formData.rootCause} onChange={handleInput} className={tc} rows="2"></textarea></div>
              <div><label className={lc}>Disposition (처리방향)</label><select name="disposition" value={formData.disposition} onChange={handleInput} className={`w-full ${ic}`}>{availableDispositions.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
              <CustomerAlignmentFields formData={formData} handleInput={handleInput} lc={lc} ic={ic} tc={tc} disabled={isReadOnly} />
            </div>
          ) : mode === 'carryover' ? (
            <div className="space-y-4">
              <div>
                <label className={`${lc}`}>{editingId && <span className="text-blue-600 text-xs px-2 py-0.5 bg-blue-50 rounded-full font-bold ml-2">수정모드</span>}</label>
                <select name="targetIssue" value={formData.targetIssue} onChange={(e) => {
                  const val = e.target.value;
                  const ex = issues.find(i => i.entryMode === 'carryover' && i.targetIssue === val);
                  if (ex) {
                    setFormData(ex);
                    setEditingId(ex.id);
                  } else {
                    let originMeta = {};
                    for (const blk of historyBlocks) {
                      const found = blk.issues.find(i => {
                        const iId = i.entryMode === 'new' ? `${i.ipBlock}.${project}.${i.issueNum}` : i.targetIssue;
                        return iId === val;
                      });
                      if (found) {
                        originMeta = {
                          ipBlock: found.ipBlock,
                          severity: found.severity,
                          phenomenon: found.phenomenon || '',
                          rootCause: found.rootCause || '',
                          disposition: found.disposition || 'Revision',
                        };
                        break;
                      }
                    }
                    setFormData({
                      ...makeDefaultForm(originMeta.ipBlock || formData.ipBlock, stage),
                      targetIssue: val,
                      ...originMeta,
                    });
                    setEditingId(null);
                  }
                }} className={`w-full font-mono ${ic}`}>
                  <option value="">이월된 이슈 선택...</option>
                  {issues.filter(i => i.entryMode === 'carryover').map(it => (
                    <option key={it.targetIssue} value={it.targetIssue}
                      style={it.carryoverAction === 'Close' ? { color: '#15803d', fontWeight: '700' } : { color: '#c2410c', fontWeight: '700' }}
                    >
                      {it.carryoverAction === 'Close' ? `🟢 [이월-DONE] ${it.targetIssue}` : `🟠 [이월-OPEN] ${it.targetIssue}`}
                    </option>
                  ))}
                  {Array.from(carryoverCandidateSet)
                    .filter(id => !issues.some(i => i.entryMode === 'carryover' && i.targetIssue === id))
                    .sort()
                    .map(id => (
                      <option key={id} value={id} style={{ color: '#c2410c' }}>
                        {`🟠 [이월-OPEN] ${id}`}
                      </option>
                    ))
                  }
                </select>
                {formData.targetIssue && renderHistoricalContext(formData.targetIssue)}
              </div>
              
              {formData.targetIssue && (
                <div className="border-t border-dashed pt-4 space-y-4">
                   <label className="block text-sm font-semibold text-gray-700">디자이너 Action 결정</label>
                   <div className="flex gap-2 mb-2">
                      <label className={`flex-1 text-sm font-bold flex items-center gap-2 border p-2 rounded-lg cursor-pointer ${formData.carryoverAction === 'Keep Open' ? 'bg-purple-50 border-purple-300 text-purple-800' : 'bg-white'}`}>
                         <input type="radio" name="carryoverAction" value="Keep Open" checked={formData.carryoverAction === 'Keep Open'} onChange={handleInput}/> Keep Open
                      </label>
                      <label className={`flex-1 text-sm font-bold flex items-center gap-2 border p-2 rounded-lg cursor-pointer ${formData.carryoverAction === 'Close' ? 'bg-red-50 border-red-300 text-red-800' : 'bg-white'}`}>
                         <input type="radio" name="carryoverAction" value="Close" checked={formData.carryoverAction === 'Close'} onChange={handleInput}/> Close
                      </label>
                      <label className={`flex-1 text-sm font-bold flex items-center gap-2 border p-2 rounded-lg cursor-pointer ${formData.carryoverAction === 'Revision' ? 'bg-orange-50 border-orange-300 text-orange-800' : 'bg-white'}`}>
                         <input type="radio" name="carryoverAction" value="Revision" checked={formData.carryoverAction === 'Revision'} onChange={handleInput}/> Revision
                      </label>
                   </div>
                   
                   {formData.carryoverAction === 'Keep Open' && (
                     <div><label className={lc}>Keep Open 사유</label><textarea name="comment" value={formData.comment || ''} onChange={handleInput} placeholder="여전히 조치되지 않은 사유 입력" className={tc} rows="2"></textarea></div>
                   )}
                   
                   {formData.carryoverAction === 'Close' && (
                     <div className="bg-red-50 border border-red-200 p-4 rounded-lg space-y-3">
                       <h3 className="text-sm font-bold text-red-700">이슈 강제 종료 (Close)</h3>
                       <div><label className={lc}>종결 방향</label>
                         <select name="disposition" value={formData.disposition === 'Waived' || formData.disposition === 'Acceptable' ? formData.disposition : 'Acceptable'} onChange={handleInput} className={`w-full font-bold text-red-700 border-red-300 ${ic}`}>
                           <option value="Acceptable">Acceptable (수용 가능 수준)</option>
                           <option value="Waived">Waived (예외 인정/무시)</option>
                         </select>
                       </div>
                       <div><label className={lc}>종료 사유 (필수)</label><textarea name="comment" value={formData.comment || ''} onChange={handleInput} placeholder="어떤 근거로 이 이슈를 무시하거나 수용하는지 상세 사유를 남겨주세요." className={`border-red-300 focus:border-red-500 focus:ring-red-500 ${tc}`} rows="2"></textarea></div>
                     </div>
                   )}
                   
                   {formData.carryoverAction === 'Revision' && (
                     <div><label className={lc}>새 대책 / 수정 내용</label><textarea name="modPlan" value={formData.modPlan || ''} onChange={handleInput} className={tc} rows="2"></textarea></div>
                   )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className={`${lc}`}>{editingId && <span className="text-blue-600 text-xs px-2 py-0.5 bg-blue-50 rounded-full font-bold ml-2">수정모드</span>}</label>
                <select name="targetIssue" value={formData.targetIssue} onChange={(e) => {
                  const v = e.target.value;
                  const ex = issues.find(i => i.entryMode === 'eval' && i.targetIssue === v);
                  if (ex) {
                    setFormData({ ...ex, types: ex.types || [] });
                    setEditingId(ex.id);
                  } else {
                    let originMeta = {};
                    for (const blk of historyBlocks) {
                      const found = blk.issues.find(i => {
                        const iId = i.entryMode === 'new' ? `${i.ipBlock}.${project}.${i.issueNum}` : i.targetIssue;
                        return iId === v;
                      });
                      if (found) { originMeta = { ipBlock: found.ipBlock, severity: found.severity }; break; }
                    }
                    setFormData(p => ({
                      ...makeDefaultForm(originMeta.ipBlock || p.ipBlock, stage),
                      targetIssue: v,
                      types: [],
                      assessment: 'Fixed',
                      comment: '',
                      ...originMeta,
                    }));
                    setEditingId(null);
                  }
                }} className={`w-full font-mono ${ic}`}>
                  <option value="">이슈 선택...</option>
                  {sortedLoadedIssues.map(id => {
                    const isDone = issues.some(it => it.entryMode === 'eval' && it.targetIssue === id);
                    return (
                      <option
                        key={id}
                        value={id}
                        style={isDone
                          ? { color: '#1e40af', fontWeight: '700' }
                          : { color: '#dc2626' }
                        }
                      >
                        {isDone ? `🔵 [평가완료] ${id}` : `🔴 [평가대기] ${id}`}
                      </option>
                    );
                  })}
                </select>
                {formData.targetIssue && renderHistoricalContext(formData.targetIssue)}
              </div>
              <div><label className={lc}>Assessment Result</label><select name="assessment" value={formData.assessment} onChange={handleInput} className={`w-full font-bold ${ic}`}><option value="Fixed">Fixed (완전 해결)</option><option value="Partial">Partial (부분 개선)</option><option value="Unresolved">Unresolved (해결 안 됨)</option><option value="Deferred">🔵 Deferred — 유보</option></select></div>
              <div><label className={lc}>Comment (평가 의견)</label><textarea name="comment" value={formData.comment} onChange={handleInput} className={tc} rows="2"></textarea></div>
              
              {formData.assessment === 'Deferred' && (
                <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
                   <h3 className="text-sm font-bold text-blue-800">유보(Deferred) 상세 정보</h3>
                   <div><label className="block text-sm font-semibold text-blue-900 mb-1">Defer Reason</label><textarea name="deferReason" value={formData.deferReason || ''} onChange={handleInput} className={tc} rows="2"></textarea></div>
                </div>
              )}
              {(formData.assessment === 'Partial' || formData.assessment === 'Unresolved') && (
                <div className="border-t border-dashed pt-4 space-y-4">
                  <h3 className="text-sm font-bold text-red-600 flex items-center gap-2"><AlertCircle size={15} /> Partial / Unresolved 상세 내용</h3>
                  <div><label className={lc}>Severity</label><select name="severity" value={formData.severity} onChange={handleInput} className={`w-full ${ic}`}><option value="Major">Major</option><option value="Minor">Minor</option></select></div>
                  <div><label className={lc}>Disposition</label><select name="disposition" value={formData.disposition} onChange={handleInput} className={`w-full ${ic}`}>{availableDispositions.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
                  <CustomerAlignmentFields formData={formData} handleInput={handleInput} lc={lc} ic={ic} tc={tc} />
                </div>
              )}
            </div>
          )}

          <div><label className={`${lc} mt-4 flex justify-between items-center`}><span>Assignee (담당자)</span></label><input type="text" name="assignee" value={formData.assignee || ''} onClick={() => !isReadOnly && setAssigneeModal({ open: true, newAssignee: '' })} readOnly className={`w-full ${isReadOnly ? 'cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200' : 'cursor-pointer bg-slate-50 focus:bg-slate-100 hover:border-blue-400'} transition-colors ${ic}`} placeholder="클릭하여 지정" /></div>
          </fieldset>
          
          <div className="mt-6 flex gap-3 pt-4 border-t border-gray-100">
            <button onClick={handleSave} disabled={isSaveDisabled || isReadOnly} className={`flex-1 py-3 rounded-lg font-bold shadow-sm transition-colors flex items-center justify-center gap-2 ${isSaveDisabled || isReadOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
              <CheckCircle size={17} /> {isReadOnly ? '(읽기 전용)' : editingId ? '수정 내용 저장' : '리스트에 추가'}
            </button>
            <button
              onClick={() => {
                if (isReadOnly) { cancelEdit(); return; }
                const hasContent = editingId ||
                  formData.phenomenon || formData.rootCause || formData.issueNum ||
                  formData.comment || formData.reopenReason || selectedFaForPull;
                if (hasContent) {
                  setCancelConfirmModal(true);
                } else {
                  cancelEdit();
                }
              }}
              className="flex-none px-4 py-3 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors border border-gray-200 flex items-center gap-1.5"
            >
              <X size={15} /> {isReadOnly && editingId ? '닫기' : '취소'}
            </button>
          </div>
        </div>

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
              {(() => {
              // ── 이번 차수에서 이미 action 취해진 ID 집합 (중복 제거용) ──
              const actedThisStage = new Set(
                issues.map(i => (i.entryMode === 'new' || i.entryMode === 'fa')
                  ? `${i.ipBlock}.${project}.${i.issueNum}`
                  : i.targetIssue
                ).filter(Boolean)
              );

              // ── [1] eval 평가 대기 가상 카드: loadedIssues 중 eval 미완료 + action 없는 항목 ──
              const pendingEvalItems = (safeData.loadedIssues || [])
                .filter(id => needsEvalSet.has(id) && !actedThisStage.has(id))
                .filter(id => {
                  const ip = id.split('.')[0];
                  return ipDropdown === 'All' ? true : ip === ipDropdown;
                })
                .filter(() => statusFilter === 'ALL' || statusFilter === 'OPEN');

              // ── [2] CARRY-OVER 가상 카드: eval 대상 아닌 미해결 이슈 중 action 없는 항목 ──
              const pendingCarryoverItems = Array.from(carryoverCandidateSet)
                .filter(id => !actedThisStage.has(id))
                .filter(id => {
                  const ip = id.split('.')[0];
                  return ipDropdown === 'All' ? true : ip === ipDropdown;
                })
                .filter(() => statusFilter === 'ALL' || statusFilter === 'OPEN');

              // ── [3] 현재 차수 실제 이슈 카드 ──
              const curFiltered = sortedIssues
                .filter(i => {
                  if (ipDropdown === 'All') return true;
                  // new/fa 모드: ipBlock 직접 비교
                  if (i.entryMode === 'new' || i.entryMode === 'fa') {
                    return (i.ipBlock || '') === ipDropdown;
                  }
                  // eval/reopen/carryover: targetIssue의 첫 세그먼트로 비교
                  const ipFromTarget = i.targetIssue ? i.targetIssue.split('.')[0] : '';
                  return ipFromTarget === ipDropdown;
                })
                .filter(i => {
                  if (statusFilter === 'ALL') return true;
                  const st = getIssueStatus(i);
                  if (statusFilter === 'OPEN' && st === 'OPEN') return true;
                  if (statusFilter === 'DEF' && st === 'DEFERRED') return true;
                  if (statusFilter === 'CLOSED' && st === 'CLOSED') return true;
                  return false;
                });

              const hasAny = pendingEvalItems.length > 0 || pendingCarryoverItems.length > 0 || curFiltered.length > 0;
              if (!hasAny) {
                return <div className="text-center text-gray-400 py-8 bg-white rounded-lg border border-dashed border-gray-300"><p>해당 상태의 이슈가 없습니다.</p></div>;
              }

              // 히스토리에서 원본 이슈 메타 조회 (공통 헬퍼)
              const findOriginItem = (id) => {
                for (const blk of historyBlocks) {
                  const found = blk.issues.find(i => {
                    const iId = i.entryMode === 'new' ? `${i.ipBlock}.${project}.${i.issueNum}` : i.targetIssue;
                    return iId === id;
                  });
                  if (found) return found;
                }
                return null;
              };

              const newFindings = curFiltered.filter(item => {
                return getIssueStatus(item) === 'OPEN' && (item.entryMode === 'new' || item.entryMode === 'fa');
              });
              const stillOpenIssues = curFiltered.filter(item => {
                return getIssueStatus(item) === 'OPEN' && item.entryMode !== 'new' && item.entryMode !== 'fa';
              });
              const resolvedDeferredIssues = curFiltered.filter(item => {
                const st = getIssueStatus(item);
                return st === 'CLOSED' || st === 'DEFERRED';
              });

              return (
                <>
                  {/* Section 1: [ACTION REQUIRED] */}
                  {(pendingEvalItems.length > 0 || pendingCarryoverItems.length > 0) && (
                    <div className="mb-6">
                      <div 
                        onClick={() => toggleSection('actionRequired')}
                        className="flex items-center justify-between mb-3 border-b border-red-200 pb-2 cursor-pointer hover:bg-red-50/50 px-2 -mx-2 rounded-lg transition-colors group"
                      >
                        <h3 className="text-sm font-semibold text-red-600 flex items-center gap-2">
                          <span className="text-red-400 group-hover:text-red-600 transition-colors">
                            {expandedSections.actionRequired ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </span>
                          <AlertCircle size={16} /> [ACTION REQUIRED] 조치 필요 항목
                        </h3>
                        <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{pendingEvalItems.length + pendingCarryoverItems.length}건</span>
                      </div>
                      {expandedSections.actionRequired && (
                        <div className="space-y-2 animate-in fade-in duration-200 slide-in-from-top-1">
                        {pendingEvalItems.map(id => {
                          const originItem = findOriginItem(id);
                          const virtualItem = originItem
                            ? { ...originItem, id: `pending-eval-${id}`, _isPendingEval: true }
                            : { id: `pending-eval-${id}`, entryMode: 'new', ipBlock: id.split('.')[0], issueNum: id.split('#')[1] ? `ISSUE#${id.split('#')[1]}` : id, _isPendingEval: true };
                          return (
                            <IssueSummaryCard
                              key={`pending-eval-${id}`}
                              item={virtualItem}
                              project={project}
                              isReadOnly={true}
                              expandable
                              onEdit={() => handleHistoryCardClick(virtualItem)}
                              historyStage={historyBlocks[historyBlocks.length - 1]?.stageName}
                              needsEval={true}
                            />
                          );
                        })}
                        {pendingCarryoverItems.map(id => {
                          const originItem = findOriginItem(id);
                          const coVirtual = originItem
                            ? { ...originItem, id: `pending-co-${id}`, _isCarryover: true }
                            : { id: `pending-co-${id}`, entryMode: 'new', ipBlock: id.split('.')[0], issueNum: id.split('#')[1] ? `ISSUE#${id.split('#')[1]}` : id, _isCarryover: true };
                          return (
                            <IssueSummaryCard
                              key={`pending-co-${id}`}
                              item={coVirtual}
                              project={project}
                              isReadOnly={true}
                              expandable
                              onEdit={() => handleHistoryCardClick(coVirtual)}
                              historyStage={historyBlocks[historyBlocks.length - 1]?.stageName}
                              needsEval={false}
                            />
                          );
                        })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Section 2: [NEW FINDINGS] */}
                  {newFindings.length > 0 && (
                    <div className="mb-6">
                      <div 
                        onClick={() => toggleSection('newFindings')}
                        className="flex items-center justify-between mb-3 border-b border-blue-200 pb-2 cursor-pointer hover:bg-blue-50/50 px-2 -mx-2 rounded-lg transition-colors group"
                      >
                        <h3 className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                          <span className="text-blue-400 group-hover:text-blue-700 transition-colors">
                            {expandedSections.newFindings ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </span>
                          <Plus size={16} /> [NEW FINDINGS] 신규 등록 리스크
                        </h3>
                        <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{newFindings.length}건</span>
                      </div>
                      {expandedSections.newFindings && (
                        <div className="space-y-2 animate-in fade-in duration-200 slide-in-from-top-1">
                        {newFindings.map(item => {
                          const itemIssueId = item.entryMode === 'new'
                            ? `${item.ipBlock}.${project}.${item.issueNum}`
                            : item.targetIssue;
                          return (
                            <IssueSummaryCard
                              key={item.id}
                              item={item}
                              project={project}
                              isReadOnly={isReadOnly}
                              editingId={editingId}
                              onEdit={isReadOnly ? handleView : handleEdit}
                              onDelete={isReadOnly ? undefined : setDeleteModal}
                              currentStage={stage}
                              needsEval={needsEvalSet.has(itemIssueId)}
                            />
                          );
                        })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Section 3: [STILL OPEN / PERSISTENT] */}
                  {stillOpenIssues.length > 0 && (
                    <div className="mb-6">
                      <div 
                        onClick={() => toggleSection('stillOpen')}
                        className="flex items-center justify-between mb-3 border-b border-orange-300 pb-2 cursor-pointer hover:bg-orange-50/50 px-2 -mx-2 rounded-lg transition-colors group"
                      >
                        <h3 className="text-sm font-semibold text-orange-700 flex items-center gap-2">
                          <span className="text-orange-400 group-hover:text-orange-700 transition-colors">
                            {expandedSections.stillOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </span>
                          <Activity size={16} /> [STILL OPEN / PERSISTENT] 관리 중인 기술 부채
                        </h3>
                        <span className="text-[11px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">{stillOpenIssues.length}건</span>
                      </div>
                      {expandedSections.stillOpen && (
                        <div className="space-y-2 animate-in fade-in duration-200 slide-in-from-top-1">
                        {stillOpenIssues.map(item => {
                          const itemIssueId = item.entryMode === 'new'
                            ? `${item.ipBlock}.${project}.${item.issueNum}`
                            : item.targetIssue;
                          return (
                            <IssueSummaryCard
                              key={item.id}
                              item={item}
                              project={project}
                              isReadOnly={isReadOnly}
                              editingId={editingId}
                              onEdit={isReadOnly ? handleView : handleEdit}
                              onDelete={isReadOnly ? undefined : setDeleteModal}
                              currentStage={stage}
                              needsEval={needsEvalSet.has(itemIssueId)}
                            />
                          );
                        })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Section 4: [RESOLVED / DEFERRED] */}
                  {resolvedDeferredIssues.length > 0 && (
                    <div className="mb-6 opacity-80 hover:opacity-100 transition-opacity">
                      <div 
                        onClick={() => toggleSection('resolved')}
                        className="flex items-center justify-between mb-3 border-b border-gray-200 pb-2 cursor-pointer hover:bg-gray-100/50 px-2 -mx-2 rounded-lg transition-colors group"
                      >
                        <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                          <span className="text-gray-400 group-hover:text-gray-600 transition-colors">
                            {expandedSections.resolved ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </span>
                          <CheckCircle size={16} /> [RESOLVED / DEFERRED] 조치 완료 및 유보
                        </h3>
                        <span className="text-[11px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{resolvedDeferredIssues.length}건</span>
                      </div>
                      {expandedSections.resolved && (
                        <div className="space-y-2 animate-in fade-in duration-200 slide-in-from-top-1">
                        {resolvedDeferredIssues.map(item => {
                          const itemIssueId = item.entryMode === 'new'
                            ? `${item.ipBlock}.${project}.${item.issueNum}`
                            : item.targetIssue;
                          return (
                            <IssueSummaryCard
                              key={item.id}
                              item={item}
                              project={project}
                              isReadOnly={isReadOnly}
                              editingId={editingId}
                              onEdit={isReadOnly ? handleView : handleEdit}
                              onDelete={isReadOnly ? undefined : setDeleteModal}
                              currentStage={stage}
                              needsEval={needsEvalSet.has(itemIssueId)}
                            />
                          );
                        })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
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

      {/* MODALS */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2 text-red-600">
              {deleteModal.faId ? (
                <><Link size={19} /> FA 연동 해제</>
              ) : (deleteModal.entryMode === 'eval' || deleteModal.entryMode === 'carryover' || deleteModal.entryMode === 'reopen') ? (
                <><RefreshCw size={19} /> 조치 내용 초기화</>
              ) : (
                <><Trash2 size={19} /> 이슈 삭제</>
              )}
            </h3>
            <p className="mb-4 text-gray-600 text-sm leading-relaxed">
              {deleteModal.faId ? (
                '연동을 해제하고 FA 리포트를 미연동 상태로 되돌리시겠습니까?'
              ) : (deleteModal.entryMode === 'eval' || deleteModal.entryMode === 'carryover' || deleteModal.entryMode === 'reopen') ? (
                '평가 및 대응 방안을 초기화하시겠습니까?'
              ) : (
                '등록된 신규 이슈를 삭제하시겠습니까?'
              )}
            </p>
            {/* 삭제 대상 ID 강조 */}
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="text-red-400 text-xs font-bold uppercase tracking-wide shrink-0">대상</span>
              <code className="text-sm font-mono font-bold text-red-700 break-all">
                {deleteModal.entryMode === 'new' || deleteModal.entryMode === 'fa'
                  ? `${deleteModal.ipBlock}.${project}.${deleteModal.issueNum}`
                  : deleteModal.targetIssue || deleteModal.id}
              </code>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteModal(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md font-medium text-sm"
              >
                취소
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium text-sm"
              >
                {deleteModal.faId
                  ? 'FA 연동 해제'
                  : (deleteModal.entryMode === 'eval' || deleteModal.entryMode === 'carryover' || deleteModal.entryMode === 'reopen')
                    ? '조치 초기화'
                    : '완전 삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 입력 취소 confirm 모달 */}
      {cancelConfirmModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-xl shadow-xl max-w-xs w-full border border-gray-200">
            <p className="text-sm font-semibold text-gray-700 mb-1">입력 내용을 초기화할까요?</p>
            <p className="text-xs text-gray-400 mb-5">작성 중인 내용이 모두 사라집니다.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCancelConfirmModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              >
                계속 작성
              </button>
              <button
                onClick={() => {
                  setCancelConfirmModal(false);
                  setSelectedFaForPull(null);
                  pendingFaPullDataRef.current = null;
                  cancelEdit();
                }}
                className="px-4 py-2 text-sm font-semibold bg-gray-700 hover:bg-gray-800 text-white rounded-md transition-colors"
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FA Pull 모달 */}
      {pullFaModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b bg-gray-50 rounded-t-xl">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Link size={17} className="text-yellow-600"/>
                FA 리포트에서 데이터 가져오기
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{currentSelectedIp}</span>
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
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full"><h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-600"><Edit2 size={19} /> 담당자 변경</h3><input autoFocus type="text" value={assigneeModal.newAssignee} onChange={(e) => setAssigneeModal(p => ({ ...p, newAssignee: e.target.value }))} className={`w-full ${ic} mb-4`} placeholder="이름 입력" onKeyDown={(e) => { if(e.key==='Enter') confirmAssigneeChange() }}/><div className="flex justify-end gap-2"><button onClick={() => setAssigneeModal({open:false, newAssignee:''})} className="px-4 py-2 bg-gray-100 rounded-md text-sm">취소</button><button onClick={confirmAssigneeChange} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm">확인</button></div></div></div>
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
                  {getHistory(historyTargetId).map((h, i) => (
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
}
