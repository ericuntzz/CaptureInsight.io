import { storage } from "../storage";
import {
  ETLError,
  ETLErrorCode,
  ETLStage,
  fromUnknownError,
  isRetryable,
} from "../utils/etlErrors";
import { cleanSheetData, type CleanedDataResult } from "./dataCleaning";
import { embedAndStoreSheet } from "./embeddings";
import {
  findMatchingTemplate,
  applyTemplateToSheet,
  type TemplateMatchResult,
} from "./templateService";
import { calculateQualityScore, type QualityScore } from "./dataValidation";
import { MAX_ROW_COUNT } from "./dataIngestion";
import type { IngestionJob, Sheet } from "../../shared/schema";

const MAX_ROWS = MAX_ROW_COUNT;
const AUTO_APPLY_CONFIDENCE_THRESHOLD = 85;

export interface ETLResult {
  success: boolean;
  jobId: string;
  sheetId: string;
  stagesCompleted: string[];
  error?: ETLError;
  metadata?: {
    rowCount?: number;
    columnCount?: number;
    embeddingsCreated?: number;
    templateApplied?: string;
    qualityScore?: number;
  };
}

interface Checkpoint {
  stage: string;
  data?: {
    parsedData?: any[];
    rowCount?: number;
    headers?: string[];
    [key: string]: any;
  };
  parsedRowCount?: number;
  embeddingsCreated?: number;
  templateApplied?: string;
}

type StageOrder = 
  | 'pending'
  | 'parsing_complete'
  | 'validating_complete'
  | 'template_matching_complete'
  | 'cleaning_complete'
  | 'quality_scoring_complete'
  | 'embedding_complete'
  | 'finalizing_complete';

const STAGE_ORDER: StageOrder[] = [
  'pending',
  'parsing_complete',
  'validating_complete',
  'template_matching_complete',
  'cleaning_complete',
  'quality_scoring_complete',
  'embedding_complete',
  'finalizing_complete',
];

function getStageIndex(stage: string): number {
  return STAGE_ORDER.indexOf(stage as StageOrder);
}

function shouldSkipStage(checkpoint: Checkpoint | null, requiredStage: StageOrder): boolean {
  if (!checkpoint) return false;
  const currentIndex = getStageIndex(checkpoint.stage);
  const requiredIndex = getStageIndex(requiredStage);
  return currentIndex >= requiredIndex;
}

async function saveCheckpoint(
  jobId: string,
  stage: string,
  data?: any,
  additionalFields?: Partial<Checkpoint>
): Promise<void> {
  const checkpoint: Checkpoint = {
    stage,
    data,
    ...additionalFields,
  };
  await storage.updateIngestionJob(jobId, {
    checkpoint,
    currentStage: stage,
  });
}

export async function processIngestionJob(jobId: string): Promise<ETLResult> {
  const stagesCompleted: string[] = [];
  const metadata: ETLResult['metadata'] = {};

  try {
    const job = await storage.getIngestionJob(jobId);
    if (!job) {
      throw new ETLError(
        `Job not found: ${jobId}`,
        ETLErrorCode.STORAGE_ERROR,
        ETLStage.PARSING,
        false
      );
    }

    const sheet = await storage.getSheet(job.sheetId);
    if (!sheet) {
      throw new ETLError(
        `Sheet not found: ${job.sheetId}`,
        ETLErrorCode.STORAGE_ERROR,
        ETLStage.PARSING,
        false
      );
    }

    await storage.updateIngestionJob(jobId, {
      status: 'extracting',
      startedAt: job.startedAt || new Date(),
    });

    const checkpoint = job.checkpoint as Checkpoint | null;
    let parsedData: any[] | null = null;

    if (!shouldSkipStage(checkpoint, 'parsing_complete')) {
      parsedData = await parseStage(job, sheet);
      await saveCheckpoint(jobId, 'parsing_complete', { 
        parsedData: parsedData, 
        rowCount: parsedData?.length || 0 
      });
      stagesCompleted.push('PARSING');
    } else {
      stagesCompleted.push('PARSING (skipped)');
      if (checkpoint?.data?.parsedData && Array.isArray(checkpoint.data.parsedData)) {
        parsedData = checkpoint.data.parsedData;
        console.log(`[ETLWorker] Loaded ${parsedData.length} rows from checkpoint`);
      } else {
        const currentSheet = await storage.getSheet(job.sheetId);
        if (currentSheet?.data) {
          parsedData = Array.isArray(currentSheet.data) 
            ? currentSheet.data 
            : [currentSheet.data];
          console.log(`[ETLWorker] Loaded ${parsedData.length} rows from sheet data`);
        } else {
          parsedData = [];
          console.warn(`[ETLWorker] No parsed data found in checkpoint or sheet`);
        }
      }
    }

    metadata.rowCount = parsedData?.length || 0;

    if (!shouldSkipStage(checkpoint, 'validating_complete')) {
      await validateStage(job, parsedData);
      await saveCheckpoint(jobId, 'validating_complete');
      stagesCompleted.push('VALIDATING');
    } else {
      stagesCompleted.push('VALIDATING (skipped)');
    }

    if (!shouldSkipStage(checkpoint, 'template_matching_complete')) {
      const templateResult = await templateMatchStage(job, sheet, parsedData);
      await saveCheckpoint(jobId, 'template_matching_complete', {
        templateApplied: templateResult?.template?.id,
      });
      stagesCompleted.push('TEMPLATE_MATCHING');
      if (templateResult?.template) {
        metadata.templateApplied = templateResult.template.name;
      }
    } else {
      stagesCompleted.push('TEMPLATE_MATCHING (skipped)');
      if (checkpoint?.templateApplied) {
        metadata.templateApplied = checkpoint.templateApplied;
      }
    }

    await storage.updateIngestionJob(jobId, { status: 'cleaning' });

    if (!shouldSkipStage(checkpoint, 'cleaning_complete')) {
      const cleanResult = await cleanStage(job, sheet);
      await saveCheckpoint(jobId, 'cleaning_complete', {
        cleanedData: cleanResult?.cleanedData ? true : false,
      });
      stagesCompleted.push('CLEANING');
    } else {
      stagesCompleted.push('CLEANING (skipped)');
    }

    if (!shouldSkipStage(checkpoint, 'quality_scoring_complete')) {
      const qualityScore = await qualityScoreStage(job, sheet);
      await saveCheckpoint(jobId, 'quality_scoring_complete', {
        qualityScore: qualityScore?.overall,
      });
      stagesCompleted.push('QUALITY_SCORING');
      metadata.qualityScore = qualityScore?.overall;
    } else {
      stagesCompleted.push('QUALITY_SCORING (skipped)');
    }

    await storage.updateIngestionJob(jobId, { status: 'embedding' });

    if (!shouldSkipStage(checkpoint, 'embedding_complete')) {
      const embeddingResult = await embedStage(job, sheet);
      await saveCheckpoint(jobId, 'embedding_complete', {
        embeddingsCreated: embeddingResult.chunksCreated || 0,
      });
      stagesCompleted.push('EMBEDDING');
      metadata.embeddingsCreated = embeddingResult.chunksCreated || 0;
    } else {
      stagesCompleted.push('EMBEDDING (skipped)');
      if (checkpoint?.embeddingsCreated) {
        metadata.embeddingsCreated = checkpoint.embeddingsCreated;
      }
    }

    if (!shouldSkipStage(checkpoint, 'finalizing_complete')) {
      await finalizeStage(job);
      await saveCheckpoint(jobId, 'finalizing_complete');
      stagesCompleted.push('FINALIZING');
    } else {
      stagesCompleted.push('FINALIZING (skipped)');
    }

    const updatedSheet = await storage.getSheet(job.sheetId);
    if (updatedSheet) {
      const data = updatedSheet.data as any[];
      if (Array.isArray(data) && data.length > 0) {
        metadata.columnCount = Object.keys(data[0] || {}).length;
      }
    }

    await storage.markJobCompleted(jobId);

    return {
      success: true,
      jobId,
      sheetId: job.sheetId,
      stagesCompleted,
      metadata,
    };
  } catch (error) {
    const etlError = fromUnknownError(error, getCurrentStage(stagesCompleted));
    
    console.error(`[ETLWorker] Job ${jobId} failed:`, etlError.message);
    
    if (!isRetryable(etlError)) {
      await storage.markJobFailed(jobId, etlError.message, etlError.code);
    }

    return {
      success: false,
      jobId,
      sheetId: (await storage.getIngestionJob(jobId))?.sheetId || '',
      stagesCompleted,
      error: etlError,
      metadata,
    };
  }
}

function getCurrentStage(stagesCompleted: string[]): ETLStage {
  const lastStage = stagesCompleted[stagesCompleted.length - 1];
  if (!lastStage) return ETLStage.PARSING;
  
  const stageMap: Record<string, ETLStage> = {
    'PARSING': ETLStage.PARSING,
    'VALIDATING': ETLStage.VALIDATING,
    'TEMPLATE_MATCHING': ETLStage.TEMPLATE_MATCHING,
    'CLEANING': ETLStage.CLEANING,
    'QUALITY_SCORING': ETLStage.QUALITY_SCORING,
    'EMBEDDING': ETLStage.EMBEDDING,
    'FINALIZING': ETLStage.FINALIZING,
  };
  
  const cleanStage = lastStage.replace(' (skipped)', '');
  return stageMap[cleanStage] || ETLStage.PARSING;
}

async function parseStage(job: IngestionJob, sheet: Sheet): Promise<any[]> {
  console.log(`[ETLWorker] Stage PARSING for sheet ${sheet.id}`);
  
  const rawData = sheet.data;
  
  if (!rawData) {
    throw new ETLError(
      'No data found in sheet',
      ETLErrorCode.PARSE_ERROR,
      ETLStage.PARSING,
      false,
      { sheetId: sheet.id }
    );
  }

  let parsedData: any[];
  let headers: string[] = [];
  
  if (Array.isArray(rawData)) {
    parsedData = rawData;
    if (parsedData.length > 0 && typeof parsedData[0] === 'object') {
      headers = Object.keys(parsedData[0] || {});
    }
  } else if (typeof rawData === 'object' && rawData !== null) {
    const rawObj = rawData as Record<string, any>;
    if ('headers' in rawObj && 'rows' in rawObj && Array.isArray(rawObj.rows)) {
      headers = rawObj.headers as string[];
      parsedData = rawObj.rows.map((row: string[]) => {
        const obj: Record<string, string> = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || '';
        });
        return obj;
      });
    } else {
      parsedData = [rawObj];
      headers = Object.keys(rawObj);
    }
  } else if (typeof rawData === 'string') {
    try {
      parsedData = JSON.parse(rawData);
      if (!Array.isArray(parsedData)) {
        parsedData = [parsedData];
      }
      if (parsedData.length > 0 && typeof parsedData[0] === 'object') {
        headers = Object.keys(parsedData[0] || {});
      }
    } catch {
      throw new ETLError(
        'Failed to parse raw data as JSON',
        ETLErrorCode.PARSE_ERROR,
        ETLStage.PARSING,
        false,
        { rawDataType: typeof rawData }
      );
    }
  } else {
    throw new ETLError(
      `Unsupported data type: ${typeof rawData}`,
      ETLErrorCode.PARSE_ERROR,
      ETLStage.PARSING,
      false
    );
  }

  if (parsedData.length > MAX_ROWS) {
    throw new ETLError(
      `Row count (${parsedData.length}) exceeds maximum limit of ${MAX_ROWS}`,
      ETLErrorCode.SIZE_LIMIT_EXCEEDED,
      ETLStage.PARSING,
      false,
      { rowCount: parsedData.length, maxRows: MAX_ROWS }
    );
  }

  await storage.updateSheet(sheet.id, {
    data: parsedData,
    rowCount: parsedData.length,
  });

  await storage.updateIngestionJob(job.id, {
    metadata: {
      ...job.metadata,
      rowCount: parsedData.length,
      columnCount: headers.length,
    },
  });

  return parsedData;
}

async function validateStage(job: IngestionJob, data: any[] | null): Promise<void> {
  console.log(`[ETLWorker] Stage VALIDATING for job ${job.id}`);
  
  if (!data || !Array.isArray(data)) {
    throw new ETLError(
      'Invalid data structure: expected array',
      ETLErrorCode.VALIDATION_ERROR,
      ETLStage.VALIDATING,
      false,
      { dataType: typeof data }
    );
  }

  if (data.length === 0) {
    throw new ETLError(
      'No rows found in data',
      ETLErrorCode.VALIDATION_ERROR,
      ETLStage.VALIDATING,
      false
    );
  }

  if (data.length > MAX_ROWS) {
    throw new ETLError(
      `Row count (${data.length}) exceeds maximum limit of ${MAX_ROWS}`,
      ETLErrorCode.SIZE_LIMIT_EXCEEDED,
      ETLStage.VALIDATING,
      false,
      { rowCount: data.length, maxRows: MAX_ROWS }
    );
  }

  const firstRow = data[0];
  if (typeof firstRow !== 'object' || firstRow === null) {
    throw new ETLError(
      'Invalid row structure: expected object',
      ETLErrorCode.VALIDATION_ERROR,
      ETLStage.VALIDATING,
      false,
      { firstRowType: typeof firstRow }
    );
  }
}

async function templateMatchStage(
  job: IngestionJob,
  sheet: Sheet,
  data: any[] | null
): Promise<TemplateMatchResult | null> {
  console.log(`[ETLWorker] Stage TEMPLATE_MATCHING for sheet ${sheet.id}`);
  
  if (!sheet.workspaceId || !sheet.spaceId) {
    console.log(`[ETLWorker] Skipping template matching: missing workspaceId or spaceId`);
    return null;
  }

  if (!data || data.length === 0) {
    console.log(`[ETLWorker] Skipping template matching: no data`);
    return null;
  }

  const columns = Object.keys(data[0] || {});
  if (columns.length === 0) {
    console.log(`[ETLWorker] Skipping template matching: no columns`);
    return null;
  }

  try {
    const meta = sheet.dataSourceMeta as Record<string, any> | null;
    const templateMatch = await findMatchingTemplate(
      {
        columns,
        data: data as Record<string, unknown>[],
        sourceUrl: meta?.sourceUrl || meta?.url,
        fileName: meta?.fileName,
      },
      sheet.workspaceId,
      sheet.spaceId
    );

    if (!templateMatch) {
      console.log(`[ETLWorker] No matching template found`);
      return null;
    }

    console.log(`[ETLWorker] Template match found: ${templateMatch.template.name} (confidence: ${templateMatch.confidence}%)`);

    if (templateMatch.confidence >= AUTO_APPLY_CONFIDENCE_THRESHOLD) {
      console.log(`[ETLWorker] Auto-applying template: ${templateMatch.template.name}`);
      
      await applyTemplateToSheet(sheet.id, templateMatch.template.id, true);
      
      await storage.updateSheet(sheet.id, {
        processingProgress: {
          currentStep: 'matching_templates',
          stepDetails: `Template applied: ${templateMatch.template.name}`,
          percentComplete: 30,
          templateMatch: {
            templateId: templateMatch.template.id,
            templateName: templateMatch.template.name,
            confidence: templateMatch.confidence,
            wasAutoApplied: true,
          },
        },
      } as any);
    }

    return templateMatch;
  } catch (error) {
    console.warn(`[ETLWorker] Template matching failed:`, error);
    throw new ETLError(
      `Template matching failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ETLErrorCode.TEMPLATE_ERROR,
      ETLStage.TEMPLATE_MATCHING,
      false,
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

async function cleanStage(job: IngestionJob, sheet: Sheet): Promise<CleanedDataResult> {
  console.log(`[ETLWorker] Stage CLEANING for sheet ${sheet.id}`);
  
  try {
    await storage.updateSheet(sheet.id, {
      cleaningStatus: 'processing',
      processingProgress: {
        currentStep: 'cleaning',
        stepDetails: 'AI cleaning in progress...',
        percentComplete: 40,
      },
    } as any);

    const result = await cleanSheetData(sheet.id);
    
    if (!result.success) {
      throw new ETLError(
        result.error || 'AI cleaning failed',
        ETLErrorCode.AI_ERROR,
        ETLStage.CLEANING,
        false,
        { failureType: result.failureType }
      );
    }

    return result;
  } catch (error) {
    if (error instanceof ETLError) {
      throw error;
    }
    throw new ETLError(
      `Cleaning failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ETLErrorCode.AI_ERROR,
      ETLStage.CLEANING,
      error instanceof Error && error.message.includes('rate limit'),
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

async function qualityScoreStage(job: IngestionJob, sheet: Sheet): Promise<QualityScore | null> {
  console.log(`[ETLWorker] Stage QUALITY_SCORING for sheet ${sheet.id}`);
  
  const updatedSheet = await storage.getSheet(sheet.id);
  if (!updatedSheet) {
    throw new ETLError(
      'Sheet not found after cleaning',
      ETLErrorCode.STORAGE_ERROR,
      ETLStage.QUALITY_SCORING,
      false
    );
  }

  const cleanedData = updatedSheet.cleanedData as {
    type: string;
    data: any[];
    title?: string;
    description?: string;
    metadata?: any;
  } | null;

  if (!cleanedData || !cleanedData.data) {
    console.log(`[ETLWorker] No cleaned data found for quality scoring`);
    return null;
  }

  const qualityScore = calculateQualityScore(cleanedData);
  
  await storage.updateSheet(sheet.id, {
    qualityScore: qualityScore.overall,
    qualityDetails: {
      confidence: qualityScore.confidence,
      completeness: qualityScore.completeness,
      dataRichness: qualityScore.dataRichness,
      issues: qualityScore.issues,
    },
    processingProgress: {
      currentStep: 'validating',
      stepDetails: `Quality score: ${qualityScore.overall}%`,
      percentComplete: 70,
    },
  } as any);

  return qualityScore;
}

async function embedStage(
  job: IngestionJob,
  sheet: Sheet
): Promise<{ success: boolean; chunksCreated?: number; error?: string }> {
  console.log(`[ETLWorker] Stage EMBEDDING for sheet ${sheet.id}`);
  
  try {
    const updatedSheet = await storage.getSheet(job.sheetId);
    if (!updatedSheet) {
      throw new ETLError(
        'Sheet not found for embedding',
        ETLErrorCode.STORAGE_ERROR,
        ETLStage.EMBEDDING,
        false
      );
    }

    await storage.updateSheet(sheet.id, {
      processingProgress: {
        currentStep: 'finalizing',
        stepDetails: 'Generating embeddings...',
        percentComplete: 80,
      },
    } as any);

    const result = await embedAndStoreSheet(
      updatedSheet,
      updatedSheet.spaceId,
      updatedSheet.workspaceId || undefined
    );

    if (!result.success) {
      throw new ETLError(
        result.error || 'Embedding generation failed',
        ETLErrorCode.EMBEDDING_ERROR,
        ETLStage.EMBEDDING,
        false
      );
    }

    return result;
  } catch (error) {
    if (error instanceof ETLError) {
      throw error;
    }
    throw new ETLError(
      `Embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ETLErrorCode.EMBEDDING_ERROR,
      ETLStage.EMBEDDING,
      error instanceof Error && error.message.includes('rate limit'),
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

async function finalizeStage(job: IngestionJob): Promise<void> {
  console.log(`[ETLWorker] Stage FINALIZING for job ${job.id}`);
  
  await storage.updateSheet(job.sheetId, {
    cleaningStatus: 'completed',
    processingProgress: {
      currentStep: 'complete',
      stepDetails: 'Processing complete',
      percentComplete: 100,
    },
  } as any);

  await storage.updateIngestionJob(job.id, {
    currentStage: 'finalizing_complete',
  });
}
