import { useState, useCallback } from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  AlertCircle,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '../ui/input-otp';

interface EncryptionUnlockModalProps {
  open: boolean;
  onUnlock: (password: string, totpCode: string) => Promise<boolean>;
  onRecover: (backupCode: string) => Promise<{
    success: boolean;
    requiresPasswordReset?: boolean;
    remainingCodes?: number;
    error?: string;
  }>;
  passwordHint?: string | null;
}

type ModalView = 'unlock' | 'recovery' | 'recovery-success';

export function EncryptionUnlockModal({
  open,
  onUnlock,
  onRecover,
  passwordHint,
}: EncryptionUnlockModalProps) {
  const [view, setView] = useState<ModalView>('unlock');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingCodes, setRemainingCodes] = useState<number | null>(null);

  const handleUnlock = useCallback(async () => {
    if (!password || totpCode.length !== 6) {
      setError('Please enter your password and 6-digit code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const success = await onUnlock(password, totpCode);
      
      if (!success) {
        setError('Invalid password or verification code. Please try again.');
        setTotpCode('');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [password, totpCode, onUnlock]);

  const handleRecover = useCallback(async () => {
    const cleanCode = backupCode.replace(/-/g, '').toUpperCase();
    if (cleanCode.length !== 8) {
      setError('Please enter a valid 8-character backup code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await onRecover(backupCode);
      
      if (result.success) {
        setRemainingCodes(result.remainingCodes ?? null);
        setView('recovery-success');
      } else {
        setError(result.error || 'Invalid backup code. Please try again.');
      }
    } catch (err) {
      setError('An error occurred during recovery. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [backupCode, onRecover]);

  const handleBackupCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    if (value.length > 8) {
      value = value.slice(0, 8);
    }
    
    if (value.length > 4) {
      value = value.slice(0, 4) + '-' + value.slice(4);
    }
    
    setBackupCode(value);
  };

  const handleSwitchToRecovery = () => {
    setView('recovery');
    setError(null);
    setPassword('');
    setTotpCode('');
  };

  const handleBackToUnlock = () => {
    setView('unlock');
    setError(null);
    setBackupCode('');
  };

  const renderUnlockView = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="unlock-password" className="text-gray-300">
            Encryption Password
          </Label>
          <div className="relative">
            <Input
              id="unlock-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your encryption password"
              className="pr-10 bg-[#0F1219] border-[rgba(255,107,53,0.2)] text-white placeholder:text-gray-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && password && totpCode.length === 6) {
                  handleUnlock();
                }
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {passwordHint && (
            <p className="text-xs text-gray-500">
              Hint: {passwordHint}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-gray-300">
            Authentication Code
          </Label>
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={totpCode}
              onChange={(value: string) => setTotpCode(value)}
              className="gap-2"
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="bg-[#0F1219] border-[rgba(255,107,53,0.2)] text-white" />
                <InputOTPSlot index={1} className="bg-[#0F1219] border-[rgba(255,107,53,0.2)] text-white" />
                <InputOTPSlot index={2} className="bg-[#0F1219] border-[rgba(255,107,53,0.2)] text-white" />
              </InputOTPGroup>
              <InputOTPSeparator className="text-gray-500" />
              <InputOTPGroup>
                <InputOTPSlot index={3} className="bg-[#0F1219] border-[rgba(255,107,53,0.2)] text-white" />
                <InputOTPSlot index={4} className="bg-[#0F1219] border-[rgba(255,107,53,0.2)] text-white" />
                <InputOTPSlot index={5} className="bg-[#0F1219] border-[rgba(255,107,53,0.2)] text-white" />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <p className="text-xs text-gray-500 text-center">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <Button
        onClick={handleUnlock}
        disabled={isLoading || !password || totpCode.length !== 6}
        className="w-full bg-[#FF6B35] hover:bg-[#E55A2B] text-white"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Unlocking...
          </>
        ) : (
          <>
            <Lock className="w-4 h-4 mr-2" />
            Unlock
          </>
        )}
      </Button>

      <div className="text-center">
        <button
          type="button"
          onClick={handleSwitchToRecovery}
          className="text-sm text-gray-400 hover:text-[#FF6B35] transition-colors"
        >
          Use backup code instead
        </button>
      </div>
    </div>
  );

  const renderRecoveryView = () => (
    <div className="space-y-6">
      <button
        type="button"
        onClick={handleBackToUnlock}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to unlock
      </button>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="backup-code" className="text-gray-300">
            Backup Code
          </Label>
          <Input
            id="backup-code"
            type="text"
            value={backupCode}
            onChange={handleBackupCodeChange}
            placeholder="XXXX-XXXX"
            maxLength={9}
            className="bg-[#0F1219] border-[rgba(255,107,53,0.2)] text-white placeholder:text-gray-500 text-center text-lg tracking-widest font-mono uppercase"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && backupCode.replace(/-/g, '').length === 8) {
                handleRecover();
              }
            }}
          />
          <p className="text-xs text-gray-500 text-center">
            Enter one of your saved backup codes
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="bg-[rgba(255,107,53,0.1)] border border-[rgba(255,107,53,0.2)] rounded-lg p-4">
        <div className="flex gap-3">
          <KeyRound className="w-5 h-5 text-[#FF6B35] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300">
            <p className="font-medium text-[#FF6B35] mb-1">Recovery process</p>
            <p>
              Using a backup code will allow you to reset your encryption password.
              Your data will remain encrypted and secure.
            </p>
          </div>
        </div>
      </div>

      <Button
        onClick={handleRecover}
        disabled={isLoading || backupCode.replace(/-/g, '').length !== 8}
        className="w-full bg-[#FF6B35] hover:bg-[#E55A2B] text-white"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Recovering...
          </>
        ) : (
          'Recover'
        )}
      </Button>
    </div>
  );

  const renderRecoverySuccessView = () => (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
          <ShieldCheck className="w-8 h-8 text-green-400" />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-medium text-white">Recovery Initiated</h3>
        <p className="text-sm text-gray-400">
          Your backup code has been verified. You can now reset your encryption password.
        </p>
      </div>

      {remainingCodes !== null && (
        <div className={`text-sm p-3 rounded-lg ${
          remainingCodes === 0 
            ? 'bg-red-500/10 border border-red-500/30 text-red-400' 
            : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
        }`}>
          {remainingCodes === 0 
            ? 'Warning: No backup codes remaining. Generate new codes after resetting your password.'
            : `${remainingCodes} backup code${remainingCodes > 1 ? 's' : ''} remaining`
          }
        </div>
      )}

      <Button
        onClick={() => {
          window.location.href = '/settings/security?reset=true';
        }}
        className="w-full bg-[#FF6B35] hover:bg-[#E55A2B] text-white"
      >
        Reset Password
      </Button>
    </div>
  );

  const getTitle = () => {
    switch (view) {
      case 'unlock':
        return 'Unlock Your Data';
      case 'recovery':
        return 'Recover Access';
      case 'recovery-success':
        return 'Recovery Successful';
      default:
        return 'Unlock Your Data';
    }
  };

  const getDescription = () => {
    switch (view) {
      case 'unlock':
        return 'Enter your encryption password and 2FA code to access your data';
      case 'recovery':
        return 'Use a backup code to recover access to your encrypted data';
      case 'recovery-success':
        return 'Your backup code has been verified';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="bg-[#1A1F2E] border-[rgba(255,107,53,0.2)] text-white max-w-md [&>button]:hidden"
        onPointerDownOutside={(e: Event) => e.preventDefault()}
        onEscapeKeyDown={(e: KeyboardEvent) => e.preventDefault()}
        onInteractOutside={(e: Event) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#FF6B35]" />
            {getTitle()}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {getDescription()}
          </DialogDescription>
        </DialogHeader>

        {view === 'unlock' && renderUnlockView()}
        {view === 'recovery' && renderRecoveryView()}
        {view === 'recovery-success' && renderRecoverySuccessView()}
      </DialogContent>
    </Dialog>
  );
}

export default EncryptionUnlockModal;
