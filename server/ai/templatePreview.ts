import type { TemplateColumn, CleaningStep } from '../../src/contexts/TemplateEditorContext';

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

export interface PreviewChange {
  rowIndex: number;
  columnName: string;
  originalValue: any;
  cleanedValue: any;
  changeType: 'formatted' | 'type_converted' | 'cleaned' | 'filled' | 'unchanged';
}

export interface PreviewError {
  rowIndex: number;
  columnName: string;
  errorType: 'validation_failed' | 'type_mismatch' | 'required_missing' | 'format_invalid';
  message: string;
  originalValue: any;
}

export interface ColumnStats {
  changesCount: number;
  errorsCount: number;
}

export interface PreviewStats {
  totalRows: number;
  totalChanges: number;
  totalErrors: number;
  columnStats: Record<string, ColumnStats>;
}

export interface PreviewResult {
  originalData: any[];
  cleanedData: any[];
  changes: PreviewChange[];
  errors: PreviewError[];
  stats: PreviewStats;
}

function applyCleaningStep(
  data: Record<string, any>[],
  step: CleaningStep
): { data: Record<string, any>[]; stepChanges: Map<string, { original: any; cleaned: any; type: PreviewChange['changeType'] }> } {
  if (!step.enabled) {
    return { data, stepChanges: new Map() };
  }

  const targetColumns = step.config?.targetColumns;
  const stepChanges = new Map<string, { original: any; cleaned: any; type: PreviewChange['changeType'] }>();

  const recordChange = (rowIndex: number, column: string, original: any, cleaned: any, type: PreviewChange['changeType']) => {
    if (original !== cleaned) {
      stepChanges.set(`${rowIndex}-${column}`, { original, cleaned, type });
    }
  };

  let result: Record<string, any>[];

  switch (step.type) {
    case 'remove_commas':
      result = data.map((row, rowIndex) => {
        const newRow = { ...row };
        for (const [key, value] of Object.entries(newRow)) {
          if (targetColumns && !targetColumns.includes(key)) continue;
          if (typeof value === 'string' && value.includes(',')) {
            const cleaned = value.replace(/,/g, '');
            const num = parseFloat(cleaned);
            if (!isNaN(num)) {
              newRow[key] = num;
              recordChange(rowIndex, key, value, num, 'type_converted');
            }
          }
        }
        return newRow;
      });
      break;

    case 'strip_currency':
      result = data.map((row, rowIndex) => {
        const newRow = { ...row };
        for (const [key, value] of Object.entries(newRow)) {
          if (targetColumns && !targetColumns.includes(key)) continue;
          if (typeof value === 'string') {
            const hasCurrency = /[$€£¥₹₽₩฿]/.test(value);
            if (hasCurrency) {
              const cleaned = value.replace(/[$€£¥₹₽₩฿]/g, '').replace(/,/g, '').trim();
              const num = parseFloat(cleaned);
              if (!isNaN(num)) {
                newRow[key] = num;
                recordChange(rowIndex, key, value, num, 'type_converted');
              }
            }
          }
        }
        return newRow;
      });
      break;

    case 'convert_percentage':
      const mode = step.config?.percentageMode || 'decimal';
      result = data.map((row, rowIndex) => {
        const newRow = { ...row };
        for (const [key, value] of Object.entries(newRow)) {
          if (targetColumns && !targetColumns.includes(key)) continue;
          if (typeof value === 'string' && value.includes('%')) {
            const cleaned = value.replace(/%/g, '').trim();
            const num = parseFloat(cleaned);
            if (!isNaN(num)) {
              const convertedValue = mode === 'decimal' ? num / 100 : num;
              newRow[key] = convertedValue;
              recordChange(rowIndex, key, value, convertedValue, 'type_converted');
            }
          }
        }
        return newRow;
      });
      break;

    case 'trim_whitespace':
      result = data.map((row, rowIndex) => {
        const newRow = { ...row };
        for (const [key, value] of Object.entries(newRow)) {
          if (targetColumns && !targetColumns.includes(key)) continue;
          if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed !== value) {
              newRow[key] = trimmed;
              recordChange(rowIndex, key, value, trimmed, 'formatted');
            }
          }
        }
        return newRow;
      });
      break;

    case 'convert_date_format':
      result = data.map((row, rowIndex) => {
        const newRow = { ...row };
        for (const [key, value] of Object.entries(newRow)) {
          if (targetColumns && !targetColumns.includes(key)) continue;
          if (typeof value === 'string' && value) {
            const parsed = new Date(value);
            if (!isNaN(parsed.getTime())) {
              const isoDate = parsed.toISOString();
              if (isoDate !== value) {
                newRow[key] = isoDate;
                recordChange(rowIndex, key, value, isoDate, 'formatted');
              }
            }
          }
        }
        return newRow;
      });
      break;

    case 'remove_duplicates':
      const seen = new Set<string>();
      result = data.filter((row, rowIndex) => {
        const key = JSON.stringify(row);
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
      break;

    case 'fill_empty':
      const fillValue = step.config?.fillValue ?? null;
      result = data.map((row, rowIndex) => {
        const newRow = { ...row };
        for (const [key, value] of Object.entries(newRow)) {
          if (targetColumns && !targetColumns.includes(key)) continue;
          if (value === null || value === undefined || value === '') {
            newRow[key] = fillValue;
            recordChange(rowIndex, key, value, fillValue, 'filled');
          }
        }
        return newRow;
      });
      break;

    default:
      result = data;
  }

  return { data: result, stepChanges };
}

function validateValue(
  value: any,
  column: TemplateColumn,
  rowIndex: number
): PreviewError | null {
  if (column.isRequired && (value === null || value === undefined || value === '')) {
    return {
      rowIndex,
      columnName: column.canonicalName,
      errorType: 'required_missing',
      message: `Required field "${column.displayName || column.canonicalName}" is empty`,
      originalValue: value
    };
  }

  if (value === null || value === undefined || value === '') {
    return null;
  }

  switch (column.dataType) {
    case 'integer':
    case 'decimal':
    case 'currency':
    case 'percentage': {
      const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[,$%]/g, ''));
      if (isNaN(numValue)) {
        return {
          rowIndex,
          columnName: column.canonicalName,
          errorType: 'type_mismatch',
          message: `Value "${value}" is not a valid number for ${column.displayName || column.canonicalName}`,
          originalValue: value
        };
      }

      if (column.validationRules?.min !== undefined && numValue < column.validationRules.min) {
        return {
          rowIndex,
          columnName: column.canonicalName,
          errorType: 'validation_failed',
          message: `Value ${numValue} is below minimum ${column.validationRules.min}`,
          originalValue: value
        };
      }

      if (column.validationRules?.max !== undefined && numValue > column.validationRules.max) {
        return {
          rowIndex,
          columnName: column.canonicalName,
          errorType: 'validation_failed',
          message: `Value ${numValue} exceeds maximum ${column.validationRules.max}`,
          originalValue: value
        };
      }
      break;
    }

    case 'date': {
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) {
        return {
          rowIndex,
          columnName: column.canonicalName,
          errorType: 'type_mismatch',
          message: `Value "${value}" is not a valid date`,
          originalValue: value
        };
      }
      break;
    }

    case 'boolean': {
      const strValue = String(value).toLowerCase();
      if (!['true', 'false', 'yes', 'no', '1', '0'].includes(strValue)) {
        return {
          rowIndex,
          columnName: column.canonicalName,
          errorType: 'type_mismatch',
          message: `Value "${value}" is not a valid boolean`,
          originalValue: value
        };
      }
      break;
    }

    case 'text': {
      if (column.validationRules?.maxLength && String(value).length > column.validationRules.maxLength) {
        return {
          rowIndex,
          columnName: column.canonicalName,
          errorType: 'validation_failed',
          message: `Value exceeds maximum length of ${column.validationRules.maxLength}`,
          originalValue: value
        };
      }

      if (column.validationRules?.pattern) {
        try {
          const regex = new RegExp(column.validationRules.pattern);
          if (!regex.test(String(value))) {
            return {
              rowIndex,
              columnName: column.canonicalName,
              errorType: 'format_invalid',
              message: `Value doesn't match required pattern`,
              originalValue: value
            };
          }
        } catch (e) {
        }
      }
      break;
    }
  }

  if (column.validationRules?.allowedValues && column.validationRules.allowedValues.length > 0) {
    if (!column.validationRules.allowedValues.includes(String(value))) {
      return {
        rowIndex,
        columnName: column.canonicalName,
        errorType: 'validation_failed',
        message: `Value "${value}" is not in the allowed values list`,
        originalValue: value
      };
    }
  }

  return null;
}

export async function previewTemplateApplication(
  templateData: TemplateData,
  sampleData: any[]
): Promise<PreviewResult> {
  if (!sampleData || sampleData.length === 0) {
    return {
      originalData: [],
      cleanedData: [],
      changes: [],
      errors: [],
      stats: {
        totalRows: 0,
        totalChanges: 0,
        totalErrors: 0,
        columnStats: {}
      }
    };
  }

  const originalData = sampleData.map(row => ({ ...row }));
  let cleanedData = sampleData.map(row => ({ ...row }));
  const allChanges: PreviewChange[] = [];
  const changesMap = new Map<string, PreviewChange>();

  for (const step of templateData.cleaningPipeline) {
    const { data: newData, stepChanges } = applyCleaningStep(cleanedData, step);
    cleanedData = newData;

    for (const [key, change] of stepChanges) {
      const [rowIndex, columnName] = key.split('-');
      const rowIdx = parseInt(rowIndex, 10);
      
      const existingKey = `${rowIdx}-${columnName}`;
      if (!changesMap.has(existingKey)) {
        changesMap.set(existingKey, {
          rowIndex: rowIdx,
          columnName,
          originalValue: change.original,
          cleanedValue: change.cleaned,
          changeType: change.type
        });
      } else {
        const existing = changesMap.get(existingKey)!;
        existing.cleanedValue = change.cleaned;
        if (change.type === 'type_converted' || existing.changeType === 'unchanged') {
          existing.changeType = change.type;
        }
      }
    }
  }

  for (const change of changesMap.values()) {
    allChanges.push(change);
  }

  const errors: PreviewError[] = [];
  const columnMap = new Map(templateData.columns.map(c => [c.canonicalName, c]));
  const aliasMap = new Map<string, TemplateColumn>();
  
  for (const column of templateData.columns) {
    if (column.aliases) {
      for (const alias of column.aliases) {
        aliasMap.set(alias.toLowerCase(), column);
      }
    }
  }

  for (let rowIndex = 0; rowIndex < cleanedData.length; rowIndex++) {
    const row = cleanedData[rowIndex];
    
    for (const [key, value] of Object.entries(row)) {
      const column = columnMap.get(key) || aliasMap.get(key.toLowerCase());
      if (column) {
        const error = validateValue(value, column, rowIndex);
        if (error) {
          errors.push(error);
        }
      }
    }

    for (const column of templateData.columns) {
      if (column.isRequired) {
        const hasValue = Object.keys(row).some(key => {
          if (key === column.canonicalName) return true;
          if (column.aliases?.includes(key)) return true;
          return false;
        });
        
        if (!hasValue) {
          errors.push({
            rowIndex,
            columnName: column.canonicalName,
            errorType: 'required_missing',
            message: `Required field "${column.displayName || column.canonicalName}" is missing`,
            originalValue: undefined
          });
        }
      }
    }
  }

  const columnStats: Record<string, ColumnStats> = {};
  
  for (const change of allChanges) {
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
    originalData,
    cleanedData,
    changes: allChanges,
    errors,
    stats: {
      totalRows: originalData.length,
      totalChanges: allChanges.length,
      totalErrors: errors.length,
      columnStats
    }
  };
}
