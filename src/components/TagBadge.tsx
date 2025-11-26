import React, { useState } from 'react';
import { X, MoreVertical, Edit2, Trash2, Palette } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Tag, TAG_COLORS } from '../data/insightsData';

interface TagBadgeProps {
  tag: Tag;
  onRemove?: () => void;
  onEdit?: (tagId: string, newName: string, newColor: string) => void;
  onDelete?: (tagId: string) => void;
  showSettings?: boolean;
  size?: 'sm' | 'md';
  interactive?: boolean;
}

export function TagBadge({
  tag,
  onRemove,
  onEdit,
  onDelete,
  showSettings = false,
  size = 'md',
  interactive = true,
}: TagBadgeProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(tag.name);

  const handleEdit = () => {
    if (onEdit) {
      onEdit(tag.id, editedName, tag.color);
      setIsEditing(false);
      setShowMenu(false);
    }
  };

  const handleColorChange = (newColor: string) => {
    if (onEdit) {
      onEdit(tag.id, tag.name, newColor);
      setShowColorPicker(false);
      setShowMenu(false);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(tag.id);
      setShowMenu(false);
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };

  return (
    <div className="relative inline-flex items-center gap-1">
      {/* Tag Badge */}
      <div
        className={`inline-flex items-center gap-1.5 rounded-full ${sizeClasses[size]}`}
        style={{
          backgroundColor: `${tag.color}20`,
          color: tag.color,
          border: `1px solid ${tag.color}40`,
        }}
      >
        {isEditing ? (
          <input
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEdit();
              if (e.key === 'Escape') {
                setIsEditing(false);
                setEditedName(tag.name);
              }
            }}
            onBlur={handleEdit}
            className="bg-transparent border-none outline-none w-20"
            style={{ color: tag.color }}
            autoFocus
          />
        ) : (
          <span>{tag.name}</span>
        )}

        {onRemove && interactive && (
          <button
            onClick={onRemove}
            className="hover:opacity-70 transition-opacity"
            style={{ color: tag.color }}
          >
            <X className="w-3 h-3" />
          </button>
        )}

        {showSettings && !isEditing && (
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="hover:opacity-70 transition-opacity"
            style={{ color: tag.color }}
          >
            <MoreVertical className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Settings Menu */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            className="absolute top-full mt-1 right-0 bg-[#1A1F2E] rounded-lg shadow-lg border border-[#2D3B4E] overflow-hidden z-50 min-w-[160px]"
          >
            {/* Edit Name */}
            <button
              onClick={() => {
                setIsEditing(true);
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#E5E7EB] hover:bg-[#252B3D] transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Name</span>
            </button>

            {/* Change Color */}
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#E5E7EB] hover:bg-[#252B3D] transition-colors"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Change Color</span>
            </button>

            {/* Color Picker */}
            {showColorPicker && (
              <div className="px-3 py-2 border-t border-[#2D3B4E]">
                <div className="grid grid-cols-5 gap-1.5">
                  {TAG_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleColorChange(color)}
                      className="w-6 h-6 rounded-full border-2 border-transparent hover:border-white transition-colors"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Delete */}
            <button
              onClick={handleDelete}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-[#252B3D] transition-colors border-t border-[#2D3B4E]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Tag</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
