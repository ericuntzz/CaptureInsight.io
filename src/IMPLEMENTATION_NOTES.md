# CaptureInsight - Implementation Notes for Production Build

## Overview
This prototype demonstrates the core functionality of **CaptureInsight**, a screenshot-based analytics platform. The production version will be a **native desktop application** (macOS/Windows) that lives in the user's menu bar/system tray, not a web application.

---

## Critical Architecture Requirements

### 1. Desktop Application (Menu Bar/System Tray)
**Current State:** Web-based React prototype  
**Production Requirement:** Native desktop application

- **macOS**: Menu bar application (similar to CleanShot X, Dropbox, etc.)
- **Windows**: System tray application
- The app should be accessible via a menu bar/system tray icon
- Clicking the icon should toggle the visibility of capture boxes on the current screen
- The app runs persistently in the background

**Suggested Tech Stack:**
- Electron (cross-platform)
- Tauri (lighter alternative to Electron)
- Swift/SwiftUI for macOS native, C#/WPF for Windows native

---

### 2. Persistent Capture Boxes with Context Awareness

#### Core Functionality
Capture boxes must **persist across sessions** and **reappear contextually** when the user returns to the same application/window.

#### Example Use Case:
1. User captures a revenue metric on their HubSpot dashboard
2. User adds markup, sets a title "Q4 Revenue"
3. User clicks "Save for Future Captures" (or similar action)
4. **One week later:** User opens HubSpot dashboard again
5. User clicks the CaptureInsight menu bar icon
6. The same "Q4 Revenue" capture box appears **in the exact same location** with all previous markup/settings intact

#### Technical Requirements:

**Window/Application Detection:**
- Detect the active application (e.g., "Google Chrome - HubSpot Dashboard")
- Detect window title/URL (for browser-based apps)
- Store capture box metadata with application context

**Persistence Layer:**
- Local database (SQLite recommended) to store:
  - Capture box coordinates (x, y, width, height)
  - Associated application/window identifier
  - Title and description
  - Markup data (arrows, text annotations, blur areas)
  - Settings (save destination, tags, etc.)
  - Screenshot thumbnail
  - Timestamp of creation and last modification

**Data Structure Example:**
```json
{
  "captureId": "uuid-123",
  "windowContext": {
    "application": "Google Chrome",
    "windowTitle": "HubSpot - Dashboard",
    "url": "https://app.hubspot.com/dashboard" // if browser
  },
  "geometry": {
    "x": 450,
    "y": 200,
    "width": 600,
    "height": 400
  },
  "title": "Q4 Revenue",
  "description": "Monthly recurring revenue trend",
  "markup": {
    "arrows": [...],
    "text": [...],
    "blurAreas": [...]
  },
  "settings": {
    "saveDestination": "Sales Reports",
    "autoCapture": true,
    "captureFrequency": "weekly"
  },
  "createdAt": "2024-01-15T10:30:00Z",
  "lastModified": "2024-01-15T10:35:00Z",
  "isActive": true
}
```

---

### 3. Toggle Visibility Behavior

**When user clicks menu bar icon:**
- If capture boxes exist for the current window context → Show them
- If no capture boxes exist → Show the floating capture toolbar to create new ones
- If capture boxes are already visible → Hide them (toggle off)

**Visual States:**
- Menu bar icon should indicate when captures are active on the current screen
- Consider badge/color change on icon when captures are visible

---

### 4. Screen Capture Implementation

**Current Prototype Limitation:**  
The web prototype uses simulated screenshots (HTML2Canvas or similar). This won't work for production.

**Production Requirements:**
- Native OS-level screen capture APIs
  - **macOS**: `CGWindowListCreateImage`, `ScreenCaptureKit` (macOS 12.3+)
  - **Windows**: `BitBlt`, `Graphics.CopyFromScreen`, or Windows.Graphics.Capture API
- Must support:
  - Full screen capture
  - Specific window capture
  - Custom region selection
  - Multi-monitor support
  - High DPI/Retina display handling

---

### 5. Multi-Monitor Support

- Detect all connected displays
- Allow capture boxes to persist across different monitors
- Store monitor identifier with capture box metadata
- Handle monitor configuration changes gracefully

---

## Feature Details from Prototype

### Floating Capture Toolbar
The toolbar includes these buttons (all functional in prototype):
1. **X** - Close/hide toolbar
2. **Capture Entire Screen** - Full screen screenshot
3. **Capture Selected Window** - Click to select a window
4. **Capture Selected Portion** - Drag to select region
5. **Insert Share Link** - Add URLs to online documents (Google Sheets, etc.)
6. **Upload File** - Upload local files for analysis
7. **Capture** - Finalize and analyze selected captures

### Capture Box Features
Each capture box supports:
- **Drag to reposition**
- **Resize handles** (8 directional handles)
- **Multi-select** (Shift + click)
- **Context menu** with:
  - Mark Up Screen (arrows, text, blur, shapes)
  - Edit Title
  - Save To (folder selection)
  - Delete

### Markup Tools
- Arrows (multiple styles)
- Text annotations
- Blur areas (privacy protection)
- Shapes (rectangles, circles)
- Freehand drawing
- Color picker
- Undo/Redo

### Data Upload Options
From the Capture Settings Modal:
1. **Screenshot Upload** - Standard image upload
2. **CSV/Excel Upload** - Structured data
3. **Google Sheets Integration** - Live connection to sheets
4. **API Integration** (Premium) - Direct API connections

---

## Brand Design System

### Colors (Must be preserved in production)
```css
--primary-orange: #FF6B35;
--background-dark: #0A0E1A;
--surface: #1A1F2E;
--text-primary: #FFFFFF;
--text-secondary: #9CA3AF;
--accent-light: #FFA07A;
--border-subtle: rgba(255, 107, 53, 0.3);
```

### Design Principles
- Dark theme with orange accents
- Glassmorphism effects (blur, transparency)
- Smooth animations and transitions
- Rounded corners (8px standard, 12px for cards)
- Subtle shadows and glows

---

## Backend Data Management System

### Overview
The desktop application includes a **backend component** that manages all captured data, organizing it into projects and folders, and presenting it in an editable spreadsheet interface.

### Architecture

#### Data Hierarchy
```
Workspace
├── Project 1 (e.g., "Q4 Marketing Analysis")
│   ├── Folder A (e.g., "HubSpot Data")
│   │   ├── Sheet 1: "Revenue Metrics"
│   │   ├── Sheet 2: "Lead Generation"
│   │   └── Sheet 3: "Customer Acquisition"
│   └── Folder B (e.g., "Google Ads Data")
│       ├── Sheet 1: "Ad Spend"
│       └── Sheet 2: "Conversion Rates"
├── Project 2 (e.g., "Sales Performance")
│   └── Folder A (e.g., "Salesforce Captures")
│       └── Sheet 1: "Pipeline Data"
└── Project 3 (e.g., "Operations Dashboard")
    └── ...
```

### Data Storage & Organization

#### 1. Project Management
- **Projects** are top-level containers for related data
- Users create projects for different initiatives, departments, or timeframes
- Each project has:
  - Unique ID
  - Name and description
  - Created/modified timestamps
  - Associated team members (for future collaboration features)
  - Settings and permissions

#### 2. Folder System
- **Folders** within projects organize data by source or category
- Common folder patterns:
  - By data source: "HubSpot", "Google Analytics", "Salesforce"
  - By metric type: "Revenue", "Marketing", "Operations"
  - By time period: "Q4 2024", "January 2025"
- Folders contain multiple sheets

#### 3. Spreadsheet Interface
- Each **Sheet** displays captured data in a clean, editable table format
- Similar to Google Sheets / Excel experience
- Features required:
  - **Add/Edit/Delete rows** manually
  - **Add/Edit/Delete columns** with custom headers
  - **Cell formatting** (numbers, dates, currency, percentages)
  - **Sort** by column
  - **Filter** rows based on criteria
  - **Search** across all cells
  - **Formulas** (basic calculations: SUM, AVERAGE, COUNT, etc.)
  - **Cell selection** and multi-select
  - **Copy/Paste** support (including from external spreadsheets)
  - **Undo/Redo** functionality
  - **Import/Export** (CSV, Excel, JSON)

### Data Ingestion Flow

#### From Screenshot Captures
1. User captures a region containing data (e.g., a table from a dashboard)
2. OCR (Optical Character Recognition) extracts text/numbers from screenshot
3. Smart detection identifies table structure (rows, columns, headers)
4. Data is mapped to spreadsheet format
5. User reviews and confirms/edits extracted data
6. Data is saved to selected Project → Folder → Sheet

**Suggested OCR Solutions:**
- Google Cloud Vision API
- AWS Textract
- Azure Computer Vision
- Tesseract (open-source, offline option)

#### From CSV/Excel Uploads
1. User uploads CSV or Excel file
2. File is parsed into structured data
3. Column headers are detected/mapped
4. Data is imported into selected sheet
5. User can merge with existing data or create new sheet

#### From Share Links (Google Sheets, etc.)
1. User provides share link URL
2. Backend fetches data via API (Google Sheets API, etc.)
3. Data is synced to local sheet
4. **Live sync option**: Periodically refresh data from source
5. Changes are tracked and versioned

#### From API Integrations (Premium)
1. User connects to external API (Stripe, Shopify, HubSpot, etc.)
2. API credentials stored securely (encrypted)
3. Data pulled on scheduled intervals
4. Automatic mapping of API response to sheet columns
5. Real-time updates available

### Backend Technical Requirements

#### Database Schema (Relational)

**Users Table**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  created_at TIMESTAMP,
  subscription_tier VARCHAR(50) -- 'free', 'pro', 'enterprise'
);
```

**Projects Table**
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  is_archived BOOLEAN DEFAULT FALSE
);
```

**Folders Table**
```sql
CREATE TABLE folders (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255),
  created_at TIMESTAMP,
  position INT -- for custom ordering
);
```

**Sheets Table**
```sql
CREATE TABLE sheets (
  id UUID PRIMARY KEY,
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  name VARCHAR(255),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  column_definitions JSONB, -- stores column names, types, formatting
  row_count INT
);
```

**Sheet Data Table**
```sql
CREATE TABLE sheet_data (
  id UUID PRIMARY KEY,
  sheet_id UUID REFERENCES sheets(id) ON DELETE CASCADE,
  row_index INT,
  column_index INT,
  value TEXT,
  value_type VARCHAR(50), -- 'string', 'number', 'date', 'currency', etc.
  formatted_value TEXT, -- for display (e.g., "$1,234.56")
  metadata JSONB, -- cell formatting, notes, etc.
  UNIQUE(sheet_id, row_index, column_index)
);
```

**Captures Table** (links captures to sheets)
```sql
CREATE TABLE captures (
  id UUID PRIMARY KEY,
  sheet_id UUID REFERENCES sheets(id),
  capture_box_id UUID, -- links to capture box metadata
  source_type VARCHAR(50), -- 'screenshot', 'csv', 'api', 'share_link'
  source_url TEXT, -- if from share link or API
  screenshot_path TEXT, -- path to stored image
  ocr_confidence FLOAT, -- if OCR was used
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### NoSQL Alternative (MongoDB/Document Store)
For more flexible schema, consider document-based storage:

```json
{
  "projectId": "uuid-123",
  "name": "Q4 Marketing Analysis",
  "folders": [
    {
      "folderId": "uuid-456",
      "name": "HubSpot Data",
      "sheets": [
        {
          "sheetId": "uuid-789",
          "name": "Revenue Metrics",
          "columns": [
            {"name": "Date", "type": "date", "format": "MM/DD/YYYY"},
            {"name": "Revenue", "type": "currency", "format": "$0,0.00"}
          ],
          "rows": [
            {"Date": "2024-10-01", "Revenue": 125000},
            {"Date": "2024-10-02", "Revenue": 132000}
          ],
          "metadata": {
            "source": "screenshot",
            "captureId": "uuid-capture-1",
            "ocrConfidence": 0.95
          }
        }
      ]
    }
  ]
}
```

### Spreadsheet UI Component

The prototype includes `/components/Spreadsheet.tsx` which demonstrates the basic interface. Production version needs:

#### Core Features
- **Cell editing**: Click to edit, Enter to confirm, Esc to cancel
- **Keyboard navigation**: Arrow keys, Tab, Shift+Tab
- **Column resizing**: Drag column borders
- **Row selection**: Click row number to select entire row
- **Column selection**: Click column header to select entire column
- **Multi-select**: Shift+click, Ctrl/Cmd+click
- **Context menu**: Right-click for cut/copy/paste/delete
- **Toolbar**: Add row, add column, delete, sort, filter, export
- **Data types**: Auto-detect or manually set (text, number, date, boolean)
- **Cell formatting**: Font, color, background, borders, alignment
- **Formulas**: Support for basic calculations across cells

#### Advanced Features
- **Conditional formatting**: Highlight cells based on rules
- **Data validation**: Dropdowns, number ranges, date ranges
- **Comments/Notes**: Attach notes to specific cells
- **Version history**: Track changes over time with rollback
- **Collaboration**: Multi-user editing (future feature)
- **Charts**: Generate charts from sheet data
- **Pivot tables**: Summarize and analyze data

#### Suggested Libraries for Spreadsheet UI
- **Handsontable** (commercial license required for production)
- **AG Grid** (community or enterprise edition)
- **React Data Grid** (various implementations)
- **Custom build** using `react-window` for virtualization

### Data Sync & Cloud Storage

#### Local-First Architecture
- All data stored locally in SQLite/embedded database
- Fast access, works offline
- User owns their data

#### Optional Cloud Sync
- End-to-end encrypted sync to cloud storage
- Allows access from multiple devices
- Backup and disaster recovery
- Suggested: 
  - Supabase (Postgres + Auth + Storage)
  - Firebase (Firestore + Auth)
  - AWS (RDS + Cognito + S3)

#### Conflict Resolution
- Last-write-wins for simple cases
- Operational Transform (OT) or CRDT for collaborative editing
- User-prompted merge for conflicting changes

---

## AI Analyst Assistant Integration

**Key Value Proposition:**  
Users build up a **persistent database** of captured data that the AI Analyst can reference for **cross-source business insights**.

**Example Workflow:**
1. User captures revenue data from HubSpot → Saved to "Marketing Project" → "HubSpot" folder → "Revenue" sheet
2. User captures ad spend from Google Ads → Saved to "Marketing Project" → "Google Ads" folder → "Spend" sheet  
3. User captures website traffic from Google Analytics → Saved to "Marketing Project" → "Analytics" folder → "Traffic" sheet
4. User asks AI: "What's my CAC trend over the last 6 months?"
5. AI references all three sheets across the project to calculate Customer Acquisition Cost
6. AI provides answer with citations to specific cells/sheets

**Production Requirements:**

#### AI Integration with Backend
- **Full data access**: AI has read access to all sheets in user's workspace
- **Cross-sheet analysis**: AI can JOIN data from multiple sheets/sources
- **Natural language queries**: Convert questions to SQL/data operations
- **Context awareness**: AI knows project structure, column meanings, data sources
- **Citation system**: AI responses link back to specific cells/rows in sheets

#### AI Feature Set
1. **Query Interface**
   - Natural language input: "Show me revenue by channel this quarter"
   - AI translates to data operations and retrieves results
   - Results displayed as tables, charts, or summary text

2. **Insights & Anomaly Detection**
   - AI proactively identifies trends, outliers, correlations
   - "Your CAC increased 23% last week - mainly due to Facebook Ads"
   - Notifications/alerts for significant changes

3. **Data Enrichment**
   - AI suggests missing data points
   - Auto-fill based on patterns
   - Suggest new captures to complete analysis

4. **Report Generation**
   - "Create a Q4 performance report"
   - AI pulls data from multiple sheets
   - Generates formatted report with charts and insights

#### Technical Implementation

**Vector Database Integration**

The AI Chat Assistant will work with the backend data of all projects uploaded to a user's account via a **Vector Database**.

**What is a Vector Database?**
- A vector database stores and manages data as high-dimensional vectors, which are numerical representations of complex data like text, images, and audio
- These databases enable fast and accurate similarity searches based on **meaning and context**, rather than just keywords
- Essential for AI applications to provide semantic understanding of data

**Why Vector Database for CaptureInsight?**
- **Cross-source analysis**: Enables AI to understand relationships between data from different sources (HubSpot, Google Ads, Salesforce, etc.)
- **Semantic search**: Users can ask questions in natural language, and AI finds relevant data based on meaning
- **Context awareness**: AI understands the business context of captured metrics across all projects
- **Fast retrieval**: Efficient querying of large amounts of captured data
- **Intelligent recommendations**: AI can suggest insights by finding similar patterns across different time periods or data sources

**How it Works:**
1. When data is captured (screenshot, CSV, API), it's processed and converted to vector embeddings
2. Vector embeddings are stored in the vector database alongside the original data
3. When user asks AI a question, the question is also converted to a vector
4. Vector database performs similarity search to find the most relevant data
5. Retrieved data is provided to LLM for accurate, context-aware responses
6. AI references specific sheets/cells in responses with proper citations

**Use Cases:**
- "Compare my CAC across all marketing channels this quarter" → AI searches vectors of all marketing-related sheets
- "What caused the revenue spike in October?" → AI finds temporal patterns in revenue data and correlating metrics
- "Are there any unusual patterns in my sales data?" → AI performs anomaly detection using vector similarity
- "Show me all data related to customer retention" → Semantic search across all projects finds retention-related captures

**Technical Stack:**
- **Vector embeddings**: Store embeddings of sheet data for semantic search
- **RAG (Retrieval Augmented Generation)**: Combine sheet data with LLM
- **Function calling**: Allow AI to execute data queries
- **Suggested stack**:
  - OpenAI GPT-4 or Anthropic Claude for LLM
  - OpenAI Text-Embedding-3 or similar for creating vector embeddings
  - LangChain for orchestration
  - **Vector Database Options**:
    - Pinecone (managed, scalable)
    - Weaviate (open-source, hybrid search)
    - Qdrant (high performance, open-source)
    - Chroma (lightweight, embedded)
    - Supabase + pgvector (PostgreSQL extension)
  - Custom SQL generation for structured queries

---

### Vector Database & AI Assistant - Detailed Implementation Guide

**⚠️ CRITICAL: This section outlines the complete database architecture for production**

#### Overview
The production application requires a sophisticated database structure that combines:
- **Traditional relational data** (users, projects, folders, sheets)
- **Vector embeddings** (for semantic search and AI analysis)
- **Hybrid search capabilities** (combining vector similarity with metadata filters)

This enables the AI Assistant to provide accurate, contextual insights across all captured data with zero hallucinations.

---

#### Database Architecture: PostgreSQL + pgvector Extension

**Why PostgreSQL with pgvector?**
- ✅ Combines relational and vector data in one database
- ✅ ACID compliance for data integrity
- ✅ Built-in support via pgvector extension
- ✅ Cost-effective (no separate vector database service needed)
- ✅ Supabase native support for seamless integration
- ✅ Mature ecosystem with excellent tooling

**Setup Requirements:**

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
SELECT * FROM pg_extension WHERE extname = 'vector';
```

---

#### Core Schema: document_embeddings Table

This table is the foundation of the AI Assistant's semantic search capabilities.

```sql
CREATE TABLE document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relational references
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  sheet_id UUID REFERENCES sheets(id) ON DELETE CASCADE,
  
  -- Content metadata
  content_type VARCHAR(50) NOT NULL, -- 'screenshot', 'csv', 'excel', 'share_link', 'api_data', 'user_note'
  content_text TEXT NOT NULL, -- Raw text content for reference
  content_summary TEXT, -- AI-generated summary of content
  
  -- Vector embedding (1536 dimensions for OpenAI text-embedding-3-small)
  embedding VECTOR(1536) NOT NULL,
  
  -- Metadata for filtering and context
  metadata JSONB DEFAULT '{}', -- Flexible structure for additional context
  
  -- Source information
  source_type VARCHAR(100), -- 'hubspot_dashboard', 'google_ads', 'salesforce', etc.
  source_url TEXT, -- Original URL if applicable
  source_file_path TEXT, -- Path to original file/screenshot
  
  -- OCR/extraction metadata (if from screenshot)
  ocr_confidence FLOAT, -- 0.0 to 1.0
  extracted_data JSONB, -- Structured data extracted from content
  
  -- Cell-level granularity (if from sheet)
  row_references INT[], -- Array of row indices this embedding relates to
  column_references TEXT[], -- Array of column names this embedding relates to
  cell_range TEXT, -- e.g., "A1:D10" for spreadsheet ranges
  
  -- Temporal context
  data_period_start DATE, -- Time period this data represents (if applicable)
  data_period_end DATE,
  
  -- Embedding metadata
  embedding_model VARCHAR(100) DEFAULT 'text-embedding-3-small',
  embedding_version VARCHAR(50),
  embedding_created_at TIMESTAMP DEFAULT NOW(),
  
  -- Standard timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Soft delete for audit trail
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_document_embeddings_user ON document_embeddings(user_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_document_embeddings_project ON document_embeddings(project_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_document_embeddings_sheet ON document_embeddings(sheet_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_document_embeddings_content_type ON document_embeddings(content_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_document_embeddings_data_period ON document_embeddings(data_period_start, data_period_end) WHERE is_deleted = FALSE;

-- CRITICAL: Vector similarity search index (HNSW for performance)
CREATE INDEX idx_document_embeddings_vector ON document_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- GIN index for JSONB metadata queries
CREATE INDEX idx_document_embeddings_metadata ON document_embeddings USING GIN (metadata);
```

---

#### Embedding Generation Service

**Service Architecture:**

```typescript
// Embedding Service Interface
interface EmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
  getEmbeddingDimensions(): number;
}

// OpenAI Implementation (Recommended)
class OpenAIEmbeddingService implements EmbeddingService {
  private apiKey: string;
  private model: string = 'text-embedding-3-small'; // 1536 dimensions, $0.02/1M tokens
  
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: text,
        model: this.model
      })
    });
    
    const data = await response.json();
    return data.data[0].embedding;
  }
  
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    // OpenAI supports up to 2048 texts per request
    const batches = this.chunkArray(texts, 2048);
    const allEmbeddings: number[][] = [];
    
    for (const batch of batches) {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: batch,
          model: this.model
        })
      });
      
      const data = await response.json();
      allEmbeddings.push(...data.data.map(d => d.embedding));
    }
    
    return allEmbeddings;
  }
  
  getEmbeddingDimensions(): number {
    return 1536; // text-embedding-3-small
    // For higher quality: 'text-embedding-3-large' = 3072 dimensions at $0.13/1M tokens
  }
}
```

**Alternative Embedding Providers:**

| Provider | Model | Dimensions | Cost | Notes |
|----------|-------|------------|------|-------|
| OpenAI | text-embedding-3-small | 1536 | $0.02/1M tokens | **Recommended** - Best balance |
| OpenAI | text-embedding-3-large | 3072 | $0.13/1M tokens | Higher quality |
| Cohere | embed-english-v3.0 | 1024 | $0.10/1M tokens | Good for English only |
| Google | text-embedding-004 | 768 | $0.025/1M chars | Competitive pricing |
| Azure OpenAI | text-embedding-ada-002 | 1536 | Variable | Enterprise compliance |
| HuggingFace | sentence-transformers | 384-768 | Free (self-hosted) | Open source option |

**Recommendation: Start with OpenAI text-embedding-3-small**
- Proven quality for business data
- Excellent cost/performance ratio
- Easy integration
- Can upgrade to text-embedding-3-large later for better results

---

#### Auto-Embedding Pipeline

**Trigger Points:**
All captured data must be automatically embedded. Here's the complete flow:

```typescript
// Auto-embedding workflow
async function processNewCapture(capture: Capture) {
  // 1. Extract/normalize text content
  const content = await extractContent(capture);
  
  // 2. Generate embedding
  const embedding = await embeddingService.generateEmbedding(content.text);
  
  // 3. Create metadata
  const metadata = {
    capture_id: capture.id,
    data_source: capture.source_type,
    metric_names: content.detectedMetrics,
    date_captured: capture.created_at,
    user_tags: capture.tags,
    project_name: capture.project.name,
    folder_name: capture.folder.name,
    sheet_name: capture.sheet.name
  };
  
  // 4. Store in document_embeddings
  await db.insert('document_embeddings', {
    user_id: capture.user_id,
    project_id: capture.project_id,
    folder_id: capture.folder_id,
    sheet_id: capture.sheet_id,
    content_type: capture.source_type,
    content_text: content.text,
    content_summary: await generateSummary(content.text),
    embedding: embedding,
    metadata: metadata,
    source_type: capture.source_application,
    source_url: capture.source_url,
    source_file_path: capture.screenshot_path,
    ocr_confidence: content.ocrConfidence,
    extracted_data: content.structuredData,
    row_references: content.rowIndices,
    column_references: content.columnNames,
    data_period_start: content.detectedDateRange?.start,
    data_period_end: content.detectedDateRange?.end,
    embedding_model: 'text-embedding-3-small',
    embedding_version: '1.0'
  });
}

// Content extraction strategies by type
async function extractContent(capture: Capture): Promise<ExtractedContent> {
  switch (capture.source_type) {
    case 'screenshot':
      return await extractFromScreenshot(capture);
    
    case 'csv':
    case 'excel':
      return await extractFromSpreadsheet(capture);
    
    case 'share_link':
      return await extractFromShareLink(capture);
    
    case 'api_data':
      return await extractFromAPIResponse(capture);
    
    default:
      throw new Error(`Unknown source type: ${capture.source_type}`);
  }
}

// Screenshot-specific extraction
async function extractFromScreenshot(capture: Capture): Promise<ExtractedContent> {
  // 1. OCR to extract text
  const ocrResult = await ocrService.extract(capture.screenshot_path);
  
  // 2. Detect table structure
  const tableData = await detectTableStructure(ocrResult);
  
  // 3. Identify metrics and values
  const metrics = await identifyMetrics(tableData);
  
  // 4. Create rich text representation
  const text = `
    Source: ${capture.source_application}
    Captured: ${capture.created_at}
    Project: ${capture.project.name} / ${capture.folder.name}
    
    Data:
    ${formatTableAsText(tableData)}
    
    Key Metrics:
    ${metrics.map(m => `${m.name}: ${m.value}`).join('\n')}
  `;
  
  return {
    text,
    ocrConfidence: ocrResult.confidence,
    structuredData: tableData,
    detectedMetrics: metrics.map(m => m.name),
    rowIndices: tableData.rowIndices,
    columnNames: tableData.columnNames,
    detectedDateRange: extractDateRange(tableData)
  };
}
```

**Chunking Strategy for Large Content:**

For large spreadsheets or documents, split into smaller chunks for better semantic search:

```typescript
async function chunkAndEmbedLargeContent(sheetId: UUID, content: string) {
  const MAX_CHUNK_SIZE = 8000; // OpenAI token limit ~8191
  const CHUNK_OVERLAP = 200; // Overlap for context continuity
  
  const chunks = splitIntoChunks(content, MAX_CHUNK_SIZE, CHUNK_OVERLAP);
  
  // Generate embeddings for all chunks in batch
  const embeddings = await embeddingService.generateBatchEmbeddings(chunks);
  
  // Store each chunk as separate document
  for (let i = 0; i < chunks.length; i++) {
    await db.insert('document_embeddings', {
      sheet_id: sheetId,
      content_text: chunks[i],
      embedding: embeddings[i],
      metadata: {
        chunk_index: i,
        total_chunks: chunks.length,
        chunk_overlap: CHUNK_OVERLAP
      }
    });
  }
}
```

---

#### AI Assistant: Semantic Search + RAG Pattern

**Query Flow:**

```typescript
// AI Assistant query handler
async function handleAIQuery(userId: UUID, query: string): Promise<AIResponse> {
  // 1. Generate embedding for user query
  const queryEmbedding = await embeddingService.generateEmbedding(query);
  
  // 2. Semantic search with hybrid filtering
  const relevantDocs = await semanticSearch(userId, queryEmbedding, {
    limit: 10,
    similarityThreshold: 0.7,
    filters: {
      // Optional: filter by project, date range, content type, etc.
    }
  });
  
  // 3. Retrieve full context from matched documents
  const context = await buildContextFromDocs(relevantDocs);
  
  // 4. RAG: Augment query with retrieved context
  const prompt = buildRAGPrompt(query, context);
  
  // 5. Generate response with LLM
  const response = await llmService.generateResponse(prompt);
  
  // 6. Add citations
  const responseWithCitations = addCitations(response, relevantDocs);
  
  return {
    answer: responseWithCitations.text,
    citations: responseWithCitations.citations,
    confidence: response.confidence,
    relevant_sheets: relevantDocs.map(d => d.sheet_id)
  };
}

// Semantic search implementation
async function semanticSearch(
  userId: UUID, 
  queryEmbedding: number[], 
  options: SearchOptions
): Promise<SearchResult[]> {
  
  const results = await db.query(`
    SELECT 
      de.id,
      de.content_text,
      de.content_summary,
      de.metadata,
      de.sheet_id,
      de.project_id,
      de.source_type,
      de.row_references,
      de.column_references,
      de.extracted_data,
      
      -- Cosine similarity score
      1 - (de.embedding <=> $1::vector) AS similarity_score,
      
      -- Join sheet info for context
      s.name AS sheet_name,
      f.name AS folder_name,
      p.name AS project_name
      
    FROM document_embeddings de
    JOIN sheets s ON de.sheet_id = s.id
    JOIN folders f ON s.folder_id = f.id
    JOIN projects p ON f.project_id = p.id
    
    WHERE 
      de.user_id = $2
      AND de.is_deleted = FALSE
      AND (1 - (de.embedding <=> $1::vector)) >= $3
      
      -- Optional metadata filters
      ${options.filters?.projectId ? 'AND de.project_id = $4' : ''}
      ${options.filters?.contentType ? 'AND de.content_type = $5' : ''}
      ${options.filters?.dateRange ? 'AND de.data_period_start >= $6 AND de.data_period_end <= $7' : ''}
      
    ORDER BY de.embedding <=> $1::vector  -- Order by similarity (ascending distance)
    LIMIT $8
  `, [
    queryEmbedding,
    userId,
    options.similarityThreshold || 0.7,
    options.filters?.projectId,
    options.filters?.contentType,
    options.filters?.dateRange?.start,
    options.filters?.dateRange?.end,
    options.limit || 10
  ]);
  
  return results.rows;
}

// Build RAG prompt
function buildRAGPrompt(userQuery: string, context: DocumentContext[]): string {
  return `
You are an AI business analyst assistant with access to the user's captured data across multiple business tools and platforms.

Your task is to answer the user's question based ONLY on the provided context data. Do not make assumptions or hallucinate information.

## User Question:
${userQuery}

## Available Context Data:

${context.map((doc, idx) => `
### Context ${idx + 1}:
- Source: ${doc.project_name} / ${doc.folder_name} / ${doc.sheet_name}
- Type: ${doc.source_type}
- Time Period: ${doc.data_period_start} to ${doc.data_period_end}
- Content:
${doc.content_summary || doc.content_text}

- Extracted Data:
${JSON.stringify(doc.extracted_data, null, 2)}
`).join('\n\n')}

## Instructions:
1. Analyze the context data to find information relevant to the question
2. If you can answer the question, provide a clear, concise answer
3. Always cite which context sources you used (e.g., "According to HubSpot Revenue data from Q4...")
4. If the data is insufficient, say "I don't have enough data to answer this question" and suggest what additional captures would help
5. If you notice patterns, trends, or anomalies, point them out
6. For calculations (like CAC, ROI, growth rates), show your work

## Response Format:
{
  "answer": "Your detailed answer here",
  "citations": [
    {
      "context_index": 0,
      "sheet_id": "uuid",
      "relevance": "Why this source was used"
    }
  ],
  "confidence": 0.95,
  "calculations": [
    {
      "metric": "CAC",
      "formula": "Total Ad Spend / Total Conversions",
      "value": "$67.50"
    }
  ],
  "suggestions": [
    "Consider capturing conversion rate data from Google Analytics for more complete CAC analysis"
  ]
}
`;
}
```

---

#### Hybrid Search: Vector + Metadata Filters

**Why Hybrid Search?**
- Pure vector search finds semantically similar content
- Metadata filters narrow results to relevant context (project, date, source type)
- Combination provides both accuracy and relevance

**Implementation:**

```typescript
// Advanced hybrid search with multiple filters
async function hybridSearch(params: HybridSearchParams): Promise<SearchResult[]> {
  const {
    userId,
    query,
    projectIds,
    folderIds,
    contentTypes,
    dateRange,
    sourceApplications,
    minConfidence,
    limit = 20
  } = params;
  
  // Generate query embedding
  const queryEmbedding = await embeddingService.generateEmbedding(query);
  
  // Build dynamic WHERE clause
  const conditions = ['de.user_id = $1', 'de.is_deleted = FALSE'];
  const values: any[] = [userId, queryEmbedding];
  let paramIndex = 3;
  
  if (projectIds?.length) {
    conditions.push(`de.project_id = ANY($${paramIndex})`);
    values.push(projectIds);
    paramIndex++;
  }
  
  if (folderIds?.length) {
    conditions.push(`de.folder_id = ANY($${paramIndex})`);
    values.push(folderIds);
    paramIndex++;
  }
  
  if (contentTypes?.length) {
    conditions.push(`de.content_type = ANY($${paramIndex})`);
    values.push(contentTypes);
    paramIndex++;
  }
  
  if (dateRange) {
    conditions.push(`de.data_period_start >= $${paramIndex}`);
    values.push(dateRange.start);
    paramIndex++;
    
    conditions.push(`de.data_period_end <= $${paramIndex}`);
    values.push(dateRange.end);
    paramIndex++;
  }
  
  if (sourceApplications?.length) {
    conditions.push(`de.metadata->>'data_source' = ANY($${paramIndex})`);
    values.push(sourceApplications);
    paramIndex++;
  }
  
  if (minConfidence) {
    conditions.push(`de.ocr_confidence >= $${paramIndex}`);
    values.push(minConfidence);
    paramIndex++;
  }
  
  // Execute hybrid search
  const results = await db.query(`
    SELECT 
      de.*,
      1 - (de.embedding <=> $2::vector) AS similarity_score,
      s.name AS sheet_name,
      f.name AS folder_name,
      p.name AS project_name,
      
      -- Calculate relevance score (weighted combination)
      (
        (1 - (de.embedding <=> $2::vector)) * 0.7 +  -- 70% vector similarity
        (CASE WHEN de.ocr_confidence > 0.9 THEN 0.3 ELSE de.ocr_confidence * 0.3 END)  -- 30% OCR confidence
      ) AS relevance_score
      
    FROM document_embeddings de
    JOIN sheets s ON de.sheet_id = s.id
    JOIN folders f ON s.folder_id = f.id
    JOIN projects p ON f.project_id = p.id
    
    WHERE ${conditions.join(' AND ')}
    
    ORDER BY relevance_score DESC
    LIMIT $${paramIndex}
  `, [...values, limit]);
  
  return results.rows;
}
```

**Metadata Enrichment for Better Filtering:**

```typescript
// Enrich metadata during capture processing
function enrichMetadata(capture: Capture): object {
  return {
    // Basic info
    capture_id: capture.id,
    data_source: capture.source_application,
    url: capture.source_url,
    
    // Detected business context
    detected_metrics: extractMetricNames(capture.content),
    business_domain: classifyBusinessDomain(capture.content), // 'marketing', 'sales', 'finance', etc.
    
    // Temporal
    fiscal_quarter: calculateFiscalQuarter(capture.data_period_start),
    week_of_year: getWeekOfYear(capture.data_period_start),
    
    // User context
    user_tags: capture.tags,
    user_notes: capture.description,
    
    // Quality metrics
    data_completeness: calculateCompleteness(capture.extracted_data),
    
    // Relationships
    related_captures: findRelatedCaptures(capture),
    
    // Custom dimensions (user-defined)
    ...capture.custom_metadata
  };
}
```

---

#### Performance Optimization

**Target Performance Metrics:**
- ✅ Semantic search query: **<100ms** for most queries
- ✅ Embedding generation: **<500ms** per capture
- ✅ RAG response generation: **<3 seconds** total

**Optimization Strategies:**

1. **Index Tuning**
```sql
-- HNSW index parameters (tune based on dataset size)
-- m: Number of connections per layer (16-64, higher = better recall, slower build)
-- ef_construction: Size of dynamic candidate list (64-200, higher = better quality)

CREATE INDEX idx_document_embeddings_vector ON document_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- For larger datasets (>1M embeddings), use higher values:
-- WITH (m = 32, ef_construction = 128);

-- Query-time tuning
SET hnsw.ef_search = 100; -- Higher = better recall, slower query (default: 40)
```

2. **Caching Strategy**
```typescript
// Cache frequently asked questions
const queryCache = new LRUCache<string, AIResponse>({
  max: 1000,
  ttl: 1000 * 60 * 60 // 1 hour
});

async function handleAIQueryWithCache(userId: UUID, query: string): Promise<AIResponse> {
  const cacheKey = `${userId}:${query}`;
  
  if (queryCache.has(cacheKey)) {
    return queryCache.get(cacheKey)!;
  }
  
  const response = await handleAIQuery(userId, query);
  queryCache.set(cacheKey, response);
  
  return response;
}
```

3. **Batch Processing**
```typescript
// Process embeddings in batches during off-peak hours
async function batchReprocessEmbeddings() {
  const batchSize = 100;
  let offset = 0;
  
  while (true) {
    const captures = await db.query(`
      SELECT * FROM captures 
      WHERE id NOT IN (SELECT DISTINCT capture_id FROM document_embeddings)
      LIMIT $1 OFFSET $2
    `, [batchSize, offset]);
    
    if (captures.rows.length === 0) break;
    
    // Process in parallel (up to 10 concurrent)
    await Promise.all(
      captures.rows.map(c => processNewCapture(c))
    );
    
    offset += batchSize;
  }
}
```

4. **Materialized Views for Common Queries**
```sql
-- Pre-aggregate frequently accessed data
CREATE MATERIALIZED VIEW user_project_summary AS
SELECT 
  p.user_id,
  p.id AS project_id,
  p.name AS project_name,
  COUNT(DISTINCT de.id) AS total_embeddings,
  COUNT(DISTINCT de.sheet_id) AS total_sheets,
  MAX(de.created_at) AS last_capture_date,
  array_agg(DISTINCT de.content_type) AS content_types
FROM projects p
JOIN folders f ON f.project_id = p.id
JOIN sheets s ON s.folder_id = f.id
JOIN document_embeddings de ON de.sheet_id = s.id
WHERE de.is_deleted = FALSE
GROUP BY p.user_id, p.id, p.name;

-- Refresh periodically
REFRESH MATERIALIZED VIEW CONCURRENTLY user_project_summary;
```

---

#### End Goals Achievement Checklist

**✅ Accurate retrieval from large datasets**
- pgvector handles millions of embeddings efficiently
- Hybrid search combines semantic similarity with exact metadata matching
- Chunking strategy ensures no information is lost in large documents

**✅ Fast semantic search (<100ms for most queries)**
- HNSW index provides O(log n) search complexity
- Properly tuned index parameters balance speed and accuracy
- Materialized views reduce query complexity for common patterns

**✅ Contextual awareness across all projects**
- Embeddings include rich metadata (project, folder, sheet context)
- Relationship tracking links related captures
- Temporal awareness via date range fields

**✅ No hallucinations (grounded in real data)**
- RAG pattern ensures LLM only uses provided context
- Citation system links every claim to source data
- Confidence scoring helps users assess answer reliability
- Clear "insufficient data" responses when context is lacking

---

#### Migration & Rollout Strategy

**Phase 1: Foundation (Week 1-2)**
- [ ] Enable pgvector extension on database
- [ ] Create document_embeddings table and indexes
- [ ] Implement embedding generation service
- [ ] Set up OpenAI API integration

**Phase 2: Data Pipeline (Week 3-4)**
- [ ] Build auto-embedding pipeline for new captures
- [ ] Implement batch processing for existing captures
- [ ] Add metadata enrichment logic
- [ ] Set up embedding quality monitoring

**Phase 3: Search (Week 5-6)**
- [ ] Implement semantic search function
- [ ] Add hybrid search with metadata filters
- [ ] Build query optimization and caching
- [ ] Performance testing and tuning

**Phase 4: AI Assistant (Week 7-8)**
- [ ] Implement RAG pattern
- [ ] Build LLM integration (GPT-4)
- [ ] Add citation system
- [ ] Create response formatting

**Phase 5: Optimization (Week 9-10)**
- [ ] Fine-tune HNSW parameters
- [ ] Implement caching strategies
- [ ] Add monitoring and alerts
- [ ] Load testing with realistic data volumes

**Phase 6: Launch (Week 11-12)**
- [ ] Beta testing with select users
- [ ] Gather feedback and iterate
- [ ] Full production rollout
- [ ] Documentation and user guides

---

#### Monitoring & Maintenance

**Key Metrics to Track:**
```typescript
interface EmbeddingMetrics {
  // Performance
  avg_embedding_time: number;
  avg_search_time: number;
  avg_rag_response_time: number;
  
  // Quality
  avg_ocr_confidence: number;
  avg_similarity_scores: number;
  
  // Volume
  total_embeddings: number;
  embeddings_per_day: number;
  queries_per_day: number;
  
  // Costs
  embedding_api_cost: number;
  llm_api_cost: number;
  
  // User satisfaction
  positive_feedback_rate: number;
  citation_click_rate: number;
}
```

**Health Checks:**
```sql
-- Monitor index size and fragmentation
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  idx_scan AS index_scans
FROM pg_stat_user_indexes
WHERE tablename = 'document_embeddings'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Monitor query performance
SELECT 
  query,
  mean_exec_time,
  stddev_exec_time,
  calls
FROM pg_stat_statements
WHERE query LIKE '%document_embeddings%'
ORDER BY mean_exec_time DESC
LIMIT 20;
```

---

### Best Practices for Vector Database Operations

1. **Always use prepared statements** to prevent SQL injection with vector data
2. **Normalize embeddings** if using inner product distance (not needed for cosine)
3. **Monitor index build times** - HNSW can take hours for large datasets
4. **Use CONCURRENTLY** when creating indexes on production tables
5. **Vacuum regularly** to maintain index performance
6. **Test similarity thresholds** - optimal value varies by use case (typically 0.6-0.8)
7. **Version your embeddings** - model updates may require reprocessing
8. **Implement graceful degradation** - fall back to metadata search if vector search fails
9. **Log failed embeddings** for debugging and reprocessing
10. **Budget for API costs** - embedding generation can add up at scale

---