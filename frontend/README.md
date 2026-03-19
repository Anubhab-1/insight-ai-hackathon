# Lumina Frontend

This package contains the Next.js interface for Lumina.

## What Lives Here

- `src/app`: app shell, metadata, and global styles
- `src/components/Dashboard.tsx`: workspace state, upload flow, prompt bar, and history
- `src/components/ExecutiveLanding.tsx`: landing experience and starter prompts
- `src/components/ExecutiveDashboardView.tsx`: dashboard display, SQL reveal, and exports
- `src/components/DashboardRenderer.tsx`: chart and table rendering

## Commands

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
```

By default the app expects the backend at `http://localhost:8000`. Set `NEXT_PUBLIC_API_BASE_URL` in `frontend/.env.local` if the API lives elsewhere.

Repository-wide setup, architecture notes, and deployment guidance live in the root `README.md`.
