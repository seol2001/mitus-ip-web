import React, { useState, useEffect } from 'react';
import { ipCategoryNameMap, makeDefaultIpIndex } from '../../data/mockData';
import { X } from '../Icons';
import ActionBar from '../ActionBar';
import IssueSummaryCard, { getIssueStatus } from '../IssueSummaryCard';
import { BookOpen, Lock, Copy } from 'lucide-react';
import { DEFAULT_IP_CONTENTS_SCHEMA } from '../../data/schemaConfig';

// ─── [D&D] 드래그 앤 드롭 라이브러리 임포트 ───
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

const IpIndexTab = ({ data, overviewData, revisionLogData, currentRevision, isArchived, onSubmit, onImmediateUpdate, onEditingStateChange }) => {
  const [unlockedOverview, setUnlockedOverview] = useState(false);
  const [selectedIpForIndex, setSelectedIpForIndex] = useState(null);
  const [isTemplateEditing, setIsTemplateEditing] = useState(false);
  const [keySpecSchema, setKeySpecSchema] = useState([]); 
  const [ipContentsSchema, setIpContentsSchema] = useState([]); // 🚀 컨텐츠 카드 스키마 상태 추가

  useEffect(() => {
    if (onEditingStateChange) onEditingStateChange(unlockedOverview);
  }, [unlockedOverview, onEditingStateChange]);

  const safeData = data || {};
  const safeOverview = overviewData || { IP_Blocks: [], Project_Name: '', Foundry: '', Process: '' };
  
  useEffect(() => {
    if (!selectedIpForIndex && safeOverview.IP_Blocks.length > 0) {
      setSelectedIpForIndex(safeOverview.IP_Blocks[0]);
    } else if (selectedIpForIndex && !safeOverview.IP_Blocks.includes(selectedIpForIndex)) {
      setSelectedIpForIndex(safeOverview.IP_Blocks[0] || null);
    }
  }, [safeOverview.IP_Blocks, selectedIpForIndex]);

  const isOverviewDisabled = isArchived || !unlockedOverview;

  const currentIpData = selectedIpForIndex && safeData[selectedIpForIndex] 
    ? safeData[selectedIpForIndex] 
    : makeDefaultIpIndex(selectedIpForIndex, currentRevision);

  // ─── 🚀 스키마 동기화 (IP 변경 시) ───
  useEffect(() => {
    if (selectedIpForIndex && currentIpData) {
      // 1. Key Spec 동기화
      if (currentIpData.UI_Schemas?.Key_Spec) {
        setKeySpecSchema(currentIpData.UI_Schemas.Key_Spec);
      } else {
        const generated = Object.keys(currentIpData.Key_Spec || {}).map(k => ({ id: k, label: k }));
        setKeySpecSchema(generated);
      }

      // 2. 컨텐츠 카드 동기화
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

  // ─── 🚀 Key Spec 핸들러 ───
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
  const handleKeySpecDelete = (id) => {
    if (window.confirm("이 항목을 삭제하시겠습니까?")) {
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

  // ─── 🚀 컨텐츠 카드 (IP Architecture 등) 핸들러 ───
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
  const handleIpContentsDelete = (id) => {
    if (window.confirm("이 카드 전체를 삭제하시겠습니까?")) {
      const newSchema = ipContentsSchema.filter(f => f.id !== id);
      setIpContentsSchema(newSchema);
      const newData = { ...currentIpData, UI_Schemas: { ...(currentIpData.UI_Schemas || {}), Contents: newSchema } };
      delete newData[id]; // 좀비 데이터 삭제
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
  };
  const handleSubmit = () => {
    if (onSubmit) onSubmit(safeData);
    setUnlockedOverview(false);
  };

  const renderSectionHeader = (title) => (
    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
      <h2 className="text-lg font-extrabold text-slate-800">{title}</h2>
      {isOverviewDisabled && <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">Locked</span>}
    </div>
  );

  const labelClass = "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1";
  const inputClass = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 bg-slate-50 focus:bg-white transition-colors disabled:opacity-50 disabled:bg-slate-100 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 placeholder:font-medium placeholder:text-slate-300";

  return (
    <div className="max-w-full space-y-4 text-left h-full pb-10">
      
      {/* ── 헤더 (Title + 템플릿 편집 버튼 + ActionBar) ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-200 mb-6 w-full gap-4">
        <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2 shrink-0">
          <BookOpen size={28} className="text-blue-600" />
          IP Index
          {isArchived && <span className="text-xs px-2 py-1 bg-slate-100 text-slate-500 rounded font-bold flex items-center gap-1 ml-1"><Lock size={11} />Read-Only</span>}
        </h1>
        
        <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
          {!isOverviewDisabled && selectedIpForIndex && (
            <div className="flex items-center gap-2 bg-indigo-50 px-2 py-1.5 rounded-lg border border-indigo-100">
              <button onClick={() => setIsTemplateEditing(!isTemplateEditing)} className={`text-xs font-bold px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${isTemplateEditing ? "bg-indigo-600 text-white shadow-sm" : "text-indigo-600 hover:bg-indigo-100"}`}>
                {isTemplateEditing ? "✅ 편집 완료" : "⚙️ 템플릿 편집"}
              </button>
              {isTemplateEditing && (
                <button onClick={() => { 
                    if (window.confirm("템플릿을 초기화하시겠습니까?")) { 
                        const generated = Object.keys(currentIpData.Key_Spec || {}).map(k => ({ id: k, label: k }));
                        setKeySpecSchema(generated); 
                        setIpContentsSchema(DEFAULT_IP_CONTENTS_SCHEMA);
                        setIsTemplateEditing(false); 
                        updateCurrentIp({ UI_Schemas: { ...(currentIpData.UI_Schemas || {}), Key_Spec: generated, Contents: DEFAULT_IP_CONTENTS_SCHEMA } });
                    } 
                }} className="text-xs font-bold text-red-500 hover:text-white bg-white hover:bg-red-500 border border-red-200 hover:border-red-500 px-2 py-1.5 rounded-md transition-all flex items-center gap-1" title="기본 템플릿으로 복구">
                  🔄 초기화
                </button>
              )}
            </div>
          )}
          <div className="shrink-0 border-l pl-4 border-slate-200">
            <ActionBar isGlobalArchived={isArchived} isEditing={unlockedOverview} onEdit={() => setUnlockedOverview(true)} onLock={handleSubmit} />
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
                  <div><label className={labelClass}>IP Category</label><select name="IP_Category" value={currentIpData.IP_Category || ''} onChange={handleIpIndexChange} className={inputClass} disabled={isOverviewDisabled}>{Object.keys(ipCategoryNameMap).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div><label className={labelClass}>IP Name</label><select name="IP_Name" value={currentIpData.IP_Name || ''} onChange={handleIpIndexChange} className={inputClass} disabled={isOverviewDisabled}>{(ipCategoryNameMap[currentIpData.IP_Category] || []).map(ip => <option key={ip} value={ip}>{ip}</option>)}</select></div>
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
              {renderSectionHeader('문서 관리 정보')}
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelClass}>Design Owner</label><input type="text" name="Design_Owner" value={currentIpData.Design_Owner || ''} onChange={handleIpIndexChange} className={inputClass} disabled={isOverviewDisabled} /></div>
                <div><label className={labelClass}>Last Updated</label><input type="date" name="Last_Updated" value={currentIpData.Last_Updated || ''} onChange={handleIpIndexChange} className={inputClass} disabled={isOverviewDisabled} /></div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-8 space-y-6">
            
            {/* 🚀 Key Spec 영역 */}
            <div className={`bg-white p-6 rounded-2xl shadow-sm border transition-colors space-y-5 ${!isOverviewDisabled ? "border-amber-300 ring-4 ring-amber-50" : "border-slate-200"}`}>
              {renderSectionHeader('Key Spec')}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleKeySpecDragEnd}>
                <SortableContext items={keySpecSchema.map(f => f.id)} strategy={verticalListSortingStrategy}>
                  <div className="w-full text-sm text-left border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                    {!isTemplateEditing && keySpecSchema.length > 0 && (
                      <div className="flex bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <div className="px-4 py-3 w-1/3 border-r border-slate-200 shrink-0">Parameter Key</div>
                        <div className="px-4 py-3 flex-1">Value</div>
                      </div>
                    )}
                    {keySpecSchema.map((field) => (
                      <SortableField key={field.id} id={field.id} isEditing={isTemplateEditing} className={`flex items-stretch border-b border-slate-100 last:border-0 ${isTemplateEditing ? "p-2 bg-indigo-50/60 transition-all m-1 rounded-lg border border-indigo-100" : "hover:bg-slate-50"}`}>
                        {(dragListeners, dragAttributes) => (
                          isTemplateEditing ? (
                            <div className="flex items-center gap-2 w-full">
                              <div className="cursor-grab active:cursor-grabbing text-indigo-400 hover:text-indigo-700 px-1 shrink-0" {...dragListeners} {...dragAttributes}>⠿</div>
                              <input type="text" value={field.label} onChange={(e) => handleKeySpecLabelChange(field.id, e.target.value)} className="w-1/3 min-w-0 border border-indigo-200 rounded-md px-2 py-1.5 text-xs font-bold text-indigo-900 bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" placeholder="Parameter Key" />
                              <div className="flex-1 text-xs text-slate-400 px-3 py-1.5 border border-dashed border-slate-200 rounded bg-slate-50/50 flex items-center h-full">값(Value) 입력 영역</div>
                              <button onClick={() => handleKeySpecClone(field)} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-md shrink-0" title="이 항목 복제"><Copy size={14} /></button>
                              <button onClick={() => handleKeySpecDelete(field.id)} className="p-1.5 text-red-400 hover:bg-red-100 rounded-md shrink-0" title="항목 삭제"><X size={14} /></button>
                            </div>
                          ) : (
                            <div className="flex w-full items-stretch min-h-[44px]">
                              <div className="px-4 py-2 w-1/3 border-r border-slate-200 text-xs font-mono text-slate-600 bg-slate-50/50 flex items-center break-all shrink-0">{field.label}</div>
                              <div className="flex-1 p-0 flex"><input type="text" value={currentIpData.Key_Spec?.[field.id] || ''} onChange={(e) => handleIpKeySpecChange(field.id, e.target.value)} className={`w-full px-4 py-2 bg-transparent outline-none focus:bg-blue-50 font-mono text-xs text-blue-900 transition-colors placeholder:text-slate-300 ${isOverviewDisabled ? 'text-slate-400 cursor-not-allowed' : ''}`} disabled={isOverviewDisabled} placeholder="Input value..." /></div>
                            </div>
                          )
                        )}
                      </SortableField>
                    ))}
                    {isTemplateEditing && <div className="p-2 bg-slate-50/50 border-t border-slate-200"><button onClick={handleKeySpecAdd} className="w-full py-2.5 border-2 border-dashed border-indigo-200 rounded-lg text-indigo-600 font-bold text-xs hover:bg-indigo-50 hover:border-indigo-400 transition-colors flex items-center justify-center gap-1">➕ 새 파라미터 추가</button></div>}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            {/* 🚀 IP 컨텐츠 카드 영역 (D&D 및 자동 넘버링 적용) */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleIpContentsDragEnd}>
              <SortableContext items={ipContentsSchema.map(f => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-6">
                  {ipContentsSchema.map((field, index) => (
                    <SortableField key={field.id} id={field.id} isEditing={isTemplateEditing} className={`bg-white p-6 rounded-2xl shadow-sm border transition-colors space-y-5 ${!isOverviewDisabled ? "border-amber-300 ring-4 ring-amber-50" : "border-slate-200"} ${isTemplateEditing ? "ring-4 ring-indigo-50 border-indigo-200" : ""}`}>
                      {(dragListeners, dragAttributes) => (
                        <>
                          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            {isTemplateEditing ? (
                              <div className="flex items-center gap-3 w-full">
                                <div className="cursor-grab active:cursor-grabbing text-indigo-400 hover:text-indigo-700 px-1 font-bold w-6 text-center" title="드래그하여 이동" {...dragListeners} {...dragAttributes}>⠿</div>
                                <span className="text-sm font-extrabold text-indigo-900">{index + 1}.</span>
                                <input type="text" value={field.label} onChange={(e) => handleIpContentsLabelChange(field.id, e.target.value)} className="flex-1 border border-indigo-200 rounded-lg px-3 py-1.5 text-sm font-bold text-indigo-900 bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" />
                                <button onClick={() => handleIpContentsDelete(field.id)} className="text-red-400 hover:bg-red-50 p-2 rounded-lg"><X size={18} /></button>
                              </div>
                            ) : (
                              <>
                                <h2 className="text-lg font-extrabold text-slate-800">{index + 1}. {field.label}</h2>
                                {isOverviewDisabled && <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">Locked</span>}
                              </>
                            )}
                          </div>

                          {/* 카드 타입별 렌더링 로직 */}
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
                  ))}
                  {isTemplateEditing && (
                    <button onClick={handleIpContentsAdd} className="w-full py-4 mt-2 border-2 border-dashed border-indigo-200 rounded-xl text-indigo-600 font-bold text-sm hover:bg-indigo-50 hover:border-indigo-400 transition-colors flex items-center justify-center gap-2">➕ 새 컨텐츠 카드 추가</button>
                  )}
                </div>
              </SortableContext>
            </DndContext>

            {/* 고정 영역: Revision History (자동 넘버링 동기화) */}
            <div className="bg-gradient-to-br from-slate-100 to-indigo-50 p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4 mt-6">
              <div className="flex items-center justify-between border-b border-indigo-200 pb-3">
                <h2 className="text-lg font-extrabold text-indigo-900">{ipContentsSchema.length + 1}. Evaluation & Revision History</h2>
                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-600 px-2 py-1 rounded border border-indigo-200">Revision_Log 연동</span>
              </div>
              
              {(() => {
                const ip = selectedIpForIndex;
                const proj = safeOverview.Project_Name || 'Unknown';
                const rlIssues = revisionLogData?.issues || [];
                const rlHistory = revisionLogData?.historyBlocks || [];
                const isNewLike = (m) => m === 'new' || m === 'fa';
                const getIssueId = (it) => isNewLike(it.entryMode) ? `${it.ipBlock}.${proj}.${it.issueNum}` : it.targetIssue;
                const isRelated = (it) => {
                  const id = getIssueId(it);
                  if (isNewLike(it.entryMode)) {
                    // ipBlock이 올바르게 저장된 경우 직접 비교
                    if (it.ipBlock) return it.ipBlock === ip;
                    // ipBlock 누락(구버전 데이터) → issueNum 기반 ID로 fallback 체크
                    return id ? id.startsWith(ip + '.') : false;
                  }
                  return id ? id.startsWith(ip + '.') : false;
                };
                const allStages = [];
                const curFiltered = rlIssues.filter(isRelated);

                // ── loadedIssues 중 현재 차수에서 아직 eval/carryover로 처리되지 않은 항목 추가 ──
                const loadedIssueIds = revisionLogData?.loadedIssues || [];
                const handledIds = new Set(
                  rlIssues
                    .filter(i => i.entryMode === 'eval' || i.entryMode === 'carryover')
                    .map(i => i.targetIssue)
                    .filter(Boolean)
                );
                const allHistoryIssues = [...rlHistory].flatMap(b => b.issues || []);
                const pendingItems = [];
                loadedIssueIds.forEach(lid => {
                  if (handledIds.has(lid)) return; // 이미 처리됨
                  // historyBlocks에서 해당 이슈의 최신 상태 조회 (역순 탐색)
                  const latestEntry = [...allHistoryIssues].reverse().find(i => getIssueId(i) === lid);
                  if (latestEntry && isRelated(latestEntry)) {
                    pendingItems.push({ ...latestEntry, _isPendingEval: true });
                  }
                });

                const combinedCurrent = [...curFiltered, ...pendingItems];
                if (combinedCurrent.length > 0) allStages.push({ stageName: currentRevision, items: combinedCurrent, isCurrent: true });
                const historyCopy = [...rlHistory].reverse();
                historyCopy.forEach(b => {
                  const filtered = (b.issues || []).filter(isRelated);
                  if (filtered.length > 0) allStages.push({ stageName: b.stageName, items: filtered });
                });
                
                if (allStages.length === 0) return (
                  <div className="text-center py-8 text-indigo-300">
                    <div className="text-3xl mb-2">📊</div>
                    <p className="text-sm font-medium">{ip} IP에 대한 Revision_Log 데이터가 없습니다.</p>
                  </div>
                );
                return allStages.map((stageBlock, si) => {
                  const stageTotal = stageBlock.items.length;
                  let stageOpen = 0, stageClosed = 0, stageDeferred = 0;
                  stageBlock.items.forEach(it => {
                    const s = getIssueStatus(it);
                    if (s === 'OPEN') stageOpen++;
                    else if (s === 'CLOSED') stageClosed++;
                    else if (s === 'DEFERRED') stageDeferred++;
                  });
                  return (
                    <div key={si} className={`rounded-xl border border-slate-200 overflow-hidden ${stageBlock.isCurrent ? 'ring-2 ring-indigo-300' : ''}`}>
                      <div className={`px-4 py-2.5 flex items-center gap-3 flex-wrap ${stageBlock.isCurrent ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                        <span className="text-white font-bold text-sm">{stageBlock.stageName}</span>
                        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white/10 text-white/80">TOTAL {stageTotal}</span>
                          {stageOpen > 0 && <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-500/80 text-white">OPEN {stageOpen}</span>}
                          {stageClosed > 0 && <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white/10 text-white/70">CLOSED {stageClosed}</span>}
                        </div>
                      </div>
                      <div className="bg-slate-50 p-3">
                        {stageBlock.items.map((it, ii) => (
                          <IssueSummaryCard key={it.id || ii} item={it} project={proj} isReadOnly={true} />
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default IpIndexTab;