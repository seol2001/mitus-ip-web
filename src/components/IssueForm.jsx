import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Edit2, FolderOpen, Activity, Link, CheckCircle, Save, X, AlertCircle } from 'lucide-react';
import { makeDefaultForm, calcNextNum, getHistory, getIssueStatus, DISPOSITION_OPTIONS, SEVERITY_OPTIONS, VERIFICATION_GAP_OPTIONS } from '../logic/revisionLogLogic';

const lc = "block text-[13px] font-medium text-gray-600 mb-1.5";
const ic = "px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed";
const tc = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 resize-y focus:border-blue-500 focus:ring-1 outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed disabled:resize-none";

const CustomerAlignmentFields = ({ formData, handleInput, disabled = false }) => (
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

export default function IssueForm({ 
  initialData, 
  mode, 
  editingId, 
  isReadOnly, 
  isArchived,
  stage,
  project,
  currentSelectedIp,
  availableIps,
  latestIssueStates,
  historyBlocks,
  issues,
  ipIndexData,
  curStageNums,
  carryoverCandidateSet,
  sortedLoadedIssues,
  availOrigins,
  sortedRevIds,
  onSave,
  onCancel,
  onPullFaClick,
  onUnlinkFa,
  onOpenAssigneeModal,
  onChange,
  onSetEditingId // 부모의 editingId를 동기화하기 위한 콜백
}) {
  const [formData, setFormData] = useState(initialData);

  // ── [수정] 0.1초의 레이스 컨디션 및 상태 유실 방지 ──
  // 단순히 initialData가 변했다고 덮어씌우지 않고, 실제로 '대상 이슈'가 바뀌었을 때만 초기화함
  const lastInitialId = React.useRef(null);
  useEffect(() => {
    // editingId(고유ID) 또는 targetIssue를 최우선으로 사용하여 고유성 보장. faId 추가하여 FA 연동 대응
    const currentId = editingId || initialData.id || initialData.faId || initialData.targetIssue || initialData.issueNum || 'new';
    if (lastInitialId.current !== currentId) {
      setFormData(initialData);
      lastInitialId.current = currentId;
    }
  }, [initialData, editingId]);

  // ── [제거] 무한 루프 원인이 되는 실시간 자동 동기화 useEffect ──
  // 대신 handleInput 및 개별 변경 핸들러에서 명시적으로 onChange를 호출함

  // Business Logic: Fixed -> Closed sync
  useEffect(() => {
    // 1. Fixed 상태인 경우 무조건 Closed로 동기화 (단, 이미 Closed가 아닐 때만)
    if (formData.assessment === 'Fixed') {
      if (formData.disposition !== 'Closed') {
        setFormData(prev => {
          const next = { ...prev, disposition: 'Closed' };
          if (onChange) onChange(next);
          return next;
        });
      }
    } 
    // 2. Eval 모드에서 Closed인 경우 Revision으로 복구 (단, 이미 Revision이 아닐 때만)
    else if (formData.entryMode === 'eval' && formData.disposition === 'Closed') {
      setFormData(prev => {
        const next = { ...prev, disposition: 'Revision' };
        if (onChange) onChange(next);
        return next;
      });
    }
  }, [formData.assessment, formData.entryMode, formData.disposition, onChange]);

  const handleInput = (e) => {
    const { name, value } = e.target;
    const nextData = { ...formData, [name]: value };
    setFormData(nextData);
    if (onChange) onChange(nextData);
  };

  const handleTypeToggle = (t) => {
    const cur = formData.types || [];
    const nextTypes = cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t];
    const nextData = { ...formData, types: nextTypes };
    setFormData(nextData);
    if (onChange) onChange(nextData);
  };

  const renderHistoricalContext = (id) => {
    const h = getHistory(id, historyBlocks, issues, project, stage);
    if (h.length === 0) return null;
    const prev = h.length > 1 ? h[h.length - 2] : null;
    const cur = h[h.length - 1];
    
    const getGapStr = (data) => {
      if (!data.verificationGap) return '';
      return ` (Gap: ${data.verificationGap}${data.gapComment ? ` - ${data.gapComment}` : ''})`;
    };
    
    return (
      <div className="mt-2 bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs space-y-1">
        <div className="font-bold text-slate-700 mb-1 flex items-center gap-1.5"><Activity size={12}/> Historical Context</div>
        {prev && (
          <div className="text-slate-500 truncate">
            <span className="font-semibold">[{prev.stage}]</span> {prev.data.disposition || prev.data.assessment || 'N/A'} - {prev.data.phenomenon || prev.data.comment || 'N/A'}
            {getGapStr(prev.data)}
          </div>
        )}
        <div className="text-slate-800 font-medium truncate">
          <span className="font-semibold text-blue-600">[{cur.stage} - 최신]</span> {cur.data.disposition || cur.data.assessment || 'N/A'} - {cur.data.phenomenon || cur.data.comment || cur.data.reopenReason || 'N/A'}
          {getGapStr(cur.data)}
        </div>
      </div>
    );
  };

  const isSaveDisabled = useMemo(() => {
     if (isArchived && !editingId) return true;
     if (mode === 'eval') return !formData.targetIssue || !formData.assessment || !(formData.comment?.trim());
     if (mode === 'carryover') {
       if (!formData.targetIssue || !formData.carryoverAction) return true;
       if (formData.carryoverAction === 'Close' && (!formData.comment || formData.comment.trim() === '')) return true;
       return false;
     }
     if (mode === 'reopen') return !formData.targetIssue || !formData.reopenReason;
     
     const hasRequiredFields = formData.ipBlock && formData.issueNum && formData.phenomenon?.trim() && formData.rootCause?.trim();
     return !hasRequiredFields;
  }, [mode, formData, isArchived, editingId]);

  const availableDispositions = stage === 'EVT0' && mode === 'new'
    ? DISPOSITION_OPTIONS.filter(opt => opt !== 'Revision')
    : DISPOSITION_OPTIONS;

  const closedIssues = useMemo(() => {
    const fixedThisStageMap = {};
    issues
      .filter(i => i.entryMode === 'eval' && i.assessment === 'Fixed')
      .forEach(i => {
        if (i.targetIssue) fixedThisStageMap[i.targetIssue] = true;
      });

    const closed = [];
    Object.entries(latestIssueStates).forEach(([id, st]) => {
      if (getIssueStatus(st) === 'CLOSED' && !fixedThisStageMap[id]) {
        closed.push(id);
      }
    });
    return closed.sort();
  }, [latestIssueStates, issues]);

  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-5 flex flex-col transition-all ${editingId && !isReadOnly ? 'ring-2 ring-blue-400' : ''} ${editingId && isReadOnly ? 'ring-2 ring-indigo-300 bg-indigo-50/10' : ''}`}>
       {editingId && (
         <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
           {isReadOnly ? (<><Edit2 size={14} className="text-slate-500" /><span className="text-sm font-bold text-slate-700">ReadOnly Mode <span className="text-xs font-normal text-slate-400 ml-1">(과거 차수 조회)</span></span></>) : (<><Edit2 size={14} className="text-blue-600" /><span className="text-sm font-bold text-blue-700">수정 모드</span></>)}
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
         <button onClick={onPullFaClick} disabled={isReadOnly} className={`w-full mb-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 border transition-all ${isReadOnly ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-amber-50 text-amber-700 border-amber-400 hover:bg-amber-100'}`}>
           <Link size={14}/> FA 리포트에서 데이터 가져오기
         </button>
       )}

      <fieldset disabled={isReadOnly} className="border-none p-0 m-0 flex-1">
        {mode === 'reopen' ? (
          <div className="space-y-4">
            <div>
              <label className={`${lc} flex justify-between`}><span>Target Issue to Re-open</span></label>
              <select name="targetIssue" value={formData.targetIssue} onChange={(e) => {
                const v = e.target.value; 
                const ex = issues.find(i => i.entryMode === 'reopen' && i.targetIssue === v);
                if (ex) { 
                  setFormData(ex); 
                  if (onChange) onChange(ex);
                  if (onSetEditingId) onSetEditingId(ex.id);
                } 
                else { 
                  const pv = latestIssueStates[v] || {}; 
                  const nextData = { ...makeDefaultForm(formData.ipBlock, stage), entryMode: 'reopen', targetIssue: v, severity: pv.severity || 'Major', phenomenon: pv.phenomenon || '', rootCause: pv.rootCause || '', disposition: 'Revision' };
                  setFormData(nextData); 
                  if (onChange) onChange(nextData);
                  if (onSetEditingId) onSetEditingId(null);
                }
              }} className={`w-full font-mono ${ic}`}>
                <option value="">이슈 선택...</option>
                {closedIssues.map(id => {
                  const isReopened = issues.some(it => it.entryMode === 'reopen' && it.targetIssue === id);
                  return (
                    <option key={id} value={id} style={isReopened ? { color: '#1e40af', fontWeight: '700' } : { color: '#374151' }}>
                      {isReopened ? `🔵 [재오픈됨] ${id}` : `⚪ [재오픈가능] ${id}`}
                    </option>
                  );
                })}
              </select>
              {formData.targetIssue && renderHistoricalContext(formData.targetIssue)}
            </div>
            {formData.targetIssue && (<>
              <div><label className={lc}>Re-open Reason</label><textarea name="reopenReason" value={formData.reopenReason} onChange={handleInput} className={`border-red-300 bg-red-50 ${tc}`} rows="2"></textarea></div>
              <div><label className={lc}>Severity</label><select name="severity" value={formData.severity} onChange={handleInput} className={`w-full ${ic}`}>{SEVERITY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
              <div><label className={lc}>Phenomenon</label><textarea name="phenomenon" value={formData.phenomenon} onChange={handleInput} className={tc} rows="2"></textarea></div>
              <div><label className={lc}>Root Cause</label><textarea name="rootCause" value={formData.rootCause} onChange={handleInput} className={tc} rows="2"></textarea></div>
              <div><label className={lc}>Disposition</label><select name="disposition" value={formData.disposition} onChange={handleInput} className={`w-full ${ic}`}>{availableDispositions.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
              <CustomerAlignmentFields formData={formData} handleInput={handleInput} disabled={isReadOnly} />
              <div><label className={lc}>Justification</label><textarea name="justification" value={formData.justification} onChange={handleInput} className={tc} rows="2"></textarea></div>
            </>)}
          </div>
        ) : (mode === 'new' || mode === 'fa') ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="w-full sm:w-[25%] shrink-0">
                <label className={lc}>IP Block</label>
                {/* [27B 감리] 'All' 차단: IP는 실제 선언된 IP 목록에서만 선택 가능 */}
                {currentSelectedIp === 'All' ? (
                  <select
                    value={formData.ipBlock || ''}
                    onChange={(e) => {
                      const newIp = e.target.value;
                      // [보안] allowlist 검증: availableIps에 없는 값 차단
                      if (!newIp || !(availableIps || []).includes(newIp)) return;
                      const newNum = calcNextNum(newIp, latestIssueStates);
                      const nextData = { ...formData, ipBlock: newIp, issueNum: newNum, subBlock: null };
                      setFormData(nextData);
                      if (onChange) onChange(nextData);
                    }}
                    disabled={isReadOnly}
                    className={`w-full h-10 ${ic} font-bold text-blue-800 bg-blue-50 border-blue-200`}
                  >
                    <option value="">-- IP 선택 --</option>
                    {(availableIps || []).filter(ip => ip !== 'All' && ip !== 'Deleted IP (Orphan)').map(ip => (
                      <option key={ip} value={ip}>{ip}</option>
                    ))}
                  </select>
                ) : (
                  <div className="h-10 px-3 flex items-center bg-blue-50 border border-blue-200 rounded-md text-sm font-bold text-blue-800">
                    {currentSelectedIp}
                  </div>
                )}
              </div>
              {ipIndexData && ipIndexData[currentSelectedIp] && ipIndexData[currentSelectedIp].Sub_Blocks && ipIndexData[currentSelectedIp].Sub_Blocks.length > 0 && (
                <div className="w-full sm:w-[30%] shrink-0">
                  <label className={lc}>Sub-Block / Issue Level</label>
                  <select name="subBlock" value={formData.subBlock || ''} onChange={(e) => {
                    const nextData = { ...formData, subBlock: e.target.value || null };
                    setFormData(nextData);
                    if (onChange) onChange(nextData);
                  }} className={`w-full ${ic}`} disabled={isReadOnly}>
                    <option value="">[Top-Level / System Overall]</option>
                    {ipIndexData[currentSelectedIp].Sub_Blocks.map(sb => (
                      <option key={sb.id} value={sb.name}>{sb.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="w-full flex-1">
                <label className={`${lc} flex justify-between`}><span>Issue Number</span></label>
                <div className="flex gap-2">
                  <select value={issues.some(i => i.entryMode === 'new' && i.ipBlock === formData.ipBlock && i.issueNum === formData.issueNum) ? formData.issueNum : (formData.issueNum === calcNextNum(formData.ipBlock, latestIssueStates) ? 'NEW' : 'DIRECT')}
                    onChange={(e) => { 
                      const v = e.target.value; 
                      if (v === 'NEW') { 
                        const nextData = { ...makeDefaultForm(formData.ipBlock, stage), issueNum: calcNextNum(formData.ipBlock, latestIssueStates) };
                        setFormData(nextData); 
                        if (onChange) onChange(nextData);
                        if (onSetEditingId) onSetEditingId(null); 
                      } 
                      else if (v === 'DIRECT') { 
                        const nextData = { ...formData, issueNum: '' };
                        setFormData(nextData); 
                        if (onChange) onChange(nextData);
                        if (onSetEditingId) onSetEditingId(null);
                      } 
                      else { 
                        const ex = issues.find(i => i.entryMode === 'new' && i.ipBlock === formData.ipBlock && i.issueNum === v); 
                        if (ex) { 
                          const nextData = { ...ex, types: ex.types || [] };
                          setFormData(nextData); 
                          if (onChange) onChange(nextData);
                          if (onSetEditingId) onSetEditingId(ex.id); 
                        } 
                      } 
                    }} className={`w-[55%] ${ic}`}>
                    <option value="NEW">+ 자동 채번(새로 등록)</option>
                    {curStageNums.map(n => <option key={n} value={n}>✅ {n}(수정)</option>)}
                    <option value="DIRECT">직접 입력...</option>
                  </select>
                  <input type="text" name="issueNum" value={formData.issueNum} onChange={(e) => {
                     const v = e.target.value; 
                     const ex = issues.find(i => i.entryMode === 'new' && i.ipBlock === formData.ipBlock && i.issueNum === v); 
                     if (ex) { 
                       const nextData = { ...ex, types: ex.types || [] };
                       setFormData(nextData); 
                       if (onChange) onChange(nextData);
                       if (onSetEditingId) onSetEditingId(ex.id);
                     } 
                     else { 
                       const nextData = { ...formData, issueNum: v };
                       setFormData(nextData); 
                       if (onChange) onChange(nextData);
                     } 
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
                    <select value={formData.origin || ''} onChange={(e) => { 
                      const v = e.target.value; 
                      const nextData = { ...formData, origin: v };
                      setFormData(nextData); 
                      if (onChange) onChange(nextData);
                    }} className={`w-full ${ic}`}>
                      <option value="">차수 선택</option>{availOrigins.map(s => <option key={s} value={s}>{s}</option>)}<option value="Direct">직접 입력...</option>
                    </select>
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
                    <select value={formData.sideEffectSource || ''} onChange={(e) => { 
                      const v = e.target.value; 
                      const nextData = { ...formData, sideEffectSource: v };
                      setFormData(nextData); 
                      if (onChange) onChange(nextData);
                    }} className={`w-full ${ic}`}>
                      <option value="">이슈 선택(Revision 항목)</option>{sortedRevIds.map(id => <option key={id} value={id}>{id}</option>)}<option value="Direct">직접 입력...</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
            {formData.faId && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-300 rounded-lg px-3 py-2 text-xs font-bold text-blue-800">
                <Link size={12}/>
                FA 연동 중: {formData.faId}
                {!isReadOnly && (
                  <button onClick={onUnlinkFa} className="ml-auto text-blue-600 hover:text-blue-800 bg-white border border-blue-200 px-2 py-1 rounded shadow-sm text-[10px] transition-colors">연동 해제</button>
                )}
              </div>
            )}
            <div><label className={lc}>Severity</label><select name="severity" value={formData.severity} onChange={handleInput} className={`w-full ${ic}`}>{SEVERITY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
            <div><label className={lc}>Phenomenon (현상)</label><textarea name="phenomenon" value={formData.phenomenon} onChange={handleInput} className={tc} rows="3"></textarea></div>
            <div><label className={lc}>Root Cause (원인)</label><textarea name="rootCause" value={formData.rootCause} onChange={handleInput} className={tc} rows="2"></textarea></div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lc}>Verification Gap</label>
                <select name="verificationGap" value={formData.verificationGap || ''} onChange={handleInput} className={`w-full ${ic}`}>
                  <option value="">Gap 선택...</option>
                  {VERIFICATION_GAP_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div>
                <label className={lc}>Gap Comment</label>
                <input type="text" name="gapComment" value={formData.gapComment || ''} onChange={handleInput} className={`w-full ${ic}`} placeholder="구체적인 누락 맥락" />
              </div>
            </div>

            <div><label className={lc}>Disposition (처리방향)</label><select name="disposition" value={formData.disposition} onChange={handleInput} disabled={formData.assessment === 'Fixed'} className={`w-full ${ic}`}>{availableDispositions.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
            <CustomerAlignmentFields formData={formData} handleInput={handleInput} disabled={isReadOnly} />
          </div>
        ) : mode === 'carryover' ? (
          <div className="space-y-4">
            <div>
              <label className={`${lc}`}>{editingId && <span className="text-blue-600 text-xs px-2 py-0.5 bg-blue-50 rounded-full font-bold ml-2">수정모드</span>}</label>
              <select name="targetIssue" value={formData.targetIssue || ''} onChange={(e) => {
                const v = e.target.value;
                const ex = issues.find(i => i.entryMode === 'carryover' && i.targetIssue === v);
                if (ex) { 
                  setFormData(ex); 
                  if (onChange) onChange(ex);
                  if (onSetEditingId) onSetEditingId(ex.id);
                } else {
                  let originMeta = {};
                  for (const blk of historyBlocks) {
                    const found = blk.issues.find(i => {
                      const iId = i.entryMode === 'new' ? `${i.ipBlock}.${project}.${i.issueNum}` : i.targetIssue;
                      return iId === v;
                    });
                    if (found) { originMeta = { ipBlock: found.ipBlock, severity: found.severity, phenomenon: found.phenomenon || '', rootCause: found.rootCause || '', disposition: found.disposition || 'Revision' }; break; }
                  }
                  const nextData = { ...makeDefaultForm(originMeta.ipBlock || currentSelectedIp, stage), targetIssue: v, ...originMeta };
                  setFormData(nextData);
                  if (onChange) onChange(nextData);
                  if (onSetEditingId) onSetEditingId(null);
                }
              }} className={`w-full font-mono ${ic}`}>
                <option value="">이월된 이슈 선택...</option>
                {issues.filter(i => i.entryMode === 'carryover').map(it => (
                  <option key={it.targetIssue} value={it.targetIssue} style={it.carryoverAction === 'Close' ? { color: '#15803d', fontWeight: '700' } : { color: '#c2410c', fontWeight: '700' }}>
                    {it.carryoverAction === 'Close' ? `🟢 [이월-DONE] ${it.targetIssue}` : `🟠 [이월-OPEN] ${it.targetIssue}`}
                  </option>
                ))}
                {Object.keys(carryoverCandidateSet || {})
                  .filter(id => !issues.some(i => i.entryMode === 'carryover' && i.targetIssue === id))
                  .sort()
                  .map(id => <option key={id} value={id} style={{ color: '#c2410c' }}>{`🟠 [이월-OPEN] ${id}`}</option>)
                }
              </select>
              {formData.targetIssue && renderHistoricalContext(formData.targetIssue)}
            </div>
            {formData.targetIssue && (
              <div className="border-t border-dashed pt-4 space-y-4">
                 <label className="block text-sm font-semibold text-gray-700">디자이너 Action 결정</label>
                 <div className="flex gap-2 mb-2">
                    {['Keep Open', 'Close', 'Revision'].map(act => (
                      <label key={act} className={`flex-1 text-sm font-bold flex items-center gap-2 border p-2 rounded-lg cursor-pointer ${formData.carryoverAction === act ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-white'}`}>
                        <input type="radio" name="carryoverAction" value={act} checked={formData.carryoverAction === act} onChange={handleInput}/> {act}
                      </label>
                    ))}
                 </div>
                 {formData.carryoverAction === 'Keep Open' && <div><label className={lc}>Keep Open 사유</label><textarea name="comment" value={formData.comment || ''} onChange={handleInput} placeholder="미조치 사유 입력" className={tc} rows="2"></textarea></div>}
                 {formData.carryoverAction === 'Close' && (
                   <div className="bg-red-50 border border-red-200 p-4 rounded-lg space-y-3">
                     <h3 className="text-sm font-bold text-red-700">이슈 강제 종료 (Close)</h3>
                     <div><label className={lc}>종결 방향</label><select name="disposition" value={formData.disposition === 'Waived' || formData.disposition === 'Acceptable' ? formData.disposition : 'Acceptable'} onChange={handleInput} className={`w-full font-bold text-red-700 border-red-300 ${ic}`}><option value="Acceptable">Acceptable</option><option value="Waived">Waived</option></select></div>
                     <div><label className={lc}>종료 사유 (필수)</label><textarea name="comment" value={formData.comment || ''} onChange={handleInput} placeholder="상세 사유 입력" className={`border-red-300 focus:border-red-500 ${tc}`} rows="2"></textarea></div>
                   </div>
                 )}
                 {formData.carryoverAction === 'Revision' && <div><label className={lc}>새 대책 / 수정 내용</label><textarea name="modPlan" value={formData.modPlan || ''} onChange={handleInput} className={tc} rows="2"></textarea></div>}
              </div>
            )}
          </div>
        ) : mode === 'eval' ? (
          <div className="space-y-4">
            <div>
              <label className={`${lc}`}>{editingId && <span className="text-blue-600 text-xs px-2 py-0.5 bg-blue-50 rounded-full font-bold ml-2">수정모드</span>}</label>
              <select name="targetIssue" value={formData.targetIssue || ''} onChange={(e) => {
                const v = e.target.value;
                const ex = issues.find(i => i.entryMode === 'eval' && i.targetIssue === v);
                if (ex) { 
                  setFormData(ex); 
                  if (onChange) onChange(ex);
                  if (onSetEditingId) onSetEditingId(ex.id);
                } else {
                  let originMeta = {};
                  for (const blk of historyBlocks) {
                    const found = blk.issues.find(i => {
                      const iId = i.entryMode === 'new' ? `${i.ipBlock}.${project}.${i.issueNum}` : i.targetIssue;
                      return iId === v;
                    });
                    if (found) { originMeta = { ipBlock: found.ipBlock, severity: found.severity }; break; }
                  }
                  const nextData = { ...makeDefaultForm(originMeta.ipBlock || currentSelectedIp, stage), targetIssue: v, assessment: 'Fixed', ...originMeta };
                  setFormData(nextData);
                  if (onChange) onChange(nextData);
                  if (onSetEditingId) onSetEditingId(null);
                }
              }} className={`w-full font-mono ${ic}`}>
                <option value="">이슈 선택...</option>
                {sortedLoadedIssues.map(id => {
                  const isDone = issues.some(it => it.entryMode === 'eval' && it.targetIssue === id);
                  return (<option key={id} value={id} style={isDone ? { color: '#1e40af', fontWeight: '700' } : { color: '#dc2626' }}>{isDone ? `🔵 [평가완료] ${id}` : `🔴 [평가대기] ${id}`}</option>);
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
                <CustomerAlignmentFields formData={formData} handleInput={handleInput} disabled={isReadOnly} />
              </div>
            )}
          </div>
        ) : null}

        <div><label className={`${lc} mt-4 flex justify-between items-center`}><span>Assignee (담당자)</span></label><input type="text" name="assignee" value={formData.assignee || ''} onClick={() => !isReadOnly && onOpenAssigneeModal()} readOnly className={`w-full ${isReadOnly ? 'cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200' : 'cursor-pointer bg-slate-50 focus:bg-slate-100 hover:border-blue-400'} transition-colors ${ic}`} placeholder="클릭하여 지정" /></div>
      </fieldset>

      {/* ───────── 하단 버튼 영역 (배포 버전 복구) ───────── */}
      <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-100">
        {/* 리스트에 추가 / 수정 사항 저장 (왼쪽, 넓게) */}
        <button
          onClick={() => onSave(formData)}
          disabled={isSaveDisabled || isReadOnly}
          className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white shadow-lg transition-all duration-200 ${
            isSaveDisabled || isReadOnly 
              ? 'bg-gray-300 cursor-not-allowed shadow-none' 
              : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98] shadow-blue-600/25'
          }`}
        >
          <CheckCircle size={18} />
          {editingId ? '수정 사항 저장' : '리스트에 추가'}
        </button>

        {/* 취소 (오른쪽) */}
        <button
          onClick={onCancel}
          className="px-6 py-3 rounded-xl text-sm font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 active:scale-[0.98] transition-all border border-gray-200 flex items-center gap-2"
        >
          <X size={18} />
          취소
        </button>
      </div>
    </div>
  );
}
