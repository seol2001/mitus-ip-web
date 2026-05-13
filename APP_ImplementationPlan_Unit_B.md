# APP_ImplementationPlan_Unit_B: UI 구조 조각화 (상세 실행 계획)

본 계획은 `App.jsx`의 거대한 렌더링 블록을 독립된 컴포넌트로 분리하여 UI 구조를 체계화하고 파일 부피를 획기적으로 줄이는 상세 로드맵입니다. 각 단계마다 UI 무결성을 검증하고 수정 사항을 기록합니다.

## 📌 핵심 원칙
1. **디자인 유지**: UI 디자인, CSS 클래스, 레이아웃 구조는 1%도 수정하지 않습니다.
2. **MLX 전담**: 컴포넌트 분리 설계 및 코드 이전 작업은 전적으로 로컬 MLX 모델을 사용합니다.
3. **무결성 보장**: 프롭스(Props) 전달 과정에서 데이터나 핸들러가 누락되지 않도록 엄격히 관리합니다.
4. **D2C 프롬프팅 적용**: MLX 추론 시 '생각 과정'을 생략하고 '코드 결과물'에 집중하는 구조화된 프롬프트를 사용하여 토큰 유실을 방지합니다.
5. **MLX + bkit 중심의 4단계 협업 고도화**: 
   - **1단계 (분석 - MLX)**: 컴포넌트 설계 및 Props 인터페이스 사전 정의, 안티패턴 정밀 분석. 결과를 `bkit_memory`에 영구 저장.
   - **2단계 (검증 - bkit)**: `bkit_pre_write_check`를 통해 설계 문서와 구현 방향의 일치 여부 확인.
   - **3단계 (구현 - Cloud Gemini)**: MLX 설계와 bkit 검증 결과를 기반으로 코드 생성 및 `App.jsx` 주입.
   - **4단계 (사후 분석 - bkit)**: `bkit_pdca_analyze`를 사용하여 설계와 구현 사이의 간극(Gap) 분석 및 사용자 QA.

---

## 🛠 1단계: 앱 종료 확인 모달 분리 (AppExitModal)
- **작업 내용**: 
  - `App.jsx` 하단의 `showAppExitWarning` 관련 JSX 블록을 `src/components/modals/AppExitModal.jsx`로 분리.
- **검증 계획**:
  - [ ] **[AI 코드 분석] Props 누락**: `isOpen`, `onClose`, `onConfirm` 등 필수 Prop이 새 컴포넌트에 인터페이스로 정의되고 `App.jsx`에서 올바르게 전달되는지 확인.
  - [ ] **[브라우저 동작 확인] 디자인 무결성**: 분리 전후의 모달 배경 블러 처리, 중앙 정렬, 폰트 스타일이 캡처 화면과 동일한지 확인.
- **수정 기록 지침**:
  - 파일 이름 규칙: `APP_StepLog_UnitB_Step1.md`
  - 내용: 수정된 함수의 라인 번호, 변경 전/후 로직 요약, 이슈 및 해결 방법 포함.
- **핵심 원칙 준수**: [x] 디자인 유지, [ ] MLX 전담, [ ] 독립성 보장

## 🛠 2단계: 워크스페이스 뷰 독립 및 Props 매핑 (WorkspaceView)
- **작업 내용**: 
  - `viewState === 'WORKSPACE'` 블록 전체를 `src/components/WorkspaceView.jsx`로 고립.
- **bkit 워크플로우 적용**:
  - [ ] **[bkit] 메모리 기록**: MLX가 분석한 `App.jsx`의 상태/핸들러(약 30개 이상)를 `bkit_memory_write`에 저장하여 유실 방지.
  - [ ] **[bkit] 사전 체크**: `bkit_pre_write_check` 실행하여 설계서 및 PDCA 준수 여부 확인.
  - [ ] **[bkit] 간극 분석**: 구현 후 `bkit_pdca_analyze`를 통해 Props 누락 여부 최종 확인.
- **검증 계획**:
  - [ ] **[AI 코드 분석] 데이터 흐름**: `activeProject`, `currentData` 등 거대 객체가 하위 탭까지 누락 없이 전달되는지 확인.
  - [ ] **[브라우저 동작 확인] 조건부 렌더링**: 타인 점유 시 읽기 전용 모드 전환 및 저장 버튼 비활성화 확인.
- **핵심 원칙 준수**: [x] 디자인 유지, [x] MLX 전담, [x] 독립성 보장

## 🛠 3단계: 대시보드 UI 구조 세분화 및 모듈화 (Dashboard UI Refactoring)
- **작업 내용**: 
  - `Dashboard.jsx` (1000+ 라인)를 기능별 소형 컴포넌트로 분리 완료.
  - 분리 완료: `DashboardHeader`, `DashboardStats`, `ProjectCard`, `IpDictionarySection`, `SubBlockCatalogSection`, `DashboardModals`.
- **bkit 워크플로우 적용**:
  - [x] **[MLX] Props 분석**: MLX-Qwen을 통해 컴포넌트 간 Props 인터페이스 사전 정의 및 `bkit_memory` 기록 완료.
  - [x] **[bkit] 사전 체크**: `bkit_pre_write_check` 실행 및 통과.
  - [x] **[bkit] 간극 분석**: `bkit_pdca_analyze`를 통해 설계 대비 구현 일치율 100% 확인.
- **검증 결과**:
  - `Dashboard.jsx` 부피가 75% 감소하였으며, 디자인 무결성이 유지됨.
- **핵심 원칙 준수**: [x] 디자인 유지, [x] MLX 전담, [x] 독립성 보장

- **핵심 원칙 준수**: [x] 디자인 유지, [x] MLX 전담, [x] 독립성 보장

## 🛠 5단계: Revision Log 탭 로직 안정화 (Stabilization)
- **작업 내용**: 
  - FA 연동 및 해제 로직의 정합성 확보.
  - 중복 컨펌 모달 제거 및 비동기 저장 가드 정밀화.
- **검증 결과**: 
  - `APP_StepLog_UnitB_Step5.md`에 기록 완료 (2026-05-07).
- **핵심 원칙 준수**: [x] 디자인 유지, [x] MLX 전담, [x] 독립성 보장

## 🛠 6단계: Revision Log 탭 UI 세분화 (RevisionLogTab Fragmentation)
- **작업 내용**: 
  - 1,100라인이 넘는 `RevisionLogTab.jsx`를 기능별 컴포넌트로 분리하여 '몬스터 파일' 문제 해결.
- **하위 컴포넌트 분리 계획**:
  - `LogHeaderSection.jsx`: IP 선택 드롭다운, 통계 요약, 필터링 UI.
  - `IssueCardList.jsx`: 이슈 카드 렌더링 로직(Historical Context 포함).
  - `LogModals.jsx`: Pull FA 모달, 삭제 확인 모달 등 통합.
- **bkit 워크플로우 적용**:
  - [ ] **[MLX] Props 인터페이스 정의**: 방대한 핸들러와 상태값이 자식 컴포넌트로 누락 없이 전달되도록 MLX로 사전 설계.
  - [ ] **[bkit] 메모리 기록**: 설계된 Props 매핑 테이블을 `bkit_memory_write`에 기록.
  - [ ] **[bkit] 사전 체크**: `bkit_pre_write_check` 실행하여 리팩토링 중 로직 유실 방지.
- **검증 계획**:
  - [ ] **[AI 코드 분석]**: 분리된 컴포넌트 간의 `formData` 동기화 무결성 확인.
  - [ ] **[브라우저 동작 확인]**: 카드 삭제, FA 연동, 실시간 필터링 기능이 기존과 100% 동일하게 작동하는지 확인.
- **핵심 원칙 준수**: [ ] 디자인 유지, [ ] MLX 전담, [ ] 독립성 보장

---

## ✅ 최종 검증 체크리스트
- [x] 단계 1: 앱 종료 확인 모달 분리 완료
- [x] 단계 2: 워크스페이스 뷰 독립 및 Props 매핑 완료
- [x] 단계 3: 대시보드 UI 구조 세분화 완료
- [x] 단계 4: 워크스페이스 뷰 내부 UI 세분화 완료
- [x] 단계 5: Revision Log 탭 로직 안정화 완료
- [ ] 단계 6: Revision Log 탭 UI 세분화 예정

---

## 💡 로컬 모델(MLX-Qwen) 활용 가이드라인 및 레슨런
Unit B 작업 과정에서 도출된 로컬 추론형 모델(MLX-Qwen 27B 등)의 특징과 한계를 바탕으로, 본 프로젝트 전반에 적용할 프롬프팅 및 환경 설정 가이드라인입니다.

1. **프롬프팅 전략: 억압 대신 분리 유도 (Structured Output)**
   - **문제**: "생각하지 마(No thinking)", "JSON만 출력해"와 같은 강력한 부정어 제약(Negative Prompting)은 추론형 모델에서 쉽게 무시되며, 오히려 불필요한 텍스트 출력으로 이어집니다.
   - **해결**: 모델의 본능적인 '단계별 추론(Chain-of-Thought)'을 허용하되, `<think>생각 과정</think>`와 같이 별도 태그로 격리시키고 최종 결과물만 `<json>결과</json>` 등에 담도록 구조화된 출력을 요구해야 합니다.
2. **토큰 자원 할당: `max_tokens`의 여유로운 설정**
   - **문제**: 복잡한 코드 블록 분석 시, 모델이 추론을 작성하다가 `max_tokens`(예: 1200) 제한에 걸려 실제 결과물 출력이 중간에 잘리는 현상(Truncation)이 발생합니다.
   - **해결**: 코드 구조 분석이나 컴포넌트 Props 추출과 같은 고부하 태스크에서는 `max_tokens`를 최소 2000~4000 이상으로 넉넉하게 설정하여 모델이 작업을 끝마칠 수 있는 환경을 보장해야 합니다.
3. **태스크 세분화 (Single-Purpose Prompting)**
   - 한 번의 프롬프트로 "분석하고, 코드 짜고, JSON으로 포맷팅해"라고 요구하는 대신, "1. 상태만 추출해", "2. 함수만 추출해"처럼 로컬 모델의 처리 한계에 맞춰 지시를 잘게 쪼개는 것이 정확도를 높이는 지름길입니다.
