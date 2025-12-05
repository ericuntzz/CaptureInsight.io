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

const SUMMARY_SYSTEM_PROMPT = `You are an expert data analyst providing concise, actionable summaries of business data.

INSTRUCTIONS:
- Analyze the provided data and create a clear, professional summary
- Use the format that best fits the data: bullets for lists, paragraphs for narratives, headers for organization
- Focus on key insights, trends, patterns, and notable observations
- Highlight any anomalies or areas requiring attention
- Keep the summary concise but comprehensive
- Use markdown formatting for readability
- Be specific with numbers and metrics when relevant
- Avoid generic statements - provide actionable insights

OUTPUT FORMAT:
- Use ## for main section headers
- Use bullet points (-) for lists of findings
- Use **bold** for emphasis on key metrics
- Keep paragraphs short and focused
- End with actionable recommendations if appropriate`;

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

function buildDataContext(sheetsData: typeof sheets.$inferSelect[]): string {
  const dataBlocks: string[] = [];
  
  for (const sheet of sheetsData) {
    const cleanedData = sheet.cleanedData as { data?: any[]; title?: string; description?: string } | null;
    const rawData = sheet.data as any[] | null;
    
    const data = cleanedData?.data || rawData || [];
    
    if (!Array.isArray(data) || data.length === 0) {
      continue;
    }
    
    const sheetName = sheet.name || "Untitled Sheet";
    const description = cleanedData?.description || "";
    
    const sampleData = data.slice(0, 100);
    const dataStr = JSON.stringify(sampleData, null, 2);
    
    let block = `### Data Source: ${sheetName}`;
    if (description) {
      block += `\nDescription: ${description}`;
    }
    block += `\nRows: ${data.length}`;
    block += `\n\nSample Data (up to 100 rows):\n\`\`\`json\n${dataStr.slice(0, 15000)}\n\`\`\``;
    
    dataBlocks.push(block);
  }
  
  return dataBlocks.join("\n\n---\n\n");
}

export async function* streamInsightSummary(
  options: StreamInsightSummaryOptions
): AsyncGenerator<SummaryStreamChunk> {
  const { batchId, spaceId, piiFilter } = options;
  
  try {
    const batchSheets = await getSheetsByBatchId(batchId);
    
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
      
      processedSheets = batchSheets.map(sheet => {
        const cleanedData = sheet.cleanedData as { data?: any[] } | null;
        const rawData = sheet.data as any[] | null;
        const data = cleanedData?.data || rawData || [];
        
        if (Array.isArray(data) && data.length > 0) {
          const filtered = filterPIIFromData(data, filterOptions);
          return {
            ...sheet,
            cleanedData: cleanedData 
              ? { ...cleanedData, data: filtered.data }
              : null,
            data: !cleanedData ? filtered.data : sheet.data,
          };
        }
        return sheet;
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
    
    const userPrompt = `Analyze the following captured data and provide a comprehensive summary with key insights:

${dataContext}

Please provide:
1. A brief overview of what the data represents
2. Key findings and notable patterns
3. Any trends or changes worth highlighting
4. Potential areas of concern or opportunities
5. Actionable recommendations (if applicable)`;

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
