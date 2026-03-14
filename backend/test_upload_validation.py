import pandas as pd
import plistlib
from fastapi import HTTPException
from fastapi.testclient import TestClient

import main


def test_validate_uploaded_csv_bytes_rejects_binary_signature():
    try:
        main.validate_uploaded_csv_bytes(b"bplist00\x01\x02\x03not_a_csv")
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "does not look like a plain text CSV" in exc.detail
    else:
        raise AssertionError("Expected binary upload validation to fail.")


def test_validate_uploaded_csv_bytes_allows_utf16_text():
    utf16_csv = "region,total_value\nEast,10\nWest,20\n".encode("utf-16")

    main.validate_uploaded_csv_bytes(utf16_csv)


def test_sanitize_dataframe_columns_normalizes_and_deduplicates_headers():
    df = pd.DataFrame([[1, 2]], columns=[" Total Value ", "Total-Value"])
    cleaned = main.sanitize_dataframe_columns(df)

    assert cleaned.columns.tolist() == ["total_value", "total_value_2"]


def test_upload_endpoint_returns_empty_auto_insights_after_upload(monkeypatch):
    monkeypatch.setattr(main, "client", None)

    with TestClient(main.app) as client:
        response = client.post(
            "/api/upload",
            files={"file": ("sales.csv", b"region,total_value\nEast,10\nWest,20\n", "text/csv")},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["table_name"] == "sales"
    assert payload["auto_insights"] == []
    assert payload["row_count"] == 2

    main.preload_youtube_data()


def test_upload_endpoint_accepts_utf16_csv(monkeypatch):
    monkeypatch.setattr(main, "client", None)
    utf16_payload = "region,total_value\nEast,10\nWest,20\n".encode("utf-16")

    with TestClient(main.app) as client:
        response = client.post(
            "/api/upload",
            files={"file": ("sales_utf16.csv", utf16_payload, "text/csv")},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["table_name"] == "sales_utf16"
    assert payload["row_count"] == 2
    assert payload["columns"] == ["region", "total_value"]

    main.preload_youtube_data()


def test_extract_csv_from_webarchive_returns_plain_csv_bytes():
    webarchive = plistlib.dumps(
        {
            "WebMainResource": {
                "WebResourceData": (
                    b'<html><body><pre style="word-wrap: break-word; white-space: pre-wrap;">'
                    b"region,total_value\nEast,10\nWest,20\n"
                    b"</pre></body></html>"
                ),
                "WebResourceMIMEType": "text/csv",
                "WebResourceURL": "https://example.com/data.csv",
                "WebResourceTextEncodingName": "UTF-8",
                "WebResourceFrameName": "",
            }
        },
        fmt=plistlib.FMT_BINARY,
    )

    extracted = main.extract_csv_from_webarchive(webarchive)

    assert extracted == b"region,total_value\nEast,10\nWest,20\n"


def test_upload_endpoint_accepts_webarchive_wrapped_csv(monkeypatch):
    monkeypatch.setattr(main, "client", None)
    webarchive = plistlib.dumps(
        {
            "WebMainResource": {
                "WebResourceData": (
                    b'<html><body><pre style="word-wrap: break-word; white-space: pre-wrap;">'
                    b"region,total_value\nEast,10\nWest,20\n"
                    b"</pre></body></html>"
                ),
                "WebResourceMIMEType": "text/csv",
                "WebResourceURL": "https://example.com/data.csv",
                "WebResourceTextEncodingName": "UTF-8",
                "WebResourceFrameName": "",
            }
        },
        fmt=plistlib.FMT_BINARY,
    )

    with TestClient(main.app) as client:
        response = client.post(
            "/api/upload",
            files={"file": ("wrapped.csv", webarchive, "text/csv")},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["table_name"] == "wrapped"
    assert payload["row_count"] == 2
    assert payload["columns"] == ["region", "total_value"]

    main.preload_youtube_data()
