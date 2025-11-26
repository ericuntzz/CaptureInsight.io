import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Spreadsheet } from './components/Spreadsheet';
import { ScreenshotOverlay } from './components/ScreenshotOverlay';
import { FloatingCaptureToolbar } from './components/FloatingCaptureToolbar';
import { CaptureOptionsModal, CaptureItem } from './components/CaptureOptionsModal';
import { CaptureAssignmentPanel } from './components/CaptureAssignmentPanel';
import { DataManagementView } from './components/DataManagementView';
import { WelcomeOverlay } from './components/WelcomeOverlay';
import { toast, Toaster } from 'sonner@2.0.3';
import { Space } from './components/SpaceBrowser';
import type { DataSource } from './components/DataSourceSidebar';
import { buildRoute, getCurrentView } from './routes';
import { useRouter } from './hooks/useRouter';

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

// Initial spaces data for the demo
// ⚠️ NOTE: Mock data sources are added for demo purposes only. 
// These will need to be removed before production launch.
const initialSpaces: Space[] = [
  {
    id: 'space-1',
    name: 'Q4 Marketing Analysis',
    description: 'Comprehensive marketing performance data',
    goals: 'Track Q4 marketing performance to optimize CAC and identify highest-performing channels.',
    instructions: '• Revenue data is in USD\\n• Compare performance against $50 target CAC\\n• Focus on month-over-month trends\\n• Prioritize Google Ads and Facebook Ads analysis',
    folders: [
      { 
        id: 'folder-1', 
        name: 'HubSpot Data', 
        sheets: [
          {
            id: 'sheet-1',
            name: 'Revenue Metrics Dashboard',
            rowCount: 120,
            lastModified: '2 hours ago',
            dataSource: {
              type: 'screenshot',
              name: 'Revenue Metrics Dashboard',
              captureDate: new Date('2024-11-16T14:30:00'),
              capturedBy: 'Eric Unterberger',
              folder: 'HubSpot Data',
              space: 'Q4 Marketing Analysis',
              tags: ['revenue', 'q4-2024', 'hubspot'],
              sentToLLMs: [
                { llm: 'ChatGPT', timestamp: new Date('2024-11-16T14:35:00') }
              ],
              preview: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=500&fit=crop'
            }
          },
          {
            id: 'sheet-2',
            name: 'Lead Generation Report',
            rowCount: 450,
            lastModified: '1 day ago',
            dataSource: {
              type: 'link',
              name: 'Lead Generation Report',
              captureDate: new Date('2024-11-15T10:20:00'),
              capturedBy: 'Eric Unterberger',
              folder: 'HubSpot Data',
              space: 'Q4 Marketing Analysis',
              tags: ['leads', 'marketing', 'q4-2024'],
              url: 'https://app.hubspot.com/reports/lead-generation-dashboard'
            }
          },
          {
            id: 'sheet-3',
            name: 'Customer Acquisition Data',
            rowCount: 89,
            lastModified: '3 days ago',
            dataSource: {
              type: 'file',
              name: 'Customer Acquisition Data',
              captureDate: new Date('2024-11-13T16:45:00'),
              capturedBy: 'Eric Unterberger',
              folder: 'HubSpot Data',
              space: 'Q4 Marketing Analysis',
              tags: ['customers', 'acquisition'],
              sentToLLMs: [
                { llm: 'Claude', timestamp: new Date('2024-11-13T16:50:00') }
              ],
              fileData: {
                fileName: 'customer_acquisition_oct2024.csv',
                fileSize: '245 KB',
                fileType: 'text/csv'
              }
            }
          }
        ] 
      },
      { 
        id: 'folder-2', 
        name: 'Google Ads Data', 
        sheets: [
          {
            id: 'sheet-4',
            name: 'Ad Spend Analysis',
            rowCount: 365,
            lastModified: '5 hours ago',
            dataSource: {
              type: 'screenshot',
              name: 'Ad Spend Analysis',
              captureDate: new Date('2024-11-17T09:15:00'),
              capturedBy: 'Sarah Chen',
              folder: 'Google Ads Data',
              space: 'Q4 Marketing Analysis',
              tags: ['ads', 'spend', 'google'],
              preview: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=500&fit=crop'
            }
          },
          {
            id: 'sheet-5',
            name: 'Conversion Rates',
            rowCount: 180,
            lastModified: '1 day ago',
            dataSource: {
              type: 'screenshot',
              name: 'Conversion Rates',
              captureDate: new Date('2024-11-16T11:30:00'),
              capturedBy: 'Mike Johnson',
              folder: 'Google Ads Data',
              space: 'Q4 Marketing Analysis',
              tags: ['conversions', 'google', 'performance'],
              sentToLLMs: [
                { llm: 'ChatGPT', timestamp: new Date('2024-11-16T11:35:00') },
                { llm: 'Claude', timestamp: new Date('2024-11-16T11:40:00') }
              ],
              preview: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=500&fit=crop'
            }
          }
        ] 
      },
      { 
        id: 'folder-3', 
        name: 'Analytics', 
        sheets: [
          {
            id: 'sheet-6',
            name: 'Website Traffic Overview',
            rowCount: 730,
            lastModified: '6 hours ago',
            dataSource: {
              type: 'link',
              name: 'Website Traffic Overview',
              captureDate: new Date('2024-11-17T08:00:00'),
              capturedBy: 'Alex Rivera',
              folder: 'Analytics',
              space: 'Q4 Marketing Analysis',
              tags: ['traffic', 'analytics', 'web'],
              url: 'https://analytics.google.com/analytics/web/#/report/visitors-overview'
            }
          }
        ] 
      },
    ],
    tags: [
      { id: 'tag-1', name: 'Revenue Growth', color: '#FF6B35', createdAt: new Date('2025-01-10'), createdBy: 'Sarah Chen', spaceId: 'space-1' },
      { id: 'tag-2', name: 'Cost Optimization', color: '#4ECDC4', createdAt: new Date('2025-01-12'), createdBy: 'Mike Johnson', spaceId: 'space-1' },
      { id: 'tag-3', name: 'Customer Acquisition', color: '#FFE66D', createdAt: new Date('2025-01-15'), createdBy: 'Sarah Chen', spaceId: 'space-1' },
      { id: 'tag-4', name: 'Ad Performance', color: '#A8E6CF', createdAt: new Date('2025-01-18'), createdBy: 'Alex Rivera', spaceId: 'space-1' },
      { id: 'tag-5', name: 'Q4 Planning', color: '#FF8B94', createdAt: new Date('2025-01-20'), createdBy: 'Sarah Chen', spaceId: 'space-1' },
    ],
  },
  {
    id: 'space-2',
    name: 'Sales Performance',
    description: 'Salesforce and sales data tracking',
    folders: [
      { 
        id: 'folder-4', 
        name: 'Salesforce Captures', 
        sheets: [
          {
            id: 'sheet-7',
            name: 'Pipeline Data Q4',
            rowCount: 234,
            lastModified: '12 hours ago',
            dataSource: {
              type: 'screenshot',
              name: 'Pipeline Data Q4',
              captureDate: new Date('2024-11-17T02:30:00'),
              capturedBy: 'Eric Unterberger',
              folder: 'Salesforce Captures',
              space: 'Sales Performance',
              tags: ['pipeline', 'salesforce', 'q4'],
              sentToLLMs: [
                { llm: 'ChatGPT', timestamp: new Date('2024-11-17T02:35:00') }
              ],
              preview: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&h=500&fit=crop'
            }
          },
          {
            id: 'sheet-8',
            name: 'Closed Deals Export',
            rowCount: 67,
            lastModified: '2 days ago',
            dataSource: {
              type: 'file',
              name: 'Closed Deals Export',
              captureDate: new Date('2024-11-15T14:20:00'),
              capturedBy: 'Sarah Chen',
              folder: 'Salesforce Captures',
              space: 'Sales Performance',
              tags: ['deals', 'salesforce', 'closed'],
              fileData: {
                fileName: 'closed_deals_november_2024.xlsx',
                fileSize: '892 KB',
                fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              }
            }
          }
        ] 
      },
    ],
    tags: [],
  },
];

export default function App() {
  const router = useRouter();
  const [currentView, setCurrentView] = useState<'capture' | 'data' | 'changelogs' | 'insights'>(() => {
    // Initialize view from URL
    return getCurrentView(router.pathname);
  });
  
  // Sync URL with current view
  useEffect(() => {
    const viewFromUrl = getCurrentView(router.pathname);
    if (viewFromUrl !== currentView) {
      setCurrentView(viewFromUrl);
    }
  }, [router.pathname]);
  
  // Update URL when view changes
  const handleViewChange = (view: 'capture' | 'data' | 'changelogs' | 'insights') => {
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
  const [spaces, setSpaces] = useState<Space[]>(() => {
    // Load spaces from localStorage if available
    try {
      const saved = localStorage.getItem('captureinsight_spaces');
      if (saved) {
        const parsedSpaces = JSON.parse(saved);
        
        // ⚠️ MIGRATION: Check if mock data sources exist, if not, use initialSpaces
        // This ensures users get the new mock data sources after code update
        const hasMockDataSources = parsedSpaces.some((space: Space) => 
          space.folders.some(folder => 
            folder.sheets.some(sheet => sheet.dataSource)
          )
        );
        
        if (!hasMockDataSources) {
          console.log('🔄 Migrating to new mock data with data sources...');
          localStorage.setItem('captureinsight_spaces', JSON.stringify(initialSpaces));
          return initialSpaces;
        }
        
        return parsedSpaces;
      }
    } catch (error) {
      console.error('Error loading spaces from localStorage:', error);
    }
    return initialSpaces;
  });
  
  // ⚠️ CRITICAL: Current Space tracking for Space-scoped architecture
  // All features (Capture, AI Assistant, Change Logs) operate within the current Space
  const [currentSpaceId, setCurrentSpaceId] = useState<string | null>(() => {
    // Load from localStorage
    try {
      const saved = localStorage.getItem('captureinsight_current_space');
      if (saved) {
        return saved;
      }
    } catch (error) {
      console.error('Error loading current space from localStorage:', error);
    }
    // Default to first space
    return initialSpaces[0]?.id || null;
  });
  
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
  
  // Default destination shared between FloatingCaptureToolbar and CaptureOptionsModal
  const [defaultDestination, setDefaultDestination] = useState<{ spaceId: string; folderId: string } | null>(() => {
    // Initialize with first space/folder
    const firstSpace = initialSpaces[0];
    const firstFolder = firstSpace?.folders[0];
    return firstSpace && firstFolder ? { spaceId: firstSpace.id, folderId: firstFolder.id } : null;
  });
  
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
  
  // ⚠️ CRITICAL: Persist spaces to localStorage whenever they change
  // This ensures analysis settings (LLM, schedule, etc.) persist across page navigation
  useEffect(() => {
    try {
      localStorage.setItem('captureinsight_spaces', JSON.stringify(spaces));
    } catch (error) {
      console.error('Error saving spaces to localStorage:', error);
    }
  }, [spaces]);

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
    destination: { spaceId: string; folderId: string };
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
    
    // Build destinations array (all items go to same destination for now)
    const destinations = captureItems.map(() => settings.destination);
    
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

  const handleStartAnalysis = (data: { 
    destinations: { spaceId: string; folderId: string }[]; 
    analysisSettings: Array<{
      captureId: string;
      analysisType: 'one-time' | 'scheduled' | 'llm-integration' | 'api' | null;
      llmProvider?: { id: string; name: string };
      schedule?: { frequency: string; time: string };
    }>
  }) => {
    const { destinations, analysisSettings } = data;
    // Update captures with their destinations
    setCaptures(prev => prev.map((capture, index) => {
      const dest = destinations[index];
      const space = spaces.find(p => p.id === dest.spaceId);
      const folder = space?.folders.find(f => f.id === dest.folderId);
      return {
        ...capture,
        folder: folder ? `${space.name} → ${folder.name}` : capture.folder
      };
    }));
    
    // ⚠️ CRITICAL: Add sheets to space folders for each capture
    // This ensures captures appear in the Projects sidebar in DataManagementView
    setSpaces(prev => {
      const newSpaces = [...prev];
      
      captureItems.forEach((item, index) => {
        const dest = destinations[index];
        const spaceIndex = newSpaces.findIndex(p => p.id === dest.spaceId);
        
        if (spaceIndex !== -1) {
          const space = newSpaces[spaceIndex];
          const folderIndex = space.folders.findIndex(f => f.id === dest.folderId);
          
          if (folderIndex !== -1) {
            // ⚠️ CRITICAL: Get analysis settings for this capture
            const settings = analysisSettings[index];
            
            // Create a new sheet for this capture with analysis preferences
            const newSheet = {
              id: `sheet-${Date.now()}-${index}`,
              name: item.name,
              rowCount: 120, // Default row count
              lastModified: 'Just now',
              // Store analysis preferences (synced with CaptureOptionsModal)
              analysisType: settings?.analysisType || null,
              llmProvider: settings?.llmProvider,
              schedule: settings?.schedule
            };
            
            // Add the sheet to the folder
            newSpaces[spaceIndex] = {
              ...space,
              folders: space.folders.map((f, idx) => 
                idx === folderIndex 
                  ? { ...f, sheets: [...f.sheets, newSheet] }
                  : f
              )
            };
          }
        }
      });
      
      return newSpaces;
    });
    
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

  const handleCreateSpace = (name: string) => {
    const spaceId = `space-${Date.now()}`;
    const newSpace: Space = {
      id: spaceId,
      name: name || 'New Space',
      description: '',
      folders: [] // Start with no folders - user will create them or system will auto-create
    };
    setSpaces(prev => [...prev, newSpace]);
    toast.success(`Space \"${name}\" created!`);
  };

  const handleCreateFolder = (spaceId: string, name: string) => {
    setSpaces(prev => prev.map(space => {
      if (space.id === spaceId) {
        return {
          ...space,
          folders: [
            ...space.folders,
            { id: `folder-${Date.now()}`, name: name || 'New Folder', sheets: [] }
          ]
        };
      }
      return space;
    }));
    toast.success(`Folder "${name}" created!`);
  };

  // ⚠️ CRITICAL: Update sheet analysis settings (synced with CaptureOptionsModal)
  const handleUpdateSheetAnalysis = (
    spaceId: string, 
    folderId: string, 
    sheetId: string, 
    settings: {
      analysisType?: 'one-time' | 'scheduled' | 'llm-integration' | 'api' | null;
      llmProvider?: { id: string; name: string };
      schedule?: { frequency: string; time: string };
    }
  ) => {
    setSpaces(prev => prev.map(space => {
      if (space.id === spaceId) {
        return {
          ...space,
          folders: space.folders.map(folder => {
            if (folder.id === folderId) {
              return {
                ...folder,
                sheets: folder.sheets.map(sheet => {
                  if (sheet.id === sheetId) {
                    return {
                      ...sheet,
                      analysisType: settings.analysisType !== undefined ? settings.analysisType : sheet.analysisType,
                      llmProvider: settings.llmProvider !== undefined ? settings.llmProvider : sheet.llmProvider,
                      schedule: settings.schedule !== undefined ? settings.schedule : sheet.schedule
                    };
                  }
                  return sheet;
                })
              };
            }
            return folder;
          })
        };
      }
      return space;
    }));
    toast.success('Analysis settings updated!');
  };

  const handleRenameSpace = (spaceId: string, newName: string) => {
    setSpaces(prev => prev.map(space => {
      if (space.id === spaceId) {
        return {
          ...space,
          name: newName
        };
      }
      return space;
    }));
    toast.success(`Space renamed to "${newName}"!`);
  };

  const handleRenameFolder = (spaceId: string, folderId: string, newName: string) => {
    setSpaces(prev => prev.map(space => {
      if (space.id === spaceId) {
        return {
          ...space,
          folders: space.folders.map(folder => {
            if (folder.id === folderId) {
              return {
                ...folder,
                name: newName
              };
            }
            return folder;
          })
        };
      }
      return space;
    }));
    toast.success(`Folder renamed to \"${newName}\"!`);
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
  const handleCreateBlankSpace = () => {
    const spaceId = `space-${Date.now()}`;
    const newSpace: Space = {
      id: spaceId,
      name: '', // Empty name - will be auto-edited
      description: '',
      folders: []
    };
    setSpaces(prev => [...prev, newSpace]);
    setCurrentSpaceId(spaceId); // Switch to new space
    return spaceId; // Return ID for component to trigger edit mode
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

  const handleAssignCaptures = (captureIds: string[], settings: {
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
    
    // Build destinations and analysis settings for each selected capture
    const destinations = captureIds.map(() => ({
      spaceId: settings.spaceId!,
      folderId: settings.folderId!
    }));
    
    const analysisSettings = captureIds.map(id => ({
      captureId: id,
      analysisType: settings.llmProvider ? 'llm-integration' as const : settings.analysisType || null,
      llmProvider: settings.llmProvider,
      schedule: settings.schedule
    }));
    
    // Add sheets to space folders
    setSpaces(prev => {
      const newSpaces = [...prev];
      
      captureIds.forEach((captureId, index) => {
        const item = captureItems.find(i => i.id === captureId);
        if (!item) return;
        
        const dest = destinations[index];
        const spaceIndex = newSpaces.findIndex(p => p.id === dest.spaceId);
        
        if (spaceIndex !== -1) {
          const space = newSpaces[spaceIndex];
          const folderIndex = space.folders.findIndex(f => f.id === dest.folderId);
          
          if (folderIndex !== -1) {
            const settingsForCapture = analysisSettings[index];
            
            const newSheet = {
              id: `sheet-${Date.now()}-${index}`,
              name: item.name,
              rowCount: 120,
              lastModified: 'Just now',
              analysisType: settingsForCapture?.analysisType || null,
              llmProvider: settingsForCapture?.llmProvider,
              schedule: settingsForCapture?.schedule
            };
            
            newSpaces[spaceIndex] = {
              ...space,
              folders: space.folders.map((f, idx) => 
                idx === folderIndex 
                  ? { ...f, sheets: [...f.sheets, newSheet] }
                  : f
              )
            };
          }
        }
      });
      
      return newSpaces;
    });
    
    // Update captures with their destinations
    setCaptures(prev => prev.map(capture => {
      if (captureIds.includes(capture.id)) {
        const space = spaces.find(p => p.id === settings.spaceId);
        const folder = space?.folders.find(f => f.id === settings.folderId);
        return {
          ...capture,
          folder: folder ? `${space.name} → ${folder.name}` : capture.folder
        };
      }
      return capture;
    }));
    
    toast.success(`${captureIds.length} capture${captureIds.length > 1 ? 's' : ''} assigned successfully!`);
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

  // Handle Space tag updates
  const handleUpdateSpaceTags = (spaceId: string, tags: any[]) => {
    setSpaces(prev => prev.map(s => 
      s.id === spaceId 
        ? { ...s, tags: tags.map(t => ({ ...t, spaceId })) }
        : s
    ));
  };

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
          onCreateSpace={(data) => {
            const spaceId = `space-${Date.now()}`;
            const newSpace: Space = {
              id: spaceId,
              name: data.name,
              description: data.description,
              goals: data.goals,
              instructions: data.instructions,
              folders: [],
              tags: [],
            };
            setSpaces(prev => [...prev, newSpace]);
            toast.success(`Space \"${data.name}\" created!`);
          }}
          onUpdateSpace={(spaceId, data) => {
            setSpaces(prev => prev.map(p => 
              p.id === spaceId 
                ? { ...p, name: data.name, goals: data.goals, instructions: data.instructions }
                : p
            ));
            toast.success(`Space \"${data.name}\" updated!`);
          }}
          onUpdateTags={handleUpdateSpaceTags}
          onDeleteSpace={(spaceId) => {
            setSpaces(prev => prev.filter(p => p.id !== spaceId));
            toast.success('Space deleted!');
          }}
          onUpdateFolder={(spaceId, folderId, name) => {
            setSpaces(prev => prev.map(p => 
              p.id === spaceId
                ? { ...p, folders: p.folders.map(f => f.id === folderId ? { ...f, name } : f) }
                : p
            ));
            toast.success(`Folder renamed to \"${name}\"!`);
          }}
          onDeleteFolder={(spaceId, folderId) => {
            setSpaces(prev => prev.map(p => 
              p.id === spaceId
                ? { ...p, folders: p.folders.filter(f => f.id !== folderId) }
                : p
            ));
            toast.success('Folder deleted!');
          }}
          onCreateFolder={handleCreateFolder}
          onUpdateSheetAnalysis={handleUpdateSheetAnalysis}
          onTopLevelViewChange={handleViewChange}
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
    // Insights now opens within DataManagementView, so redirect to data view
    return (
      <DataManagementView 
        onBackToCapture={() => setCurrentView('capture')} 
        onAddDataCapture={handleAddDataCapture}
        spaces={spaces}
        currentSpaceId={currentSpaceId}
        onSpaceChange={handleSpaceChange}
        onCreateBlankSpace={handleCreateBlankSpace}
        onCreateSpace={(data) => {
          const spaceId = `space-${Date.now()}`;
          const newSpace: Space = {
            id: spaceId,
            name: data.name,
            description: data.description,
            goals: data.goals,
            instructions: data.instructions,
            folders: []
          };
          setSpaces(prev => [...prev, newSpace]);
          toast.success(`Space \"${data.name}\" created!`);
        }}
        onUpdateSpace={(spaceId, data) => {
          setSpaces(prev => prev.map(p => 
            p.id === spaceId 
              ? { ...p, name: data.name, goals: data.goals, instructions: data.instructions }
              : p
          ));
          toast.success(`Space \"${data.name}\" updated!`);
        }}
        onDeleteSpace={(spaceId) => {
          setSpaces(prev => prev.filter(p => p.id !== spaceId));
          toast.success('Space deleted!');
        }}
        onUpdateFolder={(spaceId, folderId, name) => {
          setSpaces(prev => prev.map(p => 
            p.id === spaceId
              ? { ...p, folders: p.folders.map(f => f.id === folderId ? { ...f, name } : f) }
              : p
          ));
          toast.success(`Folder renamed to \"${name}\"!`);
        }}
        onDeleteFolder={(spaceId, folderId) => {
          setSpaces(prev => prev.map(p => 
            p.id === spaceId
              ? { ...p, folders: p.folders.filter(f => f.id !== folderId) }
              : p
          ));
          toast.success('Folder deleted!');
        }}
        onCreateFolder={handleCreateFolder}
        onUpdateSheetAnalysis={handleUpdateSheetAnalysis}
        onTopLevelViewChange={handleViewChange}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A]">
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
              spaces={spaces}
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
          onViewDashboard={() => setCurrentView('data')}
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