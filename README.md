# 🌌 Lumina: The Executive Decision Engine

**Lumina** is a high-performance, AI-driven BI platform built to turn raw CSV data into executive-ready dashboards in seconds. It combines sophisticated data planning, self-healing SQL generation, and a premium "Neural Void" design language to deliver insights that go beyond simple charts.

---

## ✨ Key Features

- **🧠 Self-Healing SQL Planner**: Our backend doesn't just guess. It analyzes your schema, generates complex SQLite queries, and if they fail, it **automatically corrects its own errors** in a feedback loop.
- **📊 Intelligent Visualization**: Built-in support for 11+ chart types, including **Radar** and **Composed** views. The system automatically selects the most readable visualization based on your data distribution.
- **💓 Neural Pulse UX**: A transparent, multi-stage loading experience that narrates the system's "internal thoughts" (Analyzing → Planning → Synthesizing).
- **📝 Executive Narration**: Every dashboard includes a high-level summary and actionable recommendations written for C-suite decision-makers.
- **🗣️ Voice-to-Dashboard**: Integrated speech recognition for hands-free query input.
- **💅 Neural Void UI**: A premium glassmorphism design system with iridescent borders, mesh gradients, and smooth staggered entrance animations.

---

## 🛠️ Technical Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS v4, Framer Motion, Recharts.
- **Backend**: FastAPI (Python), Pandas, SQLite.
- **Inference**: OpenAI-compatible API (Optimized for Llama 3 on Groq or Google Gemini).
- **Deployment**: Docker Compose ready (Frontend + Backend).

---

## 🚀 Quick Start

### 1. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # Add your LLM_API_KEY
uvicorn main:app --reload
```

### 2. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

### 3. Usage
- Open `http://localhost:3000`.
- Upload any CSV (e.g., `sample_sales.csv`).
- Ask: *"Show me engagement trends by category and explain the primary revenue drivers."*

---

## 📐 Architecture: How it Works

1.  **Schema Profiling**: Upon CSV upload, the system normalizes headers and loads them into a temporary SQLite instance.
2.  **Dual-Pass Intelligence**:
    - **Pass 1 (Planning)**: The LLM generates a structured JSON dashboard plan including SQL, chart types, and x/y axes.
    - **Pass 2 (Synthesizing)**: Once the data is fetched, the LLM performs a deep-dive analysis on the actual numbers to generate executive insights.
3.  **Visualization Heuristics**: Our frontend renderer identifies "poor" visualizations (e.g., a Pie chart with too many slices) and automatically converts them to ranked Bar charts for maximum clarity.

---

## 🧪 Quality & Stability

The codebase includes a comprehensive suite of backend tests:
```bash
cd backend
pytest test_sql_sanitization.py  # Verifies SQL security
pytest test_upload_validation.py # Verifies dataset loading
```

---

*Built with ❤️ for the Hackathon Demo.* 🚀
