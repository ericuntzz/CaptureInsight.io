# Destination Synchronization Implementation

## Overview
This document describes the two-way synchronization between the FloatingCaptureToolbar's "Save To" menu and the CaptureOptionsModal's "Change Destination" section.

## Flow Diagram

```
┌─────────────────────────────────────┐
│         App.tsx (State)              │
│  defaultDestination: {               │
│    projectId: string,                │
│    folderId: string                  │
│  }                                   │
└──────────┬────────────────┬──────────┘
           │                │
           │                │
           ▼                ▼
┌──────────────────┐  ┌──────────────────┐
│ FloatingCapture  │  │ CaptureOptions   │
│     Toolbar      │  │      Modal       │
│                  │  │                  │
│  "Save To" Menu  │  │ "Change Dest."   │
└──────────────────┘  └──────────────────┘
```

## Implementation Details

### 1. FloatingCaptureToolbar → App → CaptureOptionsModal

When a user selects a destination in the FloatingCaptureToolbar's "Save To" menu:

1. **FloatingCaptureToolbar.tsx** (lines 322-324):
   ```typescript
   if (onDestinationChange) {
     onDestinationChange(viewedProject.id, folder.id);
   }
   ```

2. **App.tsx** (line 252-258):
   ```typescript
   const handleDestinationChange = (projectId: string, folderId: string) => {
     setDefaultDestination({ projectId, folderId });
     // Shows toast notification
   };
   ```

3. **CaptureOptionsModal.tsx** (lines 278-299):
   ```typescript
   useEffect(() => {
     if (isOpen && defaultDestination && defaultDestination.projectId && defaultDestination.folderId) {
       setSelectedProject(defaultDestination.projectId);
       setSelectedFolder(defaultDestination.folderId);
       
       if (selectedCaptureIds.size > 0) {
         // Update destinations for selected captures
       }
     }
   }, [defaultDestination?.projectId, defaultDestination?.folderId]);
   ```

### 2. CaptureOptionsModal → App → FloatingCaptureToolbar

When a user selects a destination in the CaptureOptionsModal's "Change Destination" section:

1. **CaptureOptionsModal.tsx** - Two places where destinations are selected:

   a. **In the main destination list** (lines 1706-1736):
   ```typescript
   onClick={(e) => {
     // ... update local state ...
     
     // Sync with toolbar's default destination
     if (onDestinationChange) {
       onDestinationChange(project.id, folder.id);
     }
   }}
   ```

   b. **In the popup selector** (lines 480-501):
   ```typescript
   const handleSelectFromPopup = (projectId: string, folderId: string) => {
     // ... update local state ...
     
     // Sync with toolbar's default destination
     if (onDestinationChange) {
       onDestinationChange(projectId, folderId);
     }
   }
   ```

2. **App.tsx** - Same handler as above updates the state

3. **FloatingCaptureToolbar.tsx** - Automatically reflects the change via the `defaultDestination` prop

## Props Added

### CaptureOptionsModal
- **New Prop**: `onDestinationChange?: (projectId: string, folderId: string) => void`
  - **Purpose**: Callback to sync destination changes back to App state
  - **Usage**: Called whenever user selects a destination in the modal

### FloatingCaptureToolbar
- **Existing Prop**: `onDestinationChange?: (projectId: string, folderId: string) => void`
  - **Purpose**: Callback to sync destination changes back to App state
  - **Usage**: Called whenever user selects a destination in the Save To menu

## State Management

### App.tsx
- **State**: `defaultDestination: { projectId: string; folderId: string } | null`
- **Purpose**: Single source of truth for the current destination
- **Updates**: Via `handleDestinationChange` from either component

### CaptureOptionsModal.tsx
- **Local State**: 
  - `selectedProject: string`
  - `selectedFolder: string`
  - `captureDestinations: CaptureDestination[]` (per-capture destinations)
  
- **Syncing**: 
  - Receives `defaultDestination` prop
  - Initializes from `defaultDestination` or first project/folder
  - Listens for changes via useEffect and updates local state
  - Calls `onDestinationChange` when user makes selection

### FloatingCaptureToolbar.tsx
- **No Local State**: Uses `defaultDestination` prop directly for display
- **Display**: Shows current destination or "Save To" button
- **Updates**: Calls `onDestinationChange` when user makes selection

## User Experience

### Scenario 1: User changes destination in toolbar
1. User clicks "Save To" in FloatingCaptureToolbar
2. User selects "Q4 Marketing Analysis → Google Ads Data"
3. Toolbar updates immediately
4. If CaptureOptionsModal is open, it syncs and shows the new destination

### Scenario 2: User changes destination in modal
1. User has CaptureOptionsModal open
2. User clicks on "Q4 Marketing Analysis → Google Ads Data" in Change Destination
3. Modal updates immediately
4. Toolbar's default destination syncs automatically
5. Toast notification appears confirming the change

### Scenario 3: Both components visible
1. Both components stay in sync in real-time
2. Changing destination in either place updates both
3. No conflicts or race conditions

## Testing Checklist

- [ ] Change destination in toolbar → Check modal reflects change
- [ ] Change destination in modal → Check toolbar reflects change
- [ ] Change destination multiple times rapidly → Verify no UI glitches
- [ ] Select multiple captures in modal → Verify all update to new destination
- [ ] Change destination with no captures selected → Verify only default updates
- [ ] Close and reopen modal → Verify destination persists from toolbar selection

## Benefits

1. **Single Source of Truth**: App.tsx manages the canonical destination state
2. **Bi-directional Sync**: Changes in either UI reflect immediately in both
3. **User Consistency**: User expectations met regardless of where they make changes
4. **Clean Architecture**: Props-based communication, no global state needed
5. **Future-Proof**: Easy to add more destination consumers in the future
