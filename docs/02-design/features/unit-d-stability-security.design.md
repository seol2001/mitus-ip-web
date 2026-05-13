# unit-d-stability-security - Design Document

> Version: 1.0.0 | Date: 2026-05-08 | Status: Draft
> Level: Dynamic | Plan: docs/01-plan/features/unit-d-stability-security.plan.md

---

## 1. Overview

### 1.1 Purpose
본 문서는 Mitus IP Web의 비즈니스 로직 안정성과 보안을 강화하기 위한 구체적인 기술 설계를 정의합니다. 클라이언트 사이드 로직의 복잡도를 낮추고, 서버 사이드 가드를 도입하여 데이터의 무결성을 확보합니다.

### 1.2 Design Goals
- **보안(Security)**: RLS를 통한 DB 수준의 접근 제어.
- **안정성(Stability)**: 비동기 경쟁 조건 방지 및 예외 발생 시 자동 복구/롤백 지원.
- **성능(Performance)**: 불필요한 렌더링 최적화 및 대규모 데이터 처리 구조 개선.

## 2. Architecture

### 2.1 System Architecture
- **Layer 1 (Database)**: Supabase RLS Policies를 통한 권한 제어.
- **Layer 2 (Context)**: `ActionLoggerContext`를 통한 전역 상태 로깅 및 에러 전파.
- **Layer 3 (Hooks)**: `RevisionLogTab` 로직을 기능별 커스텀 훅으로 파편화.
- **Layer 4 (Components)**: 렌더링 최적화를 위한 순수 UI 컴포넌트 구조 유지.

### 2.2 Component Design (Hooks)
- `useLogState`: `useReducer`를 사용하여 이슈 리스트, 필터링, 정렬 상태 관리.
- `useLogActions`: `AbortController`를 포함한 CRUD (Save, Delete, Unlink) 비동기 통신 관리.
- `useLogForm`: `IssueForm`의 상태 및 유효성 검사 로직 담당.

### 2.3 Data Flow
1. 사용자가 액션(저장/삭제) 수행.
2. `useLogActions`에서 `AbortController` 생성 및 비동기 요청 시작.
3. 동시에 `ActionLogger`가 해당 액션을 메모리에 기록.
4. 성공 시 `useLogState`가 전역 상태 업데이트 / 실패 시 `ErrorBoundary`가 캡처하여 롤백 가이드 제공.

## 3. Data Model (Security)

### 3.1 RLS Policies (SQL Level)
```sql
-- projects 테이블 보안 정책
CREATE POLICY "Enable update for locked_by owner" ON public.projects
FOR UPDATE
USING (
  locked_by IS NULL OR 
  locked_by = auth.uid()::text
)
WITH CHECK (
  locked_by = auth.uid()::text
);
```

### 3.2 Action Log Schema
```json
{
  "timestamp": "ISO-8601",
  "actionType": "SAVE_ISSUE | DELETE_ISSUE | UNLINK_FA",
  "payload": { "id": "...", "before": "...", "after": "..." },
  "status": "PENDING | SUCCESS | FAILED",
  "error": "Error Message (optional)"
}
```

## 4. API Specification (Async Guard)

### 4.1 Async Pattern (Optimistic UI)
1. **Request**: `fetch(url, { signal: controller.signal })`
2. **Optimistic**: 즉시 UI 업데이트.
3. **Rollback**: 에러 발생 시 `ActionLogger`의 `before` 데이터를 사용하여 상태 복구.

## 5. Implementation Plan

### 5.1 Implementation Order
1. **Step 1: SQL Security**: Supabase RLS 정책 적용 및 테스트.
2. **Step 2: Logic Fragmentation**: `RevisionLogTab` 내의 상태를 `useReducer`로 전환.
3. **Step 3: Async Integrity**: `AbortController` 기반의 비동기 요청 가드 구현.
4. **Step 4: Error Handling**: `ActionLogger` 컨텍스트 및 `ErrorBoundary` 고도화.

## 6. Test Plan

### 6.1 Unit Tests
- `useLogState` reducer 테스트: 다양한 액션 타입에 따른 상태 전이 검증.
- `AbortController` 테스트: 이전 요청이 취소되고 마지막 요청이 반영되는지 확인.

### 6.2 Security Tests
- 타 사용자의 `locked_by`가 설정된 프로젝트에 대해 강제 업데이트 시도 시 Supabase API 에러(403) 반환 여부 확인.

## 7. Security Considerations
- 클라이언트 사이드 체크(`isReadOnly`)는 UX용으로 유지하되, 실제 보안은 RLS로 강제함.
- 모든 민감한 데이터 수정 액션은 로그에 기록하여 사후 추적 가능하도록 함.
