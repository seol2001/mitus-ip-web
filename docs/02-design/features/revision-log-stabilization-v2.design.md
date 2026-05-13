# revision-log-stabilization-v2 - Design Document

> Version: 1.0.0 | Date: 2026-05-08 | Status: Draft
> Level: Dynamic | Plan: docs/01-plan/features/revision-log-stabilization-v2.plan.md

---

## 1. Overview

### 1.1 Purpose
Revision Log 탭의 핵심 로직(탭 전환, FA 연동, 모달 흐름)을 안정화하여 UX 일관성과 데이터 무결성을 보장하는 설계를 정의합니다.

### 1.2 Design Goals
- 모든 서브 탭 진입 시 '읽기 전용' 상태 유지.
- FA 연동 해제 시 폼 상태와 카드 리스트 상태의 동기화 보장.
- 불필요한 중복 컨펌을 제거하여 매끄러운 작업 흐름 제공.

## 2. Architecture

### 2.1 Component Logic (RevisionLogTab.jsx)
- **State Management**: `isTabEditing` (편집 모드 여부), `mode` (현재 서브 탭), `formData` (현재 작성 중인 데이터).
- **Control Flow**:
  - `handleTabSwitch`: 탭 전환 시 폼 초기화 수행, 편집 모드 강제 변경 배제.
  - `handleUnlinkFa`: 연동 상태에 따른 분기 처리 (신규 Pull vs 기존 저장 항목).
  - `handleDeleteRequest`: 항목 삭제 및 관련 상태(FA 연동 등) 복구 처리.

## 3. Implementation Details

### 3.1 Step 5-1: 자동 편집 모드 제거
- `handleTabSwitch` 함수 내에서 `newMode === 'fa'` 등의 조건에 따라 `setIsTabEditing(true)`를 호출하던 기존의 예외 로직을 제거합니다.
- 사용자가 `ActionBar`를 통해 명시적으로 편집 모드를 켜기 전까지는 항상 `isReadOnly` 상태를 유지합니다.

### 3.2 Step 5-2: FA 연동 해제 및 삭제 로직 통합
- `handleUnlinkFa` 구현:
  ```javascript
  const handleUnlinkFa = async (e) => {
    if (editingId) {
      // 리스트에 이미 등록된 경우 삭제 로직 호출 (통합 처리)
      await handleDeleteRequest(formData);
    } else {
      // 저장 전 신규 상태인 경우 폼만 초기화
      markFaLinkState(formData.faId, false);
      setFormData(...)
    }
  }
  ```

### 3.3 Step 5-3: 중복 컨펌 모달 최적화
- `handleDeleteRequest`의 성공 시퀀스 마지막에 `cancelEdit(true)`를 배치합니다.
- `cancelEdit` 내부 로직:
  ```javascript
  const cancelEdit = useCallback(async (skipConfirm = false) => {
    if (!skipConfirm && isDirtyRef.current) {
      // 컨펌 모달 노출
    }
    // 폼 리셋 로직 수행
  }, [...]);
  ```

## 4. Test Plan

### 4.1 Manual Verification Scenarios
1. **탭 일관성**: 'FA 리포트 연동' 버튼 클릭 시 편집 모드가 자동으로 켜지지 않는지 확인.
2. **연동 해제 정합성**: 저장된 FA 연동 이슈에서 '연동 해제' 클릭 시, 카드 리스트에서도 삭제되는지 확인.
3. **UX 흐름**: '연동 해제' 컨펌 후 폼이 즉시 닫히며 추가 모달이 없는지 확인.
