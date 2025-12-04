/**
 * ============================================================================
 * Capture Assignment Panel - Bottom Left Viewport Component
 * ============================================================================
 * 
 * This panel appears at the bottom-left of the viewport when captures exist.
 * It allows users to:
 * - Select one or more captures via radio/checkboxes
 * - Assign selected captures to project/folder
 * - Set capture schedule (one-time, scheduled)
 * - Connect to LLM providers
 * 
 * 🤖 REPLIT AI REFACTORING NOTE:
 * - Props interface uses `spaces` but should eventually use Space type
 * - Internal references to projectId should become spaceId
 * - AssignmentSettings interface needs projectId → spaceId
 * - CaptureSettingsData interface needs projectId → spaceId
 * - All defaultDestination references need projectId → spaceId
 * 
 * ============================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Image, File, Link as LinkIcon, FolderOpen, Clock, Brain, ChevronDown, ChevronRight, Check, Plus, AlertCircle, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Project } from './ProjectBrowser';
import { Badge } from './ui/badge';
import type { ValidationStatus, ValidationResult } from './CaptureOptionsModal';

interface CaptureItem {
  id: string;
  type: 'screen' | 'file' | 'link';
  name: string;
  timestamp: Date;
  preview?: string;
  url?: string;
  validationStatus?: ValidationStatus;
  validationResult?: ValidationResult;
}

interface AssignmentSettings {
  projectId?: string;
  spaceId?: string;
  folderId?: string;
  analysisType?: 'one-time' | 'scheduled' | null;
  schedule?: { frequency: string; time: string };
  llmProvider?: { id: string; name: string };
}

interface LLMProvider {
  id: string;
  name: string;
  connected: boolean;
}

interface CaptureSettingsData {
  destination?: { projectId?: string; spaceId?: string; folderId: string };
  analysisType?: 'one-time' | 'scheduled' | null;
  analysisFrequency?: string;
  analysisTime?: string;
  selectedLlmId?: string | null;
}

interface CaptureAssignmentPanelProps {
  isOpen: boolean;
  captures: CaptureItem[];
  spaces: Project[]; // Renamed from projects
  onClose: () => void;
  onAssignCaptures: (captureIds: string[], settings: AssignmentSettings) => void;
  defaultDestination?: { projectId?: string; spaceId?: string; folderId: string } | null;
  analysisType?: 'one-time' | 'scheduled' | null;
  analysisFrequency?: string;
  selectedLlmId?: string | null;
  captureSettings?: Map<string, CaptureSettingsData>;
  onOpenDestinationPopup?: () => void;
  onOpenLlmPopup?: () => void;
  onOpenSchedulePopup?: () => void;
  onRenameCaptureItem?: (captureId: string, newName: string) => void;
  onDeleteCapture?: (captureId: string) => void;
  onSelectedCapturesChange?: (captureIds: Set<string>) => void;
}

export function CaptureAssignmentPanel({
  isOpen,
  captures,
  spaces,
  onClose,
  onAssignCaptures,
  defaultDestination,
  analysisType: propAnalysisType,
  analysisFrequency: propAnalysisFrequency = 'daily',
  selectedLlmId: propSelectedLlmId,
  captureSettings,
  onOpenDestinationPopup,
  onOpenLlmPopup,
  onOpenSchedulePopup,
  onRenameCaptureItem,
  onDeleteCapture,
  onSelectedCapturesChange
}: CaptureAssignmentPanelProps) {
  // Use spaces as projects for backward compatibility
  const projects = spaces;
  const [selectedCaptureIds, setSelectedCaptureIds] = useState<Set<string>>(new Set());
  const [showDestinationPopup, setShowDestinationPopup] = useState(false);
  const [showSchedulePopup, setShowSchedulePopup] = useState(false);
  const [showLlmPopup, setShowLlmPopup] = useState(false);
  const [editingCaptureId, setEditingCaptureId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [hoveredCaptureId, setHoveredCaptureId] = useState<string | null>(null);
  
  // Track previous captures to detect new ones
  const previousCaptureIdsRef = useRef<Set<string>>(new Set());
  
  // Auto-select newly added captures
  useEffect(() => {
    const currentCaptureIds = new Set(captures.map(c => c.id));
    const previousCaptureIds = previousCaptureIdsRef.current;
    
    // Find new capture IDs that weren't in the previous set
    const newCaptureIds = captures
      .filter(c => !previousCaptureIds.has(c.id))
      .map(c => c.id);
    
    // Auto-select new captures
    if (newCaptureIds.length > 0) {
      setSelectedCaptureIds(prev => {
        const newSet = new Set(prev);
        newCaptureIds.forEach(id => newSet.add(id));
        return newSet;
      });
    }
    
    // Update the ref with current capture IDs
    previousCaptureIdsRef.current = currentCaptureIds;
  }, [captures]);
  
  // Notify parent when selection changes
  useEffect(() => {
    onSelectedCapturesChange?.(selectedCaptureIds);
  }, [selectedCaptureIds, onSelectedCapturesChange]);
  
  // Assignment settings
  const [selectedProjectId, setSelectedProjectId] = useState<string>(defaultDestination?.projectId || '');
  const [selectedFolderId, setSelectedFolderId] = useState<string>(defaultDestination?.folderId || '');
  
  // Use props from toolbar if provided
  const analysisType = propAnalysisType ?? null;
  const frequency = propAnalysisFrequency;
  const selectedLlmId = propSelectedLlmId ?? null;
  
  // Project/folder navigation
  const [menuView, setMenuView] = useState<'projects' | 'folders'>('projects');
  const [viewedProjectId, setViewedProjectId] = useState<string | null>(null);
  
  const llmProviders: LLMProvider[] = [
    { id: 'chatgpt', name: 'ChatGPT', connected: true },
    { id: 'claude', name: 'Claude', connected: true },
    { id: 'gemini', name: 'Gemini', connected: false }
  ];
  
  // Get current project and folder
  const currentProject = projects.find(p => p.id === selectedProjectId);
  const currentFolder = currentProject?.folders.find(f => f.id === selectedFolderId);
  const viewedProject = projects.find(p => p.id === viewedProjectId);
  
  // Toggle capture selection
  const toggleCapture = (captureId: string) => {
    setSelectedCaptureIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(captureId)) {
        newSet.delete(captureId);
      } else {
        newSet.add(captureId);
      }
      return newSet;
    });
  };
  
  // Select all captures
  const selectAll = () => {
    if (selectedCaptureIds.size === captures.length) {
      setSelectedCaptureIds(new Set());
    } else {
      setSelectedCaptureIds(new Set(captures.map(c => c.id)));
    }
  };
  
  // Get icon for capture type
  const getCaptureIcon = (type: CaptureItem['type']) => {
    switch (type) {
      case 'screen': return Image;
      case 'file': return File;
      case 'link': return LinkIcon;
    }
  };
  
  // Handle destination selection
  const handleSelectDestination = (projectId: string, folderId: string) => {
    setSelectedProjectId(projectId);
    setSelectedFolderId(folderId);
    setShowDestinationPopup(false);
    setMenuView('projects');
  };
  
  // Handle assign captures
  const handleAssign = () => {
    if (selectedCaptureIds.size === 0) {
      return;
    }
    
    const settings: AssignmentSettings = {
      projectId: selectedProjectId,
      folderId: selectedFolderId,
      analysisType,
      schedule: analysisType === 'scheduled' ? { frequency, time } : undefined,
      llmProvider: selectedLlmId ? llmProviders.find(p => p.id === selectedLlmId) : undefined
    };
    
    onAssignCaptures(Array.from(selectedCaptureIds), settings);
    setSelectedCaptureIds(new Set());
  };
  
  if (!isOpen || captures.length === 0) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-4 left-4 z-[100] w-[340px]"
      >
        <div className="space-y-2 relative">
          {/* Select All */}
          {captures.length > 1 && (
            <button
              onClick={selectAll}
              className="flex items-center gap-1.5 px-2 py-1 bg-[rgba(26,31,46,0.6)] backdrop-blur-xl border rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.6)] text-[11px] text-[#9CA3AF] hover:text-[#FF6B35] transition-all"
            >
              <div className={`w-3 h-3 rounded border-2 flex items-center justify-center transition-all ${
                selectedCaptureIds.size === captures.length
                  ? 'border-[#FF6B35] bg-[#FF6B35]'
                  : 'border-[#9CA3AF] hover:border-[#FF6B35]'
              }`}>
                {selectedCaptureIds.size === captures.length && (
                  <Check className="w-2 h-2 text-white" />
                )}
              </div>
              <span>Select All ({captures.length})</span>
            </button>
          )}
          
          {/* Capture Items */}
          <div className="space-y-2 max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-[rgba(255,107,53,0.3)] scrollbar-track-transparent bg-[rgba(0,0,0,0)]">
            {captures.map((capture) => {
              const Icon = getCaptureIcon(capture.type);
              const isSelected = selectedCaptureIds.has(capture.id);
              
              // ⚠️ CRITICAL: Get settings for this specific capture
              // Each capture has its own independent settings
              const captureSpecificSettings = captureSettings?.get(capture.id);
              const captureDestination = captureSpecificSettings?.destination || defaultDestination;
              const captureAnalysisType = captureSpecificSettings?.analysisType ?? analysisType;
              const captureFrequency = captureSpecificSettings?.analysisFrequency || frequency;
              const captureLlmId = captureSpecificSettings?.selectedLlmId ?? selectedLlmId;
              
              // Build preferences display (only for selected captures)
              const preferences: Array<{ text: string; type: 'destination' | 'llm' | 'schedule' }> = [];
              
              // Add destination as first preference (only for selected captures)
              if (isSelected && captureDestination) {
                const project = projects.find(p => p.id === captureDestination.projectId);
                const folder = project?.folders.find(f => f.id === captureDestination.folderId);
                if (project && folder) {
                  preferences.push({ 
                    text: `${project.name} / ${folder.name}`, 
                    type: 'destination' 
                  });
                }
              }
              
              // Only show LLM for selected captures
              if (isSelected && captureLlmId) {
                const llmProvider = llmProviders.find(p => p.id === captureLlmId);
                if (llmProvider) {
                  preferences.push({ 
                    text: llmProvider.name, 
                    type: 'llm' 
                  });
                }
              }
              
              // Only show analysis type for selected captures
              if (isSelected) {
                if (captureAnalysisType === 'scheduled') {
                  preferences.push({ 
                    text: captureFrequency.charAt(0).toUpperCase() + captureFrequency.slice(1), 
                    type: 'schedule' 
                  });
                } else if (captureAnalysisType === 'one-time') {
                  preferences.push({ 
                    text: 'One-time', 
                    type: 'schedule' 
                  });
                }
              }
              
              const isEditing = editingCaptureId === capture.id;
              
              return (
                <div
                  key={capture.id}
                  onClick={() => toggleCapture(capture.id)}
                  onMouseEnter={() => {
                    if (capture.validationStatus && capture.validationStatus !== 'valid' && capture.validationStatus !== 'pending') {
                      setHoveredCaptureId(capture.id);
                    }
                  }}
                  onMouseLeave={() => setHoveredCaptureId(null)}
                  className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all bg-[rgba(26,31,46,0.85)] border cursor-pointer ${
                    hoveredCaptureId === capture.id 
                      ? 'border-[rgba(255,107,53,0.5)]' 
                      : 'border-[rgba(26,31,46,0.85)] hover:border-[rgba(255,107,53,0.3)]'
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleCapture(capture.id)}
                    className="flex-shrink-0"
                  >
                    <div className={`w-3 h-3 rounded border-2 flex items-center justify-center transition-all ${
                      isSelected
                        ? 'border-[#FF6B35] bg-[#FF6B35]'
                        : 'border-[#9CA3AF] hover:border-[#FF6B35]'
                    }`}>
                      {isSelected && (
                        <Check className="w-2 h-2 text-white" />
                      )}
                    </div>
                  </button>
                  
                  {/* Validation Status Indicator */}
                  {capture.validationStatus && capture.validationStatus !== 'pending' && (
                    <div className="flex-shrink-0">
                      {capture.validationStatus === 'validating' && (
                        <Loader2 className="w-3 h-3 text-[#9CA3AF] animate-spin" />
                      )}
                      {capture.validationStatus === 'valid' && (
                        <CheckCircle className="w-3 h-3 text-[#22C55E]" />
                      )}
                      {capture.validationStatus === 'warning' && (
                        <AlertTriangle className="w-3 h-3 text-[#F59E0B]" />
                      )}
                      {capture.validationStatus === 'error' && (
                        <AlertCircle className="w-3 h-3 text-[#EF4444]" />
                      )}
                    </div>
                  )}
                  
                  {/* Info */}
                  <div className="flex-1 text-left min-w-0 m-[0px]">
                    {/* Editable Title */}
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => {
                          if (editingName.trim() && editingName !== capture.name) {
                            onRenameCaptureItem?.(capture.id, editingName.trim());
                          }
                          setEditingCaptureId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (editingName.trim() && editingName !== capture.name) {
                              onRenameCaptureItem?.(capture.id, editingName.trim());
                            }
                            setEditingCaptureId(null);
                          } else if (e.key === 'Escape') {
                            setEditingCaptureId(null);
                          }
                        }}
                        autoFocus
                        className="w-full text-[11px] text-white bg-[#0A0E1A] border border-[#FF6B35] rounded px-1 py-0.5 focus:outline-none"
                      />
                    ) : (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCaptureId(capture.id);
                          setEditingName(capture.name);
                        }}
                        className="text-[11px] text-white truncate cursor-text hover:text-[#FF6B35] transition-colors mt-[0px] mr-[70px] mb-[0px] ml-[0px]"
                      >
                        {capture.name}
                      </div>
                    )}
                    
                    {/* Clickable Preferences */}
                    {preferences.length > 0 && (
                      <div className="text-[9px] text-[#9CA3AF] flex items-center gap-0.5 truncate">
                        {preferences.map((pref, idx) => (
                          <React.Fragment key={idx}>
                            {idx > 0 && <span className="mx-0.5">•</span>}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Select this capture first
                                if (!isSelected) {
                                  toggleCapture(capture.id);
                                }
                                // Toggle the respective popup in the toolbar
                                if (pref.type === 'destination') {
                                  onOpenDestinationPopup?.();
                                } else if (pref.type === 'llm') {
                                  onOpenLlmPopup?.();
                                } else if (pref.type === 'schedule') {
                                  onOpenSchedulePopup?.();
                                }
                              }}
                              className="truncate hover:text-[#FF6B35] transition-colors cursor-pointer"
                            >
                              {pref.text}
                            </button>
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteCapture?.(capture.id);
                    }}
                    className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-[rgba(255,107,53,0.2)] transition-colors group"
                  >
                    <X className="w-3 h-3 text-[#9CA3AF] group-hover:text-[#FF6B35] transition-colors" />
                  </button>
                </div>
              );
            })}
          </div>
          
          {/* Validation Info Side Panel - appears to the right */}
          <AnimatePresence>
            {hoveredCaptureId && (() => {
              const hoveredCapture = captures.find(c => c.id === hoveredCaptureId);
              if (!hoveredCapture?.validationResult) return null;
              
              const isError = hoveredCapture.validationStatus === 'error';
              const isWarning = hoveredCapture.validationStatus === 'warning';
              
              return (
                <motion.div
                  key="validation-panel"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-full top-0 ml-3 w-[320px]"
                  onMouseEnter={() => setHoveredCaptureId(hoveredCaptureId)}
                  onMouseLeave={() => setHoveredCaptureId(null)}
                >
                  <div className={`bg-[rgba(26,31,46,0.95)] backdrop-blur-xl border rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.6)] p-3 ${
                    isError ? 'border-[rgba(239,68,68,0.4)]' : 
                    isWarning ? 'border-[rgba(245,158,11,0.4)]' : 
                    'border-[rgba(255,107,53,0.3)]'
                  }`}>
                    {/* Header with icon */}
                    <div className="flex items-center gap-2 mb-2">
                      {isError && <AlertCircle className="w-4 h-4 text-[#EF4444]" />}
                      {isWarning && <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />}
                      <span className={`text-xs font-semibold ${
                        isError ? 'text-[#EF4444]' : 
                        isWarning ? 'text-[#F59E0B]' : 
                        'text-white'
                      }`}>
                        {isError ? 'Validation Error' : 'Warning'}
                      </span>
                    </div>
                    
                    {/* Message */}
                    <p className="text-[11px] text-white mb-2">
                      {hoveredCapture.validationResult.message}
                    </p>
                    
                    {/* Solution */}
                    {hoveredCapture.validationResult.solution && (
                      <div className="bg-[rgba(0,0,0,0.3)] rounded-md p-2">
                        <p className="text-[10px] text-[#9CA3AF] leading-relaxed">
                          <span className="text-[#FF6B35] font-medium">Fix: </span>
                          {hoveredCapture.validationResult.solution}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })()}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}