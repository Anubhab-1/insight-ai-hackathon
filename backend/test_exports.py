from fastapi.testclient import TestClient

import main


def test_export_widget_csv_returns_full_csv_payload():
    with TestClient(main.app) as client:
        response = client.post(
            "/api/export/widget-csv",
            json={
                "sql": "SELECT region, views FROM youtube_analytics LIMIT 3",
                "title": "Region Export",
            },
        )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert 'filename="region_export.csv"' in response.headers["content-disposition"]

    payload = response.content.decode("utf-8-sig")
    lines = payload.strip().splitlines()

    assert lines[0] == "region,views"
    assert len(lines) == 4
