# CaptureInsight Agent Features — Complete Implementation Plan

> **Status**: In Progress
> **Created**: March 5, 2026
> **Authors**: Eric (CaptureInsight) + Replit, with architectural review by Claude
> **Inspired by**: OpenClaw's agent paradigm

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Phase 1: Enhanced Memory](#3-phase-1-enhanced-memory)
4. [Phase 2: Skills](#4-phase-2-skills)
5. [Phase 3: Scheduled Jobs](#5-phase-3-scheduled-jobs)
6. [Cross-Cutting Concerns](#6-cross-cutting-concerns)
7. [Database Schema Reference](#7-database-schema-reference)
8. [API Endpoints Reference](#8-api-endpoints-reference)
9. [File Manifest](#9-file-manifest)
10. [Execution Timeline](#10-execution-timeline)
11. [Risk Register](#11-risk-register)

---

## 1. Executive Summary

### Goal

Transform CaptureInsight from a reactive analytics tool into a **proactive, personal data analyst assistant**. Three interconnected features give the AI agent persistent memory, reusable analytical skills, and autonomous scheduled execution.

### Features at a Glance

| Feature | What It Does | User Value |
|---------|-------------|------------|
| **Enhanced Memory** | AI remembers user preferences, learned patterns, and context across sessions | No more repeating yourself; AI gets smarter over time |
| **Skills** | Library of reusable AI analysis templates (built-in + custom) | One-click trend detection, anomaly alerts, executive briefs |
| **Scheduled Jobs** | Cron-based automation for ETL, analysis, reports, and custom prompts | "Every Monday at 9am, analyze my ad spend and email me a summary" |

### Phased Delivery

| Phase | Feature | Key Deliverables | Dependencies |
|-------|---------|-----------------|--------------|
| **Phase 1** | Memory | `agent_memory` table, CRUD API, AI integration, Memory page UI | None |
| **Phase 2** | Skills | `agent_skills` + `workspace_skills` tables, skill library, execution engine, Skills dashboard | Phase 1 schema migration |
| **Phase 3** | Scheduled Jobs | `scheduled_jobs` + `job_run_history` tables, cron scheduler, Jobs page UI | Phase 1 + 2 (jobs can run skills) |

---

## 2. Architecture Overview

### How Features Interconnect

```
┌─────────────────────────────────────────────────────────────┐
│                    CaptureInsight Dashboard                   │
│                                                               │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Memory   │  │  Scheduled   │  │   InsightWorkspace    │  │
│  │  Page     │  │  Jobs Page   │  │  ┌────────────────┐  │  │
│  │           │  │              │  │  │ Skills Dashboard│  │  │
│  └─────┬────┘  └──────┬───────┘  │  └───────┬────────┘  │  │
│        │               │          │          │            │  │
└────────┼───────────────┼──────────┼──────────┼────────────┘  │
         │               │          │          │               │
    ┌────▼────┐    ┌─────▼────┐    │    ┌─────▼─────┐        │
    │ Memory  │    │  Job     │    │    │  Skill    │        │
    │ API     │    │  API     │    │    │  API      │        │
    └────┬────┘    └─────┬────┘    │    └─────┬─────┘        │
         │               │         │          │               │
    ┌────▼────────────────▼─────────▼──────────▼─────┐        │
    │              Server Services Layer              │        │
    │                                                  │        │
    │  ┌──────────┐  ┌───────────┐  ┌──────────────┐ │        │
    │  │ Memory   │  │ Job       │  │ Skill        │ │        │
    │  │ Service  │  │ Scheduler │  │ Executor     │ │        │
    │  └────┬─────┘  └─────┬─────┘  └──────┬───────┘ │        │
    │       │              │               │          │        │
    │       │    ┌─────────▼──────────┐    │          │        │
    │       │    │  Job Executor      │    │          │        │
    │       │    │  (dispatches to:)  │◄───┘          │        │
    │       │    │  • ETL Pipeline    │               │        │
    │       │    │  • Gemini AI       │               │        │
    │       │    │  • Skill Executor  │               │        │
    │       │    │  • Report Gen      │               │        │
    │       │    └─────────┬──────────┘               │        │
    │       │              │                           │        │
    │  ┌────▼──────────────▼───────────────────────┐  │        │
    │  │         AI Layer (Gemini + RAG)            │  │        │
    │  │  • Memory injected into system prompt      │  │        │
    │  │  • Auto-learns from conversations          │  │        │
    │  │  • Skills use promptTemplates              │  │        │
    │  └───────────────────┬───────────────────────┘  │        │
    │                      │                           │        │
    └──────────────────────┼───────────────────────────┘        │
                           │                                    │
    ┌──────────────────────▼───────────────────────────┐        │
    │                  PostgreSQL (Neon)                 │        │
    │  agent_memory │ agent_skills │ workspace_skills   │        │
    │  scheduled_jobs │ job_run_history                  │        │
    └───────────────────────────────────────────────────┘        │
```

### Sidebar Navigation (Updated)

```
┌─────────────────────┐
│  [Space Switcher]   │
│  [Account Menu]     │
├─────────────────────┤
│  ▸ Workspace 1      │
│    ├── Sheet A      │
│    └── Sheet B      │
│  ▸ Workspace 2      │
├─────────────────────┤
│  📋 Rules           │  ← existing
│  🧠 Memory          │  ← NEW (Phase 1)
│  ⏰ Scheduled Jobs   │  ← NEW (Phase 3)
├─────────────────────┤
│  [+ New Workspace]  │
└─────────────────────┘

Skills Dashboard is accessed from within
the InsightWorkspace header (⚡ button),
NOT the sidebar.
```

---

## 3. Phase 1: Enhanced Memory

### 3.1 Concept

The AI assistant maintains persistent memory about each user — their preferences, learned patterns, important metrics, and contextual knowledge. Memory has two scopes:

- **Global (user-wide)**: Applies across all Spaces (e.g., "User prefers currency in USD", "User is a marketing manager")
- **Space-specific**: Applies within a single Space (e.g., "Q4 campaign target is $50K", "Primary KPI is ROAS")

### 3.2 Database: `agent_memory` Table

```sql
CREATE TABLE agent_memory (
  id            VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       VARCHAR NOT NULL REFERENCES users(id),
  space_id      VARCHAR REFERENCES spaces(id),  -- NULL = global
  category      VARCHAR,        -- 'preference' | 'insight' | 'pattern' | 'context' | 'goal'
  content       TEXT NOT NULL,   -- The actual memory entry
  source        VARCHAR,        -- 'user_manual' | 'ai_learned' | 'system'
  is_active     BOOLEAN DEFAULT true,
  importance    INTEGER DEFAULT 5,  -- 1-10 scale
  metadata      JSONB,          -- Tags, related entities, etc.
  last_accessed_at TIMESTAMP,
  created_at    TIMESTAMP DEFAULT now(),
  updated_at    TIMESTAMP DEFAULT now()
);

-- Indexes
CREATE INDEX idx_agent_memory_user ON agent_memory(user_id);
CREATE INDEX idx_agent_memory_space ON agent_memory(space_id);
CREATE INDEX idx_agent_memory_category ON agent_memory(category);
```

**Relationship to existing `chatThreads.savedToMemory` field**: The existing boolean flag on chat threads marks whether a thread has been "saved to memory." With the new system, this flag will trigger extraction of key facts from the thread into `agent_memory` entries. The flag remains as a UI indicator; `agent_memory` stores the actual content.

### 3.3 Backend API

**File**: `server/routes/memory.ts`
**Service**: `server/services/memoryService.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/memory` | List memories for authenticated user. Query params: `?spaceId=`, `?category=`, `?activeOnly=true` |
| `GET` | `/api/memory/context/:spaceId` | Assemble memory context for AI calls (global + space-specific, ordered by importance, top 20) |
| `POST` | `/api/memory` | Create a manual memory entry |
| `PATCH` | `/api/memory/:id` | Update content, category, importance, or isActive |
| `DELETE` | `/api/memory/:id` | Hard delete a memory entry |
| `POST` | `/api/memory/ai-learn` | Internal endpoint for AI to auto-create learned memories |

**Guardrails on auto-learning**:
- Max **20 auto-learned memories per user per day** (configurable)
- Before creating, check for semantic similarity against existing memories (reuse embedding infrastructure)
- Categories eligible for auto-learn: preferences, recurring questions, important metrics, terminology

### 3.4 AI Integration

**Files modified**: `server/ai/index.ts`, `server/ai/prompts.ts`

When building chat context:

1. Fetch memories via the context endpoint (global + space-specific)
2. Append to system prompt under `## Agent Memory` section
3. Order by importance (highest first), cap at 20 entries
4. Update `lastAccessedAt` on retrieved memories

After each AI interaction:

1. AI evaluates whether the conversation contains learnable information
2. If yes, calls the auto-learn endpoint
3. A subtle indicator appears in chat when new memories are learned
4. Respect the daily cap and deduplication rules

**New prompt section** instructs Gemini to:
- Reference memories when relevant to the conversation
- Identify learnable information (preferences, patterns, terminology)
- Signal when it has learned something new

### 3.5 Frontend: Memory Page

**File**: `src/components/MemoryPage.tsx`

**Layout**:
```
┌─────────────────────────────────────────────────┐
│  🧠 Memory                                      │
│  What your AI assistant remembers about you      │
│                                                   │
│  [X memories total · Y AI-learned · Z this space]│
├─────────────────────────────────────────────────┤
│  Scope: [All] [Global] [Space: Marketing] [...]  │
│  Category: [All] [Preferences] [Insights] [...]  │
├─────────────────────────────────────────────────┤
│  [+ Add Memory]                                   │
├─────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐     │
│  │ "User prefers ROAS as primary KPI"      │     │
│  │ 🧠 AI-learned · Preference · ★★★★★★★☆☆☆ │     │
│  │ 2 hours ago                    [🗑️]     │     │
│  └─────────────────────────────────────────┘     │
│  ┌─────────────────────────────────────────┐     │
│  │ "Q4 campaign budget is $50,000"         │     │
│  │ ✏️ Manual · Context · ★★★★★★★★☆☆        │     │
│  │ 3 days ago                     [🗑️]     │     │
│  └─────────────────────────────────────────┘     │
│  ...                                              │
└─────────────────────────────────────────────────┘
```

**Features**:
- Inline editing of content (click to edit)
- Category badge (color-coded)
- Source indicator (AI-learned / Manual / System)
- Importance slider (1-10, inline adjustment)
- Active/inactive toggle
- Relative timestamps
- Delete with confirmation
- "Add Memory" form with content textarea, category dropdown, space selector
- Empty state with explanation and call-to-action

**Sidebar integration** (`ProjectBrowser.tsx`):
- Brain icon button below Rules button
- Same styling pattern (gradient when active, hover states)
- Collapsed mode: icon-only with tooltip

**View routing** (`App.tsx`):
- Add `'memory'` to the view type union
- Add `onNavigateToMemory` handler
- Render `MemoryPage` when `currentView === 'memory'`

---

## 4. Phase 2: Skills

### 4.1 Concept

Skills are reusable AI analysis templates — predefined prompts with configurable parameters that can be executed against workspace data. Skills can be:

- **Built-in (system)**: 8 pre-loaded skills covering analysis, monitoring, reporting, and cleaning
- **Custom (user-created)**: Users define their own skill prompts and parameters

Skills are scoped to:
- **Space-wide**: Available to all workspaces in a space
- **Workspace-specific**: Available only to one workspace, with optional config overrides

### 4.2 Database: Skills Tables

**`agent_skills` table** (skill definitions):

```sql
CREATE TABLE agent_skills (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR NOT NULL,
  description     TEXT,
  category        VARCHAR,        -- 'analysis' | 'monitoring' | 'reporting' | 'cleaning'
  skill_type      VARCHAR,        -- 'builtin' | 'custom'
  config          JSONB,          -- Default parameters (thresholds, patterns)
  prompt_template TEXT,           -- The Gemini prompt this skill uses
  is_system       BOOLEAN DEFAULT false,
  created_by      VARCHAR REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT now(),
  updated_at      TIMESTAMP DEFAULT now()
);
```

**`workspace_skills` table** (junction — which skills are enabled where):

```sql
CREATE TABLE workspace_skills (
  id            VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id      VARCHAR NOT NULL REFERENCES agent_skills(id),
  workspace_id  VARCHAR REFERENCES workspaces(id),  -- NULL = space-wide
  space_id      VARCHAR NOT NULL REFERENCES spaces(id),
  is_enabled    BOOLEAN DEFAULT true,
  config        JSONB,          -- Workspace-specific config overrides
  created_at    TIMESTAMP DEFAULT now()
);

-- Partial unique indexes (PostgreSQL)
CREATE UNIQUE INDEX idx_ws_skill_workspace
  ON workspace_skills(skill_id, workspace_id)
  WHERE workspace_id IS NOT NULL;

CREATE UNIQUE INDEX idx_ws_skill_space_wide
  ON workspace_skills(skill_id, space_id)
  WHERE workspace_id IS NULL;
```

### 4.3 Built-in Skills Library

**File**: `server/ai/skillsLibrary.ts`

| # | Skill | Category | Description |
|---|-------|----------|-------------|
| 1 | **Trend Detection** | Analysis | Identifies upward/downward trends across time-series data, highlights acceleration/deceleration |
| 2 | **Anomaly Detection** | Monitoring | Flags statistical outliers in metrics. Config: sensitivity threshold (default: 2 std devs) |
| 3 | **KPI Health Monitor** | Monitoring | Tracks KPIs against targets, alerts when metrics fall outside acceptable ranges |
| 4 | **Weekly Summary** | Reporting | Generates narrative summary of the week's data changes, wins, and concerns |
| 5 | **Competitor Benchmark** | Analysis | Compares metrics against industry benchmarks or user-defined competitor data |
| 6 | **Data Quality Guard** | Cleaning | Monitors for quality issues: missing values, format inconsistencies, duplicate rows |
| 7 | **Auto-Categorizer** | Cleaning | Automatically categorizes and tags data rows based on patterns and content |
| 8 | **Executive Brief** | Reporting | Produces C-suite-ready bullet points highlighting changes and recommendations |

Each skill includes: `name`, `description`, `category`, `promptTemplate`, default `config`.

**Seeding**: Runs on server startup (idempotent — checks by name before inserting).

### 4.4 Backend API

**File**: `server/routes/skills.ts`
**Service**: `server/services/skillExecutor.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/skills` | List all skills (built-in + user-created) |
| `GET` | `/api/skills/workspace/:workspaceId` | Get skills enabled for a workspace (includes space-wide) |
| `GET` | `/api/skills/space/:spaceId` | Get space-wide skills |
| `POST` | `/api/skills` | Create a custom skill |
| `POST` | `/api/skills/:skillId/enable` | Enable skill for workspace or space. Body: `{ workspaceId?, spaceId, config? }` |
| `POST` | `/api/skills/:skillId/disable` | Disable skill for workspace or space |
| `PATCH` | `/api/skills/:skillId/config` | Update workspace-specific skill config |
| `POST` | `/api/skills/:skillId/run` | Manually execute skill against workspace data |

**Skill execution flow**:
1. Retrieve skill's `promptTemplate` and merged config (default + workspace override)
2. Gather workspace data context (sheets, cleaned data)
3. Inject memory context (from Phase 1) for additional relevance
4. Call Gemini with the assembled prompt
5. Return structured results (markdown-formatted analysis)

### 4.5 Frontend: Skills Dashboard

**File**: `src/components/workspace/SkillsDashboard.tsx`
**Integration**: `src/pages/InsightWorkspace.tsx`

Accessed via a **Zap/Sparkles icon button** in the InsightWorkspace header bar. Opens as a right-side drawer/overlay.

**Layout**:
```
┌───────────────────────────────────────┐
│  ⚡ Skills              [This WS ▼]  │
│                                        │
│  ── Active Skills ──                   │
│  ┌──────────────┐  ┌──────────────┐   │
│  │ Trend Detect │  │ Weekly       │   │
│  │ ■ Analysis   │  │ Summary      │   │
│  │ [Configure]  │  │ ■ Reporting  │   │
│  │ [▶ Run Now]  │  │ [▶ Run Now]  │   │
│  └──────────────┘  └──────────────┘   │
│                                        │
│  ── Available Skills ──                │
│  Analysis:                             │
│  ┌──────────────┐  ┌──────────────┐   │
│  │ Competitor   │  │              │   │
│  │ Benchmark    │  │   ...        │   │
│  │ [Enable]     │  │              │   │
│  └──────────────┘  └──────────────┘   │
│                                        │
│  Monitoring: ...                       │
│  Cleaning: ...                         │
└───────────────────────────────────────┘
```

**Features**:
- Two-column card grid
- Enable/disable toggle per skill
- "Configure" expands inline config panel
- "Run Now" executes skill, shows loading, displays result
- Scope toggle: "This Workspace" / "All Workspaces in Space"
- Result panel with "Save to Canvas" and "Dismiss" buttons
- Badge showing count of active skills on the header button

---

## 5. Phase 3: Scheduled Jobs

### 5.1 Concept

Users define automated workflows that execute on a cron schedule. Jobs can refresh data, run AI analysis, generate reports, execute skills, or run custom prompts — all without manual intervention.

### 5.2 Database: Jobs Tables

**`scheduled_jobs` table**:

```sql
CREATE TABLE scheduled_jobs (
  id                  VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             VARCHAR NOT NULL REFERENCES users(id),
  space_id            VARCHAR NOT NULL REFERENCES spaces(id),
  workspace_id        VARCHAR REFERENCES workspaces(id),
  name                VARCHAR NOT NULL,
  description         TEXT,
  job_type            VARCHAR NOT NULL,
    -- 'etl_refresh' | 'ai_analysis' | 'generate_report' | 'run_skill' | 'custom_prompt'
  schedule            VARCHAR NOT NULL,     -- Cron expression
  timezone            VARCHAR DEFAULT 'UTC',
  config              JSONB NOT NULL,       -- Job-type-specific configuration
  notification_config JSONB,               -- { inApp: bool, email: bool, emailAddress: "" }
  status              VARCHAR DEFAULT 'active',  -- 'active' | 'paused' | 'disabled'
  last_run_at         TIMESTAMP,
  last_run_status     VARCHAR,             -- 'success' | 'failed' | 'running'
  last_run_result     JSONB,
  next_run_at         TIMESTAMP,           -- Precomputed from cron expression
  run_count           INTEGER DEFAULT 0,
  fail_count          INTEGER DEFAULT 0,
  created_at          TIMESTAMP DEFAULT now(),
  updated_at          TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_scheduled_jobs_user ON scheduled_jobs(user_id);
CREATE INDEX idx_scheduled_jobs_space ON scheduled_jobs(space_id);
CREATE INDEX idx_scheduled_jobs_status ON scheduled_jobs(status);
CREATE INDEX idx_scheduled_jobs_next_run ON scheduled_jobs(next_run_at);
```

**`job_run_history` table**:

```sql
CREATE TABLE job_run_history (
  id            VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        VARCHAR NOT NULL REFERENCES scheduled_jobs(id),
  status        VARCHAR,        -- 'running' | 'success' | 'failed'
  started_at    TIMESTAMP,
  completed_at  TIMESTAMP,
  result        JSONB,          -- Output data, insights, errors
  duration_ms   INTEGER
);

CREATE INDEX idx_job_history_job ON job_run_history(job_id);
CREATE INDEX idx_job_history_started ON job_run_history(started_at);
```

### 5.3 Job Types & Config Schema

| Job Type | `config` Shape | Description |
|----------|---------------|-------------|
| `etl_refresh` | `{ sourceIds: string[], cleaningRules: boolean }` | Re-trigger ETL pipeline for specified data sources |
| `ai_analysis` | `{ prompt: string, targetSheetIds: string[] }` | Run AI analysis on workspace sheets with custom prompt |
| `generate_report` | `{ templateId: string, format: "pptx" }` | Generate a presentation/report from workspace data |
| `run_skill` | `{ skillId: string, parameters: {} }` | Execute a skill against workspace data |
| `custom_prompt` | `{ prompt: string, contextScope: "workspace" \| "space" }` | Run arbitrary AI prompt with scoped context |

### 5.4 Job Scheduler Engine

**File**: `server/services/jobScheduler.ts`
**Dependency**: `cron-parser` npm package

**Execution loop** (runs every 60 seconds, separate from ETL's 30-second loop):

```
Every 60 seconds:
  1. Query: scheduled_jobs WHERE status = 'active' AND next_run_at <= NOW()
  2. Also query: jobs WHERE last_run_status = 'running' AND last_run_at < NOW() - 10min
     → Mark these as 'failed' (stale job recovery)
  3. For each due job (max 2 concurrent):
     a. Set last_run_status = 'running'
     b. Create job_run_history entry (status = 'running')
     c. Execute based on job_type (dispatch to appropriate service)
     d. On completion:
        - Update last_run_at, last_run_status, last_run_result
        - Compute next_run_at from cron expression
        - Update job_run_history with result and duration
        - Emit WebSocket event for real-time UI update
        - Send notification if configured
     e. On failure:
        - Record error in last_run_result
        - Increment fail_count
        - Still advance next_run_at (don't retry failed schedules)
  4. Missed schedule policy: "Run latest only"
     → If server was down and multiple next_run_at are in the past,
       execute once, then advance to next future time
```

**Concurrency**: Max 2 concurrent scheduled jobs (existing ETL processor uses 3 slots).

**Graceful shutdown**: Wait for running jobs before exit (30-second timeout, matching existing ETL processor).

### 5.5 Backend API

**File**: `server/routes/scheduledJobs.ts`
**Services**: `server/services/jobScheduler.ts`, `server/services/jobExecutor.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/scheduled-jobs` | List jobs for user. Query: `?spaceId=`, `?status=` |
| `GET` | `/api/scheduled-jobs/:id` | Get job details + last run result |
| `GET` | `/api/scheduled-jobs/:id/history` | Get run history (last 50 runs) |
| `POST` | `/api/scheduled-jobs` | Create a new job |
| `PATCH` | `/api/scheduled-jobs/:id` | Update job config, schedule, or status |
| `DELETE` | `/api/scheduled-jobs/:id` | Delete a job |
| `POST` | `/api/scheduled-jobs/:id/run-now` | Manually trigger immediate execution |
| `POST` | `/api/scheduled-jobs/:id/pause` | Pause a job |
| `POST` | `/api/scheduled-jobs/:id/resume` | Resume a paused job |

### 5.6 Frontend: Scheduled Jobs Page

**File**: `src/components/ScheduledJobsPage.tsx`

**Layout**:
```
┌───────────────────────────────────────────────────┐
│  ⏰ Scheduled Jobs                                 │
│  Automate your data analysis workflow              │
│                                                     │
│  [+ Create Job]                                     │
├───────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────┐  │
│  │  📊 Weekly Ad Spend Analysis                  │  │
│  │  Every Monday at 9:00 AM · AI Analysis        │  │
│  │  ● Active   Last run: 2h ago ✅               │  │
│  │  Next run: Mon Mar 9, 9:00 AM                 │  │
│  │  [⏸ Pause] [▶ Run Now] [✏️ Edit] [🗑️ Delete] │  │
│  │                                                │  │
│  │  ▸ Run History (last 10 runs)                  │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │  🔄 Daily Data Refresh                        │  │
│  │  Every day at 6:00 AM · ETL Refresh           │  │
│  │  ⏸ Paused   Last run: 5d ago ✅               │  │
│  │  [▶ Resume] [▶ Run Now] [✏️ Edit] [🗑️ Delete] │  │
│  └──────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┘
```

**Create Job Form**:
- Name input
- Job type selector (dropdown with 5 types)
- Dynamic config section (changes based on job type)
- Schedule builder:
  - Quick presets: "Every hour", "Daily at 9am", "Weekly Monday", "Monthly 1st", "Custom"
  - Custom: cron expression input with helper text
  - Human-readable preview of schedule
  - Timezone selector (defaults to browser timezone)
- Notification settings: in-app toggle, email toggle + address input
- Workspace/Space selector

**Sidebar integration** (`ProjectBrowser.tsx`):
- Clock icon button below Memory button
- Order: Rules → Memory → Scheduled Jobs

---

## 6. Cross-Cutting Concerns

### 6.1 Authentication & Authorization

All new endpoints require authentication via the existing `isAuthenticated` middleware. Memory and job entries are scoped to `userId`. Skills are scoped via the workspace/space ownership chain.

### 6.2 WebSocket Real-Time Updates

The app already uses WebSocket (`ws` package). New events to add:

| Event | Trigger | Payload |
|-------|---------|---------|
| `memory:learned` | AI auto-learns a new memory | `{ memoryId, content, category }` |
| `job:started` | Scheduled job begins execution | `{ jobId, jobName }` |
| `job:completed` | Scheduled job finishes | `{ jobId, jobName, status, resultPreview }` |
| `skill:result` | Skill execution completes | `{ skillId, workspaceId, resultPreview }` |

### 6.3 Error Handling

| Scenario | Behavior |
|----------|----------|
| Skill referenced by job is deleted | Job fails with clear error message; user notified |
| Skill run on workspace with no data | Return helpful message: "No data available" |
| Cron expression is invalid | Reject at creation time with validation error |
| Job executor crashes mid-run | Stale job detection recovers after 10 minutes |
| Memory auto-learn exceeds daily cap | Silently skip; log for observability |
| Memory content is duplicate | Skip creation; log dedup event |

### 6.4 Performance Considerations

- Memory context assembly: Limit to top 20 entries by importance; cache for duration of chat session
- Skill execution: Queue if >2 concurrent; return 429 with retry-after
- Job scheduler: 60-second poll interval; max 2 concurrent jobs
- Database indexes on all query paths (userId, spaceId, status, nextRunAt)

### 6.5 Existing `chatThreads.savedToMemory` Migration

The existing `savedToMemory` boolean on `chatThreads` will be preserved as a UI indicator. When set to `true`, it triggers extraction of key facts into `agent_memory`. The new Memory page shows all extracted memories regardless of source thread.

---

## 7. Database Schema Reference

### New Tables Summary

| Table | Columns | Phase | Purpose |
|-------|---------|-------|---------|
| `agent_memory` | 12 | 1 | User memory entries |
| `agent_skills` | 11 | 2 | Skill definitions |
| `workspace_skills` | 7 | 2 | Skill-to-workspace junction |
| `scheduled_jobs` | 20 | 3 | Job definitions |
| `job_run_history` | 7 | 3 | Job execution history |

### Total New Columns: 57

### Index Strategy

All tables include indexes on:
- Primary lookup paths (userId, spaceId)
- Status/filter columns
- Sort columns (nextRunAt, startedAt, importance)
- Partial unique indexes for junction tables

---

## 8. API Endpoints Reference

### Phase 1: Memory (6 endpoints)

```
GET    /api/memory
GET    /api/memory/context/:spaceId
POST   /api/memory
PATCH  /api/memory/:id
DELETE /api/memory/:id
POST   /api/memory/ai-learn
```

### Phase 2: Skills (8 endpoints)

```
GET    /api/skills
GET    /api/skills/workspace/:workspaceId
GET    /api/skills/space/:spaceId
POST   /api/skills
POST   /api/skills/:skillId/enable
POST   /api/skills/:skillId/disable
PATCH  /api/skills/:skillId/config
POST   /api/skills/:skillId/run
```

### Phase 3: Scheduled Jobs (9 endpoints)

```
GET    /api/scheduled-jobs
GET    /api/scheduled-jobs/:id
GET    /api/scheduled-jobs/:id/history
POST   /api/scheduled-jobs
PATCH  /api/scheduled-jobs/:id
DELETE /api/scheduled-jobs/:id
POST   /api/scheduled-jobs/:id/run-now
POST   /api/scheduled-jobs/:id/pause
POST   /api/scheduled-jobs/:id/resume
```

### Total: 23 new endpoints

---

## 9. File Manifest

### New Files

| File | Phase | Description |
|------|-------|-------------|
| `server/routes/memory.ts` | 1 | Memory API routes |
| `server/services/memoryService.ts` | 1 | Memory business logic |
| `src/components/MemoryPage.tsx` | 1 | Memory page UI |
| `server/ai/skillsLibrary.ts` | 2 | Built-in skill definitions |
| `server/routes/skills.ts` | 2 | Skills API routes |
| `server/services/skillExecutor.ts` | 2 | Skill execution logic |
| `src/components/workspace/SkillsDashboard.tsx` | 2 | Skills dashboard UI |
| `server/routes/scheduledJobs.ts` | 3 | Scheduled jobs API routes |
| `server/services/jobScheduler.ts` | 3 | Cron scheduler engine |
| `server/services/jobExecutor.ts` | 3 | Job dispatch + execution |
| `src/components/ScheduledJobsPage.tsx` | 3 | Scheduled jobs page UI |

### Modified Files

| File | Phase | Changes |
|------|-------|---------|
| `shared/schema.ts` | 1,2,3 | New table definitions |
| `server/index.ts` | 2,3 | Skill seeding, scheduler init |
| `server/ai/index.ts` | 1 | Memory context injection |
| `server/ai/prompts.ts` | 1 | Memory-aware prompt section |
| `src/App.tsx` | 1,3 | New view types and routing |
| `src/components/ProjectBrowser.tsx` | 1,3 | Sidebar buttons |
| `src/pages/InsightWorkspace.tsx` | 2 | Skills button + dashboard |
| `package.json` | 3 | Add cron-parser dependency |
| `replit.md` | all | Documentation updates |

---

## 10. Execution Timeline

```
Phase 1: Memory
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Step 1.1: Schema (agent_memory table)
  Step 1.2: Backend API (memory CRUD + service)
  Step 1.3: AI Integration (prompt injection + auto-learn)
  Step 1.4: Frontend UI (MemoryPage + sidebar)

Phase 2: Skills
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Step 2.1: Schema (agent_skills + workspace_skills)
  Step 2.2: Seed built-in skills library
  Step 2.3: Backend API (skills CRUD + executor)
  Step 2.4: Frontend UI (SkillsDashboard)

Phase 3: Scheduled Jobs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Step 3.1: Install cron-parser + Schema (scheduled_jobs + job_run_history)
  Step 3.2: Backend API (jobs CRUD)
  Step 3.3: Job scheduler engine + executor
  Step 3.4: Frontend UI (ScheduledJobsPage + sidebar)

Final: Documentation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Update replit.md with all new features
```

---

## 11. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Memory table bloat from auto-learning | High | Medium | Daily cap (20/user/day), deduplication, soft-delete with cleanup |
| Job scheduler crashes, jobs stuck as "running" | Medium | High | Stale job detection (10-min timeout), recovery on startup |
| Server restart loses in-flight jobs | Medium | High | Job run history preserves state; advance next_run_at on recovery |
| Skill prompt injection via custom skills | Low | High | Sanitize user prompts, enforce character limits, audit log |
| Cron expressions with sub-minute frequency | Low | Medium | Validate minimum interval (5 minutes) at creation time |
| Concurrent job execution exceeds AI rate limits | Medium | Medium | Max 2 concurrent jobs; queue excess with backpressure |
| Large workspace data overwhelms skill prompt | Medium | Medium | Token-aware context assembly; truncate data with summary |
| Multiple missed scheduled runs after downtime | Low | Low | "Run latest only" policy — execute once, advance to future |

---

*End of plan. Implementation begins with Phase 1: Enhanced Memory.*
