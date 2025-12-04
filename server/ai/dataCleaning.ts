/**
 * Data Cleaning Service
 * 
 * Uses Gemini Pro to clean and structure raw data from various sources:
 * - Screenshots: Vision analysis to extract structured data
 * - Links (Google Sheets): Clean and normalize tabular data
 * - Files (PDFs, docs): Extract and structure content
 * 
 * Output is always structured JSON for RAG consumption
 */

import { GoogleGenAI } from "@google/genai";
import pLimit from "p-limit";
import pRetry, { AbortError } from "p-retry";
import { storage } from "../storage";
import { embedAndStoreSheet } from "./embeddings";
import { 
  validateScreenshot, 
  validateTabularData, 
  validateDocumentData,
  calculateQualityScore,
  getValidationErrorMessage,
  type ValidationResult,
  type QualityScore 
} from "./dataValidation";
import {
  findMatchingTemplate,
  applyTemplateToSheet,
  createTemplateApplication,
  type TemplateMatchResult,
} from "./templateService";
import {
  detectColumnTypes,
  generateColumnTypeSummary,
  type ColumnTypeHeuristic,
} from "./columnHeuristics";
import type { DataTemplate, Sheet } from "../../shared/schema";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

const PRO_MODEL = "gemini-2.5-pro";
const FLASH_MODEL = "gemini-2.5-flash";

const rateLimiter = pLimit(2);

function isRateLimitError(error: unknown): boolean {
  const errorMsg = error instanceof Error ? error.message : String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

async function generateWithRetry(
  model: string,
  contents: string | { role: string; parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] }[],
  systemInstruction?: string
): Promise<string> {
  return pRetry(
    async () => {
      try {
        const config: any = {};
        if (systemInstruction) {
          config.systemInstruction = systemInstruction;
        }
        
        const response = await ai.models.generateContent({
          model,
          contents,
          config,
        });
        return response.text || "";
      } catch (error) {
        if (isRateLimitError(error)) {
          throw error;
        }
        throw new AbortError(error as Error);
      }
    },
    {
      retries: 5,
      minTimeout: 2000,
      maxTimeout: 60000,
      factor: 2,
    }
  );
}

export interface ExtractedNote {
  text: string;
  originalRow?: number;
  context?: string;
}

export interface CleanedDataResult {
  success: boolean;
  cleanedData?: {
    type: "tabular" | "document" | "metrics" | "mixed";
    title?: string;
    description?: string;
    data: any[];
    notes?: ExtractedNote[];
    columnOrder?: string[];
    metadata?: {
      sourceType: string;
      columnCount?: number;
      rowCount?: number;
      extractedAt: string;
      aiModel: string;
      templateApplied?: string;
      templateConfidence?: number;
    };
  };
  error?: string;
  qualityScore?: QualityScore;
  validationResult?: ValidationResult;
  failureType?: 'empty_image' | 'low_quality' | 'unsupported_format' | 'no_data_found' | 'ai_error' | 'parse_error';
  templateMatch?: TemplateMatchResult;
}

export type SourceType = 'google_sheets' | 'csv' | 'google_ads' | 'meta_ads' | 'ga4' | 'custom' | 'screenshot' | 'file';

export interface ProcessingProgress {
  currentStep: 'ingesting' | 'matching_templates' | 'cleaning' | 'validating' | 'finalizing' | 'complete' | 'failed';
  stepDetails?: string;
  percentComplete?: number;
  startedAt?: string;
  templateMatch?: {
    templateId: string;
    templateName: string;
    confidence: number;
    wasAutoApplied: boolean;
  };
}

const SOURCE_SPECIFIC_GUIDANCE: Record<SourceType, string> = {
  google_sheets: `
SOURCE: Google Sheets
- Preserve cell formatting hints (merged cells may appear as empty)
- Handle formula results (numbers may be formatted as text)
- Watch for locale-specific number formats (1.000,00 vs 1,000.00)
- Date formats vary by user locale settings

NOTES & ANNOTATIONS DETECTION (Google Sheets specific):
- Look for rows that contain ONLY text with no associated numeric data - these are likely notes
- Patterns like "*JZ NOTE", "**NOTE", or text starting with asterisks are user notes
- Parenthetical text alone in a cell like "(from tableau waterfall)" is an annotation
- Rows after empty rows that contain only text are often contextual notes
- If a row has a label in column A but only text (no numbers) in other cells, check if it's a note
- Inline annotations: Text in data cells starting with "**" or containing " -- " is commentary

COLUMN STRUCTURE:
- The FIRST column typically contains row identifiers (metric names, categories)
- Keep the first column as the first property in each data object
- Preserve the original left-to-right column order
- If column A has text labels and columns B-E have monthly data, order should be: label, month1, month2, etc.`,

  csv: `
SOURCE: CSV File
- First row typically contains headers
- Quoted fields may contain commas or newlines
- Empty fields should be preserved as null
- Encoding may affect special characters`,

  google_ads: `
SOURCE: Google Ads Export
- Cost/Revenue columns are typically in micros (divide by 1,000,000)
- CTR and conversion rates are percentages
- Date columns follow YYYY-MM-DD format
- Segment columns contain dimension values
- Metrics columns: Impressions, Clicks, Cost, Conversions, etc.`,

  meta_ads: `
SOURCE: Meta Ads Export
- Spend values may include currency symbols
- Reach and Frequency are key metrics
- CPM, CPC, CTR are standard ad metrics
- Date ranges may be in breakdowns
- Action columns contain conversion data`,

  ga4: `
SOURCE: Google Analytics 4 Export
- Dimensions vs Metrics distinction is important
- Date/DateTime in various formats
- Session-based vs User-based metrics
- Event parameters may be nested
- Null values for untracked dimensions`,

  custom: `
SOURCE: Custom/Unknown
- Infer structure from data patterns
- Be flexible with column naming
- Detect data types from content
- Preserve original structure when unclear`,

  screenshot: `
SOURCE: Screenshot/Image
- Extract visible text and numbers
- Infer table structure from visual layout
- Note any truncated or partially visible data
- Capture chart data points if visible`,

  file: `
SOURCE: Uploaded File
- Extract structured content
- Preserve document hierarchy
- Handle mixed content types
- Identify tables within documents`,
};

function buildSourceAwarePrompt(
  sourceType: SourceType,
  columnHeuristics: ColumnTypeHeuristic[],
  templateHints?: string
): string {
  const basePrompt = `You are a data extraction and cleaning expert. Your job is to transform raw data into clean, structured JSON format that can be easily queried and analyzed.

RULES:
1. Always output valid JSON that can be parsed
2. Normalize data types: numbers as numbers, dates in ISO format, booleans as booleans
3. Clean text: trim whitespace, remove special characters where appropriate
4. Infer column types and apply appropriate formatting
5. Handle missing values consistently (use null)
6. Preserve the semantic meaning of the data
7. Extract ALL data, not just a sample

${SOURCE_SPECIFIC_GUIDANCE[sourceType] || SOURCE_SPECIFIC_GUIDANCE.custom}

${columnHeuristics.length > 0 ? `
PRE-DETECTED COLUMN TYPES:
${generateColumnTypeSummary(columnHeuristics)}

Use these detected types to guide your cleaning. Override only if clearly incorrect.
` : ''}

${templateHints ? `
TEMPLATE HINTS:
${templateHints}
` : ''}

OUTPUT FORMAT:
{
  "type": "tabular" | "document" | "metrics" | "mixed",
  "title": "A descriptive title for this data",
  "description": "Brief summary of what this data contains",
  "data": [
    // Array of cleaned records - each record is an object with consistent keys
    // IMPORTANT: Column order in each object should match source order (identifiers first, then data)
  ],
  "columns": [
    // Column definitions with inferred types - ORDER MATTERS (preserve source order)
    {"name": "column_name", "type": "string|number|date|boolean", "description": "brief description"}
  ],
  "notes": [
    // Optional: Array of extracted notes/comments that were standalone rows (not regular data)
    // Example: {"text": "*JZ NOTE - look at decline of VIP...", "originalRow": 23, "context": "after VIP metrics"}
  ],
  "columnOrder": [
    // Array of column names in the order they should appear (identifier columns first)
    // Example: ["metric_name", "april", "may", "june", "july", "notes"]
  ]
}`;

  return basePrompt;
}

const SCREENSHOT_CLEANING_PROMPT = `Analyze this screenshot and extract ALL visible data into structured JSON format.

For dashboards/analytics:
- Extract all metrics, KPIs, and numbers with their labels
- Capture charts/graphs as data points if values are visible
- Include dates, time periods, and any context

For tables/spreadsheets:
- Extract all visible rows and columns
- Preserve column headers as keys
- Maintain data types (numbers, dates, text)

For documents/text:
- Extract key information as structured fields
- Identify entities, dates, amounts, etc.

IMPORTANT: Extract everything you can see, not just a summary.`;

const TABULAR_CLEANING_PROMPT = `Clean and normalize this tabular data into structured JSON.

Tasks:
1. Standardize column names (lowercase, underscores, no special chars)
2. Convert numeric strings to numbers
3. Parse dates to ISO format
4. Clean text values (trim, normalize)
5. Handle missing/empty values consistently (use null)
6. Remove duplicate rows if any
7. Infer and document column types

COLUMN ORDERING (CRITICAL):
- PRESERVE the original column order from the source data
- Identifier/label columns (metric names, categories, row labels) should appear FIRST (leftmost)
- If the first column in the source contains names/labels, keep it as the first column in output
- Numeric data columns should follow identifier columns
- Notes columns should appear after data columns

NOTES DETECTION (IMPORTANT):
Detect and extract notes/comments that are NOT regular data rows:
- Rows starting with "*" or "**" followed by text (e.g., "*JZ NOTE - look at decline...")
- Rows containing "NOTE:" or "NOTE -" patterns
- Parenthetical annotations that appear alone (e.g., "(from tableau waterfall)")
- Rows that are clearly commentary, not data (text with no associated metrics)
- Cells with inline notes like "**1M CCC --" are notes attached to that row

For detected notes:
- If the note is a STANDALONE ROW with no real data values, extract it to the "notes" array
- If the note is INLINE (attached to a data row), keep it in a "notes" column for that row
- Standalone note rows should NOT appear in the main data array

Return the ENTIRE dataset, cleaned and structured.`;

const DOCUMENT_CLEANING_PROMPT = `Extract and structure all relevant information from this document/text content.

Tasks:
1. Identify key fields and their values
2. Extract dates, numbers, names, and entities
3. Structure related information together
4. Parse tables if present
5. Maintain the logical organization of information

Return comprehensive structured JSON with all extracted data.`;

async function updateSheetProgress(
  sheetId: string,
  progress: ProcessingProgress
): Promise<void> {
  try {
    await storage.updateSheet(sheetId, {
      processingProgress: progress,
    } as any);
  } catch (error) {
    console.warn(`[DataCleaning] Failed to update progress for sheet ${sheetId}:`, error);
  }
}

interface CleaningPipelineStep {
  id: string;
  type: 'remove_commas' | 'strip_currency' | 'convert_percentage' | 'trim_whitespace' | 'convert_date_format' | 'remove_duplicates' | 'fill_empty' | 'custom';
  enabled: boolean;
  config?: {
    targetColumns?: string[];
    fromFormat?: string;
    toFormat?: string;
    percentageMode?: 'decimal' | 'whole';
    fillValue?: string;
    customRule?: string;
  };
}

function applyCleaningPipelineStep(
  data: Record<string, any>[],
  step: CleaningPipelineStep
): Record<string, any>[] {
  if (!step.enabled) return data;

  const targetColumns = step.config?.targetColumns;

  switch (step.type) {
    case 'remove_commas':
      return data.map(row => {
        const newRow = { ...row };
        for (const [key, value] of Object.entries(newRow)) {
          if (targetColumns && !targetColumns.includes(key)) continue;
          if (typeof value === 'string') {
            const cleaned = value.replace(/,/g, '');
            const num = parseFloat(cleaned);
            newRow[key] = isNaN(num) ? value : num;
          }
        }
        return newRow;
      });

    case 'strip_currency':
      return data.map(row => {
        const newRow = { ...row };
        for (const [key, value] of Object.entries(newRow)) {
          if (targetColumns && !targetColumns.includes(key)) continue;
          if (typeof value === 'string') {
            const cleaned = value.replace(/[$€£¥₹₽₩฿]/g, '').replace(/,/g, '').trim();
            const num = parseFloat(cleaned);
            newRow[key] = isNaN(num) ? value : num;
          }
        }
        return newRow;
      });

    case 'convert_percentage':
      const mode = step.config?.percentageMode || 'decimal';
      return data.map(row => {
        const newRow = { ...row };
        for (const [key, value] of Object.entries(newRow)) {
          if (targetColumns && !targetColumns.includes(key)) continue;
          if (typeof value === 'string' && value.includes('%')) {
            const cleaned = value.replace(/%/g, '').trim();
            const num = parseFloat(cleaned);
            if (!isNaN(num)) {
              newRow[key] = mode === 'decimal' ? num / 100 : num;
            }
          }
        }
        return newRow;
      });

    case 'trim_whitespace':
      return data.map(row => {
        const newRow = { ...row };
        for (const [key, value] of Object.entries(newRow)) {
          if (targetColumns && !targetColumns.includes(key)) continue;
          if (typeof value === 'string') {
            newRow[key] = value.trim();
          }
        }
        return newRow;
      });

    case 'convert_date_format':
      return data.map(row => {
        const newRow = { ...row };
        for (const [key, value] of Object.entries(newRow)) {
          if (targetColumns && !targetColumns.includes(key)) continue;
          if (typeof value === 'string' && value) {
            const parsed = new Date(value);
            if (!isNaN(parsed.getTime())) {
              newRow[key] = parsed.toISOString();
            }
          }
        }
        return newRow;
      });

    case 'remove_duplicates':
      const seen = new Set<string>();
      return data.filter(row => {
        const key = JSON.stringify(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    case 'fill_empty':
      const fillValue = step.config?.fillValue ?? null;
      return data.map(row => {
        const newRow = { ...row };
        for (const [key, value] of Object.entries(newRow)) {
          if (targetColumns && !targetColumns.includes(key)) continue;
          if (value === null || value === undefined || value === '') {
            newRow[key] = fillValue;
          }
        }
        return newRow;
      });

    default:
      return data;
  }
}

function applyCleaningPipeline(
  data: Record<string, any>[],
  pipeline: { steps: CleaningPipelineStep[] }
): Record<string, any>[] {
  let result = [...data];
  
  for (const step of pipeline.steps) {
    result = applyCleaningPipelineStep(result, step);
  }
  
  return result;
}

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch image from URL: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const contentType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    return { base64, mimeType: contentType };
  } catch (error) {
    console.error('Error fetching image:', error);
    return null;
  }
}

export async function cleanScreenshotData(
  imageInput: string, 
  sourceName?: string,
  templateHints?: string
): Promise<CleanedDataResult> {
  return rateLimiter(async () => {
    try {
      let base64Data: string;
      let mimeType = "image/png";
      
      if (imageInput.startsWith("http://") || imageInput.startsWith("https://")) {
        const fetched = await fetchImageAsBase64(imageInput);
        if (!fetched) {
          return { success: false, error: "Failed to fetch image from URL" };
        }
        base64Data = fetched.base64;
        mimeType = fetched.mimeType;
      } else if (imageInput.startsWith("data:image")) {
        const parts = imageInput.split(",");
        base64Data = parts[1] || "";
        const mimeMatch = parts[0]?.match(/data:(image\/[^;]+)/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
        }
      } else {
        base64Data = imageInput;
      }
      
      if (!base64Data) {
        return { success: false, error: "No valid image data found" };
      }

      const systemPrompt = buildSourceAwarePrompt('screenshot', [], templateHints);
      
      const contents = [
        {
          role: "user",
          parts: [
            { text: SCREENSHOT_CLEANING_PROMPT },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ];

      const response = await generateWithRetry(PRO_MODEL, contents, systemPrompt);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          cleanedData: {
            type: parsed.type || "metrics",
            title: parsed.title || sourceName || "Screenshot Data",
            description: parsed.description || "Data extracted from screenshot",
            data: Array.isArray(parsed.data) ? parsed.data : [parsed.data || parsed],
            metadata: {
              sourceType: "screenshot",
              rowCount: Array.isArray(parsed.data) ? parsed.data.length : 1,
              extractedAt: new Date().toISOString(),
              aiModel: PRO_MODEL,
            },
          },
        };
      }

      return { success: false, error: "Failed to parse AI response as JSON" };
    } catch (error) {
      console.error("Screenshot cleaning error:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  });
}

/**
 * Check if a cell contains a note pattern.
 * Returns the note text if found.
 */
function extractNoteFromCell(value: any): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  
  // Pattern: starts with * or ** followed by text (e.g., "*JZ NOTE")
  if (/^\*+\s*\w+/i.test(trimmed)) {
    return trimmed;
  }
  
  // Pattern: contains "NOTE:" or "NOTE -" or "NOTE –" at start
  if (/^\**\s*NOTE\s*[-:–]/i.test(trimmed)) {
    return trimmed;
  }
  
  // Pattern: inline note starting with ** and containing --
  if (/^\*\*.*--/i.test(trimmed)) {
    return trimmed;
  }
  
  return null;
}

/**
 * Check if a value is "empty" (null, undefined, empty string, 'null' string)
 */
function isEmptyValue(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    return trimmed === '' || trimmed === 'null';
  }
  return false;
}

/**
 * Detect if a row is a STANDALONE note/comment rather than actual data.
 * A standalone note is a row where:
 * - It contains a note pattern AND
 * - All other cells are empty (no numeric or meaningful data)
 * 
 * This is DIFFERENT from inline notes, which are note cells on data rows.
 * Inline notes should be kept with the row, not extracted.
 */
function isStandaloneNoteRow(row: Record<string, any>): { isNote: boolean; noteText?: string } {
  const entries = Object.entries(row);
  const values = Object.values(row);
  
  // Count cells with actual data vs note patterns
  let noteText: string | null = null;
  let noteColumnKey: string | null = null;
  let hasNonEmptyDataCells = false;
  
  for (const [key, value] of entries) {
    if (isEmptyValue(value)) continue;
    
    // Check if this cell is a note
    const extractedNote = extractNoteFromCell(value);
    if (extractedNote) {
      noteText = extractedNote;
      noteColumnKey = key;
      continue;
    }
    
    // This is a non-empty cell that's NOT a note pattern
    // Check if it's actual data (numbers, dates, meaningful text)
    if (typeof value === 'number') {
      hasNonEmptyDataCells = true;
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      // If it's a number in string format, it's data
      if (/^[\d,.$%+-]+$/.test(trimmed) && trimmed !== '') {
        hasNonEmptyDataCells = true;
      }
      // If it looks like a label/category (short text, no note pattern), could be data
      else if (trimmed.length > 0 && trimmed.length < 100 && !extractNoteFromCell(value)) {
        hasNonEmptyDataCells = true;
      }
    } else if (value !== null && value !== undefined) {
      hasNonEmptyDataCells = true;
    }
  }
  
  // A standalone note row has a note pattern but NO other meaningful data
  if (noteText && !hasNonEmptyDataCells) {
    return { isNote: true, noteText };
  }
  
  // Special case: parenthetical text alone (e.g., "(from tableau waterfall)")
  const nonEmptyValues = values.filter(v => !isEmptyValue(v));
  if (nonEmptyValues.length === 1 && typeof nonEmptyValues[0] === 'string') {
    const text = nonEmptyValues[0].trim();
    // Parenthetical text with no numbers
    if (/^\([^)]+\)$/.test(text) && !/\d/.test(text)) {
      return { isNote: true, noteText: text };
    }
    // Long text with no numbers is likely a standalone note
    if (text.length > 30 && !/\d/.test(text) && !text.includes(',')) {
      return { isNote: true, noteText: text };
    }
  }
  
  return { isNote: false };
}

export async function cleanTabularData(
  rows: Record<string, string>[],
  headers?: string[],
  sourceName?: string,
  sourceType: SourceType = 'csv',
  templateHints?: string
): Promise<CleanedDataResult> {
  return rateLimiter(async () => {
    try {
      const columnHeuristics = detectColumnTypes(rows);
      const dataPreview = JSON.stringify({ headers, rows: rows.slice(0, 100) }, null, 2);
      const isLargeDataset = rows.length > 100;
      
      const systemPrompt = buildSourceAwarePrompt(sourceType, columnHeuristics, templateHints);
      
      const prompt = `${TABULAR_CLEANING_PROMPT}

${isLargeDataset ? `NOTE: This is a preview of ${rows.length} total rows. Apply the same cleaning rules to understand the structure.` : ''}

DATA:
${dataPreview}

${isLargeDataset ? `Full row count: ${rows.length}` : ''}`;

      const response = await generateWithRetry(FLASH_MODEL, prompt, systemPrompt);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        let cleanedRows = parsed.data;
        let extractedNotes: ExtractedNote[] = parsed.notes || [];
        
        if (isLargeDataset && Array.isArray(parsed.data)) {
          const columnMapping = inferColumnMapping(parsed.data[0], rows[0]);
          
          // For large datasets, we need to filter out note rows and extract them separately
          const processedRows: Record<string, any>[] = [];
          const detectedNotes: ExtractedNote[] = [];
          
          rows.forEach((row, index) => {
            const noteCheck = isStandaloneNoteRow(row);
            if (noteCheck.isNote && noteCheck.noteText) {
              // This is a standalone note row (no actual data), extract it
              detectedNotes.push({
                text: noteCheck.noteText,
                originalRow: index + 1,
                context: `Row ${index + 1}`
              });
            } else {
              // Regular data row (may have inline notes), apply cleaning rules
              processedRows.push(applyCleaningRules(row, columnMapping, parsed.columns));
            }
          });
          
          cleanedRows = processedRows;
          // Merge AI-detected notes with our detected notes
          extractedNotes = [...extractedNotes, ...detectedNotes];
        }
        
        // Get column order from AI response, or infer from first row
        let columnOrder = parsed.columnOrder;
        if (!columnOrder && cleanedRows.length > 0) {
          columnOrder = Object.keys(cleanedRows[0]);
        }
        
        // Reorder data columns based on columnOrder if provided
        if (columnOrder && cleanedRows.length > 0) {
          cleanedRows = cleanedRows.map((row: Record<string, any>) => {
            const orderedRow: Record<string, any> = {};
            for (const col of columnOrder) {
              if (col in row) {
                orderedRow[col] = row[col];
              }
            }
            // Add any remaining columns not in columnOrder
            for (const key of Object.keys(row)) {
              if (!(key in orderedRow)) {
                orderedRow[key] = row[key];
              }
            }
            return orderedRow;
          });
        }

        return {
          success: true,
          cleanedData: {
            type: "tabular",
            title: parsed.title || sourceName || "Spreadsheet Data",
            description: parsed.description || "Cleaned tabular data",
            data: cleanedRows,
            notes: extractedNotes,
            columnOrder: columnOrder,
            metadata: {
              sourceType: sourceType,
              columnCount: headers?.length || Object.keys(rows[0] || {}).length,
              rowCount: cleanedRows.length,
              extractedAt: new Date().toISOString(),
              aiModel: FLASH_MODEL,
            },
          },
        };
      }

      return { success: false, error: "Failed to parse AI response as JSON" };
    } catch (error) {
      console.error("Tabular cleaning error:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  });
}

export async function cleanDocumentData(
  content: string,
  contentType?: string,
  sourceName?: string,
  templateHints?: string
): Promise<CleanedDataResult> {
  return rateLimiter(async () => {
    try {
      const systemPrompt = buildSourceAwarePrompt('file', [], templateHints);
      
      const prompt = `${DOCUMENT_CLEANING_PROMPT}

Content type: ${contentType || "unknown"}
Content:
${content.slice(0, 50000)}`;

      const response = await generateWithRetry(FLASH_MODEL, prompt, systemPrompt);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          cleanedData: {
            type: parsed.type || "document",
            title: parsed.title || sourceName || "Document Data",
            description: parsed.description || "Extracted document content",
            data: Array.isArray(parsed.data) ? parsed.data : [parsed.data || parsed],
            metadata: {
              sourceType: "file",
              rowCount: Array.isArray(parsed.data) ? parsed.data.length : 1,
              extractedAt: new Date().toISOString(),
              aiModel: FLASH_MODEL,
            },
          },
        };
      }

      return { success: false, error: "Failed to parse AI response as JSON" };
    } catch (error) {
      console.error("Document cleaning error:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  });
}

function inferColumnMapping(
  cleanedSample: Record<string, any>,
  originalSample: Record<string, string>
): Map<string, string> {
  const mapping = new Map<string, string>();
  const cleanedKeys = Object.keys(cleanedSample);
  const originalKeys = Object.keys(originalSample);

  for (const cleanKey of cleanedKeys) {
    const normalizedClean = cleanKey.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const origKey of originalKeys) {
      const normalizedOrig = origKey.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedClean === normalizedOrig || normalizedClean.includes(normalizedOrig) || normalizedOrig.includes(normalizedClean)) {
        mapping.set(origKey, cleanKey);
        break;
      }
    }
  }

  return mapping;
}

function applyCleaningRules(
  row: Record<string, string>,
  columnMapping: Map<string, string>,
  columnDefs?: { name: string; type: string }[]
): Record<string, any> {
  const cleanedRow: Record<string, any> = {};
  const typeMap = new Map(columnDefs?.map(c => [c.name, c.type]) || []);

  for (const [origKey, value] of Object.entries(row)) {
    const cleanKey = columnMapping.get(origKey) || origKey.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const colType = typeMap.get(cleanKey);

    if (value === null || value === undefined || value === '') {
      cleanedRow[cleanKey] = null;
    } else if (colType === 'number' || (!colType && /^-?[\d,]+\.?\d*$/.test(value.replace(/,/g, '')))) {
      const numValue = parseFloat(value.replace(/,/g, ''));
      cleanedRow[cleanKey] = isNaN(numValue) ? value.trim() : numValue;
    } else if (colType === 'boolean' || (!colType && /^(true|false|yes|no)$/i.test(value.trim()))) {
      cleanedRow[cleanKey] = /^(true|yes)$/i.test(value.trim());
    } else if (colType === 'date' || (!colType && isDateString(value))) {
      const parsed = new Date(value);
      cleanedRow[cleanKey] = isNaN(parsed.getTime()) ? value.trim() : parsed.toISOString();
    } else {
      cleanedRow[cleanKey] = value.trim();
    }
  }

  return cleanedRow;
}

function isDateString(value: string): boolean {
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}/,
    /^\d{1,2}\/\d{1,2}\/\d{2,4}/,
    /^\d{1,2}-\d{1,2}-\d{2,4}/,
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i,
  ];
  return datePatterns.some(p => p.test(value.trim()));
}

function determineSourceType(sheet: Sheet): SourceType {
  const dataSourceType = sheet.dataSourceType;
  const meta = sheet.dataSourceMeta as Record<string, any> | null;
  
  if (dataSourceType === 'screenshot' || dataSourceType === 'capture') {
    return 'screenshot';
  }
  
  if (dataSourceType === 'file') {
    return 'file';
  }
  
  if (dataSourceType === 'link') {
    const sourceUrl = meta?.sourceUrl || meta?.url || '';
    
    if (sourceUrl.includes('docs.google.com/spreadsheets')) {
      return 'google_sheets';
    }
    if (sourceUrl.includes('ads.google.com') || meta?.source === 'google_ads') {
      return 'google_ads';
    }
    if (sourceUrl.includes('facebook.com') || sourceUrl.includes('meta.com') || meta?.source === 'meta_ads') {
      return 'meta_ads';
    }
    if (sourceUrl.includes('analytics.google.com') || meta?.source === 'ga4') {
      return 'ga4';
    }
    
    return 'csv';
  }
  
  return 'custom';
}

async function cleanWithTemplate(
  data: Record<string, any>[],
  template: DataTemplate,
  templateMatch: TemplateMatchResult
): Promise<{ cleanedData: Record<string, any>[]; pipelineApplied: boolean }> {
  const pipeline = template.cleaningPipeline as { steps: CleaningPipelineStep[] } | null;
  
  if (!pipeline || !pipeline.steps || pipeline.steps.length === 0) {
    return { cleanedData: data, pipelineApplied: false };
  }
  
  console.log(`[DataCleaning] Applying template pipeline with ${pipeline.steps.length} steps`);
  const cleanedData = applyCleaningPipeline(data, pipeline);
  
  return { cleanedData, pipelineApplied: true };
}

export async function cleanSheetData(sheetId: string): Promise<CleanedDataResult> {
  const startTime = new Date().toISOString();
  
  try {
    const sheet = await storage.getSheet(sheetId);
    if (!sheet) {
      return { success: false, error: "Sheet not found", failureType: 'no_data_found' };
    }

    await updateSheetProgress(sheetId, {
      currentStep: 'ingesting',
      stepDetails: 'Loading data...',
      percentComplete: 5,
      startedAt: startTime,
    });

    await storage.updateSheet(sheetId, { cleaningStatus: "processing" });

    let result: CleanedDataResult;
    let validationResult: ValidationResult | undefined;
    const sourceType = determineSourceType(sheet);
    const meta = sheet.dataSourceMeta as Record<string, any> | null;

    await updateSheetProgress(sheetId, {
      currentStep: 'matching_templates',
      stepDetails: 'Looking for matching templates...',
      percentComplete: 15,
      startedAt: startTime,
    });

    let templateMatch: TemplateMatchResult | null = null;
    let templateHints: string | undefined;
    
    if (sheet.workspaceId && sheet.spaceId && sourceType !== 'screenshot') {
      try {
        const sheetData = sheet.data as Record<string, unknown>[] | Record<string, unknown>;
        let dataArray: Record<string, unknown>[] = [];
        let columns: string[] = [];
        
        if (Array.isArray(sheetData)) {
          dataArray = sheetData;
          columns = Object.keys(sheetData[0] || {});
        } else if (sheetData && typeof sheetData === 'object') {
          dataArray = [sheetData];
          columns = Object.keys(sheetData);
        }
        
        if (dataArray.length > 0 && columns.length > 0) {
          templateMatch = await findMatchingTemplate(
            {
              columns,
              data: dataArray,
              sourceUrl: meta?.sourceUrl || meta?.url,
              fileName: meta?.fileName,
            },
            sheet.workspaceId,
            sheet.spaceId
          );
          
          if (templateMatch) {
            const template = templateMatch.template;
            console.log(`[DataCleaning] Template match found: ${template.name} (confidence: ${templateMatch.confidence}%)`);
            
            if (templateMatch.recommendation === 'auto-apply') {
              await updateSheetProgress(sheetId, {
                currentStep: 'matching_templates',
                stepDetails: `Auto-applying template: ${template.name}`,
                percentComplete: 20,
                startedAt: startTime,
                templateMatch: {
                  templateId: template.id,
                  templateName: template.name,
                  confidence: templateMatch.confidence,
                  wasAutoApplied: true,
                },
              });
              
              templateHints = template.aiPromptHints || undefined;
              
              const pipelineResult = await cleanWithTemplate(dataArray as Record<string, any>[], template, templateMatch);
              if (pipelineResult.pipelineApplied) {
                await storage.updateSheet(sheetId, {
                  data: pipelineResult.cleanedData,
                } as any);
              }
              
              await applyTemplateToSheet(sheetId, template.id, true);
            } else if (templateMatch.recommendation === 'suggest') {
              await updateSheetProgress(sheetId, {
                currentStep: 'matching_templates',
                stepDetails: `Template suggested: ${template.name} (${templateMatch.confidence}% match) - awaiting confirmation`,
                percentComplete: 20,
                startedAt: startTime,
                templateMatch: {
                  templateId: template.id,
                  templateName: template.name,
                  confidence: templateMatch.confidence,
                  wasAutoApplied: false,
                },
              });
              
              templateHints = template.aiPromptHints || undefined;
            }
          }
        }
      } catch (templateError) {
        console.warn(`[DataCleaning] Template matching failed for sheet ${sheetId}:`, templateError);
      }
    }

    await updateSheetProgress(sheetId, {
      currentStep: 'cleaning',
      stepDetails: templateMatch?.recommendation === 'auto-apply' 
        ? `Cleaning with template: ${templateMatch.template.name}`
        : 'AI-powered data cleaning...',
      percentComplete: 30,
      startedAt: startTime,
      templateMatch: templateMatch ? {
        templateId: templateMatch.template.id,
        templateName: templateMatch.template.name,
        confidence: templateMatch.confidence,
        wasAutoApplied: templateMatch.recommendation === 'auto-apply',
      } : undefined,
    });

    if (sourceType === 'screenshot') {
      const imageData = (sheet.data as any)?.screenshot || 
                       (sheet.data as any)?.screenshotUrl ||
                       meta?.screenshotUrl ||
                       meta?.screenshot;
      
      if (!imageData) {
        result = { 
          success: false, 
          error: "No screenshot data found",
          failureType: 'no_data_found',
        };
      } else {
        console.log(`[DataCleaning] Running pre-validation for screenshot ${sheetId}`);
        validationResult = await validateScreenshot(imageData);
        
        if (!validationResult.isValid) {
          const errorMessage = getValidationErrorMessage(validationResult, sheet.name);
          console.log(`[DataCleaning] Validation failed for ${sheetId}: ${errorMessage}`);
          
          result = {
            success: false,
            error: errorMessage,
            failureType: validationResult.failureType as any,
            validationResult,
          };
          
          await storage.updateSheet(sheetId, {
            cleaningStatus: "failed",
            validationResult: validationResult,
            processingProgress: {
              currentStep: 'failed',
              stepDetails: errorMessage,
              startedAt: startTime,
            },
          } as any);
          
          return result;
        }
        
        console.log(`[DataCleaning] Validation passed for ${sheetId}, proceeding with AI cleaning`);
        result = await cleanScreenshotData(imageData, sheet.name, templateHints);
        result.validationResult = validationResult;
      }
    } else if (sourceType === 'google_sheets' || sourceType === 'csv' || sourceType === 'google_ads' || sourceType === 'meta_ads' || sourceType === 'ga4' || sourceType === 'custom') {
      const sheetData = sheet.data as any;
      
      validationResult = validateTabularData(sheetData);
      
      if (!validationResult.isValid) {
        result = {
          success: false,
          error: validationResult.message || "No valid data found",
          failureType: validationResult.failureType as any,
          validationResult,
        };
        
        await storage.updateSheet(sheetId, {
          cleaningStatus: "failed",
          validationResult: validationResult,
          processingProgress: {
            currentStep: 'failed',
            stepDetails: validationResult.message || "Validation failed",
            startedAt: startTime,
          },
        } as any);
        
        return result;
      }
      
      if (Array.isArray(sheetData)) {
        result = await cleanTabularData(sheetData, undefined, sheet.name, sourceType, templateHints);
      } else if (sheetData && typeof sheetData === "object") {
        result = await cleanTabularData([sheetData], Object.keys(sheetData), sheet.name, sourceType, templateHints);
      } else {
        result = { success: false, error: "No link data found to clean", failureType: 'no_data_found' };
      }
      result.validationResult = validationResult;
    } else if (sourceType === 'file') {
      const content = typeof sheet.data === "string" 
        ? sheet.data 
        : JSON.stringify(sheet.data);
      
      validationResult = validateDocumentData(content, meta?.mimeType);
      
      if (!validationResult.isValid) {
        result = {
          success: false,
          error: validationResult.message || "No valid content found",
          failureType: validationResult.failureType as any,
          validationResult,
        };
        
        await storage.updateSheet(sheetId, {
          cleaningStatus: "failed",
          validationResult: validationResult,
          processingProgress: {
            currentStep: 'failed',
            stepDetails: validationResult.message || "Validation failed",
            startedAt: startTime,
          },
        } as any);
        
        return result;
      }
      
      result = await cleanDocumentData(content, meta?.mimeType, sheet.name, templateHints);
      result.validationResult = validationResult;
    } else {
      const content = typeof sheet.data === "string"
        ? sheet.data
        : JSON.stringify(sheet.data);
      
      validationResult = validateDocumentData(content);
      if (!validationResult.isValid) {
        result = {
          success: false,
          error: validationResult.message || "No valid content found",
          failureType: validationResult.failureType as any,
          validationResult,
        };
        
        await storage.updateSheet(sheetId, {
          cleaningStatus: "failed",
          validationResult: validationResult,
          processingProgress: {
            currentStep: 'failed',
            stepDetails: validationResult.message || "Validation failed",
            startedAt: startTime,
          },
        } as any);
        
        return result;
      }
      
      result = await cleanDocumentData(content, undefined, sheet.name, templateHints);
      result.validationResult = validationResult;
    }

    if (templateMatch) {
      result.templateMatch = templateMatch;
    }

    await updateSheetProgress(sheetId, {
      currentStep: 'validating',
      stepDetails: 'Validating cleaned data...',
      percentComplete: 70,
      startedAt: startTime,
      templateMatch: templateMatch ? {
        templateId: templateMatch.template.id,
        templateName: templateMatch.template.name,
        confidence: templateMatch.confidence,
        wasAutoApplied: templateMatch.recommendation === 'auto-apply',
      } : undefined,
    });

    if (result.success && result.cleanedData) {
      const qualityScore = calculateQualityScore(result.cleanedData, validationResult?.details);
      result.qualityScore = qualityScore;
      
      console.log(`[DataCleaning] Quality score for ${sheetId}: ${qualityScore.overall} (confidence: ${qualityScore.confidence}, completeness: ${qualityScore.completeness}, richness: ${qualityScore.dataRichness})`);

      await updateSheetProgress(sheetId, {
        currentStep: 'finalizing',
        stepDetails: 'Storing cleaned data and generating embeddings...',
        percentComplete: 85,
        startedAt: startTime,
        templateMatch: templateMatch ? {
          templateId: templateMatch.template.id,
          templateName: templateMatch.template.name,
          confidence: templateMatch.confidence,
          wasAutoApplied: templateMatch.recommendation === 'auto-apply',
        } : undefined,
      });

      if (templateMatch && result.cleanedData.metadata) {
        result.cleanedData.metadata.templateApplied = templateMatch.template.name;
        result.cleanedData.metadata.templateConfidence = templateMatch.confidence;
      }
      
      await storage.updateSheet(sheetId, {
        cleanedData: result.cleanedData,
        cleanedAt: new Date(),
        cleaningStatus: "completed",
        qualityScore: qualityScore.overall,
        qualityDetails: {
          confidence: qualityScore.confidence,
          completeness: qualityScore.completeness,
          dataRichness: qualityScore.dataRichness,
          issues: qualityScore.issues,
        },
        validationResult: validationResult || null,
      } as any);
      
      try {
        const updatedSheet = await storage.getSheet(sheetId);
        if (updatedSheet && updatedSheet.spaceId) {
          const sheetForEmbedding = {
            ...sheet,
            ...updatedSheet,
            cleanedData: result.cleanedData,
          };
          await embedAndStoreSheet(sheetForEmbedding as any, updatedSheet.spaceId);
          console.log(`[DataCleaning] Regenerated embeddings for sheet ${sheetId}`);
        } else {
          console.warn(`[DataCleaning] Cannot regenerate embeddings - sheet ${sheetId} missing spaceId`);
        }
      } catch (embeddingError) {
        console.warn(`[DataCleaning] Failed to regenerate embeddings for sheet ${sheetId}:`, embeddingError);
      }

      await updateSheetProgress(sheetId, {
        currentStep: 'complete',
        stepDetails: `Successfully cleaned ${result.cleanedData.data?.length || 0} records`,
        percentComplete: 100,
        startedAt: startTime,
        templateMatch: templateMatch ? {
          templateId: templateMatch.template.id,
          templateName: templateMatch.template.name,
          confidence: templateMatch.confidence,
          wasAutoApplied: templateMatch.recommendation === 'auto-apply',
        } : undefined,
      });
    } else {
      await storage.updateSheet(sheetId, {
        cleaningStatus: "failed",
        validationResult: validationResult || {
          isValid: false,
          failureType: result.failureType || 'ai_error',
          message: result.error,
        },
        processingProgress: {
          currentStep: 'failed',
          stepDetails: result.error || 'Data cleaning failed',
          startedAt: startTime,
        },
      } as any);
    }

    return result;
  } catch (error) {
    console.error(`Error cleaning sheet ${sheetId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    let failureType: CleanedDataResult['failureType'] = 'ai_error';
    if (errorMessage.includes('parse') || errorMessage.includes('JSON')) {
      failureType = 'parse_error';
    }
    
    await storage.updateSheet(sheetId, { 
      cleaningStatus: "failed",
      validationResult: {
        isValid: false,
        failureType,
        message: errorMessage,
      },
      processingProgress: {
        currentStep: 'failed',
        stepDetails: errorMessage,
        startedAt: startTime,
      },
    } as any);
    
    return { success: false, error: errorMessage, failureType };
  }
}

export async function triggerDataCleaning(sheetId: string): Promise<void> {
  console.log(`[DataCleaning] Starting background cleaning for sheet ${sheetId}`);
  
  cleanSheetData(sheetId)
    .then(result => {
      if (result.success) {
        console.log(`[DataCleaning] Completed cleaning for sheet ${sheetId}`);
        if (result.templateMatch) {
          console.log(`[DataCleaning] Template used: ${result.templateMatch.template.name} (${result.templateMatch.confidence}% confidence)`);
        }
      } else {
        console.warn(`[DataCleaning] Failed to clean sheet ${sheetId}: ${result.error}`);
      }
    })
    .catch(err => {
      console.error(`[DataCleaning] Error cleaning sheet ${sheetId}:`, err);
    });
}

export function isGeminiConfigured(): boolean {
  return !!(
    process.env.AI_INTEGRATIONS_GEMINI_BASE_URL &&
    process.env.AI_INTEGRATIONS_GEMINI_API_KEY
  );
}
