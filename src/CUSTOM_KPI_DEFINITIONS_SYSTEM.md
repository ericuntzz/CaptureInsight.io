# Custom KPI Definitions & Multi-Definition System

**⚠️ CRITICAL FEATURE: This system ensures AI Assistant accuracy by maintaining context-aware KPI definitions across teams**

**NOTE FOR REPLIT:** This addresses one of the most painful problems in data analytics - inconsistent KPI definitions across teams. When the AI Assistant says "conversion increased 23%", which conversion does it mean? This feature ensures the AI always uses the correct definition based on who's asking and what context they're in.

---

## The Core Problem: Definition Disconnectedness

Digital marketing teams struggle with **inconsistent data definitions** across departments. The same KPI term means different things to different people:

### Real-World Example: "Conversion"

| Team | Their Definition of "Conversion" | Impact on Analysis |
|------|----------------------------------|-------------------|
| Media Buyer | User signs up for the product (lead generation) | Measures ad campaign effectiveness |
| Sales Team | User books a demo call | Measures SDR performance |
| Executive Team | User becomes a paying customer | Measures business growth |
| Product Team | User completes onboarding | Measures product adoption |

**The Problem:**
When someone asks "What's our conversion rate?", the AI Assistant needs to know:
1. **Who is asking?** (Media buyer, exec, sales person)
2. **What context are they in?** (Which Space/Project/Folder)
3. **What definition should be applied?** (Signup, demo booked, paid customer, or onboarded user)

Without this context, the AI gives misleading or incorrect answers, destroying user trust.

---

## The Solution: Multi-Definition KPI System

### Architecture Overview

Every KPI can have **multiple definitions** that are context-aware:
- **Global Definition** (default across entire workspace)
- **Space-Specific Definition** (override for specific projects)
- **Team/Role-Specific Definition** (override based on who's asking)
- **Time-Based Definition** (override for specific time periods, e.g., "we changed how we track conversions in Q3 2024")

The AI Assistant automatically selects the correct definition based on:
1. Current Space/Project context
2. User's role/team
3. Time period of the data being analyzed
4. Explicit user specification

---

## Database Schema: KPI Definitions

```sql
-- Base KPI table
CREATE TABLE kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- KPI identifier
  kpi_name VARCHAR(255) NOT NULL, -- e.g., "Conversion", "CAC", "MRR"
  kpi_slug VARCHAR(255) NOT NULL, -- e.g., "conversion", "cac", "mrr" (normalized)
  
  -- Default/Global definition
  global_definition TEXT NOT NULL,
  global_calculation_formula TEXT, -- e.g., "COUNT(users WHERE status='paid') / COUNT(users WHERE status='trial')"
  
  -- Metadata
  category VARCHAR(100), -- 'marketing', 'sales', 'finance', 'product'
  unit VARCHAR(50), -- 'percentage', 'dollars', 'count', 'ratio'
  is_custom BOOLEAN DEFAULT TRUE, -- vs. platform-provided KPI
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, kpi_slug)
);

-- Multi-definition table (context-specific overrides)
CREATE TABLE kpi_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID REFERENCES kpis(id) ON DELETE CASCADE,
  
  -- Context selectors (any combination can be used)
  space_id UUID REFERENCES projects(id) ON DELETE CASCADE, -- Apply to specific Space
  team_name VARCHAR(100), -- 'media_buying', 'sales', 'executive', 'product'
  user_role VARCHAR(100), -- 'media_buyer', 'vp_marketing', 'ceo', 'analyst'
  
  -- Time-based context
  effective_from DATE, -- Definition applies starting this date
  effective_until DATE, -- Definition applies until this date (NULL = ongoing)
  
  -- The override definition
  definition TEXT NOT NULL,
  calculation_formula TEXT,
  notes TEXT, -- e.g., "Changed methodology in Q3 2024 to exclude demo accounts"
  
  -- Priority (higher number = higher priority when multiple definitions match)
  priority INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- KPI assignments to data (links KPIs to actual captured data)
CREATE TABLE kpi_data_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID REFERENCES kpis(id) ON DELETE CASCADE,
  
  -- What data this KPI is calculated from
  sheet_id UUID REFERENCES sheets(id) ON DELETE CASCADE,
  column_name VARCHAR(255), -- Which column contains this KPI
  
  -- Mapping metadata
  auto_detected BOOLEAN DEFAULT FALSE, -- Was this detected by AI or user-specified?
  confidence_score FLOAT, -- If auto-detected, how confident are we?
  
  created_at TIMESTAMP DEFAULT NOW(),
  last_verified_at TIMESTAMP
);

-- KPI synonyms (different names for same metric)
CREATE TABLE kpi_synonyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID REFERENCES kpis(id) ON DELETE CASCADE,
  
  synonym VARCHAR(255) NOT NULL,
  
  UNIQUE(kpi_id, synonym)
);

-- Examples of synonyms:
-- KPI: "Conversion Rate"
-- Synonyms: "CVR", "Conversion %", "Conv Rate", "Sign-up Rate"

-- Indexes for performance
CREATE INDEX idx_kpi_definitions_space ON kpi_definitions(space_id);
CREATE INDEX idx_kpi_definitions_team ON kpi_definitions(team_name);
CREATE INDEX idx_kpi_definitions_role ON kpi_definitions(user_role);
CREATE INDEX idx_kpi_definitions_dates ON kpi_definitions(effective_from, effective_until);
CREATE INDEX idx_kpi_data_mappings_sheet ON kpi_data_mappings(sheet_id);
CREATE INDEX idx_kpi_synonyms_synonym ON kpi_synonyms(synonym);
```

---

## KPI Resolution Algorithm

When the AI Assistant encounters a KPI reference, it must resolve which definition to use:

```typescript
interface KPIContext {
  kpiName: string;
  spaceId?: UUID;
  userId: UUID;
  userRole?: string;
  userTeam?: string;
  dateContext?: Date; // The date of the data being analyzed
}

async function resolveKPIDefinition(context: KPIContext): Promise<KPIDefinition> {
  const { kpiName, spaceId, userId, userRole, userTeam, dateContext } = context;
  
  // 1. Find the base KPI
  const kpi = await db.findOne('kpis', {
    user_id: userId,
    kpi_slug: normalizeKPIName(kpiName)
  });
  
  if (!kpi) {
    // Check synonyms
    const synonym = await db.findOne('kpi_synonyms', { synonym: kpiName });
    if (synonym) {
      kpi = await db.findOne('kpis', { id: synonym.kpi_id });
    }
  }
  
  if (!kpi) {
    throw new Error(`KPI "${kpiName}" not found`);
  }
  
  // 2. Find all matching definitions (context-specific overrides)
  const matchingDefinitions = await db.query(`
    SELECT *
    FROM kpi_definitions
    WHERE kpi_id = $1
      AND (
        -- Match by Space
        (space_id = $2 OR space_id IS NULL)
        -- Match by Team
        AND (team_name = $3 OR team_name IS NULL)
        -- Match by Role
        AND (user_role = $4 OR user_role IS NULL)
        -- Match by Date
        AND (
          (effective_from IS NULL OR effective_from <= $5)
          AND (effective_until IS NULL OR effective_until >= $5)
        )
      )
    ORDER BY priority DESC, created_at DESC
  `, [kpi.id, spaceId, userTeam, userRole, dateContext || new Date()]);
  
  // 3. Select the highest priority matching definition
  if (matchingDefinitions.length > 0) {
    const selectedDef = matchingDefinitions[0];
    return {
      kpiId: kpi.id,
      kpiName: kpi.kpi_name,
      definition: selectedDef.definition,
      calculationFormula: selectedDef.calculation_formula,
      source: 'context_specific',
      contextApplied: {
        space: selectedDef.space_id ? 'yes' : 'no',
        team: selectedDef.team_name || 'none',
        role: selectedDef.user_role || 'none',
        dateRange: selectedDef.effective_from 
          ? `${selectedDef.effective_from} to ${selectedDef.effective_until || 'ongoing'}` 
          : 'all time'
      },
      notes: selectedDef.notes
    };
  }
  
  // 4. Fall back to global definition
  return {
    kpiId: kpi.id,
    kpiName: kpi.kpi_name,
    definition: kpi.global_definition,
    calculationFormula: kpi.global_calculation_formula,
    source: 'global',
    contextApplied: {
      space: 'no',
      team: 'none',
      role: 'none',
      dateRange: 'all time'
    }
  };
}
```

---

## AI Assistant Integration

### Enhanced Prompt with KPI Context

```typescript
async function buildAIPromptWithKPIs(
  query: string,
  userContext: UserContext,
  retrievedData: RetrievedData[]
): Promise<string> {
  
  // 1. Detect KPIs mentioned in the query
  const mentionedKPIs = await detectKPIsInQuery(query);
  
  // 2. Resolve definitions for each KPI
  const kpiDefinitions = [];
  for (const kpiName of mentionedKPIs) {
    const definition = await resolveKPIDefinition({
      kpiName,
      spaceId: userContext.currentSpaceId,
      userId: userContext.userId,
      userRole: userContext.role,
      userTeam: userContext.team,
      dateContext: extractDateFromQuery(query)
    });
    kpiDefinitions.push(definition);
  }
  
  // 3. Build enhanced prompt
  return `
You are analyzing data for a user with the following context:
- Role: ${userContext.role}
- Team: ${userContext.team}
- Current Space: ${userContext.currentSpaceName}

## KPI Definitions for This Analysis

${kpiDefinitions.map(kpi => `
### ${kpi.kpiName}
**Definition:** ${kpi.definition}
${kpi.calculationFormula ? `**Formula:** ${kpi.calculationFormula}` : ''}
**Context Applied:** ${JSON.stringify(kpi.contextApplied, null, 2)}
${kpi.notes ? `**Notes:** ${kpi.notes}` : ''}
**Source:** ${kpi.source === 'context_specific' ? 'Custom definition for this context' : 'Global definition'}
`).join('\n')}

## User Query
${query}

## Available Data
${formatRetrievedData(retrievedData)}

## Instructions
1. Use ONLY the KPI definitions provided above
2. Always cite which definition you're using when referencing a KPI
3. If multiple definitions could apply, clarify which one you selected and why
4. If you need to reference a KPI not defined above, explicitly state that and ask for clarification

Now provide your analysis.
`;
}
```

### Example AI Response with KPI Context

**User Query:** "Why did our conversion rate drop 15% last month?"

**User Context:**
- Role: Media Buyer
- Team: Paid Acquisition
- Space: "Q4 2024 Ad Campaigns"

**AI Response:**
```
📊 DATA & TRENDS:
Your conversion rate dropped from 3.2% to 2.7% (-15.6%) in October 2024.

⚙️ KPI DEFINITION APPLIED:
I'm using the "Media Buyer" definition of Conversion:
- **Conversion** = User signs up for the product (completes registration form)
- **Conversion Rate** = Signups / Total Ad Clicks

Note: This differs from other team definitions:
- Sales Team defines Conversion as "demo booked"
- Executive Team defines Conversion as "became paying customer"

I'm using the Media Buyer definition because:
1. You're on the Paid Acquisition team
2. We're analyzing data in the "Q4 2024 Ad Campaigns" Space
3. This matches how your ad campaign performance is typically measured

[Rest of analysis continues with this definition...]
```

---

## UI/UX Implementation

### 1. KPI Management Interface

**Location:** Within each Space settings, plus global workspace settings

**Components:**

#### A. KPI Manager Button
- Floating action button or sidebar item
- Icon: Tag/Label icon with count badge showing number of custom KPIs
- Click to open KPI Management Panel

#### B. KPI Management Panel

```typescript
interface KPIManagerUI {
  sections: {
    // Tab 1: Custom KPIs List
    kpiList: {
      searchBar: SearchInput;
      filterBy: ['category', 'team', 'space'];
      sortBy: ['name', 'created_date', 'usage_count'];
      kpiCards: KPICard[];
    };
    
    // Tab 2: Multi-Definitions
    multiDefinitions: {
      selectedKPI: KPISelector;
      definitionsTable: DefinitionRow[];
      addDefinitionButton: Button;
    };
    
    // Tab 3: Bulk Operations
    bulkOperations: {
      selectAll: Checkbox;
      selectedKPIs: KPICard[];
      actions: ['migrate_to_space', 'duplicate', 'delete', 'export'];
    };
  };
}
```

**KPI Card Component:**
```tsx
interface KPICardProps {
  kpi: KPI;
  showDefinitionCount?: boolean;
}

function KPICard({ kpi, showDefinitionCount }: KPICardProps) {
  return (
    <div className="kpi-card">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold">{kpi.kpi_name}</h3>
          <span className="text-xs text-gray-500">{kpi.category}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuItem onClick={() => editKPI(kpi)}>Edit</DropdownMenuItem>
          <DropdownMenuItem onClick={() => duplicateKPI(kpi)}>Duplicate</DropdownMenuItem>
          <DropdownMenuItem onClick={() => addDefinition(kpi)}>Add Definition</DropdownMenuItem>
          <DropdownMenuItem onClick={() => deleteKPI(kpi)} className="text-red-600">Delete</DropdownMenuItem>
        </DropdownMenu>
      </div>
      
      {/* Global Definition - Shows on hover */}
      <Tooltip content={kpi.global_definition}>
        <div className="definition-preview">
          {truncate(kpi.global_definition, 80)}
        </div>
      </Tooltip>
      
      {/* Metadata */}
      <div className="flex gap-2 mt-2">
        <Badge>{kpi.unit}</Badge>
        {showDefinitionCount && (
          <Badge variant="secondary">
            {kpi.definition_count} {kpi.definition_count === 1 ? 'definition' : 'definitions'}
          </Badge>
        )}
      </div>
      
      {/* Synonyms */}
      {kpi.synonyms?.length > 0 && (
        <div className="text-xs text-gray-500 mt-1">
          Also known as: {kpi.synonyms.join(', ')}
        </div>
      )}
    </div>
  );
}
```

#### C. Add/Edit KPI Dialog

```tsx
function AddKPIDialog({ spaceId, onSave }: AddKPIDialogProps) {
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Custom KPI</DialogTitle>
          <DialogDescription>
            Define a KPI that's specific to your team or project
          </DialogDescription>
        </DialogHeader>
        
        <form>
          {/* Basic Info */}
          <Input label="KPI Name" placeholder="e.g., Conversion Rate" required />
          <Select label="Category">
            <option value="marketing">Marketing</option>
            <option value="sales">Sales</option>
            <option value="finance">Finance</option>
            <option value="product">Product</option>
            <option value="custom">Custom</option>
          </Select>
          <Select label="Unit">
            <option value="percentage">Percentage (%)</option>
            <option value="dollars">Dollars ($)</option>
            <option value="count">Count</option>
            <option value="ratio">Ratio</option>
          </Select>
          
          {/* Global Definition */}
          <Textarea 
            label="Global Definition" 
            placeholder="Describe what this KPI means..."
            rows={3}
            required
          />
          
          <Input 
            label="Calculation Formula (Optional)" 
            placeholder="e.g., (Paid Customers / Total Signups) * 100"
          />
          
          {/* Synonyms */}
          <TagInput 
            label="Synonyms (Optional)"
            placeholder="Add alternative names for this KPI..."
            hint="e.g., 'CVR', 'Conv Rate', 'Sign-up Rate'"
          />
          
          {/* Context-Specific Definition */}
          <Separator />
          <h4>Context-Specific Definition (Optional)</h4>
          <p className="text-sm text-gray-500">
            Override the global definition for specific teams, roles, or Spaces
          </p>
          
          <Checkbox label="Add definition for current Space only" />
          <Checkbox label="Add definition for my team" />
          <Checkbox label="Add definition for my role" />
          
          {/* If any context checkbox is selected */}
          <Textarea 
            label="Context-Specific Definition" 
            placeholder="How should this KPI be defined in this context?"
          />
          
          <Input 
            label="Effective From (Optional)" 
            type="date"
            hint="When does this definition start applying?"
          />
          
          <Input 
            label="Effective Until (Optional)" 
            type="date"
            hint="When does this definition stop applying? Leave blank for ongoing"
          />
          
          <Textarea 
            label="Notes (Optional)" 
            placeholder="Why was this definition created? Any important context?"
          />
        </form>
        
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onSave}>Create KPI</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### D. Multi-Definition Manager

```tsx
function MultiDefinitionManager({ kpi }: MultiDefinitionManagerProps) {
  const [definitions, setDefinitions] = useState<KPIDefinition[]>([]);
  
  return (
    <div className="multi-definition-manager">
      <div className="header">
        <h3>{kpi.kpi_name} - Definitions</h3>
        <Button onClick={() => addNewDefinition(kpi)}>
          + Add Definition
        </Button>
      </div>
      
      {/* Global Definition (always shown) */}
      <Card className="global-definition">
        <Badge>Global (Default)</Badge>
        <h4>Definition</h4>
        <p>{kpi.global_definition}</p>
        {kpi.global_calculation_formula && (
          <>
            <h4>Formula</h4>
            <code>{kpi.global_calculation_formula}</code>
          </>
        )}
      </Card>
      
      {/* Context-Specific Definitions */}
      <div className="context-definitions">
        <h4>Context-Specific Definitions</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Context</TableHead>
              <TableHead>Definition</TableHead>
              <TableHead>Effective Period</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {definitions.map(def => (
              <TableRow key={def.id}>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {def.space_id && <Badge>Space: {def.space_name}</Badge>}
                    {def.team_name && <Badge>Team: {def.team_name}</Badge>}
                    {def.user_role && <Badge>Role: {def.user_role}</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <Tooltip content={def.definition}>
                    {truncate(def.definition, 60)}
                  </Tooltip>
                </TableCell>
                <TableCell>
                  {def.effective_from 
                    ? `${def.effective_from} to ${def.effective_until || 'ongoing'}`
                    : 'All time'
                  }
                </TableCell>
                <TableCell>{def.priority}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuItem onClick={() => editDefinition(def)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => duplicateDefinition(def)}>Duplicate</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => deleteDefinition(def)}>Delete</DropdownMenuItem>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

#### E. Bulk Migration Tool

```tsx
function BulkMigrationTool({ sourceSpaceId }: BulkMigrationToolProps) {
  const [selectedKPIs, setSelectedKPIs] = useState<UUID[]>([]);
  const [targetSpaceId, setTargetSpaceId] = useState<UUID | null>(null);
  
  return (
    <Dialog>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Migrate KPIs to Another Space</DialogTitle>
          <DialogDescription>
            Select KPIs to copy or move to a different Space
          </DialogDescription>
        </DialogHeader>
        
        {/* Source KPIs */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4>KPIs in Current Space</h4>
            <Checkbox 
              label="Select All" 
              checked={selectedKPIs.length === allKPIs.length}
              onChange={toggleSelectAll}
            />
            <div className="kpi-list">
              {allKPIs.map(kpi => (
                <Checkbox
                  key={kpi.id}
                  label={kpi.kpi_name}
                  checked={selectedKPIs.includes(kpi.id)}
                  onChange={() => toggleKPISelection(kpi.id)}
                />
              ))}
            </div>
          </div>
          
          {/* Target Space */}
          <div>
            <h4>Target Space</h4>
            <Select 
              label="Destination Space"
              value={targetSpaceId}
              onChange={setTargetSpaceId}
            >
              {spaces.map(space => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </Select>
            
            <RadioGroup label="Migration Type">
              <Radio value="copy" label="Copy (keep in both Spaces)" />
              <Radio value="move" label="Move (remove from current Space)" />
            </RadioGroup>
            
            <Checkbox label="Include all context-specific definitions" />
            <Checkbox label="Include synonyms" />
            <Checkbox label="Include data mappings" />
          </div>
        </div>
        
        <DialogFooter>
          <p className="text-sm text-gray-500">
            {selectedKPIs.length} KPI{selectedKPIs.length !== 1 ? 's' : ''} selected
          </p>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={performMigration} disabled={!targetSpaceId || selectedKPIs.length === 0}>
            Migrate KPIs
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 2. In-Context KPI Indicators

**Show KPI definitions inline when AI references them:**

```tsx
function AIResponseWithKPIs({ response }: AIResponseProps) {
  return (
    <div className="ai-response">
      {/* Main response text */}
      <div className="response-text">
        {parseResponseWithKPIs(response.text)}
      </div>
      
      {/* KPI Context Card (if KPIs were referenced) */}
      {response.kpisUsed.length > 0 && (
        <Card className="kpi-context-card">
          <CardHeader>
            <CardTitle>KPI Definitions Used</CardTitle>
            <CardDescription>
              The AI used these definitions for this analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            {response.kpisUsed.map(kpi => (
              <div key={kpi.id} className="kpi-definition-inline">
                <div className="flex items-center gap-2">
                  <strong>{kpi.kpiName}</strong>
                  {kpi.source === 'context_specific' && (
                    <Badge variant="secondary">Custom Definition</Badge>
                  )}
                </div>
                <p className="text-sm">{kpi.definition}</p>
                <details className="text-xs text-gray-500">
                  <summary>Context applied</summary>
                  <ul>
                    <li>Space: {kpi.contextApplied.space}</li>
                    <li>Team: {kpi.contextApplied.team}</li>
                    <li>Role: {kpi.contextApplied.role}</li>
                    <li>Date Range: {kpi.contextApplied.dateRange}</li>
                  </ul>
                </details>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### 3. KPI Auto-Detection & Suggestions

```typescript
// When user uploads data, suggest KPI mappings
async function suggestKPIMappings(sheetId: UUID, columnNames: string[]): Promise<KPISuggestion[]> {
  const suggestions: KPISuggestion[] = [];
  
  // Get user's existing KPIs
  const userKPIs = await getUserKPIs(userId);
  
  for (const columnName of columnNames) {
    // Check for exact matches
    const exactMatch = userKPIs.find(kpi => 
      kpi.kpi_slug === normalizeKPIName(columnName)
    );
    
    if (exactMatch) {
      suggestions.push({
        columnName,
        suggestedKPI: exactMatch,
        confidence: 1.0,
        reason: 'Exact name match'
      });
      continue;
    }
    
    // Check for synonym matches
    const synonymMatch = await findKPIBySynonym(columnName, userKPIs);
    if (synonymMatch) {
      suggestions.push({
        columnName,
        suggestedKPI: synonymMatch,
        confidence: 0.9,
        reason: 'Synonym match'
      });
      continue;
    }
    
    // Use AI to suggest semantic matches
    const semanticMatch = await findSemanticKPIMatch(columnName, userKPIs);
    if (semanticMatch && semanticMatch.confidence > 0.7) {
      suggestions.push({
        columnName,
        suggestedKPI: semanticMatch.kpi,
        confidence: semanticMatch.confidence,
        reason: 'AI-detected similarity'
      });
      continue;
    }
    
    // Suggest creating new KPI
    suggestions.push({
      columnName,
      suggestedKPI: null,
      confidence: 0,
      reason: 'No match found - create new KPI?'
    });
  }
  
  return suggestions;
}
```

---

## Data Cleanliness & Consistency

### Automated Validation Rules

```typescript
interface DataQualityRules {
  kpis: {
    // Naming conventions
    namePattern: RegExp; // e.g., /^[A-Z][a-zA-Z\s]+$/ (starts with capital, no special chars)
    maxNameLength: number; // e.g., 100 characters
    
    // Required fields
    requireDefinition: boolean;
    requireCategory: boolean;
    requireUnit: boolean;
    
    // Uniqueness
    preventDuplicateNames: boolean;
    preventSimilarNames: boolean; // e.g., "Conversion Rate" and "conversion rate"
  };
  
  tags: {
    namePattern: RegExp;
    maxNameLength: number;
    preventDuplicates: boolean;
    suggestExisting: boolean; // Suggest existing tags before creating new ones
  };
  
  folders: {
    namePattern: RegExp;
    maxNameLength: number;
    preventDuplicates: boolean; // Within same Space
    maxDepth: number; // e.g., no more than 3 levels of nesting
  };
}

// Validation function
async function validateKPI(kpiData: NewKPI): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  // Check naming conventions
  if (!rules.kpis.namePattern.test(kpiData.kpi_name)) {
    errors.push({
      field: 'kpi_name',
      message: 'KPI name must start with a capital letter and contain no special characters'
    });
  }
  
  // Check for duplicates
  if (rules.kpis.preventDuplicateNames) {
    const existingKPI = await findKPIByName(kpiData.kpi_name, kpiData.user_id);
    if (existingKPI) {
      errors.push({
        field: 'kpi_name',
        message: `A KPI named "${kpiData.kpi_name}" already exists`
      });
    }
  }
  
  // Check for similar names
  if (rules.kpis.preventSimilarNames) {
    const similarKPIs = await findSimilarKPINames(kpiData.kpi_name, kpiData.user_id);
    if (similarKPIs.length > 0) {
      warnings.push({
        field: 'kpi_name',
        message: `Similar KPIs exist: ${similarKPIs.map(k => k.kpi_name).join(', ')}`,
        suggestion: 'Consider using an existing KPI or adding this as a synonym'
      });
    }
  }
  
  // Check required fields
  if (rules.kpis.requireDefinition && !kpiData.global_definition) {
    errors.push({
      field: 'global_definition',
      message: 'Definition is required'
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
```

### KPI Naming Best Practices (Auto-Enforced)

```typescript
const KPI_NAMING_RULES = {
  // Capitalize first letter of each word
  enforceCapitalization: true,
  
  // Use standard abbreviations
  standardAbbreviations: {
    'CAC': 'Customer Acquisition Cost',
    'LTV': 'Lifetime Value',
    'MRR': 'Monthly Recurring Revenue',
    'ARR': 'Annual Recurring Revenue',
    'ROAS': 'Return on Ad Spend',
    'CPC': 'Cost Per Click',
    'CPM': 'Cost Per Mille',
    'CTR': 'Click-Through Rate',
    'CVR': 'Conversion Rate'
  },
  
  // Suggest full names for common abbreviations
  suggestFullName: true,
  
  // Prevent ambiguous names
  ambiguousTerms: ['Conversion', 'Lead', 'Signup'], // Require clarification
  
  // Recommend specificity
  requireSpecificity: {
    enabled: true,
    minWords: 2, // e.g., "Conversion" → "Conversion Rate" or "Paid Conversion"
    exceptions: ['Revenue', 'Profit', 'Churn'] // Single-word KPIs that are OK
  }
};
```

---

## Search & Discoverability

### Enhanced Search with KPI Context

```typescript
async function searchWithKPIAwareness(
  query: string,
  userId: UUID,
  currentSpaceId?: UUID
): Promise<SearchResults> {
  
  // 1. Detect KPIs in search query
  const detectedKPIs = await detectKPIsInQuery(query);
  
  // 2. Resolve KPI definitions
  const kpiContext = await Promise.all(
    detectedKPIs.map(kpiName => 
      resolveKPIDefinition({
        kpiName,
        userId,
        spaceId: currentSpaceId
      })
    )
  );
  
  // 3. Find all data that matches these KPIs
  const matchingData = await db.query(`
    SELECT 
      s.*,
      f.name as folder_name,
      p.name as space_name,
      kdm.column_name
    FROM sheets s
    JOIN kpi_data_mappings kdm ON s.id = kdm.sheet_id
    JOIN folders f ON s.folder_id = f.id
    JOIN projects p ON f.project_id = p.id
    WHERE kdm.kpi_id = ANY($1)
      AND s.user_id = $2
    ORDER BY s.updated_at DESC
  `, [kpiContext.map(k => k.kpiId), userId]);
  
  // 4. Semantic search on the query
  const semanticResults = await semanticSearch(query, userId);
  
  // 5. Combine and rank results
  return {
    kpiMatches: matchingData,
    semanticMatches: semanticResults,
    kpiContext: kpiContext,
    suggestions: generateSearchSuggestions(query, kpiContext)
  };
}
```

---

## Implementation Checklist

### Phase 1: Core KPI System (Weeks 1-2)
- [ ] Create database tables (kpis, kpi_definitions, kpi_data_mappings, kpi_synonyms)
- [ ] Implement KPI resolution algorithm
- [ ] Build basic KPI CRUD operations
- [ ] Add KPI validation and naming rules

### Phase 2: UI Components (Weeks 3-4)
- [ ] Build KPI Manager button and panel
- [ ] Create Add/Edit KPI dialog
- [ ] Implement KPI card component with hover definitions
- [ ] Add synonym management

### Phase 3: Multi-Definition System (Weeks 5-6)
- [ ] Build multi-definition manager UI
- [ ] Implement context-based definition resolution
- [ ] Add priority system for conflicting definitions
- [ ] Create definition override workflow

### Phase 4: AI Integration (Weeks 7-8)
- [ ] Enhance AI prompts with KPI context
- [ ] Implement KPI detection in queries
- [ ] Add inline KPI definition display in responses
- [ ] Build KPI citation system

### Phase 5: Bulk Operations (Week 9)
- [ ] Create bulk migration tool
- [ ] Implement batch KPI operations
- [ ] Add import/export functionality
- [ ] Build KPI templates

### Phase 6: Auto-Detection & Cleanup (Week 10)
- [ ] Build KPI auto-detection for uploaded data
- [ ] Implement smart KPI suggestions
- [ ] Add duplicate detection and merging
- [ ] Create data quality dashboard

---

## Success Metrics

**User Confidence:**
- 90%+ of users report "confident in AI responses" after using custom KPI definitions
- <5% of AI responses require clarification about which KPI definition was used

**Data Quality:**
- 95%+ of KPIs have clear definitions
- <2% duplicate or conflicting KPI names
- 80%+ of uploaded data auto-mapped to correct KPIs

**Adoption:**
- 70%+ of active users create at least 3 custom KPIs
- 50%+ of Spaces have context-specific KPI definitions
- 60%+ of AI queries reference custom-defined KPIs

**Efficiency:**
- 50% reduction in time spent clarifying metric definitions
- 3x faster data interpretation across teams
- 80% reduction in "which conversion rate?" questions

---

**Last Updated:** January 2025  
**For:** CaptureInsight Production Implementation  
**Audience:** Replit AI Agent
