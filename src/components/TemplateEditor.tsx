import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Plus, Trash2, GripVertical, ChevronDown, ChevronRight, 
  Settings, Columns3, Sparkles, FileText, Save, RotateCcw,
  AlertCircle, Wand2, Loader2, Eye, Lightbulb, Tag, HelpCircle, ArrowRight, CheckCircle2, Calculator, Check, Keyboard
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
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { toast } from 'sonner';
import { useTemplateEditor, TemplateColumn, CleaningStep, ColumnMappingSuggestion, CalculatedField } from '../contexts/TemplateEditorContext';
import { ColumnMappingPanel, ConfirmedMapping } from './ColumnMappingPanel';
import { TemplatePreview } from './TemplatePreview';
import { SuggestedMapping, SuggestedMappingBanner } from './SuggestedMapping';
import { CalculatedFieldsPanel } from './CalculatedFieldsPanel';
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

const cleaningStepLabels: Record<string, { name: string; description: string; before: string; after: string; columnBased: boolean }> = {
  remove_commas: { name: 'Remove Commas', description: 'Strip commas from numbers', before: '1,234,567', after: '1234567', columnBased: true },
  strip_currency: { name: 'Strip Currency Symbols', description: 'Remove $, €, £ from values', before: '$1,234.56', after: '1,234.56', columnBased: true },
  convert_percentage: { name: 'Convert Percentages', description: 'Convert % strings to decimals', before: '12.5%', after: '0.125', columnBased: true },
  trim_whitespace: { name: 'Trim Whitespace', description: 'Remove extra spaces', before: '  Hello World  ', after: 'Hello World', columnBased: true },
  convert_date_format: { name: 'Convert Date Format', description: 'Standardize date formats', before: '12/25/2024', after: '2024-12-25', columnBased: true },
  remove_duplicates: { name: 'Remove Duplicates', description: 'Eliminate duplicate rows', before: '3 rows', after: '2 unique rows', columnBased: false },
  fill_empty: { name: 'Fill Empty Values', description: 'Replace empty cells with default', before: '(empty)', after: 'N/A', columnBased: true },
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

const commonColumnAliases: Record<string, string[]> = {
  'ad_spend': ['Cost', 'Total Spend', 'Amount', 'Spend', 'Ad Cost', 'Advertising Cost', 'Media Spend'],
  'spend': ['Cost', 'Total Spend', 'Amount', 'Ad Spend', 'Expense', 'Budget Used'],
  'cost': ['Spend', 'Amount', 'Total Cost', 'Price', 'Expense'],
  'revenue': ['Sales', 'Income', 'Total Revenue', 'Earnings', 'Gross Revenue'],
  'sales': ['Revenue', 'Total Sales', 'Orders Value', 'Gross Sales'],
  'impressions': ['Impr', 'Views', 'Total Impressions', 'Ad Views', 'Displays'],
  'clicks': ['Total Clicks', 'Click Count', 'Link Clicks', 'Interactions'],
  'ctr': ['Click Rate', 'Click Through Rate', 'CTR %', 'Click-Through Rate'],
  'cpc': ['Cost Per Click', 'Avg CPC', 'Average CPC', 'Click Cost'],
  'cpm': ['Cost Per Mille', 'Cost Per 1000', 'CPM Cost'],
  'conversions': ['Conv', 'Total Conversions', 'Converted', 'Actions', 'Goals'],
  'roas': ['Return On Ad Spend', 'ROAS %', 'Ad Return'],
  'date': ['Day', 'Report Date', 'Period', 'Time', 'Date Range'],
  'campaign': ['Campaign Name', 'Ad Campaign', 'Campaign Title'],
  'campaign_name': ['Campaign', 'Ad Campaign', 'Campaign Title'],
  'ad_group': ['Ad Set', 'Ad Group Name', 'Group', 'Adset'],
  'ad_name': ['Ad', 'Ad Title', 'Creative Name', 'Ad Creative'],
  'keyword': ['Search Term', 'Keywords', 'Query', 'Search Query'],
  'device': ['Device Type', 'Platform', 'Device Category'],
  'country': ['Region', 'Location', 'Geo', 'Country Code'],
  'budget': ['Daily Budget', 'Campaign Budget', 'Spend Limit', 'Budget Amount'],
};

function getSuggestedAliases(columnName: string, existingAliases: string[] = []): string[] {
  const normalizedName = columnName.toLowerCase().replace(/[\s_-]+/g, '_').replace(/[^a-z0-9_]/g, '');
  const suggestions: Set<string> = new Set();
  
  for (const [key, aliases] of Object.entries(commonColumnAliases)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      aliases.forEach(alias => suggestions.add(alias));
    }
  }
  
  const words = columnName.split(/[\s_-]+/).filter(w => w.length > 0);
  if (words.length > 1) {
    suggestions.add(words.join(' '));
    suggestions.add(words.join('_'));
    suggestions.add(words.join('-'));
    suggestions.add(words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '));
  }
  
  const existingLower = existingAliases.map(a => a.toLowerCase());
  const columnLower = columnName.toLowerCase();
  
  return Array.from(suggestions)
    .filter(s => !existingLower.includes(s.toLowerCase()) && s.toLowerCase() !== columnLower)
    .slice(0, 5);
}

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

        {/* Column Aliases - Prominent Section */}
        <div className="bg-gradient-to-r from-[#FF6B35]/5 to-transparent rounded-lg p-3 border border-[#FF6B35]/20">
          <div className="flex items-start gap-2 mb-3">
            <div className="w-6 h-6 rounded bg-[#FF6B35]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Tag className="w-3.5 h-3.5 text-[#FF6B35]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white">Column Aliases</label>
              <p className="text-xs text-gray-400 mt-0.5">Help AI recognize this column even if the name changes in future uploads</p>
            </div>
          </div>
          
          {/* Current aliases */}
          {(column.aliases || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(column.aliases || []).map((alias, idx) => (
                <span 
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-[#1A1F2E] rounded text-xs text-white border border-[#FF6B35]/30"
                >
                  {alias}
                  <button 
                    onClick={() => onRemoveAlias(alias)}
                    className="text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          
          {/* Suggested aliases */}
          {(() => {
            const suggestions = getSuggestedAliases(column.displayName || column.canonicalName, column.aliases || []);
            if (suggestions.length === 0) return null;
            
            return (
              <div className="mb-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Lightbulb className="w-3 h-3 text-yellow-500" />
                  <span className="text-xs text-gray-400">Suggested aliases:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => onAddAlias(suggestion)}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-[#1A1F2E]/50 hover:bg-[#FF6B35]/20 border border-dashed border-gray-600 hover:border-[#FF6B35]/50 rounded text-xs text-gray-300 hover:text-[#FF6B35] transition-all"
                    >
                      <Plus className="w-3 h-3" />
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
          
          {/* Custom alias input */}
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
              placeholder="Add custom alias..."
              className="flex-1 px-2 py-1.5 bg-[#1A1F2E] border border-transparent focus:border-[#FF6B35]/50 rounded text-sm text-white placeholder:text-gray-500 focus:outline-none"
            />
            <button
              onClick={handleAddAlias}
              disabled={!newAliasValue.trim()}
              className="px-3 py-1.5 bg-[#FF6B35]/20 hover:bg-[#FF6B35]/30 text-[#FF6B35] rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        </div>
        
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
      </div>
    </div>
  );
}

function getCleaningStepTooltip(type: string): string {
  const tooltips: Record<string, string> = {
    remove_commas: "Converts '1,234' to '1234' for numeric calculations",
    strip_currency: "Removes currency symbols ($, €, £) so values can be used in math",
    convert_percentage: "Converts '12.5%' to 0.125 (or 12.5) for calculations",
    trim_whitespace: "Removes leading/trailing spaces that can cause matching issues",
    convert_date_format: "Standardizes dates to a consistent format (e.g., YYYY-MM-DD)",
    remove_duplicates: "Keeps only unique rows based on all column values",
    fill_empty: "Replaces empty cells with a default value to prevent errors",
  };
  return tooltips[type] || `Enable or disable this cleaning step`;
}

interface CleaningStepItemProps {
  step: CleaningStep;
  onToggle: () => void;
  onUpdate: (updates: Partial<CleaningStep>) => void;
  columns: TemplateColumn[];
}

function CleaningStepItem({ step, onToggle, onUpdate, columns }: CleaningStepItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const label = cleaningStepLabels[step.type] || { name: step.type, description: '', before: '', after: '', columnBased: true };
  
  const hasExpandableOptions = step.type === 'convert_percentage' || step.type === 'convert_date_format' || step.type === 'fill_empty' || (label.columnBased && columns.length > 0);
  const targetColumns = step.config?.targetColumns || [];
  const isAllColumns = targetColumns.length === 0 && !showColumnPicker;

  const tooltipDescription = getCleaningStepTooltip(step.type);
  
  return (
    <div className={`rounded-lg border transition-colors ${step.enabled ? 'border-[#FF6B35]/30 bg-[#FF6B35]/5' : 'border-[#1A1F2E] bg-[#0A0E1A]'}`}>
      <div className="flex items-center gap-3 p-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Switch
                checked={step.enabled}
                onCheckedChange={onToggle}
                className="data-[state=checked]:bg-[#FF6B35]"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="bg-[#1A1F2E] border border-[#FF6B35]/30 text-white p-2 max-w-xs">
            <p className="text-xs">{tooltipDescription}</p>
          </TooltipContent>
        </Tooltip>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white font-medium">{label.name}</span>
            {step.enabled && label.before && label.after && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-500 font-mono bg-[#0A0E1A] px-1.5 py-0.5 rounded">{label.before}</span>
                <ArrowRight className="w-3 h-3 text-[#FF6B35]" />
                <span className="text-green-400 font-mono bg-[#0A0E1A] px-1.5 py-0.5 rounded">{label.after}</span>
              </div>
            )}
          </div>
          <div className="text-xs text-gray-500">{label.description}</div>
        </div>
        {step.enabled && hasExpandableOptions && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 text-gray-400 hover:text-white flex-shrink-0"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="bg-[#1A1F2E] border border-[#FF6B35]/30 text-white p-2">
              <p className="text-xs">{isExpanded ? 'Collapse options' : 'Configure options'}</p>
            </TooltipContent>
          </Tooltip>
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
              
              {label.columnBased && columns.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-400">Apply to:</label>
                    <Select 
                      value={targetColumns.length > 0 || showColumnPicker ? 'specific' : 'all'} 
                      onValueChange={(value: string) => {
                        if (value === 'all') {
                          setShowColumnPicker(false);
                          onUpdate({ config: { ...step.config, targetColumns: undefined } });
                        } else {
                          setShowColumnPicker(true);
                        }
                      }}
                    >
                      <SelectTrigger className="w-40 h-7 bg-[#1A1F2E] border-transparent text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1A1F2E] border-[#FF6B35]/30">
                        <SelectItem value="all" className="text-white hover:bg-[#FF6B35]/20 text-xs">
                          All Columns
                        </SelectItem>
                        <SelectItem value="specific" className="text-white hover:bg-[#FF6B35]/20 text-xs">
                          Specific Columns...
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {(targetColumns.length > 0 || showColumnPicker) ? (
                    <div className="space-y-1.5">
                      <p className="text-xs text-gray-500">Click columns to select:</p>
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
                                if (newTargets.length === 0) {
                                  setShowColumnPicker(false);
                                }
                              }}
                              className={`px-2 py-1 rounded text-xs transition-colors ${
                                isSelected 
                                  ? 'bg-[#FF6B35] text-white' 
                                  : 'bg-[#1A1F2E] text-gray-400 hover:text-white hover:bg-[#1A1F2E]/80'
                              }`}
                            >
                              {col.displayName || col.canonicalName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic">Rule will be applied to all columns</p>
                  )}
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
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [schemaTab, setSchemaTab] = useState<'columns' | 'calculated'>('columns');
  const [editingField, setEditingField] = useState<CalculatedField | null>(null);
  const [showFieldEditor, setShowFieldEditor] = useState(false);

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
          dataType: mapping.dataType || 'text',
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

  // Track save success state for animated feedback
  const [saveSuccess, setSaveSuccess] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const hasErrors = errors.length > 0;

  const handleSave = async () => {
    try {
      await save();
      setSaveSuccess(true);
      // Reset success state after 2 seconds
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => setSaveSuccess(false), 2000);
      toast.success('Template saved successfully');
    } catch (error) {
      toast.error('Failed to save template');
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Keyboard shortcuts: Cmd/Ctrl+S save, Cmd/Ctrl+P preview, Cmd/Ctrl+K add column, Esc close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + S: Save template
      if (isMod && e.key === 's') {
        e.preventDefault();
        if (!isSaving && !hasErrors) {
          handleSave();
        }
      }

      // Cmd/Ctrl + P: Preview template
      if (isMod && e.key === 'p') {
        e.preventDefault();
        if ((currentData && currentData.length > 0) || template.id) {
          setShowPreview(true);
        }
      }

      // Cmd/Ctrl + K: Add column (quick add)
      if (isMod && e.key === 'k') {
        e.preventDefault();
        if (schemaTab === 'columns') {
          addColumn();
        } else if (schemaTab === 'calculated') {
          setEditingField(null);
          setShowFieldEditor(true);
        }
      }

      // Esc: Close modal (only if no other modals are open)
      if (e.key === 'Escape') {
        if (showPreview) {
          setShowPreview(false);
        } else if (showResetConfirm) {
          setShowResetConfirm(false);
        } else if (showFieldEditor) {
          setShowFieldEditor(false);
          setEditingField(null);
        } else {
          closeEditor();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, hasErrors, currentData, template.id, schemaTab, showPreview, showResetConfirm, showFieldEditor]);

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
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-[#1A1F2E] border border-red-500/30 text-white p-2">
                  <p className="text-xs">Discard all unsaved changes and restore the original template</p>
                </TooltipContent>
              </Tooltip>
            )}
            {(currentData && currentData.length > 0) || template.id ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowPreview(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-[#FF6B35] hover:from-purple-600 hover:to-[#FF7B45] text-white rounded-lg transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
                  >
                    <Eye className="w-4 h-4" />
                    Preview Template
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-[#1A1F2E] border border-purple-500/30 text-white p-2 max-w-xs">
                  <p className="text-xs mb-1">
                    {currentData && currentData.length > 0 
                      ? "See exactly how your data will be transformed before saving. Recommended!"
                      : "Preview how this template transforms data"}
                  </p>
                  <div className="flex items-center gap-2 text-xs border-t border-purple-500/20 pt-1 mt-1">
                    <Keyboard className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-400">
                      {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+P
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    disabled
                    className="flex items-center gap-2 px-4 py-2 bg-[#1A1F2E] text-gray-500 rounded-lg cursor-not-allowed"
                  >
                    <Eye className="w-4 h-4" />
                    Preview
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-[#1A1F2E] border border-[#FF6B35]/30 text-white p-2 max-w-xs">
                  <p className="text-xs mb-1">Upload data first to see a live preview of your template transformations</p>
                  <div className="flex items-center gap-2 text-xs border-t border-[#FF6B35]/20 pt-1 mt-1">
                    <Keyboard className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-400">
                      {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+P
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSave}
                  disabled={isSaving || hasErrors}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    saveSuccess 
                      ? 'bg-[#22C55E] text-white' 
                      : isSaving
                        ? 'bg-[#22C55E]/70 text-white cursor-wait'
                        : 'bg-[#22C55E] hover:bg-[#16A34A] text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {saveSuccess ? (
                    <>
                      <Check className="w-4 h-4" />
                      Saved!
                    </>
                  ) : isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Template
                    </>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[#1A1F2E] border border-[#22C55E]/30 text-white p-2">
                <div className="flex items-center gap-2 text-xs">
                  <Keyboard className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-400">
                    {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+S
                  </span>
                </div>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={closeEditor}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[#1A1F2E] border border-[#1A1F2E] text-white p-2">
                <div className="flex items-center gap-2 text-xs">
                  <span>Close editor</span>
                  <span className="text-gray-400 border border-gray-600 rounded px-1.5 py-0.5">Esc</span>
                </div>
              </TooltipContent>
            </Tooltip>
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
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="block text-xs text-gray-400">Data Source</label>
                  <span className="text-xs text-gray-500">(Optional)</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-gray-500 hover:text-gray-400 transition-colors">
                        <HelpCircle className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs bg-[#1A1F2E] border border-[#FF6B35]/30 text-white p-3">
                      <p className="font-medium text-[#FF6B35] mb-1">Lock to a specific platform</p>
                      <p className="text-xs text-gray-300">
                        When set, CaptureInsight will auto-detect your data source and only apply this template to matching data (e.g., Google Ads, Meta Ads). This prevents accidentally applying the wrong template.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select 
                  value={template.sourceType || 'any'} 
                  onValueChange={(value: string) => updateTemplate({ sourceType: (value === 'any' ? null : value) as 'google_ads' | 'meta_ads' | 'ga4' | 'google_sheets' | 'csv' | 'custom' | null })}
                >
                  <SelectTrigger className="w-full bg-[#1A1F2E] border-transparent">
                    <SelectValue placeholder="Any data source" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1F2E] border-[#FF6B35]/30">
                    <SelectItem value="any" className="text-white hover:bg-[#FF6B35]/20">
                      Any data source
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
            {/* Schema Tabs */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1 p-1 bg-[#0D1117] rounded-xl">
                <button
                  onClick={() => setSchemaTab('columns')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    schemaTab === 'columns' 
                      ? 'bg-[#FF6B35]/20 text-[#FF6B35]' 
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#1A1F2E]'
                  }`}
                >
                  <Columns3 className="w-4 h-4" />
                  Columns
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    schemaTab === 'columns' ? 'bg-[#FF6B35]/30' : 'bg-[#1A1F2E]'
                  }`}>
                    {template.columns.length}
                  </span>
                </button>
                <button
                  onClick={() => setSchemaTab('calculated')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    schemaTab === 'calculated' 
                      ? 'bg-purple-500/20 text-purple-400' 
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#1A1F2E]'
                  }`}
                >
                  <Calculator className="w-4 h-4" />
                  Calculated Fields
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    schemaTab === 'calculated' ? 'bg-purple-500/30' : 'bg-[#1A1F2E]'
                  }`}>
                    {template.calculatedFields.length}
                  </span>
                </button>
              </div>
              
              {schemaTab === 'columns' && template.columns.length > 0 && (
                <div className="flex items-center gap-2">
                  {currentData && currentData.length > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={fetchAISuggestions}
                          disabled={isLoadingSuggestions}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-[#FF6B35]/20 hover:from-purple-500/30 hover:to-[#FF6B35]/30 text-purple-300 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isLoadingSuggestions ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <Wand2 className="w-4 h-4" />
                              AI Suggest
                            </>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="bg-[#1A1F2E] border border-purple-500/30 text-white p-2 max-w-xs">
                        <p className="text-xs">
                          {isLoadingSuggestions 
                            ? "AI is analyzing your data structure... 🧠"
                            : "Use AI to suggest column types and standardized names based on your data"}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => addColumn()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF6B35]/20 hover:bg-[#FF6B35]/30 text-[#FF6B35] rounded-lg text-sm transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add Column
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-[#1A1F2E] border border-[#FF6B35]/30 text-white p-2">
                      <p className="text-xs mb-1">Add a new column to your schema</p>
                      <div className="flex items-center gap-2 text-xs border-t border-[#FF6B35]/20 pt-1 mt-1">
                        <Keyboard className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-400">
                          {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+K
                        </span>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
              
              {schemaTab === 'calculated' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        setEditingField(null);
                        setShowFieldEditor(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Calculated Field
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-[#1A1F2E] border border-purple-500/30 text-white p-2">
                    <p className="text-xs mb-1">Create a formula to auto-calculate KPIs like CPA, CTR, ROAS</p>
                    <div className="flex items-center gap-2 text-xs border-t border-purple-500/20 pt-1 mt-1">
                      <Keyboard className="w-3 h-3 text-gray-400" />
                      <span className="text-gray-400">
                        {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+K
                      </span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            
            {/* Columns Tab Content */}
            {schemaTab === 'columns' && (
              <>
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
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                {currentData && currentData.length > 0 ? (
                  <>
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-[#FF6B35]/10 flex items-center justify-center mb-4">
                      <Wand2 className="w-10 h-10 text-purple-400" />
                    </div>
                    <p className="text-lg text-white font-medium mb-2">Let AI detect your columns</p>
                    <p className="text-sm text-gray-400 mb-4 text-center max-w-md">
                      We found {Object.keys(currentData[0] || {}).length} columns in your data. 
                      AI can automatically detect column types and suggest standardized names.
                    </p>
                    
                    {/* Sample data preview */}
                    <div className="w-full max-w-lg mb-6 bg-[#0D1117] rounded-xl border border-[#1A1F2E] overflow-hidden">
                      <div className="px-3 py-2 bg-[#1A1F2E]/50 border-b border-[#1A1F2E] flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-400">Sample from your data</span>
                      </div>
                      <div className="p-3 overflow-x-auto">
                        <div className="flex gap-2 flex-wrap">
                          {Object.keys(currentData[0] || {}).slice(0, 6).map((colName, idx) => (
                            <div key={idx} className="px-3 py-1.5 bg-[#1A1F2E] rounded-lg border border-[#2A2F3E]">
                              <div className="text-xs font-medium text-white mb-0.5">{colName}</div>
                              <div className="text-xs text-gray-500 truncate max-w-[100px]">
                                {String(currentData[0][colName] || '—')}
                              </div>
                            </div>
                          ))}
                          {Object.keys(currentData[0] || {}).length > 6 && (
                            <div className="px-3 py-1.5 bg-[#1A1F2E]/50 rounded-lg border border-dashed border-[#2A2F3E] flex items-center">
                              <span className="text-xs text-gray-500">
                                +{Object.keys(currentData[0] || {}).length - 6} more
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <button
                        onClick={fetchAISuggestions}
                        disabled={isLoadingSuggestions}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-[#FF6B35] hover:from-purple-600 hover:to-[#FF7B45] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-base font-medium transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105"
                      >
                        {isLoadingSuggestions ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-5 h-5" />
                            Auto-Detect Columns
                          </>
                        )}
                      </button>
                      <span className="text-gray-500 text-sm">or</span>
                      <button
                        onClick={() => addColumn()}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1F2E] hover:bg-[#252A3A] text-gray-300 rounded-xl text-sm font-medium transition-colors border border-[#2A2F3E]"
                      >
                        <Plus className="w-4 h-4" />
                        Add manually
                      </button>
                    </div>
                    
                    <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
                      <Lightbulb className="w-3 h-3" />
                      Tip: AI will suggest data types like currency, percentage, date based on your data values
                    </p>
                  </>
                ) : (
                  <>
                    <div className="relative mb-4">
                      <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#FF6B35]/20 to-[#FF8F35]/10 flex items-center justify-center">
                        <Columns3 className="w-12 h-12 text-[#FF6B35]/60" />
                      </div>
                      <div className="absolute -right-2 -bottom-2 w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-[#FF6B35]/10 flex items-center justify-center border border-purple-500/30">
                        <Plus className="w-5 h-5 text-purple-400" />
                      </div>
                    </div>
                    <p className="text-base text-white font-medium mb-1">No columns defined yet</p>
                    <p className="text-sm text-gray-400 mb-6 text-center max-w-md">
                      Add your first column to start building your data schema, or upload data first to use AI auto-detection.
                    </p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => addColumn()}
                          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#FF6B35] to-[#FF8F35] hover:from-[#FF7B45] hover:to-[#FF9F45] text-white rounded-xl text-base font-medium transition-all shadow-lg shadow-[#FF6B35]/25 hover:shadow-[#FF6B35]/40 hover:scale-105"
                        >
                          <Plus className="w-5 h-5" />
                          Add Column
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="bg-[#1A1F2E] border border-[#FF6B35]/30 text-white p-2">
                        <div className="flex items-center gap-2 text-xs">
                          <Keyboard className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-400">
                            {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+K
                          </span>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </>
                )}
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
              </>
            )}
            
            {/* Calculated Fields Tab Content */}
            {schemaTab === 'calculated' && (
              <CalculatedFieldsPanel
                fields={template.calculatedFields}
                columns={template.columns}
                sampleData={currentData}
                onEdit={(field) => {
                  setEditingField(field);
                  setShowFieldEditor(true);
                }}
                showEditor={showFieldEditor}
                editingField={editingField}
                onCloseEditor={() => {
                  setShowFieldEditor(false);
                  setEditingField(null);
                }}
              />
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
        
        {/* Template Summary Bar */}
        <div className="px-6 py-3 bg-[#0D1117] border-t border-[#1A1F2E]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {/* Columns Status */}
              <div className="flex items-center gap-2">
                {template.columns.length > 0 ? (
                  <div className="w-5 h-5 rounded-full bg-[#22C55E]/20 flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-[#22C55E]" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <AlertCircle className="w-3 h-3 text-yellow-500" />
                  </div>
                )}
                <span className="text-sm text-gray-400">
                  <span className="font-medium text-white">{template.columns.length}</span> columns
                </span>
              </div>
              
              {/* Cleaning Rules Status */}
              <div className="flex items-center gap-2">
                {template.cleaningPipeline.filter(s => s.enabled).length > 0 ? (
                  <div className="w-5 h-5 rounded-full bg-[#22C55E]/20 flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-[#22C55E]" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gray-500/20 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-gray-500" />
                  </div>
                )}
                <span className="text-sm text-gray-400">
                  <span className="font-medium text-white">{template.cleaningPipeline.filter(s => s.enabled).length}</span> cleaning rules
                </span>
              </div>
              
              {/* Calculated Fields */}
              {template.calculatedFields.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Calculator className="w-3 h-3 text-purple-400" />
                  </div>
                  <span className="text-sm text-gray-400">
                    <span className="font-medium text-white">
                      {template.calculatedFields.filter(f => f.isActive).length}/{template.calculatedFields.length}
                    </span> calculated field{template.calculatedFields.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              
              {/* Required Columns */}
              {template.columns.filter(c => c.isRequired).length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#FF6B35]/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-[#FF6B35]">!</span>
                  </div>
                  <span className="text-sm text-gray-400">
                    <span className="font-medium text-white">{template.columns.filter(c => c.isRequired).length}</span> required
                  </span>
                </div>
              )}
            </div>
            
            {/* Preview Prompt */}
            {((currentData && currentData.length > 0) || template.id) && template.columns.length > 0 && (
              <button
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                <Eye className="w-4 h-4" />
                <span>Preview to see how your data will be transformed</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
            
            {/* Keyboard Shortcuts Hint */}
            <div className="flex items-center gap-4 text-xs text-gray-500 ml-auto">
              <Keyboard className="w-3 h-3" />
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#1A1F2E] rounded border border-[#2A2F3E]">
                  {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+S
                </kbd>
                <span>Save</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#1A1F2E] rounded border border-[#2A2F3E]">
                  {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+P
                </kbd>
                <span>Preview</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#1A1F2E] rounded border border-[#2A2F3E]">
                  {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+K
                </kbd>
                <span>Add</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#1A1F2E] rounded border border-[#2A2F3E]">Esc</kbd>
                <span>Close</span>
              </span>
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

      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent className="bg-[#0A0E1A] border-[#1A1F2E]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              Are you sure you want to reset?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-gray-400 space-y-3">
                <p>This will discard all unsaved changes to:</p>
                <ul className="space-y-2 ml-1">
                  {template.columns.length > 0 && (
                    <li className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]" />
                      <span>Column schema ({template.columns.length} column{template.columns.length !== 1 ? 's' : ''})</span>
                    </li>
                  )}
                  {template.calculatedFields.length > 0 && (
                    <li className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                      <span>Calculated fields ({template.calculatedFields.filter(f => f.isActive).length}/{template.calculatedFields.length} active)</span>
                    </li>
                  )}
                  {template.cleaningPipeline.filter(s => s.enabled).length > 0 && (
                    <li className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]" />
                      <span>Cleaning pipeline rules ({template.cleaningPipeline.filter(s => s.enabled).length} active)</span>
                    </li>
                  )}
                  <li className="flex items-center gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]" />
                    <span>Template settings (name, description, scope)</span>
                  </li>
                </ul>
                <p className="text-xs text-gray-500 pt-1">
                  This action cannot be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#1A1F2E] text-gray-300 hover:bg-[#252A3A] hover:text-white border-[#2A2F3E]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                reset();
                setShowResetConfirm(false);
                toast.info('Template reset to original state');
              }}
              className="bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 border border-red-500/30"
            >
              Yes, Reset Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AnimatePresence>
  );
}
