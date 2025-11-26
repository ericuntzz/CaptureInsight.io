import React, { useState, useRef, useEffect } from 'react';
import { Edit3, Type, Save, FolderOpen, Plus, Palette, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Project } from './ProjectBrowser';

interface CaptureBoxMenuProps {
  captureIndex: number;
  captureBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  scrollOffset: { left: number; top: number };
  title: string;
  onTitleChange: (title: string) => void;
  selectedFolder: string;
  onFolderChange: (folder: string) => void;
  onToggleMarkup: () => void;
  isMarkupActive: boolean;
  projects?: Project[];
}

const MOCK_PROJECTS = [
  {
    name: 'Marketing Analytics',
    folders: ['Q4 Marketing Data', 'Campaign Performance', 'Social Media Metrics']
  },
  {
    name: 'Sales Intelligence',
    folders: ['Sales Performance', 'Revenue Tracking', 'Customer Acquisition']
  },
  {
    name: 'Product Insights',
    folders: ['Product Analytics', 'User Behavior', 'Feature Usage']
  },
  {
    name: 'Customer Data',
    folders: ['Customer Insights', 'Support Tickets', 'Satisfaction Scores']
  },
  {
    name: 'Financial Reports',
    folders: ['Financial Reports', 'Budget Analysis', 'Expense Tracking']
  }
];

const MOCK_FOLDERS = [
  'Q4 Marketing Data',
  'Sales Performance',
  'Product Analytics',
  'Customer Insights',
  'Financial Reports'
];

export function CaptureBoxMenu({
  captureIndex,
  captureBox,
  scrollOffset,
  title,
  onTitleChange,
  selectedFolder,
  onFolderChange,
  onToggleMarkup,
  isMarkupActive,
  projects = MOCK_PROJECTS
}: CaptureBoxMenuProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const [hoveredProject, setHoveredProject] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleSave = () => {
    onTitleChange(localTitle);
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setLocalTitle(title);
      setIsEditingTitle(false);
    }
  };

  // Calculate position - always above the capture box
  const menuX = captureBox.x - scrollOffset.left;
  const menuY = captureBox.y - scrollOffset.top - 48; // 48px above the box

  return (
    <div
      ref={menuRef}
      className="fixed z-[90] pointer-events-auto"
      style={{
        left: `${menuX}px`,
        top: `${menuY}px`,
      }}
    >
      <div className="flex items-center gap-2 bg-[rgba(26,31,46,0.98)] backdrop-blur-xl border border-[rgba(255,107,53,0.3)] rounded-lg px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
        {/* Mark Up Screen Button */}
        <button
          onClick={onToggleMarkup}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-all ${
            isMarkupActive
              ? 'bg-[rgba(255,107,53,0.2)] text-[#FF6B35] border border-[rgba(255,107,53,0.5)]'
              : 'text-[#9CA3AF] hover:text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)]'
          }`}
          title="Mark Up Screen"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Mark Up</span>
        </button>

        <div className="w-px h-5 bg-[rgba(255,107,53,0.2)]" />

        {/* Edit Title */}
        {isEditingTitle ? (
          <div className="flex items-center gap-1">
            <input
              ref={titleInputRef}
              type="text"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyDown}
              className="bg-[#0A0E1A] border border-[#FF6B35] rounded px-2 py-1 text-xs text-white w-48 outline-none"
              placeholder="Enter title..."
            />
          </div>
        ) : (
          <button
            onClick={() => setIsEditingTitle(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-[#9CA3AF] hover:text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)] transition-all max-w-[200px]"
            title="Edit Title"
          >
            <Type className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{title}</span>
          </button>
        )}

        <div className="w-px h-5 bg-[rgba(255,107,53,0.2)]" />

        {/* Save To Folder */}
        <div className="relative">
          <button
            onClick={() => setShowFolderMenu(!showFolderMenu)}
            onMouseEnter={() => setShowFolderMenu(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-[#9CA3AF] hover:text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)] transition-all"
            title="Save To"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save To</span>
          </button>

          {/* Folder Dropdown */}
          <AnimatePresence>
            {showFolderMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onMouseLeave={() => {
                  setShowFolderMenu(false);
                  setHoveredProject(null);
                }}
                className="absolute top-full mt-2 left-0 w-56 bg-[rgba(26,31,46,0.98)] backdrop-blur-xl border border-[rgba(255,107,53,0.3)] rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden"
              >
                <div className="p-2">
                  <div className="text-[10px] text-[#9CA3AF] px-2 py-1 mb-1">
                    SAVE TO
                  </div>

                  {/* Projects with submenu */}
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="relative"
                      onMouseEnter={() => setHoveredProject(project.id)}
                    >
                      <button
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-xs text-[#9CA3AF] hover:text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)] transition-all text-left"
                      >
                        <div className="flex items-center gap-2">
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span className="truncate">{project.name}</span>
                        </div>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
                          <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>

                      {/* Submenu for folders */}
                      <AnimatePresence>
                        {hoveredProject === project.id && (
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="absolute left-full top-0 ml-1 w-52 bg-[rgba(26,31,46,0.98)] backdrop-blur-xl border border-[rgba(255,107,53,0.3)] rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden"
                          >
                            <div className="p-2">
                              <div className="text-[10px] text-[#9CA3AF] px-2 py-1 mb-1">
                                {project.name.toUpperCase()} FOLDERS
                              </div>
                              {project.folders.map((folder) => {
                                const folderDisplayName = `${project.name} → ${folder.name}`;
                                const isSelected = selectedFolder.includes(folder.name) || selectedFolder === folderDisplayName;
                                return (
                                  <button
                                    key={folder.id}
                                    onClick={() => {
                                      onFolderChange(folderDisplayName);
                                      setShowFolderMenu(false);
                                      setHoveredProject(null);
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-all text-left ${
                                      isSelected
                                        ? 'bg-[rgba(255,107,53,0.2)] text-[#FF6B35]'
                                        : 'text-[#9CA3AF] hover:text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)]'
                                    }`}
                                  >
                                    {isSelected && (
                                      <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]" />
                                    )}
                                    <FolderOpen className="w-3.5 h-3.5" />
                                    <span className="truncate">{folder.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
