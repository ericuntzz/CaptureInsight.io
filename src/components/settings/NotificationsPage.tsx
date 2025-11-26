import { useState, useEffect } from 'react';
import { ArrowLeft, Bell, Save, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface NotificationsPageProps {
  onBack: () => void;
}

interface NotificationSettings {
  emailNotifications: {
    marketing: boolean;
    updates: boolean;
    insights: boolean;
    comments: boolean;
    mentions: boolean;
  };
  pushNotifications: {
    enabled: boolean;
    insights: boolean;
    comments: boolean;
    mentions: boolean;
  };
}

export function NotificationsPage({ onBack }: NotificationsPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
    emailNotifications: {
      marketing: false,
      updates: true,
      insights: true,
      comments: true,
      mentions: true,
    },
    pushNotifications: {
      enabled: true,
      insights: true,
      comments: true,
      mentions: true,
    },
  });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        if (data.emailNotifications || data.pushNotifications) {
          setSettings({
            emailNotifications: data.emailNotifications || settings.emailNotifications,
            pushNotifications: data.pushNotifications || settings.pushNotifications,
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailChange = (key: keyof NotificationSettings['emailNotifications']) => {
    setSettings(prev => ({
      ...prev,
      emailNotifications: {
        ...prev.emailNotifications,
        [key]: !prev.emailNotifications[key],
      },
    }));
    setHasChanges(true);
  };

  const handlePushChange = (key: keyof NotificationSettings['pushNotifications']) => {
    setSettings(prev => ({
      ...prev,
      pushNotifications: {
        ...prev.pushNotifications,
        [key]: !prev.pushNotifications[key],
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      });
      
      if (response.ok) {
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Failed to save notifications:', error);
    } finally {
      setIsSaving(false);
    }
  };

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
            <Bell className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Notifications</h1>
            <p className="text-gray-400">Manage how you receive notifications</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#1A1F2E] rounded-xl border border-[rgba(255,107,53,0.2)] p-6">
            <h3 className="text-white font-medium mb-4">Email Notifications</h3>
            <div className="space-y-4">
              <ToggleItem
                label="Marketing emails"
                description="News, product updates, and promotional content"
                checked={settings.emailNotifications.marketing}
                onChange={() => handleEmailChange('marketing')}
              />
              <ToggleItem
                label="Product updates"
                description="New features and important changes"
                checked={settings.emailNotifications.updates}
                onChange={() => handleEmailChange('updates')}
              />
              <ToggleItem
                label="New insights"
                description="Get notified when new insights are added"
                checked={settings.emailNotifications.insights}
                onChange={() => handleEmailChange('insights')}
              />
              <ToggleItem
                label="Comments"
                description="When someone comments on your insights"
                checked={settings.emailNotifications.comments}
                onChange={() => handleEmailChange('comments')}
              />
              <ToggleItem
                label="Mentions"
                description="When someone mentions you in a comment"
                checked={settings.emailNotifications.mentions}
                onChange={() => handleEmailChange('mentions')}
              />
            </div>
          </div>

          <div className="bg-[#1A1F2E] rounded-xl border border-[rgba(255,107,53,0.2)] p-6">
            <h3 className="text-white font-medium mb-4">Push Notifications</h3>
            <div className="space-y-4">
              <ToggleItem
                label="Enable push notifications"
                description="Receive notifications in your browser"
                checked={settings.pushNotifications.enabled}
                onChange={() => handlePushChange('enabled')}
              />
              {settings.pushNotifications.enabled && (
                <>
                  <ToggleItem
                    label="New insights"
                    description="Get notified when new insights are added"
                    checked={settings.pushNotifications.insights}
                    onChange={() => handlePushChange('insights')}
                  />
                  <ToggleItem
                    label="Comments"
                    description="When someone comments on your insights"
                    checked={settings.pushNotifications.comments}
                    onChange={() => handlePushChange('comments')}
                  />
                  <ToggleItem
                    label="Mentions"
                    description="When someone mentions you"
                    checked={settings.pushNotifications.mentions}
                    onChange={() => handlePushChange('mentions')}
                  />
                </>
              )}
            </div>
          </div>

          {hasChanges && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-end"
            >
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-[#FF6B35] text-white rounded-lg hover:bg-[#E55A2B] transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Changes
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface ToggleItemProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}

function ToggleItem({ label, description, checked, onChange }: ToggleItemProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-white">{label}</div>
        <div className="text-sm text-gray-400">{description}</div>
      </div>
      <button
        onClick={onChange}
        className={`w-11 h-6 rounded-full transition-colors relative ${
          checked ? 'bg-[#FF6B35]' : 'bg-gray-600'
        }`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
