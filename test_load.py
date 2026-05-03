
import sys
import os

# mlx_server.py가 있는 경로를 sys.path에 추가
sys.path.append('/Users/jacobseol')

try:
    from mlx_server import load_model
    print("Attempting to load model...")
    result = load_model()
    print(result)
except Exception as e:
    print(f"Error: {e}")
