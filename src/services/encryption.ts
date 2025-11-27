/**
 * End-to-End Encryption Service
 * 
 * Implements client-side encryption using Web Crypto API:
 * - AES-256-GCM for data encryption (authenticated encryption)
 * - PBKDF2 for key derivation from password
 * - Key wrapping for secure DEK storage
 * - TOTP secret generation for Maximum Security mode
 * - Backup codes generation with SHA-256 hashing
 * 
 * Architecture:
 * User Password → PBKDF2 → KEK (Key Encryption Key, never leaves client)
 *                           ↓
 *                    Unwrap DEK (Data Encryption Key, stored encrypted in DB)
 *                           ↓
 *                    Encrypt/Decrypt user data locally
 */

// Encryption configuration
const ENCRYPTION_CONFIG = {
  algorithm: 'AES-GCM',
  keyLength: 256,
  ivLength: 12, // 96 bits for GCM
  saltLength: 16, // 128 bits
  pbkdf2Iterations: 100000,
  tagLength: 128, // GCM auth tag length in bits
};

// Security mode configuration
const SECURITY_MODE_STORAGE_KEY = 'captureinsight_security_mode';
const BACKUP_CODE_LENGTH = 8;
const BACKUP_CODE_COUNT = 8;
const TOTP_SECRET_LENGTH = 20; // 160 bits for TOTP secret

// Base32 alphabet for TOTP secret encoding (RFC 4648)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export enum SecurityMode {
  SIMPLE = 0,
  MAXIMUM = 1,
}

export interface SecurityStatus {
  mode: SecurityMode;
  totpEnabled: boolean;
  hasBackupCodes: boolean;
  isUnlocked: boolean;
}

export interface GeneratedBackupCodes {
  plaintextCodes: string[];
  hashedCodes: string[];
}

export interface EncryptedData {
  ciphertext: string; // Base64 encoded
  iv: string; // Base64 encoded
  version: number;
}

export interface WrappedKey {
  wrappedDek: string; // Base64 encoded wrapped DEK
  salt: string; // Base64 encoded PBKDF2 salt
  iv: string; // Base64 encoded IV used for wrapping
  version: number;
}

export interface KeyBackup {
  wrappedDek: string;
  salt: string;
  iv: string;
  version: number;
  createdAt: string;
  hint: string;
}

class EncryptionService {
  private dek: CryptoKey | null = null;
  private isInitialized: boolean = false;
  private _securityMode: SecurityMode = SecurityMode.SIMPLE;

  constructor() {
    this.loadSecurityMode();
  }

  /**
   * Get current security mode
   */
  get securityMode(): SecurityMode {
    return this._securityMode;
  }

  /**
   * Set security mode
   */
  set securityMode(mode: SecurityMode) {
    this._securityMode = mode;
    this.saveSecurityMode(mode);
  }

  /**
   * Load security mode from localStorage
   */
  private loadSecurityMode(): void {
    try {
      const stored = localStorage.getItem(SECURITY_MODE_STORAGE_KEY);
      if (stored !== null) {
        const mode = parseInt(stored, 10);
        if (mode === SecurityMode.SIMPLE || mode === SecurityMode.MAXIMUM) {
          this._securityMode = mode;
        }
      }
    } catch {
      // localStorage not available or error, use default
    }
  }

  /**
   * Save security mode to localStorage
   */
  private saveSecurityMode(mode: SecurityMode): void {
    try {
      localStorage.setItem(SECURITY_MODE_STORAGE_KEY, mode.toString());
    } catch {
      // localStorage not available, silently fail
    }
  }

  /**
   * Get security mode from localStorage (static method for external access)
   */
  getStoredSecurityMode(): SecurityMode {
    try {
      const stored = localStorage.getItem(SECURITY_MODE_STORAGE_KEY);
      if (stored !== null) {
        const mode = parseInt(stored, 10);
        if (mode === SecurityMode.SIMPLE || mode === SecurityMode.MAXIMUM) {
          return mode;
        }
      }
    } catch {
      // localStorage not available
    }
    return SecurityMode.SIMPLE;
  }

  /**
   * Clear security mode from localStorage
   */
  clearStoredSecurityMode(): void {
    try {
      localStorage.removeItem(SECURITY_MODE_STORAGE_KEY);
      this._securityMode = SecurityMode.SIMPLE;
    } catch {
      // localStorage not available
    }
  }

  /**
   * Check if encryption is unlocked (DEK is in memory)
   */
  isUnlocked(): boolean {
    return this.dek !== null;
  }

  /**
   * Lock the vault (clear DEK from memory)
   */
  lock(): void {
    this.dek = null;
    this.isInitialized = false;
  }

  /**
   * Generate a random salt for PBKDF2
   */
  private generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.saltLength));
  }

  /**
   * Generate a random IV for AES-GCM
   */
  private generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.ivLength));
  }

  /**
   * Convert ArrayBuffer to Base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Convert ArrayBuffer to hex string
   */
  private arrayBufferToHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Encode bytes to Base32 (RFC 4648)
   */
  private encodeBase32(bytes: Uint8Array): string {
    let result = '';
    let bits = 0;
    let value = 0;

    for (let i = 0; i < bytes.length; i++) {
      value = (value << 8) | bytes[i];
      bits += 8;

      while (bits >= 5) {
        result += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      result += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return result;
  }

  /**
   * Generate 8 random 8-character alphanumeric backup codes
   * Returns both plaintext codes and their SHA-256 hashes
   */
  async generateBackupCodes(): Promise<GeneratedBackupCodes> {
    const alphanumeric = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars: I, O, 0, 1
    const plaintextCodes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      let code = '';
      const randomBytes = crypto.getRandomValues(new Uint8Array(BACKUP_CODE_LENGTH));
      
      for (let j = 0; j < BACKUP_CODE_LENGTH; j++) {
        code += alphanumeric[randomBytes[j] % alphanumeric.length];
      }

      plaintextCodes.push(code);
      const hash = await this.hashBackupCode(code);
      hashedCodes.push(hash);
    }

    return { plaintextCodes, hashedCodes };
  }

  /**
   * Hash a backup code using SHA-256 for verification
   */
  async hashBackupCode(code: string): Promise<string> {
    const normalizedCode = code.replace(/-/g, '').toUpperCase();
    const encoded = new TextEncoder().encode(normalizedCode);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    return this.arrayBufferToHex(hashBuffer);
  }

  /**
   * Format backup codes as "XXXX-XXXX" for display
   */
  formatBackupCodes(codes: string[]): string[] {
    return codes.map((code) => {
      const clean = code.replace(/-/g, '').toUpperCase();
      if (clean.length !== 8) {
        return code; // Return as-is if not 8 characters
      }
      return `${clean.slice(0, 4)}-${clean.slice(4)}`;
    });
  }

  /**
   * Generate a random base32 secret for TOTP (RFC 6238)
   * Returns a 32-character base32 encoded secret (160 bits)
   */
  generateTOTPSecret(): string {
    const randomBytes = crypto.getRandomValues(new Uint8Array(TOTP_SECRET_LENGTH));
    return this.encodeBase32(randomBytes);
  }

  /**
   * Build otpauth:// URI for QR code generation (RFC 6238)
   */
  buildTOTPUri(secret: string, userEmail: string, issuer: string = 'CaptureInsight'): string {
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedEmail = encodeURIComponent(userEmail);
    const encodedSecret = encodeURIComponent(secret);
    
    return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${encodedSecret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
  }

  /**
   * Get current security status
   */
  getSecurityStatus(totpEnabled: boolean = false, hasBackupCodes: boolean = false): SecurityStatus {
    return {
      mode: this._securityMode,
      totpEnabled,
      hasBackupCodes,
      isUnlocked: this.isUnlocked(),
    };
  }

  /**
   * Derive a Key Encryption Key (KEK) from password using PBKDF2
   */
  async deriveKEK(password: string, salt: Uint8Array): Promise<CryptoKey> {
    // Import password as raw key material
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Derive KEK using PBKDF2
    const kek = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: ENCRYPTION_CONFIG.pbkdf2Iterations,
        hash: 'SHA-256',
      },
      passwordKey,
      {
        name: ENCRYPTION_CONFIG.algorithm,
        length: ENCRYPTION_CONFIG.keyLength,
      },
      false, // KEK should not be extractable
      ['wrapKey', 'unwrapKey']
    );

    return kek;
  }

  /**
   * Generate a new Data Encryption Key (DEK)
   */
  async generateDEK(): Promise<CryptoKey> {
    const dek = await crypto.subtle.generateKey(
      {
        name: ENCRYPTION_CONFIG.algorithm,
        length: ENCRYPTION_CONFIG.keyLength,
      },
      true, // DEK must be extractable for wrapping
      ['encrypt', 'decrypt']
    );

    return dek;
  }

  /**
   * Wrap DEK with KEK for secure storage
   */
  async wrapDEK(dek: CryptoKey, kek: CryptoKey): Promise<{ wrappedKey: ArrayBuffer; iv: Uint8Array }> {
    const iv = this.generateIV();

    const wrappedKey = await crypto.subtle.wrapKey(
      'raw',
      dek,
      kek,
      {
        name: ENCRYPTION_CONFIG.algorithm,
        iv: iv,
        tagLength: ENCRYPTION_CONFIG.tagLength,
      }
    );

    return { wrappedKey, iv };
  }

  /**
   * Unwrap DEK using KEK
   */
  async unwrapDEK(wrappedDek: ArrayBuffer, kek: CryptoKey, iv: Uint8Array): Promise<CryptoKey> {
    const dek = await crypto.subtle.unwrapKey(
      'raw',
      wrappedDek,
      kek,
      {
        name: ENCRYPTION_CONFIG.algorithm,
        iv: iv,
        tagLength: ENCRYPTION_CONFIG.tagLength,
      },
      {
        name: ENCRYPTION_CONFIG.algorithm,
        length: ENCRYPTION_CONFIG.keyLength,
      },
      true,
      ['encrypt', 'decrypt']
    );

    return dek;
  }

  /**
   * Initialize encryption with a new password (first-time setup)
   * Returns the wrapped key data to store in the database
   */
  async setupEncryption(password: string): Promise<WrappedKey> {
    // Generate salt for PBKDF2
    const salt = this.generateSalt();

    // Derive KEK from password
    const kek = await this.deriveKEK(password, salt);

    // Generate new DEK
    const dek = await this.generateDEK();

    // Wrap DEK with KEK
    const { wrappedKey, iv } = await this.wrapDEK(dek, kek);

    // Store DEK in memory
    this.dek = dek;
    this.isInitialized = true;

    return {
      wrappedDek: this.arrayBufferToBase64(wrappedKey),
      salt: this.arrayBufferToBase64(salt.buffer),
      iv: this.arrayBufferToBase64(iv.buffer),
      version: 1,
    };
  }

  /**
   * Unlock encryption with password (returning user)
   */
  async unlock(password: string, wrappedKeyData: WrappedKey): Promise<boolean> {
    try {
      const salt = new Uint8Array(this.base64ToArrayBuffer(wrappedKeyData.salt));
      const iv = new Uint8Array(this.base64ToArrayBuffer(wrappedKeyData.iv));
      const wrappedDek = this.base64ToArrayBuffer(wrappedKeyData.wrappedDek);

      // Derive KEK from password
      const kek = await this.deriveKEK(password, salt);

      // Unwrap DEK
      const dek = await this.unwrapDEK(wrappedDek, kek, iv);

      // Store DEK in memory
      this.dek = dek;
      this.isInitialized = true;

      return true;
    } catch (error) {
      console.error('Failed to unlock encryption:', error);
      return false;
    }
  }

  /**
   * Encrypt plaintext data
   */
  async encrypt(plaintext: string): Promise<EncryptedData> {
    if (!this.dek) {
      throw new Error('Encryption not unlocked. Call unlock() first.');
    }

    const iv = this.generateIV();
    const encodedData = new TextEncoder().encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: ENCRYPTION_CONFIG.algorithm,
        iv: iv,
        tagLength: ENCRYPTION_CONFIG.tagLength,
      },
      this.dek,
      encodedData
    );

    return {
      ciphertext: this.arrayBufferToBase64(ciphertext),
      iv: this.arrayBufferToBase64(iv.buffer),
      version: 1,
    };
  }

  /**
   * Decrypt ciphertext data
   */
  async decrypt(encryptedData: EncryptedData): Promise<string> {
    if (!this.dek) {
      throw new Error('Encryption not unlocked. Call unlock() first.');
    }

    const ciphertext = this.base64ToArrayBuffer(encryptedData.ciphertext);
    const iv = new Uint8Array(this.base64ToArrayBuffer(encryptedData.iv));

    const decrypted = await crypto.subtle.decrypt(
      {
        name: ENCRYPTION_CONFIG.algorithm,
        iv: iv,
        tagLength: ENCRYPTION_CONFIG.tagLength,
      },
      this.dek,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  }

  /**
   * Encrypt a JSON object
   */
  async encryptObject<T>(obj: T): Promise<EncryptedData> {
    const plaintext = JSON.stringify(obj);
    return this.encrypt(plaintext);
  }

  /**
   * Decrypt to a JSON object
   */
  async decryptObject<T>(encryptedData: EncryptedData): Promise<T> {
    const plaintext = await this.decrypt(encryptedData);
    return JSON.parse(plaintext) as T;
  }

  /**
   * Create a key backup that user can download
   */
  async createKeyBackup(wrappedKeyData: WrappedKey, hint: string): Promise<KeyBackup> {
    return {
      ...wrappedKeyData,
      createdAt: new Date().toISOString(),
      hint,
    };
  }

  /**
   * Restore from key backup
   */
  async restoreFromBackup(backup: KeyBackup, password: string): Promise<boolean> {
    return this.unlock(password, {
      wrappedDek: backup.wrappedDek,
      salt: backup.salt,
      iv: backup.iv,
      version: backup.version,
    });
  }

  /**
   * Change encryption password
   * Re-wraps the DEK with a new password-derived KEK
   */
  async changePassword(currentPassword: string, newPassword: string, currentWrappedKey: WrappedKey): Promise<WrappedKey | null> {
    // First, unlock with current password
    const unlocked = await this.unlock(currentPassword, currentWrappedKey);
    if (!unlocked || !this.dek) {
      return null;
    }

    // Generate new salt for new password
    const newSalt = this.generateSalt();

    // Derive new KEK from new password
    const newKek = await this.deriveKEK(newPassword, newSalt);

    // Re-wrap DEK with new KEK
    const { wrappedKey, iv } = await this.wrapDEK(this.dek, newKek);

    return {
      wrappedDek: this.arrayBufferToBase64(wrappedKey),
      salt: this.arrayBufferToBase64(newSalt.buffer),
      iv: this.arrayBufferToBase64(iv.buffer),
      version: currentWrappedKey.version + 1,
    };
  }

  /**
   * Verify if a password is correct without fully unlocking
   */
  async verifyPassword(password: string, wrappedKeyData: WrappedKey): Promise<boolean> {
    try {
      const salt = new Uint8Array(this.base64ToArrayBuffer(wrappedKeyData.salt));
      const iv = new Uint8Array(this.base64ToArrayBuffer(wrappedKeyData.iv));
      const wrappedDek = this.base64ToArrayBuffer(wrappedKeyData.wrappedDek);

      const kek = await this.deriveKEK(password, salt);
      await this.unwrapDEK(wrappedDek, kek, iv);

      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();

// Export class for testing
export { EncryptionService };
