import { GoogleGenAI } from "@google/genai";
import { type SimilarityResult } from "./index";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export interface RerankOptions {
  instructions?: string;
  topK?: number;
  minScore?: number;
}

export interface RerankResult {
  results: SimilarityResult[];
  rerankScores: Map<string, number>;
}

export async function rerankResults(
  query: string,
  documents: SimilarityResult[],
  options?: RerankOptions
): Promise<RerankResult> {
  const { instructions, topK = 5, minScore = 0 } = options || {};

  if (documents.length === 0) {
    return { results: [], rerankScores: new Map() };
  }

  if (documents.length <= 3) {
    return { 
      results: documents, 
      rerankScores: new Map(documents.map(d => [d.id, d.score])) 
    };
  }

  try {
    const docsForRerank = documents.slice(0, 20);
    
    const docList = docsForRerank.map((doc, idx) => {
      const name = doc.metadata?.title || doc.metadata?.name || `Document ${idx + 1}`;
      const preview = doc.content?.slice(0, 500) || "";
      const createdAt = doc.metadata?.createdAt ? ` (Created: ${doc.metadata.createdAt})` : "";
      return `[${idx}] ${name}${createdAt}\n${preview}`;
    }).join("\n\n---\n\n");

    const instructionText = instructions 
      ? `\n\nAdditional instructions for ranking:\n${instructions}`
      : "";

    const prompt = `You are a relevance scoring expert. Given a user query and a list of documents, score each document's relevance from 0-10.

USER QUERY: "${query}"
${instructionText}

DOCUMENTS TO SCORE:
${docList}

Return a JSON array of scores in the same order as the documents. Each score should be 0-10 where:
- 10 = Perfectly relevant, directly answers the query
- 7-9 = Highly relevant, contains key information
- 4-6 = Moderately relevant, related but not directly answering
- 1-3 = Slightly relevant, tangentially related
- 0 = Not relevant at all

Return ONLY a JSON array of numbers, nothing else. Example: [8, 5, 9, 2, 7]`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    let responseText = "[]";
    if (response.text) {
      responseText = response.text.trim();
    } else if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
      responseText = response.candidates[0].content.parts[0].text.trim();
    }
    
    let jsonText = responseText;
    const jsonMatch = responseText.match(/\[[\d,\s.]+\]/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    const scores: number[] = JSON.parse(jsonText);

    const rerankScores = new Map<string, number>();
    const scoredDocs = docsForRerank.map((doc, idx) => {
      const score = scores[idx] ?? 0;
      rerankScores.set(doc.id, score);
      return {
        ...doc,
        score: score / 10,
      };
    });

    const filteredAndSorted = scoredDocs
      .filter(d => d.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return {
      results: filteredAndSorted,
      rerankScores,
    };
  } catch (error) {
    console.error("Reranking failed, falling back to original order:", error);
    return {
      results: documents.slice(0, topK),
      rerankScores: new Map(documents.map(d => [d.id, d.score])),
    };
  }
}

export function isRerankerConfigured(): boolean {
  return !!(process.env.AI_INTEGRATIONS_GEMINI_API_KEY && process.env.AI_INTEGRATIONS_GEMINI_BASE_URL);
}
