# 🧠 Autonomous AI Researcher

> **Evidence-Grounded Autonomous Multi-Agent Research Platform**  
> Unified Monorepo containing the **Next.js Frontend**, **Python FastAPI AI Service**, and **Supabase Database Schema**.

[![Repository](https://img.shields.io/badge/Repository-Unified%20Monorepo-blue)](https://github.com/harshthakkar-code/AI-Researcher)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js%2016%20%7C%20TypeScript%20%7C%20Tailwind-black)](./frontend)
[![AI Service](https://img.shields.io/badge/AI%20Service-Python%20%7C%20FastAPI%20%7C%20CrewAI-green)](./ai-service)
[![Database](https://img.shields.io/badge/Database-Supabase%20PostgreSQL%20%7C%20Realtime-emerald)](./supabase)

---

## 📁 Repository Structure (All-In-One)

Everything for this platform lives in this **single repository**:

```
AI-Researcher/
├── frontend/                  # Next.js Web App (Dashboard, Live Progress, Report Viewer)
│   ├── src/
│   │   ├── app/
│   │   │   ├── dashboard/     # Topic submission & library cards
│   │   │   ├── research/[id]/ # Real-time agent progress & telemetry stream
│   │   │   ├── reports/[id]/  # Verified Markdown report viewer with citations
│   │   │   └── api/research/  # API routes to dispatch jobs & fetch state
│   │   ├── components/layout/ # Navbar, Shell, and UI design system
│   │   ├── hooks/             # useResearchProgress (Supabase Realtime hook)
│   │   ├── lib/supabase/      # Supabase browser & server clients
│   │   └── types/             # TypeScript domain definitions
│   ├── package.json
│   └── tsconfig.json
│
├── ai-service/                # Python Multi-Agent AI Backend
│   ├── app/
│   │   ├── agents/
│   │   │   ├── researcher.py  # Topic decomposition, query gen & source harvesting
│   │   │   ├── validator.py   # Fact-checking, confidence scoring & conflict detection
│   │   │   └── writer.py      # Structured Markdown report synthesis with citations
│   │   ├── api/routes.py      # FastAPI POST /research & GET /health routes
│   │   ├── services/
│   │   │   ├── research.py    # Async pipeline orchestrator
│   │   │   └── supabase.py    # Database client for agent logs, facts, and sources
│   │   ├── tools/search.py    # SerperDev & Tavily web search integration
│   │   └── main.py            # FastAPI service entrypoint
│   ├── tests/                 # End-to-end pipeline test scripts
│   └── requirements.txt       # Python dependencies
│
├── supabase/                  # Supabase Database & Realtime
│   └── migrations/
│       └── 001_full_schema.sql # 7 Tables + RLS Policies + Realtime Publications
│
├── .gitignore                 # Unified ignore rules
└── README.md                  # Main documentation
```

---

## ⚡ How It Works

```
USER
  │ (Enter topic: "Latest developments in AI Agents")
  ▼
Next.js Frontend (Dashboard)
  │
  ├── 1. Inserts job into Supabase ('pending')
  └── 2. Dispatches async POST to FastAPI /research
           │
           ▼
FastAPI AI Service Worker (Background Task)
  │
  ├── 1. Researcher Agent
  │       ├─ Deconstructs topic into 4-6 search vectors
  │       ├─ Queries web search tools (SerperDev)
  │       └─ Extracts raw claims & primary citations
  │
  ├── 2. Validator Agent
  │       ├─ Cross-references claims across sources
  │       ├─ Isolates temporal or factual conflicts
  │       └─ Assigns confidence levels (HIGH / MED / LOW)
  │
  └── 3. Writer Agent
          ├─ Drafts executive Markdown report
          └─ Enforces strict inline source citations
           │
           ▼
Supabase Database
  │ (Live streaming: research_jobs & agent_logs)
  ▼
Next.js Frontend (/research/[id])
  │ (Supabase Realtime WebSocket Updates)
  └─ Shows live stepper, telemetry feed, sources & final report!
```

---

## 🚀 Getting Started

### 1. Database Setup (Supabase)
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Open the **SQL Editor**.
3. Paste the contents of [`supabase/migrations/001_full_schema.sql`](./supabase/migrations/001_full_schema.sql) and click **Run**.
4. Copy your **Project URL**, **Anon Key**, and **Service Role Key** from *Project Settings → API*.

---

### 2. Run the AI Service (Python FastAPI)

```powershell
cd ai-service

# Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run FastAPI server
uvicorn app.main:app --port 8000 --reload
```
API runs on `http://localhost:8000` (Docs available at `http://localhost:8000/docs`).

---

### 3. Run the Frontend (Next.js)

```powershell
cd frontend

# Install dependencies
npm install

# Start Next.js development server
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 🔒 Environment Variables

### Frontend (`frontend/.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
AI_SERVICE_URL=http://localhost:8000
```

### AI Service (`ai-service/.env`):
```env
GEMINI_API_KEY=your-gemini-api-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SERPER_API_KEY=your-serper-api-key
```

---

## 🚢 Production Deployment

- **Frontend**: Connect this GitHub repo to **Vercel**, set Root Directory to `frontend`.
- **AI Service**: Connect this GitHub repo to **Render**, set Root Directory to `ai-service` and command to `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- **Database**: Hosted on **Supabase**.
