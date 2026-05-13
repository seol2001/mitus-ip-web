/**
 * 프로젝트 관련 유틸리티 및 팩토리 함수
 */

/**
 * 사용자 가독성을 위한 타임스탬프 포맷팅 (YYYY-MM-DD HH:mm)
 */
export const formatDisplayTimestamp = (date) => {
  const pad = (n) => n.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

/**
 * 백업 프로젝트 객체 생성 (Factory Function)
 * @param {Object} original - 원본 프로젝트 객체
 * @returns {Object} 백업 정보가 적용된 심층 복제된 프로젝트 객체
 */
export const generateBackupProject = (original) => {
  // 1. 심층 복제 (Reference Sharing 방지)
  // structuredClone이 지원되지 않는 환경을 고려한 fallback 포함
  const clone = typeof structuredClone === 'function' 
    ? structuredClone(original) 
    : JSON.parse(JSON.stringify(original));

  const now = new Date();
  const displayTime = formatDisplayTimestamp(now);
  const suffix = ` (백업_${displayTime})`;
  
  // 2. 고유 ID 생성 (UUID 또는 secure random)
  const uniqueId = `${original.id}_BAK_${crypto.randomUUID ? crypto.randomUUID().split('-')[0] : Date.now()}`;

  // 3. 필드 업데이트
  const updatedProject = {
    ...clone,
    id: uniqueId,
    name: `${original.name}${suffix}`,
    updated: now.toISOString(),
    is_archived: true,
    is_locked: false,
    locked_by: null,
    locked_at: null
  };

  // 4. 내부 메타데이터 동기화 (Single Source of Truth)
  if (updatedProject.project_data) {
    updatedProject.project_data.Project_Name = updatedProject.name;
    // project_data 내부의 기본 메타데이터도 갱신
    if (updatedProject.project_data.projectId) {
      updatedProject.project_data.projectId = uniqueId;
    }
  }

  return updatedProject;
};
