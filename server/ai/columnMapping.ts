import { GoogleGenAI } from "@google/genai";
import pLimit from "p-limit";
import pRetry, { AbortError } from "p-retry";
import { getSystemColumnAliases } from "./templateService";
import type { SystemColumnAlias } from "../../shared/schema";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

const FLASH_MODEL = "gemini-2.5-flash";
const rateLimiter = pLimit(2);

function isRateLimitError(error: unknown): boolean {
  const errorMsg = error instanceof Error ? error.message : String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

async function generateWithRetry(
  model: string,
  contents: string,
  systemInstruction?: string
): Promise<string> {
  return pRetry(
    async () => {
      try {
        const config: any = {};
        if (systemInstruction) {
          config.systemInstruction = systemInstruction;
        }
        
        const response = await ai.models.generateContent({
          model,
          contents,
          config,
        });
        return response.text || "";
      } catch (error) {
        if (isRateLimitError(error)) {
          throw error;
        }
        throw new AbortError(error as Error);
      }
    },
    {
      retries: 5,
      minTimeout: 2000,
      maxTimeout: 60000,
      factor: 2,
    }
  );
}

export interface ColumnSchema {
  canonicalName: string;
  displayName: string;
  position: number;
  dataType: 'currency' | 'percentage' | 'integer' | 'decimal' | 'date' | 'text' | 'boolean';
  isRequired: boolean;
  validationRules?: {
    format?: string;
    min?: number;
    max?: number;
    maxLength?: number;
    pattern?: string;
    allowedValues?: string[];
  };
}

export interface ColumnMappingSuggestion {
  sourceColumn: string;
  suggestedMapping: string;
  displayName: string;
  confidence: number;
  reason: string;
  alternatives?: { name: string; displayName: string; confidence: number }[];
}

const COLUMN_MAPPING_SYSTEM_PROMPT = `You are an expert data analyst specializing in marketing and business data.
Your task is to match source column names to canonical/template column names for data standardization.

Consider:
1. Exact name matches (highest confidence)
2. Common abbreviations and aliases (e.g., "CTR" = "Click-Through Rate")
3. Marketing industry standard terminology
4. Data type inference from column names
5. Context from sample data if provided

For each source column, suggest the best matching target column with:
- A confidence score (0-100)
- A brief reason explaining the match
- Alternative matches if confidence < 90

Respond in JSON format only. No markdown, no explanations outside the JSON.`;

export async function suggestColumnMappings(
  sourceColumns: string[],
  templateColumns: ColumnSchema[],
  systemAliases?: SystemColumnAlias[],
  sampleData?: any[]
): Promise<ColumnMappingSuggestion[]> {
  return rateLimiter(async () => {
    const aliases = systemAliases || await getSystemColumnAliases();
    
    const aliasMapping: Record<string, { canonicalName: string; displayName: string; aliases: string[] }> = {};
    for (const alias of aliases) {
      aliasMapping[alias.canonicalName] = {
        canonicalName: alias.canonicalName,
        displayName: alias.displayName,
        aliases: alias.aliases as string[],
      };
    }
    
    const templateInfo = templateColumns.map(col => ({
      canonicalName: col.canonicalName,
      displayName: col.displayName,
      dataType: col.dataType,
    }));
    
    let sampleDataContext = "";
    if (sampleData && sampleData.length > 0) {
      const sampleRows = sampleData.slice(0, 3);
      sampleDataContext = `\n\nSample data (first 3 rows):\n${JSON.stringify(sampleRows, null, 2)}`;
    }
    
    const availableTargets = [
      ...templateInfo,
      ...Object.values(aliasMapping).map(a => ({
        canonicalName: a.canonicalName,
        displayName: a.displayName,
        aliases: a.aliases,
      })),
    ];
    
    const prompt = `Analyze these source columns and match them to the available target columns.

SOURCE COLUMNS:
${JSON.stringify(sourceColumns, null, 2)}

AVAILABLE TARGET COLUMNS (templates and system aliases):
${JSON.stringify(availableTargets, null, 2)}

SYSTEM ALIASES (canonical name -> common variations):
${JSON.stringify(aliasMapping, null, 2)}
${sampleDataContext}

Return a JSON object with this exact structure:
{
  "mappings": [
    {
      "sourceColumn": "original column name from source",
      "suggestedMapping": "canonicalName of best match",
      "displayName": "human readable display name",
      "confidence": 85,
      "reason": "Brief explanation of why this mapping was chosen",
      "alternatives": [
        { "name": "alternative_canonical", "displayName": "Alternative Display Name", "confidence": 60 }
      ]
    }
  ]
}

Rules:
1. Match every source column
2. Use canonicalName for suggestedMapping (snake_case preferred)
3. Confidence: 95-100 for exact/near-exact matches, 80-94 for strong semantic matches, 50-79 for weak matches, <50 for guesses
4. Include 1-3 alternatives if confidence < 90
5. If no good match exists, create a new canonical name based on the source column (confidence < 50)`;

    const response = await generateWithRetry(FLASH_MODEL, prompt, COLUMN_MAPPING_SYSTEM_PROMPT);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return (parsed.mappings || []).map((m: any) => ({
          sourceColumn: m.sourceColumn || '',
          suggestedMapping: m.suggestedMapping || '',
          displayName: m.displayName || m.suggestedMapping || '',
          confidence: typeof m.confidence === 'number' ? m.confidence : 50,
          reason: m.reason || 'No reason provided',
          alternatives: Array.isArray(m.alternatives) ? m.alternatives.map((alt: any) => ({
            name: alt.name || alt.canonicalName || '',
            displayName: alt.displayName || alt.name || '',
            confidence: typeof alt.confidence === 'number' ? alt.confidence : 30,
          })) : [],
        }));
      }
    } catch (e) {
      console.error("Failed to parse column mapping JSON:", e);
    }
    
    return sourceColumns.map(col => ({
      sourceColumn: col,
      suggestedMapping: col.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      displayName: col,
      confidence: 30,
      reason: 'AI parsing failed, using normalized column name',
      alternatives: [],
    }));
  });
}

export async function suggestMappingsForTemplate(
  sourceColumns: string[],
  templateId?: string,
  sampleData?: any[]
): Promise<{
  suggestions: ColumnMappingSuggestion[];
  hasHighConfidenceMappings: boolean;
  unmappedCount: number;
}> {
  const systemAliases = await getSystemColumnAliases();
  
  const suggestions = await suggestColumnMappings(
    sourceColumns,
    [],
    systemAliases,
    sampleData
  );
  
  const highConfidenceCount = suggestions.filter(s => s.confidence >= 80).length;
  const lowConfidenceCount = suggestions.filter(s => s.confidence < 50).length;
  
  return {
    suggestions,
    hasHighConfidenceMappings: highConfidenceCount > sourceColumns.length * 0.5,
    unmappedCount: lowConfidenceCount,
  };
}

export function isColumnMappingConfigured(): boolean {
  return !!(
    process.env.AI_INTEGRATIONS_GEMINI_BASE_URL &&
    process.env.AI_INTEGRATIONS_GEMINI_API_KEY
  );
}
