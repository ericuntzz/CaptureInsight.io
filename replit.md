# CaptureInsight - Full Stack Application

## Overview
CaptureInsight is a screenshot-based analytics platform designed for marketing managers. It provides tools for capturing, organizing, and analyzing data from various sources using AI, aiming to deliver comprehensive insights through a complete backend infrastructure. The platform enables hierarchical data organization, AI-powered data cleaning, and an intelligent template system for automated data processing.

## User Preferences
- I want iterative development.
- Ask before making major changes.
- I prefer detailed explanations.
- Do not make changes to the folder `Z`.
- Do not make changes to the file `Y`.

## System Architecture
CaptureInsight is a full-stack application built with React 18 (TypeScript) and Vite for the frontend, utilizing Radix UI, Tailwind CSS, TanStack React Query, TipTap, and Motion library. The backend is an Express.js (Node.js) server with PostgreSQL (Neon Serverless) and Drizzle ORM. Authentication is handled via Replit Auth (OAuth) with `connect-pg-simple` for session management.

**UI/UX Decisions:**
The design system is inspired by Stripe, featuring a premium UI with a focus on generous spacing, defined typography, and consistent component patterns (e.g., `rounded-2xl` cards, distinct button styles, gradient section dividers). Animations are implemented using the Motion library for page transitions, staggered elements, and hover effects. View states and full URL paths are persisted to `localStorage` to remember user preferences and exact navigation points across sessions, with URL restoration guarded by authentication status.

**Technical Implementations & Feature Specifications:**
-   **Hierarchical Data Organization**: Spaces > Workspaces > Insights/Chats/Sheets, with all data scoped to Workspaces.
-   **Insight Workspace**: A unified three-panel interface (Chat, Canvas, Data) with resizing, drag-and-drop reordering, and persistence of panel layouts.
-   **AI Integration**: Hybrid AI architecture leveraging Gemini 2.5 Pro/Flash for analysis and chat, and Google text-embedding-004 (768 dimensions) with `pgvector` for semantic search.
-   **Data Ingestion**: Supports direct upload of Excel/CSV files via a backend endpoint, including robust file validation, background processing for cleaning and embedding, and a maximum file size of 10MB.
-   **World-Class ETL Pipeline**: A durable, 7-stage Extract-Transform-Load pipeline (PARSING → VALIDATING → TEMPLATE_MATCHING → CLEANING → QUALITY_SCORING → EMBEDDING → FINALIZING) with idempotent stages, structured error handling, automatic retry mechanisms, and observability logging.
-   **AI Data Cleaning & Structure Detection**: AI-powered cleaning that preserves data structure, automatically detects and extracts standalone notes, and processes large datasets efficiently.
-   **Intelligent Template System**: Auto-detects and applies templates based on column similarity, aliases, and source fingerprints. Features a full-screen template editor for schema definition, cleaning pipeline configuration, and AI-suggested column mappings.
-   **Data Editing Capabilities**: Excel/Google Sheets-like data grid with multi-cell selection, cell-based formatting, in-place editing, arrow key/tab/enter navigation, undo/redo, column resizing, and JSON editing. Includes optimistic updates and unsaved changes protection.
-   **Pre-Upload Validation**: Validates Google Sheets accessibility, file types (CSV, Excel, images, PDF) and size, and URL formats before capture.
-   **Security**: `requireSpaceOwner` and `requireEntityOwner` middlewares, configurable PII filtering, and a two-tier encryption system offering server-side AES-256-GCM or end-to-end encryption (E2EE) with client-side Web Crypto API, PBKDF2, and TOTP 2FA.
-   **Chrome Extension**: A Manifest V3 React-based extension for capturing web content and integrating with the backend.

## External Dependencies
-   **Database**: PostgreSQL (Neon Serverless)
-   **ORM**: Drizzle ORM
-   **Authentication**: Replit Auth (Google, GitHub, X, Apple, email OAuth)
-   **Session Management**: `connect-pg-simple`
-   **AI Services**:
    -   Gemini 2.5 Pro/Flash (via Replit AI Integrations)
    -   Google text-embedding-004 (via Gemini API)
-   **Frontend Libraries**: React, Radix UI, Tailwind CSS, TanStack React Query, TipTap, Motion library