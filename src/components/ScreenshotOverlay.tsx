import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MarkupTools } from './MarkupTools';
import { Project } from './ProjectBrowser';
import type { MarkupTool, MarkupElement } from './MarkupTools';

interface Selection {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CaptureData extends Selection {
  title: string;
  folder: string;
  blurActive: boolean;
}

interface ScreenshotOverlayProps {
  containerRef: React.RefObject<HTMLDivElement>;
  tableContainerRef: React.RefObject<HTMLDivElement>;
  onCapture: (selection: Selection) => void;
  isBlurMode: boolean;
  onBlurArea: (selection: Selection) => void;
  captures: CaptureData[];
  blurAreas: Selection[];
  isDemoComplete: boolean;
  onDeleteCapture?: (index: number) => void;
  onDeleteBlurArea?: (index: number) => void;
  onUpdateCapture?: (index: number, selection: Selection) => void;
  onUpdateBlurArea?: (index: number, selection: Selection) => void;
  onUpdateCaptureTitle?: (index: number, title: string) => void;
  onUpdateCaptureFolder?: (index: number, folder: string) => void;
  onToggleBlur?: (index: number) => void;
  selectedCaptureIndices?: number[];
  onSelectedCapturesChange?: (indices: number[]) => void;
  isShiftPressed?: boolean;
  projects?: Project[];
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
  onUpdateCaptureTitle,
  onUpdateCaptureFolder,
  onToggleBlur,
  selectedCaptureIndices: externalSelectedIndices = [],
  onSelectedCapturesChange,
  isShiftPressed = false,
  projects = [],
}: ScreenshotOverlayProps) {
  // ============ STATE ============
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [activeBlurIndex, setActiveBlurIndex] = useState<number | null>(null);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle>(null);
  const [scrollOffset, setScrollOffset] = useState({ left: 0, top: 0 });
  const [clipPath, setClipPath] = useState<string>('none');
  const [editingCaptureIndex, setEditingCaptureIndex] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  
  // Use external selectedCaptureIndices
  const selectedCaptureIndices = externalSelectedIndices;
  const setSelectedCaptureIndices = (indices: number[]) => {
    if (onSelectedCapturesChange) {
      onSelectedCapturesChange(indices);
    }
  };
  
  // Helper to check if a capture is selected
  const isCaptureSelected = (index: number) => selectedCaptureIndices.includes(index);
  
  // Get the active capture index (first selected one for backward compatibility)
  const activeCaptureIndex = selectedCaptureIndices.length > 0 ? selectedCaptureIndices[0] : null;
  
  // Markup state
  const [markupElements, setMarkupElements] = useState<MarkupElement[]>([]);
  const [activeMarkupTool, setActiveMarkupTool] = useState<MarkupTool>(null);
  const [drawColor, setDrawColor] = useState('#FF6B35');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [textColor, setTextColor] = useState('#FF6B35');
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState('Inter');

  // ============ REFS ============
  const overlayRef = useRef<HTMLDivElement>(null);
  
  // Refs for tracking state in event handlers
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const currentPosRef = useRef<{ x: number; y: number } | null>(null);
  const resizeDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const originalSelectionRef = useRef<Selection | null>(null);
  const initialScrollRef = useRef<{ left: number; top: number }>({ left: 0, top: 0 });
  
  // Auto-scroll refs
  const autoScrollFrameRef = useRef<number | null>(null);
  const mousePositionRef = useRef<{ clientX: number; clientY: number } | null>(null);

  // ============ SCROLL TRACKING & CLIPPING ============
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
      
      const clipTop = tableRect.top - containerRect.top;
      const clipLeft = tableRect.left - containerRect.left;
      const clipRight = containerRect.right - tableRect.right;
      const clipBottom = containerRect.bottom - tableRect.bottom;
      
      setClipPath(`inset(${clipTop}px ${clipRight}px ${clipBottom}px ${clipLeft}px round 0px 0px 12px 12px)`);
    };

    scrollContainer.addEventListener('scroll', updateBounds);
    window.addEventListener('resize', updateBounds);
    updateBounds();
    
    return () => {
      scrollContainer.removeEventListener('scroll', updateBounds);
      window.removeEventListener('resize', updateBounds);
    };
  }, []);

  // ============ KEYBOARD DELETE ============
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeCaptureIndex !== null && onDeleteCapture) {
          e.preventDefault();
          onDeleteCapture(activeCaptureIndex);
          setSelectedCaptureIndices([]);
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

  // ============ AUTO-SCROLL SYSTEM (REBUILT FROM SCRATCH) ============
  
  // Start the auto-scroll animation loop
  const startAutoScrollLoop = () => {
    if (autoScrollFrameRef.current) return; // Already running

    const scrollContainer = document.querySelector('[data-scroll-container]') as HTMLElement;
    if (!scrollContainer) return;

    const EDGE_THRESHOLD = 60; // Distance from edge to trigger scroll (pixels)
    const MAX_SCROLL_SPEED = 12; // Maximum pixels per frame

    const animate = () => {
      const mouse = mousePositionRef.current;
      if (!mouse) {
        autoScrollFrameRef.current = null;
        return;
      }

      const scrollRect = scrollContainer.getBoundingClientRect();
      
      // Calculate distance from mouse to each edge
      const distanceFromTop = mouse.clientY - scrollRect.top;
      const distanceFromBottom = scrollRect.bottom - mouse.clientY;
      const distanceFromLeft = mouse.clientX - scrollRect.left;
      const distanceFromRight = scrollRect.right - mouse.clientX;

      // Check if we can scroll in each direction
      const canScrollUp = scrollContainer.scrollTop > 0;
      const canScrollDown = scrollContainer.scrollTop < scrollContainer.scrollHeight - scrollContainer.clientHeight;
      const canScrollLeft = scrollContainer.scrollLeft > 0;
      const canScrollRight = scrollContainer.scrollLeft < scrollContainer.scrollWidth - scrollContainer.clientWidth;

      let scrollX = 0;
      let scrollY = 0;

      // Calculate vertical scroll
      if (distanceFromTop < EDGE_THRESHOLD && canScrollUp) {
        // Near top edge - scroll up
        const intensity = 1 - (distanceFromTop / EDGE_THRESHOLD); // 0 to 1
        scrollY = -Math.ceil(intensity * MAX_SCROLL_SPEED);
      } else if (distanceFromBottom < EDGE_THRESHOLD && canScrollDown) {
        // Near bottom edge - scroll down
        const intensity = 1 - (distanceFromBottom / EDGE_THRESHOLD);
        scrollY = Math.ceil(intensity * MAX_SCROLL_SPEED);
      }

      // Calculate horizontal scroll
      if (distanceFromLeft < EDGE_THRESHOLD && canScrollLeft) {
        // Near left edge - scroll left
        const intensity = 1 - (distanceFromLeft / EDGE_THRESHOLD);
        scrollX = -Math.ceil(intensity * MAX_SCROLL_SPEED);
      } else if (distanceFromRight < EDGE_THRESHOLD && canScrollRight) {
        // Near right edge - scroll right
        const intensity = 1 - (distanceFromRight / EDGE_THRESHOLD);
        scrollX = Math.ceil(intensity * MAX_SCROLL_SPEED);
      }

      // Apply scroll
      if (scrollY !== 0) {
        scrollContainer.scrollTop += scrollY;
      }
      if (scrollX !== 0) {
        scrollContainer.scrollLeft += scrollX;
      }

      // Continue loop if still active
      if (isDragging || activeHandle) {
        autoScrollFrameRef.current = requestAnimationFrame(animate);
      } else {
        autoScrollFrameRef.current = null;
      }
    };

    autoScrollFrameRef.current = requestAnimationFrame(animate);
  };

  // Stop auto-scroll
  const stopAutoScroll = () => {
    if (autoScrollFrameRef.current) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
    mousePositionRef.current = null;
  };

  // Update mouse position for auto-scroll
  const updateMousePosition = (clientX: number, clientY: number) => {
    mousePositionRef.current = { clientX, clientY };
    
    // Start auto-scroll if not already running
    if ((isDragging || activeHandle) && !autoScrollFrameRef.current) {
      startAutoScrollLoop();
    }
  };

  // ============ MOUSE HANDLERS ============

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !isDemoComplete) return;

    // Keep existing capture selections visible when drawing new boxes
    // Only deactivate blur areas
    setActiveBlurIndex(null);

    const scrollContainer = document.querySelector('[data-scroll-container]') as HTMLElement;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = scrollContainer?.scrollLeft || 0;
    const scrollTop = scrollContainer?.scrollTop || 0;
    
    // Calculate position in content coordinates (including scroll offset)
    const x = e.clientX - rect.left + scrollLeft;
    const y = e.clientY - rect.top + scrollTop;

    const pos = { x, y };
    setIsDragging(true);
    setStartPos(pos);
    startPosRef.current = pos;
    setCurrentPos(pos);
    currentPosRef.current = pos;
    
    // Start tracking mouse for auto-scroll
    updateMousePosition(e.clientX, e.clientY);
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
    
    // Update mouse position for auto-scroll
    updateMousePosition(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    // Stop auto-scroll
    stopAutoScroll();

    // Handle resize end
    if (activeHandle) {
      setActiveHandle(null);
      resizeDragStartRef.current = null;
      originalSelectionRef.current = null;
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
      // Check if any selected capture has blur mode active
      const activeBlurCapture = activeCaptureIndex !== null && captures[activeCaptureIndex]?.blurActive;
      
      if (activeBlurCapture) {
        // Blur mode is active for the selected capture - create blur boxes within it
        const capture = captures[activeCaptureIndex];
        const isWithinCaptureBox = (
          selection.x >= capture.x &&
          selection.y >= capture.y &&
          selection.x + selection.width <= capture.x + capture.width &&
          selection.y + selection.height <= capture.y + capture.height
        );
        
        if (isWithinCaptureBox) {
          // Create a blur box
          onBlurArea(selection);
        } else {
          // Don't create blur area if it's outside the capture box
          console.log('Blur areas can only be created within the capture box');
        }
      } else {
        // Normal mode - create a new capture
        onCapture(selection);
      }
    }

    setIsDragging(false);
    setStartPos(null);
    startPosRef.current = null;
    setCurrentPos(null);
    currentPosRef.current = null;
  };

  const handleResizeMouseDown = (e: React.MouseEvent, handle: ResizeHandle, captureIndex?: number, blurIndex?: number) => {
    e.stopPropagation();
    
    // Store initial scroll position
    const scrollContainer = document.querySelector('[data-scroll-container]') as HTMLElement;
    initialScrollRef.current = {
      left: scrollContainer?.scrollLeft || 0,
      top: scrollContainer?.scrollTop || 0
    };
    
    if (captureIndex !== undefined) {
      setSelectedCaptureIndices([captureIndex]);
      setActiveBlurIndex(null);
      setActiveHandle(handle);
      const dragStart = { x: e.clientX, y: e.clientY };
      resizeDragStartRef.current = dragStart;
      originalSelectionRef.current = captures[captureIndex];
    } else if (blurIndex !== undefined) {
      setActiveBlurIndex(blurIndex);
      // Don't deselect captures when interacting with blur boxes
      setActiveHandle(handle);
      const dragStart = { x: e.clientX, y: e.clientY };
      resizeDragStartRef.current = dragStart;
      originalSelectionRef.current = blurAreas[blurIndex];
    }
    
    // Start tracking mouse for auto-scroll
    updateMousePosition(e.clientX, e.clientY);
  };

  // ============ GLOBAL MOUSE HANDLERS ============
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging || activeHandle) {
        handleMouseUp();
      }
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Update mouse position for auto-scroll
      if (isDragging || activeHandle) {
        updateMousePosition(e.clientX, e.clientY);
      }

      // Handle new capture drag
      if (isDragging && startPosRef.current && containerRef.current) {
        const scrollContainer = document.querySelector('[data-scroll-container]') as HTMLElement;
        const rect = containerRef.current.getBoundingClientRect();
        const scrollLeft = scrollContainer?.scrollLeft || 0;
        const scrollTop = scrollContainer?.scrollTop || 0;
        const x = e.clientX - rect.left + scrollLeft;
        const y = e.clientY - rect.top + scrollTop;
        const newPos = { x, y };
        setCurrentPos(newPos);
        currentPosRef.current = newPos;
      }
      
      // Handle resize/move of existing captures
      if (activeHandle && resizeDragStartRef.current && originalSelectionRef.current && containerRef.current) {
        const scrollContainer = document.querySelector('[data-scroll-container]') as HTMLElement;
        const currentScrollLeft = scrollContainer?.scrollLeft || 0;
        const currentScrollTop = scrollContainer?.scrollTop || 0;
        
        // Calculate delta accounting for scroll changes
        const scrollDeltaX = currentScrollLeft - initialScrollRef.current.left;
        const scrollDeltaY = currentScrollTop - initialScrollRef.current.top;
        const deltaX = (e.clientX - resizeDragStartRef.current.x) + scrollDeltaX;
        const deltaY = (e.clientY - resizeDragStartRef.current.y) + scrollDeltaY;
        
        let newSelection = { ...originalSelectionRef.current };
        
        switch (activeHandle) {
          case 'tl':
            newSelection.x = originalSelectionRef.current.x + deltaX;
            newSelection.y = originalSelectionRef.current.y + deltaY;
            newSelection.width = originalSelectionRef.current.width - deltaX;
            newSelection.height = originalSelectionRef.current.height - deltaY;
            break;
          case 'tr':
            newSelection.y = originalSelectionRef.current.y + deltaY;
            newSelection.width = originalSelectionRef.current.width + deltaX;
            newSelection.height = originalSelectionRef.current.height - deltaY;
            break;
          case 'bl':
            newSelection.x = originalSelectionRef.current.x + deltaX;
            newSelection.width = originalSelectionRef.current.width - deltaX;
            newSelection.height = originalSelectionRef.current.height + deltaY;
            break;
          case 'br':
            newSelection.width = originalSelectionRef.current.width + deltaX;
            newSelection.height = originalSelectionRef.current.height + deltaY;
            break;
          case 't':
            newSelection.y = originalSelectionRef.current.y + deltaY;
            newSelection.height = originalSelectionRef.current.height - deltaY;
            break;
          case 'r':
            newSelection.width = originalSelectionRef.current.width + deltaX;
            break;
          case 'b':
            newSelection.height = originalSelectionRef.current.height + deltaY;
            break;
          case 'l':
            newSelection.x = originalSelectionRef.current.x + deltaX;
            newSelection.width = originalSelectionRef.current.width - deltaX;
            break;
          case 'move':
            newSelection.x = originalSelectionRef.current.x + deltaX;
            newSelection.y = originalSelectionRef.current.y + deltaY;
            break;
        }
        
        // Ensure minimum size
        if (newSelection.width < 50) newSelection.width = 50;
        if (newSelection.height < 50) newSelection.height = 50;
        
        // Ensure within bounds
        if (newSelection.x < 0) newSelection.x = 0;
        if (newSelection.y < 0) newSelection.y = 0;
        
        // Update active capture or blur area
        if (activeBlurIndex !== null && onUpdateBlurArea) {
          onUpdateBlurArea(activeBlurIndex, newSelection);
        } else if (activeCaptureIndex !== null && onUpdateCapture) {
          onUpdateCapture(activeCaptureIndex, newSelection);
        }
      }
    };

    if (isDragging || activeHandle) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
    }
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      
      // Cleanup auto-scroll on unmount
      if (autoScrollFrameRef.current) {
        cancelAnimationFrame(autoScrollFrameRef.current);
        autoScrollFrameRef.current = null;
      }
    };
  }, [isDragging, activeHandle, activeCaptureIndex, activeBlurIndex, isBlurMode, onCapture, onBlurArea, onUpdateCapture, onUpdateBlurArea]);

  // ============ HELPER FUNCTIONS ============

  const getCurrentSelection = (): Selection | null => {
    if (!startPos || !currentPos) return null;
    return {
      x: Math.min(startPos.x, currentPos.x),
      y: Math.min(startPos.y, currentPos.y),
      width: Math.abs(currentPos.x - startPos.x),
      height: Math.abs(currentPos.y - startPos.y),
    };
  };

  const handleWheel = (e: React.WheelEvent) => {
    const scrollContainer = document.querySelector('[data-scroll-container]') as HTMLElement;
    if (scrollContainer && !isDragging && !activeHandle) {
      scrollContainer.scrollTop += e.deltaY;
      scrollContainer.scrollLeft += e.deltaX;
    }
  };

  const currentSelection = getCurrentSelection();

  // ============ RENDER ============
  
  return (
    <div
      ref={overlayRef}
      className={`absolute inset-0 ${isDemoComplete ? 'cursor-crosshair' : 'pointer-events-none'}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
      style={{ zIndex: 10, clipPath }}
    >
      {/* Render previous captures */}
      {captures.map((capture, index) => {
        const isActive = isCaptureSelected(index);
        const isMultiSelected = isActive && selectedCaptureIndices.length > 1;
        const isBlurring = capture.blurActive && isActive;
        return (
          <div
            key={`capture-${index}`}
            className={`absolute pointer-events-auto group rounded-xl bg-[rgba(255,107,53,0.2)] ${isMultiSelected ? 'shadow-[0_0_0_2px_rgba(255,107,53,0.5)]' : ''}`}
            style={{
              left: capture.x - scrollOffset.left,
              top: capture.y - scrollOffset.top,
              width: capture.width,
              height: capture.height,
              cursor: isBlurring ? 'crosshair' : (isActive ? (activeHandle === 'move' ? 'grabbing' : 'grab') : 'pointer'),
              pointerEvents: 'auto',
            }}
            onClick={(e) => {
              if (!isBlurring) {
                e.stopPropagation();
                // Handle multi-selection with shift key
                if (isShiftPressed && selectedCaptureIndices.length > 0) {
                  // Add to selection if not already selected
                  if (!isCaptureSelected(index)) {
                    setSelectedCaptureIndices([...selectedCaptureIndices, index]);
                  }
                } else {
                  // Single selection (replace current selection)
                  setSelectedCaptureIndices([index]);
                }
              }
            }}
            onMouseDown={(e) => {
              if (isActive && !isBlurring) {
                handleResizeMouseDown(e, 'move', index);
              }
            }}
          >
            {onDeleteCapture && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteCapture(index);
                  // Remove from selection if it was selected
                  setSelectedCaptureIndices(selectedCaptureIndices.filter(i => i !== index));
                }}
                className="absolute -bottom-7 -left-1 w-5 h-5 bg-[#FF6B35] hover:bg-[#ff8558] rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20"
                title="Remove capture"
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2L10 10M10 2L2 10" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
            
            {/* Resize handles */}
            <>
              {/* Corner Handles */}
              {isActive && !isBlurring && ['tl', 'tr', 'bl', 'br'].map((handle) => (
                <div
                  key={handle}
                  className="absolute w-2 h-2 bg-[#FF6B35] rounded-full hover:scale-125 transition-transform cursor-pointer z-10"
                  style={{
                    [handle.includes('t') ? 'top' : 'bottom']: -6,
                    [handle.includes('l') ? 'left' : 'right']: -6,
                    cursor: `${handle.includes('t') ? 'n' : 's'}${handle.includes('l') ? 'w' : 'e'}-resize`,
                  }}
                  onMouseDown={(e) => handleResizeMouseDown(e, handle as ResizeHandle, index)}
                />
              ))}
            </>
          </div>
        );
      })}

      {/* Render blur areas */}
      {blurAreas.map((blur, index) => {
        const isActive = activeBlurIndex === index;
        return (
          <div
            key={`blur-${index}`}
            className="absolute pointer-events-auto group rounded-xl bg-[rgba(59,130,246,0.2)]"
            style={{
              left: blur.x - scrollOffset.left,
              top: blur.y - scrollOffset.top,
              width: blur.width,
              height: blur.height,
              backdropFilter: 'blur(12px)',
              cursor: isActive ? (activeHandle === 'move' ? 'grabbing' : 'grab') : 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation();
              setActiveBlurIndex(index);
            }}
            onMouseDown={(e) => {
              if (isActive) {
                handleResizeMouseDown(e, 'move', undefined, index);
              }
            }}
          >
            {onDeleteBlurArea && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteBlurArea(index);
                  setActiveBlurIndex(null);
                }}
                className="absolute -bottom-7 -left-1 w-5 h-5 bg-blue-500 hover:bg-blue-400 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20"
                title="Remove blur"
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2L10 10M10 2L2 10" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}

            {/* Resize handles */}
            <>
              {/* Corner Handles */}
              {isActive && ['tl', 'tr', 'bl', 'br'].map((handle) => (
                <div
                  key={handle}
                  className="absolute w-2 h-2 bg-blue-500 rounded-full hover:scale-125 transition-transform cursor-pointer z-10"
                  style={{
                    [handle.includes('t') ? 'top' : 'bottom']: -6,
                    [handle.includes('l') ? 'left' : 'right']: -6,
                    cursor: `${handle.includes('t') ? 'n' : 's'}${handle.includes('l') ? 'w' : 'e'}-resize`,
                  }}
                  onMouseDown={(e) => handleResizeMouseDown(e, handle as ResizeHandle, undefined, index)}
                />
              ))}
            </>
          </div>
        );
      })}

      {/* Current selection being drawn */}
      {isDragging && currentSelection && currentSelection.width > 0 && currentSelection.height > 0 && (() => {
        // Check if we're drawing a blur box (when a capture has blurActive)
        const isDrawingBlur = activeCaptureIndex !== null && captures[activeCaptureIndex]?.blurActive;
        return (
          <div
            className={`absolute pointer-events-none rounded-xl ${
              isDrawingBlur ? 'border-2 border-blue-500 bg-[rgba(59,130,246,0.2)]' : 'border-2 border-[#FF6B35] bg-[rgba(255,107,53,0.2)]'
            }`}
            style={{
              left: currentSelection.x - scrollOffset.left,
              top: currentSelection.y - scrollOffset.top,
              width: currentSelection.width,
              height: currentSelection.height,
            }}
          >
            <div className={`absolute -top-6 left-0 ${isDrawingBlur ? 'bg-[#1A1F2E] border border-blue-500' : 'bg-[#1A1F2E] border border-[#FF6B35]'} rounded px-2 py-0.5`}>
              <span className={`text-xs ${isDrawingBlur ? 'text-blue-400' : 'text-[#FF6B35]'}`}>
                {Math.round(currentSelection.width)} × {Math.round(currentSelection.height)}
              </span>
            </div>
          </div>
        );
      })()}

      {/* Markup Tools - Only show for active capture when markup is active */}
      {!isBlurMode && activeCaptureIndex !== null && captures[activeCaptureIndex] && captures[activeCaptureIndex].markupActive && (
        <MarkupTools
          captureIndex={activeCaptureIndex}
          captureBox={captures[activeCaptureIndex]}
          scrollOffset={scrollOffset}
          activeTool={activeMarkupTool}
          onToolChange={setActiveMarkupTool}
          drawColor={drawColor}
          onDrawColorChange={setDrawColor}
          strokeWidth={strokeWidth}
          onStrokeWidthChange={setStrokeWidth}
          textColor={textColor}
          onTextColorChange={setTextColor}
          fontSize={fontSize}
          onFontSizeChange={setFontSize}
          fontFamily={fontFamily}
          onFontFamilyChange={setFontFamily}
        />
      )}
    </div>
  );
}