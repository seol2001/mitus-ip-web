/**
 * 보안 및 무결성을 위한 유틸리티 모음
 */

/**
 * 백엔드(Supabase/PostgreSQL) 에러를 프론트엔드용으로 위생화(Sanitization)합니다.
 * 27B 감리 반영: 화이트리스트 기반 매핑 및 정규식을 통한 식별자(제약조건 등) 제거.
 */
export const sanitizeError = (error) => {
  if (!error) return null;

  // 1. 에러 메시지 내 민감한 식별자 제거 (쿼음표로 감싸진 테이블명, 제약조건명 등)
  // 예: "violates check constraint 'projects_locked_by_check'" -> "내부 제약 조건을 위반했습니다."
  let safeMessage = error.message || "요청 처리 중 오류가 발생했습니다.";
  safeMessage = safeMessage.replace(/["'].*?["']/g, '***'); // 식별자 가리기

  // 2. 에러 코드별 화이트리스트 매핑
  const ERROR_MAP = {
    '42501': "해당 작업에 대한 권한이 없습니다. (접근 거부)",
    '23505': "이미 존재하는 데이터입니다. (중복 오류)",
    '23503': "관련된 데이터가 있어 작업을 수행할 수 없습니다.",
    'PGRST116': "데이터를 찾을 수 없습니다.",
    '403': "보안 정책에 의해 접근이 차단되었습니다."
  };

  const isSecurityError = error.code === '42501' || error.status === 403;

  return {
    code: error.code || 'UNKNOWN',
    message: ERROR_MAP[error.code] || ERROR_MAP[error.status] || "서버 통신 중 오류가 발생했습니다.",
    isSecurityError,
    // [DEBUG ONLY] 개발 환경에서만 원본 메시지를 확인하고 싶을 경우 별도 로직 필요 (운영에서는 절대 금지)
    _isSanitized: true
  };
};

/**
 * 프로젝트 수정 권한 여부를 클라이언트 사이드에서 1차 검증합니다 (Dual-Validation).
 * 
 * @param {Object} project - 프로젝트 객체
 * @param {string} currentUserId - 현재 로그인한 사용자 ID
 * @returns {boolean} 수정 가능 여부
 */
export const canUpdateProject = (project, currentUserId) => {
  if (!project) return false;
  
  // 잠금이 없거나, 본인이 잠근 경우에만 허용
  const isOwner = !project.locked_by || project.locked_by === currentUserId;
  const isArchived = project.is_archived === true;
  
  return isOwner && !isArchived;
};
