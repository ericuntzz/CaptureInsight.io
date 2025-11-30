import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
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
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useChat } from '../hooks/useChat';
import { useInsights, useInsight, useCreateInsight, useUpdateInsight, useDeleteInsight } from '../hooks/useInsights';
import { 
  useChatConversations, 
  useCreateChatConversation, 
  useUpdateChatConversation, 
  useDeleteChatConversation,
} from '../hooks/useChatConversations';
import { useWorkspaceSheets, type Sheet } from '../hooks/useSheets';
import { RichTextEditor } from '../components/RichTextEditor';
import { copyToClipboard } from '../utils/clipboard';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '../components/ui/resizable';
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

export function InsightWorkspace({ spaceId, insightId, onSidebarCollapse, workspaceId }: InsightWorkspaceProps) {
  useAuth();
  
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
  
  // Track pending saves for debouncing
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<{ title: string; summary: string }>({ title: '', summary: '' });
  
  // Data sources state
  const [sources, setSources] = useState<InsightSource[]>([]);
  const [sheetsData, setSheetsData] = useState<Record<string, any>>({});
  
  // Chat state
  const [aiChatInput, setAiChatInput] = useState('');
  const aiChatContainerRef = useRef<HTMLDivElement>(null);
  
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
    lastWorkspaceIdRef.current = workspaceId ?? null;
  }, [workspaceId]);
  
  // Sync tabs with API data - runs whenever workspaceInsights changes (including after deletions)
  useEffect(() => {
    if (isLoadingInsights) return;
    
    // Create a signature of current insight IDs to detect changes
    const currentInsightIds = workspaceInsights.map(i => i.id).sort().join(',');
    const workspaceChanged = lastWorkspaceIdRef.current !== workspaceId;
    const insightsChanged = lastInsightIdsRef.current !== currentInsightIds;
    
    // Only update if workspace changed or insights changed (including deletions)
    if (!workspaceChanged && !insightsChanged) return;
    
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
      
      // If current active tab was deleted, switch to first available
      const activeTabStillExists = insightTabs.some(t => t.id === activeTabId);
      
      setOpenTabs(insightTabs);
      
      if (!activeTabStillExists || activeTabId === 'loading' || activeTabId === 'new') {
        setActiveTabId(insightTabs[0].id);
        setLocalTitle(insightTabs[0].title);
        setNotes(insightTabs[0].summary);
        lastSavedContentRef.current = { title: insightTabs[0].title, summary: insightTabs[0].summary };
      }
    } else {
      setOpenTabs([{ id: 'new', title: 'Untitled Insight', summary: '', isSaved: false }]);
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
  
  const { messages: chatMessages, sendMessage, isLoading: isAiTyping, isLoadingHistory, historyLoadError, retryLoadHistory } = useChat({
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
  
  // Chat handlers
  const handleSendMessage = async () => {
    if (!aiChatInput.trim()) return;
    const messageContent = aiChatInput.trim();
    setAiChatInput('');
    
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
    
    await sendMessage(messageContent);
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
    if (tabToClose?.isSaved && tabToClose?.dbId && spaceId) {
      deleteInsightMutation.mutate(
        { id: tabToClose.dbId, spaceId },
        {
          onSuccess: () => {
            toast.success('Insight deleted');
          },
          onError: () => {
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
        
        {chatMessages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 group ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className="relative max-w-[85%] rounded-lg p-3 transition-all bg-[#1A1F2E] text-[#E5E7EB]">
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p className="text-xs opacity-60 mt-1">{formatRelativeTime(message.timestamp)}</p>
              
              <div className="absolute -top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#1A1F2E] border border-[#2D3B4E] rounded px-1 py-1">
                <button
                  onClick={() => handleCopyMessage(message.content)}
                  className="p-1 text-[#6B7280] hover:text-white transition-colors"
                  title="Copy message"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {isAiTyping && (
          <div className="flex gap-3">
            <div className="bg-[#1A1F2E] rounded-lg p-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-[#6B7280] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-[#6B7280] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-[#6B7280] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
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
              className="w-full text-xl text-white bg-transparent border-none outline-none focus:opacity-80 transition-opacity mb-6"
              placeholder="Add a title..."
            />
            
            <div className="bg-[#1A1A1A] rounded-lg min-h-[400px]">
              <RichTextEditor
                key={activeTabId}
                content={notes}
                onChange={setNotes}
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
}

interface DisplayableSheet {
  id: string;
  name: string;
  type: 'screenshot' | 'file' | 'link' | 'capture';
  preview: string | null;
  date: string;
  rowCount: number | null;
  dataSourceMeta: any;
}

function transformSheetToDisplayable(sheet: Sheet): DisplayableSheet {
  const meta = sheet.dataSourceMeta as { preview?: string; url?: string; screenshotUrl?: string } | null;
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
  
  return {
    id: sheet.id,
    name: sheet.name,
    type,
    preview,
    date,
    rowCount: sheet.rowCount,
    dataSourceMeta: sheet.dataSourceMeta,
  };
}

function DataSourcesPanel({ sheets, sources: _sources, sheetsData: _sheetsData, onToggle, onEditData: _onEditData, onRemoveSource: _onRemoveSource }: DataSourcesPanelProps) {
  void _sources; void _sheetsData; void _onEditData; void _onRemoveSource;
  const [activeTab, setActiveTab] = useState<'all' | 'screenshots' | 'files' | 'links'>('all');
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  
  const displayableSheets = sheets.map(transformSheetToDisplayable);
  
  useEffect(() => {
    if (displayableSheets.length > 0 && !selectedSheetId) {
      setSelectedSheetId(displayableSheets[0].id);
    } else if (displayableSheets.length === 0) {
      setSelectedSheetId(null);
    }
  }, [displayableSheets.length, selectedSheetId]);
  
  const filteredSheets = displayableSheets.filter(sheet => {
    if (activeTab === 'all') return true;
    if (activeTab === 'screenshots') return sheet.type === 'screenshot' || sheet.type === 'capture';
    if (activeTab === 'files') return sheet.type === 'file';
    if (activeTab === 'links') return sheet.type === 'link';
    return true;
  });
  
  const selectedSheet = displayableSheets.find(s => s.id === selectedSheetId) || null;
  const originalSheet = sheets.find(s => s.id === selectedSheetId);
  
  return (
    <div className="flex flex-col h-full bg-[#1E1E1E]">
      {/* Header with tabs */}
      <div className="flex-shrink-0 border-b border-[#2A2A2A]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#FF6B35]" />
            <span className="text-sm font-medium text-white">Data Sources</span>
            <span className="px-2 py-0.5 bg-[#2A2F3E] rounded-full text-xs text-gray-400">
              {displayableSheets.length}
            </span>
          </div>
          <button
            onClick={onToggle}
            className="p-1.5 text-[#6B7280] hover:text-white hover:bg-[#2A2A2A] rounded transition-colors"
            title="Collapse Data Sources"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-t border-[#2A2A2A]">
          {(['all', 'screenshots', 'files', 'links'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'text-[#FF6B35] border-b-2 border-[#FF6B35] bg-[#FF6B35]/5'
                  : 'text-gray-400 hover:text-white hover:bg-[#252525]'
              }`}
            >
              {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      {/* Content area - split view */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sources list */}
        <div className="w-1/3 border-r border-[#2A2A2A] overflow-y-auto">
          {filteredSheets.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-gray-500 text-sm">No captures in this workspace</p>
            </div>
          ) : (
            filteredSheets.map((sheet) => {
              const isSelected = selectedSheetId === sheet.id;
              
              return (
                <div
                  key={sheet.id}
                  onClick={() => setSelectedSheetId(sheet.id)}
                  className={`p-3 border-b border-[#2A2A2A] cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#FF6B35]/10 border-l-2 border-l-[#FF6B35]' : 'hover:bg-[#252525]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {(sheet.type === 'screenshot' || sheet.type === 'capture') && <Image className="w-3.5 h-3.5 text-blue-400" />}
                    {sheet.type === 'file' && <FileText className="w-3.5 h-3.5 text-green-400" />}
                    {sheet.type === 'link' && <Link2 className="w-3.5 h-3.5 text-purple-400" />}
                    <span className="text-xs text-gray-400">{sheet.type}</span>
                  </div>
                  <p className="text-sm text-white truncate">{sheet.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{sheet.date}</p>
                </div>
              );
            })
          )}
        </div>
        
        {/* Selected source detail */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedSheet ? (
            <div className="space-y-4">
              {/* Preview image */}
              {selectedSheet.preview && (
                <div className="rounded-lg overflow-hidden border border-[#2A2A2A]">
                  <img 
                    src={selectedSheet.preview} 
                    alt={selectedSheet.name}
                    className="w-full h-48 object-cover"
                  />
                </div>
              )}
              
              {/* Source info */}
              <div>
                <h3 className="text-lg font-medium text-white mb-2">{selectedSheet.name}</h3>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  {(selectedSheet.type === 'screenshot' || selectedSheet.type === 'capture') && <Image className="w-3.5 h-3.5 text-blue-400" />}
                  {selectedSheet.type === 'file' && <FileText className="w-3.5 h-3.5 text-green-400" />}
                  {selectedSheet.type === 'link' && <Link2 className="w-3.5 h-3.5 text-purple-400" />}
                  <span className="capitalize">{selectedSheet.type}</span>
                  <span>•</span>
                  <span>{selectedSheet.date}</span>
                  {selectedSheet.rowCount !== null && selectedSheet.rowCount > 0 && (
                    <>
                      <span>•</span>
                      <span>{selectedSheet.rowCount} rows</span>
                    </>
                  )}
                </div>
              </div>
              
              {/* Data preview */}
              {originalSheet?.data && typeof originalSheet.data === 'object' && (
                <div className="bg-[#212121] rounded-lg p-4 border border-[#2A2A2A]">
                  <h4 className="text-sm font-medium text-[#FF6B35] mb-3">Data Preview</h4>
                  <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                    {Object.entries(originalSheet.data as Record<string, any>)
                      .filter(([key]) => !['screenshot', 'screenshotUrl', 'preview'].includes(key))
                      .slice(0, 10)
                      .map(([key, value]) => (
                        <div key={key} className="bg-[#1A1A1A] rounded-lg p-3">
                          <p className="text-xs text-gray-400 mb-1 truncate">{key}</p>
                          <p className="text-sm font-medium text-white truncate">
                            {typeof value === 'object' ? JSON.stringify(value).slice(0, 50) : String(value).slice(0, 50)}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              
              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => toast.info('Edit functionality coming soon!')}
                  className="flex-1 py-2 px-4 bg-[#2A2A2A] hover:bg-[#3A3A3A] text-white text-sm rounded-lg transition-colors"
                >
                  Edit Data
                </button>
                <button
                  onClick={() => {
                    toast.info('Remove functionality coming soon!');
                  }}
                  className="py-2 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
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
      
      {/* Add source button */}
      <div className="flex-shrink-0 p-4 border-t border-[#2A2A2A]">
        <button
          onClick={() => toast.info('Add data source functionality coming soon!')}
          className="w-full py-2.5 bg-gradient-to-r from-[#FF6B35] to-[#E55A2B] hover:from-[#E55A2B] hover:to-[#D04A1B] text-white text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Data Source
        </button>
      </div>
    </div>
  );
}
