/**
 * Data Ingestion Service
 * 
 * Fetches and parses data from various sources:
 * - Google Sheets (via CSV export - no API key needed for public sheets)
 * - CSV files
 * - Screenshots (placeholder for OCR)
 */

import { storage } from "../storage";
import { embedAndStoreSheet } from "./embeddings";

export interface IngestionResult {
  success: boolean;
  sheetId: string;
  rowCount?: number;
  error?: string;
  data?: any[];
}

/**
 * Extract spreadsheet ID from various Google Sheets URL formats
 */
export function extractGoogleSheetId(url: string): string | null {
  const patterns = [
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    /\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/,
    /key=([a-zA-Z0-9-_]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

/**
 * Extract GID (sheet tab ID) from URL, defaults to 0
 */
export function extractGid(url: string): string {
  const match = url.match(/gid=(\d+)/);
  return match ? match[1] : "0";
}

/**
 * Build CSV export URL for Google Sheets
 */
export function buildCsvExportUrl(spreadsheetId: string, gid: string = "0"): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
}

/**
 * Parse CSV string into array of objects
 * Handles multi-line quoted fields correctly
 * Preserves whitespace in quoted fields (CSV semantics)
 */
export function parseCsv(csvText: string): { headers: string[]; rows: Record<string, string>[]; rawRows: string[][] } {
  if (!csvText || csvText.trim().length === 0) {
    return { headers: [], rows: [], rawRows: [] };
  }

  const allRows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let fieldWasQuoted = false;
  
  // Process character by character to handle multi-line quoted fields
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote within quoted field
          currentField += '"';
          i++; // Skip next quote
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        // Character inside quoted field (including newlines)
        currentField += char;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
        fieldWasQuoted = true;
      } else if (char === ',') {
        // Field separator - only trim unquoted fields
        currentRow.push(fieldWasQuoted ? currentField : currentField.trim());
        currentField = '';
        fieldWasQuoted = false;
      } else if (char === '\r') {
        // Handle Windows line endings \r\n
        if (nextChar === '\n') {
          i++; // Skip the \n
        }
        // End of row - only trim unquoted fields
        currentRow.push(fieldWasQuoted ? currentField : currentField.trim());
        allRows.push(currentRow);
        currentRow = [];
        currentField = '';
        fieldWasQuoted = false;
      } else if (char === '\n') {
        // Unix line ending - end of row
        currentRow.push(fieldWasQuoted ? currentField : currentField.trim());
        allRows.push(currentRow);
        currentRow = [];
        currentField = '';
        fieldWasQuoted = false;
      } else {
        currentField += char;
      }
    }
  }
  
  // Don't forget the last field/row
  currentRow.push(fieldWasQuoted ? currentField : currentField.trim());
  if (currentRow.length > 0) {
    allRows.push(currentRow);
  }

  if (allRows.length === 0) {
    return { headers: [], rows: [], rawRows: [] };
  }

  // Filter out completely empty rows (all empty strings)
  const nonEmptyRows = allRows.filter(row => row.some(field => field.length > 0));
  
  if (nonEmptyRows.length === 0) {
    return { headers: [], rows: [], rawRows: [] };
  }

  const headers = nonEmptyRows[0];
  const rawRows: string[][] = [];
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < nonEmptyRows.length; i++) {
    const values = nonEmptyRows[i];
    rawRows.push(values);
    
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return { headers, rows, rawRows };
}

/**
 * Fetch data from a Google Sheets share link
 */
export async function fetchGoogleSheetData(url: string): Promise<{
  success: boolean;
  data?: { headers: string[]; rows: Record<string, string>[]; rawRows: string[][] };
  error?: string;
}> {
  try {
    const spreadsheetId = extractGoogleSheetId(url);
    if (!spreadsheetId) {
      return { success: false, error: "Invalid Google Sheets URL - could not extract spreadsheet ID" };
    }

    const gid = extractGid(url);
    const csvUrl = buildCsvExportUrl(spreadsheetId, gid);

    console.log(`[DataIngestion] Fetching Google Sheet: ${csvUrl}`);

    const response = await fetch(csvUrl, {
      headers: {
        'User-Agent': 'CaptureInsight/1.0',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { 
          success: false, 
          error: "Cannot access this Google Sheet. Make sure it's shared as 'Anyone with the link can view'" 
        };
      }
      return { success: false, error: `Failed to fetch sheet: HTTP ${response.status}` };
    }

    const csvText = await response.text();
    
    // Check if we got HTML instead of CSV (happens when sheet isn't shared properly)
    if (csvText.trim().startsWith('<!DOCTYPE') || csvText.trim().startsWith('<html')) {
      return { 
        success: false, 
        error: "Cannot access this Google Sheet. Make sure it's shared as 'Anyone with the link can view'" 
      };
    }

    const parsed = parseCsv(csvText);
    console.log(`[DataIngestion] Parsed ${parsed.rows.length} rows with ${parsed.headers.length} columns`);

    return { success: true, data: parsed };
  } catch (error) {
    console.error("[DataIngestion] Error fetching Google Sheet:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error fetching sheet" 
    };
  }
}

/**
 * Check if a URL is a Google Sheets link
 */
export function isGoogleSheetsUrl(url: string): boolean {
  return url.includes('docs.google.com/spreadsheets');
}

/**
 * Ingest data from a sheet and store it with embeddings
 */
export async function ingestSheetData(
  sheetId: string,
  spaceId: string
): Promise<IngestionResult> {
  try {
    // Get the sheet from database
    const sheet = await storage.getSheet(sheetId);
    if (!sheet) {
      return { success: false, sheetId, error: "Sheet not found" };
    }

    // Check if it's a Google Sheets link
    const sourceUrl = (sheet.dataSourceMeta as any)?.url;
    if (!sourceUrl) {
      return { success: false, sheetId, error: "No source URL found for sheet" };
    }

    if (!isGoogleSheetsUrl(sourceUrl)) {
      return { success: false, sheetId, error: "Only Google Sheets URLs are currently supported" };
    }

    // Fetch the data
    const fetchResult = await fetchGoogleSheetData(sourceUrl);
    if (!fetchResult.success || !fetchResult.data) {
      return { success: false, sheetId, error: fetchResult.error };
    }

    const { headers, rows, rawRows } = fetchResult.data;

    // Update the sheet with the fetched data
    const updatedSheet = await storage.updateSheet(sheetId, {
      data: { headers, rows: rawRows },
      rowCount: rows.length,
    });

    if (!updatedSheet) {
      return { success: false, sheetId, error: "Failed to update sheet with data" };
    }

    // Create text representation for embedding
    const textContent = createTextRepresentation(headers, rows);
    
    // Generate and store embeddings
    const embeddingResult = await embedAndStoreSheet(updatedSheet, spaceId);
    
    if (!embeddingResult.success) {
      console.warn(`[DataIngestion] Embedding failed for sheet ${sheetId}: ${embeddingResult.error}`);
      // Don't fail the whole ingestion if embedding fails - data is still stored
    }

    console.log(`[DataIngestion] Successfully ingested sheet ${sheetId} with ${rows.length} rows`);

    return {
      success: true,
      sheetId,
      rowCount: rows.length,
      data: rows,
    };
  } catch (error) {
    console.error("[DataIngestion] Error ingesting sheet:", error);
    return {
      success: false,
      sheetId,
      error: error instanceof Error ? error.message : "Unknown error during ingestion",
    };
  }
}

/**
 * Create a text representation of the data for embedding
 */
function createTextRepresentation(headers: string[], rows: Record<string, string>[]): string {
  const lines: string[] = [];
  
  lines.push(`Columns: ${headers.join(', ')}`);
  lines.push(`Total rows: ${rows.length}`);
  lines.push('');
  
  // Include sample of data (first 50 rows to keep embedding reasonable)
  const sampleRows = rows.slice(0, 50);
  sampleRows.forEach((row, index) => {
    const rowParts = headers.map(h => `${h}: ${row[h] || ''}`);
    lines.push(`Row ${index + 1}: ${rowParts.join(', ')}`);
  });

  if (rows.length > 50) {
    lines.push(`... and ${rows.length - 50} more rows`);
  }

  return lines.join('\n');
}

/**
 * Ingest data immediately when a sheet is created with a link
 */
export async function ingestOnCreate(
  sheetId: string,
  spaceId: string,
  sourceUrl: string
): Promise<IngestionResult> {
  console.log(`[DataIngestion] Starting ingestion for new sheet ${sheetId}`);
  
  if (!isGoogleSheetsUrl(sourceUrl)) {
    console.log(`[DataIngestion] URL is not a Google Sheet, skipping auto-ingestion: ${sourceUrl}`);
    return { success: false, sheetId, error: "Only Google Sheets URLs are supported for auto-ingestion" };
  }

  return ingestSheetData(sheetId, spaceId);
}
