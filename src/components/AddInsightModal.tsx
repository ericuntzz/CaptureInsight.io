import React from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AddInsightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadData: () => void;
  onCreateBlank: () => void;
}

export function AddInsightModal({ isOpen, onClose, onUploadData, onCreateBlank }: AddInsightModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#1A1F2E] border border-[#2D3B4E] rounded-lg shadow-2xl z-50 w-full max-w-md"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2D3B4E]">
              <h2 className="text-white">Add a New Insight</h2>
              <button
                onClick={onClose}
                className="text-[#6B7280] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-[#9CA3AF] text-sm mb-6">
                Choose how you'd like to create your new insight:
              </p>

              {/* Option 1: Upload Data */}
              <button
                onClick={() => {
                  onUploadData();
                  onClose();
                }}
                className="w-full group bg-[#0A0E1A] border-2 border-[#FF6B35] hover:bg-[#FF6B35]/10 rounded-lg p-6 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-[#FF6B35]/20 rounded-lg flex items-center justify-center group-hover:bg-[#FF6B35]/30 transition-colors">
                    <Upload className="w-6 h-6 text-[#FF6B35]" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-white mb-1">Upload Data</h3>
                    <p className="text-sm text-[#9CA3AF]">
                      Capture data from screenshots or existing dashboards
                    </p>
                  </div>
                </div>
              </button>

              {/* Option 2: Create Blank Card */}
              <button
                onClick={() => {
                  onCreateBlank();
                  onClose();
                }}
                className="w-full group bg-[#0A0E1A] border-2 border-[#FF6B35] hover:bg-[#FF6B35]/10 rounded-lg p-6 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-[#FF6B35]/20 rounded-lg flex items-center justify-center group-hover:bg-[#FF6B35]/30 transition-colors">
                    <FileText className="w-6 h-6 text-[#FF6B35]" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-white mb-1">Create Blank Card</h3>
                    <p className="text-sm text-[#9CA3AF]">
                      Start with an empty canvas and add your own content
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
