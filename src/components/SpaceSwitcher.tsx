import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Settings, Plus, Layers } from 'lucide-react';
import { Space } from './SpaceBrowser';
import { SpaceSettingsDialog } from './SpaceSettingsDialog';
import { CreateProjectDialog } from './CreateProjectDialog';
import { motion, AnimatePresence } from 'motion/react';
import { Tag } from '../data/insightsData';

interface SpaceSwitcherProps {
  spaces: Space[];
  currentSpaceId: string | null;
  onSpaceChange: (spaceId: string) => void;
  onCreateSpace: (data: { name: string; description: string; goals: string; instructions: string }) => void;
  onUpdateSpace: (spaceId: string, data: { name: string; goals: string; instructions: string }) => void;
  onDeleteSpace: (spaceId: string) => void;
  onUpdateTags?: (spaceId: string, tags: Tag[]) => void;
  isCollapsed: boolean;
}

export function SpaceSwitcher({
  spaces,
  currentSpaceId,
  onSpaceChange,
  onCreateSpace,
  onUpdateSpace,
  onDeleteSpace,
  onUpdateTags,
  isCollapsed,
}: SpaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentSpace = spaces.find(s => s.id === currentSpaceId);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSpaceSelect = (spaceId: string) => {
    onSpaceChange(spaceId);
    setIsOpen(false);
  };

  const handleCreateSpaceClick = () => {
    setShowCreateDialog(true);
    setIsOpen(false);
  };

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSettings(true);
    setIsOpen(false);
  };

  if (isCollapsed) {
    // Collapsed mode - show icon only
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full h-12 flex items-center justify-center hover:bg-[rgba(255,107,53,0.1)] transition-colors rounded-lg"
          title={currentSpace?.name || 'Select Space'}
        >
          <Layers className="w-5 h-5 text-[#FF6B35]" />
        </button>

        {/* Dropdown menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="absolute left-full ml-2 top-0 w-64 bg-[#1A1F2E] border border-[rgba(255,107,53,0.2)] rounded-lg shadow-2xl z-50 overflow-hidden"
            >
              {/* Current Space Header */}
              {currentSpace && (
                <div className="px-3 py-2 border-b border-[rgba(255,107,53,0.1)] bg-[#1A1F2E]">
                  <div className="text-xs text-gray-400 mb-0.5">Current Space</div>
                </div>
              )}

              {/* Space List */}
              <div className="max-h-[400px] overflow-y-auto py-1">
                {spaces.map(space => (
                  <button
                    key={space.id}
                    onClick={() => handleSpaceSelect(space.id)}
                    className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                      space.id === currentSpaceId ? 'text-[#FF6B35]' : 'text-white hover:text-[#FFA07A]'
                    }`}
                  >
                    <div className="truncate">{space.name}</div>
                  </button>
                ))}
              </div>

              {/* Add New Space */}
              <div className="p-1">
                <button
                  onClick={handleCreateSpaceClick}
                  className="w-full px-3 py-2 text-left text-xs text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)] transition-colors rounded flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add a New Space
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Dialog */}
        {currentSpace && showSettings && (
          <SpaceSettingsDialog
            isOpen={true}
            onClose={() => setShowSettings(false)}
            spaceName={currentSpace.name}
            spaceId={currentSpace.id}
            space={currentSpace}
            currentGoals={currentSpace.goals}
            currentInstructions={currentSpace.instructions}
            onSave={onUpdateSpace}
            onDelete={onDeleteSpace}
            onUpdateTags={onUpdateTags}
          />
        )}

        {/* Create Dialog */}
        {showCreateDialog && (
          <CreateProjectDialog
            isOpen={true}
            onClose={() => setShowCreateDialog(false)}
            onCreate={(data) => {
              onCreateSpace(data);
              setShowCreateDialog(false);
            }}
          />
        )}
      </div>
    );
  }

  // Expanded mode
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 flex items-center gap-2 bg-[rgba(26,31,46,0.6)] hover:bg-[rgba(255,107,53,0.1)] border border-[rgba(255,107,53,0.15)] rounded-lg transition-colors"
      >
        <Layers className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <div className="flex-1 min-w-0 text-left">
          <span className="text-sm text-white truncate block">
            {currentSpace?.name || 'Select a Space'}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {currentSpace && (
            <div
              onClick={handleSettingsClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleSettingsClick(e as any);
                }
              }}
              className="p-1 hover:bg-[rgba(255,107,53,0.2)] rounded transition-colors cursor-pointer"
              title="Space Settings"
            >
              <Settings className="w-3.5 h-3.5 text-gray-400" />
            </div>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute left-0 right-0 top-full mt-1 bg-[#1A1F2E] border border-[rgba(255,107,53,0.2)] rounded-lg shadow-2xl z-50 overflow-hidden"
          >
            {/* Space List */}
            <div className="max-h-[400px] overflow-y-auto py-1">
              {spaces.map(space => (
                <button
                  key={space.id}
                  onClick={() => handleSpaceSelect(space.id)}
                  className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                    space.id === currentSpaceId ? 'text-[#FF6B35]' : 'text-white hover:text-[#FFA07A]'
                  }`}
                >
                  <div className="truncate">{space.name}</div>
                </button>
              ))}
            </div>

            {/* Add New Space */}
            <div className="p-1">
              <button
                onClick={handleCreateSpaceClick}
                className="w-full px-3 py-2 text-left text-xs text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)] transition-colors rounded flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add a New Space
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Dialog */}
      {currentSpace && showSettings && (
        <SpaceSettingsDialog
          isOpen={true}
          onClose={() => setShowSettings(false)}
          spaceName={currentSpace.name}
          spaceId={currentSpace.id}
          space={currentSpace}
          currentGoals={currentSpace.goals}
          currentInstructions={currentSpace.instructions}
          onSave={onUpdateSpace}
          onDelete={onDeleteSpace}
          onUpdateTags={onUpdateTags}
        />
      )}

      {/* Create Dialog */}
      {showCreateDialog && (
        <CreateProjectDialog
          isOpen={true}
          onClose={() => setShowCreateDialog(false)}
          onCreate={(data) => {
            onCreateSpace(data);
            setShowCreateDialog(false);
          }}
        />
      )}
    </div>
  );
}