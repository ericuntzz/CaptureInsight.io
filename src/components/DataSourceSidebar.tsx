/**
 * DataSourceSidebar Component
 * 
 * Displays the data source for the currently active sheet in a right sidebar.
 * Shows different previews based on source type (screenshot, link, file, API).
 * 
 * Features:
 * - 400px wide sidebar
 * - Close button
 * - Expandable images to fullscreen
 * - Click-to-edit name
 * - Metadata display (date, creator, folder, space, tags, LLMs sent to)
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Maximize2, ExternalLink, FileText, Image as ImageIcon, Zap, Calendar, User, FolderOpen, Tag as TagIcon, Brain, Download } from 'lucide-react';
import { TagBadge } from './TagBadge';

export interface DataSource {
  type: 'screenshot' | 'link' | 'file' | 'api';
  name: string;
  captureDate: Date;
  capturedBy: string;
  folder: string;
  space: string;
  tags?: string[];
  sentToLLMs?: Array<{ llm: string; timestamp: Date }>;
  // Type-specific data
  preview?: string; // For screenshots (URL or base64)
  url?: string; // For links
  fileData?: {
    fileName: string;
    fileSize: string;
    fileType: string;
  };
  apiConnection?: {
    endpoint: string;
    lastSync: Date;
    status: 'active' | 'inactive';
  };
}

interface DataSourceSidebarProps {
  isOpen: boolean;
  dataSource: DataSource | null;
  onClose: () => void;
  onNameChange: (newName: string) => void;
}

export function DataSourceSidebar({
  isOpen,
  dataSource,
  onClose,
  onNameChange
}: DataSourceSidebarProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dataSource) {
      setEditedName(dataSource.name);
    }
  }, [dataSource]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameClick = () => {
    setIsEditingName(true);
  };

  const handleNameBlur = () => {
    setIsEditingName(false);
    if (editedName.trim() && editedName !== dataSource?.name) {
      onNameChange(editedName.trim());
    } else {
      setEditedName(dataSource?.name || '');
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameBlur();
    } else if (e.key === 'Escape') {
      setIsEditingName(false);
      setEditedName(dataSource?.name || '');
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen || !dataSource) return null;

  return (
    <>
      {/* Sidebar */}
      <motion.div
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed right-0 top-0 h-full w-[400px] bg-[#0A0E1A] border-l border-[rgba(255,107,53,0.2)] shadow-xl z-40 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[rgba(255,107,53,0.2)]">
          <h2 className="text-white">Data Source</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[rgba(255,107,53,0.1)] rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-[#9CA3AF]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Editable Name */}
          <div>
            {isEditingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={handleNameKeyDown}
                className="w-full px-2 py-1 bg-[#1A1F2E] border border-[rgba(255,107,53,0.3)] rounded text-white focus:outline-none focus:border-[#FF6B35]"
              />
            ) : (
              <h3
                onClick={handleNameClick}
                className="text-white cursor-pointer hover:text-[#FF6B35] transition-colors"
              >
                {dataSource.name}
              </h3>
            )}
            <p className="text-xs text-[#9CA3AF] mt-1">
              {dataSource.type === 'screenshot' && 'Screenshot'}
              {dataSource.type === 'link' && 'Share Link'}
              {dataSource.type === 'file' && 'Uploaded File'}
              {dataSource.type === 'api' && 'API Connection'}
            </p>
          </div>

          {/* Preview based on type */}
          {dataSource.type === 'screenshot' && dataSource.preview && (
            <div className="relative group">
              <img
                src={dataSource.preview}
                alt="Data source preview"
                className="w-full rounded-lg border border-[rgba(255,107,53,0.2)] cursor-pointer"
                onClick={() => setIsFullscreen(true)}
              />
              <button
                onClick={() => setIsFullscreen(true)}
                className="absolute top-2 right-2 p-2 bg-[rgba(26,31,46,0.9)] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Maximize2 className="w-4 h-4 text-white" />
              </button>
            </div>
          )}

          {dataSource.type === 'link' && dataSource.url && (
            <div className="border border-[rgba(255,107,53,0.2)] rounded-lg p-4 bg-[#1A1F2E]">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-[rgba(255,107,53,0.1)] rounded">
                  <ExternalLink className="w-5 h-5 text-[#FF6B35]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white mb-1">{dataSource.name}</p>
                  <a
                    href={dataSource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#FF6B35] hover:text-[#FFA07A] break-all"
                  >
                    {dataSource.url}
                  </a>
                </div>
              </div>
            </div>
          )}

          {dataSource.type === 'file' && dataSource.fileData && (
            <div className="border border-[rgba(255,107,53,0.2)] rounded-lg p-4 bg-[#1A1F2E]">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-[rgba(255,107,53,0.1)] rounded">
                  <FileText className="w-5 h-5 text-[#FF6B35]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-white mb-1">{dataSource.fileData.fileName}</p>
                  <p className="text-xs text-[#9CA3AF]">
                    {dataSource.fileData.fileType} • {dataSource.fileData.fileSize}
                  </p>
                </div>
                <button className="p-2 hover:bg-[rgba(255,107,53,0.1)] rounded transition-colors">
                  <Download className="w-4 h-4 text-[#9CA3AF]" />
                </button>
              </div>
            </div>
          )}

          {dataSource.type === 'api' && dataSource.apiConnection && (
            <div className="border border-[rgba(255,107,53,0.2)] rounded-lg p-4 bg-[#1A1F2E]">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-[rgba(255,107,53,0.1)] rounded">
                  <Zap className="w-5 h-5 text-[#FF6B35]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-white mb-1">API Connection</p>
                  <p className="text-xs text-[#9CA3AF] mb-2">{dataSource.apiConnection.endpoint}</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] px-2 py-1 rounded ${
                      dataSource.apiConnection.status === 'active'
                        ? 'bg-[rgba(16,185,129,0.1)] text-[#10B981]'
                        : 'bg-[rgba(239,68,68,0.1)] text-[#EF4444]'
                    }`}>
                      {dataSource.apiConnection.status.toUpperCase()}
                    </span>
                    <span className="text-xs text-[#9CA3AF]">
                      Last sync: {formatDate(dataSource.apiConnection.lastSync)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="space-y-3 pt-4 border-t border-[rgba(255,107,53,0.2)]">
            <h4 className="text-xs text-[#9CA3AF] uppercase">Metadata</h4>

            {/* Date Created */}
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-[#9CA3AF] mt-0.5" />
              <div>
                <p className="text-xs text-[#9CA3AF]">Date Created</p>
                <p className="text-sm text-white">{formatDate(dataSource.captureDate)}</p>
              </div>
            </div>

            {/* Created By */}
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-[#9CA3AF] mt-0.5" />
              <div>
                <p className="text-xs text-[#9CA3AF]">Created By</p>
                <p className="text-sm text-white">{dataSource.capturedBy}</p>
              </div>
            </div>

            {/* Space */}
            <div className="flex items-start gap-3">
              <FolderOpen className="w-4 h-4 text-[#9CA3AF] mt-0.5" />
              <div>
                <p className="text-xs text-[#9CA3AF]">Space</p>
                <p className="text-sm text-white">{dataSource.space}</p>
              </div>
            </div>

            {/* Folder */}
            <div className="flex items-start gap-3">
              <FolderOpen className="w-4 h-4 text-[#9CA3AF] mt-0.5" />
              <div>
                <p className="text-xs text-[#9CA3AF]">Folder</p>
                <p className="text-sm text-white">{dataSource.folder}</p>
              </div>
            </div>

            {/* Tags */}
            {dataSource.tags && dataSource.tags.length > 0 && (
              <div className="flex items-start gap-3">
                <TagIcon className="w-4 h-4 text-[#9CA3AF] mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-[#9CA3AF] mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {dataSource.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 text-xs rounded bg-[rgba(255,107,53,0.1)] text-[#FF6B35] border border-[rgba(255,107,53,0.2)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Sent to LLMs */}
            {dataSource.sentToLLMs && dataSource.sentToLLMs.length > 0 && (
              <div className="flex items-start gap-3">
                <Brain className="w-4 h-4 text-[#9CA3AF] mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-[#9CA3AF] mb-2">Sent to External LLMs</p>
                  <div className="space-y-2">
                    {dataSource.sentToLLMs.map((llm, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm text-white">{llm.llm}</span>
                        <span className="text-xs text-[#9CA3AF]">
                          {formatDate(llm.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Fullscreen Image Modal */}
      <AnimatePresence>
        {isFullscreen && dataSource.type === 'screenshot' && dataSource.preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsFullscreen(false)}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-8 cursor-pointer"
          >
            <button
              onClick={() => setIsFullscreen(false)}
              className="absolute top-4 right-4 p-2 bg-[rgba(26,31,46,0.9)] rounded-lg hover:bg-[rgba(26,31,46,1)] transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <img
              src={dataSource.preview}
              alt="Data source fullscreen"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}