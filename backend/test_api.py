
import os
import asyncio
from openai import AsyncOpenAI, RateLimitError, APIStatusError
from dotenv import load_dotenv

async def test_api():
    load_dotenv(".env")
    api_key = os.environ.get("LLM_API_KEY")
    base_url = os.environ.get("LLM_BASE_URL")
    model = os.environ.get("LLM_MODEL")
    
    print(f"Testing with Model: {model}")
    print(f"Base URL: {base_url}")
    print(f"API Key (partial): {api_key[:10]}...")
    
    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Say hello"}],
            max_tokens=5
        )
        print("Success!")
        print(response.choices[0].message.content)
    except Exception as e:
        print(f"Error Type: {type(e)}")
        print(f"Error Message: {str(e)}")
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(test_api())
