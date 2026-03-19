import asyncio
import os
import json
from dotenv import load_dotenv
from main import process_dashboard_query, client, LLM_MODEL, _init_client

async def verify():
    load_dotenv()
    global client
    if client is None:
        client = _init_client()
    
    query = "Show a composed chart of total views (bar) and average sentiment score (line) over time."
    print(f"\nTesting Query: {query}")
    try:
        res = await process_dashboard_query(query)
        print(f"Dashboard Title: {res.get('dashboard_title')}")
        for i, widget in enumerate(res.get('widgets', [])):
            print(f"Widget {i+1}: {widget.get('title')} -> Chart Type: {widget.get('chart_type')}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(verify())
