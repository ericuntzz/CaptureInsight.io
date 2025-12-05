import { GoogleGenAI } from "@google/genai";
import { db } from "../db";
import { sheets, spaces } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { filterPIIFromData, type PIIFilterOptions } from "./piiFilter";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

const FLASH_MODEL = "gemini-2.5-flash";

const SUMMARY_SYSTEM_PROMPT = `You are an expert digital marketing and advertising data analyst. You know what digital marketers, VPs of Marketing, and Account Managers of Agencies are looking for. Your job is to provide EXTREMELY CONCISE executive summaries - like a smart assistant who tells you the ONE thing you need to know first.

CRITICAL RULES:
1. Maximum 3-5 bullet points total
2. Lead with the SINGLE most important insight
3. Each point should be ONE sentence
4. Focus on "what does this mean?" not "what is the data?"
5. Use specific numbers only if they're the key finding
6. NO section headers - just clean bullet points
7. NO detailed breakdowns or explanations
8. Think: "What would I tell my boss in 30 seconds?"

EXAMPLE OUTPUT FORMAT:
- **[Main Finding]**: Volume dropped 35% from April to July - this is your top priority
- Conversion rates remained stable at ~9-11%, so the decline is a pipeline problem, not a quality issue  
- The "1M CCC" metric is your most reliable indicator - focus tracking here
- Action needed: Investigate why secondary conversions hit 0% in June/July

That's it. Short. Punchy. Actionable. No fluff.`;

export interface SummaryStreamChunk {
  type: "chunk" | "done" | "error";
  content?: string;
  error?: string;
}

export interface StreamInsightSummaryOptions {
  insightId: string;
  batchId: string;
  spaceId: string;
  piiFilter?: PIIFilterOptions;
}

async function getSheetsByBatchId(batchId: string): Promise<typeof sheets.$inferSelect[]> {
  return await db
    .select()
    .from(sheets)
    .where(eq(sheets.captureBatchId, batchId));
}

async function getSpaceAISettings(spaceId: string): Promise<{
  piiFilterEnabled?: boolean;
  piiFilterPatterns?: string[];
} | null> {
  const [space] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.id, spaceId));
  
  if (!space || !space.aiSettings) {
    return null;
  }
  
  return space.aiSettings as {
    piiFilterEnabled?: boolean;
    piiFilterPatterns?: string[];
  };
}

// Build context from sheet data for AI summary
// Note: By this point, data should already be PII-filtered if needed
function buildDataContext(sheetsData: typeof sheets.$inferSelect[]): string {
  const dataBlocks: string[] = [];
  
  for (const sheet of sheetsData) {
    // Use raw data for speed (already PII-filtered if filtering is enabled)
    const rawData = sheet.data as any;
    
    // Handle both data formats: { headers, rows } object or plain array
    let data: any[] = [];
    if (rawData) {
      if (rawData.rows && Array.isArray(rawData.rows)) {
        // Format 1: { headers: [], rows: [] } from data ingestion
        // Convert to array of objects with headers as keys
        const headers = rawData.headers || [];
        data = rawData.rows.map((row: any[]) => {
          const obj: Record<string, any> = {};
          headers.forEach((header: string, idx: number) => {
            obj[header || `col_${idx}`] = row[idx];
          });
          return obj;
        });
      } else if (Array.isArray(rawData)) {
        // Format 2: Plain array
        data = rawData;
      }
    }
    
    if (data.length === 0) {
      continue;
    }
    
    const sheetName = sheet.name || "Untitled Sheet";
    
    // Take only first 50 rows for faster processing and smaller context
    const sampleData = data.slice(0, 50);
    const dataStr = JSON.stringify(sampleData, null, 2);
    
    let block = `Data: ${sheetName}`;
    block += ` (${data.length} rows)`;
    block += `\n\`\`\`json\n${dataStr.slice(0, 8000)}\n\`\`\``;
    
    dataBlocks.push(block);
  }
  
  return dataBlocks.join("\n\n");
}

// Helper to wait for a specified time
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Check if sheets have data available
// Data can be stored as: { headers, rows } object OR as a plain array
function sheetsHaveData(sheetsList: typeof sheets.$inferSelect[]): boolean {
  for (const sheet of sheetsList) {
    const rawData = sheet.data as any;
    
    // Check if data exists in either format
    let hasData = false;
    if (rawData) {
      // Format 1: { headers: [], rows: [] } from data ingestion
      if (rawData.rows && Array.isArray(rawData.rows) && rawData.rows.length > 0) {
        hasData = true;
      }
      // Format 2: Plain array
      else if (Array.isArray(rawData) && rawData.length > 0) {
        hasData = true;
      }
    }
    
    console.log(`[InsightSummary] Sheet ${sheet.id} data check:`, {
      hasData,
      dataType: typeof rawData,
      hasRows: rawData?.rows ? rawData.rows.length : 0,
      isArray: Array.isArray(rawData)
    });
    
    if (hasData) {
      return true;
    }
  }
  return false;
}

export async function* streamInsightSummary(
  options: StreamInsightSummaryOptions
): AsyncGenerator<SummaryStreamChunk> {
  const { batchId, spaceId, piiFilter } = options;
  
  try {
    // Retry logic: wait for data ingestion to complete
    // The sheet record is created immediately, but data ingestion runs async
    const maxRetries = 10;
    const retryDelay = 1000; // 1 second between retries
    let batchSheets = await getSheetsByBatchId(batchId);
    console.log(`[InsightSummary] Found ${batchSheets.length} sheets for batchId: ${batchId}`);
    let retries = 0;
    
    // Wait for sheets to have data (data ingestion to complete)
    while (!sheetsHaveData(batchSheets) && retries < maxRetries) {
      console.log(`[InsightSummary] Waiting for data ingestion... (attempt ${retries + 1}/${maxRetries})`);
      await delay(retryDelay);
      batchSheets = await getSheetsByBatchId(batchId);
      console.log(`[InsightSummary] Retry found ${batchSheets.length} sheets`);
      retries++;
    }
    
    if (batchSheets.length === 0) {
      yield {
        type: "error",
        error: "No sheets found with the specified batch ID",
      };
      return;
    }
    
    const spaceSettings = await getSpaceAISettings(spaceId);
    
    let processedSheets = batchSheets;
    
    const shouldFilterPII = piiFilter?.enabled || spaceSettings?.piiFilterEnabled;
    
    if (shouldFilterPII) {
      const filterOptions: PIIFilterOptions = {
        enabled: true,
        patterns: piiFilter?.patterns || spaceSettings?.piiFilterPatterns,
      };
      
      // SECURITY: Filter BOTH raw data and cleaned data to prevent PII leaks
      // Since we use raw data for instant summaries, we must filter it
      processedSheets = batchSheets.map(sheet => {
        const cleanedData = sheet.cleanedData as { data?: any[] } | null;
        const rawData = sheet.data as any[] | null;
        
        // Filter raw data (used for instant summaries)
        let filteredRawData = rawData;
        if (Array.isArray(rawData) && rawData.length > 0) {
          const filtered = filterPIIFromData(rawData, filterOptions);
          filteredRawData = filtered.data;
        }
        
        // Filter cleaned data if it exists
        let filteredCleanedData = cleanedData;
        if (cleanedData?.data && Array.isArray(cleanedData.data) && cleanedData.data.length > 0) {
          const filtered = filterPIIFromData(cleanedData.data, filterOptions);
          filteredCleanedData = { ...cleanedData, data: filtered.data };
        }
        
        return {
          ...sheet,
          data: filteredRawData,
          cleanedData: filteredCleanedData,
        };
      });
    }
    
    const dataContext = buildDataContext(processedSheets);
    
    if (!dataContext.trim()) {
      yield {
        type: "error",
        error: "No data available in the captured sheets for summarization",
      };
      return;
    }
    
    const userPrompt = `Here's the data I just captured. Give me the quick takeaway - what's the ONE most important thing I need to know, plus 2-3 supporting points. Keep it super brief.

${dataContext}`;

    const response = await ai.models.generateContentStream({
      model: FLASH_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: SUMMARY_SYSTEM_PROMPT,
      },
    });
    
    for await (const chunk of response) {
      const text = chunk.text;
      if (text) {
        yield {
          type: "chunk",
          content: text,
        };
      }
    }
    
    yield { type: "done" };
    
  } catch (error) {
    console.error("Error streaming insight summary:", error);
    yield {
      type: "error",
      error: error instanceof Error ? error.message : "Failed to generate summary",
    };
  }
}

export function isInsightSummaryConfigured(): boolean {
  return !!(
    process.env.AI_INTEGRATIONS_GEMINI_BASE_URL &&
    process.env.AI_INTEGRATIONS_GEMINI_API_KEY
  );
}
