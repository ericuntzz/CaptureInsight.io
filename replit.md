# CaptureInsight - Full Stack Application

## Overview
CaptureInsight is a screenshot-based analytics platform for marketing managers. It provides tools for capturing, organizing, and analyzing data from various sources using AI. The platform aims to deliver comprehensive insights through a complete backend infrastructure.

## User Preferences
- I want iterative development.
- Ask before making major changes.
- I prefer detailed explanations.
- Do not make changes to the folder `Z`.
- Do not make changes to the file `Y`.

### UX Approach: View State Persistence
- **Default to the most useful view**: When a user first views a feature, default to the most valuable/actionable view (e.g., "Data" view instead of "Files" view for data sources).
- **Remember user preferences**: Always persist the user's last selected view/state to localStorage so it remains when they refresh or return later.
- **Pattern**: Use localStorage with a descriptive key (e.g., `captureinsight_<feature>_<setting>`) and initialize state with a function that checks localStorage first, falling back to the default.
- **Full URL Persistence**: The complete URL path is saved to localStorage (`captureinsight_current_url`) so users return to the exact page they were on after a browser refresh. This includes the current view, any deep link parameters, and query strings.
- **Auth-Guarded URL Restoration**: The initial URL restore effect is guarded by `authLoading` to prevent race conditions during authentication. URL persistence is guarded by `hasRestoredUrl` to prevent overwriting saved URLs during initial load. The view sync effect runs unguarded to allow normal navigation.
- **Navigation Pattern**: All view changes must use `handleViewChange()` instead of `setCurrentView()` directly. This ensures both the state AND the URL are updated together, preventing the sync effect from resetting the view.

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
A hybrid AI architecture leverages Gemini 2.5 Pro/Flash (via Replit AI Integrations) for screenshot/data analysis and chat. Google text-embedding-004 (768 dimensions, via Gemini API) is used for text embeddings with `pgvector` for semantic search.

**Excel/CSV File Upload:**
Direct file upload support for Excel (.xlsx, .xls) and CSV files:
-   **Backend Endpoint**: `POST /api/spaces/:spaceId/sheets/upload` accepts base64-encoded file data
-   **File Validation**: Validates file contents (not just extension/MIME) to prevent spoofed files - detects HTML/JSON disguised as CSV
-   **Size Limit**: 10MB maximum file size
-   **Full Pipeline Integration**: Upload → Parse → Clean (AI) → Embed (vectorize for RAG)
-   **Background Processing**: Cleaning and embedding run asynchronously after sheet creation
-   **Key Files**: `server/ai/dataIngestion.ts` (parseUploadedFile, parseExcel), `server/routes.ts`

**AI Canvas Editing (ChatGPT Canvas-like):**
The Insight Workspace features AI-powered canvas editing similar to ChatGPT's Canvas mode:
-   **Quick Action Buttons**: 7 AI-powered editing buttons in the canvas panel header:
    -   Polish, Shorten, Expand, Simplify, Professional, Grammar, Summarize
-   **Edit Proposals**: AI returns structured edit proposals with preview, rationale, and Apply/Dismiss actions
-   **Highlight-to-Refine**: Select text in the canvas and a BubbleMenu appears with "Refine" button to improve just that selection
-   **Selection Persistence**: Selection coordinates are captured with the AI request and survive the async cycle
-   **Security Features**:
    -   PII filtering applied to canvas content (title, notes, selection) before sending to AI
    -   JSON parsing validation to reject malformed AI responses
    -   HTML sanitization before inserting AI suggestions into the editor
    -   Validation to reject explanatory text patterns in edit proposals
-   **Types**: Defined in `shared/types/canvasAI.ts` (CanvasContext, AIEditProposal, AICanvasResponse, CanvasQuickAction)

**Data Ingestion Pipeline:**
Supports Google Sheets import, parsing CSV data, generating text embeddings for RAG, and background processing for asynchronous ingestion.

**AI Data Cleaning & Structure Detection:**
Intelligent AI-powered cleaning that preserves data structure while extracting notes:
-   **Column Order Preservation**: Keeps identifier/label columns (metric names) on the left, matching the source document structure
-   **Notes Detection**: Automatically detects and extracts standalone notes from data:
    -   Rows starting with `*` or `**` (e.g., "*JZ NOTE - look at decline...")
    -   Rows containing "NOTE:" or "NOTE -" patterns
    -   Parenthetical annotations alone in a cell (e.g., "(from tableau waterfall)")
    -   Rows with only text and no numeric data
-   **Inline Notes**: Notes attached to data rows (like "**1M CCC -- explanation") are preserved in a notes column
-   **Standalone Notes Extraction**: Pure comment rows are moved to a separate notes array, not mixed with data
-   **Large Dataset Handling**: Special processing for datasets >100 rows to detect and filter standalone notes
-   **Key Functions**: `isStandaloneNoteRow()`, `extractNoteFromCell()` in `server/ai/dataCleaning.ts`

**Intelligent Template System:**
A comprehensive template system for automated data cleaning and structuring:
-   **Template Matching**: Auto-detects when uploaded data matches a saved template using:
    -   Column name similarity (exact, case-insensitive, fuzzy matching)
    -   Column aliases (user-defined + 25 pre-built marketing aliases)
    -   Source fingerprinting (Google Sheet ID, URL patterns)
    -   Confidence thresholds (≥85% auto-apply, 60-85% suggest, <60% ignore)
-   **Template Editor**: Full-screen editor with:
    -   Column schema definition (name, type, validation rules)
    -   Cleaning pipeline configuration (remove commas, strip currency, convert %, dates, etc.)
    -   AI-suggested column mappings with confirm/reject UI
    -   Preview before save (side-by-side original vs cleaned data)
    -   Column aliases management per column
-   **Template Management**: Settings page to list, edit, delete templates with search/filter
-   **Manual Template Selection**: Card-based picker when auto-match fails
-   **Source-Aware Cleaning**: Different AI prompts for Google Sheets, CSV, Google Ads, Meta Ads, GA4
-   **Column Type Heuristics**: Pre-detect dates, currencies, percentages before AI cleaning
-   **Processing Progress UI**: Blurred data preview with step-by-step progress overlay during processing
-   **Database Tables**: `data_templates`, `template_applications`, `system_column_aliases`
-   **Key Files**: `server/ai/templateService.ts`, `server/ai/columnMapping.ts`, `server/ai/templatePreview.ts`, `src/components/TemplateEditor.tsx`

**Data Quality Scoring & Validation:**
Includes a pre-validation layer with a quality score (Confidence, Completeness, Data Richness), failure type classification, user data correction via JSON and inline table editing, and a retry mechanism.

**Pre-Upload Validation System:**
Validates data sources before capturing to prevent upload failures:
-   **Google Sheets Validation**: Checks if Google Sheets are publicly accessible before capture. Server-side endpoint (`/api/validate-google-sheet`) attempts to fetch the sheet's CSV export to verify public access.
-   **File Validation**: Validates file type (CSV, Excel, PNG, JPEG, GIF, WebP, PDF) and size (max 50MB) when files are uploaded.
-   **URL Validation**: Basic URL format validation for links.
-   **Validation Indicators**: Each captured item displays a status indicator (green = valid, yellow = warning, red = error) in the CaptureAssignmentPanel.
-   **Tooltips**: Hover over indicators to see the issue and recommended solution.
-   **Capture Data Button Warning**: Shows warning badge when items have validation issues.
-   **Confirmation Dialog**: When proceeding with validation warnings, a dialog explains the issues and allows users to proceed anyway or go back to fix.
-   **Key Files**: `src/lib/captureValidation.ts`, `server/routes.ts` (validation endpoint), `src/components/CaptureAssignmentPanel.tsx`, `src/components/FloatingCaptureToolbar.tsx`

**Data Editing Capabilities (Excel/Google Sheets-like):**
-   **Multi-Cell Selection**: Select multiple cells for batch operations:
    -   Click: Select single cell
    -   Shift+Click: Select range from last clicked cell to current cell
    -   Ctrl/Cmd+Click: Toggle individual cells in/out of selection
-   **Cell-Based Formatting**: Formatting (currency, percent, number, decimals) applies only to selected cells, not entire columns
-   **Selection Anchor**: System tracks the "anchor" cell for consistent keyboard navigation after multi-selection
-   **Type-to-Edit**: Start typing immediately to replace cell content (no double-click needed).
-   **Arrow Key Navigation**: Use arrow keys to move between cells when a cell is selected.
-   **Edit Mode (F2/Enter)**: Press F2 or Enter to edit existing content without replacing it.
-   **Tab Navigation**: Tab moves right, Shift+Tab moves left, wrapping to next/previous row.
-   **Enter Navigation**: Enter moves down, Shift+Enter moves up after editing.
-   **Delete/Backspace**: Clears all selected cells content.
-   **Escape**: Cancel editing or deselect all cells.
-   **Undo/Redo**: Ctrl+Z to undo, Ctrl+Y or Ctrl+Shift+Z to redo. Unlimited undo history per session.
-   **Undo/Redo Buttons**: Visible arrow buttons appear next to "Edit Data" when changes are made.
-   **Column Resizing**: Drag column header edges to resize columns (60px-500px range).
-   **Stable Cell Size**: Cells maintain consistent height during editing (no size jumps).
-   **Sticky Header**: Column headers stay visible with solid background when scrolling.
-   **JSON Editing**: Full JSON editor for advanced data modifications.
-   **Visual Indicators**: Row numbers, zebra striping, and subtle highlight on selected cells for easy navigation.
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