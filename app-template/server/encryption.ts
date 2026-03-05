import crypto from 'crypto';
import { db } from './db';
import { serverEncryptionKeys, userEncryptionKeys } from '../shared/schema';
import { eq } from 'drizzle-orm';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getMasterKey(): Buffer {
  const masterKeyEnv = process.env.ENCRYPTION_MASTER_KEY;
  if (!masterKeyEnv) {
    const generatedKey = crypto.randomBytes(KEY_LENGTH).toString('base64');
    console.warn('ENCRYPTION_MASTER_KEY not set. For production, set this environment variable.');
    console.warn('Generated key (save this):', generatedKey);
    return Buffer.from(generatedKey, 'base64');
  }

  const isHex = /^[0-9a-fA-F]+$/.test(masterKeyEnv) && masterKeyEnv.length === 64;

  if (isHex) {
    return Buffer.from(masterKeyEnv, 'hex');
  } else {
    const decoded = Buffer.from(masterKeyEnv, 'base64');
    if (decoded.length !== KEY_LENGTH) {
      throw new Error(`ENCRYPTION_MASTER_KEY must decode to ${KEY_LENGTH} bytes. Got ${decoded.length} bytes.`);
    }
    return decoded;
  }
}

export class ServerEncryptionService {
  private masterKey: Buffer;

  constructor() {
    this.masterKey = getMasterKey();
  }

  private encryptWithMasterKey(data: Buffer): { encrypted: string; iv: string } {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv);

    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      encrypted: Buffer.concat([encrypted, authTag]).toString('base64'),
      iv: iv.toString('base64'),
    };
  }

  private decryptWithMasterKey(encryptedBase64: string, ivBase64: string): Buffer {
    const iv = Buffer.from(ivBase64, 'base64');
    const encryptedWithTag = Buffer.from(encryptedBase64, 'base64');

    const authTag = encryptedWithTag.subarray(-AUTH_TAG_LENGTH);
    const encrypted = encryptedWithTag.subarray(0, -AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKey, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  async getOrCreateUserKey(userId: string): Promise<{ keyId: string; key: Buffer }> {
    const existing = await db
      .select()
      .from(serverEncryptionKeys)
      .where(eq(serverEncryptionKeys.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      const record = existing[0];
      const key = this.decryptWithMasterKey(record.encryptedKey, record.iv);
      return { keyId: record.id, key };
    }

    const newKey = crypto.randomBytes(KEY_LENGTH);
    const { encrypted, iv } = this.encryptWithMasterKey(newKey);

    const [inserted] = await db
      .insert(serverEncryptionKeys)
      .values({
        userId,
        encryptedKey: encrypted,
        iv,
      })
      .returning();

    await db
      .insert(userEncryptionKeys)
      .values({
        userId,
        securityMode: 0,
        serverKeyId: inserted.id,
      })
      .onConflictDoUpdate({
        target: userEncryptionKeys.userId,
        set: {
          securityMode: 0,
          serverKeyId: inserted.id,
          updatedAt: new Date(),
        },
      });

    return { keyId: inserted.id, key: newKey };
  }

  async getUserKey(userId: string): Promise<Buffer | null> {
    const existing = await db
      .select()
      .from(serverEncryptionKeys)
      .where(eq(serverEncryptionKeys.userId, userId))
      .limit(1);

    if (existing.length === 0) {
      return null;
    }

    const record = existing[0];
    return this.decryptWithMasterKey(record.encryptedKey, record.iv);
  }

  encryptData(data: string, key: Buffer): { encrypted: string; iv: string } {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return {
      encrypted: Buffer.concat([encrypted, authTag]).toString('base64'),
      iv: iv.toString('base64'),
    };
  }

  decryptData(encryptedBase64: string, ivBase64: string, key: Buffer): string {
    const iv = Buffer.from(ivBase64, 'base64');
    const encryptedWithTag = Buffer.from(encryptedBase64, 'base64');

    const authTag = encryptedWithTag.subarray(-AUTH_TAG_LENGTH);
    const encrypted = encryptedWithTag.subarray(0, -AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  async encryptForUser(userId: string, data: string): Promise<{ encrypted: string; iv: string }> {
    const { key } = await this.getOrCreateUserKey(userId);
    return this.encryptData(data, key);
  }

  async decryptForUser(userId: string, encryptedBase64: string, ivBase64: string): Promise<string | null> {
    const key = await this.getUserKey(userId);
    if (!key) {
      return null;
    }
    return this.decryptData(encryptedBase64, ivBase64, key);
  }

  async rotateUserKey(userId: string): Promise<void> {
    const newKey = crypto.randomBytes(KEY_LENGTH);
    const { encrypted, iv } = this.encryptWithMasterKey(newKey);

    await db
      .update(serverEncryptionKeys)
      .set({
        encryptedKey: encrypted,
        iv,
        rotatedAt: new Date(),
      })
      .where(eq(serverEncryptionKeys.userId, userId));
  }

  async deleteUserKey(userId: string): Promise<void> {
    await db
      .delete(serverEncryptionKeys)
      .where(eq(serverEncryptionKeys.userId, userId));
  }

  async getSecurityMode(userId: string): Promise<number> {
    const record = await db
      .select({ securityMode: userEncryptionKeys.securityMode })
      .from(userEncryptionKeys)
      .where(eq(userEncryptionKeys.userId, userId))
      .limit(1);

    return record.length > 0 ? (record[0].securityMode ?? 0) : 0;
  }

  generateBackupCodes(count: number = 8): { codes: string[]; hashes: string[] } {
    const codes: string[] = [];
    const hashes: string[] = [];

    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
      hashes.push(this.hashBackupCode(code));
    }

    return { codes, hashes };
  }

  hashBackupCode(code: string): string {
    return crypto
      .createHash('sha256')
      .update(code.toUpperCase().replace(/-/g, ''))
      .digest('hex');
  }

  verifyBackupCode(code: string, hashes: string[]): boolean {
    const inputHash = this.hashBackupCode(code);
    return hashes.includes(inputHash);
  }
}

export const serverEncryption = new ServerEncryptionService();
