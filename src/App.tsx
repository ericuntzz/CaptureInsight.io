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
import { TemplateManagement } from './pages/TemplateManagement';
import { RulesPanel } from './pages/RulesPanel';
import { ProjectBrowser, Project } from './components/ProjectBrowser';
import { EmptyWorkspaceState } from './components/EmptyWorkspaceState';
import { WelcomeModal, useWelcomeModal } from './components/WelcomeModal';
import { ChromeExtensionBanner } from './components/ChromeExtensionBanner';
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
  useUploadFile,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  useSaveWorkspaceRules,
} from './hooks/useSpaces';
import * as Dialog from '@radix-ui/react-dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './lib/queryClient';

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

type ValidationStatus = 'pending' | 'validating' | 'valid' | 'warning' | 'error';

interface ValidationResult {
  status: ValidationStatus;
  message: string;
  solution?: string;
  canProceed: boolean;
}

interface ShareLinkData {
  id: string;
  url: string;
  name: string;
  timestamp: Date;
  validationStatus?: ValidationStatus;
  validationResult?: ValidationResult;
}

interface FileData {
  id: string;
  name: string;
  file: File;
  timestamp: Date;
  validationStatus?: ValidationStatus;
  validationResult?: ValidationResult;
}

export default function App() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // Local state to optimistically close overlay immediately after successful completion
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  
  // Welcome modal state (for tutorial video modal)
  const { showWelcome, closeWelcome, openWelcome } = useWelcomeModal();
  
  // Check if user has completed onboarding
  const { 
    data: onboardingStatus, 
    isError: onboardingError,
    isLoading: onboardingLoading,
    refetch: refetchOnboarding,
    isFetching: onboardingFetching,
  } = useQuery({
    queryKey: ['/api/user/onboarding-status'],
    queryFn: async () => {
      const response = await fetch('/api/user/onboarding-status', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch onboarding status');
      }
      return response.json();
    },
    enabled: isAuthenticated,
    staleTime: 60000,
    retry: 2,
  });
  
  // Mutation to complete onboarding
  const completeOnboardingMutation = useMutation({
    mutationFn: async (aiLearningConsent: boolean) => {
      const response = await apiRequest('POST', '/api/user/complete-onboarding', { aiLearningConsent });
      return response.json();
    },
    onSuccess: () => {
      // Optimistically close the overlay immediately
      setOnboardingCompleted(true);
      queryClient.invalidateQueries({ queryKey: ['/api/user/onboarding-status'] });
      toast.success('Welcome to CaptureInsight!');
    },
    onError: () => {
      toast.error('Failed to save preferences. Please try again.');
    },
  });
  
  // Handle onboarding completion
  const handleOnboardingComplete = (aiLearningConsent: boolean) => {
    completeOnboardingMutation.mutate(aiLearningConsent);
  };
  
  // Handle retry when there's an error
  const handleOnboardingRetry = async () => {
    setIsRetrying(true);
    try {
      await refetchOnboarding();
    } finally {
      setIsRetrying(false);
    }
  };
  
  // Show welcome overlay ONLY for first-time users who haven't completed onboarding
  // Wait for onboarding status to load before showing - prevents flash for returning users
  const showWelcomeOverlay = isAuthenticated && !onboardingCompleted && 
    // Only show after data loads AND user is a first-time user who hasn't completed onboarding
    onboardingStatus?.isFirstLogin && !onboardingStatus?.hasCompletedOnboarding;
  
  // On initial load, restore the last visited URL if at root
  // IMPORTANT: Wait for auth to settle before restoring to prevent race conditions
  const [hasRestoredUrl, setHasRestoredUrl] = useState(false);
  
  useEffect(() => {
    // Wait for auth loading to complete before restoring URL
    if (authLoading) return;
    if (hasRestoredUrl) return;
    setHasRestoredUrl(true);
    
    // Only restore if we're at the root path (fresh page load/refresh)
    if (window.location.pathname === '/') {
      const savedUrl = localStorage.getItem('captureinsight_current_url');
      // Check that savedUrl is valid and different from current location
      if (savedUrl && savedUrl !== '/' && savedUrl !== window.location.pathname) {
        // Use replace to avoid adding to history
        router.replace(savedUrl);
      }
    }
  }, [authLoading, hasRestoredUrl, router]);
  
  // Persist current URL to localStorage whenever it changes
  // Only skip persisting BEFORE the initial URL restoration is complete
  useEffect(() => {
    // Don't persist until we've completed the initial URL restoration check
    // This prevents overwriting a good saved URL during the initial load race
    if (!hasRestoredUrl) return;
    
    const currentUrl = router.pathname + router.search + router.hash;
    localStorage.setItem('captureinsight_current_url', currentUrl);
  }, [hasRestoredUrl, router.pathname, router.search, router.hash]);
  
  // Initialize view from URL or localStorage
  const [currentView, setCurrentView] = useState<'capture' | 'data' | 'changelogs' | 'insights' | 'workspace' | 'rules'>(() => {
    if (typeof window !== 'undefined') {
      // First check if there's a saved URL to restore
      const savedUrl = localStorage.getItem('captureinsight_current_url');
      if (window.location.pathname === '/' && savedUrl && savedUrl !== '/') {
        // Get view from saved URL
        return getCurrentView(savedUrl.split('?')[0].split('#')[0]);
      }
      
      // Otherwise get view from current URL
      return getCurrentView(window.location.pathname);
    }
    return 'capture';
  });
  
  type SettingsPage = 'profile' | 'settings' | 'preferences' | 'notifications' | 'billing' | 'companies' | 'security' | 'templates' | null;
  const [activeSettingsPage, setActiveSettingsPage] = useState<SettingsPage>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/settings') {
        return 'settings';
      }
      if (window.location.pathname === '/settings/security') {
        return 'security';
      }
      if (window.location.pathname === '/settings/templates') {
        return 'templates';
      }
    }
    return null;
  });
  
  // Track the URL user was on before entering settings (to restore on back)
  // On initial load, if we're on a settings page, get the previous URL from localStorage
  const previousUrlRef = useRef<string | null>(
    typeof window !== 'undefined' && window.location.pathname.startsWith('/settings')
      ? localStorage.getItem('captureinsight_pre_settings_url') || '/'
      : null
  );
  
  const handleNavigateToSettings = (page: 'profile' | 'settings' | 'preferences' | 'notifications' | 'billing' | 'companies' | 'security' | 'templates') => {
    // Save current URL before navigating to settings (only if not already in settings)
    if (!window.location.pathname.startsWith('/settings')) {
      const currentUrl = window.location.pathname + window.location.search + window.location.hash;
      previousUrlRef.current = currentUrl;
      localStorage.setItem('captureinsight_pre_settings_url', currentUrl);
    }
    
    setActiveSettingsPage(page);
    if (page === 'settings') {
      router.push('/settings');
    } else if (page === 'security') {
      router.push('/settings/security');
    } else if (page === 'templates') {
      router.push('/settings/templates');
    }
  };
  
  const handleCloseSettings = () => {
    setActiveSettingsPage(null);
    if (window.location.pathname.startsWith('/settings')) {
      // Restore the URL the user was on before entering settings
      const previousUrl = previousUrlRef.current || localStorage.getItem('captureinsight_pre_settings_url') || '/';
      router.push(previousUrl);
      // Clear the saved pre-settings URL
      localStorage.removeItem('captureinsight_pre_settings_url');
      previousUrlRef.current = null;
    }
  };
  
  // Navigate from a settings sub-page back to the main settings menu
  const handleBackToSettingsMenu = () => {
    setActiveSettingsPage('settings');
    router.push('/settings');
  };
  
  const handleLogout = () => {
    window.location.href = '/api/logout';
  };
  
  // Note: Current view is now persisted via the full URL in captureinsight_current_url
  
  // Sync URL with current view when router changes (back/forward navigation)
  useEffect(() => {
    const viewFromUrl = getCurrentView(router.pathname);
    if (viewFromUrl !== currentView) {
      setCurrentView(viewFromUrl);
    }
  }, [router.pathname, currentView]);
  
  // Update URL when view changes
  const handleViewChange = (view: 'capture' | 'data' | 'changelogs' | 'insights' | 'workspace' | 'rules', params?: { captureBatchId?: string }) => {
    setCurrentView(view);
    // Push new URL with optional search params
    let url: string;
    switch (view) {
      case 'capture':
        url = buildRoute.capture();
        break;
      case 'data':
        url = buildRoute.data();
        break;
      case 'changelogs':
        url = buildRoute.changeLogs();
        break;
      case 'insights':
        url = buildRoute.insights();
        break;
      case 'workspace':
        url = buildRoute.workspace();
        break;
      case 'rules':
        url = buildRoute.rules();
        break;
    }
    
    // Add search params if provided
    if (params?.captureBatchId) {
      url = `${url}?batchId=${params.captureBatchId}`;
    }
    
    router.push(url);
  };
  
  const [captureMode, setCaptureMode] = useState<CaptureMode>('region');
  const [captures, setCaptures] = useState<CaptureData[]>([]);
  const [shareLinks, setShareLinks] = useState<ShareLinkData[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<FileData[]>([]);
  const isSubmittingCapturesRef = useRef(false);
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
  const uploadFileMutation = useUploadFile();
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
  
  // Track temp workspace ID to update when real ID comes back
  const pendingWorkspaceRef = useRef<string | null>(null);
  
  // Track newly created workspace ID to auto-edit its name
  const [newlyCreatedWorkspaceId, setNewlyCreatedWorkspaceId] = useState<string | null>(null);
  
  // Set activeWorkspaceId to first workspace when spaces/current space changes (if not already set)
  useEffect(() => {
    // Skip if we have a pending optimistic workspace (don't override temp ID)
    if (pendingWorkspaceRef.current) return;
    // Skip if active workspace is a temp ID (waiting for server response)
    if (activeWorkspaceId?.startsWith('temp-')) return;
    
    if (!spacesLoading && currentSpace) {
      const workspaces = currentSpace.workspaces || currentSpace.folders || [];
      if (workspaces.length > 0 && (!activeWorkspaceId || !workspaces.find(w => w.id === activeWorkspaceId))) {
        setActiveWorkspaceId(workspaces[0].id);
      }
    }
  }, [currentSpace, spacesLoading, activeWorkspaceId]);
  
  // Handle workspace creation - switches to new workspace immediately AND enables rename
  const handleCreateWorkspace = async (spaceId: string, name: string) => {
    try {
      const newWorkspace = await createWorkspaceMutation.mutateAsync({ 
        spaceId, 
        name,
        // Switch to temp ID immediately for instant feedback
        onOptimisticId: (tempId) => {
          pendingWorkspaceRef.current = tempId;
          setActiveWorkspaceId(tempId);
          // Also set as newly created to enable inline editing
          setNewlyCreatedWorkspaceId(tempId);
        }
      });
      // Update to real ID when server responds
      if (newWorkspace?.id) {
        // Only update if we're still on the temp ID (user hasn't switched away)
        if (pendingWorkspaceRef.current && activeWorkspaceId?.startsWith('temp-')) {
          setActiveWorkspaceId(newWorkspace.id);
        }
        // Update the editing ID if we're still editing the temp one
        if (newlyCreatedWorkspaceId?.startsWith('temp-')) {
          setNewlyCreatedWorkspaceId(newWorkspace.id);
        }
        pendingWorkspaceRef.current = null;
      }
    } catch (error) {
      console.error('Error creating workspace:', error);
      toast.error('Failed to create workspace');
      pendingWorkspaceRef.current = null;
      setNewlyCreatedWorkspaceId(null);
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
  
  // Rules modal state for upload flow
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [rulesModalWorkspaceId, setRulesModalWorkspaceId] = useState<string | null>(null);
  const [pendingUploadData, setPendingUploadData] = useState<{
    destinations: { spaceId: string; folderId: string }[];
    analysisSettings: Array<{
      captureId: string;
      analysisType: 'one-time' | 'scheduled' | 'llm-integration' | 'api' | null;
      llmProvider?: { id: string; name: string };
      schedule?: { frequency: string; time: string };
    }>;
    captureBatchId: string;
  } | null>(null);
  
  // Hook for saving workspace rules
  const saveWorkspaceRulesMutation = useSaveWorkspaceRules();
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Combine all capture items into a single array for the modal
  const captureItems = useMemo<CaptureItem[]>(() => {
    const items: CaptureItem[] = [];
    
    captures.forEach(capture => {
      items.push({
        id: capture.id,
        type: 'screen',
        name: capture.title,
        timestamp: capture.timestamp,
      });
    });
    
    // Add share links with validation status
    shareLinks.forEach(link => {
      items.push({
        id: link.id,
        type: 'link',
        name: link.name,
        timestamp: link.timestamp,
        url: link.url,
        validationStatus: link.validationStatus,
        validationResult: link.validationResult,
      });
    });
    
    // Add uploaded files with validation status
    uploadedFiles.forEach(file => {
      items.push({
        id: file.id,
        type: 'file',
        name: file.name,
        timestamp: file.timestamp,
        validationStatus: file.validationStatus,
        validationResult: file.validationResult,
      });
    });
    
    // Sort by timestamp
    return items.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [captures, shareLinks, uploadedFiles]);

  const validationInfo = useMemo(() => {
    let errorCount = 0;
    let warningCount = 0;
    
    captureItems.forEach(item => {
      if (item.validationStatus === 'error') errorCount++;
      if (item.validationStatus === 'warning') warningCount++;
    });
    
    let message = '';
    if (errorCount > 0) {
      message = `${errorCount} item${errorCount > 1 ? 's' : ''} cannot be processed`;
    } else if (warningCount > 0) {
      message = `${warningCount} item${warningCount > 1 ? 's' : ''} may have issues`;
    }
    
    return {
      hasErrors: errorCount > 0,
      hasWarnings: warningCount > 0,
      errorCount,
      warningCount,
      message,
    };
  }, [captureItems]);

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
    
    // For new users, destination may be minimal or empty
    // Allow proceeding - space and workspace will be auto-created in handleStartAnalysis
    const resolvedSpaceId = settings?.destination?.spaceId || settings?.destination?.projectId || spaces[0]?.id || '';
    const folderId = settings?.destination?.folderId || '';
    
    // Build destinations array - spaceId and folderId may be empty for new users (will be auto-created)
    const destinations = captureItems.map(() => ({ spaceId: resolvedSpaceId, folderId }));
    
    // Build analysis settings array (all items get same settings for now)
    const analysisSettings = captureItems.map(item => ({
      captureId: item.id,
      analysisType: settings?.llmProvider ? 'llm-integration' as const : settings?.analysisType || null,
      llmProvider: settings?.llmProvider,
      schedule: settings?.schedule
    }));
    
    // Use the same logic as the modal - space/workspace will be auto-created if needed
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
    // Prevent double submissions (React StrictMode, double-click, etc.)
    if (isSubmittingCapturesRef.current) {
      console.log('[Capture Flow] Submission already in progress, ignoring duplicate call');
      return;
    }
    isSubmittingCapturesRef.current = true;
    
    let { destinations } = data;
    const { analysisSettings } = data;
    
    // Generate a unique batch ID to group all captures from this session
    const captureBatchId = crypto.randomUUID();
    
    try {
      console.log('[Capture Flow] Starting analysis with destinations:', destinations);
      console.log('[Capture Flow] Capture batch ID:', captureBatchId);
      console.log('[Capture Flow] Available spaces:', spaces.map(s => ({ id: s.id, name: s.name, workspaces: s.workspaces?.length || 0, folders: s.folders?.length || 0 })));
      
      // Step 1: Determine or create the target space
      let targetSpaceId = destinations[0]?.spaceId;
      
      if (!targetSpaceId || targetSpaceId === '') {
        if (spaces.length === 0) {
          // No spaces exist - create a default one
          console.log('[Capture Flow] No spaces exist, creating default space...');
          const newSpace = await createSpaceMutation.mutateAsync({
            name: 'My Captures',
            description: 'Default space for your captured data'
          });
          
          if (newSpace?.id) {
            targetSpaceId = newSpace.id;
            setCurrentSpaceId(newSpace.id);
            console.log('[Capture Flow] Created new space:', newSpace.id);
          }
        } else {
          // Use first existing space
          targetSpaceId = spaces[0].id;
          console.log('[Capture Flow] Using existing space:', targetSpaceId);
        }
        
        // Update destinations with the space
        destinations = destinations.map(dest => ({
          ...dest,
          spaceId: targetSpaceId
        }));
      }
      
      // Step 2: Check if we need to create a workspace
      const targetFolderId = destinations[0]?.folderId;
      
      // Check if the target workspace actually exists in the loaded spaces
      const space = spaces.find(p => p.id === targetSpaceId);
      const existingWorkspaces = space?.workspaces || space?.folders || [];
      const workspaceExists = existingWorkspaces.some(w => w.id === targetFolderId);
      
      // Need workspace if folderId is empty OR if the referenced workspace doesn't exist
      const needsWorkspace = !targetFolderId || targetFolderId === '' || !workspaceExists;
      
      console.log('[Capture Flow] Target folderId:', targetFolderId, 'Workspace exists:', workspaceExists, 'Needs workspace:', needsWorkspace);
      
      if (needsWorkspace && targetSpaceId) {
        console.log('[Capture Flow] Space found:', space?.name, 'Existing workspaces:', existingWorkspaces.length);
        
        // ALWAYS create a workspace if none exist in this space
        if (existingWorkspaces.length === 0) {
          console.log('[Capture Flow] No workspaces in space, creating "My Workspace"...');
          
          try {
            const newWorkspace = await createWorkspaceMutation.mutateAsync({ 
              spaceId: targetSpaceId, 
              name: 'My Workspace' 
            });
            
            console.log('[Capture Flow] Workspace creation result:', newWorkspace);
            
            if (newWorkspace?.id) {
              // Update ALL destinations with the new workspace ID
              destinations = destinations.map(dest => ({
                ...dest,
                spaceId: targetSpaceId,
                folderId: newWorkspace.id
              }));
              
              // Set as active workspace immediately
              setActiveWorkspaceId(newWorkspace.id);
              console.log('[Capture Flow] Set active workspace to:', newWorkspace.id);
            }
          } catch (workspaceError) {
            console.error('[Capture Flow] Failed to create workspace:', workspaceError);
            toast.error('Failed to create workspace');
            return;
          }
        } else {
          // Use the first existing workspace
          const firstWorkspace = existingWorkspaces[0];
          console.log('[Capture Flow] Using existing workspace:', firstWorkspace.id, firstWorkspace.name);
          
          destinations = destinations.map(dest => ({
            ...dest,
            folderId: firstWorkspace.id
          }));
          setActiveWorkspaceId(firstWorkspace.id);
        }
      }
      
      // Step 3: Validate we have valid destinations
      const finalSpaceId = destinations[0]?.spaceId;
      const finalFolderId = destinations[0]?.folderId;
      
      console.log('[Capture Flow] Final destination - spaceId:', finalSpaceId, 'folderId:', finalFolderId);
      
      if (!finalSpaceId || !finalFolderId) {
        console.error('[Capture Flow] Missing destination after auto-creation!');
        toast.error('Could not determine destination for captures');
        return;
      }
      
      // Step 3.5: Check if workspace has active rules configured
      console.log('[Capture Flow] Checking workspace rules for:', finalFolderId);
      try {
        const rulesResponse = await fetch(`/api/workspaces/${finalFolderId}/rules`, {
          credentials: 'include'
        });
        const rulesData = rulesResponse.ok ? await rulesResponse.json() : null;
        
        // If no rules exist or rules are in draft status, show the rules modal
        if (!rulesData || rulesData.status !== 'active') {
          console.log('[Capture Flow] No active rules found, showing rules configuration modal');
          
          // Store pending upload data so we can resume after rules are configured
          setPendingUploadData({
            destinations,
            analysisSettings,
            captureBatchId,
          });
          setRulesModalWorkspaceId(finalFolderId);
          setShowRulesModal(true);
          
          // Don't reset the submitting flag - we'll resume after rules are configured
          return;
        }
        
        console.log('[Capture Flow] Active rules found, proceeding with upload');
      } catch (rulesError) {
        console.log('[Capture Flow] Error checking rules (proceeding anyway):', rulesError);
        // If rules check fails, proceed with upload anyway
      }
      
      // Step 4: Update captures with their destinations
      setCaptures(prev => prev.map((capture, index) => {
        const dest = destinations[index];
        return {
          ...capture,
          folder: `Workspace`
        };
      }));
      
      // Step 5: Create sheets for each capture via API
      console.log('[Capture Flow] Creating sheets for', captureItems.length, 'items...');
      
      for (let index = 0; index < captureItems.length; index++) {
        const item = captureItems[index];
        const dest = destinations[index];
        const settings = analysisSettings[index];
        
        console.log('[Capture Flow] Creating sheet:', item.name, 'in workspace:', dest.folderId, item.type === 'link' ? `URL: ${item.url}` : '', item.type === 'file' ? '(file upload)' : '');
        
        if (item.type === 'file') {
          const fileData = uploadedFiles.find(f => f.id === item.id);
          if (fileData?.file) {
            console.log('[Capture Flow] Uploading file:', fileData.file.name, 'size:', fileData.file.size);
            await uploadFileMutation.mutateAsync({
              spaceId: dest.spaceId,
              workspaceId: dest.folderId,
              file: fileData.file,
              name: item.name,
              captureBatchId,
              analysisType: settings?.analysisType,
              llmProvider: settings?.llmProvider,
              schedule: settings?.schedule,
            });
          } else {
            console.error('[Capture Flow] File not found for item:', item.id);
            toast.error(`File not found: ${item.name}`);
          }
        } else {
          await createSheetMutation.mutateAsync({
            spaceId: dest.spaceId,
            folderId: dest.folderId,
            name: item.name,
            dataSourceType: item.type,
            dataSourceMeta: {
              analysisType: settings?.analysisType,
              llmProvider: settings?.llmProvider,
              schedule: settings?.schedule,
              url: item.url,
            },
            captureBatchId,
          });
        }
      }
      
      // Step 6: Navigate to workspace view with batch ID
      console.log('[Capture Flow] Navigating to workspace view...');
      console.log('[Capture Flow] Active workspace ID:', finalFolderId);
      console.log('[Capture Flow] Capture batch ID for navigation:', captureBatchId);
      
      // Set the active workspace before navigating
      setActiveWorkspaceId(finalFolderId);
      
      // Use handleViewChange to properly update URL and view state with batch ID
      handleViewChange('workspace', { captureBatchId });
      setShowOptionsModal(false);
      
      // Clear captures after successful save
      setCaptures([]);
      setUploadedFiles([]);
      setShareLinks([]);
      
      console.log('[Capture Flow] Navigation complete, showing success toast');
      toast.success(`${captureItems.length} item(s) saved to workspace!`);
      
    } catch (error) {
      console.error('[Capture Flow] Error:', error);
      // Provide more specific error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to save captures: ${errorMessage}`);
    } finally {
      // Reset submission guard after completion (success or error)
      isSubmittingCapturesRef.current = false;
    }
  };

  // Continue upload after rules have been configured
  const continueUploadAfterRules = async () => {
    if (!pendingUploadData) {
      console.error('[Capture Flow] No pending upload data');
      return;
    }
    
    const { destinations, analysisSettings, captureBatchId } = pendingUploadData;
    
    console.log('[Capture Flow] Continuing upload after rules configuration');
    
    try {
      // Step 4: Update captures with their destinations
      setCaptures(prev => prev.map((capture, index) => {
        return {
          ...capture,
          folder: `Workspace`
        };
      }));
      
      // Step 5: Create sheets for each capture via API
      console.log('[Capture Flow] Creating sheets for', captureItems.length, 'items...');
      
      for (let index = 0; index < captureItems.length; index++) {
        const item = captureItems[index];
        const dest = destinations[index];
        const settings = analysisSettings[index];
        
        console.log('[Capture Flow] Creating sheet:', item.name, 'in workspace:', dest.folderId);
        
        if (item.type === 'file') {
          const fileData = uploadedFiles.find(f => f.id === item.id);
          if (fileData?.file) {
            console.log('[Capture Flow] Uploading file:', fileData.file.name, 'size:', fileData.file.size);
            await uploadFileMutation.mutateAsync({
              spaceId: dest.spaceId,
              workspaceId: dest.folderId,
              file: fileData.file,
              name: item.name,
              captureBatchId,
              analysisType: settings?.analysisType,
              llmProvider: settings?.llmProvider,
              schedule: settings?.schedule,
            });
          } else {
            console.error('[Capture Flow] File not found for item:', item.id);
            toast.error(`File not found: ${item.name}`);
          }
        } else {
          await createSheetMutation.mutateAsync({
            spaceId: dest.spaceId,
            folderId: dest.folderId,
            name: item.name,
            dataSourceType: item.type,
            dataSourceMeta: {
              analysisType: settings?.analysisType,
              llmProvider: settings?.llmProvider,
              schedule: settings?.schedule,
              url: item.url,
            },
            captureBatchId,
          });
        }
      }
      
      // Step 6: Navigate to workspace view with batch ID
      const finalFolderId = destinations[0]?.folderId;
      console.log('[Capture Flow] Navigating to workspace view...');
      
      setActiveWorkspaceId(finalFolderId);
      handleViewChange('workspace', { captureBatchId });
      setShowOptionsModal(false);
      
      // Clear captures and pending data after successful save
      setCaptures([]);
      setUploadedFiles([]);
      setShareLinks([]);
      setPendingUploadData(null);
      
      console.log('[Capture Flow] Upload complete, showing success toast');
      toast.success(`${captureItems.length} item(s) saved to workspace!`);
      
    } catch (error) {
      console.error('[Capture Flow] Error during continued upload:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to save captures: ${errorMessage}`);
    } finally {
      isSubmittingCapturesRef.current = false;
    }
  };

  // Handle finishing rules configuration and continuing with upload
  const handleRulesFinish = async () => {
    if (!rulesModalWorkspaceId) return;
    
    try {
      // Set rules status to 'active'
      await apiRequest('PATCH', `/api/workspaces/${rulesModalWorkspaceId}/rules`, { 
        status: 'active' 
      });
      
      toast.success('Rules saved and activated!');
      
      // Close the modal
      setShowRulesModal(false);
      setRulesModalWorkspaceId(null);
      
      // Continue with the upload
      await continueUploadAfterRules();
      
    } catch (error) {
      console.error('Error activating rules:', error);
      toast.error('Failed to activate rules');
    }
  };

  // Handle saving a section of rules
  const handleSaveRulesSection = async (section: string, data: any) => {
    if (!rulesModalWorkspaceId) return;
    
    try {
      await apiRequest('PUT', `/api/workspaces/${rulesModalWorkspaceId}/rules`, { 
        section, 
        data,
        status: 'draft' // Keep as draft until Finish is clicked
      });
      toast.success('Section saved');
    } catch (error) {
      console.error('Error saving rules section:', error);
      toast.error('Failed to save rules');
    }
  };

  const validateGoogleSheet = async (url: string): Promise<ValidationResult> => {
    const isGoogleSheet = /docs\.google\.com\/spreadsheets|sheets\.google\.com/.test(url);
    
    if (!isGoogleSheet) {
      return { status: 'valid', message: 'Link is ready for capture', canProceed: true };
    }
    
    try {
      const response = await fetch('/api/validate-google-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url }),
      });
      
      const data = await response.json();
      
      if (data.isPublic) {
        return {
          status: 'valid',
          message: 'Google Sheet is publicly accessible',
          canProceed: true,
        };
      } else {
        return {
          status: 'warning',
          message: data.message || 'Google Sheet may not be publicly accessible',
          solution: data.solution || 'Open your Google Sheet, click "Share", then change access to "Anyone with the link can view"',
          canProceed: true,
        };
      }
    } catch (error) {
      console.error('Error validating Google Sheet:', error);
      return {
        status: 'warning',
        message: 'Could not verify Google Sheet accessibility',
        solution: 'Make sure the sheet is shared publicly: Open the sheet, click "Share", then set "Anyone with the link" to "Viewer"',
        canProceed: true,
      };
    }
  };

  const validateFile = (file: File): ValidationResult => {
    const supportedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'application/pdf',
    ];
    const maxSize = 50 * 1024 * 1024; // 50MB
    
    if (!supportedTypes.includes(file.type)) {
      return {
        status: 'error',
        message: 'Unsupported file type',
        solution: 'Supported formats: CSV, Excel, PNG, JPEG, GIF, WebP, PDF',
        canProceed: false,
      };
    }
    
    if (file.size > maxSize) {
      return {
        status: 'error',
        message: 'File too large',
        solution: `Maximum file size is 50MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB`,
        canProceed: false,
      };
    }
    
    return {
      status: 'valid',
      message: 'File is ready for upload',
      canProceed: true,
    };
  };

  const handleShareLink = async (url: string) => {
    const now = new Date();
    const linkId = `link-${Date.now()}-${Math.random()}`;
    
    const linkData: ShareLinkData = {
      id: linkId,
      url,
      name: url.length > 40 ? url.substring(0, 37) + '...' : url,
      timestamp: now,
      validationStatus: 'validating',
    };
    
    setShareLinks(prev => [...prev, linkData]);
    toast.success('Link added - validating...');
    console.log('Share link:', url);
    
    const validationResult = await validateGoogleSheet(url);
    
    setShareLinks(prev => prev.map(link => 
      link.id === linkId
        ? { ...link, validationStatus: validationResult.status, validationResult }
        : link
    ));
    
    if (validationResult.status === 'warning') {
      toast.warning(validationResult.message);
    } else if (validationResult.status === 'error') {
      toast.error(validationResult.message);
    }
  };

  const handleUploadFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const now = new Date();
      const validationResult = validateFile(file);
      
      const fileData: FileData = {
        id: `file-${Date.now()}-${Math.random()}`,
        name: file.name,
        file,
        timestamp: now,
        validationStatus: validationResult.status,
        validationResult,
      };
      
      setUploadedFiles(prev => [...prev, fileData]);
      
      if (validationResult.status === 'valid') {
        toast.success(`File uploaded: ${file.name}`);
      } else if (validationResult.status === 'warning') {
        toast.warning(validationResult.message);
      } else if (validationResult.status === 'error') {
        toast.error(validationResult.message);
      }
      
      console.log('Uploaded file:', file, 'Validation:', validationResult.status);
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
      
      // Auto-navigate to capture view to prompt data collection
      setCurrentView('capture');
      setShowToolbar(true);
      toast.success('Space created! Add your first data capture.');
      
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
          return <ProfilePage onBack={handleBackToSettingsMenu} />;
        case 'settings':
          return (
            <SettingsPage 
              onBack={handleCloseSettings}
              onNavigate={(page) => setActiveSettingsPage(page)}
            />
          );
        case 'preferences':
          return <PreferencesPage onBack={handleBackToSettingsMenu} />;
        case 'notifications':
          return <NotificationsPage onBack={handleBackToSettingsMenu} />;
        case 'billing':
          return <BillingPage onBack={handleBackToSettingsMenu} />;
        case 'companies':
          return <CompanyManagementPage onBack={handleBackToSettingsMenu} />;
        case 'security':
          return <SecuritySettings onBack={handleBackToSettingsMenu} />;
        case 'templates':
          return (
            <TemplateManagement 
              workspaceId={activeWorkspaceId} 
              spaceId={currentSpaceId}
              onBack={handleBackToSettingsMenu} 
            />
          );
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
              const newSpace = await createSpaceMutation.mutateAsync({
                name: data.name,
                description: data.description,
                goals: data.goals,
                instructions: data.instructions,
              });
              setCurrentSpaceId(newSpace.id);
              
              // Auto-navigate to capture view to prompt data collection
              setCurrentView('capture');
              setShowToolbar(true);
              toast.success(`Space "${data.name}" created! Add your first data capture.`);
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
  } else if (currentView === 'workspace' || currentView === 'rules') {
    // Workspace view with auto-collapsed ProjectBrowser sidebar
    const handleWorkspaceSelectSheet = (projectId: string, _folderId: string, _sheetId: string) => {
      setCurrentSpaceId(projectId);
    };
    
    const handleWorkspaceCreateProject = async (data: { name: string; description: string; goals: string; instructions: string }) => {
      try {
        const newSpace = await createSpaceMutation.mutateAsync({
          name: data.name,
          description: data.description,
          goals: data.goals,
          instructions: data.instructions,
        });
        setCurrentSpaceId(newSpace.id);
        
        // Auto-navigate to capture view to prompt data collection
        setCurrentView('capture');
        setShowToolbar(true);
        toast.success(`Space "${data.name}" created! Add your first data capture.`);
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
      <div className="h-screen bg-[#0A0E1A] flex flex-col overflow-hidden">
        {/* Chrome Extension Download Banner */}
        <ChromeExtensionBanner />
        
        <div className="flex-1 flex overflow-hidden">
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
          activeView={currentView === 'rules' ? 'rules' : 'workspace'}
          onViewChange={handleWorkspaceViewChange}
          onBackToCapture={() => handleViewChange('capture')}
          externalCollapseControl={(() => {
            const workspaces = currentSpace?.workspaces || currentSpace?.folders || [];
            // Keep menu expanded when no workspaces, collapse when workspaces exist
            return workspaces.length > 0;
          })()}
          user={user}
          onNavigateToSettings={handleNavigateToSettings}
          onLogout={handleLogout}
          activeWorkspaceId={activeWorkspaceId}
          onWorkspaceChange={setActiveWorkspaceId}
          onCreateWorkspace={handleCreateWorkspace}
          onDeleteWorkspace={handleDeleteWorkspace}
          newlyCreatedWorkspaceId={newlyCreatedWorkspaceId}
          onNewlyCreatedWorkspaceHandled={() => setNewlyCreatedWorkspaceId(null)}
          onNavigateToRules={() => handleViewChange('rules')}
        />
        
        {/* Main Workspace Content */}
        <div className="flex-1 overflow-hidden">
          {(() => {
            // Show loading state while spaces data is being fetched
            if (spacesLoading) {
              return (
                <div className="flex-1 flex items-center justify-center h-full bg-[#0D1117]">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
                    <span className="text-gray-400 text-sm">Loading workspace...</span>
                  </div>
                </div>
              );
            }
            
            const workspaces = currentSpace?.workspaces || currentSpace?.folders || [];
            const hasWorkspaces = workspaces.length > 0;
            
            if (!hasWorkspaces) {
              return (
                <EmptyWorkspaceState 
                  onUploadData={() => {
                    // Switch to capture view to show the capture toolbar
                    handleViewChange('capture');
                  }}
                  onWatchTutorial={openWelcome}
                />
              );
            }
            
            if (currentView === 'rules') {
              const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
              return (
                <RulesPanel
                  workspaceId={activeWorkspaceId || ''}
                  workspaceName={activeWorkspace?.name || 'Workspace'}
                  workspaces={workspaces.map(w => ({ id: w.id, name: w.name }))}
                  onWorkspaceChange={setActiveWorkspaceId}
                  onSave={async (section, data) => {
                    if (!activeWorkspaceId) return;
                    await apiRequest('PUT', `/api/workspaces/${activeWorkspaceId}/rules`, { section, data });
                    toast.success('Rules saved successfully');
                  }}
                  onFinish={() => handleViewChange('workspace')}
                />
              );
            }
            
            // Extract batchId from URL to use as key - forces re-mount when batchId changes
            // This ensures the summary useEffect runs when navigating with a new batchId
            const urlBatchId = new URLSearchParams(router.search).get('batchId');
            
            return (
              <InsightWorkspace
                key={urlBatchId ? `workspace-${urlBatchId}` : 'workspace-default'}
                onBack={() => handleViewChange('capture')}
                spaceId={currentSpaceId}
                insightId={null}
                workspaceId={activeWorkspaceId}
              />
            );
          })()}
        </div>
        </div>
        
        {/* Welcome Tutorial Modal - shows tutorial videos and questions form */}
        <WelcomeModal
          open={showWelcome}
          onOpenChange={(open) => {
            if (!open) closeWelcome();
          }}
        />
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
          <div className="flex items-center gap-3">
            <a
              href="/api/login"
              className="text-white/80 hover:text-white px-3 py-2 text-sm font-medium transition-colors"
            >
              Login
            </a>
            <a
              href="/api/login"
              className="bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] hover:shadow-lg hover:shadow-[#FF6B35]/30 text-white px-5 py-2 rounded-lg text-sm font-medium transition-all"
            >
              Get Started Free
            </a>
          </div>
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
          onViewDashboard={() => handleViewChange('workspace')}
          forceOpenPopup={forceOpenPopup}
          validationInfo={validationInfo}
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
      
      {/* Welcome Overlay for new users - includes AI learning consent */}
      <WelcomeOverlay
        isOpen={showWelcomeOverlay ?? false}
        onComplete={handleOnboardingComplete}
        isLoading={completeOnboardingMutation.isPending}
        isStatusLoading={onboardingLoading || onboardingFetching}
        hasError={onboardingError && !isRetrying}
        onRetry={handleOnboardingRetry}
        isRetrying={isRetrying}
      />

      {/* Welcome Tutorial Modal - shows tutorial videos and questions form */}
      <WelcomeModal
        open={showWelcome && isAuthenticated}
        onOpenChange={(open) => {
          if (!open) closeWelcome();
        }}
      />

      {/* Rules Configuration Modal - shown during upload flow when no active rules exist */}
      <Dialog.Root 
        open={showRulesModal} 
        onOpenChange={(open) => {
          if (!open) {
            // If user closes modal without finishing, cancel the upload
            setShowRulesModal(false);
            setRulesModalWorkspaceId(null);
            setPendingUploadData(null);
            isSubmittingCapturesRef.current = false;
            toast.info('Upload cancelled - configure rules to continue');
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/70 z-50" />
          <Dialog.Content className="fixed inset-0 z-50 overflow-y-auto">
            <div className="min-h-full">
              {rulesModalWorkspaceId && (() => {
                const allWorkspaces = spaces.flatMap(s => 
                  (s.workspaces || s.folders || []).map(w => ({ id: w.id, name: w.name }))
                );
                const currentWorkspace = allWorkspaces.find(w => w.id === rulesModalWorkspaceId);
                return (
                  <RulesPanel
                    workspaceId={rulesModalWorkspaceId}
                    workspaceName={currentWorkspace?.name || 'Workspace'}
                    workspaces={allWorkspaces}
                    onWorkspaceChange={(newId) => setRulesModalWorkspaceId(newId)}
                    onSave={handleSaveRulesSection}
                    onFinish={handleRulesFinish}
                  />
                );
              })()}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}