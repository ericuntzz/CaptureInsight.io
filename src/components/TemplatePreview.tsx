import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, AlertTriangle, CheckCircle2, AlertCircle, ChevronDown, ChevronRight,
  Eye, ArrowRight, Loader2, RefreshCw, Filter, BarChart3, Download
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Switch } from './ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

type ChangeType = 'formatted' | 'type_converted' | 'cleaned' | 'filled' | 'unchanged';
type ErrorType = 'validation_failed' | 'type_mismatch' | 'required_missing' | 'format_invalid';

interface PreviewChange {
  rowIndex: number;
  columnName: string;
  originalValue: any;
  cleanedValue: any;
  changeType: ChangeType;
}

interface PreviewError {
  rowIndex: number;
  columnName: string;
  errorType: ErrorType;
  message: string;
  originalValue: any;
}

interface ColumnStats {
  changesCount: number;
  errorsCount: number;
}

interface PreviewStats {
  totalRows: number;
  totalChanges: number;
  totalErrors: number;
  columnStats: Record<string, ColumnStats>;
}

interface PreviewData {
  originalData: Record<string, any>[];
  cleanedData: Record<string, any>[];
  changes: PreviewChange[];
  errors: PreviewError[];
  stats: PreviewStats;
}

interface LegacyPreviewData {
  originalData: Record<string, any>[];
  cleanedData: Record<string, any>[];
  changes: Array<{
    row: number;
    column: string;
    from: string;
    to: string;
    type: 'format' | 'transform' | 'error';
  }>;
  errors: Array<{
    row: number;
    column: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  stats: {
    rowsProcessed: number;
    changesCount: number;
    errorsCount: number;
    warningsCount: number;
  };
}

interface TemplatePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  templateId?: string;
  templateName?: string;
  sampleData?: Record<string, any>[];
  cleaningPipeline?: any;
  columnSchema?: any;
  sheetId?: string;
}

function convertLegacyToNewFormat(legacy: LegacyPreviewData): PreviewData {
  const changes: PreviewChange[] = legacy.changes.map(c => ({
    rowIndex: c.row,
    columnName: c.column,
    originalValue: c.from,
    cleanedValue: c.to,
    changeType: c.type === 'transform' ? 'type_converted' : 'formatted' as ChangeType
  }));

  const errors: PreviewError[] = legacy.errors.map(e => ({
    rowIndex: e.row,
    columnName: e.column,
    errorType: 'validation_failed' as ErrorType,
    message: e.message,
    originalValue: legacy.originalData[e.row]?.[e.column]
  }));

  const columnStats: Record<string, ColumnStats> = {};
  for (const change of changes) {
    if (!columnStats[change.columnName]) {
      columnStats[change.columnName] = { changesCount: 0, errorsCount: 0 };
    }
    columnStats[change.columnName].changesCount++;
  }
  for (const error of errors) {
    if (!columnStats[error.columnName]) {
      columnStats[error.columnName] = { changesCount: 0, errorsCount: 0 };
    }
    columnStats[error.columnName].errorsCount++;
  }

  return {
    originalData: legacy.originalData,
    cleanedData: legacy.cleanedData,
    changes,
    errors,
    stats: {
      totalRows: legacy.stats.rowsProcessed,
      totalChanges: legacy.stats.changesCount,
      totalErrors: legacy.stats.errorsCount,
      columnStats
    }
  };
}

function isLegacyFormat(data: any): data is LegacyPreviewData {
  return data.stats && 'rowsProcessed' in data.stats;
}

export function TemplatePreview({
  isOpen,
  onClose,
  templateId,
  templateName,
  sampleData,
  cleaningPipeline,
  columnSchema,
  sheetId,
}: TemplatePreviewProps) {
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOnlyChanges, setShowOnlyChanges] = useState(false);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState(true);
  const [expandedStats, setExpandedStats] = useState(false);
  const [highlightedCell, setHighlightedCell] = useState<{ row: number; column: string } | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<string>('all');
  
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

  const fetchPreview = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let response;
      
      if (templateId && sheetId) {
        response = await fetch(`/api/templates/${templateId}/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ sheetId }),
        });
      } else if (sampleData && sampleData.length > 0 && (cleaningPipeline || columnSchema)) {
        response = await fetch('/api/templates/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            template: {
              name: templateName || 'Preview Template',
              description: '',
              scope: 'workspace',
              columns: columnSchema?.columns || [],
              cleaningPipeline: cleaningPipeline?.steps || [],
              columnAliases: {}
            },
            sampleData,
          }),
        });
      } else {
        setError('No data available for preview');
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate preview');
      }

      const data = await response.json();
      
      if (isLegacyFormat(data)) {
        setPreviewData(convertLegacyToNewFormat(data));
      } else {
        setPreviewData(data as PreviewData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
    } finally {
      setIsLoading(false);
    }
  }, [templateId, sheetId, sampleData, cleaningPipeline, columnSchema, templateName]);

  useEffect(() => {
    if (isOpen) {
      fetchPreview();
    }
  }, [isOpen, fetchPreview]);

  const handleScroll = useCallback((source: 'left' | 'right') => {
    const sourceRef = source === 'left' ? leftScrollRef : rightScrollRef;
    const targetRef = source === 'left' ? rightScrollRef : leftScrollRef;
    
    if (sourceRef.current && targetRef.current) {
      targetRef.current.scrollTop = sourceRef.current.scrollTop;
      targetRef.current.scrollLeft = sourceRef.current.scrollLeft;
    }
  }, []);

  const columns = useMemo(() => {
    if (!previewData) return [];
    const allColumns = new Set<string>();
    [...previewData.originalData, ...previewData.cleanedData].forEach(row => {
      Object.keys(row).forEach(key => allColumns.add(key));
    });
    return Array.from(allColumns);
  }, [previewData]);

  const filteredColumns = useMemo(() => {
    if (selectedColumn === 'all') return columns;
    return columns.filter(col => col === selectedColumn);
  }, [columns, selectedColumn]);

  const changesMap = useMemo(() => {
    if (!previewData) return new Map<string, PreviewChange>();
    const map = new Map<string, PreviewChange>();
    previewData.changes.forEach(change => {
      map.set(`${change.rowIndex}-${change.columnName}`, change);
    });
    return map;
  }, [previewData]);

  const errorsMap = useMemo(() => {
    if (!previewData) return new Map<string, PreviewError[]>();
    const map = new Map<string, PreviewError[]>();
    previewData.errors.forEach(error => {
      const key = `${error.rowIndex}-${error.columnName}`;
      const existing = map.get(key) || [];
      map.set(key, [...existing, error]);
    });
    return map;
  }, [previewData]);

  const rowsWithChanges = useMemo(() => {
    if (!previewData) return new Set<number>();
    const rows = new Set<number>();
    previewData.changes.forEach(c => {
      if (selectedColumn === 'all' || c.columnName === selectedColumn) {
        rows.add(c.rowIndex);
      }
    });
    return rows;
  }, [previewData, selectedColumn]);

  const rowsWithErrors = useMemo(() => {
    if (!previewData) return new Set<number>();
    const rows = new Set<number>();
    previewData.errors.forEach(e => {
      if (selectedColumn === 'all' || e.columnName === selectedColumn) {
        rows.add(e.rowIndex);
      }
    });
    return rows;
  }, [previewData, selectedColumn]);

  const filteredRows = useMemo(() => {
    if (!previewData) return [];
    
    let rows = previewData.originalData.map((_, index) => index);
    
    if (showOnlyChanges) {
      rows = rows.filter(i => rowsWithChanges.has(i));
    }
    
    if (showOnlyErrors) {
      rows = rows.filter(i => rowsWithErrors.has(i));
    }
    
    return rows;
  }, [previewData, showOnlyChanges, showOnlyErrors, rowsWithChanges, rowsWithErrors]);

  const getChangeTypeLabel = (type: ChangeType): string => {
    switch (type) {
      case 'formatted': return 'Formatted';
      case 'type_converted': return 'Type Converted';
      case 'cleaned': return 'Cleaned';
      case 'filled': return 'Filled';
      default: return 'Unchanged';
    }
  };

  const getErrorTypeLabel = (type: ErrorType): string => {
    switch (type) {
      case 'validation_failed': return 'Validation Failed';
      case 'type_mismatch': return 'Type Mismatch';
      case 'required_missing': return 'Required Missing';
      case 'format_invalid': return 'Invalid Format';
      default: return 'Error';
    }
  };

  const getCellClassName = (row: number, column: string, isCleanedSide: boolean) => {
    const changeKey = `${row}-${column}`;
    const change = changesMap.get(changeKey);
    const errors = errorsMap.get(changeKey) || [];
    
    const isHighlighted = highlightedCell?.row === row && highlightedCell?.column === column;
    
    let baseClass = 'px-3 py-2 text-sm border-r border-b border-[#1A1F2E] truncate max-w-[200px] transition-colors';
    
    if (isHighlighted) {
      baseClass += ' ring-2 ring-[#FF6B35] ring-inset';
    }
    
    if (errors.length > 0) {
      return `${baseClass} bg-[#EF4444]/20 text-red-300`;
    }
    
    if (change && isCleanedSide) {
      if (change.changeType === 'formatted' || change.changeType === 'cleaned') {
        return `${baseClass} bg-[#22C55E]/20 text-green-300`;
      }
      if (change.changeType === 'type_converted') {
        return `${baseClass} bg-[#EAB308]/20 text-yellow-300`;
      }
      if (change.changeType === 'filled') {
        return `${baseClass} bg-purple-500/20 text-purple-300`;
      }
    }
    
    return `${baseClass} text-gray-300`;
  };

  const scrollToCell = useCallback((row: number, column: string) => {
    setHighlightedCell({ row, column });
    
    const leftTable = leftScrollRef.current;
    if (leftTable) {
      const rowElements = leftTable.querySelectorAll('tr');
      const targetRow = rowElements[row + 1];
      if (targetRow) {
        targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    
    setTimeout(() => setHighlightedCell(null), 2000);
  }, []);

  const exportToCsv = useCallback(() => {
    if (!previewData) return;
    
    const headers = columns;
    const csvContent = [
      headers.join(','),
      ...previewData.cleanedData.map(row => 
        headers.map(h => {
          const value = row[h];
          if (value === null || value === undefined) return '';
          const strValue = String(value);
          if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
            return `"${strValue.replace(/"/g, '""')}"`;
          }
          return strValue;
        }).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `preview_${templateName || 'data'}_cleaned.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [previewData, columns, templateName]);

  const errorsByColumn = useMemo(() => {
    if (!previewData) return new Map<string, PreviewError[]>();
    const map = new Map<string, PreviewError[]>();
    previewData.errors.forEach(error => {
      const existing = map.get(error.columnName) || [];
      map.set(error.columnName, [...existing, error]);
    });
    return map;
  }, [previewData]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-4 z-[60] bg-[#0A0E1A] rounded-xl border border-[#1A1F2E] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1A1F2E]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-[#FF6B35] flex items-center justify-center">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Preview Cleaning Results
              </h2>
              <p className="text-sm text-gray-400">
                {templateName ? `Template: ${templateName}` : 'Preview how your data will be transformed'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={exportToCsv}
              disabled={!previewData || isLoading}
              className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              title="Export cleaned data as CSV"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={fetchPreview}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {previewData && (
          <div className="flex items-center gap-6 px-6 py-3 bg-[#0D1117] border-b border-[#1A1F2E]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-gray-300">
                <span className="font-medium text-white">{previewData.stats.totalRows}</span> rows
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-[#22C55E]" />
              <span className="text-sm text-gray-300">
                <span className="font-medium text-[#22C55E]">{previewData.stats.totalChanges}</span> changes
              </span>
            </div>
            
            {previewData.stats.totalErrors > 0 && (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#EF4444]" />
                <span className="text-sm text-gray-300">
                  <span className="font-medium text-[#EF4444]">{previewData.stats.totalErrors}</span> errors
                </span>
              </div>
            )}
            
            <button
              onClick={() => setExpandedStats(!expandedStats)}
              className="flex items-center gap-2 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-[#1A1F2E] rounded transition-colors"
            >
              <BarChart3 className="w-3 h-3" />
              Column Stats
              {expandedStats ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>

            <div className="flex-1" />

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <Select value={selectedColumn} onValueChange={setSelectedColumn}>
                  <SelectTrigger className="w-40 h-8 bg-[#1A1F2E] border-transparent text-sm">
                    <SelectValue placeholder="Filter column" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1F2E] border-[#2A2F3E]">
                    <SelectItem value="all" className="text-white hover:bg-[#FF6B35]/20">
                      All columns
                    </SelectItem>
                    {columns.map(col => (
                      <SelectItem key={col} value={col} className="text-white hover:bg-[#FF6B35]/20">
                        {col}
                        {previewData.stats.columnStats[col] && (
                          <span className="ml-2 text-xs text-gray-500">
                            ({previewData.stats.columnStats[col].changesCount} changes)
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  checked={showOnlyChanges}
                  onCheckedChange={setShowOnlyChanges}
                />
                <span className="text-sm text-gray-400">Changed only</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  checked={showOnlyErrors}
                  onCheckedChange={setShowOnlyErrors}
                />
                <span className="text-sm text-gray-400">Errors only</span>
              </label>
            </div>
          </div>
        )}

        {expandedStats && previewData && Object.keys(previewData.stats.columnStats).length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-[#1A1F2E] overflow-hidden"
          >
            <div className="px-6 py-3 bg-[#0D1117]/50">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {Object.entries(previewData.stats.columnStats)
                  .sort(([, a], [, b]) => (b.changesCount + b.errorsCount) - (a.changesCount + a.errorsCount))
                  .map(([colName, stats]) => (
                    <div
                      key={colName}
                      className={`p-2 rounded-lg bg-[#1A1F2E]/50 cursor-pointer hover:bg-[#1A1F2E] transition-colors ${
                        selectedColumn === colName ? 'ring-1 ring-[#FF6B35]' : ''
                      }`}
                      onClick={() => setSelectedColumn(selectedColumn === colName ? 'all' : colName)}
                    >
                      <div className="text-xs text-gray-400 truncate" title={colName}>{colName}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {stats.changesCount > 0 && (
                          <span className="text-xs text-[#22C55E]">{stats.changesCount} ✓</span>
                        )}
                        {stats.errorsCount > 0 && (
                          <span className="text-xs text-[#EF4444]">{stats.errorsCount} ✗</span>
                        )}
                        {stats.changesCount === 0 && stats.errorsCount === 0 && (
                          <span className="text-xs text-gray-500">No changes</span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </motion.div>
        )}

        <div className="flex-1 flex overflow-hidden">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-[#FF6B35] animate-spin" />
                <p className="text-gray-400">Generating preview...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-center">
                <AlertCircle className="w-12 h-12 text-[#EF4444]" />
                <p className="text-lg text-white font-medium">Preview Error</p>
                <p className="text-gray-400 max-w-md">{error}</p>
                <button
                  onClick={fetchPreview}
                  className="mt-2 px-4 py-2 bg-[#FF6B35] hover:bg-[#FF8F35] text-white rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : previewData ? (
            <div className="flex-1 flex">
              <div className="flex-1 flex flex-col border-r border-[#1A1F2E]">
                <div className="px-4 py-2 bg-[#0D1117] border-b border-[#1A1F2E]">
                  <h3 className="text-sm font-medium text-gray-400">Original Data</h3>
                </div>
                <div 
                  ref={leftScrollRef}
                  className="flex-1 overflow-auto"
                  onScroll={() => handleScroll('left')}
                >
                  <table className="w-full border-collapse min-w-max">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-[#0D1117]">
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-r border-b border-[#1A1F2E] bg-[#0D1117] sticky left-0 z-20 w-12">
                          #
                        </th>
                        {filteredColumns.map(column => (
                          <th 
                            key={column}
                            className="px-3 py-2 text-left text-xs font-medium text-gray-400 border-r border-b border-[#1A1F2E] bg-[#0D1117] whitespace-nowrap"
                          >
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map(rowIndex => {
                        const row = previewData.originalData[rowIndex] || {};
                        const hasError = rowsWithErrors.has(rowIndex);
                        
                        return (
                          <tr 
                            key={rowIndex}
                            className={`hover:bg-[#1A1F2E]/50 ${hasError ? 'bg-[#EF4444]/5' : ''}`}
                          >
                            <td className="px-3 py-2 text-xs text-gray-500 border-r border-b border-[#1A1F2E] bg-[#0A0E1A] sticky left-0 z-10">
                              {rowIndex + 1}
                              {hasError && (
                                <AlertCircle className="inline-block ml-1 w-3 h-3 text-[#EF4444]" />
                              )}
                            </td>
                            {filteredColumns.map(column => {
                              const value = row[column];
                              const displayValue = value === null || value === undefined ? '' : String(value);
                              const change = changesMap.get(`${rowIndex}-${column}`);
                              
                              return (
                                <TooltipProvider key={column}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <td className={getCellClassName(rowIndex, column, false)}>
                                        {displayValue}
                                      </td>
                                    </TooltipTrigger>
                                    {change && (
                                      <TooltipContent side="bottom" className="bg-[#1A1F2E] border-[#2A2F3E] text-white">
                                        <div className="text-xs">
                                          <div className="text-gray-400">Original value:</div>
                                          <div className="font-mono">{String(change.originalValue) || '(empty)'}</div>
                                          <div className="text-gray-400 mt-1">Will become:</div>
                                          <div className="font-mono text-[#22C55E]">{String(change.cleanedValue) || '(empty)'}</div>
                                          <div className="text-[#EAB308] mt-1 text-[10px]">
                                            {getChangeTypeLabel(change.changeType)}
                                          </div>
                                        </div>
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  
                  {filteredRows.length === 0 && (
                    <div className="flex items-center justify-center h-40 text-gray-500">
                      No rows match the current filters
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 flex flex-col">
                <div className="px-4 py-2 bg-[#0D1117] border-b border-[#1A1F2E]">
                  <h3 className="text-sm font-medium text-gray-400">Cleaned Data</h3>
                </div>
                <div 
                  ref={rightScrollRef}
                  className="flex-1 overflow-auto"
                  onScroll={() => handleScroll('right')}
                >
                  <table className="w-full border-collapse min-w-max">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-[#0D1117]">
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-r border-b border-[#1A1F2E] bg-[#0D1117] sticky left-0 z-20 w-12">
                          #
                        </th>
                        {filteredColumns.map(column => {
                          const colStats = previewData.stats.columnStats[column];
                          return (
                            <th 
                              key={column}
                              className="px-3 py-2 text-left text-xs font-medium text-gray-400 border-r border-b border-[#1A1F2E] bg-[#0D1117] whitespace-nowrap"
                            >
                              <div className="flex items-center gap-2">
                                {column}
                                {colStats && colStats.errorsCount > 0 && (
                                  <span className="px-1.5 py-0.5 bg-[#EF4444]/20 text-[#EF4444] rounded text-[10px]">
                                    {colStats.errorsCount}
                                  </span>
                                )}
                                {colStats && colStats.changesCount > 0 && colStats.errorsCount === 0 && (
                                  <span className="px-1.5 py-0.5 bg-[#22C55E]/20 text-[#22C55E] rounded text-[10px]">
                                    {colStats.changesCount}
                                  </span>
                                )}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map(rowIndex => {
                        const row = previewData.cleanedData[rowIndex] || {};
                        const hasError = rowsWithErrors.has(rowIndex);
                        
                        return (
                          <tr 
                            key={rowIndex}
                            className={`hover:bg-[#1A1F2E]/50 ${hasError ? 'bg-[#EF4444]/5' : ''}`}
                          >
                            <td className="px-3 py-2 text-xs text-gray-500 border-r border-b border-[#1A1F2E] bg-[#0A0E1A] sticky left-0 z-10">
                              {rowIndex + 1}
                            </td>
                            {filteredColumns.map(column => {
                              const value = row[column];
                              const displayValue = value === null || value === undefined ? '' : String(value);
                              const cellErrors = errorsMap.get(`${rowIndex}-${column}`) || [];
                              const change = changesMap.get(`${rowIndex}-${column}`);
                              
                              return (
                                <TooltipProvider key={column}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <td className={getCellClassName(rowIndex, column, true)}>
                                        {displayValue}
                                      </td>
                                    </TooltipTrigger>
                                    {(cellErrors.length > 0 || change) && (
                                      <TooltipContent side="bottom" className="bg-[#1A1F2E] border-[#2A2F3E] text-white max-w-xs">
                                        <div className="text-xs space-y-2">
                                          {change && (
                                            <div>
                                              <div className="text-gray-400">Changed from:</div>
                                              <div className="font-mono">{String(change.originalValue) || '(empty)'}</div>
                                              <div className="text-[#22C55E] text-[10px] mt-0.5">
                                                {getChangeTypeLabel(change.changeType)}
                                              </div>
                                            </div>
                                          )}
                                          {cellErrors.map((err, i) => (
                                            <div key={i} className="text-[#EF4444]">
                                              <span className="text-[10px] text-[#EAB308] mr-1">
                                                [{getErrorTypeLabel(err.errorType)}]
                                              </span>
                                              {err.message}
                                            </div>
                                          ))}
                                        </div>
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  
                  {filteredRows.length === 0 && (
                    <div className="flex items-center justify-center h-40 text-gray-500">
                      No rows match the current filters
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              No preview data available
            </div>
          )}
        </div>

        {previewData && previewData.errors.length > 0 && (
          <div className="border-t border-[#1A1F2E]">
            <button
              onClick={() => setExpandedErrors(!expandedErrors)}
              className="w-full flex items-center gap-2 px-6 py-3 hover:bg-[#1A1F2E]/50 transition-colors"
            >
              {expandedErrors ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
              <AlertCircle className="w-4 h-4 text-[#EF4444]" />
              <span className="text-sm font-medium text-white">
                Error Details ({previewData.errors.length} issues in {errorsByColumn.size} columns)
              </span>
            </button>
            
            <AnimatePresence>
              {expandedErrors && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-4 max-h-48 overflow-y-auto">
                    <div className="space-y-3">
                      {Array.from(errorsByColumn.entries()).map(([columnName, errors]) => (
                        <div key={columnName} className="bg-[#1A1F2E]/50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-white">{columnName}</span>
                            <span className="text-xs text-[#EF4444]">{errors.length} errors</span>
                          </div>
                          <div className="space-y-1">
                            {Object.entries(
                              errors.reduce((acc, error) => {
                                const key = `${error.errorType}: ${error.message}`;
                                if (!acc[key]) {
                                  acc[key] = { ...error, count: 0, rows: [] as number[] };
                                }
                                acc[key].count++;
                                acc[key].rows.push(error.rowIndex);
                                return acc;
                              }, {} as Record<string, PreviewError & { count: number; rows: number[] }>)
                            ).map(([key, groupedError]) => (
                              <div 
                                key={key}
                                className="flex items-center justify-between p-2 rounded bg-[#EF4444]/10 cursor-pointer hover:bg-[#EF4444]/20 transition-colors"
                                onClick={() => scrollToCell(groupedError.rows[0], columnName)}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="text-[10px] px-1.5 py-0.5 bg-[#EAB308]/20 text-[#EAB308] rounded">
                                    {getErrorTypeLabel(groupedError.errorType)}
                                  </span>
                                  <span className="text-xs text-red-300 truncate">{groupedError.message}</span>
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                  <span className="text-xs text-gray-500">
                                    {groupedError.count}× 
                                    {groupedError.count <= 3 && ` (rows: ${groupedError.rows.map(r => r + 1).join(', ')})`}
                                  </span>
                                  <button className="text-xs text-[#FF6B35] hover:text-[#FF8F35] whitespace-nowrap">
                                    Go to first
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="flex items-center justify-between px-6 py-3 bg-[#0D1117] border-t border-[#1A1F2E]">
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#22C55E]/30" />
              <span>Formatted/Cleaned</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#EAB308]/30" />
              <span>Type converted</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-purple-500/30" />
              <span>Filled empty</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#EF4444]/30" />
              <span>Validation error</span>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#1A1F2E] hover:bg-[#2A2F3E] text-white rounded-lg transition-colors"
          >
            Close Preview
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
