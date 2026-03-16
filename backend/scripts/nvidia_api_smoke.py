import os
import httpx

def main() -> None:
    api_key = os.environ.get("NVIDIA_API_KEY") or os.environ.get("LLM_API_KEY")
    if not api_key:
        raise SystemExit("Set NVIDIA_API_KEY (or LLM_API_KEY) before running this script.")

    url = os.environ.get("NVIDIA_BASE_URL") or "https://integrate.api.nvidia.com/v1/chat/completions"
    # Using a faster model to verify key
    data = {
        "model": os.environ.get("NVIDIA_MODEL") or "meta/llama-3.1-8b-instruct",
        "messages": [{"role": "user", "content": "Hi"}],
        "max_tokens": 5,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    print(f"Polling {url} with llama-3.1-8b-instruct...")
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.post(url, headers=headers, json=data)
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
