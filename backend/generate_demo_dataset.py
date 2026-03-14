from __future__ import annotations

from datetime import date, timedelta
import math
import random

import pandas as pd


OUTPUT_PATH = "youtube_data.csv"
ROW_COUNT = 1560
SEED = 42


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(value, maximum))


def build_title(category: str, region: str, index: int) -> str:
    themes = {
        "Education": ["SQL Playbook", "Data Sprint", "Growth Workshop", "Metrics Deep Dive"],
        "Technology": ["Cloud Briefing", "AI Systems", "FastAPI Build", "Next.js Review"],
        "Business": ["Revenue Pulse", "Market Movers", "Boardroom Brief", "Pipeline Review"],
        "Finance": ["Margin Moves", "Investor Lens", "Capital Breakdown", "Budget Watch"],
        "Gaming": ["Launch Meta", "Patch Review", "Creator Challenge", "Competitive Run"],
        "Lifestyle": ["Creator Routine", "Studio Reset", "Productivity Lab", "Weekly Upgrade"],
    }
    theme = themes[category][index % len(themes[category])]
    return f"{region} {theme} #{index + 1}"


def main() -> None:
    random.seed(SEED)

    categories = ["Education", "Technology", "Business", "Finance", "Gaming", "Lifestyle"]
    regions = [
        "North America",
        "Europe",
        "Asia",
        "Latin America",
        "Middle East",
        "Africa",
    ]
    languages = {
        "North America": ["English", "Spanish"],
        "Europe": ["English", "German", "French"],
        "Asia": ["English", "Hindi", "Japanese"],
        "Latin America": ["Spanish", "Portuguese"],
        "Middle East": ["Arabic", "English"],
        "Africa": ["English", "French"],
    }
    base_views = {
        "Education": 120_000,
        "Technology": 180_000,
        "Business": 150_000,
        "Finance": 135_000,
        "Gaming": 260_000,
        "Lifestyle": 210_000,
    }
    base_duration = {
        "Education": 780,
        "Technology": 690,
        "Business": 720,
        "Finance": 660,
        "Gaming": 840,
        "Lifestyle": 540,
    }
    base_sentiment = {
        "Education": 0.84,
        "Technology": 0.81,
        "Business": 0.79,
        "Finance": 0.77,
        "Gaming": 0.74,
        "Lifestyle": 0.8,
    }
    region_multiplier = {
        "North America": 1.22,
        "Europe": 1.08,
        "Asia": 1.34,
        "Latin America": 0.92,
        "Middle East": 0.88,
        "Africa": 0.79,
    }

    start_date = date(2024, 1, 1)
    rows = []

    for index in range(ROW_COUNT):
        category = categories[index % len(categories)]
        # Rotate regions at a different cadence than categories so the dataset
        # covers every category-region combination instead of collapsing to two regions.
        region = regions[(index // len(categories)) % len(regions)]
        language = random.choice(languages[region])
        published_at = start_date + timedelta(days=index % 420)
        ads_enabled = random.random() < 0.76

        seasonal_lift = 1.0 + 0.18 * math.sin((published_at.timetuple().tm_yday / 365) * math.tau)
        volatility = random.lognormvariate(0, 0.38)
        duration_seconds = int(clamp(random.gauss(base_duration[category], 110), 210, 1800))

        views = int(base_views[category] * region_multiplier[region] * seasonal_lift * volatility)
        likes_rate = random.uniform(0.034, 0.082)
        comments_rate = random.uniform(0.0035, 0.016)
        shares_rate = random.uniform(0.0018, 0.0105)

        likes = int(views * likes_rate)
        comments = int(views * comments_rate)
        shares = int(views * shares_rate)
        sentiment_score = round(clamp(base_sentiment[category] + random.gauss(0, 0.06), 0.42, 0.97), 2)
        watch_time_hours = round(views * duration_seconds * random.uniform(0.29, 0.57) / 3600, 1)
        estimated_revenue_usd = round((views / 1000) * random.uniform(2.6, 10.4) * (1.0 if ads_enabled else 0.32), 2)
        subscribers_gained = int(views * random.uniform(0.001, 0.0045))

        rows.append(
            {
                "video_id": f"v{index + 1:04d}",
                "title": build_title(category, region, index),
                "published_at": published_at.isoformat(),
                "category": category,
                "language": language,
                "duration_seconds": duration_seconds,
                "views": views,
                "likes": likes,
                "comments": comments,
                "shares": shares,
                "sentiment_score": sentiment_score,
                "region": region,
                "ads_enabled": ads_enabled,
                "watch_time_hours": watch_time_hours,
                "estimated_revenue_usd": estimated_revenue_usd,
                "subscribers_gained": subscribers_gained,
            }
        )

    df = pd.DataFrame(rows)
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"Wrote {len(df)} rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
