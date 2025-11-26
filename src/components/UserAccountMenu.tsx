/**
 * ============================================================================
 * DEVELOPER NOTE: MULTI-COMPANY/BRAND MANAGEMENT - CRITICAL FEATURE
 * ============================================================================
 * 
 * PURPOSE:
 * This component enables users to manage multiple companies/brands within a single
 * account. This is ESSENTIAL for:
 * 
 * 1. AGENCIES: Marketing/analytics agencies managing multiple client companies
 * 2. FREELANCERS: Independent consultants working with various brands
 * 3. CONSULTANTS: Business consultants managing insights for multiple organizations
 * 4. IN-HOUSE TEAMS: Teams managing multiple sub-brands or business units
 * 
 * DATA SEPARATION REQUIREMENTS:
 * - Each Company must have COMPLETELY ISOLATED data:
 *   - Separate Spaces (Projects)
 *   - Separate Folders
 *   - Separate Captured Sheets/Insights
 *   - Separate Vector Database entries
 *   - Separate AI Analyst Assistant context
 * 
 * BACKEND IMPLEMENTATION NEEDED:
 * 
 * 1. DATABASE SCHEMA:
 *    - Create `companies` table with fields:
 *      - id (UUID, primary key)
 *      - name (string)
 *      - logo (string, URL to logo image)
 *      - created_at (timestamp)
 *      - updated_at (timestamp)
 * 
 *    - Create `user_companies` junction table:
 *      - user_id (UUID, foreign key to users)
 *      - company_id (UUID, foreign key to companies)
 *      - role (enum: 'owner', 'admin', 'member', 'viewer')
 *      - created_at (timestamp)
 * 
 *    - Update ALL existing tables to include `company_id`:
 *      - spaces (projects) → company_id
 *      - folders → company_id
 *      - sheets (captures) → company_id
 *      - vector_embeddings → company_id
 *      - ai_chat_history → company_id
 * 
 * 2. ROW LEVEL SECURITY (RLS):
 *    - Implement Supabase RLS policies to ensure users can ONLY access
 *      data belonging to companies they're members of
 *    - Example policy: WHERE company_id IN (
 *        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
 *      )
 * 
 * 3. VECTOR DATABASE:
 *    - Add company_id metadata to ALL vector embeddings
 *    - Update search queries to filter by company_id
 *    - This ensures AI Analyst Assistant only references data from current company
 * 
 * 4. FRONTEND STATE MANAGEMENT:
 *    - Store current company ID in localStorage: 'captureinsight_current_company'
 *    - Pass company_id to ALL API calls
 *    - Reset/reload all data when switching companies
 * 
 * 5. API ENDPOINTS NEEDED:
 *    - GET /api/companies → List all companies user has access to
 *    - POST /api/companies → Create new company
 *    - PUT /api/companies/:id → Update company details
 *    - DELETE /api/companies/:id → Delete company (with cascade)
 *    - POST /api/companies/:id/switch → Switch active company
 *    - GET /api/companies/:id/members → List company members
 *    - POST /api/companies/:id/invite → Invite user to company
 * 
 * SECURITY CONSIDERATIONS:
 * - NEVER allow data leakage between companies
 * - Validate company_id on EVERY backend request
 * - Log company switches for audit trail
 * - Implement proper authorization checks (user must be member of company)
 * 
 * ============================================================================
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Settings, 
  User, 
  Building2, 
  ChevronRight, 
  Check,
  LogOut,
  Bell,
  HelpCircle,
  CreditCard,
  Palette
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface Company {
  id: string;
  name: string;
  logo?: string;
  role?: 'owner' | 'admin' | 'member' | 'viewer';
}

interface UserAccountMenuProps {
  userName: string;
  userInitials: string;
  userEmail?: string;
  currentCompany?: Company;
  companies?: Company[];
  isCollapsed: boolean;
  onSwitchCompany?: (companyId: string) => void;
  onCreateCompany?: () => void;
  onSettings?: () => void;
  onProfile?: () => void;
  onPreferences?: () => void;
  onBilling?: () => void;
  onHelp?: () => void;
  onLogout?: () => void;
}

export function UserAccountMenu({
  userName,
  userInitials,
  userEmail,
  currentCompany,
  companies = [],
  isCollapsed,
  onSwitchCompany,
  onCreateCompany,
  onSettings,
  onProfile,
  onPreferences,
  onBilling,
  onHelp,
  onLogout,
}: UserAccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCompanySwitch, setShowCompanySwitch] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCompanySwitch(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleMenuItemClick = (action?: () => void) => {
    if (action) action();
    setIsOpen(false);
    setShowCompanySwitch(false);
  };

  const handleCompanySwitchClick = () => {
    setShowCompanySwitch(true);
  };

  const handleBackToMainMenu = () => {
    setShowCompanySwitch(false);
  };

  const handleCompanySelect = (companyId: string) => {
    if (onSwitchCompany) {
      onSwitchCompany(companyId);
    }
    setIsOpen(false);
    setShowCompanySwitch(false);
  };

  if (isCollapsed) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-center rounded-lg transition-all text-[#6B7280] hover:bg-[rgba(255,107,53,0.1)] hover:text-white group p-3"
          title={userName}
        >
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FFA07A] flex items-center justify-center text-white text-[9px] group-hover:ring-2 group-hover:ring-[#FF6B35]">
            {userInitials}
          </div>
        </button>

        {/* Dropdown Menu - Collapsed Mode */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="absolute left-full ml-2 bottom-0 w-64 bg-[#1A1F2E] border border-[rgba(255,107,53,0.2)] rounded-lg shadow-2xl z-50 overflow-hidden"
            >
              {renderMenuContent()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Expanded mode
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center rounded-lg transition-all text-[#6B7280] hover:bg-[rgba(255,107,53,0.1)] hover:text-white group p-3"
      >
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FFA07A] flex items-center justify-center text-white text-[9px] flex-shrink-0">
          {userInitials}
        </div>
        <motion.span 
          className="text-sm whitespace-nowrap overflow-hidden ml-3 flex-1 text-left"
        >
          {userName}
        </motion.span>
      </button>

      {/* Dropdown Menu - Expanded Mode */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute left-0 right-0 bottom-full mb-2 bg-[#1A1F2E] border border-[rgba(255,107,53,0.2)] rounded-lg shadow-2xl z-50 overflow-hidden"
          >
            {renderMenuContent()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  function renderMenuContent() {
    if (showCompanySwitch) {
      return (
        <>
          {/* Company Switch Header */}
          <div className="px-3 py-2 border-b border-[rgba(255,107,53,0.1)] bg-[rgba(255,107,53,0.05)]">
            <button
              onClick={handleBackToMainMenu}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <ChevronRight className="w-3 h-3 rotate-180" />
              Back
            </button>
            <div className="text-sm text-white mt-1">Switch Company</div>
          </div>

          {/* Company List */}
          <div className="max-h-[300px] overflow-y-auto py-1">
            {companies.map(company => (
              <button
                key={company.id}
                onClick={() => handleCompanySelect(company.id)}
                className={`w-full px-3 py-2.5 text-left hover:bg-[rgba(255,107,53,0.1)] transition-colors flex items-center justify-between ${
                  currentCompany?.id === company.id ? 'bg-[rgba(255,107,53,0.08)]' : ''
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded bg-[rgba(255,107,53,0.2)] flex items-center justify-center text-[#FF6B35] flex-shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{company.name}</div>
                    {company.role && (
                      <div className="text-xs text-gray-400 capitalize">{company.role}</div>
                    )}
                  </div>
                </div>
                {currentCompany?.id === company.id && (
                  <Check className="w-4 h-4 text-[#FF6B35] flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* Create New Company */}
          <div className="border-t border-[rgba(255,107,53,0.1)] p-1">
            <button
              onClick={() => handleMenuItemClick(onCreateCompany)}
              className="w-full px-3 py-2 text-left text-sm text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)] transition-colors rounded"
            >
              + Create New Company
            </button>
          </div>
        </>
      );
    }

    // Main Menu
    return (
      <>
        {/* User Info Header */}
        <div className="px-3 py-3 border-b border-[rgba(255,107,53,0.1)] bg-[rgba(255,107,53,0.05)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FFA07A] flex items-center justify-center text-white">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white truncate">{userName}</div>
              {userEmail && (
                <div className="text-xs text-gray-400 truncate">{userEmail}</div>
              )}
            </div>
          </div>
          {currentCompany && (
            <div className="mt-2 pt-2 border-t border-[rgba(255,107,53,0.1)]">
              <div className="text-xs text-gray-400">Current Company</div>
              <div className="text-sm text-white truncate flex items-center gap-2 mt-0.5">
                <Building2 className="w-3 h-3 text-[#FF6B35]" />
                {currentCompany.name}
              </div>
            </div>
          )}
        </div>

        {/* Menu Items */}
        <div className="py-1">
          <MenuItem
            icon={User}
            label="Profile"
            onClick={() => handleMenuItemClick(onProfile)}
          />
          <MenuItem
            icon={Settings}
            label="Settings"
            onClick={() => handleMenuItemClick(onSettings)}
          />
          <MenuItem
            icon={Palette}
            label="Preferences"
            onClick={() => handleMenuItemClick(onPreferences)}
          />
          <MenuItem
            icon={Bell}
            label="Notifications"
            onClick={() => handleMenuItemClick()}
          />
          <MenuItem
            icon={CreditCard}
            label="Billing"
            onClick={() => handleMenuItemClick(onBilling)}
          />
        </div>

        {/* Company Switch Section */}
        {companies.length > 0 && (
          <>
            <div className="border-t border-[rgba(255,107,53,0.1)]" />
            <div className="py-1">
              <MenuItem
                icon={Building2}
                label="Switch Company"
                onClick={handleCompanySwitchClick}
                showChevron
                highlight
              />
            </div>
          </>
        )}

        {/* Bottom Actions */}
        <div className="border-t border-[rgba(255,107,53,0.1)]" />
        <div className="py-1">
          <MenuItem
            icon={LogOut}
            label="Log Out"
            onClick={() => handleMenuItemClick(onLogout)}
            danger
          />
        </div>
      </>
    );
  }
}

interface MenuItemProps {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  showChevron?: boolean;
  highlight?: boolean;
  danger?: boolean;
}

function MenuItem({ icon: Icon, label, onClick, showChevron, highlight, danger }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-2 text-left text-sm hover:bg-[rgba(255,107,53,0.1)] transition-colors flex items-center justify-between ${
        highlight ? 'text-[#FF6B35]' : danger ? 'text-red-400 hover:text-red-300' : 'text-white'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </div>
      {showChevron && (
        <ChevronRight className="w-4 h-4 text-gray-400" />
      )}
    </button>
  );
}