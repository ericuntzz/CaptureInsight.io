/**
 * ============================================================================
 * CRITICAL: PROJECT/FOLDER STATE SYNCHRONIZATION
 * ============================================================================
 * 
 * This component handles the "Change Destination" workflow for assigning
 * captures to specific project folders.
 * 
 * ⚠️ This is part of the THREE-MODULE SYNC SYSTEM:
 * 1. FloatingCaptureToolbar.tsx - "Save To" dropdown
 * 2. CaptureOptionsModal.tsx (THIS FILE) - "Change Destination" workflow
 * 3. DataManagementView.tsx - "Projects" sidebar view
 * 
 * State Management:
 * - `projects` prop comes from App.tsx (single source of truth)
 * - `defaultDestination` prop is used to pre-fill capture destinations
 * - `onDestinationChange` syncs destination changes back to App.tsx
 * - `onCreateProject` and `onCreateFolder` create new projects/folders in App.tsx
 * 
 * When making changes here, also check:
 * - App.tsx (main state management and synchronization)
 * - FloatingCaptureToolbar.tsx (toolbar save destination)
 * - DataManagementView.tsx (projects sidebar)
 * 
 * See App.tsx for the complete synchronization documentation.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Calendar, ArrowLeft, FileSpreadsheet, Zap, FolderOpen, ChevronRight, ChevronDown, Image, File, Link as LinkIcon, Plus, Brain, X, MoreVertical, Trash2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Project } from './ProjectBrowser';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';

interface CaptureDestination {
  projectId?: string;
  spaceId?: string;
  folderId: string;
}

// ⚠️ CRITICAL: Analysis settings for each capture (synced with Sheet interface in ProjectBrowser)
export interface CaptureAnalysisSettings {
  captureId: string;
  analysisType: 'one-time' | 'scheduled' | 'llm-integration' | 'api' | null;
  llmProvider?: { id: string; name: string };
  schedule?: { frequency: string; time: string };
}

interface LLMProvider {
  id: string;
  name: string;
  connected: boolean;
}

export type ValidationStatus = 'pending' | 'validating' | 'valid' | 'warning' | 'error';

export interface ValidationResult {
  status: ValidationStatus;
  message: string;
  solution?: string;
  canProceed: boolean;
}

export interface CaptureItem {
  id: string;
  type: 'screen' | 'file' | 'link';
  name: string;
  timestamp: Date;
  preview?: string;
  url?: string;
  validationStatus?: ValidationStatus;
  validationResult?: ValidationResult;
}

interface CaptureOptionsModalProps {
  isOpen: boolean;
  onBack: () => void;
  onStartAnalysis: (data: { 
    destinations: { spaceId: string; folderId: string }[]; 
    analysisSettings: CaptureAnalysisSettings[] 
  }) => void;
  spaces: Project[]; // Renamed from projects, using Project type for now
  captureItems: CaptureItem[];
  onAddMoreCaptures?: () => void; // Callback to add more captures
  onCreateSpace?: (name: string) => void; // Renamed from onCreateProject
  onCreateFolder?: (spaceId: string, name: string) => void; // Changed projectId to spaceId
  onDeleteCaptures?: (captureIds: string[]) => void; // Callback to delete captures
  onRenameSpace?: (spaceId: string, newName: string) => void; // Renamed from onRenameProject
  onRenameFolder?: (spaceId: string, folderId: string, newName: string) => void; // Changed projectId to spaceId
  defaultDestination?: { spaceId: string; folderId: string } | null; // Changed projectId to spaceId
  onDestinationChange?: (spaceId: string, folderId: string) => void; // Changed projectId to spaceId
}

type AssignmentMode = 'unified' | 'individual';

export function CaptureOptionsModal({ 
  isOpen, 
  onBack, 
  onStartAnalysis, 
  spaces, 
  captureItems,
  onAddMoreCaptures,
  onCreateSpace,
  onCreateFolder,
  onDeleteCaptures,
  onRenameSpace,
  onRenameFolder,
  defaultDestination,
  onDestinationChange
}: CaptureOptionsModalProps) {
  // Map spaces to projects for backward compatibility
  const projects = spaces;
  const onCreateProject = onCreateSpace;
  const onRenameProject = onRenameSpace;
  
  const [selectedOption, setSelectedOption] = useState<'one-time' | 'scheduled' | 'llm-integration' | 'api' | null>(null);
  const [frequency, setFrequency] = useState('daily');
  const [time, setTime] = useState('09:00');
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>('individual');
  const [selectedCaptureIds, setSelectedCaptureIds] = useState<Set<string>>(new Set());
  const [assignedCaptureIds, setAssignedCaptureIds] = useState<Set<string>>(new Set());
  
  // LLM Integration state
  const [llmProviders, setLlmProviders] = useState<LLMProvider[]>([
    { id: 'chatgpt', name: 'ChatGPT', connected: true },
    { id: 'claude', name: 'Claude', connected: true }
  ]);
  const [captureLlmMappings, setCaptureLlmMappings] = useState<Record<string, string>>({}); // captureId -> llmId
  const [showLlmConnectionModal, setShowLlmConnectionModal] = useState(false);
  
  // Schedule state
  const [captureScheduleMappings, setCaptureScheduleMappings] = useState<Record<string, {frequency: string, time: string}>>({}); // captureId -> schedule
  
  // One-time analysis state
  const [captureOneTimeMappings, setCaptureOneTimeMappings] = useState<Set<string>>(new Set()); // Set of captureIds marked for one-time analysis
  
  // Editing state for capture names
  const [editingCaptureId, setEditingCaptureId] = useState<string | null>(null);
  const [editingCaptureName, setEditingCaptureName] = useState('');
  const [captureNames, setCaptureNames] = useState<Record<string, string>>({});
  
  // Collapsed/expanded state for sections
  const [capturesCollapsed, setCapturesCollapsed] = useState(false);
  const [selectionsSaved, setSelectionsSaved] = useState(false);
  
  // Error/warning messages
  const [showNoCaptureWarning, setShowNoCaptureWarning] = useState(false);
  
  // Popup state for project/folder selection
  const [showAssignmentPopup, setShowAssignmentPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const [hoveredProject, setHoveredProject] = useState<string | null>(null);
  const [clickedProject, setClickedProject] = useState<string | null>(null);
  const [submenuPosition, setSubmenuPosition] = useState({ top: 0, left: 0 });
  
  // Inline edit popups for sub-heading items
  const [inlineEditCaptureId, setInlineEditCaptureId] = useState<string | null>(null);
  const [inlineEditType, setInlineEditType] = useState<'llm' | 'schedule' | 'destination' | null>(null);
  const [inlineEditPosition, setInlineEditPosition] = useState({ top: 0, left: 0 });
  const [inlineEditFrequency, setInlineEditFrequency] = useState('daily');
  const [inlineEditTime, setInlineEditTime] = useState('09:00');
  const [inlineEditSelectedCaptures, setInlineEditSelectedCaptures] = useState<Set<string>>(new Set());
  
  // Adding new project/folder in destination popup
  const [addingNewProject, setAddingNewProject] = useState(false);
  const [addingFolderToProject, setAddingFolderToProject] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  
  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [capturesToDelete, setCapturesToDelete] = useState<string[]>([]);
  
  // Title editing state
  const [isEditingTitles, setIsEditingTitles] = useState(false);
  const [editedProjectNames, setEditedProjectNames] = useState<Record<string, string>>({});
  const [editedFolderNames, setEditedFolderNames] = useState<Record<string, string>>({});
  const [showTitleEditMenu, setShowTitleEditMenu] = useState(false);
  
  // Initialize destinations for each capture
  const [captureDestinations, setCaptureDestinations] = useState<CaptureDestination[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  
  const isMultipleCaptures = captureItems.length > 1;
  
  // Check if any titles have been edited
  const hasEditedTitles = Object.keys(editedProjectNames).length > 0 || Object.keys(editedFolderNames).length > 0;
  
  // Handler to save edited titles
  const handleSaveTitles = () => {
    // Save project name changes
    Object.entries(editedProjectNames).forEach(([projectId, newName]) => {
      if (newName.trim() && onRenameProject) {
        onRenameProject(projectId, newName.trim());
      }
    });
    
    // Save folder name changes
    Object.entries(editedFolderNames).forEach(([folderKey, newName]) => {
      const [projectId, folderId] = folderKey.split('::');
      if (newName.trim() && onRenameFolder) {
        onRenameFolder(projectId, folderId, newName.trim());
      }
    });
    
    // Reset editing state
    setIsEditingTitles(false);
    setEditedProjectNames({});
    setEditedFolderNames({});
  };
  
  // Load saved settings from localStorage
  const loadSavedSettings = () => {
    try {
      const saved = localStorage.getItem('captureOptionsSettings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading saved settings:', error);
    }
    return null;
  };
  
  // Save settings to localStorage
  const saveSettings = () => {
    try {
      const settings = {
        captureNames,
        captureDestinations: captureDestinations.map((dest, index) => ({
          captureId: captureItems[index]?.id,
          ...dest
        })),
        captureLlmMappings,
        captureScheduleMappings,
        captureOneTimeMappings: Array.from(captureOneTimeMappings),
        assignedCaptureIds: Array.from(assignedCaptureIds),
      };
      localStorage.setItem('captureOptionsSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };
  
  // Initialize or restore destinations when modal opens or projects/captureItems changes
  useEffect(() => {
    if (isOpen && projects.length > 0 && captureItems.length > 0) {
      const savedSettings = loadSavedSettings();
      
      // Determine the fallback destination
      // Priority: 1) defaultDestination from toolbar, 2) first project/folder
      let fallbackProjectId: string;
      let fallbackFolderId: string;
      
      if (defaultDestination && defaultDestination.spaceId && defaultDestination.folderId) {
        fallbackProjectId = defaultDestination.spaceId;
        fallbackFolderId = defaultDestination.folderId;
      } else {
        const defaultProject = projects[0];
        const defaultFolder = defaultProject?.folders[0];
        fallbackProjectId = defaultProject?.id || '';
        fallbackFolderId = defaultFolder?.id || '';
      }
      
      // Initialize destinations array
      const newDestinations: CaptureDestination[] = [];
      
      // Restore or initialize each capture's settings
      captureItems.forEach((item, index) => {
        if (savedSettings && savedSettings.captureDestinations) {
          const savedDest = savedSettings.captureDestinations.find((d: any) => d.captureId === item.id);
          if (savedDest) {
            newDestinations.push({
              projectId: savedDest.projectId,
              folderId: savedDest.folderId
            });
          } else {
            // Use the fallback (toolbar selection or first project)
            newDestinations.push({
              projectId: fallbackProjectId,
              folderId: fallbackFolderId
            });
          }
        } else {
          // Use the fallback (toolbar selection or first project)
          newDestinations.push({
            projectId: fallbackProjectId,
            folderId: fallbackFolderId
          });
        }
      });
      
      setCaptureDestinations(newDestinations);
      
      // Restore other settings
      if (savedSettings) {
        if (savedSettings.captureNames) {
          setCaptureNames(savedSettings.captureNames);
        }
        if (savedSettings.captureLlmMappings) {
          setCaptureLlmMappings(savedSettings.captureLlmMappings);
        }
        if (savedSettings.captureScheduleMappings) {
          setCaptureScheduleMappings(savedSettings.captureScheduleMappings);
        }
        if (savedSettings.captureOneTimeMappings) {
          setCaptureOneTimeMappings(new Set(savedSettings.captureOneTimeMappings));
        }
        if (savedSettings.assignedCaptureIds) {
          setAssignedCaptureIds(new Set(savedSettings.assignedCaptureIds));
        }
      }
      
      setSelectedProject(fallbackProjectId);
      setSelectedFolder(fallbackFolderId);
      setAssignmentMode('individual');
      setSelectedCaptureIds(new Set());
      setCapturesCollapsed(false);
      setSelectionsSaved(false);
      setShowAssignmentPopup(false);
      setClickedProject(null);
      setShowLlmConnectionModal(false);
    }
  }, [isOpen, projects, captureItems.length, defaultDestination]);

  // Auto-save settings whenever they change
  useEffect(() => {
    if (isOpen && captureItems.length > 0) {
      saveSettings();
    }
  }, [captureNames, captureDestinations, captureLlmMappings, captureScheduleMappings, captureOneTimeMappings, assignedCaptureIds]);

  // Sync defaultDestination changes from toolbar while modal is open
  useEffect(() => {
    if (isOpen && defaultDestination && defaultDestination.spaceId && defaultDestination.folderId) {
      // Update selected project/folder to match the new default from toolbar
      setSelectedProject(defaultDestination.spaceId);
      setSelectedFolder(defaultDestination.folderId);
      
      // If there are selected captures, update their destinations too
      if (selectedCaptureIds.size > 0) {
        setCaptureDestinations(prev => {
          const newDest = [...prev];
          selectedCaptureIds.forEach(captureId => {
            const captureIndex = captureItems.findIndex(c => c.id === captureId);
            if (captureIndex !== -1) {
              newDest[captureIndex] = { 
                projectId: defaultDestination.spaceId, 
                folderId: defaultDestination.folderId 
              };
            }
          });
          return newDest;
        });
      }
    }
  }, [defaultDestination?.spaceId, defaultDestination?.folderId]);

  // Update individual destinations when in individual mode and selections change
  const updateSelectedCapturesDestination = (projectId: string, folderId: string) => {
    if (selectedCaptureIds.size === 0) return;
    
    // Update destinations immediately for selected captures
    setCaptureDestinations(prev => {
      const newDest = [...prev];
      selectedCaptureIds.forEach(captureId => {
        const captureIndex = captureItems.findIndex(c => c.id === captureId);
        if (captureIndex !== -1) {
          newDest[captureIndex] = { projectId, folderId };
        }
      });
      return newDest;
    });
    
    // Only mark as assigned if BOTH project AND folder are set
    if (projectId && folderId) {
      // Mark all selected captures as assigned
      setAssignedCaptureIds(prev => {
        const updated = new Set(prev);
        selectedCaptureIds.forEach(id => updated.add(id));
        return updated;
      });
      
      // Clear the newly selected captures from selection (but keep them assigned)
      setSelectedCaptureIds(new Set());
    }
  };

  const currentProject = projects.find(p => p.id === selectedProject);
  const currentFolder = currentProject?.folders.find(f => f.id === selectedFolder);

  // Helper to check if there are any captures that can be updated
  const hasCapturesToUpdate = () => {
    return selectedCaptureIds.size > 0;
  };

  // Get destination for a specific capture
  const getDestinationForCapture = (captureId: string) => {
    const captureIndex = captureItems.findIndex(c => c.id === captureId);
    return captureDestinations[captureIndex];
  };

  // Toggle capture selection (multi-select with flexible editing)
  // - Click selected capture → deselect it
  // - Click unlocked assigned capture → unassign it (allows changing assignment)
  // - Click locked assigned capture → unlock and select for editing
  // - Click unassigned capture → select it
  const toggleCaptureSelection = (captureId: string) => {
    // Clear any warnings when user interacts with captures
    setShowNoCaptureWarning(false);
    
    const isAlreadySelected = selectedCaptureIds.has(captureId);
    const isAlreadyAssigned = assignedCaptureIds.has(captureId);
    const hasOneTimeAnalysis = captureOneTimeMappings.has(captureId);
    
    // If clicking a currently selected capture, deselect it
    if (isAlreadySelected) {
      setSelectedCaptureIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(captureId);
        return newSet;
      });
      
      // Check if we should unhighlight one-time analysis
      // If this capture has one-time analysis and no other selected/assigned captures have it, unhighlight
      if (hasOneTimeAnalysis) {
        const remainingCapturesWithOneTime = Array.from(new Set([...selectedCaptureIds, ...assignedCaptureIds]))
          .filter(id => id !== captureId && captureOneTimeMappings.has(id));
        
        if (remainingCapturesWithOneTime.length === 0 && selectedOption === 'one-time') {
          setSelectedOption(null);
        }
      }
      return;
    }
    
    // If clicking an assigned capture, deselect it from assigned and select it for editing
    if (isAlreadyAssigned) {
      setAssignedCaptureIds(prev => {
        const updated = new Set(prev);
        updated.delete(captureId);
        return updated;
      });
      
      // Select it
      setSelectedCaptureIds(new Set([captureId]));
      
      // Update the selected project/folder to match this capture's current assignment
      const destination = getDestinationForCapture(captureId);
      if (destination) {
        setSelectedProject(destination.projectId || destination.spaceId || '');
        setSelectedFolder(destination.folderId);
      }
      
      // If this capture has one-time analysis, highlight the one-time option
      if (hasOneTimeAnalysis) {
        setSelectedOption('one-time');
      }
      return;
    }
    
    // If selecting a new capture (not selected, not assigned)
    // Just add it to selection
    setSelectedCaptureIds(prev => {
      const newSet = new Set(prev);
      newSet.add(captureId);
      return newSet;
    });
    
    // If this capture has one-time analysis, highlight the one-time option
    if (hasOneTimeAnalysis) {
      setSelectedOption('one-time');
    }
  };

  // Check if a capture has been assigned (committed)
  const isCaptureAssigned = (captureId: string) => {
    return assignedCaptureIds.has(captureId);
  };

  // Get icon for capture type
  const getCaptureIcon = (type: CaptureItem['type']) => {
    switch (type) {
      case 'screen':
        return Image;
      case 'file':
        return File;
      case 'link':
        return LinkIcon;
    }
  };

  // Check if all captures are assigned
  const areAllCapturesAssigned = () => {
    if (assignmentMode === 'unified') {
      // Allow proceeding if project is selected - workspace will be auto-created if needed
      const currentProject = projects.find(p => p.id === selectedProject);
      const hasNoWorkspaces = !currentProject?.folders || currentProject.folders.length === 0;
      
      // If no workspaces exist, allow proceeding with just a project selected
      if (hasNoWorkspaces && selectedProject) {
        return true;
      }
      return selectedProject && selectedFolder;
    } else {
      // In individual mode, check if all captures have valid destinations
      return captureDestinations.every((dest, index) => {
        return dest.projectId && dest.folderId;
      });
    }
  };

  // Handle save selections
  const handleSaveSelections = () => {
    setSelectionsSaved(true);
    setCapturesCollapsed(true);
    // Clear all selections
    setSelectedCaptureIds(new Set());
  };

  // Handle expanding sections (allows editing again)
  const handleExpandSection = (section: 'captures') => {
    if (section === 'captures') {
      setCapturesCollapsed(false);
    }
    setSelectionsSaved(false);
  };

  // Handle opening assignment popup
  const handleOpenAssignmentPopup = (event: React.MouseEvent, captureId?: string) => {
    // Check if any captures are selected OR assigned (or if a specific capture is being clicked)
    const hasCapturesToAssign = captureId || selectedCaptureIds.size > 0 || assignedCaptureIds.size > 0;
    
    if (!hasCapturesToAssign) {
      // No captures selected or assigned - show warning and don't open popup
      setShowNoCaptureWarning(true);
      // Auto-hide warning after 3 seconds
      setTimeout(() => setShowNoCaptureWarning(false), 3000);
      return;
    }
    
    // Clear any previous warning
    setShowNoCaptureWarning(false);
    
    const rect = event.currentTarget.getBoundingClientRect();
    const menuPosition = {
      top: rect.bottom + 8,
      left: rect.left
    };
    setPopupPosition(menuPosition);
    setInlineEditPosition(menuPosition); // Set both positions
    
    // If in individual mode and a specific capture is clicked
    if (assignmentMode === 'individual' && captureId) {
      // If a specific capture is clicked, select it
      setSelectedCaptureIds(new Set([captureId]));
      setInlineEditSelectedCaptures(new Set([captureId])); // Mirror to inline edit
    } else {
      // If there are assigned captures but no selected ones, use assigned captures
      const capturesToUse = selectedCaptureIds.size > 0 ? selectedCaptureIds : assignedCaptureIds;
      // Mirror the current selection to inline edit selected captures
      setInlineEditSelectedCaptures(new Set(capturesToUse));
    }
    
    setShowAssignmentPopup(true);
  };

  // Handle selecting project and folder from popup
  const handleSelectFromPopup = (projectId: string, folderId: string) => {
    setSelectedProject(projectId);
    setSelectedFolder(folderId);
    
    if (assignmentMode === 'unified') {
      // In unified mode, just update the selected project/folder
      // The actual assignment happens when user proceeds
    } else if (assignmentMode === 'individual') {
      // In individual mode, assign to currently selected captures
      if (selectedCaptureIds.size > 0) {
        updateSelectedCapturesDestination(projectId, folderId);
      }
    }
    
    // Sync with toolbar's default destination
    if (onDestinationChange) {
      onDestinationChange(projectId, folderId);
    }
    
    setShowAssignmentPopup(false);
    setHoveredProject(null);
    setClickedProject(null);
  };

  // Handle initiating delete for capture(s)
  const handleInitiateDelete = (captureId: string) => {
    // Only consider selectedCaptureIds for bulk delete (not assignedCaptureIds)
    // assignedCaptureIds are just visually marked, selectedCaptureIds are actively selected for operations
    
    // If the capture is part of the selected set and there are multiple selected, delete all selected
    if (selectedCaptureIds.has(captureId) && selectedCaptureIds.size > 1) {
      setCapturesToDelete(Array.from(selectedCaptureIds));
    } else {
      // Otherwise just delete this one
      setCapturesToDelete([captureId]);
    }
    
    setShowDeleteConfirm(true);
  };

  // Handle confirming delete
  const handleConfirmDelete = () => {
    if (onDeleteCaptures && capturesToDelete.length > 0) {
      onDeleteCaptures(capturesToDelete);
      
      // Clear selections
      setSelectedCaptureIds(new Set());
      setAssignedCaptureIds(new Set());
      
      // Clear any related state for deleted captures
      capturesToDelete.forEach(id => {
        const newDestinations = [...captureDestinations];
        const captureIndex = captureItems.findIndex(c => c.id === id);
        if (captureIndex !== -1) {
          newDestinations[captureIndex] = { projectId: '', folderId: '' };
        }
        setCaptureDestinations(newDestinations);
      });
    }
    
    setShowDeleteConfirm(false);
    setCapturesToDelete([]);
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-[rgba(10,14,26,0.85)] backdrop-blur-sm flex items-center justify-center z-50 px-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="w-full max-w-[520px] max-h-[85vh] bg-[#1A1F2E] border border-[rgba(255,107,53,0.3)] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col"
          >
            {/* Scrollable Content */}
            <div className="overflow-y-auto px-8 py-8 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {/* Save Destination Section */}
              <div className="mb-6">
                <h3 className="text-white text-lg mb-1">
                  Select Data Capture Preferences
                </h3>
                <p className="text-xs text-[#9CA3AF] mb-4">
                  Select one, or more, of your data sources to assign their Project/Folder, Data Capture Intervals, and LLM Preferences.
                </p>

                {/* Capture Selection */}
                <div className="mb-4">
                  {/* Collapsible Section Header */}
                  <button
                    onClick={() => capturesCollapsed ? handleExpandSection('captures') : null}
                    className="w-full flex items-center justify-between mb-2 group"
                  >
                    <div className="flex items-center gap-2.5">
                      {/* Select All Checkbox - Only show when not collapsed and multiple captures */}
                      {!capturesCollapsed && isMultipleCaptures && (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            // Clear warning
                            setShowNoCaptureWarning(false);
                            // Toggle select all
                            const allCaptureIds = captureItems.map(item => item.id);
                            const allSelected = allCaptureIds.every(id => selectedCaptureIds.has(id) || assignedCaptureIds.has(id));
                            
                            if (allSelected) {
                              // Deselect all
                              setSelectedCaptureIds(new Set());
                              setAssignedCaptureIds(new Set());
                            } else {
                              // Select all
                              setSelectedCaptureIds(new Set(allCaptureIds));
                              setAssignedCaptureIds(new Set());
                            }
                          }}
                          className="cursor-pointer"
                        >
                          <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                            captureItems.every(item => selectedCaptureIds.has(item.id) || assignedCaptureIds.has(item.id))
                              ? 'border-[#FF6B35] bg-[#FF6B35]' 
                              : 'border-[#9CA3AF]'
                          }`}>
                            {captureItems.every(item => selectedCaptureIds.has(item.id) || assignedCaptureIds.has(item.id)) && (
                              <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                        </div>
                      )}
                      <label className={`block text-xs uppercase tracking-wider cursor-pointer transition-colors ${
                        showNoCaptureWarning ? 'text-[#FF6B35]' : 'text-[#9CA3AF]'
                      }`}>
                        SELECT DATA SOURCE TO ASSIGN
                      </label>
                    </div>
                    {capturesCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#FF6B35] transition-colors" />
                    ) : (
                      onAddMoreCaptures && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            saveSettings();
                            onAddMoreCaptures();
                          }}
                          className="flex items-center gap-1 text-[#FF6B35] hover:text-[#FF7A47] transition-all hover:scale-110"
                        >
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        </button>
                      )
                    )}
                  </button>
                  
                  {/* Captures List - Only show when not collapsed */}
                  {!capturesCollapsed && (
                    <div className="space-y-1.5">
                      {captureItems.map((item) => {
                        const Icon = getCaptureIcon(item.type);
                        const destination = getDestinationForCapture(item.id);
                        const destProject = projects.find(p => p.id === destination?.projectId);
                        const destFolder = destProject?.folders.find(f => f.id === destination?.folderId);
                        const isSelected = selectedCaptureIds.has(item.id);
                        const isAssigned = isCaptureAssigned(item.id);
                        
                        return (
                          <div key={item.id} className="relative group">
                            <button
                              onClick={() => toggleCaptureSelection(item.id)}
                              className={`w-full px-3 py-1.5 pr-10 rounded-lg text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                                isSelected || isAssigned
                                  ? 'bg-[rgba(255,107,53,0.15)] border-2 border-[#FF6B35]'
                                  : 'bg-[#0A0E1A] border border-[rgba(255,107,53,0.15)] hover:border-[rgba(255,107,53,0.3)]'
                              }`}
                            >
                              {/* Checkbox */}
                              <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                                (isSelected || isAssigned)
                                  ? 'border-[#FF6B35] bg-[#FF6B35]' 
                                  : 'border-[#9CA3AF]'
                              }`}>
                                {(isSelected || isAssigned) && (
                                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                {editingCaptureId === item.id ? (
                                  <input
                                    type="text"
                                    value={editingCaptureName}
                                    onChange={(e) => setEditingCaptureName(e.target.value)}
                                    onBlur={() => {
                                      if (editingCaptureName.trim()) {
                                        setCaptureNames(prev => ({ ...prev, [item.id]: editingCaptureName }));
                                      }
                                      setEditingCaptureId(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        if (editingCaptureName.trim()) {
                                          setCaptureNames(prev => ({ ...prev, [item.id]: editingCaptureName }));
                                        }
                                        setEditingCaptureId(null);
                                      } else if (e.key === 'Escape') {
                                        setEditingCaptureId(null);
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                    className="text-xs text-white bg-[#0A0E1A] px-2 py-0.5 rounded border border-[#FF6B35] outline-none w-full"
                                  />
                                ) : (
                                  <div 
                                    className="text-xs text-white truncate cursor-text"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingCaptureId(item.id);
                                      setEditingCaptureName(captureNames[item.id] || item.name);
                                    }}
                                  >
                                    {captureNames[item.id] || item.name}
                                  </div>
                                )}
                                <div className="text-[9px] text-[#6B7280] mt-0.5 flex items-center gap-1 flex-wrap">
                                  {destFolder && destProject && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setInlineEditPosition({ top: rect.bottom + 4, left: rect.left });
                                        setInlineEditCaptureId(item.id);
                                        // Include all selected captures
                                        const allSelected = new Set([...selectedCaptureIds, ...assignedCaptureIds]);
                                        setInlineEditSelectedCaptures(allSelected.size > 0 ? allSelected : new Set([item.id]));
                                        setInlineEditType('destination');
                                      }}
                                      className="flex items-center gap-1 hover:text-[#FF6B35] transition-colors cursor-pointer"
                                    >
                                      <span className="truncate">{destProject.name}</span>
                                      <ChevronRight className="w-2 h-2 flex-shrink-0" />
                                      <span className="truncate">{destFolder.name}</span>
                                    </button>
                                  )}
                                  {captureLlmMappings[item.id] && (
                                    <>
                                      {destFolder && destProject && (
                                        <span className="text-[#6B7280]">•</span>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          setInlineEditPosition({ top: rect.bottom + 4, left: rect.left });
                                          setInlineEditCaptureId(item.id);
                                          // Include all selected captures
                                          const allSelected = new Set([...selectedCaptureIds, ...assignedCaptureIds]);
                                          setInlineEditSelectedCaptures(allSelected.size > 0 ? allSelected : new Set([item.id]));
                                          setInlineEditType('llm');
                                        }}
                                        className="flex items-center gap-0.5 transition-all cursor-pointer group"
                                      >
                                        <Brain className="w-2 h-2 text-[#FF6B35] group-hover:text-[#FF8557] group-hover:scale-110 transition-all" />
                                        <span className="text-[#FF6B35] group-hover:text-[#FF8557]">
                                          {llmProviders.find(p => p.id === captureLlmMappings[item.id])?.name}
                                        </span>
                                      </button>
                                    </>
                                  )}
                                  {captureOneTimeMappings.has(item.id) && (
                                    <>
                                      {(destFolder && destProject) || captureLlmMappings[item.id] ? (
                                        <span className="text-[#6B7280]">•</span>
                                      ) : null}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // Remove one-time analysis from all selected captures
                                          const newOneTimeSet = new Set(captureOneTimeMappings);
                                          const allSelected = new Set([...selectedCaptureIds, ...assignedCaptureIds]);
                                          const capturesToUpdate = allSelected.size > 0 ? allSelected : new Set([item.id]);
                                          capturesToUpdate.forEach(id => newOneTimeSet.delete(id));
                                          setCaptureOneTimeMappings(newOneTimeSet);
                                        }}
                                        className="flex items-center gap-0.5 hover:text-[#EF4444] transition-colors cursor-pointer group"
                                      >
                                        <Clock className="w-2 h-2 text-[#FF6B35] group-hover:text-[#EF4444] group-hover:scale-110 transition-all" />
                                        <span className="text-[#FF6B35] group-hover:text-[#EF4444]">
                                          One-Time Analysis
                                        </span>
                                      </button>
                                    </>
                                  )}
                                  {captureScheduleMappings[item.id] && !captureOneTimeMappings.has(item.id) && (
                                    <>
                                      {(destFolder && destProject) || captureLlmMappings[item.id] ? (
                                        <span className="text-[#6B7280]">•</span>
                                      ) : null}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          setInlineEditPosition({ top: rect.bottom + 4, left: rect.left });
                                          setInlineEditCaptureId(item.id);
                                          // Include all selected captures
                                          const allSelected = new Set([...selectedCaptureIds, ...assignedCaptureIds]);
                                          setInlineEditSelectedCaptures(allSelected.size > 0 ? allSelected : new Set([item.id]));
                                          setInlineEditType('schedule');
                                          setInlineEditFrequency(captureScheduleMappings[item.id].frequency);
                                          setInlineEditTime(captureScheduleMappings[item.id].time);
                                        }}
                                        className="flex items-center gap-0.5 transition-all cursor-pointer group"
                                      >
                                        <Clock className="w-2 h-2 text-[#FF6B35] group-hover:text-[#FF8557] group-hover:scale-110 transition-all" />
                                        <span className="text-[#FF6B35] group-hover:text-[#FF8557] capitalize">
                                          {captureScheduleMappings[item.id].frequency}
                                        </span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </button>
                            
                            {/* Three-dot menu button */}
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1 rounded hover:bg-[rgba(255,107,53,0.2)] transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <MoreVertical className="w-4 h-4 text-[#9CA3AF] hover:text-[#FF6B35]" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent 
                                  className="bg-[#1A1F2E] border-[rgba(255,107,53,0.3)]"
                                  align="end"
                                >
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleInitiateDelete(item.id);
                                    }}
                                    className="text-red-400 hover:text-red-300 hover:bg-[rgba(239,68,68,0.1)] cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Data Source
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  )}



                  {/* Warning Message - No Capture Selected */}
                  {!capturesCollapsed && showNoCaptureWarning && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-3 px-3 py-2 bg-[rgba(255,107,53,0.15)] border border-[#FF6B35] rounded-lg"
                    >
                      <div className="text-xs text-[#FF6B35] flex items-center gap-2">
                        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span>Please select a capture to assign to a project/folder</span>
                      </div>
                    </motion.div>
                  )}


                </div>




              </div>

              {/* Toggle Button for One-Time vs Scheduled */}
              <div className="mb-4">
                <div className="grid grid-cols-2 gap-2">
                  {/* One-Time Analysis Button */}
                  <button
                    onClick={() => {
                      if (selectedOption === 'one-time') {
                        // If currently highlighted, remove one-time analysis from selected captures
                        const newOneTimeSet = new Set(captureOneTimeMappings);
                        const capturesToRemove = new Set([...selectedCaptureIds, ...assignedCaptureIds]);
                        capturesToRemove.forEach(captureId => {
                          newOneTimeSet.delete(captureId);
                        });
                        setCaptureOneTimeMappings(newOneTimeSet);
                        setSelectedOption(null);
                      } else {
                        setSelectedOption('one-time');
                        // Automatically apply one-time analysis to selected captures
                        if (selectedCaptureIds.size > 0 || assignedCaptureIds.size > 0) {
                          const newOneTimeSet = new Set(captureOneTimeMappings);
                          const capturesToAnalyze = new Set([...selectedCaptureIds, ...assignedCaptureIds]);
                          capturesToAnalyze.forEach(captureId => {
                            newOneTimeSet.add(captureId);
                          });
                          setCaptureOneTimeMappings(newOneTimeSet);
                          
                          // Remove schedules from these captures since one-time analysis replaces schedules
                          const newSchedules = { ...captureScheduleMappings };
                          capturesToAnalyze.forEach(captureId => {
                            delete newSchedules[captureId];
                          });
                          setCaptureScheduleMappings(newSchedules);
                        }
                      }
                    }}
                    className={`p-2.5 rounded-xl cursor-pointer transition-all text-left ${
                      selectedOption === 'one-time'
                        ? 'bg-[rgba(255,107,53,0.05)] border-2 border-[#FF6B35]'
                        : 'bg-[#1A1F2E] border border-[rgba(255,107,53,0.2)] hover:border-[rgba(255,107,53,0.4)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-[#FF6B35]" />
                      <span className="text-white text-sm">One-Time Analysis</span>
                    </div>
                    <p className="text-xs text-[#9CA3AF]">
                      Analyze this data once right now
                    </p>
                  </button>

                  {/* Schedule Regular Captures Button */}
                  <button
                    onClick={() => setSelectedOption(selectedOption === 'scheduled' ? null : 'scheduled')}
                    className={`p-2.5 rounded-xl cursor-pointer transition-all text-left ${
                      selectedOption === 'scheduled'
                        ? 'bg-[rgba(255,107,53,0.05)] border-2 border-[#FF6B35]'
                        : 'bg-[#1A1F2E] border border-[rgba(255,107,53,0.2)] hover:border-[rgba(255,107,53,0.4)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-[#FF6B35]" />
                      <span className="text-white text-sm">Schedule Regular Captures</span>
                    </div>
                    <p className="text-xs text-[#9CA3AF]">
                      Automatically capture this data at regular intervals
                    </p>
                  </button>
                </div>

                {/* Expandable section for Schedule Regular Captures */}
                <AnimatePresence>
                  {selectedOption === 'scheduled' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 space-y-2 overflow-hidden"
                    >
                      {/* Info message about selection */}
                      {selectedCaptureIds.size === 0 && assignedCaptureIds.size === 0 ? (
                        <div className="p-2 bg-[rgba(255,107,53,0.1)] border border-[rgba(255,107,53,0.3)] rounded-lg">
                          <p className="text-xs text-[#FF6B35] flex items-center gap-2">
                            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Select captures above to schedule them
                          </p>
                        </div>
                      ) : (
                        <div className="p-2 bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.3)] rounded-lg">
                          <p className="text-xs text-[#10B981] flex items-center gap-2">
                            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            {selectedCaptureIds.size + assignedCaptureIds.size} capture(s) selected - set schedule below
                          </p>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs text-[#9CA3AF] mb-1">Frequency</label>
                        <select
                          value={frequency}
                          onChange={(e) => setFrequency(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-[#0A0E1A] border border-[rgba(255,107,53,0.2)] rounded-lg text-white text-xs focus:outline-none focus:border-[#FF6B35] transition-colors"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-[#9CA3AF] mb-1">Capture at</label>
                        <input
                          type="time"
                          value={time}
                          onChange={(e) => setTime(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-[#0A0E1A] border border-[rgba(255,107,53,0.2)] rounded-lg text-white text-xs focus:outline-none focus:border-[#FF6B35] transition-colors"
                        />
                      </div>

                      {/* Apply Schedule Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedCaptureIds.size === 0 && assignedCaptureIds.size === 0) {
                            return;
                          }
                          // Apply schedule to selected captures
                          const newSchedules = { ...captureScheduleMappings };
                          const capturesToSchedule = new Set([...selectedCaptureIds, ...assignedCaptureIds]);
                          capturesToSchedule.forEach(captureId => {
                            newSchedules[captureId] = { frequency, time };
                          });
                          setCaptureScheduleMappings(newSchedules);
                          
                          // Remove one-time analysis from these captures since they now have a schedule
                          const newOneTimeSet = new Set(captureOneTimeMappings);
                          capturesToSchedule.forEach(captureId => {
                            newOneTimeSet.delete(captureId);
                          });
                          setCaptureOneTimeMappings(newOneTimeSet);
                          
                          // Collapse the section
                          setSelectedOption(null);
                        }}
                        disabled={selectedCaptureIds.size === 0 && assignedCaptureIds.size === 0}
                        className={`w-full px-3 py-2 text-xs rounded-lg transition-all ${
                          selectedCaptureIds.size === 0 && assignedCaptureIds.size === 0
                            ? 'bg-[rgba(255,107,53,0.05)] text-[#6B7280] border border-[rgba(255,107,53,0.1)] cursor-not-allowed'
                            : 'bg-[#FF6B35] text-white hover:bg-[#FF7A47]'
                        }`}
                      >
                        Apply Schedule to Selected Captures
                      </button>

                      {/* Show scheduled captures count */}
                      {Object.keys(captureScheduleMappings).length > 0 && (
                        <div className="pt-2 border-t border-[rgba(255,107,53,0.1)]">
                          <p className="text-xs text-[#9CA3AF]">
                            {Object.keys(captureScheduleMappings).length} capture(s) scheduled
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Option 3: Send Data to Your LLM */}
              <div
                onClick={() => setSelectedOption('llm-integration')}
                className={`p-2.5 rounded-xl mb-2 cursor-pointer transition-all ${
                  selectedOption === 'llm-integration'
                    ? 'bg-[rgba(255,107,53,0.05)] border-2 border-[#FF6B35]'
                    : 'bg-[#1A1F2E] border border-[rgba(255,107,53,0.2)] hover:border-[rgba(255,107,53,0.4)]'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-[#FF6B35]" />
                      <span className="text-white text-sm">Send Data to Your LLM</span>
                    </div>
                    <p className="text-xs text-[#9CA3AF] ml-6 mb-2">
                      Auto send data and generate chats with your LLM
                    </p>

                    {/* Expandable section */}
                    {selectedOption === 'llm-integration' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-2 space-y-2"
                      >
                        {/* Info message about selection */}
                        {selectedCaptureIds.size === 0 && assignedCaptureIds.size === 0 ? (
                          <div className="p-2 bg-[rgba(255,107,53,0.1)] border border-[rgba(255,107,53,0.3)] rounded-lg">
                            <p className="text-xs text-[#FF6B35] flex items-center gap-2">
                              <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Select captures above to map them to an LLM
                            </p>
                          </div>
                        ) : (
                          <div className="p-2 bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.3)] rounded-lg">
                            <p className="text-xs text-[#10B981] flex items-center gap-2">
                              <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              {selectedCaptureIds.size + assignedCaptureIds.size} capture(s) selected - choose an LLM below
                            </p>
                          </div>
                        )}
                        
                        {/* Connected LLM Providers */}
                        <div className="space-y-1.5">
                          {llmProviders.map((provider) => {
                            // Check if all selected captures have this LLM assigned
                            const capturesToCheck = new Set([...selectedCaptureIds, ...assignedCaptureIds]);
                            const allHaveLlm = capturesToCheck.size > 0 && 
                              Array.from(capturesToCheck).every(id => captureLlmMappings[id] === provider.id);
                            const someHaveLlm = capturesToCheck.size > 0 && 
                              Array.from(capturesToCheck).some(id => captureLlmMappings[id] === provider.id);
                            
                            return (
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
                                <div className="flex items-center gap-1.5">
                                  {/* Select Button */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (selectedCaptureIds.size === 0 && assignedCaptureIds.size === 0) {
                                        return;
                                      }
                                      // Add LLM to selected captures (never remove)
                                      const newMappings = { ...captureLlmMappings };
                                      const capturesToMap = new Set([...selectedCaptureIds, ...assignedCaptureIds]);
                                      capturesToMap.forEach(captureId => {
                                        newMappings[captureId] = provider.id;
                                      });
                                      setCaptureLlmMappings(newMappings);
                                      setSelectedOption(null);
                                    }}
                                    disabled={selectedCaptureIds.size === 0 && assignedCaptureIds.size === 0}
                                    className={`px-2.5 py-1 text-[10px] rounded-lg transition-all ${
                                      selectedCaptureIds.size === 0 && assignedCaptureIds.size === 0
                                        ? 'bg-[rgba(255,107,53,0.05)] text-[#6B7280] border border-[rgba(255,107,53,0.1)] cursor-not-allowed'
                                        : allHaveLlm
                                        ? 'bg-[#FF6B35] text-white hover:bg-[#FF7A47]'
                                        : 'bg-[rgba(255,107,53,0.1)] text-[#FF6B35] border border-[rgba(255,107,53,0.3)] hover:bg-[rgba(255,107,53,0.2)]'
                                    }`}
                                  >
                                    {allHaveLlm ? 'Selected' : 'Select'}
                                  </button>
                                  
                                  {/* Deselect Button - only show if some captures have this LLM */}
                                  {someHaveLlm && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (selectedCaptureIds.size === 0 && assignedCaptureIds.size === 0) {
                                          return;
                                        }
                                        // Remove LLM from selected captures
                                        const newMappings = { ...captureLlmMappings };
                                        const capturesToUnmap = new Set([...selectedCaptureIds, ...assignedCaptureIds]);
                                        capturesToUnmap.forEach(captureId => {
                                          if (newMappings[captureId] === provider.id) {
                                            delete newMappings[captureId];
                                          }
                                        });
                                        setCaptureLlmMappings(newMappings);
                                        setSelectedOption(null);
                                      }}
                                      disabled={selectedCaptureIds.size === 0 && assignedCaptureIds.size === 0}
                                      className="px-2.5 py-1 text-[10px] rounded-lg transition-all bg-[rgba(255,107,53,0.1)] text-[#FF6B35] border border-[rgba(255,107,53,0.3)] hover:bg-[rgba(255,107,53,0.2)]"
                                    >
                                      Deselect
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowLlmConnectionModal(true);
                          }}
                          className="w-full px-3 py-2 text-xs bg-[#0A0E1A] border border-[rgba(255,107,53,0.3)] text-[#FF6B35] rounded-lg hover:bg-[rgba(255,107,53,0.1)] hover:border-[#FF6B35] transition-all"
                        >
                          + Connect New LLM
                        </button>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>

              {/* Option 4: API Integration */}
              <div
                className="p-2.5 rounded-xl mb-6 border border-[rgba(255,107,53,0.15)] bg-[rgba(26,31,46,0.5)] opacity-70 cursor-not-allowed"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#9CA3AF]" />
                      <span className="text-white text-sm">API Integration (Premium)</span>
                      <Badge variant="secondary" className="ml-auto bg-[rgba(255,107,53,0.1)] text-[#FF6B35] border-[rgba(255,107,53,0.3)] text-[10px] px-1.5 py-0.5">
                        Coming Soon
                      </Badge>
                    </div>
                    <p className="text-xs text-[#9CA3AF] ml-6">
                      Connect directly via API for real-time updates
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons - Fixed at bottom */}
            <div className="flex items-center gap-3 px-8 pb-8 pt-4 border-t border-[rgba(255,107,53,0.1)]">
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-5 py-3 bg-transparent border border-[rgba(255,107,53,0.3)] text-[#FF6B35] rounded-lg hover:bg-[rgba(255,107,53,0.1)] transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={() => {
                  if (captureDestinations.length > 0) {
                    // Auto-create default folders for projects that don't have any
                    const updatedDestinations = captureDestinations.map(dest => {
                      if (dest.projectId && !dest.folderId) {
                        const project = projects.find(p => p.id === dest.projectId);
                        if (project && project.folders.length === 0) {
                          // Create a default folder
                          const defaultFolderId = `folder-${Date.now()}-${Math.random()}`;
                          if (onCreateFolder) {
                            onCreateFolder(dest.projectId, 'Default Folder');
                          }
                          return { ...dest, folderId: defaultFolderId };
                        }
                      }
                      return dest;
                    });
                    
                    // ⚠️ CRITICAL: Build analysis settings for each capture
                    // This data will be stored with sheets and synced to DataManagementView
                    const analysisSettings: CaptureAnalysisSettings[] = captureItems.map(item => {
                      // Determine analysis type based on which mapping contains this capture
                      let analysisType: 'one-time' | 'scheduled' | 'llm-integration' | 'api' | null = null;
                      
                      if (captureOneTimeMappings.has(item.id)) {
                        analysisType = 'one-time';
                      } else if (captureLlmMappings[item.id]) {
                        analysisType = 'llm-integration';
                      } else if (captureScheduleMappings[item.id]) {
                        analysisType = 'scheduled';
                      }
                      
                      return {
                        captureId: item.id,
                        analysisType,
                        llmProvider: captureLlmMappings[item.id] 
                          ? llmProviders.find(p => p.id === captureLlmMappings[item.id])
                          : undefined,
                        schedule: captureScheduleMappings[item.id]
                      };
                    });
                    
                    // Clear saved settings when completing the flow
                    localStorage.removeItem('captureOptionsSettings');
                    // Normalize destinations to have spaceId (use projectId as fallback)
                    const normalizedDestinations = updatedDestinations.map(dest => ({
                      spaceId: dest.spaceId || dest.projectId || '',
                      folderId: dest.folderId
                    }));
                    onStartAnalysis({ destinations: normalizedDestinations, analysisSettings });
                  }
                }}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white rounded-lg hover:scale-[1.02] hover:shadow-[0_8px_24px_rgba(255,107,53,0.4)] transition-all"
                disabled={captureDestinations.length === 0}
              >
                Upload & Analyze Data
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      
      {/* LLM Connection Modal */}
      {showLlmConnectionModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setShowLlmConnectionModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-[#1A1F2E] border border-[rgba(255,107,53,0.3)] rounded-2xl p-6 max-w-md w-full shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg text-white flex items-center gap-2">
                  <Brain className="w-5 h-5 text-[#FF6B35]" />
                  Connect LLM Provider
                </h3>
                <p className="text-xs text-[#9CA3AF] mt-1">
                  Connect additional LLM providers to send your data
                </p>
              </div>
              <button
                onClick={() => setShowLlmConnectionModal(false)}
                className="p-2 hover:bg-[rgba(255,107,53,0.1)] rounded-lg transition-all"
              >
                <X className="w-4 h-4 text-[#9CA3AF]" />
              </button>
            </div>

            {/* Available LLM Providers */}
            <div className="space-y-3 mb-6">
              {llmProviders.map((provider) => (
                <div
                  key={provider.id}
                  className="p-4 bg-[#0A0E1A] border border-[rgba(255,107,53,0.2)] rounded-lg hover:border-[rgba(255,107,53,0.4)] transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-[#FF6B35]" />
                      <span className="text-sm text-white">{provider.name}</span>
                    </div>
                    {provider.connected && (
                      <span className="text-[10px] text-[#10B981] bg-[rgba(16,185,129,0.1)] px-2 py-1 rounded">
                        Connected
                      </span>
                    )}
                  </div>
                  {!provider.connected && (
                    <button
                      onClick={() => {
                        // Connect provider
                        setLlmProviders(prev =>
                          prev.map(p =>
                            p.id === provider.id ? { ...p, connected: true } : p
                          )
                        );
                      }}
                      className="w-full px-3 py-2 bg-[#FF6B35] text-white text-xs rounded-lg hover:bg-[#FF7A47] transition-all"
                    >
                      Connect {provider.name}
                    </button>
                  )}
                </div>
              ))}
              
              {/* Add more providers placeholder */}
              <div className="p-4 bg-[#0A0E1A] border border-dashed border-[rgba(255,107,53,0.2)] rounded-lg">
                <div className="flex items-center gap-2 text-[#9CA3AF] text-sm">
                  <Plus className="w-4 h-4" />
                  <span>More providers coming soon...</span>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowLlmConnectionModal(false)}
              className="w-full px-4 py-2.5 bg-[rgba(255,107,53,0.1)] border border-[rgba(255,107,53,0.3)] text-[#FF6B35] rounded-lg hover:bg-[rgba(255,107,53,0.2)] transition-all"
            >
              Done
            </button>
          </motion.div>
        </motion.div>
      )}
      
      {/* Inline Edit Popups - Only for LLM and Schedule (not destination) */}
      {inlineEditCaptureId && inlineEditType && inlineEditType !== 'destination' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110]"
          onClick={() => {
            setInlineEditCaptureId(null);
            setInlineEditType(null);
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            style={{
              position: 'fixed',
              top: inlineEditPosition.top,
              left: inlineEditPosition.left,
            }}
            className="bg-[#1A1F2E] border border-[rgba(255,107,53,0.3)] rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-4 w-[320px]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* LLM Selection */}
            {inlineEditType === 'llm' && (
              <div className="space-y-2">
                <div className="mb-2 pb-2 border-b border-[rgba(255,107,53,0.1)]">
                  <div className="flex items-center gap-2">
                    <Brain className="w-3.5 h-3.5 text-[#FF6B35]" />
                    <span className="text-xs text-white">Change LLM</span>
                  </div>
                  {inlineEditSelectedCaptures.size > 1 && (
                    <div className="mt-1 text-[9px] text-[#9CA3AF]">
                      Applies to {inlineEditSelectedCaptures.size} selected captures
                    </div>
                  )}
                </div>
                {llmProviders.map((provider) => {
                  // Check if all selected captures have this LLM
                  const allHaveLlm = Array.from(inlineEditSelectedCaptures).every(
                    id => captureLlmMappings[id] === provider.id
                  );
                  
                  return (
                    <button
                      key={provider.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        const newMappings = { ...captureLlmMappings };
                        inlineEditSelectedCaptures.forEach(captureId => {
                          newMappings[captureId] = provider.id;
                        });
                        setCaptureLlmMappings(newMappings);
                        setInlineEditCaptureId(null);
                        setInlineEditType(null);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-all ${
                        allHaveLlm
                          ? 'bg-[#FF6B35] text-white'
                          : 'bg-[#0A0E1A] text-[#9CA3AF] hover:bg-[rgba(255,107,53,0.1)] hover:text-white'
                      }`}
                    >
                      <span>{provider.name}</span>
                      {allHaveLlm && (
                        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  );
                })}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const newMappings = { ...captureLlmMappings };
                    inlineEditSelectedCaptures.forEach(captureId => {
                      delete newMappings[captureId];
                    });
                    setCaptureLlmMappings(newMappings);
                    setInlineEditCaptureId(null);
                    setInlineEditType(null);
                  }}
                  className="w-full p-2 rounded-lg text-xs bg-[rgba(239,68,68,0.1)] text-[#EF4444] hover:bg-[rgba(239,68,68,0.2)] transition-all border border-[rgba(239,68,68,0.3)]"
                >
                  Remove LLM
                </button>
              </div>
            )}

            {/* Schedule Selection */}
            {inlineEditType === 'schedule' && (
              <div className="space-y-3">
                <div className="mb-1 pb-2 border-b border-[rgba(255,107,53,0.1)]">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#FF6B35]" />
                    <span className="text-xs text-white">Change Schedule</span>
                  </div>
                  {inlineEditSelectedCaptures.size > 1 && (
                    <div className="mt-1 text-[9px] text-[#9CA3AF]">
                      Applies to {inlineEditSelectedCaptures.size} selected captures
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="text-[10px] text-[#9CA3AF] mb-1 block">Frequency</label>
                  <select
                    value={inlineEditFrequency}
                    onChange={(e) => setInlineEditFrequency(e.target.value)}
                    className="w-full px-2 py-1.5 bg-[#0A0E1A] border border-[rgba(255,107,53,0.3)] text-white text-xs rounded-lg outline-none focus:border-[#FF6B35]"
                  >
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-[10px] text-[#9CA3AF] mb-1 block">Time</label>
                  <input
                    type="time"
                    value={inlineEditTime}
                    onChange={(e) => setInlineEditTime(e.target.value)}
                    className="w-full px-2 py-1.5 bg-[#0A0E1A] border border-[rgba(255,107,53,0.3)] text-white text-xs rounded-lg outline-none focus:border-[#FF6B35]"
                  />
                </div>
                
                <div className="flex gap-2 pt-2 border-t border-[rgba(255,107,53,0.1)]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newSchedules = { ...captureScheduleMappings };
                      const newOneTimeSet = new Set(captureOneTimeMappings);
                      
                      inlineEditSelectedCaptures.forEach(captureId => {
                        newSchedules[captureId] = {
                          frequency: inlineEditFrequency,
                          time: inlineEditTime
                        };
                        // Remove one-time analysis if present
                        newOneTimeSet.delete(captureId);
                      });
                      
                      setCaptureScheduleMappings(newSchedules);
                      setCaptureOneTimeMappings(newOneTimeSet);
                      setInlineEditCaptureId(null);
                      setInlineEditType(null);
                    }}
                    className="flex-1 px-3 py-1.5 bg-[#FF6B35] text-white text-xs rounded-lg hover:bg-[#FF7A47] transition-all"
                  >
                    Apply
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newSchedules = { ...captureScheduleMappings };
                      inlineEditSelectedCaptures.forEach(captureId => {
                        delete newSchedules[captureId];
                      });
                      setCaptureScheduleMappings(newSchedules);
                      setInlineEditCaptureId(null);
                      setInlineEditType(null);
                    }}
                    className="px-3 py-1.5 bg-[rgba(239,68,68,0.1)] text-[#EF4444] text-xs rounded-lg hover:bg-[rgba(239,68,68,0.2)] transition-all border border-[rgba(239,68,68,0.3)]"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>
      
      {/* Destination Selection Menu - Unified for both Assignment Popup and Inline Edit */}
      {(inlineEditType === 'destination' || showAssignmentPopup) && (
              <div className="relative">
                {/* Backdrop to close menu */}
                <div 
                  className="fixed inset-0 z-[60]"
                  onClick={() => {
                    if (showAssignmentPopup) {
                      setShowAssignmentPopup(false);
                      setSelectedCaptureIds(new Set());
                    }
                    if (inlineEditType === 'destination') {
                      setInlineEditCaptureId(null);
                      setInlineEditType(null);
                    }
                  }}
                />
                
                {/* Main Menu */}
                <div
                  className="fixed z-[70] w-[320px] bg-[#1A1F2E] border border-[rgba(255,107,53,0.3)] rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.4)] p-4"
                  style={{
                    top: `${showAssignmentPopup ? popupPosition.top : inlineEditPosition.top}px`,
                    left: `${showAssignmentPopup ? popupPosition.left : inlineEditPosition.left}px`
                  }}
                  onKeyDown={(e) => {
                    // Prevent Enter key from closing the popup when pressed in input fields
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                    }
                  }}
                >
              {(() => {
                // Determine which set of captures to use based on mode
                const activeSelectedCaptures = showAssignmentPopup ? selectedCaptureIds : inlineEditSelectedCaptures;
                
                return (
              <div className="space-y-2">
                <div className="mb-2 pb-2 border-b border-[rgba(255,107,53,0.1)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-3.5 h-3.5 text-[#FF6B35]" />
                      <span className="text-xs text-white">Change Destination</span>
                    </div>
                    
                    {/* Edit Titles Menu */}
                    {!isEditingTitles && !hasEditedTitles ? (
                      <DropdownMenu open={showTitleEditMenu} onOpenChange={setShowTitleEditMenu}>
                        <DropdownMenuTrigger asChild>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowTitleEditMenu(!showTitleEditMenu);
                            }}
                            className="p-1 hover:bg-[rgba(255,107,53,0.1)] rounded transition-all"
                          >
                            <MoreVertical className="w-3.5 h-3.5 text-[#9CA3AF] hover:text-white" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent 
                          align="end"
                          className="bg-[#1A1F2E] border-[rgba(255,107,53,0.3)]"
                        >
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsEditingTitles(true);
                              setShowTitleEditMenu(false);
                            }}
                            className="text-white hover:bg-[rgba(255,107,53,0.1)] focus:bg-[rgba(255,107,53,0.1)] cursor-pointer text-xs"
                          >
                            Edit Titles
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : hasEditedTitles ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveTitles();
                        }}
                        className="px-2.5 py-1 bg-[#FF6B35] text-white text-[10px] rounded hover:bg-[#FF7A47] transition-all"
                      >
                        Save
                      </button>
                    ) : null}
                  </div>
                  {isEditingTitles && (
                    <div className="mt-1.5 p-1.5 bg-[rgba(255,107,53,0.1)] border border-[rgba(255,107,53,0.3)] rounded text-[9px] text-[#FF6B35] flex items-center gap-1">
                      <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Edit mode: Click on any name to change it</span>
                    </div>
                  )}
                  {activeSelectedCaptures.size > 1 && !isEditingTitles && (
                    <div className="mt-1 text-[9px] text-[#9CA3AF]">
                      Applies to {activeSelectedCaptures.size} selected captures
                    </div>
                  )}
                </div>
                
                <div className="max-h-[300px] overflow-y-auto overflow-x-hidden space-y-3 scrollbar-hide pr-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {projects.map((project) => {
                    const projectNameValue = editedProjectNames[project.id] ?? project.name;
                    
                    return (
                    <div key={project.id} className="space-y-1.5">
                      <div className="flex items-center justify-between px-1 py-1 group">
                        {isEditingTitles ? (
                          <div className="flex items-center gap-1.5 flex-1">
                            <FolderOpen className="w-3.5 h-3.5 text-[#FF6B35] flex-shrink-0" />
                            <input
                              type="text"
                              value={projectNameValue}
                              onChange={(e) => {
                                setEditedProjectNames({
                                  ...editedProjectNames,
                                  [project.id]: e.target.value
                                });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="Project name..."
                              className="flex-1 px-2 py-1 bg-[rgba(255,107,53,0.05)] border-2 border-[#FF6B35] text-white text-sm rounded outline-none focus:border-[#FF8557] focus:bg-[rgba(255,107,53,0.08)] transition-all placeholder:text-[#6B7280]"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <FolderOpen className="w-3.5 h-3.5 text-[#FF6B35] flex-shrink-0" />
                            <span className="text-sm text-white">{project.name}</span>
                          </div>
                        )}
                        {!isEditingTitles && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddingFolderToProject(project.id);
                              setNewItemName('');
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-[rgba(255,107,53,0.1)] rounded"
                            title="Add folder"
                          >
                            <Plus className="w-3 h-3 text-[#FF6B35]" />
                          </button>
                        )}
                      </div>
                      
                      {project.folders.length === 0 ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAddingFolderToProject(project.id);
                            setNewItemName('');
                          }}
                          className="w-full ml-5 mr-5 flex items-center justify-center gap-2 p-3 rounded-lg text-xs transition-all bg-[rgba(255,107,53,0.05)] border-2 border-dashed border-[rgba(255,107,53,0.3)] hover:border-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)] text-[#9CA3AF] hover:text-[#FF6B35]"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Create a folder to organize data</span>
                        </button>
                      ) : (
                        project.folders.map((folder) => {
                        // Check if all selected captures have this destination
                        const allHaveDestination = activeSelectedCaptures.size > 0 && Array.from(activeSelectedCaptures).every(id => {
                          const captureIndex = captureItems.findIndex(c => c.id === id);
                          return captureIndex !== -1 && 
                            captureDestinations[captureIndex]?.projectId === project.id &&
                            captureDestinations[captureIndex]?.folderId === folder.id;
                        });
                        
                        const folderKey = `${project.id}::${folder.id}`;
                        const folderNameValue = editedFolderNames[folderKey] ?? folder.name;
                        
                        // If in editing mode, render as an input
                        if (isEditingTitles) {
                          return (
                            <div key={folder.id} className="ml-5 mr-5 pl-4 pr-2 flex items-center gap-1.5">
                              <FolderOpen className="w-3 h-3 text-[#FF6B35] flex-shrink-0" />
                              <input
                                type="text"
                                value={folderNameValue}
                                onChange={(e) => {
                                  setEditedFolderNames({
                                    ...editedFolderNames,
                                    [folderKey]: e.target.value
                                  });
                                }}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Folder name..."
                                className="flex-1 px-2 py-1.5 bg-[rgba(255,107,53,0.05)] border-2 border-[#FF6B35] text-white text-xs rounded-lg outline-none focus:border-[#FF8557] focus:bg-[rgba(255,107,53,0.08)] transition-all placeholder:text-[#6B7280]"
                              />
                            </div>
                          );
                        }
                        
                        return (
                          <button
                            key={folder.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              
                              if (showAssignmentPopup) {
                                // Use the Assignment Popup handler
                                handleSelectFromPopup(project.id, folder.id);
                              } else {
                                // Inline edit mode - update destinations directly
                                const newDestinations = [...captureDestinations];
                                
                                // Update all selected captures
                                activeSelectedCaptures.forEach(captureId => {
                                  const captureIndex = captureItems.findIndex(c => c.id === captureId);
                                  if (captureIndex !== -1) {
                                    newDestinations[captureIndex] = {
                                      projectId: project.id,
                                      folderId: folder.id
                                    };
                                  }
                                });
                                
                                setCaptureDestinations(newDestinations);
                                setInlineEditCaptureId(null);
                                setInlineEditType(null);
                                
                                // Sync with toolbar's default destination
                                if (onDestinationChange) {
                                  onDestinationChange(project.id, folder.id);
                                }
                              }
                            }}
                            className={`w-full ml-5 mr-5 flex items-center gap-2 p-2.5 pl-4 pr-4 rounded-lg text-xs transition-all ${
                              allHaveDestination
                                ? 'bg-[#FF6B35] text-white'
                                : 'text-[#9CA3AF] hover:bg-[rgba(255,107,53,0.1)] hover:text-white'
                            }`}
                          >
                            <FolderOpen className={`w-3.5 h-3.5 flex-shrink-0 ${allHaveDestination ? 'text-white' : 'text-[#FF6B35]'}`} />
                            <span className="flex-1 text-left">{folder.name}</span>
                            {allHaveDestination && (
                              <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>
                        );
                        })
                      )}
                      
                      {/* Adding new folder inline */}
                      {addingFolderToProject === project.id && (
                        <div className="ml-5 mr-5 pl-4 pr-2 flex items-center gap-1.5">
                          <FolderOpen className="w-3 h-3 text-[#FF6B35] flex-shrink-0" />
                          <input
                            type="text"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                                if (newItemName.trim()) {
                                  if (onCreateFolder) {
                                    onCreateFolder(project.id, newItemName.trim());
                                  }
                                  setAddingFolderToProject(null);
                                  setNewItemName('');
                                }
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                e.stopPropagation();
                                setAddingFolderToProject(null);
                                setNewItemName('');
                              }
                            }}
                            onBlur={() => {
                              if (newItemName.trim() && onCreateFolder) {
                                onCreateFolder(project.id, newItemName.trim());
                              }
                              setAddingFolderToProject(null);
                              setNewItemName('');
                            }}
                            placeholder="New folder name..."
                            autoFocus
                            className="flex-1 px-2 py-1.5 bg-[#0A0E1A] border border-[#FF6B35] text-white text-xs rounded-lg outline-none focus:border-[#FF8557] transition-colors"
                          />
                        </div>
                      )}
                    </div>
                  );
                  })}
                  
                  {/* Add New Project */}
                  {!addingNewProject ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAddingNewProject(true);
                        setNewItemName('');
                      }}
                      className="w-full flex items-center gap-2 px-2 py-2 text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)] rounded-lg transition-all text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add New Project</span>
                    </button>
                  ) : (
                    <div className="px-2">
                      <input
                        type="text"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            if (newItemName.trim()) {
                              if (onCreateProject) {
                                onCreateProject(newItemName.trim());
                              }
                              setAddingNewProject(false);
                              setNewItemName('');
                            }
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            e.stopPropagation();
                            setAddingNewProject(false);
                            setNewItemName('');
                          }
                        }}
                        onBlur={() => {
                          if (newItemName.trim() && onCreateProject) {
                            onCreateProject(newItemName.trim());
                          }
                          setAddingNewProject(false);
                          setNewItemName('');
                        }}
                        placeholder="New project name..."
                        autoFocus
                        className="w-full px-2 py-1.5 bg-[#0A0E1A] border border-[#FF6B35] text-white text-xs rounded-lg outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>
                );
              })()}
                </div>
              </div>
            )}
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent className="bg-[#1A1F2E] border-[rgba(255,107,53,0.3)]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-400" />
            Delete Data Source{capturesToDelete.length > 1 ? 's' : ''}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[#9CA3AF]">
            {capturesToDelete.length === 1 
              ? 'Are you sure you want to delete this data source? This action cannot be undone.'
              : `Are you sure you want to delete ${capturesToDelete.length} data sources? This action cannot be undone.`
            }
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={() => {
              setShowDeleteConfirm(false);
              setCapturesToDelete([]);
            }}
            className="bg-[#0A0E1A] text-white border-[rgba(255,107,53,0.3)] hover:bg-[#1A1F2E]"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmDelete}
            className="bg-red-500 text-white hover:bg-red-600"
          >
            Delete {capturesToDelete.length > 1 ? `${capturesToDelete.length} Sources` : 'Source'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
