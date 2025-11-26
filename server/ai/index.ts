import {
  analyzeScreenshot,
  analyzeData,
  chat as geminiChat,
  extractInsights,
  analyzeKPI,
  isGeminiConfigured,
  type ScreenshotAnalysisResult,
  type DataAnalysisResult,
  type ChatMessage,
  type ChatResponse,
  type ExtractInsightsResult,
  type InsightResult,
} from "./gemini";

import {
  createEmbedding,
  createEmbeddings,
  cosineSimilarity,
  isOpenAIConfigured,
  getEmbeddingDimensions,
  type EmbeddingResult,
  type BatchEmbeddingResult,
} from "./openai";

import { storage } from "../storage";

export {
  analyzeScreenshot,
  analyzeData,
  extractInsights,
  analyzeKPI,
  isGeminiConfigured,
  createEmbedding,
  createEmbeddings,
  cosineSimilarity,
  isOpenAIConfigured,
  getEmbeddingDimensions,
};

export type {
  ScreenshotAnalysisResult,
  DataAnalysisResult,
  ChatMessage,
  ChatResponse,
  ExtractInsightsResult,
  InsightResult,
  EmbeddingResult,
  BatchEmbeddingResult,
};

export interface AnalyzeCaptureOptions {
  context?: string;
  spaceGoals?: string;
}

export type AnalyzeCaptureResult = ScreenshotAnalysisResult | DataAnalysisResult;

export async function analyzeCapture(
  type: "screenshot" | "data",
  content: string | any[],
  options?: AnalyzeCaptureOptions
): Promise<AnalyzeCaptureResult> {
  if (!isGeminiConfigured()) {
    throw new Error("Gemini AI is not configured. Please check AI_INTEGRATIONS_GEMINI_BASE_URL and AI_INTEGRATIONS_GEMINI_API_KEY environment variables.");
  }

  const contextWithGoals = options?.spaceGoals 
    ? `${options?.context || ""}\n\nSpace Goals: ${options.spaceGoals}`
    : options?.context;

  if (type === "screenshot") {
    if (typeof content !== "string") {
      throw new Error("Screenshot content must be a base64 string");
    }
    return analyzeScreenshot(content, contextWithGoals);
  } else {
    if (!Array.isArray(content)) {
      throw new Error("Data content must be an array");
    }
    return analyzeData(content, contextWithGoals);
  }
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!isOpenAIConfigured()) {
    console.warn("OpenAI is not configured. Embeddings are disabled.");
    return null;
  }

  try {
    const result = await createEmbedding(text);
    return result.embedding;
  } catch (error) {
    console.error("Failed to generate embedding:", error);
    return null;
  }
}

export async function generateEmbeddings(texts: string[]): Promise<number[][] | null> {
  if (!isOpenAIConfigured()) {
    console.warn("OpenAI is not configured. Embeddings are disabled.");
    return null;
  }

  try {
    const result = await createEmbeddings(texts);
    return result.embeddings;
  } catch (error) {
    console.error("Failed to generate embeddings:", error);
    return null;
  }
}

export interface SimilarityResult {
  id: string;
  entityType: string;
  entityId: string;
  score: number;
  content?: string | null;
  metadata?: any;
}

export async function searchSimilar(
  query: string,
  spaceId: string,
  limit: number = 10
): Promise<SimilarityResult[]> {
  if (!isOpenAIConfigured()) {
    console.warn("OpenAI is not configured. Vector search is disabled.");
    return [];
  }

  try {
    const embedding = await createEmbedding(query);
    
    if (!embedding || !embedding.embedding) {
      console.error("Failed to generate embedding for query");
      return [];
    }

    const results = await storage.searchSimilarDocuments(
      embedding.embedding,
      spaceId,
      limit
    );

    return results.map((doc) => ({
      id: doc.id,
      entityType: doc.entityType,
      entityId: doc.entityId,
      score: doc.similarity,
      content: doc.content,
      metadata: doc.metadata,
    }));
  } catch (error) {
    console.error("Error in searchSimilar:", error);
    return [];
  }
}

export function getAIStatus(): {
  gemini: { configured: boolean };
  openai: { configured: boolean; embeddingsEnabled: boolean };
} {
  return {
    gemini: {
      configured: isGeminiConfigured(),
    },
    openai: {
      configured: isOpenAIConfigured(),
      embeddingsEnabled: isOpenAIConfigured(),
    },
  };
}

export interface RagChatOptions {
  messages: ChatMessage[];
  spaceId?: string;
  spaceGoals?: string;
  additionalContext?: string;
  useRag?: boolean;
}

export async function chat(options: RagChatOptions): Promise<ChatResponse & { retrievedContext?: SimilarityResult[] }> {
  const { messages, spaceId, spaceGoals, additionalContext, useRag = true } = options;
  
  if (!isGeminiConfigured()) {
    throw new Error("Gemini AI is not configured");
  }

  let ragContext: SimilarityResult[] = [];
  let contextString = additionalContext || "";

  if (useRag && spaceId && isOpenAIConfigured() && messages.length > 0) {
    const lastUserMessage = messages.filter(m => m.role === "user").pop();
    if (lastUserMessage) {
      try {
        ragContext = await searchSimilar(lastUserMessage.content, spaceId, 5);
        
        if (ragContext.length > 0) {
          const relevantContent = ragContext
            .filter(r => r.score > 0.7)
            .map(r => {
              const entityLabel = r.entityType === "insight" ? "Insight" : "Data Sheet";
              const meta = r.metadata ? ` (${JSON.stringify(r.metadata)})` : "";
              return `[${entityLabel}${meta}]: ${r.content}`;
            })
            .join("\n\n");
          
          if (relevantContent) {
            contextString = contextString 
              ? `${contextString}\n\nRELEVANT CONTEXT FROM YOUR DATA:\n${relevantContent}`
              : `RELEVANT CONTEXT FROM YOUR DATA:\n${relevantContent}`;
          }
        }
      } catch (error) {
        console.error("RAG context retrieval failed:", error);
      }
    }
  }

  const result = await geminiChat(messages, contextString, spaceGoals);
  
  return {
    ...result,
    retrievedContext: ragContext.length > 0 ? ragContext : undefined,
  };
}
