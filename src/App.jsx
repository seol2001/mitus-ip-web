import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { initialProjectData, defaultProjOverview, makeBlankOverview, makeDefaultIpIndex, ipCategoryNameMap } from './data/mockData';
import Dashboard from './components/Dashboard';
import ProjectOverviewTab from './components/tabs/ProjectOverviewTab';
import IpIndexTab from './components/tabs/IpIndexTab';
import RevisionLogTab from './components/tabs/RevisionLogTab';
import FaReportTab from './components/tabs/FaReportTab';
import NewProjectModal from './components/NewProjectModal';
import LockChecklistModal from './components/LockChecklistModal';
import { useConfirm } from './contexts/ConfirmContext';
import { ArrowLeft, Save as SaveIcon, Download, ChevronsRight, Lock as LockIcon, AlertCircle, Clock } from 'lucide-react';
import JSZip from 'jszip';
import { getOverviewMD, getIpIndexMD, getRevLogMD, getFaReportMD } from './utils/exportMarkdown';
import AccessGate from './components/AccessGate';


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
    const isFixedOrClosed = disposition === 'Fixed' || disposition === 'Acceptable' || disposition === 'Waived' || disposition === 'Closed';

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
  const [isAuthorized, setIsAuthorized] = useState(() => {
    // 세션 저장소에서 인증 상태 확인
    return sessionStorage.getItem('mitus_authorized') === 'true';
  });
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
  const projectsListRef = useRef([]); // 하트비트 로직에서 스테일 클로저 방지를 위한 Ref
  useEffect(() => {
    projectsListRef.current = projectsList;
  }, [projectsList]);

  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [lockModalOpen, setLockModalOpen] = useState(false);
  const [lockChecklist, setLockChecklist] = useState([]);
  const showConfirm = useConfirm();
  const [isDbConnected, setIsDbConnected] = useState(false); // 실제 DB 연결 상태

  const [globalIpDictionary, setGlobalIpDictionary] = useState(ipCategoryNameMap);
  const [customIpDetails, setCustomIpDetails] = useState([]);

  // ─── [Supabase] 초기 프로젝트 목록 로드 ───
  useEffect(() => {
    async function fetchProjects() {
      setLoading(true);
      console.log('🔍 Supabase에서 프로젝트 목록을 불러오는 중...');
      
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, latest_evt, phases, updated, is_locked, locked_by, locked_at, is_archived, project_data')
        .order('updated', { ascending: false });

      // Fetch Custom IPs
      const { data: customIpsData, error: customIpsError } = await supabase
        .from('custom_ips')
        .select('*')
        .order('created_at', { ascending: true });
        
      if (!customIpsError && customIpsData) {
        setCustomIpDetails(customIpsData);
        // Merge into dictionary
        setGlobalIpDictionary(prev => {
          const newDict = JSON.parse(JSON.stringify(prev));
          customIpsData.forEach(cip => {
            if (!newDict[cip.category]) {
              newDict[cip.category] = [];
            }
            if (!newDict[cip.category].includes(cip.name)) {
              newDict[cip.category].push(cip.name);
            }
          });
          return newDict;
        });
      }

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

    // URL 파라미터 체크 (POC용 편의 기능: ?key=mitus2026)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('key') === 'mitus2026') {
      handleAuthorize();
    }

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

  const handleAddCustomIp = async (category, name, description) => {
    if (isDemoMode) {
      const newIp = { id: Date.now().toString(), category, name, description, created_by: currentUser, created_at: new Date().toISOString() };
      setCustomIpDetails(prev => [...prev, newIp]);
      setGlobalIpDictionary(prev => {
        const newDict = JSON.parse(JSON.stringify(prev));
        if (!newDict[category]) newDict[category] = [];
        if (!newDict[category].includes(name)) newDict[category].push(name);
        return newDict;
      });
      return true;
    }

    const { data, error } = await supabase
      .from('custom_ips')
      .insert([{ category, name, description, created_by: currentUser }])
      .select();

    if (error) {
      console.error('Error adding custom IP:', error);
      showConfirm({ title: "저장 실패", message: "Custom IP 등록에 실패했습니다.", type: "danger", showCancel: false });
      return false;
    }

    if (data && data.length > 0) {
      const newIp = data[0];
      setCustomIpDetails(prev => [...prev, newIp]);
      setGlobalIpDictionary(prev => {
        const newDict = JSON.parse(JSON.stringify(prev));
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
          const newDict = JSON.parse(JSON.stringify(prev));
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

    const { data, error } = await supabase
      .from('custom_ips')
      .update(updatedData)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error editing custom IP:', error);
      showConfirm({ title: "수정 실패", message: "Custom IP 수정에 실패했습니다.", type: "danger", showCancel: false });
      return false;
    }

    if (data && data.length > 0) {
      setCustomIpDetails(prev => prev.map(ip => ip.id === id ? data[0] : ip));
      if (updatedData.name && (updatedData.name !== targetIp.name || updatedData.category !== targetIp.category)) {
        setGlobalIpDictionary(prev => {
          const newDict = JSON.parse(JSON.stringify(prev));
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
        const newDict = JSON.parse(JSON.stringify(prev));
        if (newDict[targetIp.category]) {
          newDict[targetIp.category] = newDict[targetIp.category].filter(n => n !== targetIp.name);
          if (newDict[targetIp.category].length === 0) delete newDict[targetIp.category];
        }
        return newDict;
      });
      return true;
    }

    const { error } = await supabase.from('custom_ips').delete().eq('id', id);
    if (error) {
      console.error('Error deleting custom IP:', error);
      showConfirm({ title: "삭제 실패", message: "Custom IP 삭제에 실패했습니다.", type: "danger", showCancel: false });
      return false;
    }

    setCustomIpDetails(prev => prev.filter(ip => ip.id !== id));
    setGlobalIpDictionary(prev => {
      const newDict = JSON.parse(JSON.stringify(prev));
      if (newDict[targetIp.category]) {
        newDict[targetIp.category] = newDict[targetIp.category].filter(n => n !== targetIp.name);
        if (newDict[targetIp.category].length === 0) delete newDict[targetIp.category];
      }
      return newDict;
    });
    return true;
  };

  const [activeProject, setActiveProject] = useState(null);
  const [projectData, setProjectData] = useState(null);
  const [currentViewedRevision, setCurrentViewedRevision] = useState('');
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  
  const [activeTab, setActiveTab] = useState('Project_Overview');
  const tabs = ['Project_Overview', 'IP_Index', 'Revision_Log', 'FA_Report'];

  const LOCK_STALE_THRESHOLD_MIN = 10;
  const currentData = projectData?.revisions?.[currentViewedRevision] || {};
  const currentProjMeta = projectsList.find(p => p.id === activeProject?.id);

  // ─── [아키텍처 개선] 잠금 상태 상세 분석 ───
  const getLockDetail = (meta) => {
    if (!meta?.is_locked || !meta?.locked_at) return { isLocked: false, isStale: false, isByMe: false };
    const lockTime = new Date(meta.locked_at).getTime();
    const diffMins = (Date.now() - lockTime) / (1000 * 60);
    const isStale = diffMins >= LOCK_STALE_THRESHOLD_MIN;
    const isByMe = meta.locked_by === currentUser;
    return { isLocked: true, isStale, isByMe, lockedBy: meta.locked_by, minutesAgo: Math.floor(diffMins) };
  };

  const lockDetail = getLockDetail(currentProjMeta);
  // 타인이 점유 중이고, 아직 정체(Stale)되지 않은 경우에만 진정한 Lock으로 간주
  const isSessionLockedByOther = lockDetail.isLocked && !lockDetail.isByMe && !lockDetail.isStale;
  
  // ─── [개선] 읽기 전용 사유(lockReason) 분석 ───
  const lockReason = isSessionLockedByOther ? `Locked by ${currentProjMeta?.locked_by}` :
                     (lockDetail.isLocked && !lockDetail.isByMe && lockDetail.isStale) ? `Stale Lock (${lockDetail.lockedBy})` :
                     (activeProject && !activeProject.isLatest) ? "Historical View" :
                     currentProjMeta?.is_archived ? "Project Archived" : 
                     (currentData?.status === "archived") ? "Revision Locked" : "";

  const isArchived = !!lockReason;

  const [dirtyNavigation, setDirtyNavigation] = useState(null); 
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [isGloballyEditing, setIsGloballyEditing] = useState(false);
  const isDirtyRef = useRef(false);
  const originalDataSnapshot = useRef(null);
  
  const latestDataRef = useRef(projectData);
  useEffect(() => {
    latestDataRef.current = projectData;
  }, [projectData]);

  // ─── [아키텍처 개선] 하트비트 (Heartbeat) 로직: 5분마다 locked_at 갱신 ───
  useEffect(() => {
    if (!activeProject || isDemoMode) return;

    const interval = setInterval(async () => {
      // 최신 projectsList 상태를 Ref에서 가져와 락 보유 여부 확인
      const currentMeta = projectsListRef.current.find(p => p.id === activeProject.id);
      const detail = getLockDetail(currentMeta);
      
      if (detail.isLocked && detail.isByMe) {
        console.log('💓 [Heartbeat] 잠금 시간 갱신 중...');
        const { error } = await supabase
          .from('projects')
          .update({ locked_at: new Date().toISOString() })
          .eq('id', activeProject.id);
        
        if (error) console.error('❌ Heartbeat Error:', error);
      } else if (detail.isLocked && !detail.isByMe) {
        // [중요] 더 이상 락을 보유하고 있지 않다면 (타인에 의한 강제 해제 등) 알림
        console.warn('⚠️ [Heartbeat] 잠금 권한이 상실되었습니다.');
        showConfirm({
          title: "편집 권한 상실",
          message: `다른 사용자(${detail.lockedBy})가 편집 권한을 가져갔습니다.\n이후의 수정사항은 저장되지 않을 수 있으며, 현재 페이지는 읽기 전용으로 전환됩니다.`,
          type: "danger",
          showCancel: false
        });
        // 알림 후 UI가 자동으로 isSessionLockedByOther에 의해 Read-Only가 됨
      }
    }, 5 * 60 * 1000); // 5분

    return () => clearInterval(interval);
  }, [activeProject?.id, isDemoMode, currentUser]);

  // ─── 브라우저 이탈 방지 (Cleanup Lock) ───
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (activeProject && !isDemoMode) {
        const currentMeta = projectsListRef.current.find(p => p.id === activeProject.id);
        if (currentMeta?.locked_by === currentUser) {
          // Supabase 인증 정보 포함을 위해 fetch + keepalive 사용
          const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/projects?id=eq.${activeProject.id}`;
          const headers = {
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          };
          const body = JSON.stringify({ is_locked: false, locked_by: null, locked_at: null });

          // 브라우저 종료 시에도 비동기 요청이 완료되도록 keepalive 설정
          fetch(url, {
            method: 'PATCH',
            headers,
            body,
            keepalive: true
          }).catch(err => console.error('Cleanup Lock Error:', err));
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeProject?.id, isDemoMode, currentUser]);

  const handleAuthorize = () => {
    sessionStorage.setItem('mitus_authorized', 'true');
    setIsAuthorized(true);
  };


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

  const handleTabSubmit = useCallback(async (tabName, newData, forceDirty = false) => {
    if (isArchived) {
      showConfirm({
        title: "수정 불가",
        message: "잠금 처리된 차수입니다. 수정할 수 없습니다.",
        type: "warning",
        showCancel: false
      });
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
        // [수정] 저장 시 locked_at도 함께 갱신하여 세션 유지
        const { error } = await supabase
          .from('projects')
          .update({ 
            project_data: savedProjectData, 
            updated: dt,
            locked_at: dt 
          })
          .eq('id', activeProject?.id);
        if (error) console.error('Error saving to Supabase:', error);
      }
    }, 0);

    if (isGloballyEditing || forceDirty) {
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

  // ─── [신규] 브라우저 뒤로가기 지원 ───
  useEffect(() => {
    const handlePopState = (event) => {
      if (viewState === 'WORKSPACE') {
        // 이미 히스토리가 이동된 상태이므로 history.back() 없이 내부 상태만 정리
        executeExit(true);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [viewState]);

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
        isLatest: phase === proj.latest_evt,
        updated: proj.updated  // dbUpdatedAt으로 탭에 전달되는 핵심 필드
      });
      setCurrentViewedRevision(phase);
      setActiveTab('Project_Overview');
      setViewState('WORKSPACE');
      return;
    }

    // Supabase에서 상세 데이터 가져오기
    const { data, error } = await supabase
      .from('projects')
      .select('project_data, is_locked, locked_by, locked_at')
      .eq('id', projectId)
      .single();

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

    // 잠금 상태 상세 분석
    const detail = getLockDetail(data);

    if (detail.isLocked && !detail.isByMe) {
      if (detail.isStale) {
        // [좀비 락 해결] 정체된 잠금 발견 시 자동 Takeover
        console.log(`♻️ [Zombie Lock] ${detail.lockedBy}님의 정체된 잠금을 발견하여 자동 해제 후 점유합니다. (${detail.minutesAgo}분 전)`);
        await supabase
          .from('projects')
          .update({ is_locked: true, locked_by: currentUser, locked_at: new Date().toISOString() })
          .eq('id', projectId);
      } else {
        // 타인이 활발히 점유 중 → Read-Only로 진입
        console.log(`🔒 [Presence] ${data.locked_by}님이 편집 중입니다. 읽기 전용으로 진입합니다.`);
      }
    } else if (!detail.isByMe) {
      // 잠금 없음 → 즉시 선점
      await supabase
          .from('projects')
          .update({ is_locked: true, locked_by: currentUser, locked_at: new Date().toISOString() })
          .eq('id', projectId);
    }
    // isLockedByMe → 이미 본인이 선점 중, 재획득 불필요

    setProjectData(data.project_data);
    setActiveProject({
      id: projectId,
      name: proj.name,
      evt: phase,
      isLatest: phase === proj.latest_evt,
      updated: proj.updated  // dbUpdatedAt으로 탭에 전달되는 핵심 필드
    });
    setCurrentViewedRevision(phase);
    setActiveTab('Project_Overview');
    isDirtyRef.current = false;
    setIsGloballyEditing(false);
    originalDataSnapshot.current = null;
    
    // 브라우저 히스토리에 워크스페이스 진입 기록 추가
    window.history.pushState({ type: 'WORKSPACE', projectId, phase }, '');
    
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

    const { error } = await supabase.from('projects').insert([newProjMeta]);
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

  const handleToggleArchive = async (projectId, targetIsArchived) => {
    const confirmed = await showConfirm({
      title: targetIsArchived ? "프로젝트 아카이브" : "아카이브 복구",
      message: targetIsArchived 
        ? "이 프로젝트를 아카이브로 이동하시겠습니까?" 
        : "이 프로젝트를 아카이브에서 복구하시겠습니까?",
      type: "warning"
    });
    if (!confirmed) return;

    if (!isDemoMode) {
      // 1. Supabase DB 업데이트
      const { error } = await supabase
        .from('projects')
        .update({ is_archived: targetIsArchived })
        .eq('id', projectId);

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
      showConfirm({
        title: "삭제 불가",
        message: '시스템 레퍼런스 프로젝트는 삭제할 수 없습니다.\n\n대신 "초기 시드 데이터로 복구" 기능을 사용하세요.',
        type: "warning",
        showCancel: false
      });
      return;
    }
    if (!isDemoMode) {
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
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
  };

  const handleLoadProjectClick = async () => {
    showConfirm({
      title: "준비 중",
      message: "외부 프로젝트 파일(.json)을 가져오는 기능은 현재 개발 중입니다. (Phase 3 implementation)",
      type: "info",
      showCancel: false
    });
  };

  // ─── [신규] 잠금 강제 해제 (Force Unlock) 핸들러 ───
  const handleForceUnlock = async (projectId) => {
    if (isDemoMode) {
      setProjectsList(prev => prev.map(p => 
        p.id === projectId ? { ...p, is_locked: false, locked_by: null, locked_at: null } : p
      ));
      return;
    }

    const { error } = await supabase
      .from('projects')
      .update({ is_locked: false, locked_by: null, locked_at: null })
      .eq('id', projectId);

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
      // 로컬 상태는 실시간 구독(Realtime)에 의해 자동 업데이트됨
    }
  };

  const requestBackToDashboard = () => {
    if (isDirtyRef.current) {
      setShowExitWarning(true);
    } else {
      executeExit();
    }
  };

  const executeExit = async (fromPopState = false) => {
    if (activeProject && !isDemoMode) {
      // 본인이 선점한 경우에만 해제 (Read-Only 진입자가 나갈 때 타인의 락을 지우지 않음)
      const currentMeta = projectsList.find(p => p.id === activeProject.id);
      if (currentMeta?.locked_by === currentUser) {
        await supabase
          .from('projects')
          .update({ is_locked: false, locked_by: null, locked_at: null })
          .eq('id', activeProject.id);
      }
    }
    
    // UI 버튼을 통해 나가는 경우 브라우저 히스토리도 뒤로 한 칸 이동
    if (!fromPopState) {
      window.history.back();
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
  const handleGenerateNextRevision = useCallback(async () => {
    if (!currentData || currentData.status !== 'archived') {
      showConfirm({
        title: "파생 불가",
        message: "현재 최신 차수가 Lock(Archived) 상태여야 다음 차수를 생성할 수 있습니다.",
        type: "warning",
        showCancel: false
      });
      return;
    }

    const faReports = currentData?.faReport?.faReports || [];
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

    const confirmNext = await showConfirm({
      title: "차수 파생 (Revision Up)",
      message: `현재 차수(${currentViewedRevision})를 보존하고 다음 차수를 파생하시겠습니까?`,
      type: "info",
      confirmText: "파생 실행"
    });
    if (!confirmNext) return;

    try {
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
        await supabase
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
  const REFERENCE_PROJECT_ID = 'SM5718';

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
    if (!activeProject || !activeProject.isLatest || activeProject.evt === 'EVT0') {
      showConfirm({
        title: "롤백 불가",
        message: "롤백할 수 없는 상태입니다 (EVT0 이거나 최신 차수가 아님).",
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
      const currentProj = projectsList.find(p => p.id === activeProject.id);
      if (!currentProj || currentProj.phases.length <= 1) return;

      const currentPhase = activeProject.evt; 
      const previousPhase = currentProj.phases[currentProj.phases.length - 2]; 
      const newPhases = currentProj.phases.slice(0, -1);

      // 1. 새로운 project_data 계산 (현재 차수 삭제 및 이전 차수를 draft로)
      const newRevisions = { ...projectData.revisions };
      delete newRevisions[currentPhase];
      if (newRevisions[previousPhase]) {
        newRevisions[previousPhase].status = 'draft'; 
      }
      const updatedProjectData = { ...projectData, revisions: newRevisions };

      // 2. DB 업데이트 (데모 모드가 아닐 때만)
      if (!isDemoMode) {
        try {
          await supabase
            .from('projects')
            .update({ 
              phases: newPhases, 
              latest_evt: previousPhase, 
              project_data: updatedProjectData,
              updated: new Date().toISOString()
            })
            .eq('id', activeProject.id);
        } catch (dbErr) {
          console.error("Rollback DB Error:", dbErr);
          showConfirm({ title: "DB 업데이트 실패", message: "DB 저장 중 오류가 발생했습니다.", type: "danger", showCancel: false });
          return;
        }
      }

      // 3. 로컬 상태 업데이트
      setProjectsList(prev => prev.map(p => {
        if (p.id === activeProject.id) {
          return { 
            ...p, 
            phases: newPhases, 
            latest_evt: previousPhase, 
            updated: new Date().toISOString(),
            project_data: updatedProjectData // 대시보드 리스트 데이터도 갱신
          };
        }
        return p;
      }));

      setProjectData(updatedProjectData);
      setActiveProject({ ...activeProject, evt: previousPhase, isLatest: true });
      setCurrentViewedRevision(previousPhase);
      
      isDirtyRef.current = false;
      showConfirm({ title: "롤백 완료", message: `[DEBUG] ${currentPhase}가 삭제되고 ${previousPhase}로 롤백되었습니다.`, type: "success", showCancel: false });
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
      await supabase.from('projects').update({ project_data: updatedProjectData }).eq('id', activeProject.id);
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
      handleGenerateNextRevision();
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
        await supabase.from('projects').update({ project_data: updatedProjectData }).eq('id', activeProject.id);
      }
      showConfirm({ title: "해제 완료", message: "잠금이 해제되어 다시 편집할 수 있습니다.", type: "success", showCancel: false });
    }
  };
  
  
  const handleSaveMD = async () => {
    if (!activeProject || !currentData) {
      showConfirm({
        title: "데이터 없음",
        message: "출력할 데이터가 없습니다.",
        type: "info",
        showCancel: false
      });
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
      showConfirm({
        title: "내보내기 오류",
        message: "Markdown Export 중 오류가 발생했습니다: " + err.message,
        type: "danger",
        showCancel: false
      });
      console.error(err);
    }
  };

  if (!isAuthorized) {
    return <AccessGate onAuthorized={handleAuthorize} />;
  }

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
            handleForceUnlock={handleForceUnlock}
            globalIpDictionary={globalIpDictionary}
            customIpDetails={customIpDetails}
            handleEditCustomIp={handleEditCustomIp}
            handleDeleteCustomIp={handleDeleteCustomIp}
            handleAddCustomIp={handleAddCustomIp}
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
          {/* 🚀 통합 글로벌 헤더 (Navigation + Context + Global Actions) */}
          <div className="bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-[20] px-4 py-2.5">
            <div className="flex items-center gap-3">
              <button onClick={requestBackToDashboard} className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 px-3 py-2 rounded-xl border border-slate-100 transition-colors shrink-0">
                <ArrowLeft size={14} /> <span className="hidden lg:inline">Dashboard</span>
              </button>
              
              <div className="h-5 w-[1px] bg-slate-200 mx-1 hidden sm:block"></div>
              
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-extrabold px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 shadow-sm shrink-0">{activeProject.name}</span>
                <span className={`font-mono text-[10px] font-bold px-2 py-0.5 border rounded-full shrink-0 ${activeProject.isLatest ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : 'bg-slate-200 text-slate-600 border-slate-300'}`}>{activeProject.evt}</span>
                {isDirtyRef.current && <span className="text-[10px] font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 animate-pulse shrink-0">Unsaved</span>}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* ── 글로벌 상태 및 Lock 액션 영역 ── */}
              <div className="flex items-center gap-2">
                {!isArchived ? (
                  <div className="flex items-center gap-2 text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 shadow-inner">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">작성 중</span>
                    <span className="text-slate-200 mx-1">|</span>
                    <button onClick={handleGlobalLock} className="text-blue-600 hover:text-blue-800 text-[11px] font-bold flex items-center gap-1 transition-colors">
                      <LockIcon size={12} /> 현재 차수 확정 (Lock)
                    </button>
                  </div>
                ) : isSessionLockedByOther ? (
                  <div className="flex items-center gap-2 text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 font-bold text-[11px] shadow-sm">
                    <LockIcon size={12} className="text-rose-500" />
                    읽기 전용 ({currentProjMeta?.locked_by})
                  </div>
                ) : (lockDetail.isLocked && !lockDetail.isByMe && lockDetail.isStale) ? (
                  <div className="flex items-center gap-2 text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 font-bold text-[10px] shadow-sm">
                    <span>정체된 잠금 ({lockDetail.minutesAgo}분 전)</span>
                    <button onClick={async () => {
                      const confirmed = await showConfirm({
                        title: "편집 권한 가져오기 (Takeover)",
                        message: "타인이 편집 중인 잠금을 해제하고 편집 권한을 가져오시겠습니까?\n상대방의 저장되지 않은 데이터가 유실될 수 있습니다.",
                        type: "warning",
                        confirmText: "권한 가져오기"
                      });
                      if (confirmed) handleForceUnlock(activeProject.id);
                    }} className="bg-amber-600 hover:bg-amber-700 text-white px-2 py-0.5 rounded transition-colors">Takeover</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold">
                    <LockIcon size={12} /> Read-Only
                    {!currentProjMeta?.is_archived && <button onClick={handleGlobalUnlock} className="text-red-500 ml-2 hover:underline">Unlock</button>}
                  </div>
                )}
              </div>

              <div className="h-5 w-[1px] bg-slate-200 mx-1 hidden md:block"></div>

              {/* ── 글로벌 유틸리티 영역 ── */}
              <div className="flex gap-2">
                {activeProject.isLatest && (
                  <button onClick={handleSaveMD} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs text-white bg-slate-800 hover:bg-slate-900 transition-colors shadow-sm">
                    <Download size={14} /> .md 백업
                  </button>
                )}
                { (() => {
                    const canGenerate = activeProject.isLatest && currentData?.status === 'archived';
                    return (
                      <button onClick={handleGenerateNextRevision} disabled={!canGenerate} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition-all ${canGenerate ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200'}`}>
                        <ChevronsRight size={14} /> 다음 차수 파생
                      </button>
                    );
                })() }
                {activeProject.isLatest && activeProject.evt !== 'EVT0' && !isSessionLockedByOther && (() => {
                  const currentNum = parseInt(activeProject.evt.match(/\d+/)?.[0] || "0");
                  const prevEvt = activeProject.evt.replace(/\d+/, currentNum - 1);
                  return (
                    <button onClick={handleDebugRollback} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs text-rose-400/80 hover:text-rose-600 bg-rose-50/30 hover:bg-rose-50 border border-rose-100 transition-all shadow-sm">
                      Data reset to {prevEvt}
                    </button>
                  );
                })()}
              </div>
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
                lockReason={lockReason}
                projectId={activeProject.id}
                dbUpdatedAt={activeProject.updated}
                onSubmit={(newData) => handleTabSubmit('projectOverview', newData)} 
                onImmediateUpdate={(newData, forceDirty) => handleTabSubmit('projectOverview', newData, forceDirty)}
                revisionLogData={currentData?.revisionLog}
                faReportData={currentData?.faReport}
                onEditingStateChange={handleEditingStateChange}
                onForceUnlock={() => handleForceUnlock(activeProject.id)}
                globalIpDictionary={globalIpDictionary}
                onAddCustomIp={handleAddCustomIp}
              />
            )}
            {activeTab === 'IP_Index' && (
              <IpIndexTab 
                data={currentData?.ipIndex}
                overviewData={currentData?.projectOverview}
                revisionLogData={currentData?.revisionLog}
                currentRevision={currentViewedRevision}
                isArchived={isArchived} 
                lockReason={lockReason}
                projectId={activeProject.id}
                dbUpdatedAt={activeProject.updated}
                onSubmit={(newData) => handleTabSubmit('ipIndex', newData)} 
                onImmediateUpdate={(newData, forceDirty) => handleTabSubmit('ipIndex', newData, forceDirty)}
                onEditingStateChange={handleEditingStateChange}
                onForceUnlock={() => handleForceUnlock(activeProject.id)}
                globalIpDictionary={globalIpDictionary}
              />
            )}
            {activeTab === 'Revision_Log' && (
              <RevisionLogTab 
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
                onImmediateUpdate={(newData, forceDirty) => handleTabSubmit('revisionLog', newData, forceDirty)}
                onFaReportUpdate={(newData) => handleTabSubmit('faReport', newData)}
                onEditingStateChange={handleEditingStateChange}
                onForceUnlock={() => handleForceUnlock(activeProject.id)}
              />
            )}
            {activeTab === 'FA_Report' && (
              <FaReportTab 
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
                onImmediateUpdate={(newData, forceDirty) => handleTabSubmit('faReport', newData, forceDirty)}
                onRevisionLogUpdate={(newLogData) => handleTabSubmit('revisionLog', newLogData)}
                onEditingStateChange={handleEditingStateChange}
                onForceUnlock={() => handleForceUnlock(activeProject.id)}
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

      <LockChecklistModal 
        isOpen={lockModalOpen} 
        onClose={() => setLockModalOpen(false)} 
        checklist={lockChecklist}
        onConfirm={handleFinalConfirmLock}
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