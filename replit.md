# CaptureInsight - Full Stack Application

## Overview
CaptureInsight is a screenshot-based analytics platform designed for marketing managers. It facilitates the capture, organization, and AI-powered analysis of data from various sources. The platform is a full-stack application with a complete backend infrastructure, aiming to provide comprehensive data insights.

## User Preferences
- **Data Privacy Priority**: Security is critical when using LLMs
- **UI Preservation**: Maintain original UI design, do not rebuild from scratch
- **Design Pattern**: Canvas inputs use local state + blur/debounce sync to prevent cursor jumping

## System Architecture
CaptureInsight employs a modern full-stack architecture. The frontend is built with **React 18** and **TypeScript**, utilizing **Vite**, **Radix UI** for components, **Tailwind CSS** for styling, **TanStack React Query** for data fetching, and **TipTap** for rich text editing. The backend is an **Express.js** server on **Node.js**, with **PostgreSQL** (Neon Serverless) as the database, managed by **Drizzle ORM**. Authentication is handled via **Replit Auth** (supporting Google, GitHub, X, Apple, and email), with session management using `connect-pg-simple`.

The application's core data model revolves around 14 tables, including `users`, `spaces`, `folders`, `sheets`, `tags`, `insights`, `chat_threads`, and `change_logs`, facilitating a hierarchical organization of data and activity tracking.

**Key Features:**
- User authentication with multiple OAuth providers.
- Hierarchical workspace organization (Space → Folder → Sheet).
- Space-scoped tag system with associations.
- Insights management with sources and threaded comments.
- AI chat integration per insight.
- Activity tracking and change logs.
- Screen capture simulation.
- Multi-tenant data isolation with space and entity-level authorization.
- PII filtering for AI inputs, configurable per space.
- AI consent tracking with granular controls for AI features and PII scrubbing.
- Chrome Extension for direct webpage screenshot capture, including a floating toolbar, destination/tag pickers, and configurable AI analysis. The extension uses Manifest V3 and cookie-based authentication.
- Blur Editor component in the Chrome extension for client-side pixelation blur on captured screenshots, enhancing privacy.

**AI Architecture:**
A hybrid AI approach leverages **Gemini 2.5 Pro/Flash** (via Replit AI Integrations) for screenshot analysis, data analysis, and chat conversations. **OpenAI** (requiring an API key) is used for text embeddings (text-embedding-3-small, 1536 dimensions) to enable semantic search. **pgvector** is integrated for efficient similarity search with 1536-dimension vectors and IVFFlat index.

**UI/UX Decisions:**
- Uses Radix UI for accessible and customizable UI components.
- Tailwind CSS for utility-first styling.
- Integrates a rich text editor (TipTap) for content creation.
- Motion library for animations, enhancing user experience.

## External Dependencies
- **PostgreSQL (Neon Serverless)**: Primary database.
- **Replit Auth**: OAuth provider for user authentication (Google, GitHub, X, Apple, email).
- **Gemini 2.5 Pro/Flash**: AI model for screenshot analysis, data analysis, and chat (via Replit AI Integrations).
- **OpenAI**: AI service for generating text embeddings for semantic search.
- **Vite**: Frontend build tool.
- **Radix UI**: UI component library.
- **Tailwind CSS**: CSS framework.
- **TanStack React Query**: Data fetching and state management.
- **TipTap**: Rich text editor.
- **Motion**: Animation library.
- **connect-pg-simple**: PostgreSQL session store for Express.js.