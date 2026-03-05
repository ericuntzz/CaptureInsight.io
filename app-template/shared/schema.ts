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
} from "drizzle-orm/pg-core";

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

// Infer types for use in storage and routes
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;

// User encryption keys table for E2EE (End-to-End Encryption)
// securityMode: 0 = Simple (server-side encryption), 1 = Maximum (E2EE with password + 2FA)
export const userEncryptionKeys = pgTable("user_encryption_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  securityMode: integer("security_mode").default(0),
  wrappedDek: text("wrapped_dek"),
  salt: text("salt"),
  iv: text("iv"),
  serverKeyId: varchar("server_key_id"),
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").default(false),
  backupCodes: jsonb("backup_codes").$type<string[]>(),
  backupCodesUsed: jsonb("backup_codes_used").$type<string[]>(),
  version: integer("version").default(1),
  passwordHint: varchar("password_hint"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Server-managed encryption keys for Simple mode
export const serverEncryptionKeys = pgTable("server_encryption_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  encryptedKey: text("encrypted_key").notNull(),
  iv: text("iv").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  rotatedAt: timestamp("rotated_at"),
});

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  encryptionKey: one(userEncryptionKeys),
}));

export const userEncryptionKeysRelations = relations(userEncryptionKeys, ({ one }) => ({
  user: one(users, {
    fields: [userEncryptionKeys.userId],
    references: [users.id],
  }),
}));

export const serverEncryptionKeysRelations = relations(serverEncryptionKeys, ({ one }) => ({
  user: one(users, {
    fields: [serverEncryptionKeys.userId],
    references: [users.id],
  }),
}));
