import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Shield, ShieldCheck, Lock, Smartphone, Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '../components/ui/button';
import { apiRequest } from '../lib/queryClient';
import { toast } from 'sonner';

interface SecuritySettingsProps {
  onBack: () => void;
  onStartMaxSecuritySetup?: () => void;
}

interface SecurityStatus {
  securityMode: 0 | 1;
  encryptionEnabled: boolean;
}

interface TwoFAStatus {
  enabled: boolean;
  isSetUp: boolean;
}

export function SecuritySettings({ onBack, onStartMaxSecuritySetup }: SecuritySettingsProps) {
  const queryClient = useQueryClient();
  const [isSettingUp2FA, setIsSettingUp2FA] = useState(false);
  void isSettingUp2FA;

  const { data: securityStatus, isLoading: securityLoading } = useQuery<SecurityStatus>({
    queryKey: ['/api/security/status'],
  });

  const { data: twoFAStatus, isLoading: twoFALoading } = useQuery<TwoFAStatus>({
    queryKey: ['/api/login-2fa/status'],
  });

  const updateSecurityModeMutation = useMutation({
    mutationFn: async (mode: 0 | 1) => {
      const res = await apiRequest('PUT', '/api/security/mode', { securityMode: mode });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/security/status'] });
      toast.success('Security mode updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update security mode: ${error.message}`);
    },
  });

  const enable2FAMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/login-2fa/enable', {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/login-2fa/status'] });
      toast.success('Two-factor authentication enabled');
    },
    onError: (error: Error) => {
      toast.error(`Failed to enable 2FA: ${error.message}`);
    },
  });

  const disable2FAMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/login-2fa/disable', {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/login-2fa/status'] });
      toast.success('Two-factor authentication disabled');
    },
    onError: (error: Error) => {
      toast.error(`Failed to disable 2FA: ${error.message}`);
    },
  });

  const handleUpgradeToMaxSecurity = () => {
    if (onStartMaxSecuritySetup) {
      onStartMaxSecuritySetup();
    } else {
      updateSecurityModeMutation.mutate(1);
    }
  };

  const handleSelectSimple = () => {
    updateSecurityModeMutation.mutate(0);
  };

  const handleSetup2FA = () => {
    setIsSettingUp2FA(true);
    enable2FAMutation.mutate();
  };

  const isLoading = securityLoading || twoFALoading;
  const currentSecurityMode = securityStatus?.securityMode ?? 0;
  const is2FAEnabled = twoFAStatus?.enabled ?? false;
  const is2FASetUp = twoFAStatus?.isSetUp ?? false;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0A0D12]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#E55A2B] flex items-center justify-center shadow-lg shadow-[#FF6B35]/25">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div className="absolute inset-0 rounded-full bg-[#FF6B35]/20 animate-ping" />
          </div>
          <p className="text-gray-400 text-sm">Loading security settings...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex-1 bg-[#0A0D12] overflow-auto"
    >
      <div className="max-w-4xl mx-auto py-12 px-8 lg:px-12">
        <motion.button
          onClick={onBack}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="group flex items-center gap-2 text-gray-500 hover:text-white mb-10 transition-all duration-200"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-200" />
          <span className="text-sm font-medium">Back</span>
        </motion.button>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center gap-5 mb-12"
        >
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF6B35] to-[#E55A2B] flex items-center justify-center shadow-xl shadow-[#FF6B35]/25">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#0A0D12] flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Security Settings</h1>
            <p className="text-gray-400 mt-1">Manage your data encryption and login security</p>
          </div>
        </motion.div>

        <div className="space-y-12">
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="mb-6">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-[0.2em] mb-2">
                Data Encryption
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Choose how your data is protected. This affects how your captures and insights are encrypted.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                onClick={currentSecurityMode !== 0 ? handleSelectSimple : undefined}
                className={`relative group cursor-pointer rounded-2xl p-6 transition-all duration-300 ${
                  currentSecurityMode === 0 
                    ? 'bg-gradient-to-br from-[#1A1F2E] to-[#161A24] ring-2 ring-[#FF6B35] shadow-lg shadow-[#FF6B35]/10' 
                    : 'bg-[#1A1F2E]/60 hover:bg-[#1A1F2E] border border-[#2A2F3E] hover:border-[#FF6B35]/30 hover:shadow-lg hover:shadow-[#FF6B35]/5'
                }`}
              >
                {currentSecurityMode === 0 && (
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#FF6B35]/5 to-transparent pointer-events-none" />
                )}
                
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF6B35]/20 to-[#FF6B35]/5 border border-[#FF6B35]/10 flex items-center justify-center">
                      <ShieldCheck className="w-6 h-6 text-[#FF6B35]" />
                    </div>
                    {currentSecurityMode === 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF6B35]/15 text-[#FF6B35] text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-lg font-semibold text-white tracking-tight mb-2">
                    Simple Protection
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed mb-5">
                    Your data is encrypted on our servers. Protected against external attacks with automatic key management.
                  </p>
                  
                  <div className="flex flex-wrap gap-2 mb-5">
                    <span className="px-2.5 py-1 rounded-md bg-[#2A2F3E] text-xs text-gray-300">Server-side encryption</span>
                    <span className="px-2.5 py-1 rounded-md bg-[#2A2F3E] text-xs text-gray-300">Account recovery</span>
                  </div>

                  {currentSecurityMode !== 0 && (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectSimple();
                      }}
                      disabled={updateSecurityModeMutation.isPending}
                      variant="outline"
                      className="w-full border-[#3A3F4E] hover:border-[#FF6B35]/50 hover:bg-[#FF6B35]/5 text-white font-medium transition-all duration-200"
                    >
                      {updateSecurityModeMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Select
                    </Button>
                  )}
                </div>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                onClick={currentSecurityMode !== 1 ? handleUpgradeToMaxSecurity : undefined}
                className={`relative group cursor-pointer rounded-2xl p-6 transition-all duration-300 ${
                  currentSecurityMode === 1 
                    ? 'bg-gradient-to-br from-[#1A1F2E] to-[#161A24] ring-2 ring-[#FF6B35] shadow-lg shadow-[#FF6B35]/10' 
                    : 'bg-[#1A1F2E]/60 hover:bg-[#1A1F2E] border border-[#2A2F3E] hover:border-[#FF6B35]/30 hover:shadow-lg hover:shadow-[#FF6B35]/5'
                }`}
              >
                {currentSecurityMode === 1 && (
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#FF6B35]/5 to-transparent pointer-events-none" />
                )}
                
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF6B35]/20 to-[#FF6B35]/5 border border-[#FF6B35]/10 flex items-center justify-center">
                      <Lock className="w-6 h-6 text-[#FF6B35]" />
                    </div>
                    {currentSecurityMode === 1 ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF6B35]/15 text-[#FF6B35] text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 text-xs font-semibold">
                        <Sparkles className="w-3 h-3" />
                        Recommended
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-lg font-semibold text-white tracking-tight mb-2">
                    Maximum Security
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed mb-5">
                    End-to-end encryption with zero-knowledge architecture. Only you can access your data.
                  </p>
                  
                  <div className="flex flex-wrap gap-2 mb-5">
                    <span className="px-2.5 py-1 rounded-md bg-[#2A2F3E] text-xs text-gray-300">E2E encryption</span>
                    <span className="px-2.5 py-1 rounded-md bg-[#2A2F3E] text-xs text-gray-300">Password + 2FA</span>
                    <span className="px-2.5 py-1 rounded-md bg-[#2A2F3E] text-xs text-gray-300">Backup codes</span>
                  </div>

                  {currentSecurityMode !== 1 && (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpgradeToMaxSecurity();
                      }}
                      disabled={updateSecurityModeMutation.isPending}
                      className="w-full bg-gradient-to-r from-[#FF6B35] to-[#E55A2B] hover:from-[#E55A2B] hover:to-[#D04A1B] text-white font-medium shadow-md shadow-[#FF6B35]/25 transition-all duration-200"
                    >
                      {updateSecurityModeMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Upgrade to Maximum Security
                    </Button>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.section>

          <div className="h-px bg-gradient-to-r from-transparent via-[#2A2F3E] to-transparent" />

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="mb-6">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-[0.2em] mb-2">
                Login Security
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Additional protection for your account access.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-[#1A1F2E] to-[#161A24] rounded-2xl border border-[#2A2F3E] p-6">
              <div className="flex items-start gap-5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF6B35]/20 to-[#FF6B35]/5 border border-[#FF6B35]/10 flex items-center justify-center flex-shrink-0">
                  <Smartphone className="w-6 h-6 text-[#FF6B35]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <h3 className="text-lg font-semibold text-white tracking-tight">
                      Two-Factor Authentication
                    </h3>
                    {is2FAEnabled && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Enabled
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed mb-5">
                    Add an extra layer of security to your account by requiring a verification code from your authenticator app when signing in.
                  </p>
                  
                  {!is2FASetUp ? (
                    <Button
                      onClick={handleSetup2FA}
                      disabled={enable2FAMutation.isPending}
                      className="bg-gradient-to-r from-[#FF6B35] to-[#E55A2B] hover:from-[#E55A2B] hover:to-[#D04A1B] text-white font-medium shadow-md shadow-[#FF6B35]/25 transition-all duration-200"
                    >
                      {enable2FAMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Smartphone className="w-4 h-4 mr-2" />
                      )}
                      Set up 2FA
                    </Button>
                  ) : is2FAEnabled ? (
                    <Button
                      onClick={() => disable2FAMutation.mutate()}
                      disabled={disable2FAMutation.isPending}
                      variant="outline"
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 font-medium transition-all duration-200"
                    >
                      {disable2FAMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Disable 2FA
                    </Button>
                  ) : (
                    <Button
                      onClick={() => enable2FAMutation.mutate()}
                      disabled={enable2FAMutation.isPending}
                      className="bg-gradient-to-r from-[#FF6B35] to-[#E55A2B] hover:from-[#E55A2B] hover:to-[#D04A1B] text-white font-medium shadow-md shadow-[#FF6B35]/25 transition-all duration-200"
                    >
                      {enable2FAMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Enable 2FA
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </motion.section>

          <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="pt-4"
          >
            <div className="flex items-center justify-center gap-2 text-center">
              <Shield className="w-4 h-4 text-gray-600" />
              <p className="text-xs text-gray-600">
                Your security is our priority. All data is encrypted in transit using TLS 1.3.
              </p>
            </div>
          </motion.footer>
        </div>
      </div>
    </motion.div>
  );
}

export default SecuritySettings;
