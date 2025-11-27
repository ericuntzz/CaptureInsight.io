import { useState, useMemo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Lock,
  Eye,
  EyeOff,
  Smartphone,
  Shield,
  Loader2,
  CheckCircle2,
  Copy,
  AlertTriangle,
  KeyRound,
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
import { Checkbox } from '../ui/checkbox';
import { Progress } from '../ui/progress';
import { apiRequest } from '../../lib/queryClient';
import { encryptionService, type WrappedKey } from '../../services/encryption';
import { toast } from 'sonner';
import { BackupCodesDisplay } from './BackupCodesDisplay';

interface MaximumSecuritySetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail?: string;
  onSetupComplete?: () => void;
}

interface SetupMaximumResponse {
  totpSecret: string;
  totpUri: string;
  backupCodes: string[];
}

type SetupStep = 1 | 2 | 3;

function calculatePasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;

  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;
  if (/[a-z]/.test(password)) score += 15;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 15;

  if (score < 30) {
    return { score, label: 'Weak', color: 'bg-red-500' };
  } else if (score < 60) {
    return { score, label: 'Fair', color: 'bg-yellow-500' };
  } else if (score < 80) {
    return { score, label: 'Good', color: 'bg-blue-500' };
  } else {
    return { score, label: 'Strong', color: 'bg-green-500' };
  }
}

export function MaximumSecuritySetup({
  open,
  onOpenChange,
  userEmail = 'user@example.com',
  onSetupComplete,
}: MaximumSecuritySetupProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<SetupStep>(1);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hint, setHint] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [_wrappedKeyData, setWrappedKeyData] = useState<WrappedKey | null>(null);
  const [totpSecret, setTotpSecret] = useState('');
  const [totpUri, setTotpUri] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const [savedCodesConfirmed, setSavedCodesConfirmed] = useState(false);

  const passwordStrength = useMemo(
    () => calculatePasswordStrength(password),
    [password]
  );

  const passwordsMatch = password === confirmPassword && password.length > 0;
  const isStep1Valid =
    password.length >= 8 && passwordsMatch && passwordStrength.score >= 30;

  const setupMaximumMutation = useMutation({
    mutationFn: async (data: { wrappedKey: WrappedKey; hint?: string }) => {
      const res = await apiRequest('POST', '/api/security/setup-maximum', {
        wrappedKey: data.wrappedKey,
        hint: data.hint,
      });
      return res.json() as Promise<SetupMaximumResponse>;
    },
    onSuccess: (data) => {
      setTotpSecret(data.totpSecret);
      setTotpUri(data.totpUri);
      setBackupCodes(
        encryptionService.formatBackupCodes(data.backupCodes)
      );
      setStep(2);
    },
    onError: (error: Error) => {
      toast.error(`Failed to set up Maximum Security: ${error.message}`);
    },
  });

  const verifyTotpMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest('POST', '/api/security/verify-totp', {
        code,
      });
      return res.json();
    },
    onSuccess: () => {
      setStep(3);
    },
    onError: (error: Error) => {
      toast.error(`Invalid verification code: ${error.message}`);
    },
  });

  const completeSetupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/security/complete-setup', {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/security/status'] });
      toast.success('Maximum Security mode enabled successfully!');
      onSetupComplete?.();
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(`Failed to complete setup: ${error.message}`);
    },
  });

  const handleStep1Continue = useCallback(async () => {
    try {
      const wrapped = await encryptionService.setupEncryption(password);
      setWrappedKeyData(wrapped);
      setupMaximumMutation.mutate({ wrappedKey: wrapped, hint });
    } catch (error) {
      toast.error('Failed to generate encryption keys');
    }
  }, [password, hint, setupMaximumMutation]);

  const handleStep2Continue = useCallback(() => {
    if (verificationCode.length === 6) {
      verifyTotpMutation.mutate(verificationCode);
    }
  }, [verificationCode, verifyTotpMutation]);

  const handleStep3Complete = useCallback(() => {
    completeSetupMutation.mutate();
  }, [completeSetupMutation]);

  const handleCopySecret = useCallback(() => {
    navigator.clipboard.writeText(totpSecret);
    toast.success('Secret copied to clipboard');
  }, [totpSecret]);

  const handleCopyAllBackupCodes = useCallback(() => {
    const text = backupCodes.join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Backup codes copied to clipboard');
  }, [backupCodes]);

  const handleDownloadBackupCodes = useCallback(() => {
    const text = `CaptureInsight Backup Codes
Generated: ${new Date().toLocaleString()}
Account: ${userEmail}

Keep these codes in a safe place. Each code can only be used once.

${backupCodes.join('\n')}
`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'captureinsight-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Backup codes downloaded');
  }, [backupCodes, userEmail]);

  const handleClose = useCallback(() => {
    setStep(1);
    setPassword('');
    setConfirmPassword('');
    setHint('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setWrappedKeyData(null);
    setTotpSecret('');
    setTotpUri('');
    setVerificationCode('');
    setBackupCodes([]);
    setSavedCodesConfirmed(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3].map((s) => (
        <div key={s} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              s === step
                ? 'bg-[#FF6B35] text-white'
                : s < step
                  ? 'bg-green-600 text-white'
                  : 'bg-[#1A1F2E] text-gray-400 border border-gray-600'
            }`}
          >
            {s < step ? <CheckCircle2 className="w-4 h-4" /> : s}
          </div>
          {s < 3 && (
            <div
              className={`w-12 h-0.5 mx-1 ${
                s < step ? 'bg-green-600' : 'bg-gray-600'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-[#FF6B35]">
        <Lock className="w-5 h-5" />
        <h3 className="font-medium">Create Encryption Password</h3>
      </div>

      <p className="text-sm text-gray-400">
        This password will encrypt your data. It cannot be recovered if lost.
        Choose a strong, memorable password.
      </p>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password" className="text-gray-300">
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter a strong password"
              className="pr-10 bg-[#0F1219] border-[rgba(255,107,53,0.2)] text-white placeholder:text-gray-500"
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

          {password.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Password strength:</span>
                <span
                  className={`font-medium ${
                    passwordStrength.score < 30
                      ? 'text-red-400'
                      : passwordStrength.score < 60
                        ? 'text-yellow-400'
                        : passwordStrength.score < 80
                          ? 'text-blue-400'
                          : 'text-green-400'
                  }`}
                >
                  {passwordStrength.label}
                </span>
              </div>
              <Progress
                value={passwordStrength.score}
                className="h-1.5 bg-gray-700"
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-gray-300">
            Confirm Password
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              className="pr-10 bg-[#0F1219] border-[rgba(255,107,53,0.2)] text-white placeholder:text-gray-500"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showConfirmPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="text-xs text-red-400">Passwords do not match</p>
          )}
          {passwordsMatch && (
            <p className="text-xs text-green-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Passwords match
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="hint" className="text-gray-300">
            Password Hint{' '}
            <span className="text-gray-500 font-normal">(optional)</span>
          </Label>
          <Input
            id="hint"
            type="text"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="A hint to help you remember"
            className="bg-[#0F1219] border-[rgba(255,107,53,0.2)] text-white placeholder:text-gray-500"
          />
        </div>
      </div>

      <div className="bg-[rgba(255,107,53,0.1)] border border-[rgba(255,107,53,0.2)] rounded-lg p-4">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-[#FF6B35] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300">
            <p className="font-medium text-[#FF6B35] mb-1">Important</p>
            <p>
              If you forget this password, you will lose access to all your
              encrypted data. We cannot recover it for you.
            </p>
          </div>
        </div>
      </div>

      <Button
        onClick={handleStep1Continue}
        disabled={!isStep1Valid || setupMaximumMutation.isPending}
        className="w-full bg-[#FF6B35] hover:bg-[#E55A2B] text-white"
      >
        {setupMaximumMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Setting up encryption...
          </>
        ) : (
          'Continue'
        )}
      </Button>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-[#FF6B35]">
        <Smartphone className="w-5 h-5" />
        <h3 className="font-medium">Set Up Two-Factor Authentication</h3>
      </div>

      <p className="text-sm text-gray-400">
        Scan this QR code with your authenticator app (like Google Authenticator
        or Authy), or enter the secret manually.
      </p>

      <div className="bg-[#0F1219] border border-[rgba(255,107,53,0.2)] rounded-lg p-6">
        <div className="text-center space-y-4">
          <div className="bg-white p-4 rounded-lg inline-block mx-auto">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(totpUri)}`}
              alt="QR Code for TOTP"
              className="w-[180px] h-[180px]"
            />
          </div>

          <p className="text-xs text-gray-500">
            Scan with your authenticator app
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-gray-300 flex items-center gap-2">
          <KeyRound className="w-4 h-4" />
          Manual Entry Secret
        </Label>
        <div className="flex gap-2">
          <div className="flex-1 bg-[#0F1219] border border-[rgba(255,107,53,0.2)] rounded-lg px-4 py-3 font-mono text-sm text-white break-all">
            {totpSecret}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleCopySecret}
            className="flex-shrink-0 border-[rgba(255,107,53,0.3)] text-white hover:bg-[rgba(255,107,53,0.1)]"
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="verificationCode" className="text-gray-300">
          Verification Code
        </Label>
        <Input
          id="verificationCode"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={verificationCode}
          onChange={(e) =>
            setVerificationCode(e.target.value.replace(/\D/g, ''))
          }
          placeholder="Enter 6-digit code"
          className="bg-[#0F1219] border-[rgba(255,107,53,0.2)] text-white placeholder:text-gray-500 text-center text-lg tracking-widest font-mono"
        />
        <p className="text-xs text-gray-500">
          Enter the 6-digit code from your authenticator app
        </p>
      </div>

      <Button
        onClick={handleStep2Continue}
        disabled={verificationCode.length !== 6 || verifyTotpMutation.isPending}
        className="w-full bg-[#FF6B35] hover:bg-[#E55A2B] text-white"
      >
        {verifyTotpMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Verifying...
          </>
        ) : (
          'Verify & Continue'
        )}
      </Button>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-[#FF6B35]">
        <Shield className="w-5 h-5" />
        <h3 className="font-medium">Save Backup Codes</h3>
      </div>

      <p className="text-sm text-gray-400">
        These backup codes can be used to access your account if you lose your
        authenticator device. Each code can only be used once.
      </p>

      <BackupCodesDisplay
        codes={backupCodes}
        onCopyAll={handleCopyAllBackupCodes}
        onDownload={handleDownloadBackupCodes}
      />

      <div className="bg-[rgba(255,107,53,0.1)] border border-[rgba(255,107,53,0.2)] rounded-lg p-4">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-[#FF6B35] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300">
            <p className="font-medium text-[#FF6B35] mb-1">
              Store these codes securely
            </p>
            <p>
              Save these codes in a secure location like a password manager or
              printed copy. You will not be able to view them again.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Checkbox
          id="savedCodes"
          checked={savedCodesConfirmed}
          onCheckedChange={(checked: boolean | 'indeterminate') =>
            setSavedCodesConfirmed(checked === true)
          }
          className="data-[state=checked]:bg-[#FF6B35] data-[state=checked]:border-[#FF6B35]"
        />
        <Label
          htmlFor="savedCodes"
          className="text-sm text-gray-300 cursor-pointer"
        >
          I have saved these backup codes in a secure location
        </Label>
      </div>

      <Button
        onClick={handleStep3Complete}
        disabled={!savedCodesConfirmed || completeSetupMutation.isPending}
        className="w-full bg-[#FF6B35] hover:bg-[#E55A2B] text-white"
      >
        {completeSetupMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Completing setup...
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Complete Setup
          </>
        )}
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#1A1F2E] border-[rgba(255,107,53,0.2)] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#FF6B35]" />
            Maximum Security Setup
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Set up end-to-end encryption for your data
          </DialogDescription>
        </DialogHeader>

        {renderStepIndicator()}

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </DialogContent>
    </Dialog>
  );
}

export default MaximumSecuritySetup;
