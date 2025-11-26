import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Camera, FileText, Folder, FolderOpen, ChevronRight, ChevronDown, Plus, Trash2, Settings as SettingsIcon, Check, X, MoreVertical, FolderPlus, Edit2, FileSpreadsheet, Brain, Clock, ChevronsRight, ChevronsLeft, HelpCircle, Gift, Database } from 'lucide-react';
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
  currentSpaceId?: string | null; // ⚠️ NEW: Current active Space for Space-scoped architecture
  onSpaceChange?: (spaceId: string) => void; // ⚠️ NEW: Handle Space switching
  onCreateBlankSpace?: () => Promise<string>; // ⚠️ NEW: Create blank Space (returns spaceId)
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
  activeView?: 'data' | 'ai' | 'changelogs' | 'insights';
  onViewChange?: (view: 'data' | 'ai' | 'changelogs' | 'insights') => void;
  onBackToCapture?: () => void;
  externalCollapseControl?: boolean; // NEW: External control for collapse state
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
  // Only show folders from the current Space - use fallback to first project if not found
  const currentSpace = (currentSpaceId && projects.find(p => p.id === currentSpaceId)) || projects[0];
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
      {/* Space Header - Original design with name + settings gear */}
      <div className="px-2 pt-4 pb-2">
        {!isCollapsed ? (
          <div className="flex items-center justify-between">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[rgba(255,107,53,0.1)] transition-colors text-white max-w-[180px]">
                  <Sparkles className="w-4 h-4 text-[#FF6B35] flex-shrink-0" />
                  <span className="text-sm font-medium truncate">
                    {currentSpace?.name || 'Select a Space'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 bg-[#2D3B4E] border-[rgba(255,107,53,0.2)]">
                {projects.map((space) => (
                  <DropdownMenuItem
                    key={space.id}
                    onClick={() => onSpaceChange?.(space.id)}
                    className={`text-white hover:bg-[rgba(255,107,53,0.1)] cursor-pointer ${
                      space.id === currentSpace?.id ? 'bg-[rgba(255,107,53,0.15)]' : ''
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-2 text-[#FF6B35]" />
                    <span className="truncate">{space.name}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="bg-[rgba(255,107,53,0.1)]" />
                <DropdownMenuItem
                  onClick={() => setShowCreateProject(true)}
                  className="text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-2" />
                  Create New Space
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => currentSpace && setProjectSettingsDialog(currentSpace)}
                  className="p-1.5 rounded hover:bg-[rgba(255,107,53,0.1)] text-[#6B7280] hover:text-white transition-colors"
                >
                  <SettingsIcon className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-[#2D3B4E] border-[rgba(255,107,53,0.3)] text-white">
                Space Settings
              </TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={handleProjectsClick}
                className="w-full flex justify-center p-2 text-[#FF6B35]"
              >
                <Sparkles className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-[#2D3B4E] border-[rgba(255,107,53,0.3)] text-white">
              {currentSpace?.name || 'Spaces'}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Divider */}
      <div className="mx-2 mb-2 border-b border-[rgba(255,107,53,0.1)]" />

      {/* Navigation Buttons */}
      <div className="px-2 pb-2">
        {/* Insights Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onViewChange?.('insights')}
              className={`w-full flex items-center rounded-lg transition-all mb-2 group p-3 ${isCollapsed ? 'justify-center' : ''} ${
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
              onClick={() => onBackToCapture?.()}
              className={`w-full flex items-center rounded-lg transition-all mb-2 group p-3 ${isCollapsed ? 'justify-center' : ''} text-[#9CA3AF] hover:bg-[rgba(255,107,53,0.1)] hover:text-white`}
            >
              <Camera className={`w-4 h-4 flex-shrink-0 ${isCollapsed ? 'group-hover:text-[#FF6B35]' : ''}`} />
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm whitespace-nowrap overflow-hidden ml-3"
                  >
                    + Upload
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
              className={`w-full flex items-center rounded-lg transition-all mb-2 group p-3 ${isCollapsed ? 'justify-center' : ''} ${
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
              className={`w-full flex items-center rounded-lg transition-all mb-2 group p-3 ${isCollapsed ? 'justify-center' : ''} ${
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

      {/* Folders Tree - Only shown when Files view is active */}
      {activeView === 'data' && !isCollapsed && (
        <div className="flex-1 overflow-y-auto px-2">
          {/* Folders Header with Add Button */}
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs text-[#6B7280] uppercase tracking-wide">Folders</span>
            {currentSpace && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleStartCreateFolder(currentSpace.id)}
                    className="p-1 rounded hover:bg-[rgba(255,107,53,0.1)] text-[#6B7280] hover:text-[#FF6B35] transition-colors"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[#2D3B4E] border-[rgba(255,107,53,0.3)] text-white">
                  New Folder
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Folder List */}
          {foldersToDisplay.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-[#6B7280] text-sm">No folders yet</p>
              {currentSpace && (
                <button
                  onClick={() => handleStartCreateFolder(currentSpace.id)}
                  className="mt-2 text-xs text-[#FF6B35] hover:underline"
                >
                  Create your first folder
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {foldersToDisplay.map((folder: FolderType) => (
                <div key={folder.id}>
                  {/* Folder Row */}
                  <div
                    className={`group flex items-center rounded-lg transition-all hover:bg-[rgba(255,107,53,0.1)] ${
                      expandedFolders.has(folder.id) ? 'bg-[rgba(255,107,53,0.05)]' : ''
                    }`}
                  >
                    {/* Expand/Collapse Toggle */}
                    <button
                      onClick={() => toggleFolder(folder.id)}
                      className="p-2 text-[#6B7280] hover:text-white"
                    >
                      {expandedFolders.has(folder.id) ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Folder Icon & Name */}
                    {editingFolder?.folderId === folder.id ? (
                      <div className="flex-1 flex items-center gap-1 pr-2">
                        <input
                          ref={inputRef}
                          type="text"
                          value={editingFolder?.name || ''}
                          onChange={(e) => editingFolder && setEditingFolder({ ...editingFolder, name: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEditFolder();
                            if (e.key === 'Escape') handleCancelEditFolder();
                          }}
                          className="flex-1 bg-[#2D3B4E] text-white text-sm px-2 py-1 rounded border border-[rgba(255,107,53,0.3)] focus:outline-none focus:border-[#FF6B35]"
                        />
                        <button onClick={handleSaveEditFolder} className="p-1 text-green-400 hover:text-green-300">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={handleCancelEditFolder} className="p-1 text-red-400 hover:text-red-300">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 flex items-center gap-2 py-2 text-[#9CA3AF] hover:text-white cursor-pointer" onClick={() => toggleFolder(folder.id)}>
                          {expandedFolders.has(folder.id) ? (
                            <FolderOpen className="w-4 h-4 text-[#FF6B35]" />
                          ) : (
                            <Folder className="w-4 h-4" />
                          )}
                          <span className="text-sm truncate">{folder.name}</span>
                          <span className="text-xs text-[#6B7280]">({folder.sheets?.length || 0})</span>
                        </div>

                        {/* Folder Actions */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 opacity-0 group-hover:opacity-100 text-[#6B7280] hover:text-white transition-opacity">
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-[#2D3B4E] border-[rgba(255,107,53,0.2)]">
                            <DropdownMenuItem
                              onClick={() => currentSpace && handleStartEditFolder(currentSpace.id, folder.id, folder.name)}
                              className="text-white hover:bg-[rgba(255,107,53,0.1)] cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5 mr-2" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-[rgba(255,107,53,0.1)]" />
                            <DropdownMenuItem
                              onClick={() => setShowDeleteConfirm(folder.id)}
                              className="text-red-400 hover:bg-[rgba(255,107,53,0.1)] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </div>

                  {/* Delete Confirmation */}
                  {showDeleteConfirm === folder.id && (
                    <div className="ml-6 p-2 bg-[#2D3B4E] rounded-lg border border-red-500/30 mb-1">
                      <p className="text-xs text-[#9CA3AF] mb-2">Delete "{folder.name}"?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => currentSpace && handleDeleteFolder(currentSpace.id, folder.id)}
                          className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(null)}
                          className="px-2 py-1 text-xs bg-[#1A1F2E] text-[#9CA3AF] rounded hover:bg-[#252B3B]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Sheets List (when folder expanded) */}
                  <AnimatePresence>
                    {expandedFolders.has(folder.id) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="ml-6 overflow-hidden"
                      >
                        {folder.sheets && folder.sheets.length > 0 ? (
                          folder.sheets.map((sheet: Sheet) => (
                            <button
                              key={sheet.id}
                              onClick={() => currentSpace && onSelectSheet(currentSpace.id, folder.id, sheet.id)}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                                selectedSheet === sheet.id
                                  ? 'bg-[rgba(255,107,53,0.2)] text-[#FF6B35]'
                                  : 'text-[#9CA3AF] hover:bg-[rgba(255,107,53,0.1)] hover:text-white'
                              }`}
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              <span className="truncate">{sheet.name}</span>
                            </button>
                          ))
                        ) : (
                          <p className="text-xs text-[#6B7280] px-2 py-1.5 italic">No files yet</p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}

          {/* Create Folder Input */}
          {creatingFolder && currentSpace?.id === creatingFolder.projectId && (
            <div className="mt-2 flex items-center gap-1 px-1">
              <FolderPlus className="w-4 h-4 text-[#FF6B35]" />
              <input
                ref={createInputRef}
                type="text"
                value={creatingFolder.name}
                onChange={(e) => setCreatingFolder({ ...creatingFolder, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveCreateFolder();
                  if (e.key === 'Escape') handleCancelCreateFolder();
                }}
                className="flex-1 bg-[#2D3B4E] text-white text-sm px-2 py-1 rounded border border-[rgba(255,107,53,0.3)] focus:outline-none focus:border-[#FF6B35]"
              />
              <button onClick={handleSaveCreateFolder} className="p-1 text-green-400 hover:text-green-300">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleCancelCreateFolder} className="p-1 text-red-400 hover:text-red-300">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Spacer when not showing folders */}
      {(activeView !== 'data' || isCollapsed) && <div className="flex-1" />}

      {/* Footer */}
      <div className="px-2 py-4">
        {/* Collapse/Expand Menu Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`w-full flex items-center rounded-lg transition-all text-[#6B7280] hover:bg-[rgba(255,107,53,0.1)] hover:text-white mb-1 group p-3 ${isCollapsed ? 'justify-center' : ''}`}
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
            <button className={`w-full flex items-center rounded-lg transition-all text-[#6B7280] hover:bg-[rgba(255,107,53,0.1)] hover:text-white mb-1 group p-3 ${isCollapsed ? 'justify-center' : ''}`}>
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
            <button className={`w-full flex items-center rounded-lg transition-all text-[#6B7280] hover:bg-[rgba(255,107,53,0.1)] hover:text-white mb-1 group p-3 ${isCollapsed ? 'justify-center' : ''}`}>
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
          userName="Eric Unterberger"
          userInitials="EU"
          userEmail="eric@captureinsight.com"
          currentCompany={{
            id: '1',
            name: 'CaptureInsight Demo',
            role: 'owner'
          }}
          companies={[
            { id: '1', name: 'CaptureInsight Demo', role: 'owner' },
            { id: '2', name: 'Acme Marketing Agency', role: 'admin' },
            { id: '3', name: 'Tech Startup Inc', role: 'member' }
          ]}
          isCollapsed={isCollapsed}
          onSwitchCompany={(companyId) => {
            console.log('Switch to company:', companyId);
            toast.success(`Switched to ${companyId === '1' ? 'CaptureInsight Demo' : companyId === '2' ? 'Acme Marketing Agency' : 'Tech Startup Inc'}`);
          }}
          onCreateCompany={() => {
            console.log('Create new company');
            toast.success('Create Company feature coming soon!');
          }}
          onSettings={() => {
            console.log('Open settings');
          }}
          onProfile={() => {
            console.log('Open profile');
          }}
          onPreferences={() => {
            console.log('Open preferences');
          }}
          onBilling={() => {
            console.log('Open billing');
          }}
          onHelp={() => {
            console.log('Open help');
          }}
          onLogout={() => {
            console.log('Logout');
            toast.success('Logged out successfully');
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