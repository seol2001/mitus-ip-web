import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { initialProjectData, defaultProjOverview, makeBlankOverview, makeDefaultIpIndex, ipCategoryNameMap } from './data/mockData';
import { projectService } from './services/projectService';
import { useProjectLock } from './hooks/useProjectLock';
import { useNavigationGuard } from './hooks/useNavigationGuard';
import { deriveNextRevisionData } from './utils/projectLogic';
import { canUpdateProject } from './utils/securityUtils';
import Dashboard from './components/Dashboard';
import WorkspaceView from './components/WorkspaceView';
import NewProjectModal from './components/NewProjectModal';
import LockChecklistModal from './components/LockChecklistModal';
import { useConfirm } from './contexts/ConfirmContext';
import { Save as SaveIcon, AlertCircle } from 'lucide-react';
import AccessGate from './components/AccessGate';
import ImportModal from './components/ImportModal';
import ProjectManageModal from './components/ProjectManageModal';
import AppExitModal from './components/modals/AppExitModal';
import { useProjectService } from './hooks/useProjectService';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import useExportManager from './hooks/useExportManager';
import { generateBackupProject } from './utils/projectUtils';


const REFERENCE_PROJECT_ID = 'SM5718';


class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorStr: '' };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errorStr: error.toString() + '\n' + error.stack };
  }
  render() {
    if (this.state.hasError) {
      return <div style={{ padding: 20, color: 'red', background: '#ffebee', whiteSpace: 'pre-wrap' }}>{this.state.errorStr}</div>;
    }
    return this.props.children;
  }
}

function App() {
  const { isAuthorized, currentUser, login } = useAuth();
  const [viewState, setViewState] = useState('DASHBOARD');

  const [projectsList, setProjectsList] = useState([]);
  const projectsListRef = useRef([]); // 하트비트 로직에서 스테일 클로저 방지를 위한 Ref
  useEffect(() => {
    projectsListRef.current = projectsList;
  }, [projectsList]);

  const [loading, setLoading] = useState(true);
  const [isDbConnected, setIsDbConnected] = useState(false);

  // ─── [아키텍처 개선] Refs (이벤트 리스너 stale closure 방지용) ───
  const activeProjectRef = useRef(null);
  const isDemoModeRef = useRef(false);

  const [activeProject, setActiveProject] = useState(null);
  useEffect(() => { activeProjectRef.current = activeProject; }, [activeProject]);

  const [isDemoMode, setIsDemoMode] = useState(false);
  useEffect(() => { isDemoModeRef.current = isDemoMode; }, [isDemoMode]);

  const [lockModalOpen, setLockModalOpen] = useState(false);
  const [lockChecklist, setLockChecklist] = useState([]);
  
  // [Unit D] 비동기 요청 취소를 위한 AbortController Ref
  const saveAbortControllerRef = useRef(null);

  // 브라우저 탭 제목 동적 변경 (로컬/배포 구분)
  useEffect(() => {
    const isLocal = import.meta.env.DEV ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    if (isLocal) {
      document.title = '🏠 [LOCAL] mitus-ip-web';
    } else {
      document.title = '🚀 mitus-ip-web';
    }
  }, []);

  const showConfirm = useConfirm();

  const [globalIpDictionary, setGlobalIpDictionary] = useState(ipCategoryNameMap);
  const [customIpDetails, setCustomIpDetails] = useState([]);

  // ─── [신규] 가져오기(Import) 모달 상태 ───
  const [importModalData, setImportModalData] = useState(null); // { project, existingProject }
  const [manageModalData, setManageModalData] = useState(null); // { mode, project }


  // ─── [Supabase] 프로젝트 목록 로드 함수 ───
  async function fetchProjects() {
    try {
      setLoading(true);
      const { projects: data, customIps: customIpsData, error } = await projectService.fetchProjects();

      if (customIpsData) {
        setCustomIpDetails(customIpsData);
        setGlobalIpDictionary(prev => {
          const newDict = structuredClone(prev);
          customIpsData.forEach(cip => {
            if (!newDict[cip.category]) newDict[cip.category] = [];
            if (!newDict[cip.category].includes(cip.name)) newDict[cip.category].push(cip.name);
          });
          return newDict;
        });
      }

      if (error) {
        if (error.message === 'Failed to fetch' || !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('your-project-id')) {
          setIsDemoMode(true);
          const { initialProjectData } = await import('./data/mockData');
          setProjectsList([{
            id: 'SM5718',
            name: 'SM5718 (Demo Mode)',
            latest_evt: 'EVT1',
            phases: ['EVT1'],
            updated: new Date().toISOString(),
            is_locked: false,
            project_data: initialProjectData
          }]);
        }
      } else {
        setProjectsList(data.map(p => ({
          ...p,
          is_locked: p.is_locked ?? false,
          is_archived: p.is_archived ?? false
        })));
        setIsDbConnected(true);
        setIsDemoMode(false);
      }
    } catch (e) {
      console.error('Fetch Projects Error:', e);
    } finally {
      setLoading(false);
    }
  }

  // ─── [useEffect] 프로젝트 로드, 실시간 구독 및 URL 인증 ───
  useEffect(() => {
    fetchProjects();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('key') === 'mitus2026') {
      handleAuthorize();
    }

    const channel = supabase
      .channel('projects-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        if (eventType === 'INSERT') {
          setProjectsList(prev => prev.some(p => p.id === newRecord.id) ? prev : [newRecord, ...prev]);
        } else if (eventType === 'UPDATE') {
          // [버그1 픽스] Race Condition 방어: Realtime UPDATE가 handleTabSubmit의
          // 낙관적 로컬 업데이트(setProjectsList)보다 오래된 데이터를 가져올 경우
          // 로컬의 최신 상태를 보호하기 위해 타임스탬프를 비교함.
          setProjectsList(prev => prev.map(p => {
            if (p.id !== newRecord.id) return p;
            // 로컬 상태가 더 최신이면(updated_at이 더 크면) Realtime 데이터 무시
            const localTime = p.updated ? new Date(p.updated).getTime() : 0;
            const remoteTime = newRecord.updated ? new Date(newRecord.updated).getTime() : 0;
            if (localTime > remoteTime) {
              console.log('🛡️ [Realtime Guard] 로컬 상태가 더 최신이므로 Realtime 업데이트 무시:', p.id);
              return p;
            }
            return { ...p, ...newRecord };
          }));
        } else if (eventType === 'DELETE') {
          setProjectsList(prev => prev.filter(p => p.id !== oldRecord.id));
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('🟢 [Realtime] projects 구독 성공');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAddCustomIp = async (category, name, description) => {
    if (isDemoMode) {
      const newIp = { id: Date.now().toString(), category, name, description, created_by: currentUser, created_at: new Date().toISOString() };
      setCustomIpDetails(prev => [...prev, newIp]);
      setGlobalIpDictionary(prev => {
        const newDict = structuredClone(prev);
        if (!newDict[category]) newDict[category] = [];
        if (!newDict[category].includes(name)) newDict[category].push(name);
        return newDict;
      });
      return true;
    }

    const { data, error } = await projectService.addCustomIp(category, name, description, currentUser);

    if (error) {
      console.error('Error adding custom IP:', error);
      showConfirm({ title: "저장 실패", message: "Custom IP 등록에 실패했습니다.", type: "danger", showCancel: false });
      return false;
    }

    if (data && data.length > 0) {
      const newIp = data[0];
      setCustomIpDetails(prev => [...prev, newIp]);
      setGlobalIpDictionary(prev => {
        const newDict = structuredClone(prev);
        if (!newDict[category]) newDict[category] = [];
        if (!newDict[category].includes(name)) newDict[category].push(name);
        return newDict;
      });
    }
    return true;
  };

  const handleEditCustomIp = async (id, updatedData) => {
    const targetIp = customIpDetails.find(ip => ip.id === id);
    if (!targetIp) return false;

    if (isDemoMode) {
      setCustomIpDetails(prev => prev.map(ip => ip.id === id ? { ...ip, ...updatedData } : ip));
      if (updatedData.name && (updatedData.name !== targetIp.name || updatedData.category !== targetIp.category)) {
        setGlobalIpDictionary(prev => {
          const newDict = structuredClone(prev);
          // Remove old
          if (newDict[targetIp.category]) {
            newDict[targetIp.category] = newDict[targetIp.category].filter(n => n !== targetIp.name);
            if (newDict[targetIp.category].length === 0) delete newDict[targetIp.category];
          }
          // Add new
          const cat = updatedData.category || targetIp.category;
          const name = updatedData.name || targetIp.name;
          if (!newDict[cat]) newDict[cat] = [];
          if (!newDict[cat].includes(name)) newDict[cat].push(name);
          return newDict;
        });
      }
      return true;
    }

    const { data, error } = await projectService.updateCustomIp(id, updatedData);

    if (error) {
      console.error('Error editing custom IP:', error);
      showConfirm({ title: "수정 실패", message: "Custom IP 수정에 실패했습니다.", type: "danger", showCancel: false });
      return false;
    }

    if (data && data.length > 0) {
      setCustomIpDetails(prev => prev.map(ip => ip.id === id ? data[0] : ip));
      if (updatedData.name && (updatedData.name !== targetIp.name || updatedData.category !== targetIp.category)) {
        setGlobalIpDictionary(prev => {
          const newDict = structuredClone(prev);
          // Remove old
          if (newDict[targetIp.category]) {
            newDict[targetIp.category] = newDict[targetIp.category].filter(n => n !== targetIp.name);
            if (newDict[targetIp.category].length === 0) delete newDict[targetIp.category];
          }
          // Add new
          const cat = updatedData.category || targetIp.category;
          const name = updatedData.name || targetIp.name;
          if (!newDict[cat]) newDict[cat] = [];
          if (!newDict[cat].includes(name)) newDict[cat].push(name);
          return newDict;
        });
      }
    }
    return true;
  };

  const handleDeleteCustomIp = async (id) => {
    const targetIp = customIpDetails.find(ip => ip.id === id);
    if (!targetIp) return false;

    if (isDemoMode) {
      setCustomIpDetails(prev => prev.filter(ip => ip.id !== id));
      setGlobalIpDictionary(prev => {
        const newDict = structuredClone(prev);
        if (newDict[targetIp.category]) {
          newDict[targetIp.category] = newDict[targetIp.category].filter(n => n !== targetIp.name);
          if (newDict[targetIp.category].length === 0) delete newDict[targetIp.category];
        }
        return newDict;
      });
      return true;
    }

    const { error } = await projectService.deleteCustomIp(id);
    if (error) {
      console.error('Error deleting custom IP:', error);
      showConfirm({ title: "삭제 실패", message: "Custom IP 삭제에 실패했습니다.", type: "danger", showCancel: false });
      return false;
    }

    setCustomIpDetails(prev => prev.filter(ip => ip.id !== id));
    setGlobalIpDictionary(prev => {
      const newDict = structuredClone(prev);
      if (newDict[targetIp.category]) {
        newDict[targetIp.category] = newDict[targetIp.category].filter(n => n !== targetIp.name);
        if (newDict[targetIp.category].length === 0) delete newDict[targetIp.category];
      }
      return newDict;
    });
    return true;
  };
  const [projectData, setProjectData] = useState(null);
  const [currentViewedRevision, setCurrentViewedRevision] = useState('');
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState('Project_Overview');
  const [rollbackCounter, setRollbackCounter] = useState(0); // 롤백 시 자식 컴포넌트 강제 리팩토링을 위한 카운터
  const [initialIpForIpIndex, setInitialIpForIpIndex] = useState(null);
  const tabs = ['Project_Overview', 'IP_Index', 'Revision_Log', 'FA_Report'];

  const LOCK_STALE_THRESHOLD_MIN = 10;
  const currentData = projectData?.revisions?.[currentViewedRevision] || {};
  const currentProjMeta = projectsList.find(p => p.id === activeProject?.id);

  // ─── [아키텍처 개선] 프로젝트 잠금 및 하트비트 로직 분리 (useProjectLock Hook) ───
  const { lockDetail, isSessionLockedByOther, lockReason, getLockDetail } = useProjectLock({
    activeProject,
    currentUser,
    projectsList,
    setProjectsList, // [V1.3.1 Hotfix] 낙관적 업데이트 지원
    isDemoMode,
    showConfirm,
    setActiveProject // [V1.3.2] 상태 리셋(forceLock 해제 및 mode 전환)을 위해 추가
  });

  const isArchived = !!lockReason || currentData?.status === 'archived';

  const [showAppExitWarning, setShowAppExitWarning] = useState(false); // 앱 종료 확인 모달 상태
  const [isGloballyEditing, setIsGloballyEditing] = useState(false);

  const isDirtyRef = useRef(false);
  const originalDataSnapshot = useRef(null);
  const executeExitRef = useRef(null);
  const isExitingAppRef = useRef(false);
  const pendingSavesRef = useRef(0);

  // 폼 입력 데이터의 수정 여부를 추적 (DB 저장 여부와 별개)
  const [isFormDirty, setIsFormDirty] = useState(false);
  const tabRef = useRef(null);
  const isFormDirtySyncRef = useRef(false);

  const handleFormDirtyChange = useCallback((dirty) => {
    setIsFormDirty(dirty);
    isFormDirtySyncRef.current = dirty;
  }, []);

  const latestDataRef = useRef(projectData);
  useEffect(() => {
    latestDataRef.current = projectData;
  }, [projectData]);

  // ─── [아키텍처 개선] 실시간 외부 변경 감지 (아카이브/삭제) ───
  useEffect(() => {
    // 로딩 중이거나 워크스페이스가 아니면 감지 건너뜀
    if (loading || viewState !== 'WORKSPACE' || !activeProject) return;

    const currentProjMeta = projectsList.find(p => p.id === activeProject.id);

    // 1. 프로젝트가 영구 삭제된 경우 (로딩 완료 후에도 없는 경우에만)
    if (!currentProjMeta) {
      showConfirm({
        title: "프로젝트 삭제됨",
        message: "현재 작업 중인 프로젝트가 다른 기기(또는 탭)에서 삭제되었습니다. 대시보드로 강제 이동합니다.",
        type: "warning",
        showCancel: false
      }).then(() => {
        if (executeExitRef.current) executeExitRef.current(); // 강제 이탈
      });
    }
    // 2. 프로젝트가 아카이브된 경우
    else if (currentProjMeta.is_archived) {
      showConfirm({
        title: "프로젝트 아카이브",
        message: "현재 작업 중인 프로젝트가 다른 기기(또는 탭)에서 보관 처리되었습니다. 대시보드로 강제 이동합니다.",
        type: "warning",
        showCancel: false
      }).then(() => {
        if (executeExitRef.current) executeExitRef.current(); // 강제 이탈
      });
    }
  }, [projectsList, activeProject, viewState, showConfirm, loading]);

  // ─── [아키텍처 개선] 프로젝트 관리 서비스 연동 ───
  const {
    handleToggleArchive,
    handlePermanentDelete,
    handleForceUnlock
  } = useProjectService({
    isDemoMode,
    setProjectsList,
    projectsList,
    activeProject,
    executeExitRef,
    showConfirm,
    REFERENCE_PROJECT_ID
  });

  // ─── [아키텍처 개선] 내보내기 관리자 연동 (Export Manager) ───
  const { handleSaveMD, handleExportProject } = useExportManager({
    activeProject,
    currentData,
    currentViewedRevision,
    projectsList,
    currentUser,
    showConfirm
  });

  // ─── [아키텍처 개선] 전역 내비게이션 가드 (Hash + PopState) ───
  useNavigationGuard({
    isAuthorized,
    viewState,
    setViewState,
    showConfirm,
    setIsGloballyEditing,
    setIsFormDirty,
    tabRef,
    isExitingAppRef,
    setShowAppExitWarning,
    isDirtyRef,
    isFormDirtySyncRef,
    executeExitRef
  });


  // login function is now provided by useAuth() context


  // ─── [아키텍체 개선] 자식 컴포넌트 리렌더링 방지를 위한 useCallback 적용 ───
  const handleEditingStateChange = useCallback((isEditing) => {
    setIsGloballyEditing(isEditing);
    if (isEditing) {
      const currentSnap = latestDataRef.current?.revisions[currentViewedRevision];
      // [보안/성능] structuredClone을 사용하여 데이터 무결성 보장 (기존 JSON 방식 대체)
      originalDataSnapshot.current = currentSnap ? structuredClone(currentSnap) : null;
      isDirtyRef.current = false;
    } else {
      isDirtyRef.current = false;
      originalDataSnapshot.current = null;
    }
  }, [currentViewedRevision]);

  // ─── [신규] 변경 사항 폐기 및 원래 상태로 복구 (Rollback) ───
  const discardProjectChanges = useCallback(() => {
    if (originalDataSnapshot.current) {
      setProjectData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          revisions: {
            ...prev.revisions,
            [currentViewedRevision]: structuredClone(originalDataSnapshot.current)
          }
        };
      });
      // [버그2 픽스] setRollbackCounter 제거: 강제 리마운트가 tabRef를 무효화시켜
      // 이후 resetForm 호출 시 Blank 화면을 유발하는 근본 원인이었음.
      // 스냅샷 데이터 복원만으로 충분히 UI가 원상 복구됨.
      originalDataSnapshot.current = null;
      isDirtyRef.current = false;
      setIsFormDirty(false);
      isFormDirtySyncRef.current = false;
    }
  }, [currentViewedRevision]);

  // ─── [신규] 명시적 저장 패턴 적용: 로컬 상태만 업데이트 (DB 저장 없음) ───
  const handleLocalUpdate = useCallback((tabName, newData, forceDirty = true) => {
    // [버그2 근본 수정] 스냅샷을 setProjectData 업데이터 내부의 prev로 캡처.
    // latestDataRef는 useEffect로 동기화되어 타이밍 문제가 있지만,
    // 업데이터의 prev는 React가 보장하는 진짜 현재 상태임.
    setProjectData(prev => {
      if (!prev) return prev;

      // 스냅샷이 없으면 지금 prev(수정 전 상태)를 원본으로 캡처
      if (!originalDataSnapshot.current) {
        const currentSnap = prev.revisions?.[currentViewedRevision];
        originalDataSnapshot.current = currentSnap ? structuredClone(currentSnap) : null;
      }

      return {
        ...prev,
        revisions: {
          ...prev.revisions,
          [currentViewedRevision]: {
            ...(prev.revisions?.[currentViewedRevision] || {}),
            [tabName]: newData
          }
        }
      };
    });

    if (forceDirty) {
      isDirtyRef.current = true;
      setIsFormDirty(true);
      isFormDirtySyncRef.current = true;
    }
  }, [currentViewedRevision]);

  const handleTabSubmit = useCallback(async (tabName, newData, clearDirty = false) => {
    if (isArchived) {
      showConfirm({
        title: "수정 불가",
        message: "잠금 처리된 차수입니다. 수정할 수 없습니다.",
        type: "warning",
        showCancel: false
      });
      return;
    }

    // [중요] 레이스 컨디션 방지: 함수 진입 즉시 펜딩 카운트 증가 (동기적)
    pendingSavesRef.current++;

    // [중요] 비동기 클로저 캡처: 비동기 실행 중 전역 상태가 바뀌어도 영향받지 않도록 모든 필요 정보 캡처
    const currentProjectId = activeProject?.id;
    const currentUserId = currentUser;
    const currentRevisionId = currentViewedRevision;

    try {
      if (!currentProjectId) {
        console.warn('⚠️ [Save Aborted] No active project ID found.');
        return;
      }

      // 1. 로컬 상태 업데이트 및 최신 데이터 캡처
      // [버그1 근본 수정] latestUpdatedData를 setProjectData 업데이터 내부에서 캡처하는 방식은
      // React 18 Concurrent Mode에서 업데이터가 지연 실행될 경우 null이 될 수 있음.
      // 대신 latestDataRef(최신 렌더 상태)를 직접 병합하여 동기적으로 구성.
      const prevData = latestDataRef.current;
      const latestUpdatedData = prevData ? {
        ...prevData,
        revisions: {
          ...prevData.revisions,
          [currentRevisionId]: {
            ...(prevData.revisions?.[currentRevisionId] || {}),
            [tabName]: newData
          }
        }
      } : null;

      // 로컬 상태도 동일하게 업데이트
      if (latestUpdatedData) {
        setProjectData(latestUpdatedData);
      }

      // 2. 비동기 DB 저장 프로세스
      if (latestUpdatedData) {
        const dt = new Date().toISOString();

        // [수정] 대시보드 동기화: Demo 모드든 Supabase 모드든 projectsList를 즉시 업데이트하여 대시보드 정합성 확보
        setProjectsList(prev => prev.map(p =>
          p.id === currentProjectId ? { ...p, project_data: latestUpdatedData, updated: dt } : p
        ));

        if (!isDemoMode) {
          // [Dual-Validation] 서버 요청 전 클라이언트 사이드 권한 1차 검증
          const currentProjMeta = projectsList.find(p => p.id === currentProjectId);
          if (!canUpdateProject(currentProjMeta, currentUserId)) {
            console.error('🚫 [Save Blocked] No ownership or project archived.');
            showConfirm({
              title: "저장 실패",
              message: "편집 권한이 없거나 아카이브된 프로젝트입니다.",
              type: "danger",
              showCancel: false
            });
            return;
          }

          // [AbortController] 이전 진행 중인 저장 요청이 있다면 취소 (Race Condition 방지)
          if (saveAbortControllerRef.current) {
            saveAbortControllerRef.current.abort();
            console.log('🛑 [Save Aborted] Previous request cancelled.');
          }
          saveAbortControllerRef.current = new AbortController();

          console.log(`💾 [Save Start] Project: ${currentProjectId}, Tab: ${tabName}, User: ${currentUserId}`);
          
          const { error, count } = await projectService.updateProjectData(
            currentProjectId, 
            latestUpdatedData, 
            dt, 
            currentUserId,
            saveAbortControllerRef.current.signal // Abort Signal 전달 (향후 서비스 확장용)
          );

          if (error) {
            console.error('❌ [Save Error] Supabase Error:', error);
          } else if (count === 0) {
            console.warn('⚠️ [Save Warning] No rows updated. Lock mismatch or RLS issue likely.');
            console.log('Current User ID used for update:', currentUserId);
          } else {
            console.log(`✅ [Save Success] Project ${currentProjectId} updated in DB.`);
          }
        }
      }

      if (clearDirty) {
        // [자동 저장용] 저장이 완료되었으므로 더티 상태를 해제하여 모달이 뜨지 않도록 함
        isDirtyRef.current = false;
        setIsFormDirty(false);
        isFormDirtySyncRef.current = false;
      } else if (isGloballyEditing) {
        // [명시적 저장용] 저장이 완료되어도 락이 걸려있는 한 글로벌 에디팅 상태 유지
        isDirtyRef.current = false; 
        setIsFormDirty(false);
        isFormDirtySyncRef.current = false;
      }
    } catch (err) {
      console.error('❌ [Unexpected Error during handleTabSubmit]:', err);
    } finally {
      // 작업 완료 후 (성공/실패 무관) 카운트 감소
      pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
    }
  }, [isArchived, isGloballyEditing, currentViewedRevision, activeProject, isDemoMode, currentUser]);

  const handleTabClick = useCallback(async (tab) => {
    if (activeTab === tab) return;

    // ── [2중 가드] 통합 경로 적용 ──
    let canProceed = true;
    const isInternalDirty = tabRef.current?.canNavigate?.() === false;

    if (isInternalDirty || (isGloballyEditing && isDirtyRef.current) || isFormDirtySyncRef.current) {
      canProceed = await showConfirm({
        title: "변경 사항을 취소하시겠습니까?",
        message: "마지막으로 저장된 데이터로 안전하게 복구됩니다.",
        confirmText: "원래 상태로 복구",
        cancelText: "계속 수정하기",
        type: "warning"
      });
    }

    if (canProceed) {
      // [버그2 최종 수정] AnimatePresence mode="sync"와 함께 적용.
      // 탭 전환(setActiveTab)을 먼저 실행하여 새 탭을 마운트하고,
      // 데이터 복원(discardProjectChanges)은 requestAnimationFrame으로
      // 다음 페인트 사이클에 분리하여 exit 중인 컴포넌트와의 충돌을 원천 차단.
      tabRef.current?.resetForm?.();
      setIsGloballyEditing(false);
      isDirtyRef.current = false;
      setIsFormDirty(false);
      isFormDirtySyncRef.current = false;
      setActiveTab(tab); // 1. 먼저 탭 전환

      // 2. 다음 페인트 사이클에 데이터 복원 (exit 애니메이션과 setProjectData 충돌 방지)
      requestAnimationFrame(() => {
        discardProjectChanges();
      });
    }
  }, [activeTab, isGloballyEditing, isFormDirty, showConfirm, discardProjectChanges]);



  const openWorkspace = async (projectId, phase, targetTab = 'Project_Overview', targetIp = null, mode = null, force = false) => {
    const proj = projectsList.find(p => p.id === projectId);
    if (!proj) return;

    if (isDemoMode) {
      console.log('🚀 [Demo Mode] Local 데이터를 사용하여 워크스페이스를 엽니다.');
      setProjectData(proj.project_data);
      setActiveProject({
        id: projectId,
        name: proj.name,
        evt: phase,
        isLatest: phase === proj.latest_evt,
        updated: proj.updated,
        mode: 'edit' // 데모 모드는 항상 편집 가능
      });
      setCurrentViewedRevision(phase);
      setActiveTab(targetTab);
      setInitialIpForIpIndex(targetIp);
      window.history.pushState({ type: 'WORKSPACE' }, '');
      setViewState('WORKSPACE');
      return;
    }

    // Supabase에서 상세 데이터 가져오기
    const { data, error } = await projectService.fetchProjectDetail(projectId);

    if (error || !data?.project_data) {
      console.error('Error fetching project data:', error);
      showConfirm({
        title: "데이터 로드 실패",
        message: "프로젝트 데이터를 불러오는 데 실패했습니다.",
        type: "danger",
        showCancel: false
      });
      return;
    }

    // [중요] 이전 상태(lockDetail)가 아닌, 방금 가져온 데이터로만 잠금 분석
    const detail = getLockDetail(data);
    let finalMode = mode;

    // [V1.3.1] 의도 기반 진입 제어 로직 (협업 중심 문구 개선)
    if (finalMode === 'edit' && detail.isLocked && !detail.isByMe && !force) {
      if (detail.isStale) {
        // [케이스 A] 정체된 잠금
        const confirmed = await showConfirm({
          title: "편집 권한 갱신 확인",
          message: `${detail.lockedBy}님이 한동안 활동이 없었습니다.\n기존 잠금을 해제하고 현재 편집 권한을 가져오시겠습니까?`,
          type: "warning",
          confirmText: "권한 가져오기",
          cancelText: "읽기 전용으로 접속"
        });

        if (confirmed) {
          openWorkspace(projectId, phase, targetTab, targetIp, 'edit', true);
        } else {
          openWorkspace(projectId, phase, targetTab, targetIp, 'readonly');
        }
        return; 
      } else {
        // [케이스 B] 활성 잠금
        const confirmed = await showConfirm({
          title: "프로젝트 편집 권한 안내",
          message: `${detail.lockedBy}님이 현재 활발히 편집 중입니다.\n지금 권한을 가져오면 상대방의 작업 내용이 저장되지 않을 수 있습니다.\n\n정말 편집 권한을 가져오시겠습니까?`,
          type: "danger",
          confirmText: "위험 감수하고 가져오기",
          cancelText: "읽기 전용으로 접속"
        });

        if (confirmed) {
          openWorkspace(projectId, phase, targetTab, targetIp, 'edit', true);
        } else {
          openWorkspace(projectId, phase, targetTab, targetIp, 'readonly');
        }
        return;
      }
    } else if (!finalMode) {
      // 모드가 지정되지 않은 경우 자동 판별
      finalMode = (detail.isLocked && !detail.isByMe && !detail.isStale) ? 'readonly' : 'edit';
    }

    setProjectData(data.project_data);
    const isLatest = String(phase).trim() === String(proj.latest_evt || 'EVT0').trim();

    setActiveProject({
      id: projectId,
      name: proj.name,
      evt: phase,
      isLatest: isLatest,
      updated: proj.updated,
      mode: finalMode,
      forceLock: force // [V1.3.1] 원자적 잠금 탈취 플래그 전달
    });

    setCurrentViewedRevision(phase);
    setActiveTab(targetTab);
    setInitialIpForIpIndex(targetIp);
    isDirtyRef.current = false;
    setIsGloballyEditing(false);
    originalDataSnapshot.current = null;

    window.history.pushState({ type: 'WORKSPACE', projectId, phase }, '', '#workspace');
    setIsFormDirty(false); 
    setViewState('WORKSPACE');
  };

  const handleNewProjectClick = () => {
    setIsNewProjectModalOpen(true);
  };

  const handleCreateProject = async (formData) => {
    const id = formData.Project_Name.trim();
    if (projectsList.find(p => p.id === id)) {
      showConfirm({
        title: "이름 중복",
        message: "이미 존재하는 프로젝트 이름(ID) 입니다.",
        type: "warning",
        showCancel: false
      });
      return;
    }

    const today = new Date().toISOString();
    const initialIpIndex = {};
    (formData.IP_Blocks || []).forEach(ip => {
      initialIpIndex[ip] = makeDefaultIpIndex(ip, 'EVT0');
    });

    const newProjData = {
      projectId: id,
      revisions: {
        "EVT0": {
          status: "draft",
          // defaultProjOverview 대신 makeBlankOverview 사용 → mock 데이터 유입 차단
          projectOverview: makeBlankOverview(formData),
          ipIndex: initialIpIndex,
          revisionLog: { initialMode: 'new', loadedIssues: [], historyBlocks: [], issues: [] },
          faReport: { faReports: [] }
        }
      }
    };

    const newProjMeta = {
      id: id,
      name: id,
      updated: today,
      latest_evt: 'EVT0',
      phases: ['EVT0'],
      is_locked: false,
      locked_by: null,
      locked_at: null,
      project_data: newProjData
    };

    if (isDemoMode) {
      console.log('🏗️ [Demo Mode] Local 상태에 새 프로젝트를 추가합니다.');
      const newProjects = [newProjMeta, ...projectsList];
      setProjectsList(newProjects);
      setIsNewProjectModalOpen(false);
      openWorkspace(id, 'EVT0');
      return;
    }

    const { error } = await projectService.createProject(newProjMeta);
    if (error) {
      console.error('Error creating project:', error);
      showConfirm({
        title: "생성 실패",
        message: "프로젝트 생성에 실패했습니다.",
        type: "danger",
        showCancel: false
      });
      return;
    }

    setProjectsList([newProjMeta, ...projectsList]);
    setIsNewProjectModalOpen(false);
    openWorkspace(id, 'EVT0');
  };



  const handleLoadProjectClick = async (file) => {
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = JSON.parse(e.target.result);

          // 기본 유효성 검사
          if (content.app !== "Mitus-IP-Web" || !content.project || !content.project.id) {
            throw new Error("유효한 Mitus-IP-Web 프로젝트 파일이 아닙니다.");
          }

          const incomingProject = content.project;
          const existingProject = projectsList.find(p => p.id === incomingProject.id);

          // 모달 오픈 (사용자에게 옵션 선택 받기)
          setImportModalData({
            project: incomingProject,
            existingProject: existingProject
          });
        } catch (err) {
          showConfirm({
            title: "가져오기 실패",
            message: "파일을 읽는 중 오류가 발생했습니다: " + err.message,
            type: "danger",
            showCancel: false
          });
        }
      };
      reader.readAsText(file);
    } catch (err) {
      console.error('File Reader Error:', err);
    }
  };



  const requestBackToDashboard = async () => {
    // [2중 가드] 탭 내부 상태 OR 전역 플래그 체크
    let canProceed = true;
    const isInternalDirty = tabRef.current?.canNavigate?.() === false;

    if (isInternalDirty || (isGloballyEditing && isDirtyRef.current) || isFormDirtySyncRef.current) {
      canProceed = await showConfirm({
        title: "변경 사항을 취소하시겠습니까?",
        message: "마지막으로 저장된 데이터로 안전하게 복구됩니다.",
        confirmText: "원래 상태로 복구",
        cancelText: "계속 수정하기",
        type: "warning"
      });
    }

    if (canProceed) {
      // [27b/Gemma4] 초기화 승인 시 전역 상태 롤백 및 컴포넌트 리마운트
      discardProjectChanges();
      tabRef.current?.resetForm?.();
      executeExit();
    }
  };

  const executeExit = useCallback(async (fromPopState = false) => {
    const curActive = activeProjectRef.current;
    const curDemo = isDemoModeRef.current;
    const curProjects = projectsListRef.current;

    if (curActive && !curDemo) {
      // [레이스 컨디션 방지] 진행 중인 저장이 있다면 최대 2초간 대기
      let retryCount = 0;
      while (pendingSavesRef.current > 0 && retryCount < 20) {
        console.log(`⏳ [Exit Guard] Waiting for pending saves... (${retryCount + 1}/20)`);
        await new Promise(resolve => setTimeout(resolve, 100));
        retryCount++;
      }

      // [Bug #3 Fix] 명시적 소유자(currentUser) 전달로 본인의 잠금 확실히 해제
      await projectService.setProjectLock(curActive.id, false, currentUser);
    }

    if (!fromPopState) {
      // 버튼으로 나가는 경우 히스토리를 한 칸 뒤(#dashboard)로 돌림
      isExitingAppRef.current = true; // [추가] 이탈 프로세스 시작 플래그 설정 (중복 가드 방지)
      window.history.back();
    } else {
      // popstate로 인해 이미 URL이 바뀌어 들어온 경우, 현재 위치를 #dashboard로 명시적 고정
      window.history.replaceState({ type: 'DASHBOARD' }, '', '#dashboard');
    }

    setShowAppExitWarning(false);
    setViewState('DASHBOARD');
    setActiveProject(null);
    setProjectData(null);
    setCurrentViewedRevision('');
    setIsGloballyEditing(false);
    isDirtyRef.current = false;
    setIsFormDirty(false);
    isFormDirtySyncRef.current = false; // 확실한 초기화
    originalDataSnapshot.current = null;
  }, [currentUser]);

  useEffect(() => {
    executeExitRef.current = executeExit;
  }, [executeExit]);

  const handleExitWithSave = () => {
    executeExit();
  };

  const handleExitWithDiscard = async () => {
    setIsFormDirty(false);
    isFormDirtySyncRef.current = false; // 폐기 시 초기화
    if (originalDataSnapshot.current) {
      const snapToRestore = originalDataSnapshot.current;
      const curActive = activeProjectRef.current;

      // 1. 로컬 상태 복구
      setProjectData(prev => ({
        ...prev,
        revisions: {
          ...prev.revisions,
          [currentViewedRevision]: snapToRestore
        }
      }));

      // 2. 데이터베이스(Supabase) 롤백
      if (curActive && !isDemoModeRef.current) {
        try {
          // 전체 프로젝트 데이터를 가져와서 해당 차수만 스냅샷으로 교체
          const { data: latestProj } = await projectService.fetchProjectDetail(curActive.id);

          if (latestProj) {
            const updatedData = {
              ...latestProj.project_data,
              revisions: {
                ...latestProj.project_data.revisions,
                [currentViewedRevision]: snapToRestore
              }
            };

            await projectService.updateProject(curActive.id, { project_data: updatedData }, currentUser);

            console.log('↩️ [Rollback] Database successfully reverted to original snapshot');
          }
        } catch (error) {
          console.error('❌ [Rollback] Failed to revert database:', error);
        }
      }
    }
    executeExit();
  };

  // ─── [아키텍처 개선] 분리된 순수 함수를 호출하여 로직 간소화 ───
  const handleGenerateNextRevision = useCallback(async (forcedProjectData = null, skipConfirm = false) => {
    // If forcedProjectData is provided (e.g. immediately after locking), use it to bypass stale closure
    const targetData = forcedProjectData ? (forcedProjectData.revisions?.[currentViewedRevision] || {}) : currentData;

    if (!targetData || targetData.status !== 'archived') {
      showConfirm({
        title: "파생 불가",
        message: "현재 최신 차수가 Lock(Archived) 상태여야 다음 차수를 생성할 수 있습니다.",
        type: "warning",
        showCancel: false
      });
      return;
    }

    const faReports = targetData?.faReport?.faReports || [];
    const unlinkedFAs = faReports.filter(f => {
      if (f.isLinkedToLog) return false;
      if (currentViewedRevision === 'EVT0' && f.disposition === 'Revision') return false;
      return true;
    });

    if (unlinkedFAs.length > 0) {
      showConfirm({
        title: "미결 이슈 존재",
        message: "FA 리포트에 아직 Revision Log로 가져오지 않은 미결 이슈가 있습니다. 모든 FA 이슈를 Log에 반영해야 다음 차수를 생성할 수 있습니다.",
        type: "warning",
        showCancel: false
      });
      return;
    }

    let confirmNext = true;
    if (!skipConfirm) {
      confirmNext = await showConfirm({
        title: "차수 파생 (Revision Up)",
        message: `현재 차수(${currentViewedRevision})를 보존하고 다음 차수를 파생하시겠습니까?`,
        type: "info",
        confirmText: "파생 실행"
      });
    }

    if (!confirmNext) return;

    try {
      const { nextEvtName, newRevisionData, newPhases } = deriveNextRevisionData(targetData, currentViewedRevision, activeProject, projectsList);

      const updatedProjectData = {
        ...(forcedProjectData || projectData),
        revisions: {
          ...((forcedProjectData || projectData).revisions),
          [nextEvtName]: newRevisionData
        }
      };

      setProjectData(updatedProjectData);

      if (isDemoMode) {
        setProjectsList(prev => prev.map(p =>
          p.id === activeProject.id
            ? { ...p, latest_evt: nextEvtName, phases: newPhases, updated: new Date().toISOString(), project_data: updatedProjectData }
            : p
        ));
      } else {
        await projectService.updateProject(activeProject.id, {
          latest_evt: nextEvtName,
          phases: newPhases,
          project_data: updatedProjectData,
          updated: new Date().toISOString()
        }, currentUser);

        setProjectsList(prev => prev.map(p =>
          p.id === activeProject.id
            ? { ...p, latest_evt: nextEvtName, phases: newPhases, updated: new Date().toISOString() }
            : p
        ));
      }

      setActiveProject(prev => ({ ...prev, evt: nextEvtName, isLatest: true }));
      setCurrentViewedRevision(nextEvtName);
      setActiveTab('Revision_Log');
    } catch (err) {
      showConfirm({
        title: "파생 오류",
        message: "파생 중 오류가 발생했습니다: " + err.message,
        type: "danger",
        showCancel: false
      });
      console.error(err);
    }
  }, [currentData, currentViewedRevision, activeProject, projectsList, isDemoMode, projectData, showConfirm]);

  // ─── 레퍼런스 프로젝트 보호 ───

  /** SM5718을 mockData 원본 데이터로 즉시 복구 */
  const handleResetReference = async () => {
    const confirmed = await showConfirm({
      title: "레퍼런스 복구",
      message: `[레퍼런스 복구] "${REFERENCE_PROJECT_ID}" 프로젝트를 초기 시드 데이터로 완전히 덮어쓰시겠습니까?\n\n현재 수정 내용은 모두 사라지며 복구할 수 없습니다.`,
      type: "danger",
      confirmText: "복구 실행"
    });
    if (!confirmed) return;
    try {
      const { initialProjectData } = await import('./data/mockData');
      const resetPayload = {
        id: REFERENCE_PROJECT_ID,
        name: 'SM5718',
        latest_evt: 'EVT2',
        phases: ['EVT1', 'EVT2'],
        updated: new Date().toISOString(),
        is_archived: false,
        is_locked: false,
        locked_by: null,
        locked_at: null,
        project_data: initialProjectData,
      };
      if (isDemoMode) {
        setProjectsList(prev => {
          const exists = prev.find(p => p.id === REFERENCE_PROJECT_ID);
          if (exists) {
            return prev.map(p => p.id === REFERENCE_PROJECT_ID ? { ...p, ...resetPayload } : p);
          }
          return [resetPayload, ...prev];
        });
      } else {
        const { error } = await projectService.upsertProject(resetPayload);
        if (error) throw error;
        setProjectsList(prev => {
          const exists = prev.find(p => p.id === REFERENCE_PROJECT_ID);
          if (exists) {
            return prev.map(p => p.id === REFERENCE_PROJECT_ID ? { ...p, ...resetPayload } : p);
          }
          return [resetPayload, ...prev];
        });
      }
      // 만약 현재 해당 프로젝트를 워크스페이스에서 보고 있다면 데이터도 갱신
      if (activeProject?.id === REFERENCE_PROJECT_ID) {
        setProjectData(initialProjectData);
        setCurrentViewedRevision('EVT2');
      }
      showConfirm({
        title: "복구 완료",
        message: '레퍼런스 프로젝트가 초기 상태로 복구되었습니다.',
        type: "success",
        showCancel: false
      });
    } catch (err) {
      showConfirm({
        title: "복구 실패",
        message: '복구 실패: ' + err.message,
        type: "danger",
        showCancel: false
      });
      console.error(err);
    }
  };

  const handleDebugRollback = async () => {
    if (!activeProject || !activeProject.isLatest) {
      showConfirm({
        title: "롤백 불가",
        message: "롤백할 수 없는 상태입니다 (최신 차수가 아님).",
        type: "warning",
        showCancel: false
      });
      return;
    }

    const confirmed = await showConfirm({
      title: "데이터 리셋 (Rollback)",
      message: `[디버그] 정말 ${activeProject.evt} 차수를 삭제하고 이전 차수로 롤백하시겠습니까?`,
      type: "danger",
      confirmText: "롤백 실행"
    });

    if (confirmed) {
      try {
        // 1. 현재 단계 및 전체 차수 목록 확보 (데이터 기반 정렬)
        const currentPhase = activeProject.evt;
        const allPhases = Object.keys(projectData.revisions).sort((a, b) => {
          return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });
        
        const currentIndex = allPhases.indexOf(currentPhase);

        // [Guard 1] projectData.revisions에 현재 차수 키가 없는 경우 (indexOf = -1)
        if (currentIndex === -1) {
          console.error('[Rollback] currentPhase not found in allPhases:', currentPhase, allPhases);
          showConfirm({
            title: "롤백 오류",
            message: `현재 차수(${currentPhase})를 차수 목록에서 찾을 수 없습니다. 새로고침 후 다시 시도해주세요.`,
            type: "danger",
            showCancel: false
          });
          return;
        }

        // [Guard 2] 이전 단계가 없는 경우 (EVT0 = index 0) 롤백 불가
        if (currentIndex === 0) {
          showConfirm({
            title: "롤백 불가",
            message: `현재 차수(${currentPhase})가 이 프로젝트의 최초 차수이므로 더 이상 롤백할 수 없습니다.\n롤백은 이전 차수 데이터가 존재할 때만 가능합니다.`,
            type: "warning",
            showCancel: false
          });
          return;
        }

        const previousPhase = allPhases[currentIndex - 1];
        const newPhases = allPhases.slice(0, currentIndex);

        // 2. 새로운 project_data 계산 (불변성 보장을 위한 Deep Copy)
        const updatedProjectData = structuredClone(projectData);
        delete updatedProjectData.revisions[currentPhase];
        if (updatedProjectData.revisions[previousPhase]) {
          updatedProjectData.revisions[previousPhase].status = 'draft';
        }

        // 3. DB 업데이트 (실제 환경일 때만)
        if (!isDemoMode) {
          await projectService.updateProject(activeProject.id, {
            phases: newPhases,
            latest_evt: previousPhase,
            project_data: updatedProjectData,
            updated: new Date().toISOString()
          }, currentUser);
        }

        // 4. 로컬 상태 원자적 업데이트
        setProjectsList(prev => prev.map(p => {
          if (p.id === activeProject.id) {
            return {
              ...p,
              phases: newPhases,
              latest_evt: previousPhase,
              updated: new Date().toISOString(),
              project_data: updatedProjectData 
            };
          }
          return p;
        }));

        setProjectData(updatedProjectData);
        setActiveProject(prev => ({ 
          ...prev, 
          evt: previousPhase, 
          phases: newPhases, // 메타데이터 동기화 (CRITICAL)
          isLatest: true 
        }));
        setCurrentViewedRevision(previousPhase);
        
        // 5. 클린업 및 리프레시 (UI 강제 리마운트 트리거)
        setRollbackCounter(prev => prev + 1);
        isDirtyRef.current = false;
        setIsFormDirty(false);

        ['Project_Overview', 'IP_Index', 'Revision_Log', 'FA_Report'].forEach(tab => {
          localStorage.removeItem(`mitus_autosave_${activeProject.id}_${tab}`);
        });

        showConfirm({ 
          title: "롤백 완료", 
          message: `[DEBUG] ${currentPhase}가 삭제되었습니다. 이제 프로젝트가 ${previousPhase} 단계의 'Draft' 상태로 안전하게 복구되었습니다.`, 
          type: "success", 
          showCancel: false 
        });

      } catch (err) {
        console.error("Rollback Critical Error:", err);
        showConfirm({
          title: "롤백 실패",
          message: "롤백 처리 중 오류가 발생했습니다: " + err.message,
          type: "danger",
          showCancel: false
        });
      }
    }
  };

  const handleGlobalLock = async () => {
    // 1. 미저장 데이터 체크 및 자동 저장 안내
    if (isDirtyRef.current || isGloballyEditing) {
      const confirmSave = await showConfirm({
        title: "자동 저장 확인",
        message: "수정 중인 내용이 있습니다. 마감 전 자동으로 저장하고 진행하시겠습니까?",
        type: "info",
        confirmText: "저장 후 진행",
        cancelText: "저장 안 함"
      });
      if (!confirmSave) return;
      // TODO: 현재 탭의 저장 로직을 강제로 호출하거나, 전체 데이터를 한번에 저장하는 로직 필요
      // 여기서는 일단 경고로 남겨두고, 사용자가 수동 저장하게 유도하거나 handleTabSubmit을 활용
    }

    // 2. 전제 조건 검사 (Checklist 생성)
    const checklist = [];

    // [FA Report 체크]
    const faReports = currentData?.faReport?.faReports || [];
    const unlinkedFAs = faReports.filter(f => {
      if (f.isLinkedToLog) return false;
      // EVT0에서 Revision 판정은 예외 (다음 차수에서 처리)
      if (currentViewedRevision === 'EVT0' && f.disposition === 'Revision') return false;
      return true;
    });
    checklist.push({
      title: "FA 리포트 연동 확인",
      stage: currentViewedRevision,
      isPassed: unlinkedFAs.length === 0,
      description: "발생된 모든 FA 리포트가 Revision Log에 연동되어야 합니다.",
      pendingItems: unlinkedFAs.map(f => f.faId)
    });

    // [Revision Log 체크]
    const revLog = currentData.revisionLog;
    const issues = revLog?.issues || [];
    const loaded = revLog?.loadedIssues || [];

    const evaluatedIds = issues.filter(i => i.entryMode === 'eval').map(i => i.targetIssue);
    const missingEvals = loaded.filter(id => !evaluatedIds.includes(id));
    checklist.push({
      title: "이전 차수 수정 평가 완료",
      stage: currentViewedRevision,
      isPassed: missingEvals.length === 0,
      description: "이전 차수에서 넘어온 모든 이슈에 대한 평가(eval)가 기록되어야 합니다.",
      pendingItems: missingEvals
    });

    const unmanagedCarryovers = issues.filter(i => i.entryMode === 'carryover' && i.carryoverStatus === 'OPEN');
    checklist.push({
      title: "이월 이슈 조치 확정",
      stage: currentViewedRevision,
      isPassed: unmanagedCarryovers.length === 0,
      description: "자동 이월된 이슈들에 대한 명확한 조치 방향(Keep Open, Close 등)이 결정되어야 합니다.",
      pendingItems: unmanagedCarryovers.map(i => i.targetIssue)
    });

    setLockChecklist(checklist);
    setLockModalOpen(true);
  };

  const handleFinalConfirmLock = async () => {
    setLockModalOpen(false);

    const updatedProjectData = {
      ...projectData,
      revisions: {
        ...projectData.revisions,
        [currentViewedRevision]: {
          ...projectData.revisions[currentViewedRevision],
          status: 'archived'
        }
      }
    };

    setProjectData(updatedProjectData);
    if (!isDemoMode) {
      await projectService.updateProject(activeProject.id, { project_data: updatedProjectData }, currentUser);
    }

    // 마감 성공 알림 및 다음 차수 생성 유도
    const confirmed = await showConfirm({
      title: "차수 확정 완료",
      message: "현재 차수가 성공적으로 확정되었습니다.\n지금 바로 다음 차수(Revision-up)를 생성하시겠습니까?",
      type: "success",
      confirmText: "지금 생성",
      cancelText: "나중에"
    });

    if (confirmed) {
      handleGenerateNextRevision(updatedProjectData, true);
    }
  };

  const handleGlobalUnlock = async () => {
    const confirmed = await showConfirm({
      title: "차수 잠금 해제 (Unlock)",
      message: "잠긴 문서의 Lock을 해제하고 다시 편집(Draft) 상태로 되돌립니다.\n\n[주의: 이미 다음 차수가 파생된 상태에서 과거 차수를 수정하면 데이터 정합성에 문제가 생길 수 있습니다.]\n정말 잠금을 해제하시겠습니까?",
      type: "warning",
      confirmText: "잠금 해제"
    });

    if (confirmed) {
      const updatedProjectData = {
        ...projectData,
        revisions: {
          ...projectData.revisions,
          [currentViewedRevision]: {
            ...projectData.revisions[currentViewedRevision],
            status: "draft"
          }
        }
      };

      setProjectData(updatedProjectData);
      if (!isDemoMode) {
        await projectService.updateProject(activeProject.id, { project_data: updatedProjectData }, currentUser);
      }
      showConfirm({ title: "해제 완료", message: "잠금이 해제되어 다시 편집할 수 있습니다.", type: "success", showCancel: false });
    }
  };




  const handleImportConfirm = async (config) => {
    const { mode, useBackup, selectedRevisions, revActions, newId, newName } = config;
    const { project: incoming } = importModalData;

    try {
      setLoading(true);

      // 1. 가져올 데이터 필터링
      const filteredRevisions = {};
      selectedRevisions.forEach(rev => {
        filteredRevisions[rev] = incoming.project_data.revisions[rev];
      });

      let projectToSave = {
        ...incoming,
        project_data: {
          ...incoming.project_data,
          revisions: filteredRevisions
        },
        updated: new Date().toISOString(),
        is_locked: false,
        locked_by: null,
        locked_at: null
      };

      // ─── [신규] Deep Replace 로직 (신규 프로젝트 시 내부 ID/이름 치환) ───
      if (mode === 'new') {
        const oldId = incoming.id;
        const oldName = incoming.name || incoming.id;

        // JSON 문자열 치환 방식으로 가장 확실하게 전체 교체
        let jsonStr = JSON.stringify(projectToSave);

        // ID 치환 (전체 일치하는 경우만 바꾸는 게 좋지만, 여기서는 범용적으로 처리)
        // 주의: 너무 짧은 ID는 위험할 수 있으나 프로젝트 ID 특성상 보통 고유함
        if (oldId !== newId) {
          jsonStr = jsonStr.split(`"${oldId}"`).join(`"${newId}"`);
        }
        // 이름 치환
        if (oldName !== newName) {
          jsonStr = jsonStr.split(`"${oldName}"`).join(`"${newName}"`);
          // Overview 내부의 Project_Name 등 객체 값들도 치환 (따옴표 없는 경우 대응)
          jsonStr = jsonStr.split(`: "${oldName}"`).join(`: "${newName}"`);
        }

        projectToSave = JSON.parse(jsonStr);

        // 상위 레벨 최종 확정
        projectToSave.id = newId;
        projectToSave.name = newName;
      }

      if (isDemoMode) {
        if (mode === 'new') {
          setProjectsList(prev => [projectToSave, ...prev]);
        }
        else if (mode === 'merge') {
          setProjectsList(prev => {
            // [Bug #1 Fix] 백업 프로젝트를 별도로 수집하기 위한 배열
            const backupEntries = [];

            const updatedList = prev.map(p => {
              if (p.id !== incoming.id) return p;

              // 🛡️ 안정성: 백업 생성 (Snapshot) - Factory Function 사용
              if (useBackup) {
                const backupProject = generateBackupProject(p);
                backupEntries.push(backupProject);
              }

              // [Bug #1 Fix] phases 동기화를 위해 최종 추가/변경 키를 모두 추적
              const merged = { ...p.project_data.revisions };
              const phasesToAdd = [];

              selectedRevisions.forEach(rev => {
                const action = revActions[rev];
                if (action === 'overwrite') {
                  merged[rev] = filteredRevisions[rev];
                  phasesToAdd.push(rev); // overwrite도 phases에 포함 보장
                } else {
                  const targetKey = merged[rev] ? rev + '_Imported' : rev;
                  merged[targetKey] = filteredRevisions[rev];
                  phasesToAdd.push(targetKey); // ADD AS COPY 키 포함
                }
              });

              // [Bug #1 Fix] phases 배열을 revisions 키와 동기화 (중복 제거)
              const updatedPhases = Array.from(new Set([...p.phases, ...phasesToAdd]));

              return {
                ...p,
                phases: updatedPhases,
                project_data: { ...p.project_data, revisions: merged },
                updated: new Date().toISOString()
              };
            });

            // 백업 프로젝트가 있으면 리스트 맨 앞에 추가
            return backupEntries.length > 0 ? [...backupEntries, ...updatedList] : updatedList;
          });
        }
      } else {
        // ─── [Real Mode] ───
        if (mode === 'new') {
          const { error } = await projectService.createProject(projectToSave);
          if (error) throw error;
        }
        else if (mode === 'merge') {
          const existing = projectsList.find(p => p.id === incoming.id);

          // 1. 전체 프로젝트 백업 (Snapshot) - Factory Function 사용
          if (useBackup && existing) {
            const backupProject = generateBackupProject(existing);
            const { error: bakError } = await projectService.createProject(backupProject);
            if (bakError) console.error('Backup failed, but continuing:', bakError);
          }

          // 2. [Bug #1 Fix] 데이터 병합 + phases 동기화
          const mergedRevisions = { ...existing.project_data.revisions };
          const phasesToAdd = [];

          selectedRevisions.forEach(rev => {
            const action = revActions[rev];
            if (action === 'overwrite') {
              mergedRevisions[rev] = filteredRevisions[rev];
              phasesToAdd.push(rev); // overwrite도 phases에 포함 보장
            } else {
              const targetKey = mergedRevisions[rev] ? rev + '_Imported' : rev;
              mergedRevisions[targetKey] = filteredRevisions[rev];
              phasesToAdd.push(targetKey); // ADD AS COPY 키 포함
            }
          });

          // [Bug #1 Fix] phases 배열 업데이트 (중복 제거)
          const updatedPhases = Array.from(new Set([...existing.phases, ...phasesToAdd]));

          // 3. [27b 권고] Optimistic Update: API 호출 전 로컬 상태 즉시 반영
          setProjectsList(prev => prev.map(p => p.id === incoming.id ? {
            ...p,
            phases: updatedPhases,
            project_data: { ...existing.project_data, revisions: mergedRevisions },
            updated: new Date().toISOString()
          } : p));

          // 4. DB 저장 (phases 포함)
          const { error } = await projectService.updateProject(incoming.id, {
            phases: updatedPhases,
            project_data: { ...existing.project_data, revisions: mergedRevisions },
            updated: new Date().toISOString()
          }, currentUser);

          // 5. [27b 권고] DB 실패 시 롤백 (잠금 권한 없음 포함)
          if (error) {
            setProjectsList(prev => prev.map(p => p.id === incoming.id ? existing : p));
            throw error;
          }
        }
      }

      setImportModalData(null);
      showConfirm({ title: "가져오기 완료", message: "프로젝트 데이터를 성공적으로 처리했습니다.", type: "success", showCancel: false });
    } catch (err) {
      showConfirm({ title: "가져오기 실패", message: "데이터 저장 중 오류가 발생했습니다: " + err.message, type: "danger", showCancel: false });
    } finally {
      setLoading(false);
    }
  };

  const handleManageConfirm = async (config) => {
    const { mode, project } = manageModalData;
    const { newId, newName, selectedRevisions } = config;

    try {
      setLoading(true);

      const processProjectData = (p, targetId, targetName) => {
        const oldId = p.id;
        const oldName = p.name || p.id;
        let jsonStr = JSON.stringify(p);
        if (oldId !== targetId) jsonStr = jsonStr.split(`"${oldId}"`).join(`"${targetId}"`);
        if (oldName !== targetName) {
          jsonStr = jsonStr.split(`"${oldName}"`).join(`"${targetName}"`);
          jsonStr = jsonStr.split(`: "${oldName}"`).join(`: "${targetName}"`);
        }
        const processed = JSON.parse(jsonStr);
        processed.id = targetId;
        processed.name = targetName;
        return processed;
      };

      if (mode === 'rename') {
        const updatedProject = processProjectData(project, newId, newName);
        updatedProject.updated = new Date().toISOString();

        if (isDemoMode) {
          setProjectsList(prev => prev.map(p => p.id === project.id ? updatedProject : p));
        } else {
          if (project.id !== newId) {
            await projectService.deleteProject(project.id);
            const { error } = await projectService.createProject(updatedProject);
            if (error) throw error;
          } else {
            const { error } = await projectService.updateProject(project.id, updatedProject);
            if (error) throw error;
          }
        }
      }
      else if (mode === 'copy') {
        const filteredRevisions = {};
        selectedRevisions.forEach(rev => {
          filteredRevisions[rev] = project.project_data.revisions[rev];
        });
        const projectToClone = {
          ...project,
          project_data: { ...project.project_data, revisions: filteredRevisions }
        };
        const newProject = processProjectData(projectToClone, newId, newName);
        newProject.updated = new Date().toISOString();
        newProject.is_locked = false;
        newProject.locked_by = null;
        newProject.locked_at = null;

        if (isDemoMode) {
          setProjectsList(prev => [newProject, ...prev]);
        } else {
          const { error } = await projectService.createProject(newProject);
          if (error) throw error;
        }
      }

      setManageModalData(null);
      showConfirm({
        title: mode === 'rename' ? "이름 변경 완료" : "프로젝트 복제 완료",
        message: "성공적으로 처리되었습니다.",
        type: "success",
        showCancel: false
      });
      fetchProjects();
    } catch (err) {
      showConfirm({ title: "오류 발생", message: err.message, type: "danger", showCancel: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100">
      {!isAuthorized ? (
        <AccessGate onAuthorized={login} />
      ) : (
        <>
          {isDemoMode && (
            <div className="bg-amber-500 text-white text-[10px] font-bold py-1 px-4 flex justify-between items-center animate-pulse shadow-md sticky top-0 z-[100]">
              <div className="flex items-center gap-2">
                <AlertCircle size={12} />
                <span>DEMO MODE: DATABASE CONNECTION FAILED. DATA IS BEING SAVED LOCALLY FOR THIS SESSION.</span>
              </div>
              <button onClick={() => setIsDemoMode(false)} className="hover:underline opacity-80">Close</button>
            </div>
          )}

          {loading && (
            <div className="fixed inset-0 flex items-center justify-center bg-white/80 z-[100] backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="font-extrabold text-slate-600 animate-pulse text-lg">Cloud 데이터 동기화 중...</p>
              </div>
            </div>
          )}
          {viewState === 'DASHBOARD' && (
            <>
              <Dashboard
                projects={projectsList}
                isDemoMode={isDemoMode}
                isDbConnected={isDbConnected}
                referenceProjectId={REFERENCE_PROJECT_ID}
                handleNewProject={handleNewProjectClick}
                handleLoadProjectClick={handleLoadProjectClick}
                openWorkspace={openWorkspace}
                handleToggleArchive={handleToggleArchive}
                handlePermanentDelete={handlePermanentDelete}
                handleResetReference={handleResetReference}
                handleForceUnlock={(pid) => handleForceUnlock(pid, () => {
                  // 탈취 성공 시 본인 세션이 해당 프로젝트라면 편집 모드로 승격
                  setActiveProject(prev => (prev?.id === pid) ? { ...prev, mode: 'edit', forceLock: true } : prev);
                })}
                globalIpDictionary={globalIpDictionary}
                customIpDetails={customIpDetails}
                handleEditCustomIp={handleEditCustomIp}
                handleDeleteCustomIp={handleDeleteCustomIp}
                handleAddCustomIp={handleAddCustomIp}
                handleExportProject={handleExportProject}
                onManageProject={(mode, project) => setManageModalData({ mode, project })}
              />
              {isNewProjectModalOpen && (
                <NewProjectModal
                  onClose={() => setIsNewProjectModalOpen(false)}
                  onCreate={handleCreateProject}
                />
              )}

              {importModalData && (
                <ImportModal
                  data={importModalData}
                  onClose={() => setImportModalData(null)}
                  onConfirm={handleImportConfirm}
                />
              )}

              {manageModalData && (
                <ProjectManageModal
                  mode={manageModalData.mode}
                  project={manageModalData.project}
                  existingIds={projectsList.map(p => p.id)}
                  onClose={() => setManageModalData(null)}
                  onConfirm={handleManageConfirm}
                />
              )}
            </>
          )}

          {viewState === 'WORKSPACE' && activeProject && projectData && (
            <WorkspaceView
              // Data Props
              activeProject={activeProject}
              projectData={projectData}
              currentData={currentData}
              isDirtyRef={isDirtyRef}
              isArchived={isArchived}
              isSessionLockedByOther={isSessionLockedByOther}
              currentProjMeta={currentProjMeta}
              lockDetail={lockDetail}
              tabs={tabs}
              activeTab={activeTab}
              rollbackCounter={rollbackCounter}
              currentViewedRevision={currentViewedRevision}
              lockReason={lockReason}
              globalIpDictionary={globalIpDictionary}
              initialIpForIpIndex={initialIpForIpIndex}
              tabRef={tabRef}
              isFormDirty={isFormDirty}

              // Handler Props
              requestBackToDashboard={requestBackToDashboard}
              handleGlobalLock={handleGlobalLock}
              handleGlobalUnlock={handleGlobalUnlock}
              handleSaveMD={handleSaveMD}
              handleGenerateNextRevision={handleGenerateNextRevision}
              handleDebugRollback={handleDebugRollback}
              handleTabClick={handleTabClick}
              handleTabSubmit={handleTabSubmit}
              handleLocalUpdate={handleLocalUpdate}
              handleEditingStateChange={handleEditingStateChange}
              handleForceUnlock={(pid) => handleForceUnlock(pid, () => {
                // 내부 탈취 성공 시 본인 세션을 즉시 편집 모드로 승격하여 useProjectLock 활성화
                setActiveProject(prev => (prev?.id === pid) ? { ...prev, mode: 'edit', forceLock: true } : prev);
              })}
              handleAddCustomIp={handleAddCustomIp}
              handleFormDirtyChange={handleFormDirtyChange}
              showConfirm={showConfirm}
            />
          )}
        </>
      )}



      <LockChecklistModal
        isOpen={lockModalOpen}
        onClose={() => setLockModalOpen(false)}
        checklist={lockChecklist}
        onConfirm={handleFinalConfirmLock}
      />

      {/* ─── 모달 3: 대시보드에서 앱 종료 확인 ─── */}
      <AppExitModal
        isOpen={showAppExitWarning}
        onClose={() => setShowAppExitWarning(false)}
        onConfirm={() => {
          isExitingAppRef.current = true;
          setShowAppExitWarning(false);
          window.history.go(-2);
        }}
      />

    </div>
  );
}

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}