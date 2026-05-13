import React, { useState, useRef } from 'react';
import { useConfirm } from '../contexts/ConfirmContext';

// 하위 컴포넌트 임포트
import DashboardHeader from './dashboard/DashboardHeader';
import DashboardStats from './dashboard/DashboardStats';
import ProjectCard from './dashboard/ProjectCard';
import IpDictionarySection from './dashboard/IpDictionarySection';
import SubBlockCatalogSection from './dashboard/SubBlockCatalogSection';
import DashboardModals from './dashboard/DashboardModals';

import { useAuth } from '../contexts/AuthContext';

export default function Dashboard({ 
  projects, isDemoMode, isDbConnected, referenceProjectId, 
  handleNewProject, handleLoadProjectClick, openWorkspace, 
  handleToggleArchive, handlePermanentDelete, handleResetReference, handleForceUnlock, 
  globalIpDictionary, customIpDictionary, customIpDetails, 
  handleEditCustomIp, handleDeleteCustomIp, handleAddCustomIp, 
  handleExportProject, onManageProject 
}) {
  const { currentUser } = useAuth();
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [openSettingsId, setOpenSettingsId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const showConfirm = useConfirm();
  const fileInputRef = useRef(null);

  const [isIpDictOpen, setIsIpDictOpen] = useState(false);
  const [isSubBlockOpen, setIsSubBlockOpen] = useState(false);
  
  // Usage Modal States
  const [usageModalIp, setUsageModalIp] = useState(null); 
  const [usageModalSubBlock, setUsageModalSubBlock] = useState(null); // { name: 'Gate_Driver', occurrences: [...] }
  
  // Custom IP Edit Modal State
  const [editModalIp, setEditModalIp] = useState(null);
  const [editIpForm, setEditIpForm] = useState({ category: '', name: '', description: '' });
  const [isEditIpInUse, setIsEditIpInUse] = useState(false);

  // Custom IP Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addIpForm, setAddIpForm] = useState({ category: '', name: '', description: '' });
  const [isCategoryLocked, setIsCategoryLocked] = useState(false);

  const openAddModal = (category = '') => {
    setAddIpForm({ category, name: '', description: '' });
    setIsCategoryLocked(!!category);
    setIsAddModalOpen(true);
  };

  const submitAddCustomIp = async () => {
    if (!addIpForm.category || !addIpForm.name || !addIpForm.description) {
      alert('필수 입력값을 확인해주세요.');
      return;
    }
    const success = await handleAddCustomIp(addIpForm.category, addIpForm.name, addIpForm.description);
    if (success) setIsAddModalOpen(false);
  };

  const checkIfIpInUse = (ipName) => {
    return projects.some(p => {
      const blocks = p.project_data?.projectOverview?.IP_Blocks || [];
      return blocks.includes(ipName);
    });
  };

  const openEditModal = (customDetail) => {
    const inUse = checkIfIpInUse(customDetail.name);
    setIsEditIpInUse(inUse);
    setEditIpForm({ category: customDetail.category, name: customDetail.name, description: customDetail.description });
    setEditModalIp(customDetail);
  };

  const submitEditCustomIp = async () => {
    if (!editIpForm.category || !editIpForm.name || !editIpForm.description) {
      alert('필수 입력값을 확인해주세요.');
      return;
    }
    const success = await handleEditCustomIp(editModalIp.id, editIpForm);
    if (success) setEditModalIp(null);
  };

  const submitDeleteCustomIp = async () => {
    if (isEditIpInUse) return;
    const confirmed = await showConfirm({
      title: "커스텀 IP 삭제",
      message: `'${editModalIp.name}' 항목을 영구적으로 삭제하시겠습니까?`,
      type: "danger",
      confirmText: "삭제"
    });
    if (confirmed) {
      const success = await handleDeleteCustomIp(editModalIp.id);
      if (success) setEditModalIp(null);
    }
  };

  // 날짜 포맷팅 (KST 기준, 분까지만 표시)
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
  
  // 영구 삭제 모달 상태
  const [deleteModalProj, setDeleteModalProj] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // 잠금 강제 해제 모달 상태
  const [unlockModalProj, setUnlockModalProj] = useState(null);

  const filteredProjects = projects.filter(p => showArchived || !p.is_archived);

  // 잠금 상태 분석 헬퍼
  // --- Sub-Block Catalog 추출 로직 ---
  const [subBlockSearch, setSubBlockSearch] = useState('');
  const allSubBlocks = projects.flatMap(p => {
    // p.project_data가 있는 경우에만 처리 (리스트 조회 시에는 없을 수 있음)
    if (!p.project_data) return [];
    
    // 최신 차수의 데이터 가져오기
    const latestEvt = p.latest_evt;
    const revisionData = p.project_data.revisions?.[latestEvt] || p.project_data;
    const ipIndex = revisionData.ipIndex || {};

    return Object.entries(ipIndex).flatMap(([ipName, ipData]) => {
      const subBlocks = ipData.Sub_Blocks || [];
      return subBlocks.map(sb => ({
        ...sb,
        parentIp: ipName,
        projectId: p.id,
        projectName: p.name,
        evt: latestEvt
      }));
    });
  });

  const filteredSubBlocks = allSubBlocks.filter(sb => 
    sb.name.toLowerCase().includes(subBlockSearch.toLowerCase()) ||
    sb.parentIp.toLowerCase().includes(subBlockSearch.toLowerCase()) ||
    sb.keyFeatures?.toLowerCase().includes(subBlockSearch.toLowerCase()) ||
    sb.motherIpName?.toLowerCase().includes(subBlockSearch.toLowerCase())
  );

  // 이름별 그룹화 로직
  const groupedSubBlocks = filteredSubBlocks.reduce((acc, sb) => {
    if (!acc[sb.name]) {
      acc[sb.name] = {
        name: sb.name,
        occurrences: [],
        latestFeatures: sb.keyFeatures // 가장 최근 데이터 기준 특징 (필요시 정렬 로직 추가 가능)
      };
    }
    acc[sb.name].occurrences.push(sb);
    return acc;
  }, {});

  const sortedSubBlockGroups = Object.values(groupedSubBlocks).sort((a, b) => a.name.localeCompare(b.name));

  const [expandedSubBlockName, setExpandedSubBlockName] = useState(null);

  const getIpUsage = (ipName) => {
    return projects.filter(p => {
      const latestEvt = p.latest_evt;
      const revisionData = p.project_data?.revisions?.[latestEvt] || p.project_data || {};
      const ipBlocks = revisionData.projectOverview?.IP_Blocks || [];
      return ipBlocks.includes(ipName);
    });
  };

  const getLockStatus = (proj) => {
    if (!proj.is_locked || !proj.locked_at) return { isStale: false, minutes: 0 };
    const lockTime = new Date(proj.locked_at).getTime();
    const diffMins = Math.floor((Date.now() - lockTime) / (1000 * 60));
    return {
      isStale: diffMins >= 10, // 10분 이상이면 정체(Stale)로 간주
      minutes: diffMins
    };
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6 mt-8">
      {/* 1. 헤더 영역 */}
      <DashboardHeader 
        fileInputRef={fileInputRef}
        onLoadProject={handleLoadProjectClick}
        onNewProject={handleNewProject}
      />

      {/* 2. 연결 상태 및 필터 */}
      <DashboardStats 
        isDemoMode={isDemoMode}
        isDbConnected={isDbConnected}
        showArchived={showArchived}
        onShowArchivedChange={setShowArchived}
      />

      {/* 3. 프로젝트 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map(proj => (
          <ProjectCard 
            key={proj.id}
            project={proj}
            // currentUser comes from Context in ProjectCard
            referenceProjectId={referenceProjectId}
            openSettingsId={openSettingsId}
            setOpenSettingsId={setOpenSettingsId}
            openDropdownId={openDropdownId}
            setOpenDropdownId={setOpenDropdownId}
            onExport={handleExportProject}
            onManage={onManageProject}
            onToggleArchive={handleToggleArchive}
            onResetReference={handleResetReference}
            onDelete={setDeleteModalProj}
            onUnlock={setUnlockModalProj}
            onOpenWorkspace={openWorkspace}
            showConfirm={showConfirm}
          />
        ))}

        {filteredProjects.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400">
            <p>표시할 프로젝트가 없습니다. 'New Project'를 클릭하여 시작하세요.</p>
          </div>
        )}
      </div>

      {/* 4. Global IP Dictionary 섹션 */}
      <IpDictionarySection 
        isIpDictOpen={isIpDictOpen}
        setIsIpDictOpen={setIsIpDictOpen}
        globalIpDictionary={globalIpDictionary}
        customIpDetails={customIpDetails}
        projects={projects}
        openAddModal={openAddModal}
        setUsageModalIp={setUsageModalIp}
        openEditModal={openEditModal}
      />

      {/* 5. Sub-Block Catalog 섹션 */}
      <SubBlockCatalogSection 
        isSubBlockOpen={isSubBlockOpen}
        setIsSubBlockOpen={setIsSubBlockOpen}
        subBlockSearch={subBlockSearch}
        setSubBlockSearch={setSubBlockSearch}
        allSubBlocks={allSubBlocks}
        sortedSubBlockGroups={sortedSubBlockGroups}
        expandedSubBlockName={expandedSubBlockName}
        setExpandedSubBlockName={setExpandedSubBlockName}
        setUsageModalSubBlock={setUsageModalSubBlock}
        openWorkspace={openWorkspace}
      />

      {/* 6. 대시보드 공통 모달 그룹 */}
      <DashboardModals 
        deleteModalProj={deleteModalProj}
        setDeleteModalProj={setDeleteModalProj}
        deleteConfirmText={deleteConfirmText}
        setDeleteConfirmText={setDeleteConfirmText}
        handlePermanentDelete={handlePermanentDelete}
        unlockModalProj={unlockModalProj}
        setUnlockModalProj={setUnlockModalProj}
        handleForceUnlock={handleForceUnlock}
        getLockStatus={getLockStatus}
        editModalIp={editModalIp}
        setEditModalIp={setEditModalIp}
        editIpForm={editIpForm}
        setEditIpForm={setEditIpForm}
        isEditIpInUse={isEditIpInUse}
        submitEditCustomIp={submitEditCustomIp}
        submitDeleteCustomIp={submitDeleteCustomIp}
        isAddModalOpen={isAddModalOpen}
        setIsAddModalOpen={setIsAddModalOpen}
        addIpForm={addIpForm}
        setAddIpForm={setAddIpForm}
        isCategoryLocked={isCategoryLocked}
        submitAddCustomIp={submitAddCustomIp}
        usageModalIp={usageModalIp}
        setUsageModalIp={setUsageModalIp}
        usageModalSubBlock={usageModalSubBlock}
        setUsageModalSubBlock={setUsageModalSubBlock}
        openWorkspace={openWorkspace}
      />
    </div>
  );
}
