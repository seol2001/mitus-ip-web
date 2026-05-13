import { supabase } from '../supabaseClient';

/**
 * 프로젝트 관련 Supabase 통신 서비스
 */
export const projectService = {
  /**
   * 프로젝트 목록 및 Custom IP 목록 조회
   */
  async fetchProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, latest_evt, phases, updated, is_locked, locked_by, locked_at, is_archived, project_data')
      .order('updated', { ascending: false });

    const { data: customIpsData, error: customIpsError } = await supabase
      .from('custom_ips')
      .select('*')
      .order('created_at', { ascending: true });

    return { 
      projects: data || [], 
      customIps: customIpsData || [], 
      error: error || customIpsError 
    };
  },

  /**
   * 신규 프로젝트 생성
   */
  async createProject(projectMeta) {
    return await supabase.from('projects').insert([projectMeta]);
  },

  /**
   * 프로젝트 데이터 업데이트 (Tab Submit 등)
   */
  async updateProjectData(projectId, projectData, updatedTime, userId) {
    return await supabase
      .from('projects')
      .update({ 
        project_data: projectData, 
        updated: updatedTime,
        locked_at: updatedTime 
      })
      .eq('id', projectId)
      .eq('locked_by', userId)
      .select('*', { count: 'exact' }); // 업데이트된 행의 개수를 확인하기 위해 select 추가
  },

  /**
   * 프로젝트 메타데이터 및 데이터 전체 업데이트 (병합/가져오기 등)
   */
  async updateProject(projectId, updatePayload, userId = null) {
    let query = supabase
      .from('projects')
      .update(updatePayload)
      .eq('id', projectId);
      
    // 사용자 ID가 제공된 경우에만 잠금 상태 확인 (API Guard)
    // 아무도 잠그지 않았거나(null), 본인이 잠근 경우에만 업데이트 허용
    if (userId) {
      query = query.or(`locked_by.is.null,locked_by.eq.${userId}`);
    }
    
    return await query.select('*', { count: 'exact' });
  },

  /**
   * 프로젝트 상세 데이터 단건 조회 (워크스페이스 진입 시)
   */
  async fetchProjectDetail(projectId) {
    return await supabase
      .from('projects')
      .select('project_data, is_locked, locked_by, locked_at')
      .eq('id', projectId)
      .single();
  },

  /**
   * 프로젝트 삭제
   */
  async deleteProject(projectId) {
    return await supabase.from('projects').delete().eq('id', projectId);
  },

  /**
   * [의도 기반 API] 프로젝트 잠금 획득 (Atomic Acquire)
   */
  async acquireLock(projectId, userId, lockTime = null) {
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const newLockTime = lockTime || new Date().toISOString();

    return await supabase
      .from('projects')
      .update({ 
        is_locked: true, 
        locked_by: userId, 
        locked_at: newLockTime 
      })
      .eq('id', projectId)
      // [원자적 잠금] 아무도 잠그지 않았거나, 내가 이미 잠갔거나, 잠금이 정체(Stale)된 경우에만 성공
      .or(`locked_by.is.null,locked_by.eq.${userId},locked_at.lt.${staleThreshold}`)
      .select('*', { count: 'exact' });
  },

  /**
   * [의도 기반 API] 프로젝트 잠금 해제 (Atomic Release)
   * 소유권 검증을 통해 본인의 잠금만 해제 가능
   */
  async releaseLock(projectId, userId) {
    if (!userId) {
      console.warn('⚠️ [projectService] userId 없이 releaseLock이 호출되었습니다. 해제가 무시될 수 있습니다.');
    }

    return await supabase
      .from('projects')
      .update({ 
        is_locked: false, 
        locked_by: null, 
        locked_at: null 
      })
      .eq('id', projectId)
      .eq('locked_by', userId) // 반드시 소유자 본인이어야 함
      .select('*', { count: 'exact' });
  },

  /**
   * [의도 기반 API] 프로젝트 강제 해제 (Force Release / Takeover)
   * 타인의 좀비 잠금이나 정체된 잠금을 강제로 풀 때 사용
   */
  async forceReleaseLock(projectId) {
    return await supabase
      .from('projects')
      .update({ 
        is_locked: false, 
        locked_by: null, 
        locked_at: null 
      })
      .eq('id', projectId)
      // 강제 해제는 소유자 체크 없이 ID만으로 수행 (관리자 기능 또는 Takeover 시나리오)
      .select('*', { count: 'exact' });
  },

  /**
   * [하위 호환용] 프로젝트 잠금/해제 설정 (Atomic Update 적용)
   * 점진적 폐기 대상이며, 신규 코드는 acquireLock / releaseLock 사용 권장
   */
  async setProjectLock(projectId, isLocked, userId, lockTime = null) {
    if (isLocked) {
      return this.acquireLock(projectId, userId, lockTime);
    } else {
      // [Bug #3 Fix] userId가 null인 경우 강제 해제(force)로 간주하여 처리
      if (!userId) {
        return this.forceReleaseLock(projectId);
      }
      return this.releaseLock(projectId, userId);
    }
  },

  /**
   * 하트비트 (잠금 시간 갱신 - 원자적 처리)
   */
  async updateHeartbeat(projectId, userId) {
    return await supabase
      .from('projects')
      .update({ locked_at: new Date().toISOString() })
      .eq('id', projectId)
      .eq('locked_by', userId) // 내가 잠금을 소유하고 있을 때만 갱신 가능
      .select('*', { count: 'exact' });
  },

  /**
   * Custom IP 추가
   */
  async addCustomIp(category, name, description, currentUser) {
    return await supabase
      .from('custom_ips')
      .insert([{ category, name, description, created_by: currentUser }])
      .select();
  },

  /**
   * Custom IP 수정
   */
  async updateCustomIp(id, updatedData) {
    return await supabase
      .from('custom_ips')
      .update(updatedData)
      .eq('id', id)
      .select();
  },

  /**
   * Custom IP 삭제
   */
  async deleteCustomIp(id) {
    return await supabase.from('custom_ips').delete().eq('id', id);
  },

  /**
   * 프로젝트 복제 및 복원 시 Upsert
   */
  async upsertProject(projectPayload) {
    return await supabase.from('projects').upsert(projectPayload);
  }
};
