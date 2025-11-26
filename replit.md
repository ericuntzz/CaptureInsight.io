# CaptureInsight Demo - Project Documentation

## Overview
CaptureInsight is a screen capture and insights management application built with React, TypeScript, and Vite. This demo allows users to capture areas from their screen, manage insights, organize with tags, and collaborate with teams.

## Project Structure
- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite 6.3.5
- **UI Components**: Radix UI with custom components
- **Styling**: Tailwind CSS (via globals.css)
- **Rich Text**: TipTap editor
- **Animation**: Motion library

## Key Features
- Screen capture simulation with region selection
- Insights management with canvas view
- Tag-based organization system
- Team collaboration features
- Project and space management
- Data sheets and change logs
- AI assistant integration

## Development Setup

### Running the Application
The development server is configured to run on port 5000:
```bash
npm run dev
```

The application will be available at `http://localhost:5000/`

### Building for Production
```bash
npm run build
```

Build output is stored in the `build/` directory.

## Replit Configuration

### Workflow
- **Development Server**: Runs `npm run dev` on port 5000
- **Host**: Configured to bind to `0.0.0.0` for Replit proxy compatibility
- **HMR**: WebSocket hot module replacement configured for Replit environment

### Deployment
The project is configured for Replit autoscale deployment:
- Build command: `npm run build`
- Run command: `npx vite preview --host 0.0.0.0 --port 5000`

## Project Components

### Main Views
- **InsightsView**: Main insights management interface with row/kanban layouts
- **CanvasInsightView**: Detailed canvas view for individual insights
- **DataManagementView**: Manage data sheets and exports
- **ChangeLogsView**: Track project changes
- **TagManagementView**: Organize and manage tags

### Core Features
- **Screen Capture**: Simulated capture area with region selection
- **Tag System**: Space-scoped tag management with cascade delete
- **Projects & Spaces**: Hierarchical organization
- **Team Collaboration**: Team member management and assignments
- **AI Assistant**: Integrated AI panel for insights

## File Structure
```
src/
├── api/          # API integration (insights, tags)
├── components/   # React components
│   ├── ui/      # Reusable UI components (buttons, dialogs, etc.)
│   └── ...      # Feature components
├── data/        # Mock data and type definitions
├── hooks/       # Custom React hooks
├── styles/      # Global styles
├── types/       # TypeScript type definitions
└── utils/       # Utility functions
```

## Recent Changes (November 26, 2025)

### Initial Replit Setup
- Created TypeScript configuration files (tsconfig.json, tsconfig.node.json)
- Configured Vite for Replit environment:
  - Port 5000 binding
  - Host set to 0.0.0.0
  - HMR WebSocket configuration
- Fixed file extension: Renamed `useRouter.ts` to `useRouter.tsx` (contains JSX)
- Fixed import path: Updated InsightsView.tsx to import from `../utils/tagUtils` instead of `./shared/tagManagement`
- Added .gitignore for Node.js projects
- Configured deployment for Replit autoscale

### Dependencies Installed
All npm dependencies installed successfully (238 packages)

## Notes
- The application uses mock data for demonstration purposes
- Screen capture is simulated (not actual screen capture in browser)
- Router is custom lightweight implementation (can be replaced with React Router)
- Tags are space-scoped for proper isolation between workspaces
