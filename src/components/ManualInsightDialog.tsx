import React, { useState } from 'react';
import { X, ExternalLink, Plus, Trash2, Sparkles, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Insight, Tag, InsightSource, mockTags } from '../data/insightsData';
import { TagBadge } from './TagBadge';
import { toast } from 'sonner';
import { validateTagName, getNextTagColor } from '../utils/tagUtils';

interface ManualInsightDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddInsight: (insight: Insight) => void;
  spaceId: string | null; // Added: Space context for tag operations
}

type SourceType = 'datasheet' | 'changelog' | 'chat';

export function ManualInsightDialog({
  isOpen,
  onClose,
  onAddInsight,
  spaceId, // Added: Receive spaceId prop
}: ManualInsightDialogProps) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [status, setStatus] = useState<'Open' | 'Archived'>('Open');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tags, setTags] = useState<Tag[]>(mockTags);
  const [sources, setSources] = useState<InsightSource[]>([]);
  const [showSourceLinking, setShowSourceLinking] = useState(false);
  const [sourceTab, setSourceTab] = useState<SourceType>('datasheet');

  // Mock data for source linking
  const mockDataSheets = [
    { id: 'ds-1', name: 'Q4 Revenue Data', date: 'Nov 1', tags: ['tag-1', 'tag-2'] },
    { id: 'ds-2', name: 'Google Ads Performance', date: 'Nov 5', tags: ['tag-1'] },
    { id: 'ds-3', name: 'Facebook Ads Dashboard', date: 'Nov 8', tags: ['tag-3'] },
    { id: 'ds-4', name: 'Email Campaign Results', date: 'Nov 12', tags: ['tag-2'] },
  ];

  const mockChangeLogs = [
    { id: 'cl-1', name: 'Updated pricing strategy', date: 'Nov 3', user: 'Sarah Chen' },
    { id: 'cl-2', name: 'Launched new campaign', date: 'Nov 7', user: 'Mike Johnson' },
    { id: 'cl-3', name: 'Adjusted ad spend allocation', date: 'Nov 10', user: 'Alex Rivera' },
  ];

  const mockChatConversations = [
    { id: 'chat-1', snippet: 'CAC analysis from Q4 data...', date: 'Nov 2', messages: 12 },
    { id: 'chat-2', snippet: 'Revenue breakdown by channel...', date: 'Nov 6', messages: 8 },
    { id: 'chat-3', snippet: 'Google Ads ROI investigation...', date: 'Nov 9', messages: 15 },
  ];

  const handleSave = () => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (!summary.trim() || summary.length < 10) {
      toast.error('Please enter a summary (minimum 10 characters)');
      return;
    }

    if (selectedTags.length === 0) {
      toast.error('Please select at least one tag');
      return;
    }

    const newInsight: Insight = {
      id: `insight-${Date.now()}`,
      title: title.trim(),
      summary: summary.trim(),
      status,
      dateCreated: new Date(),
      createdBy: 'Current User', // TODO: Replace with actual user
      tags: selectedTags,
      sources,
      comments: [],
    };

    onAddInsight(newInsight);
    handleClose();
  };

  const handleClose = () => {
    setTitle('');
    setSummary('');
    setStatus('Open');
    setSelectedTags([]);
    setSources([]);
    setShowSourceLinking(false);
    onClose();
  };

  const handleAddSource = (sourceId: string, sourceName: string, type: SourceType) => {
    const newSource: InsightSource = {
      id: `source-${Date.now()}-${sourceId}`,
      type,
      name: sourceName,
      url: `/${type}/${sourceId}`,
    };

    if (type === 'chat') {
      newSource.chatBubbleId = sourceId;
    }

    setSources([...sources, newSource]);
    toast.success(`Added ${sourceName} as a source`);
  };

  const handleRemoveSource = (sourceId: string) => {
    setSources(sources.filter((s) => s.id !== sourceId));
  };

  const handleToggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleCreateTag = (name: string, color: string) => {
    const newTag: Tag = {
      id: `tag-${Date.now()}`,
      name,
      color,
      createdAt: new Date(),
      createdBy: 'Current User',
    };
    setTags([...tags, newTag]);
    setSelectedTags([...selectedTags, newTag.id]);
    toast.success(`Tag "${name}" created!`);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6"
      onClick={handleClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[#1A1F2E] rounded-xl p-6 max-w-3xl w-full border border-[#2D3B4E] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white text-xl">Create New Insight</h3>
          <button
            onClick={handleClose}
            className="text-[#6B7280] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title Input */}
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-2">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter insight title..."
              className="w-full px-4 py-2 bg-[#0A0E1A] border border-[#2D3B4E] rounded-lg text-white placeholder:text-[#6B7280] outline-none focus:border-[#FF6B35]"
            />
          </div>

          {/* Summary */}
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-2">
              Summary <span className="text-red-400">*</span>
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Write a summary of this insight..."
              rows={6}
              className="w-full px-4 py-2 bg-[#0A0E1A] border border-[#2D3B4E] rounded-lg text-white placeholder:text-[#6B7280] outline-none focus:border-[#FF6B35] resize-none"
            />
            <div className="text-xs text-[#6B7280] mt-1">
              {summary.length} characters (minimum 10)
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-2">
              Tags <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleToggleTag(tag.id)}
                  className={`px-3 py-1 rounded-full text-xs transition-all ${
                    selectedTags.includes(tag.id)
                      ? 'ring-2 ring-[#FF6B35]'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: tag.color, color: 'white' }}
                >
                  {tag.name}
                </button>
              ))}
              <button
                onClick={() => {
                  if (!spaceId) {
                    toast.error('No space selected');
                    return;
                  }
                  const name = prompt('Enter tag name:');
                  if (name) {
                    const validation = validateTagName(name, spaceId, tags);
                    if (validation.isValid) {
                      const color = getNextTagColor(tags);
                      handleCreateTag(name, color);
                    } else {
                      toast.error(validation.error || 'Invalid tag name');
                    }
                  }
                }}
                className="px-3 py-1 bg-[#252B3D] text-[#9CA3AF] rounded-full text-xs hover:bg-[#2D3B4E] transition-colors"
              >
                + Add Tag
              </button>
            </div>
          </div>

          {/* Status & Assignment Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Status */}
            <div>
              <label className="block text-sm text-[#9CA3AF] mb-2">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'Open' | 'Archived')}
                className="w-full px-4 py-2 bg-[#0A0E1A] border border-[#2D3B4E] rounded-lg text-white outline-none focus:border-[#FF6B35]"
              >
                <option value="Open">Open</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Sources */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm text-[#9CA3AF]">
                Sources ({sources.length})
              </label>
              <button
                onClick={() => setShowSourceLinking(!showSourceLinking)}
                className="flex items-center gap-2 px-3 py-1 bg-[#252B3D] text-[#9CA3AF] rounded text-xs hover:bg-[#2D3B4E] transition-colors"
              >
                <Plus className="w-3 h-3" />
                Link Sources
              </button>
            </div>

            {/* Selected Sources */}
            {sources.length > 0 && (
              <div className="space-y-2 mb-3">
                {sources.map((source) => (
                  <div
                    key={source.id}
                    className="flex items-center justify-between bg-[#0A0E1A] rounded-lg p-2"
                  >
                    <div className="flex items-center gap-2">
                      <ExternalLink className="w-3.5 h-3.5 text-[#FF6B35]" />
                      <span className="text-sm text-[#E5E7EB]">{source.name}</span>
                      <span className="text-xs text-[#6B7280]">({source.type})</span>
                    </div>
                    <button
                      onClick={() => handleRemoveSource(source.id)}
                      className="text-[#6B7280] hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Source Linking Panel */}
            <AnimatePresence>
              {showSourceLinking && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-[#0A0E1A] rounded-lg p-4 border border-[#2D3B4E]">
                    {/* Tabs */}
                    <div className="flex items-center gap-2 mb-4">
                      <button
                        onClick={() => setSourceTab('datasheet')}
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          sourceTab === 'datasheet'
                            ? 'bg-[rgba(255,107,53,0.2)] text-[#FF6B35]'
                            : 'text-[#9CA3AF] hover:text-white'
                        }`}
                      >
                        Data Sheets
                      </button>
                      <button
                        onClick={() => setSourceTab('changelog')}
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          sourceTab === 'changelog'
                            ? 'bg-[rgba(255,107,53,0.2)] text-[#FF6B35]'
                            : 'text-[#9CA3AF] hover:text-white'
                        }`}
                      >
                        Change Logs
                      </button>
                      <button
                        onClick={() => setSourceTab('chat')}
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          sourceTab === 'chat'
                            ? 'bg-[rgba(255,107,53,0.2)] text-[#FF6B35]'
                            : 'text-[#9CA3AF] hover:text-white'
                        }`}
                      >
                        AI Chats
                      </button>
                    </div>

                    {/* Search (placeholder) */}
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                      <input
                        type="text"
                        placeholder="Search..."
                        className="w-full pl-10 pr-4 py-2 bg-[#1A1F2E] border border-[#2D3B4E] rounded-lg text-sm text-white placeholder:text-[#6B7280] outline-none focus:border-[#FF6B35]"
                      />
                    </div>

                    {/* Source List */}
                    <div className="max-h-[200px] overflow-y-auto space-y-1">
                      {sourceTab === 'datasheet' &&
                        mockDataSheets.map((sheet) => {
                          const isAdded = sources.some((s) => s.name === sheet.name);
                          return (
                            <button
                              key={sheet.id}
                              onClick={() => !isAdded && handleAddSource(sheet.id, sheet.name, 'datasheet')}
                              disabled={isAdded}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors ${
                                isAdded
                                  ? 'bg-[#1A1F2E] opacity-50 cursor-not-allowed'
                                  : 'hover:bg-[#1A1F2E] text-[#E5E7EB]'
                              }`}
                            >
                              <span>{sheet.name}</span>
                              <span className="text-xs text-[#6B7280]">{sheet.date}</span>
                            </button>
                          );
                        })}

                      {sourceTab === 'changelog' &&
                        mockChangeLogs.map((log) => {
                          const isAdded = sources.some((s) => s.name === log.name);
                          return (
                            <button
                              key={log.id}
                              onClick={() => !isAdded && handleAddSource(log.id, log.name, 'changelog')}
                              disabled={isAdded}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors ${
                                isAdded
                                  ? 'bg-[#1A1F2E] opacity-50 cursor-not-allowed'
                                  : 'hover:bg-[#1A1F2E] text-[#E5E7EB]'
                              }`}
                            >
                              <div className="flex flex-col items-start">
                                <span>{log.name}</span>
                                <span className="text-xs text-[#6B7280]">by {log.user}</span>
                              </div>
                              <span className="text-xs text-[#6B7280]">{log.date}</span>
                            </button>
                          );
                        })}

                      {sourceTab === 'chat' &&
                        mockChatConversations.map((chat) => {
                          const isAdded = sources.some((s) => s.chatBubbleId === chat.id);
                          return (
                            <button
                              key={chat.id}
                              onClick={() => !isAdded && handleAddSource(chat.id, chat.snippet, 'chat')}
                              disabled={isAdded}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors ${
                                isAdded
                                  ? 'bg-[#1A1F2E] opacity-50 cursor-not-allowed'
                                  : 'hover:bg-[#1A1F2E] text-[#E5E7EB]'
                              }`}
                            >
                              <div className="flex flex-col items-start">
                                <span className="line-clamp-1">{chat.snippet}</span>
                                <span className="text-xs text-[#6B7280]">{chat.messages} messages</span>
                              </div>
                              <span className="text-xs text-[#6B7280]">{chat.date}</span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-[#2D3B4E]">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-[#FF6B35] text-white rounded-lg hover:bg-[#FFA07A] transition-colors"
            >
              Create Insight
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-[#252B3D] text-[#9CA3AF] rounded-lg hover:bg-[#2D3B4E] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}