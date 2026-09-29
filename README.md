# AP Memory Agent — Autonomous Application Processing with Hindsight Long-Term Memory

A production-ready, real-time application processing and decision platform built for the hackathon. **Minimal UI, maximum functionality, zero dummy data.**

---

## The Problem
Enterprise review workflows (procurement requests, vendor approvals, grant proposals, and budget requisitions) suffer from fragmented organizational memory. Reviewers and automated systems repeatedly make decisions without remembering past policy rules, precedent approvals, or compliance exceptions established across historical interactions.

Standard LLM solutions are stateless and reset across sessions. Standard RAG solutions only perform static keyword/vector searches over documents without learning or adapting over time.

---

## Why Hindsight is Mandatory
**AP Memory Agent** is built around **Vectorize Hindsight** persistent long-term memory:

1. **Retain (`client.retain`)**:
   - When a reviewer specifies an operational policy rule (e.g. *"Always flag software license requests over $5,000 for SOC2 compliance, but expedite hardware under $2,500"*), the agent permanently retains this guideline in Hindsight.
2. **Recall (`client.recall`)**:
   - When an application is submitted, the agent actively retrieves relevant precedent policies from Hindsight using multi-strategy search (semantic, keyword, and temporal ranking).
3. **Reason with Live External Data**:
   - The agent verifies current real-world facts (live currency exchange rates from Frankfurter API and vendor URL reachability) and evaluates compliance against the recalled Hindsight memories.
4. **Action & Precedent Retention**:
   - The agent updates the persistent database in real time, emits execution steps over Server-Sent Events (SSE) without page refresh, and retains the new decision as a precedent back into Hindsight.

---

## Architecture

```
User Action (New Request or Policy)
       │
       ▼
React 18 SaaS Frontend (Vite + Tailwind CSS)
       │ (REST + SSE)
       ▼
Node.js + Express Backend API (TypeScript)
       │
  ┌────┴───────────────────────────┐
  │                                │
  ▼                                ▼
SQLite Database              Server-Sent Events (SSE)
(better-sqlite3 / sql.js)    (Zero-latency live updates)
  │
  ├────────────────────────────────┐
  ▼                                ▼
Hindsight Memory Engine       Groq LLM / Reasoner
(@vectorize-io/hindsight)     (llama-3.3-70b-versatile)
- retain()                     - Live currency verification
- recall()                     - Domain reachability check
- reflect()                    - Precedent compliance reasoning
```

---

## Core Features

- **Real-Time Data (0% Dummy Data)**: Every record originates from real user actions, persistent database records, live currency APIs, real Hindsight memory banks, and real-time SSE broadcasts. Truthful empty states are displayed when no data exists.
- **Dual-Mode Hindsight**: First-class support for Vectorize Hindsight Cloud via `@vectorize-io/hindsight-client`, backed by an embedded local TEMPR memory engine for zero-friction evaluation out of the box.
- **Groq LLM with Tool Calling**: High-speed reasoning with models like `llama-3.3-70b-versatile`, with resilient fallback to deterministic precedent evaluation.
- **Live Status Progression**: Real-time step indicators streamed via SSE:
  `✓ Request received` $\rightarrow$ `✓ Current live data fetched` $\rightarrow$ `✓ Relevant memory retrieved` $\rightarrow$ `✓ Agent decision formulated` $\rightarrow$ `✓ Request updated`.
- **Subtle Hindsight Memory Card**: Elegant context banner on each request:
  `🧠 Relevant memory: The agent applied stored policy context... [View context]`
- **Interactive Agent Assistant**: Direct natural language assistant capable of retrieving remembered policies, checking pipeline stats, and explaining decisions.
- **Clean SaaS UI**: Modern, bright interface (Inter font, subtle borders, generous spacing, strictly no dark themes).

---

## Quick Start

### 1. Prerequisites
- Node.js (v18+)
- npm

### 2. Installation
```bash
# Install root dependencies
npm install

# Install backend dependencies
npm install --prefix backend

# Install frontend dependencies
npm install --prefix frontend
```

### 3. Configuration
Copy `.env.example` to `.env` (optional keys can also be entered directly in the UI Settings modal):
```env
PORT=4000
JWT_SECRET=your_jwt_secret

# Optional: Groq LLM Key (Free tier at console.groq.com)
GROQ_API_KEY=

# Optional: Vectorize Hindsight Key (ui.hindsight.vectorize.io)
HINDSIGHT_API_KEY=
HINDSIGHT_BASE_URL=https://api.hindsight.vectorize.io
```

### 4. Running the Application
```bash
# Run both Backend and Frontend concurrently:
npm run dev
```
- Frontend: `http://localhost:5173`
- Backend API & Production Server: `http://localhost:4000`

---

## Hackathon Judge Demo Walkthrough (3-Minute Flow)

1. **Launch Workspace**:
   - Open `http://localhost:5173` or `http://localhost:4000`.
   - Click **"⚡ Launch Demo Reviewer"** for instant 1-click access.
   - Note the truthful empty state: *"No requests yet. Create your first request to get started."*
2. **Teach the Agent a Policy (Hindsight `retain`)**:
   - Click **`[ + Teach Policy Rule ]`**.
   - Select the preset: *"Always flag software license requests over $5,000 for SOC2 Type II compliance verification."*
   - Click **`Retain Memory Rule`**.
   - Notice the real-time activity timeline logs: *"Agent retained new policy memory into Hindsight"*.
3. **Submit a Software Request (Precedent Violation)**:
   - Click **`[ + New Request ]`**.
   - Click the preset: **"Software: $7,500 (Triggers SOC2 Check)"**.
   - Click **`Submit Request`**.
   - Watch the live execution steps stream in real time without refreshing:
     - `✓ Request received`
     - `✓ Current live data fetched`
     - `✓ Relevant memory retrieved`
     - `✓ Agent decision formulated`
     - `✓ Request updated`
   - The request is marked **FLAGGED**: *"Amount ($7,500) exceeds your stored policy threshold ($5,000) for Software. Per remembered precedent, SOC2 Type II compliance verification is required."*
   - Click **`[ View context ]`** to inspect the exact memory retrieved from Hindsight.
4. **Submit an Expedited Hardware Request**:
   - Click **`[ + New Request ]`**.
   - Click preset: **"Hardware: $1,200 (Expedited Path)"**.
   - Notice the agent immediately approves the request in real time.
5. **Interactive Assistant**:
   - In the right-hand Agent Assistant box, ask: *"What policies are remembered?"*
   - The agent queries Hindsight and responds with your stored rules.
