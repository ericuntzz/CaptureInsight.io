import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface ColumnValidationRules {
  format?: string;
  min?: number;
  max?: number;
  maxLength?: number;
  pattern?: string;
  allowedValues?: string[];
}

export interface TemplateColumn {
  id: string;
  canonicalName: string;
  displayName: string;
  position: number;
  dataType: 'currency' | 'percentage' | 'integer' | 'decimal' | 'date' | 'text' | 'boolean';
  isRequired: boolean;
  validationRules?: ColumnValidationRules;
  aliases?: string[];
}

export interface CleaningStep {
  id: string;
  type: 'remove_commas' | 'strip_currency' | 'convert_percentage' | 'trim_whitespace' | 'convert_date_format' | 'remove_duplicates' | 'fill_empty' | 'custom';
  enabled: boolean;
  config?: {
    targetColumns?: string[];
    fromFormat?: string;
    toFormat?: string;
    percentageMode?: 'decimal' | 'whole';
    fillValue?: string;
    customRule?: string;
  };
}

export interface TemplateData {
  id?: string;
  name: string;
  description: string;
  scope: 'workspace' | 'space';
  sourceType?: 'google_ads' | 'meta_ads' | 'ga4' | 'google_sheets' | 'csv' | 'custom' | null;
  aiPromptHints?: string;
  columns: TemplateColumn[];
  cleaningPipeline: CleaningStep[];
  columnAliases: Record<string, string[]>;
}

interface ValidationError {
  field: string;
  message: string;
}

interface TemplateEditorContextValue {
  template: TemplateData;
  isDirty: boolean;
  errors: ValidationError[];
  isOpen: boolean;
  isSaving: boolean;
  setTemplate: (template: TemplateData) => void;
  updateTemplate: (updates: Partial<TemplateData>) => void;
  addColumn: (column?: Partial<TemplateColumn>) => void;
  updateColumn: (columnId: string, updates: Partial<TemplateColumn>) => void;
  deleteColumn: (columnId: string) => void;
  reorderColumns: (fromIndex: number, toIndex: number) => void;
  addColumnAlias: (columnId: string, alias: string) => void;
  removeColumnAlias: (columnId: string, alias: string) => void;
  updateCleaningStep: (stepId: string, updates: Partial<CleaningStep>) => void;
  toggleCleaningStep: (stepId: string) => void;
  validate: () => boolean;
  openEditor: (initialData?: Partial<TemplateData>) => void;
  closeEditor: () => void;
  save: () => Promise<void>;
  reset: () => void;
}

const defaultCleaningSteps: CleaningStep[] = [
  { id: 'remove_commas', type: 'remove_commas', enabled: true },
  { id: 'strip_currency', type: 'strip_currency', enabled: true },
  { id: 'convert_percentage', type: 'convert_percentage', enabled: false, config: { percentageMode: 'decimal' } },
  { id: 'trim_whitespace', type: 'trim_whitespace', enabled: true },
  { id: 'convert_date_format', type: 'convert_date_format', enabled: false, config: { fromFormat: 'MM/DD/YYYY', toFormat: 'YYYY-MM-DD' } },
  { id: 'remove_duplicates', type: 'remove_duplicates', enabled: false },
  { id: 'fill_empty', type: 'fill_empty', enabled: false, config: { fillValue: '' } },
];

const createDefaultTemplate = (): TemplateData => ({
  name: '',
  description: '',
  scope: 'workspace',
  sourceType: null,
  aiPromptHints: '',
  columns: [],
  cleaningPipeline: [...defaultCleaningSteps],
  columnAliases: {},
});

const TemplateEditorContext = createContext<TemplateEditorContextValue | null>(null);

export function TemplateEditorProvider({ children }: { children: React.ReactNode }) {
  const [template, setTemplateState] = useState<TemplateData>(createDefaultTemplate());
  const [originalTemplate, setOriginalTemplate] = useState<TemplateData | null>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = useMemo(() => {
    if (!originalTemplate) return false;
    return JSON.stringify(template) !== JSON.stringify(originalTemplate);
  }, [template, originalTemplate]);

  const setTemplate = useCallback((newTemplate: TemplateData) => {
    setTemplateState(newTemplate);
  }, []);

  const updateTemplate = useCallback((updates: Partial<TemplateData>) => {
    setTemplateState(prev => ({ ...prev, ...updates }));
  }, []);

  const addColumn = useCallback((column?: Partial<TemplateColumn>) => {
    const newColumn: TemplateColumn = {
      id: `col-${Date.now()}`,
      canonicalName: column?.canonicalName || '',
      displayName: column?.displayName || '',
      position: template.columns.length,
      dataType: column?.dataType || 'text',
      isRequired: column?.isRequired ?? false,
      validationRules: column?.validationRules || {},
      aliases: column?.aliases || [],
    };
    setTemplateState(prev => ({
      ...prev,
      columns: [...prev.columns, newColumn],
    }));
  }, [template.columns.length]);

  const updateColumn = useCallback((columnId: string, updates: Partial<TemplateColumn>) => {
    setTemplateState(prev => ({
      ...prev,
      columns: prev.columns.map(col =>
        col.id === columnId ? { ...col, ...updates } : col
      ),
    }));
  }, []);

  const deleteColumn = useCallback((columnId: string) => {
    setTemplateState(prev => ({
      ...prev,
      columns: prev.columns.filter(col => col.id !== columnId)
        .map((col, idx) => ({ ...col, position: idx })),
      columnAliases: Object.fromEntries(
        Object.entries(prev.columnAliases).filter(([key]) => key !== columnId)
      ),
    }));
  }, []);

  const reorderColumns = useCallback((fromIndex: number, toIndex: number) => {
    setTemplateState(prev => {
      const newColumns = [...prev.columns];
      const [removed] = newColumns.splice(fromIndex, 1);
      newColumns.splice(toIndex, 0, removed);
      return {
        ...prev,
        columns: newColumns.map((col, idx) => ({ ...col, position: idx })),
      };
    });
  }, []);

  const addColumnAlias = useCallback((columnId: string, alias: string) => {
    if (!alias.trim()) return;
    setTemplateState(prev => {
      const column = prev.columns.find(c => c.id === columnId);
      if (!column) return prev;
      
      const currentAliases = column.aliases || [];
      if (currentAliases.includes(alias.trim())) return prev;
      
      return {
        ...prev,
        columns: prev.columns.map(col =>
          col.id === columnId
            ? { ...col, aliases: [...currentAliases, alias.trim()] }
            : col
        ),
      };
    });
  }, []);

  const removeColumnAlias = useCallback((columnId: string, alias: string) => {
    setTemplateState(prev => ({
      ...prev,
      columns: prev.columns.map(col =>
        col.id === columnId
          ? { ...col, aliases: (col.aliases || []).filter(a => a !== alias) }
          : col
      ),
    }));
  }, []);

  const updateCleaningStep = useCallback((stepId: string, updates: Partial<CleaningStep>) => {
    setTemplateState(prev => ({
      ...prev,
      cleaningPipeline: prev.cleaningPipeline.map(step =>
        step.id === stepId ? { ...step, ...updates } : step
      ),
    }));
  }, []);

  const toggleCleaningStep = useCallback((stepId: string) => {
    setTemplateState(prev => ({
      ...prev,
      cleaningPipeline: prev.cleaningPipeline.map(step =>
        step.id === stepId ? { ...step, enabled: !step.enabled } : step
      ),
    }));
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: ValidationError[] = [];
    
    if (!template.name.trim()) {
      newErrors.push({ field: 'name', message: 'Template name is required' });
    }
    
    if (template.columns.length === 0) {
      newErrors.push({ field: 'columns', message: 'At least one column is required' });
    }
    
    template.columns.forEach((col, idx) => {
      if (!col.canonicalName.trim()) {
        newErrors.push({ field: `column-${idx}-canonicalName`, message: `Column ${idx + 1} needs a canonical name` });
      }
      if (!col.displayName.trim()) {
        newErrors.push({ field: `column-${idx}-displayName`, message: `Column ${idx + 1} needs a display name` });
      }
    });
    
    setErrors(newErrors);
    return newErrors.length === 0;
  }, [template]);

  const openEditor = useCallback((initialData?: Partial<TemplateData>) => {
    const newTemplate = initialData
      ? { ...createDefaultTemplate(), ...initialData }
      : createDefaultTemplate();
    setTemplateState(newTemplate);
    setOriginalTemplate(newTemplate);
    setErrors([]);
    setIsOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setIsOpen(false);
    setTemplateState(createDefaultTemplate());
    setOriginalTemplate(null);
    setErrors([]);
  }, []);

  const save = useCallback(async () => {
    if (!validate()) return;
    
    setIsSaving(true);
    try {
      const response = await fetch('/api/templates', {
        method: template.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...template,
          columnSchema: { columns: template.columns },
          cleaningPipeline: { steps: template.cleaningPipeline },
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save template');
      }
      
      closeEditor();
    } catch (error) {
      console.error('Failed to save template:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [template, validate, closeEditor]);

  const reset = useCallback(() => {
    if (originalTemplate) {
      setTemplateState(originalTemplate);
    } else {
      setTemplateState(createDefaultTemplate());
    }
    setErrors([]);
  }, [originalTemplate]);

  const value: TemplateEditorContextValue = {
    template,
    isDirty,
    errors,
    isOpen,
    isSaving,
    setTemplate,
    updateTemplate,
    addColumn,
    updateColumn,
    deleteColumn,
    reorderColumns,
    addColumnAlias,
    removeColumnAlias,
    updateCleaningStep,
    toggleCleaningStep,
    validate,
    openEditor,
    closeEditor,
    save,
    reset,
  };

  return (
    <TemplateEditorContext.Provider value={value}>
      {children}
    </TemplateEditorContext.Provider>
  );
}

export function useTemplateEditor() {
  const context = useContext(TemplateEditorContext);
  if (!context) {
    throw new Error('useTemplateEditor must be used within a TemplateEditorProvider');
  }
  return context;
}
