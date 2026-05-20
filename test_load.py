import sys
import os

# mlx_server.py가 있는 경로를 sys.path에 추가
sys.path.append('/Users/jacobseol')

try:
    from mlx_server import ask_gemma4
    print("gemma4 모델에게 질의합니다...")
    
    # 정밀 추론 테스트용 질문 (React 19 대용량 최적화 기법)
    test_prompt = "React 19에서 대용량 데이터를 최적화하여 화이트 스크린 없이 렌더링하기 위한 대표적인 세 가지 기법을 간단한 설명과 함께 추천해줘."
    
    result = ask_gemma4(test_prompt, temp=0.2, max_tokens=1024)
    print("\n=== Gemma4 Inference Result ===")
    print(result)
    print("===============================")
except Exception as e:
    print(f"❌ Error: {e}")
