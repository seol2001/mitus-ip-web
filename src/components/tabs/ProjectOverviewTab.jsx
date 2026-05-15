import React, { useState, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import { foundryProcessMap, ipCategoryNameMap } from '../../data/mockData';
import { X } from '../Icons';
import ActionBar from '../ActionBar';
import { LayoutDashboard, Lock, Copy } from 'lucide-react';
import { DEFAULT_OVERVIEW_SCHEMA, MAJOR_SPECS_SCHEMA, ORGANIZATION_SCHEMA } from '../../data/schemaConfig';
import { useAutoSave, clearAutoSave } from '../../hooks/useAutoSave';
import { useConfirm } from '../../contexts/ConfirmContext';
import AutoSaveRecoveryModal from '../AutoSaveRecoveryModal';

// ─── [D&D] 드래그 앤 드롭 라이브러리 임포트 ───
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, rectSortingStrategy, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const OSAT_OPTIONS = ['ASE_Korea', 'Amkor_Technology', 'JCET_Group', 'SPIL', 'PTI', 'Nepes', 'SFA_Semicon', '기타'];
const STAGE_ORDER = ['EVT0', 'EVT1', 'EVT2', 'EVT3', 'EVT4', 'EVT5'];

const SortableField = ({ id, isEditing, className, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !isEditing });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 1,
    position: isDragging ? 'relative' : 'static',
  };

  return (
    <div ref={setNodeRef} style={style} className={className}>
      {typeof children === 'function' ? children(listeners, attributes) : children}
    </div>
  );
};

const IpDeleteModal = ({ type, ipName, references, onConfirm, onCancel, customTitle, customMessage }) => {
  const isBlocked = type === 'blocked';
  const headerLabel  = customTitle  ?? (isBlocked ? 'IP 삭제 불가' : 'IP 삭제 최종 확인');
  const subHeading   = customTitle  ?? (isBlocked ? '삭제 차단' : '영구 삭제 경고');
  const bodyMessage  = customMessage ?? (isBlocked
    ? '해당 IP와 연결된 기록이 존재하여 삭제할 수 없습니다. 관련 데이터를 모두 정리해 주세요.'
    : '해당 IP를 삭제하시겠습니까? 삭제 시 설정된 기본 정보가 영구적으로 제거됩니다.');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(15,23,42,0.45)' }} onClick={onCancel}>
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border overflow-hidden animate-modal-in" style={{ borderColor: isBlocked ? '#fca5a5' : '#fde68a' }} onClick={e => e.stopPropagation()}>
        <div className="h-1.5 w-full" style={{ background: isBlocked ? 'linear-gradient(90deg,#ef4444,#f87171)' : 'linear-gradient(90deg,#f59e0b,#fbbf24)' }} />
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{ background: isBlocked ? '#fee2e2' : '#fef3c7' }}>{isBlocked ? '🚫' : '⚠️'}</div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: isBlocked ? '#dc2626' : '#d97706' }}>{headerLabel}</p>
              <h2 className="text-base font-extrabold text-slate-800"><span className="inline-block bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded text-sm mr-1">{ipName}</span>{subHeading}</h2>
            </div>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed mb-4">{bodyMessage}</p>
          {isBlocked && references && references.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4 max-h-36 overflow-y-auto">
              <p className="text-[11px] font-bold text-red-600 uppercase mb-2 tracking-wider">발견된 참조 데이터</p>
              <ul className="space-y-1">
                {references.map((ref, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-red-800"><span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />{ref}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <button onClick={onCancel} className="px-4 py-2 text-sm font-bold rounded-xl border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors">{isBlocked ? '확인' : '취소'}</button>
            {!isBlocked && <button onClick={onConfirm} className="px-4 py-2 text-sm font-bold rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors shadow-sm">삭제 확정</button>}
          </div>
        </div>
      </div>
      <style>{`@keyframes modal-in { from { opacity: 0; transform: scale(0.92) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } } .animate-modal-in { animation: modal-in 0.18s cubic-bezier(.4,0,.2,1) both; }`}</style>
    </div>
  );
};

const ProjectOverviewTab = forwardRef(({ data, currentStage, isArchived, lockReason, projectId, dbUpdatedAt, onSubmit, onImmediateUpdate, onFormDirtyChange, revisionLogData, faReportData, onEditingStateChange, onForceUnlock, globalIpDictionary, onAddCustomIp }, ref) => {
  const safeData = data || {};
  // [수정] 모든 탭 초기 잠금 상태로 시작 (사용자 요청)
  const [unlockedOverview, setUnlockedOverview] = useState(false);

  // [추가] 외부(App.jsx)에서 상태를 리셋할 수 있는 기능 노출
  useImperativeHandle(ref, () => ({
    canNavigate: async () => true, // Overview는 현재 별도의 Dirty 가드가 필요 없음
    resetForm: () => {
      setUnlockedOverview(false);
      // [Gemma4/27B 합의 수정] 탭 전환 복구 시 로컬 schema 상태를 명시적 초기화.
      // useEffect의 [safeData.UI_Schemas] 참조 동일성 트랩을 우회하는 직접 초기화.
      setOverviewSchema(safeData.UI_Schemas?.Contents || DEFAULT_OVERVIEW_SCHEMA);
      setSpecsSchema(safeData.UI_Schemas?.Specs || MAJOR_SPECS_SCHEMA);
      setOrgSchema(safeData.UI_Schemas?.Organization || ORGANIZATION_SCHEMA);
    }
  }), [safeData.UI_Schemas]);
  
  const showConfirm = useConfirm();
  
  const [overviewSchema, setOverviewSchema] = useState(safeData.UI_Schemas?.Contents || DEFAULT_OVERVIEW_SCHEMA);
  const [specsSchema, setSpecsSchema] = useState(safeData.UI_Schemas?.Specs || MAJOR_SPECS_SCHEMA);
  const [orgSchema, setOrgSchema] = useState(safeData.UI_Schemas?.Organization || ORGANIZATION_SCHEMA);

  useEffect(() => {
    // 프로젝트 전체 잠금 상태가 바뀌면 탭 로컬 편집 상태도 동기화
    // [수정] 강제 잠금 로직만 유지하여 초기 진입 시 잠금 상태 보장 (사용자 요청)
    if (isArchived === true) {
      setUnlockedOverview(false);
    }
  }, [isArchived]);

  // ─── 지능형 Auto-Save ───
  const { showRecoveryModal, recoveredTime, handleRestore, handleDiscard } = useAutoSave({
    projectId,
    tabName: 'Project_Overview',
    data: safeData,
    isEditing: unlockedOverview,
    onRestore: (recoveredData) => {
      if (onImmediateUpdate) onImmediateUpdate(recoveredData, true);
    },
    dbUpdatedAt,
    setIsEditing: setUnlockedOverview
  });

  useEffect(() => {
    // [Gemma4 설계 반영] UI_Schemas 뿐만 아니라 내부 데이터(Contents, Specs 등)의 
    // 실제 값이 변경되었을 때도 로컬 스키마 상태를 동기화해야 Stale State 버그가 발생하지 않음.
    setOverviewSchema(safeData.UI_Schemas?.Contents || DEFAULT_OVERVIEW_SCHEMA);
    setSpecsSchema(safeData.UI_Schemas?.Specs || MAJOR_SPECS_SCHEMA);
    setOrgSchema(safeData.UI_Schemas?.Organization || ORGANIZATION_SCHEMA);
  }, [safeData.UI_Schemas, safeData.Contents, safeData.Specs, safeData.Organization]);

  const isOverviewDisabled = isArchived || !unlockedOverview;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // ─── [D&D] 정렬 핸들러 ───
  const handleSpecsDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSpecsSchema((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        const newSchema = arrayMove(items, oldIndex, newIndex);
        if (onImmediateUpdate) onImmediateUpdate({ ...safeData, UI_Schemas: { ...(safeData.UI_Schemas || {}), Specs: newSchema } });
        return newSchema;
      });
    }
  };

  const handleOrgDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrgSchema((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        const newSchema = arrayMove(items, oldIndex, newIndex);
        if (onImmediateUpdate) onImmediateUpdate({ ...safeData, UI_Schemas: { ...(safeData.UI_Schemas || {}), Organization: newSchema } });
        return newSchema;
      });
    }
  };

  const handleContentsDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOverviewSchema((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        const newSchema = arrayMove(items, oldIndex, newIndex);
        if (onImmediateUpdate) onImmediateUpdate({ ...safeData, UI_Schemas: { ...(safeData.UI_Schemas || {}), Contents: newSchema } });
        return newSchema;
      });
    }
  };

  // ─── Major Specs 핸들러 ───
  const handleSpecsLabelChange = (id, newLabel) => {
    const newSchema = specsSchema.map(f => f.id === id ? { ...f, label: newLabel } : f);
    setSpecsSchema(newSchema);
    if (onImmediateUpdate) onImmediateUpdate({ ...safeData, UI_Schemas: { ...(safeData.UI_Schemas || {}), Specs: newSchema } });
  };
  const handleSpecsDelete = async (id) => {
    const confirmed = await showConfirm({
      title: "항목 삭제 확인",
      message: "이 스펙 항목을 삭제하시겠습니까?",
      type: "danger",
      confirmText: "삭제"
    });

    if (confirmed) {
      const newSchema = specsSchema.filter(f => f.id !== id);
      setSpecsSchema(newSchema);
      const newData = { ...safeData, UI_Schemas: { ...(safeData.UI_Schemas || {}), Specs: newSchema } };
      if (newData.Specs) {
        const newSpecsData = { ...newData.Specs };
        delete newSpecsData[id];
        newData.Specs = newSpecsData;
      }
      if (onImmediateUpdate) onImmediateUpdate(newData);
    }
  };
  const handleSpecsAdd = () => {
    const newId = `Spec_${Date.now()}`;
    const newSchema = [...specsSchema, { id: newId, label: 'New Spec' }];
    setSpecsSchema(newSchema);
    if (onImmediateUpdate) onImmediateUpdate({ ...safeData, UI_Schemas: { ...(safeData.UI_Schemas || {}), Specs: newSchema } });
  };

  // ─── Organization 핸들러 ───
  const handleOrgLabelChange = (id, newLabel) => {
    const newSchema = orgSchema.map(f => f.id === id ? { ...f, label: newLabel } : f);
    setOrgSchema(newSchema);
    if (onImmediateUpdate) onImmediateUpdate({ ...safeData, UI_Schemas: { ...(safeData.UI_Schemas || {}), Organization: newSchema } });
  };
  const handleOrgDelete = async (id) => {
    const confirmed = await showConfirm({
      title: "항목 삭제 확인",
      message: "이 조직 항목을 삭제하시겠습니까?",
      type: "danger",
      confirmText: "삭제"
    });

    if (confirmed) {
      const newSchema = orgSchema.filter(f => f.id !== id);
      setOrgSchema(newSchema);
      const newData = { ...safeData, UI_Schemas: { ...(safeData.UI_Schemas || {}), Organization: newSchema } };
      if (newData.Organization) {
        const newOrgData = { ...newData.Organization };
        delete newOrgData[id];
        newData.Organization = newOrgData;
      }
      if (onImmediateUpdate) onImmediateUpdate(newData);
    }
  };
  const handleOrgAdd = () => {
    const newId = `Org_${Date.now()}`;
    const newSchema = [...orgSchema, { id: newId, label: 'New Field' }];
    setOrgSchema(newSchema);
    if (onImmediateUpdate) onImmediateUpdate({ ...safeData, UI_Schemas: { ...(safeData.UI_Schemas || {}), Organization: newSchema } });
  };

  // ─── Contents 핸들러 ───
  const handleSchemaLabelChange = (id, newLabel) => {
    const newSchema = overviewSchema.map(field => field.id === id ? { ...field, label: newLabel } : field);
    setOverviewSchema(newSchema);
    if (onImmediateUpdate) onImmediateUpdate({ ...safeData, UI_Schemas: { ...(safeData.UI_Schemas || {}), Contents: newSchema } });
  };
  const handleSchemaDelete = async (id) => {
    const confirmed = await showConfirm({
      title: "항목 삭제 확인",
      message: "이 항목을 삭제하시겠습니까?",
      type: "danger",
      confirmText: "삭제"
    });

    if (confirmed) {
      const newSchema = overviewSchema.filter(f => f.id !== id);
      setOverviewSchema(newSchema);
      const newData = { ...safeData, UI_Schemas: { ...(safeData.UI_Schemas || {}), Contents: newSchema } };
      if (newData.Contents) {
        const newContentsData = { ...newData.Contents };
        delete newContentsData[id];
        newData.Contents = newContentsData;
      }
      if (onImmediateUpdate) onImmediateUpdate(newData);
    }
  };
  const handleSchemaAdd = () => {
    const newId = `Custom_${Date.now()}`;
    setOverviewSchema(prev => {
      const nextNum = prev.length + 1; 
      const newSchema = [...prev, { id: newId, label: `${nextNum}. New Custom Field`, rows: 4 }];
      if (onImmediateUpdate) onImmediateUpdate({ ...safeData, UI_Schemas: { ...(safeData.UI_Schemas || {}), Contents: newSchema } });
      return newSchema;
    });
  };

  // ─── 🚀 테이블(Table) 전용 핸들러 추가 ───
  const handleTableTemplateRowChange = (fieldId, rowId, newLabel) => {
    const newSchema = overviewSchema.map(field => {
      if (field.id === fieldId && field.type === 'table') {
        const newRows = (field.templateRows || []).map(r => r.id === rowId ? { ...r, item: newLabel } : r);
        return { ...field, templateRows: newRows };
      }
      return field;
    });
    setOverviewSchema(newSchema);
    if (onImmediateUpdate) onImmediateUpdate({ ...safeData, UI_Schemas: { ...(safeData.UI_Schemas || {}), Contents: newSchema } });
  };

  const handleTableTemplateRowDelete = async (fieldId, rowId) => {
    const confirmed = await showConfirm({
      title: "항목 삭제",
      message: "이 테이블 항목을 삭제하시겠습니까?",
      type: "danger",
      confirmText: "삭제"
    });

    if (confirmed) {
      const newSchema = overviewSchema.map(field => {
        if (field.id === fieldId && field.type === 'table') {
          const newRows = (field.templateRows || []).filter(r => r.id !== rowId);
          return { ...field, templateRows: newRows };
        }
        return field;
      });
      setOverviewSchema(newSchema);
      
      const newData = { ...safeData, UI_Schemas: { ...(safeData.UI_Schemas || {}), Contents: newSchema } };
      if (newData[fieldId] && typeof newData[fieldId] === 'object') {
         const newTableData = { ...newData[fieldId] };
         delete newTableData[rowId];
         newData[fieldId] = newTableData;
      }
      if (onImmediateUpdate) onImmediateUpdate(newData);
    }
  };

  const handleTableTemplateRowAdd = (fieldId) => {
    const newSchema = overviewSchema.map(field => {
      if (field.id === fieldId && field.type === 'table') {
        const newRowId = `row_${Date.now()}`;
        const newRows = [...(field.templateRows || []), { id: newRowId, item: "New Item" }];
        return { ...field, templateRows: newRows };
      }
      return field;
    });
    setOverviewSchema(newSchema);
    if (onImmediateUpdate) onImmediateUpdate({ ...safeData, UI_Schemas: { ...(safeData.UI_Schemas || {}), Contents: newSchema } });
  };

  const handleTableDataChange = (fieldId, rowId, colName, value) => {
    const currentFieldData = typeof safeData[fieldId] === 'object' && safeData[fieldId] !== null ? safeData[fieldId] : {};
    const currentRowData = currentFieldData[rowId] || { spec: '', unit: '', remarks: '' };
    const newFieldData = {
      ...currentFieldData,
      [rowId]: { ...currentRowData, [colName]: value }
    };
    handleChange({ target: { name: fieldId, value: newFieldData } });
  };

  // ─── 공통 로직 ───
  const handleChange = (e) => {
    const { name, value } = e.target;
    const newData = { ...safeData, [name]: value };
    if (name === 'Foundry') newData.Process = (foundryProcessMap[value] || [])[0] || '';
    if (onImmediateUpdate) onImmediateUpdate(newData);
    if (onFormDirtyChange) onFormDirtyChange(true);
  };

  const handleNestedChange = (section, field, value) => {
    const newData = { ...safeData, [section]: { ...(safeData[section] || {}), [field]: value } };
    if (onImmediateUpdate) onImmediateUpdate(newData);
    if (onFormDirtyChange) onFormDirtyChange(true);
  };

  const handleSubmit = () => {
    if (onSubmit) onSubmit(safeData);
    clearAutoSave(projectId, 'Project_Overview');
    setUnlockedOverview(false);
  };


  const dictToUse = globalIpDictionary || ipCategoryNameMap;
  const initialCategory = Object.keys(dictToUse)[0] || '';
  const initialIp = (dictToUse[initialCategory] || [])[0] || '';
  const [selCategory, setSelCategory] = useState(initialCategory);
  const [selIpName, setSelIpName] = useState(initialIp);

  const [customIpModalOpen, setCustomIpModalOpen] = useState(false);
  const [customIpForm, setCustomIpForm] = useState({ category: '', name: '', description: '' });

  const handleCustomIpSubmit = async () => {
    if (!customIpForm.category || !customIpForm.name || !customIpForm.description) {
      alert('카테고리, 이름, 설명을 모두 입력해주세요.');
      return;
    }
    const success = await onAddCustomIp(customIpForm.category, customIpForm.name, customIpForm.description);
    if (success) {
      setSelCategory(customIpForm.category);
      setSelIpName(customIpForm.name);
      const current = safeData.IP_Blocks || [];
      if (!current.includes(customIpForm.name)) {
        const newData = { ...safeData, IP_Blocks: [...current, customIpForm.name] };
        if (onImmediateUpdate) onImmediateUpdate(newData);
      }
      setCustomIpModalOpen(false);
      setCustomIpForm({ category: '', name: '', description: '' });
    }
  };


  const handleOsatToggle = (option) => {
    if (isOverviewDisabled) return;
    const current = safeData.OSAT_Partner || [];
    const newData = { ...safeData, OSAT_Partner: current.includes(option) ? current.filter(o => o !== option) : [...current, option] };
    if (onImmediateUpdate) onImmediateUpdate(newData);
  };

  const [modal, setModal] = useState(null);
  const closeModal = useCallback(() => setModal(null), []);

  const checkIpDependencies = useCallback((ipName) => {
    const refs = [];
    const rl = revisionLogData || {};
    const checkIssues = (issues = [], stageName = '') => {
      issues.forEach(issue => {
        const block = issue.ipBlock || (issue.targetIssue ? issue.targetIssue.split('.')[0] : '');
        if (block === ipName) refs.push((stageName ? `[Revision Log / ${stageName}] ` : `[Revision Log / Current Stage] `) + (issue.targetIssue || `${issue.ipBlock} ${issue.issueNum || ''}`).trim());
      });
    };
    checkIssues(rl.issues, '');
    (rl.historyBlocks || []).forEach(hb => checkIssues(hb.issues || [], hb.stageName));
    (faReportData?.faReports || []).forEach(report => {
      if (report.ipBlock === ipName) refs.push(`[FA Report] ${report.faId || report.ipBlock} — ${report.phenomenon?.slice(0, 30) || ''}…`);
    });
    return refs;
  }, [revisionLogData, faReportData]);

  const addIpBlock = () => {
    if (selIpName === '__CUSTOM__') {
      setCustomIpForm({ category: selCategory, name: '', description: '' });
      setCustomIpModalOpen(true);
      return;
    }
    if ((safeData.IP_Blocks || []).includes(selIpName)) {
      setModal({ type: 'blocked', ipName: selIpName, references: ['이미 Project IP Blocks 목록에 등록된 IP입니다.'], onConfirm: null, customTitle: '중복 IP', customMessage: `'${selIpName}'은(는) 이미 존재하는 IP입니다. 동일한 IP를 중복 추가할 수 없습니다.` });
      return;
    }
    if (onImmediateUpdate) onImmediateUpdate({ ...safeData, IP_Blocks: [...(safeData.IP_Blocks || []), selIpName] });
  };

  const removeIpBlock = useCallback((ipToRemove) => {
    const refs = checkIpDependencies(ipToRemove);
    if (refs.length > 0) {
      setModal({ type: 'blocked', ipName: ipToRemove, references: refs, onConfirm: null });
    } else {
      setModal({
        type: 'confirm', ipName: ipToRemove, references: [],
        onConfirm: () => {
          if (onImmediateUpdate) onImmediateUpdate({ ...safeData, IP_Blocks: (safeData.IP_Blocks || []).filter(ip => ip !== ipToRemove) });
          setModal(null);
        },
      });
    }
  }, [checkIpDependencies, safeData, onImmediateUpdate]);

  useEffect(() => {
    if (onEditingStateChange) onEditingStateChange(unlockedOverview);
  }, [unlockedOverview, onEditingStateChange]);

  const labelClass = "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1";
  const inputClass = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 bg-slate-50 focus:bg-white transition-colors disabled:opacity-50 disabled:bg-slate-100 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 placeholder:font-medium placeholder:text-slate-300";

  return (
    <div className="max-w-full grid grid-cols-1 xl:grid-cols-12 gap-8 text-left h-full pb-10">
      
      {modal && <IpDeleteModal type={modal.type} ipName={modal.ipName} references={modal.references} onConfirm={modal.onConfirm} onCancel={closeModal} customTitle={modal.customTitle} customMessage={modal.customMessage} />}

      <AutoSaveRecoveryModal 
        isOpen={showRecoveryModal} 
        timestamp={recoveredTime} 
        onRestore={handleRestore} 
        onDiscard={handleDiscard} 
      />

      {/* ── 헤더 영역 ── */}
      <div className="xl:col-span-12 w-full flex flex-col sm:flex-row items-start sm:items-center pb-4 border-b border-slate-200 mb-6 gap-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
            <LayoutDashboard size={28} className="text-blue-600" />
            Project Overview
          </h1>
          {isArchived && <span className="text-xs px-2 py-1 bg-slate-100 text-slate-500 rounded font-bold flex items-center gap-1"><Lock size={11} />Read-Only</span>}
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          
          <div className="shrink-0 border-l pl-3 border-slate-200">
            <ActionBar 
              isGlobalArchived={isArchived} 
              isEditing={unlockedOverview} 
              onEdit={() => setUnlockedOverview(true)} 
              onLock={handleSubmit} 
              lockReason={lockReason}
              onForceUnlock={onForceUnlock}
            />
          </div>
        </div>
      </div>

      {/* ── 좌측 컬럼 ── */}
      <div className="xl:col-span-4 space-y-6">
        <div className={`bg-white p-6 rounded-2xl shadow-sm border transition-colors space-y-5 ${!isOverviewDisabled ? "border-amber-300 ring-4 ring-amber-50" : "border-slate-200"}`}>
          <h2 className="text-lg font-extrabold text-slate-800 border-b border-slate-100 pb-3 flex items-center justify-between">Project & Customer Info</h2>
          <div className="space-y-4">
            <div><label className={labelClass}>Project Name</label><input type="text" value={safeData.Project_Name || ''} className={`${inputClass} bg-slate-100`} disabled={true} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelClass}>Customer</label><input type="text" value={safeData.Customer_Name || ''} onChange={(e) => handleChange({target: {name: 'Customer_Name', value: e.target.value}})} className={inputClass} disabled={isOverviewDisabled} /></div>
              <div><label className={labelClass}>Application</label><input type="text" value={safeData.Target_Application || ''} onChange={(e) => handleChange({target: {name: 'Target_Application', value: e.target.value}})} className={inputClass} disabled={isOverviewDisabled} /></div>
            </div>
          </div>
        </div>

        {/* 🚀 Major Specs (D&D) */}
        <div className={`bg-white p-6 rounded-2xl shadow-sm border transition-colors space-y-5 ${!isOverviewDisabled ? "border-amber-300 ring-4 ring-amber-50" : "border-slate-200"}`}>
          <h2 className="text-lg font-extrabold text-slate-800 border-b border-slate-100 pb-3 flex items-center justify-between">Major Specs</h2>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSpecsDragEnd}>
            <SortableContext items={specsSchema.map(f => f.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 gap-4">
                {specsSchema.map((field) => {
                  const isCustomSpec = !MAJOR_SPECS_SCHEMA.some(s => s.id === field.id);
                  return (
                  <SortableField 
                    key={field.id} id={field.id} isEditing={unlockedOverview}
                    className={`${field.colSpan === 2 ? 'col-span-2' : 'col-span-1'} ${unlockedOverview ? "relative group" : ""}`}
                  >
                    {(dragListeners, dragAttributes) => (
                      <>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5 flex-1">
                            {unlockedOverview && <div className="cursor-grab text-slate-300 hover:text-amber-500" {...dragListeners} {...dragAttributes}>⠿</div>}
                            {unlockedOverview && isCustomSpec ? (
                              <input type="text" value={field.label} onChange={(e) => handleSpecsLabelChange(field.id, e.target.value)} className="text-[11px] font-bold text-slate-700 bg-white border border-slate-200 rounded px-1.5 py-0.5 outline-none focus:border-amber-400 w-1/2 uppercase tracking-wider" placeholder="항목 이름" />
                            ) : (
                              <label className={`${labelClass} mb-0 ml-0`}>{field.label}</label>
                            )}
                          </div>
                          {unlockedOverview && isCustomSpec && (
                            <button onClick={() => handleSpecsDelete(field.id)} className="text-slate-300 hover:text-red-500 transition-colors p-0.5"><X size={14} /></button>
                          )}
                        </div>
                        <input type="text" value={safeData.Specs?.[field.id] || ''} onChange={(e) => handleNestedChange('Specs', field.id, e.target.value)} className={inputClass} disabled={isOverviewDisabled} />
                      </>
                    )}
                  </SortableField>
                  );
                })}
              </div>
              {unlockedOverview && (
                <button onClick={handleSpecsAdd} className="w-full py-2.5 mt-4 border-2 border-dashed border-amber-200 rounded-xl text-amber-600 font-bold text-sm hover:bg-amber-50 transition-colors flex items-center justify-center gap-2">➕ 새 스펙 항목 추가</button>
              )}
            </SortableContext>
          </DndContext>
        </div>

        <div className={`bg-white p-6 rounded-2xl shadow-sm border transition-colors space-y-5 ${!isOverviewDisabled ? "border-amber-300 ring-4 ring-amber-50" : "border-slate-200"}`}>
          <h2 className="text-lg font-extrabold text-slate-800 border-b border-slate-100 pb-3 flex items-center justify-between">T/O Dates {isOverviewDisabled && <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">Locked</span>}</h2>
          <div className="grid grid-cols-2 gap-4">
            {STAGE_ORDER.filter(phase => STAGE_ORDER.indexOf(phase) <= STAGE_ORDER.indexOf(currentStage || 'EVT5')).map(phase => (
              <div key={phase}><label className={labelClass}>{phase} T/O Date</label><input type="date" value={(safeData.TO_Dates || {})[phase] || ''} onChange={(e) => handleNestedChange('TO_Dates', phase, e.target.value)} className={inputClass} disabled={isOverviewDisabled} /></div>
            ))}
          </div>
        </div>

        {/* 🚀 Organization (D&D) */}
        <div className={`bg-white p-6 rounded-2xl shadow-sm border transition-colors space-y-5 ${!isOverviewDisabled ? "border-amber-300 ring-4 ring-amber-50" : "border-slate-200"}`}>
          <h2 className="text-lg font-extrabold text-slate-800 border-b border-slate-100 pb-3 flex items-center justify-between">Organization</h2>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleOrgDragEnd}>
            <SortableContext items={orgSchema.map(f => f.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-3 gap-3">
                {orgSchema.map((field) => {
                  const isCustomOrg = !ORGANIZATION_SCHEMA.some(s => s.id === field.id);
                  return (
                  <SortableField 
                    key={field.id} id={field.id} isEditing={unlockedOverview}
                    className={`${field.colSpan === 3 ? 'col-span-3' : 'col-span-1'} ${unlockedOverview ? "relative group" : ""}`}
                  >
                    {(dragListeners, dragAttributes) => (
                      <>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5 flex-1">
                            {unlockedOverview && <div className="cursor-grab text-slate-300 hover:text-amber-500" {...dragListeners} {...dragAttributes}>⠿</div>}
                            {unlockedOverview && isCustomOrg ? (
                              <input type="text" value={field.label} onChange={(e) => handleOrgLabelChange(field.id, e.target.value)} className="text-[11px] font-bold text-slate-700 bg-white border border-slate-200 rounded px-1.5 py-0.5 outline-none focus:border-amber-400 w-1/2 uppercase tracking-wider" placeholder="항목 이름" />
                            ) : (
                              <label className={`${labelClass} mb-0 ml-0`}>{field.label}</label>
                            )}
                          </div>
                          {unlockedOverview && isCustomOrg && (
                            <button onClick={() => handleOrgDelete(field.id)} className="text-slate-300 hover:text-red-500 transition-colors p-0.5"><X size={14} /></button>
                          )}
                        </div>
                        {field.type === 'textarea' ? (
                          <textarea rows={field.rows || 2} value={safeData.Organization?.[field.id] || ''} onChange={(e) => handleNestedChange('Organization', field.id, e.target.value)} className={inputClass} disabled={isOverviewDisabled}></textarea>
                        ) : (
                          <input type="text" value={safeData.Organization?.[field.id] || ''} onChange={(e) => handleNestedChange('Organization', field.id, e.target.value)} className={inputClass} disabled={isOverviewDisabled} />
                        )}
                      </>
                    )}
                  </SortableField>
                  );
                })}
              </div>
              {unlockedOverview && (
                <button onClick={handleOrgAdd} className="col-span-3 w-full py-2.5 mt-4 border-2 border-dashed border-amber-200 rounded-xl text-amber-600 font-bold text-sm hover:bg-amber-50 transition-colors flex items-center justify-center gap-2">➕ 새 조직 항목 추가</button>
              )}
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* ── 우측 컬럼 ── */}
      <div className="xl:col-span-8 space-y-6">
        
        {/* 🚀 Project IP Blocks */}
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-2xl shadow-sm border border-indigo-100 space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-indigo-200 pb-3 gap-3">
            <h2 className="text-lg font-extrabold text-indigo-900">Project IP Blocks</h2>
            <span className="text-xs font-bold text-indigo-500 bg-indigo-100 px-2 py-1 rounded-md">Total: {(safeData.IP_Blocks || []).length} Blocks</span>
          </div>
          <div className="space-y-4">
            {!isOverviewDisabled && (
              <div className="flex flex-col sm:flex-row gap-3">
                <select value={selCategory} onChange={(e) => { setSelCategory(e.target.value); setSelIpName(dictToUse[e.target.value][0]); }} className="flex-1 border border-indigo-200 rounded-lg px-3 py-2.5 text-sm font-bold text-slate-700 bg-white shadow-sm outline-none">
                  {Object.keys(dictToUse).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={selIpName} onChange={(e) => setSelIpName(e.target.value)} className="flex-1 border border-indigo-200 rounded-lg px-3 py-2.5 text-sm font-bold text-slate-700 bg-white shadow-sm outline-none">
                  {(dictToUse[selCategory] || []).map(ip => <option key={ip} value={ip}>{ip}</option>)}
                  <option value="__CUSTOM__">➕ 새 IP 직접 입력 (Custom)</option>
                </select>
                <button onClick={addIpBlock} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-lg shadow-sm transition-colors whitespace-nowrap">+ Add New IP</button>
              </div>
            )}
            {(safeData.IP_Blocks || []).length > 0 ? (
              <div className="flex flex-wrap gap-3 pt-2 mt-2">
                {(safeData.IP_Blocks || []).map((ip, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white border border-indigo-200 px-3 py-1.5 rounded-lg shadow-sm animate-fid" style={{ animationDelay: `${idx * 0.05}s` }}>
                    <span className="text-sm font-bold text-indigo-800">{ip}</span>
                    {!isOverviewDisabled && (
                      <button onClick={() => removeIpBlock(ip)} className="text-indigo-400 hover:text-red-500 hover:bg-red-50 rounded-full p-0.5"><X size={14} /></button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-indigo-400 font-medium py-3 text-center border border-dashed border-indigo-200 rounded-lg bg-white/50">등록된 IP 블록이 없습니다.</div>
            )}
          </div>
        </div>

        {/* 🚀 Project Overview Contents (D&D 및 테이블 구조 통합) */}
        <div className={`bg-white p-6 rounded-2xl shadow-sm border transition-colors space-y-6 ${!isOverviewDisabled ? "border-amber-300 ring-4 ring-amber-50" : "border-slate-200"}`}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
              Project Overview Contents
              {isOverviewDisabled && <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">Locked</span>}
            </h2>
          </div>
          
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleContentsDragEnd}>
            <SortableContext items={overviewSchema.map(f => f.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-6">
                {overviewSchema.map((field) => {
                  const isCustomContents = !DEFAULT_OVERVIEW_SCHEMA.some(s => s.id === field.id);
                  const defaultField = DEFAULT_OVERVIEW_SCHEMA.find(s => s.id === field.id);
                  const defaultRows = defaultField?.templateRows || [];
                  
                  return (
                  <SortableField 
                    key={field.id} id={field.id} isEditing={unlockedOverview}
                    className={unlockedOverview ? "relative group" : ""}
                  >
                    {(dragListeners, dragAttributes) => (
                        <div className="flex flex-col gap-2 w-full">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5 flex-1">
                              {unlockedOverview && <div className="cursor-grab text-slate-300 hover:text-amber-500" {...dragListeners} {...dragAttributes}>⠿</div>}
                              {unlockedOverview && isCustomContents ? (
                                <input type="text" value={field.label} onChange={(e) => handleSchemaLabelChange(field.id, e.target.value)} className="text-[11px] font-bold text-slate-700 bg-white border border-slate-200 rounded px-1.5 py-0.5 outline-none focus:border-amber-400 w-1/2 uppercase tracking-wider" placeholder="섹션 이름" />
                              ) : (
                                <label className={`${labelClass} mb-0 ml-0`}>{field.label}</label>
                              )}
                            </div>
                            {unlockedOverview && isCustomContents && (
                              <button onClick={() => handleSchemaDelete(field.id)} className="text-slate-300 hover:text-red-500 transition-colors p-0.5"><X size={14} /></button>
                            )}
                          </div>

                          {field.type === 'table' ? (
                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                              <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold text-[11px] uppercase tracking-wider">
                                  <tr>
                                    <th className="px-4 py-3 border-r border-slate-200 w-[25%]">Item</th>
                                    <th className="px-4 py-3 border-r border-slate-200 w-[35%]">Specification</th>
                                    <th className="px-4 py-3 border-r border-slate-200 w-[15%] text-center">Unit</th>
                                    <th className="px-4 py-3 w-[25%]">Remarks</th>
                                    {unlockedOverview && <th className="px-2 py-3 w-[5%] text-center"></th>}
                                  </tr>
                                </thead>
                                <tbody className="bg-white">
                                  {(field.templateRows || []).map((row) => {
                                    const tableData = typeof safeData[field.id] === 'object' && safeData[field.id] !== null ? safeData[field.id] : {};
                                    const rowData = tableData[row.id] || { spec: '', unit: '', remarks: '' };
                                    const isCustomRow = !defaultRows.some(r => r.id === row.id);
                                    return (
                                      <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-2 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/30">
                                          {unlockedOverview && isCustomRow ? (
                                            <input type="text" value={row.item} onChange={(e) => handleTableTemplateRowChange(field.id, row.id, e.target.value)} className="w-full bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:border-amber-400" placeholder="항목명" />
                                          ) : (
                                            row.item
                                          )}
                                        </td>
                                        <td className="p-0 border-r border-slate-200">
                                          <input type="text" value={rowData.spec} onChange={(e) => handleTableDataChange(field.id, row.id, 'spec', e.target.value)} className="w-full h-full px-4 py-2.5 bg-transparent outline-none focus:bg-blue-50 transition-colors text-slate-800 font-medium placeholder:text-slate-300" disabled={isOverviewDisabled} placeholder="ex) 3.0 ~ 4.5" />
                                        </td>
                                        <td className="p-0 border-r border-slate-200">
                                          <input type="text" value={rowData.unit} onChange={(e) => handleTableDataChange(field.id, row.id, 'unit', e.target.value)} className="w-full h-full px-4 py-2.5 bg-transparent outline-none focus:bg-blue-50 transition-colors text-center text-slate-800 font-medium placeholder:text-slate-300" disabled={isOverviewDisabled} placeholder="ex) V" />
                                        </td>
                                        <td className="p-0 border-r border-slate-200">
                                          <input type="text" value={rowData.remarks} onChange={(e) => handleTableDataChange(field.id, row.id, 'remarks', e.target.value)} className="w-full h-full px-4 py-2.5 bg-transparent outline-none focus:bg-blue-50 transition-colors text-slate-800 font-medium placeholder:text-slate-300" disabled={isOverviewDisabled} placeholder="비고 입력..." />
                                        </td>
                                        {unlockedOverview && (
                                          <td className="p-0 text-center align-middle">
                                            {isCustomRow && (
                                              <button onClick={() => handleTableTemplateRowDelete(field.id, row.id)} className="text-slate-300 hover:text-red-500 transition-colors"><X size={14} /></button>
                                            )}
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                              {unlockedOverview && (
                                <button onClick={() => handleTableTemplateRowAdd(field.id)} className="w-full py-2 bg-slate-50 hover:bg-amber-50 text-amber-600 text-xs font-bold transition-colors border-t border-slate-200 flex justify-center items-center gap-1">➕ 새 테이블 항목(Row) 추가</button>
                              )}
                            </div>
                          ) : (
                            <textarea rows={field.rows || 4} value={safeData[field.id] || ''} onChange={(e) => handleChange({target: {name: field.id, value: e.target.value}})} className={`${inputClass} ${field.fontMono ? 'font-mono' : ''}`} disabled={isOverviewDisabled} placeholder={field.placeholder || ''} />
                          )}
                        </div>
                    )}
                  </SortableField>
                  );
                })}
                {unlockedOverview && (
                  <button onClick={handleSchemaAdd} className="w-full py-3.5 mt-4 border-2 border-dashed border-amber-200 rounded-xl text-amber-600 font-bold text-sm hover:bg-amber-50 transition-colors flex items-center justify-center gap-2">➕ 새 컨텐츠 섹션 추가</button>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* ── Custom IP 추가 모달 ── */}
      {customIpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(15,23,42,0.45)' }}>
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 to-blue-500" />
            <div className="p-6">
              <h2 className="text-xl font-extrabold text-slate-800 mb-4">새로운 IP 직접 등록</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">카테고리 <span className="text-red-500">*</span></label>
                  <input type="text" value={customIpForm.category} onChange={e => setCustomIpForm({...customIpForm, category: e.target.value})} className="w-full px-3 py-2 border rounded outline-none focus:border-indigo-400" placeholder="예: Power_Regulation" />
                  <p className="text-[10px] text-slate-400 mt-1">기존 카테고리를 입력하거나 새 카테고리를 만들 수 있습니다.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">IP 이름 <span className="text-red-500">*</span></label>
                  <input type="text" value={customIpForm.name} onChange={e => setCustomIpForm({...customIpForm, name: e.target.value})} className="w-full px-3 py-2 border rounded outline-none focus:border-indigo-400" placeholder="예: LDO_1V2" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">상세 설명 (필수) <span className="text-red-500">*</span></label>
                  <textarea value={customIpForm.description} onChange={e => setCustomIpForm({...customIpForm, description: e.target.value})} className="w-full px-3 py-2 border rounded outline-none focus:border-indigo-400" placeholder="이 IP의 목적, 핵심 스펙 등을 간략히 적어주세요. (파편화 방지용)" rows={3} />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button onClick={() => setCustomIpModalOpen(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors">취소</button>
                <button onClick={handleCustomIpSubmit} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors">등록하기</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
});

export default ProjectOverviewTab;