import sys
import time

# Add the directory containing mlx_server.py to the system path
sys.path.append('/Users/jacobseol')

try:
    from mlx_server import load
    print("⏳ Gemma4-26B-MoE 로컬 모델 로드를 시작합니다...")
    
    start_time = time.perf_counter()
    # Gemma4 모델 명시적 로드 실행
    result = load("gemma4")
    duration = time.perf_counter() - start_time
    
    print("\n=== Gemma4 Load Result ===")
    print(result)
    print(f"⏱️ 총 소요 시간: {duration:.2f}초")
    print("==========================")
except Exception as e:
    print(f"❌ Error: {e}")
