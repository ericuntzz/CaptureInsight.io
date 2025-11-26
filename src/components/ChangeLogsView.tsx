/**
 * =============================================================================
 * REPLIT IMPLEMENTATION NOTE - CHANGE LOGS FEATURE
 * =============================================================================
 * 
 * PURPOSE: This feature addresses a critical data accuracy problem for marketers.
 * 
 * PROBLEM: Digital marketers don't trust AI-generated insights because LLMs often
 * hallucinate or make incorrect assumptions about business context. When analyzing
 * data from screenshots/uploads, the AI lacks critical context about:
 * - What marketing campaigns were running when
 * - What changes were made to ad spend, targeting, or strategy
 * - External factors affecting the data (seasonality, market changes, etc.)
 * 
 * SOLUTION: The Change Logs feature allows marketers to document their marketing
 * activities and changes over time. The AI Assistant is trained to ALWAYS review
 * these logs when generating insights, ensuring recommendations are grounded in
 * the actual business reality rather than pure data interpretation.
 * 
 * KEY FEATURES:
 * 1. Easy logging of marketing changes with timestamps
 * 2. Ability to tag/link specific data files/folders to each change
 * 3. Connect existing assets OR capture new ones directly from the log entry
 * 4. Search functionality to quickly find relevant changes
 * 5. Filter by Project/Folder to see context-specific changes
 * 
 * BACKEND IMPLEMENTATION NOTES (for Replit):
 * - Store change logs in Vector Database for semantic search
 * - AI should query relevant logs based on:
 *   a) Date range of the data being analyzed
 *   b) Projects/folders associated with the query
 *   c) Semantic similarity to the user's question
 * - Each log entry should be embedded with its connected assets for context
 * - Logs should be weighted heavily in the AI's context window
 * 
 * AI CHAT INTEGRATION (Search + AI Questions):
 * - The search bar should support TWO modes:
 *   1. KEYWORD SEARCH: Traditional filtering by matching text in change log titles,
 *      descriptions, tags, and connected assets
 *   2. AI CHAT MODE: If the query is a natural language question (e.g., "Why did 
 *      conversions drop in March?" or "What campaigns were running last quarter?"),
 *      the AI should:
 *      a) Analyze the question semantically using embeddings
 *      b) Retrieve relevant change logs from vector database
 *      c) Provide a conversational answer citing specific change logs
 *      d) Display the relevant change logs below the AI response
 *      e) Allow follow-up questions in a chat-like interface
 * - Implementation approach:
 *   - Detect if query is a question (contains question words, ends with "?", etc.)
 *   - If question: Open AI chat panel with context from change logs
 *   - If keywords: Traditional filter/search behavior
 *   - Users can toggle between modes or use a split view
 * - The AI should have access to ALL change logs in the current Space to provide
 *   comprehensive answers about marketing activities and context
 * 
 * PEOPLE/USER ASSIGNMENT IMPLEMENTATION:
 * - When a user creates a change log, automatically assign their user profile to
 *   the change log via the "teamMember" field (or equivalent user reference)
 * - Store the user's full profile reference (ID, name, email, avatar, etc.)
 * - Change logs are SHARED across the entire team/workspace - all team members
 *   can view and filter change logs created by any other team member
 * - The "People" filter allows team members to filter change logs by creator
 * - This enables:
 *   a) Attribution: See who made what changes
 *   b) Collaboration: Team can see all context, not just their own changes
 *   c) Accountability: Clear record of who documented what
 *   d) Knowledge sharing: New team members can see historical context from all users
 * - DO NOT restrict visibility based on creator - all change logs in a Space
 *   should be visible to all team members in that Space
 * 
 * USER WORKFLOW:
 * 1. User makes a marketing change (e.g., "Increased Facebook ad budget by 50%")
 * 2. User creates a log entry documenting the change (auto-assigned to their profile)
 * 3. User tags relevant data files (e.g., "Q4 Ad Spend" spreadsheet)
 * 4. All team members can now see this change log in the Space
 * 5. When asking AI about performance, AI references this log automatically
 * 6. AI provides contextualized insights: "Your CAC increased 30% after the 
 *    Facebook budget increase on Oct 15th by John Doe, suggesting diminishing returns..."
 * 
 * This creates trust through transparency and accuracy.
 * =============================================================================
 */

import React, { useState, useMemo } from 'react';
import { Search, Filter, Plus, ArrowLeft, Calendar, Tag, Link, Camera, X, Check, FileText, FolderOpen, ChevronDown, User, Tag as TagIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Project } from './ProjectBrowser';
import { toast } from 'sonner';

interface ChangeLog {
  id: string;
  title: string;
  description: string;
  date: Date;
  projectId?: string;
  folderId?: string;
  connectedAssets: ConnectedAsset[];
  tags: string[];
  teamMember?: string; // User who created this log entry
}

interface ConnectedAsset {
  id: string;
  name: string;
  type: 'sheet' | 'folder' | 'project';
  projectId: string;
  folderId?: string;
}

interface ChangeLogsViewProps {
  spaces: Project[];
  onCaptureNewAsset?: () => void;
  currentSpaceId?: string | null;
  onUpdateTags?: (spaceId: string, tags: any[]) => void;
}

export function ChangeLogsView({ spaces, onCaptureNewAsset, currentSpaceId, onUpdateTags }: ChangeLogsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<string | 'all'>('all');
  const [selectedFolder, setSelectedFolder] = useState<string | 'all'>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all');
  const [selectedTeamMember, setSelectedTeamMember] = useState<string | 'all'>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showNewLogForm, setShowNewLogForm] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newGlobalTag, setNewGlobalTag] = useState('');
  
  // New log form state
  const [newLogTitle, setNewLogTitle] = useState('');
  const [newLogDescription, setNewLogDescription] = useState('');
  const [newLogDate, setNewLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [newLogTags, setNewLogTags] = useState<string[]>([]);
  const [newLogAssets, setNewLogAssets] = useState<ConnectedAsset[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [filterTagInput, setFilterTagInput] = useState('');
  
  // Mock data for demonstration
  const [changeLogs, setChangeLogs] = useState<ChangeLog[]>([
    {
      id: 'log-1',
      title: 'Increased Facebook Ad Budget by 50%',
      description: 'Scaled Facebook campaigns targeting 25-34 age group in response to strong Q3 performance. Added $5k/month to total budget.',
      date: new Date('2024-10-15'),
      projectId: 'proj-1',
      folderId: 'folder-2',
      connectedAssets: [
        { id: 'sheet-4', name: 'Ad Spend', type: 'sheet', projectId: 'proj-1', folderId: 'folder-2' },
        { id: 'sheet-5', name: 'Conversion Rates', type: 'sheet', projectId: 'proj-1', folderId: 'folder-2' },
      ],
      tags: ['Facebook Ads', 'Budget Increase', 'Q4'],
      teamMember: 'John Doe',
    },
    {
      id: 'log-2',
      title: 'Launched New Google Ads Campaign',
      description: 'Started "Holiday Sales 2024" campaign targeting bottom-funnel keywords with aggressive bidding strategy.',
      date: new Date('2024-11-01'),
      projectId: 'proj-1',
      folderId: 'folder-2',
      connectedAssets: [
        { id: 'sheet-4', name: 'Ad Spend', type: 'sheet', projectId: 'proj-1', folderId: 'folder-2' },
      ],
      tags: ['Google Ads', 'New Campaign', 'Holiday'],
      teamMember: 'Jane Smith',
    },
    {
      id: 'log-3',
      title: 'Updated Pricing Page Copy',
      description: 'A/B test: Changed main CTA from "Start Free Trial" to "Get Started Free" based on competitor analysis.',
      date: new Date('2024-10-22'),
      projectId: 'proj-1',
      folderId: 'folder-3',
      connectedAssets: [
        { id: 'sheet-6', name: 'Website Traffic', type: 'sheet', projectId: 'proj-1', folderId: 'folder-3' },
      ],
      tags: ['Website', 'A/B Test', 'Conversion Optimization'],
      teamMember: 'Alice Johnson',
    },
  ]);

  const filteredLogs = changeLogs.filter(log => {
    // Search filter
    const matchesSearch = searchQuery === '' || 
      log.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Project filter
    const matchesProject = selectedProject === 'all' || log.projectId === selectedProject;
    
    // Folder filter
    const matchesFolder = selectedFolder === 'all' || log.folderId === selectedFolder;
    
    // Tags filter
    const matchesTags = selectedTags.length === 0 || log.tags.some(tag => selectedTags.includes(tag));
    
    // Date range filter
    const matchesDateRange = selectedDateRange === 'all' || 
      (log.date >= new Date('2024-01-01') && log.date <= new Date('2024-12-31'));
    
    // Team member filter
    const matchesTeamMember = selectedTeamMember === 'all' || log.teamMember === selectedTeamMember;
    
    return matchesSearch && matchesProject && matchesFolder && matchesTags && matchesDateRange && matchesTeamMember;
  });

  const handleAddTag = () => {
    if (tagInput.trim() && !newLogTags.includes(tagInput.trim())) {
      setNewLogTags([...newLogTags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setNewLogTags(newLogTags.filter(t => t !== tag));
  };

  const handleAddAsset = (asset: ConnectedAsset) => {
    if (!newLogAssets.find(a => a.id === asset.id)) {
      setNewLogAssets([...newLogAssets, asset]);
    }
    setShowAssetPicker(false);
  };

  const handleRemoveAsset = (assetId: string) => {
    setNewLogAssets(newLogAssets.filter(a => a.id !== assetId));
  };

  const handleSaveLog = () => {
    if (!newLogTitle.trim()) {
      toast.error('Please enter a title for this change log');
      return;
    }

    const newLog: ChangeLog = {
      id: `log-${Date.now()}`,
      title: newLogTitle,
      description: newLogDescription,
      date: new Date(newLogDate),
      projectId: newLogAssets[0]?.projectId,
      folderId: newLogAssets[0]?.folderId,
      connectedAssets: newLogAssets,
      tags: newLogTags,
      teamMember: 'John Doe', // Add the team member here
    };

    setChangeLogs([newLog, ...changeLogs]);
    
    // Reset form
    setNewLogTitle('');
    setNewLogDescription('');
    setNewLogDate(new Date().toISOString().split('T')[0]);
    setNewLogTags([]);
    setNewLogAssets([]);
    setShowNewLogForm(false);
    
    toast.success('Change log created successfully!');
  };

  const handleDeleteTagFromLog = (logId: string, tagToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChangeLogs(changeLogs.map(log => 
      log.id === logId 
        ? { ...log, tags: log.tags.filter(t => t !== tagToDelete) }
        : log
    ));
    toast.success('Tag removed from change log');
  };

  const handleToggleTagFilter = (tag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAddGlobalTag = () => {
    if (newGlobalTag.trim()) {
      // This will just be used to create a tag that can be added to logs
      // We'll add it to the first log for now to make it appear in the list
      toast.info('Add this tag to a change log to save it');
      setNewGlobalTag('');
      setShowNewTagInput(false);
    }
  };

  const getProjectName = (projectId?: string) => {
    if (!projectId) return null;
    return spaces.find(p => p.id === projectId)?.name;
  };

  const getFolderName = (projectId?: string, folderId?: string) => {
    if (!projectId || !folderId) return null;
    const project = spaces.find(p => p.id === projectId);
    return project?.folders.find(f => f.id === folderId)?.name;
  };

  // Get current space
  const currentSpace = currentSpaceId ? spaces.find(s => s.id === currentSpaceId) : null;
  
  // ⚠️ NEW: Pull tags from current space instead of deriving from change logs
  const allTags = currentSpace?.tags || [];

  // Get all unique team members from all change logs
  const allTeamMembers = Array.from(new Set(changeLogs.map(log => log.teamMember).filter(Boolean))) as string[];

  // Filter available folders based on selectedProject
  const availableFolders = selectedProject === 'all' 
    ? [] 
    : spaces.find(p => p.id === selectedProject)?.folders || [];

  // Helper function to format date headers
  const formatDateHeader = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Reset time to start of day for comparison
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    
    if (dateOnly.getTime() === todayOnly.getTime()) {
      return 'Today';
    } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  // Group change logs by date
  const groupedByDate = useMemo(() => {
    const groups: { [key: string]: ChangeLog[] } = {};
    
    // Sort filtered logs by date (newest first)
    const sortedLogs = [...filteredLogs].sort((a, b) => b.date.getTime() - a.date.getTime());
    
    sortedLogs.forEach(log => {
      const dateKey = new Date(log.date.getFullYear(), log.date.getMonth(), log.date.getDate()).getTime().toString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(log);
    });
    
    // Sort each group by time created (newest first within the same day)
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => b.date.getTime() - a.date.getTime());
    });
    
    return groups;
  }, [filteredLogs]);

  // Get sorted date keys (newest first)
  const sortedDateKeys = useMemo(() => {
    return Object.keys(groupedByDate).sort((a, b) => Number(b) - Number(a));
  }, [groupedByDate]);

  return (
    <div className="flex flex-col h-full bg-[#0A0E1A]">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4">
        <div className="border-b border-[#1A1F2E] pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-white text-2xl">
                {filteredLogs.length} change log{filteredLogs.length !== 1 ? 's' : ''}
                {currentSpace && ` in ${currentSpace.name}`}
              </h1>
            </div>
          </div>

          {/* Filters Panel */}
          <div className="flex items-center gap-2 flex-wrap pt-4">
            {/* Tag Filter */}
            <FilterDropdown
              label="Tags"
              icon={TagIcon}
              items={allTags.map(tag => ({ id: tag.id, name: tag.name, color: tag.color }))}
              selectedIds={selectedTags}
              onChange={(ids) => setSelectedTags(ids)}
              onAddTag={(tagName, color) => {
                if (!currentSpace || !currentSpaceId || !onUpdateTags) return;
                const newTag = { id: `tag-${Date.now()}`, name: tagName, color, spaceId: currentSpaceId };
                const updatedTags = [...(currentSpace.tags || []), newTag];
                onUpdateTags(currentSpaceId, updatedTags);
                toast.success(`Tag "${tagName}" created!`);
              }}
              showAddTag={true}
            />

            {/* Folder Filter */}
            <FilterDropdown
              label="Folders"
              icon={FolderOpen}
              items={spaces.flatMap(s => s.folders.map(f => ({ id: f.id, name: f.name })))}
              selectedIds={selectedFolder === 'all' ? [] : [selectedFolder]}
              onChange={(ids) => setSelectedFolder(ids[0] || 'all')}
            />

            {/* People Filter */}
            <FilterDropdown
              label="People"
              icon={User}
              items={allTeamMembers.map(m => ({ id: m, name: m }))}
              selectedIds={selectedTeamMember === 'all' ? [] : [selectedTeamMember]}
              onChange={(ids) => setSelectedTeamMember(ids[0] || 'all')}
            />

            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search change logs and ask questions with AI"
                className="w-full h-10 pl-10 pr-4 bg-[#1A1F2E] rounded-lg text-white text-sm placeholder:text-[#6B7280] focus:outline-none"
              />
            </div>

            {/* Clear Filters */}
            {(selectedTags.length > 0 || selectedFolder !== 'all' || selectedTeamMember !== 'all') && (
              <button
                onClick={() => {
                  setSelectedTags([]);
                  setSelectedFolder('all');
                  setSelectedTeamMember('all');
                }}
                className="text-sm text-[#FF6B35] hover:text-[#FFA07A] transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Change Logs List */}
      <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-[#6B7280] mx-auto mb-4" />
            <p className="text-[#9CA3AF]">
              {searchQuery || selectedProject !== 'all' || selectedFolder !== 'all' || selectedTags.length > 0 || selectedDateRange !== 'all'
                ? 'No change logs found matching your filters'
                : 'No change logs yet. Create your first one!'}
            </p>
          </div>
        ) : (
          <>
            {/* Add New Change Log Button */}
            <button
              onClick={() => setShowNewLogForm(true)}
              className="w-full h-10 mb-6 px-4 bg-transparent border border-[#FF6B35] text-[#FF6B35] rounded-lg hover:bg-[rgba(255,107,53,0.05)] active:bg-[rgba(255,107,53,0.05)] focus:bg-[rgba(255,107,53,0.05)] focus-visible:bg-[rgba(255,107,53,0.05)] transition-all flex items-center justify-center gap-2 outline-none focus:outline-none !bg-transparent"
              style={{ backgroundColor: 'transparent' }}
            >
              <Plus className="w-4 h-4" />
              Add a New Change Log
            </button>

            {sortedDateKeys.map((dateKey, dateIndex) => {
              const logs = groupedByDate[dateKey];
              const date = new Date(Number(dateKey));
              
              return (
                <div key={dateKey} className={dateIndex > 0 ? 'mt-8' : ''}>
                  <h2 className="text-sm text-[#FF6B35] font-bold mb-3">{formatDateHeader(date)}</h2>
                  <div className="space-y-3">
                    {logs.map(log => {
                      const isExpanded = expandedLogIds.has(log.id);
                      
                      return (
                        <motion.div
                          key={log.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => {
                            const newExpanded = new Set(expandedLogIds);
                            if (isExpanded) {
                              newExpanded.delete(log.id);
                            } else {
                              newExpanded.add(log.id);
                            }
                            setExpandedLogIds(newExpanded);
                          }}
                          className="bg-[#1A1F2E] border border-[#2D3B4E] rounded-lg p-4 hover:border-[#FF6B35] transition-colors cursor-pointer"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-white mb-1">{log.title}</h3>
                              <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                                <Calendar className="w-3 h-3" />
                                {log.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                {log.projectId && (
                                  <>
                                    <span>•</span>
                                    <FolderOpen className="w-3 h-3" />
                                    {getProjectName(log.projectId)}
                                    {log.folderId && ` → ${getFolderName(log.projectId, log.folderId)}`}
                                  </>
                                )}
                              </div>
                            </div>
                            <ChevronDown className={`w-5 h-5 text-[#6B7280] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>

                          {/* Expandable Description */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="mt-4"
                              >
                                <p className="text-[#9CA3AF] text-sm mb-4">{log.description}</p>
                                
                                {/* Tags */}
                                {log.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {log.tags.map(tag => (
                                      <span
                                        key={tag}
                                        className="px-2 py-1 bg-[#252B3D] text-[#FF6B35] text-xs rounded-md flex items-center gap-1.5 group"
                                      >
                                        <Tag className="w-3 h-3" />
                                        {tag}
                                        <button
                                          onClick={(e) => handleDeleteTagFromLog(log.id, tag, e)}
                                          className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-white ml-1"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* New Log Form Modal */}
      <AnimatePresence>
        {showNewLogForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => setShowNewLogForm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-[#1A1F2E] border border-[#2D3B4E] rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-[#1A1F2E] border-b border-[#2D3B4E] px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-white">New Change Log</h2>
                <button
                  onClick={() => setShowNewLogForm(false)}
                  className="p-2 text-[#6B7280] hover:text-white hover:bg-[#252B3D] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                {/* Title */}
                <div>
                  <label className="block text-sm text-[#9CA3AF] mb-2">Title *</label>
                  <input
                    type="text"
                    value={newLogTitle}
                    onChange={(e) => setNewLogTitle(e.target.value)}
                    placeholder="e.g., Increased Facebook Ad Budget by 50%"
                    className="w-full px-4 py-2 bg-[#0A0E1A] border border-[#2D3B4E] rounded-lg text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#FF6B35]"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm text-[#9CA3AF] mb-2">Date</label>
                  <input
                    type="date"
                    value={newLogDate}
                    onChange={(e) => setNewLogDate(e.target.value)}
                    className="w-full px-4 py-2 bg-[#0A0E1A] border border-[#2D3B4E] rounded-lg text-white focus:outline-none focus:border-[#FF6B35]"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm text-[#9CA3AF] mb-2">Description</label>
                  <textarea
                    value={newLogDescription}
                    onChange={(e) => setNewLogDescription(e.target.value)}
                    placeholder="Describe what changed and why..."
                    rows={4}
                    className="w-full px-4 py-2 bg-[#0A0E1A] border border-[#2D3B4E] rounded-lg text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#FF6B35] resize-none"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm text-[#9CA3AF] mb-2">Tags</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      placeholder="Add a tag..."
                      className="flex-1 px-4 py-2 bg-[#0A0E1A] border border-[#2D3B4E] rounded-lg text-white text-sm placeholder:text-[#6B7280] focus:outline-none focus:border-[#FF6B35]"
                    />
                    <button
                      onClick={handleAddTag}
                      className="px-4 py-2 bg-[#252B3D] text-white rounded-lg hover:bg-[#2D3B4E] transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {newLogTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {newLogTags.map(tag => (
                        <span
                          key={tag}
                          className="px-3 py-1 bg-[#252B3D] text-[#FF6B35] text-sm rounded-md flex items-center gap-2"
                        >
                          <Tag className="w-3 h-3" />
                          {tag}
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:text-white transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Connected Assets */}
                <div>
                  <label className="block text-sm text-[#9CA3AF] mb-2">Connected Assets</label>
                  <div className="space-y-2">
                    {newLogAssets.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {newLogAssets.map(asset => (
                          <div
                            key={asset.id}
                            className="px-3 py-2 bg-[#0A0E1A] border border-[#2D3B4E] rounded-lg text-sm text-[#E5E7EB] flex items-center gap-2"
                          >
                            <Link className="w-3 h-3 text-[#FF6B35]" />
                            {asset.name}
                            <button
                              onClick={() => handleRemoveAsset(asset.id)}
                              className="text-[#6B7280] hover:text-white transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowAssetPicker(!showAssetPicker)}
                        className="flex-1 px-4 py-2 bg-[#0A0E1A] border border-[#2D3B4E] rounded-lg text-white text-sm hover:border-[#FF6B35] transition-colors flex items-center justify-center gap-2"
                      >
                        <Link className="w-4 h-4" />
                        Connect Existing Asset
                      </button>
                      <button
                        onClick={() => {
                          onCaptureNewAsset?.();
                          toast.info('Capture a new asset and return here to link it');
                        }}
                        className="flex-1 px-4 py-2 bg-[#0A0E1A] border border-[#2D3B4E] rounded-lg text-white text-sm hover:border-[#FF6B35] transition-colors flex items-center justify-center gap-2"
                      >
                        <Camera className="w-4 h-4" />
                        Capture New Asset
                      </button>
                    </div>

                    {/* Asset Picker */}
                    {showAssetPicker && (
                      <div className="mt-2 p-4 bg-[#0A0E1A] border border-[#2D3B4E] rounded-lg max-h-64 overflow-y-auto">
                        {spaces.map(project => (
                          <div key={project.id} className="mb-4 last:mb-0">
                            <p className="text-sm text-[#9CA3AF] mb-2">{project.name}</p>
                            {project.folders.map(folder => (
                              <div key={folder.id} className="ml-4 mb-2">
                                <p className="text-xs text-[#6B7280] mb-1">{folder.name}</p>
                                <div className="ml-4 space-y-1">
                                  {folder.sheets && folder.sheets.length > 0 ? (
                                    folder.sheets.map((sheet: any) => (
                                      <button
                                        key={sheet.id}
                                        onClick={() => handleAddAsset({
                                          id: sheet.id,
                                          name: sheet.name,
                                          type: 'sheet',
                                          projectId: project.id,
                                          folderId: folder.id,
                                        })}
                                        className="w-full text-left px-3 py-1.5 text-sm text-white hover:bg-[#252B3D] rounded transition-colors"
                                      >
                                        {sheet.name}
                                      </button>
                                    ))
                                  ) : (
                                    <p className="text-xs text-[#6B7280] italic px-3 py-1.5">No sheets in this folder</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-[#1A1F2E] border-t border-[#2D3B4E] px-6 py-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowNewLogForm(false)}
                  className="px-4 py-2 bg-[#252B3D] text-white rounded-lg hover:bg-[#2D3B4E] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveLog}
                  className="px-4 py-2 bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Save Change Log
                </button>
              </div>
            </motion.div>
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
        className={`h-10 flex items-center gap-2 px-3 rounded-lg transition-colors ${
          selectedIds.length > 0
            ? 'bg-[#1A1F2E] text-[#FF6B35]'
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
                      <Check className="w-4 h-4" />
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