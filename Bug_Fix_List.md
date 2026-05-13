# 🐛 Bug Fix List - mitus-ip-web

## 🏗️ 개발 원칙 및 시스템 가이드라인 (Unit D 기반)

> [!IMPORTANT]
> 본 프로젝트의 모든 수정 작업은 아래의 핵심 원칙을 엄격히 준수합니다.

1. **디자인 유지 (UI/UX Preservation)**: UI 디자인, CSS 클래스명, 레이아웃 구조는 절대 수정하지 않습니다. 모든 작업은 '보이지 않는 로직'의 고도화에 집중합니다.
2. **멀티 모델 협업 분석 (gemma4 & 27b)**: 복잡한 논리 판단 및 데이터 스키마 설계 시, **gemma4 모델의 1차 분석**과 **27b 모델의 크로스 체크 절차**를 거쳐 분석의 정밀도와 신뢰성을 확보합니다.
3. **D2C (Direct-to-Code) 프롬프팅**: 추론 시 구조화된 프롬프트를 사용하여 토큰 유실을 방지하고 코드 정합성을 극대화합니다.
4. **bkit 기반 PDCA 협업**:
   - **Plan/Design**: bkit을 통한 상세 설계 및 아키텍처 체크.
   - **Do**: 설계에 기반한 정밀한 코드 주입.
   - **Check/Act**: `bkit_pdca_analyze`를 활용한 구현 일치율(Gap) 분석 및 보정.
5. **데이터 무결성 보장**: Context API 기반의 중앙 집중형 상태 관리 체계를 존중하며, 기존 데이터 스키마나 프롭스(Props) 인터페이스를 파괴하지 않습니다.
6. **로직 독립성**: 보안, 로깅, 비즈니스 로직을 컨텍스트 수준에서 분리하여 가용성과 확장성을 유지합니다.

---

## 🧪 검증 및 품질 관리 절차 (QA Process)

모든 결함 수정은 아래의 **'Test-First'** 절차를 엄격히 준수합니다.

1.  **결함 스크리닝 (Screening)**: 새로운 결함 발견 시, 해당 결함을 재현하는 Playwright 테스트 케이스를 `tests/` 폴더 내에 작성합니다. 수정 전 실행하여 반드시 **Fail**이 뜨는 것을 확인합니다.
2.  **로직 분석 및 설계 (Plan)**: **gemma4 1차 분석 및 27b 크로스 체크**를 통해 원인을 파악하고 `Bug_Fix_List.md`에 해결 방안을 기술합니다.
3.  **코드 수정 (Do)**: 설계된 내용에 따라 소스 코드를 수정합니다.
4.  **최종 검증 (Verify)**: 작성했던 Playwright 테스트를 재실행하여 **Pass**로 전환됨을 확인하고, 관련 탭의 `deep_scan` 테스트를 통해 사이드 이펙트가 없음을 확증합니다.

---

## 🐞 수정 목록

### 1. ADD AS COPY 병합 시 히스토리 드롭다운 미표시 이슈
- **발견 날짜**: 2026-05-09
- **분석 도구**: gemma4 (1차 분석) & 27b (크로스 체크)
- **심각도 (Priority)**: 🔴 High (P1) - 핵심 버전 관리 워크플로우 차단
- **해결 난이도**: 🟢 Low - 상태 배열 업데이트 로직 추가만으로 해결 가능
- **증상**: 데이터 병합 시 'ADD AS COPY' 옵션을 선택하여 `_Imported` 접미사가 붙은 리비전을 생성했으나, 대시보드의 히스토리 드롭다운 리스트에 나타나지 않음.
- **원인 분석**: 대시보드의 히스토리 리스트는 프로젝트 테이블의 `phases` 배열 필드를 기반으로 렌더링됨. 현재 `src/App.jsx`의 `handleImportConfirm` 로직에서 병합 시 `project_data` 내부의 리비전 객체는 갱신하지만, 상위 레벨의 `phases` 배열을 업데이트하는 로직이 누락됨.
- **해결 방안**: `handleImportConfirm` 내에서 `mergedRevisions`의 키 리스트를 추출하여 `phases` 배열을 생성 및 업데이트.
- **수정 대상 파일**: [App.jsx](file:///Users/jacobseol/Library/CloudStorage/SynologyDrive-DS716p/Antigravity/Mitus_IP_Web/mitus-ip-web/src/App.jsx)
- **검증 테스트**: `tests/bug_screening.spec.js` (Case: "Bug #1")
- **진행 상태**: ✅ 수정 완료 (2026-05-13)
- **적용 내용**:
  - `phases` 배열이 `revisions` 키와 동기화되지 않는 근본 원인 해결
  - Demo/Real 양 모드에서 `phasesToAdd` 배열로 `overwrite` 및 `ADD AS COPY` 키를 모두 추적
  - `Array.from(new Set([...phases, ...phasesToAdd]))` 패턴으로 중복 없이 `phases` 갱신
  - Demo Mode: 백업 프로젝트를 별도 `backupEntries` 배열로 분리하여 리스트에 정상 추가
  - Real Mode: Optimistic Update + DB 실패 시 롤백 패턴 적용 (27b 크로스 체크 반영)

- **진행 상태**: ✅ 수정 완료 (2026-05-13)
- **적용 내용**:
  - `src/utils/projectUtils.js`에 `generateBackupProject` 팩토리 함수 도입 (아키텍처 개선)
  - 타임스탬프 포맷을 `YYYY-MM-DD HH:mm`으로 개선하여 가독성 확보 (gemma4 권고)
  - `name`과 `project_data.Project_Name`을 동기화하여 데이터 무결성 확보 (27b 권고)
  - `crypto.randomUUID()`를 활용하여 안전하고 고유한 백업 ID 생성
  - Demo/Real 모드 로직 통합으로 유지보수성 향상
- **원인 분석**: `src/App.jsx`의 백업 생성 로직에서 `name` 필드를 재정의하지 않아 원본 값이 그대로 유지됨.
- **해결 방안**: 백업 객체 생성 시 `name` 필드에 `(백업_timestamp)` 접미사를 추가.
- **수정 대상 파일**: [App.jsx](file:///Users/jacobseol/Library/CloudStorage/SynologyDrive-DS716p/Antigravity/Mitus_IP_Web/mitus-ip-web/src/App.jsx)
- **검증 테스트**: `tests/bug_screening.spec.js` (Case: "Bug #2")
- **진행 상태**: 🛠️ 분석 완료 (수정 대기 중)

- **진행 상태**: ✅ 수정 완료 (2026-05-13)
- **적용 내용**:
  - `Gemma4(설계자)` 권고에 따라 **IoC(제어의 역전)** 패턴을 도입하여 `useNavigationGuard`와 `App.jsx` 간의 역할 분리.
  - `27b(감리관)` 권고에 따라 **2단계 커밋(Confirm → Execute)** 순서를 보장하여 사용자 승인 시에만 종료 로직 실행.
  - `executeExit` 중앙 집중식 종료 함수를 호출함으로써 **Drain Pattern(진행 중인 저장 대기)** 및 **잠금 해제 API 호출**의 원자성 확보.
  - 불필요한 개별 상태 리셋 로직을 제거하여 **Single Source of Truth** 유지.

### 4. ReadOnly 모드 무결성 및 보안 강화 (Hardening)
- **발견 날짜**: 2026-05-10
- **분석 도구**: gemma4 (1차 분석) & 27b (크로스 체크)
- **심각도 (Priority)**: 🔴 Critical (P0) - 데이터 무결성 및 보안 핵심 위험
- **해결 난이도**: 🔴 High - 하트비트, API 가드, DB 원자적 잠금 등 다층 수정 필요
- **증상**: 다중 사용자 접속 시 '읽기 전용' 사용자가 데이터를 수정하거나 잠금 권한이 충돌할 가능성 존재.
- **해결 방안**: 하트비트 표시 개선, API 가드 강화, SQL 원자적 잠금 구현 등.
- **수정 대상 파일**: [App.jsx](file:///Users/jacobseol/Library/CloudStorage/SynologyDrive-DS716p/Antigravity/Mitus_IP_Web/mitus-ip-web/src/App.jsx), [projectService.js](file:///Users/jacobseol/Library/CloudStorage/SynologyDrive-DS716p/Antigravity/Mitus_IP_Web/mitus-ip-web/src/services/projectService.js)
- **검증 테스트**: `tests/auth_security.spec.js`
- **진행 상태**: ✅ 수정 완료 (2026-05-13)
- **적용 내용**:
  - `projectService.js`: 비원자적 상태 접근을 제거하고 `.or()` 쿼리를 활용한 **Atomic Lock** 구현 (Check-and-Set 연산).
  - `projectService.js` / `App.jsx`: 병합/파생/수정 등 모든 데이터 변경 API에 **`locked_by` 검증 가드(API Guard)** 적용.
  - `useProjectLock.js` / `App.jsx`: Supabase Realtime을 통한 **즉각적인 잠금 탈취 인지 및 Soft Lock 전환** 구현.
  - 하트비트 및 폴링 주기 단축(1분)을 통해 연결 불안정 대응력 강화.

### 5. 대시보드 잠금 배너 논리적 모순 및 UX 개선
- **발견 날짜**: 2026-05-13
- **분석 도구**: gemma4 (디자인) & 27b (감리)
- **심각도 (Priority)**: 🟡 Medium (P2) - 사용자 시각적 혼동 및 UX 저해
- **증상**: 본인이 점유한 프로젝트임에도 대시보드에서 타인 점유와 동일한 경고 배너가 표시됨.
- **원인 분석**: `ProjectCard` 컴포넌트가 소유주를 구분하지 않고 `is_locked` 상태일 경우 일괄적으로 경고 배너를 렌더링함.
- **해결 방안**: 본인 점유 시 배너 숨김 처리 및 타인 점유 시 '마지막 활동 시간' 명시로 문구 개선.
- **수정 대상 파일**: [ProjectCard.jsx](file:///Users/jacobseol/Library/CloudStorage/SynologyDrive-DS716p/Antigravity/Mitus_IP_Web/mitus-ip-web/src/components/dashboard/ProjectCard.jsx)
- **진행 상태**: ✅ 수정 완료 (2026-05-13)
- **적용 내용**:
  - `locked_by === currentUser` 조건 시 배너 렌더링 차단 (시각적 노이즈 제거).
  - `(마지막 활동 N분 전)` 문구 도입으로 시간 정보의 의미 명확화.
  - 10분 이상 비활성 시 `- 권한 회수 가능` 안내 추가로 사용자 액션 유도.
  - `useMemo` 적용으로 성능 최적화 및 안정성 확보.

---

## 💡 종합 의견 및 전략적 제안

본 프로젝트의 결함 목록을 종합적으로 분석한 결과, **상태 관리의 일관성**과 **보안/무결성** 확보가 가장 시급한 과제입니다.

1. **우선순위 전략**: 
   - 데이터 손실 및 협업 차단 위험이 큰 **Bug #3(잠금 해제)**과 **Bug #4(보안 강화)**를 최우선으로 처리해야 합니다. 
   - 이후 핵심 기능인 **Bug #1(히스토리)**을 처리하고, UX 개선 항목인 **Bug #2(백업 명칭)**를 마무리하는 순서를 권장합니다.

2. **개발 원칙 준수 진단**: 
   - 현재 모든 분석이 **gemma4 및 27b** 교차 분석을 통해 원칙에 맞게 수행되고 있으며, **Test-First** 절차가 엄격히 정의되어 있어 품질 유지에 매우 유리한 구조입니다. 
   - 다만, **Bug #4**와 같이 복잡한 백엔드/DB 로직 수정 시 "기존 인터페이스 파괴 금지(원칙 5)"와 충돌할 가능성이 있으므로 점진적 도입 전략이 필요합니다.

3. **향후 개선 제안**:
   - 1. **분석 모델 고도화**: gemma4와 27b의 교차 검증 결과를 최종 구현 전 인간 개발자가 한 번 더 검토하는 프로세스를 상시화하여 환각(Hallucination) 리스크를 원천 차단하세요.
   - **테스트 자동화**: 브라우저 뒤로가기 및 다중 사용자 충돌 상황을 Playwright 시나리오에 상시 포함하여 회귀 테스트를 강화할 것을 제안합니다.
