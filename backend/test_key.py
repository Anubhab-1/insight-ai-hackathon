from fastapi.testclient import TestClient

import main


def test_insights_endpoint_reports_missing_api_key(monkeypatch):
    monkeypatch.setattr(main, "client", None)

    with TestClient(main.app) as client:
        response = client.get("/api/insights")

    assert response.status_code == 200
    payload = response.json()
    assert payload["insights"][0]["title"] == "API Key Missing"


def test_query_endpoint_requires_api_key(monkeypatch):
    monkeypatch.setattr(main, "client", None)

    with TestClient(main.app) as client:
        response = client.post(
            "/api/query",
            json={"query": "Show me views by region", "history": []},
        )

    assert response.status_code == 500
    assert response.json()["detail"] == "LLM_API_KEY is missing. Please set it in the backend."


def test_get_dataset_profile_recovers_from_stale_active_table(monkeypatch):
    monkeypatch.setattr(main, "active_table", "missing_table_name")

    profile = main.get_dataset_profile()

    assert profile["table"] == "youtube_analytics"
    assert profile["row_count"] > 0
