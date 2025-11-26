import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check } from 'lucide-react';

interface AnimatedCursorProps {
  isHovering: boolean;
  onAnimationComplete: (step: string) => void;
  shouldAutoScroll: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
}

type AnimationStep = 
  | 'idle' 
  | 'appearing' 
  | 'moving' 
  | 'clicking' 
  | 'dragging' 
  | 'released' 
  | 'showing-summary'
  | 'complete';

export function AnimatedCursor({ 
  isHovering, 
  onAnimationComplete, 
  shouldAutoScroll, 
  scrollRef 
}: AnimatedCursorProps) {
  const [step, setStep] = useState<AnimationStep>('idle');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 });
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    if (!isHovering) {
      setIsVisible(false);
      setStep('idle');
      setShowOverlay(false);
      return;
    }

    let isCancelled = false;
    let animationFrameId: number | null = null;
    const timeouts: NodeJS.Timeout[] = [];

    const delay = (ms: number) => new Promise<void>(resolve => {
      const timeout = setTimeout(() => {
        if (!isCancelled) resolve();
      }, ms);
      timeouts.push(timeout);
    });

    const sequence = async () => {
      if (isCancelled) return;

      // Show overlay
      setShowOverlay(true);
      await delay(300);
      if (isCancelled) return;

      // STEP 1: Cursor Appears (0-0.8s)
      setStep('appearing');
      setIsVisible(true);
      setPosition({ x: 60, y: 90 });
      await delay(800);
      if (isCancelled) return;

      // STEP 2: Move to Selection Start (0.8-1.5s)
      setStep('moving');
      const startX = 100;
      const startY = 140;
      setPosition({ x: startX, y: startY });
      setSelectionStart({ x: startX - 20, y: startY - 20 });
      await delay(700);
      if (isCancelled) return;

      // STEP 3: Click Down (1.5-1.8s)
      setStep('clicking');
      await delay(300);
      if (isCancelled) return;

      // STEP 4: Drag Selection (1.8-4.5s)
      setStep('dragging');
      const endX = 980;
      const endY = 480;
      setSelectionEnd({ x: endX, y: endY });

      // Animate cursor drag
      const duration = 2700;
      const startTime = Date.now();

      const animate = () => {
        if (isCancelled) return;

        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const eased = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        const currentX = startX + (endX - startX) * eased;
        const currentY = startY + (endY - startY) * eased;
        
        setPosition({ x: currentX, y: currentY });
        setSelectionEnd({ x: currentX, y: currentY });

        if (progress < 1 && !isCancelled) {
          animationFrameId = requestAnimationFrame(animate);
        }
      };
      animate();

      await delay(duration);
      if (isCancelled) return;

      // STEP 5: Release Click (4.5-4.8s)
      setStep('released');
      await delay(300);
      if (isCancelled) return;

      // STEP 6: Pause & Show Data Count (4.8-5.5s)
      setStep('showing-summary');
      await delay(700);
      if (isCancelled) return;

      // STEP 7: Complete
      setStep('complete');
      onAnimationComplete('complete');
    };

    sequence();

    return () => {
      isCancelled = true;
      timeouts.forEach(timeout => clearTimeout(timeout));
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isHovering, onAnimationComplete]);

  if (!isVisible && !showOverlay) return null;

  const getSelectionDimensions = () => {
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);
    const rows = Math.round(height / 44); // Approximate row height
    const cols = Math.round(width / 100); // Approximate column width
    return { width, height, rows: Math.max(1, rows), cols: Math.max(1, cols) };
  };

  const dimensions = getSelectionDimensions();

  return (
    <AnimatePresence>
      {/* Dark Overlay */}
      {showOverlay && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 bg-[rgba(10,14,26,0.3)] pointer-events-none z-20"
        />
      )}

      <div className="absolute inset-0 pointer-events-none z-30">
        {/* Selection Overlay - Highlighted cells during drag */}
        {(step === 'dragging' || step === 'released' || step === 'showing-summary') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute"
            style={{
              left: Math.min(selectionStart.x, selectionEnd.x),
              top: Math.min(selectionStart.y, selectionEnd.y),
              width: dimensions.width,
              height: dimensions.height,
            }}
          >
            {/* Selection fill */}
            <div className="absolute inset-0 bg-[rgba(255,107,53,0.12)]" />
            
            {/* Animated dashed border */}
            <motion.div
              className="absolute inset-0 border-3"
              style={{
                borderWidth: 3,
                borderStyle: 'dashed',
                borderColor: '#FF6B35',
                borderRadius: 4,
              }}
              animate={{
                borderDashOffset: step === 'dragging' ? [0, -16] : 0,
              }}
              transition={{
                duration: 1,
                repeat: step === 'dragging' ? Infinity : 0,
                ease: 'linear',
              }}
            />
          </motion.div>
        )}

        {/* Cursor */}
        {isVisible && (
          <motion.div
            animate={{ 
              x: position.x, 
              y: position.y,
              scale: step === 'clicking' ? 0.95 : 1,
            }}
            transition={{ 
              x: { duration: step === 'moving' ? 0.7 : 0, ease: [0.25, 0.1, 0.25, 1] },
              y: { duration: step === 'moving' ? 0.7 : 0, ease: [0.25, 0.1, 0.25, 1] },
              scale: { duration: 0.15 },
            }}
            className="absolute"
            style={{ transformOrigin: 'top left' }}
          >
            {/* Cursor glow */}
            <motion.div
              animate={{ 
                opacity: [0.3, 0.6, 0.3],
                scale: [1, 1.2, 1],
              }}
              transition={{ 
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute -left-2 -top-2 w-10 h-10 bg-[#FF6B35] rounded-full blur-xl opacity-40"
            />

            {/* Cursor SVG */}
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                filter: 'drop-shadow(0 4px 12px rgba(255, 107, 53, 0.4))',
              }}
            >
              <defs>
                <linearGradient id="cursorGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FF6B35" />
                  <stop offset="100%" stopColor="#FFA07A" />
                </linearGradient>
              </defs>
              <path
                d="M6 4L22 14L14 15.5L10 24L6 4Z"
                fill="url(#cursorGradient)"
                stroke="#FFF"
                strokeWidth="1.5"
              />
            </svg>

            {/* Click ripple effect */}
            {step === 'clicking' && (
              <motion.div
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 3, opacity: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="absolute top-2 left-2 w-8 h-8 border-2 border-[#FF6B35] rounded-full"
              />
            )}
          </motion.div>
        )}

        {/* Dimension Badge (follows cursor during drag) */}
        {step === 'dragging' && dimensions.width > 50 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute bg-[#1A1F2E] border border-[#FF6B35] rounded-lg px-3 py-1.5 shadow-lg"
            style={{
              left: position.x + 20,
              top: position.y + 20,
            }}
          >
            <span className="text-xs text-white whitespace-nowrap">
              {dimensions.rows} rows × {dimensions.cols} columns
            </span>
          </motion.div>
        )}

        {/* Success Checkmark (appears on release) */}
        {step === 'released' && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ 
              type: 'spring',
              stiffness: 200,
              damping: 15,
            }}
            className="absolute"
            style={{
              left: (selectionStart.x + selectionEnd.x) / 2 - 24,
              top: (selectionStart.y + selectionEnd.y) / 2 - 24,
            }}
          >
            <div className="w-12 h-12 bg-[#10B981] rounded-full flex items-center justify-center shadow-[0_8px_24px_rgba(16,185,129,0.4)]">
              <Check className="w-7 h-7 text-white" strokeWidth={3} />
            </div>
          </motion.div>
        )}

        {/* Capture Summary Badge */}
        {step === 'showing-summary' && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ 
              type: 'spring',
              stiffness: 200,
              damping: 20,
            }}
            className="absolute bg-[#1A1F2E] border-2 border-[#10B981] rounded-xl px-6 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
            style={{
              left: (selectionStart.x + selectionEnd.x) / 2 - 100,
              top: (selectionStart.y + selectionEnd.y) / 2 - 40,
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[rgba(16,185,129,0.15)] rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-[#10B981]" strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-white mb-0.5">
                  {dimensions.rows * dimensions.cols} cells captured
                </div>
                <div className="text-xs text-[#9CA3AF]">Ready for analysis</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Confetti particles on success */}
        {step === 'released' && (
          <>
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  x: (selectionStart.x + selectionEnd.x) / 2,
                  y: (selectionStart.y + selectionEnd.y) / 2,
                  scale: 1,
                  opacity: 1,
                }}
                animate={{ 
                  x: (selectionStart.x + selectionEnd.x) / 2 + (Math.cos(i * 30 * Math.PI / 180) * 60),
                  y: (selectionStart.y + selectionEnd.y) / 2 + (Math.sin(i * 30 * Math.PI / 180) * 60),
                  scale: 0,
                  opacity: 0,
                }}
                transition={{ 
                  duration: 0.6,
                  ease: 'easeOut',
                }}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  backgroundColor: i % 3 === 0 ? '#FF6B35' : i % 3 === 1 ? '#10B981' : '#FFA07A',
                }}
              />
            ))}
          </>
        )}
      </div>
    </AnimatePresence>
  );
}
