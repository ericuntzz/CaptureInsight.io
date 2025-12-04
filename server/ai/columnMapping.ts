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
  suggestedCanonicalName: string;
  suggestedDisplayName: string;
  suggestedDataType: 'currency' | 'percentage' | 'integer' | 'decimal' | 'date' | 'text' | 'boolean';
  confidence: number;
  reason: string;
  alternativeNames?: string[];
}

const COLUMN_MAPPING_SYSTEM_PROMPT = `You are an expert data analyst specializing in marketing and business data.
Your task is to analyze source columns and suggest standardized canonical names, display names, and data types.

Consider:
1. Column names - use snake_case for canonical names
2. Common abbreviations and aliases (e.g., "CTR" = "click_through_rate", "CPC" = "cost_per_click")
3. Marketing industry standard terminology
4. Data type inference from column names AND sample values
5. Context from sample data to determine the best data type

Data types to choose from:
- currency: For monetary values ($100, €50, etc.)
- percentage: For percentage values (10%, 0.1, etc.)
- integer: For whole numbers (counts, IDs)
- decimal: For decimal numbers (rates, scores)
- date: For dates and timestamps
- text: For strings and text
- boolean: For true/false values

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
    
    const prompt = `Analyze these source columns and suggest standardized mappings.

SOURCE COLUMNS:
${JSON.stringify(sourceColumns, null, 2)}

KNOWN SYSTEM ALIASES (canonical name -> common variations):
${JSON.stringify(aliasMapping, null, 2)}
${sampleDataContext}

Return a JSON object with this exact structure:
{
  "mappings": [
    {
      "sourceColumn": "original column name from source",
      "suggestedCanonicalName": "snake_case_canonical_name",
      "suggestedDisplayName": "Human Readable Display Name",
      "suggestedDataType": "text",
      "confidence": 85,
      "reason": "Brief explanation of why this mapping was chosen",
      "alternativeNames": ["alternative_name_1", "alternative_name_2"]
    }
  ]
}

Data type options: currency, percentage, integer, decimal, date, text, boolean

Rules:
1. Analyze every source column
2. Use snake_case for suggestedCanonicalName
3. Use Title Case for suggestedDisplayName
4. Infer suggestedDataType from column name AND sample data values
5. Confidence: 95-100 for exact/near-exact matches, 80-94 for strong semantic matches, 50-79 for weak matches, <50 for guesses
6. Include 1-3 alternativeNames if confidence < 90
7. If a system alias matches, use its canonical name and boost confidence`;

    const response = await generateWithRetry(FLASH_MODEL, prompt, COLUMN_MAPPING_SYSTEM_PROMPT);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return (parsed.mappings || []).map((m: any) => ({
          sourceColumn: m.sourceColumn || '',
          suggestedCanonicalName: m.suggestedCanonicalName || m.suggestedMapping || '',
          suggestedDisplayName: m.suggestedDisplayName || m.displayName || '',
          suggestedDataType: validateDataType(m.suggestedDataType),
          confidence: typeof m.confidence === 'number' ? Math.min(100, Math.max(0, m.confidence)) : 50,
          reason: m.reason || 'No reason provided',
          alternativeNames: Array.isArray(m.alternativeNames) ? m.alternativeNames.filter((n: any) => typeof n === 'string') : [],
        }));
      }
    } catch (e) {
      console.error("Failed to parse column mapping JSON:", e);
    }
    
    return sourceColumns.map(col => ({
      sourceColumn: col,
      suggestedCanonicalName: col.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      suggestedDisplayName: toTitleCase(col),
      suggestedDataType: 'text' as const,
      confidence: 30,
      reason: 'AI parsing failed, using normalized column name',
      alternativeNames: [],
    }));
  });
}

function validateDataType(type: any): 'currency' | 'percentage' | 'integer' | 'decimal' | 'date' | 'text' | 'boolean' {
  const validTypes = ['currency', 'percentage', 'integer', 'decimal', 'date', 'text', 'boolean'];
  return validTypes.includes(type) ? type : 'text';
}

function toTitleCase(str: string): string {
  return str
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
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
