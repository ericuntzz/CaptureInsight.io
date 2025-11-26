# Project → Space Refactoring Summary

## ✅ Completed: User-Facing Text Updates

All user-visible labels, buttons, and toast messages have been updated from "Project/Projects" to "Space/Spaces":

### Files Updated:
1. **ProjectBrowser.tsx** - Main sidebar component
   - "New Project" → "New Space"
   - "Projects" (header) → "Spaces"
   - "Projects" (tooltip) → "Spaces"
   - "Project Settings" → "Space Settings"

2. **CreateProjectDialog.tsx** - Creation dialog
   - "Create New Project" → "Create New Space"
   - "Project Name" → "Space Name"
   - "Project Goals" → "Space Goals"
   - "Create Project" → "Create Space"
   - All toast messages updated
   - All placeholder text updated

3. **ProjectSettingsDialog.tsx** - Settings dialog
   - "Project Settings" → "Space Settings"
   - "Project Name" → "Space Name"  
   - "Project Goals" → "Space Goals"
   - "Delete Project" → "Delete Space"
   - All toast messages updated
   - All placeholder text updated

4. **App.tsx** - Main application file
   - Updated all toast messages:
     - `Space "${name}" created!`
     - `Space "${name}" updated!`
     - `Space deleted!`
     - `Space renamed to "${newName}"!`
   - Updated localStorage key: `captureinsight_spaces`
   - Updated variable names: `initialSpaces`, `spaces`, etc.
   - Added comprehensive Replit AI refactoring note

5. **LLMExportDialog.tsx** - Export dialog
   - Updated to accept both `space` and `project` props for backwards compatibility

## 🤖 Replit AI Refactoring Notes Added

Each component now has a detailed header comment explaining what needs to be refactored:

### Components with Refactoring Notes:
- `/components/ProjectBrowser.tsx`
- `/components/CreateProjectDialog.tsx`
- `/components/ProjectSettingsDialog.tsx`
- `/App.tsx`

### What the Notes Cover:
1. **Interfaces to rename** (e.g., `Project` → `Space`)
2. **Parameters to rename** (e.g., `projectId` → `spaceId`)
3. **Functions to rename** (e.g., `toggleProject` → `toggleSpace`)
4. **Imports to update** (e.g., from `ProjectBrowser` to `SpaceBrowser`)
5. **Component names to update** (e.g., `ProjectBrowser` → `SpaceBrowser`)
6. **Files to rename** (e.g., `ProjectBrowser.tsx` → `SpaceBrowser.tsx`)
7. **localStorage keys to update** (e.g., `captureInsight_projects` → `captureInsight_spaces`)

## 📋 Still TODO: Code-Level Refactoring

The following changes still need to be completed (documented in Replit AI notes):

### 1. Interface/Type Renames
```typescript
// Current
export interface Project { ... }
interface ProjectBrowserProps { ... }

// Should become
export interface Space { ... }
interface SpaceBrowserProps { ... }
```

### 2. Component Renames
```typescript
// Current files
/components/ProjectBrowser.tsx
/components/CreateProjectDialog.tsx
/components/ProjectSettingsDialog.tsx

// Should become
/components/SpaceBrowser.tsx
/components/CreateSpaceDialog.tsx
/components/SpaceSettingsDialog.tsx
```

### 3. Variable/Parameter Renames
Throughout all files, rename:
- `project` → `space`
- `projects` → `spaces`
- `projectId` → `spaceId`
- `newProject` → `newSpace`
- `expandedProjects` → `expandedSpaces`
- `projectSettingsDialog` → `spaceSettingsDialog`
- etc.

### 4. Function Renames
- `toggleProject()` → `toggleSpace()`
- `handleCreateProject()` → `handleCreateSpace()`
- `handleUpdateProject()` → `handleUpdateSpace()`
- `handleDeleteProject()` → `handleDeleteSpace()`
- `onCreateProject` → `onCreateSpace`
- `onUpdateProject` → `onUpdateSpace`
- `onDeleteProject` → `onDeleteSpace`

### 5. Import Statement Updates
All files that currently import:
```typescript
import { Project } from './components/ProjectBrowser';
```

Should update to:
```typescript
import { Space } from './components/SpaceBrowser';
```

### 6. localStorage Key Updates
```typescript
// Current
localStorage.getItem('captureInsight_projects')
localStorage.setItem('captureInsight_projects', ...)

// Should become
localStorage.getItem('captureInsight_spaces')
localStorage.setItem('captureInsight_spaces', ...)
```

## 🎯 Files That Need Code Updates

Based on search results, these files import or use Project interfaces:

1. `/App.tsx` ✅ (Replit note added, toast messages updated)
2. `/components/ProjectBrowser.tsx` ✅ (Replit note added, UI text updated)
3. `/components/CreateProjectDialog.tsx` ✅ (Replit note added, UI text updated)
4. `/components/ProjectSettingsDialog.tsx` ✅ (Replit note added, UI text updated)
5. `/components/DataManagementView.tsx` - Needs refactoring
6. `/components/ScreenshotOverlay.tsx` - Needs refactoring
7. `/components/CaptureAssignmentPanel.tsx` - Needs refactoring
8. `/components/CaptureBoxMenu.tsx` - Needs refactoring
9. `/components/CaptureOptionsModal.tsx` - Needs refactoring
10. `/components/FloatingCaptureToolbar.tsx` - Needs refactoring
11. `/components/ChangeLogsView.tsx` - Needs refactoring
12. `/components/LLMExportDialog.tsx` ✅ (Updated for backwards compatibility)

## 💡 Implementation Strategy for Replit

When Replit AI performs the refactoring, it should:

1. **Start with base components**:
   - Rename `ProjectBrowser.tsx` → `SpaceBrowser.tsx`
   - Update all interfaces, types, and exports within
   
2. **Update dialog components**:
   - Rename `CreateProjectDialog.tsx` → `CreateSpaceDialog.tsx`
   - Rename `ProjectSettingsDialog.tsx` → `SpaceSettingsDialog.tsx`
   - Update all internal code

3. **Update all consumers**:
   - Update all import statements across the codebase
   - Update all variable/parameter names
   - Update all function names

4. **Update data persistence**:
   - Update localStorage keys
   - Ensure backwards compatibility or migration strategy

5. **Test thoroughly**:
   - Ensure all functionality works
   - Verify localStorage persistence
   - Check all UI flows

## ✨ Status: Ready for Replit

All user-facing text has been updated. The codebase now displays "Space/Spaces" to users.

Comprehensive Replit AI notes have been added to guide the complete code-level refactoring.

When you upload this to Replit, the AI will see these notes and can perform the deep refactoring automatically.
