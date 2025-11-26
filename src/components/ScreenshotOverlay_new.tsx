import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Selection {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ScreenshotOverlayProps {
  containerRef: React.RefObject<HTMLDivElement>;
  tableContainerRef: React.RefObject<HTMLDivElement>;
  onCapture: (selection: Selection) => void;
  isBlurMode: boolean;
  onBlurArea: (selection: Selection) => void;
  captures: Selection[];
  blurAreas: Selection[];
  isDemoComplete: boolean;
  onDeleteCapture?: (index: number) => void;
  onDeleteBlurArea?: (index: number) => void;
  onUpdateCapture?: (index: number, selection: Selection) => void;
  onUpdateBlurArea?: (index: number, selection: Selection) => void;
}

type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'r' | 'b' | 'l' | 'move' | null;

export function ScreenshotOverlay({
  containerRef,
  tableContainerRef,
  onCapture,
  isBlurMode,
  onBlurArea,
  captures,
  blurAreas,
  isDemoComplete,
  onDeleteCapture,
  onDeleteBlurArea,
  onUpdateCapture,
  onUpdateBlurArea,
}: ScreenshotOverlayProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const autoScrollAnimationRef = useRef<number | null>(null);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const scrollVelocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isUpdatingRef = useRef<boolean>(false);
  
  // Refs for accessing current state in event listeners
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const currentPosRef = useRef<{ x: number; y: number } | null>(null);
  const resizeDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const originalPendingSelectionRef = useRef<Selection | null>(null);
  const initialScrollRef = useRef<{ left: number; top: number }>({ left: 0, top: 0 });
  
  // For capture editing
  const [activeCaptureIndex, setActiveCaptureIndex] = useState<number | null>(null);
  const [activeBlurIndex, setActiveBlurIndex] = useState<number | null>(null);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle>(null);
  const [resizeDragStart, setResizeDragStart] = useState<{ x: number; y: number } | null>(null);
  const [originalPendingSelection, setOriginalPendingSelection] = useState<Selection | null>(null);
  const [isResizingBlur, setIsResizingBlur] = useState(false);
  const [scrollOffset, setScrollOffset] = useState({ left: 0, top: 0 });
  const [clipPath, setClipPath] = useState<string>('none');

  // Track scroll position and clip bounds for rendering
  useEffect(() => {
    const scrollContainer = document.querySelector('[data-scroll-container]') as HTMLElement;
    if (!scrollContainer || !containerRef.current || !tableContainerRef.current) return;

    const updateBounds = () => {
      setScrollOffset({
        left: scrollContainer.scrollLeft,
        top: scrollContainer.scrollTop,
      });

      // Calculate clip path based on table container bounds
      const containerRect = containerRef.current!.getBoundingClientRect();
      const tableRect = tableContainerRef.current!.getBoundingClientRect();
      
      // Calculate clip region relative to the overlay container
      const clipTop = tableRect.top - containerRect.top;
      const clipLeft = tableRect.left - containerRect.left;
      const clipRight = containerRect.right - tableRect.right;
      const clipBottom = containerRect.bottom - tableRect.bottom;
      
      setClipPath(`inset(${clipTop}px ${clipRight}px ${clipBottom}px ${clipLeft}px round 0px 0px 12px 12px)`);
    };

    scrollContainer.addEventListener('scroll', updateBounds);
    window.addEventListener('resize', updateBounds);
    // Initialize
    updateBounds();
    
    return () => {
      scrollContainer.removeEventListener('scroll', updateBounds);
      window.removeEventListener('resize', updateBounds);
    };
  }, []);

  // Handle keyboard delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeCaptureIndex !== null && onDeleteCapture) {
          e.preventDefault();
          onDeleteCapture(activeCaptureIndex);
          setActiveCaptureIndex(null);
        } else if (activeBlurIndex !== null && onDeleteBlurArea) {
          e.preventDefault();
          onDeleteBlurArea(activeBlurIndex);
          setActiveBlurIndex(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCaptureIndex, activeBlurIndex, onDeleteCapture, onDeleteBlurArea]);

  const handleResizeMouseDown = (e: React.MouseEvent, handle: ResizeHandle, captureIndex?: number, blurIndex?: number) => {
    e.stopPropagation();
    
    // Store initial scroll position
    const scrollContainer = document.querySelector('[data-scroll-container]') as HTMLElement;
    const initialScroll = {
      left: scrollContainer?.scrollLeft || 0,
      top: scrollContainer?.scrollTop || 0
    };
    initialScrollRef.current = initialScroll;
    
    if (captureIndex !== undefined) {
      // Resizing a confirmed capture
      setActiveCaptureIndex(captureIndex);
      setActiveBlurIndex(null);
      setActiveHandle(handle);
      const dragStart = { x: e.clientX, y: e.clientY };
      setResizeDragStart(dragStart);
      resizeDragStartRef.current = dragStart;
      const originalSel = captures[captureIndex];
      setOriginalPendingSelection(originalSel);
      originalPendingSelectionRef.current = originalSel;
      setIsResizingBlur(false);
    } else if (blurIndex !== undefined) {
      // Resizing a blur area
      setActiveBlurIndex(blurIndex);
      setActiveCaptureIndex(null);
      setActiveHandle(handle);
      const dragStart = { x: e.clientX, y: e.clientY };
      setResizeDragStart(dragStart);
      resizeDragStartRef.current = dragStart;
      const originalSel = blurAreas[blurIndex];
      setOriginalPendingSelection(originalSel);
      originalPendingSelectionRef.current = originalSel;
      setIsResizingBlur(true);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !isDemoComplete) return;

    // Deactivate any active capture or blur when clicking on overlay
    setActiveCaptureIndex(null);
    setActiveBlurIndex(null);

    const scrollContainer = document.querySelector('[data-scroll-container]') as HTMLElement;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = scrollContainer?.scrollLeft || 0;
    const scrollTop = scrollContainer?.scrollTop || 0;
    const x = e.clientX - rect.left + scrollLeft;
    const y = e.clientY - rect.top + scrollTop;

    const pos = { x, y };
    setIsDragging(true);
    setStartPos(pos);
    startPosRef.current = pos;
    setCurrentPos(pos);
    currentPosRef.current = pos;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !startPosRef.current || !containerRef.current) return;

    const scrollContainer = document.querySelector('[data-scroll-container]') as HTMLElement;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = scrollContainer?.scrollLeft || 0;
    const scrollTop = scrollContainer?.scrollTop || 0;
    const x = e.clientX - rect.left + scrollLeft;
    const y = e.clientY - rect.top + scrollTop;

    const pos = { x, y };
    setCurrentPos(pos);
    currentPosRef.current = pos;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    // Calculate box bounds in viewport coordinates for auto-scroll (subtract scroll offset)
    const boxLeft = Math.min(startPosRef.current.x, x);
    const boxTop = Math.min(startPosRef.current.y, y);
    const boxRight = Math.max(startPosRef.current.x, x);
    const boxBottom = Math.max(startPosRef.current.y, y);
    const boxBounds = {
      left: rect.left + boxLeft - scrollLeft,
      top: rect.top + boxTop - scrollTop,
      right: rect.left + boxRight - scrollLeft,
      bottom: rect.top + boxBottom - scrollTop,
    };

    // Update scroll velocity for smooth auto-scroll
    updateScrollVelocity(e.clientX, e.clientY, boxBounds);
  };

  const handleMouseUp = () => {
    // Clear auto-scroll animation
    if (autoScrollAnimationRef.current) {
      cancelAnimationFrame(autoScrollAnimationRef.current);
      autoScrollAnimationRef.current = null;
    }
    scrollVelocityRef.current = { x: 0, y: 0 };

    // Handle resize end
    if (activeHandle) {
      setActiveHandle(null);
      setResizeDragStart(null);
      resizeDragStartRef.current = null;
      setOriginalPendingSelection(null);
      originalPendingSelectionRef.current = null;
      setIsResizingBlur(false);
      // Don't clear activeCaptureIndex/activeBlurIndex here - keep it active for further edits
      return;
    }

    if (!isDragging || !startPosRef.current || !currentPosRef.current) {
      setIsDragging(false);
      setStartPos(null);
      startPosRef.current = null;
      setCurrentPos(null);
      currentPosRef.current = null;
      return;
    }

    const selection: Selection = {
      x: Math.min(startPosRef.current.x, currentPosRef.current.x),
      y: Math.min(startPosRef.current.y, currentPosRef.current.y),
      width: Math.abs(currentPosRef.current.x - startPosRef.current.x),
      height: Math.abs(currentPosRef.current.y - startPosRef.current.y),
    };

    // Only capture if selection is larger than 10x10 pixels
    if (selection.width > 10 && selection.height > 10) {
      if (isBlurMode) {
        onBlurArea(selection);
      } else {
        onCapture(selection);
      }
    }

    setIsDragging(false);
    setStartPos(null);
    startPosRef.current = null;
    setCurrentPos(null);
    currentPosRef.current = null;
  };

  // Smooth auto-scroll function
  const startAutoScroll = () => {
    const scrollContainer = document.querySelector('[data-scroll-container]') as HTMLElement;
    if (!scrollContainer) return;

    const animate = () => {
      const velocity = scrollVelocityRef.current;
      
      if (velocity.x === 0 && velocity.y === 0) {
        autoScrollAnimationRef.current = null;
        return;
      }

      // Apply scroll
      if (velocity.y !== 0) scrollContainer.scrollTop += velocity.y;
      if (velocity.x !== 0) scrollContainer.scrollLeft += velocity.x;

      // Continue animation
      autoScrollAnimationRef.current = requestAnimationFrame(animate);
    };

    if (!autoScrollAnimationRef.current) {
      autoScrollAnimationRef.current = requestAnimationFrame(animate);
    }
  };

  // Calculate scroll velocity based on mouse position AND box edges with gravity-like feel
  const updateScrollVelocity = (clientX: number, clientY: number, boxBounds?: { left: number; right: number; top: number; bottom: number }) => {
    const scrollContainer = document.querySelector('[data-scroll-container]') as HTMLElement;
    if (!scrollContainer) return;

    const scrollThreshold = 80; // Threshold for when to start scrolling
    const minSpeed = 1; // Minimum scroll speed
    const maxSpeed = 12; // Maximum scroll speed
    
    // Get scroll container bounds instead of window viewport
    const containerRect = scrollContainer.getBoundingClientRect();
    const containerLeft = containerRect.left;
    const containerTop = containerRect.top;
    const containerRight = containerRect.right;
    const containerBottom = containerRect.bottom;
    
    let scrollX = 0;
    let scrollY = 0;
    
    // Calculate distances from mouse/box to scroll container edges
    let topDistance = clientY - containerTop;
    let bottomDistance = containerBottom - clientY;
    let leftDistance = clientX - containerLeft;
    let rightDistance = containerRight - clientX;
    
    // If we have box bounds, use the closer of mouse or box edge to trigger scrolling
    if (boxBounds) {
      topDistance = Math.min(topDistance, boxBounds.top - containerTop);
      bottomDistance = Math.min(bottomDistance, containerBottom - boxBounds.bottom);
      leftDistance = Math.min(leftDistance, boxBounds.left - containerLeft);
      rightDistance = Math.min(rightDistance, containerRight - boxBounds.right);
    }
    
    // Check if we can actually scroll in each direction
    const canScrollUp = scrollContainer.scrollTop > 0;
    const canScrollDown = scrollContainer.scrollTop < scrollContainer.scrollHeight - scrollContainer.clientHeight;
    const canScrollLeft = scrollContainer.scrollLeft > 0;
    const canScrollRight = scrollContainer.scrollLeft < scrollContainer.scrollWidth - scrollContainer.clientWidth;
    
    // Check vertical scroll (top/bottom)
    if (topDistance < scrollThreshold && canScrollUp) {
      // Exponential acceleration: slow at far distance, fast when close
      const normalizedDistance = Math.max(0, Math.min(1, 1 - (Math.max(0, topDistance) / scrollThreshold)));
      const easeFactor = Math.pow(normalizedDistance, 2); // Quadratic curve
      const speed = minSpeed + (maxSpeed - minSpeed) * easeFactor;
      scrollY = -speed;
    } else if (bottomDistance < scrollThreshold && canScrollDown) {
      const normalizedDistance = Math.max(0, Math.min(1, 1 - (Math.max(0, bottomDistance) / scrollThreshold)));
      const easeFactor = Math.pow(normalizedDistance, 2);
      const speed = minSpeed + (maxSpeed - minSpeed) * easeFactor;
      scrollY = speed;
    }
    
    // Check horizontal scroll (left/right) - independent of vertical
    if (leftDistance < scrollThreshold && canScrollLeft) {
      const normalizedDistance = Math.max(0, Math.min(1, 1 - (Math.max(0, leftDistance) / scrollThreshold)));
      const easeFactor = Math.pow(normalizedDistance, 2);
      const speed = minSpeed + (maxSpeed - minSpeed) * easeFactor;
      scrollX = -speed;
    } else if (rightDistance < scrollThreshold && canScrollRight) {
      const normalizedDistance = Math.max(0, Math.min(1, 1 - (Math.max(0, rightDistance) / scrollThreshold)));
      const easeFactor = Math.pow(normalizedDistance, 2);
      const speed = minSpeed + (maxSpeed - minSpeed) * easeFactor;
      scrollX = speed;
    }
    
    scrollVelocityRef.current = { x: scrollX, y: scrollY };
    
    // Start animation if needed
    if ((scrollX !== 0 || scrollY !== 0) && !autoScrollAnimationRef.current) {
      startAutoScroll();
    } else if (scrollX === 0 && scrollY === 0 && autoScrollAnimationRef.current) {
      cancelAnimationFrame(autoScrollAnimationRef.current);
      autoScrollAnimationRef.current = null;
    }
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging || activeHandle) {
        handleMouseUp();
      }
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Handle initial drag for new selection
      if (isDragging && startPosRef.current && containerRef.current) {
        // Update current position (with scroll offset for content-relative coords)
        const scrollContainer = document.querySelector('[data-scroll-container]') as HTMLElement;
        const rect = containerRef.current.getBoundingClientRect();
        const scrollLeft = scrollContainer?.scrollLeft || 0;
        const scrollTop = scrollContainer?.scrollTop || 0;
        const x = e.clientX - rect.left + scrollLeft;
        const y = e.clientY - rect.top + scrollTop;
        const newPos = { x, y };
        setCurrentPos(newPos);
        currentPosRef.current = newPos;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        
        // Calculate box bounds in viewport coordinates for auto-scroll (subtract scroll offset)
        const boxLeft = Math.min(startPosRef.current.x, x);
        const boxTop = Math.min(startPosRef.current.y, y);
        const boxRight = Math.max(startPosRef.current.x, x);
        const boxBottom = Math.max(startPosRef.current.y, y);
        const boxBounds = {
          left: rect.left + boxLeft - scrollLeft,
          top: rect.top + boxTop - scrollTop,
          right: rect.left + boxRight - scrollLeft,
          bottom: rect.top + boxBottom - scrollTop,
        };
        
        // Update scroll velocity for smooth auto-scroll
        updateScrollVelocity(e.clientX, e.clientY, boxBounds);
      }
      
      // Handle resize/move of existing captures
      if (activeHandle && resizeDragStartRef.current && originalPendingSelectionRef.current && containerRef.current) {
        // Prevent concurrent updates
        if (isUpdatingRef.current) return;
        isUpdatingRef.current = true;
        
        // Get current scroll position
        const scrollContainer = document.querySelector('[data-scroll-container]') as HTMLElement;
        const currentScrollLeft = scrollContainer?.scrollLeft || 0;
        const currentScrollTop = scrollContainer?.scrollTop || 0;
        
        // Calculate delta accounting for scroll changes
        const scrollDeltaX = currentScrollLeft - initialScrollRef.current.left;
        const scrollDeltaY = currentScrollTop - initialScrollRef.current.top;
        const deltaX = (e.clientX - resizeDragStartRef.current.x) + scrollDeltaX;
        const deltaY = (e.clientY - resizeDragStartRef.current.y) + scrollDeltaY;
        
        let newSelection = { ...originalPendingSelectionRef.current };
        
        switch (activeHandle) {
          case 'tl':
            newSelection.x = originalPendingSelectionRef.current.x + deltaX;
            newSelection.y = originalPendingSelectionRef.current.y + deltaY;
            newSelection.width = originalPendingSelectionRef.current.width - deltaX;
            newSelection.height = originalPendingSelectionRef.current.height - deltaY;
            break;
          case 'tr':
            newSelection.y = originalPendingSelectionRef.current.y + deltaY;
            newSelection.width = originalPendingSelectionRef.current.width + deltaX;
            newSelection.height = originalPendingSelectionRef.current.height - deltaY;
            break;
          case 'bl':
            newSelection.x = originalPendingSelectionRef.current.x + deltaX;
            newSelection.width = originalPendingSelectionRef.current.width - deltaX;
            newSelection.height = originalPendingSelectionRef.current.height + deltaY;
            break;
          case 'br':
            newSelection.width = originalPendingSelectionRef.current.width + deltaX;
            newSelection.height = originalPendingSelectionRef.current.height + deltaY;
            break;
          case 't':
            newSelection.y = originalPendingSelectionRef.current.y + deltaY;
            newSelection.height = originalPendingSelectionRef.current.height - deltaY;
            break;
          case 'r':
            newSelection.width = originalPendingSelectionRef.current.width + deltaX;
            break;
          case 'b':
            newSelection.height = originalPendingSelectionRef.current.height + deltaY;
            break;
          case 'l':
            newSelection.x = originalPendingSelectionRef.current.x + deltaX;
            newSelection.width = originalPendingSelectionRef.current.width - deltaX;
            break;
          case 'move':
            newSelection.x = originalPendingSelectionRef.current.x + deltaX;
            newSelection.y = originalPendingSelectionRef.current.y + deltaY;
            break;
        }
        
        // Ensure minimum size
        if (newSelection.width < 50) newSelection.width = 50;
        if (newSelection.height < 50) newSelection.height = 50;
        
        // Ensure within bounds
        if (newSelection.x < 0) newSelection.x = 0;
        if (newSelection.y < 0) newSelection.y = 0;
        
        // Calculate box bounds in viewport coordinates for auto-scroll
        const rect = containerRef.current.getBoundingClientRect();
        const boxBounds = {
          left: rect.left + newSelection.x - currentScrollLeft,
          top: rect.top + newSelection.y - currentScrollTop,
          right: rect.left + newSelection.x + newSelection.width - currentScrollLeft,
          bottom: rect.top + newSelection.y + newSelection.height - currentScrollTop,
        };
        
        // Update scroll velocity for smooth auto-scroll with box bounds
        updateScrollVelocity(e.clientX, e.clientY, boxBounds);
        
        // Update active capture or blur area
        if (isResizingBlur && activeBlurIndex !== null && onUpdateBlurArea) {
          onUpdateBlurArea(activeBlurIndex, newSelection);
        } else if (activeCaptureIndex !== null && onUpdateCapture) {
          onUpdateCapture(activeCaptureIndex, newSelection);
        }
        
        // Reset update flag
        requestAnimationFrame(() => {
          isUpdatingRef.current = false;
        });
      }
    };

    if (isDragging || activeHandle) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
    }
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      // Cleanup auto-scroll animation on unmount
      if (autoScrollAnimationRef.current) {
        cancelAnimationFrame(autoScrollAnimationRef.current);
      }
      scrollVelocityRef.current = { x: 0, y: 0 };
    };
  }, [isDragging, activeHandle, activeCaptureIndex, activeBlurIndex, isBlurMode, onCapture, onBlurArea, onUpdateCapture, onUpdateBlurArea, isResizingBlur]);

  const getCurrentSelection = (): Selection | null => {
    if (!startPos || !currentPos) return null;
    return {
      x: Math.min(startPos.x, currentPos.x),
      y: Math.min(startPos.y, currentPos.y),
      width: Math.abs(currentPos.x - startPos.x),
      height: Math.abs(currentPos.y - startPos.y),
    };
  };

  const currentSelection = getCurrentSelection();

  const handleWheel = (e: React.WheelEvent) => {
    // Pass wheel events through to the scroll container
    const scrollContainer = document.querySelector('[data-scroll-container]') as HTMLElement;
    if (scrollContainer && !isDragging && !activeHandle) {
      scrollContainer.scrollTop += e.deltaY;
      scrollContainer.scrollLeft += e.deltaX;
    }
  };

  return (
    <div
      ref={overlayRef}
      className={`absolute inset-0 ${isDemoComplete ? (isBlurMode ? 'cursor-crosshair' : 'cursor-crosshair') : 'pointer-events-none'}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
      style={{ zIndex: 10, clipPath }}
    >
      {/* Render previous captures */}
      {captures.map((capture, index) => {
        const isActive = activeCaptureIndex === index;
        return (
          <div
            key={`capture-${index}`}
            className={`absolute border-2 border-[#FF6B35] pointer-events-auto group ${
              isActive ? 'bg-[rgba(255,107,53,0.2)]' : 'bg-[rgba(255,107,53,0.1)]'
            }`}
            style={{
              left: capture.x - scrollOffset.left,
              top: capture.y - scrollOffset.top,
              width: capture.width,
              height: capture.height,
              cursor: isBlurMode ? 'crosshair' : (isActive ? (activeHandle === 'move' ? 'grabbing' : 'grab') : 'pointer'),
              pointerEvents: isBlurMode ? 'none' : 'auto',
            }}
            onClick={(e) => {
              if (!isBlurMode) {
                e.stopPropagation();
                setActiveCaptureIndex(index);
              }
            }}
            onMouseDown={(e) => {
              if (isActive && !isBlurMode) {
                handleResizeMouseDown(e, 'move', index);
              }
            }}
          >
            <div className="absolute -top-6 left-0 bg-[#1A1F2E] border border-[#FF6B35] rounded px-2 py-0.5 pointer-events-none">
              <span className="text-xs text-[#FF6B35]">Capture {index + 1}</span>
            </div>
            {onDeleteCapture && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteCapture(index);
                  setActiveCaptureIndex(null);
                }}
                className="absolute -bottom-7 -left-1 w-5 h-5 bg-[#FF6B35] hover:bg-[#ff8558] rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20"
                title="Remove capture"
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2L10 10M10 2L2 10" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
            
            {/* Resize handles - always visible, but only interactive when not in blur mode */}
            <>
              {/* Corner Handles */}
              {['tl', 'tr', 'bl', 'br'].map((handle) => (
                <div
                  key={handle}
                  className="absolute w-4 h-4 bg-[#FF6B35] border-2 border-white rounded-full hover:scale-125 transition-transform cursor-pointer z-10"
                  style={{
                    [handle.includes('t') ? 'top' : 'bottom']: -6,
                    [handle.includes('l') ? 'left' : 'right']: -6,
                    cursor: `${handle.includes('t') ? 'n' : 's'}${handle.includes('l') ? 'w' : 'e'}-resize`,
                    pointerEvents: isBlurMode ? 'none' : 'auto',
                  }}
                  onMouseDown={(e) => handleResizeMouseDown(e, handle as ResizeHandle, index)}
                />
              ))}

              {/* Edge Handles */}
              {['t', 'r', 'b', 'l'].map((handle) => (
                <div
                  key={handle}
                  className="absolute bg-[#FF6B35] hover:bg-[#FFA07A] transition-colors cursor-pointer z-10"
                  style={{
                    ...(handle === 't' || handle === 'b'
                      ? { left: '50%', transform: 'translateX(-50%)', width: 40, height: 8 }
                      : { top: '50%', transform: 'translateY(-50%)', width: 8, height: 40 }),
                    [handle]: -4,
                    cursor: `${handle === 't' || handle === 'b' ? 'ns' : 'ew'}-resize`,
                    borderRadius: 4,
                    pointerEvents: isBlurMode ? 'none' : 'auto',
                  }}
                  onMouseDown={(e) => handleResizeMouseDown(e, handle as ResizeHandle, index)}
                />
              ))}

              {/* Center Move Icon - only show when active and not in blur mode */}
              {isActive && !isBlurMode && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                  <div className="bg-[#FF6B35] rounded-full p-1.5 shadow-lg">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-white">
                      <path d="M8 1V15M1 8H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
              )}
            </>
          </div>
        );
      })}

      {/* Render blur areas */}
      {blurAreas.map((area, index) => {
        const isActive = activeBlurIndex === index;
        return (
          <div
            key={`blur-${index}`}
            className={`absolute pointer-events-auto group ${
              isActive ? 'bg-[rgba(255,107,53,0.25)]' : 'bg-[rgba(255,107,53,0.2)]'
            }`}
            style={{
              left: area.x - scrollOffset.left,
              top: area.y - scrollOffset.top,
              width: area.width,
              height: area.height,
              backdropFilter: 'blur(8px)',
              border: '2px dashed rgba(255, 107, 53, 0.5)',
              cursor: isActive ? (activeHandle === 'move' ? 'grabbing' : 'grab') : 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation();
              setActiveBlurIndex(index);
              setActiveCaptureIndex(null);
            }}
            onMouseDown={(e) => {
              if (isActive) {
                handleResizeMouseDown(e, 'move', undefined, index);
              }
            }}
          >
            <div className="absolute -top-6 left-0 bg-[#1A1F2E] border border-[#FF6B35] rounded px-2 py-0.5 pointer-events-none">
              <span className="text-xs text-[#FF6B35]">Blur {index + 1}</span>
            </div>
            {onDeleteBlurArea && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteBlurArea(index);
                  setActiveBlurIndex(null);
                }}
                className="absolute -bottom-7 -left-1 w-5 h-5 bg-[#FF6B35] hover:bg-[#ff8558] rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20"
                title="Remove blur"
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2L10 10M10 2L2 10" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
            
            {/* Resize handles - always visible */}
            <>
              {/* Corner Handles */}
              {['tl', 'tr', 'bl', 'br'].map((handle) => (
                <div
                  key={handle}
                  className="absolute w-4 h-4 bg-[#FF6B35] border-2 border-white rounded-full hover:scale-125 transition-transform cursor-pointer z-10"
                  style={{
                    [handle.includes('t') ? 'top' : 'bottom']: -6,
                    [handle.includes('l') ? 'left' : 'right']: -6,
                    cursor: `${handle.includes('t') ? 'n' : 's'}${handle.includes('l') ? 'w' : 'e'}-resize`,
                  }}
                  onMouseDown={(e) => handleResizeMouseDown(e, handle as ResizeHandle, undefined, index)}
                />
              ))}

              {/* Edge Handles */}
              {['t', 'r', 'b', 'l'].map((handle) => (
                <div
                  key={handle}
                  className="absolute bg-[#FF6B35] hover:bg-[#FFA07A] transition-colors cursor-pointer z-10"
                  style={{
                    ...(handle === 't' || handle === 'b'
                      ? { left: '50%', transform: 'translateX(-50%)', width: 40, height: 8 }
                      : { top: '50%', transform: 'translateY(-50%)', width: 8, height: 40 }),
                    [handle]: -4,
                    cursor: `${handle === 't' || handle === 'b' ? 'ns' : 'ew'}-resize`,
                    borderRadius: 4,
                  }}
                  onMouseDown={(e) => handleResizeMouseDown(e, handle as ResizeHandle, undefined, index)}
                />
              ))}

              {/* Center Move Icon - only show when active */}
              {isActive && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                  <div className="bg-[#FF6B35] rounded-full p-1.5 shadow-lg">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-white">
                      <path d="M8 1V15M1 8H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
              )}
            </>
          </div>
        );
      })}

      {/* Current selection being drawn */}
      {isDragging && currentSelection && currentSelection.width > 0 && currentSelection.height > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`absolute border-2 pointer-events-none ${
            isBlurMode
              ? 'border-dashed border-[#FF6B35] bg-[rgba(255,107,53,0.15)]'
              : 'border-[#FF6B35] bg-[rgba(255,107,53,0.15)]'
          }`}
          style={{
            left: currentSelection.x - scrollOffset.left,
            top: currentSelection.y - scrollOffset.top,
            width: currentSelection.width,
            height: currentSelection.height,
          }}
        >
          {/* Selection size indicator */}
          <div className="absolute -top-6 left-0 bg-[#1A1F2E] border border-[#FF6B35] rounded px-2 py-0.5">
            <span className="text-xs text-[#FF6B35]">
              {Math.round(currentSelection.width)} × {Math.round(currentSelection.height)}
            </span>
          </div>
        </motion.div>
      )}

    </div>
  );
}
