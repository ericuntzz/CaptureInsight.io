// Tag Management View - Central location to manage all tags in a space

import React, { useState } from 'react';
import { Tag as TagIcon, Search, Edit2, Trash2, Plus, BarChart3, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Tag } from '../data/insightsData';
import { TagBadge } from './TagBadge';
import { TagDeleteConfirmDialog } from './TagDeleteConfirmDialog';
import { useTags, useTagUsage } from '../hooks/useTags';
import { getTagUsageStats } from '../utils/tagUtils';
import { toast } from 'sonner@2.0.3';

interface TagManagementViewProps {
  spaceId: string | null;
  spaceName?: string;
}

export function TagManagementView({ spaceId, spaceName }: TagManagementViewProps) {
  const { tags, createTag, updateTag, deleteTag } = useTags(spaceId);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);

  // Filter tags by search query
  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle tag edit
  const handleEditTag = (tagId: string, newName: string, newColor: string) => {
    updateTag(tagId, { name: newName, color: newColor });
  };

  // Handle tag delete
  const handleDeleteTag = (tag: Tag) => {
    setTagToDelete(tag);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (tagToDelete) {
      deleteTag(tagToDelete.id);
      setShowDeleteConfirm(false);
      setTagToDelete(null);
      if (selectedTag?.id === tagToDelete.id) {
        setSelectedTag(null);
      }
    }
  };

  // Sort tags by created date (newest first)
  const sortedTags = [...filteredTags].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  return (
    <div className="h-full bg-[#0A0E1A] flex">
      {/* Sidebar - Tag List */}
      <div className="w-80 bg-[#0F1419] border-r border-[#1A1F2E] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#1A1F2E]">
          <h2 className="text-white text-lg mb-3">Tags</h2>
          {spaceName && (
            <p className="text-sm text-[#6B7280] mb-3">in {spaceName}</p>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tags..."
              className="w-full pl-10 pr-4 py-2 bg-[#0A0E1A] border border-[#2D3B4E] rounded-lg text-sm text-white placeholder:text-[#6B7280] outline-none focus:border-[#FF6B35]"
            />
          </div>
        </div>

        {/* Tag List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {sortedTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => setSelectedTag(tag)}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                  selectedTag?.id === tag.id
                    ? 'bg-[rgba(255,107,53,0.1)] border border-[#FF6B35]'
                    : 'bg-[#1A1F2E] hover:bg-[#252B3D]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm text-white">{tag.name}</span>
                </div>
                <TagIcon className="w-4 h-4 text-[#6B7280]" />
              </button>
            ))}

            {sortedTags.length === 0 && (
              <div className="text-center py-8">
                <TagIcon className="w-12 h-12 text-[#2D3B4E] mx-auto mb-3" />
                <p className="text-sm text-[#6B7280]">
                  {searchQuery ? 'No tags found' : 'No tags yet'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Create Tag Button */}
        <div className="p-4 border-t border-[#1A1F2E]">
          <button
            onClick={() => {
              const name = prompt('Enter tag name:');
              if (name) {
                createTag(name);
              }
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#FF6B35] text-white rounded-lg hover:bg-[#FFA07A] transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Create Tag</span>
          </button>
        </div>
      </div>

      {/* Main Content - Tag Details */}
      <div className="flex-1 overflow-y-auto">
        {selectedTag ? (
          <TagDetailPanel
            tag={selectedTag}
            spaceId={spaceId}
            onEdit={handleEditTag}
            onDelete={handleDeleteTag}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <TagIcon className="w-16 h-16 text-[#2D3B4E] mx-auto mb-4" />
              <h3 className="text-white text-lg mb-2">No Tag Selected</h3>
              <p className="text-sm text-[#6B7280] max-w-sm">
                Select a tag from the sidebar to view its details and usage statistics
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {tagToDelete && (
        <TagDeleteConfirmDialog
          isOpen={showDeleteConfirm}
          tag={tagToDelete}
          usageStats={
            getTagUsageStats(tagToDelete.id, []) // Mock insights array
          }
          onConfirm={confirmDelete}
          onCancel={() => {
            setShowDeleteConfirm(false);
            setTagToDelete(null);
          }}
        />
      )}
    </div>
  );
}

// Tag Detail Panel Component
function TagDetailPanel({
  tag,
  spaceId,
  onEdit,
  onDelete,
}: {
  tag: Tag;
  spaceId: string | null;
  onEdit: (tagId: string, newName: string, newColor: string) => void;
  onDelete: (tag: Tag) => void;
}) {
  const { usage, isLoading } = useTagUsage(tag.id, spaceId);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${tag.color}20` }}
          >
            <TagIcon className="w-6 h-6" style={{ color: tag.color }} />
          </div>
          <div>
            <h2 className="text-white text-2xl mb-1">{tag.name}</h2>
            <p className="text-sm text-[#6B7280]">
              Created by {tag.createdBy} on {tag.createdAt.toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <TagBadge
            tag={tag}
            onEdit={onEdit}
            onDelete={() => onDelete(tag)}
            showSettings={true}
            size="md"
          />
        </div>
      </div>

      {/* Usage Statistics */}
      <div className="bg-[#1A1F2E] rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-[#FF6B35]" />
          <h3 className="text-white">Usage Statistics</h3>
        </div>

        {isLoading ? (
          <div className="text-sm text-[#6B7280]">Loading...</div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Insights"
              count={usage.insightsCount}
              color="#FF6B35"
            />
            <StatCard
              label="Data Sheets"
              count={usage.dataSheetsCount}
              color="#4ECDC4"
            />
            <StatCard
              label="Chat Messages"
              count={usage.chatMessagesCount}
              color="#FFE66D"
            />
            <StatCard
              label="Change Logs"
              count={usage.changeLogsCount}
              color="#A8E6CF"
            />
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-[#2D3B4E]">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#9CA3AF]">Total Items</span>
            <span className="text-2xl text-[#FF6B35]">{usage.totalCount}</span>
          </div>
        </div>
      </div>

      {/* Recent Usage */}
      <div className="bg-[#1A1F2E] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-[#FF6B35]" />
          <h3 className="text-white">Recent Activity</h3>
        </div>

        <div className="text-sm text-[#6B7280]">
          No recent activity to display
        </div>

        {/* TODO: Add list of recently tagged items */}
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div
      className="p-4 rounded-lg border"
      style={{
        backgroundColor: `${color}10`,
        borderColor: `${color}30`,
      }}
    >
      <div className="text-xs text-[#9CA3AF] mb-1">{label}</div>
      <div className="text-2xl" style={{ color }}>
        {count}
      </div>
    </div>
  );
}
