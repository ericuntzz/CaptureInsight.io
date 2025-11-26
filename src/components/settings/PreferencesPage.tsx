import { useState, useEffect } from 'react';
import { ArrowLeft, Palette, Save, Loader2, Check } from 'lucide-react';
import { motion } from 'motion/react';

interface PreferencesPageProps {
  onBack: () => void;
}

const themes = [
  { id: 'dark', name: 'Dark', color: '#0F1219' },
  { id: 'light', name: 'Light', color: '#FFFFFF' },
  { id: 'system', name: 'System', color: 'linear-gradient(135deg, #0F1219 50%, #FFFFFF 50%)' },
];

const languages = [
  { id: 'en', name: 'English' },
  { id: 'es', name: 'Spanish' },
  { id: 'fr', name: 'French' },
  { id: 'de', name: 'German' },
  { id: 'pt', name: 'Portuguese' },
  { id: 'zh', name: 'Chinese' },
  { id: 'ja', name: 'Japanese' },
];

const timezones = [
  { id: 'UTC', name: 'UTC (Coordinated Universal Time)' },
  { id: 'America/New_York', name: 'Eastern Time (ET)' },
  { id: 'America/Chicago', name: 'Central Time (CT)' },
  { id: 'America/Denver', name: 'Mountain Time (MT)' },
  { id: 'America/Los_Angeles', name: 'Pacific Time (PT)' },
  { id: 'Europe/London', name: 'London (GMT)' },
  { id: 'Europe/Paris', name: 'Paris (CET)' },
  { id: 'Asia/Tokyo', name: 'Tokyo (JST)' },
  { id: 'Asia/Shanghai', name: 'Shanghai (CST)' },
];

const dateFormats = [
  { id: 'MM/DD/YYYY', name: 'MM/DD/YYYY (12/31/2024)' },
  { id: 'DD/MM/YYYY', name: 'DD/MM/YYYY (31/12/2024)' },
  { id: 'YYYY-MM-DD', name: 'YYYY-MM-DD (2024-12-31)' },
];

export function PreferencesPage({ onBack }: PreferencesPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    theme: 'dark',
    language: 'en',
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
  });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/settings', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setPreferences({
          theme: data.theme || 'dark',
          language: data.language || 'en',
          timezone: data.timezone || 'UTC',
          dateFormat: data.dateFormat || 'MM/DD/YYYY',
        });
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setPreferences(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(preferences),
      });
      
      if (response.ok) {
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
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
            <Palette className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Preferences</h1>
            <p className="text-gray-400">Customize your experience</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#1A1F2E] rounded-xl border border-[rgba(255,107,53,0.2)] p-6">
            <h3 className="text-white font-medium mb-4">Theme</h3>
            <div className="flex gap-4">
              {themes.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => handleChange('theme', theme.id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                    preferences.theme === theme.id
                      ? 'border-[#FF6B35] bg-[rgba(255,107,53,0.1)]'
                      : 'border-[rgba(255,107,53,0.2)] hover:border-[rgba(255,107,53,0.4)]'
                  }`}
                >
                  <div
                    className="w-16 h-12 rounded-md border border-gray-600 relative overflow-hidden"
                    style={{ background: theme.color }}
                  >
                    {preferences.theme === theme.id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Check className="w-5 h-5 text-[#FF6B35]" />
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-gray-300">{theme.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#1A1F2E] rounded-xl border border-[rgba(255,107,53,0.2)] p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Language</label>
              <select
                value={preferences.language}
                onChange={(e) => handleChange('language', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0F1219] border border-[rgba(255,107,53,0.2)] rounded-lg text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
              >
                {languages.map(lang => (
                  <option key={lang.id} value={lang.id}>{lang.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Timezone</label>
              <select
                value={preferences.timezone}
                onChange={(e) => handleChange('timezone', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0F1219] border border-[rgba(255,107,53,0.2)] rounded-lg text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
              >
                {timezones.map(tz => (
                  <option key={tz.id} value={tz.id}>{tz.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Date Format</label>
              <select
                value={preferences.dateFormat}
                onChange={(e) => handleChange('dateFormat', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0F1219] border border-[rgba(255,107,53,0.2)] rounded-lg text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
              >
                {dateFormats.map(format => (
                  <option key={format.id} value={format.id}>{format.name}</option>
                ))}
              </select>
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
