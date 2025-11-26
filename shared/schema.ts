import { sql, relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  customType,
} from "drizzle-orm/pg-core";

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return value.slice(1, -1).split(',').map(Number);
  },
});

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  ownedSpaces: many(spaces),
  createdSheets: many(sheets),
  createdTags: many(tags),
  createdInsights: many(insights),
  assignedInsights: many(insights, { relationName: "assignedInsights" }),
  chatThreads: many(chatThreads),
  comments: many(insightComments),
}));

// Spaces table
export const spaces = pgTable("spaces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  goals: text("goals"),
  instructions: text("instructions"),
  ownerId: varchar("owner_id").references(() => users.id),
  aiSettings: jsonb("ai_settings").$type<{
    consentGiven?: boolean;
    consentDate?: string;
    piiFilterEnabled?: boolean;
    piiFilterPatterns?: string[];
    dataProcessingAllowed?: boolean;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const spacesRelations = relations(spaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [spaces.ownerId],
    references: [users.id],
  }),
  folders: many(folders),
  sheets: many(sheets),
  tags: many(tags),
  insights: many(insights),
  chatMessages: many(chatMessages),
  changeLogs: many(changeLogs),
}));

// Folders table
export const folders = pgTable("folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  spaceId: varchar("space_id").references(() => spaces.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const foldersRelations = relations(folders, ({ one, many }) => ({
  space: one(spaces, {
    fields: [folders.spaceId],
    references: [spaces.id],
  }),
  sheets: many(sheets),
  changeLogs: many(changeLogs),
}));

// Sheets table
export const sheets = pgTable("sheets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  folderId: varchar("folder_id").references(() => folders.id),
  spaceId: varchar("space_id").references(() => spaces.id).notNull(),
  rowCount: integer("row_count").default(0),
  lastModified: timestamp("last_modified").defaultNow(),
  dataSourceType: varchar("data_source_type"),
  dataSourceMeta: jsonb("data_source_meta"),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

export const sheetsRelations = relations(sheets, ({ one }) => ({
  folder: one(folders, {
    fields: [sheets.folderId],
    references: [folders.id],
  }),
  space: one(spaces, {
    fields: [sheets.spaceId],
    references: [spaces.id],
  }),
  creator: one(users, {
    fields: [sheets.createdBy],
    references: [users.id],
  }),
}));

// Tags table
export const tags = pgTable("tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  color: varchar("color").notNull(),
  spaceId: varchar("space_id").references(() => spaces.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

export const tagsRelations = relations(tags, ({ one, many }) => ({
  space: one(spaces, {
    fields: [tags.spaceId],
    references: [spaces.id],
  }),
  creator: one(users, {
    fields: [tags.createdBy],
    references: [users.id],
  }),
  associations: many(tagAssociations),
}));

// Tag associations table
export const tagAssociations = pgTable("tag_associations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tagId: varchar("tag_id").references(() => tags.id).notNull(),
  entityType: varchar("entity_type").notNull(), // 'chat_message' | 'data_sheet' | 'change_log' | 'insight'
  entityId: varchar("entity_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

export const tagAssociationsRelations = relations(tagAssociations, ({ one }) => ({
  tag: one(tags, {
    fields: [tagAssociations.tagId],
    references: [tags.id],
  }),
  creator: one(users, {
    fields: [tagAssociations.createdBy],
    references: [users.id],
  }),
}));

// Insights table
export const insights = pgTable("insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  summary: text("summary"),
  status: varchar("status").default("Open"), // 'Open' | 'Closed'
  priority: varchar("priority"), // 'High' | 'Medium' | 'Low'
  spaceId: varchar("space_id").references(() => spaces.id).notNull(),
  assignedTo: varchar("assigned_to").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insightsRelations = relations(insights, ({ one, many }) => ({
  space: one(spaces, {
    fields: [insights.spaceId],
    references: [spaces.id],
  }),
  assignee: one(users, {
    fields: [insights.assignedTo],
    references: [users.id],
    relationName: "assignedInsights",
  }),
  creator: one(users, {
    fields: [insights.createdBy],
    references: [users.id],
  }),
  sources: many(insightSources),
  comments: many(insightComments),
  chatThreads: many(chatThreads),
}));

// Insight sources table
export const insightSources = pgTable("insight_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  insightId: varchar("insight_id").references(() => insights.id).notNull(),
  sourceType: varchar("source_type").notNull(), // 'chat' | 'capture' | 'datasheet' | 'changelog'
  sourceId: varchar("source_id").notNull(),
  sourceName: varchar("source_name"),
  sourceUrl: varchar("source_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insightSourcesRelations = relations(insightSources, ({ one }) => ({
  insight: one(insights, {
    fields: [insightSources.insightId],
    references: [insights.id],
  }),
}));

// Insight comments table
export const insightComments = pgTable("insight_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  insightId: varchar("insight_id").references(() => insights.id).notNull(),
  content: text("content").notNull(),
  authorId: varchar("author_id").references(() => users.id),
  parentId: varchar("parent_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  mentions: jsonb("mentions"), // Array of user IDs
});

export const insightCommentsRelations = relations(insightComments, ({ one }) => ({
  insight: one(insights, {
    fields: [insightComments.insightId],
    references: [insights.id],
  }),
  author: one(users, {
    fields: [insightComments.authorId],
    references: [users.id],
  }),
}));

// Chat threads table
export const chatThreads = pgTable("chat_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  insightId: varchar("insight_id").references(() => insights.id),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
});

export const chatThreadsRelations = relations(chatThreads, ({ one, many }) => ({
  insight: one(insights, {
    fields: [chatThreads.insightId],
    references: [insights.id],
  }),
  user: one(users, {
    fields: [chatThreads.userId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}));

// Chat messages table
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").references(() => chatThreads.id),
  role: varchar("role").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  spaceId: varchar("space_id").references(() => spaces.id),
  citations: jsonb("citations"), // Array of citation objects
});

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  thread: one(chatThreads, {
    fields: [chatMessages.threadId],
    references: [chatThreads.id],
  }),
  space: one(spaces, {
    fields: [chatMessages.spaceId],
    references: [spaces.id],
  }),
}));

// Change logs table
export const changeLogs = pgTable("change_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  spaceId: varchar("space_id").references(() => spaces.id).notNull(),
  folderId: varchar("folder_id").references(() => folders.id),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
  changes: jsonb("changes"), // Array of change objects
});

export const changeLogsRelations = relations(changeLogs, ({ one }) => ({
  space: one(spaces, {
    fields: [changeLogs.spaceId],
    references: [spaces.id],
  }),
  folder: one(folders, {
    fields: [changeLogs.folderId],
    references: [folders.id],
  }),
  creator: one(users, {
    fields: [changeLogs.createdBy],
    references: [users.id],
  }),
}));

// Document embeddings table with pgvector support for semantic search
export const documentEmbeddings = pgTable("document_embeddings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: varchar("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  content: text("content"),
  embedding: vector("embedding"),
  metadata: jsonb("metadata"),
  spaceId: varchar("space_id").references(() => spaces.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_document_embeddings_space").on(table.spaceId),
  index("idx_document_embeddings_entity").on(table.entityType, table.entityId),
]);

// Companies table
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  logo: varchar("logo"),
  industry: varchar("industry"),
  size: varchar("size"),
  website: varchar("website"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

export const companiesRelations = relations(companies, ({ one, many }) => ({
  creator: one(users, {
    fields: [companies.createdBy],
    references: [users.id],
  }),
  members: many(companyMembers),
}));

// Company members junction table
export const companyMembers = pgTable("company_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  companyId: varchar("company_id").references(() => companies.id).notNull(),
  role: varchar("role").notNull().default('member'),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const companyMembersRelations = relations(companyMembers, ({ one }) => ({
  user: one(users, {
    fields: [companyMembers.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [companyMembers.companyId],
    references: [companies.id],
  }),
}));

// User settings table for preferences and notifications
export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  theme: varchar("theme").default('dark'),
  language: varchar("language").default('en'),
  timezone: varchar("timezone").default('UTC'),
  dateFormat: varchar("date_format").default('MM/DD/YYYY'),
  emailNotifications: jsonb("email_notifications").$type<{
    marketing: boolean;
    updates: boolean;
    insights: boolean;
    comments: boolean;
    mentions: boolean;
  }>().default({
    marketing: false,
    updates: true,
    insights: true,
    comments: true,
    mentions: true,
  }),
  pushNotifications: jsonb("push_notifications").$type<{
    enabled: boolean;
    insights: boolean;
    comments: boolean;
    mentions: boolean;
  }>().default({
    enabled: true,
    insights: true,
    comments: true,
    mentions: true,
  }),
  currentCompanyId: varchar("current_company_id").references(() => companies.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
  currentCompany: one(companies, {
    fields: [userSettings.currentCompanyId],
    references: [companies.id],
  }),
}));

// Export types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertCompany = typeof companies.$inferInsert;
export type Company = typeof companies.$inferSelect;

export type InsertCompanyMember = typeof companyMembers.$inferInsert;
export type CompanyMember = typeof companyMembers.$inferSelect;

export type InsertUserSettings = typeof userSettings.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;

export type InsertSpace = typeof spaces.$inferInsert;
export type Space = typeof spaces.$inferSelect;

export type InsertFolder = typeof folders.$inferInsert;
export type Folder = typeof folders.$inferSelect;

export type InsertSheet = typeof sheets.$inferInsert;
export type Sheet = typeof sheets.$inferSelect;

export type InsertTag = typeof tags.$inferInsert;
export type Tag = typeof tags.$inferSelect;

export type InsertTagAssociation = typeof tagAssociations.$inferInsert;
export type TagAssociation = typeof tagAssociations.$inferSelect;

export type InsertInsight = typeof insights.$inferInsert;
export type Insight = typeof insights.$inferSelect;

export type InsertInsightSource = typeof insightSources.$inferInsert;
export type InsightSource = typeof insightSources.$inferSelect;

export type InsertInsightComment = typeof insightComments.$inferInsert;
export type InsightComment = typeof insightComments.$inferSelect;

export type InsertChatThread = typeof chatThreads.$inferInsert;
export type ChatThread = typeof chatThreads.$inferSelect;

export type InsertChatMessage = typeof chatMessages.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;

export type InsertChangeLog = typeof changeLogs.$inferInsert;
export type ChangeLog = typeof changeLogs.$inferSelect;

export type InsertDocumentEmbedding = typeof documentEmbeddings.$inferInsert;
export type DocumentEmbedding = typeof documentEmbeddings.$inferSelect;
