# CaptureInsight - Full Stack Application

## Overview
CaptureInsight is a screenshot-based analytics platform for marketing managers. It provides tools for capturing, organizing, and analyzing data from various sources using AI. The platform aims to deliver comprehensive insights through a complete backend infrastructure.

## User Preferences
- I want iterative development.
- Ask before making major changes.
- I prefer detailed explanations.
- Do not make changes to the folder `Z`.
- Do not make changes to the file `Y`.

## System Architecture
CaptureInsight is a full-stack application. The frontend uses React 18 (TypeScript) with Vite, Radix UI, Tailwind CSS, TanStack React Query, TipTap, and Motion library. The backend is an Express.js (Node.js) server with PostgreSQL (Neon Serverless) and Drizzle ORM. Authentication is handled via Replit Auth (OAuth), and sessions use `connect-pg-simple`.

**Key Features:**
-   **Hierarchical Data Organization**: Spaces > Workspaces > Insights/Chats/Sheets, with all data scoped to Workspaces.
-   **New User Onboarding**: Streamlined flow with automatic workspace creation upon data upload.
-   **Space-scoped Tagging System**: For robust organization and association.
-   **Insights Management**: Knowledge cards with status, priority, linked sources, and threaded comments.
-   **AI Chat Integration**: Per-insight AI conversations with RAG capabilities.
-   **Insight Workspace**: A unified three-panel interface (Chat, Canvas, Data) with advanced resizing and drag-and-drop reordering, persistence for panel sizes and order, and smooth collapse/expand animations.
-   **Activity Tracking**: Logs for user actions.
-   **Screenshot Capture**: Chrome extension for web content capture, file uploads, and link captures.
-   **Multi-Tenant Data Isolation**: Ensures data privacy through space and entity-level authorization.
-   **AI Consent & PII Filtering**: Configurable PII scrubbing and explicit AI feature consent per space.

**AI Integration:**
A hybrid AI architecture leverages Gemini 2.5 Pro/Flash (via Replit AI Integrations) for screenshot/data analysis and chat. OpenAI (text-embedding-3-small) is used for text embeddings with `pgvector` for semantic search.

**Data Ingestion Pipeline:**
Supports Google Sheets import, parsing CSV data, generating text embeddings for RAG, and background processing for asynchronous ingestion.

**Data Quality Scoring & Validation:**
Includes a pre-validation layer with a quality score (Confidence, Completeness, Data Richness), failure type classification, user data correction via JSON and inline table editing, and a retry mechanism.

**Data Editing Capabilities (Excel/Google Sheets-like):**
-   **Single-Click Selection**: Click any cell to select it (subtle border-only highlight, no background fill).
-   **Type-to-Edit**: Start typing immediately to replace cell content (no double-click needed).
-   **Arrow Key Navigation**: Use arrow keys to move between cells when a cell is selected.
-   **Edit Mode (F2/Enter)**: Press F2 or Enter to edit existing content without replacing it.
-   **Tab Navigation**: Tab moves right, Shift+Tab moves left, wrapping to next/previous row.
-   **Enter Navigation**: Enter moves down, Shift+Enter moves up after editing.
-   **Delete/Backspace**: Clears the selected cell content.
-   **Escape**: Cancel editing or deselect cell.
-   **Undo/Redo**: Ctrl+Z to undo, Ctrl+Y or Ctrl+Shift+Z to redo. Unlimited undo history per session.
-   **Undo/Redo Buttons**: Visible arrow buttons appear next to "Edit Data" when changes are made.
-   **Column Resizing**: Drag column header edges to resize columns (60px-500px range).
-   **Stable Cell Size**: Cells maintain consistent height during editing (no size jumps).
-   **Sticky Header**: Column headers stay visible with solid background when scrolling.
-   **JSON Editing**: Full JSON editor for advanced data modifications.
-   **Visual Indicators**: Row numbers and zebra striping for easy navigation.
-   **Unsaved Changes Protection**: Confirmation dialog when switching data sources with pending edits.
-   **Add/Delete Rows**: Row management with hover-revealed delete buttons and "Add Row" functionality.
-   **Optimistic Updates**: Changes are immediately visible with automatic rollback on errors.

**Chrome Extension:**
Manifest V3 React-based extension for capturing content, integrating with the backend for saving captures, and AI analysis.

**Security:**
-   `requireSpaceOwner` and `requireEntityOwner` middlewares for access control.
-   Configurable PII filtering module (`server/ai/piiFilter.ts`) with 14 pattern types, enabled/disabled per space.
-   **Two-Tier Encryption System**:
    -   **Simple Protection (securityMode: 0)**: Server-side AES-256-GCM encryption with per-user keys.
    -   **Maximum Security (securityMode: 1)**: End-to-end encryption (E2EE) with zero-knowledge architecture, client-side encryption using Web Crypto API, PBKDF2 for key derivation, TOTP 2FA, and backup codes.
-   **Login 2FA**: Optional TOTP-based two-factor authentication for login, independent of encryption security mode.

**Design System (Stripe-Inspired Premium UI):**
-   **Brand Colors**: Primary Orange (`#FF6B35`), Dark Background (`#0A0D12`), Card Background (`#1A1F2E`).
-   **Spacing**: Generous page padding, section spacing, and card padding for visual breathing room.
-   **Typography**: Defined styles for titles, labels, and body text using specific font weights and sizes.
-   **Component Patterns**:
    -   **Cards**: `rounded-2xl` with subtle borders, hover effects, and `whileHover` animations using Motion library.
    -   **Icon Containers**: Large, rounded, subtle gradient backgrounds.
    -   **Buttons**: Primary, secondary, and destructive styles with distinct gradients and shadows.
    -   **Badges/Tags**: Varied styles for status, recommendations, and features.
    -   **Section Dividers**: Gradient lines.
-   **Animations (Motion Library)**: Page entry, staggered elements, content slide, hover lift effects.
-   **Loading States**: Spinner with accent color, pulse effect, and loading text.

## External Dependencies
-   **Database**: PostgreSQL (Neon Serverless)
-   **ORM**: Drizzle ORM
-   **Authentication**: Replit Auth (Google, GitHub, X, Apple, email OAuth)
-   **Session Management**: `connect-pg-simple`
-   **AI Services**:
    -   Gemini 2.5 Pro/Flash (via Replit AI Integrations)
    -   OpenAI API (for text embeddings)
-   **Frontend Libraries**: React, Radix UI, Tailwind CSS, TanStack React Query, TipTap, Motion library