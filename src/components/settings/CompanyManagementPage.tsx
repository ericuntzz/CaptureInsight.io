import { useState, useEffect } from 'react';
import { ArrowLeft, Building2, Plus, Loader2, Settings, Users, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CompanyManagementPageProps {
  onBack: () => void;
  onCompanySwitch?: (companyId: string) => void;
}

interface Company {
  id: string;
  name: string;
  logo?: string;
  industry?: string;
  size?: string;
  website?: string;
  role: string;
  createdAt?: string;
}

export function CompanyManagementPage({ onBack, onCompanySwitch }: CompanyManagementPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCompany, setNewCompany] = useState({
    name: '',
    industry: '',
    size: '',
    website: '',
  });

  useEffect(() => {
    fetchCompanies();
    fetchCurrentCompany();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await fetch('/api/companies', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setCompanies(data);
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCurrentCompany = async () => {
    try {
      const response = await fetch('/api/settings', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setCurrentCompanyId(data.currentCompanyId);
      }
    } catch (error) {
      console.error('Failed to fetch current company:', error);
    }
  };

  const handleSwitchCompany = async (companyId: string) => {
    try {
      const response = await fetch(`/api/companies/${companyId}/switch`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        setCurrentCompanyId(companyId);
        if (onCompanySwitch) {
          onCompanySwitch(companyId);
        }
      }
    } catch (error) {
      console.error('Failed to switch company:', error);
    }
  };

  const handleCreateCompany = async () => {
    if (!newCompany.name.trim()) return;
    
    setIsCreating(true);
    try {
      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newCompany),
      });
      
      if (response.ok) {
        const created = await response.json();
        setCompanies(prev => [...prev, created]);
        setShowCreateModal(false);
        setNewCompany({ name: '', industry: '', size: '', website: '' });
        
        if (companies.length === 0) {
          handleSwitchCompany(created.id);
        }
      }
    } catch (error) {
      console.error('Failed to create company:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    if (!confirm('Are you sure you want to delete this company? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/companies/${companyId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (response.ok) {
        setCompanies(prev => prev.filter(c => c.id !== companyId));
        if (currentCompanyId === companyId) {
          setCurrentCompanyId(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete company:', error);
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

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FFA07A] flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white">Companies</h1>
              <p className="text-gray-400">Manage your companies and switch between them</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#FF6B35] text-white rounded-lg hover:bg-[#E55A2B] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Company
          </button>
        </div>

        {companies.length === 0 ? (
          <div className="bg-[#1A1F2E] rounded-xl border border-[rgba(255,107,53,0.2)] p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-white font-medium mb-2">No companies yet</h3>
            <p className="text-gray-400 mb-6">Create your first company to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF6B35] text-white rounded-lg hover:bg-[#E55A2B] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Company
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {companies.map(company => (
              <div
                key={company.id}
                className={`bg-[#1A1F2E] rounded-xl border p-4 transition-all ${
                  currentCompanyId === company.id
                    ? 'border-[#FF6B35] bg-[rgba(255,107,53,0.05)]'
                    : 'border-[rgba(255,107,53,0.2)] hover:border-[rgba(255,107,53,0.4)]'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[rgba(255,107,53,0.2)] flex items-center justify-center text-[#FF6B35]">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium truncate">{company.name}</span>
                      <span className="text-xs px-2 py-0.5 bg-[rgba(255,107,53,0.2)] text-[#FF6B35] rounded capitalize">
                        {company.role}
                      </span>
                      {currentCompanyId === company.id && (
                        <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400 flex items-center gap-4 mt-1">
                      {company.industry && <span>{company.industry}</span>}
                      {company.size && <span>{company.size} employees</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentCompanyId !== company.id && (
                      <button
                        onClick={() => handleSwitchCompany(company.id)}
                        className="px-3 py-1.5 text-sm bg-[rgba(255,107,53,0.15)] text-[#FF6B35] rounded-lg hover:bg-[rgba(255,107,53,0.25)] transition-colors"
                      >
                        Switch
                      </button>
                    )}
                    {company.role === 'owner' && (
                      <>
                        <button
                          className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-[rgba(255,107,53,0.1)]"
                          title="Company settings"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-[rgba(255,107,53,0.1)]"
                          title="Manage members"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCompany(company.id)}
                          className="p-2 text-gray-400 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                          title="Delete company"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1A1F2E] rounded-xl border border-[rgba(255,107,53,0.2)] p-6 w-full max-w-md"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-xl font-semibold text-white mb-6">Create New Company</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={newCompany.name}
                    onChange={(e) => setNewCompany(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[#0F1219] border border-[rgba(255,107,53,0.2)] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6B35] transition-colors"
                    placeholder="Enter company name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Industry
                  </label>
                  <select
                    value={newCompany.industry}
                    onChange={(e) => setNewCompany(prev => ({ ...prev, industry: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[#0F1219] border border-[rgba(255,107,53,0.2)] rounded-lg text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                  >
                    <option value="">Select industry</option>
                    <option value="Technology">Technology</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Finance">Finance</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="E-commerce">E-commerce</option>
                    <option value="Education">Education</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Company Size
                  </label>
                  <select
                    value={newCompany.size}
                    onChange={(e) => setNewCompany(prev => ({ ...prev, size: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[#0F1219] border border-[rgba(255,107,53,0.2)] rounded-lg text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                  >
                    <option value="">Select size</option>
                    <option value="1-10">1-10</option>
                    <option value="11-50">11-50</option>
                    <option value="51-200">51-200</option>
                    <option value="201-500">201-500</option>
                    <option value="500+">500+</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Website
                  </label>
                  <input
                    type="url"
                    value={newCompany.website}
                    onChange={(e) => setNewCompany(prev => ({ ...prev, website: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[#0F1219] border border-[rgba(255,107,53,0.2)] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6B35] transition-colors"
                    placeholder="https://example.com"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCompany}
                  disabled={!newCompany.name.trim() || isCreating}
                  className="flex items-center gap-2 px-4 py-2 bg-[#FF6B35] text-white rounded-lg hover:bg-[#E55A2B] transition-colors disabled:opacity-50"
                >
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Create Company
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
