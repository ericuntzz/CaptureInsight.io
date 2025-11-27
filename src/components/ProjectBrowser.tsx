import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Camera, FileText, Folder, FolderOpen, ChevronRight, ChevronDown, Plus, Trash2, Settings as SettingsIcon, Check, X, MoreVertical, FolderPlus, Edit2, FileSpreadsheet, Brain, Clock, ChevronsRight, ChevronsLeft, HelpCircle, Gift, Database, LayoutGrid } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from './ui/dropdown-menu';
import { SpaceSwitcher } from './SpaceSwitcher';
import { UserAccountMenu, Company } from './UserAccountMenu';
import { CreateProjectDialog } from './CreateProjectDialog';
import { ProjectSettingsDialog } from './ProjectSettingsDialog';
import { toast } from 'sonner';
import type { Project } from '../App';
import type { DataSource } from './DataSourceSidebar';

// ⚠️ CRITICAL: Sheet analysis preferences sync with CaptureOptionsModal
// When updating this interface, also update CaptureOptionsModal analysis state
interface Sheet {
  id: string;
  name: string;
  rowCount: number;
  lastModified: string;
  // Analysis preferences (synced with CaptureOptionsModal)
  analysisType?: 'one-time' | 'scheduled' | 'llm-integration' | 'api' | null;
  llmProvider?: { id: string; name: string };
  schedule?: { frequency: string; time: string };
  // NEW: Data source tracking
  dataSource?: DataSource;
}

interface FolderType {
  id: string;
  name: string;
  sheets: Sheet[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  folders: FolderType[];
  goals?: string;
  instructions?: string;
  tags?: import('../data/insightsData').Tag[];
}

interface ProjectBrowserProps {
  projects: Project[];
  currentSpaceId?: string | null;
  onSpaceChange?: (spaceId: string) => void;
  onCreateBlankSpace?: () => Promise<string>;
  selectedSheet: string | null;
  onSelectSheet: (projectId: string, folderId: string, sheetId: string) => void;
  onCreateProject: (data: { name: string; description: string; goals: string; instructions: string }) => void;
  onUpdateProject: (projectId: string, data: { name: string; goals: string; instructions: string }) => void;
  onDeleteProject: (projectId: string) => void;
  onUpdateTags?: (spaceId: string, tags: any[]) => void;
  onUpdateFolder: (projectId: string, folderId: string, name: string) => void;
  onDeleteFolder: (projectId: string, folderId: string) => void;
  onCreateFolder: (projectId: string, folderName: string) => void;
  onAddDataCapture?: (projectId: string, folderId: string) => void;
  onUpdateSheetAnalysis?: (
    projectId: string, 
    folderId: string, 
    sheetId: string, 
    settings: {
      analysisType?: 'one-time' | 'scheduled' | 'llm-integration' | 'api' | null;
      llmProvider?: { id: string; name: string };
      schedule?: { frequency: string; time: string };
    }
  ) => void;
  activeView?: 'data' | 'ai' | 'changelogs' | 'insights' | 'workspace';
  onViewChange?: (view: 'data' | 'ai' | 'changelogs' | 'insights' | 'workspace') => void;
  onBackToCapture?: () => void;
  externalCollapseControl?: boolean;
  user?: {
    id: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    profileImageUrl?: string | null;
  } | null;
  onNavigateToSettings?: (page: 'profile' | 'settings' | 'preferences' | 'notifications' | 'billing' | 'companies') => void;
  onLogout?: () => void;
}

export function ProjectBrowser({ 
  projects, 
  currentSpaceId,
  onSpaceChange,
  onCreateBlankSpace,
  selectedSheet, 
  onSelectSheet, 
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onUpdateTags,
  onUpdateFolder,
  onDeleteFolder,
  onCreateFolder,
  onAddDataCapture,
  onUpdateSheetAnalysis,
  activeView,
  onViewChange,
  onBackToCapture,
  externalCollapseControl,
  user,
  onNavigateToSettings,
  onLogout,
}: ProjectBrowserProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set(projects.map(p => p.id)));
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Dialog states
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [projectSettingsDialog, setProjectSettingsDialog] = useState<Project | null>(null);
  
  // Inline editing state
  const [editingFolder, setEditingFolder] = useState<{ projectId: string; folderId: string; name: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState<{ projectId: string; name: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  const prevEditingFolderId = useRef<string | null>(null);
  useEffect(() => {
    if (editingFolder && editingFolder.folderId !== prevEditingFolderId.current) {
      prevEditingFolderId.current = editingFolder.folderId;
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    } else if (!editingFolder) {
      prevEditingFolderId.current = null;
    }
  }, [editingFolder]);

  // Focus input when creating folder starts
  const prevCreatingProjectId = useRef<string | null>(null);
  useEffect(() => {
    if (creatingFolder && creatingFolder.projectId !== prevCreatingProjectId.current) {
      prevCreatingProjectId.current = creatingFolder.projectId;
      if (createInputRef.current) {
        createInputRef.current.focus();
        createInputRef.current.select();
      }
    } else if (!creatingFolder) {
      prevCreatingProjectId.current = null;
    }
  }, [creatingFolder]);

  // NEW: Handle external collapse control from Canvas mode
  useEffect(() => {
    if (externalCollapseControl !== undefined) {
      setIsCollapsed(externalCollapseControl);
    }
  }, [externalCollapseControl]);

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleStartEditFolder = (projectId: string, folderId: string, currentName: string) => {
    setEditingFolder({ projectId, folderId, name: currentName });
  };

  const handleSaveEditFolder = () => {
    if (editingFolder && editingFolder.name.trim()) {
      onUpdateFolder(editingFolder.projectId, editingFolder.folderId, editingFolder.name);
      setEditingFolder(null);
    } else {
      toast.error('Folder name cannot be empty');
    }
  };

  const handleCancelEditFolder = () => {
    setEditingFolder(null);
  };

  const handleDeleteFolder = (projectId: string, folderId: string) => {
    onDeleteFolder(projectId, folderId);
    setShowDeleteConfirm(null);
  };

  const handleStartCreateFolder = (projectId: string) => {
    setCreatingFolder({ projectId, name: 'New Folder' });
  };

  const handleSaveCreateFolder = () => {
    if (creatingFolder && creatingFolder.name.trim()) {
      onCreateFolder(creatingFolder.projectId, creatingFolder.name);
      setCreatingFolder(null);
      toast.success(`Folder "${creatingFolder.name}" created successfully`);
    } else {
      toast.error('Folder name cannot be empty');
    }
  };

  const handleCancelCreateFolder = () => {
    setCreatingFolder(null);
  };

  const handleProjectsClick = () => {
    // Clicking projects icon in collapsed mode expands the sidebar
    setIsCollapsed(false);
  };

  // ⚠️ CRITICAL: Get current Space for Space-scoped architecture
  // Only show folders from the current Space
  const currentSpace = currentSpaceId ? projects.find(p => p.id === currentSpaceId) : projects[0];
  const foldersToDisplay = currentSpace?.folders || [];

  // Handle create blank Space with auto-edit
  const handleCreateBlankSpace = async () => {
    if (onCreateBlankSpace) {
      const newSpaceId = await onCreateBlankSpace();
      // Space created, switch to the new space
      if (onSpaceChange && newSpaceId) {
        onSpaceChange(newSpaceId);
      }
    }
  };

  return (
    <motion.div 
      initial={false}
      animate={{ width: isCollapsed ? 58 : 240 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="bg-[#1A1F2E] h-full flex flex-col"
    >
      {/* Space Switcher */}
      <div className="px-2 pt-4 pb-2">
        {onSpaceChange && (
          <SpaceSwitcher
            spaces={projects}
            currentSpaceId={currentSpaceId || null}
            onSpaceChange={onSpaceChange}
            onCreateSpace={onCreateProject}
            onUpdateSpace={onUpdateProject}
            onDeleteSpace={onDeleteProject}
            onUpdateTags={onUpdateTags}
            isCollapsed={isCollapsed}
          />
        )}
      </div>

      {/* Divider */}
      <div className="mx-2 mb-2 border-b border-[rgba(255,107,53,0.1)]" />

      {/* Navigation Buttons */}
      <div className="px-2 pb-2">
        {/* Workspace Button - New Unified View */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onViewChange?.('workspace')}
              className={`w-full h-10 flex items-center rounded-lg transition-all mb-2 group px-3 ${
                activeView === 'workspace'
                  ? 'bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white'
                  : 'text-[#9CA3AF] hover:bg-[rgba(255,107,53,0.1)] hover:text-white'
              }`}
            >
              <LayoutGrid className={`w-4 h-4 flex-shrink-0 ${activeView !== 'workspace' && isCollapsed ? 'group-hover:text-[#FF6B35]' : ''}`} />
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm whitespace-nowrap overflow-hidden ml-3"
                  >
                    Workspace
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right" className="bg-[#2D3B4E] border-[rgba(255,107,53,0.3)] text-white">
              Workspace
            </TooltipContent>
          )}
        </Tooltip>

        {/* Insights Button (Legacy) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onViewChange?.('insights')}
              className={`w-full h-10 flex items-center rounded-lg transition-all mb-2 group px-3 ${
                activeView === 'insights'
                  ? 'bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white'
                  : 'text-[#9CA3AF] hover:bg-[rgba(255,107,53,0.1)] hover:text-white'
              }`}
            >
              <Brain className={`w-4 h-4 flex-shrink-0 ${activeView !== 'insights' && isCollapsed ? 'group-hover:text-[#FF6B35]' : ''}`} />
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm whitespace-nowrap overflow-hidden ml-3"
                  >
                    Insights
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right" className="bg-[#2D3B4E] border-[rgba(255,107,53,0.3)] text-white">
              Insights
            </TooltipContent>
          )}
        </Tooltip>

        {/* Upload Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onBackToCapture}
              className="w-full h-10 flex items-center rounded-lg transition-all mb-2 text-[#9CA3AF] hover:bg-[rgba(255,107,53,0.1)] hover:text-white group px-3"
            >
              <Plus className={`w-4 h-4 flex-shrink-0 ${isCollapsed ? 'group-hover:text-[#FF6B35]' : ''}`} />
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm whitespace-nowrap overflow-hidden ml-3"
                  >
                    Upload
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right" className="bg-[#2D3B4E] border-[rgba(255,107,53,0.3)] text-white">
              Upload
            </TooltipContent>
          )}
        </Tooltip>

        {/* Change Logs Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onViewChange?.('changelogs')}
              className={`w-full h-10 flex items-center rounded-lg transition-all mb-2 group px-3 ${
                activeView === 'changelogs'
                  ? 'bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white'
                  : 'text-[#9CA3AF] hover:bg-[rgba(255,107,53,0.1)] hover:text-white'
              }`}
            >
              <FileText className={`w-4 h-4 flex-shrink-0 ${activeView !== 'changelogs' && isCollapsed ? 'group-hover:text-[#FF6B35]' : ''}`} />
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm whitespace-nowrap overflow-hidden ml-3"
                  >
                    Change Logs
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right" className="bg-[#2D3B4E] border-[rgba(255,107,53,0.3)] text-white">
              Change Logs
            </TooltipContent>
          )}
        </Tooltip>

        {/* Files Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onViewChange?.('data')}
              className={`w-full h-10 flex items-center rounded-lg transition-all mb-2 group px-3 ${
                activeView === 'data'
                  ? 'bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white'
                  : 'text-[#9CA3AF] hover:bg-[rgba(255,107,53,0.1)] hover:text-white'
              }`}
            >
              <Folder className={`w-4 h-4 flex-shrink-0 ${activeView !== 'data' && isCollapsed ? 'group-hover:text-[#FF6B35]' : ''}`} />
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm whitespace-nowrap overflow-hidden ml-3"
                  >
                    Files
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right" className="bg-[#2D3B4E] border-[rgba(255,107,53,0.3)] text-white">
              Files
            </TooltipContent>
          )}
        </Tooltip>

        {/* AI Assistant Button - REMOVED: Now using Canvas mode for AI interactions */}
      </div>

      {/* Spacer - Removed folders section */}
      <div className="flex-1" />

      {/* Footer */}
      <div className="px-2 py-4">
        {/* Collapse/Expand Menu Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="w-full h-10 flex items-center rounded-lg transition-all text-[#6B7280] hover:bg-[rgba(255,107,53,0.1)] hover:text-white mb-1 group px-3"
            >
              {isCollapsed ? (
                <ChevronsRight className="w-4 h-4 flex-shrink-0 group-hover:text-[#FF6B35]" />
              ) : (
                <>
                  <ChevronsLeft className="w-4 h-4 flex-shrink-0" />
                  <AnimatePresence>
                    <motion.span 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-sm whitespace-nowrap overflow-hidden ml-3"
                    >
                    </motion.span>
                  </AnimatePresence>
                </>
              )}
            </button>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right" className="bg-[#2D3B4E] border-[rgba(255,107,53,0.3)] text-white">
              Expand
            </TooltipContent>
          )}
        </Tooltip>

        {/* Support */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="w-full h-10 flex items-center rounded-lg transition-all text-[#6B7280] hover:bg-[rgba(255,107,53,0.1)] hover:text-white mb-1 group px-3">
              <HelpCircle className={`w-4 h-4 flex-shrink-0 ${isCollapsed ? 'group-hover:text-[#FF6B35]' : ''}`} />
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm whitespace-nowrap overflow-hidden ml-3"
                  >
                    Support
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right" className="bg-[#2D3B4E] border-[rgba(255,107,53,0.3)] text-white">
              Support
            </TooltipContent>
          )}
        </Tooltip>

        {/* What's New? */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="w-full h-10 flex items-center rounded-lg transition-all text-[#6B7280] hover:bg-[rgba(255,107,53,0.1)] hover:text-white mb-1 group px-3">
              <Gift className={`w-4 h-4 flex-shrink-0 ${isCollapsed ? 'group-hover:text-[#FF6B35]' : ''}`} />
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm whitespace-nowrap overflow-hidden ml-3"
                  >
                    What's New?
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right" className="bg-[#2D3B4E] border-[rgba(255,107,53,0.3)] text-white">
              What's New?
            </TooltipContent>
          )}
        </Tooltip>

        {/* User Profile */}
        <UserAccountMenu
          userName={user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'User' : 'Guest'}
          userInitials={user ? (user.firstName && user.lastName ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : (user.email?.[0] || 'U').toUpperCase()) : 'G'}
          userEmail={user?.email || ''}
          currentCompany={{
            id: '1',
            name: 'CaptureInsight Demo',
            role: 'owner'
          }}
          companies={[
            { id: '1', name: 'CaptureInsight Demo', role: 'owner' },
          ]}
          isCollapsed={isCollapsed}
          onSwitchCompany={(companyId) => {
            toast.success(`Switched to company`);
          }}
          onCreateCompany={() => {
            onNavigateToSettings?.('companies');
          }}
          onSettings={() => {
            onNavigateToSettings?.('settings');
          }}
          onProfile={() => {
            onNavigateToSettings?.('profile');
          }}
          onPreferences={() => {
            onNavigateToSettings?.('preferences');
          }}
          onBilling={() => {
            onNavigateToSettings?.('billing');
          }}
          onHelp={() => {
            window.open('https://captureinsight.com/help', '_blank');
          }}
          onLogout={() => {
            if (onLogout) {
              onLogout();
            } else {
              window.location.href = '/api/logout';
            }
          }}
        />
      </div>

      {/* Dialogs */}
      <CreateProjectDialog
        isOpen={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        onCreate={onCreateProject}
      />

      {projectSettingsDialog && (
        <ProjectSettingsDialog
          isOpen={true}
          onClose={() => setProjectSettingsDialog(null)}
          projectName={projectSettingsDialog.name}
          projectId={projectSettingsDialog.id}
          project={projectSettingsDialog}
          currentGoals={projectSettingsDialog.goals}
          currentInstructions={projectSettingsDialog.instructions}
          onSave={onUpdateProject}
          onDelete={onDeleteProject}
        />
      )}
    </motion.div>
  );
}