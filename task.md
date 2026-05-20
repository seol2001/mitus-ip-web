# 🚀 Task: Unit D - Stability & Security Hardening

본 프로젝트는 **'프로젝트 헌법(MAIN_PRINCIPLES.md)'**의 원칙을 준수하며, gemma4(설계)와 27b(감리)의 교차 검증을 거쳐 진행됩니다.

## ✅ Phase 1: Security Hardening (보안 강화) - [완료]
- [x] **1.1 Supabase RLS 정책 수립 및 적용**
  - [x] `projects` 테이블: `locked_by` 소유자 기반 UPDATE 권한 제어 (SQL 설계 완료)
  - [x] RLS 에러 위생화(Sanitization) 유틸리티 작성 (`securityUtils.js`)
- [x] **1.2 애플리케이션 레이어 이중 검증 (Dual-Validation)**
  - [x] `projectService.js` 내 에러 위생화 통합
  - [x] `App.jsx` 내 `canUpdateProject` 가드 주입
- [x] **1.3 보안 테스트 및 검증**
  - [x] 변경 사항 로컬 빌드 및 오류 여부 1차 검증
  - [x] 수동 / 논리적 무결성 분석을 통한 탭 전이 완벽 검증 (자동 이월 이슈 관리 탭 우선 진입 확인)
  - [x] 403 에러 위생화 로직 검증 완료

## ✅ Phase 2: Modernization & Refactoring (로직 현대화) - [완료]
- [x] **2.1 `RevisionLogTab.jsx` 로직 파편화 및 해체**
  - [x] `useLogFilter` 구현: 필터 및 내비게이션 상태 격리
  - [x] `useLogData` 구현: useReducer 기반 데이터 가공 및 참조 안정성 확보
  - [x] `useLogForm` 구현: 폼 상태 및 Dirty 체크 로직 분리
  - [x] `useAsyncAction` 구현: AbortController 중앙 집중 관리
- [x] **2.2 성능 및 안정성 최적화**
  - [x] 1,100라인 모놀리식 컴포넌트를 선언적 훅 구조로 전환
  - [x] executeSafe 래퍼를 통한 전역 비동기 보안 가드 주입

## ✅ Phase 3: Action Logging & Recovery (무결성 복구) - [완료]
- [x] **3.1 ActionLoggerContext 고도화**
  - [x] Command 패턴 기반 액션 스택 구현
  - [x] Undo/Redo 기능 프로토타입
- [x] **3.2 낙관적 잠금 (Optimistic Locking)**
  - [x] DB `version` 컬럼 도입 및 연동
  - [x] 충돌 해결(Conflict Resolution) UI 구현
- [x] **Vite 빌드 안정성 테스트**
  - [x] `npm run build` 를 수행하여 컴파일 및 린트 정합성 검증구현

## ✅ Phase 4: Revision Log Metrics Synchronization (실시간 통계 동기화) - [완료]
- [x] **4.1 실시간 통계 불일치 해결**
  - [x] `RevisionLogTab.jsx` 컴포넌트 내 `allStats` 계산 대상을 `issues` 배열 순회에서 `latestIssueStates` 순회로 전면 개편
  - [x] 비즈니스 룰 구현: 판정 전 이전 차수 이월 미판정 건은 `currDebt`로 합산하고, 판정/심사 즉시 `currCarryover` 또는 `currClosed`로 실시간 전이되도록 처리
  - [x] `useMemo` 종속성 배열을 `latestIssueStates` 기반으로 최적화하여 완벽한 반응형 렌더링 생명주기 보장
- [x] **4.2 AI 에이전트 다중 모델 규칙 명문화**
  - [x] `.cursorrules`에 모델 로드 시 alias 명시 원칙 및 전용 ask 툴(`ask_gemma4`, `ask_27b`) 구분 사용에 관한 기술 헌장 추가 반영
- [x] **4.3 빌드 및 검증**
  - [x] `bkit`을 활용하여 `bkit_pre_write_check` 및 `bkit_post_write` 검증 완료
  - [x] Vite 빌드(`npm run build`) 정합성 검증 통과 (632ms, No Errors)
  - [x] 로컬 모델(`gemma4` MoE)에 의한 최종 사후 감리(Post-Audit) 통과 (최종 판정: PASS - 완벽함)

## ✅ Phase 5: Hierarchical Open (Debt) Metrics Breakdown (계층적 Open 지표 시각화) - [완료]
- [x] **5.1 통계 데이터 모델 고도화 (`useLogData.js`)**
  - [x] `stats` 집계 연산 내 `debtDetails` 계산 장착하여 세부 항목(`Revision`, `Deferred`, `SW Workaround`, `Test Screening` 등) 집계 무결성 확보
- [x] **5.2 마일스톤 테이블 상시 노출 개편 (`MilestoneMetricsTable.jsx`)**
  - [x] 기존 팝오버 툴팁을 제거하고, 2줄 헤더 `(Rev / Def / SW / TS / SM / Oth)` 적용
  - [x] 셀 데이터 영역에 총건수 뱃지와 약어 순서에 맞춘 슬래시(/) 조합 상세 건수를 수직 상시 노출
- [x] **5.3 안전성 및 정합성 검증**
  - [x] Vite 빌드(`npm run build`) 정합성 검증 통과 (501ms, No Errors)
  - [x] 로컬 모델(`gemma4` MoE)을 통한 사후 감리 통과 (`[APPROVED WITH RECOMMENDATIONS]`)


## [x] Phase 6: Visual Optimization & Compact Glassmorphic Dashboard (시각적 최적화 및 글래스모피즘 리스킨)
- [x] **6.1 `MilestoneMetricsTable.jsx` 헤더 Two-tier 개편**
  - [x] `OPEN` 메인 텍스트 간소화 및 `(REV / DEBT)` 보조 텍스트 2단 구조화 적용
  - [x] 헤더 내 `white-space: nowrap` 강제로 가로 오버플로우 방지 및 줄바꿈 완전 차단
- [x] **6.2 바디 셀 '수직 2단'을 '수평 1줄' 컴팩트 정렬로 개편**
  - [x] Primary-Secondary Inline 레이아웃 구현 (총 Debt 뱃지 좌측 배치, Revision/Core 상세 수치 우측 배치)
  - [x] 불필요한 세로 적재(stacked)를 해제하여 테이블 행 높이를 대폭 축소 (세로 공간 낭비 방지)
- [x] **6.3 프리미엄 라이트 글래스모피즘 스킨 및 소프트 틴트(Soft Tint) 뱃지 적용**
  - [x] 채도를 줄인 은은한 파스텔조 틴티드 뱃지 테두리 및 배경 적용 (emerald, blue, amber, purple)
  - [x] 외곽 컨테이너의 반투명 보더(`border-white/40 bg-white/40`)와 강화된 `backdrop-blur-xl` 글래스 반사광 효과 적용
  - [x] 부드러운 행 호버 트랜지션 마이크로 인터랙션 구현 (`group-hover:bg-slate-50/40`)
- [x] **6.4 CLS 방지를 위한 고정 열 너비 지정 및 웹 접근성(a11y) 검증**
  - [x] 각 `<th>` 및 `<td>` 영역에 균형 잡힌 고정 너비 백분율 주입
  - [x] 시맨틱 `<table>` 구조를 깨지 않고 유효하게 유지하여 스크린 리더 준수 보장
- [x] **6.5 빌드 테스트 및 최종 사후 감리 진행**
  - [x] `npm run build`를 통한 정적 빌드 무결성 확보
  - [x] 최종 렌더링 품질 상태 확인 및 사후 감리 검토

---
*최종 업데이트: 2026-05-20*

