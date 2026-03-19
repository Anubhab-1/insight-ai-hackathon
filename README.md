# Lumina

Lumina turns raw CSV files into decision-ready dashboards and executive briefings. Upload a dataset, ask a business question in plain English, and review KPIs, charts, recommendations, and follow-up questions backed by read-only SQL.

## Why Lumina

- CSV-first workflow with almost no setup
- Safe SQL execution against a local SQLite dataset
- Schema preview, sample rows, and suggested prompts after upload
- Executive summary, chart insights, and export-ready dashboard views
- Local fallback mode when no LLM key is configured

## Product Flow

1. Upload a CSV.
2. Lumina normalizes the columns, loads the data into SQLite, and profiles the schema.
3. A planner creates KPIs, widgets, and safe query plans.
4. The backend validates and executes only read-only SQL.
5. The frontend renders the dashboard, summary, and follow-up questions.

## Stack

- Backend: FastAPI, pandas, SQLite, OpenAI-compatible LLM client
- Frontend: Next.js App Router, TypeScript, Tailwind CSS, Recharts, Framer Motion

## Project Layout

- `backend/main.py`: API surface, dataset loading, SQL validation, dashboard planning
- `backend/test_*.py`: backend coverage for upload, querying, and fallback behavior
- `frontend/src/components/Dashboard.tsx`: workspace shell, dataset state, history, prompt bar
- `frontend/src/components/ExecutiveDashboardView.tsx`: dashboard rendering, exports, SQL reveal
- `frontend/src/components/DashboardRenderer.tsx`: chart and table rendering

## Local Setup

### Backend

1. Copy `backend/.env.example` to `backend/.env`.
2. Add `LLM_API_KEY` if you want LLM-backed planning.
3. Install dependencies from `backend/requirements.txt`.
4. Run `uvicorn main:app --reload` from the `backend` directory.

### Frontend

1. Copy `frontend/.env.example` to `frontend/.env.local`.
2. Run `npm install` in `frontend`.
3. Run `npm run dev`.
4. Open `http://localhost:3000`.

## Environment Variables

### Backend

- `LLM_API_KEY`: provider key for the OpenAI-compatible endpoint
- `LLM_BASE_URL`: provider base URL
- `LLM_MODEL`: model identifier
- `API_CORS_ORIGINS`: comma-separated list of allowed frontend origins
- `LUMINA_DISABLE_LLM`: optional flag to force local fallback mode
- `LUMINA_ALLOW_RESET`: optional flag to enable `/api/reset` outside local development

Legacy environment aliases are still accepted for backward compatibility.

### Frontend

- `NEXT_PUBLIC_API_BASE_URL`: public backend base URL for browser requests

If `NEXT_PUBLIC_API_BASE_URL` is omitted on localhost, the frontend uses the local backend. For split or reverse-proxy deployments, set it explicitly.

## Quality Checks

```bash
cd backend && pytest -q
cd frontend && npm run lint
cd frontend && npm run typecheck
cd frontend && npm run build
```

## Deployment

### Docker

```bash
docker compose up --build
```

This starts the frontend on `http://localhost:3000` and the backend on `http://localhost:8000`.

### Split Deployment

1. Deploy the backend with `backend/Dockerfile` or `uvicorn main:app --host 0.0.0.0 --port 8000`.
2. Set `API_CORS_ORIGINS` to your frontend URL.
3. Deploy the frontend with `frontend/Dockerfile`.
4. Build the frontend with `NEXT_PUBLIC_API_BASE_URL` set to the public backend URL.

## Demo Notes

- Upload a CSV and use the built-in starter prompts.
- Show the schema preview, sample rows, and visible SQL to reinforce trust.
- Export the finished dashboard as a briefing once the first answer is ready.

## Security Note

If an API key was ever committed to this workspace, revoke it and issue a new one. `.gitignore` excludes backend secrets, but rotated credentials are still the safest move.
