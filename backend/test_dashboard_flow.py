import asyncio

import pytest
import main


@pytest.fixture(autouse=False)
def with_demo_dataset():
    """Preload the YouTube demo dataset so local dashboard logic has data to work with."""
    main.preload_youtube_data()
    yield
    # Leave the dataset in place; no teardown needed for tests



async def fake_generate_dashboard_plan(query, history=None):
    return {
        "dashboard_title": "Executive Views Dashboard",
        "dashboard_subtitle": "A multi-view answer for leadership.",
        "confidence": "high",
        "cannot_answer": False,
        "kpis": [
            {
                "title": "Total Views",
                "sql": "SELECT SUM(views) AS value FROM youtube_analytics",
                "format": "number",
            }
        ],
        "widgets": [
            {
                "id": "views_by_region",
                "title": "Views by Region",
                "chart_type": "bar",
                "sql": "SELECT region, SUM(views) AS total_views FROM youtube_analytics GROUP BY region ORDER BY total_views DESC",
                "x_axis": "region",
                "y_axis": "total_views",
            },
            {
                "id": "views_by_month",
                "title": "Views by Month",
                "chart_type": "line",
                "sql": "SELECT substr(published_at, 1, 7) AS month, SUM(views) AS total_views FROM youtube_analytics GROUP BY month ORDER BY month",
                "x_axis": "month",
                "y_axis": "total_views",
            },
        ],
        "follow_up_questions": [
            "Which category is driving the strongest results?",
            "How do likes and comments trend with views?",
            "What changes if we only look at ads-enabled videos?",
        ],
    }


async def fake_generate_dashboard_summary(query, plan, kpis, widgets, history=None):
    return {
        "executive_summary": "Views are concentrated in Asia and North America, with clear month-over-month concentration in the uploaded sample.",
        "recommendations": [
            "Double down on the best-performing regions.",
            "Audit the weakest region for format or distribution issues.",
            "Compare category mix before changing the publishing strategy.",
        ],
        "widget_insights": [
            {"id": "views_by_region", "insight": "Asia leads the current region mix."},
            {"id": "views_by_month", "insight": "Monthly performance is clustered around the publishing schedule."},
        ],
        "kpi_insights": [
            {"title": "Total Views", "insight": "This KPI reflects the full dataset total."}
        ],
        "follow_up_questions": [
            "Which category is driving the strongest results?",
            "How do likes and comments trend with views?",
            "What changes if we only look at ads-enabled videos?",
        ],
    }


def test_process_dashboard_query_returns_multi_widget_dashboard(monkeypatch):
    monkeypatch.setattr(main, "generate_dashboard_plan", fake_generate_dashboard_plan)
    monkeypatch.setattr(main, "generate_dashboard_summary", fake_generate_dashboard_summary)

    response = asyncio.run(main.process_dashboard_query("Show me a leadership dashboard for views.", []))

    assert response["dashboard_title"] == "Executive Views Dashboard"
    assert response["confidence"] == "high"
    assert len(response["kpis"]) == 1
    assert len(response["widgets"]) == 2
    assert response["widgets"][0]["title"] == "Views by Region"
    assert response["widgets"][0]["insight"] == "Asia leads the current region mix."
    assert response["kpis"][0]["insight"] == "This KPI reflects the full dataset total."
    assert len(response["follow_up_questions"]) == 3


async def fake_generate_dashboard_summary_with_irrelevant_followups(query, plan, kpis, widgets, history=None):
    return {
        "executive_summary": "Views are concentrated in Asia and North America, with clear month-over-month concentration in the uploaded sample.",
        "recommendations": [
            "Double down on the best-performing regions.",
            "Audit the weakest region for format or distribution issues.",
            "Compare category mix before changing the publishing strategy.",
        ],
        "widget_insights": [
            {"id": "views_by_region", "insight": "Asia leads the current region mix."},
            {"id": "views_by_month", "insight": "Monthly performance is clustered around the publishing schedule."},
        ],
        "kpi_insights": [
            {"title": "Total Views", "insight": "This KPI reflects the full dataset total."}
        ],
        "follow_up_questions": [
            "What is churn by subscription plan next quarter?",
            "Forecast EBITDA for the next six months.",
            "How should we price the premium tier?",
        ],
    }


async def fake_rate_limited_dashboard_plan(query, history=None):
    raise RuntimeError("Rate limit reached for the provider")


def test_process_dashboard_query_uses_local_fallback_when_rate_limited(monkeypatch, with_demo_dataset):
    monkeypatch.setattr(main, "generate_dashboard_plan", fake_rate_limited_dashboard_plan)

    response = asyncio.run(
        main.process_dashboard_query(
            "Show the trend of views over time and break it down by region.",
            [],
        )
    )

    assert response["cannot_answer"] is False
    assert response["dashboard_subtitle"] == "Generated from local query heuristics while the LLM provider is unavailable."
    assert len(response["kpis"]) >= 1
    assert len(response["widgets"]) >= 2
    assert any(widget["chart_type"] == "line" for widget in response["widgets"])
    assert any(widget["chart_type"] == "bar" for widget in response["widgets"])


def test_process_dashboard_query_replaces_irrelevant_follow_up_questions(monkeypatch):
    monkeypatch.setattr(main, "generate_dashboard_plan", fake_generate_dashboard_plan)
    monkeypatch.setattr(main, "generate_dashboard_summary", fake_generate_dashboard_summary_with_irrelevant_followups)

    response = asyncio.run(main.process_dashboard_query("Show me a leadership dashboard for views.", []))

    assert len(response["follow_up_questions"]) == 3
    assert all("views" in question.lower() or "region" in question.lower() or "month" in question.lower() for question in response["follow_up_questions"])
    assert all("churn" not in question.lower() for question in response["follow_up_questions"])


def test_choose_chart_type_avoids_pie_when_slices_are_tightly_clustered():
    rows = [
        {"region": "US", "total_views": 2_008_898},
        {"region": "PK", "total_views": 2_007_482},
        {"region": "IN", "total_views": 2_002_028},
        {"region": "BR", "total_views": 1_997_321},
        {"region": "UK", "total_views": 1_996_858},
    ]

    chart_type = main.choose_chart_type(rows, "pie", "region", "total_views")

    assert chart_type == "bar"


def test_local_summary_uses_narrow_lead_language_for_close_category_results():
    summary = main.build_local_dashboard_summary(
        "Compare views by region.",
        {"follow_up_questions": []},
        [],
        [
            {
                "id": "views_by_region",
                "title": "Views by Region",
                "chart_type": "bar",
                "x_axis": "region",
                "y_axis": "total_views",
                "data": [
                    {"region": "US", "total_views": 2_008_898},
                    {"region": "PK", "total_views": 2_007_482},
                    {"region": "IN", "total_views": 2_002_028},
                    {"region": "BR", "total_views": 1_997_321},
                    {"region": "UK", "total_views": 1_996_858},
                ],
            }
        ],
    )

    assert "narrowly ahead" in summary["executive_summary"]
    assert "close race" in summary["recommendations"][0]
