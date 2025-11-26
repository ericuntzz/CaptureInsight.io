# CaptureInsight - Implementation Guide for Replit

## Overview

This repository contains the interactive demo and complete technical specifications for **CaptureInsight**, a screenshot-based analytics platform that helps marketing managers and business leaders capture, organize, and analyze data from multiple sources using AI.

---

## Key Documentation Files

### 1. **IMPLEMENTATION_NOTES.md** (Primary Technical Guide)
**Purpose:** Complete technical architecture and requirements for production build

**Key Sections:**
- Desktop Application Architecture (macOS/Windows menu bar app)
- Persistent Capture Boxes with Context Awareness
- Screen Capture Implementation (native OS APIs)
- Backend Data Management System (Projects → Folders → Sheets)
- Database Schema (PostgreSQL + pgvector)
- **Vector Database & AI Assistant Implementation** (Lines 555-1424)
  - PostgreSQL + pgvector extension setup
  - document_embeddings table schema
  - Embedding generation service (OpenAI integration)
  - Auto-embedding pipeline
  - Semantic search + RAG pattern
  - Hybrid search (vector + metadata filters)
  - Performance optimization strategies

**Read this first** for understanding the complete technical architecture.

---

### 2. **AI_ASSISTANT_TRAINING_GUIDE.md** (AI Intelligence Layer)
**Purpose:** How to train the AI Assistant to provide expert-level business insights

**Core Value Proposition:**
The AI Assistant must function as a **world-class digital marketer, strategist, and business analyst** that:
- Provides TWO outputs always:
  1. **Data & Trends** (what the data shows)
  2. **Expert Analysis** (WHY it is what it is + statistical significance + causal relationships + recommendations)

**Key Sections:**
- The Core Problem (executives need to explain data to stakeholders)
- Training Strategy Options:
  - **Option 1:** Fine-Tuned Model (highest quality, longer timeline)
  - **Option 2:** RAG + Prompt Engineering ⭐ **RECOMMENDED**
  - **Option 3:** Hybrid Approach (best long-term)
- Statistical Analysis Module (actual calculations, not descriptions)
- Causal Inference Engine (understanding marketing cause-effect relationships)
- Industry Benchmarks Database
- Response Quality Evaluation & Feedback Loop

**Recommended Approach:** Start with Option 2 (RAG + Prompt Engineering), then upgrade to Option 3 (Hybrid) based on user feedback.

**Timeline:** 6-12 weeks from MVP to production-ready AI, depending on approach

---

### 3. **CUSTOM_KPI_DEFINITIONS_SYSTEM.md** (Context-Aware KPI Management)
**Purpose:** Solve the problem of inconsistent KPI definitions across teams

**Core Problem:**
The same KPI term means different things to different teams:
- Media Buyer's "Conversion" = User signup
- Sales Team's "Conversion" = Demo booked
- Executive's "Conversion" = Paid customer

**Solution: Multi-Definition KPI System**
- Every KPI can have multiple context-aware definitions
- AI automatically selects correct definition based on:
  - Who is asking (role, team)
  - What context they're in (Space, project)
  - Time period of data
- Always cites which definition was used

**Key Sections:**
- Database schema for KPI definitions and multi-definitions
- KPI resolution algorithm (context-based selection)
- AI integration with KPI context
- UI/UX for KPI management (hover definitions, bulk operations)
- Auto-detection and data quality rules
- Search and discoverability

**Implementation Timeline:** 10 weeks (can be built in parallel with AI Assistant)

---

### 4. **DESKTOP_FOLDER_SYNC_SYSTEM.md** ⭐ (Native Desktop Integration)
**Purpose:** Eliminate manual uploading by syncing local desktop folders with CaptureInsight

**Core Problem:**
Users save files to Downloads/Desktop, then manually upload to CaptureInsight. This creates:
- Digital clutter (files scattered everywhere)
- Manual work (upload every file)
- No automatic backup
- Disconnected workflow (desktop vs. web)

**Solution: Dropbox-Style Folder Sync**
- User saves files to `~/CaptureInsight/` on their computer
- Folder structure mirrors Spaces and Folders
- Files automatically sync to cloud
- Two-way sync (desktop ↔ cloud)
- Multi-device support

**Key Features:**
- File system watcher (real-time detection)
- Background upload queue (non-blocking)
- Conflict resolution (when same file edited in two places)
- Offline mode (queues uploads until connection restored)
- Selective sync (choose which Spaces to sync)
- System tray icon (shows sync status)

**Technical Architecture:**
- File watcher: chokidar (Node.js)
- Desktop app: Electron or Tauri
- Local metadata: SQLite database
- Sync engine: Bidirectional sync algorithm
- Deduplication: Only upload unique files

**Implementation Timeline:** 10 weeks

**User Experience:**
```
User workflow:
1. Export CSV from Google Ads
2. Save to ~/CaptureInsight/Q4 2024 Campaigns/Google Ads/
3. File automatically uploads and appears in web app
4. AI processes it and makes it searchable
5. No manual upload needed! ✨
```

---

### 5. **WHY_WE_ARE_BUILDING_CAPTUREINSIGHT.md** (Vision & Mission)
**Purpose:** Explains the problem we're solving and why it matters

**Read this to understand:**
- The pain of manual data analysis and reporting
- Why existing tools (BI, spreadsheets, AI) fail
- How CaptureInsight is different
- The market opportunity
- Our unfair advantages
- What success looks like

**This is the "why" behind all the technical decisions.**

---

## Critical Decision Points for Replit

### Decision 1: Vector Database Setup
**Question:** How to structure the database for AI Assistant capabilities?

**Answer:** PostgreSQL + pgvector extension (documented in IMPLEMENTATION_NOTES.md)

**Why:**
- ✅ Combines relational and vector data in one database
- ✅ No separate vector database service needed
- ✅ Supabase native support
- ✅ Handles millions of embeddings efficiently

**Action Items:**
1. Enable pgvector extension
2. Create document_embeddings table with HNSW indexes
3. Implement embedding generation service (OpenAI text-embedding-3-small recommended)
4. Build auto-embedding pipeline for all captured data

---

### Decision 2: AI Assistant Training Approach
**Question:** How to make the AI provide expert-level business insights?

**Answer:** RAG + Expert Prompt Engineering with path to Hybrid (documented in AI_ASSISTANT_TRAINING_GUIDE.md)

**Why:**
- ✅ Faster time to market (2 months vs. 6 months for fine-tuning)
- ✅ Modern base models (GPT-4o, Claude 3.5) already excel at reasoning
- ✅ Can upgrade to fine-tuning later based on validated use cases
- ✅ Easier to maintain and iterate

**Action Items:**
1. Build expert system prompt (marketing analyst persona)
2. Create domain knowledge base (marketing scenarios, causal relationships)
3. Integrate industry benchmarks database
4. Implement statistical analysis module
5. Add user feedback collection for continuous improvement

---

## End Goals & Success Criteria

### Vector Database Performance
- ✅ Semantic search: **<100ms** for most queries
- ✅ Accurate retrieval from large datasets (millions of captures)
- ✅ Contextual awareness across all projects/sources
- ✅ No hallucinations (grounded in real data via RAG)

### AI Assistant Quality
- ✅ 85%+ user satisfaction rating
- ✅ 100% citation rate (every claim backed by data)
- ✅ 90%+ statistical analysis inclusion
- ✅ Actionable recommendations in every response
- ✅ 10x faster than manual analysis

---

## Implementation Roadmap

### Phase 1: Foundation
**Focus:** Database & Vector Search
- Enable pgvector extension
- Create document_embeddings table and indexes
- Implement embedding generation service
- Set up OpenAI API integration

### Phase 2: Data Pipeline
**Focus:** Auto-Embedding
- Build auto-embedding pipeline for new captures
- Implement batch processing for existing captures
- Add metadata enrichment logic
- Set up embedding quality monitoring

### Phase 3: Search & Retrieval
**Focus:** Semantic Search
- Implement semantic search function
- Add hybrid search with metadata filters
- Build query optimization and caching
- Performance testing and tuning

### Phase 4: AI Assistant MVP
**Focus:** Expert Intelligence Layer
- Implement RAG pattern
- Build LLM integration (GPT-4o)
- Create expert system prompt
- Add citation system
- Deploy basic domain knowledge base

### Phase 5: Knowledge Expansion
**Focus:** Domain Expertise
- Expand knowledge base to 2,000+ scenarios
- Integrate industry benchmarks database
- Implement causal inference engine
- Add statistical analysis module

### Phase 6: Optimization
**Focus:** Production Ready
- Analyze user feedback
- Optimize prompts for common use cases
- Fine-tune HNSW parameters
- Implement response caching
- Load testing

### Phase 7 (Optional): Fine-Tuning
**Focus:** Advanced AI
- Fine-tune on validated responses
- Deploy hybrid routing
- Continuous learning pipeline

---

## Key Technologies

**Database:**
- PostgreSQL 15+
- pgvector extension for vector similarity search

**AI/ML:**
- OpenAI text-embedding-3-small (embeddings)
- OpenAI GPT-4o or Anthropic Claude 3.5 Sonnet (LLM)
- RAG (Retrieval Augmented Generation) pattern

**Backend:**
- Node.js/TypeScript recommended
- Supabase for auth, database, storage (optional)

**Desktop App (Production):**
- Electron or Tauri (cross-platform)
- Native screen capture APIs (macOS: ScreenCaptureKit, Windows: Windows.Graphics.Capture)

---

## Questions for Replit

1. **Vector Database:** Are you comfortable with PostgreSQL + pgvector, or would you prefer a standalone vector database (Pinecone, Weaviate, Qdrant)?

2. **AI Training Approach:** Do you agree with starting with RAG + Prompt Engineering (Option 2) before potentially investing in fine-tuning?

3. **Embedding Provider:** OpenAI text-embedding-3-small recommended - any concerns or alternative preferences?

4. **LLM Provider:** GPT-4o (OpenAI) vs. Claude 3.5 Sonnet (Anthropic) - do you have a preference?

5. **Domain Knowledge:** Should the AI agent build the initial marketing knowledge base from publicly available resources (marketing blogs, case studies, benchmarks reports)?

6. **Benchmarks Data:** Should the system scrape publicly available industry benchmark data or use a specific data source?

7. **Statistical Libraries:** Which statistical analysis libraries should be used (e.g., simple-statistics, mathjs, or more advanced options)?

8. **Desktop Sync Framework:** Electron (mature, larger) or Tauri (modern, lighter) for the desktop sync app?

9. **Desktop Sync Priority:** Should desktop folder sync be built in Phase 1 (core feature) or Phase 2 (after web app is stable)?

---

## Next Steps

1. **Review all documentation files** (IMPLEMENTATION_NOTES.md, AI_ASSISTANT_TRAINING_GUIDE.md, CUSTOM_KPI_DEFINITIONS_SYSTEM.md, DESKTOP_FOLDER_SYNC_SYSTEM.md)
2. **Make key decisions** on database architecture and AI training approach  
3. **Begin Phase 1** (database setup) once decisions are finalized
4. **Set up monitoring** for API usage and performance metrics

---

## API Usage Considerations

**OpenAI API Costs (estimated for production):**
- Embeddings (text-embedding-3-small): ~$0.02 per 1M tokens
  - Average capture: ~500 tokens = $0.00001 per capture
  - 10,000 captures/month = ~$0.10/month for embeddings
  
- LLM (GPT-4o): ~$5 per 1M input tokens, ~$15 per 1M output tokens
  - Average query: ~2,000 input tokens + ~1,000 output tokens = ~$0.025 per query
  - 1,000 queries/month = ~$25/month
  - 10,000 queries/month = ~$250/month

**Optimization Strategies:**
- Cache common queries (30%+ cache hit rate reduces costs significantly)
- Use streaming for better UX while minimizing token usage
- Implement query batching where possible
- Monitor and alert on unusual API usage patterns

---

## Contact & Support

For questions about this implementation guide:
- Review the detailed technical specifications in IMPLEMENTATION_NOTES.md
- Review the AI training strategy in AI_ASSISTANT_TRAINING_GUIDE.md
- All design patterns and UI/UX decisions are demonstrated in the interactive prototype

---

**Last Updated:** January 2025  
**Version:** 1.0  
**Status:** Ready for Production Implementation