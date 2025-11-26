import React, { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Tag, TAG_COLORS } from '../data/insightsData';
import { TagBadge } from './TagBadge';

interface TagSelectorProps {
  allTags: Tag[];
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
  onCreateTag: (name: string, color: string) => void;
  onEditTag?: (tagId: string, newName: string, newColor: string) => void;
  onDeleteTag?: (tagId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  required?: boolean;
  placeholder?: string;
}

export function TagSelector({
  allTags,
  selectedTagIds,
  onTagsChange,
  onCreateTag,
  onEditTag,
  onDeleteTag,
  isOpen,
  onClose,
  required = false,
  placeholder = 'Select tags...',
}: TagSelectorProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const selectedTags = allTags.filter((tag) => selectedTagIds.includes(tag.id));
  const availableTags = allTags.filter((tag) => !selectedTagIds.includes(tag.id));

  const filteredTags = availableTags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagsChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onTagsChange([...selectedTagIds, tagId]);
    }
  };

  const handleCreateTag = () => {
    if (newTagName.trim()) {
      // Auto-assign color based on current tag count
      const colorIndex = allTags.length % TAG_COLORS.length;
      const color = TAG_COLORS[colorIndex];
      onCreateTag(newTagName.trim(), color);
      setNewTagName('');
      setIsCreating(false);
      setSearchQuery('');
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 min-w-[280px] bg-[rgba(26,31,46,0.98)] backdrop-blur-xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden z-[110]"
    >
      <div className="p-3">
        <div className="text-[10px] text-[#9CA3AF] mb-2 flex items-center justify-between">
          <span>
            {required ? 'SELECT TAGS (REQUIRED)' : 'SELECT TAGS'}
          </span>
          {required && selectedTagIds.length === 0 && (
            <span className="text-red-400">Required</span>
          )}
        </div>

        {/* Selected Tags */}
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3 pb-3 border-b border-[#2D3B4E]">
            {selectedTags.map((tag) => (
              <TagBadge
                key={tag.id}
                tag={tag}
                onRemove={() => handleToggleTag(tag.id)}
                size="sm"
              />
            ))}
          </div>
        )}

        {/* Search / Create Input */}
        <div className="mb-2">
          {isCreating ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateTag();
                  if (e.key === 'Escape') {
                    setIsCreating(false);
                    setNewTagName('');
                  }
                }}
                placeholder="Tag name..."
                className="flex-1 px-3 py-2 bg-[#0A0E1A] border border-[#2D3B4E] rounded-lg text-sm text-white placeholder:text-[#6B7280] outline-none focus:border-[#FF6B35]"
                autoFocus
              />
              <button
                onClick={handleCreateTag}
                disabled={!newTagName.trim()}
                className="p-2 bg-[#FF6B35] text-white rounded-lg hover:bg-[#FFA07A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tags..."
              className="w-full px-3 py-2 bg-[#0A0E1A] border border-[#2D3B4E] rounded-lg text-sm text-white placeholder:text-[#6B7280] outline-none focus:border-[#FF6B35]"
            />
          )}
        </div>

        {/* Tag List */}
        <div className="max-h-[200px] overflow-y-auto space-y-1">
          {filteredTags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => handleToggleTag(tag.id)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm text-[#9CA3AF] hover:text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)] transition-all text-left"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span>{tag.name}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Create New Tag Button */}
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full flex items-center gap-2 px-3 py-2 mt-2 rounded-md text-sm text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)] transition-all border-t border-[#2D3B4E] pt-3"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Tag</span>
          </button>
        )}
      </div>
    </motion.div>
  );
}
