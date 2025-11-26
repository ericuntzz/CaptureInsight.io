import React, { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { Tag, Insight, InsightSource } from '../data/insightsData';
import { TagBadge } from './TagBadge';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface CreateInsightCardProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMessages: Message[];
  onRemoveMessage: (messageId: string) => void;
  tags: Tag[];
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
  onCreateTag: (name: string, color: string) => void;
  onSave: (insight: Partial<Insight>) => void;
}

export function CreateInsightCard({
  isOpen,
  onClose,
  selectedMessages,
  onRemoveMessage,
  tags,
  selectedTagIds,
  onTagsChange,
  onCreateTag,
  onSave,
}: CreateInsightCardProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [status, setStatus] = useState<'Open' | 'Archived'>('Open');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // Generate AI summary from selected messages
  const generateAISummary = () => {
    setIsGeneratingSummary(true);

    // Simulate AI processing
    setTimeout(() => {
      // Extract key points from messages
      const messageContents = selectedMessages.map(m => m.content).join('\n\n');
      
      // Mock AI summary generation
      const mockSummary = `Based on the conversation, here's a summary of the key insights:\n\n${messageContents.slice(0, 300)}...\n\nKey Recommendations:\n• Review the data patterns identified\n• Consider implementing suggested optimizations\n• Monitor metrics closely for the next period`;
      
      setSummary(mockSummary);
      setIsGeneratingSummary(false);
      toast.success('AI summary generated!');
    }, 1500);
  };

  const handleSave = () => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (!summary.trim() || summary.length < 10) {
      toast.error('Please enter a summary (minimum 10 characters)');
      return;
    }

    if (selectedTagIds.length === 0) {
      toast.error('Please select at least one tag');
      return;
    }

    // Create insight sources from selected messages
    const sources: InsightSource[] = selectedMessages.map(msg => ({
      id: `source-${msg.id}`,
      type: 'chat',
      name: `${msg.role === 'user' ? 'User' : 'AI'} message - ${msg.timestamp.toLocaleDateString()}`,
      url: `/ai-assistant#message-${msg.id}`,
      chatBubbleId: msg.id,
    }));

    const insight: Partial<Insight> = {
      title: title.trim(),
      summary: summary.trim(),
      status,
      dateCreated: new Date(),
      createdBy: user?.firstName || user?.email || 'Anonymous',
      tags: selectedTagIds,
      sources,
      comments: [],
    };

    onSave(insight);
  };

  if (!isOpen) return null;

  const selectedTags = tags.filter(tag => selectedTagIds.includes(tag.id));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[#1A1F2E] rounded-xl p-6 max-w-2xl w-full border border-[#2D3B4E] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white text-xl">Create Insight</h3>
          <button
            onClick={onClose}
            className="text-[#6B7280] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Selected Messages Preview */}
          <div>
            <div className="text-sm text-[#9CA3AF] mb-2">
              Selected Messages ({selectedMessages.length})
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {selectedMessages.map(msg => (
                <div key={msg.id} className="bg-[#0A0E1A] rounded-lg p-3 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-xs text-[#FF6B35] mb-1">
                      {msg.role === 'user' ? 'You' : 'AI Assistant'} • {msg.timestamp.toLocaleString()}
                    </div>
                    <p className="text-sm text-[#E5E7EB] line-clamp-2">{msg.content}</p>
                  </div>
                  <button
                    onClick={() => onRemoveMessage(msg.id)}
                    className="ml-2 text-[#6B7280] hover:text-red-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

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

          {/* AI Summary */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm text-[#9CA3AF]">
                Summary <span className="text-red-400">*</span>
              </label>
              <button
                onClick={generateAISummary}
                disabled={isGeneratingSummary || selectedMessages.length === 0}
                className="flex items-center gap-2 px-3 py-1 bg-[#252B3D] text-[#9CA3AF] rounded text-xs hover:bg-[#2D3B4E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-3 h-3" />
                {isGeneratingSummary ? 'Generating...' : 'Generate AI Summary'}
              </button>
            </div>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="AI will generate a summary, or you can write your own..."
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
              {selectedTags.map(tag => (
                <TagBadge
                  key={tag.id}
                  tag={tag}
                  onRemove={() => onTagsChange(selectedTagIds.filter(id => id !== tag.id))}
                  size="sm"
                />
              ))}
              <button
                onClick={() => {
                  // TODO: Open tag selector dropdown
                  toast.info('Tag selector coming soon - full integration pending');
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

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-[#2D3B4E]">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-[#FF6B35] text-white rounded-lg hover:bg-[#FFA07A] transition-colors"
            >
              Create Insight
            </button>
            <button
              onClick={onClose}
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