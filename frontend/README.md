# InsightAI Frontend

This folder contains the Next.js dashboard client for InsightAI.

## Run

```bash
npm install
npm run dev
```

The app expects the FastAPI backend on `http://localhost:8000`.

## Key UI Areas

- [src/components/Dashboard.tsx](/c:/Users/anubhab%20samanta/.gemini/antigravity/scratch/InsightAI/frontend/src/components/Dashboard.tsx): shell, dataset state, query history
- [src/components/ExecutiveLanding.tsx](/c:/Users/anubhab%20samanta/.gemini/antigravity/scratch/InsightAI/frontend/src/components/ExecutiveLanding.tsx): landing experience and demo prompts
- [src/components/ExecutiveDashboardView.tsx](/c:/Users/anubhab%20samanta/.gemini/antigravity/scratch/InsightAI/frontend/src/components/ExecutiveDashboardView.tsx): dashboard rendering, PDF export, CSV export actions

Repository-level setup and architecture notes live in the root [README.md](/c:/Users/anubhab%20samanta/.gemini/antigravity/scratch/InsightAI/README.md).
