# Canvas Insight Card Feature - Implementation Notes for Replit

## Overview
This document outlines the major redesign of the Insights page to transform individual Insight Cards into a ChatGPT Canvas-like experience. This redesign aims to unify AI chat conversations with Insights, reduce navigation complexity, and improve the overall user experience.

---

## 🎯 Feature Intention & Goals

### **Problem Being Solved:**
1. **Separation of AI Chat and Insights**: Currently, AI Chat and Insights are separate features requiring navigation between pages. This creates friction for users who want to discuss insights with AI.
2. **Too Much Navigation**: Having a separate AI Assistant button in the sidebar adds unnecessary navigation steps.
3. **Insight-Chat Connection**: Users want to have conversations ABOUT specific insights, not just general AI chat.

### **Solution:**
Transform Insight Cards into an interactive Canvas experience where:
- Clicking an Insight Card expands it into a full Canvas view
- AI Chat appears on the LEFT side (ChatGPT Canvas style)
- The Insight Card content becomes the RIGHT side (the "canvas")
- Each Insight has its own 1:1 private AI chat thread
- Creating a new AI chat automatically creates a new Insight Card

### **Benefits:**
- **Less Navigation**: Remove AI Assistant from sidebar, integrate everything into Insights page
- **Better Context**: AI chat is always in context of a specific Insight
- **Unified Experience**: Conversations and insights are connected, not separate
- **Multi-tasking**: Tabs allow users to work on multiple insights simultaneously
- **Canvas-like UX**: Familiar pattern for users who use ChatGPT Canvas

---

## 🏗️ Architecture Overview

### **Before (Current State)**
```
Left Sidebar:
├── Insights (button)
├── Upload (button)
├── Change Logs (button)
├── Files (button)
└── AI Assistant (button) ← WILL BE REMOVED

Insights Page:
├── Filter bar
├── Generate Insights button
├── Insight Cards (list view)
│   ├── Card 1 (collapsed)
│   ├── Card 2 (expanded) ← Shows details inline
│   │   ├── AI Summary
│   │   ├── Tags (separate section)
│   │   ├── Sources (separate section)
│   │   ├── Private AI Chat (bottom of card)
│   │   ├── Comments
│   │   └── Details (metadata)
│   └── Card 3 (collapsed)

AI Assistant Page (Separate):
├── Chat history (all conversations mixed)
└── Input field
```

### **After (New Canvas Mode)**
```
Left Sidebar:
├── Insights (button)
├── Upload (button)
├── Change Logs (button)
└── Files (button)
    [AI Assistant button REMOVED - now integrated into Insights]

Insights Page (Canvas Mode):
├── Canvas Tabs (top) ← NEW: Switch between multiple open insights
│   ├── Tab 1: "Revenue Analysis Q4"
│   ├── Tab 2: "Customer Retention Trends"
│   └── [+] New Chat
│
├── AI Chat Panel (LEFT SIDE - 40% width) ← NEW: ChatGPT Canvas style
│   ├── Chat messages (scrollable)
│   ├── AI typing indicator
│   └── Input field with Send button
│
└── Insight Card Canvas (RIGHT SIDE - 60% width) ← Expanded card
    ├── Card Header (title, status, action buttons)
    ├── Notes Section ← Changed from "AI Summary"
    │   ├── AI-generated content (lighter color, editable)
    │   └── User notes (normal color)
    │   └── [Regenerate] button (small icon, bottom-right)
    ├── Comments Section
    └── Details Section (BOTTOM, collapsible) ← Moved to bottom
        ├── Tags (inside Details)
        ├── Sources (inside Details)
        ├── Status, Date, Created By, Assigned To
        └── All expanded by default in Canvas mode

Left Sidebar State:
└── Automatically collapses to icon-only mode when Canvas opens
```

---

## 🔄 User Flow Changes

### **Opening an Insight in Canvas Mode**
1. User clicks on an Insight Card in the list
2. **Simultaneously (smooth animation):**
   - Left sidebar collapses to icon-only mode
   - Insight Card expands to 60% width on the right
   - AI Chat panel slides in from left at 40% width
   - Canvas tabs appear at the top
   - All other Insight Cards are hidden
3. User can now:
   - Chat with AI on the left about this specific insight
   - Edit/view insight content on the right
   - Expand/collapse metadata sections at the bottom

### **Creating a New AI Chat**
1. User clicks "+ New Chat" button (could be in sidebar or on Insights page)
2. **System automatically:**
   - Creates a blank Insight Card with title "Untitled Insight"
   - Opens Canvas mode with empty AI chat on left
   - User starts chatting
3. **As conversation progresses:**
   - AI analyzes the conversation context
   - AI auto-generates/updates Insight Card details:
     - Title (based on conversation topic)
     - Notes section (AI summary of key points)
     - Tags (auto-suggested based on conversation)
     - Sources (if user mentions specific data sheets/links)
   - User can manually edit any of these at any time

### **Switching Between Multiple Insights**
1. User has 3 Insights open in Canvas mode
2. Tabs show at the top: "Revenue Q4" | "Retention" | "Ad Spend"
3. Clicking a tab:
   - Switches the RIGHT side (canvas) to that Insight Card
   - Switches the LEFT side (chat) to that Insight's chat history
   - Smooth transition, no page reload

### **Closing Canvas Mode**
1. User clicks "Close" button (X icon in top-right)
2. **System returns to normal Insights list view:**
   - Canvas mode closes
   - Left sidebar expands back to full width
   - All Insight Cards return to list view
   - No warning/confirmation needed (auto-saves all changes)

---

## 🎨 UI/UX Design Specifications

### **Canvas Layout**
```
┌─────────────────────────────────────────────────────────────────┐
│ [Tab 1] [Tab 2] [Tab 3] [+New]              [Close X]           │ ← Canvas Header
├──────────────────────┬──────────────────────────────────────────┤
│                      │                                          │
│   AI CHAT PANEL      │        INSIGHT CARD CANVAS               │
│   (40% width)        │        (60% width)                       │
│                      │                                          │
│  ┌────────────────┐  │  ┌────────────────────────────────────┐ │
│  │ AI Message 1   │  │  │ [Title - Editable]                 │ │
│  └────────────────┘  │  │                                    │ │
│                      │  │ NOTES (AI + User Combined)         │ │
│  ┌────────────────┐  │  │ ┌────────────────────────────────┐ │
│  │ User Message 1 │  │  │ │ AI-generated summary (light   │ │
│  └────────────────┘  │  │ │ color, editable)              │ │
│                      │  │ │                                │ │
│  ┌────────────────┐  │  │ │ User's additional notes...    │ │
│  │ AI Message 2   │  │  │ └────────────────────[Regen]────┘ │
│  └────────────────┘  │  │                                    │ │
│                      │  │ COMMENTS                           │ │
│  ┌────────────────┐  │  │ [Comments section here]           │ │
│  │ User Message 2 │  │  │                                    │ │
│  └────────────────┘  │  │                                    │ │
│                      │  │ ▼ DETAILS (collapsed)              │ │
│  [↓ Scroll more]     │  │   [Click to expand metadata]       │ │
│                      │  │                                    │ │
│  ┌────────────────┐  │  └────────────────────────────────────┘ │
│  │ Type message...│  │                                          │
│  │          [Send]│  │                                          │
│  └────────────────┘  │                                          │
│                      │                                          │
└──────────────────────┴──────────────────────────────────────────┘
```

### **Design Inspiration: ChatGPT Canvas**
- **Left panel**: Clean, minimal chat interface
  - White/light text on dark background
  - Messages stacked vertically with timestamps
  - Avatar for user/AI
  - Typing indicator when AI is responding
  - Input field always visible at bottom
  
- **Right panel**: Document/canvas area
  - Feels like editing a document
  - Clean, spacious layout
  - Sections clearly delineated
  - Metadata/settings at bottom (not competing for attention)

### **Color Scheme** (Match existing CaptureInsight brand)
- Background: `#0F1419` (dark slate)
- Panel backgrounds: `#1A1F2E` (slightly lighter)
- Accent: `#FF6B35` (orange) for buttons, highlights
- Text: `#E5E7EB` (light gray)
- AI-generated text (lighter): `#9CA3AF` (medium gray)
- Borders: `#2D3B4E` (subtle)

### **Animations**
- Canvas open/close: 300ms ease-in-out
- Sidebar collapse: 300ms ease-in-out (synchronized with canvas open)
- Tab switching: 200ms ease
- Chat messages: Fade in (150ms)
- Sections expand/collapse: 250ms

---

## 📊 Data Model Changes

### **Current Insight Interface** (from `/data/insightsData.ts`)
```typescript
interface Insight {
  id: string;
  title: string;
  summary: string; // Currently labeled "AI Summary"
  status: 'Open' | 'Archived';
  tags: string[];
  sources: Source[];
  comments: Comment[];
  dateCreated: Date;
  createdBy: string;
  assignedTo?: string;
  // ... other fields
}
```

### **New Fields Needed**
```typescript
interface Insight {
  // ... existing fields ...
  
  // NEW: AI Chat thread (1:1 relationship)
  chatThreadId: string; // Links to separate chat storage
  
  // CHANGED: Rename "summary" to "notes" conceptually
  // Keep field name as "summary" but treat as editable notes
  // AI updates this, but user can also edit
  notes: string; // Previously "summary", now editable by user + AI
  
  // NEW: Track if this was auto-generated from chat
  autoGenerated: boolean; // True if created from "New Chat"
  
  // NEW: Last AI update timestamp
  lastAiUpdate?: Date;
}
```

### **New Chat Thread Storage**
Since each Insight now has a 1:1 AI chat, we need to store chat messages separately:

```typescript
interface ChatThread {
  id: string; // Same as chatThreadId in Insight
  insightId: string; // Back-reference to Insight
  userId: string; // Private to this user
  messages: ChatMessage[];
  createdAt: Date;
  lastMessageAt: Date;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  // Optional: citations to data sources
  citations?: Citation[];
}
```

**Storage Strategy:**
- **localStorage** (for demo): Store chat threads with key `insightChat_{userId}_{insightId}`
- **Production database**: 
  - Table: `chat_threads`
  - Foreign keys: `insight_id`, `user_id`
  - JSON field for messages array
  - Index on `(user_id, insight_id)` for fast lookup

---

## 🔧 Implementation Phases

### **✅ PHASE 1: Restructure Insight Card Layout (COMPLETED)**
- [x] Move TAGS into DETAILS section
- [x] Move SOURCES into DETAILS section
- [x] Remove standalone Tags and Sources sections
- [x] Tags and Sources now appear at top of DETAILS when expanded

### **🚧 PHASE 2: Canvas Mode Core (NEXT)**
1. **Add Canvas Mode State**
   - Track which Insight(s) are open in Canvas mode
   - Track active Canvas tab
   - Track sidebar collapsed state

2. **Build Canvas Layout**
   - Create two-panel layout (AI Chat left, Card right)
   - Implement responsive widths (40% / 60% with resize handle?)
   - Hide Insight Cards list when Canvas is active

3. **AI Chat Panel (Left Side)**
   - Move existing "Private AI Chat" code from bottom of card
   - Expand to full-height panel
   - Style to match ChatGPT Canvas aesthetic
   - Messages display with avatars, timestamps
   - Input field fixed at bottom

4. **Insight Canvas (Right Side)**
   - Card expands to fill space
   - Remove collapse/expand button (always expanded in Canvas)
   - Metadata sections move to bottom

5. **Open/Close Animations**
   - Click card → triggers Canvas mode
   - Sidebar collapses simultaneously
   - Close button returns to list view
   - Sidebar expands simultaneously

### **PHASE 3: Notes Section Redesign**
1. **Change "AI Summary" to "Notes"**
   - Remove label "AI Summary"
   - Just show "NOTES" section header
   - Content is combination of AI-generated + user-written

2. **Editable Text Area**
   - User can click anywhere in Notes to edit
   - AI-generated content shown in lighter color (#9CA3AF)
   - User-typed content in normal color (#E5E7EB)
   - Placeholder text: "Add your notes here... or ask AI to generate insights"

3. **Regenerate AI Summary Button**
   - Small icon button in bottom-right corner of Notes box
   - Icon: RotateCw (lucide-react)
   - On click: AI re-analyzes insight and updates notes
   - Does NOT delete user's notes, only regenerates AI section

4. **AI Auto-Update Logic**
   - When user sends message in AI chat
   - AI response updates Notes section (appends or modifies AI-generated portion)
   - Preserves user-written notes
   - Visual indicator: "AI updated notes" toast notification

### **PHASE 4: Tabs for Multiple Insights**
1. **Tab Bar Component**
   - Render at top of Canvas area
   - Show title of each open Insight
   - Active tab highlighted
   - Close button (X) on each tab
   - "+ New Chat" button at end

2. **Tab Switching Logic**
   - Clicking tab switches:
     - Right side: Insight Card content
     - Left side: AI Chat messages for that Insight
   - Smooth transition animation
   - State persists (doesn't reload)

3. **Multiple Canvas Sessions**
   - Track array of open Insights: `openCanvasInsights: string[]`
   - Each has its own chat thread loaded
   - Maximum tabs? (Consider UX: maybe 5-8 max)

### **PHASE 5: "Generate Insights" Integration**
1. **Button Behavior Change**
   - Currently: Shows toast "Coming soon"
   - New: Opens Canvas mode with new blank Insight
   - AI immediately starts analyzing all Space data
   - Chat shows: "Analyzing your space data..."
   - AI generates insights and populates Card + Notes

2. **AI Analysis Flow**
   - Scan all data sheets in current Space
   - Scan all Change Logs
   - Scan all existing Insights
   - Scan all tags
   - Identify patterns, anomalies, trends
   - Generate Insight Card with:
     - Title (e.g., "Revenue Drop in Q3 Detected")
     - Notes (detailed analysis)
     - Tags (auto-applied)
     - Sources (links to relevant sheets)

### **PHASE 6: Remove AI Assistant Page**
1. **Delete `/components/AIAssistantPanel.tsx`**
   - No longer needed (functionality moved to Canvas)
   
2. **Update App.tsx**
   - Remove `activeView === 'ai'` state handling
   - Remove routing to AI Assistant
   
3. **Update ProjectBrowser.tsx**
   - Remove "AI Assistant" button from sidebar
   - Update `activeView` type to exclude 'ai'

4. **Migration Strategy for Existing AI Chats** (if any)
   - If demo has existing AI chat history, create a "General Insights" card
   - Attach old chat history to that card
   - Or simply discard (since it's mock data)

---

## 🔒 Real-Time Collaboration Considerations

### **Multi-User Scenarios**
Since Insights can be shared with teams, but AI Chats are **private** to each user:

**Decision: Private AI Chats per User**
- Each user has their own private AI chat thread for each Insight
- Storage key: `insightChat_{userId}_{insightId}`
- Other team members CANNOT see your AI chat
- Comments are still public (visible to team)

**Why?**
- Users want to think/explore privately before sharing with team
- AI chat is like "working out loud" - personal brainstorming
- When ready to share, user can convert AI response to Comment

**Real-Time Sync (Database)**
- Insight Card content (title, notes, tags, status): **Synced in real-time** across team
- AI Chat messages: **NOT synced** (private to user)
- Comments: **Synced in real-time** (public to team)

**Implementation Notes for Backend:**
1. Use WebSocket or Firebase for real-time updates to Insight cards
2. AI chat threads stored separately with `user_id` foreign key
3. Query: `SELECT * FROM chat_threads WHERE insight_id = ? AND user_id = ?`
4. Comments table has `insight_id` foreign key, no `user_id` (public to all)

---

## 📱 Mobile/Responsive Behavior

### **Desktop** (Width > 1024px)
- Full Canvas mode as described above
- AI Chat (40%) | Insight Card (60%)
- Sidebar collapses to icons

### **Tablet** (768px - 1024px)
- Stacked layout:
  - AI Chat panel on top (full width, 50% height)
  - Insight Card below (full width, 50% height)
  - Both scrollable independently

### **Mobile** (< 768px)
- **Tab-based switching:**
  - Tab 1: "Chat" - Shows AI Chat only
  - Tab 2: "Card" - Shows Insight Card only
  - Toggle between views with tabs at top
- Sidebar fully collapsed (hamburger menu?)

**Design Inspiration:** How ChatGPT Canvas works on mobile
- On mobile, ChatGPT Canvas has a toggle button to switch between chat and canvas
- Same pattern should work here

---

## 🧪 Testing Checklist

### **Canvas Mode**
- [ ] Click Insight Card → Canvas mode opens
- [ ] Sidebar collapses simultaneously
- [ ] AI Chat panel appears on left
- [ ] Insight Card expands on right
- [ ] Close button returns to list view
- [ ] Sidebar expands simultaneously

### **AI Chat in Canvas**
- [ ] Send message in chat → AI responds
- [ ] Chat history persists when switching tabs
- [ ] Chat history persists when closing/reopening Canvas
- [ ] Private chat (not visible to other users)
- [ ] Convert AI response to Comment works

### **Notes Section**
- [ ] User can click and edit notes
- [ ] AI-generated text is lighter color
- [ ] User-typed text is normal color
- [ ] Regenerate button updates AI section only
- [ ] AI updates notes during conversation
- [ ] User notes are NOT deleted by AI

### **Tabs**
- [ ] Multiple Insights can be open simultaneously
- [ ] Tabs show at top with Insight titles
- [ ] Clicking tab switches both chat and card
- [ ] Close tab (X) removes from Canvas
- [ ] "+ New Chat" creates new Insight + opens in Canvas

### **Details Section**
- [ ] Tags visible inside Details (top)
- [ ] Sources visible inside Details (after tags)
- [ ] All metadata below (status, date, etc.)
- [ ] Collapsed by default in Canvas mode
- [ ] Can expand/collapse in Canvas

### **Generate Insights Button**
- [ ] Button opens new Canvas with blank Insight
- [ ] AI analyzes Space data automatically
- [ ] Chat shows analysis progress
- [ ] Insight Card populates with findings

### **Responsive**
- [ ] Desktop: Side-by-side panels
- [ ] Tablet: Stacked panels
- [ ] Mobile: Tab-based switching

---

## 🚀 Future Enhancements (Post-MVP)

1. **Resize Handle**
   - Allow users to drag the divider between AI Chat and Canvas
   - Adjust widths (e.g., 30/70 or 50/50)
   - Save preference per user

2. **Export/Share Canvas**
   - Export Insight + Chat transcript as PDF
   - Share Canvas link with team (read-only)

3. **AI Voice Mode**
   - Voice input for AI chat
   - AI reads responses aloud

4. **Insight Templates**
   - Pre-built insight templates (Weekly Update, Performance Review, etc.)
   - Create new Insight from template

5. **Canvas Fullscreen Mode**
   - Hide sidebar completely
   - Expand Canvas to full screen
   - Focus mode for deep work

6. **Collaborative Canvas**
   - Multiple users editing same Insight in real-time
   - See who else is viewing (avatars)
   - Live cursor tracking

---

## 📝 Summary

This Canvas Insight Card redesign is a **major architectural change** that will:

✅ **Simplify navigation** - Remove AI Assistant page, integrate into Insights  
✅ **Improve UX** - ChatGPT Canvas-like experience users already know  
✅ **Connect features** - AI chat directly tied to Insights, not separate  
✅ **Enable multi-tasking** - Tabs for working on multiple insights  
✅ **Reduce friction** - Everything in one place, less clicking around  

**Key Principle:** Every AI conversation creates or enhances an Insight. Insights and AI chats are two sides of the same coin.

---

## 🔗 Related Documentation

- See `/DATA_SOURCE_FEATURE_NOTES_FOR_REPLIT.md` for Data Source feature details
- See `/components/InsightsView.tsx` for current Insights implementation
- See `/components/AIAssistantPanel.tsx` for current AI chat (to be removed)

---

**Last Updated:** [Current Date]  
**Status:** Phase 1 Complete (Restructure), Phase 2 Ready to Build
