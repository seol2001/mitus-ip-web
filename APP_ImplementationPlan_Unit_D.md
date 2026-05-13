# 구현 계획서 - Unit D: 비즈니스 로직 고도화 및 안정성 강화 (Stability & Security)

## 📋 개요
본 유닛은 `mitus-ip-web` 프로젝트의 신뢰성을 확보하기 위해 서버 사이드 보안 정책(RLS)을 강화하고, 클라이언트 사이드의 예외 처리 및 액션 로깅 시스템을 구축하는 것을 목표로 합니다. 특히 비대해진 상태 관리 로직을 현대화하여 성능과 유지보수성을 동시에 확보합니다.

---

## 🛠 1단계: 서버 사이드 보안 및 데이터 정합성 강화
- **작업 내용**: 
  - Supabase **RLS(Row Level Security)** 정책 적용으로 프로젝트 잠금 권한 강제.
  - **비동기 무결성 가드**: `AbortController`를 통한 중복/지연 요청 취소 처리.
- **상세 설계**: [Design Document](file:///Users/jacobseol/Library/CloudStorage/SynologyDrive-DS716p/Antigravity/Mitus_IP_Web/mitus-ip-web/docs/02-design/features/unit-d-stability-security.design.md)
- **핵심 패턴**: Optimistic UI + Rollback mechanism.

## 🛠 2단계: 로직 현대화 및 파편화 (Logic Modernization)
- **작업 내용**: 
  - `useReducer` 도입을 통한 `RevisionLogTab` 상태 중앙 집중 관리.
  - 비즈니스 로직의 커스텀 훅(`useLogActions`, `useLogState`) 분리.
- **상세 설계**: 1,140줄의 컴포넌트 파일을 기능 단위로 분리하여 가독성 및 테스트 용이성 확보.

## 🛠 3단계: 전역 에러 핸들링 및 사용자 액션 로깅
- **작업 내용**: 
  - `ActionLoggerContext` 도입: 주요 데이터 변경 이력을 메모리에 기록.
  - `ErrorBoundary` 고도화: 에러 발생 시 로그를 기반으로 한 '이전 상태 복구' 링크 제공.
- **핵심 패턴**: Command 패턴 기반의 액션 로깅.

---

## 🏁 체크리스트 및 현재 진행 상황
- [x] 단계 0: 기획 및 상세 설계 완료 (`bkit_pdca_design`)
- [ ] 단계 1: 서버 사이드 RLS 정책 및 비동기 가드 적용 예정
- [ ] 단계 2: 상태 관리 로직 현대화 (`useReducer`) 예정
- [ ] 단계 3: 로깅 및 에러 핸들링 시스템 구축 예정

---

## 💡 핵심 원칙 (MLX-DEV / bkit)
1. **디자인 유지**: UI 디자인, CSS 클래스, 레이아웃 구조는 1%도 수정하지 않습니다. 모든 고도화는 '보이지 않는 로직'에 집중합니다.
2. **MLX 전담**: SQL 쿼리 설계, 상태 전이 로직 정의 등 논리적 판단이 필요한 영역은 전적으로 로컬 MLX-QWEN 모델의 분석 결과를 따릅니다.
3. **D2C(Direct-to-Code) 프롬프팅 적용**: MLX 추론 시 '생각 과정'을 생략하고 '코드 결과물'에 집중하는 구조화된 프롬프트를 사용하여 토큰 유실을 방지하고 정합성을 높입니다.
4. **MLX + bkit 중심의 PDCA 협업**: 
   - **Plan/Design (MLX/bkit)**: 상세 설계 및 아키텍처 체크.
   - **Do (Implementation)**: 설계 기반 코드 주입.
   - **Check/Act (bkit)**: `bkit_pdca_analyze`를 통한 설계 대비 구현 일치율(Gap) 분석 및 보정.
5. **무결성 보장**: Context API 기반의 중앙 집중형 상태 관리 체계를 존중하며, 기존 프롭스(Props) 인터페이스나 데이터 스키마를 파괴하지 않습니다.
6. **독립성 보장**: 보안 및 로깅 로직은 비즈니스 로직과 컨텍스트 수준에서 분리하여 가독성과 확장성을 유지합니다.
