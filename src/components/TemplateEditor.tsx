import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Plus, Trash2, GripVertical, ChevronDown, ChevronRight, 
  Settings, Columns3, Sparkles, FileText, Save, RotateCcw,
  AlertCircle
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
import { useTemplateEditor, TemplateColumn, CleaningStep } from '../contexts/TemplateEditorContext';
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
  arrayMove,
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

interface SortableColumnRowProps {
  column: TemplateColumn;
  onUpdate: (updates: Partial<TemplateColumn>) => void;
  onDelete: () => void;
  onToggleExpand: () => void;
  isExpanded: boolean;
  onAddAlias: (alias: string) => void;
  onRemoveAlias: (alias: string) => void;
}

function SortableColumnRow({ 
  column, 
  onUpdate, 
  onDelete, 
  onToggleExpand, 
  isExpanded,
  onAddAlias,
  onRemoveAlias,
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
    <div ref={setNodeRef} style={style}>
      <div className={`flex items-center gap-2 p-3 bg-[#0A0E1A] rounded-lg border ${isExpanded ? 'border-[#FF6B35]/50' : 'border-[#1A1F2E]'} hover:border-[#FF6B35]/30 transition-colors group`}>
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
          onClick={onToggleExpand}
          className="p-1.5 text-gray-400 hover:text-[#FF6B35] transition-colors"
          title="Validation rules & aliases"
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        
        <button
          onClick={onDelete}
          className="p-1.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ml-8 mt-2 p-4 bg-[#0A0E1A]/50 rounded-lg border border-[#1A1F2E] space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Format Pattern</label>
                  <input
                    type="text"
                    value={column.validationRules?.format || ''}
                    onChange={(e) => onUpdate({ 
                      validationRules: { ...column.validationRules, format: e.target.value } 
                    })}
                    placeholder="e.g., $X.XX or MM/DD/YYYY"
                    className="w-full px-2 py-1.5 bg-[#1A1F2E] border border-transparent focus:border-[#FF6B35]/50 rounded text-sm text-white placeholder:text-gray-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Regex Pattern</label>
                  <input
                    type="text"
                    value={column.validationRules?.pattern || ''}
                    onChange={(e) => onUpdate({ 
                      validationRules: { ...column.validationRules, pattern: e.target.value } 
                    })}
                    placeholder="^[A-Z]+$"
                    className="w-full px-2 py-1.5 bg-[#1A1F2E] border border-transparent focus:border-[#FF6B35]/50 rounded text-sm text-white placeholder:text-gray-500 focus:outline-none"
                  />
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
          </motion.div>
        )}
      </AnimatePresence>
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
}

export function TemplateEditor({ currentData }: TemplateEditorProps) {
  const {
    template,
    isDirty,
    errors,
    isOpen,
    isSaving,
    updateTemplate,
    addColumn,
    updateColumn,
    deleteColumn,
    reorderColumns,
    addColumnAlias,
    removeColumnAlias,
    updateCleaningStep,
    toggleCleaningStep,
    closeEditor,
    save,
    reset,
  } = useTemplateEditor();

  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set());

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

  const toggleColumnExpand = (columnId: string) => {
    setExpandedColumns(prev => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      return next;
    });
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
        onClick={closeEditor}
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-4 z-50 bg-[#0A0E1A] rounded-xl border border-[#1A1F2E] overflow-hidden flex flex-col"
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
                  value={template.sourceType || ''} 
                  onValueChange={(value) => updateTemplate({ sourceType: value as any || null })}
                >
                  <SelectTrigger className="w-full bg-[#1A1F2E] border-transparent">
                    <SelectValue placeholder="Any source type" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1F2E] border-[#FF6B35]/30">
                    <SelectItem value="" className="text-white hover:bg-[#FF6B35]/20">
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
              
              <button
                onClick={() => addColumn()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF6B35]/20 hover:bg-[#FF6B35]/30 text-[#FF6B35] rounded-lg text-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Column
              </button>
            </div>
            
            <div className="mb-3 grid grid-cols-[40px_1fr_1fr_100px_100px_32px_32px] gap-2 px-3 text-xs text-gray-500 font-medium">
              <div></div>
              <div>Canonical Name</div>
              <div>Display Name</div>
              <div>Data Type</div>
              <div>Required</div>
              <div></div>
              <div></div>
            </div>
            
            {template.columns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Columns3 className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">No columns defined yet</p>
                <p className="text-xs">Click "Add Column" to start building your schema</p>
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
                  <div className="space-y-2">
                    {template.columns.map(column => (
                      <SortableColumnRow
                        key={column.id}
                        column={column}
                        onUpdate={(updates) => updateColumn(column.id, updates)}
                        onDelete={() => deleteColumn(column.id)}
                        onToggleExpand={() => toggleColumnExpand(column.id)}
                        isExpanded={expandedColumns.has(column.id)}
                        onAddAlias={(alias) => addColumnAlias(column.id, alias)}
                        onRemoveAlias={(alias) => removeColumnAlias(column.id, alias)}
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
    </AnimatePresence>
  );
}
