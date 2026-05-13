import { useCallback } from 'react';
import { projectService } from '../services/projectService';

export const useProjectService = ({ isDemoMode, setProjectsList, projectsList, activeProject, executeExitRef, showConfirm, REFERENCE_PROJECT_ID }) => {
  const handleToggleArchive = useCallback(async (projectId, targetIsArchived) => {
    const targetProject = projectsList.find(p => p.id === projectId);
    if (targetIsArchived && targetProject?.is_locked) {
      showConfirm({
        title: "보관 불가",
        message: "현재 작업 중인(열려있는) 프로젝트는 보관할 수 없습니다. 먼저 프로젝트를 닫아주세요.",
        type: "warning",
        showCancel: false
      });
      return;
    }

    const confirmed = await showConfirm({
      title: targetIsArchived ? "프로젝트 아카이브" : "아카이브 복구",
      message: targetIsArchived 
        ? "이 프로젝트를 아카이브로 이동하시겠습니까?" 
        : "이 프로젝트를 아카이브에서 복구하시겠습니까?",
      type: "warning"
    });
    if (!confirmed) return;

    if (!isDemoMode) {
      const { error } = await projectService.updateProject(projectId, { is_archived: targetIsArchived });

      if (error) {
        console.error('Error toggling archive:', error);
        showConfirm({
          title: "변경 실패",
          message: "상태 변경에 실패했습니다.",
          type: "danger",
          showCancel: false
        });
        return;
      }
    } else {
      console.log('🗄️ [Demo Mode] Local 상태의 보관 여부를 변경합니다.');
    }

    setProjectsList(prev => prev.map(p => {
      if (p.id === projectId) return { ...p, is_archived: targetIsArchived };
      return p;
    }));

    if (targetIsArchived && activeProject && activeProject.id === projectId) {
      if (executeExitRef.current) executeExitRef.current();
    }
  }, [showConfirm, isDemoMode, setProjectsList, projectsList, activeProject, executeExitRef]);

  const handlePermanentDelete = useCallback(async (projectId) => {
    const targetProject = projectsList.find(p => p.id === projectId);
    if (targetProject?.is_locked) {
      showConfirm({
        title: "삭제 불가",
        message: "현재 작업 중인(열려있는) 프로젝트는 삭제할 수 없습니다. 먼저 프로젝트를 닫아주세요.",
        type: "warning",
        showCancel: false
      });
      return;
    }

    if (projectId === REFERENCE_PROJECT_ID) {
      showConfirm({
        title: "삭제 불가",
        message: '시스템 레퍼런스 프로젝트는 삭제할 수 없습니다.\n\n대신 "초기 시드 데이터로 복구" 기능을 사용하세요.',
        type: "warning",
        showCancel: false
      });
      return;
    }
    if (!isDemoMode) {
      const { error } = await projectService.deleteProject(projectId);
      if (error) {
        console.error('Error deleting project:', error);
        showConfirm({
          title: "삭제 실패",
          message: "삭제에 실패했습니다.",
          type: "danger",
          showCancel: false
        });
        return;
      }
    } else {
      console.log('🗑️ [Demo Mode] Local 상태에서 프로젝트를 삭제합니다.');
    }
    setProjectsList(prev => prev.filter(p => p.id !== projectId));
  }, [showConfirm, isDemoMode, setProjectsList, projectsList, REFERENCE_PROJECT_ID]);

  const handleForceUnlock = useCallback(async (projectId, onSuccess) => {
    if (isDemoMode) {
      setProjectsList(prev => prev.map(p => 
        p.id === projectId ? { ...p, is_locked: false, locked_by: null, locked_at: null } : p
      ));
      if (onSuccess) onSuccess();
      return;
    }

    // [의도 기반 API 적용] 강제 탈취 시에는 소유권 체크 없이 해제 시도
    const { error } = await projectService.forceReleaseLock(projectId);

    if (error) {
      console.error('❌ Force Unlock Error:', error);
      showConfirm({
        title: "잠금 해제 실패",
        message: "잠금 해제에 실패했습니다.",
        type: "danger",
        showCancel: false
      });
    } else {
      console.log(`✅ [Force Unlock] ${projectId} 잠금이 해제되었습니다.`);
      if (onSuccess) onSuccess();
    }
  }, [isDemoMode, setProjectsList, showConfirm]);

  return {
    handleToggleArchive,
    handlePermanentDelete,
    handleForceUnlock
  };
};
