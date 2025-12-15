import { ArrowLeft, Settings, User, Palette, Bell, CreditCard, Building2, Shield } from 'lucide-react';
import { motion } from 'motion/react';

interface SettingsPageProps {
  onBack: () => void;
  onNavigate: (page: 'profile' | 'preferences' | 'notifications' | 'billing' | 'companies' | 'security') => void;
}

const settingsItems = [
  {
    id: 'profile',
    icon: User,
    title: 'Profile',
    description: 'Update your personal information and photo',
  },
  {
    id: 'preferences',
    icon: Palette,
    title: 'Preferences',
    description: 'Theme, language, timezone, and display settings',
  },
  {
    id: 'notifications',
    icon: Bell,
    title: 'Notifications',
    description: 'Email and push notification preferences',
  },
  {
    id: 'companies',
    icon: Building2,
    title: 'Companies',
    description: 'Manage your companies and switch between them',
  },
  {
    id: 'billing',
    icon: CreditCard,
    title: 'Billing',
    description: 'View your plan, invoices, and payment methods',
  },
];

const securityItems = [
  {
    id: 'security',
    icon: Shield,
    title: 'Security',
    description: 'Data encryption, two-factor authentication, and security settings',
    disabled: false,
  },
];


export function SettingsPage({ onBack, onNavigate }: SettingsPageProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 bg-[#0F1219] overflow-auto"
    >
      <div className="max-w-2xl mx-auto p-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FFA07A] flex items-center justify-center">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Settings</h1>
            <p className="text-gray-400">Manage your account settings and preferences</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Account</h2>
            <div className="bg-[#1A1F2E] rounded-xl border border-[rgba(255,107,53,0.2)] overflow-hidden">
              {settingsItems.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id as any)}
                  className={`w-full flex items-center gap-4 p-4 hover:bg-[rgba(255,107,53,0.1)] transition-colors text-left ${
                    index !== settingsItems.length - 1 ? 'border-b border-[rgba(255,107,53,0.1)]' : ''
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-[rgba(255,107,53,0.15)] flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-[#FF6B35]" />
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium">{item.title}</div>
                    <div className="text-sm text-gray-400">{item.description}</div>
                  </div>
                  <ArrowLeft className="w-4 h-4 text-gray-400 rotate-180" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Security</h2>
            <div className="bg-[#1A1F2E] rounded-xl border border-[rgba(255,107,53,0.2)] overflow-hidden">
              {securityItems.map((item, index) => {
                const isClickable = !item.disabled;
                const Wrapper = isClickable ? 'button' : 'div';
                return (
                  <Wrapper
                    key={item.id}
                    onClick={isClickable ? () => onNavigate(item.id as any) : undefined}
                    className={`w-full flex items-center gap-4 p-4 text-left ${
                      item.disabled 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:bg-[rgba(255,107,53,0.1)] transition-colors cursor-pointer'
                    } ${
                      index !== securityItems.length - 1 ? 'border-b border-[rgba(255,107,53,0.1)]' : ''
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-[rgba(255,107,53,0.15)] flex items-center justify-center">
                      <item.icon className="w-5 h-5 text-[#FF6B35]" />
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-medium flex items-center gap-2">
                        {item.title}
                        {item.disabled && (
                          <span className="text-xs px-2 py-0.5 bg-gray-700 rounded text-gray-400">Coming Soon</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">{item.description}</div>
                    </div>
                    {isClickable && <ArrowLeft className="w-4 h-4 text-gray-400 rotate-180" />}
                  </Wrapper>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
}
