import { GoogleGenAI } from "@google/genai";
import pLimit from "p-limit";
import pRetry, { AbortError } from "p-retry";
import {
  buildAnalysisPrompt,
  buildChatPrompt,
  buildInsightExtractionPrompt,
  buildCanvasEditPrompt,
  buildCanvasAwareChatPrompt,
  SCREENSHOT_ANALYSIS_PROMPT,
  DATA_TABLE_ANALYSIS_PROMPT,
  EXPERT_BUSINESS_ANALYST_PERSONA,
} from "./prompts";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

const FLASH_MODEL = "gemini-2.5-flash";
const PRO_MODEL = "gemini-2.5-pro";

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
  contents: string | { role: string; parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] }[],
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

export interface ScreenshotAnalysisResult {
  platform?: string;
  metrics: Array<{
    name: string;
    value: string;
    trend?: string;
    significance?: string;
  }>;
  keyFindings: string[];
  anomalies: string[];
  recommendations: string[];
  rawText?: string;
  summary: string;
}

export async function analyzeScreenshot(
  base64Image: string,
  context?: string
): Promise<ScreenshotAnalysisResult> {
  return rateLimiter(async () => {
    const systemPrompt = buildAnalysisPrompt("screenshot", context);
    
    const contents = [
      {
        role: "user",
        parts: [
          { text: "Analyze this screenshot and extract all relevant business metrics and insights. Return your analysis in JSON format." },
          {
            inlineData: {
              mimeType: "image/png",
              data: base64Image,
            },
          },
        ],
      },
    ];

    const response = await generateWithRetry(FLASH_MODEL, contents, systemPrompt);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          platform: parsed.platform,
          metrics: parsed.metrics || [],
          keyFindings: parsed.keyFindings || [],
          anomalies: parsed.anomalies || [],
          recommendations: parsed.recommendations || [],
          rawText: parsed.rawText,
          summary: parsed.summary || response.slice(0, 500),
        };
      }
    } catch (e) {
      console.error("Failed to parse screenshot analysis JSON:", e);
    }
    
    return {
      metrics: [],
      keyFindings: [],
      anomalies: [],
      recommendations: [],
      summary: response,
    };
  });
}

export interface DataAnalysisResult {
  summary: string;
  trends: Array<{
    metric: string;
    direction: string;
    magnitude: string;
    significance: string;
  }>;
  insights: string[];
  anomalies: string[];
  recommendations: string[];
  statistics?: Record<string, number | string>;
}

export async function analyzeData(
  data: any[],
  context?: string
): Promise<DataAnalysisResult> {
  return rateLimiter(async () => {
    const systemPrompt = buildAnalysisPrompt("data", context);
    
    const dataStr = JSON.stringify(data, null, 2);
    const prompt = `Analyze this data and provide business insights. Return your analysis in JSON format with the following structure:
{
  "summary": "Overall summary of the data",
  "trends": [{"metric": "", "direction": "", "magnitude": "", "significance": ""}],
  "insights": ["insight 1", "insight 2"],
  "anomalies": ["anomaly 1"],
  "recommendations": ["recommendation 1"],
  "statistics": {}
}

DATA:
${dataStr.slice(0, 30000)}`;

    const response = await generateWithRetry(FLASH_MODEL, prompt, systemPrompt);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || "",
          trends: parsed.trends || [],
          insights: parsed.insights || [],
          anomalies: parsed.anomalies || [],
          recommendations: parsed.recommendations || [],
          statistics: parsed.statistics,
        };
      }
    } catch (e) {
      console.error("Failed to parse data analysis JSON:", e);
    }
    
    return {
      summary: response,
      trends: [],
      insights: [],
      anomalies: [],
      recommendations: [],
    };
  });
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface ChatResponse {
  response: string;
  suggestedFollowUps?: string[];
}

export async function chat(
  messages: ChatMessage[],
  context?: string,
  spaceGoals?: string,
  memoryContext?: string
): Promise<ChatResponse> {
  return rateLimiter(async () => {
    const systemPrompt = buildChatPrompt(spaceGoals, context, memoryContext);
    
    const contents = messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const useProModel = messages.length > 10 || 
      messages.some(m => m.content.length > 2000);
    
    const response = await generateWithRetry(
      useProModel ? PRO_MODEL : FLASH_MODEL,
      contents,
      systemPrompt
    );
    
    return {
      response,
      suggestedFollowUps: extractSuggestedFollowUps(response),
    };
  });
}

function extractSuggestedFollowUps(response: string): string[] {
  const followUps: string[] = [];
  
  const patterns = [
    /would you like (?:me to|to know|more details about) (.+?)\?/gi,
    /shall I (?:analyze|explain|break down) (.+?)\?/gi,
    /I can also (?:help with|analyze|look into) (.+?)\./gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(response)) !== null) {
      if (match[1] && followUps.length < 3) {
        followUps.push(match[1].trim());
      }
    }
  }
  
  return followUps;
}

export interface CanvasEditProposal {
  type: 'replace' | 'insert' | 'delete' | 'rewrite';
  targetType: 'title' | 'notes' | 'selection';
  originalText?: string;
  suggestedText: string;
  rationale: string;
}

export interface CanvasEditResponse extends ChatResponse {
  editProposals?: CanvasEditProposal[];
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

export async function chatWithCanvas(
  messages: ChatMessage[],
  canvasContext: CanvasContext,
  quickAction?: string,
  context?: string,
  spaceGoals?: string,
  memoryContext?: string
): Promise<CanvasEditResponse> {
  return rateLimiter(async () => {
    let systemPrompt: string;
    let userPrompt: string | null = null;

    if (quickAction) {
      systemPrompt = buildCanvasEditPrompt(quickAction, canvasContext);
      userPrompt = `Apply the "${quickAction}" transformation now and return the result in JSON format with editProposals.`;
    } else {
      systemPrompt = buildCanvasAwareChatPrompt(spaceGoals, context, canvasContext, memoryContext);
    }
    
    const contents = messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    if (userPrompt) {
      contents.push({
        role: "user",
        parts: [{ text: userPrompt }],
      });
    }

    const useProModel = messages.length > 10 || 
      messages.some(m => m.content.length > 2000);
    
    const response = await generateWithRetry(
      useProModel ? PRO_MODEL : FLASH_MODEL,
      contents,
      systemPrompt
    );
    
    if (quickAction) {
      try {
        // Try to extract JSON from ```json blocks first (more reliable)
        const jsonBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
        let jsonContent: string | null = null;
        
        if (jsonBlockMatch) {
          jsonContent = jsonBlockMatch[1].trim();
        } else {
          // Fall back to matching any JSON object
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonContent = jsonMatch[0];
          }
        }
        
        if (jsonContent) {
          const parsed = JSON.parse(jsonContent);
          
          // Validate the parsed structure has the expected shape
          if (parsed.editProposals && Array.isArray(parsed.editProposals)) {
            // Validate each edit proposal has required fields and sensible content
            const validProposals = parsed.editProposals.filter((proposal: any) => {
              if (!proposal.suggestedText || typeof proposal.suggestedText !== 'string') {
                return false;
              }
              // Filter out proposals where suggestedText looks like explanatory text
              const lowerText = proposal.suggestedText.toLowerCase().trim();
              const explanatoryPatterns = [
                /^here['']?s/,
                /^i['']?ve/,
                /^i have/,
                /^i can/,
                /^let me/,
                /^sure[,!]/,
                /^certainly/,
                /^of course/,
                /^i['']?ll/,
                /^this is/,
                /^the following/,
              ];
              for (const pattern of explanatoryPatterns) {
                if (pattern.test(lowerText)) {
                  console.warn("Filtered out edit proposal with explanatory text:", proposal.suggestedText.slice(0, 100));
                  return false;
                }
              }
              return true;
            });
            
            return {
              response: parsed.response || `Applied "${quickAction}" transformation to your content.`,
              editProposals: validProposals,
              suggestedFollowUps: [],
            };
          }
        }
      } catch (e) {
        console.error("Failed to parse canvas edit JSON:", e);
      }
      
      // When JSON parsing fails or structure is invalid, do NOT create an edit proposal
      // Just return the text response so the user can see what the AI said
      console.warn("Canvas edit JSON parsing failed - returning text response only without edit proposals");
      return {
        response: `I tried to process your "${quickAction}" request, but couldn't generate a proper edit. Here's my response:\n\n${response}`,
        editProposals: [], // Empty array - no garbage proposals
        suggestedFollowUps: [],
      };
    }
    
    return {
      response,
      suggestedFollowUps: extractSuggestedFollowUps(response),
    };
  });
}

export interface InsightResult {
  title: string;
  summary: string;
  category: string;
  priority: string;
  metrics?: string[];
  suggestedAction?: string;
  confidence: string;
}

export interface ExtractInsightsResult {
  insights: InsightResult[];
}

export async function extractInsights(
  content: string,
  spaceGoals?: string
): Promise<ExtractInsightsResult> {
  return rateLimiter(async () => {
    const systemPrompt = buildInsightExtractionPrompt(spaceGoals);
    
    const prompt = `Extract actionable business insights from the following content. Return as JSON:
{
  "insights": [
    {
      "title": "Brief insight title",
      "summary": "2-3 sentence explanation",
      "category": "performance|anomaly|opportunity|risk|causation|recommendation",
      "priority": "high|medium|low",
      "metrics": ["Related metrics"],
      "suggestedAction": "What to do about it",
      "confidence": "high|medium|low"
    }
  ]
}

CONTENT:
${content.slice(0, 30000)}`;

    const response = await generateWithRetry(FLASH_MODEL, prompt, systemPrompt);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          insights: parsed.insights || [],
        };
      }
    } catch (e) {
      console.error("Failed to parse insights JSON:", e);
    }
    
    return { insights: [] };
  });
}

export async function analyzeKPI(
  kpiName: string,
  currentValue: number,
  previousValue: number,
  historicalData?: number[],
  context?: string
): Promise<{
  analysis: string;
  significance: string;
  trend: string;
  recommendations: string[];
}> {
  return rateLimiter(async () => {
    const systemPrompt = buildAnalysisPrompt("kpi", context);
    
    const percentChange = ((currentValue - previousValue) / previousValue) * 100;
    
    const prompt = `Analyze this KPI performance:

KPI: ${kpiName}
Current Value: ${currentValue}
Previous Value: ${previousValue}
Change: ${percentChange.toFixed(2)}%
${historicalData ? `Historical Data: ${JSON.stringify(historicalData)}` : ""}

Provide analysis in JSON format:
{
  "analysis": "Detailed analysis of the KPI performance",
  "significance": "high|medium|low",
  "trend": "improving|declining|stable",
  "recommendations": ["recommendation 1", "recommendation 2"]
}`;

    const response = await generateWithRetry(FLASH_MODEL, prompt, systemPrompt);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse KPI analysis JSON:", e);
    }
    
    return {
      analysis: response,
      significance: "medium",
      trend: percentChange > 0 ? "improving" : percentChange < 0 ? "declining" : "stable",
      recommendations: [],
    };
  });
}

export function isGeminiConfigured(): boolean {
  return !!(
    process.env.AI_INTEGRATIONS_GEMINI_BASE_URL &&
    process.env.AI_INTEGRATIONS_GEMINI_API_KEY
  );
}
