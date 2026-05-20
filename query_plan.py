import sys
sys.path.append('/Users/jacobseol')

from mlx_server import load, ask_gemma4, ask_27b

prompt = """
당신은 반도체 IP 결함 추적 시스템의 수석 아키텍트입니다.
현재 'IP Index' 탭의 결함 이력(Revision History)을 4가지 UI 섹션으로 렌더링하려고 합니다:
1. 신규 등록 리스트 (이번 차수 신규)
2. REVISION (하드웨어 수정 판정 건)
3. 관리형 부채 (소프트웨어 워크어라운드, 유보 등 잔여 건)
4. 종결 (조치 완료 건)

[질문]
만약 '이번 차수에 새롭게 등록'되었는데, 'REVISION(하드웨어 수정)'으로 즉각 판정된 이슈가 있다면,
이 이슈를 '1. 신규 등록 리스트'에 표시해야 할까요? 아니면 '2. REVISION' 섹션에 표시해야 할까요?
혹은 둘 다 표시하거나 다른 대안이 좋을까요? 100단어 이내로 제안해주세요.
"""

print("\n=== Gemma4 호출 중 ===")
try:
    load("gemma4")
    print(ask_gemma4(prompt))
except Exception as e:
    print(f"Gemma4 Error: {e}")

print("\n=== Qwen 27B 호출 중 ===")
try:
    load("27b")
    print(ask_27b(prompt))
except Exception as e:
    print(f"27b Error: {e}")
