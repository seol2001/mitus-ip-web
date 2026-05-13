import React, { useState, useMemo, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
  FileSearch, AlertCircle, Edit2, Trash2, CheckCircle, Plus, X,
  Link, AlertTriangle, ShieldCheck, GitBranch, User, Building2, Lock,
  Activity, Tag, ChevronDown, ChevronRight
} from 'lucide-react';
import ActionBar from '../ActionBar';
import { useAutoSave, clearAutoSave } from '../../hooks/useAutoSave';
import AutoSaveRecoveryModal from '../AutoSaveRecoveryModal';
import { useConfirm } from '../../contexts/ConfirmContext';

// ── FA 카드 좌측 Color Bar ────────────────────────────────────────
const getFaColorBar = (fa) => {
  if (fa.severity === 'S1') return 'border-l-4 border-l-red-500';
  if (fa.severity === 'S2') return 'border-l-4 border-l-orange-400';
  return 'border-l-4 border-l-yellow-400';
};

const SEVERITY_OPTIONS = ['S1', 'S2', 'S3'];
const CUST_STAGE_OPTIONS = ['Proto', 'ES', 'CS', 'MP'];
const DISPOSITION_OPTIONS = ['Revision', 'Workaround', 'Screening'];
const STAGES = ['EVT0', 'EVT1', 'EVT2', 'EVT3', 'EVT4', 'EVT5', 'DVT', 'PVT', 'MP'];

// ── 배지 스타일 헬퍼 ──────────────────────────────────────────────────
const severityStyle = (s) => ({
  S1: 'bg-red-100 text-red-700 border-red-300',
  S2: 'bg-orange-100 text-orange-700 border-orange-300',
  S3: 'bg-yellow-100 text-yellow-700 border-yellow-300',
}[s] || 'bg-gray-100 text-gray-600 border-gray-300');

const dispositionStyle = (d) => ({
  Revision: 'bg-red-50 text-red-700 border-red-300',
  Workaround: 'bg-blue-50 text-blue-700 border-blue-300',
  Screening: 'bg-purple-50 text-purple-700 border-purple-300',
}[d] || 'bg-gray-100 text-gray-600 border-gray-300');

const gapStyle = (g) =>
  g === 'Potential Risk'
    ? 'bg-amber-50 text-amber-700 border-amber-300'
    : 'bg-green-50 text-green-700 border-green-300';

// ── 기본 폼 ──────────────────────────────────────────────────────────
const makeDefault = (ipBlock = '', currentRevision = '') => ({
  ipBlock,
  subBlock: null,
  sampleSourceVer: '',
  reportedInStage: currentRevision,
  versionGap: '',
  customer: '',
  custStage: 'ES',
  severity: 'S2',
  phenomenon: '',
  rootCause: '',
  disposition: 'Revision',
  reportLink: '',
  isLinkedToLog: false,
});

const FaReportTab = forwardRef(({
  data,
  overviewData,
  currentRevision,
  isArchived,
  lockReason,
  projectId,
  dbUpdatedAt,
  onSubmit,
  onImmediateUpdate,
  onRevisionLogUpdate,
  onFormDirtyChange,
  onEditingStateChange,
  onForceUnlock,
  revisionLogData,
  ipIndexData
}, ref) => {
  const faReports = useMemo(() => data?.faReports || [], [data]);
  const ipBlocks = useMemo(
    () => overviewData?.IP_Blocks || [],
    [overviewData]
  );
  const allIps = useMemo(
    () => ['All', ...ipBlocks],
    [ipBlocks]
  );

  const [selectedIp, setSelectedIp] = useState('All');
  const [formData, setFormData] = useState(makeDefault(ipBlocks[0] || '', currentRevision));
  const [editingId, setEditingId] = useState(null);
  const showConfirm = useConfirm();
  const [severityFilter, setSeverityFilter] = useState('ALL');

  const [expandedSections, setExpandedSections] = useState({
    S1: true,
    S2: true,
    S3: true,
    linked: false
  });

  // [추가] 외부(App.jsx)에서 상태를 리셋할 수 있는 기능 노출
  useImperativeHandle(ref, () => ({
    canNavigate: async () => {
      // FA Report도 현재는 별도의 Dirty 가드가 필요 없으나 일관성을 위해 추가
      return true;
    },
    resetForm: () => {
      setEditingId(null);
      setFormData(makeDefault(ipBlocks[0] || '', currentRevision));
      setIsTabEditing(false);
    }
  }), [ipBlocks, currentRevision]);

  // ── 탭 로컬 편집 상태: 초기 잠금 상태로 시작 (사용자 요청) ──
  const [isTabEditing, setIsTabEditing] = useState(false);
  const isReadOnly = isArchived || !isTabEditing;

  useEffect(() => {
    // 프로젝트 전체 잠금 상태가 바뀌면 탭 로컬 편집 상태도 동기화
    // [수정] 자동 잠금 해제 로직 제거, 강제 잠금 로직만 유지
    if (isArchived === true) {
      setIsTabEditing(false);
    }
  }, [isArchived]);

  useEffect(() => {
    if (onEditingStateChange) onEditingStateChange(isTabEditing);
  }, [isTabEditing, onEditingStateChange]);

  // ─── 지능형 Auto-Save ───
  const { showRecoveryModal, recoveredTime, handleRestore, handleDiscard } = useAutoSave({
    projectId,
    tabName: 'FA_Report',
    data: data,
    isEditing: isTabEditing,
    onRestore: (recoveredData) => {
      if (onImmediateUpdate) onImmediateUpdate(recoveredData, true);
    },
    dbUpdatedAt,
    setIsEditing: setIsTabEditing
  });

  // ── versionGap 자동 계산 ─────────────────────────────────────────
  const calcGap = useCallback((srcVer, repStage) => {
    if (!srcVer || !repStage) return '';
    const srcIdx = STAGES.indexOf(srcVer);
    const repIdx = STAGES.indexOf(repStage);
    if (srcIdx === -1 || repIdx === -1) return '';
    return srcIdx < repIdx ? 'Potential Risk' : 'Fixed in Latest';
  }, []);

  const handleInput = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      // sampleSourceVer 또는 reportedInStage 변경 시 versionGap 재계산
      if (name === 'sampleSourceVer' || name === 'reportedInStage') {
        next.versionGap = calcGap(
          name === 'sampleSourceVer' ? value : prev.sampleSourceVer,
          name === 'reportedInStage' ? value : prev.reportedInStage
        );
      }
      return next;
    });
    if (onFormDirtyChange) onFormDirtyChange(true);
  };

  // ── 저장 ─────────────────────────────────────────────────────────
  const handleSave = () => {
    if (isReadOnly) return; // isArchived 또는 편집 모드 아닐 때 차단
    let updated;
    if (editingId) {
      updated = faReports.map(f => f.faId === editingId ? { ...f, ...formData } : f);
    } else {
      const faId = `FA-${Date.now()}`;
      updated = [...faReports, { ...formData, faId }];
    }
    const newData = { ...data, faReports: updated };
    if (onSubmit) onSubmit(newData);
    resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData(makeDefault(selectedIp !== 'All' ? selectedIp : (ipBlocks[0] || ''), currentRevision));
  };

  const handleEdit = (fa) => {
    setFormData({ ...fa });
    setEditingId(fa.faId);
  };

  const handleDeleteRequest = async (fa) => {
    const confirmed = await showConfirm({
      title: "FA 리포트 삭제",
      message: `정말로 [${fa.faId}] 항목을 삭제하시겠습니까?`,
      type: "danger",
      confirmText: "영구 삭제"
    });

    if (confirmed) {
      const updated = faReports.filter(f => f.faId !== fa.faId);
      const newData = { ...data, faReports: updated };
      if (onSubmit) onSubmit(newData);
      if (editingId === fa.faId) resetForm();
    }
  };

  // ── 필터된 카드 목록 ─────────────────────────────────────────────
  const filteredReports = useMemo(() =>
    selectedIp === 'All'
      ? faReports
      : faReports.filter(f => f.ipBlock === selectedIp),
    [faReports, selectedIp]
  );

  // ── 통계 ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const all = faReports;
    return {
      total: all.length,
      s1: all.filter(f => f.severity === 'S1').length,
      s2: all.filter(f => f.severity === 'S2').length,
      s3: all.filter(f => f.severity === 'S3').length,
      unlinked: all.filter(f => !f.isLinkedToLog).length,
    };
  }, [faReports]);

  // ── 스타일 상수 ──────────────────────────────────────────────────
  const lc = "block text-[13px] font-medium text-gray-600 mb-1.5";
  const ic = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed";
  const tc = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 resize-y focus:border-blue-500 focus:ring-1 outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed disabled:resize-none";

  const isSaveDisabled = !formData.ipBlock || !formData.phenomenon || !formData.rootCause || !formData.sampleSourceVer;

  // 잠금 핸들러
  const handleLock = () => {
    if (onSubmit) onSubmit(data);
    clearAutoSave(projectId, 'FA_Report');
    setIsTabEditing(false);
    setEditingId(null);
    setFormData(makeDefault(selectedIp !== 'All' ? selectedIp : (ipBlocks[0] || ''), currentRevision));
  };

  return (
    <div className="space-y-4 max-w-full">
      <AutoSaveRecoveryModal 
        isOpen={showRecoveryModal} 
        timestamp={recoveredTime} 
        onRestore={handleRestore} 
        onDiscard={handleDiscard} 
      />

      {/* ── 헤더 (Title + ActionBar) ── */}
      <div className="flex items-center gap-6 pb-4 border-b border-slate-200 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <FileSearch size={28} className="text-blue-600" />
            FA Reports
          </h1>
          {isArchived && <span className="text-xs px-2 py-1 bg-slate-100 text-slate-500 rounded font-bold flex items-center gap-1"><Lock size={11} />Read-Only</span>}
        </div>
        <div className="shrink-0 border-l pl-3 border-slate-200">
          <ActionBar
            isGlobalArchived={isArchived}
            isEditing={isTabEditing}
            onEdit={() => setIsTabEditing(true)}
            onLock={handleLock}
            lockReason={lockReason}
            onForceUnlock={onForceUnlock}
          />
        </div>
      </div>

      {/* ===== 첫 번째 행 (Control Panel) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="hidden lg:block"></div> {/* 좌측 빈 공간 (RevisionLog와 레이아웃 맞춤) */}
        {/* 우측 상단 박스: IP 선택 전용 */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center overflow-x-auto whitespace-nowrap">
          {/* IP 선택 */}
          <div className="flex flex-row items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">IP 선택</span>
            {allIps.map(ip => (
              <button
                key={ip}
                onClick={() => {
                  setSelectedIp(ip);
                  if (!editingId) setFormData(prev => ({ ...prev, ipBlock: ip === 'All' ? (ipBlocks[0] || '') : ip }));
                }}
                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all shrink-0 ${selectedIp === ip
                    ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
              >
                {ip}
                {ip !== 'All' && (
                  <span className="ml-1.5 text-[10px] opacity-70">
                    {faReports.filter(f => f.ipBlock === ip && !f.isLinkedToLog).length > 0
                      ? `⚠️${faReports.filter(f => f.ipBlock === ip && !f.isLinkedToLog).length}`
                      : '✓'}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 2-panel 레이아웃 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* LEFT: 입력 폼 */}
        <div className={`bg-white p-5 rounded-xl shadow-sm border border-gray-200 space-y-4 relative ${editingId && !isReadOnly ? 'ring-2 ring-blue-500' : ''} ${editingId && isReadOnly ? 'ring-2 ring-indigo-300 bg-indigo-50/10' : ''}`}>
          <h2 className="text-base font-bold flex items-center gap-2 border-b pb-3">
            {editingId && isReadOnly
              ? <>👁️ FA 리포트 상세 <span className="text-xs font-normal text-indigo-400 ml-1">(읽기 전용)</span></>
              : editingId
              ? <><Edit2 size={15} className="text-blue-600" />FA 리포트 수정 중</>
              : <><Plus size={15} className="text-blue-600" />FA 리포트 등록</>
            }
          </h2>

          {isArchived && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-600">
              <Lock size={14} />과거 차수의 FA 리포트는 읽기 전용입니다.
            </div>
          )}

          {/* 섹션 1: IP & 버전 매핑 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-200 pb-2">
              <GitBranch size={14} className="text-slate-500" />IP 및 버전 매핑
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className={lc}>IP Block <span className="text-red-500">*</span></label>
                <select name="ipBlock" value={formData.ipBlock} onChange={handleInput} disabled={isReadOnly} className={ic}>
                  <option value="">선택...</option>
                  {ipBlocks.map(ip => <option key={ip} value={ip}>{ip}</option>)}
                </select>
              </div>
              {ipIndexData && ipIndexData[formData.ipBlock] && ipIndexData[formData.ipBlock].Sub_Blocks && ipIndexData[formData.ipBlock].Sub_Blocks.length > 0 && (
                <div className="flex-1">
                  <label className={lc}>Sub-Block / Level</label>
                  <select name="subBlock" value={formData.subBlock || ''} onChange={(e) => setFormData(p => ({ ...p, subBlock: e.target.value || null }))} disabled={isReadOnly} className={ic}>
                    <option value="">[Top-Level / Overall]</option>
                    {ipIndexData[formData.ipBlock].Sub_Blocks.map(sb => (
                      <option key={sb.id} value={sb.name}>{sb.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lc}>Sample Source Ver <span className="text-red-500">*</span></label>
                <select name="sampleSourceVer" value={formData.sampleSourceVer} onChange={handleInput} disabled={isReadOnly} className={ic}>
                  <option value="">차수 선택...</option>
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={lc}>Reported In Stage</label>
                <select name="reportedInStage" value={formData.reportedInStage} onChange={handleInput} disabled={isReadOnly} className={ic}>
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            {formData.versionGap && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-bold ${gapStyle(formData.versionGap)}`}>
                {formData.versionGap === 'Potential Risk'
                  ? <AlertTriangle size={14} />
                  : <ShieldCheck size={14} />}
                Version Gap: {formData.versionGap}
              </div>
            )}
          </div>

          {/* 섹션 2: 고객 정보 */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-blue-900 flex items-center gap-1.5 border-b border-blue-100 pb-2">
              <Building2 size={14} className="text-blue-500" />고객 정보
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lc}>Customer</label>
                <input type="text" name="customer" value={formData.customer} onChange={handleInput} disabled={isReadOnly} className={ic} placeholder="고객사명" />
              </div>
              <div>
                <label className={lc}>Customer Stage</label>
                <select name="custStage" value={formData.custStage} onChange={handleInput} disabled={isReadOnly} className={ic}>
                  {CUST_STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* 섹션 3: 분석 정보 */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <AlertCircle size={14} className="text-gray-500" />분석 정보
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lc}>Severity</label>
                <select name="severity" value={formData.severity} onChange={handleInput} disabled={isReadOnly} className={ic}>
                  {SEVERITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={lc}>Disposition</label>
                <select name="disposition" value={formData.disposition} onChange={handleInput} disabled={isReadOnly} className={ic}>
                  {DISPOSITION_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={lc}>Phenomenon (현상) <span className="text-red-500">*</span></label>
              <textarea name="phenomenon" value={formData.phenomenon} onChange={handleInput} disabled={isReadOnly} className={tc} rows="3" placeholder="고객이 발견한 현상을 구체적으로 기록하세요" />
            </div>
            <div>
              <label className={lc}>Root Cause (원인) <span className="text-red-500">*</span></label>
              <textarea name="rootCause" value={formData.rootCause} onChange={handleInput} disabled={isReadOnly} className={tc} rows="3" placeholder="분석된 근본 원인을 기록하세요" />
            </div>
          </div>

          {/* 섹션 4: 첨부 링크 */}
          <div>
            <label className={`${lc} flex items-center gap-1`}><Link size={12} />Report Link</label>
            <input type="url" name="reportLink" value={formData.reportLink} onChange={handleInput} disabled={isReadOnly} className={ic} placeholder="https://..." />
          </div>

          {/* 액션 버튼 */}
          {!isReadOnly && (
            <div className="flex gap-3 pt-3 border-t border-gray-100">
              <button
                onClick={handleSave}
                disabled={isSaveDisabled}
                className={`flex-1 py-3 rounded-lg font-bold shadow-sm transition-colors flex items-center justify-center gap-2 ${isSaveDisabled
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
              >
                <CheckCircle size={16} />
                {editingId ? '수정 내용 저장' : '리포트 등록'}
              </button>
              {editingId && (
                <button onClick={resetForm} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2">
                  <X size={16} />수정 취소
                </button>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: 카드 리스트 */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 flex flex-col h-[calc(100vh-12rem)] overflow-y-auto">
          <div className="sticky top-0 z-10 bg-gray-50 rounded-t-xl px-5 pt-5 pb-3 mb-3 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-base font-semibold flex items-center gap-2 text-gray-800 m-0 whitespace-nowrap shrink-0">
              <FileSearch size={16} className="text-gray-600" />
              Current - {currentRevision}
              {selectedIp !== 'All' && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{selectedIp}</span>}
            </h2>
            <div className="flex flex-row items-center gap-2.5 shrink-0 overflow-x-auto ml-6 pl-1 p-1">
              <button onClick={() => setSeverityFilter('ALL')} className={`flex items-center gap-2 px-4 py-1 rounded-lg shadow-sm transition-all ${severityFilter === 'ALL' ? 'border-2 border-slate-400 bg-slate-100 scale-105 font-semibold' : 'border border-slate-200 bg-white opacity-60 hover:opacity-100'}`}>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Total</span><span className="font-mono font-semibold text-slate-700">{stats.total}</span>
              </button>
              <button onClick={() => setSeverityFilter('S1')} className={`flex items-center gap-2 px-4 py-1 rounded-lg shadow-sm transition-all ${severityFilter === 'S1' ? 'border-2 border-red-400 bg-red-100 scale-105 font-semibold' : 'border border-red-200 bg-red-50 opacity-60 hover:opacity-100'}`}>
                <span className="text-[10px] font-semibold text-red-500 uppercase tracking-widest">S1</span><span className="font-mono font-semibold text-red-700">{stats.s1}</span>
              </button>
              <button onClick={() => setSeverityFilter('S2')} className={`flex items-center gap-2 px-4 py-1 rounded-lg shadow-sm transition-all ${severityFilter === 'S2' ? 'border-2 border-orange-400 bg-orange-100 scale-105 font-semibold' : 'border border-orange-200 bg-orange-50 opacity-60 hover:opacity-100'}`}>
                <span className="text-[10px] font-semibold text-orange-500 uppercase tracking-widest">S2</span><span className="font-mono font-semibold text-orange-700">{stats.s2}</span>
              </button>
              <button onClick={() => setSeverityFilter('S3')} className={`flex items-center gap-2 px-4 py-1 rounded-lg shadow-sm transition-all ${severityFilter === 'S3' ? 'border-2 border-yellow-400 bg-yellow-100 scale-105 font-semibold' : 'border border-yellow-200 bg-yellow-50 opacity-60 hover:opacity-100'}`}>
                <span className="text-[10px] font-semibold text-yellow-600 uppercase tracking-widest">S3</span><span className="font-mono font-semibold text-yellow-700">{stats.s3}</span>
              </button>
            </div>
          </div>

          {(() => {
            const curFiltered = filteredReports.filter(f => {
              if (severityFilter === 'ALL') return true;
              return f.severity === severityFilter;
            });
            if (curFiltered.length === 0) {
              return (
                <div className="text-center text-gray-400 py-12 bg-white rounded-lg border border-dashed border-gray-300">
                  <FileSearch size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">해당 상태의 FA 리포트가 없습니다.</p>
                </div>
              );
            }

            const sections = [
              { id: 'S1', title: 'S1 (Critical)', items: curFiltered.filter(f => !f.isLinkedToLog && f.severity === 'S1') },
              { id: 'S2', title: 'S2 (Major)', items: curFiltered.filter(f => !f.isLinkedToLog && f.severity === 'S2') },
              { id: 'S3', title: 'S3 (Minor)', items: curFiltered.filter(f => !f.isLinkedToLog && f.severity === 'S3') },
              { id: 'linked', title: 'Linked Reports', items: curFiltered.filter(f => f.isLinkedToLog) }
            ];

            return (
              <div className="space-y-4 px-5 pb-5">
                {sections.map(sec => {
                  if (sec.items.length === 0) return null;
                  const isExpanded = expandedSections[sec.id];
                  return (
                    <div key={sec.id} className="space-y-2">
                      <h3
                        onClick={() => setExpandedSections(p => ({ ...p, [sec.id]: !p[sec.id] }))}
                        className={`flex items-center text-[11px] font-bold text-gray-500 tracking-wider cursor-pointer hover:bg-gray-100/50 p-1 rounded transition-colors ${sec.id === 'linked' ? 'opacity-60' : ''}`}
                      >
                        {isExpanded ? <ChevronDown size={14} className="mr-1" /> : <ChevronRight size={14} className="mr-1" />}
                        {sec.title}
                        <span className="ml-auto bg-gray-100 px-1.5 py-0.5 rounded text-[10px] text-gray-600 border border-gray-200">
                          {sec.items.length}건
                        </span>
                      </h3>
                      {isExpanded && (
                        <div className="space-y-2.5">
                          {sec.items.map(fa => (
                            <div
                              key={fa.faId}
                              onClick={() => handleEdit(fa)}
                              className={[
                                'bg-white rounded-xl shadow-sm overflow-hidden transition-all cursor-pointer hover:shadow-md hover:bg-slate-50',
                                getFaColorBar(fa),
                                editingId === fa.faId
                                  ? 'ring-2 ring-blue-500 border-transparent'
                                  : 'border border-gray-200',
                                sec.id === 'linked' ? 'opacity-60 hover:opacity-100' : ''
                              ].join(' ')}
                            >
                              {/* 카드 본문 */}
                              <div className="px-4 py-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">

                                    {/* Row 1: FA ID (대형 Bold) + severity/disposition/versionGap 뱃지 */}
                                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                                      <span className="text-[15px] font-semibold text-gray-900 tracking-tight font-mono">
                                        {fa.faId}
                                      </span>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${severityStyle(fa.severity)}`}>
                                        {fa.severity}
                                      </span>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${dispositionStyle(fa.disposition)}`}>
                                        {fa.disposition}
                                      </span>
                                      {fa.versionGap && (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${gapStyle(fa.versionGap)}`}>
                                          {fa.versionGap === 'Potential Risk' ? <AlertTriangle size={9} /> : <ShieldCheck size={9} />}
                                          {fa.versionGap === 'Potential Risk' ? 'Risk' : 'OK'}
                                        </span>
                                      )}
                                    </div>

                                    {/* Row 2: 메타데이터 2열 그리드 */}
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mb-2">
                                      <div className="flex items-center gap-1 text-xs text-gray-500 min-w-0">
                                        <Tag size={10} className="shrink-0 text-gray-400" />
                                        <span className="font-semibold text-gray-600 truncate">
                                          {fa.ipBlock || '–'}
                                          {fa.subBlock && <span className="text-[10px] text-indigo-500 ml-1">➔ {fa.subBlock}</span>}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 text-xs text-gray-500 min-w-0">
                                        <Building2 size={10} className="shrink-0 text-gray-400" />
                                        <span className="truncate">{fa.customer || '–'} ({fa.custStage})</span>
                                      </div>
                                      <div className="flex items-center gap-1 text-xs text-gray-500 col-span-2 min-w-0">
                                        <GitBranch size={10} className="shrink-0 text-gray-400" />
                                        <span className="truncate">{fa.sampleSourceVer} → {fa.reportedInStage}</span>
                                      </div>
                                    </div>

                                    {/* Row 3: 현상 (최대 3줄 말줄임) + 원인 (1줄) */}
                                    {fa.phenomenon && (
                                      <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">
                                        <span className="font-semibold text-gray-700">현상: </span>{fa.phenomenon}
                                      </p>
                                    )}
                                    {fa.rootCause && (
                                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                        <span className="font-semibold">원인: </span>{fa.rootCause}
                                      </p>
                                    )}
                                  </div>

                                  {/* 액션 버튼 */}
                                  {!isArchived && (
                                    <div className="flex gap-0.5 shrink-0 ml-1 mt-0.5">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteRequest(fa); }}
                                        disabled={fa.isLinkedToLog}
                                        className={`p-1.5 rounded transition-colors ${fa.isLinkedToLog ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* 연동 상태 + 리포트 링크 푸터 */}
                              <div className="px-4 pb-2.5 flex items-center justify-between border-t border-gray-100">
                                {fa.isLinkedToLog ? (
                                  <span className="flex items-center gap-1 text-[11px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                    <CheckCircle size={10} />연동 완료
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                    <AlertTriangle size={10} />미연동 — Log Pull 필요
                                  </span>
                                )}
                                {fa.reportLink && (
                                  <a href={fa.reportLink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                    <Link size={11} />리포트
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
      {/* MODALS SECTION */}
    </div>
  );
});

export default FaReportTab;
