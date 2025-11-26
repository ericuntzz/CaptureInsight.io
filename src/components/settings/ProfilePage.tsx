import { useState, useEffect } from 'react';
import { ArrowLeft, User, Camera, Save, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface ProfilePageProps {
  onBack: () => void;
}

export function ProfilePage({ onBack }: ProfilePageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    profileImageUrl: '',
  });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/profile', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setProfile({
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          profileImageUrl: data.profileImageUrl || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          firstName: profile.firstName,
          lastName: profile.lastName,
          profileImageUrl: profile.profileImageUrl,
        }),
      });
      
      if (response.ok) {
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
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
            <User className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Profile</h1>
            <p className="text-gray-400">Manage your personal information</p>
          </div>
        </div>

        <div className="bg-[#1A1F2E] rounded-xl border border-[rgba(255,107,53,0.2)] p-6 space-y-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FFA07A] flex items-center justify-center text-white text-2xl font-semibold">
                {profile.firstName?.[0] || profile.email?.[0] || 'U'}
                {profile.lastName?.[0] || ''}
              </div>
              <button className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#FF6B35] flex items-center justify-center text-white hover:bg-[#E55A2B] transition-colors">
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-400">Profile Photo</p>
              <p className="text-xs text-gray-500 mt-1">JPG, PNG or GIF. Max 2MB.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                First Name
              </label>
              <input
                type="text"
                value={profile.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0F1219] border border-[rgba(255,107,53,0.2)] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6B35] transition-colors"
                placeholder="Enter first name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Last Name
              </label>
              <input
                type="text"
                value={profile.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0F1219] border border-[rgba(255,107,53,0.2)] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6B35] transition-colors"
                placeholder="Enter last name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="w-full px-4 py-2.5 bg-[#0F1219] border border-[rgba(255,107,53,0.1)] rounded-lg text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Email is managed by your authentication provider</p>
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
