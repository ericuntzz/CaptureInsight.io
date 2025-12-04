import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Plus, Trash2, GripVertical, ChevronDown, ChevronRight, 
  Settings, Columns3, Sparkles, FileText, Save, RotateCcw,
  AlertCircle, Wand2, Loader2, Eye
} from 'lucide-react';
import { Switch } from './ui/switch';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { Checkbox } from './ui/checkbox';
import { toast } from 'sonner';
import { useTemplateEditor, TemplateColumn, CleaningStep, ColumnMappingSuggestion } from '../contexts/TemplateEditorContext';
import { ColumnMappingPanel, ConfirmedMapping } from './ColumnMappingPanel';
import { TemplatePreview } from './TemplatePreview';
import { SuggestedMapping, SuggestedMappingBanner } from './SuggestedMapping';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const sourceTypeOptions = [
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'ga4', label: 'GA4' },
  { value: 'google_sheets', label: 'Google Sheets' },
  { value: 'csv', label: 'CSV' },
  { value: 'custom', label: 'Custom' },
];

const dataTypeOptions = [
  { value: 'currency', label: 'Currency' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'integer', label: 'Integer' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'date', label: 'Date' },
  { value: 'text', label: 'Text' },
  { value: 'boolean', label: 'Boolean' },
];

const cleaningStepLabels: Record<string, { name: string; description: string }> = {
  remove_commas: { name: 'Remove Commas', description: 'Strip commas from numbers (e.g., 1,000 → 1000)' },
  strip_currency: { name: 'Strip Currency Symbols', description: 'Remove $, €, £, etc. from values' },
  convert_percentage: { name: 'Convert Percentages', description: 'Convert percentage strings to numbers' },
  trim_whitespace: { name: 'Trim Whitespace', description: 'Remove leading/trailing spaces' },
  convert_date_format: { name: 'Convert Date Format', description: 'Transform date formats' },
  remove_duplicates: { name: 'Remove Duplicates', description: 'Eliminate duplicate rows' },
  fill_empty: { name: 'Fill Empty Values', description: 'Replace empty cells with default value' },
};

const formatValidationPresets = [
  { value: 'none', label: 'None (any format accepted)', pattern: '' },
  { value: 'us_currency', label: 'US Currency ($1,234.56)', pattern: '^\\$[\\d,]+(\\.\\d{2})?$' },
  { value: 'percentage', label: 'Percentage (12.5% or 0.125)', pattern: '^\\d+(\\.\\d+)?%?$' },
  { value: 'date_mdy', label: 'Date (MM/DD/YYYY)', pattern: '^\\d{2}/\\d{2}/\\d{4}$' },
  { value: 'date_ymd', label: 'Date (YYYY-MM-DD)', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
  { value: 'integer', label: 'Integer (1234)', pattern: '^-?\\d+$' },
  { value: 'decimal', label: 'Decimal (123.45)', pattern: '^-?\\d+(\\.\\d+)?$' },
  { value: 'email', label: 'Email Address', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
  { value: 'phone', label: 'Phone Number', pattern: '^[\\d\\s\\-\\(\\)\\+]+$' },
  { value: 'custom', label: 'Custom pattern (advanced)', pattern: '' },
];

interface SortableColumnRowProps {
  column: TemplateColumn;
  onUpdate: (updates: Partial<TemplateColumn>) => void;
  onDelete: () => void;
  onAddAlias: (alias: string) => void;
  onRemoveAlias: (alias: string) => void;
  suggestion?: ColumnMappingSuggestion;
  onAcceptSuggestion?: () => void;
  onRejectSuggestion?: () => void;
}

function SortableColumnRow({ 
  column, 
  onUpdate, 
  onDelete, 
  onAddAlias,
  onRemoveAlias,
  suggestion,
  onAcceptSuggestion,
  onRejectSuggestion,
}: SortableColumnRowProps) {
  const [newAliasValue, setNewAliasValue] = useState('');
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleAddAlias = () => {
    if (newAliasValue.trim()) {
      onAddAlias(newAliasValue.trim());
      setNewAliasValue('');
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="space-y-2">
      {suggestion && onAcceptSuggestion && onRejectSuggestion && (
        <SuggestedMapping
          suggestion={suggestion}
          onAccept={onAcceptSuggestion}
          onReject={onRejectSuggestion}
        />
      )}
      <div className="flex items-center gap-2 p-3 bg-[#0A0E1A] rounded-lg rounded-b-none border border-b-0 border-[#1A1F2E] hover:border-[#FF6B35]/30 transition-colors group">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-gray-500 hover:text-gray-300"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        
        <input
          type="text"
          value={column.canonicalName}
          onChange={(e) => onUpdate({ canonicalName: e.target.value })}
          placeholder="column_name"
          className="flex-1 min-w-[120px] px-2 py-1.5 bg-[#1A1F2E] border border-transparent focus:border-[#FF6B35]/50 rounded text-sm text-white placeholder:text-gray-500 focus:outline-none"
        />
        
        <input
          type="text"
          value={column.displayName}
          onChange={(e) => onUpdate({ displayName: e.target.value })}
          placeholder="Display Name"
          className="flex-1 min-w-[120px] px-2 py-1.5 bg-[#1A1F2E] border border-transparent focus:border-[#FF6B35]/50 rounded text-sm text-white placeholder:text-gray-500 focus:outline-none"
        />
        
        <Select 
          value={column.dataType} 
          onValueChange={(value: any) => onUpdate({ dataType: value })}
        >
          <SelectTrigger className="w-[100px] h-8 bg-[#1A1F2E] border-transparent text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1A1F2E] border-[#FF6B35]/30">
            {dataTypeOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-white hover:bg-[#FF6B35]/20">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <div className="flex items-center gap-2">
          <Checkbox
            checked={column.isRequired}
            onCheckedChange={(checked) => onUpdate({ isRequired: checked as boolean })}
            className="border-gray-600 data-[state=checked]:bg-[#FF6B35] data-[state=checked]:border-[#FF6B35]"
          />
          <span className="text-xs text-gray-400">Required</span>
        </div>
        
        <button
          onClick={onDelete}
          className="p-1.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      
      {/* Validation settings - always visible */}
      <div className="ml-8 p-4 bg-[#0A0E1A]/50 rounded-lg rounded-t-none border border-t-0 border-[#1A1F2E] space-y-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Format Validation (optional)</label>
          <Select 
            value={column.validationRules?.format || 'none'} 
            onValueChange={(value: string) => {
              const preset = formatValidationPresets.find(p => p.value === value);
              if (value === 'none') {
                onUpdate({ 
                  validationRules: { ...column.validationRules, format: undefined, pattern: undefined } 
                });
              } else if (value === 'custom') {
                onUpdate({ 
                  validationRules: { ...column.validationRules, format: 'custom' } 
                });
              } else {
                onUpdate({ 
                  validationRules: { ...column.validationRules, format: value, pattern: preset?.pattern } 
                });
              }
            }}
          >
            <SelectTrigger className="w-full h-9 bg-[#1A1F2E] border-transparent text-sm">
              <SelectValue placeholder="Select format validation" />
            </SelectTrigger>
            <SelectContent className="bg-[#1A1F2E] border-[#FF6B35]/30">
              {formatValidationPresets.map(preset => (
                <SelectItem key={preset.value} value={preset.value} className="text-white hover:bg-[#FF6B35]/20">
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {column.validationRules?.format === 'custom' && (
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Custom Regex Pattern</label>
            <input
              type="text"
              value={column.validationRules?.pattern || ''}
              onChange={(e) => onUpdate({ 
                validationRules: { ...column.validationRules, pattern: e.target.value } 
              })}
              placeholder="e.g., ^[A-Z]{2}-\d{4}$"
              className="w-full px-2 py-1.5 bg-[#1A1F2E] border border-transparent focus:border-[#FF6B35]/50 rounded text-sm text-white placeholder:text-gray-500 focus:outline-none font-mono text-xs"
            />
            <p className="text-xs text-gray-500 mt-1">Enter a regular expression pattern for advanced validation</p>
          </div>
        )}
        
        {(column.dataType === 'integer' || column.dataType === 'decimal' || column.dataType === 'currency' || column.dataType === 'percentage') && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Min Value</label>
              <input
                type="number"
                value={column.validationRules?.min ?? ''}
                onChange={(e) => onUpdate({ 
                  validationRules: { ...column.validationRules, min: e.target.value ? Number(e.target.value) : undefined } 
                })}
                className="w-full px-2 py-1.5 bg-[#1A1F2E] border border-transparent focus:border-[#FF6B35]/50 rounded text-sm text-white placeholder:text-gray-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Max Value</label>
              <input
                type="number"
                value={column.validationRules?.max ?? ''}
                onChange={(e) => onUpdate({ 
                  validationRules: { ...column.validationRules, max: e.target.value ? Number(e.target.value) : undefined } 
                })}
                className="w-full px-2 py-1.5 bg-[#1A1F2E] border border-transparent focus:border-[#FF6B35]/50 rounded text-sm text-white placeholder:text-gray-500 focus:outline-none"
              />
            </div>
          </div>
        )}
        
        {column.dataType === 'text' && (
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Max Length</label>
            <input
              type="number"
              value={column.validationRules?.maxLength ?? ''}
              onChange={(e) => onUpdate({ 
                validationRules: { ...column.validationRules, maxLength: e.target.value ? Number(e.target.value) : undefined } 
              })}
              className="w-32 px-2 py-1.5 bg-[#1A1F2E] border border-transparent focus:border-[#FF6B35]/50 rounded text-sm text-white placeholder:text-gray-500 focus:outline-none"
            />
          </div>
        )}
        
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Allowed Values (comma-separated)</label>
          <input
            type="text"
            value={column.validationRules?.allowedValues?.join(', ') || ''}
            onChange={(e) => onUpdate({ 
              validationRules: { 
                ...column.validationRules, 
                allowedValues: e.target.value ? e.target.value.split(',').map(v => v.trim()) : undefined 
              } 
            })}
            placeholder="value1, value2, value3"
            className="w-full px-2 py-1.5 bg-[#1A1F2E] border border-transparent focus:border-[#FF6B35]/50 rounded text-sm text-white placeholder:text-gray-500 focus:outline-none"
          />
        </div>
        
        <div className="border-t border-[#1A1F2E] pt-4">
          <label className="block text-xs text-gray-400 mb-2">Column Aliases</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {(column.aliases || []).map((alias, idx) => (
              <span 
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-1 bg-[#1A1F2E] rounded text-xs text-gray-300"
              >
                {alias}
                <button 
                  onClick={() => onRemoveAlias(alias)}
                  className="text-gray-500 hover:text-red-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newAliasValue}
              onChange={(e) => setNewAliasValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddAlias();
                }
              }}
              placeholder="Add alias..."
              className="flex-1 px-2 py-1.5 bg-[#1A1F2E] border border-transparent focus:border-[#FF6B35]/50 rounded text-sm text-white placeholder:text-gray-500 focus:outline-none"
            />
            <button
              onClick={handleAddAlias}
              className="px-3 py-1.5 bg-[#FF6B35]/20 hover:bg-[#FF6B35]/30 text-[#FF6B35] rounded text-sm transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CleaningStepItemProps {
  step: CleaningStep;
  onToggle: () => void;
  onUpdate: (updates: Partial<CleaningStep>) => void;
  columns: TemplateColumn[];
}

function CleaningStepItem({ step, onToggle, onUpdate, columns }: CleaningStepItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const label = cleaningStepLabels[step.type] || { name: step.type, description: '' };

  return (
    <div className={`rounded-lg border transition-colors ${step.enabled ? 'border-[#FF6B35]/30 bg-[#FF6B35]/5' : 'border-[#1A1F2E] bg-[#0A0E1A]'}`}>
      <div className="flex items-center gap-3 p-3">
        <Switch
          checked={step.enabled}
          onCheckedChange={onToggle}
          className="data-[state=checked]:bg-[#FF6B35]"
        />
        <div className="flex-1">
          <div className="text-sm text-white font-medium">{label.name}</div>
          <div className="text-xs text-gray-500">{label.description}</div>
        </div>
        {step.enabled && (step.type === 'convert_percentage' || step.type === 'convert_date_format' || step.type === 'fill_empty') && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-400 hover:text-white"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        )}
      </div>
      
      <AnimatePresence>
        {isExpanded && step.enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">
              {step.type === 'convert_percentage' && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Percentage Mode</label>
                  <Select 
                    value={step.config?.percentageMode || 'decimal'} 
                    onValueChange={(value: 'decimal' | 'whole') => onUpdate({ 
                      config: { ...step.config, percentageMode: value } 
                    })}
                  >
                    <SelectTrigger className="w-full h-8 bg-[#1A1F2E] border-transparent text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1F2E] border-[#FF6B35]/30">
                      <SelectItem value="decimal" className="text-white hover:bg-[#FF6B35]/20">
                        Decimal (0.125)
                      </SelectItem>
                      <SelectItem value="whole" className="text-white hover:bg-[#FF6B35]/20">
                        Whole (12.5)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {step.type === 'convert_date_format' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">From Format</label>
                    <input
                      type="text"
                      value={step.config?.fromFormat || ''}
                      onChange={(e) => onUpdate({ 
                        config: { ...step.config, fromFormat: e.target.value } 
                      })}
                      placeholder="MM/DD/YYYY"
                      className="w-full px-2 py-1.5 bg-[#1A1F2E] border border-transparent focus:border-[#FF6B35]/50 rounded text-sm text-white placeholder:text-gray-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">To Format</label>
                    <input
                      type="text"
                      value={step.config?.toFormat || ''}
                      onChange={(e) => onUpdate({ 
                        config: { ...step.config, toFormat: e.target.value } 
                      })}
                      placeholder="YYYY-MM-DD"
                      className="w-full px-2 py-1.5 bg-[#1A1F2E] border border-transparent focus:border-[#FF6B35]/50 rounded text-sm text-white placeholder:text-gray-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
              
              {step.type === 'fill_empty' && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Fill Value</label>
                  <input
                    type="text"
                    value={step.config?.fillValue || ''}
                    onChange={(e) => onUpdate({ 
                      config: { ...step.config, fillValue: e.target.value } 
                    })}
                    placeholder="N/A, 0, or leave empty"
                    className="w-full px-2 py-1.5 bg-[#1A1F2E] border border-transparent focus:border-[#FF6B35]/50 rounded text-sm text-white placeholder:text-gray-500 focus:outline-none"
                  />
                </div>
              )}
              
              {columns.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Apply to Columns (leave empty for all)</label>
                  <div className="flex flex-wrap gap-1">
                    {columns.map(col => {
                      const isSelected = step.config?.targetColumns?.includes(col.canonicalName);
                      return (
                        <button
                          key={col.id}
                          onClick={() => {
                            const current = step.config?.targetColumns || [];
                            const newTargets = isSelected
                              ? current.filter(c => c !== col.canonicalName)
                              : [...current, col.canonicalName];
                            onUpdate({ config: { ...step.config, targetColumns: newTargets.length ? newTargets : undefined } });
                          }}
                          className={`px-2 py-1 rounded text-xs transition-colors ${
                            isSelected 
                              ? 'bg-[#FF6B35] text-white' 
                              : 'bg-[#1A1F2E] text-gray-400 hover:text-white'
                          }`}
                        >
                          {col.displayName || col.canonicalName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface TemplateEditorProps {
  currentData?: Record<string, any>[];
  spaceId?: string;
}

export function TemplateEditor({ currentData, spaceId }: TemplateEditorProps) {
  const {
    template,
    isDirty,
    errors,
    isOpen,
    isSaving,
    columnSuggestions,
    isLoadingSuggestions,
    updateTemplate,
    addColumn,
    updateColumn,
    deleteColumn,
    reorderColumns,
    addColumnAlias,
    removeColumnAlias,
    updateCleaningStep,
    toggleCleaningStep,
    setColumnSuggestions,
    setIsLoadingSuggestions,
    acceptSuggestion,
    rejectSuggestion,
    clearAllSuggestions,
    closeEditor,
    save,
    reset,
  } = useTemplateEditor();

  const [aiSuggestions, setAiSuggestions] = useState<ColumnMappingSuggestion[]>([]);
  const [showMappingPanel, setShowMappingPanel] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const fetchAISuggestions = useCallback(async () => {
    if (!currentData || currentData.length === 0) {
      toast.error('No data available to analyze');
      return;
    }

    const sourceColumns = Object.keys(currentData[0] || {});
    if (sourceColumns.length === 0) {
      toast.error('No columns found in the data');
      return;
    }

    setIsLoadingSuggestions(true);
    setShowMappingPanel(true);

    try {
      const response = await fetch('/api/templates/suggest-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sourceColumns,
          templateColumns: template.columns.map(c => ({
            canonicalName: c.canonicalName,
            displayName: c.displayName,
            dataType: c.dataType,
          })),
          sampleData: currentData.slice(0, 5),
          spaceId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to get AI suggestions');
      }

      const data = await response.json();
      const suggestions = data.suggestions || [];
      setAiSuggestions(suggestions);
      
      const suggestionsMap: Record<string, ColumnMappingSuggestion> = {};
      template.columns.forEach((col, index) => {
        const suggestion = suggestions.find((s: ColumnMappingSuggestion) => 
          s.sourceColumn === col.canonicalName || 
          (col.aliases || []).includes(s.sourceColumn) ||
          suggestions[index]
        );
        if (suggestion || suggestions[index]) {
          suggestionsMap[col.id] = suggestion || suggestions[index];
        }
      });
      
      if (suggestions.length > 0 && template.columns.length === 0) {
        suggestions.forEach((s: ColumnMappingSuggestion, idx: number) => {
          const colId = `col-${Date.now()}-${idx}`;
          suggestionsMap[colId] = s;
        });
      }
      
      setColumnSuggestions(suggestionsMap);
      
      if (data.summary?.highConfidence > 0) {
        toast.success(`Found ${data.summary.highConfidence} high-confidence mappings`);
      }
    } catch (error) {
      console.error('Failed to fetch AI suggestions:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to get AI suggestions');
      setShowMappingPanel(false);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [currentData, template.columns, spaceId, setColumnSuggestions, setIsLoadingSuggestions]);

  const handleConfirmMappings = useCallback((mappings: ConfirmedMapping[]) => {
    mappings.forEach(mapping => {
      const existingColumn = template.columns.find(
        c => c.canonicalName === mapping.mappedTo
      );

      if (!existingColumn) {
        addColumn({
          canonicalName: mapping.mappedTo,
          displayName: mapping.displayName,
          dataType: 'text',
          isRequired: false,
          aliases: mapping.sourceColumn !== mapping.mappedTo ? [mapping.sourceColumn] : [],
        });
      } else {
        if (mapping.sourceColumn !== mapping.mappedTo && 
            !(existingColumn.aliases || []).includes(mapping.sourceColumn)) {
          addColumnAlias(existingColumn.id, mapping.sourceColumn);
        }
      }
    });

    setShowMappingPanel(false);
    setAiSuggestions([]);
    toast.success(`Applied ${mappings.length} column mappings`);
  }, [template.columns, addColumn, addColumnAlias]);

  const handleDismissMappings = useCallback(() => {
    setShowMappingPanel(false);
    setAiSuggestions([]);
    clearAllSuggestions();
  }, [clearAllSuggestions]);

  const handleAcceptAllSuggestions = useCallback(() => {
    Object.keys(columnSuggestions).forEach(colId => {
      acceptSuggestion(colId);
    });
    toast.success('Applied all AI suggestions');
  }, [columnSuggestions, acceptSuggestion]);

  const suggestionsCount = Object.keys(columnSuggestions).length;
  const highConfidenceCount = Object.values(columnSuggestions).filter(s => s.confidence >= 85).length;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = template.columns.findIndex(col => col.id === active.id);
      const newIndex = template.columns.findIndex(col => col.id === over.id);
      reorderColumns(oldIndex, newIndex);
    }
  };

  const handleSave = async () => {
    try {
      await save();
      toast.success('Template saved successfully');
    } catch (error) {
      toast.error('Failed to save template');
    }
  };

  const hasErrors = errors.length > 0;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={closeEditor}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="relative w-full h-full max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] bg-[#0A0E1A] rounded-xl border border-[#1A1F2E] overflow-hidden flex flex-col z-10"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1A1F2E]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FF6B35] to-[#FF8F35] flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {template.id ? 'Edit Template' : 'Create Data Template'}
              </h2>
              <p className="text-sm text-gray-400">
                Define column mappings, validation rules, and cleaning steps
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isDirty && (
              <button
                onClick={reset}
                className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            )}
            {currentData && currentData.length > 0 && (
              <button
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-colors"
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving || hasErrors}
              className="flex items-center gap-2 px-4 py-2 bg-[#FF6B35] hover:bg-[#FF8F35] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Template'}
            </button>
            <button
              onClick={closeEditor}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {hasErrors && (
          <div className="px-6 py-3 bg-red-500/10 border-b border-red-500/30">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">Please fix the following errors:</span>
            </div>
            <ul className="mt-1 ml-6 text-sm text-red-300 list-disc">
              {errors.map((err, idx) => (
                <li key={idx}>{err.message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          <div className="w-72 border-r border-[#1A1F2E] p-4 overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-4 h-4 text-[#FF6B35]" />
              <h3 className="text-sm font-medium text-white">Template Settings</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Template Name *</label>
                <input
                  type="text"
                  value={template.name}
                  onChange={(e) => updateTemplate({ name: e.target.value })}
                  placeholder="e.g., Monthly Ad Performance Report"
                  className="w-full px-3 py-2 bg-[#1A1F2E] border border-transparent focus:border-[#FF6B35]/50 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Description</label>
                <textarea
                  value={template.description}
                  onChange={(e) => updateTemplate({ description: e.target.value })}
                  placeholder="Describe what this template is for..."
                  rows={3}
                  className="w-full px-3 py-2 bg-[#1A1F2E] border border-transparent focus:border-[#FF6B35]/50 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none resize-none"
                />
              </div>
              
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Scope</label>
                <Select 
                  value={template.scope} 
                  onValueChange={(value: 'workspace' | 'space') => updateTemplate({ scope: value })}
                >
                  <SelectTrigger className="w-full bg-[#1A1F2E] border-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1F2E] border-[#FF6B35]/30">
                    <SelectItem value="workspace" className="text-white hover:bg-[#FF6B35]/20">
                      Workspace (all spaces)
                    </SelectItem>
                    <SelectItem value="space" className="text-white hover:bg-[#FF6B35]/20">
                      Current Space only
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Source Type Lock (optional)</label>
                <Select 
                  value={template.sourceType || 'any'} 
                  onValueChange={(value: string) => updateTemplate({ sourceType: (value === 'any' ? null : value) as 'google_ads' | 'meta_ads' | 'ga4' | 'google_sheets' | 'csv' | 'custom' | null })}
                >
                  <SelectTrigger className="w-full bg-[#1A1F2E] border-transparent">
                    <SelectValue placeholder="Any source type" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1F2E] border-[#FF6B35]/30">
                    <SelectItem value="any" className="text-white hover:bg-[#FF6B35]/20">
                      Any source type
                    </SelectItem>
                    {sourceTypeOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value} className="text-white hover:bg-[#FF6B35]/20">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">AI Prompt Hints (optional)</label>
                <textarea
                  value={template.aiPromptHints || ''}
                  onChange={(e) => updateTemplate({ aiPromptHints: e.target.value })}
                  placeholder="Additional context for AI processing..."
                  rows={4}
                  className="w-full px-3 py-2 bg-[#1A1F2E] border border-transparent focus:border-[#FF6B35]/50 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Columns3 className="w-4 h-4 text-[#FF6B35]" />
                <h3 className="text-sm font-medium text-white">Column Schema</h3>
                <span className="text-xs text-gray-500">({template.columns.length} columns)</span>
              </div>
              
              {template.columns.length > 0 && (
                <div className="flex items-center gap-2">
                  {currentData && currentData.length > 0 && (
                    <button
                      onClick={fetchAISuggestions}
                      disabled={isLoadingSuggestions}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-[#FF6B35]/20 hover:from-purple-500/30 hover:to-[#FF6B35]/30 text-purple-300 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Use AI to suggest column mappings from your data"
                    >
                      {isLoadingSuggestions ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Wand2 className="w-4 h-4" />
                      )}
                      AI Suggest
                    </button>
                  )}
                  <button
                    onClick={() => addColumn()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF6B35]/20 hover:bg-[#FF6B35]/30 text-[#FF6B35] rounded-lg text-sm transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Column
                  </button>
                </div>
              )}
            </div>
            
            {showMappingPanel && (
              <div className="mb-4">
                <ColumnMappingPanel
                  suggestions={aiSuggestions}
                  isLoading={isLoadingSuggestions}
                  onConfirm={handleConfirmMappings}
                  onDismiss={handleDismissMappings}
                  onRefresh={fetchAISuggestions}
                />
              </div>
            )}
            
            {suggestionsCount > 0 && !showMappingPanel && (
              <SuggestedMappingBanner
                totalSuggestions={suggestionsCount}
                highConfidenceCount={highConfidenceCount}
                onApplyAll={handleAcceptAllSuggestions}
                onDismissAll={clearAllSuggestions}
                isLoading={isLoadingSuggestions}
              />
            )}
            
            {template.columns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#FF6B35]/20 to-[#FF8F35]/10 flex items-center justify-center mb-4">
                  <Columns3 className="w-10 h-10 text-[#FF6B35]/60" />
                </div>
                <p className="text-base text-white font-medium mb-1">No columns defined yet</p>
                <p className="text-sm text-gray-400 mb-6">Add your first column to start building your data schema</p>
                <button
                  onClick={() => addColumn()}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#FF6B35] to-[#FF8F35] hover:from-[#FF7B45] hover:to-[#FF9F45] text-white rounded-xl text-base font-medium transition-all shadow-lg shadow-[#FF6B35]/25 hover:shadow-[#FF6B35]/40 hover:scale-105"
                >
                  <Plus className="w-5 h-5" />
                  Add Column
                </button>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={template.columns.map(c => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4">
                    {template.columns.map(column => (
                      <SortableColumnRow
                        key={column.id}
                        column={column}
                        onUpdate={(updates) => updateColumn(column.id, updates)}
                        onDelete={() => deleteColumn(column.id)}
                        onAddAlias={(alias) => addColumnAlias(column.id, alias)}
                        onRemoveAlias={(alias) => removeColumnAlias(column.id, alias)}
                        suggestion={columnSuggestions[column.id]}
                        onAcceptSuggestion={() => acceptSuggestion(column.id)}
                        onRejectSuggestion={() => rejectSuggestion(column.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          <div className="w-80 border-l border-[#1A1F2E] p-4 overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-[#FF6B35]" />
              <h3 className="text-sm font-medium text-white">Cleaning Pipeline</h3>
            </div>
            
            <p className="text-xs text-gray-500 mb-4">
              Configure automatic data cleaning steps that will be applied when this template is used.
            </p>
            
            <div className="space-y-2">
              {template.cleaningPipeline.map(step => (
                <CleaningStepItem
                  key={step.id}
                  step={step}
                  onToggle={() => toggleCleaningStep(step.id)}
                  onUpdate={(updates) => updateCleaningStep(step.id, updates)}
                  columns={template.columns}
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>
      </div>

      <TemplatePreview
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        templateId={template.id}
        templateName={template.name}
        sampleData={currentData}
        cleaningPipeline={{ steps: template.cleaningPipeline }}
        columnSchema={{ columns: template.columns }}
      />
    </AnimatePresence>
  );
}
