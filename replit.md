# CaptureInsight - Full Stack Application

## Overview
CaptureInsight is a screenshot-based analytics platform designed for marketing managers. It provides tools for capturing, organizing, and analyzing data from various sources using AI, aiming to deliver comprehensive insights through a complete backend infrastructure. The platform enables hierarchical data organization, AI-powered data cleaning, and an intelligent template system for automated data processing.

**Original Design**: Based on [Figma Design](https://www.figma.com/design/TUZWel1YVzoA5u9NsxuRP3/Build-CaptureInsight-Demo-Screen-1)

## Quick Start (Development)
```bash
npm install        # Install dependencies
npm run dev        # Start frontend dev server (port 5000)
npm run server:dev # Start backend server (port 3001) - run in separate terminal
```

## Production Deployment
For Replit Autoscale deployment, both frontend and backend run together:
```bash
npm run build      # Build frontend
bash -c "tsx server/index.ts & npx vite preview --host 0.0.0.0 --port 5000"
```
- Frontend serves on port 5000 (maps to external port 80)
- Backend runs on port 3001 (internal API calls)

## User Preferences
- Iterative development approach
- Ask before making major changes
- Prefer detailed explanations
- Do not modify folder `Z` or file `Y`

## System Architecture

### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | React 18 (TypeScript), Vite, Radix UI, Tailwind CSS, TanStack React Query, TipTap, Motion |
| Backend | Express.js (Node.js), TypeScript |
| Database | PostgreSQL (Neon Serverless), Drizzle ORM, pgvector |
| Authentication | Replit Auth (OAuth), connect-pg-simple |
| AI Services | See AI Integration section below |

### UI/UX Design System
- Inspired by Stripe's premium UI
- Generous spacing, defined typography
- Consistent patterns: `rounded-2xl` cards, distinct button styles, gradient section dividers
- Motion library for animations (page transitions, staggered elements, hover effects)
- View states and URL paths persisted to `localStorage` with auth-guarded restoration

## Core Features

### Data Organization
- **Hierarchy**: Spaces > Workspaces > Insights/Chats/Sheets
- **Insight Workspace**: Three-panel interface (Chat, Canvas, Data) with resizing and drag-and-drop

### ETL Pipeline (7 Stages)
```
PARSING → VALIDATING → TEMPLATE_MATCHING → CLEANING → QUALITY_SCORING → EMBEDDING → FINALIZING
```
- Durable job tracking with checkpoint resumability
- Automatic retry with exponential backoff
- Server-side encryption support (AES-256-GCM)
- Background processor runs every 30 seconds, max 3 concurrent jobs

### AI Integration
| Service | Provider | Purpose | Required Key |
|---------|----------|---------|--------------|
| Analysis & Chat | Gemini 2.5 Pro/Flash | Data analysis, summaries, canvas editing | AI_INTEGRATIONS_GEMINI_API_KEY |
| Semantic Search (RAG) | OpenAI text-embedding-3-small | Vector embeddings for search (768 dimensions) | OPENAI_API_KEY |
| Hybrid Search | pgvector | Vector similarity + keyword matching | N/A (database) |

**Note**: If OPENAI_API_KEY is missing, embeddings are disabled and semantic search won't work. Gemini is still required for AI analysis and chat features.

### Template Matching System
Auto-detects and applies templates using weighted scoring:
- Column Name Similarity (40%)
- Data Type Match (25%)
- Source Fingerprint (20%)
- Statistical Profile (15%)

Auto-apply threshold: 85% confidence

### Data Ingestion
**Supported file types for ETL processing:**
- CSV files (max 10MB)
- Excel files (.xlsx, .xls) (max 50MB)

**Other capture types (handled separately):**
- Screenshots (image analysis via Gemini)
- Links/URLs (web content capture)
- Google Sheets (requires accessible sharing settings)

### Security Features
- `requireSpaceOwner` and `requireEntityOwner` middlewares
- Configurable PII filtering
- Two-tier encryption:
  - Server-side: AES-256-GCM
  - End-to-end: Client-side Web Crypto API, PBKDF2, TOTP 2FA

### Data Editing
- Excel/Google Sheets-like data grid
- Multi-cell selection, in-place editing
- Arrow key/tab/enter navigation
- Undo/redo, column resizing
- Optimistic updates with unsaved changes protection

## Project Structure
```
├── src/                    # Frontend React app
│   ├── components/         # UI components
│   ├── hooks/              # Custom React hooks
│   ├── contexts/           # React context providers
│   └── lib/                # Utilities
├── server/                 # Backend Express server
│   ├── ai/                 # AI services (ETL, embeddings, cleaning)
│   ├── routes.ts           # API endpoints
│   ├── storage.ts          # Database operations
│   └── encryption.ts       # Server-side encryption
├── shared/                 # Shared types and schema
│   └── schema.ts           # Drizzle database schema
├── extension/              # Chrome extension (Manifest V3)
└── attached_assets/        # User uploads and example data
```

## Environment Variables

### Required
| Variable | Purpose |
|----------|---------|
| DATABASE_URL | PostgreSQL connection string (auto-provided by Replit) |
| PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE | PostgreSQL connection details |
| ENCRYPTION_MASTER_KEY | Server-side AES-256-GCM encryption |

### AI Services
| Variable | Purpose | Required For |
|----------|---------|--------------|
| AI_INTEGRATIONS_GEMINI_API_KEY | Gemini AI analysis | Analysis, chat, data cleaning |
| AI_INTEGRATIONS_GEMINI_BASE_URL | Gemini API endpoint | Analysis, chat, data cleaning |
| OPENAI_API_KEY | OpenAI embeddings | Semantic search, RAG |

### Authentication (Auto-configured by Replit)
| Variable | Purpose |
|----------|---------|
| REPL_IDENTITY | Replit authentication identity |
| REPL_ID | Replit project identifier |
| ISSUER_URL | OAuth issuer URL |

## Scripts
```bash
npm run dev          # Frontend dev server (port 5000)
npm run build        # Build for production
npm run server       # Production backend
npm run server:dev   # Backend with hot reload (port 3001)
npm run db:push      # Sync database schema
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
```

## Recent Changes
- **2024-12-15**: Fixed Space Goals and AI Instructions - Backend now auto-fetches these from database when spaceId is provided, ensuring AI chat/analysis/summaries respect user-defined goals and instructions
- **2024-12-15**: Settings sub-pages Back button now returns to main Settings menu instead of exiting to workspace
- **2024-12-15**: Billing and Security temporarily disabled with "Coming soon once beta is complete..." message
- **2024-12-15**: Implemented Rules System - workspace-level data processing rules with 4 configurable sections (cleaning, renaming, KPIs, AI hints), per-section saves, upload flow integration with rules modal, and canvas summary trigger after ETL
- **2024-12-11**: Added Welcome Screen modal with tutorial video placeholders (Vimeo support), Questions form, and Chrome extension download banner
- **2024-12-11**: Added contact questions endpoint (POST /api/contact/question) storing to database for email forwarding to ericunterberger@proton.me
- **2024-12-11**: Added "Watch tutorial" link to EmptyWorkspaceState component
- **2024-12-08**: Switched embeddings from Google text-embedding-004 to OpenAI text-embedding-3-small (768 dimensions) due to Replit Gemini proxy not supporting embedding endpoints
- **2024-12-08**: Fixed file upload flow to properly send base64 file data with captureBatchId for batch processing
- **2024-12-08**: ETL pipeline now completes all 7 stages successfully with embedding generation
- **2024-12-08**: Updated deployment config to run backend and frontend together on port 5000

## External Dependencies
- **Database**: PostgreSQL (Neon Serverless)
- **ORM**: Drizzle ORM
- **Authentication**: Replit Auth (Google, GitHub, X, Apple, email OAuth)
- **Session Management**: connect-pg-simple
- **AI Services**: Gemini 2.5 Pro/Flash (analysis), OpenAI text-embedding-3-small (embeddings)
- **Frontend Libraries**: React, Radix UI, Tailwind CSS, TanStack React Query, TipTap, Motion
