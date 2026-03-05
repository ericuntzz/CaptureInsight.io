/**
 * End-to-End Encryption Service (Client-side)
 *
 * AES-256-GCM for data encryption
 * PBKDF2 for key derivation from password
 * Key wrapping for secure DEK storage
 */

const ENCRYPTION_CONFIG = {
  algorithm: 'AES-GCM',
  keyLength: 256,
  ivLength: 12,
  saltLength: 16,
  pbkdf2Iterations: 100000,
  tagLength: 128,
};

const SECURITY_MODE_STORAGE_KEY = 'app_security_mode';

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

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  version: number;
}

export interface WrappedKey {
  wrappedDek: string;
  salt: string;
  iv: string;
  version: number;
}

class EncryptionService {
  private dek: CryptoKey | null = null;
  private _isInitialized: boolean = false;
  private _securityMode: SecurityMode = SecurityMode.SIMPLE;

  constructor() {
    this.loadSecurityMode();
  }

  get securityMode(): SecurityMode {
    return this._securityMode;
  }

  set securityMode(mode: SecurityMode) {
    this._securityMode = mode;
    this.saveSecurityMode(mode);
  }

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
      // localStorage not available
    }
  }

  private saveSecurityMode(mode: SecurityMode): void {
    try {
      localStorage.setItem(SECURITY_MODE_STORAGE_KEY, mode.toString());
    } catch {
      // localStorage not available
    }
  }

  isUnlocked(): boolean {
    return this.dek !== null && this._isInitialized;
  }

  lock(): void {
    this.dek = null;
    this._isInitialized = false;
  }

  private generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.saltLength));
  }

  private generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.ivLength));
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  async deriveKEK(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: ENCRYPTION_CONFIG.pbkdf2Iterations,
        hash: 'SHA-256',
      },
      passwordKey,
      {
        name: ENCRYPTION_CONFIG.algorithm,
        length: ENCRYPTION_CONFIG.keyLength,
      },
      false,
      ['wrapKey', 'unwrapKey']
    );
  }

  async generateDEK(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
      {
        name: ENCRYPTION_CONFIG.algorithm,
        length: ENCRYPTION_CONFIG.keyLength,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  async wrapDEK(dek: CryptoKey, kek: CryptoKey): Promise<{ wrappedKey: ArrayBuffer; iv: Uint8Array }> {
    const iv = this.generateIV();
    const wrappedKey = await crypto.subtle.wrapKey('raw', dek, kek, {
      name: ENCRYPTION_CONFIG.algorithm,
      iv,
      tagLength: ENCRYPTION_CONFIG.tagLength,
    });
    return { wrappedKey, iv };
  }

  async unwrapDEK(wrappedDek: ArrayBuffer, kek: CryptoKey, iv: Uint8Array): Promise<CryptoKey> {
    return crypto.subtle.unwrapKey(
      'raw',
      wrappedDek,
      kek,
      { name: ENCRYPTION_CONFIG.algorithm, iv, tagLength: ENCRYPTION_CONFIG.tagLength },
      { name: ENCRYPTION_CONFIG.algorithm, length: ENCRYPTION_CONFIG.keyLength },
      true,
      ['encrypt', 'decrypt']
    );
  }

  async setupEncryption(password: string): Promise<WrappedKey> {
    const salt = this.generateSalt();
    const kek = await this.deriveKEK(password, salt);
    const dek = await this.generateDEK();
    const { wrappedKey, iv } = await this.wrapDEK(dek, kek);

    this.dek = dek;
    this._isInitialized = true;

    return {
      wrappedDek: this.arrayBufferToBase64(wrappedKey),
      salt: this.arrayBufferToBase64(salt.buffer),
      iv: this.arrayBufferToBase64(iv.buffer),
      version: 1,
    };
  }

  async unlock(password: string, wrappedKeyData: WrappedKey): Promise<boolean> {
    try {
      const salt = new Uint8Array(this.base64ToArrayBuffer(wrappedKeyData.salt));
      const iv = new Uint8Array(this.base64ToArrayBuffer(wrappedKeyData.iv));
      const wrappedDek = this.base64ToArrayBuffer(wrappedKeyData.wrappedDek);

      const kek = await this.deriveKEK(password, salt);
      const dek = await this.unwrapDEK(wrappedDek, kek, iv);

      this.dek = dek;
      this._isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to unlock encryption:', error);
      return false;
    }
  }

  async encrypt(plaintext: string): Promise<EncryptedData> {
    if (!this.dek) throw new Error('Encryption not unlocked.');

    const iv = this.generateIV();
    const ciphertext = await crypto.subtle.encrypt(
      { name: ENCRYPTION_CONFIG.algorithm, iv, tagLength: ENCRYPTION_CONFIG.tagLength },
      this.dek,
      new TextEncoder().encode(plaintext)
    );

    return {
      ciphertext: this.arrayBufferToBase64(ciphertext),
      iv: this.arrayBufferToBase64(iv.buffer),
      version: 1,
    };
  }

  async decrypt(encryptedData: EncryptedData): Promise<string> {
    if (!this.dek) throw new Error('Encryption not unlocked.');

    const ciphertext = this.base64ToArrayBuffer(encryptedData.ciphertext);
    const iv = new Uint8Array(this.base64ToArrayBuffer(encryptedData.iv));

    const decrypted = await crypto.subtle.decrypt(
      { name: ENCRYPTION_CONFIG.algorithm, iv, tagLength: ENCRYPTION_CONFIG.tagLength },
      this.dek,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  }
}

export const encryptionService = new EncryptionService();
export { EncryptionService };
