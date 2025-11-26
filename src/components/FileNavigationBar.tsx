/**
 * FileNavigationBar Component
 * 
 * Displays a horizontal navigation bar above the data dashboard with:
 * - Folder dropdown selector (current folder with dropdown to switch)
 * - File tabs (individual files with orange borders)
 * - Folder actions (Add Data Capture, Add Folder, Rename, Delete)
 * - View Source Data button to toggle data source sidebar
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, MoreVertical, Pencil, Trash2, FolderPlus, Settings, Eye, EyeOff } from 'lucide-react';
import { FolderOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';

interface Sheet {
  id: string;
  name: string;
  rowCount: number;
  lastModified: string;
  analysisType?: 'one-time' | 'scheduled' | 'llm-integration' | 'api' | null;
  llmProvider?: { id: string; name: string };
  schedule?: { frequency: string; time: string };
}

interface Folder {
  id: string;
  name: string;
  sheets: Sheet[];
}

interface Space {
  id: string;
  name: string;
  description?: string;
  goals?: string;
  instructions?: string;
  folders: Folder[];
}

interface FileNavigationBarProps {
  space: Space;
  currentFolderId: string;
  currentSheetId: string | null;
  onFolderChange: (folderId: string) => void;
  onSheetChange: (sheetId: string) => void;
  onAddDataCapture?: (spaceId: string, folderId: string) => void;
  onAddFolder?: (spaceId: string) => void;
  onRenameFolder?: (spaceId: string, folderId: string, name: string) => void;
  onDeleteFolder?: (spaceId: string, folderId: string) => void;
  onUpdateSheetAnalysis?: (
    spaceId: string,
    folderId: string,
    sheetId: string,
    settings: {
      analysisType?: 'one-time' | 'scheduled' | 'llm-integration' | 'api' | null;
      llmProvider?: { id: string; name: string };
      schedule?: { frequency: string; time: string };
    }
  ) => void;
  // NEW: Source data toggle props
  showSourceData?: boolean;
  onToggleSourceData?: () => void;
}

export function FileNavigationBar({
  space,
  currentFolderId,
  currentSheetId,
  onFolderChange,
  onSheetChange,
  onAddDataCapture,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
  onUpdateSheetAnalysis,
  showSourceData = false,
  onToggleSourceData,
}: FileNavigationBarProps) {
  const [showFolderDropdown, setShowFolderDropdown] = useState(false);
  const [isRenamingFolder, setIsRenamingFolder] = useState(false);
  const [renameFolderValue, setRenameFolderValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  
  const currentFolder = space.folders.find(f => f.id === currentFolderId);
  const currentFolderName = currentFolder?.name || 'Select Folder';
  const files = currentFolder?.sheets || [];

  // Focus input when renaming starts
  useEffect(() => {
    if (isRenamingFolder && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenamingFolder]);

  const handleStartRename = () => {
    setRenameFolderValue(currentFolderName);
    setIsRenamingFolder(true);
  };

  const handleFinishRename = () => {
    if (renameFolderValue.trim() && renameFolderValue !== currentFolderName) {
      onRenameFolder?.(space.id, currentFolderId, renameFolderValue.trim());
    }
    setIsRenamingFolder(false);
  };

  const handleCancelRename = () => {
    setIsRenamingFolder(false);
    setRenameFolderValue('');
  };

  return (
    <div className="bg-[rgb(0,0,0)] border-b px-6 py-4 bg-[rgb(10,14,26)]">
      <div className="flex flex-col gap-3">
        {/* Folder Dropdown Row */}
        <div className="flex items-center gap-3">
          {/* Folder Dropdown */}
          <div className="relative">
            {isRenamingFolder ? (
              <div className="flex items-center gap-2">
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameFolderValue}
                  onChange={(e) => setRenameFolderValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleFinishRename();
                    } else if (e.key === 'Escape') {
                      handleCancelRename();
                    }
                  }}
                  onBlur={handleFinishRename}
                  className="px-3 py-2 bg-[#0A0E1A] border border-[#FF6B35] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35] focus:ring-opacity-50"
                  style={{ width: '200px' }}
                />
              </div>
            ) : (
              <DropdownMenu open={showFolderDropdown} onOpenChange={setShowFolderDropdown}>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-3 py-2 bg-[rgba(26,31,46,0.6)] hover:bg-[rgba(255,107,53,0.1)] border border-[rgba(255,107,53,0.15)] rounded-lg transition-colors">
                    <FolderOpen className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-white">{currentFolderName}</span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className="bg-[#1A1F2E] border-[rgba(255,107,53,0.3)] w-56"
                  align="start"
                >
                  {space.folders.map((folder) => (
                    <DropdownMenuItem
                      key={folder.id}
                      onClick={(e) => {
                        // Prevent navigation if clicking on the menu button
                        if ((e.target as HTMLElement).closest('.folder-menu-trigger')) {
                          return;
                        }
                        onFolderChange(folder.id);
                        // Auto-select first sheet if available
                        if (folder.sheets.length > 0) {
                          onSheetChange(folder.sheets[0].id);
                        }
                      }}
                      className={`cursor-pointer flex items-center justify-between ${
                        folder.id === currentFolderId
                          ? 'bg-[rgba(255,107,53,0.2)] text-[#FF6B35]'
                          : 'text-[#E5E7EB] hover:text-white hover:bg-[rgba(255,107,53,0.08)]'
                      }`}
                    >
                      <span>{folder.name}</span>
                      
                      {/* Three-dot menu for each folder */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <button 
                            className="folder-menu-trigger p-1 hover:bg-[rgba(255,107,53,0.2)] rounded transition-all"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="w-3.5 h-3.5 text-[#9CA3AF]" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-[#1A1F2E] border-[rgba(255,107,53,0.3)] w-56">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddDataCapture?.(space.id, folder.id);
                            }}
                            className="text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)] cursor-pointer"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Data Capture
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenameFolderValue(folder.name);
                              setIsRenamingFolder(true);
                              setShowFolderDropdown(false);
                              // Switch to this folder first
                              onFolderChange(folder.id);
                            }}
                            className="text-[#E5E7EB] hover:text-white hover:bg-[rgba(255,107,53,0.08)] cursor-pointer"
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Rename Folder
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete folder "${folder.name}"?`)) {
                                onDeleteFolder?.(space.id, folder.id);
                              }
                            }}
                            className="text-red-400 hover:text-red-300 hover:bg-red-400/10 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Folder
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </DropdownMenuItem>
                  ))}
                  
                  {/* New Folder Button */}
                  <DropdownMenuItem
                    onClick={() => {
                      setShowFolderDropdown(false);
                      onAddFolder?.(space.id);
                    }}
                    className="cursor-pointer text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)] flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Folder</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* NEW: View Source Data Button */}
          {onToggleSourceData && (
            <button
              onClick={onToggleSourceData}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                showSourceData
                  ? 'bg-[rgba(255,107,53,0.2)] text-[#FF6B35] border border-[rgba(255,107,53,0.5)] hover:bg-[rgba(255,107,53,0.25)]'
                  : 'bg-[rgba(26,31,46,0.6)] text-white border border-[rgba(255,107,53,0.15)] hover:bg-[rgba(255,107,53,0.1)]'
              }`}
            >
              {showSourceData ? (
                <>
                  <EyeOff className="w-4 h-4" />
                  <span className="text-sm">Hide Source Data</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  <span className="text-sm">View Source Data</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* File Tabs - Removed: Now handled by browser-style tabs in Spreadsheet component */}
      </div>
    </div>
  );
}