import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Tag as TagIcon, Users, Calendar, ChevronDown, Grid, List, Columns, Settings2, X, MessageSquare, Send, ExternalLink, CheckCircle, Clock, Archive, TrendingUp, CheckCircle2, FolderOpen, User, LayoutGrid, Sparkles, Paperclip, Link, Maximize, MoreVertical, Copy, Merge, Share2, Download, Trash2, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ManualInsightDialog } from './ManualInsightDialog';
import { TagDeleteConfirmDialog } from './TagDeleteConfirmDialog';
import { CanvasInsightView } from './CanvasInsightView';
import { AddInsightModal } from './AddInsightModal';
import { getTagUsageStats } from '../utils/tagUtils';
import { Tag } from '../data/insightsData';
import type { Insight } from '../data/insightsData';
import { TagBadge } from './TagBadge';
import { toast } from 'sonner';
import { useInsights, useUpdateInsight, useCreateInsightComment, useCreateInsight } from '../hooks/useInsights';
import { useTags, useCreateTag } from '../hooks/useTags';
import { useChat } from '../hooks/useChat';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';

interface InsightsViewProps {
  spaces: any[];
  currentSpaceId: string | null;
  onUpdateTags?: (spaceId: string, tags: any[]) => void;
  onCollapseSidebar?: (collapsed: boolean) => void;
}

type ViewStyle = 'row' | 'kanban';
type KanbanColumn = 'tag' | 'status' | 'folder' | 'date';

export function InsightsView({ spaces, currentSpaceId, onCollapseSidebar }: InsightsViewProps) {
  const [viewStyle, setViewStyle] = useState<ViewStyle>('row');
  const [kanbanColumn, setKanbanColumn] = useState<KanbanColumn>('status');
  const [selectedFilters, setSelectedFilters] = useState({
    tags: [] as string[],
    folders: [] as string[],
    dateRange: null as { start: Date; end: Date } | null,
    people: [] as string[],
    status: [] as ('Open' | 'Archived')[],
  });
  const [expandedInsightId, setExpandedInsightId] = useState<string | null>(null);
  const [showManualInsightDialog, setShowManualInsightDialog] = useState(false);
  const [showTagDeleteConfirmDialog, setShowTagDeleteConfirmDialog] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
  const [fullscreenInsight, setFullscreenInsight] = useState<Insight | null>(null);
  const [showAddInsightModal, setShowAddInsightModal] = useState(false);
  
  // ⚠️ NEW: Canvas mode state
  const [canvasInsightId, setCanvasInsightId] = useState<string | null>(null);
  const [openCanvasTabs, setOpenCanvasTabs] = useState<string[]>([]); // Track multiple open insights
  const [activeCanvasTab, setActiveCanvasTab] = useState<string | null>(null);

  // Get current space
  const currentSpace = spaces.find((s) => s.id === currentSpaceId);
  
  // Fetch insights from API with date conversion
  const { data: rawInsights = [], isLoading: insightsLoading, isError: insightsError } = useInsights(currentSpaceId);
  const insights: Insight[] = useMemo(() => {
    if (!rawInsights || !Array.isArray(rawInsights)) return [];
    return rawInsights.map((insight: any) => ({
      ...insight,
      dateCreated: insight.dateCreated instanceof Date ? insight.dateCreated : new Date(insight.dateCreated),
      comments: (insight.comments || []).map((comment: any) => ({
        ...comment,
        createdAt: comment.createdAt instanceof Date ? comment.createdAt : new Date(comment.createdAt),
      })),
    }));
  }, [rawInsights]);

  // Fetch tags from API with date conversion
  const { data: rawTags = [], isLoading: tagsLoading, isError: tagsError } = useTags(currentSpaceId);
  const tags: Tag[] = useMemo(() => {
    if (!rawTags || !Array.isArray(rawTags)) return [];
    return rawTags.map((tag: any) => ({
      ...tag,
      createdAt: tag.createdAt instanceof Date ? tag.createdAt : new Date(tag.createdAt),
    }));
  }, [rawTags]);

  // Mutation hooks
  const updateInsightMutation = useUpdateInsight();
  const createCommentMutation = useCreateInsightComment();
  const createTagMutation = useCreateTag();
  const createInsightMutation = useCreateInsight();

  // ⚠️ NEW: Auto-expand last worked insight on mount
  useEffect(() => {
    if (!currentSpaceId) return;
    
    // Check localStorage for last expanded insight for this space
    const storageKey = `lastExpandedInsight_${currentSpaceId}`;
    const lastExpandedId = localStorage.getItem(storageKey);
    
    // If there's a last expanded insight and it exists in current insights, auto-expand it
    if (lastExpandedId && insights.some(i => i.id === lastExpandedId)) {
      setExpandedInsightId(lastExpandedId);
    } else if (insights.length > 0) {
      // Otherwise, auto-expand the first insight
      setExpandedInsightId(insights[0].id);
      localStorage.setItem(storageKey, insights[0].id);
    }
  }, [currentSpaceId]); // Only run on mount or when space changes

  // Handle status change using mutation
  const handleStatusChange = (insightId: string, newStatus: 'Open' | 'Archived') => {
    updateInsightMutation.mutate(
      { id: insightId, data: { status: newStatus } },
      {
        onSuccess: () => {
          toast.success(`Insight ${newStatus === 'Archived' ? 'archived' : 'reopened'}!`);
        },
        onError: () => {
          toast.error('Failed to update insight status');
        },
      }
    );
  };

  // Handle comment submission using mutation
  const handleAddComment = (insightId: string, content: string, parentId?: string) => {
    createCommentMutation.mutate(
      { insightId, content, parentId },
      {
        onSuccess: () => {
          toast.success('Comment added!');
        },
        onError: () => {
          toast.error('Failed to add comment');
        },
      }
    );
  };

  // Filter insights
  const filteredInsights = useMemo(() => {
    return insights.filter((insight) => {
      // Tag filter
      if (
        selectedFilters.tags.length > 0 &&
        !insight.tags.some((tagId) => selectedFilters.tags.includes(tagId))
      ) {
        return false;
      }

      // Folder filter
      if (
        selectedFilters.folders.length > 0 &&
        !selectedFilters.folders.includes(insight.folderId || '')
      ) {
        return false;
      }

      // People filter (creator only)
      if (selectedFilters.people.length > 0) {
        if (!selectedFilters.people.includes(insight.createdBy)) {
          return false;
        }
      }

      // Date range filter
      if (selectedFilters.dateRange) {
        const insightDate = insight.dateCreated;
        if (
          insightDate < selectedFilters.dateRange.start ||
          insightDate > selectedFilters.dateRange.end
        ) {
          return false;
        }
      }

      // Status filter
      if (
        selectedFilters.status.length > 0 &&
        !selectedFilters.status.includes(insight.status)
      ) {
        return false;
      }

      return true;
    });
  }, [insights, selectedFilters]);

  // Group insights for Kanban view
  const groupedInsights = useMemo(() => {
    const groups: { [key: string]: Insight[] } = {};

    filteredInsights.forEach((insight) => {
      let key = '';

      switch (kanbanColumn) {
        case 'status':
          key = insight.status;
          break;
        case 'tag':
          // Group by first tag
          const firstTagId = insight.tags[0];
          const firstTag = tags.find((t) => t.id === firstTagId);
          key = firstTag ? firstTag.name : 'Untagged';
          break;
        case 'folder':
          const folder = currentSpace?.folders.find((f: any) => f.id === insight.folderId);
          key = folder ? folder.name : 'No Folder';
          break;
        case 'date':
          const date = insight.dateCreated;
          const month = date.toLocaleString('default', { month: 'short', year: 'numeric' });
          key = month;
          break;
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(insight);
    });

    return groups;
  }, [filteredInsights, kanbanColumn, tags, currentSpace]);

  const handleToggleExpand = (insightId: string) => {
    const newExpandedId = expandedInsightId === insightId ? null : insightId;
    setExpandedInsightId(newExpandedId);
    
    // ⚠️ NEW: Save to localStorage for this space
    if (currentSpaceId && newExpandedId) {
      const storageKey = `lastExpandedInsight_${currentSpaceId}`;
      localStorage.setItem(storageKey, newExpandedId);
    }
  };

  // ⚠️ NEW: Canvas mode handlers
  const handleOpenCanvas = (insightId: string) => {
    // Add to open tabs if not already there
    if (!openCanvasTabs.includes(insightId)) {
      setOpenCanvasTabs(prev => [...prev, insightId]);
    }
    
    // Set as active tab
    setActiveCanvasTab(insightId);
    setCanvasInsightId(insightId);
    
    // Collapse sidebar
    if (onCollapseSidebar) {
      onCollapseSidebar(true);
    }
  };

  const handleCloseCanvas = () => {
    setCanvasInsightId(null);
    setActiveCanvasTab(null);
    setOpenCanvasTabs([]);
    
    // Expand sidebar
    if (onCollapseSidebar) {
      onCollapseSidebar(false);
    }
  };

  const handleSwitchCanvasTab = (insightId: string) => {
    setActiveCanvasTab(insightId);
    setCanvasInsightId(insightId);
  };

  const handleCloseCanvasTab = (insightId: string) => {
    const newTabs = openCanvasTabs.filter(id => id !== insightId);
    setOpenCanvasTabs(newTabs);
    
    // If closing active tab, switch to another or close canvas
    if (insightId === activeCanvasTab) {
      if (newTabs.length > 0) {
        const newActiveTab = newTabs[newTabs.length - 1];
        setActiveCanvasTab(newActiveTab);
        setCanvasInsightId(newActiveTab);
      } else {
        handleCloseCanvas();
      }
    }
  };

  // Handle "Upload Data" from modal
  const handleUploadData = () => {
    if (!currentSpaceId) {
      toast.error('Please select a space first');
      return;
    }
    
    createInsightMutation.mutate(
      {
        spaceId: currentSpaceId,
        data: {
          title: 'Untitled Insight',
          summary: 'Click to add notes or capture data...',
          status: 'Open',
          tags: [],
        },
      },
      {
        onSuccess: () => {
          // TODO: Open floating capture toolbar
          toast.success('New insight created! Opening capture toolbar...');
          toast.info('Floating capture toolbar will open here (to be implemented)');
        },
        onError: () => {
          toast.error('Failed to create insight');
        },
      }
    );
  };

  // Handle "Create Blank Card" from modal
  const handleCreateBlank = () => {
    if (!currentSpaceId) {
      toast.error('Please select a space first');
      return;
    }
    
    createInsightMutation.mutate(
      {
        spaceId: currentSpaceId,
        data: {
          title: 'Untitled Insight',
          summary: '',
          status: 'Open',
          tags: [],
        },
      },
      {
        onSuccess: (newInsight) => {
          handleOpenCanvas(newInsight.id);
          toast.success('New blank insight created!');
        },
        onError: () => {
          toast.error('Failed to create insight');
        },
      }
    );
  };

  // ⚠️ NEW: If canvas mode is active, render Canvas view instead of list view
  if (canvasInsightId) {
    return (
      <CanvasInsightView
        insights={insights}
        openTabs={openCanvasTabs}
        activeTabId={canvasInsightId}
        tags={tags}
        spaceId={currentSpaceId}
        onSwitchTab={handleSwitchCanvasTab}
        onCloseTab={handleCloseCanvasTab}
        onCloseCanvas={handleCloseCanvas}
        onCreateNewInsight={(newInsight) => {
          if (!currentSpaceId) {
            toast.error('Please select a space first');
            return;
          }
          createInsightMutation.mutate(
            {
              spaceId: currentSpaceId,
              data: {
                title: newInsight.title,
                summary: newInsight.summary,
                status: newInsight.status,
                tags: newInsight.tags,
              },
            },
            {
              onSuccess: (createdInsight) => {
                handleOpenCanvas(createdInsight.id);
                toast.success('New insight created from chat!');
              },
              onError: () => {
                toast.error('Failed to create insight');
              },
            }
          );
        }}
        onUpdateInsight={(insightId, updates) => {
          updateInsightMutation.mutate(
            { id: insightId, data: updates },
            {
              onError: () => {
                toast.error('Failed to update insight');
              },
            }
          );
        }}
      />
    );
  }

  // Show loading indicator while data is loading
  if (insightsLoading || tagsLoading) {
    return (
      <div className="h-full bg-[#0A0E1A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-[#FF6B35] animate-spin" />
          <p className="text-[#9CA3AF]">Loading insights...</p>
        </div>
      </div>
    );
  }

  // Show inline error banner if any data failed to load (but continue to show partial UI)
  const hasDataError = insightsError || tagsError;

  return (
    <div className="h-full bg-[#0A0E1A] flex flex-col">
      {/* Error Banner - shows when there's a data loading error */}
      {hasDataError && (
        <div className="flex-shrink-0 bg-[rgba(239,68,68,0.1)] border-b border-[rgba(239,68,68,0.3)] px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-[rgba(239,68,68,0.2)] rounded-full flex items-center justify-center">
              <X className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex-1">
              <p className="text-red-400 text-sm">
                {insightsError && tagsError 
                  ? 'Unable to load insights and tags. Please check your connection and try again.'
                  : insightsError 
                  ? 'Unable to load insights. Please check your connection and try again.'
                  : 'Unable to load tags. Tag filtering may not work correctly.'}
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1 bg-[rgba(239,68,68,0.2)] hover:bg-[rgba(239,68,68,0.3)] text-red-400 rounded-lg text-sm transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4">
        <div className="border-b border-[#1A1F2E] pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-white text-2xl">
                {filteredInsights.length} insight{filteredInsights.length !== 1 ? 's' : ''}
                {currentSpace && ` in ${currentSpace.name}`}
              </h1>
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-[#1A1F2E] rounded-lg p-1">
                <button
                  onClick={() => setViewStyle('row')}
                  className={`p-2 rounded transition-colors ${
                    viewStyle === 'row'
                      ? 'bg-[rgba(255,107,53,0.2)] text-[#FF6B35]'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                  title="Row View"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewStyle('kanban')}
                  className={`p-2 rounded transition-colors ${
                    viewStyle === 'kanban'
                      ? 'bg-[rgba(255,107,53,0.2)] text-[#FF6B35]'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                  title="Kanban View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Filters Panel */}
          <div className="flex items-center justify-between pt-4 flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Tag Filter */}
              <FilterDropdown
                label="Tags"
                icon={TagIcon}
                items={tags.map((tag) => ({ id: tag.id, name: tag.name, color: tag.color }))}
                selectedIds={selectedFilters.tags}
                onChange={(ids) => setSelectedFilters({ ...selectedFilters, tags: ids })}
                onAddTag={(tagName, color) => {
                  if (!currentSpaceId) return;
                  createTagMutation.mutate(
                    { spaceId: currentSpaceId, name: tagName, color },
                    {
                      onSuccess: () => {
                        toast.success(`Tag "${tagName}" created!`);
                      },
                      onError: () => {
                        toast.error('Failed to create tag');
                      },
                    }
                  );
                }}
                showAddTag={true}
              />

              {/* Folder Filter */}
              {currentSpace && (
                <FilterDropdown
                  label="Folders"
                  icon={FolderOpen}
                  items={currentSpace.folders.map((f: any) => ({ id: f.id, name: f.name }))}
                  selectedIds={selectedFilters.folders}
                  onChange={(ids) => setSelectedFilters({ ...selectedFilters, folders: ids })}
                />
              )}

              {/* People Filter - derived from insights data */}
              <FilterDropdown
                label="People"
                icon={User}
                items={Array.from(new Set(insights.map(i => i.createdBy))).filter(Boolean).map((name) => ({ id: name, name: name }))}
                selectedIds={selectedFilters.people}
                onChange={(ids) => setSelectedFilters({ ...selectedFilters, people: ids })}
              />

              {/* Status Filter */}
              <FilterDropdown
                label="Status"
                icon={CheckCircle}
                items={[
                  { id: 'Open', name: 'Open' },
                  { id: 'Archived', name: 'Archived' }
                ]}
                selectedIds={selectedFilters.status}
                onChange={(ids) => setSelectedFilters({ ...selectedFilters, status: ids as ('Open' | 'Archived')[] })}
              />

              {/* Clear Filters */}
              {(selectedFilters.tags.length > 0 ||
                selectedFilters.folders.length > 0 ||
                selectedFilters.people.length > 0 ||
                selectedFilters.status.length > 0) && (
                <button
                  onClick={() =>
                    setSelectedFilters({ tags: [], folders: [], dateRange: null, people: [], status: [] })
                  }
                  className="text-sm text-[#FF6B35] hover:text-[#FFA07A] transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Group By Selector - Only show in Kanban view */}
              {viewStyle === 'kanban' && (
                <select
                  value={kanbanColumn}
                  onChange={(e) => setKanbanColumn(e.target.value as KanbanColumn)}
                  className="px-3 py-2 bg-[#1A1F2E] border border-[#2D3B4E] rounded-lg text-sm text-white outline-none focus:border-[#FF6B35] hover:border-[#FF6B35] transition-colors"
                >
                  <option value="status">Group by Status</option>
                  <option value="tag">Group by Tag</option>
                  <option value="folder">Group by Folder</option>
                  <option value="date">Group by Date</option>
                </select>
              )}

              {/* Removed Generate Insights button - replaced with "+ Add a New Insight" button below */}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 scrollbar-hide">
        {viewStyle === 'row' ? (
          <RowView
            insights={filteredInsights}
            tags={tags}
            expandedInsightId={expandedInsightId}
            onToggleExpand={handleToggleExpand}
            onFullscreen={setFullscreenInsight}
            onOpenCanvas={handleOpenCanvas}
            onAddInsight={() => setShowAddInsightModal(true)}
            spaceId={currentSpaceId}
          />
        ) : (
          <KanbanView
            groupedInsights={groupedInsights}
            tags={tags}
            expandedInsightId={expandedInsightId}
            onToggleExpand={handleToggleExpand}
            onFullscreen={setFullscreenInsight}
            onOpenCanvas={handleOpenCanvas}
            onAddInsight={() => setShowAddInsightModal(true)}
            spaceId={currentSpaceId}
          />
        )}
      </div>

      {/* Manual Insight Dialog */}
      <ManualInsightDialog
        isOpen={showManualInsightDialog}
        onClose={() => setShowManualInsightDialog(false)}
        spaceId={currentSpaceId}
        onAddInsight={(newInsight) => {
          if (!currentSpaceId) {
            toast.error('Please select a space first');
            return;
          }
          createInsightMutation.mutate(
            {
              spaceId: currentSpaceId,
              data: {
                title: newInsight.title,
                summary: newInsight.summary,
                status: newInsight.status,
                tags: newInsight.tags,
              },
            },
            {
              onSuccess: () => {
                toast.success('Insight added successfully!');
                setShowManualInsightDialog(false);
              },
              onError: () => {
                toast.error('Failed to add insight');
              },
            }
          );
        }}
      />

      {/* Tag Delete Confirm Dialog */}
      <TagDeleteConfirmDialog
        isOpen={showTagDeleteConfirmDialog}
        tag={tagToDelete!}
        usageStats={tagToDelete ? getTagUsageStats(tagToDelete.id, insights) : { insightsCount: 0, dataSheetsCount: 0, chatMessagesCount: 0, changeLogsCount: 0, totalCount: 0 }}
        onConfirm={() => {
          if (tagToDelete) {
            toast.info('Tag removal from insights should be done through Space Settings.');
            setShowTagDeleteConfirmDialog(false);
            setTagToDelete(null);
          }
        }}
        onCancel={() => {
          setShowTagDeleteConfirmDialog(false);
          setTagToDelete(null);
        }}
      />

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {fullscreenInsight && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8"
            onClick={() => setFullscreenInsight(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[#0A0E1A] rounded-lg border border-[#2D3B4E] w-full h-full overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-[#0A0E1A] border-b border-[#2D3B4E] p-6 flex items-center justify-between z-10">
                <h2 className="text-2xl text-white">{fullscreenInsight.title}</h2>
                <div className="flex items-center gap-2">
                  <InsightActionButtons insight={fullscreenInsight} onFullscreen={() => {}} />
                  <button
                    onClick={() => setFullscreenInsight(null)}
                    className="text-[#6B7280] hover:text-white p-1.5"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="p-6">
                <InsightDetails 
                  insight={fullscreenInsight} 
                  tags={tags.filter((tag) => fullscreenInsight.tags.includes(tag.id))} 
                  onOpenCanvas={() => handleOpenCanvas(fullscreenInsight.id)}
                  spaceId={currentSpaceId}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Insight Modal */}
      <AddInsightModal
        isOpen={showAddInsightModal}
        onClose={() => setShowAddInsightModal(false)}
        onUploadData={handleUploadData}
        onCreateBlank={handleCreateBlank}
      />
    </div>
  );
}

// Row View Component
function RowView({
  insights,
  tags,
  expandedInsightId,
  onToggleExpand,
  onFullscreen,
  onOpenCanvas,
  onAddInsight,
  spaceId,
}: {
  insights: Insight[];
  tags: Tag[];
  expandedInsightId: string | null;
  onToggleExpand: (id: string) => void;
  onFullscreen: (insight: Insight) => void;
  onOpenCanvas: (insightId: string) => void;
  onAddInsight: () => void;
  spaceId: string | null;
}) {
  return (
    <div className="space-y-2">
      {/* Add New Insight Button */}
      <button
        onClick={onAddInsight}
        className="w-full h-[40px] border border-[#FF6B35] bg-transparent hover:bg-[#FF6B35]/5 active:bg-[#FF6B35]/5 focus:bg-[#FF6B35]/5 focus-visible:bg-[#FF6B35]/5 rounded-lg transition-all flex items-center justify-center group p-[0px] mt-[0px] mr-[0px] mb-[30px] ml-[0px] text-[15px] outline-none focus:outline-none !bg-transparent"
        style={{ backgroundColor: 'transparent' }}
      >
        <span className="text-[#FF6B35] group-hover:text-[#FFA07A] transition-colors text-[15px] font-bold font-normal">
          + Add a New Insight
        </span>
      </button>

      {insights.map((insight) => (
        <InsightRow
          key={insight.id}
          insight={insight}
          tags={tags}
          isExpanded={expandedInsightId === insight.id}
          onToggle={() => onToggleExpand(insight.id)}
          onFullscreen={onFullscreen}
          onOpenCanvas={onOpenCanvas}
          spaceId={spaceId}
        />
      ))}

      {insights.length === 0 && (
        <div className="text-center py-12 text-[#6B7280]">
          <p>No insights found. Click "+ Add a New Insight" above to create your first one.</p>
        </div>
      )}
    </div>
  );
}

// Kanban View Component
function KanbanView({
  groupedInsights,
  tags,
  expandedInsightId,
  onToggleExpand,
  onFullscreen,
  onOpenCanvas,
  onAddInsight,
  spaceId,
}: {
  groupedInsights: { [key: string]: Insight[] };
  tags: Tag[];
  expandedInsightId: string | null;
  onToggleExpand: (id: string) => void;
  onFullscreen: (insight: Insight) => void;
  onOpenCanvas: (insightId: string) => void;
  onAddInsight: () => void;
  spaceId: string | null;
}) {
  return (
    <div className="space-y-4">
      {/* Add New Insight Button - Kanban style */}
      <button
        onClick={onAddInsight}
        className="w-full max-w-[320px] h-[120px] border-2 border-[#FF6B35] bg-transparent hover:bg-[#FF6B35]/5 active:bg-[#FF6B35]/5 focus:bg-[#FF6B35]/5 focus-visible:bg-[#FF6B35]/5 rounded-lg transition-all flex items-center justify-center group outline-none focus:outline-none !bg-transparent"
        style={{ backgroundColor: 'transparent' }}
      >
        <span className="text-[#FF6B35] group-hover:text-[#FFA07A] transition-colors">
          + Add a New Insight
        </span>
      </button>

      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '500px' }}>
        {Object.entries(groupedInsights).map(([column, insights]) => (
          <div key={column} className="flex-shrink-0 w-[320px]">
            <div className="bg-[#1A1F2E] rounded-lg p-3 h-full">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white">{column}</h3>
                <span className="text-[#6B7280] text-sm">{insights.length}</span>
              </div>
              <div className="space-y-2">
                {insights.map((insight) => (
                  <InsightCard
                    key={insight.id}
                    insight={insight}
                    tags={tags}
                    isExpanded={expandedInsightId === insight.id}
                    onToggle={() => onToggleExpand(insight.id)}
                    onFullscreen={onFullscreen}
                    onOpenCanvas={onOpenCanvas}
                    spaceId={spaceId}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}

        {Object.keys(groupedInsights).length === 0 && (
          <div className="text-center py-12 text-[#6B7280] w-full">
            <p>No insights found. Click "+ Add a New Insight" above to create your first one.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Insight Action Buttons Component
function InsightActionButtons({ 
  insight, 
  onFullscreen,
  onOpenCanvas
}: { 
  insight: Insight;
  onFullscreen: () => void;
  onOpenCanvas?: () => void;
}) {
  const handleAddFiles = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast.success('Add Files clicked');
    // TODO: Implement file upload
  };

  const handleAddTags = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast.success('Add Tags clicked');
    // TODO: Implement tag selector
  };

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast.success('Insight link copied to clipboard');
    // TODO: Copy actual link
  };

  const handleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenCanvas) {
      onOpenCanvas();
    } else {
      onFullscreen();
    }
  };

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={handleAddFiles}
        className="p-1.5 text-[#6B7280] hover:text-white hover:bg-[#2D3B4E] rounded transition-colors"
        title="Add Files"
      >
        <Paperclip className="w-4 h-4" />
      </button>
      
      <button
        onClick={handleAddTags}
        className="p-1.5 text-[#6B7280] hover:text-white hover:bg-[#2D3B4E] rounded transition-colors"
        title="Add Tags"
      >
        <TagIcon className="w-4 h-4" />
      </button>
      
      <button
        onClick={handleFullscreen}
        className="p-1.5 text-[#6B7280] hover:text-white hover:bg-[#2D3B4E] rounded transition-colors"
        title="Canvas"
      >
        <Maximize className="w-4 h-4" />
      </button>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 text-[#6B7280] hover:text-white hover:bg-[#2D3B4E] rounded transition-colors"
            title="More"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-[#1A1F2E] border-[#2D3B4E]">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              toast.success('Merge Insights clicked');
            }}
            className="text-[#E5E7EB] hover:bg-[#2D3B4E] cursor-pointer"
          >
            <Merge className="w-4 h-4 mr-2" />
            Merge Insights
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              toast.success('Duplicate Insight clicked');
            }}
            className="text-[#E5E7EB] hover:bg-[#2D3B4E] cursor-pointer"
          >
            <Copy className="w-4 h-4 mr-2" />
            Duplicate Insight
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              toast.success('Share with Team Member clicked');
            }}
            className="text-[#E5E7EB] hover:bg-[#2D3B4E] cursor-pointer"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share with Team Member
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              toast.success('Download clicked');
            }}
            className="text-[#E5E7EB] hover:bg-[#2D3B4E] cursor-pointer"
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[#2D3B4E]" />
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              toast.success('Delete Insight clicked');
            }}
            className="text-red-400 hover:bg-[#2D3B4E] cursor-pointer"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Insight
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Insight Row Component (Asana-style)
function InsightRow({
  insight,
  tags,
  isExpanded,
  onToggle,
  onFullscreen,
  onOpenCanvas,
  spaceId,
}: {
  insight: Insight;
  tags: Tag[];
  isExpanded: boolean;
  onToggle: () => void;
  onFullscreen: (insight: Insight) => void;
  onOpenCanvas: (insightId: string) => void;
  spaceId: string | null;
}) {
  const insightTags = tags.filter((tag) => insight.tags.includes(tag.id));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div className="bg-[#1A1F2E] rounded-lg overflow-hidden">
      {/* Collapsed View */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#252B3D] transition-colors text-left cursor-pointer"
      >
        <div className="flex-1 flex items-center gap-4">
          <div className={`w-2 h-2 rounded-full ${insight.status === 'Open' ? 'bg-[#FF6B35]' : 'bg-[#4ECDC4]'}`} />
          <span className="text-white">{insight.title}</span>
          <div className="flex items-center gap-2">
            {insightTags.slice(0, 2).map((tag) => (
              <TagBadge key={tag.id} tag={tag} size="sm" interactive={false} />
            ))}
            {insightTags.length > 2 && (
              <span className="text-xs text-[#6B7280]">+{insightTags.length - 2}</span>
            )}
          </div>
        </div>
        <InsightActionButtons insight={insight} onFullscreen={() => onFullscreen(insight)} onOpenCanvas={() => onOpenCanvas(insight.id)} />
      </div>

      {/* Expanded View */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-[#2D3B4E]"
          >
            <InsightDetails insight={insight} tags={insightTags} onOpenCanvas={() => onOpenCanvas(insight.id)} spaceId={spaceId} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Insight Card Component (Trello-style)
function InsightCard({
  insight,
  tags,
  isExpanded,
  onToggle,
  onFullscreen,
  onOpenCanvas,
  spaceId,
}: {
  insight: Insight;
  tags: Tag[];
  isExpanded: boolean;
  onToggle: () => void;
  onFullscreen: (insight: Insight) => void;
  onOpenCanvas: (insightId: string) => void;
  spaceId: string | null;
}) {
  const insightTags = tags.filter((tag) => insight.tags.includes(tag.id));

  if (isExpanded) {
    return (
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-[#0A0E1A] rounded-lg p-4 border border-[#2D3B4E] relative"
      >
        <div className="flex items-start justify-between mb-3">
          <h4 className="text-white flex-1">{insight.title}</h4>
          <div className="flex items-center gap-2">
            <InsightActionButtons insight={insight} onFullscreen={() => onFullscreen(insight)} onOpenCanvas={() => onOpenCanvas(insight.id)} />
            <button
              onClick={onToggle}
              className="text-[#6B7280] hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <InsightDetails insight={insight} tags={insightTags} compact onOpenCanvas={() => onOpenCanvas(insight.id)} spaceId={spaceId} />
      </motion.div>
    );
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      className="w-full bg-[#0A0E1A] rounded-lg p-3 text-left hover:border-[#FF6B35] transition-colors border border-transparent cursor-pointer"
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-white text-sm">{insight.title}</h4>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${insight.status === 'Open' ? 'bg-[#FF6B35]' : 'bg-[#4ECDC4]'}`} />
      </div>
      <p className="text-xs text-[#9CA3AF] line-clamp-2 mb-3">{insight.summary}</p>
      <div className="flex items-center justify-between text-xs text-[#6B7280]">
        <span>{insight.dateCreated.toLocaleDateString()}</span>
        {insight.comments.length > 0 && (
          <div className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            <span>{insight.comments.length}</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {insightTags.slice(0, 3).map((tag) => (
          <TagBadge key={tag.id} tag={tag} size="sm" interactive={false} />
        ))}
      </div>
    </div>
  );
}

// Insight Details Component
function InsightDetails({
  insight,
  tags,
  compact = false,
  onOpenCanvas,
  spaceId,
}: {
  insight: Insight;
  tags: Tag[];
  compact?: boolean;
  onOpenCanvas?: () => void;
  spaceId: string | null;
}) {
  const [newComment, setNewComment] = useState('');
  const [aiChatInput, setAiChatInput] = useState('');
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const aiChatContainerRef = React.useRef<HTMLDivElement>(null);

  // Use the chat hook for AI messages
  const { messages: aiChatMessages, sendMessage, isLoading: isAiTyping } = useChat({
    spaceId,
    insightId: insight.id,
  });

  // Collapse state for sections
  const [isMetadataCollapsed, setIsMetadataCollapsed] = useState(true);
  const [isAiChatCollapsed, setIsAiChatCollapsed] = useState(false);
  const [isTagsCollapsed, setIsTagsCollapsed] = useState(true);
  const [isSourcesCollapsed, setIsSourcesCollapsed] = useState(true);

  // Auto-close other dropdowns when one is opened
  const handleToggleTags = () => {
    if (isTagsCollapsed) {
      setIsSourcesCollapsed(true);
      setIsMetadataCollapsed(true);
    }
    setIsTagsCollapsed(!isTagsCollapsed);
  };

  const handleToggleSources = () => {
    if (isSourcesCollapsed) {
      setIsTagsCollapsed(true);
      setIsMetadataCollapsed(true);
    }
    setIsSourcesCollapsed(!isSourcesCollapsed);
  };

  const handleToggleMetadata = () => {
    if (isMetadataCollapsed) {
      setIsTagsCollapsed(true);
      setIsSourcesCollapsed(true);
    }
    setIsMetadataCollapsed(!isMetadataCollapsed);
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (aiChatContainerRef.current) {
      aiChatContainerRef.current.scrollTop = aiChatContainerRef.current.scrollHeight;
    }
  }, [aiChatMessages]);

  const handleSendAiMessage = async () => {
    if (!aiChatInput.trim()) return;

    const messageContent = aiChatInput.trim();
    setAiChatInput('');

    // Open Canvas view when sending first message
    if (onOpenCanvas) {
      onOpenCanvas();
    }

    // Send message using the hook
    await sendMessage(messageContent);
  };

  const handleConvertToComment = (messageContent: string) => {
    toast.success('AI response converted to comment!');
  };

  return (
    <div className={compact ? 'space-y-3' : 'p-4 space-y-4'}>
      {/* Summary */}
      <div>
        <div className="text-xs text-[#6B7280] mb-1">AI SUMMARY</div>
        <p className="text-sm text-[#E5E7EB] m-[0px] px-[0px] py-[6px]">{insight.summary}</p>
      </div>

      {/* 
        ═══════════════════════════════════════════════════════════════════════════
        PRIVATE AI CHAT - INSIGHT-SPECIFIC CONTEXT-AWARE ASSISTANT
        ═══════════════════════════════════════════════════════════════════════════
        
        FEATURE OVERVIEW:
        ================
        This AI Chat section allows users to have a PRIVATE conversation with their AI Assistant
        specifically about this Insight card. Each user has their own private chat thread per insight
        that is completely separate from team comments and the main AI Assistant panel.
        
        KEY FEATURES:
        ============
        1. PRIVACY & ISOLATION:
           - Each user has their own private AI chat thread per insight
           - Not visible to other team members (unlike Comments which are public)
           - Persisted in localStorage with key format: insightChat_{userId}_{insightId}
           - Chat history loads when insight card is opened
        
        2. CONTEXT-AWARE AI:
           - AI has full context of THIS specific insight:
             * Insight title, summary, and description
             * All linked sources (data sheets, captures, chat messages, change logs)
             * All public comments and discussions
             * Tags and metadata
           - AI ALSO has access to ALL space data:
             * All captured data sheets and their contents
             * All AI Chat conversation history in the space
             * All Change Logs tracked in the space
             * All other Insights and their relationships
           - AI PRIORITIZES answering questions about THIS insight while leveraging full space context
        
        3. SMART EXPANSION BEHAVIOR:
           - Initial state: Compact text input field (always visible, no button to click)
           - When user sends first message: Chat expands downward showing message history
           - Insight card container extends vertically to accommodate chat (keeping everything contained)
           - Max height limit: ~400px, then scrolling is enabled within chat container
           - Auto-scrolls to newest message when AI responds
        
        4. CONVERT TO COMMENT:
           - Each AI response has a "Convert to Comment" button
           - Allows users to share AI insights with the team by converting to public comment
           - Useful when AI provides valuable analysis that team should see
           - One-click operation that creates a new comment with AI's response
        
        5. AI CAPABILITIES:
           - Can answer questions about the insight's data sources
           - Can explain patterns or anomalies in the linked data
           - Can suggest related insights or connections to other space data
           - Can help draft updates to the insight summary
           - Can analyze comments and provide sentiment/summary
           - Can cross-reference with other insights, captures, and chat history
        
        IMPLEMENTATION NOTES:
        ====================
        - AI chat now connected to real backend via useChat hook (/api/ai/chat)
        - Chat messages stored in database via /api/chat-threads endpoints
        - AI API receives full insight context + space context + chat history
        - Consider rate limiting to prevent abuse (e.g., max 50 messages per insight)
        - Consider adding "Clear Chat" button for users to reset conversation
        - Consider adding "Export Chat" to download conversation history
        
        USER EXPERIENCE FLOW:
        ====================
        1. User opens insight card → AI Chat input is already visible
        2. User types question → Presses Enter or clicks Send
        3. Chat expands to show user message and "AI is typing..." indicator
        4. AI responds with contextual answer based on insight + space data
        5. User can continue conversation or convert AI response to comment
        6. Chat history persists when card is closed and reopened
        7. If chat gets long (>400px), scroll appears for navigation
        
        EXAMPLE USE CASES:
        =================
        - "What's the trend in the revenue data linked to this insight?"
        - "Can you explain why the conversion rate dropped in Q3?"
        - "Are there any other insights related to this topic?"
        - "Summarize the comments on this insight"
        - "What did we discuss about this in the main AI Chat?"
        - "Compare this to the data from last month's capture"
        - "Draft an update to this insight's summary based on new data"
        
        ═══════════════════════════════════════════════════════════════════════════
      */}
      <div>
        {/* AI Chat Section - Always Visible */}
        <div className="mb-2">
          <div className="text-xs text-[#6B7280]">AI CHAT & CANVAS</div>
        </div>
        
        {/* AI Chat Container - Slack Style */}
        <div className="bg-[#1A1F2E] rounded-lg overflow-hidden">
          {/* Chat Messages Thread - Removed from preview, only visible in Canvas Mode */}
          
          {/* Action Buttons Section - Only shown when there are AI messages
              
              "TAG A CHAT" BUTTON - FEATURE DOCUMENTATION
              ═══════════════════════════════════════════════════════════════════════
              
              INTENDED FUNCTIONALITY:
              =====================
              The "Tag a Chat" button allows users to apply tags to selected AI chat messages within
              the private AI chat thread. This enables users to organize, categorize, and later filter/
              reference specific parts of their AI conversations.
              
              KEY BEHAVIORS:
              =============
              1. MESSAGE SELECTION:
                 - Users can click individual chat messages to select them (checkbox appears)
                 - Multiple messages can be selected at once
                 - Selected messages are highlighted with orange border and background
                 - Selection persists until user deselects or applies tags
              
              2. TAG APPLICATION:
                 - When "Tag a Chat" is clicked, show tag selection dropdown (similar to Insights tags)
                 - User can select existing tags OR create new tags on-the-fly
                 - Selected tags are applied to ALL currently selected messages
                 - Tags appear as small badges on tagged messages (visible on hover or always visible)
              
              3. TAG FILTERING & REFERENCE:
                 - Future feature: Filter chat messages by tags (e.g., "Show only messages tagged 'Important'")
                 - Future feature: Cross-reference tagged chats from main AI Chat or other insights
                 - Future feature: Export tagged conversations for documentation
              
              4. USE CASES:
                 - Tag important AI responses for quick reference later
                 - Categorize different topics discussed in long conversations
                 - Mark messages to revisit or share with team
                 - Organize research findings from AI analysis
                 - Flag action items or recommendations from AI
              
              IMPLEMENTATION NOTES:
              ===================
              - Store message tags in localStorage: insightChatTags_{userId}_{insightId}
              - Format: { messageId: [tagId1, tagId2, ...] }
              - Tags should use the same space-scoped tag system as Insights
              - Consider adding bulk operations (tag all, untag all, select all)
              - May want "quick tags" for common categories (Important, Follow-up, Question, etc.)
              
              EXAMPLE USER FLOW:
              ================
              1. User has conversation with AI about revenue trends
              2. AI provides 3 key insights in separate messages
              3. User clicks each of those 3 messages to select them (checkboxes checked)
              4. User clicks "Tag a Chat" button
              5. Dropdown appears with existing tags + "Add Tag" option
              6. User selects "Revenue Analysis" tag or creates new one
              7. All 3 selected messages now show "Revenue Analysis" tag badge
              8. Later, user can filter to see only "Revenue Analysis" tagged messages
              9. User can reference these tagged messages from other insights or reports
              
              ═══════════════════════════════════════════════════════════════════════
          */}

          
          {/* AI Chat Input - Slack Style */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={aiChatInput}
              onChange={(e) => setAiChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendAiMessage();
                }
              }}
              placeholder="Ask the AI anything about this insight..."
              className="flex-1 px-[12px] py-[8px] bg-[#FFA07A] border-0 text-sm text-[#0A0E1A] placeholder:text-[#4B5563] outline-none transition-colors rounded-[30px] mx-[0px] my-[10px]"
            />
            <button
              onClick={onOpenCanvas}
              className="px-4 py-2 bg-[#FF6B35] hover:bg-[#FFA07A] text-white text-sm rounded-lg transition-colors whitespace-nowrap"
            >
              Open Canvas Editor
            </button>
          </div>
        </div>
      </div>

      {/* Dropdown Menu Buttons Row */}
      <div className="flex items-center gap-1.5 mb-2">
        {/* Tags Dropdown */}
        <button 
          onClick={handleToggleTags}
          className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
        >
          <div className="text-xs text-[#6B7280]">TAGS</div>
          <ChevronDown className={`w-3 h-3 text-[#6B7280] transition-transform ${isTagsCollapsed ? '-rotate-90' : ''}`} />
        </button>

        {/* Sources Dropdown */}
        <button 
          onClick={handleToggleSources}
          className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
        >
          <div className="text-xs text-[#6B7280]">SOURCES</div>
          <ChevronDown className={`w-3 h-3 text-[#6B7280] transition-transform ${isSourcesCollapsed ? '-rotate-90' : ''}`} />
        </button>

        {/* Details Dropdown */}
        <button 
          onClick={handleToggleMetadata}
          className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
        >
          <div className="text-xs text-[#6B7280]">DETAILS</div>
          <ChevronDown className={`w-3 h-3 text-[#6B7280] transition-transform ${isMetadataCollapsed ? '-rotate-90' : ''}`} />
        </button>
      </div>

      {/* Tags Content */}
      <AnimatePresence>
        {!isTagsCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-3"
          >
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <TagBadge key={tag.id} tag={tag} size="sm" interactive={false} />
              ))}
              {tags.length === 0 && (
                <span className="text-xs text-[#6B7280]">No tags</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sources Content */}
      <AnimatePresence>
        {!isSourcesCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-3"
          >
            <div className="space-y-2">
              {insight.sources.map((source) => (
                <a
                  key={source.id}
                  href={source.url}
                  className="flex items-center gap-2 text-sm text-[#FF6B35] hover:text-[#FFA07A] transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{source.name}</span>
                  <span className="text-xs text-[#6B7280]">({source.type})</span>
                </a>
              ))}
              {insight.sources.length === 0 && (
                <span className="text-xs text-[#6B7280]">No sources</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Details (Metadata) Content */}
      <AnimatePresence>
        {!isMetadataCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-3"
          >
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-xs text-[#6B7280] mb-1">STATUS</div>
                <div className={`inline-flex items-center gap-2 px-2 py-1 rounded ${insight.status === 'Open' ? 'bg-[rgba(255,107,53,0.2)] text-[#FF6B35]' : 'bg-[rgba(78,205,196,0.2)] text-[#4ECDC4]'}`}>
                  {insight.status}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#6B7280] mb-1">DATE CREATED</div>
                <div className="text-[#E5E7EB]">{insight.dateCreated.toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-xs text-[#6B7280] mb-1">CREATED BY</div>
                <div className="text-[#E5E7EB]">{insight.createdBy}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Filter Dropdown Component
function FilterDropdown({
  label,
  icon: Icon,
  items,
  selectedIds,
  onChange,
  onAddTag,
  showAddTag = false,
}: {
  label: string;
  icon: any;
  items: { id: string; name: string; color?: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onAddTag?: (tagName: string, color: string) => void;
  showAddTag?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAddTagInput, setShowAddTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const handleAddTag = () => {
    if (newTagName.trim() && onAddTag) {
      // Generate a random color from preset palette
      const colors = ['#FF6B35', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      onAddTag(newTagName.trim(), randomColor);
      setNewTagName('');
      setShowAddTagInput(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
          selectedIds.length > 0
            ? 'bg-[rgba(255,107,53,0.2)] text-[#FF6B35]'
            : 'bg-[#1A1F2E] text-[#9CA3AF] hover:text-white'
        }`}
      >
        <Icon className="w-4 h-4" />
        <span className="text-sm">{label}</span>
        {selectedIds.length > 0 && (
          <span className="text-xs">({selectedIds.length})</span>
        )}
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => {
              setIsOpen(false);
              setShowAddTagInput(false);
              setNewTagName('');
            }}
          />
          <div className="absolute top-full mt-2 left-0 bg-[#1A1F2E] rounded-lg shadow-lg border border-[#2D3B4E] overflow-hidden z-20 min-w-[200px]">
            <div className="max-h-[200px] overflow-y-auto p-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleToggle(item.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#E5E7EB] hover:bg-[#252B3D] rounded transition-colors"
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selectedIds.includes(item.id) ? 'bg-[#FF6B35] border-[#FF6B35]' : 'border-[#6B7280]'}`}>
                    {selectedIds.includes(item.id) && (
                      <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  {item.color && (
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  )}
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
            
            {/* Add Tag Section */}
            {showAddTag && (
              <div className="border-t border-[#2D3B4E] p-2">
                {showAddTagInput ? (
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddTag();
                        } else if (e.key === 'Escape') {
                          setShowAddTagInput(false);
                          setNewTagName('');
                        }
                      }}
                      placeholder="Tag name..."
                      autoFocus
                      className="flex-1 px-2 py-1.5 bg-[#0A0E1A] border border-[#2D3B4E] rounded text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#FF6B35]"
                    />
                    <button
                      onClick={handleAddTag}
                      className="px-2 py-1.5 bg-[#FF6B35] text-white rounded hover:bg-[#FFA07A] transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAddTagInput(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#FF6B35] hover:bg-[#252B3D] rounded transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Tag
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}