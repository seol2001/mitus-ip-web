/**
 * Revision Log 관련 순수 비즈니스 로직 모듈
 * UI 및 사이드 이펙트가 없는 순수 함수들로 구성됩니다.
 */

/**
 * 이슈의 최종 상태를 판별합니다.
 * @param {Object} item 이슈 데이터 객체
 * @returns {'OPEN' | 'CLOSED' | 'DEFERRED'}
 */
export const DISPOSITION_OPTIONS = ['Waived', 'Acceptable', 'SW Workaround', 'Test Screening', 'System Mitigation', 'Revision', 'Closed'];

export const SEVERITY_OPTIONS = ['Marginal', 'Fail', 'Major', 'Minor'];

export const VERIFICATION_GAP_OPTIONS = [
  'Verification Plan Omission',
  'Model/PDK Mismatch',
  'Simulation Limitation',
  'Review Miss (Human Error)',
  'Spec Ambiguity',
  'Etc.'
];

export const getIssueStatus = (item) => {
  if (!item) return 'OPEN';

  // 1. 평가(eval) 모드
  if (item.entryMode === 'eval') {
    if (item.assessment === 'Deferred') return 'DEFERRED';
    if (item.assessment === 'Fixed') return 'CLOSED';
    return 'OPEN';
  }

  // 2. 재오픈(reopen) 모드
  if (item.entryMode === 'reopen') return 'OPEN';

  // 3. 이월(carryover) 모드
  if (item.entryMode === 'carryover') {
    return item.carryoverAction === 'Close' ? 'CLOSED' : 'OPEN';
  }

  // 4. 신규(new) / FA(fa) 모드
  return 'OPEN';
};

/**
 * 새 이슈 등록을 위한 기본 폼 데이터를 생성합니다.
 * @param {string} ip 현재 선택된 IP Block
 * @param {string} issueNum 자동 채번된 이슈 번호
 * @returns {Object} 초기화된 폼 데이터 객체
 */
export const makeDefaultForm = (ip, issueNum = '') => ({
  ipBlock: ip,
  subBlock: null,
  entryMode: 'new',
  issueNum,
  types: ['Initial'],
  severity: 'Minor',
  phenomenon: '',
  rootCause: '',
  disposition: 'Revision',
  justification: '',
  modPlan: '',
  verificationGap: '',
  gapComment: '',
  customerAlignment: 'Internal Only',
  customerReportType: 'N/A',
  sanitizedStory: '',
  customerFacingAttachments: '',
  customerAlignmentDetails: '',
  attachments: '',
  assignee: '',
  origin: '',
  escapeReason: '',
  sideEffectSource: ''
});

/**
 * 다음 이슈 번호를 계산합니다. (e.g. ISSUE#5)
 * @param {string} ip 대상 IP 블록
 * @param {Object} latestIssueStates 최신 이슈 상태 맵
 * @returns {string} 생성된 이슈 번호
 */
export const calcNextNum = (ip, latestIssueStates) => {
  let max = 0;
  const chk = (id) => {
    if (!id) return;
    const pts = id.split('.');
    if (pts[0] === ip) {
      const m = id.match(/#(\d+)/);
      if (m) {
        const n = parseInt(m[1]);
        if (n > max) max = n;
      }
    }
  };
  Object.keys(latestIssueStates || {}).forEach(id => chk(id));
  return `ISSUE#${max + 1}`;
};

/**
 * 특정 이슈의 전체 히스토리를 가져옵니다.
 * @param {string} id 이슈 ID
 * @param {Array} historyBlocks 과거 차수 데이터 블록
 * @param {Array} issues 현재 차수 이슈 목록
 * @param {string} project 프로젝트 명
 * @param {string} stage 현재 차수 명
 * @returns {Array} 히스토리 리스트
 */
export const getHistory = (id, historyBlocks, issues, project, stage) => {
  const list = [];
  (historyBlocks || []).forEach(b => {
    (b.issues || []).forEach(i => {
      const iId = i.entryMode === 'new' ? `${i.ipBlock}.${project}.${i.issueNum}` : i.targetIssue;
      if (iId === id) list.push({ stage: b.stageName, data: i });
    });
  });
  (issues || []).forEach(i => {
    const iId = i.entryMode === 'new' ? `${i.ipBlock}.${project}.${i.issueNum}` : i.targetIssue;
    if (iId === id) list.push({ stage: stage, data: i });
  });
  return list;
};
