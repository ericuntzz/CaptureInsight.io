import {
  analyzeScreenshot,
  analyzeData,
  chat as geminiChat,
  chatWithCanvas as geminiChatWithCanvas,
  extractInsights,
  analyzeKPI,
  isGeminiConfigured,
  type ScreenshotAnalysisResult,
  type DataAnalysisResult,
  type ChatMessage,
  type ChatResponse,
  type ExtractInsightsResult,
  type InsightResult,
  type CanvasEditResponse,
} from "./gemini";

import {
  createEmbedding,
  createEmbeddings,
  cosineSimilarity,
  isOpenAIConfigured as isOpenAIEmbeddingsConfigured,
  getEmbeddingDimensions,
  type EmbeddingResult,
  type BatchEmbeddingResult,
} from "./openai";

import {
  filterPII,
  filterPIIFromData,
  filterPIIFromMessages,
  getAvailablePIIPatterns,
  type PIIFilterOptions,
  type PIIFilterResult,
} from "./piiFilter";

import {
  detectColumnTypes,
  detectCurrency,
  detectPercentage,
  detectDate,
  detectInteger,
  generateColumnTypeSummary,
  type ColumnTypeHeuristic,
  type CurrencyDetectionResult,
  type PercentageDetectionResult,
  type DateDetectionResult,
  type IntegerDetectionResult,
} from "./columnHeuristics";

import {
  cleanSheetData,
  cleanScreenshotData,
  cleanTabularData,
  cleanDocumentData,
  triggerDataCleaning,
  isGeminiConfigured as isDataCleaningConfigured,
  type CleanedDataResult,
  type SourceType,
  type ProcessingProgress,
} from "./dataCleaning";

import {
  suggestColumnMappings,
  suggestMappingsForTemplate,
  isColumnMappingConfigured,
  type ColumnMappingSuggestion,
  type ColumnSchema as ColumnMappingSchema,
} from "./columnMapping";

import {
  streamInsightSummary,
  isInsightSummaryConfigured,
  type SummaryStreamChunk,
  type StreamInsightSummaryOptions,
} from "./insightSummary";

import {
  rerankResults,
  isRerankerConfigured,
  type RerankOptions,
} from "./reranker";

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
  isOpenAIEmbeddingsConfigured,
  getEmbeddingDimensions,
  filterPII,
  filterPIIFromData,
  filterPIIFromMessages,
  getAvailablePIIPatterns,
  detectColumnTypes,
  detectCurrency,
  detectPercentage,
  detectDate,
  detectInteger,
  generateColumnTypeSummary,
  cleanSheetData,
  cleanScreenshotData,
  cleanTabularData,
  cleanDocumentData,
  triggerDataCleaning,
  isDataCleaningConfigured,
  suggestColumnMappings,
  suggestMappingsForTemplate,
  isColumnMappingConfigured,
  streamInsightSummary,
  isInsightSummaryConfigured,
};

export type { PIIFilterOptions, PIIFilterResult };

export type {
  ColumnTypeHeuristic,
  CurrencyDetectionResult,
  PercentageDetectionResult,
  DateDetectionResult,
  IntegerDetectionResult,
};

export type {
  CleanedDataResult,
  SourceType,
  ProcessingProgress,
};

export type {
  ColumnMappingSuggestion,
  ColumnMappingSchema,
};

export type {
  SummaryStreamChunk,
  StreamInsightSummaryOptions,
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
  CanvasEditResponse,
};

export interface AnalyzeCaptureOptions {
  context?: string;
  spaceGoals?: string;
  piiFilter?: PIIFilterOptions;
}

export type AnalyzeCaptureResult = ScreenshotAnalysisResult | DataAnalysisResult;

export type AnalyzeCaptureResultWithPII = (ScreenshotAnalysisResult | DataAnalysisResult) & {
  piiRedacted?: { count: number; types: string[] };
};

export async function analyzeCapture(
  type: "screenshot" | "data",
  content: string | any[],
  options?: AnalyzeCaptureOptions
): Promise<AnalyzeCaptureResultWithPII> {
  if (!isGeminiConfigured()) {
    throw new Error("Gemini AI is not configured. Please check AI_INTEGRATIONS_GEMINI_BASE_URL and AI_INTEGRATIONS_GEMINI_API_KEY environment variables.");
  }

  const contextWithGoals = options?.spaceGoals 
    ? `${options?.context || ""}\n\nSpace Goals: ${options.spaceGoals}`
    : options?.context;

  let piiRedacted: { count: number; types: string[] } | undefined;

  if (type === "screenshot") {
    if (typeof content !== "string") {
      throw new Error("Screenshot content must be a base64 string");
    }
    const result = await analyzeScreenshot(content, contextWithGoals);
    return { ...result, piiRedacted };
  } else {
    if (!Array.isArray(content)) {
      throw new Error("Data content must be an array");
    }
    
    let dataToAnalyze = content;
    if (options?.piiFilter?.enabled) {
      const filtered = filterPIIFromData(content, options.piiFilter);
      dataToAnalyze = filtered.data;
      piiRedacted = { count: filtered.redactedCount, types: filtered.redactedTypes };
    }
    
    const result = await analyzeData(dataToAnalyze, contextWithGoals);
    return { ...result, piiRedacted };
  }
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!isOpenAIEmbeddingsConfigured()) {
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
  if (!isOpenAIEmbeddingsConfigured()) {
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
  if (!isOpenAIEmbeddingsConfigured()) {
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
  embeddings: { configured: boolean; provider: string };
} {
  return {
    gemini: {
      configured: isGeminiConfigured(),
    },
    embeddings: {
      configured: isOpenAIEmbeddingsConfigured(),
      provider: "openai",
    },
  };
}

export interface CanvasContext {
  title: string;
  notes: string;
  selection?: {
    text: string;
    start?: number;
    end?: number;
  };
}

export interface RagChatOptions {
  messages: ChatMessage[];
  spaceId?: string;
  workspaceId?: string;
  allSpaceIds?: string[];
  spaceGoals?: string;
  additionalContext?: string;
  memoryContext?: string;
  useRag?: boolean;
  useHybridSearch?: boolean;
  useReranking?: boolean;
  rerankInstructions?: string;
  piiFilter?: PIIFilterOptions;
  canvasContext?: CanvasContext;
  quickAction?: string;
}

export interface ChatCitation {
  entityType: string;
  entityId: string;
  name: string;
  relevanceScore: number;
}

export interface AIEditProposal {
  type: 'replace' | 'insert' | 'delete' | 'rewrite';
  targetType: 'title' | 'notes' | 'selection';
  originalText?: string;
  suggestedText: string;
  rationale: string;
}

export interface RagChatResponse extends ChatResponse {
  citations?: ChatCitation[];
  retrievedContext?: SimilarityResult[];
  piiRedacted?: { count: number; types: string[] };
  editProposals?: AIEditProposal[];
}

export async function chat(options: RagChatOptions): Promise<RagChatResponse> {
  const {
    messages,
    spaceId,
    workspaceId,
    allSpaceIds,
    spaceGoals,
    additionalContext,
    memoryContext,
    useRag = true,
    useHybridSearch = true,
    useReranking = true,
    rerankInstructions,
    piiFilter,
    canvasContext,
    quickAction
  } = options;
  
  if (!isGeminiConfigured()) {
    throw new Error("Gemini AI is not configured");
  }

  let ragContext: SimilarityResult[] = [];
  let contextString = additionalContext || "";
  const citations: ChatCitation[] = [];
  let piiRedacted: { count: number; types: string[] } | undefined;

  let messagesToSend = messages;
  if (piiFilter?.enabled) {
    const filtered = filterPIIFromMessages(messages, piiFilter);
    messagesToSend = filtered.messages;
    piiRedacted = { count: filtered.redactedCount, types: filtered.redactedTypes };
  }

  if (useRag && spaceId && isOpenAIEmbeddingsConfigured() && messagesToSend.length > 0) {
    const lastUserMessage = messagesToSend.filter(m => m.role === "user").pop();
    if (lastUserMessage) {
      try {
        const candidateSpaceIds = allSpaceIds?.length ? allSpaceIds : [spaceId];
        const spaceIdsToSearch = candidateSpaceIds.filter((id): id is string => id != null && id !== '');
        
        if (useHybridSearch && spaceIdsToSearch.length > 0) {
          const embedding = await createEmbedding(lastUserMessage.content);
          if (embedding?.embedding) {
            const hybridResults = await storage.searchHybridDocuments({
              query: lastUserMessage.content,
              embedding: embedding.embedding,
              spaceIds: spaceIdsToSearch,
              currentWorkspaceId: workspaceId,
              limit: 20,
              vectorWeight: 0.7,
              keywordWeight: 0.3,
              workspaceBoost: 1.5,
            });
            
            ragContext = hybridResults.map(doc => ({
              id: doc.id,
              entityType: doc.entityType,
              entityId: doc.entityId,
              score: doc.combinedScore,
              content: doc.content,
              metadata: doc.metadata,
            }));
          }
        } else {
          ragContext = await searchSimilar(lastUserMessage.content, spaceId, 20);
        }
        
        if (useReranking && ragContext.length > 3 && isRerankerConfigured()) {
          const reranked = await rerankResults(
            lastUserMessage.content,
            ragContext,
            {
              instructions: rerankInstructions,
              topK: 5,
              minScore: 0.3,
            }
          );
          ragContext = reranked.results;
        } else {
          ragContext = ragContext.slice(0, 5);
        }
        
        if (ragContext.length > 0) {
          const relevantResults = ragContext.filter(r => r.score > 0.3);
          
          relevantResults.forEach(r => {
            const name = r.metadata?.title || r.metadata?.name || r.entityId;
            citations.push({
              entityType: r.entityType,
              entityId: r.entityId,
              name: typeof name === 'string' ? name : r.entityId,
              relevanceScore: r.score,
            });
          });
          
          let relevantContent = relevantResults
            .map(r => {
              const entityLabel = r.entityType === "insight" ? "Insight" : "Data Sheet";
              const name = r.metadata?.title || r.metadata?.name || "";
              return `[${entityLabel}: ${name}]\n${r.content}`;
            })
            .join("\n\n---\n\n");
          
          if (piiFilter?.enabled && relevantContent) {
            const filteredContext = filterPII(relevantContent, piiFilter);
            relevantContent = filteredContext.text;
            if (piiRedacted) {
              piiRedacted.count += filteredContext.redactedCount;
              filteredContext.redactedTypes.forEach(t => {
                if (!piiRedacted!.types.includes(t)) piiRedacted!.types.push(t);
              });
            }
          }
          
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

  if (canvasContext || quickAction) {
    const result = await geminiChatWithCanvas(
      messagesToSend,
      canvasContext || { title: '', notes: '' },
      quickAction,
      contextString,
      spaceGoals,
      memoryContext
    );
    
    return {
      ...result,
      citations: citations.length > 0 ? citations : undefined,
      retrievedContext: ragContext.length > 0 ? ragContext : undefined,
      piiRedacted,
    };
  }

  const result = await geminiChat(messagesToSend, contextString, spaceGoals, memoryContext);
  
  return {
    ...result,
    citations: citations.length > 0 ? citations : undefined,
    retrievedContext: ragContext.length > 0 ? ragContext : undefined,
    piiRedacted,
  };
}
