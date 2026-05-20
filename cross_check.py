import sys
import os
import time

# Add the directory containing mlx_server.py to the system path
sys.path.append('/Users/jacobseol')

# Define paths
PLAN_PATH = "/Users/jacobseol/.gemini/antigravity-ide/brain/21c7016a-2293-46fa-bfaa-8dd5a5440bab/implementation_plan.md"
SCRATCH_DIR = "/Users/jacobseol/.gemini/antigravity-ide/brain/21c7016a-2293-46fa-bfaa-8dd5a5440bab/scratch"

def run_cross_check():
    # 1. Read implementation plan
    if not os.path.exists(PLAN_PATH):
        print(f"❌ Implementation plan file not found at: {PLAN_PATH}")
        return

    with open(PLAN_PATH, "r", encoding="utf-8") as f:
        plan_content = f.read()

    print("📖 구현 계획서(implementation_plan.md)를 성공적으로 읽었습니다.")
    print("--------------------------------------------------")

    # Import specialized model functions from mlx_server
    try:
        from mlx_server import ask_gemma4, ask_27b
    except ImportError as e:
        print(f"❌ Failed to import mlx_server: {e}")
        return

    # 2. Gemma4 (Creative Frontend Architect) Review
    print("\n🚀 [1/2] Gemma4 (Creative Frontend Architect 페르소나) 검토를 시작합니다...")
    gemma4_prompt = f"""
당신은 '창의적 프런트엔드 설계자(Creative Frontend Architect)'입니다. 
다음 제공되는 [구현 계획서]를 읽고, 시각적 디자인, 디자인의 우아함, UI/UX 일관성, 마이크로 인터랙션, 그리고 컴포넌트의 유연한 구조 측면에서 면밀하게 크로스 체크를 진행해주세요. 
특히 다음 질문들에 대답해 주십시오:
1. '무거운 거대 벽'을 부수고 도입한 '플로팅 카드 아키텍처'가 기존 RevisionLog 탭과의 시각적 아이덴티티 매핑 측면에서 완벽하게 우아한 조화를 이루고 있나요?
2. Vertical Accent Bar와 Mellow Hover Lift(상승 그림자) 효과가 미적으로 훌륭한 사용자 경험(WOW 포인트)을 주는가에 대해 프런트엔드 아트 관점에서 평가해주세요.
3. 추가적인 디자인 디테일이나 마이크로 인터랙션으로 개선할 만한 창의적인 보완 아이디어가 있다면 구체적으로 제안해 주세요.

[구현 계획서]
{plan_content}
"""
    
    start_gemma4 = time.perf_counter()
    # temp=0.2로 설정하여 일관되면서도 창의적인 고밀도 설계 조언 유도
    gemma4_review = ask_gemma4(gemma4_prompt, temp=0.2, max_tokens=1500)
    gemma4_time = time.perf_counter() - start_gemma4
    print(f"✅ Gemma4 검토 완료! (소요 시간: {gemma4_time:.2f}초)")

    # Save Gemma4 review
    gemma4_out_path = os.path.join(SCRATCH_DIR, "review_gemma4.txt")
    with open(gemma4_out_path, "w", encoding="utf-8") as f:
        f.write(gemma4_review)
    print(f"💾 Gemma4 검토 결과를 파일에 저장했습니다: {gemma4_out_path}")

    # 3. Qwen 27B (Critical Performance & Security Auditor) Review
    print("\n🚀 [2/2] Qwen-27B (Critical Performance & Security Auditor 페르소나) 검토를 시작합니다...")
    qwen_prompt = f"""
당신은 '냉철한 성능 및 보안 감리관(Critical Security & Performance Auditor)'입니다.
다음 제공되는 [구현 계획서]를 읽고, React 19 최적화, 렌더링 병목 차단, 보안(XSS 및 안전한 데이터 렌더링), 컴포넌트 생명주기 및 메모리 누수 방지 측면에서 면밀하게 크로스 체크 및 감리를 진행해주세요.
특히 다음 질문들에 대답해 주십시오:
1. 5개 아코디언이 각각 개별적으로 분리되어 독립적으로 렌더링될 때, React 19의 상태 업데이트 전파나 메인 스레드 블로킹(Jank) 현상에 미칠 영향은 어떠한가요?
2. 마크업의 구조적인 결함(예: className 내부 스타일 바인딩 유효성, tailwind.config 확장 문제)이나 데이터 부재 시(예: newFindings.length가 0일 때)의 예외 처리에 허점은 없나요?
3. 성능 효율이나 안정성을 추가적으로 극대화하기 위해 이 코드 설계에서 개선 또는 보완해야 할 감리 지적 사항과 구체적인 최적화 리팩토링 제안을 주십시오.

[구현 계획서]
{plan_content}
"""

    start_qwen = time.perf_counter()
    # temp=0.0으로 냉철하고 결정론적인 보안 및 성능 감리 유도
    qwen_review = ask_27b(qwen_prompt, temp=0.0, max_tokens=1500)
    qwen_time = time.perf_counter() - start_qwen
    print(f"✅ Qwen-27B 검토 완료! (소요 시간: {qwen_time:.2f}초)")

    # Save Qwen-27B review
    qwen_out_path = os.path.join(SCRATCH_DIR, "review_qwen.txt")
    with open(qwen_out_path, "w", encoding="utf-8") as f:
        f.write(qwen_review)
    print(f"💾 Qwen-27B 검토 결과를 파일에 저장했습니다: {qwen_out_path}")

    print("\n==================================================")
    print("🎉 두 로컬 모델의 크로스 체크 검토 프로세스가 성공적으로 완료되었습니다!")
    print(f"- Gemma4 검토 소요: {gemma4_time:.2f}초")
    print(f"- Qwen-27B 검토 소요: {qwen_time:.2f}초")
    print("==================================================")

if __name__ == "__main__":
    run_cross_check()
