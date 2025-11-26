/**
 * ============================================================================
 * CRITICAL: PROJECT/FOLDER STATE SYNCHRONIZATION
 * ============================================================================
 * 
 * This component receives project/folder state from App.tsx (the single source of truth).
 * 
 * ⚠️ DO NOT create separate `projects` state in this component!
 * ⚠️ All project/folder modifications must use the handlers passed from App.tsx
 * 
 * This component is part of the THREE-MODULE SYNC SYSTEM:
 * 1. FloatingCaptureToolbar.tsx - "Save To" dropdown
 * 2. CaptureOptionsModal.tsx - "Change Destination" workflow  
 * 3. DataManagementView.tsx (THIS FILE) - "Projects" sidebar view
 * 
 * When making changes here, also check:
 * - App.tsx (main state management)
 * - FloatingCaptureToolbar.tsx (toolbar save destination)
 * - CaptureOptionsModal.tsx (modal change destination)
 * 
 * See App.tsx for the complete synchronization documentation.
 * 
 * 🤖 REPLIT AI REFACTORING NOTE:
 * - Props use `spaces` but should eventually use Space type from SpaceBrowser
 * - Callback props renamed: onCreateSpace, onUpdateSpace, onDeleteSpace
 * - Parameters renamed: spaceId instead of projectId
 * - Internal variables still use "project" for backward compatibility
 * - All onAddDataCapture references need projectId → spaceId
 * 
 * ============================================================================
 */

import React, { useState, useRef } from 'react';
import { ProjectBrowser, Project } from './ProjectBrowser';
import { Spreadsheet } from './Spreadsheet';
import { AIAssistantPanel } from './AIAssistantPanel';
import { ChangeLogsView } from './ChangeLogsView';
import { InsightsView } from './InsightsView';
import { FileNavigationBar } from './FileNavigationBar';
import { DataSourceSidebar, DataSource } from './DataSourceSidebar';
import { AnimatePresence } from 'motion/react';
import { LayoutGrid, Table, Sparkles, Plus, Upload, Link2, ArrowLeft, Brain, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

interface Sheet {
  id: string;
  name: string;
  rowCount: number;
  lastModified: string;
  dataSource?: DataSource;
}

interface FolderType {
  id: string;
  name: string;
  sheets: Sheet[];
}

// Initial mock data
const initialMockProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'Q4 Marketing Analysis',
    description: 'Comprehensive marketing performance data',
    goals: 'Track Q4 marketing performance to optimize CAC and identify highest-performing channels.',
    instructions: '• Revenue data is in USD\n• Compare performance against $50 target CAC\n• Focus on month-over-month trends\n• Prioritize Google Ads and Facebook Ads analysis',
    folders: [
      {
        id: 'folder-1',
        name: 'HubSpot Data',
        sheets: [
          { id: 'sheet-1', name: 'Revenue Metrics', rowCount: 120, lastModified: '2 hours ago' },
          { id: 'sheet-2', name: 'Lead Generation', rowCount: 450, lastModified: '1 day ago' },
          { id: 'sheet-3', name: 'Customer Acquisition', rowCount: 89, lastModified: '3 days ago' },
        ],
      },
      {
        id: 'folder-2',
        name: 'Google Ads Data',
        sheets: [
          { id: 'sheet-4', name: 'Ad Spend', rowCount: 365, lastModified: '5 hours ago' },
          { id: 'sheet-5', name: 'Conversion Rates', rowCount: 180, lastModified: '1 day ago' },
        ],
      },
      {
        id: 'folder-3',
        name: 'Analytics',
        sheets: [
          { id: 'sheet-6', name: 'Website Traffic', rowCount: 730, lastModified: '6 hours ago' },
        ],
      },
    ],
  },
  {
    id: 'proj-2',
    name: 'Sales Performance',
    description: 'Salesforce and sales data tracking',
    folders: [
      {
        id: 'folder-4',
        name: 'Salesforce Captures',
        sheets: [
          { id: 'sheet-7', name: 'Pipeline Data', rowCount: 234, lastModified: '12 hours ago' },
          { id: 'sheet-8', name: 'Closed Deals', rowCount: 67, lastModified: '2 days ago' },
        ],
      },
    ],
  },
];

interface DataManagementViewProps {
  onBackToCapture: () => void;
  onAddDataCapture?: (projectId: string, folderId: string) => void;
  spaces: Project[]; // ⚠️ SYNCED FROM APP.TSX - Renamed from projects
  currentSpaceId?: string | null; // ⚠️ NEW: Current active Space for Space-scoped architecture
  onSpaceChange?: (spaceId: string) => void; // ⚠️ NEW: Handle Space switching
  onCreateBlankSpace?: () => string; // ⚠️ NEW: Create blank Space (returns spaceId)
  onCreateSpace: (data: { name: string; description: string; goals: string; instructions: string }) => void;
  onUpdateSpace: (spaceId: string, data: { name: string; goals: string; instructions: string }) => void;
  onDeleteSpace: (spaceId: string) => void;
  onUpdateTags?: (spaceId: string, tags: any[]) => void; // ⚠️ NEW: Handle Space-level tag updates
  onUpdateFolder: (spaceId: string, folderId: string, name: string) => void;
  onDeleteFolder: (spaceId: string, folderId: string) => void;
  onCreateFolder: (spaceId: string, name: string) => void;
  onUpdateSheetAnalysis: (
    spaceId: string, 
    folderId: string, 
    sheetId: string, 
    settings: {
      analysisType?: 'one-time' | 'scheduled' | 'llm-integration' | 'api' | null;
      llmProvider?: { id: string; name: string };
      schedule?: { frequency: string; time: string };
    }
  ) => void; // ⚠️ SYNCED WITH CaptureOptionsModal analysis settings
  onTopLevelViewChange?: (view: 'capture' | 'data' | 'changelogs' | 'insights') => void; // ⚠️ NEW: Handle top-level view changes
}

export function DataManagementView({ 
  onBackToCapture, 
  onAddDataCapture,
  spaces, // ⚠️ SYNCED FROM APP.TSX - Renamed from projects
  currentSpaceId,
  onSpaceChange,
  onCreateBlankSpace,
  onCreateSpace,
  onUpdateSpace,
  onDeleteSpace,
  onUpdateTags,
  onUpdateFolder,
  onDeleteFolder,
  onCreateFolder,
  onUpdateSheetAnalysis,
  onTopLevelViewChange,
}: DataManagementViewProps) {
  // Use spaces as projects for backward compatibility
  const projects = spaces;
  const onCreateProject = onCreateSpace;
  const onUpdateProject = onUpdateSpace;
  const onDeleteProject = onDeleteSpace;
  
  const [selectedProject, setSelectedProject] = useState<string>(projects[0]?.id || '');
  const [selectedFolder, setSelectedFolder] = useState<string>(() => {
    // Initialize with first folder from current space or first project
    const initSpace = currentSpaceId ? projects.find(p => p.id === currentSpaceId) : projects[0];
    return initSpace?.folders[0]?.id || '';
  });
  const [selectedSheet, setSelectedSheet] = useState<string | null>(() => {
    // Initialize with first sheet from selected folder
    const initSpace = currentSpaceId ? projects.find(p => p.id === currentSpaceId) : projects[0];
    const initFolder = initSpace?.folders[0];
    return initFolder?.sheets[0]?.id || null;
  });
  const [isSpreadsheetHovered, setIsSpreadsheetHovered] = useState(false);
  const [activeView, setActiveView] = useState<'data' | 'ai' | 'changelogs' | 'insights'>('data');
  const scrollRef = useRef<HTMLDivElement>(null);

  // NEW: Data source sidebar state
  const [showSourceDataSidebar, setShowSourceDataSidebar] = useState(false);
  
  // NEW: Sidebar collapse control for Canvas mode
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleSelectSheet = (projectId: string, folderId: string, sheetId: string) => {
    setSelectedProject(projectId);
    setSelectedFolder(folderId);
    setSelectedSheet(sheetId);
    // Automatically show data view when a sheet is selected
    setActiveView('data');
  };

  // ⚠️ REMOVED: handleCreateProject, handleUpdateProject, handleDeleteProject
  // These are now passed as props from App.tsx to ensure sync with toolbar/modal
  
  const handleDeleteProjectLocal = (projectId: string) => {
    onDeleteProject(projectId);
    // If deleted project was selected, switch to first available
    if (selectedProject === projectId && projects.length > 1) {
      const remainingProjects = projects.filter(p => p.id !== projectId);
      if (remainingProjects.length > 0) {
        setSelectedProject(remainingProjects[0].id);
        if (remainingProjects[0].folders.length > 0) {
          setSelectedFolder(remainingProjects[0].folders[0].id);
          if (remainingProjects[0].folders[0].sheets.length > 0) {
            setSelectedSheet(remainingProjects[0].folders[0].sheets[0].id);
          }
        }
      }
    }
  };

  // ⚠️ REMOVED: handleUpdateFolder, handleDeleteFolder, handleCreateFolder
  // These are now passed as props from App.tsx
  
  const handleDeleteFolderLocal = (projectId: string, folderId: string) => {
    onDeleteFolder(projectId, folderId);
    // If deleted folder was selected, clear selection
    if (selectedFolder === folderId) {
      setSelectedFolder('');
      setSelectedSheet(null);
    }
  };

  const currentProject = projects.find(p => p.id === selectedProject);

  // Get current space for FileNavigationBar
  const currentSpace = currentSpaceId ? projects.find(p => p.id === currentSpaceId) : projects[0];
  
  // Get current folder for passing sheets to Spreadsheet
  const currentFolder = currentSpace?.folders.find(f => f.id === selectedFolder);

  // Get current sheet with dataSource (must be AFTER currentFolder is defined)
  const currentSheet = currentFolder?.sheets.find(s => s.id === selectedSheet);

  // Handle view changes - all views now open locally (data, ai, changelogs, insights)
  const handleViewChange = (view: 'data' | 'ai' | 'changelogs' | 'insights') => {
    setActiveView(view);
  };

  return (
    <div className="h-screen bg-[#0A0E1A] flex flex-col">
      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Project Browser (simplified - no folders shown) */}
        <ProjectBrowser
          projects={projects}
          currentSpaceId={currentSpaceId}
          onSpaceChange={onSpaceChange}
          onCreateBlankSpace={onCreateBlankSpace}
          selectedSheet={selectedSheet}
          onSelectSheet={handleSelectSheet}
          onCreateProject={onCreateProject}
          onUpdateProject={onUpdateProject}
          onDeleteProject={handleDeleteProjectLocal}
          onUpdateFolder={onUpdateFolder}
          onDeleteFolder={handleDeleteFolderLocal}
          onCreateFolder={onCreateFolder}
          onAddDataCapture={onAddDataCapture}
          onUpdateSheetAnalysis={onUpdateSheetAnalysis}
          activeView={activeView}
          onViewChange={handleViewChange}
          onBackToCapture={onBackToCapture}
          externalCollapseControl={sidebarCollapsed}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeView === 'data' ? (
            <>
              {/* File Navigation Bar - Shows folder dropdown and file tabs */}
              {currentSpace && selectedFolder && (
                <FileNavigationBar
                  space={currentSpace}
                  currentFolderId={selectedFolder}
                  currentSheetId={selectedSheet}
                  onFolderChange={(folderId) => {
                    setSelectedFolder(folderId);
                    // Auto-select first sheet in new folder
                    const folder = currentSpace.folders.find(f => f.id === folderId);
                    if (folder && folder.sheets.length > 0) {
                      setSelectedSheet(folder.sheets[0].id);
                    } else {
                      setSelectedSheet(null);
                    }
                  }}
                  onSheetChange={setSelectedSheet}
                  onAddDataCapture={onAddDataCapture}
                  onAddFolder={(spaceId) => {
                    const folderName = prompt('Enter folder name:');
                    if (folderName) {
                      onCreateFolder(spaceId, folderName);
                    }
                  }}
                  onRenameFolder={onUpdateFolder}
                  onDeleteFolder={(spaceId, folderId) => {
                    onDeleteFolder(spaceId, folderId);
                    // If deleted folder was selected, switch to first folder
                    if (folderId === selectedFolder) {
                      const remainingFolders = currentSpace.folders.filter(f => f.id !== folderId);
                      if (remainingFolders.length > 0) {
                        setSelectedFolder(remainingFolders[0].id);
                        if (remainingFolders[0].sheets.length > 0) {
                          setSelectedSheet(remainingFolders[0].sheets[0].id);
                        }
                      }
                    }
                  }}
                  onUpdateSheetAnalysis={onUpdateSheetAnalysis}
                  showSourceData={showSourceDataSidebar}
                  onToggleSourceData={() => setShowSourceDataSidebar(!showSourceDataSidebar)}
                />
              )}
              
              {/* Spreadsheet View */}
              <div className="flex-1 overflow-hidden">
                <Spreadsheet
                  onHover={setIsSpreadsheetHovered}
                  demoSelection={null}
                  scrollRef={scrollRef}
                  sheets={currentFolder?.sheets || []}
                  currentSheetId={selectedSheet}
                  onSheetChange={setSelectedSheet}
                  onAddDataCapture={onAddDataCapture}
                  spaceId={currentSpaceId}
                  folderId={selectedFolder}
                />
              </div>
            </>
          ) : activeView === 'ai' ? (
            /* AI Assistant View */
            <AIAssistantPanel 
              projectName={currentProject?.name}
              spaceId={currentSpaceId}
            />
          ) : activeView === 'insights' ? (
            /* Insights View */
            <InsightsView 
              spaces={projects}
              currentSpaceId={currentSpaceId}
              onUpdateTags={onUpdateTags}
              onCollapseSidebar={(collapsed) => setSidebarCollapsed(collapsed)}
            />
          ) : (
            /* Change Logs View */
            <ChangeLogsView 
              spaces={projects}
              currentSpaceId={currentSpaceId}
              onUpdateTags={onUpdateTags}
              onCaptureNewAsset={onBackToCapture}
            />
          )}
        </div>

        {/* Data Source Sidebar */}
        <AnimatePresence>
          {showSourceDataSidebar && activeView === 'data' && (
            <DataSourceSidebar
              isOpen={showSourceDataSidebar}
              dataSource={currentSheet?.dataSource || null}
              onClose={() => setShowSourceDataSidebar(false)}
              onNameChange={(newName) => {
                // TODO: Update sheet name in App.tsx state
                toast.success(`Renamed to "${newName}"`);
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}