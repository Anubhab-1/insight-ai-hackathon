import asyncio
from types import SimpleNamespace
from typing import List

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


def test_process_analytic_query_executes_generated_sql_and_uses_llm_json():
    fake_client = FakeAsyncOpenAI(
        [
            "```sql\nSELECT region, views FROM youtube_analytics LIMIT 2\n```",
            (
                '{"chart_type":"bar","x_axis":"region","y_axis":"views",'
                '"title":"Top Regions","narration":"Views are concentrated in two regions.",'
                '"recommendations":["Double down on the top region","Test a second region","Track weekly movement"],'
                '"confidence":"high","cannot_answer":false,"cannot_answer_reason":""}'
            ),
        ]
    )

    result = asyncio.run(
        main.process_analytic_query(
            "Which regions have the most views?",
            main.active_schema,
            fake_client,
        )
    )

    assert result["sql"] == "SELECT region, views FROM youtube_analytics LIMIT 2"
    assert result["title"] == "Top Regions"
    assert result["chart_type"] == "bar"
    assert result["confidence"] == "high"
    assert len(result["data"]) == 2
    assert set(result["data"][0]) == {"region", "views"}
    assert len(result["recommendations"]) == 3


def test_build_fallback_dashboard_uses_renderable_axes_from_rows():
    fallback = main.build_fallback_dashboard(
        "Show me views by region and category",
        {
            "title": "Views by Region and Category",
            "chart_type": "bar",
            "x_axis": "region || ' - ' || category",
            "y_axis": "total_views",
            "sql": "SELECT region, category, SUM(views) AS total_views FROM youtube_analytics GROUP BY region, category",
            "data": [
                {"region": "North America", "category": "Gaming", "total_views": 10},
                {"region": "Latin America", "category": "Education", "total_views": 8},
            ],
            "narration": "A fallback summary.",
            "recommendations": ["Do something next."],
            "confidence": "medium",
        },
    )

    widget = fallback["widgets"][0]
    assert widget["chart_type"] == "bar"
    assert widget["x_axis"] == "region"
    assert widget["y_axis"] == "total_views"
    assert len(widget["data"]) == 2
