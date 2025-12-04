/**
 * Template Service
 * 
 * Provides CRUD operations for data templates and intelligent template matching
 * for automated data cleaning and structuring.
 */

import { db } from "../db";
import { 
  dataTemplates, 
  templateApplications, 
  systemColumnAliases,
  sheets,
  type DataTemplate, 
  type InsertDataTemplate,
  type TemplateApplication,
  type InsertTemplateApplication,
  type SystemColumnAlias,
  type Sheet,
} from "../../shared/schema";
import { eq, and, desc, or } from "drizzle-orm";

/**
 * Result of template matching
 */
export interface TemplateMatchResult {
  template: DataTemplate;
  confidence: number;
  recommendation: 'auto-apply' | 'suggest' | 'none';
  matchDetails: {
    columnNameSimilarity: number;
    columnTypeMatch: number;
    sourceFingerprint: number;
    statisticalProfile: number;
  };
}

/**
 * Source fingerprint extracted from URL or file name
 */
export interface SourceFingerprint {
  googleSheetId?: string;
  urlPatterns: string[];
  fileNamePatterns: string[];
}

/**
 * Column schema definition from template
 */
interface ColumnSchema {
  columns: Array<{
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
  }>;
}

/**
 * Matching configuration from template
 */
interface MatchingConfig {
  autoApplyThreshold: number;
  suggestThreshold: number;
  featureWeights: {
    columnNameSimilarity: number;
    columnTypeMatch: number;
    sourceFingerprint: number;
    statisticalProfile: number;
  };
}

const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  autoApplyThreshold: 0.85,
  suggestThreshold: 0.6,
  featureWeights: {
    columnNameSimilarity: 0.4,
    columnTypeMatch: 0.25,
    sourceFingerprint: 0.2,
    statisticalProfile: 0.15,
  },
};

// ==================== CRUD OPERATIONS ====================

/**
 * Create a new data template
 * @param data - Template data to insert
 * @returns Created template
 */
export async function createTemplate(data: InsertDataTemplate): Promise<DataTemplate> {
  const [template] = await db.insert(dataTemplates).values(data).returning();
  return template;
}

/**
 * Get a template by ID
 * @param id - Template ID
 * @returns Template or undefined if not found
 */
export async function getTemplate(id: string): Promise<DataTemplate | undefined> {
  const [template] = await db.select().from(dataTemplates).where(eq(dataTemplates.id, id));
  return template;
}

/**
 * Get all templates for a workspace
 * @param workspaceId - Workspace ID
 * @returns Array of templates
 */
export async function getTemplatesByWorkspace(workspaceId: string): Promise<DataTemplate[]> {
  return await db
    .select()
    .from(dataTemplates)
    .where(eq(dataTemplates.workspaceId, workspaceId))
    .orderBy(desc(dataTemplates.usageCount), desc(dataTemplates.updatedAt));
}

/**
 * Get all templates for a space (space-level templates only)
 * @param spaceId - Space ID
 * @returns Array of templates
 */
export async function getTemplatesBySpace(spaceId: string): Promise<DataTemplate[]> {
  return await db
    .select()
    .from(dataTemplates)
    .where(
      and(
        eq(dataTemplates.spaceId, spaceId),
        eq(dataTemplates.scope, 'space')
      )
    )
    .orderBy(desc(dataTemplates.usageCount), desc(dataTemplates.updatedAt));
}

/**
 * Get all available templates for a context (workspace + space-level)
 * @param workspaceId - Workspace ID
 * @param spaceId - Space ID
 * @returns Array of templates (workspace-specific first, then space-level)
 */
export async function getAvailableTemplates(workspaceId: string, spaceId: string): Promise<DataTemplate[]> {
  return await db
    .select()
    .from(dataTemplates)
    .where(
      or(
        eq(dataTemplates.workspaceId, workspaceId),
        and(
          eq(dataTemplates.spaceId, spaceId),
          eq(dataTemplates.scope, 'space')
        )
      )
    )
    .orderBy(desc(dataTemplates.usageCount), desc(dataTemplates.updatedAt));
}

/**
 * Update a template
 * @param id - Template ID
 * @param data - Partial template data to update
 * @returns Updated template or undefined if not found
 */
export async function updateTemplate(
  id: string, 
  data: Partial<InsertDataTemplate>
): Promise<DataTemplate | undefined> {
  const [template] = await db
    .update(dataTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(dataTemplates.id, id))
    .returning();
  return template;
}

/**
 * Delete a template
 * @param id - Template ID
 * @returns True if deleted, false if not found
 */
export async function deleteTemplate(id: string): Promise<boolean> {
  const result = await db.delete(dataTemplates).where(eq(dataTemplates.id, id));
  return (result.rowCount ?? 0) > 0;
}

/**
 * Increment template usage count and update last used timestamp
 * @param id - Template ID
 * @returns Updated template or undefined if not found
 */
export async function incrementTemplateUsage(id: string): Promise<DataTemplate | undefined> {
  const template = await getTemplate(id);
  if (!template) return undefined;

  const [updated] = await db
    .update(dataTemplates)
    .set({
      usageCount: (template.usageCount || 0) + 1,
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(dataTemplates.id, id))
    .returning();
  return updated;
}

// ==================== TEMPLATE APPLICATION ====================

/**
 * Record a template application to a sheet
 * @param data - Template application data
 * @returns Created application record
 */
export async function createTemplateApplication(
  data: InsertTemplateApplication
): Promise<TemplateApplication> {
  const [application] = await db.insert(templateApplications).values(data).returning();
  await incrementTemplateUsage(data.templateId);
  return application;
}

/**
 * Get template applications for a sheet
 * @param sheetId - Sheet ID
 * @returns Array of template applications
 */
export async function getTemplateApplicationsBySheet(sheetId: string): Promise<TemplateApplication[]> {
  return await db
    .select()
    .from(templateApplications)
    .where(eq(templateApplications.sheetId, sheetId))
    .orderBy(desc(templateApplications.appliedAt));
}

// ==================== SYSTEM COLUMN ALIASES ====================

/**
 * Get all system column aliases
 * @param category - Optional category filter
 * @returns Array of system column aliases
 */
export async function getSystemColumnAliases(category?: string): Promise<SystemColumnAlias[]> {
  if (category) {
    return await db
      .select()
      .from(systemColumnAliases)
      .where(eq(systemColumnAliases.category, category));
  }
  return await db.select().from(systemColumnAliases);
}

// ==================== TEMPLATE MATCHING ====================

/**
 * Extract source fingerprint from URL or file name
 * @param url - Source URL (optional)
 * @param fileName - File name (optional)
 * @returns Extracted fingerprint
 */
export function calculateSourceFingerprint(url?: string, fileName?: string): SourceFingerprint {
  const fingerprint: SourceFingerprint = {
    urlPatterns: [],
    fileNamePatterns: [],
  };

  if (url) {
    const googleSheetMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (googleSheetMatch) {
      fingerprint.googleSheetId = googleSheetMatch[1];
    }

    try {
      const urlObj = new URL(url);
      fingerprint.urlPatterns.push(urlObj.hostname);
      
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        fingerprint.urlPatterns.push(`${urlObj.hostname}/${pathParts[0]}`);
      }
    } catch {
      fingerprint.urlPatterns.push(url.split('/')[0] || url);
    }
  }

  if (fileName) {
    fingerprint.fileNamePatterns.push(fileName.toLowerCase());
    
    const baseName = fileName.replace(/\.[^.]+$/, '').toLowerCase();
    fingerprint.fileNamePatterns.push(baseName);
    
    const datePattern = baseName.replace(/\d{4}[-_]?\d{2}[-_]?\d{2}|\d{2}[-_]?\d{2}[-_]?\d{4}/g, '*');
    if (datePattern !== baseName) {
      fingerprint.fileNamePatterns.push(datePattern);
    }
  }

  return fingerprint;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate fuzzy similarity between two strings (0-1)
 */
function fuzzyMatch(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return 1 - distance / maxLen;
}

/**
 * Normalize a column name for comparison
 */
function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Calculate column name similarity using Jaccard + fuzzy matching
 * @param sourceColumns - Column names from the source data
 * @param templateColumns - Column definitions from the template
 * @param aliases - User-defined and system aliases
 * @returns Similarity score (0-1)
 */
export function calculateColumnSimilarity(
  sourceColumns: string[],
  templateColumns: ColumnSchema['columns'],
  aliases: { [canonicalName: string]: string[] } = {}
): number {
  if (sourceColumns.length === 0 || templateColumns.length === 0) {
    return 0;
  }

  const normalizedSource = sourceColumns.map(normalizeColumnName);
  let matchedCount = 0;
  const matchScores: number[] = [];

  for (const templateCol of templateColumns) {
    const canonicalNormalized = normalizeColumnName(templateCol.canonicalName);
    const displayNormalized = normalizeColumnName(templateCol.displayName);
    const columnAliases = aliases[templateCol.canonicalName] || [];
    const normalizedAliases = columnAliases.map(normalizeColumnName);

    let bestScore = 0;

    for (const sourceCol of normalizedSource) {
      if (sourceCol === canonicalNormalized || sourceCol === displayNormalized) {
        bestScore = 1;
        break;
      }

      for (const alias of normalizedAliases) {
        if (sourceCol === alias) {
          bestScore = 1;
          break;
        }
      }

      if (bestScore < 1) {
        const fuzzyCanonical = fuzzyMatch(sourceCol, canonicalNormalized);
        const fuzzyDisplay = fuzzyMatch(sourceCol, displayNormalized);
        const fuzzyAliases = normalizedAliases.map(a => fuzzyMatch(sourceCol, a));
        const maxFuzzy = Math.max(fuzzyCanonical, fuzzyDisplay, ...fuzzyAliases);
        
        if (maxFuzzy > 0.8) {
          bestScore = Math.max(bestScore, maxFuzzy);
        }
      }
    }

    matchScores.push(bestScore);
    if (bestScore >= 0.8) matchedCount++;
  }

  const avgScore = matchScores.reduce((a, b) => a + b, 0) / matchScores.length;
  const jaccardScore = matchedCount / Math.max(sourceColumns.length, templateColumns.length);
  
  return (avgScore * 0.6) + (jaccardScore * 0.4);
}

/**
 * Calculate source fingerprint match score
 */
function calculateFingerprintScore(
  sourceFingerprint: SourceFingerprint,
  templateFingerprint: {
    googleSheetId?: string;
    urlPatterns?: string[];
    fileNamePatterns?: string[];
  } | null
): number {
  if (!templateFingerprint) return 0;

  if (sourceFingerprint.googleSheetId && templateFingerprint.googleSheetId) {
    if (sourceFingerprint.googleSheetId === templateFingerprint.googleSheetId) {
      return 1;
    }
  }

  let bestUrlScore = 0;
  if (templateFingerprint.urlPatterns) {
    for (const sourcePattern of sourceFingerprint.urlPatterns) {
      for (const templatePattern of templateFingerprint.urlPatterns) {
        if (sourcePattern === templatePattern) {
          bestUrlScore = Math.max(bestUrlScore, 0.9);
        } else if (sourcePattern.includes(templatePattern) || templatePattern.includes(sourcePattern)) {
          bestUrlScore = Math.max(bestUrlScore, 0.7);
        }
      }
    }
  }

  let bestFileScore = 0;
  if (templateFingerprint.fileNamePatterns) {
    for (const sourcePattern of sourceFingerprint.fileNamePatterns) {
      for (const templatePattern of templateFingerprint.fileNamePatterns) {
        if (sourcePattern === templatePattern) {
          bestFileScore = Math.max(bestFileScore, 0.9);
        } else {
          const fuzzyScore = fuzzyMatch(sourcePattern, templatePattern);
          if (fuzzyScore > 0.7) {
            bestFileScore = Math.max(bestFileScore, fuzzyScore * 0.8);
          }
        }
      }
    }
  }

  return Math.max(bestUrlScore, bestFileScore);
}

/**
 * Infer data type from sample values
 */
function inferDataType(values: unknown[]): string {
  const sampleValues = values.slice(0, 100).filter(v => v != null && v !== '');
  if (sampleValues.length === 0) return 'text';

  let numericCount = 0;
  let dateCount = 0;
  let booleanCount = 0;
  let currencyCount = 0;
  let percentageCount = 0;

  for (const value of sampleValues) {
    const strVal = String(value).trim();
    
    if (/^[$€£¥][\d,]+\.?\d*$/.test(strVal) || /^[\d,]+\.?\d*\s*[$€£¥]$/.test(strVal)) {
      currencyCount++;
      continue;
    }
    
    if (/^[\d.]+%$/.test(strVal)) {
      percentageCount++;
      continue;
    }

    if (!isNaN(Number(strVal.replace(/[,$]/g, '')))) {
      numericCount++;
      continue;
    }

    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(strVal) || 
        /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(strVal) ||
        !isNaN(Date.parse(strVal))) {
      dateCount++;
      continue;
    }

    if (['true', 'false', 'yes', 'no', '1', '0'].includes(strVal.toLowerCase())) {
      booleanCount++;
    }
  }

  const threshold = sampleValues.length * 0.6;
  
  if (currencyCount > threshold) return 'currency';
  if (percentageCount > threshold) return 'percentage';
  if (numericCount > threshold) {
    const hasDecimals = sampleValues.some(v => String(v).includes('.'));
    return hasDecimals ? 'decimal' : 'integer';
  }
  if (dateCount > threshold) return 'date';
  if (booleanCount > threshold) return 'boolean';
  
  return 'text';
}

/**
 * Calculate column type match score
 */
function calculateTypeMatchScore(
  sourceData: Record<string, unknown>[],
  templateColumns: ColumnSchema['columns'] | undefined | null
): number {
  if (!templateColumns || templateColumns.length === 0 || sourceData.length === 0) return 0;

  const sourceColumns = Object.keys(sourceData[0] || {});
  if (sourceColumns.length === 0) return 0;

  let matchCount = 0;

  for (const templateCol of templateColumns) {
    const normalizedTemplate = normalizeColumnName(templateCol.canonicalName);
    const displayNormalized = normalizeColumnName(templateCol.displayName);
    
    for (const sourceCol of sourceColumns) {
      const normalizedSource = normalizeColumnName(sourceCol);
      
      if (normalizedSource === normalizedTemplate || normalizedSource === displayNormalized) {
        const columnValues = sourceData.map(row => row[sourceCol]);
        const inferredType = inferDataType(columnValues);
        
        if (inferredType === templateCol.dataType) {
          matchCount++;
        } else if (
          (inferredType === 'integer' && templateCol.dataType === 'decimal') ||
          (inferredType === 'decimal' && templateCol.dataType === 'integer') ||
          (inferredType === 'decimal' && templateCol.dataType === 'currency') ||
          (inferredType === 'currency' && templateCol.dataType === 'decimal')
        ) {
          matchCount += 0.5;
        }
        break;
      }
    }
  }

  return matchCount / templateColumns.length;
}

/**
 * Score a template match against sheet data
 * @param sheetData - The sheet data to match against
 * @param template - The template to score
 * @param systemAliases - System-level column aliases
 * @returns Match result with confidence score and details
 */
export function scoreTemplateMatch(
  sheetData: {
    columns: string[];
    data: Record<string, unknown>[];
    sourceUrl?: string;
    fileName?: string;
  },
  template: DataTemplate,
  systemAliases: SystemColumnAlias[] = []
): TemplateMatchResult {
  const columnSchema = template.columnSchema as ColumnSchema | null;
  const matchingConfig = (template.matchingConfig as MatchingConfig | null) || DEFAULT_MATCHING_CONFIG;
  const templateAliases = template.columnAliases as { [key: string]: string[] } | null;
  const templateFingerprint = template.sourceFingerprint as {
    googleSheetId?: string;
    urlPatterns?: string[];
    fileNamePatterns?: string[];
  } | null;

  // Merge and deduplicate aliases (normalize to lowercase for comparison)
  const mergedAliases: { [key: string]: string[] } = {};
  
  // First, add template aliases
  if (templateAliases) {
    for (const [key, aliases] of Object.entries(templateAliases)) {
      if (!mergedAliases[key]) {
        mergedAliases[key] = [];
      }
      mergedAliases[key].push(...aliases);
    }
  }
  
  // Then, add system aliases (deduplicating)
  for (const sysAlias of systemAliases) {
    if (!mergedAliases[sysAlias.canonicalName]) {
      mergedAliases[sysAlias.canonicalName] = [];
    }
    const existingLower = new Set(mergedAliases[sysAlias.canonicalName].map(a => a.toLowerCase()));
    const sysAliases = sysAlias.aliases as string[];
    for (const alias of [...sysAliases, sysAlias.displayName]) {
      if (!existingLower.has(alias.toLowerCase())) {
        mergedAliases[sysAlias.canonicalName].push(alias);
        existingLower.add(alias.toLowerCase());
      }
    }
  }

  const sourceFingerprint = calculateSourceFingerprint(sheetData.sourceUrl, sheetData.fileName);
  const fingerprintScore = calculateFingerprintScore(sourceFingerprint, templateFingerprint);

  // Guard against null/undefined columnSchema.columns
  const templateColumns = columnSchema?.columns || [];
  
  const columnSimilarity = templateColumns.length > 0
    ? calculateColumnSimilarity(sheetData.columns, templateColumns, mergedAliases)
    : 0;

  const typeMatchScore = templateColumns.length > 0
    ? calculateTypeMatchScore(sheetData.data, templateColumns)
    : 0;

  const statisticalProfileScore = 0;

  const weights = matchingConfig.featureWeights;
  const weightedScore = 
    (columnSimilarity * weights.columnNameSimilarity) +
    (typeMatchScore * weights.columnTypeMatch) +
    (fingerprintScore * weights.sourceFingerprint) +
    (statisticalProfileScore * weights.statisticalProfile);

  const confidence = Math.round(weightedScore * 100);

  let recommendation: 'auto-apply' | 'suggest' | 'none';
  if (weightedScore >= matchingConfig.autoApplyThreshold) {
    recommendation = 'auto-apply';
  } else if (weightedScore >= matchingConfig.suggestThreshold) {
    recommendation = 'suggest';
  } else {
    recommendation = 'none';
  }

  return {
    template,
    confidence,
    recommendation,
    matchDetails: {
      columnNameSimilarity: Math.round(columnSimilarity * 100),
      columnTypeMatch: Math.round(typeMatchScore * 100),
      sourceFingerprint: Math.round(fingerprintScore * 100),
      statisticalProfile: Math.round(statisticalProfileScore * 100),
    },
  };
}

/**
 * Find the best matching template for sheet data
 * @param sheetData - The sheet data to match against
 * @param workspaceId - Workspace ID for template lookup
 * @param spaceId - Space ID for template lookup
 * @returns Best matching template result, or null if no good match found
 */
export async function findMatchingTemplate(
  sheetData: {
    columns: string[];
    data: Record<string, unknown>[];
    sourceUrl?: string;
    fileName?: string;
  },
  workspaceId: string,
  spaceId: string
): Promise<TemplateMatchResult | null> {
  const templates = await getAvailableTemplates(workspaceId, spaceId);
  
  if (templates.length === 0) {
    return null;
  }

  const systemAliases = await getSystemColumnAliases();

  const results: TemplateMatchResult[] = [];
  for (const template of templates) {
    const result = scoreTemplateMatch(sheetData, template, systemAliases);
    if (result.recommendation !== 'none') {
      results.push(result);
    }
  }

  if (results.length === 0) {
    return null;
  }

  results.sort((a, b) => b.confidence - a.confidence);

  return results[0];
}

/**
 * Apply a template to a sheet
 * @param sheetId - Sheet ID to apply template to
 * @param templateId - Template ID to apply
 * @param wasAutoApplied - Whether this was auto-applied or user-selected
 * @param columnMappings - Column mapping details
 * @returns Template application record
 */
export async function applyTemplateToSheet(
  sheetId: string,
  templateId: string,
  wasAutoApplied: boolean,
  columnMappings?: {
    [sourceColumn: string]: {
      mappedTo: string;
      confidence: number;
      wasUserConfirmed: boolean;
    };
  }
): Promise<TemplateApplication | null> {
  const template = await getTemplate(templateId);
  if (!template) return null;

  const [sheet] = await db.select().from(sheets).where(eq(sheets.id, sheetId));
  if (!sheet) return null;

  await db
    .update(sheets)
    .set({ 
      appliedTemplateId: templateId,
      lastModified: new Date(),
    })
    .where(eq(sheets.id, sheetId));

  const application = await createTemplateApplication({
    templateId,
    sheetId,
    wasAutoApplied,
    columnMappings: columnMappings || null,
    unmappedColumns: null,
  });

  return application;
}
