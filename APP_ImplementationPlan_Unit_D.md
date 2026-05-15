# Implementation Plan - Unit D: Stability & Security Hardening (Phase 2 Focus)

## 🎯 Goal
`RevisionLogTab.jsx`의 1,100라인 모놀리식 구조를 해체하고, 커스텀 훅 및 `useReducer` 기반의 현대적 아키텍처로 전환하여 성능과 보안 무결성을 확보함.

## 🏗️ Phase 2: 로직 현대화 (Modernization) - [CURRENT]

### [Architecture: Granular Hook System]
27B 보안 감리 결과에 따라 단일 리듀서 대신 도메인별 분리된 상태 관리 체계를 채택함.

1.  **`useLogData` (The Core)**
    - 역할: Supabase 실시간 데이터 fetching, 정렬, 필터링 결과 관리.
    - 성능: `useMemo`를 통해 필터 변경 시에만 가공 데이터 재계산.
    - 가상화: 500개 이상의 로그 데이터를 처리하기 위해 `react-window` 도입 준비.

2.  **`useLogForm` (The Input)**
    - 역할: 로컬 폼 입력값, 에러 밸리데이션, Dirty 상태 관리.
    - 보안: 서버 응답 대기 중(`isFetching`) 입력 필드 비활성화로 TOCTOU 방어.

3.  **`useLogFilter` (The Navigator)**
    - 역할: IP 선택, 상태 필터, 검색 쿼리 관리.
    - 성능: 필터 변경이 폼이나 전체 데이터 구조를 파괴하지 않도록 독립적 상태 유지.

4.  **`useAsyncAction` (The Orchestrator)**
    - 역할: `AbortController` 라이프사이클 중앙 관리 및 전파.
    - 보안: 모든 비동기 요청에 대해 중도 취소 및 메모리 릭 방지.

### [Implementation Steps]
1.  **파일 분리**: `src/hooks/revisionLog/` 폴더를 생성하고 훅별로 파일 분리.
2.  **상태 객체 전환**: `Set`을 제거하고 일반 객체 또는 `Map`으로 직렬화 가능성 확보.
3.  **UI 매핑**: `RevisionLogTab.jsx`의 렌더링 로직은 그대로 유지하되, 내부 변수를 커스텀 훅에서 추출한 값으로 교체.
4.  **가상화 적용 (Variable Size)** - [CURRENT]
    - 라이브러리: `react-window` 도입.
    - 방식: `VariableSizeList`를 사용하여 확장/축소 상태에 따른 동적 높이 계산.
    - 성능 최적화: `resetAfterIndex` API를 활용하여 확장 시 레이아웃 재계산 및 60FPS 유지.

## ⚠️ User Review Required (Critical)
> [!IMPORTANT]
> **패키지 설치 필요**: `react-window` 라이브러리 설치가 필요합니다. 승인 시 `npm install`을 실행합니다.
> **레이아웃 제약**: 가상화 특성상 이슈 카드의 높이가 고정되어야 하므로, 내용이 아주 길 경우 텍스트 생략(`ellipsis`) 처리가 필요할 수 있습니다.

## 🔍 Verification Plan
- **성능 검사**: 가상화 적용 전후 렌더링 노드 수(DOM Count) 비교.
- **스크롤 테스트**: 대용량 데이터 주입 상태에서 스크롤 시 화이트 아웃(White-out) 현상 발생 여부 확인.
- **무결성 검사**: 필터 변경 시 가상화 리스트가 즉각적으로 데이터 동기화를 수행하는지 확인.

---

## 🚀 Step 4 Revision: Ultra-Precise Virtualization Procedure (Gemma4/27B 기반)

### [1] 실패 분석 및 교훈 (Post-Mortem)
1.  **Hooks 규칙 위반**: 렌더링 블록(IIFE) 내에서 `useMemo`를 호출하여 리액트 엔진 패닉 유발.
2.  **타입 참조 에러**: `HEADER` 항목에 없는 `data.id`를 참조하여 런타임 익셉션 발생.
3.  **구조적 정합성 상실**: 대규모 파일 교체 중 태그 짝 불일치 및 코드 누락 발생.

### [2] 27B 감리관의 화이트스크린 방지 체크리스트
- [ ] **Top-Down Logic**: 모든 가공 로직을 컴포넌트 상단 `useMemo`로 이전 완료했는가?
- [ ] **Defensive Access**: 모든 속성 접근 시 `?.` (Optional Chaining)을 적용했는가?
- [ ] **Component Decoupling**: 리스트 로직을 독립 컴포넌트로 분리하여 메인 파일의 복잡도를 낮췄는가?

### [3] 5단계 정밀 구현 시나리오
1.  **[1단계]** `src/components/tabs/RevisionLogVirtualList.jsx` [NEW] 생성 (로직 분리).
2.  **[2단계]** `RevisionLogTab.jsx` 상단에서 `virtualListData`를 `useMemo`로 안정적으로 준비.
3.  **[3단계]** `RevisionLogVirtualList`에 `getItemSize` 방어적 로직 구현.
4.  **[4단계]** 메인 컴포넌트의 IIFE 블록을 단일 서브 컴포넌트로 교체.
5.  **[완료]** 단계별 Lint 및 빌드 검사 수행.

---

## 🛠️ Step 5: 상태 및 비동기 로직 해체 시나리오 (Hook Decoupling Procedure)
**(Gemma4 아키텍처 초안 + 27B 보안/성능 감리 적용 버전)**

**목표:** 렌더링 최적화(가상화)가 완료된 메인 컴포넌트에서 비즈니스 로직을 5단계로 안전하게 추출하여 "화이트스크린 0%"를 보장함. 한 단계를 수행할 때마다 브라우저 검증을 필수로 진행함.

### [Phase 1] `useLogFilter` 분리 (단순 필터 상태)
- **추출 대상:** `ipDropdown`, `statusFilter` 등 UI 전용 검색/필터 상태.
- **Input/Output 인터페이스:** 
  - `Input`: 초기 필터 조건 (ex. `initialIp: 'All'`)
  - `Output`: `filters`, `setFilters`, `applyFilters`
- **방어적 코딩 (감리관 지침):** `useMemo`와 `useCallback`을 적극 사용하여 필터 변경 함수가 매번 재생성되는 것을 방지. 리렌더링 루프 원천 차단.
- **검증 포인트:** 드롭다운 클릭 시 화면이 깜빡이거나 멈추지 않고, 선택한 필터 상태가 잘 적용되는가?

### [Phase 2] Data Structure Refinement (Set을 Object/Map으로 전환)
- **추출 대상:** `expandedItems`, `needsEvalSet` 등 비직렬화(Non-serializable) 자료구조인 `Set`.
- **Input/Output 인터페이스:** 
  - `Input`: 원본 리스트 데이터
  - `Output`: `selectionMap` (Record<string, boolean> 형태의 객체), `toggleSelection` 함수
- **방어적 코딩 (감리관 지침):** 상태 업데이트 시 반드시 `setState(prev => ({...prev, [id]: !prev[id]}))` 형태의 Functional Update(함수형 업데이트) 사용. 최신 상태를 보장하여 Stale Closure 오류 방지.
- **검증 포인트:** 특정 이슈의 확장(토글) 버튼 클릭 시 부드럽게 열고 닫히며 다른 행에 전혀 영향을 주지 않는가?

### [Phase 3] `useLogForm` 분리 (입력 및 Dirty 상태)
- **추출 대상:** 폼 데이터(`editFormData`), 입력 변경 감지(`handleChange`), 폼 변경점 존재 여부(`isDirty`).
- **Input/Output 인터페이스:**
  - `Input`: 수정 대상 이슈의 초기 데이터 (`initialData`)
  - `Output`: `formData`, `isDirty`, `updateField`, `resetForm`
- **방어적 코딩 (감리관 지침):** `?.` (Optional Chaining) 필수. 데이터 바인딩 시 XSS(크로스 사이트 스크립팅) 취약점 차단을 위해 안전한 React 표준 바인딩만 사용.
- **검증 포인트:** 에디터에 텍스트 입력 시 지연(Lag)이 없고, `isDirty`가 정확히 작동하며, 취소 시 원본 복구가 즉각적으로 이루어지는가?

### [Phase 4] `useLogData` 분리 (Supabase & 정렬 로직)
- **추출 대상:** `supabase.from('...')` 비동기 호출부, 데이터 fetching, 정렬(sort), 중복 제거 등 가장 무거운 비즈니스 핵심 로직.
- **Input/Output 인터페이스:**
  - `Input`: `filters` (Phase 1 결과물), 현재 진행 중인 `project` 정보.
  - `Output`: `logs` (최종 렌더링용 배열), `isLoading`, `error`, `fetchData`
- **방어적 코딩 (감리관 지침):** 네트워크 지연에 대비한 Fallback (`[]`, `{}`). 데이터 매핑 중 고유 `id` 누락 시 렌더링이 터지지 않도록 예외 처리.
- **검증 포인트:** 페이지 진입 및 새로고침 시 콘솔 에러 없이 데이터가 온전하게 로딩되며, 데이터가 없을 때도 안정적으로 빈 화면(또는 '데이터 없음' UI)을 표출하는가?

### [Phase 5] `useAsyncAction` 분리 (Orchestrator 제어)
- **추출 대상:** 서버 저장/수정/삭제 시도 중 로딩 화면(Overlay) 통제 및 네트워크 요청 취소 로직.
- **Input/Output 인터페이스:**
  - `Input`: 실행할 비동기 함수 (`actionFn`)
  - `Output`: `execute`, `isPending`, `error`
- **방어적 코딩 (감리관 지침):** `AbortController`를 필수 적용하여 컴포넌트 Unmount 시(탭 이동 등) 진행 중인 요청 즉각 취소. '더블 클릭' 방지로 Race Condition 제어.
- **검증 포인트:** 데이터를 저장하는 도중 다른 탭으로 빠르게 이동해도 메모리 누수(Memory Leak) 경고나 브라우저 화이트스크린이 발생하지 않는가?
