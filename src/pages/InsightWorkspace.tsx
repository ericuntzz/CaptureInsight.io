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
  Sparkles,
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
import { useInsight } from '../hooks/useInsights';
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
}

interface InsightWorkspaceProps {
  onBack: () => void;
  spaceId: string | null;
  insightId?: string | null;
  onSidebarCollapse?: (collapsed: boolean) => void;
}

export function InsightWorkspace({ spaceId, insightId, onSidebarCollapse }: InsightWorkspaceProps) {
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
  
  // Panel order as array - supports drag-and-drop reordering
  // Order determines visual position: index 0 = left, index 1 = center, index 2 = right
  type PanelId = 'chat' | 'canvas' | 'data';
  const PANEL_ORDER_STORAGE_KEY = 'insight-workspace-panel-order';
  
  const getInitialPanelOrder = (): PanelId[] => {
    try {
      const saved = localStorage.getItem(PANEL_ORDER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 3) {
          return parsed as PanelId[];
        }
      }
    } catch (e) {
      console.error('Failed to load panel order from localStorage:', e);
    }
    return ['chat', 'canvas', 'data'];
  };
  
  const [panelOrder, setPanelOrder] = useState<PanelId[]>(getInitialPanelOrder);
  const [activeDragId, setActiveDragId] = useState<PanelId | null>(null);
  
  // Save panel order to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(PANEL_ORDER_STORAGE_KEY, JSON.stringify(panelOrder));
    } catch (e) {
      console.error('Failed to save panel order to localStorage:', e);
    }
  }, [panelOrder]);
  
  // Get order index for a panel (1-based for react-resizable-panels)
  const getPanelOrderIndex = (panelId: PanelId): number => {
    return panelOrder.indexOf(panelId) + 1;
  };
  
  // DnD sensors
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
    setActiveDragId(event.active.id as PanelId);
  };
  
  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    
    if (over && active.id !== over.id) {
      setPanelOrder((items) => {
        const oldIndex = items.indexOf(active.id as PanelId);
        const newIndex = items.indexOf(over.id as PanelId);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };
  
  // Calculate continuous opacity for smooth fade during drag (fade between 4% and 10%)
  const getContentOpacity = (size: number) => {
    if (size <= 4) return 0;
    if (size >= 10) return 1;
    return (size - 4) / 6; // Linear fade from 4% to 10%
  };
  
  const getCollapsedOpacity = (size: number) => {
    if (size <= 4) return 1;
    if (size >= 10) return 0;
    return 1 - (size - 4) / 6; // Inverse of content opacity
  };
  
  // Insight tabs state
  const [openTabs, setOpenTabs] = useState<InsightTab[]>([
    { id: 'default', title: 'Untitled Insight', summary: '' }
  ]);
  const [activeTabId, setActiveTabId] = useState('default');
  
  // Canvas state
  const [viewMode, setViewMode] = useState<'default' | 'slide'>('default');
  const [notes, setNotes] = useState('');
  const [localTitle, setLocalTitle] = useState('Untitled Insight');
  
  // Data sources state
  const [sources, setSources] = useState<InsightSource[]>([]);
  const [sheetsData, setSheetsData] = useState<Record<string, any>>({});
  
  // Chat state
  const [aiChatInput, setAiChatInput] = useState('');
  const aiChatContainerRef = useRef<HTMLDivElement>(null);
  
  const activeInsightId = insightId || activeTabId;
  
  const { messages: chatMessages, sendMessage, isLoading: isAiTyping } = useChat({
    spaceId,
    insightId: activeInsightId,
  });
  
  const { data: insight } = useInsight(insightId || null);
  
  // Auto-collapse left sidebar when workspace opens
  useEffect(() => {
    onSidebarCollapse?.(true);
    return () => {
      onSidebarCollapse?.(false);
    };
  }, [onSidebarCollapse]);
  
  // Load insight data
  useEffect(() => {
    if (insight) {
      setLocalTitle(insight.title || 'Untitled Insight');
      setNotes(insight.summary || '');
    }
  }, [insight]);
  
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
  
  // Expand canvas - swap to normal order, collapse data, keep chat as-is
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
    setPanelOrder('normal');
  }, [isCanvasCollapsed, isDataCollapsed, chatManuallyCollapsed]);
  
  // Expand data - swap to put data next to chat, collapse canvas, keep chat as-is
  const handleExpandData = useCallback(() => {
    // If data is already large (not collapsed), restore to normal sizes
    if (!isDataCollapsed && isCanvasCollapsed) {
      // Data is expanded, restore both to normal sizes
      dataPanelRef.current?.resize(25);
      canvasPanelRef.current?.resize(45);
      setPanelOrder('normal');
    } else {
      // Expand data fully, collapse canvas, swap order so data is next to chat
      // Don't touch chat - respect chatManuallyCollapsed
      dataPanelRef.current?.resize(chatManuallyCollapsed ? 72 : 67);
      canvasPanelRef.current?.resize(3);
      setPanelOrder('swapped');
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
    await sendMessage(messageContent);
  };
  
  const handleCopyMessage = (content: string) => {
    copyToClipboard(content);
    toast.success('Message copied!');
  };
  
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };
  
  // Tab handlers
  const handleCreateNewInsight = () => {
    const newTab: InsightTab = {
      id: `insight-${Date.now()}`,
      title: 'New Chat Insight',
      summary: '',
    };
    setOpenTabs([...openTabs, newTab]);
    setActiveTabId(newTab.id);
    setLocalTitle(newTab.title);
    setNotes('');
  };
  
  const handleCloseTab = (tabId: string) => {
    if (openTabs.length <= 1) return;
    const newTabs = openTabs.filter(t => t.id !== tabId);
    setOpenTabs(newTabs);
    if (activeTabId === tabId) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  };
  
  const handleSwitchTab = (tabId: string) => {
    const tab = openTabs.find(t => t.id === tabId);
    if (tab) {
      setActiveTabId(tabId);
      setLocalTitle(tab.title);
      setNotes(tab.summary);
    }
  };
  
  // Update tab when title changes
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



  // Chat Panel Content
  const ChatPanelContent = () => (
    <div className="flex flex-col h-full bg-[#1A1A1A]">
      <div className="flex items-center justify-end p-2 border-b border-[#2A2A2A]">
        <button
          onClick={handleCollapseChat}
          className="p-1.5 text-[#6B7280] hover:text-white hover:bg-[#2A2A2A] rounded transition-colors"
          title="Collapse Chat"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
      
      <div
        ref={aiChatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 scrollbar-hide"
      >
        {chatMessages.length === 0 && (
          <div className="text-center py-8">
            <Sparkles className="w-8 h-8 mx-auto mb-3 text-[#FF6B35] opacity-50" />
            <p className="text-white mb-1">Start a conversation about this insight</p>
            <p className="text-xs text-[#6B7280]">Ask questions, get analysis, or brainstorm ideas (only you can see this chat)</p>
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
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="Ask about this insight... (Press Enter to send)"
          className="w-full px-4 py-3 bg-[#1A1F2E] border border-[#2D3B4E] text-white placeholder:text-[#6B7280] outline-none focus:border-[#FF6B35] transition-colors rounded-[43px] text-[13px]"
        />
      </div>
    </div>
  );

  // Canvas Panel Content
  const CanvasPanelContent = () => (
    <div className="flex flex-col h-full bg-[#212121]">
      <div className="flex-shrink-0 bg-[#1E1E1E]">
        <div className="flex items-center justify-between px-6 py-4 bg-[rgb(33,33,33)]">
          <div className="flex items-center gap-2 overflow-x-auto flex-1">
            {openTabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#2A2A2A] text-white'
                      : 'text-[#9CA3AF] hover:text-white hover:bg-[#252525]'
                  }`}
                  onClick={() => handleSwitchTab(tab.id)}
                >
                  <span className="text-sm whitespace-nowrap max-w-[200px] truncate">
                    {tab.title}
                  </span>
                  {openTabs.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseTab(tab.id);
                      }}
                      className="text-[#6B7280] hover:text-white transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
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
      
      <div className="flex-1 overflow-y-auto">
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
                <div className="flex-1 border-2 border-[#E0E0E0] rounded p-6 overflow-y-auto">
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

  // Data Sources Panel Content
  const DataSourcesPanelContent = () => (
    <DataSourcesPanel
      sources={sources}
      sheetsData={sheetsData}
      onToggle={handleCollapseData}
      onEditData={handleEditData}
      onRemoveSource={handleRemoveSource}
    />
  );

  // Collapsed rail inside a panel
  const CollapsedPanelContent = ({ 
    type, 
    onClick, 
    direction 
  }: { 
    type: 'chat' | 'canvas' | 'data'; 
    onClick: () => void;
    direction: 'left' | 'right';
  }) => {
    const icons = {
      chat: <MessageSquare className="w-5 h-5 text-[#6B7280]" />,
      canvas: <FileText className="w-5 h-5 text-[#6B7280]" />,
      data: <Database className="w-5 h-5 text-[#6B7280]" />,
    };
    
    const labels = {
      chat: 'Expand Chat',
      canvas: 'Expand Canvas',
      data: 'Expand Data Sources',
    };
    
    return (
      <button
        onClick={onClick}
        className="flex flex-col items-center justify-between py-4 h-full w-full bg-[#1A1A1A] hover:bg-[#252525] transition-colors cursor-pointer"
        title={labels[type]}
        aria-label={labels[type]}
      >
        {icons[type]}
        <div className="flex-1" />
        {direction === 'left' ? (
          <ChevronRight className="w-4 h-4 text-[#6B7280]" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-[#6B7280]" />
        )}
      </button>
    );
  };

  // Panel content wrappers with continuous opacity based on live size
  const PanelContentWrapper = ({ 
    size, 
    collapsedContent, 
    expandedContent 
  }: { 
    size: number; 
    collapsedContent: React.ReactNode; 
    expandedContent: React.ReactNode;
  }) => {
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
  };

  return (
    <motion.div 
      className="h-screen bg-[#1E1E1E] flex overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <ResizablePanelGroup direction="horizontal" className="h-full" autoSaveId="insight-workspace-panels">
        {/* Chat Panel - always first, uses order=1 */}
        <ResizablePanel 
          id="chat-panel"
          ref={chatPanelRef}
          defaultSize={30} 
          minSize={3}
          maxSize={50}
          order={1}
          onResize={(size) => setChatSize(size)}
        >
          <PanelContentWrapper
            size={chatSize}
            collapsedContent={<CollapsedPanelContent type="chat" onClick={handleExpandChat} direction="left" />}
            expandedContent={<ChatPanelContent />}
          />
        </ResizablePanel>
        
        <ResizableHandle id="chat-center-handle" className="w-1.5 group cursor-col-resize flex items-center justify-center">
          <div className="w-[1px] h-full bg-[#3A3F4E] group-hover:bg-[#FF6B35]/60 transition-colors" />
        </ResizableHandle>
        
        {/* Canvas Panel - order depends on panelOrder state */}
        <ResizablePanel 
          id="canvas-panel"
          ref={canvasPanelRef}
          defaultSize={45}
          minSize={3}
          order={panelOrder === 'normal' ? 2 : 3}
          onResize={(size) => setCanvasSize(size)}
        >
          <PanelContentWrapper
            size={canvasSize}
            collapsedContent={
              <CollapsedPanelContent 
                type="canvas" 
                onClick={handleExpandCanvas} 
                direction={panelOrder === 'normal' ? 'left' : 'right'} 
              />
            }
            expandedContent={<CanvasPanelContent />}
          />
        </ResizablePanel>
        
        {/* Drag handle between center and right panels - double-click behavior depends on which panel is in center */}
        <ResizableHandle 
          id="center-right-handle"
          className="w-1.5 group cursor-col-resize flex items-center justify-center"
          onDoubleClick={panelOrder === 'normal' ? handleDoubleClickExpandCanvas : handleDoubleClickExpandData}
        >
          <div className="w-[1px] h-full bg-[#3A3F4E] group-hover:bg-[#FF6B35]/60 transition-colors" />
        </ResizableHandle>
        
        {/* Data Panel - order depends on panelOrder state */}
        <ResizablePanel 
          id="data-panel"
          ref={dataPanelRef}
          defaultSize={25}
          minSize={3}
          order={panelOrder === 'normal' ? 3 : 2}
          onResize={(size) => setDataSize(size)}
        >
          <PanelContentWrapper
            size={dataSize}
            collapsedContent={
              <CollapsedPanelContent 
                type="data" 
                onClick={handleExpandData} 
                direction={panelOrder === 'normal' ? 'right' : 'left'} 
              />
            }
            expandedContent={<DataSourcesPanelContent />}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </motion.div>
  );
}

// Mock data for demonstration
const MOCK_DATA_SOURCES = [
  {
    id: 'mock-1',
    name: 'Q4 Sales Dashboard',
    type: 'screenshot' as const,
    preview: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop',
    date: '2024-11-25',
    extractedData: {
      'Total Revenue': '$2.4M',
      'Growth Rate': '+15.3%',
      'Active Customers': '12,847',
      'Top Product': 'Enterprise Plan',
    },
  },
  {
    id: 'mock-2',
    name: 'Customer Feedback Survey',
    type: 'file' as const,
    preview: null,
    date: '2024-11-24',
    extractedData: {
      'Response Rate': '68%',
      'NPS Score': '72',
      'Satisfaction': '4.5/5',
      'Top Concern': 'Pricing',
    },
  },
  {
    id: 'mock-3',
    name: 'Competitor Analysis Report',
    type: 'link' as const,
    preview: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop',
    date: '2024-11-23',
    extractedData: {
      'Market Share': '23%',
      'Key Differentiator': 'AI Features',
      'Pricing Gap': '-12%',
      'Feature Parity': '85%',
    },
  },
];

interface DataSourcesPanelProps {
  sources: InsightSource[];
  sheetsData: Record<string, any>;
  onToggle: () => void;
  onEditData: (sourceId: string, newData: any) => void;
  onRemoveSource: (sourceId: string) => void;
}

function DataSourcesPanel({ sources, sheetsData: _sheetsData, onToggle, onEditData: _onEditData, onRemoveSource: _onRemoveSource }: DataSourcesPanelProps) {
  // Note: sheetsData, onEditData, onRemoveSource are reserved for future real data integration
  void _sheetsData; void _onEditData; void _onRemoveSource;
  const [activeTab, setActiveTab] = useState<'all' | 'screenshots' | 'files' | 'links'>('all');
  const [selectedMockId, setSelectedMockId] = useState<string | null>(MOCK_DATA_SOURCES[0]?.id || null);
  
  const useMockData = sources.length === 0;
  const displaySources = useMockData ? MOCK_DATA_SOURCES : sources;
  
  const filteredSources = displaySources.filter(source => {
    if (activeTab === 'all') return true;
    if (useMockData) {
      const mockSource = source as typeof MOCK_DATA_SOURCES[0];
      if (activeTab === 'screenshots') return mockSource.type === 'screenshot';
      if (activeTab === 'files') return mockSource.type === 'file';
      if (activeTab === 'links') return mockSource.type === 'link';
    } else {
      const realSource = source as InsightSource;
      if (activeTab === 'screenshots') return realSource.sourceType === 'screenshot';
      if (activeTab === 'files') return realSource.sourceType === 'file';
      if (activeTab === 'links') return realSource.sourceType === 'link';
    }
    return true;
  });
  
  const selectedMockSource = useMockData 
    ? MOCK_DATA_SOURCES.find(s => s.id === selectedMockId) 
    : null;
  
  return (
    <div className="flex flex-col h-full bg-[#1A1A1A]">
      {/* Header with tabs */}
      <div className="flex-shrink-0 border-b border-[#2A2A2A]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#FF6B35]" />
            <span className="text-sm font-medium text-white">Data Sources</span>
            <span className="px-2 py-0.5 bg-[#2A2F3E] rounded-full text-xs text-gray-400">
              {displaySources.length}
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
          {filteredSources.map((source) => {
            const mockSource = source as typeof MOCK_DATA_SOURCES[0];
            const isSelected = useMockData && selectedMockId === mockSource.id;
            
            return (
              <div
                key={mockSource.id}
                onClick={() => useMockData && setSelectedMockId(mockSource.id)}
                className={`p-3 border-b border-[#2A2A2A] cursor-pointer transition-colors ${
                  isSelected ? 'bg-[#FF6B35]/10 border-l-2 border-l-[#FF6B35]' : 'hover:bg-[#252525]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {mockSource.type === 'screenshot' && <Image className="w-3.5 h-3.5 text-blue-400" />}
                  {mockSource.type === 'file' && <FileText className="w-3.5 h-3.5 text-green-400" />}
                  {mockSource.type === 'link' && <Link2 className="w-3.5 h-3.5 text-purple-400" />}
                  <span className="text-xs text-gray-400">{mockSource.type}</span>
                </div>
                <p className="text-sm text-white truncate">{mockSource.name}</p>
                <p className="text-xs text-gray-500 mt-1">{mockSource.date}</p>
              </div>
            );
          })}
        </div>
        
        {/* Selected source detail */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedMockSource ? (
            <div className="space-y-4">
              {/* Preview image */}
              {selectedMockSource.preview && (
                <div className="rounded-lg overflow-hidden border border-[#2A2A2A]">
                  <img 
                    src={selectedMockSource.preview} 
                    alt={selectedMockSource.name}
                    className="w-full h-48 object-cover"
                  />
                </div>
              )}
              
              {/* Source info */}
              <div>
                <h3 className="text-lg font-medium text-white mb-2">{selectedMockSource.name}</h3>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  {selectedMockSource.type === 'screenshot' && <Image className="w-3.5 h-3.5 text-blue-400" />}
                  {selectedMockSource.type === 'file' && <FileText className="w-3.5 h-3.5 text-green-400" />}
                  {selectedMockSource.type === 'link' && <Link2 className="w-3.5 h-3.5 text-purple-400" />}
                  <span className="capitalize">{selectedMockSource.type}</span>
                  <span>•</span>
                  <span>{selectedMockSource.date}</span>
                </div>
              </div>
              
              {/* Extracted data */}
              <div className="bg-[#212121] rounded-lg p-4 border border-[#2A2A2A]">
                <h4 className="text-sm font-medium text-[#FF6B35] mb-3">Extracted Data</h4>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(selectedMockSource.extractedData).map(([key, value]) => (
                    <div key={key} className="bg-[#1A1A1A] rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">{key}</p>
                      <p className="text-sm font-medium text-white">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              
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
                    if (selectedMockId) {
                      setSelectedMockId(null);
                      toast.success('Source removed');
                    }
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
              <p className="text-gray-400 text-sm">Select a data source to view details</p>
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
