/**
 * ============================================================================
 * CRITICAL: PROJECT/FOLDER STATE SYNCHRONIZATION  
 * ============================================================================
 * 
 * This component displays the floating toolbar with integrated data capture preferences.
 * 
 * ⚠️ All capture preferences are now INLINE in this toolbar as individual icon buttons.
 * When user captures/uploads/adds link, setting buttons appear in the toolbar.
 * Each button shows its own popup menu when clicked.
 * 
 * State Management:
 * - `projects` prop comes from App.tsx (single source of truth)
 * - `defaultDestination` prop is synced across application
 * - `onDestinationChange` updates App.tsx state when user changes destination
 * - Analysis settings (LLM, schedule, etc.) are managed here and passed to onFinalCapture
 * 
 * When making changes here, also check:
 * - App.tsx (main state management and synchronization)
 * - DataManagementView.tsx (projects sidebar)
 * ============================================================================
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Square, Scan, Link2, Upload, Camera, FolderOpen, ArrowLeft, ChevronDown, Brain, Clock, Zap, Calendar, Check, Plus, Trash2, EyeOff, Database, Tag as TagIcon, Sparkles, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Project } from './ProjectBrowser';
import { Badge } from './ui/badge';
import { Tag, TAG_COLORS } from '../data/insightsData';
import { TagBadge } from './TagBadge';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useTags, useCreateTag } from '../hooks/useTags';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';

interface LLMProvider {
  id: string;
  name: string;
  connected: boolean;
}

interface ValidationInfo {
  hasWarnings: boolean;
  hasErrors: boolean;
  warningCount: number;
  errorCount: number;
  message: string;
}

interface FloatingCaptureToolbarProps {
  onClose: () => void;
  onCaptureWindow: () => void;
  onCaptureRegion: () => void;
  onInsertShareLink: (url: string) => void;
  onUploadFile: () => void;
  onFinalCapture: (settings?: CaptureSettings) => void;
  captureCount: number;
  currentMode: 'window' | 'region';
  selectedCaptureIndices: number[];
  onToggleBlur?: (index: number) => void;
  isBlurActive?: boolean;
  selectedFolder?: string;
  onFolderChange?: (index: number, folder: string) => void;
  targetFolder?: { projectId: string; folderId: string } | null;
  spaces: Project[]; // Renamed from projects, but using Project type for now (will be Space after full refactor)
  defaultDestination?: { spaceId: string; folderId: string } | null; // Changed projectId to spaceId
  onDestinationChange?: (spaceId: string, folderId: string) => void; // Changed projectId to spaceId
  hasUploadedFile?: boolean;
  hasAddedLink?: boolean;
  analysisType?: 'one-time' | 'scheduled' | null;
  analysisFrequency?: string;
  analysisTime?: string;
  selectedLlmId?: string | null;
  onAnalysisTypeChange?: (type: 'one-time' | 'scheduled' | null) => void;
  onAnalysisFrequencyChange?: (frequency: string) => void;
  onAnalysisTimeChange?: (time: string) => void;
  onSelectedLlmChange?: (id: string | null) => void;
  onViewDashboard?: () => void;
  forceOpenPopup?: 'destination' | 'llm' | 'schedule' | null;
  validationInfo?: ValidationInfo;
}

export interface CaptureSettings {
  destination: { projectId?: string; spaceId?: string; folderId: string };
  analysisType: 'one-time' | 'scheduled' | 'llm-integration' | 'api' | null;
  llmProvider?: { id: string; name: string };
  schedule?: { frequency: string; time: string };
}

export function FloatingCaptureToolbar({
  onClose,
  onCaptureWindow,
  onCaptureRegion,
  onInsertShareLink,
  onUploadFile,
  onFinalCapture,
  captureCount,
  currentMode,
  selectedCaptureIndices,
  onToggleBlur,
  isBlurActive = false,
  spaces, // Renamed from projects
  defaultDestination,
  onDestinationChange,
  hasUploadedFile = false,
  hasAddedLink = false,
  analysisType: propAnalysisType,
  analysisFrequency: propAnalysisFrequency = 'daily',
  analysisTime: propAnalysisTime = '09:00',
  selectedLlmId: propSelectedLlmId,
  onAnalysisTypeChange,
  onAnalysisFrequencyChange,
  onAnalysisTimeChange,
  onSelectedLlmChange,
  onViewDashboard,
  forceOpenPopup,
  validationInfo
}: FloatingCaptureToolbarProps) {
  const { user } = useAuth();
  const toolbarRef = useRef<HTMLDivElement>(null);
  
  const [showValidationWarningDialog, setShowValidationWarningDialog] = useState(false);
  
  // Individual popup states
  const [showDestinationPopup, setShowDestinationPopup] = useState(false);
  const [showLlmPopup, setShowLlmPopup] = useState(false);
  const [showApiPopup, setShowApiPopup] = useState(false);
  const [showSaveToMenu, setShowSaveToMenu] = useState(false);
  const [showShareLinkPopup, setShowShareLinkPopup] = useState(false);
  const [showApiTooltip, setShowApiTooltip] = useState(false);
  const [showTagsPopup, setShowTagsPopup] = useState(false); // NEW: Tags popup state
  
  // Track if schedule settings have changed
  const [scheduleChanged, setScheduleChanged] = useState(false);
  const [appliedFrequency, setAppliedFrequency] = useState(propAnalysisFrequency);
  const [appliedTime, setAppliedTime] = useState(propAnalysisTime);
  
  // Track first time showing settings buttons (for pulsating glow)
  const [showPulseGlow, setShowPulseGlow] = useState(false);
  const hasShownSettingsRef = useRef(false);
  
  // Destination menu navigation
  const [menuView, setMenuView] = useState<'projects' | 'folders'>('projects');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  // NEW: Tags state - fetch real tags from API
  const currentSpaceId = defaultDestination?.spaceId || null;
  const { data: rawTags = [], isLoading: tagsLoading, isError: tagsError } = useTags(currentSpaceId);
  const createTagMutation = useCreateTag();
  
  // Convert API tags to UI format with date conversion
  const tags: Tag[] = useMemo(() => {
    if (!rawTags || !Array.isArray(rawTags)) return [];
    return rawTags.map((tag: any) => ({
      ...tag,
      createdAt: tag.createdAt instanceof Date ? tag.createdAt : new Date(tag.createdAt),
    }));
  }, [rawTags]);
  
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  
  // Use props if provided, otherwise use local state (for backward compatibility)
  const analysisType = propAnalysisType ?? null;
  const frequency = propAnalysisFrequency;
  const time = propAnalysisTime;
  const selectedLlmId = propSelectedLlmId ?? null;
  
  const setAnalysisType = onAnalysisTypeChange || (() => {});
  const setFrequency = onAnalysisFrequencyChange || (() => {});
  const setTime = onAnalysisTimeChange || (() => {});
  const setSelectedLlmId = onSelectedLlmChange || (() => {});
  
  const [llmProviders] = useState<LLMProvider[]>([
    { id: 'chatgpt', name: 'ChatGPT', connected: true },
    { id: 'claude', name: 'Claude', connected: true }
  ]);
  
  // Get current destination info for display
  const currentProject = defaultDestination ? spaces.find(p => p.id === defaultDestination.spaceId) : null;
  const currentFolder = currentProject ? currentProject.folders.find(f => f.id === defaultDestination?.folderId) : null;
  
  // Get the project being viewed in the folder menu
  const viewedProject = selectedProjectId ? spaces.find(p => p.id === selectedProjectId) : null;

  // Show setting buttons if user has captured, uploaded, or added a link
  const showSettingButtons = captureCount > 0 || hasUploadedFile || hasAddedLink;

  // Trigger pulsating glow on first appearance of settings buttons
  useEffect(() => {
    if (showSettingButtons && !hasShownSettingsRef.current) {
      hasShownSettingsRef.current = true;
      setShowPulseGlow(true);
      
      // Auto-remove glow after 10 seconds
      const timeout = setTimeout(() => {
        setShowPulseGlow(false);
      }, 10000);
      
      return () => clearTimeout(timeout);
    }
  }, [showSettingButtons]);

  // Respond to external popup triggers from CaptureAssignmentPanel
  useEffect(() => {
    if (forceOpenPopup === 'destination') {
      setShowDestinationPopup(true);
      setShowLlmPopup(false);
      setShowApiPopup(false);
      setShowSaveToMenu(false);
      setShowShareLinkPopup(false);
      setMenuView('projects');
    } else if (forceOpenPopup === 'llm') {
      setShowLlmPopup(true);
      setShowDestinationPopup(false);
      setShowApiPopup(false);
      setShowSaveToMenu(false);
      setShowShareLinkPopup(false);
    } else if (forceOpenPopup === 'schedule') {
      setShowLlmPopup(true);
      setShowDestinationPopup(false);
      setShowApiPopup(false);
      setShowSaveToMenu(false);
      setShowShareLinkPopup(false);
    }
  }, [forceOpenPopup]);

  // Close all popups when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setShowDestinationPopup(false);
        setShowLlmPopup(false);
        setShowApiPopup(false);
        setShowSaveToMenu(false);
        setShowShareLinkPopup(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const captureButtons = [
    {
      id: 'region',
      icon: Scan,
      label: 'Capture Selected Portion',
      onClick: onCaptureRegion,
      variant: 'capture' as const,
      isActive: currentMode === 'region'
    },
    {
      id: 'window',
      icon: Square,
      label: 'Capture Selected Window',
      onClick: onCaptureWindow,
      variant: 'capture' as const,
      isActive: currentMode === 'window'
    },
    {
      id: 'upload',
      icon: Upload,
      label: 'Upload File',
      onClick: onUploadFile,
      variant: 'default' as const
    }
  ];

  const executeFinalCapture = () => {
    // Check if user has any spaces and workspaces
    const currentSpace = spaces.find(s => s.id === defaultDestination?.spaceId) || spaces[0];
    const hasNoSpaces = spaces.length === 0;
    const hasNoWorkspaces = !currentSpace?.folders || currentSpace.folders.length === 0;
    
    // For new users without spaces or workspaces, allow proceeding - both will be auto-created
    // Only show error if user HAS workspaces but hasn't selected a destination
    if (!defaultDestination && !hasNoWorkspaces && !hasNoSpaces) {
      toast.error('Please select a destination first');
      return;
    }
    
    // Build destination - spaceId and folderId may be empty for new users (will be auto-created in App.tsx)
    const destination = defaultDestination || {
      spaceId: currentSpace?.id || '',
      folderId: '' // Empty - will trigger auto-create in App.tsx
    };

    const settings: CaptureSettings = {
      destination,
      analysisType: selectedLlmId ? 'llm-integration' : analysisType,
      llmProvider: selectedLlmId ? llmProviders.find(p => p.id === selectedLlmId) : undefined,
      schedule: analysisType === 'scheduled' ? { frequency, time } : undefined
    };

    onFinalCapture(settings);
  };

  const handleFinalCapture = () => {
    if (validationInfo?.hasWarnings || validationInfo?.hasErrors) {
      setShowValidationWarningDialog(true);
    } else {
      executeFinalCapture();
    }
  };

  return (
    <div 
      ref={toolbarRef}
      className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[100]"
      style={{
        pointerEvents: 'auto'
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-1 bg-[rgba(26,31,46,0.98)] backdrop-blur-xl border border-[rgba(26,31,46,0.98)] rounded-xl px-2 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
      >
        {/* Capture Mode Buttons */}
        {captureButtons.map((button) => {
          const Icon = button.icon;
          return (
            <TooltipButton
              key={button.id}
              icon={Icon}
              label={button.label}
              onClick={button.onClick}
              variant={button.variant}
              isActive={button.isActive}
            />
          );
        })}

        {/* Share Link Button with Popup */}
        <ShareLinkButton
          isActive={showShareLinkPopup}
          onClick={() => {
            setShowShareLinkPopup(!showShareLinkPopup);
            setShowDestinationPopup(false);
            setShowLlmPopup(false);
            setShowApiPopup(false);
            setShowSaveToMenu(false);
          }}
          isOpen={showShareLinkPopup}
          onSubmit={(url) => {
            onInsertShareLink(url);
            setShowShareLinkPopup(false);
          }}
          onClose={() => setShowShareLinkPopup(false)}
        />

        {/* API Integration Button */}
        <div 
          className="relative"
          onMouseEnter={() => setShowApiTooltip(true)}
          onMouseLeave={() => setShowApiTooltip(false)}
        >
          <SettingButton
            icon={Zap}
            label="Connect via API"
            isActive={showApiPopup}
            onClick={() => {
              setShowApiPopup(!showApiPopup);
              setShowDestinationPopup(false);
              setShowLlmPopup(false);
              setShowSaveToMenu(false);
            }}
            disabled
          >
            <ApiPopup isOpen={showApiPopup} />
          </SettingButton>
          
          {/* Tooltip for disabled API button */}
          {showApiTooltip && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-full mb-3 left-1/2 transform -translate-x-1/2 whitespace-nowrap pointer-events-none z-[120]"
            >
              <div className="bg-[#2D3B4E] rounded-lg px-3 py-1.5 shadow-lg">
                <span className="text-xs text-white">API Link Coming Soon</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Setting Buttons - Only show when content exists */}
        {showSettingButtons && (
          <>
            <div className="w-px h-6 bg-[rgba(255,107,53,0.2)] mx-1" />
            
            {/* Blur Sensitive Data Button */}
            {onToggleBlur && (
              <TooltipButton
                icon={EyeOff}
                label="Blur Sensitive Data"
                onClick={() => {
                  if (selectedCaptureIndices.length > 0) {
                    onToggleBlur(selectedCaptureIndices[0]);
                  }
                }}
                variant="default"
                isActive={isBlurActive}
              />
            )}

            {/* 1. Save To Button */}
            <SettingButton
              icon={FolderOpen}
              label="Save To"
              isActive={showDestinationPopup}
              onClick={() => {
                setShowPulseGlow(false); // Remove glow when clicked
                setShowDestinationPopup(!showDestinationPopup);
                setShowLlmPopup(false);
                setShowApiPopup(false);
                setShowSaveToMenu(false);
                setShowTagsPopup(false); // NEW: Close tags popup
                if (!showDestinationPopup) {
                  setMenuView('projects');
                }
              }}
              hasValue={!!currentProject && !!currentFolder}
              showPulseGlow={false}
            >
              <DestinationPopup
                isOpen={showDestinationPopup}
                projects={spaces}
                currentProject={currentProject}
                currentFolder={currentFolder}
                menuView={menuView}
                setMenuView={setMenuView}
                selectedProjectId={selectedProjectId}
                setSelectedProjectId={setSelectedProjectId}
                viewedProject={viewedProject}
                defaultDestination={defaultDestination}
                onDestinationChange={onDestinationChange}
                onClose={() => {
                  setShowDestinationPopup(false);
                  setMenuView('projects');
                }}
              />
            </SettingButton>

            {/* NEW: 2. Tags Button (REQUIRED) */}
            <SettingButton
              icon={TagIcon}
              label="Tags"
              isActive={showTagsPopup}
              onClick={() => {
                if (!currentSpaceId) {
                  toast.error('Please select a destination first to manage tags');
                  return;
                }
                setShowPulseGlow(false);
                setShowTagsPopup(!showTagsPopup);
                setShowDestinationPopup(false);
                setShowLlmPopup(false);
                setShowApiPopup(false);
                setShowSaveToMenu(false);
              }}
              hasValue={selectedTags.length > 0}
              showPulseGlow={false}
              disabled={!currentSpaceId}
            >
              <TagsPopup
                isOpen={showTagsPopup}
                tags={tags}
                selectedTags={selectedTags}
                onTagsChange={setSelectedTags}
                isLoading={tagsLoading}
                hasError={tagsError}
                onCreateTag={(name, color) => {
                  // Use spaceId from defaultDestination for proper space scoping
                  const spaceId = defaultDestination?.spaceId || null;
                  if (!spaceId) {
                    toast.error('Please select a space destination first');
                    return;
                  }
                  
                  // Create tag via API
                  createTagMutation.mutate(
                    { spaceId, name, color },
                    {
                      onSuccess: (newTag: any) => {
                        setSelectedTags(prev => [...prev, newTag.id]);
                        toast.success(`Tag "${name}" created!`);
                      },
                      onError: () => {
                        toast.error('Failed to create tag');
                      },
                    }
                  );
                }}
                onClose={() => setShowTagsPopup(false)}
              />
            </SettingButton>

            {/* 3. Send to LLM Button */}
            <SettingButton
              icon={Sparkles}
              label="Send to LLM"
              isActive={showLlmPopup}
              onClick={() => {
                setShowPulseGlow(false); // Remove glow when clicked
                setShowLlmPopup(!showLlmPopup);
                setShowDestinationPopup(false);
                setShowApiPopup(false);
                setShowSaveToMenu(false);
                setShowTagsPopup(false); // NEW: Close tags popup
              }}
              hasValue={!!selectedLlmId}
              showPulseGlow={false}
            >
              <LlmPopup
                isOpen={showLlmPopup}
                llmProviders={llmProviders}
                selectedLlmId={selectedLlmId}
                setSelectedLlmId={setSelectedLlmId}
                onClose={() => setShowLlmPopup(false)}
              />
            </SettingButton>
          </>
        )}

        {/* View Dashboard Button */}
        {onViewDashboard && (
          <>
            <div className="w-px h-6 bg-[rgba(255,107,53,0.2)] mx-1" />
            <TooltipButton
              icon={Database}
              label="View Dashboard"
              onClick={onViewDashboard}
              variant="dashboard"
            />
          </>
        )}

        {/* Capture Button - Only show when content exists */}
        {showSettingButtons && (
          <div className="relative">
            <TooltipButton
              icon={Brain}
              label="Capture Data"
              onClick={handleFinalCapture}
              variant="primary"
              count={captureCount}
            />
            {/* Validation Warning Indicator */}
            {(validationInfo?.hasWarnings || validationInfo?.hasErrors) && (
              <div className="absolute -top-1 -right-1 flex items-center justify-center">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                  validationInfo.hasErrors 
                    ? 'bg-red-500' 
                    : 'bg-amber-500'
                }`}>
                  <AlertTriangle className="w-2.5 h-2.5 text-white" />
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Validation Warning Dialog */}
      <AlertDialog open={showValidationWarningDialog} onOpenChange={setShowValidationWarningDialog}>
        <AlertDialogContent className="bg-[#1A1F2E] border border-[rgba(255,107,53,0.3)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${validationInfo?.hasErrors ? 'text-red-500' : 'text-amber-500'}`} />
              {validationInfo?.hasErrors ? 'Validation Errors' : 'Validation Warnings'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#9CA3AF]">
              {validationInfo?.message || 'Some items may have issues that could affect processing.'}
              <br /><br />
              {validationInfo?.hasErrors 
                ? 'Items with errors may fail to process. Check the indicators next to each item for details.'
                : 'Items with warnings may not process correctly. Hover over the warning icons for more details.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#0A0D12] text-white border-[rgba(255,107,53,0.3)] hover:bg-[rgba(255,107,53,0.1)]">
              Go Back
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setShowValidationWarningDialog(false);
                executeFinalCapture();
              }}
              className="bg-[#FF6B35] text-white hover:bg-[#E55A2B]"
            >
              Proceed Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Setting Button Component
interface SettingButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
  onClick: () => void;
  children?: React.ReactNode;
  hasValue?: boolean;
  disabled?: boolean;
  showPulseGlow?: boolean;
}

function SettingButton({ icon: Icon, label, isActive, onClick, children, hasValue = false, disabled = false, showPulseGlow = false }: SettingButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={onClick}
        onMouseEnter={() => !isActive && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        disabled={disabled}
        className={`relative p-2.5 rounded-lg transition-all ${
          disabled
            ? 'text-[#6B7280] opacity-50 cursor-not-allowed'
            : isActive
            ? 'bg-[rgba(255,107,53,0.2)] text-[#FF6B35] border border-[rgba(255,107,53,0.5)]'
            : hasValue
            ? 'text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)]'
            : 'text-[#9CA3AF] hover:text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)]'
        } ${showPulseGlow && !disabled ? 'pulse-glow-effect' : ''}`}
      >
        <Icon className="w-4 h-4" />
        {hasValue && !isActive && (
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#FF6B35] rounded-full" />
        )}
      </button>
      
      {/* Tooltip */}
      {showTooltip && !isActive && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-full mb-3 left-1/2 transform -translate-x-1/2 whitespace-nowrap pointer-events-none z-[120]"
        >
          <div className="bg-[#2D3B4E] rounded-lg px-3 py-1.5 shadow-lg">
            <span className="text-xs text-white">{label}</span>
          </div>
        </motion.div>
      )}

      {/* Popup Content */}
      {children}
    </div>
  );
}

// Destination Popup
interface DestinationPopupProps {
  isOpen: boolean;
  projects: Project[];
  currentProject: Project | undefined;
  currentFolder: any;
  menuView: 'projects' | 'folders';
  setMenuView: (view: 'projects' | 'folders') => void;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  viewedProject: Project | undefined;
  defaultDestination: { spaceId: string; folderId: string } | null | undefined; // Changed projectId to spaceId
  onDestinationChange?: (spaceId: string, folderId: string) => void; // Changed projectId to spaceId
  onClose: () => void;
}

function DestinationPopup({
  isOpen,
  projects,
  currentProject,
  currentFolder,
  menuView,
  setMenuView,
  selectedProjectId,
  setSelectedProjectId,
  viewedProject,
  defaultDestination,
  onDestinationChange,
  onClose
}: DestinationPopupProps) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 min-w-[280px] bg-[rgba(26,31,46,0.98)] backdrop-blur-xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden z-[110]"
    >
      <div className="p-3">
        <div className="text-[10px] text-[#9CA3AF] mb-2">Save Data To</div>

        {/* Header with back button for folder view */}
        {menuView === 'folders' && viewedProject && (
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setMenuView('projects')}
              className="flex items-center gap-1 text-[#FF6B35] hover:text-[#FFA07A] transition-colors text-xs"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back</span>
            </button>
            <div className="text-[10px] text-[#9CA3AF]">
              {viewedProject.name.toUpperCase()}
            </div>
          </div>
        )}

        {/* Projects view */}
        <AnimatePresence mode="wait">
          {menuView === 'projects' && (
            <motion.div
              key="projects-view"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-1"
            >
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => {
                    setSelectedProjectId(project.id);
                    setMenuView('folders');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-[#9CA3AF] hover:text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)] transition-all text-left"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span className="truncate">{project.name}</span>
                  <ChevronDown className="w-3 h-3 ml-auto -rotate-90" />
                </button>
              ))}
            </motion.div>
          )}

          {/* Folders view */}
          {menuView === 'folders' && viewedProject && (
            <motion.div
              key="folders-view"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
              className="space-y-1"
            >
              {viewedProject.folders.map((folder) => {
                const isSelected = defaultDestination?.spaceId === viewedProject.id && defaultDestination?.folderId === folder.id;
                
                return (
                  <button
                    key={folder.id}
                    onClick={() => {
                      if (onDestinationChange) {
                        onDestinationChange(viewedProject.id, folder.id);
                      }
                      onClose();
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// LLM Popup
interface LlmPopupProps {
  isOpen: boolean;
  llmProviders: LLMProvider[];
  selectedLlmId: string | null;
  setSelectedLlmId: (id: string | null) => void;
  onClose: () => void;
}

function LlmPopup({ isOpen, llmProviders, selectedLlmId, setSelectedLlmId, onClose }: LlmPopupProps) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-[255px] bg-[rgba(26,31,46,0.98)] backdrop-blur-xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden z-[110]"
    >
      <div className="p-3">
        <div className="space-y-1.5">
          {llmProviders.map((provider) => (
            <div key={provider.id} className="flex items-center justify-between p-2 bg-[#0A0E1A] border border-[rgba(255,107,53,0.2)] rounded-lg">
              <div className="flex items-center gap-2">
                <Brain className="w-3.5 h-3.5 text-[#FF6B35]" />
                <span className="text-xs text-white">{provider.name}</span>
                {provider.connected && (
                  <span className="text-[9px] text-[#10B981] bg-[rgba(16,185,129,0.1)] px-1.5 py-0.5 rounded">
                    Connected
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  if (selectedLlmId === provider.id) {
                    setSelectedLlmId(null);
                  } else {
                    setSelectedLlmId(provider.id);
                    onClose();
                  }
                }}
                className={`px-2.5 py-1 text-[10px] rounded-lg transition-all ${
                  selectedLlmId === provider.id
                    ? 'bg-[#FF6B35] text-white hover:bg-[#FF7A47]'
                    : 'bg-[rgba(255,107,53,0.1)] text-[#FF6B35] border border-[rgba(255,107,53,0.3)] hover:bg-[rgba(255,107,53,0.2)]'
                }`}
              >
                {selectedLlmId === provider.id ? 'Selected' : 'Select'}
              </button>
            </div>
          ))}
        </div>

        <button 
          onClick={() => toast.info('Connect New LLM - Coming soon!')}
          className="w-full mt-2 px-3 py-2 text-xs bg-[#0A0E1A] border border-[rgba(255,107,53,0.3)] text-[#FF6B35] rounded-lg hover:bg-[rgba(255,107,53,0.1)] hover:border-[#FF6B35] transition-all"
        >
          + Connect New LLM
        </button>
      </div>
    </motion.div>
  );
}

// API Popup
interface ApiPopupProps {
  isOpen: boolean;
}

function ApiPopup({ isOpen }: ApiPopupProps) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-[340px] bg-[rgba(26,31,46,0.98)] backdrop-blur-xl border border-[rgba(255,107,53,0.3)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden z-[110]"
    >
      <div className="p-3">
        <div className="text-[10px] text-[#9CA3AF] mb-3">4. CONNECT DATA VIA API</div>
        
        <div className="p-2.5 rounded-xl border border-[rgba(255,107,53,0.15)] bg-[rgba(26,31,46,0.5)] opacity-70">
          <div className="flex items-start gap-2">
            <Zap className="w-4 h-4 text-[#9CA3AF] mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-white text-sm">Connect Data via API (Premium)</span>
                <Badge variant="secondary" className="bg-[rgba(255,107,53,0.1)] text-[#FF6B35] border-[rgba(255,107,53,0.3)] text-[10px] px-1.5 py-0.5">
                  Coming Soon
                </Badge>
              </div>
              <p className="text-xs text-[#9CA3AF]">
                Connect directly via API for real-time updates
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Share Link Button with Popup
interface ShareLinkButtonProps {
  isActive: boolean;
  onClick: () => void;
  isOpen: boolean;
  onSubmit: (url: string) => void;
  onClose: () => void;
}

interface UrlField {
  id: string;
  value: string;
  error: string;
}

function ShareLinkButton({ isActive, onClick, isOpen, onSubmit, onClose }: ShareLinkButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [urlFields, setUrlFields] = useState<UrlField[]>([{ id: '1', value: '', error: '' }]);

  const addUrlField = () => {
    setUrlFields([...urlFields, { id: Date.now().toString(), value: '', error: '' }]);
  };

  const removeUrlField = (id: string) => {
    if (urlFields.length > 1) {
      setUrlFields(urlFields.filter(field => field.id !== id));
    }
  };

  const updateUrlField = (id: string, value: string) => {
    setUrlFields(urlFields.map(field => 
      field.id === id ? { ...field, value, error: '' } : field
    ));
  };

  const handleSubmit = () => {
    // Validate all fields
    let hasError = false;
    const updatedFields = urlFields.map(field => {
      if (!field.value.trim()) {
        hasError = true;
        return { ...field, error: 'Please enter a valid URL' };
      }

      try {
        new URL(field.value);
        return { ...field, error: '' };
      } catch (e) {
        hasError = true;
        return { ...field, error: 'Please enter a valid URL' };
      }
    });

    setUrlFields(updatedFields);

    if (!hasError) {
      // Submit each URL
      urlFields.forEach(field => {
        if (field.value.trim()) {
          onSubmit(field.value);
        }
      });
      setUrlFields([{ id: '1', value: '', error: '' }]);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="relative">
      <button
        onClick={onClick}
        onMouseEnter={() => !isOpen && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`relative p-2.5 rounded-lg transition-all ${
          isActive
            ? 'bg-[rgba(255,107,53,0.2)] text-[#FF6B35] border border-[rgba(255,107,53,0.5)]'
            : 'text-[#9CA3AF] hover:text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)]'
        }`}
      >
        <Link2 className="w-4 h-4" />
      </button>

      {/* Tooltip */}
      {showTooltip && !isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-full mb-3 left-1/2 transform -translate-x-1/2 whitespace-nowrap pointer-events-none z-[120]"
        >
          <div className="bg-[#2D3B4E] rounded-lg px-3 py-1.5 shadow-lg">
            <span className="text-xs text-white">Insert Share Link</span>
          </div>
        </motion.div>
      )}

      {/* Popup */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-[380px] bg-[rgba(26,31,46,0.98)] backdrop-blur-xl border border-[rgba(255,107,53,0.3)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden z-[110]"
        >
          <div className="p-3">
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FFA07A] flex items-center justify-center">
                <Link2 className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-white">Insert Share Link</h3>
                <p className="text-xs text-[#9CA3AF]">Add a link to a viewable online document</p>
              </div>
            </div>

            {/* URL Fields */}
            <div className="mb-3 space-y-2">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs text-[#9CA3AF]">
                  Document URL{urlFields.length > 1 ? 's' : ''}
                </label>
                <button
                  onClick={addUrlField}
                  className="flex items-center gap-1.5 px-2 py-1 bg-[rgba(255,107,53,0.1)] hover:bg-[rgba(255,107,53,0.2)] border border-[rgba(255,107,53,0.3)] rounded-lg text-[#FF6B35] text-xs transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Link
                </button>
              </div>
              
              {urlFields.map((field, index) => (
                <div key={field.id} className="flex items-start gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={field.value}
                      onChange={(e) => updateUrlField(field.id, e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="https://docs.google.com/spreadsheets/..."
                      className={`w-full bg-[#0A0E1A] border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#FF6B35] transition-colors ${
                        field.error ? 'border-red-500' : 'border-[rgba(255,107,53,0.3)]'
                      }`}
                      autoFocus={index === 0}
                    />
                    {field.error && (
                      <p className="mt-1 text-xs text-red-400">{field.error}</p>
                    )}
                  </div>
                  {urlFields.length > 1 && (
                    <button
                      onClick={() => removeUrlField(field.id)}
                      className="mt-1.5 p-1.5 hover:bg-[rgba(255,107,53,0.1)] rounded-lg transition-colors group"
                      title="Remove this URL"
                    >
                      <Trash2 className="w-4 h-4 text-[#9CA3AF] group-hover:text-red-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setUrlFields([{ id: '1', value: '', error: '' }]);
                  onClose();
                }}
                className="px-3 py-1.5 text-sm text-[#9CA3AF] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white rounded-lg text-sm hover:shadow-lg transition-all"
              >
                <Check className="w-4 h-4" />
                <span>Add Link{urlFields.length > 1 ? 's' : ''}</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Tooltip Button Component (unchanged)
interface TooltipButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'capture' | 'primary' | 'dashboard';
  isActive?: boolean;
  count?: number;
}

function TooltipButton({ 
  icon: Icon, 
  label, 
  onClick, 
  variant = 'default',
  isActive = false,
  count
}: TooltipButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const getButtonStyles = () => {
    if (variant === 'primary') {
      return 'bg-gradient-to-br from-[#FF6B35] to-[#FFA07A] text-white hover:shadow-lg hover:scale-105';
    }
    if (variant === 'dashboard') {
      return 'text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)]';
    }
    if (isActive) {
      return 'bg-[rgba(255,107,53,0.2)] text-[#FF6B35] border border-[rgba(255,107,53,0.5)]';
    }
    return 'text-[#9CA3AF] hover:text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)]';
  };

  return (
    <div className="relative">
      <button
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`relative p-2.5 rounded-lg transition-all ${getButtonStyles()}`}
      >
        <Icon className={variant === 'primary' ? 'w-5 h-5' : 'w-4 h-4'} />
        {count !== undefined && count > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF6B35] text-white text-[10px] rounded-full flex items-center justify-center shadow-lg">
            {count}
          </div>
        )}
      </button>
      
      {/* Tooltip */}
      {showTooltip && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-full mb-3 left-1/2 transform -translate-x-1/2 whitespace-nowrap pointer-events-none z-[120]"
        >
          <div className="bg-[#2D3B4E] rounded-lg px-3 py-1.5 shadow-lg">
            <span className="text-xs text-white">{label}</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// NEW: Tags Popup
interface TagsPopupProps {
  isOpen: boolean;
  tags: Tag[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  onCreateTag: (name: string, color: string) => void;
  onClose: () => void;
  isLoading?: boolean;
  hasError?: boolean;
}

function TagsPopup({ isOpen, tags, selectedTags, onTagsChange, onCreateTag, onClose, isLoading = false, hasError = false }: TagsPopupProps) {
  const [isCreatingTag, setIsCreatingTag] = React.useState(false);
  const [newTagName, setNewTagName] = React.useState('');
  const [newTagColor, setNewTagColor] = React.useState(TAG_COLORS[0]);
  
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-[280px] bg-[rgba(26,31,46,0.98)] backdrop-blur-xl border border-[rgba(255,107,53,0.3)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden z-[110]"
    >
      <div className="p-3">
        {/* Error State */}
        {hasError && (
          <div className="mb-3 p-2 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] rounded-lg">
            <p className="text-red-400 text-xs">Unable to load tags. Please try again.</p>
          </div>
        )}
        
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <div className="w-5 h-5 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
            <span className="ml-2 text-[#9CA3AF] text-xs">Loading tags...</span>
          </div>
        )}
        
        {/* Tag Selection - only show when not loading */}
        {!isLoading && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs text-[#9CA3AF]">Select Tags</label>
              <button
                onClick={() => setIsCreatingTag(true)}
                className="flex items-center gap-1.5 px-2 py-1 bg-[rgba(255,107,53,0.1)] hover:bg-[rgba(255,107,53,0.2)] border border-[rgba(255,107,53,0.3)] rounded-lg text-[#FF6B35] text-xs transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Tag
              </button>
            </div>
          
            <div className="flex flex-wrap gap-2">
              {tags.length === 0 && !hasError && (
                <p className="text-[#6B7280] text-xs">No tags yet. Create one to get started.</p>
              )}
              {tags.map(tag => (
              <TagBadge
                key={tag.id}
                tag={tag}
                isSelected={selectedTags.includes(tag.id)}
                onClick={() => {
                  if (selectedTags.includes(tag.id)) {
                    onTagsChange(selectedTags.filter(id => id !== tag.id));
                  } else {
                    onTagsChange([...selectedTags, tag.id]);
                  }
                }}
              />
            ))}
          </div>
        </div>
        )}

        {/* Create New Tag */}
        {!isLoading && isCreatingTag && (
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <label className="block text-xs text-[#9CA3AF]">New Tag Name</label>
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Enter tag name"
                className="w-full bg-[#0A0E1A] border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#FF6B35] transition-colors"
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <label className="block text-xs text-[#9CA3AF]">Color</label>
              <select
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="w-full bg-[#0A0E1A] border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#FF6B35] transition-colors"
              >
                {TAG_COLORS.map(color => (
                  <option key={color} value={color}>{color}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end mt-2">
              <button
                onClick={() => setIsCreatingTag(false)}
                className="px-3 py-1.5 text-sm text-[#9CA3AF] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onCreateTag(newTagName, newTagColor);
                  setIsCreatingTag(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white rounded-lg text-sm hover:shadow-lg transition-all"
              >
                <Check className="w-4 h-4" />
                <span>Create Tag</span>
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        {!isLoading && (
          <div className="flex items-center justify-end gap-2 mt-3">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-[#9CA3AF] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white rounded-lg text-sm hover:shadow-lg transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Save Tags</span>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}