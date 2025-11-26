# CaptureInsight - Full Stack Application

## Overview
CaptureInsight is a screenshot-based analytics platform that helps marketing managers capture, organize, and analyze data from multiple sources using AI. This is a fully-functioning application with complete backend infrastructure.

## Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 6.3.5
- **UI Components**: Radix UI with custom components
- **Styling**: Tailwind CSS
- **Data Fetching**: TanStack React Query
- **Rich Text**: TipTap editor
- **Animation**: Motion library

### Backend
- **Server**: Express.js on Node.js
- **Database**: PostgreSQL (Neon Serverless)
- **ORM**: Drizzle ORM
- **Authentication**: Replit Auth (OAuth - Google, GitHub, X, Apple, email)
- **Session**: connect-pg-simple with PostgreSQL

## Project Structure
```
├── client/src/         # React frontend
│   ├── components/     # React components
│   ├── hooks/          # Custom hooks (useAuth, useSpaces, useInsights, useTags)
│   ├── lib/            # Utilities (queryClient, authUtils)
│   ├── types/          # TypeScript types
│   └── data/           # Mock data (legacy)
├── server/             # Express backend
│   ├── index.ts        # Server entry point (port 3001)
│   ├── routes.ts       # API routes
│   ├── storage.ts      # Database operations
│   ├── replitAuth.ts   # Replit Auth integration
│   └── db.ts           # Database connection
├── shared/             # Shared code
│   └── schema.ts       # Drizzle ORM schema (14 tables)
└── src/                # Frontend source (Vite entry)
```

## Database Schema (14 Tables)
- **sessions** - User session storage (Replit Auth)
- **users** - User accounts and profiles
- **spaces** - Workspaces with settings
- **folders** - Organization within spaces
- **sheets** - Data sheets with source tracking
- **tags** - Space-scoped tag system
- **tag_associations** - Many-to-many tag relationships
- **insights** - Knowledge cards with status/priority
- **insight_sources** - Linked data sources
- **insight_comments** - Threaded comments with mentions
- **chat_threads** - Per-user per-insight AI conversations
- **chat_messages** - AI chat history
- **change_logs** - Activity tracking
- **document_embeddings** - Vector storage (future AI search)

## API Endpoints

### Authentication
- `GET /api/login` - Start OAuth login
- `GET /api/logout` - Logout
- `GET /api/callback` - OAuth callback
- `GET /api/auth/user` - Get current user

### Spaces & Organization
- `GET/POST /api/spaces` - List/create spaces
- `GET/PUT/DELETE /api/spaces/:id` - Space operations
- `GET/POST /api/spaces/:spaceId/folders` - Folder management

### Data & Insights
- `GET/POST /api/spaces/:spaceId/sheets` - Sheets
- `GET/POST /api/spaces/:spaceId/tags` - Tags
- `GET/POST /api/spaces/:spaceId/insights` - Insights
- `GET/PUT/DELETE /api/insights/:id` - Insight operations
- `GET/POST /api/insights/:insightId/comments` - Comments
- `GET/POST /api/insights/:insightId/sources` - Sources

### Chat & AI
- `GET/POST /api/chat-threads` - Chat threads
- `GET/POST /api/chat-threads/:threadId/messages` - Messages

## Development

### Running the Application
```bash
# Frontend (port 5000)
npm run dev

# Backend (port 3001)
npm run server:dev

# Database migrations
npm run db:push
```

### Workflows
- **Development Server**: `npm run dev` - Frontend on port 5000
- **Backend Server**: `npm run server:dev` - API on port 3001

## Key Features
- User authentication with multiple OAuth providers
- Hierarchical workspace organization (Space → Folder → Sheet)
- Space-scoped tag system with associations
- Insights management with sources and comments
- AI chat integration per insight
- Activity tracking and change logs
- Screen capture simulation

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `REPL_ID` - Replit project ID (auto-set)

## Recent Changes (November 26, 2025)

### Backend Infrastructure
- Created PostgreSQL database with 14 tables
- Implemented Drizzle ORM schema
- Built Express API with all CRUD endpoints
- Integrated Replit Auth (OAuth)
- Created session management with PostgreSQL

### Frontend Integration
- Added TanStack React Query for data fetching
- Created hooks: useAuth, useSpaces, useInsights, useTags
- Connected frontend to backend APIs
- Fixed type compatibility between frontend/backend models
- Added auth-aware UI with login/logout buttons

### Type System
- Created adapter layer for frontend/backend compatibility
- Defined SpaceDTO, SheetDTO, CaptureDestination types
- Fixed all TypeScript errors (24 resolved)

## AI Integration (Phase 3 - Complete)

### Hybrid AI Architecture
CaptureInsight uses a hybrid AI approach for optimal functionality:
- **Gemini 2.5 Pro/Flash** (via Replit AI Integrations): Screenshot analysis, data analysis, chat conversations
- **OpenAI** (requires API key): Text embeddings for semantic search (text-embedding-3-small, 1536 dimensions)

### AI Features
1. **Screenshot Analysis**: Upload screenshots from analytics dashboards, Gemini extracts metrics and insights
2. **Data Analysis**: Analyze tabular data with expert business analyst prompts
3. **RAG-Enabled Chat**: AI assistant uses vector search to retrieve relevant context from your data
4. **Semantic Search**: Find insights and sheets using natural language queries

### AI API Endpoints
- `GET /api/ai/status` - Check AI service configuration
- `POST /api/ai/analyze` - Analyze screenshots or data
- `POST /api/ai/chat` - RAG-enabled AI chat (supports spaceId for context)
- `POST /api/ai/extract-insights` - Extract actionable insights from content
- `POST /api/embeddings/index` - Index an entity for semantic search
- `POST /api/embeddings/reindex-space/:spaceId` - Reindex all content in a space
- `GET /api/search` - Semantic search across a space

### pgvector Integration
- Extension enabled with 1536-dimension vectors
- Uses IVFFlat index with cosine distance for efficient similarity search
- Automatically embeds insights and sheets for semantic retrieval

### Environment Variables
- `AI_INTEGRATIONS_GEMINI_API_KEY` - Auto-set by Replit AI Integrations
- `AI_INTEGRATIONS_GEMINI_BASE_URL` - Auto-set by Replit AI Integrations
- `OPENAI_API_KEY` - Required for embeddings (user must provide)

## Chrome Extension (Phase 4 - Complete)

### Overview
CaptureInsight now includes a Chrome extension that enables screenshot capture directly from any webpage. The extension features a floating toolbar and popup interface for quick capture workflow.

### Extension Structure
```
/extension
├── manifest.json           # Manifest V3 configuration
├── vite.config.ts          # Vite build config
├── package.json            # Extension dependencies
├── src/
│   ├── background/         # Service worker (auth, capture handling)
│   ├── content/            # Floating toolbar (React in shadow DOM)
│   ├── popup/              # Extension popup UI
│   └── shared/             # Shared types and constants
└── dist-extension/         # Built extension (load in Chrome)
```

### Key Features
- **Floating Toolbar**: Draggable toolbar injected into any webpage
- **Tab Capture**: Screenshot the current visible tab
- **File Upload**: Upload local images for analysis
- **Link Capture**: Save web links for reference
- **Destination Picker**: Select target space for captures (fetches from /api/spaces)
- **Tags Picker**: Multi-select tags for organization (fetches from /api/spaces/:spaceId/tags)
- **LLM Selection**: Choose Gemini 2.5 Pro, Flash, or skip analysis
- **Cookie-based Auth**: Uses existing Replit Auth session cookies
- **AI Analysis**: Configurable screenshot analysis with Gemini model choice
- **Backend Integration**: Saves captures as sheets linked to insights

### Installation (Development)
1. Build the extension:
   ```bash
   cd extension && npm install && npm run build
   ```
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked" and select the `extension/dist-extension` folder
5. The CaptureInsight extension icon will appear in your toolbar

### Extension API Endpoint
- `POST /api/captures` - Upload capture from extension
  - Requires authentication (session cookies)
  - Accepts: `{ dataUrl?, sourceUrl?, metadata, spaceId?, tags?, analyze?, llmModel? }`
  - Supports screenshot uploads (dataUrl) or link-only captures (sourceUrl)
  - Creates a sheet and linked insight with optional tag associations
  - AI analysis controlled by `analyze` (boolean) and `llmModel` ('gemini-pro'|'gemini-flash')

### Build Commands
```bash
npm run build:extension    # Build extension to dist-extension/
npm run dev:extension      # Watch mode for development
```

### Technical Notes
- Uses Manifest V3 (latest Chrome extension standard)
- React components with shadow DOM for isolation from page styles
- Cookie-based auth via `credentials: 'include'` in fetch requests
- PNG dimension parsing for accurate metadata

## Security Implementation (Phase 5 - Complete)

### Multi-Tenant Data Isolation
CaptureInsight implements comprehensive security to ensure users can only access their own data:

#### Space-Level Authorization
- `requireSpaceOwner` middleware validates ownership for all space-scoped endpoints
- Applied to 15+ endpoints: folders, sheets, tags, insights operations
- Checks: space.ownerId === req.user.id

#### Entity-Level Authorization
- `requireEntityOwner` middleware factory for id-based routes
- Protects: `/api/folders/:id`, `/api/sheets/:id`, `/api/tags/:id`, `/api/insights/:id`
- Loads entity, resolves spaceId, validates ownership
- Returns 404 for non-existent, 403 for unauthorized access

### PII Filtering for AI
- **Module**: `server/ai/piiFilter.ts`
- **14 Pattern Types**: email, phone, SSN, credit cards, API keys, passwords, IPs, names, addresses, bank accounts, dates, URLs, passport numbers, driver licenses
- **Configurable per-space** via `aiSettings.piiFiltering` (boolean)
- **Integrated into**: analyzeCapture, chat functions
- **API Endpoint**: `GET /api/ai/pii-patterns` - List available filter patterns

### AI Consent Tracking
- **Schema**: `aiSettings` JSONB field in spaces table
- **Settings**: 
  - `enableAI` (boolean) - Master toggle for AI features
  - `piiFiltering` (boolean) - Enable/disable PII scrubbing
  - `allowedPatterns` (string[]) - Specific patterns to filter
- **Endpoints**: 
  - `PUT /api/spaces/:id/ai-settings` - Update AI consent settings
  - `GET /api/spaces/:id/ai-settings` - Retrieve current settings

## Frontend-Backend Integration (Phase 6 - Complete)

### Connected Components
All major frontend components now use real backend APIs instead of mock data:

#### InsightsView
- Uses `useInsights(spaceId)` hook for insights data
- Uses `useTags(spaceId)` hook for tag data
- Mutations: `useUpdateInsight`, `useCreateInsightComment`, `useCreateInsight`
- Date normalization: API dates (strings) converted to Date objects

#### AIAssistantPanel
- Uses `useTags(spaceId)` for real tag data
- Uses `useCreateTag` mutation for tag creation
- Chat connected to `/api/ai/chat` with RAG support

#### App.tsx (Main Application)
- Removed 200+ lines of `initialSpaces` mock data
- Uses `useSpaces()` hook with React Query
- All CRUD operations via API mutations
- No more localStorage for spaces persistence

#### Spreadsheet
- Uses `fetch('/api/sheets/:id')` for sheet data
- Removed `marketingData` mock dependency
- Loading and empty state handling

### React Query Hooks
Located in `src/hooks/`:
- `useSpaces.ts` - Spaces CRUD, folders, sheets
- `useInsights.ts` - Insights CRUD, comments, sources
- `useTags.ts` - Tags CRUD, usage stats
- `useAuth.ts` - Authentication state

## Future Phases
- **Phase 7**: Desktop application (Electron/Tauri) for system-wide floating toolbar
- **Phase 8**: Advanced analytics and reporting features
