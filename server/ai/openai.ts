import OpenAI from "openai";
import pLimit from "p-limit";
import pRetry, { AbortError } from "p-retry";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  
  return openaiClient;
}

const rateLimiter = pLimit(5);

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

function isRateLimitError(error: unknown): boolean {
  const errorMsg = error instanceof Error ? error.message : String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("rate_limit") ||
    errorMsg.toLowerCase().includes("quota")
  );
}

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

export async function createEmbedding(text: string): Promise<EmbeddingResult> {
  const client = getOpenAIClient();
  
  if (!client) {
    throw new Error("OpenAI is not configured. Set OPENAI_API_KEY environment variable.");
  }
  
  return rateLimiter(async () => {
    return pRetry(
      async () => {
        try {
          const response = await client.embeddings.create({
            model: EMBEDDING_MODEL,
            input: text.slice(0, 8000),
            dimensions: EMBEDDING_DIMENSIONS,
          });
          
          return {
            embedding: response.data[0].embedding,
            tokens: response.usage?.total_tokens || 0,
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
  const client = getOpenAIClient();
  
  if (!client) {
    throw new Error("OpenAI is not configured. Set OPENAI_API_KEY environment variable.");
  }
  
  const BATCH_SIZE = 100;
  const allEmbeddings: number[][] = [];
  let totalTokens = 0;
  
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    batches.push(texts.slice(i, i + BATCH_SIZE).map(t => t.slice(0, 8000)));
  }
  
  const processBatch = async (batch: string[]): Promise<{ embeddings: number[][]; tokens: number }> => {
    return rateLimiter(async () => {
      return pRetry(
        async () => {
          try {
            const response = await client.embeddings.create({
              model: EMBEDDING_MODEL,
              input: batch,
              dimensions: EMBEDDING_DIMENSIONS,
            });
            
            const embeddings = response.data
              .sort((a, b) => a.index - b.index)
              .map(d => d.embedding);
            
            return {
              embeddings,
              tokens: response.usage?.total_tokens || 0,
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
  
  const results = await Promise.all(batches.map(processBatch));
  
  for (const result of results) {
    allEmbeddings.push(...result.embeddings);
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

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export function getEmbeddingDimensions(): number {
  return EMBEDDING_DIMENSIONS;
}
