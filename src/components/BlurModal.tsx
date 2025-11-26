import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Info } from 'lucide-react';
import { marketingData } from '../data/mockData';

interface BlurModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBlurComplete: () => void;
  onSkip: () => void;
  blurredCells: Set<string>;
  setBlurredCells: (cells: Set<string>) => void;
}

export function BlurModal({ isOpen, onClose, onBlurComplete, onSkip, blurredCells, setBlurredCells }: BlurModalProps) {
  const [isBlurring, setIsBlurring] = useState(false);
  const [selectedPreviewCell, setSelectedPreviewCell] = useState<number | null>(null);

  const handleBlurSelection = () => {
    setIsBlurring(true);
    // Demo: blur a couple of cells automatically
    setTimeout(() => {
      const newBlurred = new Set(blurredCells);
      newBlurred.add('0-1'); // First row, account name
      newBlurred.add('1-1'); // Second row, account name
      setBlurredCells(newBlurred);
      
      setTimeout(() => {
        onBlurComplete();
      }, 500);
    }, 800);
  };

  const handleCellClick = (cellIndex: number) => {
    setSelectedPreviewCell(cellIndex);
  };

  // Preview data (first 3 rows, selected columns)
  const previewData = marketingData.slice(0, 3).map(row => ({
    account_name: row.account_name,
    product_revenue: row.product_revenue,
    attribution: row.attribution,
  }));

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-[rgba(10,14,26,0.85)] backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="w-full max-w-[480px] bg-[#1A1F2E] border border-[rgba(255,107,53,0.3)] rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FFA07A] flex items-center justify-center mb-4">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-white text-[22px] mb-2">
                Blur Out Sensitive Data
              </h3>
              <p className="text-[#9CA3AF] text-[15px] leading-relaxed">
                Blur out any data you'd like removed from your AI analysis
              </p>
            </div>

            {/* Instructions */}
            <div className="flex items-start gap-3 bg-[rgba(255,107,53,0.05)] rounded-lg p-3 mb-6">
              <Info className="w-5 h-5 text-[#FF6B35] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#9CA3AF] leading-relaxed">
                Click and drag to select sensitive cells (like email addresses, phone numbers, or personal details)
              </p>
            </div>

            {/* Interactive preview area */}
            <div className="mb-6 bg-[#0A0E1A] rounded-lg p-4 border border-[rgba(255,107,53,0.1)]">
              <div className="text-xs text-[#9CA3AF] mb-3">Preview of selected data:</div>
              <div className="space-y-2">
                {previewData.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <div className="flex-1 text-[#E5E7EB] truncate">
                      {idx === 0 && selectedPreviewCell === 0 ? (
                        <span className="inline-block bg-[rgba(255,107,53,0.4)] rounded px-2 py-0.5 backdrop-blur-sm">
                          <span className="text-transparent select-none">
                            {row.account_name}
                          </span>
                        </span>
                      ) : (
                        row.account_name
                      )}
                    </div>
                    <div className="w-24 text-right text-[#E5E7EB]">{row.product_revenue}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-[#9CA3AF] flex items-center gap-2">
                <span className="cursor-pointer hover:text-[#FF6B35] transition-colors" onClick={() => handleCellClick(0)}>
                  Click to blur →
                </span>
                {selectedPreviewCell !== null && (
                  <span className="text-[#10B981]">✓ Example blurred</span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={onSkip}
                className="flex-1 px-6 py-3 bg-transparent border border-[rgba(255,107,53,0.3)] text-[#FF6B35] rounded-lg hover:bg-[rgba(255,107,53,0.1)] transition-all"
              >
                Skip
              </button>
              <button
                onClick={handleBlurSelection}
                disabled={isBlurring}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white rounded-lg hover:scale-[1.02] hover:shadow-[0_8px_24px_rgba(255,107,53,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBlurring ? 'Blurring...' : 'Blur Selection →'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
