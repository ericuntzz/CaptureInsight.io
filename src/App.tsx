import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Spreadsheet } from './components/Spreadsheet';
import { ScreenshotOverlay } from './components/ScreenshotOverlay';
import { FloatingCaptureToolbar } from './components/FloatingCaptureToolbar';
import { CaptureOptionsModal, CaptureItem } from './components/CaptureOptionsModal';
import { CaptureAssignmentPanel } from './components/CaptureAssignmentPanel';
import { DataManagementView } from './components/DataManagementView';
import { WelcomeOverlay } from './components/WelcomeOverlay';
import { toast, Toaster } from 'sonner';
import { ChangeLogsView } from './components/ChangeLogsView';
import { InsightsView } from './components/InsightsView';
import { Space } from './components/SpaceBrowser';
import type { DataSource } from './components/DataSourceSidebar';
import { buildRoute, getCurrentView } from './routes';
import { useRouter } from './hooks/useRouter';
import { useAuth } from './hooks/useAuth';
import {
  ProfilePage,
  SettingsPage,
  PreferencesPage,
  NotificationsPage,
  BillingPage,
  CompanyManagementPage,
} from './components/settings';
import { SecuritySettings } from './pages/SecuritySettings';
import { InsightWorkspace } from './pages/InsightWorkspace';
import { ProjectBrowser, Project } from './components/ProjectBrowser';
import { 
  useSpaces, 
  useCreateSpace, 
  useUpdateSpace, 
  useDeleteSpace,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  useCreateWorkspace,
  useDeleteWorkspace,
  useCreateSheet,
  useUpdateSheet,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
} from './hooks/useSpaces';

type CaptureMode = 'window' | 'region';

interface Selection {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CaptureData extends Selection {
  id: string;
  title: string;
  folder: string;
  blurActive: boolean;
  timestamp: Date;
}

interface ShareLinkData {
  id: string;
  url: string;
  name: string;
  timestamp: Date;
}

interface FileData {
  id: string;
  name: string;
  file: File;
  timestamp: Date;
}

export default function App() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  
  // Initialize view from URL or localStorage
  const [currentView, setCurrentView] = useState<'capture' | 'data' | 'changelogs' | 'insights' | 'workspace'>(() => {
    if (typeof window !== 'undefined') {
      // First try to get view from URL
      const viewFromUrl = getCurrentView(window.location.pathname);
      
      // If URL indicates a specific view (not root), use it
      if (viewFromUrl !== 'capture' || window.location.pathname === '/') {
        return viewFromUrl;
      }
      
      // Otherwise, check localStorage as fallback
      const savedView = localStorage.getItem('captureinsight_current_view');
      if (savedView && ['capture', 'data', 'changelogs', 'insights', 'workspace'].includes(savedView)) {
        return savedView as 'capture' | 'data' | 'changelogs' | 'insights' | 'workspace';
      }
      
      return viewFromUrl;
    }
    return 'capture';
  });
  
  type SettingsPage = 'profile' | 'settings' | 'preferences' | 'notifications' | 'billing' | 'companies' | 'security' | null;
  const [activeSettingsPage, setActiveSettingsPage] = useState<SettingsPage>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/settings/security') {
        return 'security';
      }
    }
    return null;
  });
  
  const handleNavigateToSettings = (page: 'profile' | 'settings' | 'preferences' | 'notifications' | 'billing' | 'companies' | 'security') => {
    setActiveSettingsPage(page);
    if (page === 'security' || page === 'settings') {
      router.push('/settings/security');
    }
  };
  
  const handleCloseSettings = () => {
    setActiveSettingsPage(null);
    if (window.location.pathname.startsWith('/settings/')) {
      router.push('/');
    }
  };
  
  const handleLogout = () => {
    window.location.href = '/api/logout';
  };
  
  // Persist current view to localStorage
  useEffect(() => {
    localStorage.setItem('captureinsight_current_view', currentView);
  }, [currentView]);
  
  // Sync URL with current view when router changes (back/forward navigation)
  useEffect(() => {
    const viewFromUrl = getCurrentView(router.pathname);
    if (viewFromUrl !== currentView) {
      setCurrentView(viewFromUrl);
    }
  }, [router.pathname]);
  
  // Update URL when view changes
  const handleViewChange = (view: 'capture' | 'data' | 'changelogs' | 'insights' | 'workspace') => {
    setCurrentView(view);
    // Push new URL
    switch (view) {
      case 'capture':
        router.push(buildRoute.capture());
        break;
      case 'data':
        router.push(buildRoute.data());
        break;
      case 'changelogs':
        router.push(buildRoute.changeLogs());
        break;
      case 'insights':
        router.push(buildRoute.insights());
        break;
      case 'workspace':
        router.push(buildRoute.workspace());
        break;
    }
  };
  
  const [showWelcome, setShowWelcome] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>('region');
  const [captures, setCaptures] = useState<CaptureData[]>([]);
  const [shareLinks, setShareLinks] = useState<ShareLinkData[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<FileData[]>([]);
  const [blurAreas, setBlurAreas] = useState<Selection[]>([]);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [isBlurMode, setIsBlurMode] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);

  const [selectedCaptureIndices, setSelectedCaptureIndices] = useState<number[]>([]);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [targetFolder, setTargetFolder] = useState<{ spaceId: string; folderId: string } | null>(null);
  const [showAssignmentPanel, setShowAssignmentPanel] = useState(false);
  
  // ⚠️ API-based spaces state using React Query
  const { data: spaces = [], isLoading: spacesLoading, refetch: refetchSpaces } = useSpaces();
  
  // Mutation hooks for CRUD operations
  const createSpaceMutation = useCreateSpace();
  const updateSpaceMutation = useUpdateSpace();
  const deleteSpaceMutation = useDeleteSpace();
  const createFolderMutation = useCreateFolder();
  const updateFolderMutation = useUpdateFolder();
  const deleteFolderMutation = useDeleteFolder();
  const createWorkspaceMutation = useCreateWorkspace();
  const deleteWorkspaceMutation = useDeleteWorkspace();
  const createSheetMutation = useCreateSheet();
  const updateSheetMutation = useUpdateSheet();
  const createTagMutation = useCreateTag();
  const updateTagMutation = useUpdateTag();
  const deleteTagMutation = useDeleteTag();
  
  // ⚠️ CRITICAL: Current Space tracking for Space-scoped architecture
  // All features (Capture, AI Assistant, Change Logs) operate within the current Space
  const [currentSpaceId, setCurrentSpaceId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('captureinsight_current_space');
      if (saved) {
        return saved;
      }
    } catch (error) {
      console.error('Error loading current space from localStorage:', error);
    }
    return null;
  });
  
  // Set currentSpaceId to first space when spaces load (if not already set)
  useEffect(() => {
    if (!spacesLoading && spaces.length > 0 && !currentSpaceId) {
      setCurrentSpaceId(spaces[0].id);
    }
  }, [spaces, spacesLoading, currentSpaceId]);
  
  // Get the current Space object
  const currentSpace = spaces.find(s => s.id === currentSpaceId);
  
  // Persist current Space to localStorage
  useEffect(() => {
    if (currentSpaceId) {
      try {
        localStorage.setItem('captureinsight_current_space', currentSpaceId);
      } catch (error) {
        console.error('Error saving current space to localStorage:', error);
      }
    }
  }, [currentSpaceId]);
  
  // Active Workspace tracking for Workspace-scoped features
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('captureinsight_active_workspace');
      if (saved) {
        return saved;
      }
    } catch (error) {
      console.error('Error loading active workspace from localStorage:', error);
    }
    return null;
  });
  
  // Persist active workspace to localStorage
  useEffect(() => {
    if (activeWorkspaceId) {
      try {
        localStorage.setItem('captureinsight_active_workspace', activeWorkspaceId);
      } catch (error) {
        console.error('Error saving active workspace to localStorage:', error);
      }
    }
  }, [activeWorkspaceId]);
  
  // Set activeWorkspaceId to first workspace when spaces/current space changes (if not already set)
  useEffect(() => {
    if (!spacesLoading && currentSpace) {
      const workspaces = currentSpace.workspaces || currentSpace.folders || [];
      if (workspaces.length > 0 && (!activeWorkspaceId || !workspaces.find(w => w.id === activeWorkspaceId))) {
        setActiveWorkspaceId(workspaces[0].id);
      }
    }
  }, [currentSpace, spacesLoading, activeWorkspaceId]);
  
  // Track temp workspace ID to update when real ID comes back
  const pendingWorkspaceRef = useRef<string | null>(null);
  
  // Handle workspace creation - switches to new workspace immediately
  const handleCreateWorkspace = async (spaceId: string, name: string) => {
    try {
      const newWorkspace = await createWorkspaceMutation.mutateAsync({ 
        spaceId, 
        name,
        // Switch to temp ID immediately for instant feedback
        onOptimisticId: (tempId) => {
          pendingWorkspaceRef.current = tempId;
          setActiveWorkspaceId(tempId);
        }
      });
      // Update to real ID when server responds
      if (newWorkspace?.id) {
        // Only update if we're still on the temp ID (user hasn't switched away)
        if (pendingWorkspaceRef.current && activeWorkspaceId?.startsWith('temp-')) {
          setActiveWorkspaceId(newWorkspace.id);
        }
        pendingWorkspaceRef.current = null;
      }
    } catch (error) {
      console.error('Error creating workspace:', error);
      toast.error('Failed to create workspace');
      pendingWorkspaceRef.current = null;
    }
  };
  
  // Handle workspace deletion
  const handleDeleteWorkspace = async (workspaceId: string) => {
    if (!currentSpaceId) {
      toast.error('No space selected');
      return;
    }
    try {
      // Switch to another workspace first for instant feedback (optimistic)
      if (activeWorkspaceId === workspaceId && currentSpace) {
        const workspaces = currentSpace.workspaces || currentSpace.folders || [];
        const remaining = workspaces.filter(w => w.id !== workspaceId);
        if (remaining.length > 0) {
          setActiveWorkspaceId(remaining[0].id);
        } else {
          setActiveWorkspaceId(null);
        }
      }
      await deleteWorkspaceMutation.mutateAsync({ id: workspaceId, spaceId: currentSpaceId });
      toast.success('Workspace deleted successfully');
    } catch (error) {
      console.error('Error deleting workspace:', error);
      toast.error('Failed to delete workspace');
    }
  };
  
  // Default destination shared between FloatingCaptureToolbar and CaptureOptionsModal
  const [defaultDestination, setDefaultDestination] = useState<{ spaceId: string; folderId: string } | null>(null);
  
  // Update default destination when spaces load
  useEffect(() => {
    if (!spacesLoading && spaces.length > 0 && !defaultDestination) {
      const firstSpace = spaces[0];
      const firstFolder = firstSpace?.folders[0];
      if (firstSpace && firstFolder) {
        setDefaultDestination({ spaceId: firstSpace.id, folderId: firstFolder.id });
      }
    }
  }, [spaces, spacesLoading, defaultDestination]);
  
  // Analysis settings shared between FloatingCaptureToolbar and CaptureAssignmentPanel
  const [analysisType, setAnalysisType] = useState<'one-time' | 'scheduled' | null>(null);
  const [analysisFrequency, setAnalysisFrequency] = useState('daily');
  const [analysisTime, setAnalysisTime] = useState('09:00');
  const [selectedLlmId, setSelectedLlmId] = useState<string | null>(null);
  
  // ⚠️ CRITICAL: Per-capture settings storage
  // Each capture has its own independent settings (destination, analysis type, LLM, etc.)
  // This prevents settings from one capture affecting another
  interface CaptureSettingsData {
    destination?: { spaceId: string; folderId: string };
    analysisType?: 'one-time' | 'scheduled' | null;
    analysisFrequency?: string;
    analysisTime?: string;
    selectedLlmId?: string | null;
  }
  const [captureSettings, setCaptureSettings] = useState<Map<string, CaptureSettingsData>>(new Map());
  
  // Track which popup should be opened from CaptureAssignmentPanel
  const [forceOpenPopup, setForceOpenPopup] = useState<'destination' | 'llm' | 'schedule' | null>(null);
  
  // Track which captures are selected in CaptureAssignmentPanel
  const [panelSelectedCaptureIds, setPanelSelectedCaptureIds] = useState<Set<string>>(new Set());
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Combine all capture items into a single array for the modal
  const captureItems = useMemo<CaptureItem[]>(() => {
    const items: CaptureItem[] = [];
    
    // Add screen captures
    captures.forEach(capture => {
      items.push({
        id: capture.id,
        type: 'screen',
        name: capture.title,
        timestamp: capture.timestamp
      });
    });
    
    // Add share links
    shareLinks.forEach(link => {
      items.push({
        id: link.id,
        type: 'link',
        name: link.name,
        timestamp: link.timestamp
      });
    });
    
    // Add uploaded files
    uploadedFiles.forEach(file => {
      items.push({
        id: file.id,
        type: 'file',
        name: file.name,
        timestamp: file.timestamp
      });
    });
    
    // Sort by timestamp
    return items.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [captures, shareLinks, uploadedFiles]);

  const handleCapture = (selection: Selection) => {
    // Generate title with capture number and timestamp
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const captureNumber = captures.length + 1;
    const title = `Capture ${captureNumber} | ${dateStr} ${timeStr}`;
    
    // Use target folder if set, otherwise default
    const folderName = targetFolder ? `Target Folder (${targetFolder.folderId})` : 'Q4 Marketing Data';
    
    // Directly add capture to array with metadata
    const captureData: CaptureData = {
      ...selection,
      id: `capture-${Date.now()}-${Math.random()}`,
      title,
      folder: folderName,
      blurActive: false,
      timestamp: now
    };
    
    setCaptures(prev => [...prev, captureData]);
    setIsBlurMode(false);
    
    // Automatically select the newly created capture to show the menu
    const newCaptureIndex = captures.length; // Index of the capture we just added
    setSelectedCaptureIndices([newCaptureIndex]);
    
    // Show success message if capture was targeted to a folder
    if (targetFolder) {
      toast.success('Capture added to folder!');
      // Reset target folder after capture
      setTargetFolder(null);
    }
  };

  const handleBlurArea = (selection: Selection) => {
    setBlurAreas(prev => [...prev, selection]);
  };

  const handleToggleBlurMode = () => {
    setIsBlurMode(prev => !prev);
  };

  const handleFinalCapture = (settings?: {
    destination: { projectId?: string; spaceId?: string; folderId: string };
    analysisType: 'one-time' | 'scheduled' | 'llm-integration' | 'api' | null;
    llmProvider?: { id: string; name: string };
    schedule?: { frequency: string; time: string };
  }) => {
    if (captureItems.length === 0) {
      toast.error('Please add at least one capture, file, or link first');
      return;
    }
    
    if (!settings || !settings.destination) {
      toast.error('Please select a destination for your data');
      return;
    }
    
    // Build destinations array with normalized spaceId (all items go to same destination for now)
    const resolvedSpaceId = settings.destination.spaceId || settings.destination.projectId || '';
    const destinations = captureItems.map(() => ({ spaceId: resolvedSpaceId, folderId: settings.destination.folderId }));
    
    // Build analysis settings array (all items get same settings for now)
    const analysisSettings = captureItems.map(item => ({
      captureId: item.id,
      analysisType: settings.llmProvider ? 'llm-integration' as const : settings.analysisType,
      llmProvider: settings.llmProvider,
      schedule: settings.schedule
    }));
    
    // Use the same logic as the modal
    handleStartAnalysis({ destinations, analysisSettings });
  };

  const handleStartAnalysis = async (data: { 
    destinations: { spaceId: string; folderId: string }[]; 
    analysisSettings: Array<{
      captureId: string;
      analysisType: 'one-time' | 'scheduled' | 'llm-integration' | 'api' | null;
      llmProvider?: { id: string; name: string };
      schedule?: { frequency: string; time: string };
    }>
  }) => {
    const { destinations, analysisSettings } = data;
    
    try {
      // Update captures with their destinations
      setCaptures(prev => prev.map((capture, index) => {
        const dest = destinations[index];
        const space = spaces.find(p => p.id === dest.spaceId);
        const folder = space?.folders.find(f => f.id === dest.folderId);
        return {
          ...capture,
          folder: folder && space ? `${space.name} → ${folder.name}` : capture.folder
        };
      }));
      
      // ⚠️ CRITICAL: Add sheets to space folders for each capture via API
      for (let index = 0; index < captureItems.length; index++) {
        const item = captureItems[index];
        const dest = destinations[index];
        const settings = analysisSettings[index];
        
        await createSheetMutation.mutateAsync({
          spaceId: dest.spaceId,
          folderId: dest.folderId,
          name: item.name,
          dataSourceType: item.type,
          dataSourceMeta: {
            analysisType: settings?.analysisType,
            llmProvider: settings?.llmProvider,
            schedule: settings?.schedule,
          },
        });
      }
      
      // Navigate to Data Management View
      setCurrentView('data');
      setShowOptionsModal(false);
      
      // Show success message
      const uniqueDestinations = new Set(destinations.map(d => `${d.spaceId}|${d.folderId}`));
      if (uniqueDestinations.size === 1) {
        const dest = destinations[0];
        const space = spaces.find(p => p.id === dest.spaceId);
        const folder = space?.folders.find(f => f.id === dest.folderId);
        toast.success(`${captureItems.length} item(s) saved to ${folder?.name}!`);
      } else {
        toast.success(`${captureItems.length} items saved to ${uniqueDestinations.size} different folders!`);
      }
    } catch (error) {
      console.error('Error starting analysis:', error);
      toast.error('Failed to save captures');
    }
  };

  const handleShareLink = (url: string) => {
    const now = new Date();
    const linkData: ShareLinkData = {
      id: `link-${Date.now()}-${Math.random()}`,
      url,
      name: url.length > 40 ? url.substring(0, 37) + '...' : url,
      timestamp: now
    };
    setShareLinks(prev => [...prev, linkData]);
    toast.success('Share link added successfully!');
    console.log('Share link:', url);
  };

  const handleUploadFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const now = new Date();
      const fileData: FileData = {
        id: `file-${Date.now()}-${Math.random()}`,
        name: file.name,
        file,
        timestamp: now
      };
      setUploadedFiles(prev => [...prev, fileData]);
      toast.success(`File uploaded: ${file.name}`);
      console.log('Uploaded file:', file);
    }
  };

  const handleDestinationChange = (spaceId: string, folderId: string) => {
    // Update global default
    setDefaultDestination({ spaceId, folderId });
    
    // ⚠️ CRITICAL: Update settings for checked captures in the panel
    // If panel has selected captures, use those; otherwise use spreadsheet overlay indices
    if (panelSelectedCaptureIds.size > 0) {
      setCaptureSettings(prev => {
        const newMap = new Map(prev);
        panelSelectedCaptureIds.forEach(captureId => {
          const existing = newMap.get(captureId) || {};
          newMap.set(captureId, {
            ...existing,
            destination: { spaceId, folderId }
          });
        });
        return newMap;
      });
    } else if (selectedCaptureIndices.length > 0) {
      setCaptureSettings(prev => {
        const newMap = new Map(prev);
        selectedCaptureIndices.forEach(index => {
          const capture = captures[index];
          if (capture) {
            const existing = newMap.get(capture.id) || {};
            newMap.set(capture.id, {
              ...existing,
              destination: { spaceId, folderId }
            });
          }
        });
        return newMap;
      });
    }
    
    const space = spaces.find(p => p.id === spaceId);
    const folder = space?.folders.find(f => f.id === folderId);
    if (space && folder) {
      toast.success(`Default destination set to ${space.name} → ${folder.name}`);
    }
  };

  // ⚠️ CRITICAL: Wrapper functions to update per-capture settings
  const handleAnalysisTypeChange = (type: 'one-time' | 'scheduled' | null) => {
    // Update global default
    setAnalysisType(type);
    
    // ⚠️ CRITICAL: Update settings for checked captures in the panel
    // If panel has selected captures, use those; otherwise use spreadsheet overlay indices
    if (panelSelectedCaptureIds.size > 0) {
      setCaptureSettings(prev => {
        const newMap = new Map(prev);
        panelSelectedCaptureIds.forEach(captureId => {
          const existing = newMap.get(captureId) || {};
          newMap.set(captureId, {
            ...existing,
            analysisType: type
          });
        });
        return newMap;
      });
    } else if (selectedCaptureIndices.length > 0) {
      setCaptureSettings(prev => {
        const newMap = new Map(prev);
        selectedCaptureIndices.forEach(index => {
          const capture = captures[index];
          if (capture) {
            const existing = newMap.get(capture.id) || {};
            newMap.set(capture.id, {
              ...existing,
              analysisType: type
            });
          }
        });
        return newMap;
      });
    }
  };

  const handleAnalysisFrequencyChange = (frequency: string) => {
    // Update global default
    setAnalysisFrequency(frequency);
    
    // ⚠️ CRITICAL: Update settings for checked captures in the panel
    // If panel has selected captures, use those; otherwise use spreadsheet overlay indices
    if (panelSelectedCaptureIds.size > 0) {
      setCaptureSettings(prev => {
        const newMap = new Map(prev);
        panelSelectedCaptureIds.forEach(captureId => {
          const existing = newMap.get(captureId) || {};
          newMap.set(captureId, {
            ...existing,
            analysisFrequency: frequency
          });
        });
        return newMap;
      });
    } else if (selectedCaptureIndices.length > 0) {
      setCaptureSettings(prev => {
        const newMap = new Map(prev);
        selectedCaptureIndices.forEach(index => {
          const capture = captures[index];
          if (capture) {
            const existing = newMap.get(capture.id) || {};
            newMap.set(capture.id, {
              ...existing,
              analysisFrequency: frequency
            });
          }
        });
        return newMap;
      });
    }
  };

  const handleAnalysisTimeChange = (time: string) => {
    // Update global default
    setAnalysisTime(time);
    
    // ⚠️ CRITICAL: Update settings for checked captures in the panel
    // If panel has selected captures, use those; otherwise use spreadsheet overlay indices
    if (panelSelectedCaptureIds.size > 0) {
      setCaptureSettings(prev => {
        const newMap = new Map(prev);
        panelSelectedCaptureIds.forEach(captureId => {
          const existing = newMap.get(captureId) || {};
          newMap.set(captureId, {
            ...existing,
            analysisTime: time
          });
        });
        return newMap;
      });
    } else if (selectedCaptureIndices.length > 0) {
      setCaptureSettings(prev => {
        const newMap = new Map(prev);
        selectedCaptureIndices.forEach(index => {
          const capture = captures[index];
          if (capture) {
            const existing = newMap.get(capture.id) || {};
            newMap.set(capture.id, {
              ...existing,
              analysisTime: time
            });
          }
        });
        return newMap;
      });
    }
  };

  const handleSelectedLlmChange = (id: string | null) => {
    // Update global default
    setSelectedLlmId(id);
    
    // ⚠️ CRITICAL: Update settings for checked captures in the panel
    // If panel has selected captures, use those; otherwise use spreadsheet overlay indices
    if (panelSelectedCaptureIds.size > 0) {
      setCaptureSettings(prev => {
        const newMap = new Map(prev);
        panelSelectedCaptureIds.forEach(captureId => {
          const existing = newMap.get(captureId) || {};
          newMap.set(captureId, {
            ...existing,
            selectedLlmId: id
          });
        });
        return newMap;
      });
    } else if (selectedCaptureIndices.length > 0) {
      setCaptureSettings(prev => {
        const newMap = new Map(prev);
        selectedCaptureIndices.forEach(index => {
          const capture = captures[index];
          if (capture) {
            const existing = newMap.get(capture.id) || {};
            newMap.set(capture.id, {
              ...existing,
              selectedLlmId: id
            });
          }
        });
        return newMap;
      });
    }
  };

  const handleCreateSpace = async (name: string) => {
    try {
      await createSpaceMutation.mutateAsync({ 
        name: name || 'New Space',
        description: '',
      });
      toast.success(`Space \"${name}\" created!`);
    } catch (error) {
      console.error('Error creating space:', error);
      toast.error('Failed to create space');
    }
  };

  const handleCreateFolder = async (spaceId: string, name: string) => {
    try {
      await createFolderMutation.mutateAsync({ 
        spaceId, 
        name: name || 'New Folder' 
      });
      toast.success(`Folder "${name}" created!`);
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Failed to create folder');
    }
  };

  // ⚠️ CRITICAL: Update sheet analysis settings (synced with CaptureOptionsModal)
  const handleUpdateSheetAnalysis = async (
    spaceId: string, 
    folderId: string, 
    sheetId: string, 
    settings: {
      analysisType?: 'one-time' | 'scheduled' | 'llm-integration' | 'api' | null;
      llmProvider?: { id: string; name: string };
      schedule?: { frequency: string; time: string };
    }
  ) => {
    try {
      await updateSheetMutation.mutateAsync({
        id: sheetId,
        data: {
          dataSourceMeta: {
            analysisType: settings.analysisType,
            llmProvider: settings.llmProvider,
            schedule: settings.schedule,
          },
        },
      });
      toast.success('Analysis settings updated!');
    } catch (error) {
      console.error('Error updating sheet analysis:', error);
      toast.error('Failed to update analysis settings');
    }
  };

  const handleRenameSpace = async (spaceId: string, newName: string) => {
    try {
      await updateSpaceMutation.mutateAsync({
        id: spaceId,
        data: { name: newName },
      });
      toast.success(`Space renamed to "${newName}"!`);
    } catch (error) {
      console.error('Error renaming space:', error);
      toast.error('Failed to rename space');
    }
  };

  const handleRenameFolder = async (spaceId: string, folderId: string, newName: string) => {
    try {
      await updateFolderMutation.mutateAsync({
        id: folderId,
        name: newName,
      });
      toast.success(`Folder renamed to \"${newName}\"!`);
    } catch (error) {
      console.error('Error renaming folder:', error);
      toast.error('Failed to rename folder');
    }
  };

  // ⚠️ CRITICAL: Handle Space switching (for new Space-scoped architecture)
  const handleSpaceChange = (spaceId: string) => {
    setCurrentSpaceId(spaceId);
    const space = spaces.find(s => s.id === spaceId);
    if (space) {
      toast.success(`Switched to ${space.name}`);
    }
  };

  // ⚠️ CRITICAL: Create blank Space for auto-edit name flow
  const handleCreateBlankSpace = async (): Promise<string> => {
    try {
      const newSpace = await createSpaceMutation.mutateAsync({ 
        name: 'New Space',
        description: '',
      });
      setCurrentSpaceId(newSpace.id);
      return newSpace.id;
    } catch (error) {
      console.error('Error creating blank space:', error);
      toast.error('Failed to create space');
      return '';
    }
  };

  // Track shift key for multi-select
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleDeleteCapture = (index: number) => {
    setCaptures(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteCaptures = (captureIds: string[]) => {
    // Delete from captures
    setCaptures(prev => prev.filter(capture => !captureIds.includes(capture.id)));
    
    // Delete from share links
    setShareLinks(prev => prev.filter(link => !captureIds.includes(link.id)));
    
    // Delete from uploaded files
    setUploadedFiles(prev => prev.filter(file => !captureIds.includes(file.id)));
    
    // Delete from capture settings
    setCaptureSettings(prev => {
      const newMap = new Map(prev);
      captureIds.forEach(id => newMap.delete(id));
      return newMap;
    });
    
    const itemCount = captureIds.length;
    toast.success(`${itemCount} data source${itemCount > 1 ? 's' : ''} deleted`);
  };
  
  const handleDeleteSingleCapture = (captureId: string) => {
    handleDeleteCaptures([captureId]);
  };

  const handleDeleteBlurArea = (index: number) => {
    setBlurAreas(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateCapture = (index: number, selection: Selection) => {
    setCaptures(prev => {
      const newCaptures = [...prev];
      newCaptures[index] = { ...newCaptures[index], ...selection };
      return newCaptures;
    });
  };

  const handleUpdateCaptureTitle = (index: number, title: string) => {
    setCaptures(prev => {
      const newCaptures = [...prev];
      newCaptures[index] = { ...newCaptures[index], title };
      return newCaptures;
    });
  };

  const handleUpdateCaptureFolder = (index: number, folder: string) => {
    setCaptures(prev => {
      const newCaptures = [...prev];
      // If multiple captures are selected, update all of them
      if (selectedCaptureIndices.length > 1 && selectedCaptureIndices.includes(index)) {
        selectedCaptureIndices.forEach(i => {
          newCaptures[i] = { ...newCaptures[i], folder };
        });
      } else {
        newCaptures[index] = { ...newCaptures[index], folder };
      }
      return newCaptures;
    });
    toast.success(selectedCaptureIndices.length > 1 
      ? `${selectedCaptureIndices.length} captures saved to "${folder}"`
      : `Capture saved to "${folder}"`);
  };

  const handleToggleBlur = (index: number) => {
    const capture = captures[index];
    if (!capture) return;
    
    // Toggle blur mode
    setCaptures(prev => {
      const newCaptures = [...prev];
      newCaptures[index] = { 
        ...newCaptures[index], 
        blurActive: !newCaptures[index].blurActive 
      };
      return newCaptures;
    });
    
    // Show toast based on new state
    if (!capture.blurActive) {
      toast.info('Blur mode activated - Click and drag to select areas to blur');
    } else {
      toast.success('Blur mode deactivated');
    }
  };

  const handleUpdateBlurArea = (index: number, selection: Selection) => {
    setBlurAreas(prev => {
      const newBlurAreas = [...prev];
      newBlurAreas[index] = selection;
      return newBlurAreas;
    });
  };

  const handleAddDataCapture = (spaceId: string, folderId: string) => {
    // Set the default destination to this folder
    setDefaultDestination({ spaceId, folderId });
    
    // Also store in targetFolder for backward compatibility
    setTargetFolder({ spaceId, folderId });
    
    // Switch to capture view
    setCurrentView('capture');
    
    // Show the toolbar
    setShowToolbar(true);
    
    // Find the folder name for better UX message
    const space = spaces.find(s => s.id === spaceId);
    const folder = space?.folders.find(f => f.id === folderId);
    const folderName = folder?.name || 'selected folder';
    
    // Show toast with folder name
    toast.success(`Capture mode activated. New captures will be saved to "${folderName}".`, {
      duration: 4000,
    });
  };

  const handleAssignCaptures = async (captureIds: string[], settings: {
    spaceId?: string;
    folderId?: string;
    analysisType?: 'one-time' | 'scheduled' | null;
    schedule?: { frequency: string; time: string };
    llmProvider?: { id: string; name: string };
  }) => {
    if (!settings.spaceId || !settings.folderId) {
      toast.error('Please select a destination for your captures');
      return;
    }
    
    try {
      // Create sheets for each capture using the API
      for (const captureId of captureIds) {
        const item = captureItems.find(i => i.id === captureId);
        if (!item) continue;
        
        await createSheetMutation.mutateAsync({
          spaceId: settings.spaceId,
          folderId: settings.folderId,
          name: item.name,
          dataSourceType: item.type,
          dataSourceMeta: {
            analysisType: settings.llmProvider ? 'llm-integration' : settings.analysisType,
            llmProvider: settings.llmProvider,
            schedule: settings.schedule,
          },
        });
      }
      
      // Update captures with their destinations
      setCaptures(prev => prev.map(capture => {
        if (captureIds.includes(capture.id)) {
          const space = spaces.find(p => p.id === settings.spaceId);
          const folder = space?.folders.find(f => f.id === settings.folderId);
          return {
            ...capture,
            folder: folder && space ? `${space.name} → ${folder.name}` : capture.folder
          };
        }
        return capture;
      }));
      
      toast.success(`${captureIds.length} capture${captureIds.length > 1 ? 's' : ''} assigned successfully!`);
    } catch (error) {
      console.error('Error assigning captures:', error);
      toast.error('Failed to assign captures');
    }
  };

  const handleReset = () => {
    // Reset all states
    setCaptureMode('region');
    setCaptures([]);
    setBlurAreas([]);
    setShowOptionsModal(false);
    setIsBlurMode(false);
    setShowToolbar(true);
    
    // Scroll back to top
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  };

  const handleCloseToolbar = () => {
    setShowToolbar(false);
  };

  // Handle Space tag updates - using API mutations
  const handleUpdateSpaceTags = async (spaceId: string, tags: any[]) => {
    // Note: This is a no-op now since tags are managed by the API
    // The component should be refactored to use tag mutations directly
    // For now, refetch spaces to get updated tags
    await refetchSpaces();
  };

  // Render settings pages when active
  if (activeSettingsPage) {
    const settingsPageContent = () => {
      switch (activeSettingsPage) {
        case 'profile':
          return <ProfilePage onBack={handleCloseSettings} />;
        case 'settings':
          return (
            <SettingsPage 
              onBack={handleCloseSettings}
              onNavigate={(page) => setActiveSettingsPage(page)}
            />
          );
        case 'preferences':
          return <PreferencesPage onBack={handleCloseSettings} />;
        case 'notifications':
          return <NotificationsPage onBack={handleCloseSettings} />;
        case 'billing':
          return <BillingPage onBack={handleCloseSettings} />;
        case 'companies':
          return <CompanyManagementPage onBack={handleCloseSettings} />;
        case 'security':
          return <SecuritySettings onBack={handleCloseSettings} />;
        default:
          return null;
      }
    };
    
    return (
      <div className="min-h-screen bg-[#0A0E1A]">
        {settingsPageContent()}
        <Toaster position="bottom-right" theme="dark" />
      </div>
    );
  }

  // Switch between views
  if (currentView === 'data') {
    return (
      <>
        <DataManagementView 
          onBackToCapture={() => setCurrentView('capture')} 
          onAddDataCapture={handleAddDataCapture}
          spaces={spaces}
          currentSpaceId={currentSpaceId}
          onSpaceChange={handleSpaceChange}
          onCreateBlankSpace={handleCreateBlankSpace}
          onCreateSpace={async (data) => {
            try {
              await createSpaceMutation.mutateAsync({
                name: data.name,
                description: data.description,
                goals: data.goals,
                instructions: data.instructions,
              });
              toast.success(`Space \"${data.name}\" created!`);
            } catch (error) {
              console.error('Error creating space:', error);
              toast.error('Failed to create space');
            }
          }}
          onUpdateSpace={async (spaceId, data) => {
            try {
              await updateSpaceMutation.mutateAsync({
                id: spaceId,
                data: { 
                  name: data.name, 
                  goals: data.goals, 
                  instructions: data.instructions 
                },
              });
              toast.success(`Space \"${data.name}\" updated!`);
            } catch (error) {
              console.error('Error updating space:', error);
              toast.error('Failed to update space');
            }
          }}
          onUpdateTags={handleUpdateSpaceTags}
          onDeleteSpace={async (spaceId) => {
            try {
              await deleteSpaceMutation.mutateAsync(spaceId);
              toast.success('Space deleted!');
            } catch (error) {
              console.error('Error deleting space:', error);
              toast.error('Failed to delete space');
            }
          }}
          onUpdateFolder={async (spaceId, folderId, name) => {
            try {
              await updateFolderMutation.mutateAsync({ id: folderId, name });
              toast.success(`Folder renamed to \"${name}\"!`);
            } catch (error) {
              console.error('Error updating folder:', error);
              toast.error('Failed to rename folder');
            }
          }}
          onDeleteFolder={async (spaceId, folderId) => {
            try {
              await deleteFolderMutation.mutateAsync({ id: folderId, spaceId });
              toast.success('Folder deleted!');
            } catch (error) {
              console.error('Error deleting folder:', error);
              toast.error('Failed to delete folder');
            }
          }}
          onCreateFolder={handleCreateFolder}
          onUpdateSheetAnalysis={handleUpdateSheetAnalysis}
          onTopLevelViewChange={handleViewChange}
          user={user}
          onNavigateToSettings={handleNavigateToSettings}
          onLogout={handleLogout}
        />
      </>
    );
  } else if (currentView === 'changelogs') {
    return (
      <ChangeLogsView 
        spaces={spaces}
        currentSpaceId={currentSpaceId}
        onUpdateTags={handleUpdateSpaceTags}
        onCaptureNewAsset={() => {
          setCurrentView('capture');
          toast.info('Create a new capture to link to your change log');
        }}
      />
    );
  } else if (currentView === 'insights') {
    return (
      <InsightsView 
        spaces={spaces}
        currentSpaceId={currentSpaceId}
        onNavigateToCapture={(insightId) => {
          // Navigate to capture view and show floating toolbar
          setCurrentView('capture');
          setShowToolbar(true);
          if (insightId) {
            toast.info('Capture data to link to your new insight');
          }
        }}
      />
    );
  } else if (currentView === 'workspace') {
    // Workspace view with auto-collapsed ProjectBrowser sidebar
    const handleWorkspaceSelectSheet = (projectId: string, _folderId: string, _sheetId: string) => {
      setCurrentSpaceId(projectId);
    };
    
    const handleWorkspaceCreateProject = async (data: { name: string; description: string; goals: string; instructions: string }) => {
      try {
        await createSpaceMutation.mutateAsync({
          name: data.name,
          description: data.description,
          goals: data.goals,
          instructions: data.instructions,
        });
        toast.success(`Space "${data.name}" created!`);
      } catch (error) {
        console.error('Error creating space:', error);
        toast.error('Failed to create space');
      }
    };
    
    const handleWorkspaceUpdateProject = async (projectId: string, data: { name: string; goals: string; instructions: string }) => {
      try {
        await updateSpaceMutation.mutateAsync({
          id: projectId,
          data: { name: data.name, goals: data.goals, instructions: data.instructions },
        });
        toast.success('Space updated!');
      } catch (error) {
        console.error('Error updating space:', error);
        toast.error('Failed to update space');
      }
    };
    
    const handleWorkspaceDeleteProject = async (projectId: string) => {
      try {
        await deleteSpaceMutation.mutateAsync(projectId);
        toast.success('Space deleted');
        if (currentSpaceId === projectId && spaces.length > 1) {
          const remaining = spaces.filter(s => s.id !== projectId);
          if (remaining.length > 0) {
            setCurrentSpaceId(remaining[0].id);
          }
        }
      } catch (error) {
        console.error('Error deleting space:', error);
        toast.error('Failed to delete space');
      }
    };
    
    const handleWorkspaceUpdateFolder = async (_spaceId: string, folderId: string, name: string) => {
      try {
        await updateFolderMutation.mutateAsync({ id: folderId, name });
        toast.success(`Folder renamed to "${name}"!`);
      } catch (error) {
        console.error('Error renaming folder:', error);
        toast.error('Failed to rename folder');
      }
    };
    
    const handleWorkspaceDeleteFolder = async (spaceId: string, folderId: string) => {
      try {
        await deleteFolderMutation.mutateAsync({ id: folderId, spaceId });
        toast.success('Folder deleted');
      } catch (error) {
        console.error('Error deleting folder:', error);
        toast.error('Failed to delete folder');
      }
    };
    
    const handleWorkspaceViewChange = (view: 'data' | 'ai' | 'changelogs' | 'insights' | 'workspace') => {
      if (view === 'ai') {
        handleViewChange('data');
      } else if (view === 'data' || view === 'changelogs' || view === 'insights' || view === 'workspace') {
        handleViewChange(view);
      }
    };
    
    return (
      <div className="h-screen bg-[#0A0E1A] flex overflow-hidden">
        {/* Original Left Sidebar - Project Browser (auto-collapsed) */}
        <ProjectBrowser
          projects={Array.isArray(spaces) ? spaces : []}
          currentSpaceId={currentSpaceId}
          onSpaceChange={setCurrentSpaceId}
          onCreateBlankSpace={handleCreateBlankSpace}
          selectedSheet={null}
          onSelectSheet={handleWorkspaceSelectSheet}
          onCreateProject={handleWorkspaceCreateProject}
          onUpdateProject={handleWorkspaceUpdateProject}
          onDeleteProject={handleWorkspaceDeleteProject}
          onUpdateFolder={handleWorkspaceUpdateFolder}
          onDeleteFolder={handleWorkspaceDeleteFolder}
          onCreateFolder={handleCreateFolder}
          onAddDataCapture={() => {
            handleViewChange('capture');
            toast.info('Create a new capture');
          }}
          activeView="workspace"
          onViewChange={handleWorkspaceViewChange}
          onBackToCapture={() => handleViewChange('capture')}
          externalCollapseControl={true}
          user={user}
          onNavigateToSettings={handleNavigateToSettings}
          onLogout={handleLogout}
          activeWorkspaceId={activeWorkspaceId}
          onWorkspaceChange={setActiveWorkspaceId}
          onCreateWorkspace={handleCreateWorkspace}
          onDeleteWorkspace={handleDeleteWorkspace}
        />
        
        {/* Main Workspace Content */}
        <div className="flex-1 overflow-hidden">
          <InsightWorkspace
            onBack={() => handleViewChange('capture')}
            spaceId={currentSpaceId}
            insightId={null}
            workspaceId={activeWorkspaceId}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A]">
      {/* Auth Header Bar */}
      <div className="fixed top-0 right-0 z-50 p-4">
        {authLoading ? (
          <div className="bg-[#1A1F2E] px-4 py-2 rounded-lg text-gray-400 text-sm">
            Loading...
          </div>
        ) : isAuthenticated && user ? (
          <div className="flex items-center gap-3 bg-[#1A1F2E] px-4 py-2 rounded-lg">
            <div className="flex items-center gap-2">
              {user.profileImageUrl && (
                <img 
                  src={user.profileImageUrl} 
                  alt="Profile" 
                  className="w-6 h-6 rounded-full"
                />
              )}
              <span className="text-white text-sm">
                {user.firstName || user.email || 'User'}
              </span>
            </div>
            <a
              href="/api/logout"
              className="bg-[#2A2F3E] hover:bg-[#3A3F4E] text-white px-3 py-1 rounded text-sm transition-colors"
            >
              Logout
            </a>
          </div>
        ) : (
          <a
            href="/api/login"
            className="bg-[#FF6B35] hover:bg-[#FF8F5E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Login with Replit
          </a>
        )}
      </div>

      {/* 
        ================================================================
        REPLIT IMPLEMENTATION NOTE - CAPTURE INSIGHT FLOATING MENU
        ================================================================
        
        PURPOSE: This view simulates what users see on their actual computer screen
        when using CaptureInsight to capture data from existing dashboards/spreadsheets.
        
        CRITICAL CONCEPT: When users install CaptureInsight, they get a floating toolbar
        that appears ON TOP of their existing applications (Google Sheets, Excel, 
        analytics dashboards, etc.). The user does NOT see our spreadsheet - they see
        THEIR OWN data sources.
        
        WHAT USERS SEE:
        - The floating capture toolbar (positioned in top-right or draggable)
        - Selection overlays when capturing regions/windows
        - Blur area controls for privacy
        - Assignment panels for organizing captures
        
        WHAT USERS DON'T SEE:
        - Our demo spreadsheet (removed from this view)
        - Any CaptureInsight-specific data displays
        
        This view demonstrates the CAPTURE WORKFLOW ONLY. The actual data appears
        in the Data Management View after captures are assigned to projects/folders.
        
        TECHNICAL IMPLEMENTATION:
        - Desktop app: Use Electron with screen capture APIs
        - Web version: Browser extension with tab/window capture permissions
        - Mobile: OS-level screen recording APIs with overlay permissions
        
        The toolbar must be:
        - Always on top of other windows
        - Draggable for user positioning
        - Minimal/non-intrusive when collapsed
        - Fully functional for multi-screen setups
        ================================================================
      */}

      {/* Main Content */}
      <main className="h-screen overflow-hidden flex items-start justify-center px-6 py-10">
        <div className="w-full max-w-[1200px]">
          {/* Capture Insight Floating Menu */}
          <div ref={containerRef} className="relative">
            {/* Capture Area - Represents user's actual application window */}
            <div 
              ref={tableContainerRef}
              className="w-full h-[600px] rounded-lg border-2 border-dashed border-[#2A2F3E] bg-[#1A1F2E]/30 flex flex-col items-center justify-center gap-4"
            >
              <div className="text-center max-w-md px-6">
                <h3 className="text-[#FF6B35] mb-2">Capture Area</h3>
                <p className="text-[#94A3B8] text-sm mb-4">
                  This area simulates your screen. In the actual application, you'll capture data from your existing dashboards, spreadsheets, or any other application.
                </p>
                <div className="flex flex-col gap-2 text-[#64748B] text-xs">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#FF6B35]"></div>
                    <span>Click and drag to select a region</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#FF6B35]"></div>
                    <span>Use the floating toolbar to manage captures</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#FF6B35]"></div>
                    <span>Add blur areas to protect sensitive data</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Screenshot Overlay for user interaction */}
            <ScreenshotOverlay
              containerRef={containerRef}
              tableContainerRef={tableContainerRef}
              onCapture={handleCapture}
              isBlurMode={isBlurMode}
              onBlurArea={handleBlurArea}
              captures={captures}
              blurAreas={blurAreas}
              isDemoComplete={true}
              onDeleteCapture={handleDeleteCapture}
              onDeleteBlurArea={handleDeleteBlurArea}
              onUpdateCapture={handleUpdateCapture}
              onUpdateBlurArea={handleUpdateBlurArea}
              onUpdateCaptureTitle={handleUpdateCaptureTitle}
              onUpdateCaptureFolder={handleUpdateCaptureFolder}
              onToggleBlur={handleToggleBlur}
              selectedCaptureIndices={selectedCaptureIndices}
              onSelectedCapturesChange={setSelectedCaptureIndices}
              isShiftPressed={isShiftPressed}
              projects={spaces}
            />
          </div>
        </div>
      </main>

      {/* Floating Capture Toolbar - Hidden when options modal is open */}
      {showToolbar && !showOptionsModal && (
        <FloatingCaptureToolbar
          onClose={handleCloseToolbar}
          onCaptureWindow={() => {
            // Toggle window mode on/off
            if (captureMode === 'window') {
              setCaptureMode('region'); // Return to region mode
              toast.info('Window capture mode deactivated');
            } else {
              setCaptureMode('window');
              toast.info('Window capture mode activated');
            }
          }}
          onCaptureRegion={() => {
            // Toggle region mode on/off
            if (captureMode === 'region') {
              toast.info('Region capture mode already active');
            } else {
              setCaptureMode('region');
              toast.info('Region capture mode activated - Click and drag to select area');
            }
          }}
          onInsertShareLink={handleShareLink}
          onUploadFile={handleUploadFile}
          onFinalCapture={handleFinalCapture}
          captureCount={captures.length}
          currentMode={captureMode}
          selectedCaptureIndices={selectedCaptureIndices}
          onToggleBlur={handleToggleBlur}
          isBlurActive={selectedCaptureIndices.length === 1 ? captures[selectedCaptureIndices[0]]?.blurActive : false}
          selectedFolder={selectedCaptureIndices.length > 0 ? captures[selectedCaptureIndices[0]]?.folder : ''}
          onFolderChange={handleUpdateCaptureFolder}
          spaces={spaces}
          defaultDestination={defaultDestination}
          onDestinationChange={handleDestinationChange}
          hasUploadedFile={uploadedFiles.length > 0}
          hasAddedLink={shareLinks.length > 0}
          analysisType={analysisType}
          analysisFrequency={analysisFrequency}
          analysisTime={analysisTime}
          selectedLlmId={selectedLlmId}
          onAnalysisTypeChange={handleAnalysisTypeChange}
          onAnalysisFrequencyChange={handleAnalysisFrequencyChange}
          onAnalysisTimeChange={handleAnalysisTimeChange}
          onSelectedLlmChange={handleSelectedLlmChange}
          onViewDashboard={() => setCurrentView('workspace')}
          forceOpenPopup={forceOpenPopup}
        />
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
      />

      {/* Capture Options Modal - DEPRECATED: Settings now inline in FloatingCaptureToolbar */}
      {/* Keeping this for backward compatibility, but it should no longer be used */}
      <CaptureOptionsModal
        isOpen={showOptionsModal}
        onBack={() => setShowOptionsModal(false)}
        onStartAnalysis={handleStartAnalysis}
        spaces={spaces}
        captureItems={captureItems}
        onAddMoreCaptures={() => {
          // Close modal and show toolbar again to add more captures
          setShowOptionsModal(false);
          setShowToolbar(true);
        }}
        onCreateSpace={handleCreateSpace}
        onCreateFolder={handleCreateFolder}
        onDeleteCaptures={handleDeleteCaptures}
        onRenameSpace={handleRenameSpace}
        onRenameFolder={handleRenameFolder}
        defaultDestination={defaultDestination}
        onDestinationChange={handleDestinationChange}
      />

      {/* Capture Assignment Panel - Top Left */}
      {currentView === 'capture' && !showOptionsModal && captureItems.length > 0 && (
        <CaptureAssignmentPanel
          isOpen={true}
          captures={captureItems}
          spaces={spaces}
          onClose={() => setShowAssignmentPanel(false)}
          onAssignCaptures={handleAssignCaptures}
          defaultDestination={defaultDestination}
          analysisType={analysisType}
          analysisFrequency={analysisFrequency}
          selectedLlmId={selectedLlmId}
          captureSettings={captureSettings}
          onDeleteCapture={handleDeleteSingleCapture}
          onOpenDestinationPopup={() => setForceOpenPopup(forceOpenPopup === 'destination' ? null : 'destination')}
          onOpenLlmPopup={() => setForceOpenPopup(forceOpenPopup === 'llm' ? null : 'llm')}
          onOpenSchedulePopup={() => setForceOpenPopup(forceOpenPopup === 'schedule' ? null : 'schedule')}
          onSelectedCapturesChange={setPanelSelectedCaptureIds}
        />
      )}
    </div>
  );
}