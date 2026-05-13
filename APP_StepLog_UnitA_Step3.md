# APP_StepLog_UnitA_Step3 (내보내기 관리자 분리)

## 📌 1. 작업 개요
- **작업 목표**: `App.jsx` 내부에 존재하던 마크다운 ZIP 다운로드(`handleSaveMD`)와 JSON 프로젝트 내보내기(`handleExportProject`) 로직을 별도의 커스텀 훅(`useExportManager.js`)으로 분리.
- **수정된 파일**:
  - `src/App.jsx` (JSZip/exportMarkdown 임포트 제거, 인라인 함수 제거 및 훅 도입)
  - `src/hooks/useExportManager.js` (신규 훅 생성)

## 📌 2. 상세 변경 내역 (Before / After)

### [Before] `App.jsx` (수정 전 코드)
- **위치**: 
  - `handleSaveMD`: Line 1161 ~ 1225 (ZIP 생성 및 다운로드 로직)
  - `handleExportProject`: Line 1227 ~ 1271 (JSON Export 로직)
- **Import 포함**: `import JSZip from 'jszip'`와 `import { getOverviewMD, ... } from './utils/exportMarkdown'`가 App.jsx 최상단에 위치.
- **로직 요약**: JSZip 인스턴스 생성, 폴더 구조 설정, KST 시간 보정, 마크다운 문자열 생성 후 blob 다운로드까지 App.jsx에 인라인으로 존재.

### [After] `useExportManager.js` 생성 및 도입
- **위치**: `src/hooks/useExportManager.js` 생성
- **로직 요약**:
  - `JSZip`, `getOverviewMD` 등 외부 라이브러리/유틸리티 Import를 훅 파일로 이동.
  - `handleSaveMD`와 `handleExportProject` 를 `useCallback`으로 감싸고 명확한 의존성 배열 설정.
  - `App.jsx`에서는 훅을 통해 두 함수를 구조분해 할당으로 받아 사용:
    ```javascript
    const { handleSaveMD, handleExportProject } = useExportManager({
      activeProject, currentData, currentViewedRevision,
      projectsList, currentUser, showConfirm
    });
    ```
- **App.jsx에서 제거된 항목**:
  - `import JSZip from 'jszip'` ← 제거
  - `import { getOverviewMD, ... } from './utils/exportMarkdown'` ← 제거
  - `handleSaveMD` 함수 본체 ← 제거 (~64줄)
  - `handleExportProject` 함수 본체 ← 제거 (~44줄)

## 📌 3. useCallback 의존성 배열

| 함수 | 의존성 |
|---|---|
| `handleSaveMD` | `activeProject`, `currentData`, `currentViewedRevision`, `showConfirm` |
| `handleExportProject` | `projectsList`, `currentUser`, `showConfirm` |

## 📌 4. 다음 액션 (사용자 검증 필요)
브라우저에서 다음 기능들이 **기존과 동일하게, 오류 없이 작동하는지** 확인 부탁드립니다.
1. 프로젝트 WORKSPACE 화면 상단의 **마크다운 다운로드(ZIP)** 버튼을 눌러 ZIP 파일이 정상적으로 다운로드되는지 확인.
2. 대시보드의 각 프로젝트 카드 → 톱니바퀴 → **Export Data (.json)** 버튼을 눌러 JSON 파일이 정상적으로 다운로드되는지 확인.
