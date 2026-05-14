import { supabase } from '../supabaseClient';
import { sanitizeError } from '../utils/securityUtils';

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
      error: sanitizeError(error || customIpsError)
    };
  },

  /**
   * 신규 프로젝트 생성
   */
  async createProject(projectMeta) {
    const { data, error } = await supabase.from('projects').insert([projectMeta]);
    return { data, error: sanitizeError(error) };
  },

  /**
   * 프로젝트 데이터 업데이트 (Tab Submit 등)
   */
  async updateProjectData(projectId, projectData, updatedTime, userId, signal = null) {
    const { data, error, count } = await supabase
      .from('projects')
      .update({ 
        project_data: projectData, 
        updated: updatedTime,
        locked_at: updatedTime 
      })
      .eq('id', projectId)
      .eq('locked_by', userId)
      .select('*', { count: 'exact' })
      .abortSignal(signal); // AbortSignal 연동

    return { data, error: sanitizeError(error), count };
  },

  /**
   * 프로젝트 메타데이터 및 데이터 전체 업데이트 (병합/가져오기 등)
   */
  async updateProject(projectId, updatePayload, userId = null, signal = null) {
    let query = supabase
      .from('projects')
      .update(updatePayload)
      .eq('id', projectId);
      
    if (userId) {
      query = query.or(`locked_by.is.null,locked_by.eq.${userId}`);
    }
    
    const { data, error, count } = await query
      .select('*', { count: 'exact' })
      .abortSignal(signal);
    return { data, error: sanitizeError(error), count };
  },

  /**
   * 프로젝트 상세 데이터 단건 조회 (워크스페이스 진입 시)
   */
  async fetchProjectDetail(projectId) {
    const { data, error } = await supabase
      .from('projects')
      .select('project_data, is_locked, locked_by, locked_at')
      .eq('id', projectId)
      .single();
    return { data, error: sanitizeError(error) };
  },

  /**
   * 프로젝트 삭제
   */
  async deleteProject(projectId) {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    return { error: sanitizeError(error) };
  },

  /**
   * [의도 기반 API] 프로젝트 잠금 획득 (Atomic Acquire)
   * @param {string} projectId
   * @param {string} userId
   * @param {boolean} force - 활성 잠금이라도 강제로 탈취할지 여부 (Atomic Seizure)
   */
  async acquireLock(projectId, userId, force = false, lockTime = null, signal = null) {
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const newLockTime = lockTime || new Date().toISOString();

    let query = supabase
      .from('projects')
      .update({ 
        is_locked: true, 
        locked_by: userId, 
        locked_at: newLockTime 
      })
      .eq('id', projectId);

    if (force) {
    } else {
      query = query.or(`locked_by.is.null,locked_by.eq.${userId},locked_at.lt.${staleThreshold}`);
    }

    const { data, error, count } = await query
      .select('*', { count: 'exact' })
      .abortSignal(signal);
    return { data, error: sanitizeError(error), count };
  },

  /**
   * [의도 기반 API] 프로젝트 잠금 해제 (Atomic Release)
   * 소유권 검증을 통해 본인의 잠금만 해제 가능
   */
  async releaseLock(projectId, userId) {
    if (!userId) {
      console.warn('⚠️ [projectService] userId 없이 releaseLock이 호출되었습니다. 해제가 무시될 수 있습니다.');
    }

    const { data, error, count } = await supabase
      .from('projects')
      .update({ 
        is_locked: false, 
        locked_by: null, 
        locked_at: null 
      })
      .eq('id', projectId)
      .eq('locked_by', userId)
      .select('*', { count: 'exact' });
    return { data, error: sanitizeError(error), count };
  },

  /**
   * [의도 기반 API] 프로젝트 강제 해제 (Force Release / Takeover)
   * 타인의 좀비 잠금이나 정체된 잠금을 강제로 풀 때 사용
   */
  async forceReleaseLock(projectId) {
    const { data, error, count } = await supabase
      .from('projects')
      .update({ 
        is_locked: false, 
        locked_by: null, 
        locked_at: null 
      })
      .eq('id', projectId)
      .select('*', { count: 'exact' });
    return { data, error: sanitizeError(error), count };
  },

  /**
   * [하위 호환용] 프로젝트 잠금/해제 설정 (Atomic Update 적용)
   * 점진적 폐기 대상이며, 신규 코드는 acquireLock / releaseLock 사용 권장
   */
  async setProjectLock(projectId, isLocked, userId, lockTime = null) {
    if (isLocked) {
      return this.acquireLock(projectId, userId, false, lockTime);
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
    const { data, error, count } = await supabase
      .from('projects')
      .update({ locked_at: new Date().toISOString() })
      .eq('id', projectId)
      .eq('locked_by', userId)
      .select('*', { count: 'exact' });
    return { data, error: sanitizeError(error), count };
  },

  /**
   * Custom IP 추가
   */
  async addCustomIp(category, name, description, currentUser) {
    const { data, error } = await supabase
      .from('custom_ips')
      .insert([{ category, name, description, created_by: currentUser }])
      .select();
    return { data, error: sanitizeError(error) };
  },

  /**
   * Custom IP 수정
   */
  async updateCustomIp(id, updatedData) {
    const { data, error } = await supabase
      .from('custom_ips')
      .update(updatedData)
      .eq('id', id)
      .select();
    return { data, error: sanitizeError(error) };
  },

  /**
   * Custom IP 삭제
   */
  async deleteCustomIp(id) {
    const { error } = await supabase.from('custom_ips').delete().eq('id', id);
    return { error: sanitizeError(error) };
  },

  /**
   * 프로젝트 복제 및 복원 시 Upsert
   */
  async upsertProject(projectPayload) {
    const { data, error } = await supabase.from('projects').upsert(projectPayload);
    return { data, error: sanitizeError(error) };
  }
};
