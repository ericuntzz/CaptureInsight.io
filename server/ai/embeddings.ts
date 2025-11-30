import { storage } from "../storage";
import { generateEmbedding } from "./index";
import type { Insight, Sheet } from "../../shared/schema";

export interface EmbeddingResult {
  success: boolean;
  entityType: string;
  entityId: string;
  error?: string;
}

export async function embedAndStoreContent(
  entityType: string,
  entityId: string,
  content: string,
  spaceId: string,
  metadata?: Record<string, any>
): Promise<EmbeddingResult> {
  try {
    const embedding = await generateEmbedding(content);
    
    if (!embedding) {
      return {
        success: false,
        entityType,
        entityId,
        error: "Failed to generate embedding - OpenAI not configured or embedding generation failed",
      };
    }

    await storage.createDocumentEmbedding({
      entityType,
      entityId,
      content: content.slice(0, 8000),
      embedding,
      spaceId,
      metadata,
    });

    return {
      success: true,
      entityType,
      entityId,
    };
  } catch (error) {
    console.error(`Failed to embed content for ${entityType}/${entityId}:`, error);
    return {
      success: false,
      entityType,
      entityId,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function embedAndStoreInsight(
  insight: Insight,
  spaceId: string
): Promise<EmbeddingResult> {
  const content = [
    insight.title,
    insight.summary || "",
    `Status: ${insight.status || "Open"}`,
    insight.priority ? `Priority: ${insight.priority}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return embedAndStoreContent("insight", insight.id, content, spaceId, {
    title: insight.title,
    status: insight.status,
    priority: insight.priority,
  });
}

export async function embedAndStoreSheet(
  sheet: Sheet,
  spaceId: string
): Promise<EmbeddingResult> {
  let content = sheet.name;
  
  // Prefer cleanedData for RAG - it's structured JSON optimized for AI consumption
  const sheetWithCleaned = sheet as Sheet & { cleanedData?: { title?: string; description?: string; data: any[] } };
  if (sheetWithCleaned.cleanedData && sheetWithCleaned.cleanedData.data) {
    const cleanedStr = JSON.stringify(sheetWithCleaned.cleanedData.data);
    const title = sheetWithCleaned.cleanedData.title || sheet.name;
    const description = sheetWithCleaned.cleanedData.description || "";
    content = `${title}\n${description}\n${cleanedStr.slice(0, 8000)}`;
  } else if (sheet.data) {
    // Fallback to raw data if cleanedData not available
    const dataStr = typeof sheet.data === "string" 
      ? sheet.data 
      : JSON.stringify(sheet.data);
    content += "\n" + dataStr.slice(0, 8000);
  }

  return embedAndStoreContent("sheet", sheet.id, content, spaceId, {
    name: sheet.name,
    rowCount: sheet.rowCount,
    dataSourceType: sheet.dataSourceType,
  });
}

export interface ReindexResult {
  spaceId: string;
  insights: { total: number; success: number; failed: number };
  sheets: { total: number; success: number; failed: number };
}

export async function reindexSpace(spaceId: string): Promise<ReindexResult> {
  const result: ReindexResult = {
    spaceId,
    insights: { total: 0, success: 0, failed: 0 },
    sheets: { total: 0, success: 0, failed: 0 },
  };

  const [insights, sheets] = await Promise.all([
    storage.getInsights(spaceId),
    storage.getSheets(spaceId),
  ]);

  result.insights.total = insights.length;
  result.sheets.total = sheets.length;

  const insightPromises = insights.map(async (insight) => {
    const embeddingResult = await embedAndStoreInsight(insight, spaceId);
    if (embeddingResult.success) {
      result.insights.success++;
    } else {
      result.insights.failed++;
    }
    return embeddingResult;
  });

  const sheetPromises = sheets.map(async (sheet) => {
    const embeddingResult = await embedAndStoreSheet(sheet, spaceId);
    if (embeddingResult.success) {
      result.sheets.success++;
    } else {
      result.sheets.failed++;
    }
    return embeddingResult;
  });

  await Promise.all([...insightPromises, ...sheetPromises]);

  console.log(`Reindex complete for space ${spaceId}:`, result);
  return result;
}

export async function deleteEntityEmbedding(
  entityType: string,
  entityId: string
): Promise<boolean> {
  return storage.deleteDocumentEmbedding(entityType, entityId);
}
