import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);

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

  // ==================== SPACES ====================
  app.get('/api/spaces', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const spaces = await storage.getSpaces(userId);
      res.json(spaces);
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

  app.get('/api/spaces/:id', isAuthenticated, async (req: any, res) => {
    try {
      const space = await storage.getSpace(req.params.id);
      if (!space) {
        return res.status(404).json({ message: "Space not found" });
      }
      res.json(space);
    } catch (error) {
      console.error("Error fetching space:", error);
      res.status(500).json({ message: "Failed to fetch space" });
    }
  });

  app.put('/api/spaces/:id', isAuthenticated, async (req: any, res) => {
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

  app.delete('/api/spaces/:id', isAuthenticated, async (req: any, res) => {
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

  // ==================== FOLDERS ====================
  app.get('/api/spaces/:spaceId/folders', isAuthenticated, async (req: any, res) => {
    try {
      const folders = await storage.getFolders(req.params.spaceId);
      res.json(folders);
    } catch (error) {
      console.error("Error fetching folders:", error);
      res.status(500).json({ message: "Failed to fetch folders" });
    }
  });

  app.post('/api/spaces/:spaceId/folders', isAuthenticated, async (req: any, res) => {
    try {
      const folder = await storage.createFolder({ ...req.body, spaceId: req.params.spaceId });
      res.status(201).json(folder);
    } catch (error) {
      console.error("Error creating folder:", error);
      res.status(500).json({ message: "Failed to create folder" });
    }
  });

  app.put('/api/folders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const folder = await storage.updateFolder(req.params.id, req.body);
      if (!folder) {
        return res.status(404).json({ message: "Folder not found" });
      }
      res.json(folder);
    } catch (error) {
      console.error("Error updating folder:", error);
      res.status(500).json({ message: "Failed to update folder" });
    }
  });

  app.delete('/api/folders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const deleted = await storage.deleteFolder(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Folder not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting folder:", error);
      res.status(500).json({ message: "Failed to delete folder" });
    }
  });

  // ==================== SHEETS ====================
  app.get('/api/spaces/:spaceId/sheets', isAuthenticated, async (req: any, res) => {
    try {
      const sheets = await storage.getSheets(req.params.spaceId);
      res.json(sheets);
    } catch (error) {
      console.error("Error fetching sheets:", error);
      res.status(500).json({ message: "Failed to fetch sheets" });
    }
  });

  app.get('/api/folders/:folderId/sheets', isAuthenticated, async (req: any, res) => {
    try {
      const sheets = await storage.getSheetsByFolder(req.params.folderId);
      res.json(sheets);
    } catch (error) {
      console.error("Error fetching sheets:", error);
      res.status(500).json({ message: "Failed to fetch sheets" });
    }
  });

  app.post('/api/spaces/:spaceId/sheets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sheet = await storage.createSheet({ ...req.body, spaceId: req.params.spaceId, createdBy: userId });
      res.status(201).json(sheet);
    } catch (error) {
      console.error("Error creating sheet:", error);
      res.status(500).json({ message: "Failed to create sheet" });
    }
  });

  app.get('/api/sheets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const sheet = await storage.getSheet(req.params.id);
      if (!sheet) {
        return res.status(404).json({ message: "Sheet not found" });
      }
      res.json(sheet);
    } catch (error) {
      console.error("Error fetching sheet:", error);
      res.status(500).json({ message: "Failed to fetch sheet" });
    }
  });

  app.put('/api/sheets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const sheet = await storage.updateSheet(req.params.id, req.body);
      if (!sheet) {
        return res.status(404).json({ message: "Sheet not found" });
      }
      res.json(sheet);
    } catch (error) {
      console.error("Error updating sheet:", error);
      res.status(500).json({ message: "Failed to update sheet" });
    }
  });

  app.delete('/api/sheets/:id', isAuthenticated, async (req: any, res) => {
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
  app.get('/api/spaces/:spaceId/tags', isAuthenticated, async (req: any, res) => {
    try {
      const tags = await storage.getTags(req.params.spaceId);
      res.json(tags);
    } catch (error) {
      console.error("Error fetching tags:", error);
      res.status(500).json({ message: "Failed to fetch tags" });
    }
  });

  app.post('/api/spaces/:spaceId/tags', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tag = await storage.createTag({ ...req.body, spaceId: req.params.spaceId, createdBy: userId });
      res.status(201).json(tag);
    } catch (error) {
      console.error("Error creating tag:", error);
      res.status(500).json({ message: "Failed to create tag" });
    }
  });

  app.put('/api/tags/:id', isAuthenticated, async (req: any, res) => {
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

  app.delete('/api/tags/:id', isAuthenticated, async (req: any, res) => {
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
  app.get('/api/spaces/:spaceId/insights', isAuthenticated, async (req: any, res) => {
    try {
      const insights = await storage.getInsights(req.params.spaceId);
      res.json(insights);
    } catch (error) {
      console.error("Error fetching insights:", error);
      res.status(500).json({ message: "Failed to fetch insights" });
    }
  });

  app.post('/api/spaces/:spaceId/insights', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const insight = await storage.createInsight({ ...req.body, spaceId: req.params.spaceId, createdBy: userId });
      res.status(201).json(insight);
    } catch (error) {
      console.error("Error creating insight:", error);
      res.status(500).json({ message: "Failed to create insight" });
    }
  });

  app.get('/api/insights/:id', isAuthenticated, async (req: any, res) => {
    try {
      const insight = await storage.getInsight(req.params.id);
      if (!insight) {
        return res.status(404).json({ message: "Insight not found" });
      }
      res.json(insight);
    } catch (error) {
      console.error("Error fetching insight:", error);
      res.status(500).json({ message: "Failed to fetch insight" });
    }
  });

  app.put('/api/insights/:id', isAuthenticated, async (req: any, res) => {
    try {
      const insight = await storage.updateInsight(req.params.id, req.body);
      if (!insight) {
        return res.status(404).json({ message: "Insight not found" });
      }
      res.json(insight);
    } catch (error) {
      console.error("Error updating insight:", error);
      res.status(500).json({ message: "Failed to update insight" });
    }
  });

  app.delete('/api/insights/:id', isAuthenticated, async (req: any, res) => {
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
  app.get('/api/insights/:insightId/sources', isAuthenticated, async (req: any, res) => {
    try {
      const sources = await storage.getInsightSources(req.params.insightId);
      res.json(sources);
    } catch (error) {
      console.error("Error fetching insight sources:", error);
      res.status(500).json({ message: "Failed to fetch insight sources" });
    }
  });

  app.post('/api/insights/:insightId/sources', isAuthenticated, async (req: any, res) => {
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
  app.get('/api/insights/:insightId/comments', isAuthenticated, async (req: any, res) => {
    try {
      const comments = await storage.getInsightComments(req.params.insightId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching insight comments:", error);
      res.status(500).json({ message: "Failed to fetch insight comments" });
    }
  });

  app.post('/api/insights/:insightId/comments', isAuthenticated, async (req: any, res) => {
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

  // ==================== CHAT THREADS & MESSAGES ====================
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
  app.get('/api/spaces/:spaceId/change-logs', isAuthenticated, async (req: any, res) => {
    try {
      const logs = await storage.getChangeLogs(req.params.spaceId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching change logs:", error);
      res.status(500).json({ message: "Failed to fetch change logs" });
    }
  });

  app.post('/api/spaces/:spaceId/change-logs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const log = await storage.createChangeLog({ ...req.body, spaceId: req.params.spaceId, createdBy: userId });
      res.status(201).json(log);
    } catch (error) {
      console.error("Error creating change log:", error);
      res.status(500).json({ message: "Failed to create change log" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
