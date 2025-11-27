import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { encryptionService, SecurityMode, type WrappedKey } from '../services/encryption';
import { apiRequest, getQueryFn } from '../lib/queryClient';
import { EncryptionUnlockModal } from '../components/security/EncryptionUnlockModal';

interface SecurityStatus {
  securityMode: number;
  totpEnabled: boolean;
  hasBackupCodes: boolean;
  passwordHint?: string | null;
}

interface EncryptionContextValue {
  isLocked: boolean;
  isMaximumSecurity: boolean;
  securityStatus: SecurityStatus | null;
  isLoading: boolean;
  unlock: (password: string, totpCode: string) => Promise<boolean>;
  lock: () => void;
  recoverWithBackupCode: (backupCode: string) => Promise<{ success: boolean; requiresPasswordReset?: boolean; remainingCodes?: number; error?: string }>;
  passwordHint?: string | null;
}

const defaultContextValue: EncryptionContextValue = {
  isLocked: false,
  isMaximumSecurity: false,
  securityStatus: null,
  isLoading: true,
  unlock: async () => false,
  lock: () => {},
  recoverWithBackupCode: async () => ({ success: false }),
  passwordHint: null,
};

const EncryptionContext = createContext<EncryptionContextValue>(defaultContextValue);

export function useEncryption() {
  return useContext(EncryptionContext);
}

interface EncryptionProviderProps {
  children: React.ReactNode;
}

export function EncryptionProvider({ children }: EncryptionProviderProps) {
  const [isUnlocked, setIsUnlocked] = useState(false);

  const { data: securityStatus, isLoading: statusLoading } = useQuery<SecurityStatus | null>({
    queryKey: ['/api/security/status'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
    staleTime: 60000,
  });

  const isMaximumSecurity = securityStatus?.securityMode === SecurityMode.MAXIMUM;
  const isLocked = isMaximumSecurity && !isUnlocked && !encryptionService.isUnlocked();

  useEffect(() => {
    if (encryptionService.isUnlocked()) {
      setIsUnlocked(true);
    }
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isMaximumSecurity) {
        encryptionService.lock();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isMaximumSecurity]);

  const unlock = useCallback(async (password: string, totpCode: string): Promise<boolean> => {
    try {
      const response = await apiRequest('POST', '/api/security/verify-totp', { code: totpCode });
      const data = await response.json();

      if (!data.valid) {
        return false;
      }

      const wrappedKeyData: WrappedKey = {
        wrappedDek: data.wrappedDek,
        salt: data.salt,
        iv: data.iv,
        version: 1,
      };

      const success = await encryptionService.unlock(password, wrappedKeyData);
      
      if (success) {
        setIsUnlocked(true);
        encryptionService.securityMode = SecurityMode.MAXIMUM;
      }
      
      return success;
    } catch (error) {
      console.error('Unlock failed:', error);
      return false;
    }
  }, []);

  const lock = useCallback(() => {
    encryptionService.lock();
    setIsUnlocked(false);
  }, []);

  const recoverWithBackupCode = useCallback(async (backupCode: string): Promise<{
    success: boolean;
    requiresPasswordReset?: boolean;
    remainingCodes?: number;
    error?: string;
  }> => {
    try {
      const normalizedCode = backupCode.replace(/-/g, '').toUpperCase();
      
      const response = await apiRequest('POST', '/api/security/recover', {
        backupCode: normalizedCode,
        wrappedDek: '',
        salt: '',
        iv: '',
      });
      
      const data = await response.json();

      if (data.success) {
        return {
          success: true,
          requiresPasswordReset: true,
          remainingCodes: data.remainingCodes,
        };
      }
      
      return { success: false, error: 'Invalid backup code' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to recover access';
      return { success: false, error: message };
    }
  }, []);

  const contextValue: EncryptionContextValue = {
    isLocked,
    isMaximumSecurity,
    securityStatus: securityStatus ?? null,
    isLoading: statusLoading,
    unlock,
    lock,
    recoverWithBackupCode,
    passwordHint: securityStatus?.passwordHint,
  };

  return (
    <EncryptionContext.Provider value={contextValue}>
      {children}
      {isLocked && !statusLoading && (
        <EncryptionUnlockModal
          open={true}
          onUnlock={unlock}
          onRecover={recoverWithBackupCode}
          passwordHint={securityStatus?.passwordHint}
        />
      )}
    </EncryptionContext.Provider>
  );
}

export default EncryptionProvider;
