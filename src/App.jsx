import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { initialProjectData, defaultProjOverview, makeBlankOverview, makeDefaultIpIndex } from './data/mockData';
import Dashboard from './components/Dashboard';
import ProjectOverviewTab from './components/tabs/ProjectOverviewTab';
import IpIndexTab from './components/tabs/IpIndexTab';
import RevisionLogTab from './components/tabs/RevisionLogTab';
import FaReportTab from './components/tabs/FaReportTab';
import NewProjectModal from './components/NewProjectModal';
import { ArrowLeft, Save as SaveIcon, Download, ChevronsRight, Lock as LockIcon, AlertCircle } from 'lucide-react';
import JSZip from 'jszip';
import { getOverviewMD, getIpIndexMD, getRevLogMD, getFaReportMD } from './utils/exportMarkdown';

// ─── [아키텍처 개선] 비즈니스 로직 순수 함수로 분리 (Fat Component 방지) ───
const deriveNextRevisionData = (currentData, currentViewedRevision, activeProject, projectsList) => {
  const evtNumMatch = currentViewedRevision.match(/\d+$/);
  const nextEvtNum = evtNumMatch ? parseInt(evtNumMatch[0]) + 1 : 1;
  const nextEvtName = currentViewedRevision.replace(/\d+$/, '') + nextEvtNum;

  const projMeta = projectsList.find(p => p.id === activeProject.id);
  const currentPhases = projMeta ? projMeta.phases : (activeProject.phases || []);

  if (currentPhases.includes(nextEvtName)) {
    throw new Error("다음 차수가 이미 존재합니다.");
  }

  const prevRevLog = currentData.revisionLog || {};
  const prevLogIssues = prevRevLog.issues || [];
  const historyBlocks = prevRevLog.historyBlocks || [];

  const allChronological = [...historyBlocks.flatMap(b => b.issues || []), ...prevLogIssues].filter(Boolean);
  const latestIssueStates = {};
  allChronological.forEach(item => {
    const id = item.entryMode === 'new' ? `${item.ipBlock}.${activeProject.id}.${item.issueNum}` : item.targetIssue;
    if (!id) return;
    latestIssueStates[id] = item;
  });

  const loadedIssuesIDs = [];
  const carryOverIssues = [];

  Object.entries(latestIssueStates).forEach(([issueId, st]) => {
    const disposition = st.entryMode === 'eval' && st.assessment === 'Fixed' ? 'Fixed' : (st.disposition || 'Revision');
    const isFixedOrClosed = disposition === 'Fixed' || disposition === 'Acceptable' || disposition === 'Waived';

    if (isFixedOrClosed) return;

    if (disposition === 'Revision') {
      loadedIssuesIDs.push(issueId);
    } else {
      carryOverIssues.push({
        ...st,
        id: Date.now() + Math.random(),
        entryMode: 'carryover',
        carryoverStatus: 'OPEN',
        targetIssue: issueId,
      });
    }
  });

  const newRevisionLog = {
    initialMode: 'eval',
    loadedIssues: loadedIssuesIDs,
    issues: carryOverIssues,
    historyBlocks: [
      ...historyBlocks,
      {
        stageName: currentViewedRevision,
        issues: prevLogIssues
      }
    ]
  };

  const prevFaReports = currentData.faReport?.faReports || [];
  // 이전 차수에서 Revision 판정을 받아 연동 대기 중인(isLinkedToLog === false) FA 리포트를 다음 차수로 자동 이월
  const carryOverFaReports = prevFaReports.filter(f => !f.isLinkedToLog && f.disposition === 'Revision');
  const newFaReport = { faReports: carryOverFaReports };

  const newRevisionData = {
    status: "draft",
    projectOverview: JSON.parse(JSON.stringify(currentData.projectOverview)),
    ipIndex: JSON.parse(JSON.stringify(currentData.ipIndex)),
    revisionLog: newRevisionLog,
    faReport: newFaReport
  };

  const newPhases = projMeta ? [...projMeta.phases, nextEvtName] : [nextEvtName];

  return { nextEvtName, newRevisionData, newPhases };
};

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
      return <div style={{padding: 20, color: 'red', background: '#ffebee', whiteSpace: 'pre-wrap'}}>{this.state.errorStr}</div>;
    }
    return this.props.children;
  }
}

function App() {
  const [viewState, setViewState] = useState('DASHBOARD');
  const [currentUser, setCurrentUser] = useState(() => {
    let savedUser = localStorage.getItem('mitus_current_user');
    if (!savedUser) {
      savedUser = `User_${Math.floor(10000 + Math.random() * 90000)}`;
      localStorage.setItem('mitus_current_user', savedUser);
    }
    return savedUser;
  });

  const [projectsList, setProjectsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isDbConnected, setIsDbConnected] = useState(false); // 실제 DB 연결 상태

  // ─── [Supabase] 초기 프로젝트 목록 로드 ───
  useEffect(() => {
    async function fetchProjects() {
      setLoading(true);
      console.log('🔍 Supabase에서 프로젝트 목록을 불러오는 중...');
      
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, latest_evt, phases, updated, is_locked, locked_by, locked_at, is_archived')
        .order('updated', { ascending: false });

      if (error) {
        console.error('❌ Supabase Fetch Error:', error);
        
        // [긴급 대응] 접속 실패 시 데모 데이터 로드
        if (error.message === 'Failed to fetch' || !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('your-project-id')) {
          console.warn('⚠️ Supabase 연결이 설정되지 않았거나 실패했습니다. 데모 데이터를 로드합니다.');
          setIsDemoMode(true);
          try {
            const { initialProjectData, defaultProjOverview } = await import('./data/mockData');
            const demoData = [
              {
                id: 'SM5718',
                name: 'SM5718 (Demo Mode)',
                latest_evt: 'EVT2',
                phases: ['EVT1', 'EVT2'],
                updated: new Date().toISOString(),
                is_archived: false,
                project_data: initialProjectData
              }
            ];
            setProjectsList(demoData);
          } catch (e) {
            console.error('Demo data load failed:', e);
          }
        } else {
          console.error('Supabase connection failed:', error.message);
          setIsDbConnected(false);
        }
      } else if (!data || data.length === 0) {
        // DB는 연결되었으나 비어있음 → Seeding
        setIsDbConnected(true);
        console.warn('⚠️ 데이터베이스가 비어있습니다. 초기 시딩을 시작합니다...');
        try {
          const { initialProjectData, defaultProjOverview } = await import('./data/mockData');
          
          const seedProjects = [
            {
              id: 'SM5718',
              name: 'SM5718 (Seed)',
              latest_evt: 'EVT2',
              phases: ['EVT1', 'EVT2'],
              updated: new Date().toISOString(),
              is_archived: false,
              project_data: initialProjectData
            },
            {
              id: 'SM5719',
              name: 'SM5719 (Empty)',
              latest_evt: 'EVT0',
              phases: ['EVT0'],
              updated: new Date().toISOString(),
              is_archived: true,
              project_data: {
                projectId: "SM5719",
                revisions: {
                  "EVT0": {
                    status: "draft",
                    projectOverview: defaultProjOverview,
                    ipIndex: {},
                    revisionLog: { issues: [], historyBlocks: [], loadedIssues: [] },
                    faReport: { faReports: [] }
                  }
                }
              }
            }
          ];

          const { data: seeded, error: seedError } = await supabase.from('projects').upsert(seedProjects).select();
          if (seedError) {
            console.error('❌ Seed Upsert Error:', seedError);
          } else {
            console.log('✅ Seeding 성공:', seeded);
            setProjectsList(seeded.map(p => ({
              ...p,
              is_locked: p.is_locked ?? false,
              locked_by: p.locked_by ?? null,
              locked_at: p.locked_at ?? null,
              is_archived: p.is_archived ?? false
            })));
          }
        } catch (e) {
          console.error('❌ Seeding Logic Error:', e);
        }
      } else {
        console.log(`✅ ${data.length}개의 프로젝트를 성공적으로 불러왔습니다.`);
        // 데이터 보정 (Migration Logic)
        const validated = data.map(p => ({
          ...p,
          is_locked: p.is_locked ?? false,
          locked_by: p.locked_by ?? null,
          locked_at: p.locked_at ?? null,
          is_archived: p.is_archived ?? false
        }));
        setProjectsList(validated);
        setIsDbConnected(true);
      }
      setLoading(false);
    }
    fetchProjects();

    // ─── [Realtime] projects 테이블 실시간 구독 ───
    const channel = supabase
      .channel('projects-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        if (eventType === 'INSERT') {
          setProjectsList(prev => {
            if (prev.some(p => p.id === newRecord.id)) return prev;
            return [newRecord, ...prev];
          });
        } else if (eventType === 'UPDATE') {
          setProjectsList(prev => prev.map(p =>
            p.id === newRecord.id
              ? { ...p, ...newRecord }
              : p
          ));
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

  const [activeProject, setActiveProject] = useState(null);
  const [projectData, setProjectData] = useState(null);
  const [currentViewedRevision, setCurrentViewedRevision] = useState('');
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  
  const [activeTab, setActiveTab] = useState('Project_Overview');
  const tabs = ['Project_Overview', 'IP_Index', 'Revision_Log', 'FA_Report'];

  // localStorage 저장 로직 제거 (Supabase로 통합)
  // useEffect(() => {
  //   localStorage.setItem('mitus_projects_list', JSON.stringify(projectsList));
  // }, [projectsList]);

  // ─── [아키텍처 개선] 불필요한 연쇄 리렌더링 제거 ───
  // 자동 저장 로직 (상세 데이터는 수동 저장/Submit 시점에 Supabase로 전송)
  useEffect(() => {
    if (projectData && activeProject) {
      // 로컬 백업용으로만 남겨둘 수 있음
      localStorage.setItem(`mitus_project_backup_${activeProject.id}`, JSON.stringify(projectData));
    }
  }, [projectData, activeProject]);

  const currentData = projectData?.revisions?.[currentViewedRevision] || {};
  const currentProjMeta = projectsList.find(p => p.id === activeProject?.id);
  const isSessionLockedByOther = currentProjMeta?.is_locked && currentProjMeta?.locked_by !== currentUser;
  const isProjectArchived = currentProjMeta?.is_archived === true;
  const isArchived = (activeProject ? !activeProject.isLatest || currentData?.status === "archived" : false) || currentProjMeta?.is_archived || isSessionLockedByOther;

  const [dirtyNavigation, setDirtyNavigation] = useState(null); 
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [isGloballyEditing, setIsGloballyEditing] = useState(false);
  const isDirtyRef = useRef(false);
  const originalDataSnapshot = useRef(null);
  
  const latestDataRef = useRef(projectData);
  useEffect(() => {
    latestDataRef.current = projectData;
  }, [projectData]);

  // ─── 브라우저 이탈 방지 (Cleanup Lock) ───
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (activeProject) {
        // 비동기 처리가 보장되지 않을 수 있으므로, beacon이나 동기적 처리가 필요할 수 있음
        // 여기서는 간단히 rpc나 별도 처리 없이 업데이트 시도
        await supabase
          .from('projects')
          .update({ is_locked: false, locked_by: null, locked_at: null })
          .eq('id', activeProject.id);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeProject, isDemoMode]);

  // ─── [아키텍체 개선] 자식 컴포넌트 리렌더링 방지를 위한 useCallback 적용 ───
  const handleEditingStateChange = useCallback((isEditing) => {
    setIsGloballyEditing(isEditing);
    if (isEditing) {
      const currentSnap = latestDataRef.current?.revisions[currentViewedRevision];
      originalDataSnapshot.current = currentSnap ? JSON.parse(JSON.stringify(currentSnap)) : null;
      isDirtyRef.current = false;
    } else {
      isDirtyRef.current = false;
      originalDataSnapshot.current = null;
    }
  }, [currentViewedRevision]);

  const handleTabSubmit = useCallback(async (tabName, newData) => {
    if (isArchived) {
      alert("잠금 처리된 차수입니다. 수정할 수 없습니다.");
      return;
    }
    
    // functional update로 항상 최신 projectData를 base로 사용 (스테일 클로저 방지)
    let savedProjectData;
    setProjectData(prev => {
      const updated = {
        ...prev,
        revisions: {
          ...prev.revisions,
          [currentViewedRevision]: {
            ...prev.revisions[currentViewedRevision],
            [tabName]: newData
          }
        }
      };
      savedProjectData = updated;
      return updated;
    });

    // 비동기 DB 저장은 다음 틱에 savedProjectData를 사용 (스테일 없는 최신값)
    setTimeout(async () => {
      if (!savedProjectData) return;
      const dt = new Date().toISOString();
      if (isDemoMode) {
        setProjectsList(prev => prev.map(p =>
          p.id === activeProject?.id ? { ...p, project_data: savedProjectData, updated: dt } : p
        ));
      } else {
        const { error } = await supabase
          .from('projects')
          .update({ project_data: savedProjectData, updated: dt })
          .eq('id', activeProject?.id);
        if (error) console.error('Error saving to Supabase:', error);
      }
    }, 0);

    if (isGloballyEditing) {
      isDirtyRef.current = true;
    }
  }, [isArchived, isGloballyEditing, currentViewedRevision, activeProject, isDemoMode]);

  const handleTabClick = useCallback((tab) => {
    if (activeTab === tab) return;
    if (isGloballyEditing && isDirtyRef.current) {
      setDirtyNavigation({ targetTab: tab });
    } else {
      setActiveTab(tab);
    }
  }, [activeTab, isGloballyEditing]);

  const performRollbackAndNavigate = () => {
    if (!dirtyNavigation) return;
    if (originalDataSnapshot.current) {
      const snapToRestore = originalDataSnapshot.current;
      setProjectData(prev => ({
        ...prev,
        revisions: {
          ...prev.revisions,
          [currentViewedRevision]: snapToRestore
        }
      }));
    }
    setActiveTab(dirtyNavigation.targetTab);
    setIsGloballyEditing(false);
    isDirtyRef.current = false;
    originalDataSnapshot.current = null;
    setDirtyNavigation(null);
  };

  const openWorkspace = async (projectId, phase) => {
    const proj = projectsList.find(p => p.id === projectId);
    if (!proj) return;
    
    if (isDemoMode) {
      console.log('🚀 [Demo Mode] Local 데이터를 사용하여 워크스페이스를 엽니다.');
      setProjectData(proj.project_data);
      setActiveProject({
        id: projectId,
        name: proj.name,
        evt: phase,
        isLatest: phase === proj.latest_evt
      });
      setCurrentViewedRevision(phase);
      setActiveTab('Project_Overview');
      setViewState('WORKSPACE');
      return;
    }

    // Supabase에서 상세 데이터 가져오기
    const { data, error } = await supabase
      .from('projects')
      .select('project_data, is_locked, locked_by')
      .eq('id', projectId)
      .single();

    if (error || !data?.project_data) {
      console.error('Error fetching project data:', error);
      alert('프로젝트 데이터를 불러오는 데 실패했습니다.');
      return;
    }

    // 잠금 획득 시도 (이미 본인이 잠근 경우가 아니면 업데이트)
    if (!(data.is_locked && data.locked_by === currentUser)) {
      await supabase
        .from('projects')
        .update({ is_locked: true, locked_by: currentUser, locked_at: new Date().toISOString() })
        .eq('id', projectId);
    }

    setProjectData(data.project_data);
    setActiveProject({
      id: projectId,
      name: proj.name,
      evt: phase,
      isLatest: phase === proj.latest_evt
    });
    setCurrentViewedRevision(phase);
    setActiveTab('Project_Overview');
    isDirtyRef.current = false;
    setIsGloballyEditing(false);
    originalDataSnapshot.current = null;
    setViewState('WORKSPACE');
  };

  const handleNewProjectClick = () => {
    setIsNewProjectModalOpen(true);
  };

  const handleCreateProject = async (formData) => {
    const id = formData.Project_Name.trim();
    if (projectsList.find(p => p.id === id)) {
      alert("이미 존재하는 프로젝트 이름(ID) 입니다.");
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

    const { error } = await supabase.from('projects').insert([newProjMeta]);
    if (error) {
      console.error('Error creating project:', error);
      alert('프로젝트 생성에 실패했습니다.');
      return;
    }

    setProjectsList([newProjMeta, ...projectsList]);
    setIsNewProjectModalOpen(false);
    openWorkspace(id, 'EVT0');
  };

  const handleToggleArchive = async (projectId, targetIsArchived) => {
    if (targetIsArchived) {
      if (!window.confirm("Move this project to the Archive?")) return;
    } else {
      if (!window.confirm("Restore this project from the Archive?")) return;
    }

    if (!isDemoMode) {
      // 1. Supabase DB 업데이트
      const { error } = await supabase
        .from('projects')
        .update({ is_archived: targetIsArchived })
        .eq('id', projectId);

      if (error) {
        console.error('Error toggling archive:', error);
        alert('상태 변경에 실패했습니다.');
        return;
      }
    } else {
      console.log('🗄️ [Demo Mode] Local 상태의 보관 여부를 변경합니다.');
    }

    // 2. 로컬 상태 업데이트
    setProjectsList(prev => prev.map(p => {
      if (p.id === projectId) return { ...p, is_archived: targetIsArchived };
      return p;
    }));

    // 3. 만약 편집 중인 프로젝트를 보관 처리했다면 자동으로 이탈 및 잠금 해제
    if (targetIsArchived && activeProject && activeProject.id === projectId) {
      executeExit();
    }
  };

  const handlePermanentDelete = async (projectId) => {
    // 레퍼런스 프로젝트 삭제 차단
    if (projectId === REFERENCE_PROJECT_ID) {
      alert('⛔ 시스템 레퍼런스 프로젝트는 삭제할 수 없습니다.\n\n대신 "초기 시드 데이터로 복구" 기능을 사용하세요.');
      return;
    }
    if (!isDemoMode) {
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) {
        console.error('Error deleting project:', error);
        alert('삭제에 실패했습니다.');
        return;
      }
    } else {
      console.log('🗑️ [Demo Mode] Local 상태에서 프로젝트를 삭제합니다.');
    }
    setProjectsList(prev => prev.filter(p => p.id !== projectId));
  };

  const handleLoadProjectClick = () => {
    alert("Select an external project file (.json) to import into the system. (Phase 3 implementation)");
  };

  const requestBackToDashboard = () => {
    if (isDirtyRef.current) {
      setShowExitWarning(true);
    } else {
      executeExit();
    }
  };

  const executeExit = async () => {
    if (activeProject && !isDemoMode) {
      await supabase
        .from('projects')
        .update({ is_locked: false, locked_by: null, locked_at: null })
        .eq('id', activeProject.id);
    }
    
    setShowExitWarning(false);
    setViewState('DASHBOARD');
    setActiveProject(null);
    setProjectData(null);
    setCurrentViewedRevision('');
    setIsGloballyEditing(false);
    isDirtyRef.current = false;
    originalDataSnapshot.current = null;
  };

  const handleExitWithSave = () => {
    executeExit();
  };

  const handleExitWithDiscard = () => {
    if (originalDataSnapshot.current) {
      const snapToRestore = originalDataSnapshot.current;
      setProjectData(prev => ({
        ...prev,
        revisions: {
          ...prev.revisions,
          [currentViewedRevision]: snapToRestore
        }
      }));
    }
    executeExit();
  };

  // ─── [아키텍처 개선] 분리된 순수 함수를 호출하여 로직 간소화 ───
  const handleGenerateNextRevision = useCallback(() => {
    if (!currentData || currentData.status !== 'archived') {
      alert("현재 최신 차수가 Lock(Archived) 상태여야 다음 차수를 생성할 수 있습니다.");
      return;
    }

    const faReports = currentData?.faReport?.faReports || [];
    // EVT0 단계에서는 Revision 판정인 FA 리포트는 연동이 원천 차단되므로 미결 검사에서 예외 처리
    const unlinkedFAs = faReports.filter(f => {
      if (f.isLinkedToLog) return false;
      if (currentViewedRevision === 'EVT0' && f.disposition === 'Revision') return false;
      return true;
    });

    if (unlinkedFAs.length > 0) {
      alert("FA 리포트에 아직 Revision Log로 가져오지 않은 미결 이슈가 있습니다. 모든 FA 이슈를 Log에 반영해야 다음 차수를 생성할 수 있습니다.");
      return;
    }

    const confirmNext = window.confirm(`현재 차수(${currentViewedRevision})를 보존하고 다음 차수를 파생하시겠습니까?`);
    if (!confirmNext) return;

    try {
      // 70줄의 비즈니스 로직을 단 한 줄로 깔끔하게 호출
      const { nextEvtName, newRevisionData, newPhases } = deriveNextRevisionData(currentData, currentViewedRevision, activeProject, projectsList);

      const updatedProjectData = {
        ...projectData,
        revisions: {
          ...projectData.revisions,
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
        supabase
          .from('projects')
          .update({ 
            latest_evt: nextEvtName, 
            phases: newPhases, 
            project_data: updatedProjectData, 
            updated: new Date().toISOString() 
          })
          .eq('id', activeProject.id);
        
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
      alert("파생 중 오류가 발생했습니다: " + err.message);
      console.error(err);
    }
  }, [currentData, currentViewedRevision, activeProject, projectsList, isDemoMode, projectData]);

  // ─── 레퍼런스 프로젝트 보호 ───
  const REFERENCE_PROJECT_ID = 'SM5718';

  /** SM5718을 mockData 원본 데이터로 즉시 복구 */
  const handleResetReference = async () => {
    if (!window.confirm(`[레퍼런스 복구] "${REFERENCE_PROJECT_ID}" 프로젝트를 초기 시드 데이터로 완전히 덮어쓰시겠습니까?\n\n현재 수정 내용은 모두 사라지며 복구할 수 없습니다.`)) return;
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
        setProjectsList(prev => prev.map(p => p.id === REFERENCE_PROJECT_ID ? { ...p, ...resetPayload } : p));
      } else {
        const { error } = await supabase.from('projects').upsert(resetPayload);
        if (error) throw error;
        setProjectsList(prev => prev.map(p => p.id === REFERENCE_PROJECT_ID ? { ...p, ...resetPayload } : p));
      }
      // 만약 현재 해당 프로젝트를 워크스페이스에서 보고 있다면 데이터도 갱신
      if (activeProject?.id === REFERENCE_PROJECT_ID) {
        setProjectData(initialProjectData);
        setCurrentViewedRevision('EVT2');
      }
      alert('✅ 레퍼런스 프로젝트가 초기 상태로 복구되었습니다.');
    } catch (err) {
      alert('❌ 복구 실패: ' + err.message);
      console.error(err);
    }
  };

  const handleDebugRollback = () => {
    if (!activeProject || !activeProject.isLatest || activeProject.evt === 'EVT0') {
      alert("롤백할 수 없는 상태입니다 (EVT0 이거나 최신 차수가 아님).");
      return;
    }

    if (window.confirm(`[디버그] 정말 ${activeProject.evt} 차수를 삭제하고 이전 차수로 롤백하시겠습니까?`)) {
      const currentProj = projectsList.find(p => p.id === activeProject.id);
      if (!currentProj || currentProj.phases.length <= 1) return;

      const currentPhase = activeProject.evt; 
      const previousPhase = currentProj.phases[currentProj.phases.length - 2]; 

      setProjectsList(prev => prev.map(p => {
        if (p.id === activeProject.id) {
          return { ...p, phases: p.phases.slice(0, -1), latest_evt: previousPhase, updated: new Date().toISOString() };
        }
        return p;
      }));

      setProjectData(prev => {
        const newRevisions = { ...prev.revisions };
        delete newRevisions[currentPhase];
        if (newRevisions[previousPhase]) {
          newRevisions[previousPhase].status = 'draft'; 
        }
        return { ...prev, revisions: newRevisions };
      });

      setActiveProject({ ...activeProject, evt: previousPhase, isLatest: true });
      setCurrentViewedRevision(previousPhase);
      
      isDirtyRef.current = false;
      alert(`[DEBUG] ${currentPhase}가 삭제되고 ${previousPhase}로 롤백되었습니다.`);
    }
  };

  const handleGlobalLock = async () => {
    if (isDirtyRef.current || isGloballyEditing) {
      alert("수정 중인 내용이 있습니다. 먼저 탭 내 저장을 완료하세요.");
      return;
    }

    const faReports = currentData?.faReport?.faReports || [];
    // EVT0 단계에서는 Revision 판정인 FA 리포트는 연동이 원천 차단되므로 Lock 검사에서 예외 처리
    const unlinkedFAs = faReports.filter(f => {
      if (f.isLinkedToLog) return false;
      if (currentViewedRevision === 'EVT0' && f.disposition === 'Revision') return false;
      return true;
    });

    if (unlinkedFAs.length > 0) {
      alert("FA 리포트에 아직 Revision Log로 가져오지 않은 미결 이슈가 있습니다. 모든 FA 이슈를 Log에 반영해야 마감(Lock)할 수 있습니다.");
      return;
    }
    const revLog = currentData.revisionLog;
    if (revLog) {
      const issues = revLog.issues || [];
      const loaded = revLog.loadedIssues || [];
      const evaluatedIds = issues.filter(i => i.entryMode === 'eval').map(i => i.targetIssue);
      const missingEvals = loaded.filter(id => !evaluatedIds.includes(id));
      if (missingEvals.length > 0) {
        alert("이전 차수 수정 평가가 완료되지 않은 이슈가 있습니다. 진행 후 Lock 하시기 바랍니다.");
        return;
      }
      const unmanagedCarryovers = issues.filter(i => i.entryMode === 'carryover' && i.carryoverStatus === 'OPEN');
      if (unmanagedCarryovers.length > 0) {
        alert("이월된 이슈 중 Action(조치)이 누락된 항목이 있습니다.");
        return;
      }
    }
    const confirmLock = window.confirm("프로젝트를 Lock 하시겠습니까? 한 번 잠그면 현재 차수는 읽기 전용 상태가 됩니다.");
    if (!confirmLock) return;
    
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
      await supabase.from('projects').update({ project_data: updatedProjectData }).eq('id', activeProject.id);
    }
  };

  const handleGlobalUnlock = async () => {
    const confirmUnlock = window.confirm("Unlock: 잠긴 문서의 Lock을 해제하고 다시 편집(Draft) 상태로 되돌립니다.\n\n[주의: 만약 이미 다음 차수(EVT3 등)가 파생된 상태에서 과거 차수의 데이터를 수정하면 데이터 정합성에 문제가 생길 수 있습니다.]\n정말 잠금을 해제하시겠습니까?");
    if (!confirmUnlock) return;

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
      await supabase.from('projects').update({ project_data: updatedProjectData }).eq('id', activeProject.id);
    }
  };
  
  const handleSaveBrowser = () => {
    alert("기본적으로 로컬스토리지에 자동 저장되고 있습니다.");
    isDirtyRef.current = false;
    setProjectData({...projectData}); 
  };
  
  const handleSaveMD = async () => {
    if (!activeProject || !currentData) {
      alert("출력할 데이터가 없습니다.");
      return;
    }

    try {
      const pName = activeProject.name;
      const rev = currentViewedRevision;
      
      const zip = new JSZip();
      const folder = zip.folder(`${pName}/${rev}`);

      // [시간 보정] JSZip 파일 생성 날짜를 로컬 시간으로 강제 지정
      const now = new Date();
      const timeOffset = now.getTimezoneOffset() * 60000;
      const localDate = new Date(now.getTime() - timeOffset);
      const zipOpts = { date: localDate };

      // 1. Project Overview
      const overviewStr = getOverviewMD(pName, rev, currentData.projectOverview);
      folder.file(`Project_Overview.${pName}.${rev}.md`, overviewStr, zipOpts);

      // 2. IP Index (개별 IP별 생성)
      const ips = currentData.projectOverview?.IP_Blocks || [];
      ips.forEach(ip => {
        const ipData = currentData.ipIndex?.[ip] || {};
        const ipStr = getIpIndexMD(pName, rev, ip, ipData, currentData.revisionLog);
        folder.file(`IP_Index.${ip}.${pName}.${rev}.md`, ipStr, zipOpts);
      });

      // 3. Revision Log
      const revLogStr = getRevLogMD(pName, rev, currentData.revisionLog);
      folder.file(`Revision_Log.${pName}.${rev}.md`, revLogStr, zipOpts);

      // 4. FA Report
      const faStr = getFaReportMD(pName, rev, currentData.faReport);
      folder.file(`FA_Report.${pName}.${rev}.md`, faStr, zipOpts);

      // ZIP 압축 및 다운로드
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${pName}_${rev}_Export.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      alert("Markdown Export 중 오류가 발생했습니다: " + err.message);
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100">
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
            currentUser={currentUser}
            isDemoMode={isDemoMode}
            isDbConnected={isDbConnected}
            referenceProjectId={REFERENCE_PROJECT_ID}
            handleNewProject={handleNewProjectClick} 
            handleLoadProjectClick={handleLoadProjectClick}
            openWorkspace={openWorkspace} 
            handleToggleArchive={handleToggleArchive}
            handlePermanentDelete={handlePermanentDelete}
            handleResetReference={handleResetReference}
          />
          {isNewProjectModalOpen && (
            <NewProjectModal 
              onClose={() => setIsNewProjectModalOpen(false)}
              onCreate={handleCreateProject}
            />
          )}
        </>
      )}

      {viewState === 'WORKSPACE' && activeProject && projectData && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col relative max-w-[1400px] mx-auto min-h-[calc(100vh-60px)]">
          {/* Top Header */}
          <div className="bg-white border-b border-slate-100 flex items-center justify-between shadow-sm z-10 px-4 py-3">
            <button onClick={requestBackToDashboard} className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 px-4 py-2 rounded-xl border border-transparent hover:border-blue-100 transition-colors">
              <ArrowLeft size={16} /> <span className="hidden sm:inline">Back to Dashboard</span>
            </button>
            <div className="flex gap-2.5">
              {activeProject.isLatest && (
                <>
                  <button type="button" onClick={handleSaveBrowser} className="hidden lg:flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 shadow-sm relative transition-colors">
                    <SaveIcon size={16} /> 브라우저 임시저장
                    {isDirtyRef.current && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                      </span>
                    )}
                  </button>
                  <button type="button" onClick={handleSaveMD} className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-white bg-blue-600 border border-blue-700 hover:bg-blue-700 shadow-sm relative transition-colors">
                    <Download size={16} /> .md 백업
                  </button>
                </>
              )}
              { (() => {
                  const canGenerate = activeProject.isLatest && currentData?.status === 'archived';
                  return (
                    <button type="button" onClick={handleGenerateNextRevision} disabled={!canGenerate} title={!canGenerate ? "현재 최신 차수가 Lock되어야 파생할 수 있습니다." : ""} className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-colors ${canGenerate ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200'}`}>
                      <ChevronsRight size={16} /> <span className="hidden sm:inline">다음 차수 파생</span>
                    </button>
                  );
              })() }
              {/* [DEBUG ONLY] 롤백 버튼 */}
              {activeProject.isLatest && activeProject.evt !== 'EVT0' && (
                <button type="button" onClick={handleDebugRollback} className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl font-bold text-sm text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 shadow-sm transition-colors">
                  [DEBUG] 롤백
                </button>
              )}
            </div>
          </div>

          {/* Sub Header */}
          <div className="bg-slate-50/50 border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-base font-extrabold px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 shadow-sm">{activeProject.name}</span>
              <span className={`font-mono text-xs font-bold px-3 py-1 border rounded-full ${activeProject.isLatest ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : 'bg-slate-200 text-slate-600 border-slate-300'}`}>{activeProject.evt}</span>
              {isDirtyRef.current && <span className="text-xs font-extrabold text-amber-500 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 animate-pulse">Unsaved Changes</span>}
            </div>
            <div className="flex items-center gap-2 font-bold text-sm">
              {!isArchived ? (
                <div className="flex items-center gap-2 text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                  </span>
                  Draft Editing Mode<span className="text-slate-300 mx-1">|</span><span onClick={handleGlobalLock} className="text-blue-600 cursor-pointer hover:underline text-xs font-bold">문서 Lock 설정</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                  <span className="w-2.5 h-2.5 bg-slate-400 rounded-full"></span>
                  Read-Only (Locked)
                  {isProjectArchived ? (
                     <span className="text-xs font-bold text-slate-700 ml-2 bg-slate-200 px-2 py-0.5 rounded border border-slate-300">
                       This project is currently Archived. To make changes, please unarchive it from the Dashboard.
                     </span>
                  ) : isSessionLockedByOther ? (
                     <span className="text-xs font-bold text-rose-600 ml-2 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                       현재 다른 사용자가 편집 중이므로 읽기 전용 모드로 표시됩니다.
                     </span>
                  ) : (
                     <><span className="text-slate-300 mx-1">|</span><span onClick={handleGlobalUnlock} className="text-red-500 cursor-pointer hover:underline text-xs flex items-center gap-1"><LockIcon size={12} /> Unlock</span></>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 탭 네비게이션 */}
          <div className="flex border-b border-gray-200 bg-white overflow-x-auto px-2">
            {tabs.map(tab => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => handleTabClick(tab)}
                  className={`px-6 py-4 text-sm font-extrabold border-b-[3px] transition-all whitespace-nowrap ${isActive ? 'border-blue-600 text-blue-700 bg-blue-50/20' : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
                >
                  {tab.replace('_', ' ')}
                </button>
              );
            })}
          </div>

          {/* 탭 콘텐츠 영역 */}
          <div className="bg-white p-6 m-4 mt-0 rounded-b-xl min-h-[500px]">
            {activeTab === 'Project_Overview' && (
              <ProjectOverviewTab 
                data={currentData?.projectOverview} 
                currentStage={currentViewedRevision}
                isArchived={isArchived} 
                onSubmit={(newData) => handleTabSubmit('projectOverview', newData)} 
                onImmediateUpdate={(newData) => handleTabSubmit('projectOverview', newData)}
                revisionLogData={currentData?.revisionLog}
                faReportData={currentData?.faReport}
                onEditingStateChange={handleEditingStateChange}
              />
            )}
            {activeTab === 'IP_Index' && (
              <IpIndexTab 
                data={currentData?.ipIndex}
                overviewData={currentData?.projectOverview}
                revisionLogData={currentData?.revisionLog}
                currentRevision={currentViewedRevision}
                isArchived={isArchived} 
                onSubmit={(newData) => handleTabSubmit('ipIndex', newData)} 
                onImmediateUpdate={(newData) => handleTabSubmit('ipIndex', newData)}
                onEditingStateChange={handleEditingStateChange}
              />
            )}
            {activeTab === 'Revision_Log' && (
              <RevisionLogTab 
                data={currentData?.revisionLog} 
                overviewData={currentData?.projectOverview}
                currentRevision={currentViewedRevision}
                isArchived={isArchived} 
                faReportData={currentData?.faReport}
                onSubmit={(newData) => handleTabSubmit('revisionLog', newData)} 
                onImmediateUpdate={(newData) => handleTabSubmit('revisionLog', newData)}
                onFaReportUpdate={(newData) => handleTabSubmit('faReport', newData)}
                onEditingStateChange={handleEditingStateChange}
              />
            )}
            {activeTab === 'FA_Report' && (
              <FaReportTab 
                data={currentData?.faReport}
                overviewData={currentData?.projectOverview}
                currentRevision={currentViewedRevision}
                revisionLogData={currentData?.revisionLog}
                isArchived={isArchived} 
                onSubmit={(newData) => handleTabSubmit('faReport', newData)} 
                onImmediateUpdate={(newData) => handleTabSubmit('faReport', newData)}
                onRevisionLogUpdate={(newLogData) => handleTabSubmit('revisionLog', newLogData)}
                onEditingStateChange={handleEditingStateChange}
              />
            )}
          </div>
        </div>
      )}

      {/* ─── 모달 1: 탭 전환 경고 ─── */}
      {dirtyNavigation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 w-full max-w-md overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 to-rose-400" />
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-rose-100 flex items-center justify-center text-xl">⚠️</div>
                <div>
                  <p className="text-xs font-bold text-rose-600 uppercase tracking-widest mb-0.5">저장되지 않은 변경사항</p>
                  <h2 className="text-base font-extrabold text-slate-800">탭 전환 경고</h2>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed mb-6 font-medium">현재 탭에 <strong className="text-rose-600">저장되지 않은 수정 사항</strong>이 있습니다. <br/>저장하지 않고 이동하시겠습니까?</p>
              <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-slate-100">
                <button onClick={() => setDirtyNavigation(null)} className="px-4 py-2.5 text-sm font-bold rounded-xl border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors">취소 / 머무르기</button>
                <button onClick={performRollbackAndNavigate} className="px-4 py-2.5 text-sm font-bold rounded-xl bg-rose-500 hover:bg-rose-600 text-white shadow-sm transition-colors">저장하지 않고 이동</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 모달 2: 나가기 (Save & Exit) 경고 ─── */}
      {showExitWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center text-3xl shadow-inner my-2">⚠️</div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-800 mb-2">저장되지 않은 변경사항</h2>
              <p className="text-sm text-slate-500 font-medium">편집 중인 내용이 <strong>완료(Save 처리)되지 않았습니다.</strong></p>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={handleExitWithSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl">임시저장 상태로 나가기</button>
              <button onClick={handleExitWithDiscard} className="w-full bg-slate-100 hover:bg-red-50 text-red-600 font-bold py-2.5 rounded-xl border border-transparent hover:border-red-200">편집 내용 취소하고 나가기</button>
              <button onClick={() => setShowExitWarning(false)} className="w-full text-slate-500 hover:text-slate-700 font-semibold py-2 rounded-xl">워크스페이스로 돌아가기</button>
            </div>
          </div>
        </div>
      )}

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