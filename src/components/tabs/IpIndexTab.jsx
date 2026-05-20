import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { ipCategoryNameMap, makeDefaultIpIndex } from '../../data/mockData';
import { X } from '../Icons';
import ActionBar from '../ActionBar';
import IssueSummaryCard from '../IssueSummaryCard';
import { BookOpen, Lock, Copy, Plus, Trash2, ChevronDown, Sparkles, Activity, CheckCircle, Clock, ShieldCheck, ArrowRightCircle } from 'lucide-react';
import { DEFAULT_IP_CONTENTS_SCHEMA } from '../../data/schemaConfig';
import { useAutoSave, clearAutoSave } from '../../hooks/useAutoSave';
import { useConfirm } from '../../contexts/ConfirmContext';
import { getIssueStatus } from '../../logic/revisionLogLogic';
import AutoSaveRecoveryModal from '../AutoSaveRecoveryModal';
import { useLogData } from '../../hooks/revisionLog/useLogData';
import MilestoneMetricsTable from './MilestoneMetricsTable';

// ─── [D&D] 드래그 앤 드롭 라이브러리 임포트 ───
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ── 섹션 헤더 컴포넌트 (독립 플로팅 카드 매칭 프리미엄 레프트 정렬 및 세로 엑센트 바 이식) ──
const SectionHeader = ({ section, title, icon, count, accentColorClass, badgeClass, isExpanded, onToggle }) => (
  <div
    onClick={() => onToggle(section)}
    className="flex items-center justify-between cursor-pointer select-none group border-b border-slate-100 pb-3"
    aria-expanded={isExpanded}
    aria-controls={`accordion-content-${section}`}
  >
    <div className="flex items-center gap-3">
      {/* 1. 세련된 세로 엑센트 바 (Vertical Accent Bar) */}
      <div className={`w-1.5 h-6 rounded-full transition-transform duration-300 group-hover:scale-y-110 ${accentColorClass}`} />
      
      <div className="flex items-center gap-2">
        <span className="p-1.5 rounded-lg bg-slate-50 group-hover:bg-white transition-colors duration-200 flex items-center justify-center">
          {icon}
        </span>
        <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
          {title}
        </h3>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClass}`}>
          {count}건
        </span>
      </div>
    </div>
    
    <div className="flex items-center gap-2">
      <span className={`text-slate-400 group-hover:text-slate-600 transition-all duration-300 p-1 rounded-lg hover:bg-slate-50 ${isExpanded ? 'rotate-0' : '-rotate-180'}`}>
        <ChevronDown size={16} />
      </span>
    </div>
  </div>
);

// ─── [D&D] 정렬 가능한 개별 아이템 래퍼 컴포넌트 ───
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

const IpIndexTab = forwardRef(({ data, overviewData, revisionLogData, currentRevision, isArchived, lockReason, projectId, dbUpdatedAt, onSubmit, onImmediateUpdate, onFormDirtyChange, onEditingStateChange, onForceUnlock, globalIpDictionary, selectedIp }, ref) => {
  const safeData = data || {};
  const [isTabEditing, setIsTabEditing] = useState(false);

  useImperativeHandle(ref, () => ({
    canNavigate: async () => true,
    resetForm: () => {
      setIsTabEditing(false);
    }
  }));

  const dictToUse = globalIpDictionary || ipCategoryNameMap;
  const [selectedIpForIndex, setSelectedIpForIndex] = useState(null);
  
  const showConfirm = useConfirm();
  const [keySpecSchema, setKeySpecSchema] = useState([]); 
  const [ipContentsSchema, setIpContentsSchema] = useState([]);

  useEffect(() => {
    if (onEditingStateChange) onEditingStateChange(isTabEditing);
  }, [isTabEditing, onEditingStateChange]);

  const { showRecoveryModal, recoveredTime, handleRestore, handleDiscard } = useAutoSave({
    projectId,
    tabName: 'IP_Index',
    data: safeData,
    isEditing: isTabEditing,
    onRestore: (recoveredData) => {
      if (onImmediateUpdate) onImmediateUpdate(recoveredData, true);
    },
    dbUpdatedAt,
    setIsEditing: setIsTabEditing
  });
  const safeOverview = overviewData || { IP_Blocks: [], Project_Name: '', Foundry: '', Process: '' };

  const [expandedItems, setExpandedItems] = useState({});
  const [expandedSections, setExpandedSections] = useState({
    newFindings: true,
    revision: true,
    debt: true,
    resolved: false,
    deferred: true
  });
  
  const toggleSection = (key) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleExpand = (id) => setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));

  const validIpsMap = React.useMemo(() => {
    const map = {};
    (safeOverview.IP_Blocks || []).forEach(ip => map[ip] = true);
    return map;
  }, [safeOverview.IP_Blocks]);

  const { latestIssueStates } = useLogData(
    revisionLogData || {},
    selectedIpForIndex || 'All',
    validIpsMap,
    safeOverview.Project_Name || 'Unknown',
    currentRevision
  );

  const getIssueTimeline = React.useCallback((issueId) => {
    if (!issueId) return [];
    const timeline = [];
    const STAGES = ['EVT0', 'EVT1', 'EVT2', 'EVT3', 'EVT4', 'EVT5', 'DVT', 'PVT', 'MP'];
    const hBlocks = revisionLogData?.historyBlocks || [];
    const curIssues = revisionLogData?.issues || [];
    const project = safeOverview.Project_Name || 'Unknown';
    
    hBlocks.forEach(block => {
      const found = block.issues?.find(i => {
        const id = i.entryMode === 'new' ? `${i.ipBlock}.${project}.${i.issueNum}` : i.targetIssue;
        return id === issueId;
      });
      if (found) timeline.push({ stage: block.stageName, data: { ...found, stage: block.stageName } });
    });
    const foundCurrent = curIssues?.find(i => {
      const id = i.entryMode === 'new' ? `${i.ipBlock}.${project}.${i.issueNum}` : i.targetIssue;
      return id === issueId;
    });
    if (foundCurrent) timeline.push({ stage: currentRevision, data: { ...foundCurrent, stage: currentRevision } });
    
    timeline.sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage));
    return timeline;
  }, [revisionLogData, safeOverview.Project_Name, currentRevision]);

  const { newFindings, resolvedIssues, revisionIssues, debtIssues, deferredIssues } = React.useMemo(() => {
    const project = safeOverview.Project_Name || 'Unknown';
    const newItems = [];
    const resolvedItems = [];
    const revisionItems = [];
    const debtItems = [];
    const deferredItems = [];

    Object.values(latestIssueStates).forEach(item => {
      if (!item) return;
      const isNewLike = item.entryMode === 'new' || item.entryMode === 'fa';
      const ip = isNewLike ? item.ipBlock : (item.targetIssue ? item.targetIssue.split('.')[0] : '');
      if (selectedIpForIndex && ip !== selectedIpForIndex) return;

      const isNewInCurrentStage = isNewLike && item.stage === currentRevision;
      const st = getIssueStatus(item);

      if (isNewInCurrentStage) {
        newItems.push(item);
      }
      else if (st === 'CLOSED') {
        resolvedItems.push(item);
      }
      else if (st === 'DEFERRED') {
        deferredItems.push(item);
      }
      else if (item.disposition === 'Revision') {
        revisionItems.push(item);
      }
      else {
        debtItems.push(item);
      }
    });

    const sortFn = (a, b) => {
      const idA = (a.entryMode === 'new' || a.entryMode === 'fa') ? `${a.ipBlock}.${project}.${a.issueNum}` : a.targetIssue;
      const idB = (b.entryMode === 'new' || b.entryMode === 'fa') ? `${b.ipBlock}.${project}.${b.issueNum}` : b.targetIssue;
      return (idA || '').localeCompare(idB || '');
    };

    newItems.sort(sortFn);
    resolvedItems.sort(sortFn);
    revisionItems.sort(sortFn);
    debtItems.sort(sortFn);
    deferredItems.sort(sortFn);

    return { newFindings: newItems, resolvedIssues: resolvedItems, revisionIssues: revisionItems, debtIssues: debtItems, deferredIssues: deferredItems };
  }, [latestIssueStates, selectedIpForIndex, currentRevision, safeOverview.Project_Name]);

  const ipStats = React.useMemo(() => {
    if (!selectedIpForIndex) return [];

    const project = safeOverview.Project_Name || 'Unknown';
    const hBlocks = revisionLogData?.historyBlocks || [];
    const stage = currentRevision;

    const pastStats = hBlocks.map(block => {
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
        
        const isNewLike = item.entryMode === 'new' || item.entryMode === 'fa';
        const ip = isNewLike ? item.ipBlock : (item.targetIssue ? item.targetIssue.split('.')[0] : '');
        if (ip !== selectedIpForIndex) return;

        total++;
        if (item.entryMode === 'new' || item.entryMode === 'fa' || (!item.entryMode && !item.carryoverStatus)) {
          newCount++;
        }
        
        if (item.disposition === 'Revision') {
          revision++;
        }

        const status = getIssueStatus(item);
        if (status === 'CLOSED') {
          closed++;
        } else if (status === 'DEFERRED') {
          carryover++;
        } else {
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

      const isNewLike = item.entryMode === 'new' || item.entryMode === 'fa';
      const ip = isNewLike ? item.ipBlock : (item.targetIssue ? item.targetIssue.split('.')[0] : '');
      if (ip !== selectedIpForIndex) return;

      currTotal++;
      
      const isNewInCurrentStage = isNewLike && item.stage === stage;
      if (isNewInCurrentStage) {
        currNew++;
      }

      if (item.stage === stage && item.disposition === 'Revision') {
        currRevision++;
      }

      const status = getIssueStatus(item);
      if (status === 'CLOSED') {
        currClosed++;
      } else if (status === 'DEFERRED') {
        if (item.stage === stage) {
          currCarryover++;
        } else {
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
  }, [revisionLogData, currentRevision, latestIssueStates, selectedIpForIndex, safeOverview.Project_Name]);

  useEffect(() => {
    if (selectedIp && safeOverview.IP_Blocks.includes(selectedIp)) {
      setSelectedIpForIndex(selectedIp);
    } else if (!selectedIpForIndex && safeOverview.IP_Blocks.length > 0) {
      setSelectedIpForIndex(safeOverview.IP_Blocks[0]);
    } else if (selectedIpForIndex && !safeOverview.IP_Blocks.includes(selectedIpForIndex)) {
      setSelectedIpForIndex(safeOverview.IP_Blocks[0] || null);
    }
  }, [safeOverview.IP_Blocks, selectedIpForIndex, selectedIp]);

  const isOverviewDisabled = isArchived || !isTabEditing;

  const currentIpData = selectedIpForIndex && safeData[selectedIpForIndex] 
    ? safeData[selectedIpForIndex] 
    : makeDefaultIpIndex(selectedIpForIndex, currentRevision);

  useEffect(() => {
    if (selectedIpForIndex && currentIpData) {
      if (currentIpData.UI_Schemas?.Key_Spec) {
        setKeySpecSchema(currentIpData.UI_Schemas.Key_Spec);
      } else {
        const generated = Object.keys(currentIpData.Key_Spec || {}).map(k => ({ id: k, label: k }));
        setKeySpecSchema(generated);
      }

      if (currentIpData.UI_Schemas?.Contents) {
        setIpContentsSchema(currentIpData.UI_Schemas.Contents);
      } else {
        setIpContentsSchema(DEFAULT_IP_CONTENTS_SCHEMA);
      }
    } else {
      setKeySpecSchema([]);
      setIpContentsSchema([]);
    }
  }, [selectedIpForIndex, safeData]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleKeySpecDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setKeySpecSchema((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        const newSchema = arrayMove(items, oldIndex, newIndex);
        updateCurrentIp({ UI_Schemas: { ...(currentIpData.UI_Schemas || {}), Key_Spec: newSchema } });
        return newSchema;
      });
    }
  };
  const handleKeySpecLabelChange = (id, newLabel) => {
    const newSchema = keySpecSchema.map(f => f.id === id ? { ...f, label: newLabel } : f);
    setKeySpecSchema(newSchema);
    updateCurrentIp({ UI_Schemas: { ...(currentIpData.UI_Schemas || {}), Key_Spec: newSchema } });
  };
  const handleKeySpecDelete = async (id) => {
    const confirmed = await showConfirm({
      title: "항목 삭제 확인",
      message: "이 항목을 삭제하시겠습니까?",
      type: "danger",
      confirmText: "삭제"
    });

    if (confirmed) {
      const newSchema = keySpecSchema.filter(f => f.id !== id);
      setKeySpecSchema(newSchema);
      const newKeySpecData = { ...(currentIpData.Key_Spec || {}) };
      delete newKeySpecData[id];
      updateCurrentIp({ UI_Schemas: { ...(currentIpData.UI_Schemas || {}), Key_Spec: newSchema }, Key_Spec: newKeySpecData });
    }
  };
  const handleKeySpecClone = (fieldToClone) => {
    const newId = `KeySpec_clone_${Date.now()}`;
    const clonedField = { ...fieldToClone, id: newId, label: `${fieldToClone.label} (Copy)` };
    const index = keySpecSchema.findIndex(f => f.id === fieldToClone.id);
    const newSchema = [...keySpecSchema];
    newSchema.splice(index + 1, 0, clonedField);
    setKeySpecSchema(newSchema);
    updateCurrentIp({ UI_Schemas: { ...(currentIpData.UI_Schemas || {}), Key_Spec: newSchema } });
  };
  const handleKeySpecAdd = () => {
    const newId = `KeySpec_${Date.now()}`;
    const newSchema = [...keySpecSchema, { id: newId, label: "New Parameter" }];
    setKeySpecSchema(newSchema);
    updateCurrentIp({ UI_Schemas: { ...(currentIpData.UI_Schemas || {}), Key_Spec: newSchema } });
  };

  const handleIpContentsDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setIpContentsSchema((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        const newSchema = arrayMove(items, oldIndex, newIndex);
        updateCurrentIp({ UI_Schemas: { ...(currentIpData.UI_Schemas || {}), Contents: newSchema } });
        return newSchema;
      });
    }
  };
  const handleIpContentsLabelChange = (id, newLabel) => {
    const newSchema = ipContentsSchema.map(f => f.id === id ? { ...f, label: newLabel } : f);
    setIpContentsSchema(newSchema);
    updateCurrentIp({ UI_Schemas: { ...(currentIpData.UI_Schemas || {}), Contents: newSchema } });
  };
  const handleIpContentsDelete = async (id) => {
    const confirmed = await showConfirm({
      title: "컨텐츠 카드 삭제",
      message: "이 카드 전체를 삭제하시겠습니까?\n내부의 모든 데이터가 유실됩니다.",
      type: "danger",
      confirmText: "카드 삭제"
    });

    if (confirmed) {
      const newSchema = ipContentsSchema.filter(f => f.id !== id);
      setIpContentsSchema(newSchema);
      const newData = { ...currentIpData, UI_Schemas: { ...(currentIpData.UI_Schemas || {}), Contents: newSchema } };
      delete newData[id];
      updateCurrentIp(newData);
    }
  };
  const handleIpContentsAdd = () => {
    const newId = `Custom_${Date.now()}`;
    const newSchema = [...ipContentsSchema, { id: newId, label: "New Custom Section", type: "custom" }];
    setIpContentsSchema(newSchema);
    updateCurrentIp({ UI_Schemas: { ...(currentIpData.UI_Schemas || {}), Contents: newSchema } });
  };

  const handleIpIndexChange = (e) => {
    const { name, value } = e.target;
    updateCurrentIp({ [name]: value });
  };
  const handleIpKeySpecChange = (key, value) => {
    updateCurrentIp({ Key_Spec: { ...(currentIpData.Key_Spec || {}), [key]: value } });
  };
  const updateCurrentIp = (patch) => {
    if (!selectedIpForIndex) return;
    const newData = { ...safeData, [selectedIpForIndex]: { ...currentIpData, ...patch } };
    if (onImmediateUpdate) onImmediateUpdate(newData);
    if (onFormDirtyChange) onFormDirtyChange(true);
  };

  const handleAddSubBlock = () => {
    const currentSubBlocks = currentIpData.Sub_Blocks || [];
    const newSubBlock = { 
      id: `sb_${Date.now()}`, 
      name: '', 
      motherProject: '', 
      motherIpName: '',
      modificationLevel: 'New',
      keyFeatures: ''
    };
    updateCurrentIp({ Sub_Blocks: [...currentSubBlocks, newSubBlock] });
  };

  const handleSubBlockChange = (id, field, value) => {
    const currentSubBlocks = currentIpData.Sub_Blocks || [];
    const newSubBlocks = currentSubBlocks.map(sb => sb.id === id ? { ...sb, [field]: value } : sb);
    updateCurrentIp({ Sub_Blocks: newSubBlocks });
  };

  const handleRemoveSubBlock = (id) => {
    const currentSubBlocks = currentIpData.Sub_Blocks || [];
    const newSubBlocks = currentSubBlocks.filter(sb => sb.id !== id);
    updateCurrentIp({ Sub_Blocks: newSubBlocks });
  };

  const handleSubmit = () => {
    if (onSubmit) onSubmit(safeData);
    clearAutoSave(projectId, 'IP_Index');
    setIsTabEditing(false);
  };

  const renderSectionHeader = (title) => (
    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
      <h2 className="text-lg font-extrabold text-slate-800">{title}</h2>
      {isOverviewDisabled && <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">Locked</span>}
    </div>
  );

  const labelClass = "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1";
  const inputClass = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 bg-slate-50 focus:bg-white transition-colors disabled:opacity-50 disabled:bg-slate-100 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 placeholder:font-medium placeholder:text-slate-300";

  const subLabelClass = "block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1";
  const subInputClass = "w-full border border-slate-100 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 bg-white focus:bg-white transition-colors disabled:opacity-50 disabled:bg-slate-50 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-50 placeholder:font-normal placeholder:text-slate-300 shadow-sm";



  return (
    <div className="max-w-full space-y-4 text-left h-full pb-10">
      
      <AutoSaveRecoveryModal 
        isOpen={showRecoveryModal} 
        timestamp={recoveredTime} 
        onRestore={handleRestore} 
        onDiscard={handleDiscard} 
      />

      {/* ── 헤더 (Title + 템플릿 편집 버튼 + ActionBar) ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center pb-4 border-b border-slate-200 mb-6 w-full gap-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2 shrink-0">
            <BookOpen size={28} className="text-blue-600" />
            IP Index
          </h1>
          {isArchived && <span className="text-xs px-2 py-1 bg-slate-100 text-slate-500 rounded font-bold flex items-center gap-1"><Lock size={11} />Read-Only</span>}
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          
          <div className="shrink-0 border-l pl-3 border-slate-200">
            <ActionBar 
              isGlobalArchived={isArchived} 
              isEditing={isTabEditing} 
              onEdit={() => setIsTabEditing(true)} 
              onLock={handleSubmit} 
              lockReason={lockReason}
              onForceUnlock={onForceUnlock}
            />
          </div>
        </div>
      </div>

      {/* IP 선택 탭바 */}
      {safeOverview.IP_Blocks.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">IP 선택</span>
            <div className="flex flex-wrap gap-2">
              {safeOverview.IP_Blocks.map(ip => (
                <button key={ip} onClick={() => setSelectedIpForIndex(ip)} className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${selectedIpForIndex === ip ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300'}`}>
                  {ip}{safeData[ip] ? <span className="ml-1.5 text-[10px] opacity-70">✓</span> : <span className="ml-1.5 text-[10px] opacity-50">○</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700 font-medium">Project Overview에서 IP Block을 먼저 등록해주세요.</div>
      )}

      {selectedIpForIndex && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div className="xl:col-span-4 space-y-6">
            <div className="bg-slate-100 p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5 opacity-90">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <h2 className="text-lg font-extrabold text-slate-700">Project & Process Info</h2>
                <span className="text-[10px] font-bold bg-slate-200 text-slate-500 px-2 py-1 rounded">Auto Linked</span>
              </div>
              <div className="space-y-4">
                <div><label className={labelClass}>Project Name</label><input type="text" value={safeOverview.Project_Name} className={inputClass + " bg-slate-100"} disabled /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelClass}>Foundry</label><input type="text" value={safeOverview.Foundry} className={inputClass + " bg-slate-100"} disabled /></div>
                  <div><label className={labelClass}>Process</label><input type="text" value={safeOverview.Process} className={inputClass + " bg-slate-100"} disabled /></div>
                </div>
              </div>
            </div>

            <div className={`bg-white p-6 rounded-2xl shadow-sm border transition-colors space-y-5 ${!isOverviewDisabled ? "border-amber-300 ring-4 ring-amber-50" : "border-slate-200"}`}>
              {renderSectionHeader('IP Identity & Lineage')}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelClass}>IP Category</label><select name="IP_Category" value={currentIpData.IP_Category || ''} onChange={handleIpIndexChange} className={inputClass} disabled={isOverviewDisabled}>{Object.keys(dictToUse).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div><label className={labelClass}>IP Name</label><select name="IP_Name" value={currentIpData.IP_Name || ''} onChange={handleIpIndexChange} className={inputClass} disabled={isOverviewDisabled}>{(dictToUse[currentIpData.IP_Category] || []).map(ip => <option key={ip} value={ip}>{ip}</option>)}</select></div>
                  <div>
                    <div className="flex justify-between items-end mb-1.5"><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">IP Version</label><span className="text-[10px] text-blue-500 font-bold mb-1">Auto update</span></div>
                    <input type="text" value={currentRevision} className={inputClass + " bg-slate-50"} disabled />
                  </div>
                  <div><label className={labelClass}>Status</label><select name="IP_Status" value={currentIpData.IP_Status || ''} onChange={handleIpIndexChange} className={inputClass} disabled={isOverviewDisabled}><option value="Active">Active</option><option value="Legacy">Legacy</option></select></div>
                </div>
                <div><label className={labelClass}>Mother Project</label><input type="text" name="Mother_Project" value={currentIpData.Mother_Project || ''} onChange={handleIpIndexChange} className={inputClass} disabled={isOverviewDisabled} /></div>
                <div><label className={labelClass}>Modification Level</label><select name="Modification_Level" value={currentIpData.Modification_Level || ''} onChange={handleIpIndexChange} className={inputClass} disabled={isOverviewDisabled}><option value="Reuse">Reuse</option><option value="Minor">Minor</option><option value="Major">Major</option><option value="New">New</option></select></div>
                <div><label className={labelClass}>Mother IP Path</label><input type="text" name="Mother_IP_Index_Path" value={currentIpData.Mother_IP_Index_Path || ''} onChange={handleIpIndexChange} className={inputClass + " font-mono text-xs"} disabled={isOverviewDisabled} /></div>
              </div>
            </div>

            <div className={`bg-white p-6 rounded-2xl shadow-sm border transition-colors space-y-5 ${!isOverviewDisabled ? "border-amber-300 ring-4 ring-amber-50" : "border-slate-200"}`}>
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h2 className="text-lg font-extrabold text-slate-800">Sub-Blocks (BOM) & Lineage</h2>
                {!isOverviewDisabled && (
                  <button onClick={handleAddSubBlock} className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold rounded flex items-center gap-1 transition-colors">
                    <Plus size={14} /> Add Sub-Block
                  </button>
                )}
              </div>
              
              {(!currentIpData.Sub_Blocks || currentIpData.Sub_Blocks.length === 0) ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-sm font-bold text-slate-400">
                  등록된 서브 블록이 없는 단일(Leaf) IP입니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {currentIpData.Sub_Blocks.map((sb, idx) => (
                    <div key={sb.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3 relative group hover:border-blue-200 transition-all">
                      {!isOverviewDisabled && (
                        <button onClick={() => handleRemoveSubBlock(sb.id)} className="absolute top-3 right-3 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remove Sub-Block">
                          <Trash2 size={16} />
                        </button>
                      )}
                      
                      <div className="pr-8">
                        <label className={subLabelClass}>Sub-Block Name (Title)</label>
                        <input 
                          type="text" 
                          value={typeof sb === 'object' ? (sb.name || '') : sb} 
                          onChange={(e) => handleSubBlockChange(sb.id, 'name', e.target.value)} 
                          placeholder="e.g. Gate_Driver" 
                          className={subInputClass + " font-extrabold text-slate-800 bg-slate-50/50"} 
                          disabled={isOverviewDisabled} 
                        />
                      </div>

                      <div className="space-y-3 pt-2 border-t border-slate-50">
                        <div>
                          <label className={subLabelClass}>Mother Project</label>
                          <input type="text" value={sb.motherProject} onChange={(e) => handleSubBlockChange(sb.id, 'motherProject', e.target.value)} placeholder="e.g. SM5713" className={subInputClass} disabled={isOverviewDisabled} />
                        </div>
                        <div>
                          <label className={subLabelClass}>Mother IP / Block Name</label>
                          <input type="text" value={sb.motherIpName || ''} onChange={(e) => handleSubBlockChange(sb.id, 'motherIpName', e.target.value)} placeholder="e.g. Buck_v2 or GD_Block" className={subInputClass} disabled={isOverviewDisabled} />
                        </div>
                        <div>
                          <label className={subLabelClass}>Modification Level</label>
                          <select value={sb.modificationLevel} onChange={(e) => handleSubBlockChange(sb.id, 'modificationLevel', e.target.value)} className={subInputClass} disabled={isOverviewDisabled}>
                            <option value="Reuse">Reuse</option>
                            <option value="Minor">Minor</option>
                            <option value="Major">Major</option>
                            <option value="New">New</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-2">
                        <label className={subLabelClass}>Key Features / Specifications</label>
                        <textarea 
                          value={sb.keyFeatures || ''} 
                          onChange={(e) => handleSubBlockChange(sb.id, 'keyFeatures', e.target.value)} 
                          placeholder="주요 설계 사양, 성능 특징, 주의사항 등을 요약 입력 (ex. Slew-rate 50V/us, Low-IQ mode 지원)" 
                          className={subInputClass + " min-h-[50px] py-2 leading-relaxed font-medium"} 
                          rows="2"
                          disabled={isOverviewDisabled}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={`bg-white p-6 rounded-2xl shadow-sm border transition-colors space-y-5 ${!isOverviewDisabled ? "border-amber-300 ring-4 ring-amber-50" : "border-slate-200"}`}>
              {renderSectionHeader('문서 관리 정보')}
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelClass}>Design Owner</label><input type="text" name="Design_Owner" value={currentIpData.Design_Owner || ''} onChange={handleIpIndexChange} className={inputClass} disabled={isOverviewDisabled} /></div>
                <div><label className={labelClass}>Last Updated</label><input type="date" name="Last_Updated" value={currentIpData.Last_Updated || ''} onChange={handleIpIndexChange} className={inputClass} disabled={isOverviewDisabled} /></div>
              </div>
            </div>


          </div>

          <div className="xl:col-span-8 space-y-6">
            
            {/* Key Spec 영역 */}
            <div className={`bg-white p-6 rounded-2xl shadow-sm border transition-colors space-y-5 ${!isOverviewDisabled ? "border-amber-300 ring-4 ring-amber-50" : "border-slate-200"}`}>
              {renderSectionHeader('Key Spec')}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleKeySpecDragEnd}>
                <SortableContext items={keySpecSchema.map(f => f.id)} strategy={verticalListSortingStrategy}>
                  <div className="w-full text-sm text-left border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                    {keySpecSchema.length > 0 && (
                      <div className="flex bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <div className="px-4 py-3 w-1/3 border-r border-slate-200 shrink-0">Parameter Key</div>
                        <div className="px-4 py-3 flex-1">Value</div>
                      </div>
                    )}
                    {keySpecSchema.map((field) => {
                      const isCustomKey = !Object.keys(currentIpData.Key_Spec || {}).includes(field.id) || field.id.startsWith('KeySpec_');
                      return (
                      <SortableField key={field.id} id={field.id} isEditing={isTabEditing} className="flex items-stretch border-b border-slate-100 last:border-0 hover:bg-slate-50 group">
                        {(dragListeners, dragAttributes) => (
                            <div className="flex w-full items-stretch min-h-[44px]">
                              <div className="px-2 py-2 w-1/3 border-r border-slate-200 text-xs font-mono text-slate-600 bg-slate-50/50 flex items-center shrink-0 gap-1">
                                {isTabEditing && <div className="cursor-grab text-slate-300 hover:text-amber-500 px-1" {...dragListeners} {...dragAttributes}>⠿</div>}
                                {isTabEditing && isCustomKey ? (
                                  <input type="text" value={field.label} onChange={(e) => handleKeySpecLabelChange(field.id, e.target.value)} className="w-full bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:border-amber-400 font-bold text-slate-700" placeholder="Parameter Key" />
                                ) : (
                                  <span className="px-2">{field.label}</span>
                                )}
                              </div>
                              <div className="flex-1 p-0 flex items-center relative">
                                <input type="text" value={currentIpData.Key_Spec?.[field.id] || ''} onChange={(e) => handleIpKeySpecChange(field.id, e.target.value)} className={`w-full px-4 py-2 bg-transparent outline-none focus:bg-blue-50 font-mono text-xs text-blue-900 transition-colors placeholder:text-slate-300 ${isOverviewDisabled ? 'text-slate-400 cursor-not-allowed' : ''}`} disabled={isOverviewDisabled} placeholder="Input value..." />
                                {isTabEditing && isCustomKey && (
                                  <button onClick={() => handleKeySpecDelete(field.id)} className="absolute right-2 text-slate-300 hover:text-red-500 transition-colors p-1"><X size={14} /></button>
                                )}
                              </div>
                            </div>
                        )}
                      </SortableField>
                      );
                    })}
                    {isTabEditing && <div className="p-2 bg-slate-50/50 border-t border-slate-200"><button onClick={handleKeySpecAdd} className="w-full py-2.5 border-2 border-dashed border-amber-200 rounded-lg text-amber-600 font-bold text-xs hover:bg-amber-50 hover:border-amber-400 transition-colors flex items-center justify-center gap-1">➕ 새 파라미터 추가</button></div>}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            {/* IP 컨텐츠 카드 영역 (D&D 및 자동 넘버링 적용) */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleIpContentsDragEnd}>
              <SortableContext items={ipContentsSchema.map(f => f.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-6">
                  {ipContentsSchema.map((field, index) => {
                    const isCustomContents = field.type === 'custom';
                    return (
                    <SortableField key={field.id} id={field.id} isEditing={isTabEditing} className={`bg-white p-6 rounded-2xl shadow-sm border transition-colors space-y-5 ${!isOverviewDisabled ? "border-amber-300 ring-4 ring-amber-50" : "border-slate-200"}`}>
                      {(dragListeners, dragAttributes) => (
                        <>
                          <div className="flex justify-between items-center border-b border-slate-100 pb-3 gap-2">
                            <div className="flex items-center gap-2 flex-1">
                              {isTabEditing && <div className="cursor-grab text-slate-300 hover:text-amber-500 px-1 font-bold w-6 text-center" title="드래그하여 이동" {...dragListeners} {...dragAttributes}>⠿</div>}
                              {isTabEditing && isCustomContents ? (
                                <div className="flex items-center gap-2 w-full max-w-md">
                                  <span className="text-lg font-extrabold text-slate-800">{index + 1}.</span>
                                  <input type="text" value={field.label} onChange={(e) => handleIpContentsLabelChange(field.id, e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-3 py-1 text-sm font-bold text-slate-800 bg-white outline-none focus:border-amber-400" placeholder="섹션 제목" />
                                </div>
                              ) : (
                                <h2 className="text-lg font-extrabold text-slate-800">{index + 1}. {field.label}</h2>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {isOverviewDisabled && <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">Locked</span>}
                              {isTabEditing && isCustomContents && (
                                <button onClick={() => handleIpContentsDelete(field.id)} className="text-slate-300 hover:text-red-500 p-1 transition-colors"><X size={18} /></button>
                              )}
                            </div>
                          </div>

                          {field.type === 'architecture' && (
                            <div className="space-y-4">
                              <div><label className={labelClass}>주요 블록 구성 (Sub-Blocks)</label><textarea value={currentIpData.Sec1_SubBlocks || ''} onChange={(e) => handleIpIndexChange({target:{name:'Sec1_SubBlocks', value:e.target.value}})} className={`${inputClass} font-mono`} disabled={isOverviewDisabled} rows={4}></textarea></div>
                              <div><label className={labelClass}>상세 설계 계보 (Design Lineage - 변경점)</label><textarea value={currentIpData.Sec1_Lineage || ''} onChange={(e) => handleIpIndexChange({target:{name:'Sec1_Lineage', value:e.target.value}})} className={`${inputClass} font-mono`} disabled={isOverviewDisabled} rows={6}></textarea></div>
                            </div>
                          )}
                          {field.type === 'summary' && (
                            <div><label className={labelClass}>원본 IP 핵심 요약 (Mother IP 기반)</label><textarea value={currentIpData.Sec2_Summary || ''} onChange={(e) => handleIpIndexChange({target:{name:'Sec2_Summary', value:e.target.value}})} className={`${inputClass} font-mono`} disabled={isOverviewDisabled} rows={5}></textarea></div>
                          )}
                          {field.type === 'focus' && (
                            <div><label className={labelClass}>설계 주안점 및 주의사항</label><textarea value={currentIpData.Sec3_Focus || ''} onChange={(e) => handleIpIndexChange({target:{name:'Sec3_Focus', value:e.target.value}})} className={`${inputClass} font-mono`} disabled={isOverviewDisabled} rows={4}></textarea></div>
                          )}
                          {field.type === 'custom' && (
                            <div><label className={labelClass}>내용 입력</label><textarea value={currentIpData[field.id] || ''} onChange={(e) => handleIpIndexChange({target:{name:field.id, value:e.target.value}})} className={`${inputClass} font-mono`} disabled={isOverviewDisabled} rows={4}></textarea></div>
                          )}
                        </>
                      )}
                    </SortableField>
                    );
                  })}
                  {isTabEditing && (
                    <button onClick={handleIpContentsAdd} className="w-full py-4 mt-2 border-2 border-dashed border-amber-200 rounded-xl text-amber-600 font-bold text-sm hover:bg-amber-50 hover:border-amber-400 transition-colors flex items-center justify-center gap-2">➕ 새 컨텐츠 카드 추가</button>
                  )}
                  </div>
                </SortableContext>
            </DndContext>

            {/* 고정 영역: Evaluation & Revision History (거대 박스 해체, 플로팅 카드 아키텍처 적용) */}
            <div className="space-y-6 mt-8">
              
              {/* [Header Area] - 평탄화된 세련된 헤더 타이틀 영역 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <Activity className="text-indigo-600" size={22} />
                    {ipContentsSchema.length + 1}. Evaluation & Revision History
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">데이터 분석 이력 및 마일스톤 품질 리포트</p>
                </div>
                <div className="mt-2 sm:mt-0">
                  <span className="text-[11px] font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full border border-indigo-100">
                    Revision_Log 연동
                  </span>
                </div>
              </div>
              
              {/* 1. MilestoneMetricsTable (독립된 세련된 화이트 카드 컨테이너) */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 mb-6 select-none transition-[transform,shadow] duration-300 hover:shadow-md hover:-translate-y-0.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Activity size={16} className="text-blue-500" />
                    마일스톤 품질 리포트 요약 (Milestone Quality Metrics)
                  </h3>
                  <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100/50">동적 집계</span>
                </div>
                <MilestoneMetricsTable stats={ipStats} />
              </div>

              {/* 2. 5단계 폭포수 필터링 아코디언 리스트 (각각의 독립된 플로팅 카드화) */}
              {(() => {
                const ip = selectedIpForIndex;
                const proj = safeOverview.Project_Name || 'Unknown';
                const hasAnyData = newFindings.length + revisionIssues.length + debtIssues.length + deferredIssues.length + resolvedIssues.length > 0;

                if (!hasAnyData) {
                  return (
                    <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 shadow-sm">
                      <div className="text-3xl mb-2">📊</div>
                      <p className="text-sm font-medium">{ip} IP에 대한 Revision_Log 데이터가 없습니다.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-6">
                    {/* (1) 신규 등록 리스트 */}
                    {newFindings.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[transform,shadow] duration-300 p-5 group">
                        <SectionHeader
                          section="newFindings"
                          title="신규 등록 리스트"
                          icon={<Sparkles size={15} className="text-indigo-500" />}
                          count={newFindings.length}
                          accentColorClass="bg-indigo-500"
                          badgeClass="text-indigo-700 bg-indigo-50 border border-indigo-100"
                          isExpanded={expandedSections.newFindings}
                          onToggle={toggleSection}
                        />
                        {expandedSections.newFindings && (
                          <div id="accordion-content-newFindings" className="space-y-2 mt-3 p-4 bg-indigo-50/20 rounded-xl border border-indigo-100/30 group-hover:bg-indigo-50/40 transition-colors duration-300">
                            {newFindings.map((item, ii) => {
                              const id = item.entryMode === 'new' ? `${item.ipBlock}.${proj}.${item.issueNum}` : item.targetIssue;
                              return (
                                <IssueSummaryCard
                                  key={item.id || ii}
                                  item={item}
                                  project={proj}
                                  isReadOnly={true}
                                  expandable={true}
                                  expanded={!!expandedItems[item.id]}
                                  onToggleExpand={() => toggleExpand(item.id)}
                                  timeline={getIssueTimeline(id)}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* (2) REVISION */}
                    {revisionIssues.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[transform,shadow] duration-300 p-5 group">
                        <SectionHeader
                          section="revision"
                          title="REVISION"
                          icon={<ArrowRightCircle size={15} className="text-amber-500" />}
                          count={revisionIssues.length}
                          accentColorClass="bg-amber-500"
                          badgeClass="text-amber-700 bg-amber-50 border border-amber-100"
                          isExpanded={expandedSections.revision}
                          onToggle={toggleSection}
                        />
                        {expandedSections.revision && (
                          <div id="accordion-content-revision" className="space-y-2 mt-3 p-4 bg-amber-50/20 rounded-xl border border-amber-100/30 group-hover:bg-amber-50/40 transition-colors duration-300">
                            {revisionIssues.map((item, ii) => {
                              const id = item.entryMode === 'new' ? `${item.ipBlock}.${proj}.${item.issueNum}` : item.targetIssue;
                              return (
                                <IssueSummaryCard
                                  key={item.id || ii}
                                  item={item}
                                  project={proj}
                                  isReadOnly={true}
                                  expandable={true}
                                  expanded={!!expandedItems[item.id]}
                                  onToggleExpand={() => toggleExpand(item.id)}
                                  timeline={getIssueTimeline(id)}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* (3) 관리형 부채 */}
                    {debtIssues.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[transform,shadow] duration-300 p-5 group">
                        <SectionHeader
                          section="debt"
                          title="관리형 부채"
                          icon={<ShieldCheck size={15} className="text-slate-500" />}
                          count={debtIssues.length}
                          accentColorClass="bg-slate-500"
                          badgeClass="text-slate-700 bg-slate-50 border border-slate-200"
                          isExpanded={expandedSections.debt}
                          onToggle={toggleSection}
                        />
                        {expandedSections.debt && (
                          <div id="accordion-content-debt" className="space-y-2 mt-3 p-4 bg-slate-50/20 rounded-xl border border-slate-100/50 group-hover:bg-slate-50/40 transition-colors duration-300">
                            {debtIssues.map((item, ii) => {
                              const id = item.entryMode === 'new' ? `${item.ipBlock}.${proj}.${item.issueNum}` : item.targetIssue;
                              return (
                                <IssueSummaryCard
                                  key={item.id || ii}
                                  item={item}
                                  project={proj}
                                  isReadOnly={true}
                                  expandable={true}
                                  expanded={!!expandedItems[item.id]}
                                  onToggleExpand={() => toggleExpand(item.id)}
                                  timeline={getIssueTimeline(id)}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* (4) 평가 유보 (Deferred) */}
                    {deferredIssues.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[transform,shadow] duration-300 p-5 group">
                        <SectionHeader
                          section="deferred"
                          title="평가 유보 (Deferred)"
                          icon={<Clock size={15} className="text-blue-500" />}
                          count={deferredIssues.length}
                          accentColorClass="bg-blue-500"
                          badgeClass="text-blue-700 bg-blue-50 border border-blue-100"
                          isExpanded={expandedSections.deferred}
                          onToggle={toggleSection}
                        />
                        {expandedSections.deferred && (
                          <div id="accordion-content-deferred" className="space-y-2 mt-3 p-4 bg-blue-50/20 rounded-xl border border-blue-100/30 group-hover:bg-blue-50/40 transition-colors duration-300">
                            {deferredIssues.map((item, ii) => {
                              const id = item.entryMode === 'new' ? `${item.ipBlock}.${proj}.${item.issueNum}` : item.targetIssue;
                              return (
                                <IssueSummaryCard
                                  key={item.id || ii}
                                  item={item}
                                  project={proj}
                                  isReadOnly={true}
                                  expandable={true}
                                  expanded={!!expandedItems[item.id]}
                                  onToggleExpand={() => toggleExpand(item.id)}
                                  timeline={getIssueTimeline(id)}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* (5) 종결 */}
                    {resolvedIssues.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[transform,shadow] duration-300 p-5 group">
                        <SectionHeader
                          section="resolved"
                          title="종결"
                          icon={<CheckCircle size={15} className="text-emerald-500" />}
                          count={resolvedIssues.length}
                          accentColorClass="bg-emerald-500"
                          badgeClass="text-emerald-700 bg-emerald-50 border border-emerald-100"
                          isExpanded={expandedSections.resolved}
                          onToggle={toggleSection}
                        />
                        {expandedSections.resolved && (
                          <div id="accordion-content-resolved" className="space-y-2 mt-3 p-4 bg-emerald-50/20 rounded-xl border border-emerald-100/30 group-hover:bg-emerald-50/40 transition-colors duration-300">
                            {resolvedIssues.map((item, ii) => {
                              const id = item.entryMode === 'new' ? `${item.ipBlock}.${proj}.${item.issueNum}` : item.targetIssue;
                              return (
                                <IssueSummaryCard
                                  key={item.id || ii}
                                  item={item}
                                  project={proj}
                                  isReadOnly={true}
                                  expandable={true}
                                  expanded={!!expandedItems[item.id]}
                                  onToggleExpand={() => toggleExpand(item.id)}
                                  timeline={getIssueTimeline(id)}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

          </div>
        </div>
      )}
    </div>
  );
});

export default IpIndexTab;