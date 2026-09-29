# AP Memory Agent — Autonomous Application Processing with Hindsight Long-Term Memory

## The Problem

Enterprise review workflows such as procurement requests, vendor approvals, grant proposals, and budget requisitions often suffer from fragmented organizational memory. Reviewers and automated systems repeatedly make decisions without remembering past policy rules, precedent approvals, or compliance exceptions established across historical interactions.

Standard LLM solutions are stateless and reset across sessions. Standard RAG solutions primarily perform static keyword or vector searches over documents without continuously learning from previous decisions and interactions.

---

## Why Hindsight is Central to the System

**AP Memory Agent** is built around **Vectorize Hindsight** persistent long-term memory:

1. **Retain (`client.retain`)**
   - When a reviewer specifies an operational policy rule, such as *"Always flag software license requests over $5,000 for SOC2 compliance, but expedite hardware under $2,500"*, the agent permanently retains the guideline in Hindsight.

2. **Recall (`client.recall`)**
   - When an application is submitted, the agent actively retrieves relevant precedent policies from Hindsight using multi-strategy search, including semantic, keyword, and temporal ranking.

3. **Reason with Live External Data**
   - The agent verifies current real-world facts, including live currency exchange rates from the Frankfurter API and vendor URL reachability, and evaluates compliance against the recalled Hindsight memories.

4. **Action & Precedent Retention**
   - The agent updates the persistent database in real time, emits execution steps over Server-Sent Events (SSE) without requiring a page refresh, and retains the resulting decision as a new precedent in Hindsight.

---

## Architecture

```text
User Action (New Request or Policy)
       │
       ▼
React 18 SaaS Frontend (Vite + Tailwind CSS)
       │
       │ REST + SSE
       ▼
Node.js + Express Backend API (TypeScript)
       │
  ┌────┴───────────────────────────┐
  │                                │
  ▼                                ▼
SQLite Database              Server-Sent Events (SSE)
(better-sqlite3 / sql.js)    Real-time live updates
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

- **Real-Time Data (0% Dummy Data):** Every record originates from real user actions, persistent database records, live currency APIs, real Hindsight memory banks, and real-time SSE broadcasts. Truthful empty states are displayed when no data exists.

- **Dual-Mode Hindsight:** First-class support for Vectorize Hindsight Cloud through `@vectorize-io/hindsight-client`, backed by an embedded local TEMPR memory engine for zero-friction evaluation and local development.

- **Groq LLM with Tool Calling:** High-speed reasoning with models such as `llama-3.3-70b-versatile`, with a resilient fallback to deterministic precedent evaluation.

- **Live Status Progression:** Real-time execution steps streamed through SSE:

  `✓ Request received` → `✓ Current live data fetched` → `✓ Relevant memory retrieved` → `✓ Agent decision formulated` → `✓ Request updated`

- **Hindsight Memory Context:** Each processed request can display the relevant memory used during reasoning, allowing users to inspect the policy context behind an agent decision.

- **Interactive Agent Assistant:** A natural-language assistant capable of retrieving remembered policies, checking pipeline statistics, and explaining decisions.

- **Clean SaaS UI:** Modern, bright interface using the Inter font, subtle borders, generous spacing, and a focused workflow-oriented design.

---

## Quick Start

### 1. Prerequisites

- Node.js v18+
- npm

### 2. Installation

Install the root dependencies:

```bash
npm install
```

Install backend dependencies:

```bash
npm install --prefix backend
```

Install frontend dependencies:

```bash
npm install --prefix frontend
```

### 3. Configuration

Copy `.env.example` to `.env`.

```env
PORT=4000
JWT_SECRET=your_jwt_secret

# Optional: Groq LLM Key
GROQ_API_KEY=

# Optional: Vectorize Hindsight Key
HINDSIGHT_API_KEY=
HINDSIGHT_BASE_URL=https://api.hindsight.vectorize.io
```

Optional configuration keys can also be entered directly through the UI Settings modal.

### 4. Running the Application

Run the backend and frontend concurrently:

```bash
npm run dev
```

The application will be available at:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000`

---

## End-to-End Demo Walkthrough

### 1. Launch the Workspace

Open:

```text
http://localhost:5173
```

or:

```text
http://localhost:4000
```

Click **"⚡ Launch Demo Reviewer"** for instant access.

The application starts with a truthful empty state:

> No requests yet. Create your first request to get started.

---

### 2. Teach the Agent a Policy

Click:

**`+ Teach Policy Rule`**

Select the policy:

> Always flag software license requests over $5,000 for SOC2 Type II compliance verification.

Click:

**`Retain Memory Rule`**

The agent stores the policy in Hindsight using `retain()`.

The activity timeline records the memory operation:

> Agent retained new policy memory into Hindsight.

---

### 3. Submit a Software Request

Click:

**`+ New Request`**

Select:

**Software: $7,500 (Triggers SOC2 Check)**

Click:

**`Submit Request`**

The agent processes the request and streams its execution steps in real time:

```text
✓ Request received
✓ Current live data fetched
✓ Relevant memory retrieved
✓ Agent decision formulated
✓ Request updated
```

The request is marked **FLAGGED** because the amount exceeds the stored software policy threshold.

The decision includes the relevant policy context:

> Amount ($7,500) exceeds your stored policy threshold ($5,000) for Software. Per remembered precedent, SOC2 Type II compliance verification is required.

Click:

**`View context`**

to inspect the memory retrieved from Hindsight.

---

### 4. Submit an Expedited Hardware Request

Click:

**`+ New Request`**

Select:

**Hardware: $1,200 (Expedited Path)**

Submit the request.

The agent retrieves the applicable policy context and evaluates the request against the remembered rules, allowing the corresponding expedited path.

---

### 5. Interact with the Agent Assistant

Use the **Agent Assistant** panel and ask:

> What policies are remembered?

The assistant queries the Hindsight memory layer and returns the policies currently stored by the system.

---

## System Flow

```text
Policy / Request
       │
       ▼
Real-Time API
       │
       ├──────────────► Live External Data
       │
       ▼
Hindsight Recall
       │
       ▼
Policy + Precedent Context
       │
       ▼
LLM / Deterministic Reasoning
       │
       ▼
Decision
       │
       ├──────────────► SQLite Persistence
       │
       ├──────────────► SSE Live Updates
       │
       └──────────────► Hindsight Retain
                              │
                              ▼
                       New Precedent Memory
```

The system therefore creates a continuous memory loop:

**Experience → Decision → Retention → Future Recall → Better Context**

---

## Technology Stack

### Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Server-Sent Events
- REST API

### Backend

- Node.js
- Express
- TypeScript
- SQLite
- JWT Authentication

### AI & Memory

- Vectorize Hindsight
- `@vectorize-io/hindsight-client`
- Groq
- Llama 3.3 70B
- Long-term semantic memory
- Policy retention and recall

### External Data

- Frankfurter API for live currency exchange rates
- Vendor URL reachability verification

---

## Key Design Principles

### Persistent Memory

The system does not treat every request as an isolated interaction. Policies and previous decisions can become persistent context for future requests.

### Real-Time Processing

Requests are processed through live backend services and progress updates are streamed to the interface using SSE.

### Explainable Decisions

The agent exposes the relevant memory and policy context used during request evaluation instead of presenting a decision without context.

### Continuous Learning

New policies and resulting decisions can be retained as memories, allowing future requests to benefit from previously established organizational knowledge.

### No Hardcoded Request History

Application records are generated from actual user interactions and persisted in the database. Empty states are shown when no records exist.

---

## Project Structure

```text
AP-memory-agent/
│
├── backend/
│   ├── src/
│   │   ├── database/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── services/
│   │
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── App.tsx
│   │   └── main.tsx
│   │
│   ├── package.json
│   └── vite.config.ts
│
├── README.md
├── WALKTHROUGH.md
├── package.json
└── package-lock.json
```

---

