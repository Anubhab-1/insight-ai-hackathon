import httpx
import json

def verify_backend_query():
    url = "http://127.0.0.1:8001/api/query"
    payload = {
        "query": "Show me total views by region",
        "history": []
    }
    
    print(f"Calling backend at {url}...")
    try:
        # Increase timeout as Qwen 3.5 might be slow
        with httpx.Client(timeout=60.0) as client:
            response = client.post(url, json=payload)
            print(f"Status Code: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print("Success! Backend returned dashboard data.")
                print(f"Dashboard Title: {data.get('dashboard_title')}")
                print(f"KPIs Count: {len(data.get('kpis', []))}")
                print(f"Widgets Count: {len(data.get('widgets', []))}")
                # Print a snippet of the executive summary
                print(f"Summary: {data.get('executive_summary')[:100]}...")
            else:
                print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify_backend_query()
