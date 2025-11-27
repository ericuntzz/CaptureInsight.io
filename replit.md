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
- **Hierarchical Workspace Organization**: Spaces > Folders > Sheets.
- **Space-scoped Tagging System**: With associations for organization.
- **Insights Management**: Knowledge cards with status/priority, linked sources, and threaded comments.
- **AI Chat Integration**: Per insight AI conversations for analysis and RAG-enabled chat.
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