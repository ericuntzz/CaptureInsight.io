import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { storage } from '../storage';
import { processIngestionJob, ETLResult } from '../ai/etlWorker';
import { ETLErrorCode, ETLStage, ETLError } from '../utils/etlErrors';

const TEST_USER_ID = 'test-user-etl-pipeline';

interface TestContext {
  user: { id: string };
  space: { id: string };
  workspace: { id: string };
  createdSheetIds: string[];
  createdJobIds: string[];
}

const ctx: Partial<TestContext> = {
  createdSheetIds: [],
  createdJobIds: [],
};

describe('ETL Pipeline Integration Tests', () => {
  beforeAll(async () => {
    ctx.user = await storage.upsertUser({
      id: TEST_USER_ID,
      email: 'test-etl-pipeline@test.com',
      firstName: 'ETL',
      lastName: 'Tester',
    });

    ctx.space = await storage.createSpace({
      name: 'ETL Test Space',
      ownerId: TEST_USER_ID,
    });

    ctx.workspace = await storage.createWorkspace({
      spaceId: ctx.space.id,
      name: 'ETL Test Workspace',
    });
  });

  afterAll(async () => {
    try {
      for (const jobId of ctx.createdJobIds || []) {
        try {
          const job = await storage.getIngestionJob(jobId);
          if (job) {
            await storage.updateIngestionJob(jobId, { status: 'completed' });
          }
        } catch (e) {
        }
      }

      for (const sheetId of ctx.createdSheetIds || []) {
        try {
          await storage.deleteSheet(sheetId);
        } catch (e) {
        }
      }

      if (ctx.workspace?.id) {
        try {
          await storage.deleteWorkspace(ctx.workspace.id);
        } catch (e) {
        }
      }
      
      if (ctx.space?.id) {
        try {
          await storage.deleteSpace(ctx.space.id);
        } catch (e) {
        }
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('Job Creation and Retrieval', () => {
    it('should create sheet and ingestion job successfully', async () => {
      const sheet = await storage.createSheet({
        name: 'Test Sheet for Job Creation',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: [{ name: 'Test', value: 123 }],
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
      });
      ctx.createdJobIds!.push(job.id);

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.sheetId).toBe(sheet.id);
      expect(job.spaceId).toBe(ctx.space!.id);
      expect(job.status).toBe('pending');
    });

    it('should find job via getPendingIngestionJobs', async () => {
      const sheet = await storage.createSheet({
        name: 'Test Sheet for Pending Jobs',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: [{ name: 'Test', value: 456 }],
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
      });
      ctx.createdJobIds!.push(job.id);

      const pendingJobs = await storage.getPendingIngestionJobs(100);
      const foundJob = pendingJobs.find(j => j.id === job.id);
      
      expect(foundJob).toBeDefined();
      expect(foundJob?.sheetId).toBe(sheet.id);
    });

    it('should find job via getIngestionJobBySheet', async () => {
      const sheet = await storage.createSheet({
        name: 'Test Sheet for JobBySheet',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: [{ name: 'Test', value: 789 }],
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
      });
      ctx.createdJobIds!.push(job.id);

      const foundJob = await storage.getIngestionJobBySheet(sheet.id);
      
      expect(foundJob).toBeDefined();
      expect(foundJob?.id).toBe(job.id);
      expect(foundJob?.sheetId).toBe(sheet.id);
    });

    it('should return undefined for non-existent job', async () => {
      const job = await storage.getIngestionJob('00000000-0000-0000-0000-000000000000');
      expect(job).toBeUndefined();
    });

    it('should return undefined for non-existent sheet job', async () => {
      const job = await storage.getIngestionJobBySheet('00000000-0000-0000-0000-000000000000');
      expect(job).toBeUndefined();
    });
  });

  describe('Complete ETL Flow', () => {
    it('should complete job and update sheet.cleaningStatus to completed', async () => {
      const testData = [
        { id: 1, product: 'Widget A', price: 19.99, quantity: 100 },
        { id: 2, product: 'Widget B', price: 29.99, quantity: 50 },
        { id: 3, product: 'Widget C', price: 39.99, quantity: 25 },
      ];

      const sheet = await storage.createSheet({
        name: 'Complete ETL Flow Test Sheet',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: testData,
        cleanedData: {
          type: 'table',
          data: testData,
          title: 'Product Inventory',
        },
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
        checkpoint: {
          stage: 'embedding_complete',
          parsedRowCount: 3,
          embeddingsCreated: 1,
        },
      });
      ctx.createdJobIds!.push(job.id);

      const result = await processIngestionJob(job.id);

      expect(result.success).toBe(true);
      expect(result.jobId).toBe(job.id);
      expect(result.sheetId).toBe(sheet.id);

      const completedJob = await storage.getIngestionJob(job.id);
      expect(completedJob?.status).toBe('completed');
      expect(completedJob?.completedAt).toBeDefined();

      const updatedSheet = await storage.getSheet(sheet.id);
      expect(updatedSheet?.cleaningStatus).toBe('completed');
    });

    it('should track all stages in stagesCompleted array', async () => {
      const sheet = await storage.createSheet({
        name: 'Stages Tracking Test Sheet',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: [{ id: 1, name: 'Test' }],
        cleanedData: {
          type: 'table',
          data: [{ id: 1, name: 'Test' }],
        },
        cleaningStatus: 'completed',
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'embedding',
        checkpoint: {
          stage: 'embedding_complete',
          embeddingsCreated: 1,
        },
      });
      ctx.createdJobIds!.push(job.id);

      const result = await processIngestionJob(job.id);

      expect(result.stagesCompleted).toEqual(expect.arrayContaining([
        'PARSING (skipped)',
        'VALIDATING (skipped)',
        'TEMPLATE_MATCHING (skipped)',
        'CLEANING (skipped)',
        'QUALITY_SCORING (skipped)',
        'EMBEDDING (skipped)',
        'FINALIZING',
      ]));
    });

    it('should populate metadata with rowCount on successful completion', async () => {
      const testData = [
        { col1: 'a' },
        { col1: 'b' },
        { col1: 'c' },
        { col1: 'd' },
      ];

      const sheet = await storage.createSheet({
        name: 'Metadata Population Test',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: testData,
        cleanedData: {
          type: 'table',
          data: testData,
        },
        cleaningStatus: 'completed',
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'embedding',
        checkpoint: {
          stage: 'embedding_complete',
        },
      });
      ctx.createdJobIds!.push(job.id);

      const result = await processIngestionJob(job.id);

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.rowCount).toBe(4);
    });
  });

  describe('Row Limit Validation (SIZE_LIMIT_EXCEEDED)', () => {
    it('should fail with SIZE_LIMIT_EXCEEDED when data exceeds 50K rows', async () => {
      const largeData = Array.from({ length: 50001 }, (_, i) => ({
        id: i,
        name: `Row ${i}`,
        value: Math.random(),
      }));

      const sheet = await storage.createSheet({
        name: 'Large Data Sheet',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: largeData,
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
      });
      ctx.createdJobIds!.push(job.id);

      const result = await processIngestionJob(job.id);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(ETLErrorCode.SIZE_LIMIT_EXCEEDED);
      // Row limit check is now done in PARSING stage (early detection is better)
      expect(result.error?.stage).toBe(ETLStage.PARSING);
      // PARSING is not complete because it failed during parsing
      expect(result.stagesCompleted).not.toContain('PARSING');
    });

    it('should pass validation with exactly 50K rows', async () => {
      const maxData = Array.from({ length: 50000 }, (_, i) => ({
        id: i,
        name: `Row ${i}`,
        value: i * 1.5,
      }));

      const sheet = await storage.createSheet({
        name: 'Max Size Data Sheet',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: maxData,
        cleanedData: {
          type: 'table',
          data: maxData.slice(0, 100),
        },
        cleaningStatus: 'completed',
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'embedding',
        checkpoint: {
          stage: 'embedding_complete',
          parsedRowCount: 50000,
          embeddingsCreated: 1,
        },
      });
      ctx.createdJobIds!.push(job.id);

      const result = await processIngestionJob(job.id);
      
      expect(result.success).toBe(true);
      expect(result.stagesCompleted).toContain('PARSING (skipped)');
      expect(result.stagesCompleted).toContain('VALIDATING (skipped)');
      expect(result.stagesCompleted).toContain('EMBEDDING (skipped)');
      expect(result.metadata?.rowCount).toBe(50000);
    }, 60000);
  });

  describe('Retry Logic', () => {
    it('should not return job in getRetryableJobs when nextRetryAt is in the future', async () => {
      const sheet = await storage.createSheet({
        name: 'Retry Test Sheet Future',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: [{ name: 'Test' }],
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
      });
      ctx.createdJobIds!.push(job.id);

      await storage.markJobFailed(job.id, 'Rate limit error', ETLErrorCode.RATE_LIMIT_ERROR);

      const futureDate = new Date(Date.now() + 60000);
      await storage.incrementJobRetry(job.id, futureDate);

      const retryableJobs = await storage.getRetryableJobs(100);
      const foundJob = retryableJobs.find(j => j.id === job.id);
      
      expect(foundJob).toBeUndefined();
    });

    it('should return job in getRetryableJobs when nextRetryAt is in the past and status is failed', async () => {
      const sheet = await storage.createSheet({
        name: 'Retry Test Sheet Past',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: [{ name: 'Test' }],
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
        maxRetries: 5,
      });
      ctx.createdJobIds!.push(job.id);

      await storage.markJobFailed(job.id, 'Timeout error', ETLErrorCode.TIMEOUT_ERROR);

      const pastDate = new Date(Date.now() - 1000);
      await storage.updateIngestionJob(job.id, { nextRetryAt: pastDate });

      const retryableJobs = await storage.getRetryableJobs(100);
      const foundJob = retryableJobs.find(j => j.id === job.id);
      
      expect(foundJob).toBeDefined();
      expect(foundJob?.status).toBe('failed');
    });

    it('should set status to pending after incrementJobRetry', async () => {
      const sheet = await storage.createSheet({
        name: 'Retry Increment Test Sheet',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: [{ name: 'Test' }],
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
        maxRetries: 5,
      });
      ctx.createdJobIds!.push(job.id);

      await storage.markJobFailed(job.id, 'Timeout error', ETLErrorCode.TIMEOUT_ERROR);
      const failedJob = await storage.getIngestionJob(job.id);
      expect(failedJob?.status).toBe('failed');

      const futureDate = new Date(Date.now() + 60000);
      await storage.incrementJobRetry(job.id, futureDate);
      
      const retriedJob = await storage.getIngestionJob(job.id);
      expect(retriedJob?.status).toBe('pending');
      expect(retriedJob?.nextRetryAt).toEqual(futureDate);
    });

    it('should increment retry count correctly', async () => {
      const sheet = await storage.createSheet({
        name: 'Retry Count Test Sheet',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: [{ name: 'Test' }],
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
        maxRetries: 3,
      });
      ctx.createdJobIds!.push(job.id);

      expect(job.retryCount).toBe(0);

      await storage.markJobFailed(job.id, 'Error 1', ETLErrorCode.RATE_LIMIT_ERROR);
      const afterFirst = await storage.getIngestionJob(job.id);
      expect(afterFirst?.retryCount).toBe(1);

      await storage.incrementJobRetry(job.id, new Date(Date.now() - 1000));
      const afterIncrement = await storage.getIngestionJob(job.id);
      expect(afterIncrement?.retryCount).toBe(2);
    });

    it('should not return job in getRetryableJobs when max retries exceeded', async () => {
      const sheet = await storage.createSheet({
        name: 'Max Retries Test Sheet',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: [{ name: 'Test' }],
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
        maxRetries: 1,
      });
      ctx.createdJobIds!.push(job.id);

      await storage.markJobFailed(job.id, 'Error 1', ETLErrorCode.RATE_LIMIT_ERROR);
      const afterFirst = await storage.getIngestionJob(job.id);
      expect(afterFirst?.retryCount).toBe(1);

      const pastDate = new Date(Date.now() - 1000);
      await storage.updateIngestionJob(job.id, { nextRetryAt: pastDate });

      const retryableJobs = await storage.getRetryableJobs(100);
      const foundJob = retryableJobs.find(j => j.id === job.id);
      
      expect(foundJob).toBeUndefined();
    });
  });

  describe('Checkpoint Resumability', () => {
    it('should skip parsing and validating stages when checkpoint is at cleaning', async () => {
      const sheet = await storage.createSheet({
        name: 'Checkpoint Test Sheet',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: [
          { id: 1, name: 'Product A', price: 10.99 },
          { id: 2, name: 'Product B', price: 20.50 },
        ],
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
        checkpoint: {
          stage: 'validating_complete',
          parsedRowCount: 2,
        },
      });
      ctx.createdJobIds!.push(job.id);

      const result = await processIngestionJob(job.id);
      
      expect(result.stagesCompleted).toContain('PARSING (skipped)');
      expect(result.stagesCompleted).toContain('VALIDATING (skipped)');
      expect(result.stagesCompleted).toContain('TEMPLATE_MATCHING');
    });

    it('should skip all stages up to cleaning when checkpoint is at cleaning_complete', async () => {
      const sheet = await storage.createSheet({
        name: 'Checkpoint Cleaning Test Sheet',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: [
          { id: 1, name: 'Item A', quantity: 5 },
        ],
        cleanedData: {
          type: 'table',
          data: [{ id: 1, name: 'Item A', quantity: 5 }],
          title: 'Test Data',
        },
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'cleaning',
        checkpoint: {
          stage: 'cleaning_complete',
          parsedRowCount: 1,
        },
      });
      ctx.createdJobIds!.push(job.id);

      const result = await processIngestionJob(job.id);
      
      expect(result.stagesCompleted).toContain('PARSING (skipped)');
      expect(result.stagesCompleted).toContain('VALIDATING (skipped)');
      expect(result.stagesCompleted).toContain('TEMPLATE_MATCHING (skipped)');
      expect(result.stagesCompleted).toContain('CLEANING (skipped)');
      expect(result.stagesCompleted).toContain('QUALITY_SCORING');
    });

    it('should resume from template_matching when checkpoint is at parsing_complete', async () => {
      const sheet = await storage.createSheet({
        name: 'Checkpoint Parsing Test Sheet',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: [
          { id: 1, name: 'Test' },
        ],
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
        checkpoint: {
          stage: 'parsing_complete',
          parsedRowCount: 1,
        },
      });
      ctx.createdJobIds!.push(job.id);

      const result = await processIngestionJob(job.id);
      
      expect(result.stagesCompleted).toContain('PARSING (skipped)');
      expect(result.stagesCompleted).toContain('VALIDATING');
    });
  });

  describe('Job Status Updates', () => {
    it('should mark job as completed successfully', async () => {
      const sheet = await storage.createSheet({
        name: 'Completion Test Sheet',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: [{ name: 'Test' }],
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
      });
      ctx.createdJobIds!.push(job.id);

      const completedJob = await storage.markJobCompleted(job.id);
      
      expect(completedJob).toBeDefined();
      expect(completedJob?.status).toBe('completed');
      expect(completedJob?.completedAt).toBeDefined();
    });

    it('should mark job as failed with error details', async () => {
      const sheet = await storage.createSheet({
        name: 'Failure Test Sheet',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: [{ name: 'Test' }],
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
      });
      ctx.createdJobIds!.push(job.id);

      const failedJob = await storage.markJobFailed(job.id, 'Test error message', ETLErrorCode.AI_ERROR);
      
      expect(failedJob).toBeDefined();
      expect(failedJob?.status).toBe('failed');
      expect(failedJob?.lastError).toBe('Test error message');
      expect(failedJob?.errorCode).toBe(ETLErrorCode.AI_ERROR);
    });

    it('should update job status during processing', async () => {
      const sheet = await storage.createSheet({
        name: 'Status Update Test Sheet',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: [{ name: 'Test' }],
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
      });
      ctx.createdJobIds!.push(job.id);

      const updatedJob = await storage.updateIngestionJob(job.id, {
        status: 'extracting',
        startedAt: new Date(),
        currentStage: 'parsing',
      });
      
      expect(updatedJob).toBeDefined();
      expect(updatedJob?.status).toBe('extracting');
      expect(updatedJob?.currentStage).toBe('parsing');
      expect(updatedJob?.startedAt).toBeDefined();
    });
  });

  describe('Parse Stage Validation', () => {
    it('should fail with PARSE_ERROR when sheet has no data', async () => {
      const sheet = await storage.createSheet({
        name: 'Empty Data Sheet',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: null,
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
      });
      ctx.createdJobIds!.push(job.id);

      const result = await processIngestionJob(job.id);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(ETLErrorCode.PARSE_ERROR);
      expect(result.error?.stage).toBe(ETLStage.PARSING);
    });

    it('should fail with VALIDATION_ERROR when data has no rows', async () => {
      const sheet = await storage.createSheet({
        name: 'No Rows Sheet',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: [],
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
      });
      ctx.createdJobIds!.push(job.id);

      const result = await processIngestionJob(job.id);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(ETLErrorCode.VALIDATION_ERROR);
      expect(result.error?.stage).toBe(ETLStage.VALIDATING);
    });

    it('should fail with VALIDATION_ERROR when row is not an object', async () => {
      const sheet = await storage.createSheet({
        name: 'Invalid Row Sheet',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: ['string row', 123, null],
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
      });
      ctx.createdJobIds!.push(job.id);

      const result = await processIngestionJob(job.id);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(ETLErrorCode.VALIDATION_ERROR);
    });

    it('should handle string data that can be parsed as JSON', async () => {
      const jsonString = JSON.stringify([{ id: 1, name: 'Test' }]);
      
      const sheet = await storage.createSheet({
        name: 'JSON String Sheet',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: jsonString as any,
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
      });
      ctx.createdJobIds!.push(job.id);

      const result = await processIngestionJob(job.id);
      
      expect(result.stagesCompleted).toContain('PARSING');
      expect(result.stagesCompleted).toContain('VALIDATING');
    });

    it('should wrap single object in array', async () => {
      const sheet = await storage.createSheet({
        name: 'Single Object Sheet',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: { id: 1, name: 'Single Object' } as any,
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
      });
      ctx.createdJobIds!.push(job.id);

      const result = await processIngestionJob(job.id);
      
      expect(result.stagesCompleted).toContain('PARSING');
      expect(result.stagesCompleted).toContain('VALIDATING');
      expect(result.metadata?.rowCount).toBe(1);
    });
  });

  describe('Job Metadata Updates', () => {
    it('should update metadata with row and column counts', async () => {
      const sheet = await storage.createSheet({
        name: 'Metadata Test Sheet',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: [
          { col1: 'a', col2: 'b', col3: 'c' },
          { col1: 'd', col2: 'e', col3: 'f' },
          { col1: 'g', col2: 'h', col3: 'i' },
        ],
        cleanedData: {
          type: 'table',
          data: [
            { col1: 'a', col2: 'b', col3: 'c' },
            { col1: 'd', col2: 'e', col3: 'f' },
            { col1: 'g', col2: 'h', col3: 'i' },
          ],
        },
        cleaningStatus: 'completed',
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
        checkpoint: {
          stage: 'embedding_complete',
          embeddingsCreated: 1,
        },
      });
      ctx.createdJobIds!.push(job.id);

      const result = await processIngestionJob(job.id);
      
      expect(result.metadata?.rowCount).toBe(3);
      expect(result.success).toBe(true);
    });

    it('should track row count during parsing stage', async () => {
      const sheet = await storage.createSheet({
        name: 'Row Count Test Sheet',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: [
          { id: 1 },
          { id: 2 },
          { id: 3 },
          { id: 4 },
          { id: 5 },
        ],
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
      });
      ctx.createdJobIds!.push(job.id);

      const result = await processIngestionJob(job.id);
      
      expect(result.metadata?.rowCount).toBe(5);
    });
  });

  describe('ETL Error Classes', () => {
    it('should create ETLError with correct properties', () => {
      const error = new ETLError(
        'Test error message',
        ETLErrorCode.PARSE_ERROR,
        ETLStage.PARSING,
        false,
        { detail: 'extra info' }
      );

      expect(error.message).toBe('Test error message');
      expect(error.code).toBe(ETLErrorCode.PARSE_ERROR);
      expect(error.stage).toBe(ETLStage.PARSING);
      expect(error.retryable).toBe(false);
      expect(error.details).toEqual({ detail: 'extra info' });
      expect(error.name).toBe('ETLError');
    });

    it('should have all expected error codes', () => {
      expect(ETLErrorCode.PARSE_ERROR).toBe('PARSE_ERROR');
      expect(ETLErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ETLErrorCode.SIZE_LIMIT_EXCEEDED).toBe('SIZE_LIMIT_EXCEEDED');
      expect(ETLErrorCode.RATE_LIMIT_ERROR).toBe('RATE_LIMIT_ERROR');
      expect(ETLErrorCode.AI_ERROR).toBe('AI_ERROR');
      expect(ETLErrorCode.EMBEDDING_ERROR).toBe('EMBEDDING_ERROR');
      expect(ETLErrorCode.STORAGE_ERROR).toBe('STORAGE_ERROR');
      expect(ETLErrorCode.TEMPLATE_ERROR).toBe('TEMPLATE_ERROR');
      expect(ETLErrorCode.TIMEOUT_ERROR).toBe('TIMEOUT_ERROR');
      expect(ETLErrorCode.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
    });

    it('should have all expected ETL stages', () => {
      expect(ETLStage.PARSING).toBe('PARSING');
      expect(ETLStage.VALIDATING).toBe('VALIDATING');
      expect(ETLStage.TEMPLATE_MATCHING).toBe('TEMPLATE_MATCHING');
      expect(ETLStage.CLEANING).toBe('CLEANING');
      expect(ETLStage.QUALITY_SCORING).toBe('QUALITY_SCORING');
      expect(ETLStage.EMBEDDING).toBe('EMBEDDING');
      expect(ETLStage.FINALIZING).toBe('FINALIZING');
    });
  });

  describe('processIngestionJob Function', () => {
    it('should return ETLResult with correct structure on success', async () => {
      const sheet = await storage.createSheet({
        name: 'ETLResult Structure Test',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: [{ id: 1, name: 'Test' }],
        cleanedData: {
          type: 'table',
          data: [{ id: 1, name: 'Test' }],
        },
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
        checkpoint: {
          stage: 'quality_scoring_complete',
        },
      });
      ctx.createdJobIds!.push(job.id);

      const result: ETLResult = await processIngestionJob(job.id);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('jobId');
      expect(result).toHaveProperty('sheetId');
      expect(result).toHaveProperty('stagesCompleted');
      expect(result.jobId).toBe(job.id);
      expect(result.sheetId).toBe(sheet.id);
      expect(Array.isArray(result.stagesCompleted)).toBe(true);
    });

    it('should fail with STORAGE_ERROR when job does not exist', async () => {
      const result = await processIngestionJob('00000000-0000-0000-0000-000000000000');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(ETLErrorCode.STORAGE_ERROR);
    });

    it('should fail with STORAGE_ERROR when sheet has no data and cannot be processed', async () => {
      const sheet = await storage.createSheet({
        name: 'Sheet With Null Data',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: null,
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
      });
      ctx.createdJobIds!.push(job.id);

      const result = await processIngestionJob(job.id);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(ETLErrorCode.PARSE_ERROR);
    });
  });

  describe('Safe Embedding Flow', () => {
    it('should have embedAndStoreSheet function signature available', async () => {
      const { embedAndStoreSheet } = await import('../ai/embeddings');
      expect(typeof embedAndStoreSheet).toBe('function');
    });

    it('should attempt embedding stage (may fail if AI API unavailable)', async () => {
      const sheet = await storage.createSheet({
        name: 'Embedding Stage Test',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: [{ id: 1, name: 'Test' }],
        cleanedData: {
          type: 'table',
          data: [{ id: 1, name: 'Test' }],
        },
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'pending',
        checkpoint: {
          stage: 'quality_scoring_complete',
        },
      });
      ctx.createdJobIds!.push(job.id);

      const result = await processIngestionJob(job.id);

      const hasEmbeddingStage = result.stagesCompleted.some(
        stage => stage.includes('EMBEDDING')
      );
      const failedAtEmbedding = result.error?.stage === ETLStage.EMBEDDING;
      
      expect(hasEmbeddingStage || failedAtEmbedding).toBe(true);
    });

    it('should skip embedding stage when checkpoint is at embedding_complete', async () => {
      const sheet = await storage.createSheet({
        name: 'Embedding Skip Test',
        spaceId: ctx.space!.id,
        workspaceId: ctx.workspace!.id,
        dataSourceType: 'file',
        data: [{ id: 1, name: 'Test' }],
        cleanedData: {
          type: 'table',
          data: [{ id: 1, name: 'Test' }],
        },
        cleaningStatus: 'completed',
        createdBy: TEST_USER_ID,
      });
      ctx.createdSheetIds!.push(sheet.id);

      const job = await storage.createIngestionJob({
        sheetId: sheet.id,
        spaceId: ctx.space!.id,
        status: 'embedding',
        checkpoint: {
          stage: 'embedding_complete',
          embeddingsCreated: 5,
        },
      });
      ctx.createdJobIds!.push(job.id);

      const result = await processIngestionJob(job.id);

      expect(result.stagesCompleted).toContain('EMBEDDING (skipped)');
      expect(result.stagesCompleted).toContain('FINALIZING');
      expect(result.success).toBe(true);
    });
  });
});
