import { GoogleGenAI } from "@google/genai";
import pLimit from "p-limit";
import pRetry, { AbortError } from "p-retry";

let genAI: GoogleGenAI | null = null;

function getGoogleAI(): GoogleGenAI | null {
  if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
    return null;
  }
  
  if (!genAI) {
    genAI = new GoogleGenAI({
      apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
      httpOptions: {
        apiVersion: "",
        baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
      },
    });
  }
  
  return genAI;
}

const rateLimiter = pLimit(5);

const EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_DIMENSIONS = 768;

function isRateLimitError(error: unknown): boolean {
  const errorMsg = error instanceof Error ? error.message : String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("rate_limit") ||
    errorMsg.includes("RATE_LIMIT") ||
    errorMsg.toLowerCase().includes("quota")
  );
}

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

export async function createEmbedding(text: string): Promise<EmbeddingResult> {
  const client = getGoogleAI();
  
  if (!client) {
    throw new Error("Google AI is not configured. Gemini integration is required for embeddings.");
  }
  
  return rateLimiter(async () => {
    return pRetry(
      async () => {
        try {
          const truncatedText = text.slice(0, 8000);
          
          const result = await client.models.embedContent({
            model: EMBEDDING_MODEL,
            contents: [{ role: "user", parts: [{ text: truncatedText }] }],
          });
          
          const embeddingValues = (result as any).embedding?.values ?? result.embeddings?.[0]?.values;
          if (!embeddingValues || embeddingValues.length !== EMBEDDING_DIMENSIONS) {
            throw new Error(`Invalid embedding returned from Google AI (expected ${EMBEDDING_DIMENSIONS} dimensions, got ${embeddingValues?.length ?? 0})`);
          }
          
          return {
            embedding: embeddingValues,
            tokens: Math.ceil(truncatedText.length / 4),
          };
        } catch (error) {
          if (isRateLimitError(error)) {
            throw error;
          }
          throw new AbortError(error as Error);
        }
      },
      {
        retries: 3,
        minTimeout: 1000,
        maxTimeout: 10000,
        factor: 2,
      }
    );
  });
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  totalTokens: number;
}

export async function createEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
  const client = getGoogleAI();
  
  if (!client) {
    throw new Error("Google AI is not configured. Gemini integration is required for embeddings.");
  }
  
  const allEmbeddings: number[][] = [];
  let totalTokens = 0;
  
  const processText = async (text: string): Promise<{ embedding: number[]; tokens: number }> => {
    return rateLimiter(async () => {
      return pRetry(
        async () => {
          try {
            const truncatedText = text.slice(0, 8000);
            
            const result = await client.models.embedContent({
              model: EMBEDDING_MODEL,
              contents: [{ role: "user", parts: [{ text: truncatedText }] }],
            });
            
            const embeddingValues = (result as any).embedding?.values ?? result.embeddings?.[0]?.values;
            if (!embeddingValues || embeddingValues.length !== EMBEDDING_DIMENSIONS) {
              throw new Error(`Invalid embedding returned from Google AI (expected ${EMBEDDING_DIMENSIONS} dimensions, got ${embeddingValues?.length ?? 0})`);
            }
            
            return {
              embedding: embeddingValues,
              tokens: Math.ceil(truncatedText.length / 4),
            };
          } catch (error) {
            if (isRateLimitError(error)) {
              throw error;
            }
            throw new AbortError(error as Error);
          }
        },
        {
          retries: 3,
          minTimeout: 1000,
          maxTimeout: 10000,
          factor: 2,
        }
      );
    });
  };
  
  const results = await Promise.all(texts.map(processText));
  
  for (const result of results) {
    allEmbeddings.push(result.embedding);
    totalTokens += result.tokens;
  }
  
  return {
    embeddings: allEmbeddings,
    totalTokens,
  };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function isGoogleEmbeddingsConfigured(): boolean {
  return !!process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
}

export function getEmbeddingDimensions(): number {
  return EMBEDDING_DIMENSIONS;
}
