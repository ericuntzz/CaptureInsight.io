import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Share2, Download, Settings, Copy, Eye, EyeOff, WrapText, ArrowUpAZ, ArrowDownAZ, Plus } from 'lucide-react';
import { marketingData } from '../data/mockData';
import { toast } from 'sonner';

interface Sheet {
  id: string;
  name: string;
  rowCount: number;
  lastModified: string;
}

interface SpreadsheetProps {
  onHover: (isHovering: boolean) => void;
  demoSelection: { startRow: number; startCol: number; endRow: number; endCol: number } | null;
  scrollRef: React.RefObject<HTMLDivElement>;
  tableContainerRef?: React.RefObject<HTMLDivElement>;
  sheets?: Sheet[]; // All files in the current folder
  currentSheetId?: string | null; // Currently selected file
  onSheetChange?: (sheetId: string) => void; // Callback when switching files
  onAddDataCapture?: (spaceId: string, folderId: string) => void; // Callback to add data capture
  spaceId?: string; // Space ID for data capture
  folderId?: string; // Folder ID for data capture
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  type: 'column' | 'row' | 'cell' | null;
  index: number | null;
  columnKey?: string;
}

interface Selection {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

type TextWrapMode = 'overflow' | 'wrap' | 'clip';

export function Spreadsheet({ 
  onHover, 
  demoSelection, 
  scrollRef,
  tableContainerRef,
  sheets = [],
  currentSheetId = null,
  onSheetChange,
  onAddDataCapture,
  spaceId,
  folderId,
}: SpreadsheetProps) {
  // Define initialColumns first before any state that references it
  const initialColumns = [
    { key: 'account_id', label: 'account_id', width: 120, align: 'left' as const },
    { key: 'account_name', label: 'account_name', width: 280, align: 'left' as const },
    { key: 'pricing_type', label: 'pricing_type', width: 140, align: 'left' as const },
    { key: 'usage_frequency', label: 'usage_frequency', width: 160, align: 'left' as const },
    { key: 'product_revenue', label: 'product_revenue', width: 160, align: 'right' as const },
    { key: 'processing_revenue', label: 'processing_revenue', width: 180, align: 'right' as const },
    { key: 'first_transaction_date', label: 'first_transaction_date', width: 200, align: 'left' as const },
    { key: 'registrant_count', label: 'registrant_count', width: 160, align: 'right' as const },
    { key: 'attribution', label: 'attribution', width: 180, align: 'left' as const },
  ];

  const headerScrollRef = useRef<HTMLDivElement>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState('');
  const editingInputRef = useRef<HTMLInputElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    type: null,
    index: null,
  });
  const [selection, setSelection] = useState<Selection | null>(null);
  const [multiSelections, setMultiSelections] = useState<Selection[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [textWrapModes, setTextWrapModes] = useState<Record<string, TextWrapMode>>({});
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<number, number>>({});
  const [resizing, setResizing] = useState<{ type: 'column' | 'row', index: number | string, startPos: number, startSize: number } | null>(null);
  const [data, setData] = useState(marketingData);
  const [isMetaKeyPressed, setIsMetaKeyPressed] = useState(false);
  const [quickCopyPosition, setQuickCopyPosition] = useState<{ x: number; y: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editingHeader, setEditingHeader] = useState<string | null>(null);
  const [columnLabels, setColumnLabels] = useState<Record<string, string>>(() => {
    const labels: Record<string, string> = {};
    initialColumns.forEach(col => {
      labels[col.key] = col.label;
    });
    return labels;
  });
  const [draggedRow, setDraggedRow] = useState<number | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ type: 'row' | 'column'; index: number | string } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const [sortState, setSortState] = useState<Record<string, 'asc' | 'desc' | null>>({});

  // Focus input when editing starts
  useEffect(() => {
    if (editingTabId && editingInputRef.current) {
      editingInputRef.current.focus();
      editingInputRef.current.select();
    }
  }, [editingTabId]);

  const handleTabDoubleClick = (sheet: Sheet, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTabId(sheet.id);
    setEditingTabName(sheet.name);
  };

  const handleTabNameChange = (sheetId: string) => {
    if (editingTabName.trim() && editingTabName !== sheets.find(s => s.id === sheetId)?.name) {
      // TODO: Add callback to update sheet name in parent
      toast.success('Tab name updated');
    }
    setEditingTabId(null);
    setEditingTabName('');
  };

  const columns = initialColumns.filter(col => !hiddenColumns.has(col.key));

  const getColumnWidth = (key: string) => {
    return columnWidths[key] || initialColumns.find(c => c.key === key)?.width || 120;
  };

  const getRowHeight = (index: number) => {
    return rowHeights[index] || 40;
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (headerScrollRef.current && scrollRef.current) {
      headerScrollRef.current.scrollLeft = scrollRef.current.scrollLeft;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    
    const scrollAmount = 40;
    
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        scrollRef.current.scrollLeft -= scrollAmount;
        break;
      case 'ArrowRight':
        e.preventDefault();
        scrollRef.current.scrollLeft += scrollAmount;
        break;
      case 'ArrowUp':
        e.preventDefault();
        scrollRef.current.scrollTop -= scrollAmount;
        break;
      case 'ArrowDown':
        e.preventDefault();
        scrollRef.current.scrollTop += scrollAmount;
        break;
    }
  };

  const isCellInDemoSelection = (rowIndex: number, colIndex: number) => {
    if (!demoSelection) return false;
    return (
      rowIndex >= demoSelection.startRow &&
      rowIndex <= demoSelection.endRow &&
      colIndex >= demoSelection.startCol &&
      colIndex <= demoSelection.endCol
    );
  };

  const isCellInSelection = (rowIndex: number, colIndex: number) => {
    // Check current selection
    if (selection) {
      const inCurrent = (
        rowIndex >= Math.min(selection.startRow, selection.endRow) &&
        rowIndex <= Math.max(selection.startRow, selection.endRow) &&
        colIndex >= Math.min(selection.startCol, selection.endCol) &&
        colIndex <= Math.max(selection.startCol, selection.endCol)
      );
      if (inCurrent) return true;
    }
    
    // Check multi-selections
    return multiSelections.some(sel => (
      rowIndex >= Math.min(sel.startRow, sel.endRow) &&
      rowIndex <= Math.max(sel.startRow, sel.endRow) &&
      colIndex >= Math.min(sel.startCol, sel.endCol) &&
      colIndex <= Math.max(sel.startCol, sel.endCol)
    ));
  };

  const isCellInSelectedColumn = (columnKey: string) => {
    return selectedColumn === columnKey;
  };

  // Helper to check if cell is on the edge of a selection (for border styling)
  const getCellBorderClasses = (rowIndex: number, colIndex: number): string => {
    const allSelections = selection ? [selection, ...multiSelections] : multiSelections;
    let borderClasses = '';
    
    for (const sel of allSelections) {
      const minRow = Math.min(sel.startRow, sel.endRow);
      const maxRow = Math.max(sel.startRow, sel.endRow);
      const minCol = Math.min(sel.startCol, sel.endCol);
      const maxCol = Math.max(sel.startCol, sel.endCol);
      
      const inThisSelection = rowIndex >= minRow && rowIndex <= maxRow && 
                              colIndex >= minCol && colIndex <= maxCol;
      
      if (inThisSelection) {
        // Top border
        if (rowIndex === minRow) {
          borderClasses += ' border-t-2 border-t-[#CC5528]';
        }
        // Bottom border
        if (rowIndex === maxRow) {
          borderClasses += ' border-b-2 border-b-[#CC5528]';
        }
        // Left border
        if (colIndex === minCol) {
          borderClasses += ' border-l-2 border-l-[#CC5528]';
        }
        // Right border
        if (colIndex === maxCol) {
          borderClasses += ' border-r-2 border-r-[#CC5528]';
        }
      }
    }
    
    return borderClasses;
  };

  // Handle cell mouse down for selection - DISABLED (no cell select mode)
  const handleCellMouseDown = (rowIndex: number, colIndex: number, event?: React.MouseEvent) => {
    // Cell selection disabled
    return;
  };

  // Update quick copy position when selection changes - DISABLED
  useEffect(() => {
    if (false) { // Disabled - no cell select mode
      // Find the table element
      const table = scrollRef.current.querySelector('table');
      if (!table) return;
      
      const maxRow = Math.max(selection.startRow, selection.endRow);
      const maxCol = Math.max(selection.startCol, selection.endCol);
      
      // Find the actual cell at the bottom-right of the selection
      const rows = table.querySelectorAll('tbody tr');
      const targetRow = rows[maxRow];
      
      if (targetRow) {
        const cells = targetRow.querySelectorAll('td');
        // +1 because first cell is row number
        const targetCell = cells[maxCol + 1];
        
        if (targetCell) {
          const rect = targetCell.getBoundingClientRect();
          // Position popup slightly to the right and below the selection
          setQuickCopyPosition({
            x: rect.right + 8,
            y: rect.bottom + 8,
          });
          return;
        }
      }
      
      // Fallback to simple calculation if we can't find the cell
      const containerRect = scrollRef.current.getBoundingClientRect();
      setQuickCopyPosition({
        x: containerRect.left + 300,
        y: containerRect.top + 200,
      });
    } else {
      setQuickCopyPosition(null);
    }
  }, [selection, scrollRef]);

  // Handle column header click
  const handleColumnHeaderClick = (columnKey: string) => {
    // Toggle column selection - if already selected, deselect it
    if (selectedColumn === columnKey) {
      setSelectedColumn(null);
    } else {
      setSelectedColumn(columnKey);
      setSelection(null); // Clear cell selection when selecting column
    }
  };

  // Handle cell mouse enter for selection dragging
  const handleCellMouseEnter = (rowIndex: number, colIndex: number) => {
    if (isDragging && selection) {
      setSelection({
        ...selection,
        endRow: rowIndex,
        endCol: colIndex,
      });
    }
  };

  // Handle clicking on empty area to deselect
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Disabled - no cell select mode
    return;
  };

  // Copy functionality
  const handleCopy = useCallback(() => {
    const allSelections = selection ? [selection, ...multiSelections] : multiSelections;
    if (allSelections.length === 0) return;

    // Collect all cells from all selections
    const allCopiedData: string[][] = [];
    let totalCells = 0;
    
    allSelections.forEach((sel, selIndex) => {
      const copiedData: string[][] = [];
      for (let row = Math.min(sel.startRow, sel.endRow); row <= Math.max(sel.startRow, sel.endRow); row++) {
        const rowData: string[] = [];
        for (let col = Math.min(sel.startCol, sel.endCol); col <= Math.max(sel.startCol, sel.endCol); col++) {
          const column = columns[col];
          const value = data[row]?.[column.key as keyof typeof data[0]];
          rowData.push(String(value || ''));
          totalCells++;
        }
        copiedData.push(rowData);
      }
      
      // Add separator between multiple selections
      if (selIndex > 0) {
        allCopiedData.push([]);
      }
      allCopiedData.push(...copiedData);
    });

    const textData = allCopiedData.map(row => row.join('\t')).join('\n');
    
    // Use fallback copy method that works in all contexts
    const copyToClipboard = (text: string) => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-999999px';
      textarea.style.top = '-999999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      
      try {
        document.execCommand('copy');
        textarea.remove();
        toast.success('Copied to clipboard');
      } catch (err) {
        console.error('Failed to copy:', err);
        textarea.remove();
        toast.error('Failed to copy to clipboard');
      }
    };
    
    copyToClipboard(textData);
  }, [selection, multiSelections, columns, data]);

  // Handle mouse up to end selection - DISABLED
  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [isDragging]);

  // Handle keyboard events for Cmd/Ctrl key and shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Track Cmd (Mac) or Ctrl (Windows/Linux) key
      if (e.metaKey || e.ctrlKey) {
        setIsMetaKeyPressed(true);
        
        // Cmd+C / Ctrl+C to copy
        if (e.key === 'c' || e.key === 'C') {
          if (selection || multiSelections.length > 0) {
            e.preventDefault();
            handleCopy();
          }
        }
        
      }
      
      // Escape key to clear selections
      if (e.key === 'Escape') {
        setSelection(null);
        setMultiSelections([]);
        setSelectedColumn(null);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Release Cmd/Ctrl key
      if (!e.metaKey && !e.ctrlKey) {
        setIsMetaKeyPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selection, multiSelections, handleCopy, data.length, columns.length]);

  // Handle right click context menu
  const handleContextMenu = (e: React.MouseEvent, type: 'column' | 'row' | 'cell', index: number, columnKey?: string) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type,
      index,
      columnKey,
    });
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => {
      setContextMenu({ visible: false, x: 0, y: 0, type: null, index: null });
    };

    if (contextMenu.visible) {
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [contextMenu.visible]);

  // Hide column
  const handleHideColumn = (columnKey: string) => {
    setHiddenColumns(prev => new Set([...prev, columnKey]));
    toast.success('Column hidden');
  };

  // Toggle text wrapping
  const handleTextWrap = (columnKey: string, mode: TextWrapMode) => {
    setTextWrapModes(prev => ({
      ...prev,
      [columnKey]: mode,
    }));
    toast.success(`Text wrapping: ${mode}`);
  };

  // Sort functionality
  const handleSort = (columnKey: string, direction: 'asc' | 'desc') => {
    const sortedData = [...data].sort((a, b) => {
      const aVal = a[columnKey as keyof typeof a];
      const bVal = b[columnKey as keyof typeof b];
      
      // Handle numeric values
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      // Handle string values
      const aStr = String(aVal || '').toLowerCase();
      const bStr = String(bVal || '').toLowerCase();
      
      if (direction === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
    
    setData(sortedData);
    setSortState(prev => ({ ...prev, [columnKey]: direction }));
    toast.success(`Sorted ${direction === 'asc' ? 'A to Z' : 'Z to A'}`);
  };

  // Cell editing - double click to edit - DISABLED
  const handleCellDoubleClick = (rowIndex: number, colIndex: number, e: React.MouseEvent) => {
    // Disabled - no cell select mode
    return;
  };

  const handleCellEdit = (rowIndex: number, columnKey: string, newValue: string) => {
    const newData = [...data];
    const row = { ...newData[rowIndex] };
    
    // Try to preserve the type of the original value
    const originalValue = row[columnKey as keyof typeof row];
    if (typeof originalValue === 'number') {
      const numValue = parseFloat(newValue);
      (row as any)[columnKey] = isNaN(numValue) ? newValue : numValue;
    } else {
      (row as any)[columnKey] = newValue;
    }
    
    newData[rowIndex] = row;
    setData(newData);
    setEditingCell(null);
    toast.success('Cell updated');
  };

  // Header editing - double click to edit - DISABLED
  const handleHeaderDoubleClick = (columnKey: string, e: React.MouseEvent) => {
    // Double-click now sorts the column
    e.stopPropagation();
    
    // Toggle sort: null -> asc -> desc -> asc -> desc...
    const currentSort = sortState[columnKey];
    const nextSort: 'asc' | 'desc' = currentSort === 'asc' ? 'desc' : 'asc';
    
    handleSort(columnKey, nextSort);
  };

  const handleHeaderEdit = (columnKey: string, newLabel: string) => {
    setColumnLabels(prev => ({
      ...prev,
      [columnKey]: newLabel
    }));
    setEditingHeader(null);
    toast.success('Header updated');
  };

  // Row drag and drop - DISABLED
  const handleRowDragStart = (e: React.DragEvent, rowIndex: number) => {
    // Disabled - no cell select mode
    return;
  };

  const handleRowDragOver = (e: React.DragEvent, rowIndex: number) => {
    e.preventDefault();
    if (draggedRow !== null && draggedRow !== rowIndex) {
      setDropTarget({ type: 'row', index: rowIndex });
    }
  };

  const handleRowDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedRow !== null && draggedRow !== targetIndex) {
      const newData = [...data];
      const [removed] = newData.splice(draggedRow, 1);
      newData.splice(targetIndex, 0, removed);
      setData(newData);
      toast.success('Row moved');
    }
    setDraggedRow(null);
    setDropTarget(null);
  };

  // Column drag and drop - ENABLED
  const handleColumnDragStart = (e: React.DragEvent, columnKey: string) => {
    e.stopPropagation();
    setDraggedColumn(columnKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleColumnDragOver = (e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    if (draggedColumn !== null && draggedColumn !== columnKey) {
      setDropTarget({ type: 'column', index: columnKey });
    }
  };

  const handleColumnDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    if (draggedColumn !== null && draggedColumn !== targetKey) {
      // Reorder data for all rows
      const newData = data.map(row => {
        const newRow: any = {};
        const keys = Object.keys(row);
        const draggedIndex = keys.indexOf(draggedColumn);
        const targetIndex = keys.indexOf(targetKey);
        
        const reorderedKeys = [...keys];
        const [removed] = reorderedKeys.splice(draggedIndex, 1);
        reorderedKeys.splice(targetIndex, 0, removed);
        
        reorderedKeys.forEach(key => {
          newRow[key] = row[key as keyof typeof row];
        });
        
        return newRow;
      });
      
      setData(newData);
      toast.success('Column moved');
    }
    setDraggedColumn(null);
    setDropTarget(null);
  };

  // Column resize
  const handleColumnResizeStart = (e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({
      type: 'column',
      index: columnKey,
      startPos: e.clientX,
      startSize: getColumnWidth(columnKey),
    });
  };

  // Row resize
  const handleRowResizeStart = (e: React.MouseEvent, rowIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({
      type: 'row',
      index: rowIndex,
      startPos: e.clientY,
      startSize: getRowHeight(rowIndex),
    });
  };

  // Handle resize move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing) return;

      if (resizing.type === 'column') {
        const delta = e.clientX - resizing.startPos;
        const newWidth = Math.max(60, resizing.startSize + delta);
        setColumnWidths(prev => ({
          ...prev,
          [resizing.index]: newWidth,
        }));
      } else if (resizing.type === 'row') {
        const delta = e.clientY - resizing.startPos;
        const newHeight = Math.max(30, resizing.startSize + delta);
        setRowHeights(prev => ({
          ...prev,
          [resizing.index]: newHeight,
        }));
      }
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    if (resizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizing]);

  return (
    <div 
      ref={tableContainerRef}
      className="w-full h-full bg-[#1A1F2E] flex flex-col"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {/* Browser-Style Tabs - Shows all files in folder */}
      {sheets && sheets.length > 0 && (
        <div className="bg-[#0A0E1A] border-b border-[rgba(255,107,53,0.12)]">
          <div className="flex items-center gap-0 pl-0 pr-2 pt-2 pb-0">
            {sheets.map((sheet) => {
              const isSelected = sheet.id === currentSheetId;
              const isEditing = editingTabId === sheet.id;
              
              return (
                <div
                  key={sheet.id}
                  className={`
                    relative px-4 py-2.5 text-xs transition-all
                    ${isSelected
                      ? 'text-[#FF6B35] bg-[#1F2532]'
                      : 'text-[#64748B] bg-transparent hover:text-[#9CA3AF] hover:bg-[#13161F]'
                    }
                  `}
                  style={{
                    borderTop: '2px solid transparent',
                    borderLeft: '1px solid transparent',
                    borderRight: '1px solid transparent',
                    borderBottom: isSelected ? '1px solid #1F2532' : '1px solid transparent',
                    marginBottom: '-1px',
                    borderTopLeftRadius: '8px',
                    borderTopRightRadius: '8px',
                  }}
                >
                  {isEditing ? (
                    <input
                      ref={editingInputRef}
                      type="text"
                      value={editingTabName}
                      onChange={(e) => setEditingTabName(e.target.value)}
                      onBlur={() => handleTabNameChange(sheet.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleTabNameChange(sheet.id);
                        } else if (e.key === 'Escape') {
                          setEditingTabId(null);
                          setEditingTabName('');
                        }
                      }}
                      className="bg-[#0A0E1A] text-white text-xs focus:outline-none focus:ring-2 focus:ring-[#FF6B35] focus:ring-opacity-50"
                      onClick={(e) => e.stopPropagation()}
                      style={{ minWidth: '150px' }}
                    />
                  ) : (
                    <button
                      onClick={() => onSheetChange?.(sheet.id)}
                      onDoubleClick={(e) => handleTabDoubleClick(sheet, e)}
                      className="whitespace-nowrap"
                    >
                      {sheet.name}
                    </button>
                  )}
                </div>
              );
            })}
            
            {/* Add Data Capture Button */}
            <button
              onClick={() => onAddDataCapture?.(spaceId, folderId)}
              className="ml-auto mr-2 p-2 hover:bg-[#FF6B35] rounded-lg transition-all text-[#FF6B35] hover:text-white"
              title="Add Data Capture"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      
      {/* File Header with Actions - REMOVED */}
      
      {/* Spreadsheet Container with Border */}
      <div className="flex-1 flex flex-col overflow-hidden border border-[rgba(255,107,53,0.06)] rounded-tr-xl">
        {/* Fixed Header */}
        <div 
          ref={headerScrollRef}
          className="bg-[#1F2532] border-b-2 relative z-20 overflow-x-hidden rounded-tr-xl"
        >
          <table className="w-full border-collapse" style={{ minWidth: columns.reduce((sum, col) => sum + getColumnWidth(col.key), 0) }}>
            <thead>
              <tr>
                {columns.map((col, index) => (
                  <th
                    key={col.key}
                    style={{ width: getColumnWidth(col.key), maxWidth: getColumnWidth(col.key) }}
                    className={`h-11 px-4 text-[13px] text-white ${col.align === 'right' ? 'text-right' : 'text-left'} relative group border-r border-[rgba(255,107,53,0.12)] cursor-pointer hover:bg-[rgba(255,107,53,0.1)] transition-colors ${
                      selectedColumn === col.key ? 'bg-[#1F2532]' : ''
                    } ${
                      dropTarget?.type === 'column' && dropTarget.index === col.key ? 'border-l-4 border-l-[#FF6B35]' : ''
                    } ${
                      draggedColumn === col.key ? 'opacity-50' : ''
                    } ${
                      index === columns.length - 1 ? 'rounded-tr-xl' : ''
                    }`}
                    onContextMenu={(e) => handleContextMenu(e, 'column', index, col.key)}
                    onClick={() => handleColumnHeaderClick(col.key)}
                    onDoubleClick={(e) => handleHeaderDoubleClick(col.key, e)}
                    draggable={true}
                    onDragStart={(e) => handleColumnDragStart(e, col.key)}
                    onDragOver={(e) => handleColumnDragOver(e, col.key)}
                    onDrop={(e) => handleColumnDrop(e, col.key)}
                    onDragEnd={() => {
                      setDraggedColumn(null);
                      setDropTarget(null);
                    }}
                  >
                    {editingHeader === col.key ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        defaultValue={columnLabels[col.key] || col.label}
                        onBlur={(e) => handleHeaderEdit(col.key, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleHeaderEdit(col.key, e.currentTarget.value);
                          } else if (e.key === 'Escape') {
                            setEditingHeader(null);
                          }
                        }}
                        className="w-full bg-[#1A1F2E] text-white px-2 py-1 rounded border border-[#FF6B35] focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div className="overflow-hidden text-ellipsis whitespace-nowrap block flex items-center justify-between gap-1">
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                          {columnLabels[col.key] || col.label}
                        </span>
                        {/* Sort indicator */}
                        {sortState[col.key] && (
                          <span className="flex-shrink-0">
                            {sortState[col.key] === 'asc' ? (
                              <ArrowUpAZ className="w-3.5 h-3.5 text-[#FF6B35]" />
                            ) : (
                              <ArrowDownAZ className="w-3.5 h-3.5 text-[#FF6B35]" />
                            )}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Column resize handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#FF6B35] group-hover:bg-[rgba(255,107,53,0.3)] transition-colors z-10"
                      onMouseDown={(e) => handleColumnResizeStart(e, col.key)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>

        {/* Table Container with Scroll */}
        <div 
          ref={scrollRef}
          data-scroll-container
          className="overflow-auto h-full relative focus:outline-none focus:ring-2 focus:ring-[rgba(255,107,53,0.3)] scrollbar-hide"
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onClick={handleContainerClick}
          tabIndex={0}
        >
          <table className="w-full border-collapse" style={{ minWidth: columns.reduce((sum, col) => sum + getColumnWidth(col.key), 0) }}>
            <tbody>
              {data.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  style={{ height: getRowHeight(rowIndex) }}
                  className={`border-b border-[rgba(255,107,53,0.05)] hover:bg-[rgba(255,107,53,0.03)] transition-colors relative ${
                    dropTarget?.type === 'row' && dropTarget.index === rowIndex ? 'border-t-4 border-t-[#FF6B35]' : ''
                  } ${
                    draggedRow === rowIndex ? 'opacity-50' : ''
                  }`}
                  draggable={false}
                  onDragStart={(e) => handleRowDragStart(e, rowIndex)}
                  onDragOver={(e) => handleRowDragOver(e, rowIndex)}
                  onDrop={(e) => handleRowDrop(e, rowIndex)}
                  onDragEnd={() => {
                    setDraggedRow(null);
                    setDropTarget(null);
                  }}
                >
                  {columns.map((col, colIndex) => {
                    const inDemo = isCellInDemoSelection(rowIndex, colIndex);
                    const inSelection = isCellInSelection(rowIndex, colIndex);
                    const inColumnSelection = isCellInSelectedColumn(col.key);
                    const value = row[col.key as keyof typeof row];
                    const wrapMode = textWrapModes[col.key] || 'overflow';
                    const borderClasses = getCellBorderClasses(rowIndex, colIndex);
                    
                    return (
                      <td
                        key={col.key}
                        style={{ width: getColumnWidth(col.key), maxWidth: getColumnWidth(col.key) }}
                        className={`px-4 text-sm text-[#E5E7EB] bg-[#0A0E1A] ${col.align === 'right' ? 'text-right' : 'text-left'} relative cursor-cell border-r border-[rgba(255,107,53,0.06)] ${
                            inDemo ? 'bg-[#0A0E1A]' : ''
                          } ${
                            inSelection ? 'bg-[#0A0E1A]' : ''
                          } ${
                            inColumnSelection ? 'bg-[#0A0E1A]' : ''
                          } ${borderClasses}`}
                        onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                        onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                        onContextMenu={(e) => handleContextMenu(e, 'cell', colIndex, col.key)}
                        onDoubleClick={(e) => handleCellDoubleClick(rowIndex, colIndex, e)}
                      >
                        {editingCell?.row === rowIndex && editingCell?.col === colIndex ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            defaultValue={String(value)}
                            onBlur={(e) => handleCellEdit(rowIndex, col.key, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleCellEdit(rowIndex, col.key, e.currentTarget.value);
                              } else if (e.key === 'Escape') {
                                setEditingCell(null);
                              }
                            }}
                            className="w-full bg-[#1A1F2E] text-white px-2 py-1 rounded border border-[#FF6B35] focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div 
                            className={`${
                              wrapMode === 'wrap' ? 'whitespace-normal break-words' : 
                              wrapMode === 'clip' ? 'whitespace-nowrap overflow-hidden' :
                              'whitespace-nowrap overflow-hidden text-ellipsis'
                            }`}
                          >
                            {value}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed bg-[#1A1F2E] border border-[rgba(255,107,53,0.3)] rounded-lg shadow-2xl py-1 z-50 min-w-[200px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {/* Copy - Show when cells are selected or any context menu */}
          {((selection || multiSelections.length > 0) || contextMenu.type === 'cell' || contextMenu.type === 'row' || contextMenu.type === 'column') && (
            <>
              <button
                onClick={() => {
                  handleCopy();
                  setContextMenu({ visible: false, x: 0, y: 0, type: null, index: null });
                }}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[rgba(255,107,53,0.1)] transition-colors flex items-center gap-3"
              >
                <Copy className="w-4 h-4" />
                Copy
              </button>
            </>
          )}

          {/* Hide Column */}
          {contextMenu.type === 'column' && contextMenu.columnKey && (
            <button
              onClick={() => handleHideColumn(contextMenu.columnKey!)}
              className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[rgba(255,107,53,0.1)] transition-colors flex items-center gap-3"
            >
              <EyeOff className="w-4 h-4" />
              Hide column
            </button>
          )}

          {/* Text Wrapping - Column only */}
          {contextMenu.type === 'column' && contextMenu.columnKey && (
            <>
              <div className="px-4 py-1 text-xs text-gray-400">Text wrapping</div>
              <button
                onClick={() => handleTextWrap(contextMenu.columnKey!, 'overflow')}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[rgba(255,107,53,0.1)] transition-colors flex items-center gap-3"
              >
                <WrapText className="w-4 h-4" />
                Overflow
              </button>
              <button
                onClick={() => handleTextWrap(contextMenu.columnKey!, 'wrap')}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[rgba(255,107,53,0.1)] transition-colors flex items-center gap-3"
              >
                <WrapText className="w-4 h-4" />
                Wrap
              </button>
              <button
                onClick={() => handleTextWrap(contextMenu.columnKey!, 'clip')}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[rgba(255,107,53,0.1)] transition-colors flex items-center gap-3"
              >
                <WrapText className="w-4 h-4" />
                Clip
              </button>
            </>
          )}

          {/* Sort Options - Column only */}
          {contextMenu.type === 'column' && contextMenu.columnKey && (
            <>
              <button
                onClick={() => handleSort(contextMenu.columnKey!, 'asc')}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[rgba(255,107,53,0.1)] transition-colors flex items-center gap-3"
              >
                <ArrowUpAZ className="w-4 h-4" />
                Sort sheet A to Z
              </button>
              <button
                onClick={() => handleSort(contextMenu.columnKey!, 'desc')}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[rgba(255,107,53,0.1)] transition-colors flex items-center gap-3"
              >
                <ArrowDownAZ className="w-4 h-4" />
                Sort sheet Z to A
              </button>
            </>
          )}
        </div>
      )}

      {/* Quick Copy Popup - DISABLED */}
      {false && (
        <button
          onClick={() => {
            handleCopy();
            setQuickCopyPosition(null);
          }}
          className="fixed bg-[#FF6B35] hover:bg-[#ff8558] text-white text-xs px-3 py-1.5 rounded-md shadow-lg flex items-center gap-1.5 z-50 transition-all hover:scale-105"
          style={{ 
            left: `${quickCopyPosition.x}px`, 
            top: `${quickCopyPosition.y}px`,
            transform: 'translate(-100%, -100%)'
          }}
        >
          <Copy className="w-3 h-3" />
          Copy Data
        </button>
      )}
    </div>
  );
}