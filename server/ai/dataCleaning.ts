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

export interface CleanedDataResult {
  success: boolean;
  cleanedData?: {
    type: "tabular" | "document" | "metrics" | "mixed";
    title?: string;
    description?: string;
    data: any[];
    metadata?: {
      sourceType: string;
      columnCount?: number;
      rowCount?: number;
      extractedAt: string;
      aiModel: string;
    };
  };
  error?: string;
}

const DATA_CLEANING_SYSTEM_PROMPT = `You are a data extraction and cleaning expert. Your job is to transform raw data into clean, structured JSON format that can be easily queried and analyzed.

RULES:
1. Always output valid JSON that can be parsed
2. Normalize data types: numbers as numbers, dates in ISO format, booleans as booleans
3. Clean text: trim whitespace, remove special characters where appropriate
4. Infer column types and apply appropriate formatting
5. Handle missing values consistently (use null)
6. Preserve the semantic meaning of the data
7. Extract ALL data, not just a sample

OUTPUT FORMAT:
{
  "type": "tabular" | "document" | "metrics" | "mixed",
  "title": "A descriptive title for this data",
  "description": "Brief summary of what this data contains",
  "data": [
    // Array of cleaned records - each record is an object with consistent keys
  ],
  "columns": [
    // Optional: column definitions with inferred types
    {"name": "column_name", "type": "string|number|date|boolean", "description": "brief description"}
  ]
}`;

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

Return the ENTIRE dataset, cleaned and structured.`;

const DOCUMENT_CLEANING_PROMPT = `Extract and structure all relevant information from this document/text content.

Tasks:
1. Identify key fields and their values
2. Extract dates, numbers, names, and entities
3. Structure related information together
4. Parse tables if present
5. Maintain the logical organization of information

Return comprehensive structured JSON with all extracted data.`;

/**
 * Fetch image from URL and convert to base64
 */
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

/**
 * Clean screenshot data using Gemini Vision
 * Accepts: base64 string, data URL (data:image/...), or https URL
 */
export async function cleanScreenshotData(imageInput: string, sourceName?: string): Promise<CleanedDataResult> {
  return rateLimiter(async () => {
    try {
      let base64Data: string;
      let mimeType = "image/png";
      
      // Handle different input formats
      if (imageInput.startsWith("http://") || imageInput.startsWith("https://")) {
        // Fetch image from URL
        const fetched = await fetchImageAsBase64(imageInput);
        if (!fetched) {
          return { success: false, error: "Failed to fetch image from URL" };
        }
        base64Data = fetched.base64;
        mimeType = fetched.mimeType;
      } else if (imageInput.startsWith("data:image")) {
        // Extract base64 from data URL
        const parts = imageInput.split(",");
        base64Data = parts[1] || "";
        const mimeMatch = parts[0]?.match(/data:(image\/[^;]+)/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
        }
      } else {
        // Assume it's already base64
        base64Data = imageInput;
      }
      
      if (!base64Data) {
        return { success: false, error: "No valid image data found" };
      }
      
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

      const response = await generateWithRetry(PRO_MODEL, contents, DATA_CLEANING_SYSTEM_PROMPT);
      
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
 * Clean tabular data (from Google Sheets, CSV, etc.)
 */
export async function cleanTabularData(
  rows: Record<string, string>[],
  headers?: string[],
  sourceName?: string
): Promise<CleanedDataResult> {
  return rateLimiter(async () => {
    try {
      const dataPreview = JSON.stringify({ headers, rows: rows.slice(0, 100) }, null, 2);
      const isLargeDataset = rows.length > 100;
      
      const prompt = `${TABULAR_CLEANING_PROMPT}

${isLargeDataset ? `NOTE: This is a preview of ${rows.length} total rows. Apply the same cleaning rules to understand the structure.` : ''}

DATA:
${dataPreview}

${isLargeDataset ? `Full row count: ${rows.length}` : ''}`;

      const response = await generateWithRetry(FLASH_MODEL, prompt, DATA_CLEANING_SYSTEM_PROMPT);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        let cleanedRows = parsed.data;
        if (isLargeDataset && Array.isArray(parsed.data)) {
          const columnMapping = inferColumnMapping(parsed.data[0], rows[0]);
          cleanedRows = rows.map(row => applyCleaningRules(row, columnMapping, parsed.columns));
        }

        return {
          success: true,
          cleanedData: {
            type: "tabular",
            title: parsed.title || sourceName || "Spreadsheet Data",
            description: parsed.description || "Cleaned tabular data",
            data: cleanedRows,
            metadata: {
              sourceType: "link",
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

/**
 * Clean document/text content
 */
export async function cleanDocumentData(
  content: string,
  contentType?: string,
  sourceName?: string
): Promise<CleanedDataResult> {
  return rateLimiter(async () => {
    try {
      const prompt = `${DOCUMENT_CLEANING_PROMPT}

Content type: ${contentType || "unknown"}
Content:
${content.slice(0, 50000)}`;

      const response = await generateWithRetry(FLASH_MODEL, prompt, DATA_CLEANING_SYSTEM_PROMPT);
      
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
    /^\d{4}-\d{2}-\d{2}/, // ISO format
    /^\d{1,2}\/\d{1,2}\/\d{2,4}/, // US format
    /^\d{1,2}-\d{1,2}-\d{2,4}/, // Common format
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i, // Month name
  ];
  return datePatterns.some(p => p.test(value.trim()));
}

/**
 * Main entry point: Clean data for a sheet based on its source type
 */
export async function cleanSheetData(sheetId: string): Promise<CleanedDataResult> {
  try {
    const sheet = await storage.getSheet(sheetId);
    if (!sheet) {
      return { success: false, error: "Sheet not found" };
    }

    await storage.updateSheet(sheetId, { cleaningStatus: "processing" });

    let result: CleanedDataResult;
    const sourceType = sheet.dataSourceType;
    const meta = sheet.dataSourceMeta as Record<string, any> | null;

    if (sourceType === "screenshot" || sourceType === "capture") {
      // Support multiple possible locations for screenshot data
      const imageData = (sheet.data as any)?.screenshot || 
                       (sheet.data as any)?.screenshotUrl ||
                       meta?.screenshotUrl ||
                       meta?.screenshot;
      
      if (imageData) {
        // cleanScreenshotData now handles all formats: URLs, data URLs, and raw base64
        result = await cleanScreenshotData(imageData, sheet.name);
      } else {
        result = { success: false, error: "No screenshot data found" };
      }
    } else if (sourceType === "link") {
      const sheetData = sheet.data as any;
      if (Array.isArray(sheetData)) {
        result = await cleanTabularData(sheetData, undefined, sheet.name);
      } else if (sheetData && typeof sheetData === "object") {
        result = await cleanTabularData([sheetData], Object.keys(sheetData), sheet.name);
      } else {
        result = { success: false, error: "No link data found to clean" };
      }
    } else if (sourceType === "file") {
      const content = typeof sheet.data === "string" 
        ? sheet.data 
        : JSON.stringify(sheet.data);
      result = await cleanDocumentData(content, meta?.mimeType, sheet.name);
    } else {
      const content = typeof sheet.data === "string"
        ? sheet.data
        : JSON.stringify(sheet.data);
      result = await cleanDocumentData(content, undefined, sheet.name);
    }

    if (result.success && result.cleanedData) {
      await storage.updateSheet(sheetId, {
        cleanedData: result.cleanedData,
        cleanedAt: new Date(),
        cleaningStatus: "completed",
      });
      
      // Regenerate embeddings with cleaned data for better RAG results
      try {
        const updatedSheet = await storage.getSheet(sheetId);
        if (updatedSheet && updatedSheet.spaceId) {
          // Ensure we have all required fields for embedding
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
    } else {
      await storage.updateSheet(sheetId, {
        cleaningStatus: "failed",
      });
    }

    return result;
  } catch (error) {
    console.error(`Error cleaning sheet ${sheetId}:`, error);
    await storage.updateSheet(sheetId, { cleaningStatus: "failed" });
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Trigger data cleaning after sheet creation (non-blocking)
 */
export async function triggerDataCleaning(sheetId: string): Promise<void> {
  console.log(`[DataCleaning] Starting background cleaning for sheet ${sheetId}`);
  
  cleanSheetData(sheetId)
    .then(result => {
      if (result.success) {
        console.log(`[DataCleaning] Completed cleaning for sheet ${sheetId}`);
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
