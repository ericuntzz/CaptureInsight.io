import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { Tag } from '../data/insightsData';
import { TagUsageStats } from '../utils/tagUtils';

interface TagDeleteConfirmDialogProps {
  isOpen: boolean;
  tag: Tag;
  usageStats: TagUsageStats;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TagDeleteConfirmDialog({
  isOpen,
  tag,
  usageStats,
  onConfirm,
  onCancel,
}: TagDeleteConfirmDialogProps) {
  if (!isOpen) return null;

  const hasUsage = usageStats.totalCount > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-6"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[#1A1F2E] rounded-xl p-6 max-w-md w-full border border-[#2D3B4E]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-white text-lg">Delete Tag?</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-[#9CA3AF]">Delete</span>
                <span
                  className="px-2 py-0.5 rounded-full text-xs"
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                    border: `1px solid ${tag.color}40`,
                  }}
                >
                  {tag.name}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-[#6B7280] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Usage Information */}
        {hasUsage ? (
          <div className="mb-6">
            <p className="text-sm text-[#E5E7EB] mb-3">
              This tag is currently used in:
            </p>
            <div className="bg-[#0A0E1A] rounded-lg p-4 space-y-2">
              {usageStats.insightsCount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#9CA3AF]">Insights</span>
                  <span className="text-white">{usageStats.insightsCount}</span>
                </div>
              )}
              {usageStats.dataSheetsCount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#9CA3AF]">Data Sheets</span>
                  <span className="text-white">{usageStats.dataSheetsCount}</span>
                </div>
              )}
              {usageStats.chatMessagesCount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#9CA3AF]">Chat Messages</span>
                  <span className="text-white">{usageStats.chatMessagesCount}</span>
                </div>
              )}
              {usageStats.changeLogsCount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#9CA3AF]">Change Logs</span>
                  <span className="text-white">{usageStats.changeLogsCount}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm pt-2 border-t border-[#2D3B4E]">
                <span className="text-[#FF6B35]">Total Items</span>
                <span className="text-[#FF6B35]">{usageStats.totalCount}</span>
              </div>
            </div>
            <p className="text-sm text-[#9CA3AF] mt-3">
              These items will no longer have this tag.
            </p>
          </div>
        ) : (
          <div className="mb-6">
            <p className="text-sm text-[#9CA3AF]">
              This tag is not currently used in any items.
            </p>
          </div>
        )}

        {/* Warning */}
        {hasUsage && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-6">
            <p className="text-xs text-yellow-200">
              ⚠️ This action cannot be undone. The tag will be permanently removed from all items.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-[#252B3D] text-[#9CA3AF] rounded-lg hover:bg-[#2D3B4E] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Delete Tag
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
