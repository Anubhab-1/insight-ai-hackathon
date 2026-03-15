
import os
import asyncio
from openai import AsyncOpenAI
from dotenv import load_dotenv

async def test_nvidia():
    load_dotenv(".env")
    api_key = os.environ.get("LLM_API_KEY")
    base_url = os.environ.get("LLM_BASE_URL")
    model = os.environ.get("LLM_MODEL")
    
    print(f"Testing NVIDIA with Model: {model}")
    print(f"Base URL: {base_url}")
    
    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    try:
        # Note: Testing if this model supports chat completions
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Say hello"}],
            max_tokens=50
        )
        print("Success!")
        print(response.choices[0].message.content)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(test_nvidia())
