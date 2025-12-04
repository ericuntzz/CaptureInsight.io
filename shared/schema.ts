import { sql, relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
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
  loginTotpSecret: text("login_totp_secret"), // Encrypted TOTP secret for login 2FA
  loginTotpEnabled: boolean("login_totp_enabled").default(false), // Whether login 2FA is enabled
  aiLearningConsent: boolean("ai_learning_consent").default(false), // Whether user consents to anonymous feedback for AI improvement
  aiLearningConsentDate: timestamp("ai_learning_consent_date"), // When consent was given/updated
  hasCompletedOnboarding: boolean("has_completed_onboarding").default(false), // Whether user has seen the welcome screen
  firstLoginAt: timestamp("first_login_at"), // When user first logged in (null = never logged in before)
  lastLoginAt: timestamp("last_login_at"), // Most recent login timestamp
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  ownedSpaces: many(spaces),
  createdSheets: many(sheets),
  createdTags: many(tags),
  createdInsights: many(insights),
  assignedInsights: many(insights, { relationName: "assignedInsights" }),
  chatThreads: many(chatThreads),
  comments: many(insightComments),
  encryptionKey: one(userEncryptionKeys),
}));

// User encryption keys table for E2EE (End-to-End Encryption)
// Stores wrapped Data Encryption Keys (DEK) that can only be unlocked client-side
// securityMode: 0 = Simple (server-side encryption), 1 = Maximum (E2EE with password + 2FA)
export const userEncryptionKeys = pgTable("user_encryption_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  securityMode: integer("security_mode").default(0), // 0=simple, 1=maximum
  wrappedDek: text("wrapped_dek"), // Base64 encoded wrapped DEK (Maximum mode only)
  salt: text("salt"), // Base64 encoded PBKDF2 salt (Maximum mode only)
  iv: text("iv"), // Base64 encoded AES-GCM IV for key wrapping (Maximum mode only)
  serverKeyId: varchar("server_key_id"), // Reference to server-managed key (Simple mode)
  totpSecret: text("totp_secret"), // Encrypted TOTP secret for encryption 2FA (Maximum mode)
  totpEnabled: boolean("totp_enabled").default(false), // Whether encryption 2FA is enabled
  backupCodes: jsonb("backup_codes").$type<string[]>(), // Hashed backup codes
  backupCodesUsed: jsonb("backup_codes_used").$type<string[]>(), // Used backup code hashes
  version: integer("version").default(1),
  passwordHint: varchar("password_hint"), // Optional hint for password recovery
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userEncryptionKeysRelations = relations(userEncryptionKeys, ({ one }) => ({
  user: one(users, {
    fields: [userEncryptionKeys.userId],
    references: [users.id],
  }),
}));

// Server-managed encryption keys for Simple mode
// These keys are managed by the server and encrypted with a master key
export const serverEncryptionKeys = pgTable("server_encryption_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  encryptedKey: text("encrypted_key").notNull(), // AES-256 key encrypted with server master key
  iv: text("iv").notNull(), // IV used for encrypting the key
  createdAt: timestamp("created_at").defaultNow(),
  rotatedAt: timestamp("rotated_at"), // Last key rotation timestamp
});

export const serverEncryptionKeysRelations = relations(serverEncryptionKeys, ({ one }) => ({
  user: one(users, {
    fields: [serverEncryptionKeys.userId],
    references: [users.id],
  }),
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
  workspaces: many(workspaces),
  sheets: many(sheets),
  tags: many(tags),
  insights: many(insights),
  chatThreads: many(chatThreads),
  chatMessages: many(chatMessages),
  changeLogs: many(changeLogs),
}));

// Workspaces table
export const workspaces = pgTable("workspaces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  spaceId: varchar("space_id").references(() => spaces.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  space: one(spaces, {
    fields: [workspaces.spaceId],
    references: [spaces.id],
  }),
  sheets: many(sheets),
  changeLogs: many(changeLogs),
  insights: many(insights),
}));

// Sheets table
export const sheets = pgTable("sheets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  workspaceId: varchar("workspace_id").references(() => workspaces.id),
  spaceId: varchar("space_id").references(() => spaces.id).notNull(),
  rowCount: integer("row_count").default(0),
  lastModified: timestamp("last_modified").defaultNow(),
  dataSourceType: varchar("data_source_type"),
  dataSourceMeta: jsonb("data_source_meta"),
  data: jsonb("data"), // Unencrypted data (legacy/migration)
  cleanedData: jsonb("cleaned_data"), // AI-cleaned structured JSON data for RAG
  cleanedAt: timestamp("cleaned_at"), // When data was last cleaned by AI
  cleaningStatus: varchar("cleaning_status").default("pending"), // pending, processing, completed, failed, validation_failed
  // Quality scoring fields for world-class data processing
  qualityScore: integer("quality_score"), // Overall quality 0-100
  qualityDetails: jsonb("quality_details").$type<{
    confidence: number; // 0-100: How confident AI is in extraction
    completeness: number; // 0-100: Data completeness (no missing values)
    dataRichness: number; // 0-100: Amount of useful data found
    issues?: string[]; // List of quality issues found
  }>(),
  validationResult: jsonb("validation_result").$type<{
    isValid: boolean;
    failureType?: 'empty_image' | 'low_quality' | 'unsupported_format' | 'no_data_found' | 'ai_error' | 'parse_error';
    message?: string;
    details?: {
      textDensity?: number; // For screenshots: estimated text coverage
      contrast?: number; // For screenshots: image contrast score
      fileSize?: number; // For all: file size in bytes
    };
  }>(),
  // Processing progress tracking for real-time UI updates
  processingProgress: jsonb("processing_progress").$type<{
    currentStep: 'ingesting' | 'matching_templates' | 'cleaning' | 'validating' | 'finalizing' | 'complete' | 'failed';
    stepDetails?: string; // e.g., "Applying template: Monthly Sales Report"
    percentComplete?: number; // 0-100
    startedAt?: string;
    templateMatch?: {
      templateId: string;
      templateName: string;
      confidence: number;
      wasAutoApplied: boolean;
    };
  }>(),
  // Template that was applied to this sheet
  appliedTemplateId: varchar("applied_template_id"),
  encryptedData: text("encrypted_data"), // E2EE: Base64 encrypted data
  encryptionIv: text("encryption_iv"), // E2EE: Base64 IV for decryption
  encryptionVersion: integer("encryption_version").default(0), // 0=unencrypted, 1+=E2EE version
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

export const sheetsRelations = relations(sheets, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [sheets.workspaceId],
    references: [workspaces.id],
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
  summary: text("summary"), // Unencrypted summary (legacy/migration)
  encryptedSummary: text("encrypted_summary"), // E2EE: Base64 encrypted summary
  encryptionIv: text("encryption_iv"), // E2EE: Base64 IV for decryption
  encryptionVersion: integer("encryption_version").default(0), // 0=unencrypted, 1+=E2EE version
  status: varchar("status").default("Open"), // 'Open' | 'Closed'
  priority: varchar("priority"), // 'High' | 'Medium' | 'Low'
  spaceId: varchar("space_id").references(() => spaces.id).notNull(),
  workspaceId: varchar("workspace_id").references(() => workspaces.id),
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
  workspace: one(workspaces, {
    fields: [insights.workspaceId],
    references: [workspaces.id],
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

// Chat threads table - space-scoped chat conversations with optional insight context
export const chatThreads = pgTable("chat_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull().default('New Chat'),
  spaceId: varchar("space_id").references(() => spaces.id).notNull(),
  workspaceId: varchar("workspace_id").references(() => workspaces.id),
  insightId: varchar("insight_id").references(() => insights.id),
  userId: varchar("user_id").references(() => users.id),
  savedToMemory: boolean("saved_to_memory").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
}, (table) => [
  index("idx_chat_threads_space").on(table.spaceId),
  index("idx_chat_threads_space_last_message").on(table.spaceId, table.lastMessageAt),
  index("idx_chat_threads_workspace").on(table.workspaceId),
]);

export const chatThreadsRelations = relations(chatThreads, ({ one, many }) => ({
  space: one(spaces, {
    fields: [chatThreads.spaceId],
    references: [spaces.id],
  }),
  workspace: one(workspaces, {
    fields: [chatThreads.workspaceId],
    references: [workspaces.id],
  }),
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
  workspaceId: varchar("workspace_id").references(() => workspaces.id),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
  changes: jsonb("changes"), // Array of change objects
});

export const changeLogsRelations = relations(changeLogs, ({ one }) => ({
  space: one(spaces, {
    fields: [changeLogs.spaceId],
    references: [spaces.id],
  }),
  workspace: one(workspaces, {
    fields: [changeLogs.workspaceId],
    references: [workspaces.id],
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

// AI Feedback table for collecting anonymous user feedback on AI responses
// This data is used to improve AI quality - only collected when user has given consent
export const aiFeedback = pgTable("ai_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").references(() => chatMessages.id), // The AI response being rated
  threadId: varchar("thread_id").references(() => chatThreads.id),
  userId: varchar("user_id").references(() => users.id), // For consent verification only, not included in training data
  rating: integer("rating"), // 1 = thumbs down, 2 = thumbs up (simple binary for now)
  feedbackType: varchar("feedback_type"), // 'helpful' | 'not_helpful' | 'inaccurate' | 'incomplete' | 'other'
  comment: text("comment"), // Optional additional feedback
  // Anonymized context for training (PII stripped)
  anonymizedQuery: text("anonymized_query"), // User's question with PII removed
  anonymizedResponse: text("anonymized_response"), // AI response (already no PII)
  responseMetrics: jsonb("response_metrics").$type<{
    hadCitations: boolean;
    citationCount: number;
    responseLength: number;
    ragContextUsed: boolean;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ai_feedback_user").on(table.userId),
  index("idx_ai_feedback_rating").on(table.rating),
  index("idx_ai_feedback_created").on(table.createdAt),
]);

export const aiFeedbackRelations = relations(aiFeedback, ({ one }) => ({
  message: one(chatMessages, {
    fields: [aiFeedback.messageId],
    references: [chatMessages.id],
  }),
  thread: one(chatThreads, {
    fields: [aiFeedback.threadId],
    references: [chatThreads.id],
  }),
  user: one(users, {
    fields: [aiFeedback.userId],
    references: [users.id],
  }),
}));

// Data Templates table - Intelligent templates for automated data cleaning and structuring
export const dataTemplates = pgTable("data_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  
  // Scope: where this template applies
  scope: varchar("scope").notNull().default('workspace'), // 'workspace' | 'space'
  workspaceId: varchar("workspace_id").references(() => workspaces.id),
  spaceId: varchar("space_id").references(() => spaces.id),
  createdBy: varchar("created_by").references(() => users.id),
  
  // Source type lock (optional) - restricts template to specific sources
  sourceType: varchar("source_type"), // 'google_sheets' | 'csv' | 'google_ads' | 'meta_ads' | 'ga4' | 'custom'
  
  // Source fingerprint for smart matching
  sourceFingerprint: jsonb("source_fingerprint").$type<{
    googleSheetId?: string; // For recurring imports from same spreadsheet
    urlPatterns?: string[]; // URL patterns that match this template
    fileNamePatterns?: string[]; // File name patterns for CSV matching
  }>(),
  
  // Column schema - the heart of the template
  columnSchema: jsonb("column_schema").$type<{
    columns: Array<{
      canonicalName: string; // Standard name (e.g., "ad_spend")
      displayName: string; // User-facing name (e.g., "Ad Spend")
      position: number; // Column order
      dataType: 'currency' | 'percentage' | 'integer' | 'decimal' | 'date' | 'text' | 'boolean';
      isRequired: boolean;
      validationRules?: {
        format?: string; // e.g., "$X.XX" for currency, "MM/DD/YYYY" for dates
        min?: number;
        max?: number;
        maxLength?: number;
        pattern?: string; // Regex pattern
        allowedValues?: string[]; // Enum values
      };
    }>;
  }>(),
  
  // Column aliases for intelligent matching (e.g., "Cost" = "Ad Spend" = "Total Spend")
  columnAliases: jsonb("column_aliases").$type<{
    [canonicalName: string]: string[]; // Maps canonical name to list of aliases
  }>(),
  
  // Default cleaning pipeline - auto-applied on every use
  cleaningPipeline: jsonb("cleaning_pipeline").$type<{
    steps: Array<{
      id: string;
      type: 'remove_commas' | 'strip_currency' | 'convert_percentage' | 'trim_whitespace' | 'convert_date_format' | 'remove_duplicates' | 'fill_empty' | 'custom';
      enabled: boolean;
      config?: {
        targetColumns?: string[]; // Apply to specific columns only
        fromFormat?: string; // For date conversion
        toFormat?: string; // For date conversion
        percentageMode?: 'decimal' | 'whole'; // 0.125 vs 12.5
        fillValue?: string; // For fill_empty
        customRule?: string; // For custom transformations
      };
    }>;
  }>(),
  
  // AI prompt customization for this template
  aiPromptHints: text("ai_prompt_hints"), // Additional context for AI cleaning
  
  // Matching configuration - controls when template auto-applies
  matchingConfig: jsonb("matching_config").$type<{
    autoApplyThreshold: number; // 0-1, default 0.85 - auto-apply if confidence >= this
    suggestThreshold: number; // 0-1, default 0.6 - suggest if confidence >= this
    featureWeights: {
      columnNameSimilarity: number; // Weight for column name matching
      columnTypeMatch: number; // Weight for data type matching
      sourceFingerprint: number; // Weight for URL/file pattern matching
      statisticalProfile: number; // Weight for data distribution matching
    };
  }>().default({
    autoApplyThreshold: 0.85,
    suggestThreshold: 0.6,
    featureWeights: {
      columnNameSimilarity: 0.4,
      columnTypeMatch: 0.25,
      sourceFingerprint: 0.2,
      statisticalProfile: 0.15,
    },
  }),
  
  // Statistical profile for smart matching (populated from sample data)
  statisticalProfile: jsonb("statistical_profile").$type<{
    rowCountRange: [number, number]; // Min/max row count seen
    columnCount: number;
    columnSignatures: {
      [columnName: string]: {
        nullRatio: number;
        uniqueRatio: number;
        sampleValues: string[]; // Hashed sample values
        patternType?: string; // Detected pattern (e.g., "email", "phone", "url")
      };
    };
  }>(),
  
  // Usage tracking
  usageCount: integer("usage_count").default(0),
  lastUsedAt: timestamp("last_used_at"),
  
  // Version control
  version: integer("version").default(1),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_data_templates_workspace").on(table.workspaceId),
  index("idx_data_templates_space").on(table.spaceId),
  index("idx_data_templates_created_by").on(table.createdBy),
  index("idx_data_templates_source_type").on(table.sourceType),
]);

export const dataTemplatesRelations = relations(dataTemplates, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [dataTemplates.workspaceId],
    references: [workspaces.id],
  }),
  space: one(spaces, {
    fields: [dataTemplates.spaceId],
    references: [spaces.id],
  }),
  creator: one(users, {
    fields: [dataTemplates.createdBy],
    references: [users.id],
  }),
}));

// Template applications - tracks which sheets used which templates
export const templateApplications = pgTable("template_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").references(() => dataTemplates.id).notNull(),
  sheetId: varchar("sheet_id").references(() => sheets.id).notNull(),
  matchConfidence: integer("match_confidence"), // 0-100, how confident the match was
  wasAutoApplied: boolean("was_auto_applied").default(false), // true if auto-applied, false if user selected
  appliedAt: timestamp("applied_at").defaultNow(),
  
  // Capture which columns were mapped and any mismatches
  columnMappings: jsonb("column_mappings").$type<{
    [sourceColumn: string]: {
      mappedTo: string; // Template's canonical name
      confidence: number;
      wasUserConfirmed: boolean;
    };
  }>(),
  
  // Track unmapped columns for template improvement
  unmappedColumns: jsonb("unmapped_columns").$type<string[]>(),
});

export const templateApplicationsRelations = relations(templateApplications, ({ one }) => ({
  template: one(dataTemplates, {
    fields: [templateApplications.templateId],
    references: [dataTemplates.id],
  }),
  sheet: one(sheets, {
    fields: [templateApplications.sheetId],
    references: [sheets.id],
  }),
}));

// Pre-built column aliases for common marketing/advertising data
// These are system-wide and supplement user-defined aliases
export const systemColumnAliases = pgTable("system_column_aliases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  canonicalName: varchar("canonical_name").notNull(), // e.g., "ad_spend"
  displayName: varchar("display_name").notNull(), // e.g., "Ad Spend"
  aliases: jsonb("aliases").$type<string[]>().notNull(), // e.g., ["Cost", "Total Spend", "Spend"]
  category: varchar("category").notNull(), // e.g., "advertising", "analytics", "ecommerce"
  dataType: varchar("data_type").notNull(), // Expected data type
  createdAt: timestamp("created_at").defaultNow(),
});

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

export type InsertWorkspace = typeof workspaces.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;

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

export type InsertAiFeedback = typeof aiFeedback.$inferInsert;
export type AiFeedback = typeof aiFeedback.$inferSelect;

export type InsertDataTemplate = typeof dataTemplates.$inferInsert;
export type DataTemplate = typeof dataTemplates.$inferSelect;

export type InsertTemplateApplication = typeof templateApplications.$inferInsert;
export type TemplateApplication = typeof templateApplications.$inferSelect;

export type InsertSystemColumnAlias = typeof systemColumnAliases.$inferInsert;
export type SystemColumnAlias = typeof systemColumnAliases.$inferSelect;
