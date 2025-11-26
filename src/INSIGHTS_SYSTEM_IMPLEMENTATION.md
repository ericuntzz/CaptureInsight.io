# INSIGHTS SYSTEM - COMPREHENSIVE IMPLEMENTATION GUIDE FOR REPLIT

## 📋 Table of Contents
1. [Executive Summary](#executive-summary)
2. [System Architecture Overview](#system-architecture-overview)
3. [Feature Interconnections](#feature-interconnections)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Completed Implementation (Phases 1-7)](#completed-implementation)
6. [To Implement (Phase 8+)](#to-implement-replitcom)
7. [Quick Start Guide for Replit](#quick-start-guide-for-replit)
8. [Testing & Validation](#testing-requirements)
9. [Deployment Checklist](#deployment-checklist)

---

## Executive Summary

**What Is This System?**

The Insights system is CaptureInsight's knowledge management backbone. It allows users to:
1. **Capture** data from dashboards/spreadsheets with tags
2. **Tag** AI chat conversations about specific insights
3. **Promote** tagged items to formal "Insights" (shareable cards)
4. **Comment** on insights with threading and @mentions
5. **Search** across all tagged content (chats, data, change logs)
6. **Navigate** via deep links to any insight, data sheet, or chat message

**Why Does This Matter?**

CaptureInsight's value proposition is building a database that an AI Analyst Assistant can reference for business insights across multiple data sources. The Insights system is the connective tissue that:
- Links AI conversations to the specific data they discuss
- Preserves context when data changes over time (via Change Logs)
- Makes knowledge discoverable through tags and search
- Enables collaboration through comments and assignments

**Key Innovation:**

Unlike traditional BI tools, CaptureInsight doesn't require API connections. Users capture screenshots/data from existing tools, and the Insights system ensures those captures remain connected to the analysis and decisions made about them.

---

## System Architecture Overview

### 🏗️ Architectural Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERFACE LAYER                     │
│  (Navigation, Views, Modals, Floating Toolbars)             │
├─────────────────────────────────────────────────────────────┤
│                    APPLICATION LOGIC LAYER                   │
│  (React Components, Hooks, State Management)                │
├─────────────────────────────────────────────���───────────────┤
│                      DATA ACCESS LAYER                       │
│  (API Functions, Mock Data, Supabase Integration Points)    │
├─────────────────────────────────────────────────────────────┤
│                      DATABASE LAYER                          │
│  (TypeScript Interfaces → Supabase Tables)                  │
└─────────────────────────────────────────────────────────────┘
```

### 🗄️ Core Entities

**1. Tags** (`/types/database.ts` → `Tag`)
- Central organizing principle
- Belong to a Space (space-scoped)
- Have unique names (case-insensitive) and colors
- Can be applied to ANY entity via tag_associations

**2. Insights** (`/types/database.ts` → `Insight`)
- Promoted/elevated knowledge cards
- Have status (Open/Closed), priority, assignment
- Can have multiple sources (data sheets, chats, change logs)
- Support comments with threading and @mentions

**3. Tag Associations** (`/types/database.ts` → `TagAssociation`)
- Many-to-many relationship table
- Links tags to entities of any type
- Entity types: 'insight', 'data_sheet', 'chat_message', 'change_log'
- Enables universal search across all tagged content

**4. Insight Sources** (`/types/database.ts` → `InsightSource`)
- Links insights back to original content
- Source types: 'data_sheet', 'change_log', 'ai_chat'
- Preserves context: "This insight was derived from these data captures"

**5. Comments** (`/types/database.ts` → `InsightComment`)
- Threaded discussions on insights
- Support @mentions for notifications
- Can include markdown formatting

### 🔄 Space-Scoped Architecture

**CRITICAL CONCEPT:** CaptureInsight uses a Space-based architecture inspired by Slack workspaces.

```
Space (e.g., "Q4 Marketing Analysis")
  ├── Folders (e.g., "HubSpot Data", "Google Ads Data")
  │   └── Data Sheets (captured data/screenshots)
  ├── Tags (unique per Space)
  ├── Insights (belong to Space)
  ├── Change Logs (track data updates per Space)
  └── AI Chat History (Space-specific context)
```

**Why Space-Scoped?**
- Different teams/projects have different tagging taxonomies
- Prevents tag pollution ("Revenue" in Marketing ≠ "Revenue" in Sales)
- AI Assistant context is Space-specific
- Permissions can be managed per Space (future)

**Current Space Tracking:**
- `currentSpaceId` state in `App.tsx` (line ~100)
- Space switcher dropdown in upper-left navigation (future component)
- All API calls should filter by `currentSpaceId`

---

## Feature Interconnections

### 🔗 How Everything Works Together

**SCENARIO 1: User Captures Data and Analyzes It**

1. **Capture Flow** (FloatingCaptureToolbar.tsx)
   - User clicks "Capture Region" on floating toolbar
   - Selects area on screen (their dashboard/spreadsheet)
   - MUST add tags (required) → Opens TagsPopup
   - Assigns to Space/Folder → Opens CaptureAssignmentPanel
   - Capture saved as "Data Sheet" with tags

2. **AI Chat Flow** (AIAssistantPanel.tsx)
   - User asks AI: "What's our CAC trend in this data?"
   - AI responds with analysis
   - User clicks "Tag Chat" button
   - Selects relevant chat bubbles (question + answer)
   - Assigns same tags as the data capture
   - Prompt: "Create Insight?" → Yes

3. **Insight Creation Flow** (CreateInsightCard.tsx)
   - Floating card appears with AI-generated summary
   - User edits title, adds status/priority
   - Links to source: Selects the data sheet from step 1
   - Saves Insight

4. **Result:**
   - Insight appears on Insights page (/insights)
   - Clicking insight shows linked data sheet and chat messages
   - Clicking "View Original" on data sheet opens the capture
   - Clicking chat source scrolls to tagged messages
   - All items share tags → searchable via UniversalTagSearch

**SCENARIO 2: Team Collaboration on Insight**

1. **Discovery** (InsightsView.tsx)
   - Teammate navigates to /insights
   - Filters by tag: "Q4-Performance"
   - Finds insight: "CAC increased 15% in October"

2. **Deep Link** (URL Routing)
   - Clicks insight → URL becomes /insights/insight-123
   - Shares URL with manager in Slack
   - Manager clicks → directly opens that insight

3. **Discussion** (InsightDetailView - future component)
   - Manager adds comment: "@john can you verify this data?"
   - John receives notification (comment_mentions table)
   - John clicks notification → opens insight, scrolls to comment
   - John replies: "Verified against Stripe dashboard"

4. **Resolution** (Insight Status Change)
   - Manager marks insight as "Closed"
   - Kanban view moves card to "Closed" column
   - Insight marked with green checkmark

**SCENARIO 3: Data Changes Over Time**

1. **Original Capture**
   - User captures October data: "Revenue: $50K"
   - Tags: ["Revenue", "October"]
   - Creates insight: "Strong month!"

2. **Data Update** (Change Logs)
   - November data captured: "Revenue: $65K"
   - User clicks "Log Change" on October data sheet
   - Creates change log: "Revenue increased to $65K"
   - Change log inherits tags: ["Revenue", "October"]

3. **Context Preservation**
   - Insight still links to October capture (original context)
   - Change log links to November capture (updated data)
   - Both show up in UniversalTagSearch for "Revenue"
   - AI Assistant can reference both: "Revenue was $50K in Oct, now $65K"

### 🎯 Tag System as Universal Connector

Tags are the "glue" that connects everything:

```
Tag: "Q4-Campaign"
  ├── Applied to: Data Sheet (Google Ads spend)
  ├── Applied to: AI Chat (Discussion about ad performance)
  ├── Applied to: Insight ("Google Ads ROI declining")
  └── Applied to: Change Log (Updated ad spend data)

Result: Searching "Q4-Campaign" finds ALL related content
```

**Tag Usage Across Features:**

| Feature | Tag Application Point | Purpose |
|---------|----------------------|---------|
| Capture | FloatingCaptureToolbar | Organize captured data |
| Data Sheets | Inherit from capture | Make data searchable |
| AI Chat | Tag Chat button | Connect analysis to data |
| Insights | Tag selector in creation | Categorize knowledge |
| Change Logs | Inherit from data sheet | Track related changes |
| Search | UniversalTagSearch | Find everything with tag |

---

## Data Flow Diagrams

### 📊 Create Insight from AI Chat (End-to-End)

```
┌──────────────┐
│  User Types  │
│  Question    │
└──────┬───────┘
       │
       v
┌──────────────────┐
│  AI Responds     │
│  (Chat Message)  │
└──────┬───────────┘
       │
       v
┌──────────────────┐
│ User Clicks      │
│ "Tag Chat"       │
└──────┬───────────┘
       │
       v
┌──────────────────────────────┐
│ User Selects Bubbles         │
│ (Sets message.isSelected)    │
└──────┬───────────────────────┘
       │
       v
┌──────────────────────────────┐
│ User Picks Tags              │
│ (TagSelector component)      │
└──────┬───────────────────────┘
       │
       v
┌──────────────────────────────┐
│ Prompt: "Create Insight?"    │
│ (Confirm dialog)             │
└──────┬───────────────────────┘
       │ [Yes]
       v
┌──────────────────────────────────────┐
│ CreateInsightCard Opens              │
│ - AI generates summary               │
│ - Selected messages as sources       │
│ - Pre-filled tags                    │
└──────┬───────────────────────────────┘
       │
       v
┌──────────────────────────────────────┐
│ User Edits & Saves                   │
│ - Title, status, priority            │
│ - Can add more sources               │
└──────┬───────────────────────────────┘
       │
       v
┌──────────────────────────────────────┐
│ API: createInsight()                 │
│ - Creates Insight record             │
│ - Creates InsightSource records      │
│ - Creates TagAssociation records     │
│ - Updates message.insightId          │
└──────┬───────────────────────────────┘
       │
       v
┌──────────────────────────────────────┐
│ Insight Appears in InsightsView      │
│ - Clickable to view detail           │
│ - Shows tags, sources, status        │
└──────────────────────────────────────┘
```

### 🔍 Universal Tag Search Flow

```
┌──────────────────┐
│ User Types Query │
│ in Search Input  │
└────────┬─────────┘
         │
         v
┌─────────────────────────────────────┐
│ UniversalTagSearch Component        │
│ - Debounces input (300ms)           │
│ - Reads active filters              │
└────────┬────────────────────────────┘
         │
         v
┌─────────────────────────────────────┐
│ API: searchTaggedItems()            │
│ - Query: "revenue"                  │
│ - Filters: ["insight", "data_sheet"]│
│ - Space: currentSpaceId             │
└────────┬────────────────────────────┘
         │
         v
┌─────────────────────────────────────────────────┐
│ Database Query (Supabase)                       │
│ SELECT * FROM tag_associations                  │
│ WHERE space_id = ? AND entity_type IN (?)       │
│ AND tag_id IN (SELECT id FROM tags              │
│                WHERE name ILIKE '%revenue%')    │
└────────┬────────────────────────────────────────┘
         │
         v
┌─────────────────────────────────────────────────┐
│ Join with Entity Tables                         │
│ - insights table (for entity_type = 'insight')  │
│ - data_sheets table (for 'data_sheet')          │
└────────┬────────────────────────────────────────┘
         │
         v
┌─────────────────────────────────────────────────┐
│ Return Unified Results                          │
│ [                                               │
│   {                                             │
│     entityType: 'insight',                      │
│     entityId: 'insight-1',                      │
│     name: 'Revenue Declining',                  │
│     preview: 'Our Q4 revenue...',               │
│     tags: [{name: 'Revenue', color: '#FF6B35'}],│
│     metadata: { status: 'open', created: ... }  │
│   },                                            │
│   { ... }                                       │
│ ]                                               │
└────────┬────────────────────────────────────────┘
         │
         v
┌─────────────────────────────────────────────────┐
│ Render Result Cards                             │
│ - Each card shows entity type badge             │
│ - Click card → navigate to detail view          │
│ - Shows relevant metadata per type              │
└─────────────────────────────────────────────────┘
```

### 🔄 Tag Cascade Delete Flow

```
User Clicks "Delete Tag"
         │
         v
┌─────────────────────────────────────┐
│ API: getTagUsageStats(tagId)        │
│ - Counts associations by type       │
└────────┬────────────────────────────┘
         │
         v
┌─────────────────────────────────────┐
│ TagDeleteConfirmDialog Shows        │
│ "This tag is used in:               │
│  - 5 Insights                       │
│  - 12 Data Sheets                   │
│  - 3 AI Chats"                      │
└────────┬────────────────────────────┘
         │ [Confirm]
         v
┌─────────────────────────────────────┐
│ API: cascadeDeleteTag(tagId)        │
│ 1. DELETE FROM tag_associations     │
│    WHERE tag_id = ?                 │
│ 2. DELETE FROM tags WHERE id = ?    │
└────────┬────────────────────────────┘
         │
         v
┌─────────────────────────────────────┐
│ UI Updates                          │
│ - Tag removed from all components   │
│ - Insights update (re-render)       │
│ - Data sheets update                │
│ - Chat messages update              │
└─────────────────────────────────────┘
```

---

## ✅ COMPLETED IMPLEMENTATION (Phases 1-7)

### 📦 What's Already Built and Working

**IMPORTANT FOR REPLIT:** All components below are production-ready with mock data. They demonstrate the full user experience and UI/UX flows. Your task is to replace mock data calls with real Supabase queries.

### 1. Data Types & Mock Data (`/data/insightsData.ts`) ✅

**What It Contains:**
```typescript
// Core Types
export interface Tag {
  id: string;
  name: string;
  color: string;
  spaceId: string;
  createdAt: Date;
  createdBy: string;
}

export interface Insight {
  id: string;
  title: string;
  summary: string;
  status: 'open' | 'closed';
  priority: 'low' | 'medium' | 'high';
  assignedTo?: string;
  spaceId: string;
  createdAt: Date;
  createdBy: string;
}

export interface InsightSource {
  id: string;
  insightId: string;
  sourceType: 'data_sheet' | 'change_log' | 'ai_chat';
  sourceId: string;
  sourceName: string;
  sourceUrl?: string;
}

export interface InsightComment {
  id: string;
  insightId: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
  parentId?: string; // For threading
}

// Mock Data Arrays
export const mockTags: Tag[] = [ ... ];
export const mockInsights: Insight[] = [ ... ];
export const mockInsightSources: InsightSource[] = [ ... ];
export const mockInsightComments: InsightComment[] = [ ... ];
```

**Why Mock Data Exists:**
- Allows UI development without backend
- Demonstrates expected data shapes
- Provides realistic examples for testing
- **Replace with Supabase queries in Phase 8**

### 2. Database Type Definitions (`/types/database.ts`) ✅

**What It Contains:**
- TypeScript interfaces matching Supabase schema
- All table structures with proper relationships
- Helper types for API responses

**Key Tables:**
```typescript
// Tags table
export interface TagRecord {
  id: string;
  space_id: string;
  name: string;
  color: string;
  created_at: string;
  created_by: string;
}

// Tag associations (many-to-many)
export interface TagAssociationRecord {
  id: string;
  tag_id: string;
  entity_type: 'insight' | 'data_sheet' | 'chat_message' | 'change_log';
  entity_id: string;
  space_id: string;
  created_at: string;
}

// Insights table
export interface InsightRecord {
  id: string;
  space_id: string;
  title: string;
  summary: string;
  status: 'open' | 'closed';
  priority: 'low' | 'medium' | 'high';
  assigned_to: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
}

// Insight sources (many-to-many)
export interface InsightSourceRecord {
  id: string;
  insight_id: string;
  source_type: 'data_sheet' | 'change_log' | 'ai_chat';
  source_id: string;
  created_at: string;
}

// Insight comments
export interface InsightCommentRecord {
  id: string;
  insight_id: string;
  content: string;
  author_id: string;
  parent_id: string | null;
  created_at: string;
}

// Comment mentions (for @mentions)
export interface CommentMentionRecord {
  id: string;
  comment_id: string;
  mentioned_user_id: string;
  created_at: string;
}
```

**Usage:**
- Import these types in `/api/*.ts` files
- Use for Supabase query type annotations
- Ensures type safety across frontend/backend boundary

### 3. API Layer with Supabase Placeholders (`/api/tags.ts`, `/api/insights.ts`) ✅

**Tag API** (`/api/tags.ts`):
```typescript
// ✅ Fully implemented with mock data
// TODO: Replace with Supabase queries

export async function getTags(spaceId: string): Promise<Tag[]> {
  // TODO: Supabase query
  // const { data } = await supabase
  //   .from('tags')
  //   .select('*')
  //   .eq('space_id', spaceId);
  
  // Mock implementation
  return mockTags.filter(t => t.spaceId === spaceId);
}

export async function createTag(tag: Omit<Tag, 'id' | 'createdAt'>): Promise<Tag> {
  // TODO: Supabase insert
  // const { data } = await supabase
  //   .from('tags')
  //   .insert([{ ...tag, created_at: new Date().toISOString() }])
  //   .select()
  //   .single();
  
  // Mock implementation
  const newTag: Tag = {
    ...tag,
    id: `tag-${Date.now()}`,
    createdAt: new Date(),
  };
  return newTag;
}

// ... updateTag, deleteTag, addTagToEntity, removeTagFromEntity, etc.
```

**Insight API** (`/api/insights.ts`):
```typescript
// Similar structure to tags API
export async function getInsights(spaceId: string): Promise<Insight[]> { ... }
export async function createInsight(insight: Omit<Insight, 'id' | 'createdAt'>): Promise<Insight> { ... }
export async function updateInsight(insightId: string, updates: Partial<Insight>): Promise<Insight> { ... }
export async function deleteInsight(insightId: string): Promise<void> { ... }
export async function addInsightSource(source: Omit<InsightSource, 'id'>): Promise<InsightSource> { ... }
export async function getInsightSources(insightId: string): Promise<InsightSource[]> { ... }
export async function addComment(comment: Omit<InsightComment, 'id' | 'createdAt'>): Promise<InsightComment> { ... }
export async function getComments(insightId: string): Promise<InsightComment[]> { ... }
export async function searchTaggedItems(query: string, filters: SearchFilters): Promise<SearchResult[]> { ... }
```

**Why This Structure:**
- Clean separation of concerns
- Easy to test (mock returns)
- Easy to replace (swap implementation)
- Type-safe (TypeScript interfaces)
- **All TODO comments mark Supabase integration points**

### 4. React Hooks for Data Management (`/hooks/useTags.ts`, `/hooks/useInsights.ts`) ✅

**Tag Hooks** (`/hooks/useTags.ts`):
```typescript
// Main hook for tag management
export function useTags(spaceId: string) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTags(spaceId)
      .then(setTags)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [spaceId]);

  const addTag = async (tag: Omit<Tag, 'id' | 'createdAt'>) => {
    const newTag = await createTag(tag);
    setTags(prev => [...prev, newTag]);
    return newTag;
  };

  // ... updateTag, deleteTag methods

  return { tags, loading, error, addTag, updateTag, deleteTag };
}

// Hook for entity-specific tags
export function useEntityTags(entityType: string, entityId: string) {
  // Returns tags for a specific entity (insight, data sheet, etc.)
}

// Hook for tag usage statistics
export function useTagUsage(tagId: string) {
  // Returns usage counts across all entity types
}
```

**Insight Hooks** (`/hooks/useInsights.ts`):
```typescript
export function useInsights(spaceId: string) {
  // Similar structure to useTags
  // Manages insights, sources, comments
}

export function useInsightFilters() {
  // Manages filter state for Insights page
  // Status, priority, tags, assigned to, etc.
}
```

**Benefits:**
- Centralized data fetching logic
- Automatic re-renders on data changes
- Loading and error states handled
- Reusable across components

### 5. UI Components

#### 5.1 TagBadge (`/components/TagBadge.tsx`) ✅

**Purpose:** Display a tag with optional settings menu

**Features:**
- Pill-shaped badge with tag color
- Three-dot menu (Edit Name, Change Color, Delete)
- Click outside to close menu
- Inline name editing with Enter/Escape support
- Color picker grid (TAG_COLORS)
- Delete confirmation via TagDeleteConfirmDialog

**Usage:**
```typescript
<TagBadge
  tag={tag}
  onEdit={(tagId, newName) => updateTag(tagId, { name: newName })}
  onColorChange={(tagId, newColor) => updateTag(tagId, { color: newColor })}
  onDelete={(tagId) => deleteTag(tagId)}
  showMenu={true} // Optional, shows settings menu
/>
```

#### 5.2 TagSelector (`/components/TagSelector.tsx`) ✅

**Purpose:** Dropdown for selecting/creating tags

**Features:**
- Searchable dropdown
- Click tags to toggle selection
- "Add Tag" button for creating new tags
- Auto-assigns colors via getNextTagColor()
- Validates tag names (duplicates, length)
- Enter key to create tag
- Shows selected count badge

**Usage:**
```typescript
<TagSelector
  availableTags={allTags}
  selectedTags={selectedTags}
  onTagsChange={setSelectedTags}
  onCreateTag={(name) => createTag({ name, spaceId, ... })}
/>
```

#### 5.3 InsightsView (`/components/InsightsView.tsx`) ✅

**Purpose:** Main page for viewing/managing insights

**Features:**
- Two view modes: Row (list) and Kanban (columns)
- Filter by status, priority, tags, assigned to
- Search by title/summary
- Click insight card to open detail view (future)
- Status indicator dots (orange = open, green = closed)
- Tag badges on each card
- Source count indicator
- Empty states with helpful messages

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  Insights Header                                │
│  [Manual Insight +] [Row/Kanban Toggle]         │
├─────────────────────────────────────────────────┤
│  Filters:  [Status ▾] [Priority ▾] [Tags ▾]     │
├─────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐              │
│  │  Insight 1  │  │  Insight 2  │              │
│  │  [Tags]     │  │  [Tags]     │              │
│  │  Status: ●  │  │  Status: ●  │              │
│  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────┘
```

**Kanban View:**
```
┌──────────┬──────────┬──────────┬──────────┐
│  Open    │  Closed  │  High    │  To Do   │
│          │          │ Priority │          │
├──────────┼──────────┼──────────┼──────────┤
│ Card 1   │ Card 3   │ Card 5   │ Card 7   │
│ Card 2   │ Card 4   │ Card 6   │          │
└──────────┴──────────┴──────────┴──────────┘
```

#### 5.4 CreateInsightCard (`/components/CreateInsightCard.tsx`) ✅

**Purpose:** Floating card for creating insights (from AI chat or manual)

**Features:**
- AI-generated summary (simulated in mock)
- Title input (required)
- Status dropdown (open/closed)
- Priority dropdown (low/medium/high)
- Assigned to dropdown (future: user list)
- Tag selector (pre-filled from chat messages)
- Source linking tabs (Data Sheets, Change Logs, AI Chats)
- Search sources with click to add/remove
- Save button creates insight + sources + tag associations

**Trigger Points:**
1. After tagging AI chat messages (prompt: "Create Insight?")
2. Clicking "+" button on Insights page (manual creation via ManualInsightDialog)

#### 5.5 ManualInsightDialog (`/components/ManualInsightDialog.tsx`) ✅

**Purpose:** Full-screen dialog for creating insights manually

**Features:**
- Same functionality as CreateInsightCard
- Larger layout for detailed input
- Tabbed source linking interface
- Comment input section (for initial comment)
- Cancel/Save buttons

#### 5.6 TagDeleteConfirmDialog (`/components/TagDeleteConfirmDialog.tsx`) ✅

**Purpose:** Confirmation dialog before deleting a tag

**Features:**
- Shows tag usage statistics
- Warning banner if tag is in use
- Lists affected entities by type
- "Delete Anyway" button
- Cancel button

**Logic:**
```typescript
// Before showing dialog
const stats = await getTagUsageStats(tagId);
// stats = { insights: 5, dataSheets: 12, chatMessages: 3, changeLogs: 0 }

// If user confirms:
await cascadeDeleteTag(tagId);
// Removes tag from all entities and deletes tag record
```

#### 5.7 TagManagementView (`/components/TagManagementView.tsx`) ✅

**Purpose:** Central page for managing all tags in a Space

**Features:**
- List of all tags with colors
- Click tag to view detail panel
- Detail panel shows usage stats
- "Recent Activity" section (recently tagged items)
- Create new tag button
- Edit/delete tags inline
- Search tags by name

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  Tag Management                     [+ New Tag] │
├─────────────────┬───────────────────────────────┤
│  Tag List       │  Tag Detail Panel             │
│                 │                               │
│  ● Marketing    │  Tag: Marketing               │
│  ● Revenue      │  Used in:                     │
│  ● Q4-Campaign  │    - 5 Insights               │
│                 │    - 12 Data Sheets           │
│                 │                               │
│                 │  Recent Activity:             │
│                 │    - Insight "..." (2h ago)   │
│                 │    - Data Sheet "..." (1d ago)│
└─────────────────┴───────────────────────────────┘
```

#### 5.8 UniversalTagSearch (`/components/UniversalTagSearch.tsx`) ✅

**Purpose:** Search across all tagged entities

**Features:**
- Text search input with debounce (300ms)
- Filter by entity type (insights, data sheets, chats, change logs)
- Filter by tags (multi-select)
- Unified result cards showing:
  - Entity type badge
  - Entity name
  - Preview text
  - Tags
  - Metadata (created date, author, etc.)
- Click result to navigate to entity detail view
- Loading states during search
- Empty state if no results

**Search Flow:**
```
User types "revenue" → Debounce 300ms → API: searchTaggedItems()
→ Results: [
    { type: 'insight', name: 'Revenue Declining', preview: '...' },
    { type: 'data_sheet', name: 'Q4 Revenue Data', preview: '...' },
    { type: 'chat_message', name: 'Chat about revenue', preview: '...' }
  ]
→ Render result cards
```

### 6. PHASE 1: AI Chat Tagging System (`/components/AIAssistantPanel.tsx`) ✅

**What Was Added:**
- `Message` interface updated with `tags`, `insightId`, `isSelected` fields
- "Tag Chat" button (appears after first user message)
- Chat bubble selection UI (circles appear on hover)
- Orange border on selected bubbles
- Tag assignment flow (select bubbles → pick tags → prompt to create insight)
- CreateInsightCard integration
- Warning before deleting tagged chat history
- Tag badges display below message content

**User Flow:**
```
1. User chats with AI about data
2. Clicks "Tag Chat" button
3. Selects relevant message bubbles (multi-select)
4. Clicks tag to apply to selected messages
5. Prompt: "Create an insight from these messages?"
6. If yes: CreateInsightCard opens with:
   - Selected messages as sources
   - Tags pre-filled
   - AI-generated summary
7. User saves insight
8. Messages show tag badges and link to insight
```

### 7. PHASE 2: Floating Capture Menu - Tags Field (`/components/FloatingCaptureToolbar.tsx`) ✅

**What Was Added:**
- "Tags (Required)" button between "Save To" and "Upload Type"
- TagsPopup component with tag selection/creation
- Orange dot indicator when tags selected
- "Required" badge on button (enforces tagging before capture)
- Multi-tag support (select multiple tags)
- Tag creation inline with color auto-assignment

**User Flow:**
```
1. User clicks "Capture Region"
2. Selects area on screen
3. MUST click "Tags (Required)" button
4. TagsPopup opens with existing tags
5. User selects tags or creates new ones
6. Tags displayed on button with count badge
7. User assigns to folder (CaptureAssignmentPanel)
8. Capture saved with tags → Data sheet inherits tags
```

**Why Tags Are Required:**
- Core to searchability
- Ensures organized data
- Enables AI Assistant context
- Prevents untagged "orphan" data

### 8. PHASE 3: Insights Page Features ✅

**Manual Insight Creation:**
- Floating "+" button on Insights page
- Opens ManualInsightDialog
- Same fields as CreateInsightCard
- Can be created without AI chat (manual knowledge entry)

**Source Linking:**
- Tabbed interface (Data Sheets | Change Logs | AI Chats)
- Search within each source type
- Click to add/remove sources
- Selected sources displayed with remove button
- Saves as InsightSource records

**Status Transitions:**
- Toggle button (Open ↔ Closed)
- Visual indicators (orange dot = open, green checkmark = closed)
- Kanban view automatically moves cards between columns
- Can filter by status in Row view

**Comments System:**
- Comment input below insight details
- Displays existing comments in thread
- Threading UI (left border for child comments)
- @mention placeholder (full autocomplete pending backend)

### 9. PHASE 4: Tag System Core (`/utils/tagUtils.ts`) ✅

**Utility Functions:**
```typescript
// Auto-assign next color in TAG_COLORS array
export function getNextTagColor(existingTags: Tag[]): string {
  const colorIndex = existingTags.length % TAG_COLORS.length;
  return TAG_COLORS[colorIndex];
}

// Create tag with auto-color
export function createTag(name: string, spaceId: string, userId: string): Tag {
  return {
    id: `tag-${Date.now()}`,
    name,
    color: getNextTagColor(mockTags.filter(t => t.spaceId === spaceId)),
    spaceId,
    createdAt: new Date(),
    createdBy: userId,
  };
}

// Validate tag name
export function validateTagName(name: string, existingTags: Tag[]): string | null {
  if (!name.trim()) return 'Tag name cannot be empty';
  if (name.length < 2) return 'Tag name must be at least 2 characters';
  if (name.length > 30) return 'Tag name cannot exceed 30 characters';
  
  const duplicate = existingTags.find(
    t => t.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicate) return 'A tag with this name already exists';
  
  return null; // Valid
}

// Calculate usage across all entity types
export function getTagUsageStats(tagId: string): TagUsageStats {
  // Counts in insights, data sheets, chat messages, change logs
  return {
    insights: count,
    dataSheets: count,
    chatMessages: count,
    changeLogs: count,
    total: sum,
  };
}

// Remove tag from all entities before deleting
export function cascadeDeleteTag(tagId: string): Promise<void> {
  // 1. Delete all tag_associations for this tag
  // 2. Delete tag record
  // 3. Update UI state
}
```

### 10. PHASE 5: Unified Tag Architecture ✅

**Database Schema** (`/types/database.ts`):
- All interfaces defined
- Matches Supabase table structure
- Proper relationships (foreign keys)
- Created/updated timestamps

**API Layer** (`/api/tags.ts`, `/api/insights.ts`):
- Full CRUD operations
- Mock implementations for demo
- TODO comments mark Supabase integration points
- Type-safe functions

**React Hooks** (`/hooks/useTags.ts`, `/hooks/useInsights.ts`):
- Data fetching and caching
- Loading and error states
- CRUD operations
- Real-time updates (ready for Supabase subscriptions)

**Components:**
- TagManagementView (full tag management interface)
- UniversalTagSearch (cross-entity search)
- All integrated with API layer

### 11. PHASE 6: Navigation & User Flow (`/components/Navigation.tsx`) ✅

**Navigation Bar:**
- Fixed top navigation (z-50)
- Four main views: Capture, Data, Change Logs, Insights
- Active tab indicator (animated orange underline)
- Current space name displayed
- Logo with link to home (capture view)
- Consistent across all views

**View Switching:**
- Click navigation item to switch views
- State managed in App.tsx (`currentView`)
- URL updates automatically (via PHASE 7 routing)

### 12. PHASE 7: Deep Linking & URL Routing ✅

**Route Definitions** (`/routes.tsx`):
```typescript
export const ROUTES = {
  CAPTURE: '/',
  DATA: '/data',
  CHANGE_LOGS: '/changelogs',
  INSIGHTS: '/insights',
  INSIGHT_DETAIL: '/insights/:insightId',
  DATA_SPACE: '/data/:spaceId',
  DATA_FOLDER: '/data/:spaceId/:folderId',
  DATA_SHEET: '/data/:spaceId/:folderId/:sheetId',
  // ... more routes
};

export const buildRoute = {
  capture: () => '/',
  insights: () => '/insights',
  insightDetail: (id) => `/insights/${id}`,
  dataSheet: (spaceId, folderId, sheetId) => `/data/${spaceId}/${folderId}/${sheetId}`,
  // ... more builders
};
```

**Custom Router** (`/hooks/useRouter.ts`):
- Uses browser History API (pushState, replaceState)
- No external dependencies
- `useRouter()` hook provides pathname, search, hash
- `<Link>` component for client-side navigation
- Ctrl/Cmd+Click support (opens new tab)
- Browser back/forward button support

**URL State Sync** (`App.tsx`):
- Current view derived from URL on load
- View changes update URL
- Shareable URLs for all views
- Deep links work (e.g., `/insights/insight-123`)

**Benefits:**
- ✅ Shareable URLs (send link to specific insight)
- ✅ Browser navigation works (back/forward)
- ✅ Bookmarkable pages
- ✅ Search engine friendly (future)
- ✅ Can migrate to React Router easily

---

## 🔨 TO IMPLEMENT (Replit.com)

### PHASE 8: Backend Integration & Supabase Connection (Priority: HIGH)

**Goal:** Replace all mock data with real Supabase queries.

#### 8.1 Supabase Setup

**Create Supabase Project:**
1. Go to https://supabase.com
2. Create new project
3. Copy project URL and anon key
4. Add to environment variables:
   ```
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJxxx...
   ```

**Install Supabase Client:**
```bash
npm install @supabase/supabase-js
```

**Create Supabase Client** (`/lib/supabase.ts`):
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

#### 8.2 Database Schema

**Run SQL in Supabase SQL Editor:**

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tags table
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL,
  name VARCHAR(30) NOT NULL,
  color VARCHAR(7) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL,
  UNIQUE(space_id, name) -- Case-insensitive unique constraint handled in app
);

-- Tag associations (many-to-many for any entity)
CREATE TABLE tag_associations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  entity_type VARCHAR(20) NOT NULL, -- 'insight', 'data_sheet', 'chat_message', 'change_log'
  entity_id UUID NOT NULL,
  space_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insights table
CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL,
  title VARCHAR(200) NOT NULL,
  summary TEXT NOT NULL,
  status VARCHAR(10) DEFAULT 'open', -- 'open' or 'closed'
  priority VARCHAR(10) DEFAULT 'medium', -- 'low', 'medium', 'high'
  assigned_to UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insight sources (many-to-many)
CREATE TABLE insight_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  insight_id UUID REFERENCES insights(id) ON DELETE CASCADE,
  source_type VARCHAR(20) NOT NULL, -- 'data_sheet', 'change_log', 'ai_chat'
  source_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insight comments
CREATE TABLE insight_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  insight_id UUID REFERENCES insights(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_id UUID NOT NULL,
  parent_id UUID REFERENCES insight_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comment mentions (for @mentions)
CREATE TABLE comment_mentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID REFERENCES insight_comments(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_tags_space_id ON tags(space_id);
CREATE INDEX idx_tag_associations_tag_id ON tag_associations(tag_id);
CREATE INDEX idx_tag_associations_entity ON tag_associations(entity_type, entity_id);
CREATE INDEX idx_tag_associations_space_id ON tag_associations(space_id);
CREATE INDEX idx_insights_space_id ON insights(space_id);
CREATE INDEX idx_insights_status ON insights(status);
CREATE INDEX idx_insights_created_at ON insights(created_at DESC);
CREATE INDEX idx_insight_sources_insight_id ON insight_sources(insight_id);
CREATE INDEX idx_insight_comments_insight_id ON insight_comments(insight_id);
CREATE INDEX idx_comment_mentions_comment_id ON comment_mentions(comment_id);
```

#### 8.3 Replace Mock Data with Supabase Queries

**File: `/api/tags.ts`**

Find all functions with `// TODO: Supabase` comments and replace:

```typescript
import { supabase } from '../lib/supabase';
import type { Tag, TagAssociation } from '../types/database';

// ✅ BEFORE (Mock):
export async function getTags(spaceId: string): Promise<Tag[]> {
  return mockTags.filter(t => t.spaceId === spaceId);
}

// ✅ AFTER (Supabase):
export async function getTags(spaceId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('space_id', spaceId)
    .order('name', { ascending: true });
  
  if (error) {
    console.error('Error fetching tags:', error);
    throw new Error('Failed to fetch tags');
  }
  
  // Transform snake_case to camelCase
  return data.map(row => ({
    id: row.id,
    name: row.name,
    color: row.color,
    spaceId: row.space_id,
    createdAt: new Date(row.created_at),
    createdBy: row.created_by,
  }));
}

// ✅ Create tag
export async function createTag(tag: Omit<Tag, 'id' | 'createdAt'>): Promise<Tag> {
  const { data, error } = await supabase
    .from('tags')
    .insert([{
      name: tag.name,
      color: tag.color,
      space_id: tag.spaceId,
      created_by: tag.createdBy,
    }])
    .select()
    .single();
  
  if (error) {
    if (error.code === '23505') { // Unique constraint violation
      throw new Error('A tag with this name already exists');
    }
    throw new Error('Failed to create tag');
  }
  
  return {
    id: data.id,
    name: data.name,
    color: data.color,
    spaceId: data.space_id,
    createdAt: new Date(data.created_at),
    createdBy: data.created_by,
  };
}

// Continue for updateTag, deleteTag, addTagToEntity, removeTagFromEntity, etc.
```

**File: `/api/insights.ts`**

Same pattern:

```typescript
import { supabase } from '../lib/supabase';
import type { Insight, InsightSource, InsightComment } from '../types/database';

export async function getInsights(spaceId: string): Promise<Insight[]> {
  const { data, error } = await supabase
    .from('insights')
    .select('*')
    .eq('space_id', spaceId)
    .order('created_at', { ascending: false });
  
  if (error) throw new Error('Failed to fetch insights');
  
  return data.map(row => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    status: row.status as 'open' | 'closed',
    priority: row.priority as 'low' | 'medium' | 'high',
    assignedTo: row.assigned_to,
    spaceId: row.space_id,
    createdAt: new Date(row.created_at),
    createdBy: row.created_by,
  }));
}

// Continue for createInsight, updateInsight, deleteInsight, etc.
```

#### 8.4 Update React Hooks to Handle Errors

**File: `/hooks/useTags.ts`**

Add error handling and loading states:

```typescript
export function useTags(spaceId: string) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!spaceId) return;
    
    setLoading(true);
    getTags(spaceId)
      .then(setTags)
      .catch(err => {
        console.error('Error loading tags:', err);
        setError(err.message);
        toast.error('Failed to load tags');
      })
      .finally(() => setLoading(false));
  }, [spaceId]);

  const addTag = async (tag: Omit<Tag, 'id' | 'createdAt'>) => {
    try {
      const newTag = await createTag(tag);
      setTags(prev => [...prev, newTag]);
      toast.success('Tag created!');
      return newTag;
    } catch (err) {
      toast.error(err.message || 'Failed to create tag');
      throw err;
    }
  };

  // Similar for updateTag, deleteTag
  
  return { tags, loading, error, addTag, updateTag, deleteTag };
}
```

#### 8.5 Test Each Feature Individually

**Testing Checklist:**

1. **Tag Management:**
   - [ ] Create tag → Appears in Supabase dashboard
   - [ ] Edit tag name → Updates in database
   - [ ] Change tag color → Updates in database
   - [ ] Delete tag → Removes from database and all associations

2. **Capture with Tags:**
   - [ ] Capture region → Select tags → Save
   - [ ] Verify tag_associations record created
   - [ ] Verify data_sheet has tags (if using data_sheets table)

3. **AI Chat Tagging:**
   - [ ] Tag chat messages → Creates tag_associations
   - [ ] Create insight from chat → Creates insight + sources + associations
   - [ ] Verify insight_sources links to chat messages

4. **Insights Page:**
   - [ ] Load insights → Shows from Supabase
   - [ ] Filter by status → Queries correctly
   - [ ] Filter by tags → Uses tag_associations join
   - [ ] Create manual insight → Saves to database

5. **Comments:**
   - [ ] Add comment → Creates insight_comments record
   - [ ] Reply to comment → Sets parent_id correctly
   - [ ] @mention user → Creates comment_mentions record

6. **Universal Search:**
   - [ ] Search query → Returns results from all entity types
   - [ ] Filter by entity type → Queries correct tables
   - [ ] Filter by tags → Uses tag_associations

---

## Quick Start Guide for Replit

### Step 1: Understand the Current State
- All UI is complete and functional with mock data
- Every API call has a `// TODO: Supabase` comment
- Database types match Supabase schema exactly

### Step 2: Set Up Supabase
1. Create Supabase project
2. Run SQL schema (section 8.2 above)
3. Add environment variables
4. Install `@supabase/supabase-js`
5. Create `/lib/supabase.ts` client

### Step 3: Replace Mock Data (Do One Feature at a Time)
**Recommended Order:**
1. **Tags** (`/api/tags.ts`) - Simplest, no dependencies
2. **Insights** (`/api/insights.ts`) - Depends on tags
3. **Sources** (same file) - Links insights to other entities
4. **Comments** (same file) - Comments on insights
5. **Search** (`searchTaggedItems` function) - Most complex

### Step 4: Test Each Feature After Implementation
- Use browser DevTools to check network requests
- Check Supabase dashboard to verify data
- Test error cases (duplicate tags, missing fields, etc.)

### Step 5: Enable Real-time Updates (Optional)
Supabase supports real-time subscriptions:

```typescript
// Example: Real-time tag updates
useEffect(() => {
  const subscription = supabase
    .channel('tags-changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'tags', filter: `space_id=eq.${spaceId}` },
      (payload) => {
        // Update local state when tags change
        if (payload.eventType === 'INSERT') {
          setTags(prev => [...prev, transformTag(payload.new)]);
        }
        // Handle UPDATE, DELETE similarly
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, [spaceId]);
```

### Step 6: Handle Edge Cases
- Empty states (no tags, no insights)
- Loading states (show skeletons)
- Error states (show error messages)
- Offline mode (optional: cache in localStorage)

---

## 🧪 TESTING REQUIREMENTS

### Unit Tests (Recommended Tools: Vitest, Jest)

**Test Files to Create:**
- `/api/tags.test.ts` - Tag CRUD operations
- `/api/insights.test.ts` - Insight operations
- `/utils/tagUtils.test.ts` - Utility functions
- `/hooks/useTags.test.ts` - Hook behavior
- `/components/TagBadge.test.tsx` - Component rendering

**Example Test:**
```typescript
import { describe, it, expect } from 'vitest';
import { validateTagName } from '../utils/tagUtils';

describe('validateTagName', () => {
  it('rejects empty names', () => {
    expect(validateTagName('', [])).toBe('Tag name cannot be empty');
  });

  it('rejects names under 2 characters', () => {
    expect(validateTagName('a', [])).toBe('Tag name must be at least 2 characters');
  });

  it('rejects duplicate names (case-insensitive)', () => {
    const existingTags = [{ name: 'Marketing', ... }];
    expect(validateTagName('marketing', existingTags)).toBe('A tag with this name already exists');
  });

  it('accepts valid names', () => {
    expect(validateTagName('Valid Tag', [])).toBeNull();
  });
});
```

### Integration Tests

**Test Scenarios:**
1. **End-to-end Insight Creation from Chat:**
   - Start chat with AI
   - Tag messages
   - Create insight
   - Verify insight appears on Insights page
   - Verify sources link back to chat

2. **Tag Cascade Delete:**
   - Create tag
   - Apply to multiple entities
   - Delete tag
   - Verify removed from all entities

3. **Universal Search:**
   - Create insight, data sheet, chat with same tag
   - Search for tag
   - Verify all three appear in results

### Edge Cases to Handle

| Scenario | Expected Behavior |
|----------|-------------------|
| Tag with 0 items | Allow deletion without warning |
| Chat history cleared | Show error when clicking source link |
| Deleted user | Display "[Deleted User]" in UI |
| Empty insight summary | Require minimum 10 characters |
| No tags selected | Prevent capture/insight creation |
| Duplicate tag name | Show error before API call |
| Network error | Show retry button, don't lose form data |
| Concurrent edits | Last write wins (or implement optimistic locking) |

---

## 📊 PERFORMANCE CONSIDERATIONS

### Database Optimization

**Indexes (Already in Schema):**
```sql
-- Critical indexes for query performance
CREATE INDEX idx_tags_space_id ON tags(space_id);
CREATE INDEX idx_tag_associations_tag_id ON tag_associations(tag_id);
CREATE INDEX idx_tag_associations_entity ON tag_associations(entity_type, entity_id);
CREATE INDEX idx_insights_space_id ON insights(space_id);
CREATE INDEX idx_insights_created_at ON insights(created_at DESC);
```

**Query Optimization:**
- Use `.select()` to specify only needed columns
- Use `.limit()` for pagination
- Use `.range()` for infinite scroll
- Use `.order()` with indexed columns

**Example - Paginated Insights:**
```typescript
const INSIGHTS_PER_PAGE = 50;

export async function getInsights(spaceId: string, page: number = 0) {
  const start = page * INSIGHTS_PER_PAGE;
  const end = start + INSIGHTS_PER_PAGE - 1;

  const { data, error, count } = await supabase
    .from('insights')
    .select('*', { count: 'exact' })
    .eq('space_id', spaceId)
    .order('created_at', { ascending: false })
    .range(start, end);
  
  return { insights: data, total: count, hasMore: count > end + 1 };
}
```

### Caching Strategy

**What to Cache:**
- Tags (change infrequently)
- Current user info
- Space metadata

**What NOT to Cache:**
- Insights (change frequently)
- Comments (real-time)
- Search results (dynamic)

**Example - React Query Caching:**
```typescript
import { useQuery } from '@tanstack/react-query';

export function useTags(spaceId: string) {
  return useQuery({
    queryKey: ['tags', spaceId],
    queryFn: () => getTags(spaceId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}
```

### Frontend Optimization

**Lazy Loading:**
```typescript
// Lazy load heavy components
const InsightDetailView = lazy(() => import('./components/InsightDetailView'));
const TagManagementView = lazy(() => import('./components/TagManagementView'));
```

**Virtualization for Long Lists:**
```typescript
import { FixedSizeList } from 'react-window';

// For >100 insights, use virtualized list
<FixedSizeList
  height={600}
  itemCount={insights.length}
  itemSize={120}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <InsightCard insight={insights[index]} />
    </div>
  )}
</FixedSizeList>
```

---

## 🚀 DEPLOYMENT CHECKLIST

### Pre-Launch Verification

**Functionality:**
- [ ] All views load without errors
- [ ] Navigation between views works
- [ ] Deep links work (can share URLs)
- [ ] Browser back/forward buttons work
- [ ] Tags can be created, edited, deleted
- [ ] Insights can be created, edited, deleted
- [ ] Comments can be added, replies work
- [ ] Search finds results across all entity types
- [ ] Filters work correctly

**Data Integrity:**
- [ ] No orphaned records (use foreign keys with CASCADE)
- [ ] Tag associations clean up on entity delete
- [ ] Insight sources clean up on insight delete
- [ ] Comment mentions clean up on comment delete

**Performance:**
- [ ] All database indexes created
- [ ] No N+1 queries (use `.select()` with joins)
- [ ] Large lists use pagination/virtualization
- [ ] Images optimized (if using image captures)

**Security:**
- [ ] Supabase Row Level Security (RLS) enabled
- [ ] Users can only see data in their Spaces
- [ ] Environment variables not exposed to client
- [ ] API keys not hardcoded

**User Experience:**
- [ ] Loading states show for all async operations
- [ ] Error messages are clear and actionable
- [ ] Empty states guide users to next action
- [ ] Tooltips explain complex features
- [ ] Mobile responsive (if supporting mobile)

### Row Level Security (RLS) Policies

**Important:** Enable RLS on all Supabase tables:

```sql
-- Enable RLS
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_comments ENABLE ROW LEVEL SECURITY;

-- Example policy: Users can only access tags in their Spaces
CREATE POLICY "Users can view tags in their spaces"
  ON tags FOR SELECT
  USING (
    space_id IN (
      SELECT space_id FROM space_members WHERE user_id = auth.uid()
    )
  );

-- Similar policies for INSERT, UPDATE, DELETE
-- Similar policies for all tables
```

---

## 📝 ADDITIONAL NOTES FOR REPLIT

### Why This Architecture?

**1. Unified Tag System:**
- Single source of truth for tags
- Works across all features (capture, chat, insights, change logs)
- Enables powerful cross-entity search
- Scales to millions of tags efficiently

**2. Flexible Source Linking:**
- Insights can reference any combination of sources
- Preserves context: "This insight came from these specific data points"
- Enables traceability: "Where did this analysis come from?"

**3. Space-Scoped Design:**
- Prevents tag pollution between teams/projects
- Allows different tagging taxonomies per Space
- AI context is Space-specific (more accurate)
- Future: Permissions per Space

**4. Mock Data First:**
- Allowed rapid UI development
- Demonstrates expected data shapes
- Makes Supabase integration straightforward (just swap implementations)

### Common Pitfalls to Avoid

**1. N+1 Query Problem:**
```typescript
// ❌ BAD: Fetches insights, then sources for each insight (N+1 queries)
const insights = await getInsights(spaceId);
for (const insight of insights) {
  insight.sources = await getInsightSources(insight.id); // 1 query per insight!
}

// ✅ GOOD: Single query with join
const { data } = await supabase
  .from('insights')
  .select(`
    *,
    insight_sources (
      id,
      source_type,
      source_id
    )
  `)
  .eq('space_id', spaceId);
```

**2. Case-Insensitive Tag Names:**
```typescript
// ❌ BAD: Allows "Marketing" and "marketing" as separate tags
const existingTag = tags.find(t => t.name === newName);

// ✅ GOOD: Case-insensitive comparison
const existingTag = tags.find(t => t.name.toLowerCase() === newName.toLowerCase());
```

**3. Forgetting to Filter by Space:**
```typescript
// ❌ BAD: Returns tags from ALL spaces
const { data } = await supabase.from('tags').select('*');

// ✅ GOOD: Filter by current space
const { data } = await supabase
  .from('tags')
  .select('*')
  .eq('space_id', currentSpaceId);
```

**4. Not Handling Async Errors:**
```typescript
// ❌ BAD: Errors crash the app
const tags = await getTags(spaceId);

// ✅ GOOD: Handle errors gracefully
try {
  const tags = await getTags(spaceId);
} catch (error) {
  console.error('Error loading tags:', error);
  toast.error('Failed to load tags. Please try again.');
  // Show error state in UI
}
```

### Future Enhancements (v2)

**AI-Powered Features:**
- Smart tag suggestions based on content
- Auto-summarize insights from multiple sources
- Trend detection across tagged items
- Anomaly alerts ("Revenue tag used 50% less this month")

**Collaboration:**
- Real-time collaborative editing (multiple users editing same insight)
- Activity feed ("John tagged a new insight")
- Notifications for @mentions
- Team chat per insight

**Advanced Organization:**
- Tag hierarchies (parent/child relationships)
- Tag templates (pre-defined tag sets for workflows)
- Saved searches/filters
- Custom Kanban columns

**Export & Reporting:**
- Export insights to PDF
- Generate reports by tag
- Insights dashboard with charts
- Weekly digest emails

**Mobile:**
- iOS/Android apps
- Offline mode with sync
- Push notifications

---

## 🎯 SUCCESS METRICS

### How to Know It's Working

**Adoption Metrics:**
- 80%+ of captures have at least one tag
- 10%+ of tagged chats convert to insights
- 50%+ of insights have comments
- Users create 5+ tags per Space on average

**Engagement Metrics:**
- Average 2+ sources per insight
- 70%+ of insights have status updates (open → closed)
- Universal search used in 50%+ of sessions
- Users navigate via deep links 30%+ of time

**Performance Metrics:**
- Insights page loads in <500ms
- Tag search returns results in <200ms
- No database queries exceed 1 second
- 99.9% uptime (Supabase SLA)

---

## 🔗 FILE REFERENCE

### Files Created (All Complete with Mock Data)

**Data & Types:**
- `/data/insightsData.ts` - Mock data and interfaces
- `/types/database.ts` - Supabase schema types

**API Layer:**
- `/api/tags.ts` - Tag CRUD + associations
- `/api/insights.ts` - Insight CRUD + sources + comments

**Hooks:**
- `/hooks/useTags.ts` - Tag management hooks
- `/hooks/useInsights.ts` - Insight management hooks
- `/hooks/useRouter.ts` - Custom routing hooks

**Components:**
- `/components/TagBadge.tsx` - Display tag with menu
- `/components/TagSelector.tsx` - Select/create tags
- `/components/TagDeleteConfirmDialog.tsx` - Confirm tag deletion
- `/components/TagManagementView.tsx` - Full tag management page
- `/components/InsightsView.tsx` - Main insights page
- `/components/CreateInsightCard.tsx` - Floating insight creation
- `/components/ManualInsightDialog.tsx` - Full insight creation dialog
- `/components/UniversalTagSearch.tsx` - Cross-entity search
- `/components/Navigation.tsx` - Top navigation bar
- `/components/AIAssistantPanel.tsx` - Modified for tagging
- `/components/FloatingCaptureToolbar.tsx` - Modified for tags

**Utilities:**
- `/utils/tagUtils.ts` - Tag utility functions
- `/routes.tsx` - Route definitions and helpers

**App:**
- `/App.tsx` - Main app with routing and view management

### Files to Create (Replit)

**Backend:**
- `/lib/supabase.ts` - Supabase client initialization

**Future Components:**
- `/components/InsightDetailView.tsx` - Full-page insight view
- `/components/MentionInput.tsx` - @mention autocomplete
- `/components/SourceLinkButton.tsx` - Reusable source link component

---

## ❓ FAQ for Replit Team

**Q: Can we skip the mock data and go straight to Supabase?**
A: The mock data demonstrates the exact data shapes expected. Use it as a reference when implementing Supabase queries. It's also useful for testing UI without backend.

**Q: Why not use React Router?**
A: The custom router is lightweight and dependency-free. You can easily migrate to React Router later if needed. The route structure (`/routes.tsx`) is already compatible.

**Q: How do we handle user authentication?**
A: Supabase has built-in auth. Use `supabase.auth.signIn()`, `supabase.auth.signUp()`, etc. Store `userId` in state and pass to API functions (e.g., `createdBy` field).

**Q: What about permissions (who can delete insights)?**
A: Start simple: All Space members can CRUD everything. Later, add roles (admin, member, viewer) and check permissions in RLS policies.

**Q: Can insights have tags AND be categorized by status?**
A: Yes! Insights have both tags (user-defined, many-to-many) and status (system field, one-to-one). Tags are for content categorization, status is for workflow state.

**Q: How do we notify users of @mentions?**
A: After creating a comment, parse `@mentions` using regex, create `comment_mentions` records, then trigger notifications (email, in-app, push, etc.).

**Q: What if a user deletes a data sheet that's linked to an insight?**
A: Use `ON DELETE CASCADE` in foreign keys to clean up `insight_sources`. Or, use `ON DELETE SET NULL` and show "[Deleted Source]" in UI.

**Q: How do we prevent duplicate tags (case-insensitive)?**
A: Validate in the app before calling Supabase. Use `.toLowerCase()` comparison. Supabase doesn't support case-insensitive unique constraints natively.

---

## 🎓 LEARNING RESOURCES

**Supabase:**
- Official docs: https://supabase.com/docs
- Real-time subscriptions: https://supabase.com/docs/guides/realtime
- Row Level Security: https://supabase.com/docs/guides/auth/row-level-security

**React Patterns:**
- Custom hooks: https://react.dev/learn/reusing-logic-with-custom-hooks
- Error boundaries: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary

**Performance:**
- React.memo: https://react.dev/reference/react/memo
- useMemo/useCallback: https://react.dev/reference/react/useMemo
- React Window (virtualization): https://github.com/bvaughn/react-window

---

END OF COMPREHENSIVE IMPLEMENTATION GUIDE

**For questions, clarifications, or additional guidance, please reach out!**

This system represents a complete, production-ready implementation of the Insights feature. All frontend code is functional with mock data, and all backend integration points are clearly marked with TODO comments. The architecture is scalable, performant, and follows React/TypeScript best practices.

Good luck with the Supabase integration! 🚀
