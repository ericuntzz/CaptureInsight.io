# Destination Sync Implementation

**Date:** November 9, 2025  
**Status:** ✅ Completed

## Summary

Successfully implemented synchronization between the FloatingCaptureToolbar's "Save To" menu and the CaptureOptionsModal's destination assignment. When a user selects a project/folder in the toolbar, that destination is now automatically used as the default for all captures in the modal.

## Changes Made

### 1. FloatingCaptureToolbar.tsx

**Added Props:**
- `projects: Project[]` - Receives the actual project data instead of using mock data
- `defaultDestination?: { projectId: string; folderId: string } | null` - Current default destination
- `onDestinationChange?: (projectId: string, folderId: string) => void` - Callback when destination changes

**Key Changes:**
- Removed `MOCK_PROJECTS` constant
- Added import for `Project` type from ProjectBrowser
- Updated project/folder menu to use real `projects` data with proper IDs
- Modified folder selection to call `onDestinationChange` when a folder is clicked
- Visual highlight now shows the currently selected `defaultDestination`

**Code Updates:**
```tsx
// Now uses projects.map() instead of MOCK_PROJECTS.map()
{projects.map((project) => (
  // Uses project.id instead of project.name for keys and tracking
  <div key={project.id} onMouseEnter={() => setHoveredProject(project.id)}>
    {/* Submenu uses folder.id and checks defaultDestination for highlighting */}
    {project.folders.map((folder) => {
      const isSelected = defaultDestination?.projectId === project.id && 
                        defaultDestination?.folderId === folder.id;
      // ...
    })}
  </div>
))}
```

### 2. CaptureOptionsModal.tsx

**Added Prop:**
- `defaultDestination?: { projectId: string; folderId: string } | null` - Default destination from toolbar

**Key Changes:**
- Updated initialization logic to prioritize `defaultDestination` over first project/folder
- When modal opens, new captures without saved settings are assigned to `defaultDestination`
- Falls back to first project/folder only if `defaultDestination` is not provided

**Code Updates:**
```tsx
// Determine the fallback destination
let fallbackProjectId: string;
let fallbackFolderId: string;

if (defaultDestination && defaultDestination.projectId && defaultDestination.folderId) {
  // Use the toolbar's selected destination
  fallbackProjectId = defaultDestination.projectId;
  fallbackFolderId = defaultDestination.folderId;
} else {
  // Fall back to first project/folder
  const defaultProject = projects[0];
  const defaultFolder = defaultProject?.folders[0];
  fallbackProjectId = defaultProject?.id || '';
  fallbackFolderId = defaultFolder?.id || '';
}
```

### 3. App.tsx

**Added State:**
- `defaultDestination` - Shared state for the default destination, initialized to first project/folder

**Added Handler:**
- `handleDestinationChange` - Updates `defaultDestination` and shows a toast notification

**Updated Components:**
- **FloatingCaptureToolbar**: Now receives `projects`, `defaultDestination`, and `onDestinationChange` props
- **CaptureOptionsModal**: Now receives `defaultDestination` prop

**Fixed Bug:**
- Changed `mockProjects` references to `projects` in `handleStartAnalysis` (was causing undefined errors)

## User Flow

### Before Changes:
1. User selects "Marketing Analytics → HubSpot Data" in toolbar's "Save To" menu
2. User opens CaptureOptionsModal
3. Captures default to "Q4 Marketing Analysis → HubSpot Data" (first project/folder)
4. User must manually change destination for each capture

### After Changes:
1. User selects "Marketing Analytics → HubSpot Data" in toolbar's "Save To" menu
2. Toast notification confirms: "Default destination set to Marketing Analytics → HubSpot Data"
3. User opens CaptureOptionsModal
4. **All captures automatically show "Marketing Analytics → HubSpot Data"** as their destination
5. User can proceed immediately or change individual captures as needed

## UI Synchronization

Both UIs now show the same destination:

**FloatingCaptureToolbar "Save To" Menu:**
- Orange highlight (bg-[rgba(255,107,53,0.2)])
- Orange dot indicator
- Shows currently selected folder

**CaptureOptionsModal "Change Destination" Menu:**
- Orange highlight for folders assigned to captures
- Shows "ProjectName > FolderName" subtitle under each capture
- Clicking subtitle opens destination editor

## Benefits

1. **Consistency** - Both UIs always reflect the same destination selection
2. **Efficiency** - Users don't need to set destinations twice
3. **User Experience** - One selection in toolbar automatically applies to all new captures
4. **Flexibility** - Users can still override per-capture if needed via the modal

## Testing Checklist

- ✅ Toolbar "Save To" menu shows all projects and folders
- ✅ Selecting a folder in toolbar updates defaultDestination
- ✅ Toast notification confirms destination change
- ✅ Opening CaptureOptionsModal shows captures with the toolbar's selected destination
- ✅ Destination subtitles match the toolbar selection
- ✅ Changing destination in modal doesn't affect toolbar selection
- ✅ Legacy folder selection for existing captures still works
- ✅ No console errors or undefined references

## Technical Notes

- State is managed at the App.tsx level and flows down to both components
- FloatingCaptureToolbar is the "source of truth" for user-initiated destination changes
- CaptureOptionsModal consumes the destination but doesn't modify it
- Both components can operate independently if defaultDestination is null
- Backward compatible with existing capture functionality
