import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Shield, ShieldCheck, Lock, Smartphone, Loader2, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
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

  const handle2FAToggle = (checked: boolean) => {
    if (checked) {
      if (!twoFAStatus?.isSetUp) {
        setIsSettingUp2FA(true);
      } else {
        enable2FAMutation.mutate();
      }
    } else {
      disable2FAMutation.mutate();
    }
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
      <div className="flex-1 flex items-center justify-center bg-[#0F1219]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF6B35]" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 bg-[#0F1219] overflow-auto"
    >
      <div className="max-w-3xl mx-auto p-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FFA07A] flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Security Settings</h1>
            <p className="text-gray-400">Manage your data encryption and login security</p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
              Data Encryption
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              Choose how your data is protected. This affects how your captures and insights are encrypted.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card 
                className={`bg-[#1A1F2E] border-2 transition-all cursor-pointer hover:border-[rgba(255,107,53,0.4)] ${
                  currentSecurityMode === 0 
                    ? 'border-[#FF6B35]' 
                    : 'border-[rgba(255,107,53,0.2)]'
                }`}
                onClick={currentSecurityMode !== 0 ? handleSelectSimple : undefined}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-lg bg-[rgba(255,107,53,0.15)] flex items-center justify-center mb-2">
                      <ShieldCheck className="w-6 h-6 text-[#FF6B35]" />
                    </div>
                    {currentSecurityMode === 0 ? (
                      <Badge className="bg-[#FF6B35] text-white border-none">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Current
                      </Badge>
                    ) : null}
                  </div>
                  <CardTitle className="text-white text-lg">Simple Protection</CardTitle>
                  <CardDescription className="text-gray-400 text-sm">
                    Your data is encrypted on our servers. Protected against external attacks.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {currentSecurityMode !== 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectSimple();
                      }}
                      disabled={updateSecurityModeMutation.isPending}
                      className="w-full border-[rgba(255,107,53,0.3)] text-white hover:bg-[rgba(255,107,53,0.1)] hover:text-white"
                    >
                      {updateSecurityModeMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Select
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card 
                className={`bg-[#1A1F2E] border-2 transition-all cursor-pointer hover:border-[rgba(255,107,53,0.4)] ${
                  currentSecurityMode === 1 
                    ? 'border-[#FF6B35]' 
                    : 'border-[rgba(255,107,53,0.2)]'
                }`}
                onClick={currentSecurityMode !== 1 ? handleUpgradeToMaxSecurity : undefined}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-lg bg-[rgba(255,107,53,0.15)] flex items-center justify-center mb-2">
                      <Lock className="w-6 h-6 text-[#FF6B35]" />
                    </div>
                    {currentSecurityMode === 1 ? (
                      <Badge className="bg-[#FF6B35] text-white border-none">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Current
                      </Badge>
                    ) : null}
                  </div>
                  <CardTitle className="text-white text-lg">Maximum Security</CardTitle>
                  <CardDescription className="text-gray-400 text-sm">
                    End-to-end encryption. Only you can access your data - we can't read it even if we wanted to.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {currentSecurityMode !== 1 && (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpgradeToMaxSecurity();
                      }}
                      disabled={updateSecurityModeMutation.isPending}
                      className="w-full bg-[#FF6B35] hover:bg-[#E55A2B] text-white"
                    >
                      {updateSecurityModeMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Upgrade
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
              Login Security
            </h2>
            <div className="bg-[#1A1F2E] rounded-xl border border-[rgba(255,107,53,0.2)] p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-[rgba(255,107,53,0.15)] flex items-center justify-center flex-shrink-0">
                  <Smartphone className="w-5 h-5 text-[#FF6B35]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-white font-medium">Two-Factor Authentication</h3>
                    {is2FASetUp && (
                      <Switch
                        checked={is2FAEnabled}
                        onCheckedChange={handle2FAToggle}
                        disabled={enable2FAMutation.isPending || disable2FAMutation.isPending}
                      />
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mb-4">
                    Add an extra layer of security to your account by requiring a verification code when signing in.
                  </p>
                  
                  {!is2FASetUp ? (
                    <Button
                      onClick={handleSetup2FA}
                      disabled={enable2FAMutation.isPending}
                      variant="outline"
                      className="border-[rgba(255,107,53,0.3)] text-white hover:bg-[rgba(255,107,53,0.1)] hover:text-white"
                    >
                      {enable2FAMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Smartphone className="w-4 h-4 mr-2" />
                      )}
                      Set up 2FA
                    </Button>
                  ) : is2FAEnabled ? (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        2FA Enabled
                      </Badge>
                      <Button
                        onClick={() => disable2FAMutation.mutate()}
                        disabled={disable2FAMutation.isPending}
                        variant="ghost"
                        size="sm"
                        className="text-gray-400 hover:text-red-400 hover:bg-red-900/20"
                      >
                        {disable2FAMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Disable'
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-gray-400 border-gray-600">
                        2FA Disabled
                      </Badge>
                      <Button
                        onClick={() => enable2FAMutation.mutate()}
                        disabled={enable2FAMutation.isPending}
                        variant="ghost"
                        size="sm"
                        className="text-[#FF6B35] hover:text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)]"
                      >
                        {enable2FAMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Enable'
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#1A1F2E]/50 rounded-xl border border-[rgba(255,107,53,0.1)] p-4">
            <p className="text-xs text-gray-500 text-center">
              Your security is our priority. All data is encrypted in transit using TLS 1.3.
              For questions about our security practices, contact security@captureinsight.com
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default SecuritySettings;
