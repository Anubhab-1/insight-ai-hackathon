import os
import pytest

os.environ.setdefault("INSIGHTAI_DISABLE_LLM", "true")
os.environ.setdefault("INSIGHTAI_ALLOW_DEMO", "true")
os.environ.setdefault("INSIGHTAI_TEST_DATA", "true")

import main  # noqa: E402


@pytest.fixture(autouse=True)
def ensure_demo_dataset():
    if main.active_table != "youtube_analytics":
        main.preload_youtube_data()
    yield
