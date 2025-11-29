import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  analyzeCapture,
  chat,
  extractInsights,
  getAIStatus,
  isGeminiConfigured,
  isOpenAIConfigured,
  searchSimilar,
  getAvailablePIIPatterns,
  type ChatMessage,
} from "./ai";
import {
  embedAndStoreInsight,
  embedAndStoreSheet,
  embedAndStoreContent,
  reindexSpace,
} from "./ai/embeddings";
import { serverEncryption } from "./encryption";
import { db } from "./db";
import { userEncryptionKeys, serverEncryptionKeys } from "../shared/schema";
import { eq } from "drizzle-orm";
import * as OTPAuth from "otpauth";

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);

  // Space ownership validation middleware
  const requireSpaceOwner = (paramName: string = 'spaceId') => {
    return async (req: any, res: any, next: any) => {
      try {
        const spaceId = req.params[paramName];
        const space = await storage.getSpace(spaceId);
        
        if (!space) {
          return res.status(404).json({ message: "Space not found" });
        }
        
        if (space.ownerId !== req.user.claims.sub) {
          return res.status(403).json({ message: "Forbidden: you do not have access to this space" });
        }
        
        req.space = space;
        next();
      } catch (error) {
        console.error("Error in requireSpaceOwner middleware:", error);
        res.status(500).json({ message: "Failed to validate space access" });
      }
    };
  };

  // Entity-level ownership validation middleware factory
  // Prevents cross-tenant access by validating that the requesting user owns the space containing the entity
  const requireEntityOwner = (entityType: 'workspace' | 'sheet' | 'tag' | 'insight', paramName: string = 'id') => {
    return async (req: any, res: any, next: any) => {
      try {
        const entityId = req.params[paramName];
        let entity: any;
        let entityName: string;

        // Load the entity based on type
        switch (entityType) {
          case 'workspace':
            entity = await storage.getWorkspace(entityId);
            entityName = 'Workspace';
            break;
          case 'sheet':
            entity = await storage.getSheet(entityId);
            entityName = 'Sheet';
            break;
          case 'tag':
            entity = await storage.getTag(entityId);
            entityName = 'Tag';
            break;
          case 'insight':
            entity = await storage.getInsight(entityId);
            entityName = 'Insight';
            break;
          default:
            return res.status(500).json({ message: "Invalid entity type" });
        }

        if (!entity) {
          return res.status(404).json({ message: `${entityName} not found` });
        }

        // Resolve the space and verify ownership
        const space = await storage.getSpace(entity.spaceId);
        if (!space) {
          return res.status(404).json({ message: "Space not found" });
        }

        if (space.ownerId !== req.user.claims.sub) {
          return res.status(403).json({ message: "Forbidden: you do not have access to this resource" });
        }

        // Attach entity and space to request for handler use
        req.entity = entity;
        req.space = space;
        next();
      } catch (error) {
        console.error(`Error in requireEntityOwner middleware (${entityType}):`, error);
        res.status(500).json({ message: "Failed to validate resource access" });
      }
    };
  };

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ==================== SECURITY ====================
  
  // Get user's current security status
  app.get('/api/security/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const [encryptionKeyRecord] = await db
        .select()
        .from(userEncryptionKeys)
        .where(eq(userEncryptionKeys.userId, userId))
        .limit(1);
      
      const [serverKeyRecord] = await db
        .select()
        .from(serverEncryptionKeys)
        .where(eq(serverEncryptionKeys.userId, userId))
        .limit(1);
      
      if (!encryptionKeyRecord) {
        return res.json({
          securityMode: 0,
          totpEnabled: false,
          hasBackupCodes: false,
          hasServerKey: false,
        });
      }
      
      res.json({
        securityMode: encryptionKeyRecord.securityMode ?? 0,
        totpEnabled: encryptionKeyRecord.totpEnabled ?? false,
        hasBackupCodes: Array.isArray(encryptionKeyRecord.backupCodes) && encryptionKeyRecord.backupCodes.length > 0,
        hasServerKey: !!serverKeyRecord,
      });
    } catch (error) {
      console.error("Error fetching security status:", error);
      res.status(500).json({ message: "Failed to fetch security status" });
    }
  });

  // Initialize or switch to Simple mode (server-side encryption)
  app.post('/api/security/setup-simple', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const { keyId } = await serverEncryption.getOrCreateUserKey(userId);
      
      await db
        .insert(userEncryptionKeys)
        .values({
          userId,
          securityMode: 0,
          serverKeyId: keyId,
          totpEnabled: false,
          wrappedDek: null,
          salt: null,
          iv: null,
          totpSecret: null,
          backupCodes: null,
          backupCodesUsed: null,
        })
        .onConflictDoUpdate({
          target: userEncryptionKeys.userId,
          set: {
            securityMode: 0,
            serverKeyId: keyId,
            totpEnabled: false,
            wrappedDek: null,
            salt: null,
            iv: null,
            totpSecret: null,
            backupCodes: null,
            backupCodesUsed: null,
            updatedAt: new Date(),
          },
        });
      
      res.json({
        success: true,
        message: "Simple security mode activated",
        securityMode: 0,
      });
    } catch (error) {
      console.error("Error setting up simple security mode:", error);
      res.status(500).json({ message: "Failed to setup simple security mode" });
    }
  });

  // Initialize Maximum Security mode (E2EE with password + 2FA)
  app.post('/api/security/setup-maximum', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { wrappedDek, salt, iv, passwordHint } = req.body;
      
      if (!wrappedDek || !salt || !iv) {
        return res.status(400).json({ 
          message: "Missing required fields: wrappedDek, salt, iv" 
        });
      }
      
      const user = await storage.getUser(userId);
      const userEmail = user?.email || 'user@captureinsight.app';
      
      const totpSecret = new OTPAuth.Secret({ size: 20 });
      const totp = new OTPAuth.TOTP({
        issuer: "CaptureInsight",
        label: userEmail,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: totpSecret,
      });
      
      const totpUri = totp.toString();
      
      const { codes: backupCodes, hashes: backupCodeHashes } = serverEncryption.generateBackupCodes(8);
      
      const encryptedTotpSecret = await serverEncryption.encryptForUser(userId, totpSecret.base32);
      const totpSecretStored = JSON.stringify({
        encrypted: encryptedTotpSecret.encrypted,
        iv: encryptedTotpSecret.iv,
      });
      
      await db
        .insert(userEncryptionKeys)
        .values({
          userId,
          securityMode: 1,
          wrappedDek,
          salt,
          iv,
          totpSecret: totpSecretStored,
          totpEnabled: true,
          backupCodes: backupCodeHashes,
          backupCodesUsed: [],
          passwordHint: passwordHint || null,
          serverKeyId: null,
        })
        .onConflictDoUpdate({
          target: userEncryptionKeys.userId,
          set: {
            securityMode: 1,
            wrappedDek,
            salt,
            iv,
            totpSecret: totpSecretStored,
            totpEnabled: true,
            backupCodes: backupCodeHashes,
            backupCodesUsed: [],
            passwordHint: passwordHint || null,
            serverKeyId: null,
            updatedAt: new Date(),
          },
        });
      
      res.json({
        success: true,
        totpSecret: totpSecret.base32,
        totpUri,
        backupCodes,
        securityMode: 1,
      });
    } catch (error) {
      console.error("Error setting up maximum security mode:", error);
      res.status(500).json({ message: "Failed to setup maximum security mode" });
    }
  });

  // Verify TOTP code for session unlock
  app.post('/api/security/verify-totp', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ message: "TOTP code is required" });
      }
      
      const [encryptionKeyRecord] = await db
        .select()
        .from(userEncryptionKeys)
        .where(eq(userEncryptionKeys.userId, userId))
        .limit(1);
      
      if (!encryptionKeyRecord || !encryptionKeyRecord.totpSecret) {
        return res.status(400).json({ message: "TOTP not configured for this user" });
      }
      
      let totpSecretBase32: string;
      try {
        const storedSecret = JSON.parse(encryptionKeyRecord.totpSecret);
        const decrypted = await serverEncryption.decryptForUser(
          userId,
          storedSecret.encrypted,
          storedSecret.iv
        );
        if (!decrypted) {
          return res.status(500).json({ message: "Failed to decrypt TOTP secret" });
        }
        totpSecretBase32 = decrypted;
      } catch (parseError) {
        totpSecretBase32 = encryptionKeyRecord.totpSecret;
      }
      
      const totp = new OTPAuth.TOTP({
        issuer: "CaptureInsight",
        label: "user",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(totpSecretBase32),
      });
      
      const delta = totp.validate({ token: code, window: 1 });
      const valid = delta !== null;
      
      if (valid) {
        res.json({
          valid: true,
          wrappedDek: encryptionKeyRecord.wrappedDek,
          salt: encryptionKeyRecord.salt,
          iv: encryptionKeyRecord.iv,
        });
      } else {
        res.json({ valid: false });
      }
    } catch (error) {
      console.error("Error verifying TOTP:", error);
      res.status(500).json({ message: "Failed to verify TOTP code" });
    }
  });

  // Recover access using backup code
  app.post('/api/security/recover', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { backupCode, newPassword, wrappedDek, salt, iv } = req.body;
      
      if (!backupCode) {
        return res.status(400).json({ message: "Backup code is required" });
      }
      
      if (!wrappedDek || !salt || !iv) {
        return res.status(400).json({ 
          message: "Missing required fields for key recovery: wrappedDek, salt, iv" 
        });
      }
      
      const [encryptionKeyRecord] = await db
        .select()
        .from(userEncryptionKeys)
        .where(eq(userEncryptionKeys.userId, userId))
        .limit(1);
      
      if (!encryptionKeyRecord || !encryptionKeyRecord.backupCodes) {
        return res.status(400).json({ message: "No backup codes configured for this user" });
      }
      
      const backupCodeHashes = encryptionKeyRecord.backupCodes as string[];
      const usedCodes = (encryptionKeyRecord.backupCodesUsed as string[]) || [];
      
      const inputHash = serverEncryption.hashBackupCode(backupCode);
      
      if (usedCodes.includes(inputHash)) {
        return res.status(400).json({ message: "This backup code has already been used" });
      }
      
      if (!backupCodeHashes.includes(inputHash)) {
        return res.status(400).json({ message: "Invalid backup code" });
      }
      
      const updatedUsedCodes = [...usedCodes, inputHash];
      const remainingCodes = backupCodeHashes.filter(hash => !updatedUsedCodes.includes(hash)).length;
      
      await db
        .update(userEncryptionKeys)
        .set({
          wrappedDek,
          salt,
          iv,
          backupCodesUsed: updatedUsedCodes,
          updatedAt: new Date(),
        })
        .where(eq(userEncryptionKeys.userId, userId));
      
      res.json({
        success: true,
        remainingCodes,
        message: remainingCodes === 0 
          ? "Recovery successful. Warning: No backup codes remaining!"
          : `Recovery successful. ${remainingCodes} backup code(s) remaining.`,
      });
    } catch (error) {
      console.error("Error recovering with backup code:", error);
      res.status(500).json({ message: "Failed to recover access" });
    }
  });

  // ==================== LOGIN 2FA ====================
  // These endpoints are for account login security (separate from encryption 2FA)
  // Available to users on any security mode

  // Get login 2FA status
  app.get('/api/login-2fa/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { enabled } = await storage.getUserLoginTotp(userId);
      res.json({ enabled });
    } catch (error) {
      console.error("Error fetching login 2FA status:", error);
      res.status(500).json({ message: "Failed to fetch login 2FA status" });
    }
  });

  // Start login 2FA setup
  app.post('/api/login-2fa/setup', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const user = await storage.getUser(userId);
      const userEmail = user?.email || 'user@captureinsight.app';
      
      const totpSecret = new OTPAuth.Secret({ size: 20 });
      const totp = new OTPAuth.TOTP({
        issuer: "CaptureInsight",
        label: userEmail,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: totpSecret,
      });
      
      const qrUri = totp.toString();
      
      const encryptedSecret = await serverEncryption.encryptForUser(userId, totpSecret.base32);
      const secretStored = JSON.stringify({
        encrypted: encryptedSecret.encrypted,
        iv: encryptedSecret.iv,
      });
      
      await storage.setUserLoginTotp(userId, secretStored, false);
      
      res.json({
        secret: totpSecret.base32,
        qrUri,
      });
    } catch (error) {
      console.error("Error setting up login 2FA:", error);
      res.status(500).json({ message: "Failed to setup login 2FA" });
    }
  });

  // Verify setup and enable login 2FA
  app.post('/api/login-2fa/verify-setup', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ message: "TOTP code is required" });
      }
      
      const { secret, enabled } = await storage.getUserLoginTotp(userId);
      
      if (!secret) {
        return res.status(400).json({ message: "Login 2FA not set up. Please start setup first." });
      }
      
      if (enabled) {
        return res.status(400).json({ message: "Login 2FA is already enabled" });
      }
      
      let totpSecretBase32: string;
      try {
        const storedSecret = JSON.parse(secret);
        const decrypted = await serverEncryption.decryptForUser(
          userId,
          storedSecret.encrypted,
          storedSecret.iv
        );
        if (!decrypted) {
          return res.status(500).json({ message: "Failed to decrypt TOTP secret" });
        }
        totpSecretBase32 = decrypted;
      } catch (parseError) {
        totpSecretBase32 = secret;
      }
      
      const totp = new OTPAuth.TOTP({
        issuer: "CaptureInsight",
        label: "user",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(totpSecretBase32),
      });
      
      const delta = totp.validate({ token: code, window: 1 });
      const valid = delta !== null;
      
      if (valid) {
        await storage.setUserLoginTotp(userId, secret, true);
        res.json({ success: true });
      } else {
        res.json({ success: false, message: "Invalid TOTP code" });
      }
    } catch (error) {
      console.error("Error verifying login 2FA setup:", error);
      res.status(500).json({ message: "Failed to verify login 2FA setup" });
    }
  });

  // Disable login 2FA
  app.post('/api/login-2fa/disable', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ message: "TOTP code is required to disable 2FA" });
      }
      
      const { secret, enabled } = await storage.getUserLoginTotp(userId);
      
      if (!enabled || !secret) {
        return res.status(400).json({ message: "Login 2FA is not enabled" });
      }
      
      let totpSecretBase32: string;
      try {
        const storedSecret = JSON.parse(secret);
        const decrypted = await serverEncryption.decryptForUser(
          userId,
          storedSecret.encrypted,
          storedSecret.iv
        );
        if (!decrypted) {
          return res.status(500).json({ message: "Failed to decrypt TOTP secret" });
        }
        totpSecretBase32 = decrypted;
      } catch (parseError) {
        totpSecretBase32 = secret;
      }
      
      const totp = new OTPAuth.TOTP({
        issuer: "CaptureInsight",
        label: "user",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(totpSecretBase32),
      });
      
      const delta = totp.validate({ token: code, window: 1 });
      const valid = delta !== null;
      
      if (valid) {
        await storage.setUserLoginTotp(userId, null, false);
        res.json({ success: true });
      } else {
        res.json({ success: false, message: "Invalid TOTP code" });
      }
    } catch (error) {
      console.error("Error disabling login 2FA:", error);
      res.status(500).json({ message: "Failed to disable login 2FA" });
    }
  });

  // Verify login 2FA code (used during login flow)
  app.post('/api/login-2fa/verify', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ message: "TOTP code is required" });
      }
      
      const { secret, enabled } = await storage.getUserLoginTotp(userId);
      
      if (!enabled || !secret) {
        return res.status(400).json({ message: "Login 2FA is not enabled for this user" });
      }
      
      let totpSecretBase32: string;
      try {
        const storedSecret = JSON.parse(secret);
        const decrypted = await serverEncryption.decryptForUser(
          userId,
          storedSecret.encrypted,
          storedSecret.iv
        );
        if (!decrypted) {
          return res.status(500).json({ message: "Failed to decrypt TOTP secret" });
        }
        totpSecretBase32 = decrypted;
      } catch (parseError) {
        totpSecretBase32 = secret;
      }
      
      const totp = new OTPAuth.TOTP({
        issuer: "CaptureInsight",
        label: "user",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(totpSecretBase32),
      });
      
      const delta = totp.validate({ token: code, window: 1 });
      const valid = delta !== null;
      
      res.json({ valid });
    } catch (error) {
      console.error("Error verifying login 2FA:", error);
      res.status(500).json({ message: "Failed to verify login 2FA code" });
    }
  });

  // ==================== SPACES ====================
  app.get('/api/spaces', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const spacesData = await storage.getSpaces(userId);
      
      const spacesWithNested = await Promise.all(
        spacesData.map(async (space) => {
          const [workspacesData, tagsData, sheetsData] = await Promise.all([
            storage.getWorkspaces(space.id),
            storage.getTags(space.id),
            storage.getSheets(space.id),
          ]);
          
          const workspacesWithSheets = workspacesData.map((workspace) => ({
            ...workspace,
            sheets: sheetsData
              .filter((sheet) => sheet.workspaceId === workspace.id)
              .map((sheet) => ({
                id: sheet.id,
                name: sheet.name,
                rowCount: sheet.rowCount || 0,
                lastModified: sheet.lastModified
                  ? new Date(sheet.lastModified).toISOString()
                  : "Never",
                dataSourceType: sheet.dataSourceType,
                dataSourceMeta: sheet.dataSourceMeta,
              })),
          }));
          
          return {
            ...space,
            workspaces: workspacesWithSheets,
            tags: tagsData.map((tag) => ({
              id: tag.id,
              name: tag.name,
              color: tag.color,
              createdAt: tag.createdAt,
              createdBy: tag.createdBy,
              spaceId: tag.spaceId,
            })),
          };
        })
      );
      
      res.json(spacesWithNested);
    } catch (error) {
      console.error("Error fetching spaces:", error);
      res.status(500).json({ message: "Failed to fetch spaces" });
    }
  });

  app.post('/api/spaces', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const space = await storage.createSpace({ ...req.body, ownerId: userId });
      res.status(201).json(space);
    } catch (error) {
      console.error("Error creating space:", error);
      res.status(500).json({ message: "Failed to create space" });
    }
  });

  app.get('/api/spaces/:id', isAuthenticated, requireSpaceOwner('id'), async (req: any, res) => {
    try {
      res.json(req.space);
    } catch (error) {
      console.error("Error fetching space:", error);
      res.status(500).json({ message: "Failed to fetch space" });
    }
  });

  app.put('/api/spaces/:id', isAuthenticated, requireSpaceOwner('id'), async (req: any, res) => {
    try {
      const space = await storage.updateSpace(req.params.id, req.body);
      if (!space) {
        return res.status(404).json({ message: "Space not found" });
      }
      res.json(space);
    } catch (error) {
      console.error("Error updating space:", error);
      res.status(500).json({ message: "Failed to update space" });
    }
  });

  app.delete('/api/spaces/:id', isAuthenticated, requireSpaceOwner('id'), async (req: any, res) => {
    try {
      const deleted = await storage.deleteSpace(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Space not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting space:", error);
      res.status(500).json({ message: "Failed to delete space" });
    }
  });

  app.put('/api/spaces/:id/ai-settings', isAuthenticated, requireSpaceOwner('id'), async (req: any, res) => {
    try {
      const { consentGiven, piiFilterEnabled, piiFilterPatterns, dataProcessingAllowed } = req.body;
      
      const aiSettings: any = {};
      
      if (typeof consentGiven === 'boolean') {
        aiSettings.consentGiven = consentGiven;
        if (consentGiven) {
          aiSettings.consentDate = new Date().toISOString();
        }
      }
      
      if (typeof piiFilterEnabled === 'boolean') {
        aiSettings.piiFilterEnabled = piiFilterEnabled;
      }
      
      if (Array.isArray(piiFilterPatterns)) {
        aiSettings.piiFilterPatterns = piiFilterPatterns;
      }
      
      if (typeof dataProcessingAllowed === 'boolean') {
        aiSettings.dataProcessingAllowed = dataProcessingAllowed;
      }

      const existingSettings = req.space.aiSettings || {};
      const mergedSettings = { ...existingSettings, ...aiSettings };
      
      const space = await storage.updateSpace(req.params.id, { aiSettings: mergedSettings });
      
      if (!space) {
        return res.status(404).json({ message: "Space not found" });
      }
      
      res.json({ 
        message: "AI settings updated successfully",
        aiSettings: space.aiSettings 
      });
    } catch (error) {
      console.error("Error updating AI settings:", error);
      res.status(500).json({ message: "Failed to update AI settings" });
    }
  });

  app.get('/api/spaces/:id/ai-settings', isAuthenticated, requireSpaceOwner('id'), async (req: any, res) => {
    try {
      res.json({ 
        aiSettings: req.space.aiSettings || {
          consentGiven: false,
          piiFilterEnabled: true,
          piiFilterPatterns: getAvailablePIIPatterns(),
          dataProcessingAllowed: false,
        }
      });
    } catch (error) {
      console.error("Error getting AI settings:", error);
      res.status(500).json({ message: "Failed to get AI settings" });
    }
  });

  // ==================== WORKSPACES ====================
  app.get('/api/spaces/:spaceId/workspaces', isAuthenticated, requireSpaceOwner('spaceId'), async (req: any, res) => {
    try {
      const workspaces = await storage.getWorkspaces(req.params.spaceId);
      res.json(workspaces);
    } catch (error) {
      console.error("Error fetching workspaces:", error);
      res.status(500).json({ message: "Failed to fetch workspaces" });
    }
  });

  app.post('/api/spaces/:spaceId/workspaces', isAuthenticated, requireSpaceOwner('spaceId'), async (req: any, res) => {
    try {
      const workspace = await storage.createWorkspace({ ...req.body, spaceId: req.params.spaceId });
      res.status(201).json(workspace);
    } catch (error) {
      console.error("Error creating workspace:", error);
      res.status(500).json({ message: "Failed to create workspace" });
    }
  });

  app.put('/api/workspaces/:id', isAuthenticated, requireEntityOwner('workspace'), async (req: any, res) => {
    try {
      const workspace = await storage.updateWorkspace(req.params.id, req.body);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not found" });
      }
      res.json(workspace);
    } catch (error) {
      console.error("Error updating workspace:", error);
      res.status(500).json({ message: "Failed to update workspace" });
    }
  });

  app.delete('/api/workspaces/:id', isAuthenticated, requireEntityOwner('workspace'), async (req: any, res) => {
    try {
      const deleted = await storage.deleteWorkspace(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Workspace not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting workspace:", error);
      res.status(500).json({ message: "Failed to delete workspace" });
    }
  });

  app.get('/api/workspaces/:id/export', isAuthenticated, requireEntityOwner('workspace'), async (req: any, res) => {
    try {
      const workspace = req.entity;
      const spaceId = workspace.spaceId;
      
      const [sheets, insights, chatThreads] = await Promise.all([
        storage.getSheetsByWorkspace(req.params.id),
        storage.getInsights(spaceId),
        storage.getChatThreadsBySpace(spaceId),
      ]);
      
      const workspaceInsights = insights.filter((insight: any) => insight.workspaceId === req.params.id);
      const workspaceThreads = chatThreads.filter((thread: any) => thread.workspaceId === req.params.id);
      
      const chatMessagesPromises = workspaceThreads.map((thread: any) => 
        storage.getChatMessages(thread.id)
      );
      const allMessages = await Promise.all(chatMessagesPromises);
      
      const threadsWithMessages = workspaceThreads.map((thread: any, index: number) => ({
        ...thread,
        messages: allMessages[index] || [],
      }));
      
      const exportData = {
        workspace: {
          id: workspace.id,
          name: workspace.name,
          spaceId: workspace.spaceId,
          createdAt: workspace.createdAt,
        },
        sheets: sheets.map((sheet: any) => ({
          id: sheet.id,
          name: sheet.name,
          rowCount: sheet.rowCount,
          dataSourceType: sheet.dataSourceType,
          dataSourceMeta: sheet.dataSourceMeta,
          createdAt: sheet.createdAt,
          lastModified: sheet.lastModified,
        })),
        insights: workspaceInsights.map((insight: any) => ({
          id: insight.id,
          title: insight.title,
          summary: insight.summary,
          content: insight.content,
          insightType: insight.insightType,
          priority: insight.priority,
          status: insight.status,
          createdAt: insight.createdAt,
          updatedAt: insight.updatedAt,
        })),
        chatThreads: threadsWithMessages.map((thread: any) => ({
          id: thread.id,
          title: thread.title,
          createdAt: thread.createdAt,
          messages: thread.messages.map((msg: any) => ({
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt,
          })),
        })),
        exportedAt: new Date().toISOString(),
      };
      
      res.json(exportData);
    } catch (error) {
      console.error("Error exporting workspace data:", error);
      res.status(500).json({ message: "Failed to export workspace data" });
    }
  });

  // ==================== SHEETS ====================
  app.get('/api/spaces/:spaceId/sheets', isAuthenticated, requireSpaceOwner('spaceId'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sheets = await storage.getSheets(req.params.spaceId);
      const securityMode = await serverEncryption.getSecurityMode(userId);
      
      if (securityMode === 0) {
        for (const sheet of sheets) {
          if (sheet.encryptedData && sheet.encryptionIv && sheet.encryptionVersion === 1) {
            try {
              const decryptedData = await serverEncryption.decryptForUser(userId, sheet.encryptedData, sheet.encryptionIv);
              if (decryptedData) {
                try {
                  (sheet as any).data = JSON.parse(decryptedData);
                } catch {
                  (sheet as any).data = decryptedData;
                }
              }
            } catch (decryptError) {
              console.error("Error decrypting sheet data:", decryptError);
            }
          }
        }
      }
      
      res.json(sheets);
    } catch (error) {
      console.error("Error fetching sheets:", error);
      res.status(500).json({ message: "Failed to fetch sheets" });
    }
  });

  app.get('/api/workspaces/:workspaceId/sheets', isAuthenticated, requireEntityOwner('workspace', 'workspaceId'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sheets = await storage.getSheetsByWorkspace(req.params.workspaceId);
      const securityMode = await serverEncryption.getSecurityMode(userId);
      
      if (securityMode === 0) {
        for (const sheet of sheets) {
          if (sheet.encryptedData && sheet.encryptionIv && sheet.encryptionVersion === 1) {
            try {
              const decryptedData = await serverEncryption.decryptForUser(userId, sheet.encryptedData, sheet.encryptionIv);
              if (decryptedData) {
                try {
                  (sheet as any).data = JSON.parse(decryptedData);
                } catch {
                  (sheet as any).data = decryptedData;
                }
              }
            } catch (decryptError) {
              console.error("Error decrypting sheet data:", decryptError);
            }
          }
        }
      }
      
      res.json(sheets);
    } catch (error) {
      console.error("Error fetching sheets:", error);
      res.status(500).json({ message: "Failed to fetch sheets" });
    }
  });

  app.post('/api/spaces/:spaceId/sheets', isAuthenticated, requireSpaceOwner('spaceId'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const securityMode = await serverEncryption.getSecurityMode(userId);
      
      let sheetData = { ...req.body, spaceId: req.params.spaceId, createdBy: userId };
      
      if (securityMode === 0 && sheetData.data !== undefined && sheetData.data !== null) {
        const dataString = typeof sheetData.data === 'string' 
          ? sheetData.data 
          : JSON.stringify(sheetData.data);
        const { encrypted, iv } = await serverEncryption.encryptForUser(userId, dataString);
        sheetData = {
          ...sheetData,
          data: null,
          encryptedData: encrypted,
          encryptionIv: iv,
          encryptionVersion: 1,
        };
      }
      
      const sheet = await storage.createSheet(sheetData);
      res.status(201).json(sheet);
    } catch (error) {
      console.error("Error creating sheet:", error);
      res.status(500).json({ message: "Failed to create sheet" });
    }
  });

  app.get('/api/sheets/:id', isAuthenticated, requireEntityOwner('sheet'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sheet = req.entity;
      
      if (sheet.encryptedData && sheet.encryptionIv && sheet.encryptionVersion === 1) {
        const securityMode = await serverEncryption.getSecurityMode(userId);
        if (securityMode === 0) {
          try {
            const decryptedData = await serverEncryption.decryptForUser(userId, sheet.encryptedData, sheet.encryptionIv);
            if (decryptedData) {
              try {
                sheet.data = JSON.parse(decryptedData);
              } catch {
                sheet.data = decryptedData;
              }
            }
          } catch (decryptError) {
            console.error("Error decrypting sheet data:", decryptError);
          }
        }
      }
      
      res.json(sheet);
    } catch (error) {
      console.error("Error fetching sheet:", error);
      res.status(500).json({ message: "Failed to fetch sheet" });
    }
  });

  app.put('/api/sheets/:id', isAuthenticated, requireEntityOwner('sheet'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const securityMode = await serverEncryption.getSecurityMode(userId);
      
      let updateData = { ...req.body };
      
      if (securityMode === 0 && updateData.data !== undefined && updateData.data !== null) {
        const dataString = typeof updateData.data === 'string' 
          ? updateData.data 
          : JSON.stringify(updateData.data);
        const { encrypted, iv } = await serverEncryption.encryptForUser(userId, dataString);
        updateData = {
          ...updateData,
          data: null,
          encryptedData: encrypted,
          encryptionIv: iv,
          encryptionVersion: 1,
        };
      }
      
      const sheet = await storage.updateSheet(req.params.id, updateData);
      if (!sheet) {
        return res.status(404).json({ message: "Sheet not found" });
      }
      res.json(sheet);
    } catch (error) {
      console.error("Error updating sheet:", error);
      res.status(500).json({ message: "Failed to update sheet" });
    }
  });

  app.delete('/api/sheets/:id', isAuthenticated, requireEntityOwner('sheet'), async (req: any, res) => {
    try {
      const deleted = await storage.deleteSheet(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Sheet not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting sheet:", error);
      res.status(500).json({ message: "Failed to delete sheet" });
    }
  });

  // ==================== TAGS ====================
  app.get('/api/spaces/:spaceId/tags', isAuthenticated, requireSpaceOwner('spaceId'), async (req: any, res) => {
    try {
      const tags = await storage.getTags(req.params.spaceId);
      res.json(tags);
    } catch (error) {
      console.error("Error fetching tags:", error);
      res.status(500).json({ message: "Failed to fetch tags" });
    }
  });

  app.post('/api/spaces/:spaceId/tags', isAuthenticated, requireSpaceOwner('spaceId'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tag = await storage.createTag({ ...req.body, spaceId: req.params.spaceId, createdBy: userId });
      res.status(201).json(tag);
    } catch (error) {
      console.error("Error creating tag:", error);
      res.status(500).json({ message: "Failed to create tag" });
    }
  });

  app.put('/api/tags/:id', isAuthenticated, requireEntityOwner('tag'), async (req: any, res) => {
    try {
      const tag = await storage.updateTag(req.params.id, req.body);
      if (!tag) {
        return res.status(404).json({ message: "Tag not found" });
      }
      res.json(tag);
    } catch (error) {
      console.error("Error updating tag:", error);
      res.status(500).json({ message: "Failed to update tag" });
    }
  });

  app.delete('/api/tags/:id', isAuthenticated, requireEntityOwner('tag'), async (req: any, res) => {
    try {
      const deleted = await storage.deleteTag(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Tag not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting tag:", error);
      res.status(500).json({ message: "Failed to delete tag" });
    }
  });

  // Tag associations
  app.get('/api/tag-associations/:entityType/:entityId', isAuthenticated, async (req: any, res) => {
    try {
      const associations = await storage.getTagAssociations(req.params.entityType, req.params.entityId);
      res.json(associations);
    } catch (error) {
      console.error("Error fetching tag associations:", error);
      res.status(500).json({ message: "Failed to fetch tag associations" });
    }
  });

  app.post('/api/tag-associations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const association = await storage.createTagAssociation({ ...req.body, createdBy: userId });
      res.status(201).json(association);
    } catch (error) {
      console.error("Error creating tag association:", error);
      res.status(500).json({ message: "Failed to create tag association" });
    }
  });

  app.delete('/api/tag-associations/:tagId/:entityType/:entityId', isAuthenticated, async (req: any, res) => {
    try {
      const deleted = await storage.deleteTagAssociation(
        req.params.tagId,
        req.params.entityType,
        req.params.entityId
      );
      if (!deleted) {
        return res.status(404).json({ message: "Tag association not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting tag association:", error);
      res.status(500).json({ message: "Failed to delete tag association" });
    }
  });

  // ==================== INSIGHTS ====================
  app.get('/api/spaces/:spaceId/insights', isAuthenticated, requireSpaceOwner('spaceId'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const insights = await storage.getInsights(req.params.spaceId);
      const securityMode = await serverEncryption.getSecurityMode(userId);
      
      if (securityMode === 0) {
        for (const insight of insights) {
          if (insight.encryptedSummary && insight.encryptionIv && insight.encryptionVersion === 1) {
            try {
              const decryptedSummary = await serverEncryption.decryptForUser(userId, insight.encryptedSummary, insight.encryptionIv);
              if (decryptedSummary) {
                (insight as any).summary = decryptedSummary;
              }
            } catch (decryptError) {
              console.error("Error decrypting insight summary:", decryptError);
            }
          }
        }
      }
      
      res.json(insights);
    } catch (error) {
      console.error("Error fetching insights:", error);
      res.status(500).json({ message: "Failed to fetch insights" });
    }
  });

  app.post('/api/spaces/:spaceId/insights', isAuthenticated, requireSpaceOwner('spaceId'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const securityMode = await serverEncryption.getSecurityMode(userId);
      
      let insightData = { ...req.body, spaceId: req.params.spaceId, createdBy: userId };
      
      if (securityMode === 0 && insightData.summary !== undefined && insightData.summary !== null) {
        const summaryString = String(insightData.summary);
        const { encrypted, iv } = await serverEncryption.encryptForUser(userId, summaryString);
        insightData = {
          ...insightData,
          summary: null,
          encryptedSummary: encrypted,
          encryptionIv: iv,
          encryptionVersion: 1,
        };
      }
      
      const insight = await storage.createInsight(insightData);
      res.status(201).json(insight);
    } catch (error) {
      console.error("Error creating insight:", error);
      res.status(500).json({ message: "Failed to create insight" });
    }
  });

  app.get('/api/insights/:id', isAuthenticated, requireEntityOwner('insight'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const insight = req.entity;
      
      if (insight.encryptedSummary && insight.encryptionIv && insight.encryptionVersion === 1) {
        const securityMode = await serverEncryption.getSecurityMode(userId);
        if (securityMode === 0) {
          try {
            const decryptedSummary = await serverEncryption.decryptForUser(userId, insight.encryptedSummary, insight.encryptionIv);
            if (decryptedSummary) {
              insight.summary = decryptedSummary;
            }
          } catch (decryptError) {
            console.error("Error decrypting insight summary:", decryptError);
          }
        }
      }
      
      res.json(insight);
    } catch (error) {
      console.error("Error fetching insight:", error);
      res.status(500).json({ message: "Failed to fetch insight" });
    }
  });

  app.put('/api/insights/:id', isAuthenticated, requireEntityOwner('insight'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const securityMode = await serverEncryption.getSecurityMode(userId);
      
      let updateData = { ...req.body };
      
      if (securityMode === 0 && updateData.summary !== undefined && updateData.summary !== null) {
        const summaryString = String(updateData.summary);
        const { encrypted, iv } = await serverEncryption.encryptForUser(userId, summaryString);
        updateData = {
          ...updateData,
          summary: null,
          encryptedSummary: encrypted,
          encryptionIv: iv,
          encryptionVersion: 1,
        };
      }
      
      const insight = await storage.updateInsight(req.params.id, updateData);
      if (!insight) {
        return res.status(404).json({ message: "Insight not found" });
      }
      res.json(insight);
    } catch (error) {
      console.error("Error updating insight:", error);
      res.status(500).json({ message: "Failed to update insight" });
    }
  });

  app.delete('/api/insights/:id', isAuthenticated, requireEntityOwner('insight'), async (req: any, res) => {
    try {
      const deleted = await storage.deleteInsight(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Insight not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting insight:", error);
      res.status(500).json({ message: "Failed to delete insight" });
    }
  });

  // Insight sources
  app.get('/api/insights/:insightId/sources', isAuthenticated, requireEntityOwner('insight', 'insightId'), async (req: any, res) => {
    try {
      const sources = await storage.getInsightSources(req.params.insightId);
      res.json(sources);
    } catch (error) {
      console.error("Error fetching insight sources:", error);
      res.status(500).json({ message: "Failed to fetch insight sources" });
    }
  });

  app.post('/api/insights/:insightId/sources', isAuthenticated, requireEntityOwner('insight', 'insightId'), async (req: any, res) => {
    try {
      const source = await storage.createInsightSource({ ...req.body, insightId: req.params.insightId });
      res.status(201).json(source);
    } catch (error) {
      console.error("Error creating insight source:", error);
      res.status(500).json({ message: "Failed to create insight source" });
    }
  });

  app.delete('/api/insight-sources/:id', isAuthenticated, async (req: any, res) => {
    try {
      const deleted = await storage.deleteInsightSource(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Insight source not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting insight source:", error);
      res.status(500).json({ message: "Failed to delete insight source" });
    }
  });

  // Insight comments
  app.get('/api/insights/:insightId/comments', isAuthenticated, requireEntityOwner('insight', 'insightId'), async (req: any, res) => {
    try {
      const comments = await storage.getInsightComments(req.params.insightId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching insight comments:", error);
      res.status(500).json({ message: "Failed to fetch insight comments" });
    }
  });

  app.post('/api/insights/:insightId/comments', isAuthenticated, requireEntityOwner('insight', 'insightId'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const comment = await storage.createInsightComment({ ...req.body, insightId: req.params.insightId, authorId: userId });
      res.status(201).json(comment);
    } catch (error) {
      console.error("Error creating insight comment:", error);
      res.status(500).json({ message: "Failed to create insight comment" });
    }
  });

  app.put('/api/insight-comments/:id', isAuthenticated, async (req: any, res) => {
    try {
      const comment = await storage.updateInsightComment(req.params.id, req.body);
      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }
      res.json(comment);
    } catch (error) {
      console.error("Error updating insight comment:", error);
      res.status(500).json({ message: "Failed to update insight comment" });
    }
  });

  app.delete('/api/insight-comments/:id', isAuthenticated, async (req: any, res) => {
    try {
      const deleted = await storage.deleteInsightComment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Comment not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting insight comment:", error);
      res.status(500).json({ message: "Failed to delete insight comment" });
    }
  });

  // ==================== CHAT CONVERSATIONS (Space-scoped) ====================
  
  // Chat thread ownership validation middleware
  const requireChatOwner = async (req: any, res: any, next: any) => {
    try {
      const chatId = req.params.chatId || req.params.id;
      const chat = await storage.getChatThread(chatId);
      
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      
      // Verify user owns the space containing this chat
      const space = await storage.getSpace(chat.spaceId);
      if (!space || space.ownerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Forbidden: you do not have access to this chat" });
      }
      
      req.chat = chat;
      req.space = space;
      next();
    } catch (error) {
      console.error("Error in requireChatOwner middleware:", error);
      res.status(500).json({ message: "Failed to validate chat access" });
    }
  };

  // Get all chats for a space
  app.get('/api/spaces/:spaceId/chats', isAuthenticated, requireSpaceOwner('spaceId'), async (req: any, res) => {
    try {
      const workspaceId = req.query.workspaceId as string | undefined;
      let chats = await storage.getChatThreadsBySpace(req.params.spaceId);
      if (workspaceId) {
        chats = chats.filter(chat => chat.workspaceId === workspaceId);
      }
      res.json(chats);
    } catch (error) {
      console.error("Error fetching chats:", error);
      res.status(500).json({ message: "Failed to fetch chats" });
    }
  });

  // Create a new chat in a space
  app.post('/api/spaces/:spaceId/chats', isAuthenticated, requireSpaceOwner('spaceId'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { title, insightId, workspaceId } = req.body;
      
      const chat = await storage.createChatThread({
        title: title || 'New Chat',
        spaceId: req.params.spaceId,
        workspaceId: workspaceId || null,
        userId,
        insightId: insightId || null,
        savedToMemory: false,
      });
      res.status(201).json(chat);
    } catch (error) {
      console.error("Error creating chat:", error);
      res.status(500).json({ message: "Failed to create chat" });
    }
  });

  // Get a specific chat
  app.get('/api/chats/:chatId', isAuthenticated, requireChatOwner, async (req: any, res) => {
    try {
      res.json(req.chat);
    } catch (error) {
      console.error("Error fetching chat:", error);
      res.status(500).json({ message: "Failed to fetch chat" });
    }
  });

  // Update a chat (rename, update insight context, etc.)
  app.patch('/api/chats/:chatId', isAuthenticated, requireChatOwner, async (req: any, res) => {
    try {
      const { title, insightId, savedToMemory } = req.body;
      const updateData: any = {};
      
      if (title !== undefined) updateData.title = title;
      if (insightId !== undefined) updateData.insightId = insightId;
      if (savedToMemory !== undefined) updateData.savedToMemory = savedToMemory;
      
      const chat = await storage.updateChatThread(req.params.chatId, updateData);
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      res.json(chat);
    } catch (error) {
      console.error("Error updating chat:", error);
      res.status(500).json({ message: "Failed to update chat" });
    }
  });

  // Delete a chat
  app.delete('/api/chats/:chatId', isAuthenticated, requireChatOwner, async (req: any, res) => {
    try {
      const deleted = await storage.deleteChatThread(req.params.chatId);
      if (!deleted) {
        return res.status(404).json({ message: "Chat not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting chat:", error);
      res.status(500).json({ message: "Failed to delete chat" });
    }
  });

  // Get messages for a chat
  app.get('/api/chats/:chatId/messages', isAuthenticated, requireChatOwner, async (req: any, res) => {
    try {
      const messages = await storage.getChatMessages(req.params.chatId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  // Add a message to a chat
  app.post('/api/chats/:chatId/messages', isAuthenticated, requireChatOwner, async (req: any, res) => {
    try {
      const { role, content, citations } = req.body;
      
      if (!role || !content) {
        return res.status(400).json({ message: "Role and content are required" });
      }
      
      const message = await storage.createChatMessage({
        threadId: req.params.chatId,
        role,
        content,
        spaceId: req.chat.spaceId,
        citations: citations || null,
      });
      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating chat message:", error);
      res.status(500).json({ message: "Failed to create chat message" });
    }
  });

  // Legacy chat thread endpoints (keeping for backwards compatibility)
  app.get('/api/chat-threads', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const threads = await storage.getChatThreads(userId);
      res.json(threads);
    } catch (error) {
      console.error("Error fetching chat threads:", error);
      res.status(500).json({ message: "Failed to fetch chat threads" });
    }
  });

  app.post('/api/chat-threads', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const thread = await storage.createChatThread({ ...req.body, userId });
      res.status(201).json(thread);
    } catch (error) {
      console.error("Error creating chat thread:", error);
      res.status(500).json({ message: "Failed to create chat thread" });
    }
  });

  app.get('/api/chat-threads/:id', isAuthenticated, async (req: any, res) => {
    try {
      const thread = await storage.getChatThread(req.params.id);
      if (!thread) {
        return res.status(404).json({ message: "Chat thread not found" });
      }
      res.json(thread);
    } catch (error) {
      console.error("Error fetching chat thread:", error);
      res.status(500).json({ message: "Failed to fetch chat thread" });
    }
  });

  app.get('/api/chat-threads/:threadId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const messages = await storage.getChatMessages(req.params.threadId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  app.post('/api/chat-threads/:threadId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const message = await storage.createChatMessage({ ...req.body, threadId: req.params.threadId });
      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating chat message:", error);
      res.status(500).json({ message: "Failed to create chat message" });
    }
  });

  // ==================== CHANGE LOGS ====================
  app.get('/api/spaces/:spaceId/change-logs', isAuthenticated, requireSpaceOwner('spaceId'), async (req: any, res) => {
    try {
      const logs = await storage.getChangeLogs(req.params.spaceId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching change logs:", error);
      res.status(500).json({ message: "Failed to fetch change logs" });
    }
  });

  app.post('/api/spaces/:spaceId/change-logs', isAuthenticated, requireSpaceOwner('spaceId'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const log = await storage.createChangeLog({ ...req.body, spaceId: req.params.spaceId, createdBy: userId });
      res.status(201).json(log);
    } catch (error) {
      console.error("Error creating change log:", error);
      res.status(500).json({ message: "Failed to create change log" });
    }
  });

  // ==================== AI ENDPOINTS ====================
  app.get('/api/ai/status', isAuthenticated, async (req: any, res) => {
    try {
      const status = getAIStatus();
      res.json({
        ...status,
        piiFilter: {
          available: true,
          patterns: getAvailablePIIPatterns(),
        },
      });
    } catch (error) {
      console.error("Error getting AI status:", error);
      res.status(500).json({ message: "Failed to get AI status" });
    }
  });

  app.get('/api/ai/pii-patterns', isAuthenticated, async (req: any, res) => {
    try {
      const patterns = getAvailablePIIPatterns();
      res.json({ 
        patterns,
        description: {
          email: "Email addresses (e.g., user@example.com)",
          phone_us: "US phone numbers (e.g., 555-123-4567)",
          phone_intl: "International phone numbers (e.g., +1234567890)",
          ssn: "Social Security Numbers (e.g., 123-45-6789)",
          credit_card: "Credit card numbers (16-digit)",
          credit_card_formatted: "Formatted credit cards (1234-5678-9012-3456)",
          ip_address: "IP addresses (e.g., 192.168.1.1)",
          api_key: "API keys and tokens",
          bearer_token: "Bearer authentication tokens",
          jwt: "JSON Web Tokens",
          aws_key: "AWS access keys",
          private_key: "Private key blocks",
          password_field: "Password fields (password=xxx)",
          date_of_birth: "Date of birth fields",
        }
      });
    } catch (error) {
      console.error("Error getting PII patterns:", error);
      res.status(500).json({ message: "Failed to get PII patterns" });
    }
  });

  app.post('/api/ai/analyze', isAuthenticated, async (req: any, res) => {
    try {
      const { type, content, context, spaceGoals, piiFilter } = req.body;

      if (!type || !content) {
        return res.status(400).json({ message: "Missing required fields: type and content" });
      }

      if (type !== 'screenshot' && type !== 'data') {
        return res.status(400).json({ message: "Type must be 'screenshot' or 'data'" });
      }

      if (!isGeminiConfigured()) {
        return res.status(503).json({ 
          message: "AI service not configured. Gemini integration is required." 
        });
      }

      const result = await analyzeCapture(type, content, { 
        context, 
        spaceGoals,
        piiFilter: piiFilter ? {
          enabled: piiFilter.enabled === true,
          patterns: piiFilter.patterns,
        } : undefined,
      });
      res.json(result);
    } catch (error) {
      console.error("Error analyzing content:", error);
      res.status(500).json({ 
        message: "Failed to analyze content",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post('/api/ai/chat', isAuthenticated, async (req: any, res) => {
    try {
      const { messages, context, spaceGoals, spaceId, useRag, piiFilter } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ message: "Messages must be an array" });
      }

      if (!isGeminiConfigured()) {
        return res.status(503).json({ 
          message: "AI service not configured. Gemini integration is required." 
        });
      }

      const chatMessages: ChatMessage[] = messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      }));

      const result = await chat({
        messages: chatMessages,
        spaceId,
        spaceGoals,
        additionalContext: context,
        useRag: useRag !== false,
        piiFilter: piiFilter ? {
          enabled: piiFilter.enabled === true,
          patterns: piiFilter.patterns,
        } : undefined,
      });
      res.json(result);
    } catch (error) {
      console.error("Error in AI chat:", error);
      res.status(500).json({ 
        message: "Failed to process chat",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Generate a short chat title from a message
  app.post('/api/ai/generate-chat-title', isAuthenticated, async (req: any, res) => {
    try {
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: "Message is required" });
      }

      if (!isGeminiConfigured()) {
        // Fallback to simple truncation if AI not configured
        const fallbackTitle = message.slice(0, 25) + (message.length > 25 ? '...' : '');
        return res.json({ title: fallbackTitle });
      }

      const result = await chat({
        messages: [
          {
            role: 'user',
            content: `Generate a very short title (3-5 words max) that summarizes this message. Return ONLY the title text, nothing else. No quotes, no explanation.\n\nMessage: "${message}"`,
          }
        ],
        useRag: false,
      });
      
      // Clean up the title - remove quotes, trim, limit length
      let title = result.response.trim();
      title = title.replace(/^["']|["']$/g, ''); // Remove surrounding quotes
      title = title.replace(/^Title:\s*/i, ''); // Remove "Title:" prefix if present
      
      // Ensure it's not too long
      if (title.length > 40) {
        title = title.slice(0, 37) + '...';
      }
      
      res.json({ title });
    } catch (error) {
      console.error("Error generating chat title:", error);
      // Fallback to simple truncation on error
      const message = req.body.message || '';
      const fallbackTitle = message.slice(0, 25) + (message.length > 25 ? '...' : '');
      res.json({ title: fallbackTitle });
    }
  });

  app.post('/api/ai/extract-insights', isAuthenticated, async (req: any, res) => {
    try {
      const { content, spaceGoals } = req.body;

      if (!content) {
        return res.status(400).json({ message: "Content is required" });
      }

      if (!isGeminiConfigured()) {
        return res.status(503).json({ 
          message: "AI service not configured. Gemini integration is required." 
        });
      }

      const result = await extractInsights(content, spaceGoals);
      res.json(result);
    } catch (error) {
      console.error("Error extracting insights:", error);
      res.status(500).json({ 
        message: "Failed to extract insights",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ==================== EMBEDDINGS & SEARCH ====================
  app.post('/api/embeddings/index', isAuthenticated, async (req: any, res) => {
    try {
      const { entityType, entityId, spaceId } = req.body;

      if (!entityType || !entityId || !spaceId) {
        return res.status(400).json({ 
          message: "Missing required fields: entityType, entityId, and spaceId" 
        });
      }

      if (!isOpenAIConfigured()) {
        return res.status(503).json({ 
          message: "Embeddings service not configured. OpenAI API key is required." 
        });
      }

      let result;

      if (entityType === 'insight') {
        const insight = await storage.getInsight(entityId);
        if (!insight) {
          return res.status(404).json({ message: "Insight not found" });
        }
        result = await embedAndStoreInsight(insight, spaceId);
      } else if (entityType === 'sheet') {
        const sheet = await storage.getSheet(entityId);
        if (!sheet) {
          return res.status(404).json({ message: "Sheet not found" });
        }
        result = await embedAndStoreSheet(sheet, spaceId);
      } else {
        return res.status(400).json({ 
          message: "Invalid entityType. Must be 'insight' or 'sheet'" 
        });
      }

      if (result.success) {
        res.json({ message: "Entity indexed successfully", result });
      } else {
        res.status(500).json({ 
          message: "Failed to index entity", 
          error: result.error 
        });
      }
    } catch (error) {
      console.error("Error indexing entity:", error);
      res.status(500).json({ 
        message: "Failed to index entity",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post('/api/embeddings/reindex-space/:spaceId', isAuthenticated, requireSpaceOwner('spaceId'), async (req: any, res) => {
    try {
      const { spaceId } = req.params;

      if (!isOpenAIConfigured()) {
        return res.status(503).json({ 
          message: "Embeddings service not configured. OpenAI API key is required." 
        });
      }

      const result = await reindexSpace(spaceId);
      res.json({ 
        message: "Space reindexed successfully", 
        result 
      });
    } catch (error) {
      console.error("Error reindexing space:", error);
      res.status(500).json({ 
        message: "Failed to reindex space",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get('/api/search', isAuthenticated, async (req: any, res) => {
    try {
      const { query, spaceId, limit } = req.query;

      if (!query || !spaceId) {
        return res.status(400).json({ 
          message: "Missing required query parameters: query and spaceId" 
        });
      }

      if (!isOpenAIConfigured()) {
        return res.status(503).json({ 
          message: "Search service not configured. OpenAI API key is required." 
        });
      }

      const parsedLimit = limit ? parseInt(limit as string, 10) : 10;
      const results = await searchSimilar(query as string, spaceId as string, parsedLimit);

      res.json({ results });
    } catch (error) {
      console.error("Error in semantic search:", error);
      res.status(500).json({ 
        message: "Failed to perform search",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ==================== CAPTURES (Chrome Extension) ====================
  app.post('/api/captures', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { dataUrl, metadata, spaceId, tags, sourceUrl, analyze, llmModel } = req.body;

      if (!dataUrl && !sourceUrl) {
        return res.status(400).json({ message: "Missing required field: dataUrl or sourceUrl" });
      }

      const isLinkOnly = !dataUrl && !!sourceUrl;

      // Validate space ownership if spaceId is explicitly provided
      if (spaceId) {
        const space = await storage.getSpace(spaceId);
        if (!space) {
          return res.status(404).json({ message: "Space not found" });
        }
        if (space.ownerId !== userId) {
          return res.status(403).json({ message: "Forbidden: you do not have access to this space" });
        }
      }

      // Get or create a default space if none provided
      let targetSpaceId = spaceId;
      if (!targetSpaceId) {
        const spaces = await storage.getSpaces(userId);
        if (spaces.length > 0) {
          targetSpaceId = spaces[0].id;
        } else {
          // Create a default space for the user
          const defaultSpace = await storage.createSpace({
            name: "My Captures",
            description: "Default space for captured screenshots",
            ownerId: userId
          });
          targetSpaceId = defaultSpace.id;
        }
      }

      // Store as a sheet with data
      const captureTitle = metadata?.title || (isLinkOnly ? `Link from ${new Date().toLocaleString()}` : `Capture from ${new Date().toLocaleString()}`);
      const captureSource = isLinkOnly ? sourceUrl : (metadata?.url || 'Unknown source');
      
      const sheet = await storage.createSheet({
        spaceId: targetSpaceId,
        name: captureTitle,
        dataSourceType: isLinkOnly ? 'link' : 'screenshot',
        dataSourceMeta: {
          captureMode: isLinkOnly ? 'link' : (metadata?.mode || 'tab'),
          sourceUrl: captureSource,
          timestamp: metadata?.timestamp || Date.now(),
          dimensions: isLinkOnly ? { width: 0, height: 0 } : (metadata?.dimensions || { width: 0, height: 0 })
        },
        data: isLinkOnly ? {
          type: 'link',
          url: sourceUrl,
          savedAt: new Date().toISOString()
        } : {
          type: 'screenshot',
          dataUrl: dataUrl,
          capturedAt: new Date().toISOString()
        },
        createdBy: userId
      });

      // Create an insight linked to this capture
      const insight = await storage.createInsight({
        spaceId: targetSpaceId,
        title: captureTitle,
        summary: isLinkOnly ? `Link saved: ${sourceUrl}` : `Screenshot captured from: ${captureSource}`,
        status: 'Open',
        priority: 'Medium',
        createdBy: userId
      });

      // Link the sheet as a source for the insight
      await storage.createInsightSource({
        insightId: insight.id,
        sourceId: sheet.id,
        sourceType: 'capture',
        sourceName: sheet.name
      });

      // Associate tags if provided
      if (tags && tags.length > 0) {
        for (const tagId of tags) {
          await storage.createTagAssociation({
            tagId,
            entityId: insight.id,
            entityType: 'insight'
          });
        }
      }

      // Optionally analyze with AI if configured and requested
      const shouldAnalyze = analyze !== false && llmModel !== 'none' && !isLinkOnly;
      if (shouldAnalyze && isGeminiConfigured() && dataUrl) {
        try {
          const analysisResult = await analyzeCapture(dataUrl, 'screenshot');
          if (analysisResult.summary) {
            const modelLabel = llmModel === 'gemini-flash' ? 'Gemini 2.5 Flash' : 'Gemini 2.5 Pro';
            await storage.updateInsight(insight.id, {
              summary: `${insight.summary}\n\n**AI Analysis (${modelLabel}):**\n${analysisResult.summary}`
            });
          }
        } catch (aiError) {
          console.error("AI analysis failed (non-blocking):", aiError);
        }
      }

      res.status(201).json({
        id: insight.id,
        sheetId: sheet.id,
        message: "Screenshot captured and saved successfully"
      });
    } catch (error) {
      console.error("Error saving capture:", error);
      res.status(500).json({ 
        message: "Failed to save capture",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ==================== PROFILE & SETTINGS ====================
  
  // Get user profile
  app.get('/api/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  // Update user profile
  app.put('/api/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { firstName, lastName, profileImageUrl } = req.body;
      
      const updated = await storage.updateUserProfile(userId, {
        firstName,
        lastName,
        profileImageUrl,
      });
      
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Get user settings (preferences, notifications, etc.)
  app.get('/api/settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let settings = await storage.getUserSettings(userId);
      
      if (!settings) {
        settings = await storage.createUserSettings({ userId });
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  // Update user settings
  app.put('/api/settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const settings = await storage.updateUserSettings(userId, req.body);
      res.json(settings);
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // Update preferences (theme, language, timezone, etc.)
  app.put('/api/preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { theme, language, timezone, dateFormat } = req.body;
      
      const settings = await storage.updateUserSettings(userId, {
        theme,
        language,
        timezone,
        dateFormat,
      });
      
      res.json(settings);
    } catch (error) {
      console.error("Error updating preferences:", error);
      res.status(500).json({ message: "Failed to update preferences" });
    }
  });

  // Update notification settings
  app.put('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { emailNotifications, pushNotifications } = req.body;
      
      const settings = await storage.updateUserSettings(userId, {
        emailNotifications,
        pushNotifications,
      });
      
      res.json(settings);
    } catch (error) {
      console.error("Error updating notifications:", error);
      res.status(500).json({ message: "Failed to update notification settings" });
    }
  });

  // Get billing info (placeholder - returns mock data for now)
  app.get('/api/billing', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      res.json({
        plan: 'free',
        status: 'active',
        billingCycle: 'monthly',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        features: {
          maxSpaces: 3,
          maxCaptures: 100,
          aiAnalysis: true,
          teamMembers: 1,
        },
        invoices: [],
      });
    } catch (error) {
      console.error("Error fetching billing:", error);
      res.status(500).json({ message: "Failed to fetch billing info" });
    }
  });

  // ==================== COMPANIES ====================
  
  // Get user's companies
  app.get('/api/companies', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const companies = await storage.getCompanies(userId);
      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  // Create a new company
  app.post('/api/companies', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, logo, industry, size, website } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "Company name is required" });
      }
      
      const company = await storage.createCompany({
        name,
        logo,
        industry,
        size,
        website,
      }, userId);
      
      res.status(201).json({ ...company, role: 'owner' });
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  // Get a specific company
  app.get('/api/companies/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const company = await storage.getCompany(req.params.id);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      const member = await storage.getCompanyMember(req.params.id, userId);
      if (!member) {
        return res.status(403).json({ message: "You don't have access to this company" });
      }
      
      res.json({ ...company, role: member.role });
    } catch (error) {
      console.error("Error fetching company:", error);
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  // Update a company
  app.put('/api/companies/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getCompanyMember(req.params.id, userId);
      
      if (!member) {
        return res.status(403).json({ message: "You don't have access to this company" });
      }
      
      if (member.role !== 'owner' && member.role !== 'admin') {
        return res.status(403).json({ message: "You don't have permission to update this company" });
      }
      
      const { name, logo, industry, size, website } = req.body;
      const company = await storage.updateCompany(req.params.id, {
        name,
        logo,
        industry,
        size,
        website,
      });
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      res.json({ ...company, role: member.role });
    } catch (error) {
      console.error("Error updating company:", error);
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  // Delete a company
  app.delete('/api/companies/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getCompanyMember(req.params.id, userId);
      
      if (!member) {
        return res.status(403).json({ message: "You don't have access to this company" });
      }
      
      if (member.role !== 'owner') {
        return res.status(403).json({ message: "Only the owner can delete this company" });
      }
      
      const deleted = await storage.deleteCompany(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting company:", error);
      res.status(500).json({ message: "Failed to delete company" });
    }
  });

  // Switch to a company (update current company in user settings)
  app.post('/api/companies/:id/switch', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getCompanyMember(req.params.id, userId);
      
      if (!member) {
        return res.status(403).json({ message: "You don't have access to this company" });
      }
      
      await storage.updateUserSettings(userId, {
        currentCompanyId: req.params.id,
      });
      
      const company = await storage.getCompany(req.params.id);
      res.json({ message: "Switched to company", company: { ...company, role: member.role } });
    } catch (error) {
      console.error("Error switching company:", error);
      res.status(500).json({ message: "Failed to switch company" });
    }
  });

  // Get company members
  app.get('/api/companies/:id/members', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await storage.getCompanyMember(req.params.id, userId);
      
      if (!member) {
        return res.status(403).json({ message: "You don't have access to this company" });
      }
      
      const members = await storage.getCompanyMembers(req.params.id);
      res.json(members);
    } catch (error) {
      console.error("Error fetching company members:", error);
      res.status(500).json({ message: "Failed to fetch company members" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
