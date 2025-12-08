import { storage } from "../storage";
import { generateEmbedding, generateEmbeddings } from "./index";
import { chunkText, type Chunk, type ChunkOptions } from "./chunking";
import type { Insight, Sheet } from "../../shared/schema";

export interface EmbeddingResult {
  success: boolean;
  entityType: string;
  entityId: string;
  chunksCreated?: number;
  error?: string;
}

export interface EmbedContentOptions {
  spaceId: string;
  workspaceId?: string;
  metadata?: Record<string, any>;
  chunkOptions?: ChunkOptions;
}

export async function embedAndStoreContent(
  entityType: string,
  entityId: string,
  content: string,
  spaceId: string,
  metadata?: Record<string, any>,
  workspaceId?: string
): Promise<EmbeddingResult> {
  try {
    await storage.deleteDocumentEmbedding(entityType, entityId);

    const chunks = chunkText(content, { maxChunkSize: 1500, overlapSize: 150 });
    
    if (chunks.length === 0) {
      return {
        success: false,
        entityType,
        entityId,
        error: "No content to embed",
      };
    }

    if (chunks.length === 1) {
      const embedding = await generateEmbedding(chunks[0].content);
      
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
        content: chunks[0].content,
        embedding,
        spaceId,
        workspaceId,
        chunkIndex: 0,
        totalChunks: 1,
        metadata: {
          ...metadata,
          ...chunks[0].metadata,
        },
      });

      return {
        success: true,
        entityType,
        entityId,
        chunksCreated: 1,
      };
    }

    const chunkContents = chunks.map(c => c.content);
    const embeddings = await generateEmbeddings(chunkContents);
    
    if (!embeddings) {
      return {
        success: false,
        entityType,
        entityId,
        error: "Failed to generate embeddings - OpenAI not configured or embedding generation failed",
      };
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];
      
      await storage.createDocumentEmbedding({
        entityType,
        entityId,
        content: chunk.content,
        embedding,
        spaceId,
        workspaceId,
        chunkIndex: chunk.index,
        totalChunks: chunks.length,
        metadata: {
          ...metadata,
          ...chunk.metadata,
          chunkStart: chunk.start,
          chunkEnd: chunk.end,
        },
      });
    }

    return {
      success: true,
      entityType,
      entityId,
      chunksCreated: chunks.length,
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
  spaceId: string,
  workspaceId?: string
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
  }, workspaceId || insight.workspaceId || undefined);
}

export async function embedAndStoreSheet(
  sheet: Sheet,
  spaceId: string,
  workspaceId?: string
): Promise<EmbeddingResult> {
  let content = sheet.name;
  
  const sheetWithCleaned = sheet as Sheet & { cleanedData?: { title?: string; description?: string; data: any[] } };
  if (sheetWithCleaned.cleanedData && sheetWithCleaned.cleanedData.data) {
    const cleanedStr = JSON.stringify(sheetWithCleaned.cleanedData.data);
    const title = sheetWithCleaned.cleanedData.title || sheet.name;
    const description = sheetWithCleaned.cleanedData.description || "";
    content = `${title}\n${description}\n${cleanedStr}`;
  } else if (sheet.data) {
    const dataStr = typeof sheet.data === "string" 
      ? sheet.data 
      : JSON.stringify(sheet.data);
    content += "\n" + dataStr;
  }

  return embedAndStoreContent("sheet", sheet.id, content, spaceId, {
    name: sheet.name,
    rowCount: sheet.rowCount,
    dataSourceType: sheet.dataSourceType,
  }, workspaceId || sheet.workspaceId || undefined);
}

export interface ReindexResult {
  spaceId: string;
  insights: { total: number; success: number; failed: number; chunksCreated: number };
  sheets: { total: number; success: number; failed: number; chunksCreated: number };
}

export async function reindexSpace(spaceId: string): Promise<ReindexResult> {
  const result: ReindexResult = {
    spaceId,
    insights: { total: 0, success: 0, failed: 0, chunksCreated: 0 },
    sheets: { total: 0, success: 0, failed: 0, chunksCreated: 0 },
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
      result.insights.chunksCreated += embeddingResult.chunksCreated || 1;
    } else {
      result.insights.failed++;
    }
    return embeddingResult;
  });

  const sheetPromises = sheets.map(async (sheet) => {
    const embeddingResult = await embedAndStoreSheet(sheet, spaceId);
    if (embeddingResult.success) {
      result.sheets.success++;
      result.sheets.chunksCreated += embeddingResult.chunksCreated || 1;
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
