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
4.  **가상화 적용**: 로그 리스트 영역에 `FixedSizeList` 또는 `VariableSizeList` 적용.

## ⚠️ User Review Required (Critical)
> [!IMPORTANT]
> **리스트 가상화 도입**: 로그 카드의 높이가 가변적일 경우 `react-virtualized-auto-sizer` 등 추가 라이브러리 검토가 필요할 수 있습니다. 1차는 고정 높이 가상화로 시도합니다.

## 🔍 Verification Plan
- **성능 검사**: 크롬 개발자 도구 'Performance' 탭을 통해 필터링 시 프레임 드롭(Jank) 발생 여부 확인.
- **레이스 컨디션 테스트**: 빠른 탭 전환 및 연속 저장 시 `AbortController`가 정상적으로 동작하는지 네트워크 탭 감시.
- **무결성 검사**: `bkit_pdca_analyze`를 통해 설계 문서와 구현 코드의 일치율(Gap) 90% 이상 확보.
