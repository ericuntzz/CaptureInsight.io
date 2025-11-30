import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Camera, FileText, Folder, FolderOpen, ChevronRight, ChevronDown, Plus, Trash2, Settings as SettingsIcon, Check, X, MoreVertical, FolderPlus, Edit2, FileSpreadsheet, Brain, Clock, ChevronsRight, ChevronsLeft, HelpCircle, Gift, Database, LayoutGrid } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from './ui/dropdown-menu';
import { SpaceSwitcher } from './SpaceSwitcher';
import { UserAccountMenu, Company } from './UserAccountMenu';
import { CreateProjectDialog } from './CreateProjectDialog';
import { ProjectSettingsDialog } from './ProjectSettingsDialog';
import { WorkspaceDeleteDialog } from './WorkspaceDeleteDialog';
import { toast } from 'sonner';
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

interface WorkspaceType {
  id: string;
  name: string;
  sheets: Sheet[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  folders: WorkspaceType[];
  workspaces?: WorkspaceType[];
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
  activeWorkspaceId?: string | null;
  onWorkspaceChange?: (workspaceId: string) => void;
  onCreateWorkspace?: (spaceId: string, name: string) => void;
  onDeleteWorkspace?: (workspaceId: string) => void;
  newlyCreatedWorkspaceId?: string | null;
  onNewlyCreatedWorkspaceHandled?: () => void;
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
  activeWorkspaceId,
  onWorkspaceChange,
  onCreateWorkspace,
  onDeleteWorkspace,
  newlyCreatedWorkspaceId,
  onNewlyCreatedWorkspaceHandled,
}: ProjectBrowserProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set(Array.isArray(projects) ? projects.map(p => p.id) : []));
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
  
  // Workspace creation state
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const workspaceInputRef = useRef<HTMLInputElement>(null);
  const [showWorkspaceFlyout, setShowWorkspaceFlyout] = useState(false);
  const workspaceButtonRef = useRef<HTMLButtonElement>(null);
  const [flyoutPosition, setFlyoutPosition] = useState<{ top: number; left: number }>({ top: 0, left: 60 });
  
  // Workspace delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<{ id: string; name: string } | null>(null);
  
  // Workspace editing state - separate ID and name to prevent re-render on every keystroke
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [editingWorkspaceName, setEditingWorkspaceName] = useState('');
  const workspaceEditInputRef = useRef<HTMLInputElement>(null);

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

  // Focus workspace input when creating starts
  useEffect(() => {
    if (isCreatingWorkspace && workspaceInputRef.current) {
      workspaceInputRef.current.focus();
      workspaceInputRef.current.select();
    }
  }, [isCreatingWorkspace]);

  // Calculate flyout position when it opens
  useEffect(() => {
    if (showWorkspaceFlyout && workspaceButtonRef.current) {
      const rect = workspaceButtonRef.current.getBoundingClientRect();
      setFlyoutPosition({
        top: rect.top,
        left: 60,
      });
    }
  }, [showWorkspaceFlyout]);

  // Workspace handlers - create immediately on "+" click, then allow renaming
  const handleStartCreateWorkspace = () => {
    if (currentSpaceId && onCreateWorkspace) {
      // Create workspace immediately with default name and switch to it
      onCreateWorkspace(currentSpaceId, 'Untitled Workspace');
    }
  };

  const handleSaveCreateWorkspace = () => {
    if (newWorkspaceName.trim() && currentSpaceId && onCreateWorkspace) {
      onCreateWorkspace(currentSpaceId, newWorkspaceName.trim());
      setIsCreatingWorkspace(false);
      setNewWorkspaceName('');
      toast.success(`Workspace "${newWorkspaceName.trim()}" created`);
    } else if (!newWorkspaceName.trim()) {
      toast.error('Workspace name cannot be empty');
    }
  };

  const handleCancelCreateWorkspace = () => {
    setIsCreatingWorkspace(false);
    setNewWorkspaceName('');
  };

  const handleSelectWorkspace = (workspaceId: string) => {
    onWorkspaceChange?.(workspaceId);
    onViewChange?.('workspace');
    setShowWorkspaceFlyout(false);
  };

  // Workspace editing handlers
  const handleStartEditWorkspace = (workspaceId: string, currentName: string) => {
    setEditingWorkspaceId(workspaceId);
    setEditingWorkspaceName(currentName);
  };

  const handleSaveEditWorkspace = () => {
    if (editingWorkspaceId && editingWorkspaceName.trim() && currentSpaceId) {
      onUpdateFolder(currentSpaceId, editingWorkspaceId, editingWorkspaceName.trim());
      setEditingWorkspaceId(null);
      setEditingWorkspaceName('');
    } else if (editingWorkspaceId && !editingWorkspaceName.trim()) {
      toast.error('Workspace name cannot be empty');
    }
  };

  const handleCancelEditWorkspace = () => {
    setEditingWorkspaceId(null);
    setEditingWorkspaceName('');
  };

  // Focus workspace edit input when editing starts
  useEffect(() => {
    if (editingWorkspaceId && workspaceEditInputRef.current) {
      workspaceEditInputRef.current.focus();
      workspaceEditInputRef.current.select();
    }
  }, [editingWorkspaceId]);

  const handleProjectsClick = () => {
    // Clicking projects icon in collapsed mode expands the sidebar
    setIsCollapsed(false);
  };

  // ⚠️ CRITICAL: Get current Space for Space-scoped architecture
  // Only show folders from the current Space
  const safeProjects = Array.isArray(projects) ? projects : [];
  const currentSpace = currentSpaceId ? safeProjects.find(p => p.id === currentSpaceId) : safeProjects[0];
  const foldersToDisplay = currentSpace?.folders || [];

  // Auto-start editing when a new workspace is created
  useEffect(() => {
    if (newlyCreatedWorkspaceId) {
      // Find the workspace with this ID to get its name
      const workspaces = currentSpace?.workspaces || currentSpace?.folders || [];
      const newWorkspace = workspaces.find(w => w.id === newlyCreatedWorkspaceId);
      if (newWorkspace) {
        handleStartEditWorkspace(newlyCreatedWorkspaceId, newWorkspace.name);
        onNewlyCreatedWorkspaceHandled?.();
      }
    }
  }, [newlyCreatedWorkspaceId, currentSpace?.workspaces, currentSpace?.folders]);

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
        {/* Add Data Button */}
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
                    Add Data
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right" className="bg-[#2D3B4E] border-[rgba(255,107,53,0.3)] text-white">
              Add Data
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
      </div>

      {/* Divider */}
      <div className="mx-2 mb-2 border-b border-[rgba(255,107,53,0.1)]" />

      {/* Workspaces Section */}
      <div className="px-2 flex-1 overflow-hidden flex flex-col">
        {/* Workspaces Header - Collapsed Mode with Flyout */}
        {isCollapsed ? (
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  ref={workspaceButtonRef}
                  onClick={() => setShowWorkspaceFlyout(!showWorkspaceFlyout)}
                  className={`w-full h-10 flex items-center justify-center rounded-lg transition-all mb-2 group ${
                    activeView === 'workspace'
                      ? 'bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white'
                      : 'text-[#9CA3AF] hover:bg-[rgba(255,107,53,0.1)] hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4 flex-shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-[#2D3B4E] border-[rgba(255,107,53,0.3)] text-white">
                Workspaces
              </TooltipContent>
            </Tooltip>

            {/* Flyout Menu for Collapsed Mode */}
            <AnimatePresence>
              {showWorkspaceFlyout && (
                <>
                  {/* Backdrop to close flyout */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowWorkspaceFlyout(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    style={{ top: flyoutPosition.top, left: flyoutPosition.left }}
                    className="fixed w-56 bg-[#1A1F2E] border border-[#2A2F3E] rounded-lg shadow-xl z-50 py-2"
                  >
                    {/* Header */}
                    <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-[#2A2F3E] mb-1">
                      Workspaces
                    </div>
                    
                    {/* New Workspace Button */}
                    <button
                      onClick={() => {
                        handleStartCreateWorkspace();
                        setShowWorkspaceFlyout(false);
                        setIsCollapsed(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)] transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>New Workspace</span>
                    </button>
                    
                    {/* Workspace List */}
                    <div className="max-h-64 overflow-y-auto">
                      {(currentSpace?.workspaces || currentSpace?.folders || []).map((workspace) => (
                        <button
                          key={workspace.id}
                          onClick={() => handleSelectWorkspace(workspace.id)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                            activeWorkspaceId === workspace.id
                              ? 'bg-[rgba(255,107,53,0.15)] text-[#FF6B35]'
                              : 'text-gray-300 hover:bg-[rgba(255,107,53,0.1)] hover:text-white'
                          }`}
                        >
                          <LayoutGrid className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{workspace.name}</span>
                        </button>
                      ))}
                      {(currentSpace?.workspaces || currentSpace?.folders || []).length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500 italic">
                          No workspaces yet
                        </div>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <>
            {/* Workspaces Header - Expanded Mode */}
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Workspaces
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleStartCreateWorkspace}
                    className="p-1 text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)] rounded transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[#2D3B4E] border-[rgba(255,107,53,0.3)] text-white">
                  New Workspace
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Inline Create Workspace Input */}
            <AnimatePresence>
              {isCreatingWorkspace && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="mb-2"
                >
                  <input
                    ref={workspaceInputRef}
                    type="text"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveCreateWorkspace();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        handleCancelCreateWorkspace();
                      }
                    }}
                    onBlur={handleSaveCreateWorkspace}
                    className="w-full px-3 py-2 bg-[#0D1117] text-white text-sm rounded-lg border border-[#FF6B35] outline-none placeholder-gray-500"
                    placeholder="Workspace name..."
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Workspace List */}
            <div className="flex-1 overflow-y-auto space-y-1">
              {(currentSpace?.workspaces || currentSpace?.folders || []).map((workspace) => (
                <div
                  key={workspace.id}
                  className={`w-full h-9 flex items-center gap-2 px-3 rounded-lg transition-all group relative ${
                    activeWorkspaceId === workspace.id
                      ? 'bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white'
                      : 'text-[#9CA3AF] hover:bg-[rgba(255,107,53,0.1)] hover:text-white'
                  }`}
                >
                  {editingWorkspaceId === workspace.id ? (
                    // Inline edit mode
                    <div className="flex-1 flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 flex-shrink-0" />
                      <input
                        ref={workspaceEditInputRef}
                        type="text"
                        value={editingWorkspaceName}
                        onChange={(e) => setEditingWorkspaceName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveEditWorkspace();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            handleCancelEditWorkspace();
                          }
                        }}
                        onBlur={handleSaveEditWorkspace}
                        className="flex-1 bg-[#0D1117] text-white text-sm rounded border border-[#FF6B35] px-2 py-0.5 outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  ) : (
                    // Normal display mode with double-click to edit
                    <button
                      onClick={() => handleSelectWorkspace(workspace.id)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleStartEditWorkspace(workspace.id, workspace.name);
                      }}
                      className="flex-1 flex items-center gap-2 h-full"
                      title="Double-click to rename"
                    >
                      <LayoutGrid className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm truncate">{workspace.name}</span>
                    </button>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setWorkspaceToDelete({ id: workspace.id, name: workspace.name });
                          setShowDeleteDialog(true);
                        }}
                        className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                          activeWorkspaceId === workspace.id
                            ? 'hover:bg-white/20 text-white'
                            : 'hover:bg-red-500/20 text-gray-400 hover:text-red-400'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-[#2D3B4E] border-[rgba(255,107,53,0.3)] text-white">
                      Delete Workspace
                    </TooltipContent>
                  </Tooltip>
                </div>
              ))}
              {(currentSpace?.workspaces || currentSpace?.folders || []).length === 0 && !isCreatingWorkspace && (
                <div className="px-3 py-4 text-sm text-gray-500 text-center">
                  <p className="mb-2">No workspaces yet</p>
                  <button
                    onClick={handleStartCreateWorkspace}
                    className="text-[#FF6B35] hover:underline text-sm"
                  >
                    Create your first workspace
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

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

      {workspaceToDelete && (
        <WorkspaceDeleteDialog
          isOpen={showDeleteDialog}
          onClose={() => {
            setShowDeleteDialog(false);
            setWorkspaceToDelete(null);
          }}
          workspaceId={workspaceToDelete.id}
          workspaceName={workspaceToDelete.name}
          onConfirmDelete={() => {
            if (onDeleteWorkspace) {
              onDeleteWorkspace(workspaceToDelete.id);
            }
            setShowDeleteDialog(false);
            setWorkspaceToDelete(null);
          }}
        />
      )}
    </motion.div>
  );
}