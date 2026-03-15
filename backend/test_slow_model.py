import httpx
import json
import time

def test_qwen_slow():
    api_key = "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"
    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    data = {
        "model": "qwen/qwen3.5-397b-a17b",
        "messages": [{"role": "user", "content": "Write a short SQL query for views by region."}],
        "max_tokens": 100
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    print(f"Polling {url} with qwen/qwen3.5-397b-a17b (Extended Timeout 120s)...")
    start = time.time()
    try:
        # 120 second timeout
        with httpx.Client(timeout=120.0) as client:
            response = client.post(url, headers=headers, json=data)
            duration = time.time() - start
            print(f"Status Code: {response.status_code}")
            print(f"Duration: {duration:.2f}s")
            print(f"Response: {response.text[:500]}...")
    except Exception as e:
        duration = time.time() - start
        print(f"Error after {duration:.2f}s: {e}")

if __name__ == "__main__":
    test_qwen_slow()
