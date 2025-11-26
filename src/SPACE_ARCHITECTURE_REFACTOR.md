# 🏗️ SPACE ARCHITECTURE REFACTOR - CRITICAL IMPLEMENTATION GUIDE

**Date:** November 14, 2025  
**Status:** ⚠️ ARCHITECTURAL CHANGE IN PROGRESS  
**Priority:** 🔴 CRITICAL - Major Feature Implementation

---

## 📋 EXECUTIVE SUMMARY

This document describes a fundamental architectural change to how CaptureInsight organizes and manages user data. We are transforming "Spaces" from a simple organizational container into a **contextual workspace** that serves as the operational center for all user activities.

### The Core Change

**BEFORE:** Spaces were one level in a hierarchy (Spaces → Folders → Data)  
**AFTER:** Spaces are contextual workspaces where ALL features operate within the scope of the currently active Space

---

## 🎯 WHY WE'RE MAKING THIS CHANGE

### User Behavior Reality

Through user research and product analysis, we discovered that:

1. **Spaces are long-lived workspaces, not temporary projects**
   - Users don't create/delete Spaces frequently
   - Spaces represent business areas (e.g., "Digital Marketing", "Sales Operations")
   - They're more like Slack workspaces than project folders

2. **Projects imply temporary timelines; Spaces imply ongoing work**
   - "Q4 Marketing Analysis" sounds like a project with an end date
   - "Digital Marketing" sounds like an ongoing operational area
   - This semantic shift better matches actual usage patterns

3. **Context-switching is expensive**
   - Users need ALL features (AI Assistant, Capture, Change Logs) to work within their current Space
   - Switching between Spaces should be intentional and clear
   - Features should "remember" which Space they're operating in

---

## 🏛️ THE NEW ARCHITECTURE

### Space Switcher (Top of Sidebar)

```
┌─────────────────────────────────────┐
│  🔷 Digital Marketing        ⚙️ ▼  │  ← Space Switcher
├─────────────────────────────────────┤
│  🤖 AI Assistant                    │
│  📸 Capture Insight                 │
│  📊 Change Logs                     │
├─────────────────────────────────────┤
│  📁 HubSpot Data             (8)    │  ← Folders (no "Spaces" section)
│  📁 Google Ads Data          (12)   │
│  📁 Analytics                (0)    │
└─────────────────────────────────────┘
```

### Key Principles

1. **Space-First Architecture**
   - The active Space is always visible at the top of the sidebar
   - All features operate within the context of the active Space
   - Switching Spaces is an intentional action

2. **Feature Scoping**
   - **Capture Insight:** Saves to folders in the current Space
   - **AI Assistant:** Prioritizes data from the current Space
   - **Change Logs:** Shows activity for the current Space
   - **Folders:** Only shows folders from the current Space

3. **Simplified Navigation**
   - No more nested "Spaces" section in sidebar
   - Folders are displayed directly
   - Space selection happens via dropdown at top

---

## 🔧 TECHNICAL IMPLEMENTATION

### 1. State Management (`App.tsx`)

```typescript
// NEW: Track the currently active Space
const [currentSpaceId, setCurrentSpaceId] = useState<string | null>(() => {
  // Load from localStorage
  const saved = localStorage.getItem('captureinsight_current_space');
  if (saved) return saved;
  // Default to first space
  return initialSpaces[0]?.id || null;
});

// Save to localStorage when it changes
useEffect(() => {
  if (currentSpaceId) {
    localStorage.setItem('captureinsight_current_space', currentSpaceId);
  }
}, [currentSpaceId]);

// Get the current Space object
const currentSpace = spaces.find(s => s.id === currentSpaceId);
```

### 2. Space Switcher Component

Located at: `/components/SpaceSwitcher.tsx`

**Features:**
- Dropdown menu to switch between Spaces
- "+ Add a New Space" option
- Settings gear icon (⚙️) next to Space name for Space Settings
- Works in both expanded and collapsed sidebar modes
- Auto-opens Space name for editing when creating new Space

**Collapsed Mode:**
- Shows Layers icon (🔷)
- Dropdown appears to the right of icon

**Expanded Mode:**
- Shows Space name with dropdown arrow
- Settings gear appears on hover
- Dropdown appears below

### 3. ProjectBrowser Updates

**REMOVED:**
- "Spaces" accordion section
- Space expand/collapse logic
- Multiple Space display in sidebar

**KEPT:**
- Folder display and management
- Sheet/file management
- AI Assistant, Capture, Change Logs buttons

**NEW BEHAVIOR:**
- Only shows folders from `currentSpace`
- All folder operations scoped to current Space

### 4. Feature Context Awareness

#### Capture Insight
```typescript
// When capturing, use current Space
const handleCapture = () => {
  // Automatically save to current Space
  const destination = {
    spaceId: currentSpaceId,
    folderId: selectedFolderId || currentSpace.folders[0]?.id
  };
  // ... save logic
};
```

#### AI Assistant
```typescript
// AI queries should prioritize current Space data
const handleAIQuery = (query: string) => {
  const context = {
    spaceId: currentSpaceId,
    spaceName: currentSpace?.name,
    spaceFolders: currentSpace?.folders,
    spaceGoals: currentSpace?.goals,
    spaceInstructions: currentSpace?.instructions,
  };
  // ... AI logic with Space context
};
```

#### Change Logs
```typescript
// Filter change logs by current Space
const filteredChangeLogs = changeLogs.filter(
  log => log.spaceId === currentSpaceId
);
```

---

## 📐 UX SPECIFICATIONS

### Space Creation Flow

1. User clicks "+ Add a New Space"
2. System creates blank Space with auto-generated ID
3. Space name field is **immediately editable** (auto-focus)
4. User types name and presses Enter or clicks away
5. Space is saved with that name

**Why:** Users should be prompted to name their Space immediately to maintain organization. This prevents "Untitled Space" clutter.

### Space Settings Access

1. **From Space Switcher:** Gear icon (⚙️) next to Space name
2. **Opens:** ProjectSettingsDialog (will be renamed to SpaceSettingsDialog)
3. **Editable:**
   - Space Name
   - Goals
   - Instructions (AI context)

### Space Switching

1. User clicks Space name dropdown
2. All Spaces listed with descriptions
3. Current Space highlighted in orange
4. Click Space to switch
5. Sidebar updates to show that Space's folders

**Preservation:**
- Last viewed folder/sheet in each Space
- AI conversation history per Space
- Space-specific settings

---

## 🗂️ FOLDER BEHAVIOR

### Display Rules

```typescript
// Only show folders from current Space
const foldersToDisplay = currentSpace?.folders || [];
```

### Folder Count Badges

Keep existing badges showing number of sheets:
```
📁 HubSpot Data         (8)
📁 Google Ads Data      (12)
📁 Analytics            (0)
```

### Folder Dropdown Behavior

- Each folder can expand/collapse to show sheets
- No wrapper "Folders" dropdown
- Folders are always visible (not hidden in accordion)

---

## 💾 DATA PERSISTENCE

### localStorage Keys

```typescript
// Current active Space
'captureinsight_current_space' → spaceId: string

// All Spaces data
'captureinsight_spaces' → Space[]: Array

// Per-Space settings (future)
'captureinsight_space_settings_{spaceId}' → SpaceSettings
```

### Space Data Structure

```typescript
interface Space {
  id: string;
  name: string;
  description: string;
  goals?: string;          // AI context
  instructions?: string;   // AI context
  folders: Folder[];
  createdAt?: Date;
  lastAccessedAt?: Date;
}

interface Folder {
  id: string;
  name: string;
  sheets: Sheet[];
}

interface Sheet {
  id: string;
  name: string;
  rowCount: number;
  lastModified: string;
  analysisType?: 'one-time' | 'scheduled' | 'llm-integration' | 'api' | null;
  llmProvider?: { id: string; name: string };
  schedule?: { frequency: string; time: string };
}
```

---

## 🔄 MIGRATION STRATEGY

### For Existing Users

1. **No data loss:** All existing Spaces/folders/sheets preserved
2. **Default Space:** First Space becomes active by default
3. **localStorage migration:** Automatic on first load
4. **User notification:** Toast explaining the new Space switcher

### For New Users

1. **Welcome Space:** Auto-create "My First Space"
2. **Onboarding:** Guide to Space switcher
3. **Example folders:** Pre-populate with sample folders

---

## 🧪 TESTING CHECKLIST

### Core Functionality
- [ ] Space switcher shows all Spaces
- [ ] Clicking Space switches context
- [ ] Current Space persists in localStorage
- [ ] Space persists after page refresh
- [ ] Settings gear opens Space settings

### Feature Scoping
- [ ] Capture saves to current Space
- [ ] AI Assistant uses current Space context
- [ ] Change Logs filter by current Space
- [ ] Folders only show from current Space

### Edge Cases
- [ ] No Spaces exist (first run)
- [ ] Only one Space exists
- [ ] Switching Spaces with active capture
- [ ] Deleting current Space (switch to another)
- [ ] Very long Space names (truncation)

### Collapsed Sidebar
- [ ] Icon-only mode shows Layers icon
- [ ] Dropdown appears to the right
- [ ] All functionality preserved

---

## 🚨 CRITICAL NOTES FOR DEVELOPERS

### 1. Scope ALL Features to Current Space

Every feature that interacts with data MUST check `currentSpaceId`:

```typescript
// ❌ BAD
const allSheets = spaces.flatMap(s => s.folders.flatMap(f => f.sheets));

// ✅ GOOD
const currentSpace = spaces.find(s => s.id === currentSpaceId);
const sheetsInCurrentSpace = currentSpace?.folders.flatMap(f => f.sheets) || [];
```

### 2. Handle Space Switching Gracefully

When Space changes:
- Clear active sheet selection
- Update URL params (if applicable)
- Preserve Space-specific state
- Show loading state if needed

### 3. Create Space Settings Flow

When creating a new Space:
```typescript
const newSpace: Space = {
  id: `space-${Date.now()}`,
  name: '', // Empty - will be auto-edited
  description: '',
  folders: [],
  createdAt: new Date(),
};
```

Then immediately trigger name edit mode.

### 4. Never Lose Data

Always save to localStorage:
- After creating Space
- After updating Space settings
- After Space switch
- After any folder/sheet changes

---

## 📚 RELATED COMPONENTS TO UPDATE

### Files That Need Changes

1. **`/App.tsx`**
   - Add `currentSpaceId` state
   - Add localStorage persistence
   - Pass `currentSpaceId` to children
   - Add `onSpaceChange` handler

2. **`/components/ProjectBrowser.tsx`**
   - Add SpaceSwitcher at top
   - Remove Spaces accordion section
   - Filter folders by currentSpace
   - Update prop types

3. **`/components/DataManagementView.tsx`**
   - Pass currentSpace to ProjectBrowser
   - Update any Space-related logic

4. **`/components/FloatingCaptureToolbar.tsx`**
   - Default to current Space for captures
   - Filter destination picker by current Space

5. **`/components/AIAssistant.tsx` (if exists)**
   - Add Space context to queries
   - Filter data by current Space

### Files That DON'T Need Changes

- Individual sheet/data components
- Chart components
- UI components (buttons, inputs, etc.)
- Spreadsheet component

---

## 🎨 DESIGN SPECIFICATIONS

### Space Switcher Styling

```css
/* Colors */
--space-primary: #FF6B35;
--space-hover: rgba(255, 107, 53, 0.1);
--space-active: rgba(255, 107, 53, 0.08);
--space-border: rgba(255, 107, 53, 0.2);

/* Dimensions */
height: 48px (collapsed) | auto (expanded)
padding: 8px 12px
border-radius: 8px

/* Icon */
Layers icon from lucide-react
Size: 16px (w-4 h-4)
Color: #FF6B35
```

### Dropdown Menu

```css
/* Position */
top-full mt-1 (expanded mode)
left-full ml-2 (collapsed mode)

/* Size */
width: 256px (w-64)
max-height: 400px with scroll

/* Animation */
fade + slide (10px)
duration: 200ms
```

---

## 🔮 FUTURE ENHANCEMENTS

### Phase 2 (Future)

1. **Space Templates**
   - "Marketing" template with pre-made folders
   - "Sales" template
   - "Product" template

2. **Space Switching Shortcuts**
   - Cmd/Ctrl + 1, 2, 3 for first three Spaces
   - Cmd/Ctrl + K to open Space switcher

3. **Space Analytics**
   - Last accessed timestamp
   - Usage metrics per Space
   - Most active folders

4. **Cross-Space Features**
   - Compare data across Spaces
   - Move folders between Spaces
   - Duplicate Space

### Phase 3 (Future)

1. **Space Sharing/Collaboration**
   - Invite team members to Space
   - Space-level permissions
   - Activity feed per Space

2. **Space Archiving**
   - Archive old Spaces
   - Restore from archive
   - Archive search

---

## ✅ ACCEPTANCE CRITERIA

This refactor is complete when:

1. ✅ Space switcher appears at top of sidebar
2. ✅ User can switch between Spaces
3. ✅ Current Space persists in localStorage
4. ✅ All features scope to current Space
5. ✅ New Spaces can be created
6. ✅ Space settings are accessible
7. ✅ Folders show only from current Space
8. ✅ No "Spaces" section in sidebar
9. ✅ Collapsed mode works correctly
10. ✅ All existing functionality preserved

---

## 📞 QUESTIONS & SUPPORT

If you have questions about this refactor:

1. Read this document thoroughly
2. Check related documentation:
   - `AI_ASSISTANT_TRAINING_GUIDE.md`
   - `README_FOR_REPLIT.md`
   - `CUSTOM_KPI_DEFINITIONS_SYSTEM.md`
3. Review the SpaceSwitcher component code
4. Check the git commit history for context

---

## 🏁 SUMMARY

This is more than a UI change - it's an architectural shift that makes CaptureInsight more intuitive and powerful. By making Spaces the primary context for all operations, we're aligning the software with how users actually work: in focused, long-term operational areas rather than short-term projects.

The key insight: **Users don't work across all their data at once. They work within specific business domains (Spaces), and all tools should be scoped to that context.**

This change makes CaptureInsight feel less like a file manager and more like a workspace where users can focus on one area of their business at a time.

---

**Last Updated:** November 14, 2025  
**Document Version:** 1.0  
**Author:** CaptureInsight Product Team
