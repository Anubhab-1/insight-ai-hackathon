import asyncio
from types import SimpleNamespace
from typing import List

from fastapi import HTTPException

import main


class FakeCompletionResponse:
    def __init__(self, content: str):
        self.choices = [SimpleNamespace(message=SimpleNamespace(content=content))]


class FakeCompletions:
    def __init__(self, responses: List[str]):
        self._responses = responses

    async def create(self, *args, **kwargs):
        return FakeCompletionResponse(self._responses.pop(0))


class FakeAsyncOpenAI:
    def __init__(self, responses: List[str]):
        self.chat = SimpleNamespace(completions=FakeCompletions(responses))


def test_execute_select_query_strips_control_characters():
    sql, rows = main.execute_select_query("SELECT region,\x01views FROM youtube_analytics LIMIT 2")

    assert "\x01" not in sql
    assert sql == "SELECT region,views FROM youtube_analytics LIMIT 2"
    assert len(rows) == 2


def test_sanitize_sql_accepts_single_statement_with_trailing_semicolon_and_comment():
    sql = main.sanitize_sql("SELECT region, views FROM youtube_analytics LIMIT 2; -- trailing note")

    assert sql == "SELECT region, views FROM youtube_analytics LIMIT 2"


def test_sanitize_sql_rejects_true_multi_statement_sql():
    try:
        main.sanitize_sql("SELECT region FROM youtube_analytics LIMIT 1; SELECT category FROM youtube_analytics LIMIT 1")
    except ValueError as exc:
        assert str(exc) == "Only single-statement SQL is allowed."
    else:
        raise AssertionError("Expected multi-statement SQL to be rejected.")


def test_sanitize_sql_allows_semicolons_inside_escaped_string_literals():
    sql = main.sanitize_sql("SELECT 'leader'';''board' AS note, region FROM youtube_analytics LIMIT 1;")

    assert sql == "SELECT 'leader'';''board' AS note, region FROM youtube_analytics LIMIT 1"


def test_process_analytic_query_returns_clear_message_for_invalid_sql():
    fake_client = FakeAsyncOpenAI(["SELECT FROM youtube_analytics"])

    result = asyncio.run(
        main.process_analytic_query(
            "Break this in a way that returns invalid SQL",
            main.active_schema,
            fake_client,
        )
    )

    assert result["cannot_answer"] is True
    assert result["cannot_answer_reason"] == "I couldn't safely execute the generated SQL for that request. Please try rephrasing the question."


def test_classify_llm_error_preserves_http_exception_details():
    status_code, detail = main.classify_llm_error(HTTPException(status_code=400, detail="Bad CSV upload"))

    assert status_code == 400
    assert detail == "Bad CSV upload"
