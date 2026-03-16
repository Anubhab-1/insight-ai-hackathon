
import os
import asyncio
from openai import AsyncOpenAI
from dotenv import load_dotenv

async def main() -> None:
    load_dotenv(".env")
    api_key = os.environ.get("LLM_API_KEY")
    base_url = os.environ.get("LLM_BASE_URL")
    model = os.environ.get("LLM_MODEL") or "llama-3.3-70b-versatile"

    if not api_key:
        raise SystemExit("LLM_API_KEY is required for this smoke test.")

    print(f"Testing with model: {model}")
    print(f"Base URL: {base_url or 'default'}")

    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Say hello"}],
            max_tokens=5,
        )
        print("Success!")
        print(response.choices[0].message.content)
    except Exception as exc:
        print(f"Error Type: {type(exc)}")
        print(f"Error Message: {str(exc)}")
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(main())
