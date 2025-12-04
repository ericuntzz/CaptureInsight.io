import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Image,
  FileText,
  Link2,
  Copy,
  Plus,
  MessageSquare,
  Database,
  Trash2,
  X,
  Presentation,
  GripVertical,
  Undo2,
  Redo2,
  Cloud,
  Check,
  Loader2,
  Sparkles,
  Wand2,
  TextQuote,
  Minimize2,
  Maximize2,
  ShieldCheck,
  Eraser,
  FileDigit,
  FilePlus2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useChat, type QuickActionType, type AIEditProposal, type CanvasContext } from '../hooks/useChat';
import { useInsights, useInsight, useCreateInsight, useUpdateInsight, useDeleteInsight } from '../hooks/useInsights';
import { 
  useChatConversations, 
  useCreateChatConversation, 
  useUpdateChatConversation, 
  useDeleteChatConversation,
} from '../hooks/useChatConversations';
import { useWorkspaceSheets, useUpdateSheetCleanedData, useRetrySheetProcessing, type Sheet } from '../hooks/useSheets';
import { useUpdateSheet, useDeleteSheet } from '../hooks/useSpaces';
import { useTemplateEditor } from '../contexts/TemplateEditorContext';
import { RichTextEditor, type RichTextEditorRef, type SelectionInfo } from '../components/RichTextEditor';
import { copyToClipboard } from '../utils/clipboard';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '../components/ui/resizable';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../components/ui/tooltip';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TypewriterText } from '../components/TypewriterText';
import { GlowingDot } from '../components/GlowingDot';

// Draggable collapsed panel content for canvas and data - must be outside component to use hooks
function DraggableCollapsedPanel({ 
  type, 
  onClick, 
  direction 
}: { 
  type: 'canvas' | 'data'; 
  onClick: () => void;
  direction: 'left' | 'right';
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id: type });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };
  
  // Canvas uses #212121 to match expanded state, Data uses #1E1E1E
  const bgColor = type === 'canvas' ? 'bg-[#212121]' : 'bg-[#1E1E1E]';
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`flex flex-col items-center justify-between py-4 h-full w-full ${bgColor} hover:bg-[#252525] transition-colors cursor-grab active:cursor-grabbing`}
      title={`${type === 'canvas' ? 'Expand Canvas' : 'Expand Data Sources'} (drag to reorder)`}
      aria-label={type === 'canvas' ? 'Expand Canvas' : 'Expand Data Sources'}
    >
      {type === 'canvas' ? (
        <FileText className="w-5 h-5 text-[#6B7280]" />
      ) : (
        <Database className="w-5 h-5 text-[#6B7280]" />
      )}
      <div className="flex-1 flex items-center justify-center">
        <GripVertical className="w-4 h-4 text-[#4B5563] opacity-50" />
      </div>
      {direction === 'left' ? (
        <ChevronRight className="w-4 h-4 text-[#6B7280]" />
      ) : (
        <ChevronLeft className="w-4 h-4 text-[#6B7280]" />
      )}
    </div>
  );
}

// Non-draggable collapsed panel content for chat (always stays on left)
function CollapsedChatPanel({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-between py-4 h-full w-full bg-[#1A1A1A] hover:bg-[#252525] transition-colors cursor-pointer"
      title="Expand Chat"
      aria-label="Expand Chat"
    >
      <MessageSquare className="w-5 h-5 text-[#6B7280]" />
      <div className="flex-1" />
      <ChevronRight className="w-4 h-4 text-[#6B7280]" />
    </button>
  );
}

// Helper functions for opacity calculation (must be outside component)
const getContentOpacity = (size: number) => {
  if (size <= 4) return 0;
  if (size >= 10) return 1;
  return (size - 4) / 6;
};

const getCollapsedOpacity = (size: number) => {
  if (size <= 4) return 1;
  if (size >= 10) return 0;
  return 1 - (size - 4) / 6;
};

// PanelContentWrapper - MUST be outside the main component to prevent remounting on re-render
function PanelContentWrapper({ 
  size, 
  collapsedContent, 
  expandedContent 
}: { 
  size: number; 
  collapsedContent: React.ReactNode; 
  expandedContent: React.ReactNode;
}) {
  const contentOpacity = getContentOpacity(size);
  const collapsedOpacity = getCollapsedOpacity(size);
  
  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Collapsed content - fades out as panel grows */}
      <div 
        className="absolute inset-0 z-10"
        style={{ 
          opacity: collapsedOpacity,
          pointerEvents: collapsedOpacity > 0.5 ? 'auto' : 'none',
          transition: 'opacity 100ms ease-out'
        }}
      >
        {collapsedContent}
      </div>
      {/* Expanded content - fades in as panel grows */}
      <div 
        className="absolute inset-0 z-0"
        style={{ 
          opacity: contentOpacity,
          pointerEvents: contentOpacity > 0.5 ? 'auto' : 'none',
          transition: 'opacity 100ms ease-out'
        }}
      >
        {expandedContent}
      </div>
    </div>
  );
}

interface InsightSource {
  id: string;
  sourceType: 'screenshot' | 'link' | 'file' | 'chat' | 'datasheet';
  sourceId: string;
  sourceName: string;
  sourceUrl?: string;
}

interface InsightTab {
  id: string;
  title: string;
  summary: string;
  isSaved?: boolean; // Track if this insight has been saved to database
  dbId?: string; // The database ID if saved
}

interface InsightWorkspaceProps {
  onBack: () => void;
  spaceId: string | null;
  insightId?: string | null;
  onSidebarCollapse?: (collapsed: boolean) => void;
  workspaceId?: string | null;
}

const getStorageKey = (baseKey: string, workspaceId?: string | null) => {
  if (workspaceId) {
    return `${baseKey}-${workspaceId}`;
  }
  return baseKey;
};

export function InsightWorkspace({ onBack, spaceId, insightId, onSidebarCollapse, workspaceId }: InsightWorkspaceProps) {
  const { aiLearningConsent } = useAuth();
  const { openEditor: openTemplateEditor } = useTemplateEditor();
  
  // Panel refs for imperative control
  const chatPanelRef = useRef<ImperativePanelHandle>(null);
  const canvasPanelRef = useRef<ImperativePanelHandle>(null);
  const dataPanelRef = useRef<ImperativePanelHandle>(null);
  
  // Live panel sizes for continuous opacity calculation (0-100)
  const [chatSize, setChatSize] = useState(30);
  const [canvasSize, setCanvasSize] = useState(45);
  const [dataSize, setDataSize] = useState(25);
  
  // Derived collapsed states (for logic, not rendering)
  const isCanvasCollapsed = canvasSize < 8;
  const isDataCollapsed = dataSize < 8;
  
  // Track if chat was manually collapsed by user
  const [chatManuallyCollapsed, setChatManuallyCollapsed] = useState(false);
  
  // Right panels order - Chat is always fixed on left, only Canvas and Data can swap
  // 'canvas-data' = Chat | Canvas | Data (default)
  // 'data-canvas' = Chat | Data | Canvas
  type RightPanelOrder = 'canvas-data' | 'data-canvas';
  const panelOrderStorageKey = getStorageKey('insight-workspace-panel-order', workspaceId);
  
  const getInitialPanelOrder = (): RightPanelOrder => {
    try {
      const saved = localStorage.getItem(panelOrderStorageKey);
      if (saved === 'canvas-data' || saved === 'data-canvas') {
        return saved;
      }
    } catch (e) {
      console.error('Failed to load panel order from localStorage:', e);
    }
    return 'canvas-data';
  };
  
  const [rightPanelOrder, setRightPanelOrder] = useState<RightPanelOrder>(getInitialPanelOrder);
  const [activeDragId, setActiveDragId] = useState<'canvas' | 'data' | null>(null);
  
  // Save panel order to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(panelOrderStorageKey, rightPanelOrder);
    } catch (e) {
      console.error('Failed to save panel order to localStorage:', e);
    }
  }, [rightPanelOrder, panelOrderStorageKey]);
  
  // DnD sensors - only for canvas and data panels
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance before activating
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    if (id === 'canvas' || id === 'data') {
      setActiveDragId(id);
    }
  };
  
  // Handle drag end - swap canvas and data positions
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    
    if (over && active.id !== over.id) {
      // Only allow swapping canvas and data
      const activeId = active.id as string;
      const overId = over.id as string;
      if ((activeId === 'canvas' || activeId === 'data') && 
          (overId === 'canvas' || overId === 'data')) {
        // Toggle the order
        setRightPanelOrder(prev => prev === 'canvas-data' ? 'data-canvas' : 'canvas-data');
      }
    }
  };
  
  // Insight tabs state
  const [openTabs, setOpenTabs] = useState<InsightTab[]>([
    { id: 'default', title: 'Untitled Insight', summary: '', isSaved: false }
  ]);
  const activeTabStorageKey = getStorageKey('insight-workspace-active-tab', workspaceId);
  const getInitialActiveTabId = (): string => {
    try {
      const saved = localStorage.getItem(activeTabStorageKey);
      if (saved) return saved;
    } catch (e) {
      console.error('Failed to load active tab from localStorage:', e);
    }
    return 'default';
  };
  const [activeTabId, setActiveTabId] = useState(getInitialActiveTabId);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabTitle, setEditingTabTitle] = useState('');
  const insightTabInputRef = useRef<HTMLInputElement>(null);
  
  // Save active tab to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(activeTabStorageKey, activeTabId);
    } catch (e) {
      console.error('Failed to save active tab to localStorage:', e);
    }
  }, [activeTabId, activeTabStorageKey]);
  
  // Canvas state
  const [viewMode, setViewMode] = useState<'default' | 'slide'>('default');
  const [notes, setNotes] = useState('');
  const [localTitle, setLocalTitle] = useState('Untitled Insight');
  const [canvasSelection, setCanvasSelection] = useState<SelectionInfo | null>(null);
  const editorRef = useRef<RichTextEditorRef>(null);
  
  // Track pending saves for debouncing
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<{ title: string; summary: string }>({ title: '', summary: '' });
  
  // Data sources state
  const [sources, setSources] = useState<InsightSource[]>([]);
  const [sheetsData, setSheetsData] = useState<Record<string, any>>({});
  
  // Chat state
  const [aiChatInput, setAiChatInput] = useState('');
  const aiChatContainerRef = useRef<HTMLDivElement>(null);
  
  // Simple animation trigger: detect when AI finishes responding
  const wasTypingRef = useRef(false);
  const [animatingMessageId, setAnimatingMessageId] = useState<string | null>(null);
  
  // Chat tabs state
  const activeChatStorageKey = getStorageKey('insight-workspace-active-chat', workspaceId);
  const getInitialActiveChatId = (): string | null => {
    try {
      const saved = localStorage.getItem(activeChatStorageKey);
      if (saved) return saved;
    } catch (e) {
      console.error('Failed to load active chat from localStorage:', e);
    }
    return null;
  };
  const [activeChatId, setActiveChatId] = useState<string | null>(getInitialActiveChatId);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState('');
  const chatTabInputRef = useRef<HTMLInputElement>(null);
  
  // Save active chat to localStorage when it changes
  useEffect(() => {
    if (activeChatId) {
      try {
        localStorage.setItem(activeChatStorageKey, activeChatId);
      } catch (e) {
        console.error('Failed to save active chat to localStorage:', e);
      }
    }
  }, [activeChatId, activeChatStorageKey]);
  
  // Fetch chat conversations for this space and workspace
  const { data: chatConversations = [], isLoading: isLoadingChats } = useChatConversations(spaceId, workspaceId ?? null);
  const createChatMutation = useCreateChatConversation();
  const updateChatMutation = useUpdateChatConversation();
  const deleteChatMutation = useDeleteChatConversation();
  
  // Fetch sheets (captures) for this workspace
  const { data: workspaceSheets = [] } = useWorkspaceSheets(spaceId, workspaceId ?? null);
  
  // Fetch insights for current workspace
  const { data: workspaceInsights = [], isLoading: isLoadingInsights } = useInsights(spaceId, workspaceId ?? null);
  
  // Track the last known insight IDs to detect changes (additions/deletions)
  const lastInsightIdsRef = useRef<string>('');
  const lastWorkspaceIdRef = useRef<string | null>(null);
  
  // Reset state when workspace changes
  useEffect(() => {
    // Clear workspace-specific state
    setActiveChatId(null);
    setSources([]);
    setSheetsData({});
    
    // Reset tabs to loading state - will be populated by sync effect
    setOpenTabs([{ id: 'loading', title: 'Loading...', summary: '', isSaved: false }]);
    setActiveTabId('loading');
    setLocalTitle('Loading...');
    setNotes('');
    lastSavedContentRef.current = { title: '', summary: '' };
    lastInsightIdsRef.current = '';
    // Note: Do NOT update lastWorkspaceIdRef here - let the sync effect detect the change
  }, [workspaceId]);
  
  // Sync tabs with API data - MERGES insights instead of replacing to prevent data loss
  useEffect(() => {
    if (isLoadingInsights) return;
    
    // Create a signature of current insight IDs to detect changes
    const currentInsightIds = workspaceInsights.map(i => i.id).sort().join(',');
    const workspaceChanged = lastWorkspaceIdRef.current !== workspaceId;
    
    // On workspace change, do a full reset
    if (workspaceChanged) {
      lastWorkspaceIdRef.current = workspaceId ?? null;
      lastInsightIdsRef.current = currentInsightIds;
      
      if (workspaceInsights.length > 0) {
        const insightTabs = workspaceInsights.map(insight => ({
          id: insight.id,
          title: insight.title,
          summary: insight.summary || '',
          isSaved: true,
          dbId: insight.id,
        }));
        setOpenTabs(insightTabs);
        setActiveTabId(insightTabs[0].id);
        setLocalTitle(insightTabs[0].title);
        setNotes(insightTabs[0].summary);
        lastSavedContentRef.current = { title: insightTabs[0].title, summary: insightTabs[0].summary };
      } else {
        setOpenTabs([{ id: 'new', title: 'Untitled Insight', summary: '', isSaved: false }]);
        setActiveTabId('new');
        setLocalTitle('Untitled Insight');
        setNotes('');
        lastSavedContentRef.current = { title: '', summary: '' };
      }
      return;
    }
    
    // For same workspace, MERGE instead of replace to prevent losing tabs during refetch
    const insightsChanged = lastInsightIdsRef.current !== currentInsightIds;
    if (!insightsChanged) return;
    
    // Build a map of DB insights for quick lookup
    const dbInsightMap = new Map(workspaceInsights.map(i => [i.id, i]));
    
    // Get IDs of insights that exist in DB
    const dbInsightIds = new Set(workspaceInsights.map(i => i.id));
    
    // Get previous insight IDs to detect deletions
    const previousIds = new Set(lastInsightIdsRef.current.split(',').filter(Boolean));
    
    // Update the ref AFTER we've used it for comparison
    lastInsightIdsRef.current = currentInsightIds;
    
    setOpenTabs(currentTabs => {
      // Start with existing tabs that are still valid (exist in DB or are unsaved)
      const mergedTabs: InsightTab[] = [];
      const seenIds = new Set<string>();
      
      // First, keep existing tabs that are still in DB or are unsaved local tabs
      for (const tab of currentTabs) {
        if (tab.dbId && dbInsightIds.has(tab.dbId)) {
          // Tab exists in DB - update with latest data
          const dbInsight = dbInsightMap.get(tab.dbId)!;
          mergedTabs.push({
            ...tab,
            id: dbInsight.id,
            title: dbInsight.title,
            summary: dbInsight.summary || '',
            isSaved: true,
            dbId: dbInsight.id,
          });
          seenIds.add(dbInsight.id);
        } else if (!tab.isSaved && !tab.dbId) {
          // Unsaved local tab - keep it
          mergedTabs.push(tab);
          seenIds.add(tab.id);
        }
        // Tabs with dbId that no longer exist in DB are dropped (deleted)
      }
      
      // Add any NEW insights from DB that we don't have yet
      for (const insight of workspaceInsights) {
        if (!seenIds.has(insight.id)) {
          mergedTabs.push({
            id: insight.id,
            title: insight.title,
            summary: insight.summary || '',
            isSaved: true,
            dbId: insight.id,
          });
        }
      }
      
      // If no tabs left, create a new empty one
      if (mergedTabs.length === 0) {
        return [{ id: 'new', title: 'Untitled Insight', summary: '', isSaved: false }];
      }
      
      return mergedTabs;
    });
    
    // Check if active tab was deleted and switch if needed
    const activeTabDeleted = previousIds.has(activeTabId) && !dbInsightIds.has(activeTabId);
    if (activeTabDeleted && workspaceInsights.length > 0) {
      const firstInsight = workspaceInsights[0];
      setActiveTabId(firstInsight.id);
      setLocalTitle(firstInsight.title);
      setNotes(firstInsight.summary || '');
      lastSavedContentRef.current = { title: firstInsight.title, summary: firstInsight.summary || '' };
    } else if (workspaceInsights.length === 0 && activeTabId !== 'new') {
      setActiveTabId('new');
      setLocalTitle('Untitled Insight');
      setNotes('');
      lastSavedContentRef.current = { title: '', summary: '' };
    }
  }, [workspaceInsights, isLoadingInsights, workspaceId, activeTabId]);
  
  // Ensure there's always an active chat - create one if none exist
  useEffect(() => {
    if (!isLoadingChats && spaceId && chatConversations.length === 0 && !createChatMutation.isPending) {
      createChatMutation.mutate({ spaceId, title: 'New Chat', workspaceId: workspaceId ?? undefined }, {
        onSuccess: (newChat) => {
          setActiveChatId(newChat.id);
        }
      });
    } else if (!isLoadingChats && chatConversations.length > 0 && !activeChatId) {
      // Check if saved chat still exists, otherwise use first available
      const savedChatId = getInitialActiveChatId();
      const savedChatExists = savedChatId && chatConversations.some(c => c.id === savedChatId);
      setActiveChatId(savedChatExists ? savedChatId : chatConversations[0].id);
    }
  }, [isLoadingChats, spaceId, chatConversations.length, activeChatId, workspaceId]);
  
  const activeInsightId = insightId || activeTabId;
  
  const { 
    messages: chatMessages, 
    sendMessage, 
    sendCanvasAction,
    isLoading: isAiTyping, 
    isLoadingHistory, 
    historyLoadError, 
    retryLoadHistory,
    pendingEditProposal,
    clearPendingEditProposal,
  } = useChat({
    spaceId,
    insightId: activeInsightId,
    chatId: activeChatId,
  });
  
  const { data: insight } = useInsight(insightId || null);
  
  // Mutation hooks for database persistence
  const createInsightMutation = useCreateInsight();
  const updateInsightMutation = useUpdateInsight();
  const deleteInsightMutation = useDeleteInsight();
  
  // Track the current tab's saved state using a ref (to avoid re-renders)
  const currentTabRef = useRef<{ isSaved: boolean; dbId?: string }>({ isSaved: false });
  
  // Update ref when tab changes
  useEffect(() => {
    const activeTab = openTabs.find(t => t.id === activeTabId);
    if (activeTab) {
      currentTabRef.current = { isSaved: activeTab.isSaved || false, dbId: activeTab.dbId };
    }
  }, [activeTabId, openTabs]);
  
  // Auto-save content to database (debounced) - uses refs to avoid re-render loops
  useEffect(() => {
    if (!spaceId) return;
    
    // Don't auto-save loading state or placeholder content
    if (activeTabId === 'loading' || localTitle === 'Loading...') return;
    
    // Don't auto-save if workspace is still being created (temp ID)
    if (workspaceId?.startsWith('temp-')) return;
    
    // Check if content has changed from last saved state
    const hasChanges = 
      localTitle !== lastSavedContentRef.current.title || 
      notes !== lastSavedContentRef.current.summary;
    
    if (!hasChanges) return;
    
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Debounce save by 1 second
    saveTimeoutRef.current = setTimeout(() => {
      const { isSaved, dbId } = currentTabRef.current;
      
      if (isSaved && dbId) {
        // Update existing insight
        updateInsightMutation.mutate({
          id: dbId,
          data: {
            title: localTitle,
            summary: notes,
          }
        }, {
          onSuccess: () => {
            lastSavedContentRef.current = { title: localTitle, summary: notes };
          }
        });
      } else if (!isSaved) {
        // Create new insight in database
        createInsightMutation.mutate({
          spaceId,
          workspaceId: workspaceId || undefined,
          data: {
            title: localTitle || 'Untitled Insight',
            summary: notes,
            status: 'Open',
          }
        }, {
          onSuccess: (newInsight) => {
            // Update the tab with the database ID using ref to prevent re-render
            currentTabRef.current = { isSaved: true, dbId: newInsight.id };
            // Also update the state for persistence
            setOpenTabs(tabs => tabs.map(t => 
              t.id === activeTabId ? { ...t, isSaved: true, dbId: newInsight.id, id: newInsight.id } : t
            ));
            setActiveTabId(newInsight.id);
            lastSavedContentRef.current = { title: localTitle, summary: notes };
            toast.success('Insight saved');
          },
          onError: () => {
            toast.error('Failed to save insight');
          }
        });
      }
    }, 1000);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [localTitle, notes, activeTabId, spaceId, workspaceId]);
  
  // Auto-collapse left sidebar when workspace opens
  useEffect(() => {
    onSidebarCollapse?.(true);
    return () => {
      onSidebarCollapse?.(false);
    };
  }, [onSidebarCollapse]);
  
  // Load insight data and mark as saved (for existing insights from DB)
  useEffect(() => {
    if (insight && insightId) {
      setLocalTitle(insight.title || 'Untitled Insight');
      setNotes(insight.summary || '');
      // Mark the active tab as saved since it's from the database
      setOpenTabs(tabs => tabs.map(t => 
        t.id === activeTabId ? { ...t, isSaved: true, dbId: insightId, title: insight.title || 'Untitled Insight', summary: insight.summary || '' } : t
      ));
      // Update the saved content ref to prevent triggering auto-save for loaded content
      lastSavedContentRef.current = { title: insight.title || 'Untitled Insight', summary: insight.summary || '' };
    }
  }, [insight, insightId, activeTabId]);
  
  // Load sources for insight
  useEffect(() => {
    if (insightId) {
      fetch(`/api/insights/${insightId}/sources`, { credentials: 'include' })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setSources(data);
            data.forEach((source: InsightSource) => {
              if (source.sourceType === 'screenshot' || source.sourceType === 'datasheet') {
                fetch(`/api/sheets/${source.sourceId}`, { credentials: 'include' })
                  .then((res) => res.json())
                  .then((sheetData) => {
                    setSheetsData((prev) => ({ ...prev, [source.sourceId]: sheetData }));
                  })
                  .catch(console.error);
              }
            });
          }
        })
        .catch(console.error);
    }
  }, [insightId]);
  
  // Auto-scroll chat to bottom
  useEffect(() => {
    if (aiChatContainerRef.current) {
      aiChatContainerRef.current.scrollTop = aiChatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);
  
  // Trigger animation when AI finishes responding (isAiTyping goes from true → false)
  useEffect(() => {
    if (wasTypingRef.current && !isAiTyping && chatMessages.length > 0) {
      const lastMessage = chatMessages[chatMessages.length - 1];
      if (lastMessage.role === 'assistant') {
        setAnimatingMessageId(lastMessage.id);
      }
    }
    wasTypingRef.current = isAiTyping;
  }, [isAiTyping, chatMessages]);
  
  // Reset animation on chat switch
  useEffect(() => {
    setAnimatingMessageId(null);
  }, [activeChatId]);
  
  // Clear animation when complete
  const handleAnimationComplete = useCallback(() => {
    setAnimatingMessageId(null);
  }, []);
  
  // Handle panel expand/collapse using imperative panel resize
  const handleExpandChat = useCallback(() => {
    setChatManuallyCollapsed(false);
    chatPanelRef.current?.resize(30);
  }, []);
  
  const handleCollapseChat = useCallback(() => {
    setChatManuallyCollapsed(true);
    chatPanelRef.current?.resize(3);
  }, []);
  
  const handleCollapseData = useCallback(() => {
    dataPanelRef.current?.resize(3);
  }, []);
  
  const handleCollapseCanvas = useCallback(() => {
    canvasPanelRef.current?.resize(3);
  }, []);
  
  // Expand canvas - move canvas next to chat, collapse data
  const handleExpandCanvas = useCallback(() => {
    // If canvas is already large (not collapsed), restore to normal sizes
    if (!isCanvasCollapsed && isDataCollapsed) {
      // Canvas is expanded, restore both to normal sizes
      canvasPanelRef.current?.resize(45);
      dataPanelRef.current?.resize(25);
    } else {
      // Expand canvas fully, collapse data
      // Don't touch chat - respect chatManuallyCollapsed
      canvasPanelRef.current?.resize(chatManuallyCollapsed ? 72 : 67);
      dataPanelRef.current?.resize(3);
    }
    setRightPanelOrder('canvas-data');
  }, [isCanvasCollapsed, isDataCollapsed, chatManuallyCollapsed]);
  
  // Expand data - move data next to chat, collapse canvas
  const handleExpandData = useCallback(() => {
    // If data is already large (not collapsed), restore to normal sizes
    if (!isDataCollapsed && isCanvasCollapsed) {
      // Data is expanded, restore both to normal sizes
      dataPanelRef.current?.resize(25);
      canvasPanelRef.current?.resize(45);
      setRightPanelOrder('canvas-data');
    } else {
      // Expand data fully, collapse canvas, swap order so data is next to chat
      // Don't touch chat - respect chatManuallyCollapsed
      dataPanelRef.current?.resize(chatManuallyCollapsed ? 72 : 67);
      canvasPanelRef.current?.resize(3);
      setRightPanelOrder('data-canvas');
    }
  }, [isCanvasCollapsed, isDataCollapsed, chatManuallyCollapsed]);
  
  // Double-click handlers use the same expand logic
  const handleDoubleClickExpandCanvas = handleExpandCanvas;
  const handleDoubleClickExpandData = handleExpandData;
  
  // Canvas AI handlers
  const getCanvasContext = useCallback((): CanvasContext => {
    const context: CanvasContext = {
      title: localTitle,
      notes: notes,
    };
    
    if (canvasSelection) {
      context.selection = {
        text: canvasSelection.text,
        start: canvasSelection.from,
        end: canvasSelection.to,
      };
    }
    
    return context;
  }, [localTitle, notes, canvasSelection]);

  const handleQuickAction = useCallback((action: QuickActionType) => {
    if (!aiLearningConsent) {
      toast.error('AI features require your consent. You can enable this in Settings.');
      return;
    }
    const canvasContext = getCanvasContext();
    if (!canvasContext.notes.trim() && !canvasContext.title.trim()) {
      toast.error('Please add some content to the canvas first');
      return;
    }
    sendCanvasAction(action, canvasContext);
  }, [getCanvasContext, sendCanvasAction, aiLearningConsent]);

  const handleRefineSelection = useCallback((selection: SelectionInfo) => {
    if (!aiLearningConsent) {
      toast.error('AI features require your consent. You can enable this in Settings.');
      return;
    }
    if (!selection.text.trim()) {
      toast.error('Please select some text to refine');
      return;
    }
    
    const context: CanvasContext = {
      title: localTitle,
      notes: notes,
      selection: {
        text: selection.text,
        start: selection.from,
        end: selection.to,
      },
    };
    
    sendCanvasAction('polish', context);
  }, [localTitle, notes, sendCanvasAction, aiLearningConsent]);

  const handleApplyEditProposal = useCallback((proposal: AIEditProposal) => {
    const suggestedText = proposal.suggestedText;
    
    if (!suggestedText || !suggestedText.trim()) {
      toast.error('Cannot apply empty edit suggestion');
      clearPendingEditProposal();
      return;
    }
    
    const lowerText = suggestedText.toLowerCase().trim();
    const explanatoryPatterns = [
      /^here['']?s\s/,
      /^i['']?ve\s/,
      /^i have\s/,
      /^i can\s/,
      /^let me\s/,
      /^sure[,!]\s/,
      /^certainly[,!]?\s/,
      /^of course[,!]?\s/,
      /^i['']?ll\s/,
      /^the following\s/,
      /^below is\s/,
      /^as requested[,:]?\s/,
    ];
    
    for (const pattern of explanatoryPatterns) {
      if (pattern.test(lowerText)) {
        toast.error('This suggestion appears to be explanatory text, not content. Please review manually.');
        clearPendingEditProposal();
        return;
      }
    }
    
    if (proposal.targetType === 'title') {
      setLocalTitle(suggestedText);
    } else if (proposal.targetType === 'selection' && editorRef.current) {
      const selectionRange = proposal.originalSelection || 
        (canvasSelection ? { from: canvasSelection.from, to: canvasSelection.to } : null);
      
      if (selectionRange) {
        editorRef.current.replaceSelection(selectionRange.from, selectionRange.to, suggestedText);
        setCanvasSelection(null);
      } else {
        toast.error('Selection range not found. Please select text and try again.');
        clearPendingEditProposal();
        return;
      }
    } else if (proposal.targetType === 'notes') {
      setNotes(suggestedText);
    }
    clearPendingEditProposal();
    toast.success('Edit applied successfully');
  }, [clearPendingEditProposal, canvasSelection]);

  const handleRejectEditProposal = useCallback(() => {
    clearPendingEditProposal();
    toast('Edit proposal dismissed');
  }, [clearPendingEditProposal]);

  // Chat handlers
  const handleSendMessage = async () => {
    if (!aiChatInput.trim()) return;
    const messageContent = aiChatInput.trim();
    setAiChatInput('');
    
    // Include canvas context with the chat message so AI can reference it
    const canvasContext = getCanvasContext();
    
    // Auto-generate title from first message if chat title is "New Chat"
    const currentChat = chatConversations.find(c => c.id === activeChatId);
    if (currentChat && currentChat.title === 'New Chat' && chatMessages.length === 0) {
      // Use AI to generate a short summary title
      fetch('/api/ai/generate-chat-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: messageContent }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.title) {
            updateChatMutation.mutate({ chatId: currentChat.id, data: { title: data.title } });
          }
        })
        .catch(() => {
          // Fallback to simple truncation if AI fails
          const fallbackTitle = messageContent.slice(0, 25) + (messageContent.length > 25 ? '...' : '');
          updateChatMutation.mutate({ chatId: currentChat.id, data: { title: fallbackTitle } });
        });
    }
    
    // Pass canvas context so AI can reference the current document
    await sendMessage(messageContent, canvasContext.notes.trim() || canvasContext.title.trim() ? canvasContext : undefined);
  };
  
  const handleCopyMessage = (content: string) => {
    copyToClipboard(content);
    toast.success('Message copied!');
  };
  
  // Chat tab handlers
  const handleCreateNewChat = () => {
    if (!spaceId) return;
    createChatMutation.mutate({ spaceId, title: 'New Chat', workspaceId: workspaceId ?? undefined }, {
      onSuccess: (newChat) => {
        setActiveChatId(newChat.id);
      }
    });
  };
  
  const handleSwitchChat = (chatId: string) => {
    if (chatId !== activeChatId) {
      setActiveChatId(chatId);
    }
  };
  
  const handleDeleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!spaceId) return;
    
    // If deleting active chat, switch to another one first
    if (chatId === activeChatId) {
      const otherChat = chatConversations.find(c => c.id !== chatId);
      if (otherChat) {
        setActiveChatId(otherChat.id);
      }
    }
    
    deleteChatMutation.mutate({ chatId, spaceId });
  };
  
  const handleStartRenameChat = (chatId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(chatId);
    setEditingChatTitle(currentTitle);
    setTimeout(() => {
      chatTabInputRef.current?.focus();
      chatTabInputRef.current?.select();
    }, 0);
  };
  
  const handleDoubleClickChat = (chatId: string, currentTitle: string) => {
    setEditingChatId(chatId);
    setEditingChatTitle(currentTitle);
    setTimeout(() => {
      chatTabInputRef.current?.focus();
      chatTabInputRef.current?.select();
    }, 0);
  };
  
  const handleSaveRenameChat = () => {
    if (editingChatId && editingChatTitle.trim()) {
      updateChatMutation.mutate({ 
        chatId: editingChatId, 
        data: { title: editingChatTitle.trim() } 
      });
    }
    setEditingChatId(null);
    setEditingChatTitle('');
  };
  
  const handleCancelRenameChat = () => {
    setEditingChatId(null);
    setEditingChatTitle('');
  };
  
  // Insight tab rename handlers
  const handleDoubleClickTab = (tabId: string, currentTitle: string) => {
    setEditingTabId(tabId);
    setEditingTabTitle(currentTitle);
    setTimeout(() => {
      insightTabInputRef.current?.focus();
      insightTabInputRef.current?.select();
    }, 0);
  };
  
  const handleSaveRenameTab = () => {
    if (editingTabId && editingTabTitle.trim()) {
      const newTitle = editingTabTitle.trim();
      // Update local tab state
      setOpenTabs(tabs => tabs.map(t => 
        t.id === editingTabId ? { ...t, title: newTitle } : t
      ));
      // Update localTitle if this is the active tab
      if (editingTabId === activeTabId) {
        setLocalTitle(newTitle);
      }
      // If the tab has a dbId, also update in database
      const tab = openTabs.find(t => t.id === editingTabId);
      if (tab?.dbId) {
        updateInsightMutation.mutate({ id: tab.dbId, data: { title: newTitle } });
      }
    }
    setEditingTabId(null);
    setEditingTabTitle('');
  };
  
  const handleCancelRenameTab = () => {
    setEditingTabId(null);
    setEditingTabTitle('');
  };
  
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };
  
  // Tab handlers - save current content to tab before switching
  const handleCreateNewInsight = () => {
    // Save current content to current tab before creating new one
    setOpenTabs(tabs => tabs.map(t => 
      t.id === activeTabId ? { ...t, title: localTitle, summary: notes } : t
    ));
    
    const newTab: InsightTab = {
      id: `insight-${Date.now()}`,
      title: 'Untitled Insight',
      summary: '',
      isSaved: false,
    };
    setOpenTabs(prev => [...prev.map(t => 
      t.id === activeTabId ? { ...t, title: localTitle, summary: notes } : t
    ), newTab]);
    setActiveTabId(newTab.id);
    setLocalTitle(newTab.title);
    setNotes('');
    // Reset the saved content tracker for the new tab
    lastSavedContentRef.current = { title: newTab.title, summary: '' };
    currentTabRef.current = { isSaved: false };
  };
  
  const handleCloseTab = (tabId: string) => {
    if (openTabs.length <= 1) return;
    
    // Find the tab being closed to check if it's saved in DB
    const tabToClose = openTabs.find(t => t.id === tabId);
    
    // If this tab is saved in the database, delete it from the database
    if (tabToClose?.isSaved && tabToClose?.dbId) {
      if (!spaceId) {
        console.error('Cannot delete insight: spaceId is missing');
        toast.error('Cannot delete insight - please refresh the page');
        return; // Don't remove from UI if we can't delete from DB
      }
      
      deleteInsightMutation.mutate(
        { id: tabToClose.dbId, spaceId },
        {
          onSuccess: () => {
            toast.success('Insight deleted');
          },
          onError: (error) => {
            console.error('Failed to delete insight:', error);
            toast.error('Failed to delete insight');
          }
        }
      );
    }
    
    // Save current content before closing
    const updatedTabs = openTabs.map(t => 
      t.id === activeTabId ? { ...t, title: localTitle, summary: notes } : t
    );
    const newTabs = updatedTabs.filter(t => t.id !== tabId);
    setOpenTabs(newTabs);
    
    if (activeTabId === tabId) {
      const newActiveTab = newTabs[newTabs.length - 1];
      setActiveTabId(newActiveTab.id);
      setLocalTitle(newActiveTab.title);
      setNotes(newActiveTab.summary);
      lastSavedContentRef.current = { title: newActiveTab.title, summary: newActiveTab.summary };
      currentTabRef.current = { isSaved: newActiveTab.isSaved || false, dbId: newActiveTab.dbId };
    }
  };
  
  const handleSwitchTab = (tabId: string) => {
    if (tabId === activeTabId) return; // Already on this tab
    
    const targetTab = openTabs.find(t => t.id === tabId);
    if (targetTab) {
      // Save current content to current tab before switching
      setOpenTabs(tabs => tabs.map(t => 
        t.id === activeTabId ? { ...t, title: localTitle, summary: notes } : t
      ));
      
      setActiveTabId(tabId);
      setLocalTitle(targetTab.title);
      setNotes(targetTab.summary);
      lastSavedContentRef.current = { title: targetTab.title, summary: targetTab.summary };
      currentTabRef.current = { isSaved: targetTab.isSaved || false, dbId: targetTab.dbId };
    }
  };
  
  // Update tab when title input loses focus
  const handleTitleBlur = () => {
    setOpenTabs(tabs => tabs.map(t => 
      t.id === activeTabId ? { ...t, title: localTitle } : t
    ));
  };
  
  // Data source handlers
  const handleEditData = (sourceId: string, newData: any) => {
    setSheetsData(prev => ({
      ...prev,
      [sourceId]: { ...prev[sourceId], data: newData }
    }));
  };
  
  const handleRemoveSource = (sourceId: string) => {
    setSources(sources.filter(s => s.sourceId !== sourceId));
    toast.success('Source removed');
  };



  // Chat Panel Content - using JSX variable instead of component to prevent remounting on re-render
  const chatPanelContent = (
    <div className="flex flex-col h-full bg-[#1A1A1A]">
      {/* Chat tabs header - matching canvas panel style */}
      <div className="flex-shrink-0 bg-[#1A1A1A]">
        <div className="flex items-center justify-between px-6 py-4 bg-[#1A1A1A]">
          {/* Chat tabs - scrollable */}
          <div className="flex items-center gap-2 overflow-x-auto flex-1 scrollbar-hide">
            <button
              onClick={handleCreateNewChat}
              className="flex-shrink-0 px-3 py-1.5 text-sm text-[#6B7280] hover:text-white hover:bg-[#252525] rounded transition-colors"
              title="New Chat"
            >
              +
            </button>
            
            {chatConversations.map((chat) => {
              const isActive = chat.id === activeChatId;
              const isEditing = chat.id === editingChatId;
              
              return (
                <div
                  key={chat.id}
                  className={`group flex items-center gap-2 px-3 py-1.5 rounded transition-colors cursor-pointer flex-shrink-0 max-w-[200px] ${
                    isActive
                      ? 'bg-[#2A2A2A] text-white'
                      : 'text-[#9CA3AF] hover:text-white hover:bg-[#252525]'
                  }`}
                  onClick={() => handleSwitchChat(chat.id)}
                  onDoubleClick={() => handleDoubleClickChat(chat.id, chat.title)}
                >
                  {isEditing ? (
                    <input
                      ref={chatTabInputRef}
                      type="text"
                      value={editingChatTitle}
                      onChange={(e) => setEditingChatTitle(e.target.value)}
                      onBlur={handleSaveRenameChat}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveRenameChat();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          handleCancelRenameChat();
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-[#1A1A1A] text-white text-sm px-1 py-0.5 rounded border border-[#FF6B35] outline-none"
                    />
                  ) : (
                    <>
                      <span className="text-sm whitespace-nowrap truncate" title={chat.title}>
                        {chat.title}
                      </span>
                      {chatConversations.length > 1 && (
                        <button
                          onClick={(e) => handleDeleteChat(chat.id, e)}
                          className="opacity-0 group-hover:opacity-100 text-[#6B7280] hover:text-white transition-all flex-shrink-0"
                          title="Delete chat"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            
            <button
              onClick={handleCreateNewChat}
              className="px-3 py-1.5 text-sm text-[#6B7280] hover:text-white transition-colors whitespace-nowrap"
            >
              + New Chat
            </button>
          </div>
          
          {/* Collapse button */}
          <div className="flex items-center gap-1 ml-4">
            <button
              onClick={handleCollapseChat}
              className="p-1.5 text-[#6B7280] hover:text-white hover:bg-[#2A2A2A] rounded transition-colors"
              title="Collapse Chat"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Chat messages area */}
      <div
        ref={aiChatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 scrollbar-hide"
      >
        {/* Error state with retry */}
        {historyLoadError && (
          <div className="text-center py-8">
            <div className="text-red-400 mb-3 text-sm">{historyLoadError}</div>
            <button
              onClick={retryLoadHistory}
              className="px-4 py-2 text-sm bg-[#FF6B35] hover:bg-[#E55A2B] text-white rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        )}
        
        {chatMessages.filter(m => m.source !== 'canvas').map((message) => {
          const isUser = message.role === 'user';
          const shouldAnimate = !isUser && animatingMessageId === message.id;
          
          return (
            <div
              key={message.id}
              className={`flex gap-3 group ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`relative max-w-[85%] rounded-lg transition-all ${
                  isUser 
                    ? 'bg-gradient-to-r from-[#FF6B35] to-[#E55A2B] text-white px-4 py-3' 
                    : 'text-[#E5E7EB] py-2'
                }`}
              >
                <div className="text-sm whitespace-pre-wrap">
                  {shouldAnimate ? (
                    <TypewriterText 
                      text={message.content}
                      speed={8}
                      onComplete={handleAnimationComplete}
                    />
                  ) : (
                    message.content
                  )}
                </div>
                <p className={`text-xs mt-1 ${isUser ? 'opacity-70' : 'opacity-50 text-[#9CA3AF]'}`}>
                  {formatRelativeTime(message.timestamp)}
                </p>
                
                {!isUser && (
                  <div className="absolute -top-2 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#1A1F2E] border border-[#2D3B4E] rounded px-1 py-1">
                    <button
                      onClick={() => handleCopyMessage(message.content)}
                      className="p-1 text-[#6B7280] hover:text-white transition-colors"
                      title="Copy message"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        
        {isAiTyping && (
          <div className="flex gap-3 justify-start">
            <div className="py-2">
              <GlowingDot />
            </div>
          </div>
        )}
      </div>
      
      <div className="flex-shrink-0 p-4">
        <input
          type="text"
          value={aiChatInput}
          onChange={(e) => setAiChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !isLoadingHistory && !historyLoadError) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          disabled={isLoadingHistory || !!historyLoadError}
          placeholder={
            isLoadingHistory 
              ? "Loading chat history..." 
              : historyLoadError 
                ? "Please retry loading chat history above" 
                : "Ask about this insight... (Press Enter to send)"
          }
          className={`w-full px-4 py-3 bg-[#1A1F2E] border border-[#2D3B4E] text-white placeholder:text-[#6B7280] outline-none focus:border-[#FF6B35] transition-colors rounded-[43px] text-[13px] ${(isLoadingHistory || historyLoadError) ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
      </div>
    </div>
  );

  // Canvas Panel Content - using JSX variable instead of component to prevent remounting on re-render
  const canvasPanelContent = (
    <div className="flex flex-col h-full bg-[#212121]">
      <div className="flex-shrink-0 bg-[#1E1E1E]">
        <div className="flex items-center justify-between px-6 py-4 bg-[rgb(33,33,33)]">
          <div className="flex items-center gap-2 overflow-x-auto flex-1 scrollbar-hide">
            <button
              onClick={handleCreateNewInsight}
              className="flex-shrink-0 px-3 py-1.5 text-sm text-[#6B7280] hover:text-white hover:bg-[#252525] rounded transition-colors"
              title="New Insight"
            >
              +
            </button>
            
            {openTabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              const isEditing = tab.id === editingTabId;
              return (
                <div
                  key={tab.id}
                  className={`group flex items-center gap-2 px-3 py-1.5 rounded transition-colors cursor-pointer max-w-[200px] ${
                    isActive
                      ? 'bg-[#2A2A2A] text-white'
                      : 'text-[#9CA3AF] hover:text-white hover:bg-[#252525]'
                  }`}
                  onClick={() => handleSwitchTab(tab.id)}
                  onDoubleClick={() => handleDoubleClickTab(tab.id, tab.title)}
                >
                  {isEditing ? (
                    <input
                      ref={insightTabInputRef}
                      type="text"
                      value={editingTabTitle}
                      onChange={(e) => setEditingTabTitle(e.target.value)}
                      onBlur={handleSaveRenameTab}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveRenameTab();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          handleCancelRenameTab();
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-[#1A1A1A] text-white text-sm px-1 py-0.5 rounded border border-[#FF6B35] outline-none"
                    />
                  ) : (
                    <>
                      <span className="text-sm whitespace-nowrap truncate" title={tab.title}>
                        {tab.title}
                      </span>
                      {openTabs.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCloseTab(tab.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-[#6B7280] hover:text-white transition-all flex-shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            
            <button
              onClick={handleCreateNewInsight}
              className="px-3 py-1.5 text-sm text-[#6B7280] hover:text-white transition-colors whitespace-nowrap"
            >
              + New Insight
            </button>
          </div>
          
          <div className="flex items-center gap-1 ml-4">
            <button
              onClick={() => setViewMode('default')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'default'
                  ? 'text-white bg-[#2A2A2A]'
                  : 'text-[#6B7280] hover:text-white hover:bg-[#252525]'
              }`}
              title="Canvas View"
            >
              <FileText className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('slide')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'slide'
                  ? 'text-white bg-[#2A2A2A]'
                  : 'text-[#6B7280] hover:text-white hover:bg-[#252525]'
              }`}
              title="Slide View"
            >
              <Presentation className="w-5 h-5" />
            </button>
            <div className="w-px h-5 bg-[#2A2A2A] mx-1" />
            <button
              onClick={handleCollapseCanvas}
              className="p-1.5 text-[#6B7280] hover:text-white hover:bg-[#2A2A2A] rounded transition-colors"
              title="Collapse Canvas"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {viewMode === 'slide' ? (
          <div className="p-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="w-full max-w-4xl aspect-[16/9] bg-white rounded-lg shadow-2xl p-12 flex flex-col">
                <div className="mb-8">
                  <input
                    type="text"
                    value={localTitle}
                    onChange={(e) => setLocalTitle(e.target.value)}
                    onBlur={handleTitleBlur}
                    className="w-full text-4xl text-[#1A1A1A] bg-transparent border-b-2 border-[#E0E0E0] pb-4 outline-none focus:border-[#FF6B35] transition-colors"
                    placeholder="Click to add title"
                  />
                </div>
                <div className="flex-1 border-2 border-[#E0E0E0] rounded p-6 overflow-y-auto scrollbar-hide">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Click to add text"
                    className="w-full h-full text-lg text-[#333333] bg-transparent outline-none resize-none"
                  />
                </div>
              </div>
              <button
                onClick={() => toast.info('Add slide functionality coming soon!')}
                className="w-full max-w-4xl py-4 bg-[#2A2A2A] hover:bg-[#333333] text-white rounded-lg transition-colors flex items-center justify-center gap-2 border border-[#3A3A3A] hover:border-[#FF6B35]"
              >
                <span className="text-lg">Add Slide +</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="px-8 py-6">
            <input
              type="text"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={handleTitleBlur}
              className="w-full text-xl text-white bg-transparent border-none outline-none focus:opacity-80 transition-opacity mb-4"
              placeholder="Add a title..."
            />
            
            {/* AI Quick Actions Bar */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <div className="flex items-center gap-1 text-xs text-[#6B7280] mr-2">
                <Sparkles className="w-3 h-3" />
                <span>AI Actions:</span>
              </div>
              <button
                onClick={() => handleQuickAction('polish')}
                disabled={isAiTyping || !aiLearningConsent}
                className="px-2.5 py-1 text-xs bg-[#2A2A2A] hover:bg-[#3A3A3A] text-[#9CA3AF] hover:text-white rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                title={!aiLearningConsent ? "AI features require consent. Enable in Settings." : "Polish and improve clarity"}
              >
                <Wand2 className="w-3 h-3" />
                Polish
              </button>
              <button
                onClick={() => handleQuickAction('shorten')}
                disabled={isAiTyping || !aiLearningConsent}
                className="px-2.5 py-1 text-xs bg-[#2A2A2A] hover:bg-[#3A3A3A] text-[#9CA3AF] hover:text-white rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                title={!aiLearningConsent ? "AI features require consent. Enable in Settings." : "Make shorter and more concise"}
              >
                <Minimize2 className="w-3 h-3" />
                Shorten
              </button>
              <button
                onClick={() => handleQuickAction('expand')}
                disabled={isAiTyping || !aiLearningConsent}
                className="px-2.5 py-1 text-xs bg-[#2A2A2A] hover:bg-[#3A3A3A] text-[#9CA3AF] hover:text-white rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                title={!aiLearningConsent ? "AI features require consent. Enable in Settings." : "Add more detail and context"}
              >
                <Maximize2 className="w-3 h-3" />
                Expand
              </button>
              <button
                onClick={() => handleQuickAction('simplify')}
                disabled={isAiTyping || !aiLearningConsent}
                className="px-2.5 py-1 text-xs bg-[#2A2A2A] hover:bg-[#3A3A3A] text-[#9CA3AF] hover:text-white rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                title={!aiLearningConsent ? "AI features require consent. Enable in Settings." : "Simplify language"}
              >
                <TextQuote className="w-3 h-3" />
                Simplify
              </button>
              <button
                onClick={() => handleQuickAction('professional')}
                disabled={isAiTyping || !aiLearningConsent}
                className="px-2.5 py-1 text-xs bg-[#2A2A2A] hover:bg-[#3A3A3A] text-[#9CA3AF] hover:text-white rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                title={!aiLearningConsent ? "AI features require consent. Enable in Settings." : "Make more professional"}
              >
                <ShieldCheck className="w-3 h-3" />
                Professional
              </button>
              <button
                onClick={() => handleQuickAction('fix_grammar')}
                disabled={isAiTyping || !aiLearningConsent}
                className="px-2.5 py-1 text-xs bg-[#2A2A2A] hover:bg-[#3A3A3A] text-[#9CA3AF] hover:text-white rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                title={!aiLearningConsent ? "AI features require consent. Enable in Settings." : "Fix grammar and spelling"}
              >
                <Eraser className="w-3 h-3" />
                Grammar
              </button>
              <button
                onClick={() => handleQuickAction('summarize')}
                disabled={isAiTyping || !aiLearningConsent}
                className="px-2.5 py-1 text-xs bg-[#2A2A2A] hover:bg-[#3A3A3A] text-[#9CA3AF] hover:text-white rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                title={!aiLearningConsent ? "AI features require consent. Enable in Settings." : "Summarize content"}
              >
                <FileDigit className="w-3 h-3" />
                Summarize
              </button>
              {isAiTyping && (
                <div className="flex items-center gap-1.5 text-xs text-[#FF6B35]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>AI thinking...</span>
                </div>
              )}
            </div>

            {/* Edit Proposal UI */}
            {pendingEditProposal && (
              <div className="mb-4 p-4 bg-gradient-to-r from-[#FF6B35]/10 to-[#2A2A2A] border border-[#FF6B35]/30 rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#FF6B35]" />
                    <span className="text-sm font-medium text-white">AI Suggestion</span>
                    <span className="text-xs text-[#6B7280] bg-[#2A2A2A] px-2 py-0.5 rounded">
                      {pendingEditProposal.type} • {pendingEditProposal.targetType}
                    </span>
                  </div>
                  <button
                    onClick={handleRejectEditProposal}
                    className="p-1 text-[#6B7280] hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-[#9CA3AF] mb-3">{pendingEditProposal.rationale}</p>
                <div className="bg-[#1A1A1A] rounded p-3 mb-3 max-h-32 overflow-y-auto">
                  <p className="text-sm text-white whitespace-pre-wrap">
                    {pendingEditProposal.suggestedText.slice(0, 500)}
                    {pendingEditProposal.suggestedText.length > 500 && '...'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApplyEditProposal(pendingEditProposal)}
                    className="px-3 py-1.5 text-xs bg-[#FF6B35] hover:bg-[#E55B25] text-white rounded-md transition-colors flex items-center gap-1.5"
                  >
                    <Check className="w-3 h-3" />
                    Apply Changes
                  </button>
                  <button
                    onClick={handleRejectEditProposal}
                    className="px-3 py-1.5 text-xs bg-[#2A2A2A] hover:bg-[#3A3A3A] text-[#9CA3AF] hover:text-white rounded-md transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            
            <div className="bg-[#1A1A1A] rounded-lg min-h-[400px]">
              <RichTextEditor
                ref={editorRef}
                key={activeTabId}
                content={notes}
                onChange={setNotes}
                onSelectionChange={setCanvasSelection}
                onRefineSelection={handleRefineSelection}
                aiConsentEnabled={aiLearningConsent}
                placeholder="Start writing your insight..."
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Data Sources Panel Content - using JSX variable instead of component to prevent remounting on re-render
  const dataSourcesPanelContent = (
    <DataSourcesPanel
      sheets={workspaceSheets}
      sources={sources}
      sheetsData={sheetsData}
      onToggle={handleCollapseData}
      onEditData={handleEditData}
      onRemoveSource={handleRemoveSource}
      onAddData={onBack}
      openTemplateEditor={openTemplateEditor}
    />
  );

  // Sortable items for DnD - only canvas and data can be reordered
  const sortableItems = rightPanelOrder === 'canvas-data' ? ['canvas', 'data'] : ['data', 'canvas'];

  return (
    <motion.div 
      className="h-screen bg-[#1E1E1E] flex overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableItems} strategy={horizontalListSortingStrategy}>
          <ResizablePanelGroup 
            direction="horizontal" 
            className="h-full" 
            autoSaveId={getStorageKey(`insight-workspace-panels-${rightPanelOrder}`, workspaceId)}
          >
            {/* Chat Panel - always first, fixed on left, NOT draggable */}
            <ResizablePanel 
              id="chat-panel"
              ref={chatPanelRef}
              defaultSize={30} 
              minSize={3}
              maxSize={50}
              onResize={(size) => setChatSize(size)}
            >
              <PanelContentWrapper
                size={chatSize}
                collapsedContent={<CollapsedChatPanel onClick={handleExpandChat} />}
                expandedContent={chatPanelContent}
              />
            </ResizablePanel>
            
            {/* Handle between Chat and center panel - matches center panel color */}
            <ResizableHandle className={`w-1.5 group cursor-col-resize flex items-center justify-center ${rightPanelOrder === 'canvas-data' ? 'bg-[#212121]' : 'bg-[#1E1E1E]'}`}>
              <div className="w-[1px] h-full bg-[#3A3F4E]/30 group-hover:bg-[#FF6B35]/60 transition-colors" />
            </ResizableHandle>
            
            {/* Center and Right panels - order depends on rightPanelOrder */}
            {rightPanelOrder === 'canvas-data' ? (
              <>
                {/* Canvas Panel (center) */}
                <ResizablePanel 
                  id="canvas-panel"
                  ref={canvasPanelRef}
                  defaultSize={45}
                  minSize={3}
                  onResize={(size) => setCanvasSize(size)}
                >
                  <PanelContentWrapper
                    size={canvasSize}
                    collapsedContent={
                      <DraggableCollapsedPanel 
                        type="canvas" 
                        onClick={handleExpandCanvas} 
                        direction="left"
                      />
                    }
                    expandedContent={canvasPanelContent}
                  />
                </ResizablePanel>
                
                {/* Handle between Canvas and Data - matches Data panel color */}
                <ResizableHandle 
                  className="w-1.5 group cursor-col-resize flex items-center justify-center bg-[#1E1E1E]"
                  onDoubleClick={handleDoubleClickExpandCanvas}
                >
                  <div className="w-[1px] h-full bg-[#3A3F4E]/30 group-hover:bg-[#FF6B35]/60 transition-colors" />
                </ResizableHandle>
                
                {/* Data Panel (right) */}
                <ResizablePanel 
                  id="data-panel"
                  ref={dataPanelRef}
                  defaultSize={25}
                  minSize={3}
                  onResize={(size) => setDataSize(size)}
                >
                  <PanelContentWrapper
                    size={dataSize}
                    collapsedContent={
                      <DraggableCollapsedPanel 
                        type="data" 
                        onClick={handleExpandData} 
                        direction="right"
                      />
                    }
                    expandedContent={dataSourcesPanelContent}
                  />
                </ResizablePanel>
              </>
            ) : (
              <>
                {/* Data Panel (center - swapped) */}
                <ResizablePanel 
                  id="data-panel"
                  ref={dataPanelRef}
                  defaultSize={45}
                  minSize={3}
                  onResize={(size) => setDataSize(size)}
                >
                  <PanelContentWrapper
                    size={dataSize}
                    collapsedContent={
                      <DraggableCollapsedPanel 
                        type="data" 
                        onClick={handleExpandData} 
                        direction="left"
                      />
                    }
                    expandedContent={dataSourcesPanelContent}
                  />
                </ResizablePanel>
                
                {/* Handle between Data and Canvas (swapped) - matches Canvas panel color */}
                <ResizableHandle 
                  className="w-1.5 group cursor-col-resize flex items-center justify-center bg-[#212121]"
                  onDoubleClick={handleDoubleClickExpandData}
                >
                  <div className="w-[1px] h-full bg-[#3A3F4E]/30 group-hover:bg-[#FF6B35]/60 transition-colors" />
                </ResizableHandle>
                
                {/* Canvas Panel (right - swapped) */}
                <ResizablePanel 
                  id="canvas-panel"
                  ref={canvasPanelRef}
                  defaultSize={25}
                  minSize={3}
                  onResize={(size) => setCanvasSize(size)}
                >
                  <PanelContentWrapper
                    size={canvasSize}
                    collapsedContent={
                      <DraggableCollapsedPanel 
                        type="canvas" 
                        onClick={handleExpandCanvas} 
                        direction="right"
                      />
                    }
                    expandedContent={canvasPanelContent}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </SortableContext>
        
        {/* Drag overlay for visual feedback during drag */}
        <DragOverlay>
          {activeDragId ? (
            <div className="w-12 h-24 bg-[#2A2A2A] border border-[#FF6B35] rounded-lg flex items-center justify-center opacity-80">
              {activeDragId === 'canvas' ? (
                <FileText className="w-5 h-5 text-[#FF6B35]" />
              ) : (
                <Database className="w-5 h-5 text-[#FF6B35]" />
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </motion.div>
  );
}

interface DataSourcesPanelProps {
  sheets: Sheet[];
  sources: InsightSource[];
  sheetsData: Record<string, any>;
  onToggle: () => void;
  onEditData: (sourceId: string, newData: any) => void;
  onRemoveSource: (sourceId: string) => void;
  onAddData: () => void;
  openTemplateEditor: (initialData?: { name?: string; description?: string; scope?: 'workspace' | 'space'; columns?: any[] }) => void;
}

interface DisplayableSheet {
  id: string;
  name: string;
  type: 'screenshot' | 'file' | 'link' | 'capture';
  preview: string | null;
  date: string;
  rowCount: number | null;
  dataSourceMeta: any;
  sourceUrl: string | null;
}

function transformSheetToDisplayable(sheet: Sheet): DisplayableSheet {
  const meta = sheet.dataSourceMeta as { preview?: string; url?: string; sourceUrl?: string; screenshotUrl?: string } | null;
  const dataType = sheet.dataSourceType?.toLowerCase() || 'capture';
  
  let type: DisplayableSheet['type'] = 'capture';
  if (dataType === 'screenshot' || dataType.includes('screenshot')) {
    type = 'screenshot';
  } else if (dataType === 'link' || dataType === 'url' || dataType.includes('link')) {
    type = 'link';
  } else if (dataType === 'file' || dataType.includes('file')) {
    type = 'file';
  }
  
  let preview: string | null = null;
  if (meta?.preview) {
    preview = meta.preview;
  } else if (meta?.screenshotUrl) {
    preview = meta.screenshotUrl;
  } else if (sheet.data && typeof sheet.data === 'object') {
    const sheetData = sheet.data as { screenshot?: string; screenshotUrl?: string; preview?: string };
    preview = sheetData.screenshot || sheetData.screenshotUrl || sheetData.preview || null;
  }
  
  const date = sheet.lastModified 
    ? new Date(sheet.lastModified).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Unknown date';
  
  // Extract full source URL from meta (priority: url > sourceUrl) or fall back to name if it looks like a URL
  const sourceUrl = meta?.url || meta?.sourceUrl || (sheet.name.startsWith('http') ? sheet.name : null);
  
  return {
    id: sheet.id,
    name: sheet.name,
    type,
    preview,
    date,
    rowCount: sheet.rowCount,
    dataSourceMeta: sheet.dataSourceMeta,
    sourceUrl,
  };
}

interface CellPosition {
  rowIndex: number;
  columnKey: string;
}

type EditMode = 'replace' | 'edit';

// Cell-level edit entry
interface CellEditEntry {
  type?: 'cell-edit'; // optional for backward compatibility
  rowIndex: number;
  columnKey: string;
  previousValue: any;
  newValue: any;
}

// Row-level operation entry (delete or add)
interface RowOperationEntry {
  type: 'delete-row' | 'add-row';
  rowIndex: number;
  rowData: any;
}

// Unified undo/redo stack entry type
type UndoEntry = CellEditEntry | RowOperationEntry;

const DATA_SOURCES_VIEW_MODE_KEY = 'captureinsight_data_sources_view_mode';
const SELECTED_SHEET_KEY = 'captureinsight_selected_sheet_id';
const SOURCES_LIST_COLLAPSED_KEY = 'captureinsight_sources_list_collapsed';

function DataSourcesPanel({ sheets, sources: _sources, sheetsData: _sheetsData, onToggle, onEditData: _onEditData, onRemoveSource: _onRemoveSource, onAddData, openTemplateEditor }: DataSourcesPanelProps) {
  void _sources; void _sheetsData; void _onEditData; void _onRemoveSource;
  
  // Initialize view mode from localStorage, defaulting to 'data'
  const [viewMode, setViewMode] = useState<'files' | 'data'>(() => {
    const saved = localStorage.getItem(DATA_SOURCES_VIEW_MODE_KEY);
    if (saved === 'files' || saved === 'data') {
      return saved;
    }
    return 'data'; // Default to 'data' view
  });
  
  // Initialize selected sheet from localStorage
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(() => {
    const saved = localStorage.getItem(SELECTED_SHEET_KEY);
    return saved || null;
  });
  
  // Sources list sidebar collapsed state - auto-collapse when a sheet is selected
  const [isSourcesListCollapsed, setIsSourcesListCollapsed] = useState(() => {
    const saved = localStorage.getItem(SOURCES_LIST_COLLAPSED_KEY);
    return saved === 'true';
  });
  
  const [showRawJson, setShowRawJson] = useState(false);
  const [showQualityDetails, setShowQualityDetails] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedJson, setEditedJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [hasJsonChanges, setHasJsonChanges] = useState(false);
  const jsonAutoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [editableTableData, setEditableTableData] = useState<any[] | null>(null);
  const [selectedCell, setSelectedCell] = useState<CellPosition | null>(null);
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
  const [editMode, setEditMode] = useState<EditMode>('replace');
  const [hasTableChanges, setHasTableChanges] = useState(false);
  const [modifiedCells, setModifiedCells] = useState<Set<string>>(new Set());
  const [editCellValue, setEditCellValue] = useState<string>('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [lastInitializedSheetId, setLastInitializedSheetId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingSheetSwitch, setPendingSheetSwitch] = useState<string | null>(null);
  
  // Auto-save status: 'idle' | 'saving' | 'saved'
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedStatusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Undo/Redo history
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);
  
  // Column widths for resizing
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(0);
  
  const updateCleanedDataMutation = useUpdateSheetCleanedData();
  const retryProcessingMutation = useRetrySheetProcessing();
  const updateSheetMutation = useUpdateSheet();
  const deleteSheetMutation = useDeleteSheet();
  
  // Sheet title editing state
  const [editingSheetTitleId, setEditingSheetTitleId] = useState<string | null>(null);
  const [editingSheetTitleValue, setEditingSheetTitleValue] = useState('');
  const sheetTitleInputRef = useRef<HTMLInputElement>(null);
  
  const displayableSheets = sheets.map(transformSheetToDisplayable);
  
  // Persist view mode preference to localStorage
  useEffect(() => {
    localStorage.setItem(DATA_SOURCES_VIEW_MODE_KEY, viewMode);
  }, [viewMode]);
  
  // Persist selected sheet to localStorage
  useEffect(() => {
    if (selectedSheetId) {
      localStorage.setItem(SELECTED_SHEET_KEY, selectedSheetId);
    }
  }, [selectedSheetId]);
  
  // Persist sources list collapsed state
  useEffect(() => {
    localStorage.setItem(SOURCES_LIST_COLLAPSED_KEY, String(isSourcesListCollapsed));
  }, [isSourcesListCollapsed]);
  
  useEffect(() => {
    if (displayableSheets.length > 0) {
      // Check if saved selection still exists in current sheets
      const savedId = localStorage.getItem(SELECTED_SHEET_KEY);
      const savedExists = savedId && displayableSheets.some(s => s.id === savedId);
      
      if (!selectedSheetId && savedExists) {
        // Restore saved selection
        setSelectedSheetId(savedId);
      } else if (!selectedSheetId || !displayableSheets.some(s => s.id === selectedSheetId)) {
        // Fall back to first sheet if no valid selection
        setSelectedSheetId(displayableSheets[0].id);
      }
    } else if (displayableSheets.length === 0) {
      setSelectedSheetId(null);
    }
  }, [displayableSheets.length, selectedSheetId]);

  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      // Always position cursor at the end - don't select
      // This ensures type-to-edit works correctly (first char isn't lost)
      const len = editInputRef.current.value.length;
      editInputRef.current.setSelectionRange(len, len);
    }
  }, [editingCell, editMode]);
  
  const selectedSheet = displayableSheets.find(s => s.id === selectedSheetId) || null;
  const originalSheet = sheets.find(s => s.id === selectedSheetId);
  const cleanedData = originalSheet?.cleanedData as any;
  const cleaningStatus = (originalSheet as any)?.cleaningStatus || 'pending';
  const qualityScore = (originalSheet as any)?.qualityScore as number | null;
  const qualityDetails = (originalSheet as any)?.qualityDetails as {
    confidence: number;
    completeness: number;
    dataRichness: number;
    issues?: string[];
  } | null;
  const validationResult = (originalSheet as any)?.validationResult as {
    isValid: boolean;
    failureType?: string;
    message?: string;
  } | null;

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  const getQualityBgColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/20';
    if (score >= 60) return 'bg-amber-500/20';
    return 'bg-red-500/20';
  };

  // Handle sheet selection with unsaved changes protection
  const handleSelectSheet = (sheetId: string) => {
    if (sheetId === selectedSheetId) {
      // If clicking same sheet, just toggle collapse
      return;
    }
    
    if (hasTableChanges) {
      // Store pending switch and show confirmation
      setPendingSheetSwitch(sheetId);
    } else {
      // No unsaved changes, switch immediately and auto-collapse sidebar
      setSelectedSheetId(sheetId);
      setIsSourcesListCollapsed(true);
    }
  };

  const confirmSheetSwitch = () => {
    if (pendingSheetSwitch) {
      setHasTableChanges(false);
      setModifiedCells(new Set());
      setEditingCell(null);
      setSelectedCell(null);
      setSelectedSheetId(pendingSheetSwitch);
      setIsSourcesListCollapsed(true);
      setPendingSheetSwitch(null);
    }
  };

  const cancelSheetSwitch = () => {
    setPendingSheetSwitch(null);
  };

  const handleStartEdit = () => {
    if (cleanedData?.data) {
      setEditedJson(JSON.stringify(cleanedData.data, null, 2));
      setJsonError(null);
      setIsEditing(true);
    }
  };

  const handleSaveEdit = async () => {
    try {
      const parsed = JSON.parse(editedJson);
      setJsonError(null);
      
      if (!selectedSheetId) return;
      
      const newCleanedData = {
        ...cleanedData,
        data: parsed,
      };
      
      await updateCleanedDataMutation.mutateAsync({
        sheetId: selectedSheetId,
        cleanedData: newCleanedData,
      });
      
      toast.success('Data saved successfully!');
      setIsEditing(false);
    } catch (e) {
      if (e instanceof SyntaxError) {
        setJsonError('Invalid JSON syntax');
      } else {
        setJsonError((e as Error).message || 'Failed to save');
        toast.error('Failed to save changes');
      }
    }
  };

  const handleRetry = async () => {
    if (!selectedSheetId) return;
    
    try {
      await retryProcessingMutation.mutateAsync(selectedSheetId);
      toast.success('Processing restarted');
    } catch (e) {
      toast.error((e as Error).message || 'Failed to retry processing');
    }
  };

  const initializeTableEditing = useCallback((data: any[], clearUndoHistory: boolean = true) => {
    setEditableTableData(JSON.parse(JSON.stringify(data)));
    setHasTableChanges(false);
    setModifiedCells(new Set());
    setEditingCell(null);
    setSelectedCell(null);
    // Only clear undo/redo stacks when explicitly requested (e.g., switching sheets)
    // This preserves undo history during background updates after auto-save
    if (clearUndoHistory) {
      setUndoStack([]);
      setRedoStack([]);
    }
    setColumnWidths({});
  }, []);

  // Initialize table data when:
  // 1. Switching to a different sheet via handleSelectSheet (which handles unsaved changes)
  // 2. Same sheet but no table data yet (first load)
  // 3. Same sheet, no unsaved changes, not editing, and not saving (allows background updates)
  useEffect(() => {
    if (cleanedData?.data && Array.isArray(cleanedData.data) && selectedSheetId) {
      const isNewSheet = lastInitializedSheetId !== selectedSheetId;
      const needsInitialLoad = editableTableData === null;
      const isCurrentlyEditing = editingCell !== null || selectedCell !== null;
      const canAcceptBackgroundUpdate = !hasTableChanges && !isSaving && !isCurrentlyEditing;
      
      // For new sheets: reinitialize (user has already confirmed via handleSelectSheet)
      if (isNewSheet) {
        initializeTableEditing(cleanedData.data);
        setLastInitializedSheetId(selectedSheetId);
        return;
      }
      
      // For first load: initialize immediately
      if (needsInitialLoad) {
        initializeTableEditing(cleanedData.data);
        setLastInitializedSheetId(selectedSheetId);
        return;
      }
      
      // For background updates: only accept if not editing, no changes, and not saving
      // Pass false for clearUndoHistory to preserve undo stack after auto-save
      if (canAcceptBackgroundUpdate) {
        initializeTableEditing(cleanedData.data, false);
        setLastInitializedSheetId(selectedSheetId);
      }
    }
  }, [cleanedData?.data, selectedSheetId, lastInitializedSheetId, hasTableChanges, isSaving, editableTableData, editingCell, selectedCell, initializeTableEditing]);

  const getColumnKeys = useCallback(() => {
    if (!editableTableData || editableTableData.length === 0) return [];
    return Object.keys(editableTableData[0] || {});
  }, [editableTableData]);

  const handleCellClick = (e: React.MouseEvent, rowIndex: number, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (editingCell) {
      commitCellEdit(editingCell.rowIndex, editingCell.columnKey, editCellValue);
    }
    setSelectedCell({ rowIndex, columnKey });
    setEditingCell(null);
    setTimeout(() => {
      tableContainerRef.current?.focus();
    }, 0);
  };

  const handleCellDoubleClick = (rowIndex: number, columnKey: string, currentValue: any) => {
    setSelectedCell({ rowIndex, columnKey });
    setEditingCell({ rowIndex, columnKey });
    setEditMode('edit');
    setEditCellValue(currentValue === null ? '' : String(currentValue));
  };

  const startEditing = (rowIndex: number, columnKey: string, initialValue: string = '', mode: EditMode = 'replace') => {
    if (!editableTableData) return;
    const currentValue = editableTableData[rowIndex]?.[columnKey];
    setSelectedCell({ rowIndex, columnKey });
    setEditingCell({ rowIndex, columnKey });
    setEditMode(mode);
    if (mode === 'replace') {
      setEditCellValue(initialValue);
    } else {
      setEditCellValue(currentValue === null ? '' : String(currentValue));
    }
  };

  const handleCellChange = (value: string) => {
    setEditCellValue(value);
  };

  const parseValue = (value: string): any => {
    if (value === '') return null;
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (!isNaN(Number(value)) && value.trim() !== '') return Number(value);
    return value;
  };

  const applyEdit = (rowIndex: number, columnKey: string, newValue: any, addToUndo: boolean = true) => {
    if (!editableTableData) return;
    
    const previousValue = editableTableData[rowIndex]?.[columnKey];
    if (previousValue === newValue) {
      setEditingCell(null);
      return;
    }
    
    const newData = [...editableTableData];
    newData[rowIndex] = { ...newData[rowIndex], [columnKey]: newValue };
    setEditableTableData(newData);
    
    if (addToUndo) {
      setUndoStack(prev => [...prev, { rowIndex, columnKey, previousValue, newValue }]);
      setRedoStack([]);
    }
    
    const originalValue = cleanedData?.data?.[rowIndex]?.[columnKey];
    const cellKey = `${rowIndex}-${columnKey}`;
    const newModified = new Set(modifiedCells);
    if (newValue !== originalValue) {
      newModified.add(cellKey);
      setHasTableChanges(true);
    } else {
      newModified.delete(cellKey);
      if (newModified.size === 0) {
        setHasTableChanges(false);
      }
    }
    setModifiedCells(newModified);
  };

  const commitCellEdit = (rowIndex: number, columnKey: string, newValue: string) => {
    const parsedValue = parseValue(newValue);
    applyEdit(rowIndex, columnKey, parsedValue);
    setEditingCell(null);
  };

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || !editableTableData) return;
    
    const lastEdit = undoStack[undoStack.length - 1];
    
    // Handle row-level operations (delete/add)
    if (lastEdit.type === 'delete-row') {
      // Restore the deleted row
      const newData = [...editableTableData];
      newData.splice(lastEdit.rowIndex, 0, lastEdit.rowData);
      setEditableTableData(newData);
      setUndoStack(prev => prev.slice(0, -1));
      setRedoStack(prev => [...prev, lastEdit]);
      setHasTableChanges(true);
      return;
    }
    
    if (lastEdit.type === 'add-row') {
      // Remove the added row
      const newData = editableTableData.filter((_, i) => i !== lastEdit.rowIndex);
      setEditableTableData(newData);
      setUndoStack(prev => prev.slice(0, -1));
      setRedoStack(prev => [...prev, lastEdit]);
      setHasTableChanges(true);
      return;
    }
    
    // Handle cell-level edits (type guard for TypeScript)
    const cellEdit = lastEdit as CellEditEntry;
    const { rowIndex, columnKey, previousValue } = cellEdit;
    
    const newData = [...editableTableData];
    newData[rowIndex] = { ...newData[rowIndex], [columnKey]: previousValue };
    setEditableTableData(newData);
    
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, lastEdit]);
    
    const originalValue = cleanedData?.data?.[rowIndex]?.[columnKey];
    const cellKey = `${rowIndex}-${columnKey}`;
    const newModified = new Set(modifiedCells);
    if (previousValue !== originalValue) {
      newModified.add(cellKey);
    } else {
      newModified.delete(cellKey);
    }
    setModifiedCells(newModified);
    setHasTableChanges(newModified.size > 0);
  }, [undoStack, editableTableData, cleanedData, modifiedCells]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0 || !editableTableData) return;
    
    const nextEdit = redoStack[redoStack.length - 1];
    
    // Handle row-level operations (delete/add)
    if (nextEdit.type === 'delete-row') {
      // Re-delete the row
      const newData = editableTableData.filter((_, i) => i !== nextEdit.rowIndex);
      setEditableTableData(newData);
      setRedoStack(prev => prev.slice(0, -1));
      setUndoStack(prev => [...prev, nextEdit]);
      setHasTableChanges(true);
      return;
    }
    
    if (nextEdit.type === 'add-row') {
      // Re-add the row
      const newData = [...editableTableData];
      newData.splice(nextEdit.rowIndex, 0, nextEdit.rowData);
      setEditableTableData(newData);
      setRedoStack(prev => prev.slice(0, -1));
      setUndoStack(prev => [...prev, nextEdit]);
      setHasTableChanges(true);
      return;
    }
    
    // Handle cell-level edits (type guard for TypeScript)
    const cellEdit = nextEdit as CellEditEntry;
    const { rowIndex, columnKey, newValue } = cellEdit;
    
    const newData = [...editableTableData];
    newData[rowIndex] = { ...newData[rowIndex], [columnKey]: newValue };
    setEditableTableData(newData);
    
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, nextEdit]);
    
    const originalValue = cleanedData?.data?.[rowIndex]?.[columnKey];
    const cellKey = `${rowIndex}-${columnKey}`;
    const newModified = new Set(modifiedCells);
    if (newValue !== originalValue) {
      newModified.add(cellKey);
    } else {
      newModified.delete(cellKey);
    }
    setModifiedCells(newModified);
    setHasTableChanges(newModified.size > 0);
  }, [redoStack, editableTableData, cleanedData, modifiedCells]);

  const clearSelectedCell = () => {
    if (!selectedCell || !editableTableData) return;
    const { rowIndex, columnKey } = selectedCell;
    applyEdit(rowIndex, columnKey, null);
  };

  // Column resize handlers
  const handleResizeStart = (e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(columnKey);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = columnWidths[columnKey] || 150;
  };

  useEffect(() => {
    if (!resizingColumn) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizeStartX.current;
      const newWidth = Math.max(60, Math.min(500, resizeStartWidth.current + diff));
      setColumnWidths(prev => ({ ...prev, [resizingColumn]: newWidth }));
    };
    
    const handleMouseUp = () => {
      setResizingColumn(null);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn]);

  const navigateCell = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (!selectedCell || !editableTableData) return;
    const columnKeys = getColumnKeys();
    const { rowIndex, columnKey } = selectedCell;
    const colIndex = columnKeys.indexOf(columnKey);
    
    let newRow = rowIndex;
    let newCol = colIndex;
    
    switch (direction) {
      case 'up':
        newRow = Math.max(0, rowIndex - 1);
        break;
      case 'down':
        newRow = Math.min(editableTableData.length - 1, rowIndex + 1);
        break;
      case 'left':
        newCol = Math.max(0, colIndex - 1);
        break;
      case 'right':
        newCol = Math.min(columnKeys.length - 1, colIndex + 1);
        break;
    }
    
    setSelectedCell({ rowIndex: newRow, columnKey: columnKeys[newCol] });
  };

  const handleTableKeyDown = (e: React.KeyboardEvent) => {
    // Handle Ctrl+Z and Ctrl+Y globally (even without selection)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      handleRedo();
      return;
    }
    
    if (!selectedCell || !editableTableData) return;
    const columnKeys = getColumnKeys();
    const { rowIndex, columnKey } = selectedCell;
    
    if (editingCell) return;
    
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateCell('up');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateCell('down');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      navigateCell('left');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      navigateCell('right');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        const colIndex = columnKeys.indexOf(columnKey);
        if (colIndex > 0) {
          setSelectedCell({ rowIndex, columnKey: columnKeys[colIndex - 1] });
        } else if (rowIndex > 0) {
          setSelectedCell({ rowIndex: rowIndex - 1, columnKey: columnKeys[columnKeys.length - 1] });
        }
      } else {
        const colIndex = columnKeys.indexOf(columnKey);
        if (colIndex < columnKeys.length - 1) {
          setSelectedCell({ rowIndex, columnKey: columnKeys[colIndex + 1] });
        } else if (rowIndex < editableTableData.length - 1) {
          setSelectedCell({ rowIndex: rowIndex + 1, columnKey: columnKeys[0] });
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        setSelectedCell({ rowIndex: Math.max(0, rowIndex - 1), columnKey });
      } else {
        startEditing(rowIndex, columnKey, '', 'edit');
      }
    } else if (e.key === 'F2') {
      e.preventDefault();
      startEditing(rowIndex, columnKey, '', 'edit');
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      clearSelectedCell();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSelectedCell(null);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      startEditing(rowIndex, columnKey, e.key, 'replace');
    }
  };

  const handleCellInputKeyDown = (e: React.KeyboardEvent, rowIndex: number, columnKey: string) => {
    const columnKeys = getColumnKeys();
    
    if (e.key === 'Enter') {
      e.preventDefault();
      commitCellEdit(rowIndex, columnKey, editCellValue);
      if (e.shiftKey) {
        setSelectedCell({ rowIndex: Math.max(0, rowIndex - 1), columnKey });
      } else {
        const nextRow = Math.min((editableTableData?.length || 1) - 1, rowIndex + 1);
        setSelectedCell({ rowIndex: nextRow, columnKey });
      }
      tableContainerRef.current?.focus();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitCellEdit(rowIndex, columnKey, editCellValue);
      const colIndex = columnKeys.indexOf(columnKey);
      if (e.shiftKey) {
        if (colIndex > 0) {
          setSelectedCell({ rowIndex, columnKey: columnKeys[colIndex - 1] });
        } else if (rowIndex > 0) {
          setSelectedCell({ rowIndex: rowIndex - 1, columnKey: columnKeys[columnKeys.length - 1] });
        }
      } else {
        if (colIndex < columnKeys.length - 1) {
          setSelectedCell({ rowIndex, columnKey: columnKeys[colIndex + 1] });
        } else if (rowIndex < (editableTableData?.length || 1) - 1) {
          setSelectedCell({ rowIndex: rowIndex + 1, columnKey: columnKeys[0] });
        }
      }
      tableContainerRef.current?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingCell(null);
      tableContainerRef.current?.focus();
    }
  };

  // Auto-save function (silent, no toast)
  const performAutoSave = async () => {
    if (!selectedSheetId || !editableTableData || !cleanedData) return;
    
    setAutoSaveStatus('saving');
    
    try {
      const fullPayload = {
        ...cleanedData,
        data: editableTableData,
      };
      
      await updateCleanedDataMutation.mutateAsync({
        sheetId: selectedSheetId,
        cleanedData: fullPayload,
      });
      
      // Clear change tracking after successful save
      setHasTableChanges(false);
      setModifiedCells(new Set());
      setAutoSaveStatus('saved');
      
      // Clear "saved" status after 3 seconds
      if (savedStatusTimeoutRef.current) {
        clearTimeout(savedStatusTimeoutRef.current);
      }
      savedStatusTimeoutRef.current = setTimeout(() => {
        setAutoSaveStatus('idle');
      }, 3000);
    } catch (e) {
      // On error, reset to idle (user can try again by making another change)
      setAutoSaveStatus('idle');
      toast.error((e as Error).message || 'Failed to auto-save');
    }
  };

  // Auto-save effect: triggers when user leaves a cell (editingCell becomes null) and there are changes
  useEffect(() => {
    // Only trigger save when user has left the cell (editingCell is null) and there are pending changes
    if (hasTableChanges && editableTableData && selectedSheetId && cleanedData && editingCell === null) {
      // Clear any existing timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      // Set a short timeout for auto-save (300ms after leaving cell)
      autoSaveTimeoutRef.current = setTimeout(() => {
        performAutoSave();
      }, 300);
    }
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [hasTableChanges, editableTableData, selectedSheetId, editingCell]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
      if (savedStatusTimeoutRef.current) clearTimeout(savedStatusTimeoutRef.current);
      if (jsonAutoSaveTimeoutRef.current) clearTimeout(jsonAutoSaveTimeoutRef.current);
    };
  }, []);

  // JSON auto-save function
  const performJsonAutoSave = async () => {
    if (!selectedSheetId || !editedJson || !cleanedData || jsonError) return;
    
    setAutoSaveStatus('saving');
    
    try {
      const parsedData = JSON.parse(editedJson);
      const fullPayload = {
        ...cleanedData,
        data: parsedData,
      };
      
      await updateCleanedDataMutation.mutateAsync({
        sheetId: selectedSheetId,
        cleanedData: fullPayload,
      });
      
      setHasJsonChanges(false);
      setAutoSaveStatus('saved');
      
      if (savedStatusTimeoutRef.current) {
        clearTimeout(savedStatusTimeoutRef.current);
      }
      savedStatusTimeoutRef.current = setTimeout(() => {
        setAutoSaveStatus('idle');
      }, 3000);
    } catch (e) {
      setAutoSaveStatus('idle');
      toast.error((e as Error).message || 'Failed to auto-save JSON');
    }
  };

  // JSON auto-save effect
  useEffect(() => {
    if (hasJsonChanges && editedJson && selectedSheetId && cleanedData && !jsonError) {
      if (jsonAutoSaveTimeoutRef.current) {
        clearTimeout(jsonAutoSaveTimeoutRef.current);
      }
      
      jsonAutoSaveTimeoutRef.current = setTimeout(() => {
        performJsonAutoSave();
      }, 1000);
    }
    
    return () => {
      if (jsonAutoSaveTimeoutRef.current) {
        clearTimeout(jsonAutoSaveTimeoutRef.current);
      }
    };
  }, [hasJsonChanges, editedJson, selectedSheetId, jsonError]);

  const handleCancelTableChanges = () => {
    if (cleanedData?.data && Array.isArray(cleanedData.data)) {
      initializeTableEditing(cleanedData.data);
    }
  };

  const handleAddRow = () => {
    if (!editableTableData || editableTableData.length === 0) return;
    
    const templateRow = editableTableData[0];
    const newRow: Record<string, any> = {};
    Object.keys(templateRow).forEach(key => {
      newRow[key] = null;
    });
    
    const newRowIndex = editableTableData.length;
    
    // Save typed undo entry for add-row operation
    setUndoStack(prev => [...prev, { 
      type: 'add-row', 
      rowIndex: newRowIndex, 
      rowData: JSON.parse(JSON.stringify(newRow)) 
    }]);
    setRedoStack([]); // Clear redo stack on new action
    
    setEditableTableData([...editableTableData, newRow]);
    setHasTableChanges(true);
  };

  const handleDeleteRow = (rowIndex: number) => {
    if (!editableTableData) return;
    
    // Capture the row data before deleting
    const deletedRowData = JSON.parse(JSON.stringify(editableTableData[rowIndex]));
    
    // Save typed undo entry for delete-row operation
    setUndoStack(prev => [...prev, { 
      type: 'delete-row', 
      rowIndex, 
      rowData: deletedRowData 
    }]);
    setRedoStack([]); // Clear redo stack on new action
    
    const newData = editableTableData.filter((_, i) => i !== rowIndex);
    setEditableTableData(newData);
    setHasTableChanges(true);
    
    const newModified = new Set<string>();
    modifiedCells.forEach(key => {
      const [idx] = key.split('-');
      const keyRowIndex = parseInt(idx);
      if (keyRowIndex < rowIndex) {
        newModified.add(key);
      } else if (keyRowIndex > rowIndex) {
        const [, col] = key.split('-');
        newModified.add(`${keyRowIndex - 1}-${col}`);
      }
    });
    setModifiedCells(newModified);
    setEditingCell(null);
  };

  // Helper function to get the display title for a sheet
  // Priority: cleanedData.title (AI-generated) > sheet.name (user-set or original)
  const getSheetDisplayTitle = (sheetId: string): string => {
    const sheetOriginal = sheets.find(s => s.id === sheetId);
    const sheetCleanedData = (sheetOriginal as any)?.cleanedData as { title?: string } | null;
    
    // Use AI-generated title if available
    if (sheetCleanedData?.title) {
      return sheetCleanedData.title;
    }
    
    // Fall back to sheet name (from sheets query which includes cleaningStatus, etc.)
    if ((sheetOriginal as any)?.name) {
      return (sheetOriginal as any).name;
    }
    
    // Final fallback to displayable sheets
    const displaySheet = displayableSheets.find(s => s.id === sheetId);
    return displaySheet?.name || 'Untitled';
  };

  // Handle double-click to start editing sheet title
  const handleSheetTitleDoubleClick = (e: React.MouseEvent, sheetId: string) => {
    e.stopPropagation();
    const currentTitle = getSheetDisplayTitle(sheetId);
    setEditingSheetTitleId(sheetId);
    setEditingSheetTitleValue(currentTitle);
    setTimeout(() => {
      sheetTitleInputRef.current?.focus();
      sheetTitleInputRef.current?.select();
    }, 0);
  };

  // Handle saving sheet title
  const handleSheetTitleSave = (sheetId: string) => {
    const newTitle = editingSheetTitleValue.trim();
    if (!newTitle || newTitle === getSheetDisplayTitle(sheetId)) {
      setEditingSheetTitleId(null);
      setEditingSheetTitleValue('');
      return;
    }
    
    // Get the current sheet's cleanedData
    const sheetOriginal = sheets.find(s => s.id === sheetId);
    const currentCleanedData = (sheetOriginal as any)?.cleanedData;
    
    // If cleanedData exists (AI has processed the sheet), update cleanedData.title
    // This preserves all AI-generated fields (type, data, metadata, etc.)
    if (currentCleanedData && typeof currentCleanedData === 'object' && currentCleanedData.data) {
      const updatedCleanedData = {
        ...currentCleanedData,
        title: newTitle
      };
      
      updateCleanedDataMutation.mutate(
        { sheetId, cleanedData: updatedCleanedData },
        {
          onSuccess: () => {
            toast.success('Title updated');
          },
          onError: () => {
            toast.error('Failed to update title');
          }
        }
      );
    } else {
      // No cleanedData yet (sheet still processing or pending)
      // Update the sheet name instead
      updateSheetMutation.mutate(
        { id: sheetId, data: { name: newTitle } },
        {
          onSuccess: () => {
            toast.success('Title updated');
          },
          onError: () => {
            toast.error('Failed to update title');
          }
        }
      );
    }
    
    setEditingSheetTitleId(null);
    setEditingSheetTitleValue('');
  };

  // Handle deleting a sheet
  const handleDeleteSheet = (e: React.MouseEvent, sheetId: string) => {
    e.stopPropagation();
    
    // If this is the selected sheet, clear selection and update localStorage
    if (selectedSheetId === sheetId) {
      // Find next available sheet to select
      const currentIndex = displayableSheets.findIndex(s => s.id === sheetId);
      const nextSheet = displayableSheets[currentIndex + 1] || displayableSheets[currentIndex - 1];
      const newSelectedId = nextSheet?.id || null;
      setSelectedSheetId(newSelectedId);
      
      // Update localStorage
      if (newSelectedId) {
        localStorage.setItem(SELECTED_SHEET_KEY, newSelectedId);
      } else {
        localStorage.removeItem(SELECTED_SHEET_KEY);
      }
    }
    
    deleteSheetMutation.mutate(sheetId, {
      onSuccess: () => {
        toast.success('Data source deleted');
      },
      onError: () => {
        toast.error('Failed to delete data source');
      }
    });
  };

  // Handle title input key down
  const handleSheetTitleKeyDown = (e: React.KeyboardEvent, sheetId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSheetTitleSave(sheetId);
    } else if (e.key === 'Escape') {
      setEditingSheetTitleId(null);
      setEditingSheetTitleValue('');
    }
  };
  
  return (
    <div className="flex flex-col h-full bg-[#1E1E1E]">
      {/* Confirmation dialog for switching sheets with unsaved changes */}
      {pendingSheetSwitch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1E1E1E] rounded-xl p-6 border border-[#2A2A2A] max-w-md shadow-xl">
            <h3 className="text-white font-medium mb-2">Unsaved Changes</h3>
            <p className="text-gray-400 text-sm mb-4">
              You have unsaved changes in the current table. Do you want to discard them and switch to another data source?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={cancelSheetSwitch}
                className="px-4 py-2 bg-[#2A2A2A] hover:bg-[#3A3A3A] text-white text-sm rounded-lg transition-colors"
              >
                Keep Editing
              </button>
              <button
                onClick={confirmSheetSwitch}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm rounded-lg transition-colors"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Header with Files/Data toggle */}
      <div className="flex-shrink-0 border-b border-[#2A2A2A]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={onAddData}
              className="p-1.5 bg-[#FF6B35] hover:bg-[#E55A2B] text-white rounded-lg transition-colors shrink-0"
              title="Add data source"
            >
              <Plus className="w-4 h-4" />
            </button>
            {selectedSheet && (
              <h3 className="text-sm font-medium text-white truncate">
                {cleanedData?.title || selectedSheet.name}
              </h3>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Files/Data Toggle */}
            <div className="flex bg-[#2A2A2A] rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('files')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'files'
                    ? 'bg-[#FF6B35] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Files
              </button>
              <button
                onClick={() => setViewMode('data')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'data'
                    ? 'bg-[#FF6B35] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Data
              </button>
            </div>
            <button
              onClick={onToggle}
              className="p-1.5 text-[#6B7280] hover:text-white hover:bg-[#2A2A2A] rounded transition-colors"
              title="Collapse panel"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Content area - split view */}
      <div className="flex-1 flex overflow-hidden">
        {/* Collapsed handle - visible thin bar when sources list is collapsed */}
        {isSourcesListCollapsed && (
          <div 
            onClick={() => setIsSourcesListCollapsed(false)}
            className="relative flex h-full cursor-pointer group/collapsed shrink-0"
            title="Expand sources list"
          >
            {/* Orange indicator lines for each data source - positioned flush left */}
            {displayableSheets.length > 0 && (
              <div className="w-[6px] h-full flex flex-col justify-center items-center gap-2 py-4 bg-[#1A1A1A] shrink-0">
                {displayableSheets.map((sheet) => (
                  <div
                    key={sheet.id}
                    className={`w-[2px] h-8 rounded-full shrink-0 transition-colors ${
                      selectedSheetId === sheet.id 
                        ? 'bg-[#FF6B35]' 
                        : 'bg-[#FF6B35]/30 group-hover/collapsed:bg-[#FF6B35]/50'
                    }`}
                  />
                ))}
              </div>
            )}
            {/* Collapse bar - entire bar turns subtle brown on hover */}
            <div className="w-[14px] min-w-[14px] h-full bg-[#2A2A2A] border-r border-[#2A2A2A] flex items-center justify-center shrink-0 group-hover/collapsed:bg-[#4b2e24] group-hover/collapsed:border-[#4b2e24] transition-colors">
              <ChevronRight className="w-3 h-3 text-gray-400 group-hover/collapsed:text-[#FF6B35] transition-colors" />
            </div>
          </div>
        )}
        
        {/* Sources list - collapsible sidebar */}
        {!isSourcesListCollapsed && (
          <div className="w-1/3 min-w-[180px] border-r border-[#2A2A2A] flex flex-col">
            {/* Sources list header with collapse button */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#2A2A2A] bg-[#1A1A1A] shrink-0">
              <span className="text-xs font-medium text-gray-400">Sources</span>
              <button
                onClick={() => setIsSourcesListCollapsed(true)}
                className="p-1 text-gray-500 hover:text-white hover:bg-[#2A2A2A] rounded transition-colors"
                title="Collapse sources list"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {/* Sources list content */}
            <div className="flex-1 overflow-y-auto">
              {displayableSheets.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-gray-500 text-sm">No captures in this workspace</p>
                </div>
              ) : (
            displayableSheets.map((sheet) => {
              const isSelected = selectedSheetId === sheet.id;
              const sheetOriginal = sheets.find(s => s.id === sheet.id);
              const sheetCleaningStatus = (sheetOriginal as any)?.cleaningStatus || 'pending';
              const displayTitle = getSheetDisplayTitle(sheet.id);
              const isEditingTitle = editingSheetTitleId === sheet.id;
              
              return (
                <div
                  key={sheet.id}
                  onClick={() => handleSelectSheet(sheet.id)}
                  className={`group p-3 border-b border-[#2A2A2A] cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#FF6B35]/10 border-l-2 border-l-[#FF6B35]' : 'hover:bg-[#252525]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {(sheet.type === 'screenshot' || sheet.type === 'capture') && <Image className="w-3.5 h-3.5 text-blue-400" />}
                      {sheet.type === 'file' && <FileText className="w-3.5 h-3.5 text-green-400" />}
                      {sheet.type === 'link' && <Link2 className="w-3.5 h-3.5 text-purple-400" />}
                      <span className="text-xs text-gray-400">{sheet.type}</span>
                    </div>
                    {/* Only show status badge if NOT completed (no "Ready" badge) */}
                    {viewMode === 'data' && sheetCleaningStatus !== 'completed' && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        sheetCleaningStatus === 'processing' ? 'bg-amber-500/20 text-amber-400' :
                        sheetCleaningStatus === 'failed' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {sheetCleaningStatus === 'processing' ? 'Processing' :
                         sheetCleaningStatus === 'failed' ? 'Failed' : 'Pending'}
                      </span>
                    )}
                  </div>
                  {/* Title row with delete button */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Title - editable on double-click */}
                      {isEditingTitle ? (
                        <input
                          ref={sheetTitleInputRef}
                          type="text"
                          value={editingSheetTitleValue}
                          onChange={(e) => setEditingSheetTitleValue(e.target.value)}
                          onBlur={() => handleSheetTitleSave(sheet.id)}
                          onKeyDown={(e) => handleSheetTitleKeyDown(e, sheet.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-sm text-white bg-[#2A2A2A] border border-[#FF6B35] rounded px-1.5 py-0.5 outline-none"
                          autoFocus
                        />
                      ) : (
                        <p 
                          className="text-sm text-white truncate cursor-text hover:text-[#FF6B35] transition-colors"
                          onDoubleClick={(e) => handleSheetTitleDoubleClick(e, sheet.id)}
                          title="Double-click to edit title"
                        >
                          {displayTitle}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">{sheet.date}</p>
                    </div>
                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDeleteSheet(e, sheet.id)}
                      className="p-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete data source"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
            </div>
          </div>
        )}
        
        {/* Selected source detail */}
        <div className="flex-1 overflow-y-auto p-4">
          
          {selectedSheet ? (
            viewMode === 'files' ? (
              /* FILES VIEW - Original raw data display */
              <div className="h-full flex flex-col">
                {/* Preview image */}
                {selectedSheet.preview && (
                  <div className="rounded-lg overflow-hidden border border-[#2A2A2A] mb-4 shrink-0">
                    <img 
                      src={selectedSheet.preview} 
                      alt={selectedSheet.name}
                      className="w-full h-48 object-cover"
                    />
                  </div>
                )}
                
                {/* Source info - with copyable link */}
                <div className="mb-4 shrink-0">
                  {/* Full link display - clickable to copy */}
                  {selectedSheet.type === 'link' ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => {
                            const fullUrl = selectedSheet.sourceUrl || selectedSheet.name;
                            navigator.clipboard.writeText(fullUrl);
                            toast.success('Link copied to clipboard');
                          }}
                          className="text-left w-full group"
                        >
                          <p className="text-sm text-purple-400 break-all hover:text-purple-300 transition-colors cursor-pointer">
                            {selectedSheet.sourceUrl || selectedSheet.name}
                          </p>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-[#2A2A2A] text-white border-[#3A3A3A]">
                        <p className="text-xs">Click to copy link</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <h3 className="text-lg font-medium text-white mb-2">{selectedSheet.name}</h3>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                    {(selectedSheet.type === 'screenshot' || selectedSheet.type === 'capture') && <Image className="w-3.5 h-3.5 text-blue-400" />}
                    {selectedSheet.type === 'file' && <FileText className="w-3.5 h-3.5 text-green-400" />}
                    {selectedSheet.type === 'link' && <Link2 className="w-3.5 h-3.5 text-purple-400" />}
                    <span className="capitalize">{selectedSheet.type}</span>
                    <span>•</span>
                    <span>{selectedSheet.date}</span>
                  </div>
                </div>
                
                {/* Raw data preview - expands to fill remaining space */}
                {originalSheet?.data && typeof originalSheet.data === 'object' && (
                  <div className="bg-[#212121] rounded-lg p-4 border border-[#2A2A2A] flex-1 flex flex-col min-h-0">
                    <h4 className="text-sm font-medium text-[#FF6B35] mb-3 shrink-0">Raw Data Preview</h4>
                    <div className="grid grid-cols-2 gap-3 overflow-y-auto flex-1">
                      {Object.entries(originalSheet.data as Record<string, any>)
                        .filter(([key]) => !['screenshot', 'screenshotUrl', 'preview'].includes(key))
                        .map(([key, value]) => (
                          <div key={key} className="bg-[#1A1A1A] rounded-lg p-3">
                            <p className="text-xs text-gray-400 mb-1">{key}</p>
                            <p className="text-sm font-medium text-white break-all">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* DATA VIEW - Cleaned JSON data display */
              <div className="h-full flex flex-col gap-4">
                {/* Data header with all controls in one row */}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Left side: View toggle buttons */}
                    {cleaningStatus === 'completed' && cleanedData?.data && (
                      <>
                        <button
                          onClick={() => { 
                            // Sync JSON edits back to table when switching to Table View
                            if (showRawJson && editedJson && !jsonError) {
                              try {
                                const parsed = JSON.parse(editedJson);
                                if (Array.isArray(parsed)) {
                                  setEditableTableData(parsed);
                                }
                              } catch (e) {
                                // Invalid JSON, don't sync
                              }
                            }
                            setShowRawJson(false); 
                            setIsEditing(false); 
                          }}
                          className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                            !showRawJson ? 'bg-[#FF6B35]/20 text-[#FF6B35]' : 'bg-[#2A2A2A] text-gray-400 hover:text-white'
                          }`}
                        >
                          Table View
                        </button>
                        <button
                          onClick={() => { 
                            setShowRawJson(true); 
                            setIsEditing(true);
                            // Use editableTableData (reflects table edits) instead of cleanedData
                            setEditedJson(JSON.stringify(editableTableData || cleanedData?.data || [], null, 2));
                            setJsonError(null);
                          }}
                          className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                            showRawJson ? 'bg-[#FF6B35]/20 text-[#FF6B35]' : 'bg-[#2A2A2A] text-gray-400 hover:text-white'
                          }`}
                        >
                          Raw JSON
                        </button>
                        
                        {/* Add Template button */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => {
                                // Open template editor with current data context
                                const columns = editableTableData && editableTableData.length > 0 
                                  ? Object.keys(editableTableData[0]).map((key, index) => ({
                                      id: `col-${index}`,
                                      canonicalName: key.toLowerCase().replace(/\s+/g, '_'),
                                      displayName: key,
                                      position: index,
                                      dataType: 'text' as const,
                                      isRequired: false,
                                    }))
                                  : [];
                                
                                openTemplateEditor({
                                  name: selectedSheet?.name ? `${selectedSheet.name} Template` : 'New Template',
                                  description: `Template created from ${selectedSheet?.name || 'data'}`,
                                  scope: 'workspace',
                                  columns,
                                });
                                toast.success('Template editor opened');
                              }}
                              className="px-2.5 py-1.5 text-xs rounded-lg transition-colors bg-[#2A2A2A] text-gray-400 hover:text-white hover:bg-[#FF6B35]/20 hover:text-[#FF6B35] flex items-center gap-1.5"
                            >
                              <FilePlus2 className="w-3.5 h-3.5" />
                              Add Template
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="bg-[#2A2A2A] text-white border-[#3A3A3A]">
                            <p className="text-xs">Create a template from this data</p>
                          </TooltipContent>
                        </Tooltip>
                        
                        {/* Undo/Redo buttons - always visible */}
                        <div className="flex items-center gap-1 border-l border-[#2A2A2A] pl-2">
                          <button
                            onClick={handleUndo}
                            disabled={undoStack.length === 0}
                            className={`p-1 rounded transition-colors ${
                              undoStack.length > 0 
                                ? 'text-gray-400 hover:text-white hover:bg-[#2A2A2A]' 
                                : 'text-gray-600 cursor-not-allowed'
                            }`}
                            title={`Undo (Ctrl+Z)${undoStack.length > 0 ? ` - ${undoStack.length} change${undoStack.length > 1 ? 's' : ''}` : ''}`}
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={handleRedo}
                            disabled={redoStack.length === 0}
                            className={`p-1 rounded transition-colors ${
                              redoStack.length > 0 
                                ? 'text-gray-400 hover:text-white hover:bg-[#2A2A2A]' 
                                : 'text-gray-600 cursor-not-allowed'
                            }`}
                            title={`Redo (Ctrl+Y)${redoStack.length > 0 ? ` - ${redoStack.length} change${redoStack.length > 1 ? 's' : ''}` : ''}`}
                          >
                            <Redo2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        
                        {/* Copy button with tooltip */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => {
                                const jsonStr = JSON.stringify(cleanedData.data, null, 2);
                                copyToClipboard(jsonStr);
                                toast.success('JSON copied to clipboard');
                              }}
                              className="p-1 text-gray-400 hover:text-white hover:bg-[#2A2A2A] rounded transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="bg-[#2A2A2A] text-white border-[#3A3A3A]">
                            <p className="text-xs">Copy data as JSON</p>
                          </TooltipContent>
                        </Tooltip>
                        
                        {/* Auto-save status indicator - always at the end */}
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 border-l border-[#2A2A2A] pl-2">
                          {autoSaveStatus === 'saving' ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF6B35]" />
                              <span>Saving...</span>
                            </>
                          ) : autoSaveStatus === 'saved' ? (
                            <>
                              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                              <Check className="w-3 h-3 text-emerald-400 -ml-2.5 mt-0.5" />
                              <span className="text-emerald-400">Saved</span>
                            </>
                          ) : (
                            <>
                              <Cloud className="w-3.5 h-3.5 text-gray-500" />
                            </>
                          )}
                        </div>
                      </>
                    )}
                    
                    {/* Spacer to push right side items to the end */}
                    <div className="flex-1" />
                    
                    {/* Right side: Quality Score and Processed status */}
                    {cleaningStatus === 'completed' && qualityScore !== null && (
                      <button
                        onClick={() => setShowQualityDetails(!showQualityDetails)}
                        className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded cursor-pointer transition-colors ${getQualityBgColor(qualityScore)} ${getQualityColor(qualityScore)} hover:opacity-80`}
                        title="Click to see quality details"
                      >
                        <span className="font-semibold">{qualityScore}%</span>
                        <span>Quality</span>
                        <ChevronDown className={`w-3 h-3 transition-transform ${showQualityDetails ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                    <span className={`text-xs px-2 py-1 rounded ${
                      cleaningStatus === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                      cleaningStatus === 'processing' ? 'bg-amber-500/20 text-amber-400' :
                      cleaningStatus === 'failed' ? 'bg-red-500/20 text-red-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {cleaningStatus === 'completed' 
                        ? cleanedData?.metadata?.extractedAt 
                          ? `Processed ${new Date(cleanedData.metadata.extractedAt).toLocaleDateString()}`
                          : 'AI Processed'
                        : cleaningStatus === 'processing' ? 'Processing...' :
                          cleaningStatus === 'failed' ? 'Processing Failed' : 'Awaiting Processing'}
                    </span>
                  </div>
                  
                  {/* Expandable Quality Details Panel */}
                  {showQualityDetails && qualityDetails && (
                    <div className="bg-[#212121] rounded-lg p-4 border border-[#2A2A2A] mt-3 animate-in slide-in-from-top-2">
                      <h4 className="text-sm font-medium text-white mb-3">Quality Breakdown</h4>
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div className="text-center">
                          <div className={`text-2xl font-bold ${getQualityColor(qualityDetails.confidence)}`}>
                            {qualityDetails.confidence}%
                          </div>
                          <div className="text-xs text-gray-400 mt-1">Confidence</div>
                          <div className="w-full h-1.5 bg-[#2A2A2A] rounded-full mt-2">
                            <div 
                              className={`h-full rounded-full ${qualityDetails.confidence >= 80 ? 'bg-emerald-500' : qualityDetails.confidence >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${qualityDetails.confidence}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-center">
                          <div className={`text-2xl font-bold ${getQualityColor(qualityDetails.completeness)}`}>
                            {qualityDetails.completeness}%
                          </div>
                          <div className="text-xs text-gray-400 mt-1">Completeness</div>
                          <div className="w-full h-1.5 bg-[#2A2A2A] rounded-full mt-2">
                            <div 
                              className={`h-full rounded-full ${qualityDetails.completeness >= 80 ? 'bg-emerald-500' : qualityDetails.completeness >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${qualityDetails.completeness}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-center">
                          <div className={`text-2xl font-bold ${getQualityColor(qualityDetails.dataRichness)}`}>
                            {qualityDetails.dataRichness}%
                          </div>
                          <div className="text-xs text-gray-400 mt-1">Data Richness</div>
                          <div className="w-full h-1.5 bg-[#2A2A2A] rounded-full mt-2">
                            <div 
                              className={`h-full rounded-full ${qualityDetails.dataRichness >= 80 ? 'bg-emerald-500' : qualityDetails.dataRichness >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${qualityDetails.dataRichness}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      {qualityDetails.issues && qualityDetails.issues.length > 0 && (
                        <div className="border-t border-[#2A2A2A] pt-3">
                          <p className="text-xs text-gray-400 mb-2">Issues Found:</p>
                          <ul className="space-y-1">
                            {qualityDetails.issues.map((issue, i) => (
                              <li key={i} className="text-xs text-amber-400 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                {issue}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {cleaningStatus === 'completed' && cleanedData?.data ? (
                  <>

                    {isEditing ? (
                      /* Edit JSON View - Auto-saves like table view */
                      <div className="flex-1 flex flex-col gap-3 min-h-0">
                        <div className="bg-[#212121] rounded-lg border border-[#2A2A2A] overflow-hidden flex-1 flex flex-col min-h-0">
                          <textarea
                            value={editedJson}
                            onChange={(e) => {
                              setEditedJson(e.target.value);
                              try {
                                JSON.parse(e.target.value);
                                setJsonError(null);
                                setHasJsonChanges(true);
                              } catch {
                                setJsonError('Invalid JSON syntax');
                              }
                            }}
                            className="w-full flex-1 p-4 text-xs text-gray-300 bg-transparent font-mono resize-none outline-none"
                            spellCheck={false}
                          />
                        </div>
                        {jsonError && (
                          <p className="shrink-0 text-xs text-red-400">{jsonError}</p>
                        )}
                        <p className="shrink-0 text-xs text-gray-500 text-center">
                          Edit JSON directly • Changes auto-save
                        </p>
                      </div>
                    ) : (
                      /* Table View - Excel/Google Sheets style editing */
                      <div className="flex-1 flex flex-col gap-3 min-h-0">
                        <div 
                          ref={tableContainerRef}
                          tabIndex={0}
                          onKeyDown={handleTableKeyDown}
                          className="bg-[#212121] rounded-lg border border-[#2A2A2A] overflow-hidden focus:outline-none flex-1 flex flex-col min-h-0"
                        >
                          <div className="overflow-auto flex-1 relative">
                            {editableTableData && editableTableData.length > 0 ? (() => {
                              const columnKeys = Object.keys(editableTableData[0] || {});
                              return (
                                <table className="w-full text-sm table-fixed">
                                  <colgroup>
                                    <col style={{ width: '48px' }} />
                                    {columnKeys.map((key) => (
                                      <col key={key} style={{ width: columnWidths[key] || 150 }} />
                                    ))}
                                    <col style={{ width: '40px' }} />
                                  </colgroup>
                                  <thead className="sticky top-0 z-20">
                                    <tr className="bg-[#252525]">
                                      <th className="px-3 h-9 text-center text-xs font-semibold text-gray-500 whitespace-nowrap border-r border-b border-[#2A2A2A] bg-[#252525]">
                                        #
                                      </th>
                                      {columnKeys.map((key) => (
                                        <th 
                                          key={key} 
                                          className="h-9 text-left text-xs font-semibold text-gray-300 whitespace-nowrap border-b border-[#2A2A2A] bg-[#252525] relative group"
                                          style={{ width: columnWidths[key] || 150 }}
                                        >
                                          <div className="px-3 truncate">{key}</div>
                                          <div 
                                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#FF6B35] bg-transparent group-hover:bg-[#3A3A3A] transition-colors"
                                            onMouseDown={(e) => handleResizeStart(e, key)}
                                          />
                                        </th>
                                      ))}
                                      <th className="h-9 text-center text-xs font-semibold text-gray-500 whitespace-nowrap border-b border-[#2A2A2A] bg-[#252525]">
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {editableTableData.slice(0, 50).map((row: any, rowIndex: number) => (
                                      <tr 
                                        key={rowIndex} 
                                        className={`group ${rowIndex % 2 === 1 ? 'bg-[#1A1A1A]' : 'bg-[#212121]'}`}
                                      >
                                        <td className="px-3 h-9 text-center text-xs text-gray-500 font-mono border-r border-[#2A2A2A] bg-[#1E1E1E]">
                                          {rowIndex + 1}
                                        </td>
                                        {columnKeys.map((columnKey) => {
                                          const value = row[columnKey];
                                          const isSelectedCell = selectedCell?.rowIndex === rowIndex && selectedCell?.columnKey === columnKey;
                                          const isEditingThisCell = editingCell?.rowIndex === rowIndex && editingCell?.columnKey === columnKey;
                                          
                                          return (
                                            <td 
                                              key={columnKey} 
                                              className={`h-9 text-gray-300 cursor-cell relative select-none overflow-hidden ${
                                                isSelectedCell 
                                                  ? 'outline outline-2 outline-[#FF6B35] outline-offset-[-2px]' 
                                                  : 'hover:bg-[#2A2A2A]/30'
                                              }`}
                                              style={{ width: columnWidths[columnKey] || 150 }}
                                              onClick={(e) => !isEditingThisCell && handleCellClick(e, rowIndex, columnKey)}
                                              onDoubleClick={() => !isEditingThisCell && handleCellDoubleClick(rowIndex, columnKey, value)}
                                            >
                                              {isEditingThisCell ? (
                                                <input
                                                  ref={editInputRef}
                                                  type="text"
                                                  value={editCellValue}
                                                  onChange={(e) => handleCellChange(e.target.value)}
                                                  onBlur={() => commitCellEdit(rowIndex, columnKey, editCellValue)}
                                                  onKeyDown={(e) => handleCellInputKeyDown(e, rowIndex, columnKey)}
                                                  className="absolute inset-0 w-full h-full px-3 bg-transparent text-white outline outline-2 outline-[#FF6B35] text-sm"
                                                  autoFocus
                                                />
                                              ) : (
                                                <div className="px-3 h-full flex items-center">
                                                  <span className="truncate">
                                                    {value === null ? <span className="text-gray-500 italic">null</span> :
                                                     typeof value === 'object' ? JSON.stringify(value) :
                                                     String(value)}
                                                  </span>
                                                </div>
                                              )}
                                            </td>
                                          );
                                        })}
                                        <td className="h-9 text-center">
                                          <button
                                            onClick={() => handleDeleteRow(rowIndex)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                                            title="Delete row"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              );
                            })() : (
                              <div className="p-4 text-center text-gray-500 text-sm">
                                No tabular data available
                              </div>
                            )}
                          </div>
                          {editableTableData && editableTableData.length > 50 && (
                            <div className="px-3 py-2 bg-[#2A2A2A] text-xs text-gray-400 text-center">
                              Showing 50 of {editableTableData.length} records
                            </div>
                          )}
                        </div>
                        
                        {/* Add Row button */}
                        {editableTableData && editableTableData.length > 0 && (
                          <button
                            onClick={handleAddRow}
                            className="shrink-0 w-full py-2 px-4 bg-[#2A2A2A] hover:bg-[#3A3A3A] text-gray-400 hover:text-white text-xs rounded-lg transition-colors flex items-center justify-center gap-2 border border-dashed border-[#3A3A3A] hover:border-[#FF6B35]/50"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Row
                          </button>
                        )}
                        
                        {/* Hint text */}
                        <p className="shrink-0 text-xs text-gray-500 text-center">
                          Click to select • Type to edit • Arrow keys to navigate • Ctrl+Z undo • Drag column edges to resize
                        </p>
                      </div>
                    )}
                  </>
                ) : cleaningStatus === 'processing' ? (
                  <div className="bg-[#212121] rounded-lg p-8 border border-[#2A2A2A] text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-[#FF6B35] border-t-transparent rounded-full mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">AI is cleaning and structuring your data...</p>
                    <p className="text-gray-500 text-xs mt-1">This may take a few moments</p>
                  </div>
                ) : cleaningStatus === 'failed' ? (
                  <div className="bg-[#212121] rounded-lg p-8 border border-red-500/30 text-center">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
                      <X className="w-6 h-6 text-red-400" />
                    </div>
                    <p className="text-white font-medium mb-2">
                      {validationResult?.failureType === 'empty_image' ? 'Empty Screenshot Detected' :
                       validationResult?.failureType === 'low_quality' ? 'Low Quality Image' :
                       validationResult?.failureType === 'no_data_found' ? 'No Data Found' :
                       'Processing Failed'}
                    </p>
                    <p className="text-gray-400 text-sm max-w-md mx-auto">
                      {validationResult?.message || 'Failed to process this data source. Please try again or upload a different file.'}
                    </p>
                    {validationResult?.failureType === 'no_data_found' && (
                      <div className="mt-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                        <p className="text-amber-400 text-xs">
                          For Google Sheets: Make sure it's shared with "Anyone with the link can view"
                        </p>
                      </div>
                    )}
                    {validationResult?.failureType === 'empty_image' && (
                      <p className="text-amber-400 text-xs mt-2">
                        Please upload a clearer screenshot with visible data.
                      </p>
                    )}
                    <button
                      onClick={handleRetry}
                      disabled={retryProcessingMutation.isPending}
                      className="mt-4 px-4 py-2 bg-gradient-to-r from-[#FF6B35] to-[#E55A2B] hover:from-[#E55A2B] hover:to-[#D04A1B] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all"
                    >
                      {retryProcessingMutation.isPending ? 'Retrying...' : 'Retry Processing'}
                    </button>
                  </div>
                ) : (
                  <div className="bg-[#212121] rounded-lg p-8 border border-[#2A2A2A] text-center">
                    <div className="animate-pulse">
                      <Database className="w-12 h-12 text-[#FF6B35] mx-auto mb-3" />
                    </div>
                    <p className="text-gray-400 text-sm">Processing will start automatically</p>
                    <p className="text-gray-500 text-xs mt-1">The system will process this data shortly...</p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#FF6B35] animate-pulse" />
                      <span className="text-xs text-gray-500">Waiting for processing queue</span>
                    </div>
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Database className="w-12 h-12 text-[#3A3A3A] mb-3" />
              <p className="text-gray-400 text-sm">
                {displayableSheets.length === 0 
                  ? 'No captures in this workspace yet' 
                  : 'Select a data source to view details'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
