# 🔴 CRITICAL: Analysis Settings Synchronization

## ⚠️ READ THIS BEFORE MODIFYING ANALYSIS PREFERENCES

This document explains how **capture analysis preferences** (one-time analysis, LLM integration, scheduled analysis) are synchronized between the Data Capture Preferences modal and the Data Management & Analysis view.

---

## What Are Analysis Settings?

Analysis settings are preferences that users configure for each captured data source:

- **One-time Analysis**: Analyze data once when uploaded
- **LLM Integration**: Send data to ChatGPT, Claude, or other LLM providers
- **Scheduled Analysis**: Automatically analyze data on a schedule (daily, weekly, monthly)
- **API Integration**: Connect to external APIs for data processing

---

## The Two-View Sync System

### 1. **CaptureOptionsModal** - Data Capture Preferences
- **Location**: Modal that appears when clicking "Capture Data" button
- **Function**: Users configure analysis preferences for each capture
- **Key Features**:
  - Select analysis type (one-time, scheduled, LLM, API)
  - Choose LLM provider (ChatGPT, Claude, etc.)
  - Set schedule frequency and time
  - Assign captures to project folders

### 2. **DataManagementView + ProjectBrowser** - Data Management & Analysis
- **Location**: Main data management page with Projects sidebar
- **Function**: Users view and edit analysis preferences for saved captures
- **Key Features**:
  - Display analysis settings in sidebar (🧠 ChatGPT, ⏰ Daily, ⚡ One-time)
  - Display analysis settings in breadcrumb/header
  - Click to edit settings (planned feature)

---

## Data Structure

### Sheet Interface (ProjectBrowser.tsx)

```typescript
interface Sheet {
  id: string;
  name: string;
  rowCount: number;
  lastModified: string;
  // ⚠️ SYNCED: Analysis preferences from CaptureOptionsModal
  analysisType?: 'one-time' | 'scheduled' | 'llm-integration' | 'api' | null;
  llmProvider?: { id: string; name: string };
  schedule?: { frequency: string; time: string };
}
```

### CaptureAnalysisSettings (CaptureOptionsModal.tsx)

```typescript
export interface CaptureAnalysisSettings {
  captureId: string;
  analysisType: 'one-time' | 'scheduled' | 'llm-integration' | 'api' | null;
  llmProvider?: { id: string; name: string };
  schedule?: { frequency: string; time: string };
}
```

**⚠️ IMPORTANT**: These two interfaces must stay in sync!

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│              CaptureOptionsModal                             │
│  User configures analysis preferences for captures          │
│                                                               │
│  State:                                                       │
│  - captureOneTimeMappings: Set<captureId>                   │
│  - captureLlmMappings: Record<captureId, llmId>             │
│  - captureScheduleMappings: Record<captureId, schedule>     │
│  - llmProviders: LLMProvider[]                              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
            onStartAnalysis({ destinations, analysisSettings })
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                     App.tsx                                  │
│  handleStartAnalysis receives analysis settings              │
│                                                               │
│  For each capture:                                           │
│  1. Get analysis settings from analysisSettings array       │
│  2. Create sheet with:                                       │
│     - analysisType                                           │
│     - llmProvider                                            │
│     - schedule                                               │
│  3. Add sheet to project folder                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
                Projects state updated
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
┌──────────────────┐          ┌──────────────────┐
│  ProjectBrowser  │          │ DataManagement   │
│                  │          │      View        │
│  Displays:       │          │                  │
│  🧠 ChatGPT      │          │  Displays:       │
│  ⏰ Daily        │          │  in breadcrumb   │
│  ⚡ One-time     │          │  (editable)      │
└──────────────────┘          └──────────────────┘
```

---

## Step-by-Step Flow

### When User Configures Analysis Settings

1. **User opens CaptureOptionsModal**
   - Sees list of captures to configure

2. **User selects "Send to your LLM"**
   - Modal updates `captureLlmMappings[captureId] = 'chatgpt'`
   - UI shows "🧠 ChatGPT" badge next to capture

3. **User clicks "Upload & Analyze Data"**
   - Modal builds `analysisSettings` array from mappings:
     ```typescript
     const analysisSettings: CaptureAnalysisSettings[] = captureItems.map(item => ({
       captureId: item.id,
       analysisType: captureLlmMappings[item.id] ? 'llm-integration' : 
                     captureScheduleMappings[item.id] ? 'scheduled' :
                     captureOneTimeMappings.has(item.id) ? 'one-time' : null,
       llmProvider: llmProviders.find(p => p.id === captureLlmMappings[item.id]),
       schedule: captureScheduleMappings[item.id]
     }));
     ```
   - Calls `onStartAnalysis({ destinations, analysisSettings })`

4. **App.tsx receives and processes**
   ```typescript
   const handleStartAnalysis = (data) => {
     const { destinations, analysisSettings } = data;
     
     captureItems.forEach((item, index) => {
       const settings = analysisSettings[index];
       const newSheet = {
         id: `sheet-${Date.now()}-${index}`,
         name: item.name,
         rowCount: 120,
         lastModified: 'Just now',
         // ⚠️ Store analysis settings
         analysisType: settings?.analysisType || null,
         llmProvider: settings?.llmProvider,
         schedule: settings?.schedule
       };
       // Add to project folder...
     });
   };
   ```

5. **Settings appear in DataManagementView**
   - **ProjectBrowser sidebar**:
     ```
     Capture 1 | Nov 9, 2025 09:48 AM
     120 rows
     🧠 ChatGPT • ⏰ Daily
     ```
   
   - **Breadcrumb header**:
     ```
     Q4 Marketing Analysis / Test Folder / Capture 1 | Nov 9, 2025 09:48 AM
     120 rows • Last modified Just now • 🧠 ChatGPT • ⏰ Daily
     ```

---

## Critical Synchronization Points

### ✅ Files That Must Stay In Sync

1. **ProjectBrowser.tsx** - `Sheet` interface
   - Defines the structure for storing analysis settings

2. **CaptureOptionsModal.tsx** - `CaptureAnalysisSettings` interface
   - Defines the structure for passing analysis settings

3. **App.tsx** - `handleStartAnalysis`
   - Maps `CaptureAnalysisSettings` → `Sheet` properties

4. **DataManagementView.tsx** - Display logic
   - Renders analysis settings in breadcrumb

5. **ProjectBrowser.tsx** - Display logic
   - Renders analysis settings in sheet list

---

## Display Icons & Colors

```typescript
// LLM Integration
🧠 ChatGPT / Claude / etc.
Color: #FF6B35 (Primary Orange)

// Scheduled Analysis
⏰ Daily / Weekly / Monthly
Color: #60A5FA (Blue)

// One-time Analysis
⚡ One-time
Color: #10B981 (Green)
```

---

## Future: Editing Analysis Settings

Currently, analysis settings display but aren't editable in DataManagementView. To add editing:

1. **Add click handlers** in DataManagementView breadcrumb
2. **Show edit dialog/modal** with current settings
3. **Call `onUpdateSheetAnalysis`** handler:
   ```typescript
   handleUpdateSheetAnalysis(
     projectId,
     folderId, 
     sheetId,
     {
       analysisType: 'llm-integration',
       llmProvider: { id: 'claude', name: 'Claude' },
       schedule: undefined
     }
   );
   ```
4. **Update projects state** in App.tsx
5. **UI automatically reflects** changes via React state

---

## Testing Checklist

After making changes to analysis settings:

- [ ] Configure one-time analysis in CaptureOptionsModal
  - [ ] Verify "⚡ One-time" appears in ProjectBrowser
  - [ ] Verify "⚡ One-time analysis" appears in breadcrumb

- [ ] Configure LLM integration in CaptureOptionsModal
  - [ ] Verify "🧠 ChatGPT" appears in ProjectBrowser
  - [ ] Verify "🧠 ChatGPT" appears in breadcrumb
  - [ ] Test with different providers (Claude, etc.)

- [ ] Configure scheduled analysis in CaptureOptionsModal
  - [ ] Verify "⏰ Daily" appears in ProjectBrowser
  - [ ] Verify "⏰ Daily" appears in breadcrumb
  - [ ] Test different frequencies (Weekly, Monthly)

- [ ] Configure multiple settings for same capture
  - [ ] Verify both "🧠 ChatGPT • ⏰ Daily" appear together

- [ ] Refresh page / navigate away and back
  - [ ] Verify settings persist (currently session-only)

---

## Common Issues

### Issue: "Analysis settings configured in modal don't appear in sidebar"
**Cause**: `analysisSettings` not being passed to `onStartAnalysis`  
**Fix**: Ensure CaptureOptionsModal builds and passes `analysisSettings` array

### Issue: "Settings display wrong LLM provider"
**Cause**: Mismatch between `captureLlmMappings` and `llmProviders` array  
**Fix**: Verify `llmProviders.find(p => p.id === captureLlmMappings[item.id])` finds correct provider

### Issue: "Schedule shows 'undefined' instead of 'Daily'"
**Cause**: Schedule object structure mismatch  
**Fix**: Ensure schedule object has `{ frequency: 'daily', time: '09:00' }` structure

### Issue: "Settings disappear after page refresh"
**Cause**: Settings only stored in React state, not persisted  
**Fix**: Add localStorage or backend persistence (future enhancement)

---

## Adding a New Analysis Type

Let's say you want to add "API Integration" analysis type:

### 1. Update Type Definitions

```typescript
// In ProjectBrowser.tsx
interface Sheet {
  analysisType?: 'one-time' | 'scheduled' | 'llm-integration' | 'api' | null;
  apiEndpoint?: string; // NEW
}

// In CaptureOptionsModal.tsx
export interface CaptureAnalysisSettings {
  analysisType: 'one-time' | 'scheduled' | 'llm-integration' | 'api' | null;
  apiEndpoint?: string; // NEW
}
```

### 2. Add State in CaptureOptionsModal

```typescript
const [captureApiMappings, setCaptureApiMappings] = useState<Record<string, string>>({});
```

### 3. Update analysisSettings Builder

```typescript
const analysisSettings: CaptureAnalysisSettings[] = captureItems.map(item => {
  let analysisType = null;
  
  if (captureOneTimeMappings.has(item.id)) analysisType = 'one-time';
  else if (captureLlmMappings[item.id]) analysisType = 'llm-integration';
  else if (captureScheduleMappings[item.id]) analysisType = 'scheduled';
  else if (captureApiMappings[item.id]) analysisType = 'api'; // NEW
  
  return {
    captureId: item.id,
    analysisType,
    llmProvider: captureLlmMappings[item.id] ? llmProviders.find(...) : undefined,
    schedule: captureScheduleMappings[item.id],
    apiEndpoint: captureApiMappings[item.id] // NEW
  };
});
```

### 4. Update handleStartAnalysis

```typescript
const newSheet = {
  // ...existing fields...
  analysisType: settings?.analysisType || null,
  llmProvider: settings?.llmProvider,
  schedule: settings?.schedule,
  apiEndpoint: settings?.apiEndpoint // NEW
};
```

### 5. Update Display Logic

```typescript
// In ProjectBrowser.tsx
{sheet.analysisType === 'api' && (
  <span className="text-[9px] text-[#A855F7]">
    🔌 API
  </span>
)}
```

### 6. Update handleUpdateSheetAnalysis

```typescript
const handleUpdateSheetAnalysis = (projectId, folderId, sheetId, settings) => {
  setProjects(prev => prev.map(project => {
    // ...existing mapping...
    return {
      ...sheet,
      analysisType: settings.analysisType !== undefined ? settings.analysisType : sheet.analysisType,
      llmProvider: settings.llmProvider !== undefined ? settings.llmProvider : sheet.llmProvider,
      schedule: settings.schedule !== undefined ? settings.schedule : sheet.schedule,
      apiEndpoint: settings.apiEndpoint !== undefined ? settings.apiEndpoint : sheet.apiEndpoint // NEW
    };
  }));
};
```

---

## Architecture Diagram

```
CaptureOptionsModal State:
┌─────────────────────────────────────┐
│ captureOneTimeMappings: Set         │
│ captureLlmMappings: Record          │
│ captureScheduleMappings: Record     │
│ llmProviders: Array                 │
└──────────────┬──────────────────────┘
               │
               │ onClick "Upload & Analyze"
               ▼
   Build CaptureAnalysisSettings[]
               │
               ▼
┌─────────────────────────────────────┐
│ onStartAnalysis({                    │
│   destinations: [...],               │
│   analysisSettings: [                │
│     {                                │
│       captureId: 'cap-1',            │
│       analysisType: 'llm-integration'│
│       llmProvider: {                 │
│         id: 'chatgpt',               │
│         name: 'ChatGPT'              │
│       }                              │
│     }                                │
│   ]                                  │
│ })                                   │
└──────────────┬──────────────────────┘
               │
               ▼
        App.tsx receives
               │
               ▼
┌─────────────────────────────────────┐
│ For each capture:                    │
│   const settings = analysisSettings │
│   const sheet = {                    │
│     analysisType: settings.type,     │
│     llmProvider: settings.provider,  │
│     schedule: settings.schedule      │
│   }                                  │
│   Add to projects state              │
└──────────────┬──────────────────────┘
               │
               ▼
     Projects State Updated
               │
       ┌───────┴────────┐
       ▼                ▼
ProjectBrowser    DataManagementView
  Displays           Displays
 🧠 ChatGPT        in Header
```

---

**Last Updated**: November 2025  
**Maintained By**: Development Team  
**Importance**: 🔴 CRITICAL - Affects user workflow between views
