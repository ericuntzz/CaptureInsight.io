import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, ArrowRight, Camera, X, GripVertical } from 'lucide-react';

interface CaptureActionPanelProps {
  isVisible: boolean;
  captureCount: number;
  isBlurMode: boolean;
  onToggleBlurMode: () => void;
  onContinue: () => void;
  onClose?: () => void;
}

export function CaptureActionPanel({ 
  isVisible, 
  captureCount, 
  isBlurMode, 
  onToggleBlurMode,
  onContinue,
  onClose
}: CaptureActionPanelProps) {
  // Position it on the right side, below where ScreenCaptureModePicker would be
  const [position, setPosition] = useState({ x: 20, y: 320 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      
      // Keep within viewport bounds
      const maxX = window.innerWidth - (containerRef.current?.offsetWidth || 0);
      const maxY = window.innerHeight - (containerRef.current?.offsetHeight || 0);
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDragStart({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ type: 'spring', duration: 0.5 }}
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            zIndex: 50,
            cursor: isDragging ? 'grabbing' : 'default',
            width: '200px'
          }}
          className="bg-[#1A1F2E] border border-[rgba(255,107,53,0.3)] rounded-lg shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
        >
          {/* Drag Handle Header */}
          <div
            onMouseDown={handleMouseDown}
            className="flex items-center justify-between px-3 py-2 border-b border-[rgba(255,107,53,0.2)] cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-[#9CA3AF]" />
              <span className="text-xs text-[#9CA3AF]">Capture Panel</span>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 hover:bg-[rgba(255,107,53,0.1)] rounded transition-colors"
                title="Close"
              >
                <X className="w-3 h-3 text-[#9CA3AF] hover:text-[#FF6B35]" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="p-3">
            {/* Capture Count */}
            <div className="flex items-start gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FFA07A] flex items-center justify-center flex-shrink-0">
                <Camera className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white">Captured</div>
                <div className="text-sm text-white">
                  {captureCount} {captureCount === 1 ? 'selection' : 'selections'}
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="mb-3">
              <p className="text-xs text-[#9CA3AF] leading-snug">
                {isBlurMode 
                  ? 'Draw rectangles to blur areas'
                  : 'Drag to capture more data'
                }
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={onToggleBlurMode}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs transition-all ${
                  isBlurMode
                    ? 'bg-[rgba(255,107,53,0.1)] border border-[#FF6B35] text-[#FF6B35]'
                    : 'bg-transparent border border-[rgba(255,107,53,0.3)] text-[#9CA3AF] hover:border-[#FF6B35] hover:text-[#FF6B35]'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>{isBlurMode ? 'Exit Blur' : 'Blur Data'}</span>
              </button>

              <button
                onClick={onContinue}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white rounded-md text-xs hover:scale-[1.02] hover:shadow-[0_8px_24px_rgba(255,107,53,0.4)] transition-all"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Hint */}
            <div className="mt-3 pt-2 border-t border-[rgba(255,107,53,0.1)]">
              <p className="text-[10px] text-[#9CA3AF] text-center">
                Multiple captures allowed
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
