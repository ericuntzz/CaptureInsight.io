# Data Source Feature Implementation - Notes for Replit

## Overview
This document outlines the implementation of the Data Source feature that allows users to view the source data (screenshot, link, file, or API connection) that was used to create each data sheet. This feature establishes a 1:1 relationship between data sheets and their source data.

## **CRITICAL ARCHITECTURE DECISION**: One Data Source Per Sheet

**This is essential for the product's core functionality:**

- Each data sheet MUST have exactly ONE data source
- When a user captures data via the FloatingCaptureToolbar, each capture item (screenshot, link, file) creates its OWN separate sheet
- This design ensures:
  1. Data is not messy or confusing
  2. Data is easily trackable and searchable for AI
  3. Clear provenance for each dataset

**Example:** If a user captures 3 items (1 screenshot, 1 link, 1 file) and clicks "Capture Data", the system creates **3 separate sheets**, each with its own data source.

---

## Current Implementation Status

### ✅ COMPLETED
1. **DataSourceSidebar Component** (`/components/DataSourceSidebar.tsx`)
   - Right sidebar (400px wide) that displays data source information
   - Supports all source types: screenshot, link, file, API
   - Features:
     - Click-to-edit name
     - Full-screen image expansion for screenshots
     - Metadata display (date, creator, folder, space, tags, LLMs sent to)
     - Close button with animation

2. **DataSource Interface** 
   - Defined in `/components/DataSourceSidebar.tsx`
   - Extended Sheet interface in `/components/ProjectBrowser.tsx` to include `dataSource?: DataSource`
   - Type definition:
   ```typescript
   export interface DataSource {
     type: 'screenshot' | 'link' | 'file' | 'api';
     name: string;
     captureDate: Date;
     capturedBy: string;
     folder: string;
     space: string;
     tags?: string[];
     sentToLLMs?: Array<{ llm: string; timestamp: Date }>;
     // Type-specific data
     preview?: string; // For screenshots (URL or base64)
     url?: string; // For links
     fileData?: {
       fileName: string;
       fileSize: string;
       fileType: string;
     };
     apiConnection?: {
       endpoint: string;
       lastSync: Date;
       status: 'active' | 'inactive';
     };
   }
   ```

3. **"View Source Data" Button** (`/components/FileNavigationBar.tsx`)
   - Added button next to folder dropdown (styled consistently with other nav buttons)
   - Toggle text: "View Source Data" ↔ "Hide Source Data"
   - Icons: Eye ↔ EyeOff

4. **Integration in DataManagementView** (`/components/DataManagementView.tsx`)
   - State management for sidebar visibility
   - Pass current sheet's data source to sidebar
   - Sidebar persists when switching between sheet tabs
   - Imported DataSourceSidebar with AnimatePresence for smooth animations

---

## 🚧 TODO: Implementation Tasks for Replit

### **PRIORITY 1: Connect Capture Flow to Data Source Creation**

#### Task 1.1: Update FloatingCaptureToolbar Capture Items
**File**: `/components/CaptureAssignmentPanel.tsx` and `/App.tsx`

**Current State**: 
- Capture items are stored in three separate arrays: `captures`, `shareLinks`, `uploadedFiles`
- CaptureItem interface exists but doesn't store enough metadata to create DataSource

**Action Required**:
1. Extend the `CaptureItem` interface (or individual interfaces) to store:
   ```typescript
   interface CaptureItem {
     id: string;
     type: 'screen' | 'file' | 'link';
     name: string;
     timestamp: Date;
     preview?: string; // NEW: Store screenshot data (base64 or URL)
     url?: string; // NEW: For links
     file?: File; // NEW: Store file reference
     tags?: string[]; // NEW: Tags selected in FloatingCaptureToolbar
     selectedLlmId?: string | null; // NEW: Track if sent to LLM
   }
   ```

2. Update capture handling in `App.tsx`:
   - `handleCapture` (line 255): Store screenshot preview data
   - `handleShareLink` (line 412): Already stores URL, good!
   - `handleFileChange` (line 429): Store file reference and metadata

**Why**: We need all this metadata to create complete DataSource objects when sheets are created.

---

#### Task 1.2: Create DataSource When Creating Sheets
**File**: `/App.tsx`, function `handleStartAnalysis` (line 330)

**Current State**:
- Sheets are created from captureItems (lines 356-391)
- Each sheet is created with:  `id`, `name`, `rowCount`, `lastModified`, `analysisType`, `llmProvider`, `schedule`
- NO dataSource is attached

**Action Required**:
Update lines 368-378 to create DataSource object from captureItem:

```typescript
// Create a new sheet for this capture with analysis preferences AND data source
const captureItem = captureItems[index];
const settings = analysisSettings[index];

// NEW: Create DataSource from captureItem
const dataSource: DataSource = {
  type: captureItem.type,
  name: captureItem.name,
  captureDate: captureItem.timestamp,
  capturedBy: 'Current User', // TODO: Replace with actual user
  folder: folder.name,
  space: space.name,
  tags: captureItem.tags || [],
  sentToLLMs: settings.llmProvider ? [{
    llm: settings.llmProvider.name,
    timestamp: new Date()
  }] : undefined,
  // Type-specific data
  preview: captureItem.type === 'screen' ? captureItem.preview : undefined,
  url: captureItem.type === 'link' ? captureItem.url : undefined,
  fileData: captureItem.type === 'file' && captureItem.file ? {
    fileName: captureItem.file.name,
    fileSize: formatFileSize(captureItem.file.size),
    fileType: captureItem.file.type || 'Unknown'
  } : undefined
};

const newSheet = {
  id: `sheet-${Date.now()}-${index}`,
  name: item.name,
  rowCount: 120, // Default row count
  lastModified: 'Just now',
  // Store analysis preferences (synced with CaptureOptionsModal)
  analysisType: settings?.analysisType || null,
  llmProvider: settings?.llmProvider,
  schedule: settings?.schedule,
  // NEW: Attach data source
  dataSource: dataSource
};
```

**Helper Function Needed**:
```typescript
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  else return (bytes / 1048576).toFixed(1) + ' MB';
}
```

---

### **PRIORITY 2: Create Mock Data Sources for Existing Sheets**

**Status**: ✅ **COMPLETED**

**File**: `/App.tsx`, `initialSpaces` constant (lines 47-227)

**What Was Done**:
Mock data sources have been added to all existing sheets in the demo for demonstration purposes. The mock data includes:

- **8 total sheets** across 2 spaces with diverse data source types:
  - 4 screenshot types (with Unsplash preview images)
  - 2 link types (with realistic URLs)
  - 2 file types (with file metadata)

- **Realistic metadata** for each data source:
  - Capture dates (recent timestamps)
  - Different users (Eric Unterberger, Sarah Chen, Mike Johnson, Alex Rivera)
  - Relevant tags
  - Some sheets sent to LLMs (ChatGPT, Claude, or both)

**⚠️ IMPORTANT NOTE FOR PRODUCTION**:
These mock data sources are for demo purposes ONLY. Before launching the product to production:
1. Remove or clear all mock dataSource objects from initialSpaces
2. Ensure the data source creation logic in PRIORITY 1 is fully implemented
3. Test with real captures to verify data sources are created correctly

The mock data serves as:
- **UI demonstration** - Shows how the sidebar displays different source types
- **UX testing** - Validates the user experience with real-looking data
- **Development reference** - Provides examples of the expected data structure

---

### **PRIORITY 3: Handle Multiple Sheets from Single CSV Upload**

**File**: `/App.tsx`, `handleFileChange` function (line 429)

**Current State**:
- File uploads create single captureItem
- User requirement: CSV with multiple sheets should create multiple data sheets

**Action Required**:
1. Detect if uploaded file is a CSV/Excel with multiple sheets
2. Parse the file to identify sheets
3. Create separate `CaptureItem` for each sheet
4. Each capture item should reference the same file but with different sheet names

**Example Logic**:
```typescript
const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    const now = new Date();
    
    // Check if it's a multi-sheet file (CSV/Excel)
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      // TODO: Parse Excel file to get sheet names
      // For each sheet, create a separate capture item
      const sheetNames = parseExcelSheets(file); // Implement this
      sheetNames.forEach((sheetName, index) => {
        const fileData: FileData = {
          id: `file-${Date.now()}-${index}`,
          name: `${sheetName} (${file.name})`,
          file,
          timestamp: now,
          sheetName: sheetName // NEW: Track which sheet this is
        };
        setUploadedFiles(prev => [...prev, fileData]);
      });
    } else {
      // Single file upload (existing logic)
      const fileData: FileData = {
        id: `file-${Date.now()}-${Math.random()}`,
        name: file.name,
        file,
        timestamp: now
      };
      setUploadedFiles(prev => [...prev, fileData]);
    }
    
    toast.success(`File uploaded: ${file.name}`);
  }
};
```

**Note**: You may need to use a library like `xlsx` for parsing Excel files.

---

### **PRIORITY 4: Enable Sheet/DataSource Name Editing**

**File**: `/components/DataManagementView.tsx` (line 337 in current implementation)

**Current State**:
- Name edit in sidebar shows toast but doesn't actually update
- TODO comment exists: `// TODO: Update sheet name in App.tsx state`

**Action Required**:
1. Create `onUpdateSheetName` prop in DataManagementView
2. Pass it from App.tsx
3. Implement handler in App.tsx that updates both:
   - Sheet name in the sheets array
   - DataSource name in the dataSource object

**Example Implementation in App.tsx**:
```typescript
const handleUpdateSheetName = (spaceId: string, folderId: string, sheetId: string, newName: string) => {
  setSpaces(prev => {
    return prev.map(space => {
      if (space.id !== spaceId) return space;
      
      return {
        ...space,
        folders: space.folders.map(folder => {
          if (folder.id !== folderId) return folder;
          
          return {
            ...folder,
            sheets: folder.sheets.map(sheet => {
              if (sheet.id !== sheetId) return sheet;
              
              return {
                ...sheet,
                name: newName,
                dataSource: sheet.dataSource ? {
                  ...sheet.dataSource,
                  name: newName
                } : undefined
              };
            })
          };
        })
      };
    });
  });
  
  toast.success(`Sheet renamed to "${newName}"`);
};
```

---

### **PRIORITY 5: API Connection Data Source Type (FUTURE)**

**Status**: Not implemented yet (placeholder in interface)

**Action Required** (when API integration feature is built):
1. Add UI for users to set up API connections
2. Create API connection capture flow
3. Store API metadata:
   - Endpoint URL
   - Authentication type
   - Last sync timestamp
   - Status (active/inactive)
4. Create sheets from API connections with proper DataSource

**Example API DataSource**:
```typescript
{
  type: 'api',
  name: 'Salesforce Pipeline',
  captureDate: new Date(),
  capturedBy: 'Current User',
  folder: 'Sales Data',
  space: 'Q4 Sales',
  apiConnection: {
    endpoint: 'https://api.salesforce.com/v1/pipeline',
    lastSync: new Date(),
    status: 'active'
  }
}
```

---

## Testing Checklist

After implementing the above tasks, test the following workflows:

### ✅ Basic Functionality
- [ ] Click "View Source Data" button - sidebar opens
- [ ] Click "Hide Source Data" button - sidebar closes
- [ ] Switch between sheet tabs - sidebar updates to show correct source
- [ ] Click data source name in sidebar - can edit name
- [ ] Press Enter/click away - name updates both sheet and data source

### ��� Capture Flow
- [ ] Capture screenshot → Click "Capture Data" → Sheet created with screenshot data source
- [ ] Add share link → Click "Capture Data" → Sheet created with link data source
- [ ] Upload file → Click "Capture Data" → Sheet created with file data source
- [ ] Capture 3 items → Click "Capture Data" → 3 sheets created, each with correct data source

### ✅ Data Source Display
- [ ] Screenshot: Shows preview image, can expand to fullscreen
- [ ] Link: Shows URL, can click to open in new tab
- [ ] File: Shows file name, size, type
- [ ] All types: Show metadata (date, creator, folder, space, tags, LLMs)

### ✅ Sidebar Behavior
- [ ] Sidebar persists when switching tabs
- [ ] Sidebar compresses spreadsheet (not fullscreen mode)
- [ ] Close button closes sidebar
- [ ] Pressing ESC closes sidebar (if implemented)

### ✅ Mock Data
- [ ] All existing sheets have data sources
- [ ] Mix of all data source types visible
- [ ] Tags display correctly
- [ ] "Sent to LLMs" displays correctly

---

## Architecture Notes

### Why This Design?

1. **1:1 Relationship**: One sheet per data source ensures clarity
2. **Provenance Tracking**: Easy to trace where data came from
3. **AI Searchability**: Clean data structure for AI to understand
4. **User Experience**: Users can easily verify data accuracy by checking source

### Data Flow

```
Capture Item (FloatingCaptureToolbar)
  ↓
CaptureItem with metadata
  ↓
Click "Capture Data"
  ↓
handleStartAnalysis creates Sheet + DataSource
  ↓
Sheet stored in Space → Folder → sheets[]
  ↓
User views in DataManagementView
  ↓
Clicks "View Source Data"
  ↓
DataSourceSidebar displays source info
```

---

## File Structure

### New Files Created
- `/components/DataSourceSidebar.tsx` - Sidebar component
- `/DATA_SOURCE_FEATURE_NOTES_FOR_REPLIT.md` - This document

### Modified Files
- `/components/ProjectBrowser.tsx` - Extended Sheet interface
- `/components/FileNavigationBar.tsx` - Added "View Source Data" button
- `/components/DataManagementView.tsx` - Integrated sidebar

### Files That Need Modification
- `/App.tsx` - Add DataSource creation logic
- `/App.tsx` - Add mock data sources to initialSpaces
- `/App.tsx` - Implement name editing handler

---

## Summary

The foundation for the Data Source feature is complete. The UI is built and ready. The main tasks remaining are:

1. Connect the capture flow to create DataSource objects
2. Add mock data to existing sheets for demo purposes
3. Handle edge cases (multi-sheet files, name editing)
4. Test thoroughly

This feature will significantly improve the user experience by providing clear provenance for all data in the system and enabling users to easily verify data accuracy.

**Key Principle to Remember**: One data source per sheet. Keep it clean, keep it trackable, keep it searchable.