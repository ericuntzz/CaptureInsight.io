// Compact Tag Management Section for Space Settings

import React, { useState } from 'react';
import { Tag as TagIcon, Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import { Tag, TAG_COLORS } from '../data/insightsData';
import { toast } from 'sonner@2.0.3';

interface TagManagementSectionProps {
  tags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
}

export function TagManagementSection({ 
  tags, 
  onTagsChange
}: TagManagementSectionProps) {
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [editingTagColor, setEditingTagColor] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState('');
  const [deleteConfirmTagId, setDeleteConfirmTagId] = useState<string | null>(null);

  // Auto-assign color from palette
  const getNextColor = () => {
    const usedColors = tags.map(t => t.color);
    const availableColors = TAG_COLORS.filter(c => !usedColors.includes(c));
    return availableColors.length > 0 ? availableColors[0] : TAG_COLORS[0];
  };

  const handleCreateTag = () => {
    if (!newTagName.trim()) {
      toast.error('Tag name cannot be empty');
      return;
    }
    
    // Check for duplicate name
    if (tags.some(t => t.name.toLowerCase() === newTagName.trim().toLowerCase())) {
      toast.error('A tag with this name already exists');
      return;
    }

    const color = getNextColor();
    const newTag: Tag = {
      id: `tag-${Date.now()}`,
      name: newTagName.trim(),
      color,
      createdAt: new Date(),
      createdBy: 'Current User', // TODO: Get from auth
      spaceId: '', // Will be set by parent
    };
    
    onTagsChange([...tags, newTag]);
    setNewTagName('');
    setShowNewTagForm(false);
    toast.success(`Tag "${newTagName}" created`);
  };

  const handleStartEdit = (tag: Tag) => {
    setEditingTagId(tag.id);
    setEditingTagName(tag.name);
    setEditingTagColor(tag.color);
  };

  const handleSaveEdit = () => {
    if (!editingTagId) return;
    
    if (!editingTagName.trim()) {
      toast.error('Tag name cannot be empty');
      return;
    }

    // Check for duplicate name (excluding current tag)
    if (tags.some(t => t.id !== editingTagId && t.name.toLowerCase() === editingTagName.trim().toLowerCase())) {
      toast.error('A tag with this name already exists');
      return;
    }

    const updatedTags = tags.map(t => 
      t.id === editingTagId 
        ? { ...t, name: editingTagName.trim(), color: editingTagColor }
        : t
    );
    onTagsChange(updatedTags);
    setEditingTagId(null);
    toast.success('Tag updated');
  };

  const handleCancelEdit = () => {
    setEditingTagId(null);
    setEditingTagName('');
    setEditingTagColor('');
  };

  const handleDeleteTag = (tagId: string) => {
    // TODO: Calculate actual usage count from insights, change logs, etc.
    const usageCount = 0; // Placeholder
    setDeleteConfirmTagId(tagId);
  };

  const confirmDelete = () => {
    if (!deleteConfirmTagId) return;
    
    const tag = tags.find(t => t.id === deleteConfirmTagId);
    const updatedTags = tags.filter(t => t.id !== deleteConfirmTagId);
    onTagsChange(updatedTags);
    setDeleteConfirmTagId(null);
    toast.success(`Tag "${tag?.name}" deleted`);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TagIcon className="w-4 h-4 text-[#9CA3AF]" />
          <span className="text-[#E5E7EB] text-sm font-medium">Manage Tags</span>
        </div>
        <button
          onClick={() => setShowNewTagForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF6B35] text-white text-xs rounded-lg hover:bg-[#FFA07A] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Tag
        </button>
      </div>

      <p className="text-xs text-[#6B7280] mb-3">
        Tags are shared across insights and change logs in this space. Changes here update everywhere.
      </p>

      {/* New Tag Form */}
      {showNewTagForm && (
        <div className="p-3 bg-[#0A0E1A] border border-[rgba(255,107,53,0.3)] rounded-lg mb-2">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateTag();
              if (e.key === 'Escape') {
                setShowNewTagForm(false);
                setNewTagName('');
              }
            }}
            placeholder="Tag name..."
            autoFocus
            className="w-full px-3 py-2 bg-[#1A1F2E] border border-[#2D3B4E] rounded text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#FF6B35] mb-2"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setShowNewTagForm(false);
                setNewTagName('');
              }}
              className="px-3 py-1.5 text-xs text-[#9CA3AF] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateTag}
              className="px-3 py-1.5 bg-[#FF6B35] text-white text-xs rounded hover:bg-[#FFA07A] transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Tag List */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {tags.length === 0 ? (
          <div className="text-center py-8 text-sm text-[#6B7280]">
            No tags yet. Create your first tag to get started.
          </div>
        ) : (
          tags.map(tag => (
            <div
              key={tag.id}
              className="p-3 bg-[#0A0E1A] border border-[#2D3B4E] rounded-lg hover:border-[rgba(255,107,53,0.3)] transition-colors"
            >
              {editingTagId === tag.id ? (
                // Edit Mode
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editingTagName}
                    onChange={(e) => setEditingTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    className="w-full px-3 py-2 bg-[#1A1F2E] border border-[#2D3B4E] rounded text-sm text-white focus:outline-none focus:border-[#FF6B35]"
                    autoFocus
                  />
                  
                  {/* Color Picker */}
                  <div className="space-y-2">
                    <div className="text-xs text-[#9CA3AF]">Color:</div>
                    <div className="flex flex-wrap gap-2">
                      {TAG_COLORS.map(color => (
                        <button
                          key={color}
                          onClick={() => setEditingTagColor(color)}
                          className={`w-8 h-8 rounded-lg transition-all ${
                            editingTagColor === color 
                              ? 'ring-2 ring-[#FF6B35] ring-offset-2 ring-offset-[#0A0E1A]' 
                              : 'hover:scale-110'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    
                    {/* Custom Color Input */}
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editingTagColor}
                        onChange={(e) => setEditingTagColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={editingTagColor}
                        onChange={(e) => setEditingTagColor(e.target.value)}
                        placeholder="#FF6B35"
                        className="flex-1 px-2 py-1 bg-[#1A1F2E] border border-[#2D3B4E] rounded text-xs text-white focus:outline-none focus:border-[#FF6B35]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={handleCancelEdit}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-[#9CA3AF] hover:text-white transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#FF6B35] text-white text-xs rounded hover:bg-[#FFA07A] transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Save
                    </button>
                  </div>
                </div>
              ) : deleteConfirmTagId === tag.id ? (
                // Delete Confirmation
                <div className="space-y-2">
                  <p className="text-sm text-red-400">
                    Delete "{tag.name}"? This will remove it from all insights and change logs.
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setDeleteConfirmTagId(null)}
                      className="px-3 py-1.5 text-xs text-[#9CA3AF] hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDelete}
                      className="px-3 py-1.5 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-sm text-white">{tag.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleStartEdit(tag)}
                      className="p-1.5 text-[#6B7280] hover:text-[#FF6B35] hover:bg-[#1A1F2E] rounded transition-colors"
                      title="Edit tag"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTag(tag.id)}
                      className="p-1.5 text-[#6B7280] hover:text-red-400 hover:bg-[#1A1F2E] rounded transition-colors"
                      title="Delete tag"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}