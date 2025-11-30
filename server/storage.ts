import {
  users,
  spaces,
  workspaces,
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
  companies,
  companyMembers,
  userSettings,
  type User,
  type UpsertUser,
  type Space,
  type InsertSpace,
  type Workspace,
  type InsertWorkspace,
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
  type Company,
  type InsertCompany,
  type CompanyMember,
  type InsertCompanyMember,
  type UserSettings,
  type InsertUserSettings,
} from "../shared/schema";
import { db, pool } from "./db";
import { eq, and, desc, inArray } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Login 2FA operations
  getUserLoginTotp(userId: string): Promise<{ secret: string | null, enabled: boolean }>;
  setUserLoginTotp(userId: string, secret: string | null, enabled: boolean): Promise<void>;

  // Space operations
  getSpaces(ownerId: string): Promise<Space[]>;
  getSpace(id: string): Promise<Space | undefined>;
  createSpace(space: InsertSpace): Promise<Space>;
  updateSpace(id: string, space: Partial<InsertSpace>): Promise<Space | undefined>;
  deleteSpace(id: string): Promise<boolean>;

  // Workspace operations
  getWorkspaces(spaceId: string): Promise<Workspace[]>;
  getWorkspace(id: string): Promise<Workspace | undefined>;
  createWorkspace(workspace: InsertWorkspace): Promise<Workspace>;
  updateWorkspace(id: string, workspace: Partial<InsertWorkspace>): Promise<Workspace | undefined>;
  deleteWorkspace(id: string): Promise<boolean>;

  // Sheet operations
  getSheets(spaceId: string): Promise<Sheet[]>;
  getSheetsByWorkspace(workspaceId: string): Promise<Sheet[]>;
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
  getInsightsByWorkspace(workspaceId: string): Promise<Insight[]>;
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
  getChatThreadsBySpace(spaceId: string): Promise<ChatThread[]>;
  getChatThread(id: string): Promise<ChatThread | undefined>;
  createChatThread(thread: InsertChatThread): Promise<ChatThread>;
  updateChatThread(id: string, thread: Partial<InsertChatThread>): Promise<ChatThread | undefined>;
  deleteChatThread(id: string): Promise<boolean>;

  // Chat message operations
  getChatMessages(threadId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  deleteChatMessages(threadId: string): Promise<boolean>;

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

  // Login 2FA operations
  async getUserLoginTotp(userId: string): Promise<{ secret: string | null, enabled: boolean }> {
    const [user] = await db
      .select({
        loginTotpSecret: users.loginTotpSecret,
        loginTotpEnabled: users.loginTotpEnabled,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return { secret: null, enabled: false };
    }

    return {
      secret: user.loginTotpSecret ?? null,
      enabled: user.loginTotpEnabled ?? false,
    };
  }

  async setUserLoginTotp(userId: string, secret: string | null, enabled: boolean): Promise<void> {
    await db
      .update(users)
      .set({
        loginTotpSecret: secret,
        loginTotpEnabled: enabled,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
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
    
    // Auto-create a default workspace for the new space
    await db.insert(workspaces).values({
      spaceId: created.id,
      name: 'My Workspace',
    });
    
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

  // Workspace operations
  async getWorkspaces(spaceId: string): Promise<Workspace[]> {
    return await db.select().from(workspaces).where(eq(workspaces.spaceId, spaceId)).orderBy(workspaces.name);
  }

  async getWorkspace(id: string): Promise<Workspace | undefined> {
    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, id));
    return workspace;
  }

  async createWorkspace(workspace: InsertWorkspace): Promise<Workspace> {
    const [created] = await db.insert(workspaces).values(workspace).returning();
    return created;
  }

  async updateWorkspace(id: string, workspace: Partial<InsertWorkspace>): Promise<Workspace | undefined> {
    const [updated] = await db
      .update(workspaces)
      .set(workspace)
      .where(eq(workspaces.id, id))
      .returning();
    return updated;
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    // Batch delete related records for performance
    // Uses inArray for bulk operations instead of sequential per-record deletes
    
    // 1. Get all chat thread IDs in this workspace
    const workspaceChatThreads = await db.select({ id: chatThreads.id })
      .from(chatThreads)
      .where(eq(chatThreads.workspaceId, id));
    const threadIds = workspaceChatThreads.map(t => t.id);
    
    // 2. Batch delete all chat messages for these threads (single query)
    if (threadIds.length > 0) {
      await db.delete(chatMessages).where(inArray(chatMessages.threadId, threadIds));
    }
    
    // 3. Delete chat threads in this workspace
    await db.delete(chatThreads).where(eq(chatThreads.workspaceId, id));
    
    // 4. Get all insight IDs in this workspace
    const workspaceInsights = await db.select({ id: insights.id })
      .from(insights)
      .where(eq(insights.workspaceId, id));
    const insightIds = workspaceInsights.map(i => i.id);
    
    // 5. Batch delete insight comments and sources (single query each)
    if (insightIds.length > 0) {
      await Promise.all([
        db.delete(insightComments).where(inArray(insightComments.insightId, insightIds)),
        db.delete(insightSources).where(inArray(insightSources.insightId, insightIds)),
      ]);
    }
    
    // 6. Delete insights, sheets, and change logs in parallel
    await Promise.all([
      db.delete(insights).where(eq(insights.workspaceId, id)),
      db.delete(sheets).where(eq(sheets.workspaceId, id)),
      db.delete(changeLogs).where(eq(changeLogs.workspaceId, id)),
    ]);
    
    // 7. Finally, delete the workspace itself
    const result = await db.delete(workspaces).where(eq(workspaces.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Sheet operations
  async getSheets(spaceId: string): Promise<Sheet[]> {
    return await db.select().from(sheets).where(eq(sheets.spaceId, spaceId)).orderBy(desc(sheets.lastModified));
  }

  async getSheetsByWorkspace(workspaceId: string): Promise<Sheet[]> {
    return await db.select().from(sheets).where(eq(sheets.workspaceId, workspaceId)).orderBy(desc(sheets.lastModified));
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
    return await db.select().from(insights).where(eq(insights.spaceId, spaceId)).orderBy(desc(insights.updatedAt));
  }

  async getInsightsByWorkspace(workspaceId: string): Promise<Insight[]> {
    return await db.select().from(insights).where(eq(insights.workspaceId, workspaceId)).orderBy(desc(insights.updatedAt));
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

  async getChatThreadsBySpace(spaceId: string): Promise<ChatThread[]> {
    return await db
      .select()
      .from(chatThreads)
      .where(eq(chatThreads.spaceId, spaceId))
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
      .set({ ...thread, updatedAt: new Date() })
      .where(eq(chatThreads.id, id))
      .returning();
    return updated;
  }

  async deleteChatThread(id: string): Promise<boolean> {
    await db.delete(chatMessages).where(eq(chatMessages.threadId, id));
    const result = await db.delete(chatThreads).where(eq(chatThreads.id, id));
    return (result.rowCount ?? 0) > 0;
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

  async deleteChatMessages(threadId: string): Promise<boolean> {
    const result = await db.delete(chatMessages).where(eq(chatMessages.threadId, threadId));
    return (result.rowCount ?? 0) > 0;
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

  // Company operations
  async getCompanies(userId: string): Promise<Array<Company & { role: string }>> {
    const memberships = await db
      .select({
        company: companies,
        role: companyMembers.role,
      })
      .from(companyMembers)
      .innerJoin(companies, eq(companyMembers.companyId, companies.id))
      .where(eq(companyMembers.userId, userId));
    
    return memberships.map(m => ({
      ...m.company,
      role: m.role,
    }));
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async createCompany(company: InsertCompany, userId: string): Promise<Company> {
    const [created] = await db.insert(companies).values({
      ...company,
      createdBy: userId,
    }).returning();
    
    await db.insert(companyMembers).values({
      userId,
      companyId: created.id,
      role: 'owner',
    });
    
    return created;
  }

  async updateCompany(id: string, company: Partial<InsertCompany>): Promise<Company | undefined> {
    const [updated] = await db
      .update(companies)
      .set({ ...company, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return updated;
  }

  async deleteCompany(id: string): Promise<boolean> {
    await db.delete(companyMembers).where(eq(companyMembers.companyId, id));
    const result = await db.delete(companies).where(eq(companies.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getCompanyMember(companyId: string, userId: string): Promise<CompanyMember | undefined> {
    const [member] = await db
      .select()
      .from(companyMembers)
      .where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)));
    return member;
  }

  async getCompanyMembers(companyId: string): Promise<Array<CompanyMember & { user: User }>> {
    const members = await db
      .select({
        member: companyMembers,
        user: users,
      })
      .from(companyMembers)
      .innerJoin(users, eq(companyMembers.userId, users.id))
      .where(eq(companyMembers.companyId, companyId));
    
    return members.map(m => ({
      ...m.member,
      user: m.user,
    }));
  }

  async addCompanyMember(member: InsertCompanyMember): Promise<CompanyMember> {
    const [created] = await db.insert(companyMembers).values(member).returning();
    return created;
  }

  async removeCompanyMember(companyId: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(companyMembers)
      .where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async updateCompanyMemberRole(companyId: string, userId: string, role: string): Promise<CompanyMember | undefined> {
    const [updated] = await db
      .update(companyMembers)
      .set({ role })
      .where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)))
      .returning();
    return updated;
  }

  // User settings operations
  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return settings;
  }

  async createUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
    const [created] = await db.insert(userSettings).values(settings).returning();
    return created;
  }

  async updateUserSettings(userId: string, settings: Partial<InsertUserSettings>): Promise<UserSettings | undefined> {
    const existing = await this.getUserSettings(userId);
    
    if (!existing) {
      return await this.createUserSettings({ ...settings, userId });
    }
    
    const [updated] = await db
      .update(userSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId))
      .returning();
    return updated;
  }

  async updateUserProfile(userId: string, profile: Partial<User>): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
