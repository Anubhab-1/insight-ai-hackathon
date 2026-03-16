import os
import httpx
import time

def main() -> None:
    api_key = os.environ.get("NVIDIA_API_KEY") or os.environ.get("LLM_API_KEY")
    if not api_key:
        raise SystemExit("Set NVIDIA_API_KEY (or LLM_API_KEY) before running this script.")

    url = os.environ.get("NVIDIA_BASE_URL") or "https://integrate.api.nvidia.com/v1/chat/completions"
    data = {
        "model": os.environ.get("NVIDIA_MODEL") or "qwen/qwen3.5-397b-a17b",
        "messages": [{"role": "user", "content": "Write a short SQL query for views by region."}],
        "max_tokens": 100,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
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
    except Exception as exc:
        duration = time.time() - start
        print(f"Error after {duration:.2f}s: {exc}")

if __name__ == "__main__":
    main()
