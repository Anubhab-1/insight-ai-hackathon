# InsightAI

InsightAI is a conversational BI dashboard for CSV datasets. A user asks a question in plain English, the backend plans a dashboard, executes validated SQLite `SELECT` queries, and the frontend renders executive-ready KPIs, charts, and recommendations.

## What It Does

- Conversational dashboard generation with multi-step orchestration
- Safe SQL execution against a local SQLite dataset
- CSV upload and schema-aware prompt suggestions
- Interactive dashboard rendering with executive summaries
- Follow-up questions and lightweight conversation memory
- PDF export from the dashboard view
- Full CSV export for each widget's filtered result set

## What It Does Not Do

- No vector database or retrieval-augmented generation
- No autonomous agent swarm or long-running agent workflow engine
- No write access to the analytics database; generated queries are restricted to read-only SQL

## Architecture

1. `backend/main.py` loads the active dataset into SQLite and exposes the API.
2. The planner LLM pass proposes KPIs, widgets, chart types, and SQL.
3. The backend sanitizes and executes only safe `SELECT` or `WITH` statements.
4. A second LLM pass writes the executive summary, recommendations, and widget insights from real query results.
5. `frontend/src/components` renders the dashboard and export actions.

## Dataset Uploads

InsightAI does not bundle a default dataset. Upload a CSV through the UI to begin analysis and generate dashboards.

## Local Setup

### Backend

1. Copy [backend/.env.example](/c:/Users/anubhab%20samanta/.gemini/antigravity/scratch/InsightAI/backend/.env.example) to `backend/.env`.
2. Add a fresh provider key to `LLM_API_KEY`.
3. Install dependencies from [backend/requirements.txt](/c:/Users/anubhab%20samanta/.gemini/antigravity/scratch/InsightAI/backend/requirements.txt).
4. Run `uvicorn main:app --reload` from the `backend` directory.

### Frontend

1. Copy [frontend/.env.example](/c:/Users/anubhab%20samanta/.gemini/antigravity/scratch/InsightAI/frontend/.env.example) to `frontend/.env.local`.
2. Run `npm install` from `frontend`.
3. Run `npm run dev`.
4. Open `http://localhost:3000`.

## Environment Variables

### Backend

- `LLM_API_KEY`: required provider key
- `LLM_BASE_URL`: OpenAI-compatible provider base URL
- `LLM_MODEL`: model identifier
- `API_CORS_ORIGINS`: comma-separated list of allowed frontend origins

### Frontend

- `NEXT_PUBLIC_API_BASE_URL`: public backend base URL for browser requests

If `NEXT_PUBLIC_API_BASE_URL` is omitted outside localhost, the frontend falls back to the current origin, which works for reverse-proxy deployments.

## Deployment

### Docker

Use [docker-compose.yml](/c:/Users/anubhab%20samanta/.gemini/antigravity/scratch/InsightAI/docker-compose.yml):

```bash
docker compose up --build
```

This starts:

- frontend on `http://localhost:3000`
- backend on `http://localhost:8000`

### Separate Frontend and Backend Hosts

1. Deploy the backend from [backend/Dockerfile](/c:/Users/anubhab%20samanta/.gemini/antigravity/scratch/InsightAI/backend/Dockerfile) or run `uvicorn main:app --host 0.0.0.0 --port 8000`.
2. Set `API_CORS_ORIGINS` on the backend to your deployed frontend URL.
3. Deploy the frontend from [frontend/Dockerfile](/c:/Users/anubhab%20samanta/.gemini/antigravity/scratch/InsightAI/frontend/Dockerfile).
4. Build the frontend with `NEXT_PUBLIC_API_BASE_URL` set to the public backend URL.

### Recommended Pre-Push Checks

```bash
cd backend && pytest
cd frontend && npm run lint && npm run build
```

## Security Note

If an API key was ever committed to this workspace, revoke it and issue a new one. The tracked `.env` has been replaced with a placeholder and [`.gitignore`](/c:/Users/anubhab%20samanta/.gemini/antigravity/scratch/InsightAI/.gitignore) now excludes backend secrets.
