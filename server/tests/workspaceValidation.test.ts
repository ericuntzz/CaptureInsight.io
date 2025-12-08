import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { storage } from '../storage';
import { validateWorkspaceForSpace } from '../utils/workspaceValidation';

const TEST_USER_ID = 'test-user-workspace-validation';
const TEST_USER_ID_2 = 'test-user-workspace-validation-2';

interface TestContext {
  app: express.Express;
  user1: { id: string };
  user2: { id: string };
  space1: { id: string };
  space2: { id: string };
  workspace1: { id: string };
  workspace2: { id: string };
}

const ctx: Partial<TestContext> = {};

function createMockApp() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  const mockAuth = (userId: string) => (req: any, res: any, next: any) => {
    req.user = { claims: { sub: userId } };
    next();
  };

  app.post('/api/spaces/:spaceId/sheets', mockAuth(TEST_USER_ID), async (req: any, res) => {
    try {
      const spaceId = req.params.spaceId;
      const userId = req.user.claims.sub;
      const { workspaceId, ...restBody } = req.body;

      const workspaceValidation = await validateWorkspaceForSpace(workspaceId, spaceId);
      if (!workspaceValidation.valid && workspaceValidation.error) {
        return res.status(workspaceValidation.error.status).json({
          message: workspaceValidation.error.message,
          error: workspaceValidation.error.errorCode,
          details: workspaceValidation.error.details
        });
      }

      const sheet = await storage.createSheet({
        spaceId,
        workspaceId: workspaceId || null,
        name: restBody.name || 'Test Sheet',
        dataSourceType: restBody.dataSourceType || 'file',
        createdBy: userId,
      });

      res.status(201).json(sheet);
    } catch (error) {
      console.error('Error creating sheet:', error);
      res.status(500).json({ message: 'Failed to create sheet' });
    }
  });

  app.post('/api/spaces/:spaceId/sheets/upload', mockAuth(TEST_USER_ID), async (req: any, res) => {
    try {
      const { spaceId } = req.params;
      const userId = req.user.claims.sub;
      const { fileData, filename, mimeType, workspaceId } = req.body;

      if (!fileData || !filename || !mimeType) {
        return res.status(400).json({
          message: "Missing required fields: fileData, filename, and mimeType are required"
        });
      }

      const workspaceValidation = await validateWorkspaceForSpace(workspaceId, spaceId);
      if (!workspaceValidation.valid && workspaceValidation.error) {
        return res.status(workspaceValidation.error.status).json({
          message: workspaceValidation.error.message,
          error: workspaceValidation.error.errorCode,
          details: workspaceValidation.error.details
        });
      }

      const sheet = await storage.createSheet({
        spaceId,
        workspaceId: workspaceId || null,
        name: filename.replace(/\.[^/.]+$/, ''),
        dataSourceType: 'file',
        createdBy: userId,
      });

      res.status(201).json(sheet);
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ message: 'Failed to upload file' });
    }
  });

  return app;
}

describe('Workspace Validation', () => {
  beforeAll(async () => {
    ctx.app = createMockApp();

    ctx.user1 = await storage.upsertUser({
      id: TEST_USER_ID,
      email: 'test-workspace-validation-1@test.com',
      firstName: 'Test',
      lastName: 'User1',
    });

    ctx.user2 = await storage.upsertUser({
      id: TEST_USER_ID_2,
      email: 'test-workspace-validation-2@test.com',
      firstName: 'Test',
      lastName: 'User2',
    });

    ctx.space1 = await storage.createSpace({
      name: 'Test Space 1 for Validation',
      ownerId: TEST_USER_ID,
    });

    ctx.space2 = await storage.createSpace({
      name: 'Test Space 2 for Validation',
      ownerId: TEST_USER_ID_2,
    });

    ctx.workspace1 = await storage.createWorkspace({
      spaceId: ctx.space1.id,
      name: 'Workspace in Space 1',
    });

    ctx.workspace2 = await storage.createWorkspace({
      spaceId: ctx.space2.id,
      name: 'Workspace in Space 2',
    });
  });

  afterAll(async () => {
    try {
      if (ctx.workspace1?.id) await storage.deleteWorkspace(ctx.workspace1.id);
      if (ctx.workspace2?.id) await storage.deleteWorkspace(ctx.workspace2.id);
      if (ctx.space1?.id) await storage.deleteSpace(ctx.space1.id);
      if (ctx.space2?.id) await storage.deleteSpace(ctx.space2.id);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('validateWorkspaceForSpace utility function', () => {
    it('should return valid for null workspaceId', async () => {
      const result = await validateWorkspaceForSpace(null, ctx.space1!.id);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return valid for undefined workspaceId', async () => {
      const result = await validateWorkspaceForSpace(undefined, ctx.space1!.id);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return valid for workspace in same space', async () => {
      const result = await validateWorkspaceForSpace(ctx.workspace1!.id, ctx.space1!.id);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return WORKSPACE_NOT_FOUND error for non-existent workspace', async () => {
      const result = await validateWorkspaceForSpace('00000000-0000-0000-0000-000000000000', ctx.space1!.id);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.errorCode).toBe('WORKSPACE_NOT_FOUND');
      expect(result.error!.status).toBe(400);
    });

    it('should return WORKSPACE_SPACE_MISMATCH error for cross-space workspace', async () => {
      const result = await validateWorkspaceForSpace(ctx.workspace2!.id, ctx.space1!.id);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.errorCode).toBe('WORKSPACE_SPACE_MISMATCH');
      expect(result.error!.status).toBe(400);
    });
  });

  describe('POST /api/spaces/:spaceId/sheets - Standard Sheet Creation', () => {
    it('should create sheet with valid workspace in same space', async () => {
      const response = await request(ctx.app!)
        .post(`/api/spaces/${ctx.space1!.id}/sheets`)
        .send({
          name: 'Valid Workspace Sheet',
          dataSourceType: 'file',
          workspaceId: ctx.workspace1!.id,
        });

      expect(response.status).toBe(201);
      expect(response.body.workspaceId).toBe(ctx.workspace1!.id);

      await storage.deleteSheet(response.body.id);
    });

    it('should create sheet without workspace (null workspaceId)', async () => {
      const response = await request(ctx.app!)
        .post(`/api/spaces/${ctx.space1!.id}/sheets`)
        .send({
          name: 'No Workspace Sheet',
          dataSourceType: 'file',
        });

      expect(response.status).toBe(201);
      expect(response.body.workspaceId).toBeNull();

      await storage.deleteSheet(response.body.id);
    });

    it('should return 400 when workspace does not exist', async () => {
      const response = await request(ctx.app!)
        .post(`/api/spaces/${ctx.space1!.id}/sheets`)
        .send({
          name: 'Invalid Workspace Sheet',
          dataSourceType: 'file',
          workspaceId: '00000000-0000-0000-0000-000000000000',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('WORKSPACE_NOT_FOUND');
      expect(response.body.message).toBe('Invalid workspace ID');
    });

    it('should return 400 when workspace belongs to different space (cross-space attack)', async () => {
      const response = await request(ctx.app!)
        .post(`/api/spaces/${ctx.space1!.id}/sheets`)
        .send({
          name: 'Cross-Space Attack Sheet',
          dataSourceType: 'file',
          workspaceId: ctx.workspace2!.id,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('WORKSPACE_SPACE_MISMATCH');
      expect(response.body.message).toBe('Invalid workspace ID');
    });
  });

  describe('POST /api/spaces/:spaceId/sheets/upload - File Upload', () => {
    const testCsvBase64 = Buffer.from('name,value\ntest,123').toString('base64');

    it('should upload file with valid workspace in same space', async () => {
      const response = await request(ctx.app!)
        .post(`/api/spaces/${ctx.space1!.id}/sheets/upload`)
        .send({
          fileData: testCsvBase64,
          filename: 'valid-workspace.csv',
          mimeType: 'text/csv',
          workspaceId: ctx.workspace1!.id,
        });

      expect(response.status).toBe(201);
      expect(response.body.workspaceId).toBe(ctx.workspace1!.id);

      await storage.deleteSheet(response.body.id);
    });

    it('should upload file without workspace (null workspaceId)', async () => {
      const response = await request(ctx.app!)
        .post(`/api/spaces/${ctx.space1!.id}/sheets/upload`)
        .send({
          fileData: testCsvBase64,
          filename: 'no-workspace.csv',
          mimeType: 'text/csv',
        });

      expect(response.status).toBe(201);
      expect(response.body.workspaceId).toBeNull();

      await storage.deleteSheet(response.body.id);
    });

    it('should return 400 when workspace does not exist for upload', async () => {
      const response = await request(ctx.app!)
        .post(`/api/spaces/${ctx.space1!.id}/sheets/upload`)
        .send({
          fileData: testCsvBase64,
          filename: 'invalid-workspace.csv',
          mimeType: 'text/csv',
          workspaceId: '00000000-0000-0000-0000-000000000000',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('WORKSPACE_NOT_FOUND');
      expect(response.body.message).toBe('Invalid workspace ID');
    });

    it('should return 400 when workspace belongs to different space for upload (cross-space attack)', async () => {
      const response = await request(ctx.app!)
        .post(`/api/spaces/${ctx.space1!.id}/sheets/upload`)
        .send({
          fileData: testCsvBase64,
          filename: 'cross-space-attack.csv',
          mimeType: 'text/csv',
          workspaceId: ctx.workspace2!.id,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('WORKSPACE_SPACE_MISMATCH');
      expect(response.body.message).toBe('Invalid workspace ID');
    });

    it('should return 400 when required fields are missing', async () => {
      const response = await request(ctx.app!)
        .post(`/api/spaces/${ctx.space1!.id}/sheets/upload`)
        .send({
          filename: 'missing-data.csv',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Missing required fields');
    });
  });
});
