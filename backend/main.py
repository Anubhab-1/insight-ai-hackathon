from fastapi import FastAPI, UploadFile, File, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Tuple, Callable, cast
from contextlib import asynccontextmanager
import pandas as pd
import sqlite3
import os
import io
import json
import asyncio
import concurrent.futures
import re
import random
import time
import traceback
import html
import plistlib
# openai >= 1.0 is required
from openai import AsyncOpenAI, RateLimitError, APIStatusError
# Use Any for ChatCompletion if type-checker is blind to openai.types
ChatCompletion = Any 

from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))


def parse_cors_origins(raw_value: Optional[str]) -> List[str]:
    if not raw_value:
        return [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            "http://localhost:3333",
            "http://127.0.0.1:3333",
        ]

    origins = [origin.strip() for origin in raw_value.split(",") if origin.strip()]
    return origins or [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3333",
        "http://127.0.0.1:3333",
    ]

client: Optional[AsyncOpenAI] = None

def _init_client() -> Optional[AsyncOpenAI]:
    """Initialize the OpenAI client with environment configuration."""
    api_key = os.environ.get("LLM_API_KEY") or os.environ.get("GROQ_API_KEY") or os.environ.get("XAI_API_KEY")
    base_url = os.environ.get("LLM_BASE_URL") or "https://api.groq.com/openai/v1"
    
    if api_key:
        return AsyncOpenAI(api_key=api_key, base_url=base_url)
    return None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global client
    if client is None:
        client = _init_client()
    try:
        yield
    finally:
        if client is not None:
            await client.close()
            client = None


app = FastAPI(title="InsightAI Backend", lifespan=lifespan)

# CORS setup
CORS_ORIGINS = parse_cors_origins(os.environ.get("API_CORS_ORIGINS"))
CORS_ALLOW_ALL = "*" in CORS_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if CORS_ALLOW_ALL else CORS_ORIGINS,
    allow_credentials=not CORS_ALLOW_ALL,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_NAME = os.path.join(BASE_DIR, "insightai.db")
VALID_CHART_TYPES = {"line", "bar", "pie", "scatter", "table"}
VALID_METRIC_FORMATS = {"number", "percent", "currency", "text"}
FORBIDDEN_SQL_PATTERN = re.compile(r"\b(insert|update|delete|drop|alter|create|replace|truncate|attach|detach|pragma|vacuum)\b", re.IGNORECASE)
CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
NON_ALPHANUMERIC_PATTERN = re.compile(r"[^a-z0-9]+")
BINARY_SIGNATURES = [b"bplist00", b"PK\x03\x04", b"\x89PNG", b"%PDF"]
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB max file size

SQL_TEXT_TRANSLATION = str.maketrans(
    {
        "\ufeff": "",
        "\u200b": "",
        "\u200c": "",
        "\u200d": "",
        "\u2060": "",
        "\u00a0": " ",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
    }
)

active_table: Optional[str] = None
active_schema: str = "No data loaded yet."


def quote_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn


def replace_active_dataset(df: pd.DataFrame, table_name: str) -> None:
    # Validate table name to prevent SQL injection
    if not table_name or not table_name.replace('_', '').replace('-', '').isalnum():
        raise ValueError("Invalid table name. Use only alphanumeric characters, underscores, and hyphens.")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        table_names = [row["name"] for row in cursor.fetchall()]
        for existing_table in table_names:
            if existing_table.startswith("sqlite_"):
                continue
            cursor.execute(f"DROP TABLE IF EXISTS {quote_identifier(existing_table)}")

        df.to_sql(table_name, conn, if_exists="replace", index=False)
        conn.commit()
    finally:
        conn.close()

def update_schema_info():
    global active_schema, active_table
    if not os.path.exists(DB_NAME):
        active_schema = "No data loaded yet."
        return
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        if not tables:
            active_schema = "No data loaded yet."
            return
            
        table_names = [t['name'] for t in tables]
        if active_table is None:
            active_schema = "No data loaded yet."
            return
            
        cursor.execute(f"PRAGMA table_info({quote_identifier(active_table)})")
        columns = cursor.fetchall()
        schema_parts = [f"{col['name']} ({col['type']})" for col in columns]
        active_schema = f"Table {active_table}: " + ", ".join(schema_parts)
    except sqlite3.OperationalError:
        active_schema = "No data loaded yet."
    finally:
        conn.close()

update_schema_info()

def preload_youtube_data():
    """Refresh the default demo dataset from disk on startup."""
    global active_table
    csv_path = os.path.join(BASE_DIR, "youtube_data.csv")
    if not os.path.exists(csv_path):
        print("No youtube_data.csv found - skipping preload")
        return

    df = pd.read_csv(csv_path)
    df.columns = df.columns.astype(str).str.strip().str.lower().str.replace(" ", "_")
    replace_active_dataset(df, "youtube_analytics")
    active_table = "youtube_analytics"
    print(f"Synced demo dataset with {len(df)} rows into youtube_analytics")
    update_schema_info()

# preload_youtube_data() # Disabled for clean startup in Lumina rebranding

LLM_MODEL = os.environ.get("LLM_MODEL") or "llama-3.3-70b-versatile"

# Initialize client at module load time
client = _init_client()

def _run_coro_in_thread(coro: Any) -> Any:
    """Run an asyncio coroutine in a fresh event loop on a worker thread.

    Used to safely call async LLM helpers from synchronous code that is
    itself invoked inside a running event-loop (FastAPI / uvicorn).
    Wrapping in a thread lets us call asyncio.run() from within FastAPI
    without hitting 'This event loop is already running'.
    """
    def _runner() -> Any:
        return asyncio.run(coro)

    _typed_runner = cast(Callable[..., Any], _runner)
    # Use a small pool to avoid blocking when multiple self-healing attempts happen
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        return pool.submit(_typed_runner).result()


async def call_llm_with_retry(func, *args, **kwargs):
    """Retries an LLM call with exponential backoff and jitter."""
    max_retries = 3
    base_delay = 2 # seconds
    
    for attempt in range(max_retries):
        try:
            return await func(*args, **kwargs)
        except RateLimitError as e:
            if attempt == max_retries - 1:
                raise e
            
            # Exponential backoff with jitter
            delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
            print(f"Rate limit hit. Retrying in {delay:.2f} seconds (attempt {attempt + 1}/{max_retries})...")
            await asyncio.sleep(delay)
        except Exception as e:
            # For other errors, we don't necessarily want to retry blindly
            raise e

class QueryRequest(BaseModel):
    query: str
    history: List[Dict[str, str]] = Field(default_factory=list)


class ExportWidgetRequest(BaseModel):
    sql: str
    title: Optional[str] = None


class DashboardMetric(BaseModel):
    title: str
    value: str
    sql: str
    format: Optional[str] = None
    insight: Optional[str] = None


class DashboardWidget(BaseModel):
    id: str
    title: str
    chart_type: str
    x_axis: str
    y_axis: str
    sql: str
    data: List[Dict[str, Any]]
    insight: Optional[str] = None


class QueryResponse(BaseModel):
    dashboard_title: str
    dashboard_subtitle: Optional[str] = None
    executive_summary: str
    kpis: List[DashboardMetric]
    widgets: List[DashboardWidget]
    recommendations: List[str]
    follow_up_questions: List[str]
    confidence: Optional[str] = None
    cannot_answer: Optional[bool] = False
    cannot_answer_reason: Optional[str] = None

SYSTEM_PROMPT = """
You are an elite data analyst AI for a YouTube content intelligence platform.
You have access to a SQLite database with this schema:
{schema}

When the user asks a question, respond with ONLY this JSON structure (no markdown, no extra text):
{
  "sql": "SELECT ...",
  "chart_type": "bar|line|pie|scatter|multi",
  "x_axis": "column_name",
  "y_axis": "column_name",
  "title": "Chart title",
  "narration": "2-3 sentence plain English insight written for a CEO. Be specific with numbers.",
  "recommendations": [
    "Actionable recommendation 1 with specific data reference",
    "Actionable recommendation 2",
    "Actionable recommendation 3"
  ],
  "confidence": "high|medium|low",
  "cannot_answer": false,
  "cannot_answer_reason": ""
}

Rules:
- If the question cannot be answered from the data, set cannot_answer: true and explain why
- Never hallucinate numbers - only use data from SQL results
- For time series always use line chart
- For comparisons across categories always use bar chart  
- For part-of-whole always use pie chart
- For correlation between two numeric columns use scatter chart
- narration must reference ACTUAL numbers from the query result, so generate SQL first
- confidence is low if query requires assumptions
"""


def get_active_columns() -> List[Dict[str, str]]:
    if not active_schema or "No data" in active_schema:
        return []

    if not active_table:
        return []

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(f"PRAGMA table_info({quote_identifier(active_table)})")
        return [dict(row) for row in cursor.fetchall()]
    except Exception:
        return []
    finally:
        conn.close()
    return []


def is_boolean_like_column(column_name: str) -> bool:
    lowered = column_name.lower()
    return lowered.startswith(("is_", "has_")) or lowered.endswith(("_flag", "_enabled", "_active"))


def infer_column_groups(columns: List[Dict[str, str]]) -> Tuple[List[str], List[str], List[str]]:
    numeric_columns: List[str] = []
    categorical_columns: List[str] = []
    date_columns: List[str] = []

    for column in columns:
        name = column["name"]
        declared_type = (column["type"] or "").upper()

        if "DATE" in declared_type or "TIME" in declared_type or any(token in name.lower() for token in ["date", "time", "month", "week", "year", "published", "created"]):
            date_columns.append(name)
            continue

        if is_boolean_like_column(name):
            categorical_columns.append(name)
            continue

        if any(token in declared_type for token in ["INT", "REAL", "NUM", "DEC", "FLOAT", "DOUBLE"]):
            numeric_columns.append(name)
        else:
            categorical_columns.append(name)

    return numeric_columns, categorical_columns, date_columns


def choose_preferred_metric(numeric_columns: List[str]) -> str:
    priority_tokens = [
        "revenue",
        "sales",
        "profit",
        "amount",
        "value",
        "views",
        "watch",
        "engagement",
        "likes",
        "comments",
        "shares",
        "count",
        "score",
    ]

    for token in priority_tokens:
        for column in numeric_columns:
            if token in column.lower():
                return column

    return numeric_columns[0] if numeric_columns else "value"


def choose_preferred_dimension(categorical_columns: List[str]) -> str:
    priority_tokens = [
        "region",
        "category",
        "segment",
        "product",
        "channel",
        "language",
        "country",
        "market",
        "campaign",
        "status",
    ]
    excluded_tokens = ["_id", "title"]

    preferred_pool = [
        column for column in categorical_columns
        if not any(token in column.lower() for token in excluded_tokens)
    ] or categorical_columns

    for token in priority_tokens:
        for column in preferred_pool:
            if token in column.lower():
                return column

    return preferred_pool[0] if preferred_pool else "segment"


def generate_example_prompts(profile: Dict[str, Any]) -> List[str]:
    numeric_columns = profile.get("numeric_columns", [])
    categorical_columns = profile.get("categorical_columns", [])
    date_columns = profile.get("date_columns", [])

    primary_metric = choose_preferred_metric(numeric_columns)
    secondary_metric_candidates = [column for column in numeric_columns if column != primary_metric]
    secondary_metric = choose_preferred_metric(secondary_metric_candidates) if secondary_metric_candidates else primary_metric
    primary_dimension = choose_preferred_dimension(categorical_columns)
    secondary_dimension = next((column for column in categorical_columns if column != primary_dimension), primary_dimension)
    primary_date = date_columns[0] if date_columns else None

    prompts: List[str] = []

    if primary_date:
        prompts.append(
            f"Show the trend of {primary_metric.replace('_', ' ')} over time and break it down by {primary_dimension.replace('_', ' ')}."
        )

    prompts.append(
        f"Compare total {primary_metric.replace('_', ' ')} across {primary_dimension.replace('_', ' ')} and highlight the top performer."
    )
    prompts.append(
        f"Which {primary_dimension.replace('_', ' ')} is underperforming on {secondary_metric.replace('_', ' ')} and what should we do next?"
    )

    if secondary_dimension != primary_dimension:
        prompts.append(
            f"Build a dashboard showing {primary_metric.replace('_', ' ')}, {secondary_metric.replace('_', ' ')}, and the key differences across {primary_dimension.replace('_', ' ')} and {secondary_dimension.replace('_', ' ')}."
        )
    else:
        prompts.append(
            f"Now filter that dashboard to the top 3 {primary_dimension.replace('_', ' ')} and explain what changed."
        )

    unique_prompts: List[str] = []
    for prompt in prompts:
        if prompt not in unique_prompts:
            unique_prompts.append(prompt)

    return cast(List[str], unique_prompts[:3])


def get_dataset_profile() -> Dict[str, Any]:
    update_schema_info()
    profile: Dict[str, Any] = {
        "table": active_table,
        "schema": active_schema,
        "row_count": 0,
        "columns": [],
        "numeric_columns": [],
        "categorical_columns": [],
        "date_columns": [],
        "example_prompts": [],
    }

    if not active_schema or "No data" in active_schema:
        return profile

    columns = get_active_columns()
    numeric_columns, categorical_columns, date_columns = infer_column_groups(columns)

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        try:
            if active_table is None:
                raise ValueError("No active table")
            cursor.execute(f"SELECT COUNT(*) AS row_count FROM {quote_identifier(active_table)}")
            row_count = cursor.fetchone()["row_count"]
        except (sqlite3.OperationalError, ValueError):
            update_schema_info()
            if active_table is None:
                return profile
            profile["table"] = active_table
            profile["schema"] = active_schema
            cursor.execute(f"SELECT COUNT(*) AS row_count FROM {quote_identifier(active_table)}")
            row_count = cursor.fetchone()["row_count"]
    finally:
        conn.close()

    profile.update(
        {
            "row_count": row_count,
            "columns": [column["name"] for column in columns],
            "numeric_columns": numeric_columns,
            "categorical_columns": categorical_columns,
            "date_columns": date_columns,
        }
    )
    profile["example_prompts"] = generate_example_prompts(profile)
    return profile


def build_history_context(history: Optional[List[Dict[str, str]]] = None) -> str:
    if not history:
        return ""

    history_lines = []
    for message in cast(Any, history or [])[-8:]:
        role = message.get("role", "user").capitalize()
        content = message.get("content", "").strip()
        if content:
            history_lines.append(f"{role}: {content}")

    if not history_lines:
        return ""

    return "\nConversation context:\n" + "\n".join(history_lines)


def strip_code_fences(text: str) -> str:
    cleaned = (text or "").strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```sql"):
        cleaned = cleaned[6:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]

    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]

    return cleaned.strip()


def normalize_sql_text(text: str) -> str:
    cleaned = strip_code_fences(text).translate(SQL_TEXT_TRANSLATION)
    cleaned = CONTROL_CHAR_PATTERN.sub("", cleaned)
    cleaned = re.sub(r"^\s*sql\s*:\s*", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip()


def extract_csv_from_webarchive(contents: bytes) -> Optional[bytes]:
    if not contents.startswith(b"bplist00"):
        return None

    try:
        payload = plistlib.loads(contents)
    except Exception:
        return None

    if not isinstance(payload, dict):
        return None

    resource = payload.get("WebMainResource")
    if not isinstance(resource, dict):
        return None

    resource_data = resource.get("WebResourceData")
    if not isinstance(resource_data, bytes) or not resource_data:
        return None

    mime_type = str(resource.get("WebResourceMIMEType") or "").lower()
    resource_url = str(resource.get("WebResourceURL") or "").lower()
    encoding = str(resource.get("WebResourceTextEncodingName") or "utf-8")

    if "csv" not in mime_type and ".csv" not in resource_url:
        return None

    try:
        text = resource_data.decode(encoding, errors="replace")
    except LookupError:
        text = resource_data.decode("utf-8", errors="replace")

    pre_match = re.search(r"<pre[^>]*>(.*)</pre>", text, flags=re.IGNORECASE | re.DOTALL)
    if pre_match:
        text = html.unescape(pre_match.group(1))

    if "," not in text and "\t" not in text:
        return None

    return text.encode("utf-8")


def looks_like_utf16_text(sample: bytes) -> bool:
    if cast(Any, sample)[0:2] in (b"\xff\xfe", b"\xfe\xff"):
        return True

    if b"\x00" not in sample:
        return False

    even_nulls = sum(1 for index in range(0, len(sample), 2) if sample[index : index + 1] == b"\x00")
    odd_nulls = sum(1 for index in range(1, len(sample), 2) if sample[index : index + 1] == b"\x00")
    total_pairs = max(len(sample) // 2, 1)

    if even_nulls / total_pairs >= 0.3 or odd_nulls / total_pairs >= 0.3:
        try:
            sample.decode("utf-16")
            return True
        except UnicodeDecodeError:
            return False

    return False


def validate_uploaded_csv_bytes(contents: bytes) -> None:
    sample = contents[0:512]
    if not sample.strip():
        raise HTTPException(status_code=400, detail="The uploaded CSV is empty.")

    if any(signature in sample for signature in BINARY_SIGNATURES):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file does not look like a plain text CSV. Export it as CSV and try again.",
        )

    if b"\x00" in sample and not looks_like_utf16_text(sample):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file contains binary data and could not be parsed as CSV.",
        )


def normalize_uploaded_csv_bytes(contents: bytes) -> bytes:
    extracted_contents = extract_csv_from_webarchive(contents)
    return extracted_contents if extracted_contents is not None else contents


def read_uploaded_csv(contents: bytes) -> pd.DataFrame:
    parse_attempts = [
        {"encoding": "utf-8"},
        {"encoding": "utf-8-sig"},
        {"encoding": "utf-16"},
        {"encoding": "utf-16-le"},
        {"encoding": "utf-16-be"},
        {"encoding": "latin1"},
    ]
    last_error: Optional[Exception] = None

    for attempt in parse_attempts:
        try:
            return pd.read_csv(
                io.BytesIO(contents),
                sep=None,
                engine="python",
                **attempt,
            )
        except (UnicodeDecodeError, pd.errors.EmptyDataError, pd.errors.ParserError) as exc:
            last_error = exc

    if isinstance(last_error, Exception):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file could not be parsed as a CSV table. Export it as a standard comma-separated file and try again.",
        ) from last_error
    raise HTTPException(
        status_code=400,
        detail="The uploaded file could not be parsed as a CSV table. Export it as a standard comma-separated file and try again.",
    )


def sanitize_column_name(name: str, fallback: str) -> str:
    cleaned = (name or "").translate(SQL_TEXT_TRANSLATION)
    cleaned = CONTROL_CHAR_PATTERN.sub("", cleaned)
    cleaned = cleaned.strip().lower()
    cleaned = NON_ALPHANUMERIC_PATTERN.sub("_", cleaned)
    cleaned = cleaned.strip("_")

    if not cleaned:
        cleaned = fallback

    if cleaned[0].isdigit():
        cleaned = f"col_{cleaned}"

    return cleaned


def sanitize_dataframe_columns(df: pd.DataFrame) -> pd.DataFrame:
    sanitized_columns: List[str] = []
    seen: Dict[str, int] = {}

    for index, raw_name in enumerate(df.columns.astype(str).tolist(), start=1):
        candidate = sanitize_column_name(raw_name, f"column_{index}")
        suffix = seen.get(candidate, 0)
        seen[candidate] = suffix + 1
        sanitized_columns.append(candidate if suffix == 0 else f"{candidate}_{suffix + 1}")

    df = df.copy()
    df.columns = sanitized_columns

    if len(df.columns) < 2:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file does not contain a usable CSV table. Please verify the export format.",
        )

    return df


def split_sql_statements(sql: str) -> List[str]:
    statements: List[str] = []
    buffer: List[str] = []
    in_single_quote = False
    in_double_quote = False
    index = 0

    while index < len(sql):
        char = sql[index]
        next_char = sql[index + 1] if index + 1 < len(sql) else ""

        if char == "'" and not in_double_quote:
            if in_single_quote and next_char == "'":
                buffer.extend([char, next_char])
                index += 2
                continue
            in_single_quote = not in_single_quote
        elif char == '"' and not in_single_quote:
            if in_double_quote and next_char == '"':
                buffer.extend([char, next_char])
                index += 2
                continue
            in_double_quote = not in_double_quote

        if char == ";" and not in_single_quote and not in_double_quote:
            statement = "".join(buffer).strip()
            if statement:
                statements.append(statement)
            buffer = []
            index += 1
            continue

        buffer.append(char)
        index += 1

    trailing_statement = "".join(buffer).strip()
    if trailing_statement:
        statements.append(trailing_statement)

    return statements


def parse_json_payload(text: str) -> Dict[str, Any]:
    cleaned = strip_code_fences(text)

    try:
        payload = json.loads(cleaned)
        if isinstance(payload, dict):
            return payload
    except json.JSONDecodeError:
        pass

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Model did not return JSON.")

    payload = json.loads(cleaned[start : end + 1])
    if not isinstance(payload, dict):
        raise ValueError("Expected a JSON object.")

    return payload


def sanitize_sql(sql: str) -> str:
    cleaned = normalize_sql_text(sql)
    cleaned = re.sub(r"/\*.*?\*/", "", cleaned, flags=re.DOTALL)
    cleaned = re.sub(r"--.*?$", "", cleaned, flags=re.MULTILINE).strip()

    if not cleaned:
        raise ValueError("No SQL was generated.")

    statements = split_sql_statements(cleaned)
    if not statements:
        raise ValueError("No SQL was generated.")

    if len(statements) > 1:
        raise ValueError("Only single-statement SQL is allowed.")

    cleaned = statements[0]
    lowered = cleaned.lower()
    if not lowered.startswith(("select", "with")):
        raise ValueError("Only SELECT queries are allowed.")

    if FORBIDDEN_SQL_PATTERN.search(cleaned):
        raise ValueError("Unsafe SQL detected in generated query.")

    return cleaned


def classify_sql_execution_error(error_message: str) -> str:
    lowered = (error_message or "").lower()

    if any(token in lowered for token in ["no such column", "no such table", "ambiguous column name"]):
        return "Your question requires columns or tables that are not present in the current dataset."

    if any(token in lowered for token in ["syntax error", "unrecognized token", "incomplete input", "misuse of aggregate"]):
        return "I couldn't safely execute the generated SQL for that request. Please try rephrasing the question."

    return "I couldn't answer that request from the current dataset."


def classify_llm_error(error: Exception) -> Tuple[int, str]:
    if isinstance(error, HTTPException):
        # Cast to HTTPException to satisfy type checker
        http_err = cast(HTTPException, error)
        detail = http_err.detail if isinstance(http_err.detail, str) else "Request failed."
        return http_err.status_code, detail

    error_text = str(error)
    lowered = error_text.lower()

    if isinstance(error, RateLimitError):
        return 429, "The LLM provider rate limit was reached. Please retry in a few minutes."

    if isinstance(error, APIStatusError):
        if "not found" in lowered and "model" in lowered:
            return 500, "The configured LLM model is not available for the current provider endpoint. Update LLM_MODEL in backend/.env."
        return 502, "The LLM provider returned an upstream error. Please retry shortly."

    return 500, error_text


def execute_select_query(sql: str) -> Tuple[str, List[Dict[str, Any]]]:
    safe_sql = sanitize_sql(sql)
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(safe_sql)
        results = [dict(row) for row in cursor.fetchall()]
        return safe_sql, results
    except Exception as e:
        print(f"SQL Execution Error: {e}")
        return safe_sql, []
    finally:
        conn.close()


def is_numeric_value(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def is_dateish_name(column_name: str) -> bool:
    lowered = column_name.lower()
    return any(token in lowered for token in ["date", "time", "month", "week", "year", "published", "created"])


def is_dateish_value(value: Any) -> bool:
    if not isinstance(value, str):
        return False

    return bool(re.match(r"^\d{4}-\d{2}(-\d{2})?", value)) or any(month in value.lower() for month in [
        "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"
    ])


def classify_result_columns(rows: List[Dict[str, Any]]) -> Tuple[List[str], List[str], List[str], List[str]]:
    if not rows:
        return [], [], [], []

    columns = [str(col) for col in rows[0].keys()]
    numeric_columns: List[str] = []
    date_columns: List[str] = []
    categorical_columns: List[str] = []

    for column in columns:
        values = [row.get(column) for row in rows[:5] if row.get(column) is not None]
        if values and all(is_numeric_value(value) for value in values):
            numeric_columns.append(column)
            continue

        if is_dateish_name(column) or (values and all(is_dateish_value(value) for value in values if isinstance(value, str))):
            date_columns.append(column)

        categorical_columns.append(column)

    return columns, numeric_columns, date_columns, categorical_columns


def choose_axes(
    rows: List[Dict[str, Any]],
    preferred_x: str,
    preferred_y: str,
    requested_chart_type: str,
) -> Tuple[str, str]:
    columns, numeric_columns, date_columns, categorical_columns = classify_result_columns(rows)
    x_axis = preferred_x if preferred_x in columns else ""
    y_axis = preferred_y if preferred_y in columns else ""

    if requested_chart_type == "scatter":
        scatter_candidates = [column for column in numeric_columns]
        if len(scatter_candidates) >= 2:
            return x_axis or scatter_candidates[0], y_axis or scatter_candidates[1]
        return "", ""

    if not x_axis:
        if requested_chart_type == "line" and date_columns:
            x_axis = date_columns[0]
        elif categorical_columns:
            x_axis = categorical_columns[0]
        elif columns:
            x_axis = columns[0]

    if not y_axis:
        numeric_candidates = [column for column in numeric_columns if column != x_axis]
        if numeric_candidates:
            y_axis = numeric_candidates[0]
        else:
            remaining = [column for column in columns if column != x_axis]
            y_axis = remaining[0] if remaining else x_axis

    return x_axis, y_axis


def choose_chart_type(rows: List[Dict[str, Any]], requested_chart_type: str, x_axis: str, y_axis: str) -> str:
    columns, numeric_columns, date_columns, _ = classify_result_columns(rows)
    chart_type = requested_chart_type if requested_chart_type in VALID_CHART_TYPES else ""

    if chart_type == "pie" and len(rows) > 6:
        chart_type = "bar"

    if chart_type == "scatter" and not (x_axis in numeric_columns and y_axis in numeric_columns):
        chart_type = ""

    if chart_type == "line" and not (x_axis in date_columns or is_dateish_name(x_axis)):
        chart_type = ""

    if chart_type and (chart_type == "table" or (x_axis in columns and y_axis in columns)):
        return chart_type

    if x_axis in numeric_columns and y_axis in numeric_columns and len(rows) <= 50:
        return "scatter"

    if x_axis and y_axis and (x_axis in date_columns or is_dateish_name(x_axis)):
        return "line"

    if x_axis and y_axis and len(rows) <= 6 and x_axis not in numeric_columns:
        return "pie"

    if x_axis and y_axis:
        return "bar"

    return "table"


def make_widget_id(title: str, index: int) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", (title or "").lower()).strip("_")
    return slug or f"widget_{index + 1}"


def slugify_filename(value: str, fallback: str = "export") -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", (value or "").lower()).strip("_")
    return slug or fallback


def extract_metric_value(rows: List[Dict[str, Any]]) -> Tuple[Optional[str], Any]:
    if not rows:
        return None, None

    row = rows[0]
    if "value" in row:
        return "value", row["value"]

    for key, value in row.items():
        if is_numeric_value(value):
            return key, value

    first_key = next(iter(row), None)
    return first_key, row.get(first_key) if first_key else None


def format_metric_value(value: Any, metric_format: Optional[str]) -> str:
    if value is None:
        return "n/a"

    if isinstance(value, bool):
        return "Yes" if value else "No"

    if metric_format == "currency" and is_numeric_value(value):
        return f"${value:,.0f}" if abs(value) >= 100 else f"${value:,.2f}"

    if metric_format == "percent" and is_numeric_value(value):
        percent_value = value * 100 if abs(value) <= 1 else value
        return f"{percent_value:.1f}%"

    if isinstance(value, int):
        return f"{value:,}"

    if isinstance(value, float):
        formatted = f"{value:,.2f}"
        return formatted.rstrip("0").rstrip(".")

    return str(value)


def compact_rows(rows: List[Dict[str, Any]], limit: int = 6) -> List[Dict[str, Any]]:
    return rows[:limit]


def query_mentions(text: str, *phrases: str) -> bool:
    return any(phrase in text for phrase in phrases)


def format_column_label(column_name: str) -> str:
    return column_name.replace("_", " ")


def aggregate_for_metric(metric: str) -> str:
    lowered = metric.lower()
    if any(token in lowered for token in ["score", "rate", "ratio", "duration"]):
        return "AVG"
    return "SUM"


def alias_for_metric(metric: str, aggregate: str) -> str:
    prefix = "avg" if aggregate == "AVG" else "total"
    return f"{prefix}_{metric.lower()}"


def metric_format_for_column(metric: str) -> str:
    lowered = metric.lower()
    if "revenue" in lowered or "amount" in lowered or "sales" in lowered:
        return "currency"
    return "number"


def choose_metrics_from_query(query: str, numeric_columns: List[str]) -> List[str]:
    lowered = query.lower()
    alias_groups = [
        ("views", ["views", "view"]),
        ("likes", ["likes", "like"]),
        ("comments", ["comments", "comment"]),
        ("shares", ["shares", "share"]),
        ("sentiment_score", ["sentiment", "sentiment score"]),
        ("estimated_revenue_usd", ["revenue", "sales", "income"]),
        ("watch_time_hours", ["watch time"]),
        ("duration_seconds", ["duration"]),
        ("duration_sec", ["duration"]),
        ("subscribers_gained", ["subscribers", "subscriber gains"]),
    ]

    selected: List[str] = []
    for column_name, phrases in alias_groups:
        if column_name in numeric_columns and query_mentions(lowered, *phrases):
            selected.append(column_name)

    for column_name in numeric_columns:
        label = format_column_label(column_name)
        if column_name not in selected and (column_name.lower() in lowered or label in lowered):
            selected.append(column_name)

    if not selected and numeric_columns:
        selected.append(choose_preferred_metric(numeric_columns))

    return list(selected)[0:4]


def choose_dimensions_from_query(query: str, categorical_columns: List[str]) -> List[str]:
    lowered = query.lower()
    alias_groups = [
        ("region", ["region", "market", "country"]),
        ("category", ["category", "categories", "content type"]),
        ("language", ["language", "languages"]),
        ("ads_enabled", ["ads enabled", "ads-enabled", "with ads", "ads only"]),
    ]

    selected: List[str] = []
    for column_name, phrases in alias_groups:
        if column_name in categorical_columns and query_mentions(lowered, *phrases):
            selected.append(column_name)

    for column_name in categorical_columns:
        label = format_column_label(column_name)
        if column_name not in selected and (column_name.lower() in lowered or label in lowered):
            selected.append(column_name)

    if not selected and categorical_columns:
        selected.append(choose_preferred_dimension(categorical_columns))

    return list(selected)[0:3]


def build_local_filter_clause(query: str, all_columns: List[str]) -> str:
    lowered = query.lower()
    clauses: List[str] = []

    if "ads_enabled" in all_columns:
        column_sql = quote_identifier("ads_enabled")
        if query_mentions(lowered, "ads enabled", "ads-enabled", "with ads", "ads only"):
            clauses.append(f"{column_sql} = 1")
        elif query_mentions(lowered, "without ads", "non ads", "non-ads", "ads disabled", "ads-disabled"):
            clauses.append(f"{column_sql} = 0")

    if "language" in all_columns:
        for language in ["english", "spanish", "urdu", "japanese", "hindi", "arabic", "german", "french", "portuguese"]:
            if language in lowered:
                clauses.append(f'LOWER({quote_identifier("language")}) = \'{language}\'')
                break

    return " WHERE " + " AND ".join(clauses) if clauses else ""


def build_time_bucket_expression(date_column: str) -> Tuple[str, str]:
    return f"substr({quote_identifier(date_column)}, 1, 7) AS period", "period"


def build_local_dashboard_title(query: str, primary_metric: str, dimensions: List[str]) -> str:
    if query_mentions(query.lower(), "trend", "over time"):
        return f"{format_column_label(primary_metric).title()} Trend Dashboard"

    if dimensions:
        named_dimensions = " and ".join(format_column_label(dimension) for dimension in dimensions[:2])
        return f"{format_column_label(primary_metric).title()} by {named_dimensions.title()}"

    return f"{format_column_label(primary_metric).title()} Overview"


def build_local_follow_up_questions(primary_metric: str, primary_dimension: Optional[str], date_column: Optional[str]) -> List[str]:
    prompts: List[str] = []

    if primary_dimension:
        prompts.append(
            f"Which {format_column_label(primary_dimension)} is underperforming on {format_column_label(primary_metric)} and what should we do next?"
        )

    if date_column:
        prompts.append(
            f"Now show how {format_column_label(primary_metric)} changes over time for the strongest {format_column_label(primary_dimension or 'segment')}."
        )

    prompts.append(
        f"Compare {format_column_label(primary_metric)} across the top {format_column_label(primary_dimension or 'segments')} and highlight the leader."
    )

    unique_prompts: List[str] = []
    for prompt in prompts:
        if prompt not in unique_prompts:
            unique_prompts.append(prompt)
    return unique_prompts[:3]


async def build_local_dashboard_plan(query: str, history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
    dataset_profile = get_dataset_profile()
    if active_table is None:
        return {
            "dashboard_title": "No dataset loaded",
            "dashboard_subtitle": "Please upload a CSV file to get started.",
            "confidence": "low",
            "cannot_answer": True,
            "cannot_answer_reason": "No active dataset table found.",
            "kpis": [],
            "widgets": [],
            "follow_up_questions": [],
        }

    numeric_columns = dataset_profile.get("numeric_columns", [])
    categorical_columns = dataset_profile.get("categorical_columns", [])
    date_columns = dataset_profile.get("date_columns", [])
    all_columns = dataset_profile.get("columns", [])
    lowered = query.lower()

    if not numeric_columns:
        return {
            "dashboard_title": "Unable to Answer",
            "dashboard_subtitle": "The current dataset does not contain numeric measures that can be charted.",
            "confidence": "low",
            "cannot_answer": True,
            "cannot_answer_reason": "The current dataset does not contain numeric columns for dashboard calculations.",
            "kpis": [],
            "widgets": [],
            "follow_up_questions": dataset_profile.get("example_prompts", []),
        }

    metrics = choose_metrics_from_query(query, numeric_columns)
    primary_metric = metrics[0]
    dimensions = choose_dimensions_from_query(query, categorical_columns)
    primary_dimension = dimensions[0] if dimensions else None
    secondary_dimension = next((dimension for dimension in dimensions[1:] if dimension != primary_dimension), None)
    date_column = date_columns[0] if date_columns else None
    where_clause = build_local_filter_clause(query, all_columns)
    has_trend = query_mentions(lowered, "trend", "over time", "monthly", "daily", "by month", "by week", "over the last")
    has_dashboard = query_mentions(lowered, "dashboard", "executive")

    kpis: List[Dict[str, Any]] = []
    widgets: List[Dict[str, Any]] = []

    aggregate = aggregate_for_metric(primary_metric)
    metric_alias = alias_for_metric(primary_metric, aggregate)
    primary_metric_sql = quote_identifier(primary_metric)

    kpis.append(
        {
            "title": f"Total {format_column_label(primary_metric).title()}" if aggregate == "SUM" else f"Average {format_column_label(primary_metric).title()}",
            "sql": f"SELECT {aggregate}({primary_metric_sql}) AS value FROM {quote_identifier(active_table)}{where_clause}",
            "format": metric_format_for_column(primary_metric),
        }
    )

    if primary_dimension:
        dimension_sql = quote_identifier(primary_dimension)
        kpis.append(
            {
                "title": f"Top {format_column_label(primary_dimension).title()}",
                "sql": (
                    f"SELECT {dimension_sql} AS {primary_dimension}, {aggregate}({primary_metric_sql}) AS value "
                    f"FROM {quote_identifier(active_table)}{where_clause} "
                    f"GROUP BY {dimension_sql} ORDER BY value DESC LIMIT 1"
                ),
                "format": metric_format_for_column(primary_metric),
            }
        )

    for extra_metric in cast(Any, metrics)[1:3]:
        extra_aggregate = aggregate_for_metric(extra_metric)
        extra_metric_sql = quote_identifier(extra_metric)
        kpis.append(
            {
                "title": f"{'Average' if extra_aggregate == 'AVG' else 'Total'} {format_column_label(extra_metric).title()}",
                "sql": f"SELECT {extra_aggregate}({extra_metric_sql}) AS value FROM {quote_identifier(active_table)}{where_clause}",
                "format": metric_format_for_column(extra_metric),
            }
        )

    if has_trend and date_column:
        dimension_sql, time_alias = build_time_bucket_expression(cast(str, date_column))
        widgets.append(
            {
                "id": "metric_trend",
                "title": f"{format_column_label(primary_metric).title()} Over Time",
                "chart_type": "line",
                "sql": (
                    f"SELECT {time_bucket_sql}, {aggregate}({primary_metric_sql}) AS {metric_alias} "
                    f"FROM {quote_identifier(active_table)}{where_clause} "
                    f"GROUP BY {time_alias} ORDER BY {time_alias}"
                ),
                "x_axis": time_alias,
                "y_axis": metric_alias,
            }
        )

    if primary_dimension:
        dimension_sql = quote_identifier(primary_dimension)
        widgets.append(
            {
                "id": "primary_dimension_compare",
                "title": f"{format_column_label(primary_metric).title()} by {format_column_label(primary_dimension).title()}",
                "chart_type": "bar",
                "sql": (
                    f"SELECT {dimension_sql} AS {primary_dimension}, {aggregate}({primary_metric_sql}) AS {metric_alias} "
                    f"FROM {quote_identifier(active_table)}{where_clause} "
                    f"GROUP BY {dimension_sql} ORDER BY {metric_alias} DESC LIMIT 12"
                ),
                "x_axis": primary_dimension,
                "y_axis": metric_alias,
            }
        )

    if secondary_dimension and secondary_dimension != primary_dimension and (has_dashboard or query_mentions(lowered, "break down", "breakdown", "compare", "category", "region")):
        dimension_sql = quote_identifier(secondary_dimension)
        widgets.append(
            {
                "id": "secondary_dimension_compare",
                "title": f"{format_column_label(primary_metric).title()} by {format_column_label(secondary_dimension).title()}",
                "chart_type": "bar",
                "sql": (
                    f"SELECT {dimension_sql} AS {secondary_dimension}, {aggregate}({primary_metric_sql}) AS {metric_alias} "
                    f"FROM {quote_identifier(active_table)}{where_clause} "
                    f"GROUP BY {dimension_sql} ORDER BY {metric_alias} DESC LIMIT 12"
                ),
                "x_axis": secondary_dimension,
                "y_axis": metric_alias,
            }
        )

    if len(metrics) > 1 and primary_dimension and secondary_dimension and primary_dimension != secondary_dimension:
        requested_selects = [
            f"{quote_identifier(primary_dimension)} AS {primary_dimension}",
            f"{quote_identifier(secondary_dimension)} AS {secondary_dimension}",
        ]
        for metric in cast(Any, list(metrics))[:4]:
            metric_aggregate = aggregate_for_metric(metric)
            metric_alias_name = alias_for_metric(metric, metric_aggregate)
            requested_selects.append(f"{metric_aggregate}({quote_identifier(metric)}) AS {metric_alias_name}")

        widgets.append(
            {
                "id": "segment_breakdown",
                "title": f"{format_column_label(primary_metric).title()} by {format_column_label(primary_dimension).title()} and {format_column_label(secondary_dimension).title()}",
                "chart_type": "table",
                "sql": (
                    f"SELECT {', '.join(requested_selects)} "
                    f"FROM {quote_identifier(active_table)}{where_clause} "
                    f"GROUP BY {quote_identifier(primary_dimension)}, {quote_identifier(secondary_dimension)} "
                    f"ORDER BY {metric_alias} DESC LIMIT 12"
                ),
                "x_axis": primary_dimension,
                "y_axis": metric_alias,
            }
        )

    if "sentiment_score" in metrics and primary_dimension:
        widgets.append(
            {
                "id": "sentiment_compare",
                "title": f"Average Sentiment by {format_column_label(primary_dimension).title()}",
                "chart_type": "bar",
                "sql": (
                    f"SELECT {quote_identifier(primary_dimension)} AS {primary_dimension}, AVG({quote_identifier('sentiment_score')}) AS avg_sentiment_score "
                    f"FROM {quote_identifier(active_table)}{where_clause} "
                    f"GROUP BY {quote_identifier(primary_dimension)} ORDER BY avg_sentiment_score DESC LIMIT 12"
                ),
                "x_axis": primary_dimension,
                "y_axis": "avg_sentiment_score",
            }
        )

    if not widgets and primary_dimension:
        widgets.append(
            {
                "id": "fallback_compare",
                "title": f"{format_column_label(primary_metric).title()} by {format_column_label(primary_dimension).title()}",
                "chart_type": "bar",
                "sql": (
                    f"SELECT {quote_identifier(primary_dimension)} AS {primary_dimension}, {aggregate}({primary_metric_sql}) AS {metric_alias} "
                    f"FROM {quote_identifier(active_table)}{where_clause} "
                    f"GROUP BY {quote_identifier(primary_dimension)} ORDER BY {metric_alias} DESC LIMIT 12"
                ),
                "x_axis": primary_dimension,
                "y_axis": metric_alias,
            }
        )

    return {
        "dashboard_title": build_local_dashboard_title(query, primary_metric, dimensions),
        "dashboard_subtitle": "Generated from local query heuristics while the LLM provider is unavailable.",
        "confidence": "medium",
        "cannot_answer": False,
        "cannot_answer_reason": "",
        "kpis": cast(Any, kpis)[:4],
        "widgets": cast(Any, widgets)[:4],
        "follow_up_questions": build_local_follow_up_questions(primary_metric, primary_dimension, date_column),
    }


def build_local_dashboard_summary(
    query: str,
    plan: Dict[str, Any],
    kpis: List[Dict[str, Any]],
    widgets: List[Dict[str, Any]],
) -> Dict[str, Any]:
    summary_parts: List[str] = []
    widget_insights: List[Dict[str, str]] = []
    kpi_insights: List[Dict[str, str]] = []
    recommendations: List[str] = []

    if kpis:
        summary_parts.append(f"{kpis[0]['title']} is {kpis[0]['value']}.")
        if len(kpis) > 1:
            summary_parts.append(f"{kpis[1]['title']} leads the current cut of the data.")

    for kpi in kpis:
        if kpi.get("insight"):
            kpi_insights.append({"title": kpi["title"], "insight": kpi["insight"]})

    for widget in widgets:
        rows = widget.get("data", [])
        x_axis = widget.get("x_axis") or ""
        y_axis = widget.get("y_axis") or ""
        if not rows or not x_axis or not y_axis:
            continue

        if widget.get("chart_type") == "line" and len(rows) >= 2:
            first_row = rows[0]
            last_row = rows[-1]
            first_value = first_row.get(y_axis)
            last_value = last_row.get(y_axis)
            if is_numeric_value(first_value) and is_numeric_value(last_value):
                delta = last_value - first_value
                direction = "increased" if delta >= 0 else "decreased"
                insight = (
                    f"{format_column_label(y_axis).title()} {direction} from {format_metric_value(first_value, None)} "
                    f"to {format_metric_value(last_value, None)} across the visible time window."
                )
                widget_insights.append({"id": widget["id"], "insight": insight})
                summary_parts.append(insight)
                recommendations.append(
                    "Review the most recent periods to understand what is driving the visible momentum change."
                )
        else:
            numeric_rows = [row for row in rows if is_numeric_value(row.get(y_axis))]
            if numeric_rows:
                top_row = max(numeric_rows, key=lambda row: row.get(y_axis, 0))
                top_label = top_row.get(x_axis)
                top_value = top_row.get(y_axis)
                insight = (
                    f"{top_label} is leading {format_column_label(y_axis)} at {format_metric_value(top_value, None)}."
                )
                widget_insights.append({"id": widget["id"], "insight": insight})
                if len(summary_parts) < 3:
                    summary_parts.append(insight)
                if len(numeric_rows) > 1:
                    bottom_row = min(numeric_rows, key=lambda row: row.get(y_axis, 0))
                    bottom_label = bottom_row.get(x_axis)
                    recommendations.append(
                        f"Double down on {top_label} while reviewing why {bottom_label} trails on {format_column_label(y_axis)}."
                    )

    if not summary_parts:
        summary_parts.append("The dashboard was generated from local query heuristics using the current dataset.")

    if not recommendations:
        recommendations = [
            "Prioritize the strongest segment shown in the dashboard and replicate the tactics behind it.",
            "Investigate the weakest segment to identify operational or content gaps.",
            "Use a follow-up filter to compare how the picture changes for a narrower slice of the data.",
        ]

    raw_prompts = cast(List[str], plan.get("follow_up_questions", []))
    follow_up_questions = raw_prompts[:3] or cast(Any, get_dataset_profile()).get("example_prompts", [])
    return {
        "executive_summary": " ".join(cast(List[str], summary_parts)[:3]),
        "recommendations": cast(List[str], recommendations)[:3],
        "widget_insights": widget_insights,
        "kpi_insights": kpi_insights,
        "follow_up_questions": follow_up_questions,
    }


async def build_local_dashboard_response(query: str, history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
    plan = await build_local_dashboard_plan(query, history)
    if plan.get("cannot_answer"):
        return {
            "dashboard_title": plan.get("dashboard_title") or query,
            "dashboard_subtitle": plan.get("dashboard_subtitle"),
            "executive_summary": "",
            "kpis": [],
            "widgets": [],
            "recommendations": [],
            "follow_up_questions": plan.get("follow_up_questions", [])[:3],
            "confidence": plan.get("confidence", "low"),
            "cannot_answer": True,
            "cannot_answer_reason": plan.get("cannot_answer_reason") or "The local fallback could not build a dashboard for this dataset.",
        }

    kpis, widgets, errors = await execute_dashboard_plan(plan)
    if not kpis and not widgets:
        return {
            "dashboard_title": plan.get("dashboard_title") or query,
            "dashboard_subtitle": plan.get("dashboard_subtitle"),
            "executive_summary": "",
            "kpis": [],
            "widgets": [],
            "recommendations": [],
            "follow_up_questions": plan.get("follow_up_questions", [])[:3],
            "confidence": "low",
            "cannot_answer": True,
            "cannot_answer_reason": "; ".join(errors) if errors else "The local fallback could not produce any usable widgets or KPIs.",
        }

    summary = build_local_dashboard_summary(query, plan, kpis, widgets)
    widget_insights = {item.get("id"): item.get("insight") for item in summary.get("widget_insights", []) if item.get("id")}
    kpi_insights = {item.get("title"): item.get("insight") for item in summary.get("kpi_insights", []) if item.get("title")}

    for widget in widgets:
        widget["insight"] = widget_insights.get(widget["id"])

    for kpi in kpis:
        if kpi["title"] in kpi_insights:
            kpi["insight"] = kpi_insights[kpi["title"]]

    return {
        "dashboard_title": plan.get("dashboard_title") or query,
        "dashboard_subtitle": plan.get("dashboard_subtitle"),
        "executive_summary": summary.get("executive_summary") or "Dashboard generated from the local fallback planner.",
        "kpis": kpis,
        "widgets": widgets,
        "recommendations": summary.get("recommendations", [])[:3],
        "follow_up_questions": cast(List[str], summary.get("follow_up_questions", []))[:3] or cast(List[str], plan.get("follow_up_questions", []))[:3],
        "confidence": plan.get("confidence", "medium"),
        "cannot_answer": False,
        "cannot_answer_reason": None,
    }


def should_use_local_dashboard_fallback(error: Exception) -> bool:
    lowered = str(error).lower()
    return isinstance(error, (RateLimitError, APIStatusError)) or any(
        token in lowered for token in ["rate limit", "quota", "resource_exhausted", "too many requests"]
    )


async def generate_dashboard_plan(query: str, history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
    if client is None:
        raise HTTPException(status_code=500, detail="LLM client is not initialized.")
    dataset_profile = get_dataset_profile()
    history_context = build_history_context(history)

    planner_prompt = f"""
You are planning a board-ready analytics dashboard for a non-technical executive.

Current table: {dataset_profile["table"]}
Schema: {dataset_profile["schema"]}
Row count: {dataset_profile["row_count"]}
Columns: {dataset_profile["columns"]}
Numeric columns: {dataset_profile["numeric_columns"]}
Categorical columns: {dataset_profile["categorical_columns"]}
Date columns: {dataset_profile["date_columns"]}
{history_context}

Return JSON only in this shape:
{{
  "dashboard_title": "short title",
  "dashboard_subtitle": "one sentence framing the answer",
  "confidence": "high|medium|low",
  "cannot_answer": false,
  "cannot_answer_reason": "",
  "kpis": [
    {{"title": "KPI name", "sql": "SELECT ...", "format": "number|percent|currency|text"}}
  ],
  "widgets": [
    {{
      "id": "stable_id",
      "title": "Widget title",
      "chart_type": "line|bar|pie|scatter|table",
      "sql": "SELECT ...",
      "x_axis": "column_name",
      "y_axis": "column_name"
    }}
  ],
  "follow_up_questions": ["question 1", "question 2", "question 3"]
}}

Rules:
- Build 2 to 4 widgets and 2 to 4 KPIs that together answer the user's request.
- Use only SQLite SELECT or WITH statements. No semicolons. No markdown.
- KPI SQL must return one row. Alias the main value column to "value" when possible.
- Widget SQL should usually return 3 to 12 rows unless the user clearly asked for detail.
- Use line for time series, bar for comparisons, pie only for parts of a whole with <= 6 slices, scatter for numeric correlation, table for detailed drill-downs.
- Favor dashboards that include a trend, a segment comparison, and one supporting view when the request is broad.
- If the request is a follow-up like "now filter this", apply the conversation history.
- If the request cannot be answered from this dataset, set cannot_answer to true and leave kpis/widgets empty.
"""

    response = await call_llm_with_retry(
        client.chat.completions.create,
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": "You are a precise analytics engineer. Return valid JSON only."},
            {"role": "user", "content": planner_prompt + f"\nUser request: {query}"},
        ],
    )
    typed_response = cast(ChatCompletion, response)

    return parse_json_payload(typed_response.choices[0].message.content)


async def execute_dashboard_plan(plan: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[str]]:
    kpi_results: List[Dict[str, Any]] = []
    widget_results: List[Dict[str, Any]] = []
    errors: List[str] = []
    
    loop = asyncio.get_event_loop()

    for index, metric_plan in enumerate(cast(Any, plan.get("kpis", []))[:4]):
        title = str(metric_plan.get("title") or f"KPI {index + 1}")
        metric_format = str(metric_plan.get("format") or "number").lower()
        if metric_format not in VALID_METRIC_FORMATS:
            metric_format = "number"

        success = False
        last_error = ""
        for attempt in range(3):
            try:
                # Offload synchronous SQL to thread pool
                safe_sql, rows = await loop.run_in_executor(None, execute_select_query, metric_plan.get("sql", ""))
                key, raw_value = extract_metric_value(rows)
                if raw_value is not None:
                    context_bits = []
                    for column, value in rows[0].items():
                        if column == key:
                            continue
                        context_bits.append(f"{column.replace('_', ' ')}: {value}")

                    kpi_results.append(
                        {
                            "title": title,
                            "value": format_metric_value(raw_value, metric_format),
                            "sql": safe_sql,
                            "format": metric_format,
                            "insight": "; ".join(cast(Any, list(context_bits))[:2]) if context_bits else None,
                        }
                    )
                success = True
                break
            except sqlite3.OperationalError as exc:
                last_error = str(exc)
                if attempt < 2 and client:
                    # Self-heal attempt
                    print(f"Self-healing KPI '{title}' (attempt {attempt + 1}). Error: {last_error}")
                    correction_prompt = f"Your previous SQL query for the KPI '{title}' failed with this SQLite error: {last_error}.\nThe schema is: {get_dataset_profile()['schema']}\nRewrite ONLY the raw SQL query to fix this. No explanation."
                    try:
                        res = cast(ChatCompletion, await call_llm_with_retry(
                            client.chat.completions.create,
                            model=LLM_MODEL,
                            messages=[{"role": "user", "content": correction_prompt}],
                        ))
                        metric_plan["sql"] = sanitize_sql(res.choices[0].message.content)
                    except Exception:
                        break  # Give up on LLM failure
                else:
                    break
            except Exception as exc:
                last_error = str(exc)
                break
                
        if not success:
            errors.append(f"{title}: {last_error}")

    for index, widget_plan in enumerate(plan.get("widgets", [])[:4]):
        title = str(widget_plan.get("title") or f"Widget {index + 1}")
        requested_chart_type = str(widget_plan.get("chart_type") or "bar").lower()

        success = False
        last_error = ""
        for attempt in range(3):
            try:
                # Offload synchronous SQL to thread pool
                safe_sql, rows = await loop.run_in_executor(None, execute_select_query, widget_plan.get("sql", ""))
                if not rows:
                    success = True
                    break

                x_axis, y_axis = choose_axes(
                    rows,
                    str(widget_plan.get("x_axis") or ""),
                    str(widget_plan.get("y_axis") or ""),
                    requested_chart_type,
                )
                chart_type = choose_chart_type(rows, requested_chart_type, x_axis, y_axis)

                limit = 50 if chart_type in {"scatter", "table"} else 12
                widget_results.append(
                    {
                        "id": str(widget_plan.get("id") or make_widget_id(title, index)),
                        "title": title,
                        "chart_type": chart_type,
                        "x_axis": x_axis,
                        "y_axis": y_axis,
                        "sql": safe_sql,
                        "data": list(rows)[0:limit],
                        "insight": None,
                    }
                )
                success = True
                break
            except sqlite3.OperationalError as exc:
                last_error = str(exc)
                if attempt < 2 and client:
                    # Self-heal attempt
                    print(f"Self-healing Widget '{title}' (attempt {attempt + 1}). Error: {last_error}")
                    correction_prompt = f"Your previous SQL query for the widget '{title}' failed with this SQLite error: {last_error}.\nThe schema is: {get_dataset_profile()['schema']}\nRewrite ONLY the raw SQL query to fix this. No explanation."
                    try:
                        res = cast(ChatCompletion, await call_llm_with_retry(
                            client.chat.completions.create,
                            model=LLM_MODEL,
                            messages=[{"role": "user", "content": correction_prompt}],
                        ))
                        widget_plan["sql"] = sanitize_sql(res.choices[0].message.content)
                    except Exception:
                        break  # Give up on LLM failure
                else:
                    break
            except Exception as exc:
                last_error = str(exc)
                break
                
        if not success:
            errors.append(f"{title}: {last_error}")

    return kpi_results, widget_results, errors


async def generate_dashboard_summary(
    query: str,
    plan: Dict[str, Any],
    kpis: List[Dict[str, Any]],
    widgets: List[Dict[str, Any]],
    history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    if client is None:
        raise HTTPException(status_code=500, detail="LLM client is not initialized.")
    summary_prompt = f"""
Write an executive-ready summary for a generated dashboard.

User request: {query}
{build_history_context(history)}
Planned dashboard title: {plan.get("dashboard_title", "")}
Planned subtitle: {plan.get("dashboard_subtitle", "")}

Executed KPI results:
{json.dumps(kpis, default=str)}

Executed widget results (truncated rows only):
{json.dumps([
    {
        "id": widget["id"],
        "title": widget["title"],
        "chart_type": widget["chart_type"],
        "sample_rows": compact_rows(widget["data"]),
    }
    for widget in widgets
], default=str)}

Return JSON only:
{{
  "executive_summary": "3-4 sentence summary for a CXO",
  "recommendations": ["action 1", "action 2", "action 3"],
  "widget_insights": [{{"id": "widget_id", "insight": "one sentence insight"}}],
  "kpi_insights": [{{"title": "KPI title", "insight": "one sentence insight"}}],
  "follow_up_questions": ["question 1", "question 2", "question 3"]
}}

Rules:
- Use only the values and rows provided above.
- Mention actual figures when they are available.
- Keep recommendations specific and business-oriented.
- If the evidence is weak or partial, say so instead of inventing details.
"""

    response = await call_llm_with_retry(
        client.chat.completions.create,
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": "You are a cautious executive analyst. Return JSON only."},
            {"role": "user", "content": summary_prompt},
        ],
    )

    typed_response = cast(ChatCompletion, response)
    return parse_json_payload(typed_response.choices[0].message.content)


def build_fallback_dashboard(query: str, legacy_response: Dict[str, Any]) -> Dict[str, Any]:
    if legacy_response.get("cannot_answer"):
        return {
            "dashboard_title": legacy_response.get("title") or "Unable to Answer",
            "dashboard_subtitle": None,
            "executive_summary": legacy_response.get("narration", ""),
            "kpis": [],
            "widgets": [],
            "recommendations": legacy_response.get("recommendations", []),
            "follow_up_questions": get_dataset_profile().get("example_prompts", []),
            "confidence": legacy_response.get("confidence", "low"),
            "cannot_answer": True,
            "cannot_answer_reason": legacy_response.get("cannot_answer_reason"),
        }

    rows = legacy_response.get("data", [])
    requested_chart_type = str(legacy_response.get("chart_type") or "table").lower()
    x_axis, y_axis = choose_axes(
        rows,
        str(legacy_response.get("x_axis") or ""),
        str(legacy_response.get("y_axis") or ""),
        requested_chart_type,
    )
    chart_type = choose_chart_type(rows, requested_chart_type, x_axis, y_axis)
    limit = 50 if chart_type in {"scatter", "table"} else 12

    return {
        "dashboard_title": legacy_response.get("title") or query,
        "dashboard_subtitle": "Single-view fallback dashboard",
        "executive_summary": legacy_response.get("narration", ""),
        "kpis": [],
        "widgets": [
            {
                "id": "primary_view",
                "title": legacy_response.get("title") or "Primary View",
                "chart_type": chart_type,
                "x_axis": x_axis,
                "y_axis": y_axis,
                "sql": legacy_response.get("sql", ""),
                "data": rows[:limit],
                "insight": legacy_response.get("narration"),
            }
        ],
        "recommendations": legacy_response.get("recommendations", []),
        "follow_up_questions": get_dataset_profile().get("example_prompts", []),
        "confidence": legacy_response.get("confidence"),
        "cannot_answer": False,
        "cannot_answer_reason": None,
    }


async def process_dashboard_query(query: str, history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
    try:
        try:
            plan = await generate_dashboard_plan(query, history)
        except Exception as exc:
            if should_use_local_dashboard_fallback(exc):
                return await build_local_dashboard_response(query, history)
            raise

        if plan.get("cannot_answer"):
            return {
                "dashboard_title": plan.get("dashboard_title") or query,
                "dashboard_subtitle": plan.get("dashboard_subtitle"),
                "executive_summary": "",
                "kpis": [],
                "widgets": [],
                "recommendations": [],
                "follow_up_questions": cast(Any, plan.get("follow_up_questions", []))[:3] or cast(Any, get_dataset_profile().get("example_prompts", [])),
                "confidence": plan.get("confidence", "low"),
                "cannot_answer": True,
                "cannot_answer_reason": plan.get("cannot_answer_reason") or "The requested dashboard cannot be generated from the available data.",
            }

        # Execute planned SQL queries safely (async)
        kpis, widgets, errors = await execute_dashboard_plan(plan)
        if not kpis and not widgets:
            if errors:
                raise ValueError("; ".join(errors))
            raise ValueError("The dashboard plan did not produce any usable widgets or KPIs.")

        try:
            summary = await generate_dashboard_summary(query, plan, kpis, widgets, history)
        except Exception as exc:
            if should_use_local_dashboard_fallback(exc):
                summary = build_local_dashboard_summary(query, plan, kpis, widgets)
            else:
                raise
        widget_insights = {item.get("id"): item.get("insight") for item in summary.get("widget_insights", []) if item.get("id")}
        kpi_insights = {item.get("title"): item.get("insight") for item in summary.get("kpi_insights", []) if item.get("title")}

        for widget in widgets:
            widget["insight"] = widget_insights.get(widget["id"])

        for kpi in kpis:
            if kpi["title"] in kpi_insights:
                kpi["insight"] = kpi_insights[kpi["title"]]

        follow_up_questions = summary.get("follow_up_questions", [])[:3] or plan.get("follow_up_questions", [])[:3]
        if not follow_up_questions:
            follow_up_questions = get_dataset_profile().get("example_prompts", [])

        return {
            "dashboard_title": plan.get("dashboard_title") or query,
            "dashboard_subtitle": plan.get("dashboard_subtitle"),
            "executive_summary": summary.get("executive_summary") or "Dashboard generated successfully.",
            "kpis": kpis,
            "widgets": widgets,
            "recommendations": summary.get("recommendations", [])[:3],
            "follow_up_questions": follow_up_questions,
            "confidence": plan.get("confidence", "medium"),
            "cannot_answer": False,
            "cannot_answer_reason": None,
        }
    except Exception as exc:
        if should_use_local_dashboard_fallback(exc):
            return await build_local_dashboard_response(query, history)
        legacy_response = await process_analytic_query(query, active_schema, client, history)
        return build_fallback_dashboard(query, cast(Dict[str, Any], legacy_response))

async def process_analytic_query(query: str, schema: str, openai_client: Optional[AsyncOpenAI], history: Optional[List[Dict[str, str]]] = None):
    if openai_client is None:
        raise HTTPException(status_code=500, detail="LLM client is not initialized. Please set LLM_API_KEY in the backend .env file.")
    # Pass 1: generate SQL
    history_context = build_history_context(history)

    sql_prompt = f"Given SQLite schema: {schema}{history_context}\nGenerate ONLY the raw SQL query to answer this user question: '{query}'. Return only the SQL string, no markdown ticks, no explanation."
    res1 = await call_llm_with_retry(
        openai_client.chat.completions.create,
        model=LLM_MODEL,
        messages=[{"role": "user", "content": sql_prompt}]
    )
    res1_typed = cast(ChatCompletion, res1)
    sql = sanitize_sql(res1_typed.choices[0].message.content)
    
    # Execute SQL
    sql_error = None
    try:
        _, data = execute_select_query(sql)
    except Exception as e:
        sql_error = str(e)
        data = []

    # Step 4: If SQL fails, return graceful error protecting against hallucinated columns
    if sql_error:
        return {
            "sql": sql,
            "cannot_answer": True,
            "cannot_answer_reason": classify_sql_execution_error(sql_error),
            "data": [],
            "chart_type": "table",
            "x_axis": "",
            "y_axis": "",
            "narration": "I could not answer this question using the available data.",
            "recommendations": []
        }
        
    if not data:
        return {
            "sql": sql,
            "cannot_answer": True,
            "cannot_answer_reason": "The query executed successfully but returned exactly 0 rows.",
            "data": [],
            "chart_type": "table",
            "x_axis": "",
            "y_axis": "",
            "narration": "There is no data matching this query.",
            "recommendations": []
        }

    # Pass 2: format JSON based on the fetched actual data!
    # Sending BOTH the question AND the real data back to ensure hallucination-free narration
    user_msg = f"""
The user asked: "{query}"
The actual query results are: {list(data)[0:20]}

Write a 2-3 sentence CEO-level insight using ONLY these exact numbers.
Then give 3 actionable recommendations based on this specific data.
Output MUST follow the strict JSON formatting rules provided.
"""
    sys_prompt = SYSTEM_PROMPT.replace("{schema}", schema)
    
    res2 = await call_llm_with_retry(
        openai_client.chat.completions.create,
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_msg}
        ]
    )
    
    try:
        res2_typed = cast(ChatCompletion, res2)
        result = parse_json_payload(res2_typed.choices[0].message.content)
    except Exception:
        result = {}
        
    result["data"] = data
    result["sql"] = sql # override with the actual executed SQL
    return result

@app.get("/api/health")
def health():
    try:
        has_data = active_schema and "No data" not in active_schema
        dataset_profile = get_dataset_profile()
        is_demo_mode = client is None
        return {
            "status": "ok",
            "has_data": has_data,
            "table": active_table,
            "row_count": dataset_profile.get("row_count", 0),
            "columns": dataset_profile.get("columns", []),
            "schema": dataset_profile.get("schema", ""),
            "example_prompts": dataset_profile.get("example_prompts", []),
            "demo_mode": is_demo_mode,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/insights")
async def get_insights():
    if not active_schema or "No data" in active_schema:
        return {"insights": []}
        
    if not client:
        return {"insights": [{"title": "API Key Missing", "description": "Please set API Key."}]}

    auto_queries = [
        "Which category has the highest average views?",
        "Which region has the worst sentiment score?", 
        "What video duration range gets the most likes?",
        "Which language has the highest engagement rate (likes+comments+shares / views)?",
        "Are ads_enabled videos getting more or fewer views on average?"
    ]
    
    cards = []
    # Running sequentially to respect rate limits while allowing the powerful 2-step queries to complete
    for q in auto_queries:
        try:
            res_dict = await process_analytic_query(q, active_schema, client)
            res_val = cast(Dict[str, Any], res_dict)
            title = res_val.get("title", q)
            narration = res_val.get("narration", "No insight generated.")
            cards.append({"title": title, "description": narration})
        except RateLimitError:
            return {"insights": [{"title": "Rate Limit Reached", "description": "The LLM provider rate limit was reached. Please retry in a few minutes."}]}
        except APIStatusError:
            return {"insights": [{"title": "Provider Unavailable", "description": "The LLM provider returned an upstream error. Please retry shortly."}]}
        except Exception as e:
            print(f"Error on auto query '{q}': {e}")
            
    return {"insights": cards}

@app.get("/api/reset")
async def reset_dataset():
    global active_table, active_schema
    active_table = None
    if os.path.exists(DB_NAME):
        try:
            os.remove(DB_NAME)
        except:
            pass
    active_schema = "No data loaded yet."
    update_schema_info()
    return {"message": "System reset to clean Lumina state", "table": None}

@app.post("/api/export/widget-csv")
async def export_widget_csv(request: ExportWidgetRequest):
    try:
        _, rows = execute_select_query(request.sql)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    if not rows:
        raise HTTPException(status_code=404, detail="The widget query returned no rows to export.")

    csv_payload = pd.DataFrame(rows).to_csv(index=False).encode("utf-8-sig")
    filename = f"{slugify_filename(request.title or 'widget_export')}.csv"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

    return Response(
        content=csv_payload,
        media_type="text/csv; charset=utf-8",
        headers=headers,
    )

@app.post("/api/upload")
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed.")
    
    try:
        contents = await file.read()
        
        # Validate file size
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB.")
        
        if len(contents) == 0:
            raise HTTPException(status_code=400, detail="The uploaded CSV file is empty.")
        
        contents = normalize_uploaded_csv_bytes(contents)
        validate_uploaded_csv_bytes(contents)
        df = read_uploaded_csv(contents)

        if df.empty:
            raise HTTPException(status_code=400, detail="The uploaded CSV has headers but no data rows.")

        df = sanitize_dataframe_columns(df)
        
        global active_table
        active_table = file.filename.split('.')[0].lower().replace(' ', '_')
        active_table = ''.join(c for c in active_table if c.isalnum() or c == '_')
        if active_table and active_table[0].isdigit():
            active_table = f"t_{active_table}"
        if not active_table:
            active_table = "data_table"

        replace_active_dataset(df, active_table)
        
        update_schema_info()

        sample_data = df.head(5).fillna("").to_dict(orient="records")
        
        return {
            "message": "File uploaded successfully",
            "table_name": active_table,
            "schema": active_schema,
            "row_count": len(df),
            "columns": df.columns.tolist(),
            "example_prompts": get_dataset_profile().get("example_prompts", []),
            "sample_data": sample_data,
            "auto_insights": []
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        status_code, detail = classify_llm_error(e)
        raise HTTPException(status_code=status_code, detail=detail)

@app.post("/api/query", response_model=QueryResponse)
async def query_data(request: QueryRequest):
    if not request.query or not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty. Please provide a question.")

    if not active_schema or "No data" in active_schema:
        raise HTTPException(status_code=400, detail="I don't have data on that. Please upload a CSV first.")
        
    if not client:
         raise HTTPException(status_code=500, detail="LLM_API_KEY is missing. Please set it in the backend.")
         
    try:
        res = await process_dashboard_query(request.query, request.history)

        return {
            "dashboard_title": str(res.get("dashboard_title", request.query)),
            "dashboard_subtitle": res.get("dashboard_subtitle"),
            "executive_summary": str(res.get("executive_summary", "")),
            "kpis": res.get("kpis", []),
            "widgets": res.get("widgets", []),
            "recommendations": res.get("recommendations", []),
            "follow_up_questions": res.get("follow_up_questions", []),
            "confidence": res.get("confidence"),
            "cannot_answer": res.get("cannot_answer", False),
            "cannot_answer_reason": res.get("cannot_answer_reason")
        }
    except Exception as e:
        print(f"Error: {e}")
        status_code, detail = classify_llm_error(e)
        raise HTTPException(status_code=status_code, detail=detail)
