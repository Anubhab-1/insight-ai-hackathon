import httpx
import json

def test():
    api_key = "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"
    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    # Using a faster model to verify key
    data = {
        "model": "meta/llama-3.1-8b-instruct",
        "messages": [{"role": "user", "content": "Hi"}],
        "max_tokens": 5
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
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
    test()
