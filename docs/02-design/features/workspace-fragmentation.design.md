# workspace-fragmentation - Design Document

> Version: 1.0.0 | Date: 2026-05-06 | Status: Draft
> Level: Dynamic | Plan: docs/01-plan/features/workspace-fragmentation.plan.md

---

## 1. Overview

### 1.1 Purpose
`WorkspaceView.jsx`를 3개의 핵심 UI 블록(`Header`, `Tabs`, `Content`)으로 분할하여 상위 컴포넌트의 가독성을 높이고 독립적인 컴포넌트 개발 환경을 구축함.

### 1.2 Design Goals
- **관심사 분리**: 헤더(글로벌 액션), 탭(네비게이션), 콘텐츠(데이터 렌더링)의 책임을 명확히 분리.
- **Props 최적화**: 각 하위 컴포넌트가 필요로 하는 최소한의 Props만 전달하도록 설계.
- **디자인 무결성**: 기존 Tailwind CSS 클래스와 Lucide 아이콘 구성을 그대로 유지.

## 2. Architecture

### 2.1 System Architecture
`WorkspaceView`가 상태 관리 및 오케스트레이션 역할을 수행하고, 3개의 하위 컴포넌트가 UI 렌더링을 담당하는 계층 구조.

### 2.2 Component Design
- **WorkspaceHeader**: 
  - 뒤로가기 버튼, 프로젝트명/차수 표시, 잠금 상태 배지, 글로벌 액션 버튼 그룹.
- **WorkspaceTabs**: 
  - 탭 버튼 리스트 렌더링 및 활성 상태 하이라이트.
- **WorkspaceContent**: 
  - `activeTab` 값에 따른 조건부 컴포넌트(`ProjectOverviewTab`, `IpIndexTab` 등) 스위칭.

### 2.3 Data Flow
- `App.jsx` → `WorkspaceView` (모든 Props 수신)
- `WorkspaceView` → `WorkspaceHeader` (글로벌 상태 및 액션 핸들러 전달)
- `WorkspaceView` → `WorkspaceTabs` (탭 정보 및 전환 핸들러 전달)
- `WorkspaceView` → `WorkspaceContent` (탭별 데이터 및 저장 핸들러 전달)

## 3. Implementation Plan

### 3.1 File Structure
- `src/components/workspace/WorkspaceHeader.jsx`
- `src/components/workspace/WorkspaceTabs.jsx`
- `src/components/workspace/WorkspaceContent.jsx`

### 3.2 Implementation Order
1. 하위 컴포넌트 3종 생성 및 Props 정의.
2. `WorkspaceView.jsx`에서 하위 컴포넌트 임포트 및 Props 전달부 구현.
3. 기존 인라인 JSX 코드 제거 및 무결성 검증.

## 4. Test Plan

### 4.1 Manual Verification
- 대시보드로 돌아가기 버튼 작동 여부.
- 현재 차수 Lock/Unlock 액션 정상 동작 여부.
- 탭 클릭 시 콘텐츠 전환 및 데이터 유실 여부.
- 읽기 전용 모드 시 UI 제약(배지 표시 등) 정상 동작 여부.
