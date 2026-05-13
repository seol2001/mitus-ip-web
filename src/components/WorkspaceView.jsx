import React from 'react';
import WorkspaceHeader from './workspace/WorkspaceHeader';
import WorkspaceTabs from './workspace/WorkspaceTabs';
import WorkspaceContent from './workspace/WorkspaceContent';

/**
 * WorkspaceView - 워크스페이스 메인 뷰 컴포넌트
 * UI 구조 세분화를 통해 가독성을 높이고 하위 컴포넌트(Header, Tabs, Content)를 오케스트레이션합니다.
 */
const WorkspaceView = ({
  // Data Props
  activeProject,
  projectData,
  currentData,
  isDirtyRef,
  isArchived,
  isSessionLockedByOther,
  currentProjMeta,
  lockDetail,
  tabs,
  activeTab,
  currentViewedRevision,
  lockReason,
  globalIpDictionary,
  initialIpForIpIndex,
  tabRef,
  isFormDirty,
  
  // Handler Props
  requestBackToDashboard,
  handleGlobalLock,
  handleGlobalUnlock,
  handleSaveMD,
  handleGenerateNextRevision,
  handleDebugRollback,
  handleTabClick,
  handleTabSubmit,
  handleEditingStateChange,
  handleForceUnlock,
  handleAddCustomIp,
  handleFormDirtyChange,
  showConfirm
}) => {
  if (!activeProject || !projectData) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col relative max-w-[1400px] mx-auto min-h-[calc(100vh-60px)]">
      {/* 🚀 통합 글로벌 헤더 (Navigation + Context + Global Actions) */}
      <WorkspaceHeader 
        activeProject={activeProject}
        currentViewedRevision={currentViewedRevision}
        isDirtyRef={isDirtyRef}
        isArchived={isArchived}
        isSessionLockedByOther={isSessionLockedByOther}
        currentProjMeta={currentProjMeta}
        lockDetail={lockDetail}
        isFormDirty={isFormDirty}
        currentData={currentData}
        requestBackToDashboard={requestBackToDashboard}
        handleGlobalLock={handleGlobalLock}
        handleGlobalUnlock={handleGlobalUnlock}
        handleSaveMD={handleSaveMD}
        handleGenerateNextRevision={handleGenerateNextRevision}
        handleDebugRollback={handleDebugRollback}
        handleForceUnlock={handleForceUnlock}
        showConfirm={showConfirm}
      />

      {/* 탭 네비게이션 */}
      <WorkspaceTabs 
        tabs={tabs}
        activeTab={activeTab}
        onTabClick={handleTabClick}
      />

      {/* 탭 콘텐츠 영역 */}
      <WorkspaceContent 
        activeTab={activeTab}
        tabRef={tabRef}
        currentData={currentData}
        currentViewedRevision={currentViewedRevision}
        isArchived={isArchived}
        lockReason={lockReason}
        activeProject={activeProject}
        globalIpDictionary={globalIpDictionary}
        handleAddCustomIp={handleAddCustomIp}
        handleTabSubmit={handleTabSubmit}
        handleEditingStateChange={handleEditingStateChange}
        handleForceUnlock={handleForceUnlock}
        handleFormDirtyChange={handleFormDirtyChange}
        initialIpForIpIndex={initialIpForIpIndex}
      />
    </div>
  );
};

export default WorkspaceView;
