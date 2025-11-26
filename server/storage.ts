import {
  users,
  spaces,
  folders,
  sheets,
  tags,
  tagAssociations,
  insights,
  insightSources,
  insightComments,
  chatThreads,
  chatMessages,
  changeLogs,
  documentEmbeddings,
  type User,
  type UpsertUser,
  type Space,
  type InsertSpace,
  type Folder,
  type InsertFolder,
  type Sheet,
  type InsertSheet,
  type Tag,
  type InsertTag,
  type TagAssociation,
  type InsertTagAssociation,
  type Insight,
  type InsertInsight,
  type InsightSource,
  type InsertInsightSource,
  type InsightComment,
  type InsertInsightComment,
  type ChatThread,
  type InsertChatThread,
  type ChatMessage,
  type InsertChatMessage,
  type ChangeLog,
  type InsertChangeLog,
  type DocumentEmbedding,
  type InsertDocumentEmbedding,
} from "../shared/schema";
import { db, pool } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Space operations
  getSpaces(ownerId: string): Promise<Space[]>;
  getSpace(id: string): Promise<Space | undefined>;
  createSpace(space: InsertSpace): Promise<Space>;
  updateSpace(id: string, space: Partial<InsertSpace>): Promise<Space | undefined>;
  deleteSpace(id: string): Promise<boolean>;

  // Folder operations
  getFolders(spaceId: string): Promise<Folder[]>;
  getFolder(id: string): Promise<Folder | undefined>;
  createFolder(folder: InsertFolder): Promise<Folder>;
  updateFolder(id: string, folder: Partial<InsertFolder>): Promise<Folder | undefined>;
  deleteFolder(id: string): Promise<boolean>;

  // Sheet operations
  getSheets(spaceId: string): Promise<Sheet[]>;
  getSheetsByFolder(folderId: string): Promise<Sheet[]>;
  getSheet(id: string): Promise<Sheet | undefined>;
  createSheet(sheet: InsertSheet): Promise<Sheet>;
  updateSheet(id: string, sheet: Partial<InsertSheet>): Promise<Sheet | undefined>;
  deleteSheet(id: string): Promise<boolean>;

  // Tag operations
  getTags(spaceId: string): Promise<Tag[]>;
  getTag(id: string): Promise<Tag | undefined>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTag(id: string, tag: Partial<InsertTag>): Promise<Tag | undefined>;
  deleteTag(id: string): Promise<boolean>;

  // Tag association operations
  getTagAssociations(entityType: string, entityId: string): Promise<TagAssociation[]>;
  createTagAssociation(association: InsertTagAssociation): Promise<TagAssociation>;
  deleteTagAssociation(tagId: string, entityType: string, entityId: string): Promise<boolean>;

  // Insight operations
  getInsights(spaceId: string): Promise<Insight[]>;
  getInsight(id: string): Promise<Insight | undefined>;
  createInsight(insight: InsertInsight): Promise<Insight>;
  updateInsight(id: string, insight: Partial<InsertInsight>): Promise<Insight | undefined>;
  deleteInsight(id: string): Promise<boolean>;

  // Insight source operations
  getInsightSources(insightId: string): Promise<InsightSource[]>;
  createInsightSource(source: InsertInsightSource): Promise<InsightSource>;
  deleteInsightSource(id: string): Promise<boolean>;

  // Insight comment operations
  getInsightComments(insightId: string): Promise<InsightComment[]>;
  createInsightComment(comment: InsertInsightComment): Promise<InsightComment>;
  updateInsightComment(id: string, comment: Partial<InsertInsightComment>): Promise<InsightComment | undefined>;
  deleteInsightComment(id: string): Promise<boolean>;

  // Chat thread operations
  getChatThreads(userId: string): Promise<ChatThread[]>;
  getChatThread(id: string): Promise<ChatThread | undefined>;
  createChatThread(thread: InsertChatThread): Promise<ChatThread>;
  updateChatThread(id: string, thread: Partial<InsertChatThread>): Promise<ChatThread | undefined>;

  // Chat message operations
  getChatMessages(threadId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  // Change log operations
  getChangeLogs(spaceId: string): Promise<ChangeLog[]>;
  createChangeLog(changeLog: InsertChangeLog): Promise<ChangeLog>;

  // Document embedding operations
  createDocumentEmbedding(data: InsertDocumentEmbedding): Promise<DocumentEmbedding>;
  getDocumentEmbedding(entityType: string, entityId: string): Promise<DocumentEmbedding | undefined>;
  deleteDocumentEmbedding(entityType: string, entityId: string): Promise<boolean>;
  searchSimilarDocuments(embedding: number[], spaceId: string, limit?: number): Promise<Array<DocumentEmbedding & { similarity: number }>>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Space operations
  async getSpaces(ownerId: string): Promise<Space[]> {
    return await db.select().from(spaces).where(eq(spaces.ownerId, ownerId)).orderBy(desc(spaces.createdAt));
  }

  async getSpace(id: string): Promise<Space | undefined> {
    const [space] = await db.select().from(spaces).where(eq(spaces.id, id));
    return space;
  }

  async createSpace(space: InsertSpace): Promise<Space> {
    const [created] = await db.insert(spaces).values(space).returning();
    return created;
  }

  async updateSpace(id: string, space: Partial<InsertSpace>): Promise<Space | undefined> {
    const [updated] = await db
      .update(spaces)
      .set({ ...space, updatedAt: new Date() })
      .where(eq(spaces.id, id))
      .returning();
    return updated;
  }

  async deleteSpace(id: string): Promise<boolean> {
    const result = await db.delete(spaces).where(eq(spaces.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Folder operations
  async getFolders(spaceId: string): Promise<Folder[]> {
    return await db.select().from(folders).where(eq(folders.spaceId, spaceId)).orderBy(folders.name);
  }

  async getFolder(id: string): Promise<Folder | undefined> {
    const [folder] = await db.select().from(folders).where(eq(folders.id, id));
    return folder;
  }

  async createFolder(folder: InsertFolder): Promise<Folder> {
    const [created] = await db.insert(folders).values(folder).returning();
    return created;
  }

  async updateFolder(id: string, folder: Partial<InsertFolder>): Promise<Folder | undefined> {
    const [updated] = await db
      .update(folders)
      .set(folder)
      .where(eq(folders.id, id))
      .returning();
    return updated;
  }

  async deleteFolder(id: string): Promise<boolean> {
    const result = await db.delete(folders).where(eq(folders.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Sheet operations
  async getSheets(spaceId: string): Promise<Sheet[]> {
    return await db.select().from(sheets).where(eq(sheets.spaceId, spaceId)).orderBy(desc(sheets.lastModified));
  }

  async getSheetsByFolder(folderId: string): Promise<Sheet[]> {
    return await db.select().from(sheets).where(eq(sheets.folderId, folderId)).orderBy(desc(sheets.lastModified));
  }

  async getSheet(id: string): Promise<Sheet | undefined> {
    const [sheet] = await db.select().from(sheets).where(eq(sheets.id, id));
    return sheet;
  }

  async createSheet(sheet: InsertSheet): Promise<Sheet> {
    const [created] = await db.insert(sheets).values(sheet).returning();
    return created;
  }

  async updateSheet(id: string, sheet: Partial<InsertSheet>): Promise<Sheet | undefined> {
    const [updated] = await db
      .update(sheets)
      .set({ ...sheet, lastModified: new Date() })
      .where(eq(sheets.id, id))
      .returning();
    return updated;
  }

  async deleteSheet(id: string): Promise<boolean> {
    const result = await db.delete(sheets).where(eq(sheets.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Tag operations
  async getTags(spaceId: string): Promise<Tag[]> {
    return await db.select().from(tags).where(eq(tags.spaceId, spaceId)).orderBy(tags.name);
  }

  async getTag(id: string): Promise<Tag | undefined> {
    const [tag] = await db.select().from(tags).where(eq(tags.id, id));
    return tag;
  }

  async createTag(tag: InsertTag): Promise<Tag> {
    const [created] = await db.insert(tags).values(tag).returning();
    return created;
  }

  async updateTag(id: string, tag: Partial<InsertTag>): Promise<Tag | undefined> {
    const [updated] = await db
      .update(tags)
      .set(tag)
      .where(eq(tags.id, id))
      .returning();
    return updated;
  }

  async deleteTag(id: string): Promise<boolean> {
    await db.delete(tagAssociations).where(eq(tagAssociations.tagId, id));
    const result = await db.delete(tags).where(eq(tags.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Tag association operations
  async getTagAssociations(entityType: string, entityId: string): Promise<TagAssociation[]> {
    return await db
      .select()
      .from(tagAssociations)
      .where(and(eq(tagAssociations.entityType, entityType), eq(tagAssociations.entityId, entityId)));
  }

  async createTagAssociation(association: InsertTagAssociation): Promise<TagAssociation> {
    const [created] = await db.insert(tagAssociations).values(association).returning();
    return created;
  }

  async deleteTagAssociation(tagId: string, entityType: string, entityId: string): Promise<boolean> {
    const result = await db
      .delete(tagAssociations)
      .where(
        and(
          eq(tagAssociations.tagId, tagId),
          eq(tagAssociations.entityType, entityType),
          eq(tagAssociations.entityId, entityId)
        )
      );
    return (result.rowCount ?? 0) > 0;
  }

  // Insight operations
  async getInsights(spaceId: string): Promise<Insight[]> {
    return await db.select().from(insights).where(eq(insights.spaceId, spaceId)).orderBy(desc(insights.createdAt));
  }

  async getInsight(id: string): Promise<Insight | undefined> {
    const [insight] = await db.select().from(insights).where(eq(insights.id, id));
    return insight;
  }

  async createInsight(insight: InsertInsight): Promise<Insight> {
    const [created] = await db.insert(insights).values(insight).returning();
    return created;
  }

  async updateInsight(id: string, insight: Partial<InsertInsight>): Promise<Insight | undefined> {
    const [updated] = await db
      .update(insights)
      .set({ ...insight, updatedAt: new Date() })
      .where(eq(insights.id, id))
      .returning();
    return updated;
  }

  async deleteInsight(id: string): Promise<boolean> {
    await db.delete(insightSources).where(eq(insightSources.insightId, id));
    await db.delete(insightComments).where(eq(insightComments.insightId, id));
    const result = await db.delete(insights).where(eq(insights.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Insight source operations
  async getInsightSources(insightId: string): Promise<InsightSource[]> {
    return await db.select().from(insightSources).where(eq(insightSources.insightId, insightId));
  }

  async createInsightSource(source: InsertInsightSource): Promise<InsightSource> {
    const [created] = await db.insert(insightSources).values(source).returning();
    return created;
  }

  async deleteInsightSource(id: string): Promise<boolean> {
    const result = await db.delete(insightSources).where(eq(insightSources.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Insight comment operations
  async getInsightComments(insightId: string): Promise<InsightComment[]> {
    return await db
      .select()
      .from(insightComments)
      .where(eq(insightComments.insightId, insightId))
      .orderBy(insightComments.createdAt);
  }

  async createInsightComment(comment: InsertInsightComment): Promise<InsightComment> {
    const [created] = await db.insert(insightComments).values(comment).returning();
    return created;
  }

  async updateInsightComment(id: string, comment: Partial<InsertInsightComment>): Promise<InsightComment | undefined> {
    const [updated] = await db
      .update(insightComments)
      .set({ ...comment, updatedAt: new Date() })
      .where(eq(insightComments.id, id))
      .returning();
    return updated;
  }

  async deleteInsightComment(id: string): Promise<boolean> {
    const result = await db.delete(insightComments).where(eq(insightComments.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Chat thread operations
  async getChatThreads(userId: string): Promise<ChatThread[]> {
    return await db
      .select()
      .from(chatThreads)
      .where(eq(chatThreads.userId, userId))
      .orderBy(desc(chatThreads.lastMessageAt));
  }

  async getChatThread(id: string): Promise<ChatThread | undefined> {
    const [thread] = await db.select().from(chatThreads).where(eq(chatThreads.id, id));
    return thread;
  }

  async createChatThread(thread: InsertChatThread): Promise<ChatThread> {
    const [created] = await db.insert(chatThreads).values(thread).returning();
    return created;
  }

  async updateChatThread(id: string, thread: Partial<InsertChatThread>): Promise<ChatThread | undefined> {
    const [updated] = await db
      .update(chatThreads)
      .set(thread)
      .where(eq(chatThreads.id, id))
      .returning();
    return updated;
  }

  // Chat message operations
  async getChatMessages(threadId: string): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.threadId, threadId))
      .orderBy(chatMessages.createdAt);
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [created] = await db.insert(chatMessages).values(message).returning();
    if (message.threadId) {
      await this.updateChatThread(message.threadId, { lastMessageAt: new Date() });
    }
    return created;
  }

  // Change log operations
  async getChangeLogs(spaceId: string): Promise<ChangeLog[]> {
    return await db
      .select()
      .from(changeLogs)
      .where(eq(changeLogs.spaceId, spaceId))
      .orderBy(desc(changeLogs.createdAt));
  }

  async createChangeLog(changeLog: InsertChangeLog): Promise<ChangeLog> {
    const [created] = await db.insert(changeLogs).values(changeLog).returning();
    return created;
  }

  // Document embedding operations
  async createDocumentEmbedding(data: InsertDocumentEmbedding): Promise<DocumentEmbedding> {
    await db
      .delete(documentEmbeddings)
      .where(
        and(
          eq(documentEmbeddings.entityType, data.entityType),
          eq(documentEmbeddings.entityId, data.entityId)
        )
      );
    
    const [created] = await db.insert(documentEmbeddings).values(data).returning();
    return created;
  }

  async getDocumentEmbedding(entityType: string, entityId: string): Promise<DocumentEmbedding | undefined> {
    const [embedding] = await db
      .select()
      .from(documentEmbeddings)
      .where(
        and(
          eq(documentEmbeddings.entityType, entityType),
          eq(documentEmbeddings.entityId, entityId)
        )
      );
    return embedding;
  }

  async deleteDocumentEmbedding(entityType: string, entityId: string): Promise<boolean> {
    const result = await db
      .delete(documentEmbeddings)
      .where(
        and(
          eq(documentEmbeddings.entityType, entityType),
          eq(documentEmbeddings.entityId, entityId)
        )
      );
    return (result.rowCount ?? 0) > 0;
  }

  async searchSimilarDocuments(
    embedding: number[],
    spaceId: string,
    limit: number = 10
  ): Promise<Array<DocumentEmbedding & { similarity: number }>> {
    const embeddingStr = `[${embedding.join(',')}]`;
    
    const result = await pool.query(
      `SELECT 
        id, 
        entity_type as "entityType", 
        entity_id as "entityId", 
        content, 
        metadata, 
        space_id as "spaceId", 
        created_at as "createdAt",
        embedding,
        1 - (embedding <=> $1::vector) as similarity
      FROM document_embeddings
      WHERE space_id = $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3`,
      [embeddingStr, spaceId, limit]
    );
    
    return result.rows.map(row => ({
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      content: row.content,
      embedding: row.embedding ? row.embedding.slice(1, -1).split(',').map(Number) : null,
      metadata: row.metadata,
      spaceId: row.spaceId,
      createdAt: row.createdAt,
      similarity: parseFloat(row.similarity),
    }));
  }
}

export const storage = new DatabaseStorage();
