# revision-log-stabilization - Design Document

> Version: 1.0.0 | Date: 2026-05-07 | Status: Draft
> Level: Dynamic | Plan: docs/01-plan/features/revision-log-stabilization.plan.md

---

## 1. Overview

### 1.1 Purpose
This document outlines the technical design for stabilizing the Revision Log tab logic, focusing on asynchronous state management and cross-component synchronization.

### 1.2 Design Goals
- Implement a robust asynchronous saving guard using a reference-based tracking system.
- Standardize the "Read-Only" state derived from both global project locks and local UI edit states.
- Unify deletion and unlinking workflows to ensure data parity between the form and list views.

## 2. Architecture

### 2.1 Asynchronous Save Guard (Global)
- **Component**: `App.jsx`
- **Mechanism**: Use `pendingSavesRef` (useRef) to track the number of active database write operations.
- **Guard**: `executeExit` (navigation guard) must await all pending saves before releasing the project lock.

### 2.2 Tab State Management (Local)
- **Component**: `RevisionLogTab.jsx`
- **State**: `isTabEditing` (Boolean)
- **Derived State**: `isReadOnly = isArchived || !isTabEditing`
- **Logic**: All input fields and action buttons (like 'Pull from FA') must strictly respect `isReadOnly`.

## 3. Data Flow

### 3.1 FA Linking/Unlinking Flow
1. **Link (Pull)**: 
   - User selects an FA report.
   - Form is populated with FA data.
   - `faId` is recorded in `formData`.
   - `markFaLinkState` updates the original FA report list to mark it as linked.
2. **Unlink**:
   - **Scenario A (New Pull)**: Reset form fields, clear `faId`, and unmark FA link state.
   - **Scenario B (Existing Issue)**: Trigger `handleDeleteRequest` which removes the issue from the list, clears the lock, and unmarks FA link state.

## 4. Implementation Plan

### 4.1 File Structure
- `src/App.jsx`: Main navigation and global lock guards.
- `src/components/tabs/RevisionLogTab.jsx`: Tab-specific logic and mode management.
- `src/components/IssueForm.jsx`: Generic issue form UI.

### 4.2 Implementation Order
1. **Step 1 (Lock Guard)**: Hardening `executeExit` with `pendingSavesRef`.
2. **Step 2 (Mode Stabilization)**: Standardizing `isTabEditing` transitions and removing auto-edit for FA tab.
3. **Step 3 (Workflow Parity)**: Integrating `handleUnlinkFa` with `handleDeleteRequest`.
4. **Step 4 (UX Polish)**: Streamlining confirmation modals with `skipConfirm`.

## 5. Test Plan

### 5.1 Manual Verification
- **Test 1**: Save an issue and immediately click the dashboard. Verify data is saved in the DB.
- **Test 2**: Enter Revision Log, click FA sub-tab. Verify UI remains read-only.
- **Test 3**: Unlink an existing FA issue from the form. Verify it disappears from the card list.
- **Test 4**: Delete an issue being edited. Verify only one confirmation modal appears.

## 6. Security Considerations
- Project locks are strictly enforced at the API level using `.eq('locked_by', userId)`.
- UI guards (`isReadOnly`) prevent unauthorized writes even if the API is bypassed.
