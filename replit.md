# CaptureInsight - Full Stack Application

## Overview
CaptureInsight is a screenshot-based analytics platform designed for marketing managers. It facilitates the capture, organization, and AI-powered analysis of data from various sources. The platform offers a complete backend infrastructure and aims to provide comprehensive insights to users.

## User Preferences
- I want iterative development.
- Ask before making major changes.
- I prefer detailed explanations.
- Do not make changes to the folder `Z`.
- Do not make changes to the file `Y`.

## System Architecture
CaptureInsight is a full-stack application with a React 18 (TypeScript) frontend using Vite, Radix UI, Tailwind CSS, TanStack React Query, TipTap, and Motion library. The backend is an Express.js (Node.js) server utilizing PostgreSQL (Neon Serverless) with Drizzle ORM. Authentication is handled via Replit Auth (OAuth), and sessions are managed with `connect-pg-simple`.

The application's core features include:
- **Hierarchical Organization**: Spaces > Workspaces > Insights/Chats/Sheets. Each Workspace serves as a self-contained container with all data scoped to it. Users can create and switch between multiple Workspaces within a Space.
- **Space-scoped Tagging System**: With associations for organization.
- **Insights Management**: Knowledge cards with status/priority, linked sources, and threaded comments.
- **AI Chat Integration**: Per insight AI conversations for analysis and RAG-enabled chat.
- **Insight Workspace**: Unified interface combining data viewing, AI chat, and canvas editing. Features a three-panel horizontal layout with advanced resizing behavior.

### Insight Workspace Panel Architecture (`src/pages/InsightWorkspace.tsx`)

**Panel Layout**: Chat (left, fixed) | Canvas/Data (center/right, swappable via drag)

**Key Implementation Details**:
- Uses `react-resizable-panels` library with `ResizablePanelGroup`, `ResizablePanel`, and `ResizableHandle`
- Uses `@dnd-kit/core` and `@dnd-kit/sortable` for drag-and-drop panel reordering
- Panels have unique IDs (`chat-panel`, `canvas-panel`, `data-panel`) for tracking
- Uses `autoSaveId="insight-workspace-panels-{order}"` for localStorage size persistence per layout
- Panel order controlled via conditional rendering based on `rightPanelOrder` state

**Drag-and-Drop Panel Reordering**:
- Chat panel is fixed on the left (not draggable)
- Canvas and Data panels can be dragged to swap positions
- `rightPanelOrder` state: 'canvas-data' (default) or 'data-canvas' (swapped)
- Order persisted to localStorage key `workspace-right-panel-order`
- `DraggableCollapsedPanel` component (defined outside main component for hooks compliance) enables collapsed panels to be dragged
- `CollapsedChatPanel` is a non-draggable button component for the chat panel
- Uses conditional rendering to swap panel DOM order (avoids ResizableHandle ordering issues)

**Smooth Collapse/Expand with Continuous Opacity**:
- Tracks live panel sizes via `onResize` callbacks: `chatSize`, `canvasSize`, `dataSize`
- Content opacity calculated continuously between 4-10% panel width (not binary threshold)
- Both collapsed icon and expanded content always rendered with absolute positioning
- Uses `getContentOpacity(size)` and `getCollapsedOpacity(size)` helper functions
- Collapsed threshold: panel size < 8%
- `PanelContentWrapper` component manages opacity and pointer-events based on live size

**Panel Swapping Behavior**:
- Expand button or double-click: swaps panel to center, bumps other panel to right
- Double-click toggle: first click expands, second click restores normal sizes

**Chat Panel Respects User Intent**:
- `chatManuallyCollapsed` state tracks if user explicitly closed Chat
- When expanding Canvas/Data, Chat stays closed if user previously collapsed it
- Only re-expands when user clicks Chat expand button

**Drag Handles (ResizableHandle)**:
- Thin subtle design: 1px visible width, 6px hit area (`w-1.5`)
- Orange hover effect: `group-hover:bg-[#FF6B35]/60`
- Double-click on center-right handle triggers expand/toggle based on current `rightPanelOrder`

**Canvas Auto-Save & Persistence**:
- Title and content (notes) are synced to tab state in real-time as user types
- Debounced auto-save (1 second delay) persists changes to database
- Uses `useCreateInsight` mutation for new insights, `useUpdateInsight` for existing
- `InsightTab` interface tracks: `id`, `title`, `summary`, `isSaved`, `dbId`
- `lastSavedContentRef` tracks last saved content to detect actual changes
- Tab switching preserves content by loading from tab state
- Existing insights loaded from DB are automatically marked as saved with their `dbId`
- **Activity Tracking**: Change logs for user actions.
- **Screenshot Capture**: Chrome extension for direct webpage capture, supporting tab screenshots, file uploads, and link captures.
- **Multi-Tenant Data Isolation**: Space and entity-level authorization ensures data privacy.
- **AI Consent & PII Filtering**: Configurable PII scrubbing for AI interactions and explicit AI feature consent per space.

**AI Integration**:
A hybrid AI architecture uses Gemini 2.5 Pro/Flash (via Replit AI Integrations) for screenshot and data analysis, and chat conversations. OpenAI (requires API key) is used for text embeddings (text-embedding-3-small, 1536 dimensions) to enable semantic search via `pgvector` with IVFFlat index.

**Chrome Extension**:
The Chrome extension, built with Manifest V3 and React in a shadow DOM, provides a floating toolbar for capturing content. It integrates with the backend for saving captures, selecting spaces and tags, and performing AI analysis with configurable LLM models.

**Security**:
- `requireSpaceOwner` and `requireEntityOwner` middlewares enforce access control based on user ownership for all space-scoped and entity-level operations.
- PII filtering module (`server/ai/piiFilter.ts`) with 14 pattern types can be enabled/disabled and configured per space.
- AI consent settings are stored in the `spaces` table (`aiSettings` JSONB field) to control `enableAI`, `piiFiltering`, and `allowedPatterns`.

**Two-Tier Encryption System**:
- **Simple Protection (securityMode: 0)**: Server-side encryption using AES-256-GCM. Data is automatically encrypted/decrypted by the server. Per-user keys are stored encrypted with a master key. Provides protection against external attacks while allowing account recovery.
- **Maximum Security (securityMode: 1)**: End-to-end encryption (E2EE) with zero-knowledge architecture. Requires password + TOTP 2FA + 8 backup codes. Data is encrypted client-side using Web Crypto API. Server stores only encrypted blobs and cannot access user data.
- Key derivation uses PBKDF2 with 100,000 iterations for password-based key generation.
- TOTP uses SHA1/6-digit/30-second standard (OTPAuth library).
- Backup codes are SHA-256 hashed, one-time use, stored with used codes tracked.
- Session-based DEK (Data Encryption Key) management clears keys on browser close.
- Important: Set `ENCRYPTION_MASTER_KEY` environment variable for production (auto-generates in dev).

**Login 2FA** (separate from encryption):
- Optional TOTP-based two-factor authentication for all users during login.
- Managed independently from encryption security mode.
- Available at `/settings/security`.

## External Dependencies
- **Database**: PostgreSQL (Neon Serverless)
- **ORM**: Drizzle ORM
- **Authentication**: Replit Auth (Google, GitHub, X, Apple, email OAuth)
- **Session Management**: `connect-pg-simple`
- **AI Services**:
    - Gemini 2.5 Pro/Flash (via Replit AI Integrations)
    - OpenAI API (for text embeddings)
- **Frontend Libraries**: React, Radix UI, Tailwind CSS, TanStack React Query, TipTap, Motion library

## Design System (Stripe-Inspired Premium UI)

### Brand Colors
- **Primary Orange**: `#FF6B35` (main accent)
- **Secondary Orange**: `#E55A2B` (hover states, gradients)
- **Dark Orange**: `#D04A1B` (pressed states)
- **Background Dark**: `#0A0D12` (page backgrounds)
- **Card Background**: `#1A1F2E` (cards, containers)
- **Card Background Alt**: `#161A24` (gradient endpoints)
- **Border Color**: `#2A2F3E` (subtle borders)
- **Border Hover**: `#3A3F4E` (interactive borders)

### Spacing Guidelines
- **Page Padding**: `py-16 px-8 lg:px-16` (generous breathing room)
- **Section Spacing**: `space-y-16` (large gaps between sections)
- **Card Padding**: `p-8` (comfortable internal spacing)
- **Card Gap**: `gap-8` (space between cards in grids)
- **Header to Content**: `mb-16` (page header to first section)
- **Section Header to Content**: `mb-8` (section title to cards)
- **Back Button Margin**: `mb-12` (back button to page header)
- **Title to Description**: `mb-2` to `mb-3` (tight coupling)
- **Description to Content**: `mb-6` to `mb-8` (clear separation)
- **Feature Tags to Button**: `mb-8` (adequate button spacing)

### Typography
- **Page Title**: `text-3xl font-bold tracking-tight`
- **Card Title**: `text-xl font-semibold tracking-tight`
- **Section Label**: `text-xs font-semibold uppercase tracking-[0.2em] text-gray-500`
- **Body Text**: `text-base leading-relaxed text-gray-400`
- **Card Description**: `text-sm leading-relaxed text-gray-400`
- **Button Text**: `font-medium`
- **Badge Text**: `text-xs font-semibold`

### Component Patterns

#### Cards
- **Border Radius**: `rounded-2xl`
- **Default State**: `bg-[#1A1F2E]/60 border border-[#2A2F3E]`
- **Hover State**: `hover:bg-[#1A1F2E] hover:border-[#FF6B35]/30 hover:shadow-xl hover:shadow-[#FF6B35]/5`
- **Active/Selected**: `ring-2 ring-[#FF6B35] shadow-xl shadow-[#FF6B35]/10`
- **Gradient Background**: `bg-gradient-to-br from-[#1A1F2E] to-[#161A24]`
- **Hover Animation**: `whileHover={{ y: -3 }}` with Motion library

#### Icon Containers
- **Size**: `w-14 h-14` (large) or `w-12 h-12` (medium)
- **Border Radius**: `rounded-xl`
- **Background**: `bg-gradient-to-br from-[#FF6B35]/20 to-[#FF6B35]/5`
- **Border**: `border border-[#FF6B35]/10`

#### Buttons
- **Primary**: `bg-gradient-to-r from-[#FF6B35] to-[#E55A2B] hover:from-[#E55A2B] hover:to-[#D04A1B] shadow-lg shadow-[#FF6B35]/25`
- **Secondary/Outline**: `border-[#3A3F4E] hover:border-[#FF6B35]/50 hover:bg-[#FF6B35]/5`
- **Destructive**: `border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50`
- **Height**: `h-11` or `h-12` for prominence
- **Transition**: `transition-all duration-200`

#### Badges/Tags
- **Status Active**: `bg-[#FF6B35]/15 text-[#FF6B35]` with icon
- **Status Success**: `bg-emerald-500/15 text-emerald-400`
- **Recommended**: `bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400`
- **Feature Tag**: `px-3 py-1.5 rounded-lg bg-[#2A2F3E]/80 text-xs text-gray-300 font-medium`
- **Padding**: `px-3 py-1.5` or `px-3.5 py-1.5`
- **Border Radius**: `rounded-full` for status, `rounded-lg` for features

#### Section Dividers
- **Gradient Line**: `h-px bg-gradient-to-r from-transparent via-[#2A2F3E] to-transparent`

### Animations (Motion Library)
- **Page Enter**: `initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}`
- **Stagger Elements**: Use `delay: 0.1`, `delay: 0.15`, `delay: 0.2`, etc.
- **Content Slide**: `initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}`
- **Back Button**: `initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}`
- **Hover Lift**: `whileHover={{ y: -3 }} transition={{ duration: 0.2 }}`
- **Icon Hover**: `group-hover:-translate-x-1 transition-transform duration-200`

### Loading States
- **Spinner**: Use Loader2 icon with `animate-spin`
- **Accent Color**: `text-[#FF6B35]`
- **Pulse Effect**: `animate-ping` on accent element behind main loader
- **Loading Text**: `text-gray-400 text-sm font-medium`