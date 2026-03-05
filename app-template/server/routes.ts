import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { serverEncryption } from "./encryption";
import { db } from "./db";
import { userEncryptionKeys, serverEncryptionKeys } from "../shared/schema";
import { eq } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up Replit Auth
  await setupAuth(app);

  // ── Auth Routes ───────────────────────────────────────────────────────
  app.get("/api/auth/user", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const claims = (req.user as any).claims;
    if (!claims) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = claims["sub"];
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  });

  // ── Security Routes ───────────────────────────────────────────────────
  app.get("/api/security/status", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims["sub"];
    const mode = await serverEncryption.getSecurityMode(userId);

    const encKeys = await db
      .select()
      .from(userEncryptionKeys)
      .where(eq(userEncryptionKeys.userId, userId))
      .limit(1);

    res.json({
      securityMode: mode,
      totpEnabled: encKeys[0]?.totpEnabled ?? false,
      hasBackupCodes: (encKeys[0]?.backupCodes as string[] | null)?.length ? true : false,
      passwordHint: encKeys[0]?.passwordHint ?? null,
    });
  });

  app.post("/api/security/setup-simple", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims["sub"];

    try {
      const { keyId } = await serverEncryption.getOrCreateUserKey(userId);
      res.json({ success: true, keyId });
    } catch (error) {
      console.error("Simple encryption setup error:", error);
      res.status(500).json({ message: "Failed to set up encryption" });
    }
  });

  // ── Health Check ──────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ── Add your app routes here ──────────────────────────────────────────
  // Example:
  // app.get("/api/items", isAuthenticated, async (req, res) => {
  //   const userId = (req.user as any).claims["sub"];
  //   // ... your logic
  // });

  const httpServer = createServer(app);
  return httpServer;
}
