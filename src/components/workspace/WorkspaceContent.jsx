import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ProjectOverviewTab from '../tabs/ProjectOverviewTab';
import IpIndexTab from '../tabs/IpIndexTab';
import RevisionLogTab from '../tabs/RevisionLogTab';
import FaReportTab from '../tabs/FaReportTab';

const WorkspaceContent = ({
  activeTab,
  rollbackCounter,
  tabRef,
  currentData,
  currentViewedRevision,
  isArchived,
  lockReason,
  activeProject,
  globalIpDictionary,
  handleAddCustomIp,
  handleTabSubmit,
  handleLocalUpdate,
  handleEditingStateChange,
  handleForceUnlock,
  handleFormDirtyChange,
  initialIpForIpIndex
}) => {
  return (
    <div className="bg-white p-6 m-4 mt-0 rounded-b-xl min-h-[500px]">
      <AnimatePresence mode="sync">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="w-full h-full"
        >
          {activeTab === 'Project_Overview' && (
            <ProjectOverviewTab 
              ref={tabRef}
              data={currentData?.projectOverview} 
              currentStage={currentViewedRevision}
              isArchived={isArchived} 
              lockReason={lockReason}
              projectId={activeProject.id}
              dbUpdatedAt={activeProject.updated}
              onSubmit={(newData) => handleTabSubmit('projectOverview', newData)} 
              onImmediateUpdate={(newData, forceDirty) => handleLocalUpdate('projectOverview', newData, forceDirty)}
              revisionLogData={currentData?.revisionLog}
              faReportData={currentData?.faReport}
              onEditingStateChange={handleEditingStateChange}
              onForceUnlock={() => handleForceUnlock(activeProject.id)}
              globalIpDictionary={globalIpDictionary}
              onAddCustomIp={handleAddCustomIp}
              onFormDirtyChange={handleFormDirtyChange}
            />
          )}
          {activeTab === 'IP_Index' && (
            <IpIndexTab 
              ref={tabRef}
              data={currentData?.ipIndex}
              overviewData={currentData?.projectOverview}
              revisionLogData={currentData?.revisionLog}
              currentRevision={currentViewedRevision}
              isArchived={isArchived} 
              lockReason={lockReason}
              projectId={activeProject.id}
              dbUpdatedAt={activeProject.updated}
              onSubmit={(newData) => handleTabSubmit('ipIndex', newData)} 
              onImmediateUpdate={(newData, forceDirty) => handleLocalUpdate('ipIndex', newData, forceDirty)}
              onEditingStateChange={handleEditingStateChange}
              onForceUnlock={() => handleForceUnlock(activeProject.id)}
              globalIpDictionary={globalIpDictionary}
              selectedIp={initialIpForIpIndex}
              onFormDirtyChange={handleFormDirtyChange}
            />
          )}
          {activeTab === 'Revision_Log' && (
            <RevisionLogTab 
              ref={tabRef}
              data={currentData?.revisionLog} 
              overviewData={currentData?.projectOverview}
              ipIndexData={currentData?.ipIndex}
              currentRevision={currentViewedRevision}
              isArchived={isArchived} 
              lockReason={lockReason}
              projectId={activeProject.id}
              dbUpdatedAt={activeProject.updated}
              faReportData={currentData?.faReport}
              onSubmit={(newData) => handleTabSubmit('revisionLog', newData)} 
              onImmediateUpdate={(newData, forceDirty) => handleTabSubmit('revisionLog', newData, true)}
              onFaReportUpdate={(newData) => handleTabSubmit('faReport', newData, true)}
              onEditingStateChange={handleEditingStateChange}
              onFormDirtyChange={handleFormDirtyChange}
              onForceUnlock={() => handleForceUnlock(activeProject.id)}
            />
          )}
          {activeTab === 'FA_Report' && (
            <FaReportTab 
              ref={tabRef}
              data={currentData?.faReport}
              overviewData={currentData?.projectOverview}
              ipIndexData={currentData?.ipIndex}
              currentRevision={currentViewedRevision}
              revisionLogData={currentData?.revisionLog}
              isArchived={isArchived} 
              lockReason={lockReason}
              projectId={activeProject.id}
              dbUpdatedAt={activeProject.updated}
              onSubmit={(newData) => handleTabSubmit('faReport', newData)} 
              onImmediateUpdate={(newData, forceDirty) => handleTabSubmit('faReport', newData, true)}
              onRevisionLogUpdate={(newLogData) => handleTabSubmit('revisionLog', newLogData, true)}
              onEditingStateChange={handleEditingStateChange}
              onForceUnlock={() => handleForceUnlock(activeProject.id)}
              onFormDirtyChange={handleFormDirtyChange}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default WorkspaceContent;
