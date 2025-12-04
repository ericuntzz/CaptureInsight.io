import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, AlertTriangle, CheckCircle2, AlertCircle, ChevronDown, ChevronRight,
  Eye, ArrowRight, Loader2, RefreshCw
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Switch } from './ui/switch';

interface PreviewChange {
  row: number;
  column: string;
  from: string;
  to: string;
  type: 'format' | 'transform' | 'error';
}

interface PreviewError {
  row: number;
  column: string;
  message: string;
  severity: 'error' | 'warning';
}

interface PreviewStats {
  rowsProcessed: number;
  changesCount: number;
  errorsCount: number;
  warningsCount: number;
}

interface PreviewData {
  originalData: Record<string, any>[];
  cleanedData: Record<string, any>[];
  changes: PreviewChange[];
  errors: PreviewError[];
  stats: PreviewStats;
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
  const [highlightedCell, setHighlightedCell] = useState<{ row: number; column: string } | null>(null);
  
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
      } else if (sampleData && sampleData.length > 0) {
        response = await fetch('/api/templates/preview-with-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            data: sampleData,
            cleaningPipeline,
            columnSchema,
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
      setPreviewData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
    } finally {
      setIsLoading(false);
    }
  }, [templateId, sheetId, sampleData, cleaningPipeline, columnSchema]);

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

  const changesMap = useMemo(() => {
    if (!previewData) return new Map<string, PreviewChange>();
    const map = new Map<string, PreviewChange>();
    previewData.changes.forEach(change => {
      map.set(`${change.row}-${change.column}`, change);
    });
    return map;
  }, [previewData]);

  const errorsMap = useMemo(() => {
    if (!previewData) return new Map<string, PreviewError[]>();
    const map = new Map<string, PreviewError[]>();
    previewData.errors.forEach(error => {
      const key = `${error.row}-${error.column}`;
      const existing = map.get(key) || [];
      map.set(key, [...existing, error]);
    });
    return map;
  }, [previewData]);

  const rowsWithChanges = useMemo(() => {
    if (!previewData) return new Set<number>();
    return new Set(previewData.changes.map(c => c.row));
  }, [previewData]);

  const rowsWithErrors = useMemo(() => {
    if (!previewData) return new Set<number>();
    return new Set(previewData.errors.map(e => e.row));
  }, [previewData]);

  const columnErrors = useMemo(() => {
    if (!previewData) return new Map<string, { errors: number; warnings: number }>();
    const map = new Map<string, { errors: number; warnings: number }>();
    previewData.errors.forEach(error => {
      const existing = map.get(error.column) || { errors: 0, warnings: 0 };
      if (error.severity === 'error') {
        existing.errors++;
      } else {
        existing.warnings++;
      }
      map.set(error.column, existing);
    });
    return map;
  }, [previewData]);

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

  const getCellClassName = (row: number, column: string, isCleanedSide: boolean) => {
    const changeKey = `${row}-${column}`;
    const change = changesMap.get(changeKey);
    const errors = errorsMap.get(changeKey) || [];
    
    const isHighlighted = highlightedCell?.row === row && highlightedCell?.column === column;
    
    let baseClass = 'px-3 py-2 text-sm border-r border-b border-[#1A1F2E] truncate max-w-[200px] transition-colors';
    
    if (isHighlighted) {
      baseClass += ' ring-2 ring-[#FF6B35] ring-inset';
    }
    
    if (errors.some(e => e.severity === 'error')) {
      return `${baseClass} bg-red-500/20 text-red-300`;
    }
    
    if (errors.some(e => e.severity === 'warning')) {
      return `${baseClass} bg-yellow-500/20 text-yellow-300`;
    }
    
    if (change && isCleanedSide) {
      if (change.type === 'format') {
        return `${baseClass} bg-green-500/20 text-green-300`;
      }
      if (change.type === 'transform') {
        return `${baseClass} bg-yellow-500/20 text-yellow-300`;
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
                <span className="font-medium text-white">{previewData.stats.rowsProcessed}</span> rows processed
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-gray-300">
                <span className="font-medium text-white">{previewData.stats.changesCount}</span> changes
              </span>
            </div>
            
            {previewData.stats.errorsCount > 0 && (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-sm text-gray-300">
                  <span className="font-medium text-red-400">{previewData.stats.errorsCount}</span> errors
                </span>
              </div>
            )}
            
            {previewData.stats.warningsCount > 0 && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-gray-300">
                  <span className="font-medium text-yellow-400">{previewData.stats.warningsCount}</span> warnings
                </span>
              </div>
            )}

            <div className="flex-1" />

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  checked={showOnlyChanges}
                  onCheckedChange={setShowOnlyChanges}
                />
                <span className="text-sm text-gray-400">Show only changes</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  checked={showOnlyErrors}
                  onCheckedChange={setShowOnlyErrors}
                />
                <span className="text-sm text-gray-400">Show only errors</span>
              </label>
            </div>
          </div>
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
                <AlertCircle className="w-12 h-12 text-red-400" />
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
                        {columns.map(column => (
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
                            className={`hover:bg-[#1A1F2E]/50 ${hasError ? 'bg-red-500/5' : ''}`}
                          >
                            <td className="px-3 py-2 text-xs text-gray-500 border-r border-b border-[#1A1F2E] bg-[#0A0E1A] sticky left-0 z-10">
                              {rowIndex + 1}
                              {hasError && (
                                <AlertCircle className="inline-block ml-1 w-3 h-3 text-red-400" />
                              )}
                            </td>
                            {columns.map(column => {
                              const value = row[column];
                              const displayValue = value === null || value === undefined ? '' : String(value);
                              
                              return (
                                <TooltipProvider key={column}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <td className={getCellClassName(rowIndex, column, false)}>
                                        {displayValue}
                                      </td>
                                    </TooltipTrigger>
                                    {changesMap.has(`${rowIndex}-${column}`) && (
                                      <TooltipContent side="bottom" className="bg-[#1A1F2E] border-[#2A2F3E] text-white">
                                        <div className="text-xs">
                                          <div className="text-gray-400">Before:</div>
                                          <div className="font-mono">{changesMap.get(`${rowIndex}-${column}`)?.from || '(empty)'}</div>
                                          <div className="text-gray-400 mt-1">After:</div>
                                          <div className="font-mono text-green-400">{changesMap.get(`${rowIndex}-${column}`)?.to || '(empty)'}</div>
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
                        {columns.map(column => {
                          const colErrors = columnErrors.get(column);
                          return (
                            <th 
                              key={column}
                              className="px-3 py-2 text-left text-xs font-medium text-gray-400 border-r border-b border-[#1A1F2E] bg-[#0D1117] whitespace-nowrap"
                            >
                              <div className="flex items-center gap-2">
                                {column}
                                {colErrors && colErrors.errors > 0 && (
                                  <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px]">
                                    {colErrors.errors}
                                  </span>
                                )}
                                {colErrors && colErrors.warnings > 0 && (
                                  <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-[10px]">
                                    {colErrors.warnings}
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
                            className={`hover:bg-[#1A1F2E]/50 ${hasError ? 'bg-red-500/5' : ''}`}
                          >
                            <td className="px-3 py-2 text-xs text-gray-500 border-r border-b border-[#1A1F2E] bg-[#0A0E1A] sticky left-0 z-10">
                              {rowIndex + 1}
                            </td>
                            {columns.map(column => {
                              const value = row[column];
                              const displayValue = value === null || value === undefined ? '' : String(value);
                              const cellErrors = errorsMap.get(`${rowIndex}-${column}`) || [];
                              
                              return (
                                <TooltipProvider key={column}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <td className={getCellClassName(rowIndex, column, true)}>
                                        {displayValue}
                                      </td>
                                    </TooltipTrigger>
                                    {(cellErrors.length > 0 || changesMap.has(`${rowIndex}-${column}`)) && (
                                      <TooltipContent side="bottom" className="bg-[#1A1F2E] border-[#2A2F3E] text-white max-w-xs">
                                        <div className="text-xs space-y-2">
                                          {changesMap.has(`${rowIndex}-${column}`) && (
                                            <div>
                                              <div className="text-gray-400">Changed from:</div>
                                              <div className="font-mono">{changesMap.get(`${rowIndex}-${column}`)?.from || '(empty)'}</div>
                                            </div>
                                          )}
                                          {cellErrors.map((err, i) => (
                                            <div key={i} className={err.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}>
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
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm font-medium text-white">
                Error Details ({previewData.errors.length} issues)
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
                    <div className="space-y-2">
                      {Object.entries(
                        previewData.errors.reduce((acc, error) => {
                          const key = `${error.column}: ${error.message}`;
                          if (!acc[key]) {
                            acc[key] = { ...error, count: 0, rows: [] as number[] };
                          }
                          acc[key].count++;
                          acc[key].rows.push(error.row);
                          return acc;
                        }, {} as Record<string, PreviewError & { count: number; rows: number[] }>)
                      ).map(([key, groupedError]) => (
                        <div 
                          key={key}
                          className={`flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-[#1A1F2E]/50 transition-colors ${
                            groupedError.severity === 'error' ? 'bg-red-500/10' : 'bg-yellow-500/10'
                          }`}
                          onClick={() => scrollToCell(groupedError.rows[0], groupedError.column)}
                        >
                          <div className="flex items-center gap-3">
                            {groupedError.severity === 'error' ? (
                              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                            )}
                            <div>
                              <p className={`text-sm ${groupedError.severity === 'error' ? 'text-red-300' : 'text-yellow-300'}`}>
                                Column "{groupedError.column}": {groupedError.message}
                              </p>
                              <p className="text-xs text-gray-500">
                                {groupedError.count} occurrence{groupedError.count > 1 ? 's' : ''} 
                                {groupedError.count <= 5 && ` (rows: ${groupedError.rows.map(r => r + 1).join(', ')})`}
                              </p>
                            </div>
                          </div>
                          <button className="text-xs text-[#FF6B35] hover:text-[#FF8F35]">
                            Go to first
                          </button>
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
              <div className="w-3 h-3 rounded bg-green-500/30" />
              <span>Formatted (trimmed, cleaned)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-yellow-500/30" />
              <span>Transformed (type conversion)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500/30" />
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
