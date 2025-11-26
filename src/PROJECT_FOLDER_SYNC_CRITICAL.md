# 🔴 CRITICAL: Project/Folder State Synchronization

## ⚠️ READ THIS BEFORE MAKING ANY PROJECT/FOLDER CHANGES

This document explains the **THREE-MODULE SYNCHRONIZATION SYSTEM** that keeps project and folder state consistent across the entire application.

---

## The Three Synchronized Modules

### 1. **FloatingCaptureToolbar.tsx** - "Save To" Dropdown
- **Location**: Floating toolbar in capture view
- **Function**: Allows users to set the default destination for new captures
- **Key Feature**: Shows current default destination with "Saving to:" label

### 2. **CaptureOptionsModal.tsx** - "Change Destination" Workflow
- **Location**: Modal that appears when clicking "Capture Data"
- **Function**: Allows users to assign individual captures to specific project folders
- **Key Feature**: Pre-fills all captures with the default destination from the toolbar

### 3. **DataManagementView.tsx + ProjectBrowser.tsx** - "Projects" Sidebar
- **Location**: Left sidebar in Data Management & Analysis view
- **Function**: Displays all projects and folders, allows browsing captured data
- **Key Feature**: Shows the actual project/folder structure with sheet counts

---

## Single Source of Truth: App.tsx

**ALL** project/folder state lives in **App.tsx** in the `projects` state variable.

```typescript
const [projects, setProjects] = useState<Project[]>(initialProjects);
```

### Why This Matters

If any component creates its own separate `projects` state, the three modules will become **out of sync**:
- ❌ Projects created in the toolbar won't appear in the sidebar
- ❌ Folders created in the modal won't show in the toolbar
- ❌ Data saved to a folder won't appear in the projects view

---

## How It Works

### Data Flow

```
App.tsx (projects state)
    │
    ├──> FloatingCaptureToolbar (receives projects prop)
    │        └──> User changes default destination
    │             └──> onDestinationChange() → Updates App.tsx
    │
    ├──> CaptureOptionsModal (receives projects prop)
    │        ├──> User creates new project
    │        │    └──> onCreateProject() → Updates App.tsx
    │        ├──> User creates new folder
    │        │    └──> onCreateFolder() → Updates App.tsx
    │        └──> User assigns captures to folders
    │             └──> onStartAnalysis() → Saves to App.tsx
    │
    └──> DataManagementView (receives projects prop)
             └──> ProjectBrowser (receives projects prop)
                  ├──> User creates project
                  │    └──> onCreateProject() → Updates App.tsx
                  ├──> User creates folder
                  │    └──> onCreateFolder() → Updates App.tsx
                  ├──> User renames/deletes project
                  │    └──> Updates App.tsx
                  └──> User renames/deletes folder
                       └──> Updates App.tsx
```

### State Update Handlers in App.tsx

All mutations to the `projects` state happen through these handlers:

| Handler | Purpose | Used By |
|---------|---------|---------|
| `handleCreateProject()` | Creates a new project | CaptureOptionsModal, DataManagementView |
| `handleCreateFolder()` | Creates a new folder | CaptureOptionsModal, DataManagementView |
| `handleRenameProject()` | Renames a project | CaptureOptionsModal |
| `handleRenameFolder()` | Renames a folder | CaptureOptionsModal |
| `handleDeleteProject()` | Deletes a project | DataManagementView |
| `handleDeleteFolder()` | Deletes a folder | DataManagementView |
| `handleUpdateProject()` | Updates project settings | DataManagementView |
| `handleUpdateFolder()` | Updates folder settings | DataManagementView |
| `handleDestinationChange()` | Updates default destination | FloatingCaptureToolbar, CaptureOptionsModal |

---

## 🚨 Critical Rules

### ✅ DO:
1. **Always pass `projects` as a prop** from App.tsx to child components
2. **Always call the handlers** passed from App.tsx to modify projects
3. **Update all three modules** if you change the project structure or behavior
4. **Test all three views** after making changes (toolbar, modal, sidebar)

### ❌ DON'T:
1. **Never create separate `projects` state** in child components
2. **Never directly mutate the `projects` prop**
3. **Never use `setProjects`** outside of App.tsx
4. **Never create your own project management handlers** in child components

---

## File Checklist

When making project/folder-related changes, check these files:

- [ ] **App.tsx** - Main state management
- [ ] **FloatingCaptureToolbar.tsx** - Save To dropdown
- [ ] **CaptureOptionsModal.tsx** - Change Destination workflow
- [ ] **DataManagementView.tsx** - Data view wrapper
- [ ] **ProjectBrowser.tsx** - Projects sidebar

---

## Example: Adding a New Project Property

Let's say you want to add a `color` property to projects.

### ❌ WRONG Way (Will Break Sync):

```typescript
// In DataManagementView.tsx
const [projects, setProjects] = useState([...]); // WRONG! Separate state!

const updateProjectColor = (id, color) => {
  setProjects(prev => prev.map(p => p.id === id ? {...p, color} : p));
};
```

### ✅ CORRECT Way:

```typescript
// 1. Update the Project interface in ProjectBrowser.tsx
export interface Project {
  id: string;
  name: string;
  description: string;
  folders: FolderType[];
  goals?: string;
  instructions?: string;
  color?: string; // NEW PROPERTY
}

// 2. Add handler in App.tsx
const handleUpdateProjectColor = (projectId: string, color: string) => {
  setProjects(prev => prev.map(p => 
    p.id === projectId ? { ...p, color } : p
  ));
  toast.success(`Project color updated!`);
};

// 3. Pass handler to DataManagementView
<DataManagementView
  projects={projects}
  onUpdateProjectColor={handleUpdateProjectColor}
  ...
/>

// 4. Add prop to DataManagementView interface
interface DataManagementViewProps {
  projects: Project[];
  onUpdateProjectColor: (projectId: string, color: string) => void;
  ...
}

// 5. Pass to ProjectBrowser
<ProjectBrowser
  projects={projects}
  onUpdateProjectColor={onUpdateProjectColor}
  ...
/>

// 6. Update FloatingCaptureToolbar UI if needed (e.g., show color in menu)
// 7. Update CaptureOptionsModal UI if needed (e.g., show color in list)
```

---

## Testing Synchronization

After making changes, test this flow:

1. **Create a project** in the CaptureOptionsModal
   - ✅ Should appear immediately in FloatingCaptureToolbar's "Save To" menu
   - ✅ Should appear in DataManagementView's Projects sidebar

2. **Create a folder** in the FloatingCaptureToolbar
   - ✅ Should appear in CaptureOptionsModal's destination picker
   - ✅ Should appear in DataManagementView's Projects sidebar

3. **Save captures** to a folder via CaptureOptionsModal
   - ✅ Should show correct count in DataManagementView's Projects sidebar
   - ✅ Should be accessible when clicking the folder

4. **Rename/Delete** a project in DataManagementView
   - ✅ Should update in FloatingCaptureToolbar
   - ✅ Should update in CaptureOptionsModal

---

## Common Issues

### Issue: "Projects I created in the toolbar don't show up in the sidebar"
**Cause**: DataManagementView has its own separate `projects` state  
**Fix**: Remove the separate state and pass `projects` as a prop from App.tsx

### Issue: "Default destination doesn't sync between toolbar and modal"
**Cause**: Not using the shared `defaultDestination` state  
**Fix**: Ensure both components receive `defaultDestination` prop from App.tsx

### Issue: "Folders created in one view don't appear in another"
**Cause**: Component is calling its own handler instead of the App.tsx handler  
**Fix**: Call the `onCreateFolder` prop instead of a local handler

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│                   App.tsx                        │
│  ┌──────────────────────────────────────────┐   │
│  │  State: projects, defaultDestination     │   │
│  │  Handlers: handleCreateProject(), etc.   │   │
│  └──────────────────────────────────────────┘   │
└───────────┬────────────┬────────────┬───────────┘
            │            │            │
            ▼            ▼            ▼
    ┌───────────┐  ┌─────────┐  ┌──────────────┐
    │  Toolbar  │  │  Modal  │  │  Data View   │
    │  Save To  │  │ Change  │  │   Projects   │
    │           │  │  Dest.  │  │   Sidebar    │
    └───────────┘  └─────────┘  └──────────────┘
         │              │              │
         └──────────────┴──────────────┘
                        │
              All use same projects
              All call same handlers
              All stay synchronized
```

---

## Questions?

If you're unsure whether a change will affect synchronization:

1. Check if it modifies the `projects` state structure
2. If YES → Update all three modules
3. If NO → Proceed, but test all three views anyway

**When in doubt, ask or refer to this document!**

---

**Last Updated**: November 2025  
**Maintained By**: Development Team  
**Importance**: 🔴 CRITICAL - DO NOT IGNORE
