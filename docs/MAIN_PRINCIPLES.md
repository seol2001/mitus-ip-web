# 📜 Mitus IP Web - MAIN PRINCIPLES (Project Constitution)

본 문서는 프로젝트의 무결성과 신뢰성을 유지하기 위한 최상위 지침서입니다. 모든 AI 에이전트와 개발자는 이 원칙을 엄격히 준수해야 합니다.

---

## 🏗️ 1. 개발 핵심 원칙 (Core Principles)

1.  **디자인 절대 유지 (UI/UX Preservation)**: 
    - UI 디자인, CSS 클래스명, 레이아웃 구조는 1%도 수정하지 않는다.
    - 모든 고도화는 '보이지 않는 로직'의 안정성과 보안에만 집중한다.
2.  **멀티 모델 협업 분석 (gemma4 & 27b)**: 
    - 논리적 설계 및 데이터 스키마 변경 시 반드시 **gemma4(설계자)**의 1차 분석과 **27b(감리관)**의 크로스 체크를 거친다.
    - **English-Only Inference**: 모델의 추론 성능 극대화 및 토큰 절약을 위해, 로컬 모델에게 질문할 때와 모델이 응답할 때는 **반드시 영어로만 진행**한다. (최종 사용자 보고는 메인 AI가 한국어로 요약)
3.  **데이터 무결성 및 상태 관리**: 
    - Context API 기반의 중앙 집중형 상태 관리 체계를 존중한다.
    - 기존 프롭스(Props) 인터페이스나 데이터 스키마를 파괴하지 않는다.
    - DB를 '단일 진실 공급원(SSoT)'으로 취급한다.
4.  **로직 독립성**: 
    - 보안, 로깅, 비즈니스 로직은 컨텍스트 수준에서 분리하여 가용성을 유지한다.

---

## 🧪 2. 검증 및 품질 관리 (QA Process)

모든 작업은 **'Test-First'** 절차를 준수한다.
1.  **Screening**: 결함 재현 테스트(Playwright) 작성 및 Fail 확인.
2.  **Plan**: gemma4/27b 분석 후 `CHANGELOG.md`에 해결 방안 기술.
3.  **Do**: 설계에 기반한 정밀한 코드 주입.
4.  **Verify**: 테스트 Pass 확인 및 전체 시스템 Deep Scan.

---

### 3. Git 자동화 및 릴리즈 프로토콜 (Release Automation)
- **버전 프리징 요청 시 자동 수행 항목**:
    1. `DashboardHeader.jsx` 내 버전 문자열 업데이트.
    2. `CHANGELOG.md` 내 수정 히스토리 기록.
    3. 로컬 `git commit` 및 `git tag` 생성.
- **Push 원칙 (Strict Approval)**:
    - **절대 금지**: 사용자 승인 없는 `git push`는 어떠한 경우에도 금지한다.
    - **수행 방식**: 로컬 커밋/태그 완료 후, 사용자에게 Push 여부를 확인받은 뒤 승인 시에만 `git push origin [branch/tag]`를 수행한다.

---

## 🔍 4. 기술적 가드레일 (Technical Guardrails)

- **보안**: RLS 정책은 항상 `STRICT` 모드이며, 에러 메시지는 서버 단에서 위생화(Sanitization) 처리한다.
- **성능**: `ActionLogger` 등 지속적 로깅 시스템은 반드시 **Ring Buffer(최대 1,000개)**를 사용하여 메모리 누수를 방지한다.
- **무결성**: 다중 사용자 충돌 방지를 위해 `version` 컬럼 기반의 **낙관적 잠금(Optimistic Locking)**을 적용한다.
