interface CalculatedField {
  id: string;
  name: string;
  description?: string;
  expression: string;
  outputType: 'currency' | 'percentage' | 'number' | 'integer';
  formatConfig?: {
    currencyCode?: string;
    decimalPlaces?: number;
    percentageMode?: 'decimal' | 'whole';
  };
  position: number;
  isActive: boolean;
}

interface FormulaValidationResult {
  isValid: boolean;
  error?: string;
  referencedColumns: string[];
}

interface EvaluationResult {
  value: number | null;
  formattedValue: string;
  error?: string;
}

interface RowContext {
  [columnName: string]: number | string | null;
}

const SUPPORTED_FUNCTIONS = ['SUM', 'AVG', 'MIN', 'MAX', 'COUNT', 'IF', 'ROUND', 'ABS', 'CEIL', 'FLOOR'];

export function extractColumnReferences(expression: string): string[] {
  const columnRefPattern = /\[([^\]]+)\]/g;
  const references: string[] = [];
  let match;
  
  while ((match = columnRefPattern.exec(expression)) !== null) {
    if (!references.includes(match[1])) {
      references.push(match[1]);
    }
  }
  
  return references;
}

export function validateFormula(expression: string, availableColumns: string[]): FormulaValidationResult {
  if (!expression || !expression.trim()) {
    return { isValid: false, error: 'Formula is required', referencedColumns: [] };
  }
  
  const referencedColumns = extractColumnReferences(expression);
  
  if (referencedColumns.length === 0) {
    return { 
      isValid: false, 
      error: 'Formula must reference at least one column using [Column Name] syntax', 
      referencedColumns: [] 
    };
  }
  
  const missingColumns = referencedColumns.filter(col => !availableColumns.includes(col));
  if (missingColumns.length > 0) {
    return { 
      isValid: false, 
      error: `Unknown column(s): ${missingColumns.map(c => `"${c}"`).join(', ')}`, 
      referencedColumns 
    };
  }
  
  const sanitized = expression.replace(/\[([^\]]+)\]/g, '1');
  
  const functionPattern = new RegExp(`\\b(${SUPPORTED_FUNCTIONS.join('|')})\\b`, 'gi');
  const withoutFunctions = sanitized.replace(functionPattern, '');
  
  const validChars = /^[\d\s+\-*/().,:?<>=!&|]+$/;
  if (!validChars.test(withoutFunctions)) {
    return { 
      isValid: false, 
      error: 'Invalid characters in formula. Use +, -, *, /, parentheses, and column references.', 
      referencedColumns 
    };
  }
  
  const openParens = (expression.match(/\(/g) || []).length;
  const closeParens = (expression.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    return { 
      isValid: false, 
      error: 'Unbalanced parentheses in formula.', 
      referencedColumns 
    };
  }
  
  return { isValid: true, referencedColumns };
}

function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  
  if (typeof value === 'string') {
    const cleaned = value
      .replace(/[$€£¥₹,]/g, '')
      .replace(/%$/, '')
      .trim();
    
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  
  return null;
}

function evaluateExpression(expression: string, context: RowContext): number | null {
  try {
    let evalExpression = expression;
    
    const columnRefs = expression.match(/\[([^\]]+)\]/g) || [];
    for (const ref of columnRefs) {
      const columnName = ref.slice(1, -1);
      const value = parseNumber(context[columnName]);
      
      if (value === null) {
        return null;
      }
      
      evalExpression = evalExpression.replace(ref, value.toString());
    }
    
    evalExpression = evalExpression.replace(/\bABS\s*\(/gi, 'Math.abs(');
    evalExpression = evalExpression.replace(/\bROUND\s*\(/gi, 'Math.round(');
    evalExpression = evalExpression.replace(/\bCEIL\s*\(/gi, 'Math.ceil(');
    evalExpression = evalExpression.replace(/\bFLOOR\s*\(/gi, 'Math.floor(');
    evalExpression = evalExpression.replace(/\bMIN\s*\(/gi, 'Math.min(');
    evalExpression = evalExpression.replace(/\bMAX\s*\(/gi, 'Math.max(');
    
    evalExpression = evalExpression.replace(/\bIF\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi, '(($1) ? ($2) : ($3))');
    
    if (!/^[\d\s+\-*/().?:,<>=!&|Math.absceilfloorminmaxround]+$/i.test(evalExpression)) {
      console.warn('Potentially unsafe formula expression:', evalExpression);
      return null;
    }
    
    const result = new Function(`return ${evalExpression}`)();
    
    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
      return null;
    }
    
    return result;
  } catch (error) {
    console.error('Formula evaluation error:', error);
    return null;
  }
}

export function evaluateFormula(field: CalculatedField, rowData: RowContext): EvaluationResult {
  if (!field.isActive) {
    return { value: null, formattedValue: '-', error: 'Field is inactive' };
  }
  
  const value = evaluateExpression(field.expression, rowData);
  
  if (value === null) {
    return { value: null, formattedValue: '-', error: 'Could not evaluate (missing or invalid data)' };
  }
  
  const formattedValue = formatValue(value, field.outputType, field.formatConfig);
  
  return { value, formattedValue };
}

function formatValue(
  value: number, 
  outputType: CalculatedField['outputType'], 
  config?: CalculatedField['formatConfig']
): string {
  const decimals = config?.decimalPlaces ?? 2;
  
  switch (outputType) {
    case 'currency': {
      const currencyCode = config?.currencyCode || 'USD';
      try {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currencyCode,
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(value);
      } catch {
        return `$${value.toFixed(decimals)}`;
      }
    }
    
    case 'percentage': {
      const percentValue = config?.percentageMode === 'whole' ? value : value * 100;
      return `${percentValue.toFixed(decimals)}%`;
    }
    
    case 'integer':
      return Math.round(value).toLocaleString('en-US');
    
    case 'number':
    default:
      return value.toFixed(decimals);
  }
}

export function evaluateCalculatedFields(
  fields: CalculatedField[],
  data: Record<string, any>[]
): { data: Record<string, any>[]; errors: Array<{ row: number; field: string; error: string }> } {
  const activeFields = fields.filter(f => f.isActive).sort((a, b) => a.position - b.position);
  const errors: Array<{ row: number; field: string; error: string }> = [];
  
  const processedData = data.map((row, rowIndex) => {
    const newRow = { ...row };
    
    for (const field of activeFields) {
      const result = evaluateFormula(field, row);
      
      if (result.error && result.value === null) {
        errors.push({ row: rowIndex, field: field.name, error: result.error });
      }
      
      newRow[field.name] = result.formattedValue;
      newRow[`${field.name}_raw`] = result.value;
    }
    
    return newRow;
  });
  
  return { data: processedData, errors };
}

export function previewCalculatedField(
  field: CalculatedField,
  sampleData: Record<string, any>[]
): { previews: Array<{ raw: number | null; formatted: string }>; errors: string[] } {
  const previews: Array<{ raw: number | null; formatted: string }> = [];
  const errors: string[] = [];
  
  const samplesToProcess = sampleData.slice(0, 5);
  
  for (const row of samplesToProcess) {
    const result = evaluateFormula(field, row);
    previews.push({ raw: result.value, formatted: result.formattedValue });
    
    if (result.error && !errors.includes(result.error)) {
      errors.push(result.error);
    }
  }
  
  return { previews, errors };
}

export function getFormulaHelp(): { functions: Array<{ name: string; syntax: string; description: string; example: string }> } {
  return {
    functions: [
      { 
        name: 'Basic Math', 
        syntax: '+ - * /', 
        description: 'Addition, subtraction, multiplication, division',
        example: '[Ad Spend] / [Conversions]'
      },
      { 
        name: 'Parentheses', 
        syntax: '( )', 
        description: 'Group operations for order of precedence',
        example: '([Clicks] / [Impressions]) * 100'
      },
      { 
        name: 'ROUND', 
        syntax: 'ROUND(value)', 
        description: 'Round to nearest integer',
        example: 'ROUND([Total] / [Count])'
      },
      { 
        name: 'ABS', 
        syntax: 'ABS(value)', 
        description: 'Absolute value (removes negative sign)',
        example: 'ABS([Change])'
      },
      { 
        name: 'MIN', 
        syntax: 'MIN(a, b)', 
        description: 'Returns the smaller of two values',
        example: 'MIN([Budget], [Spend])'
      },
      { 
        name: 'MAX', 
        syntax: 'MAX(a, b)', 
        description: 'Returns the larger of two values',
        example: 'MAX([CTR], 0)'
      },
      { 
        name: 'IF', 
        syntax: 'IF(condition, then, else)', 
        description: 'Conditional logic',
        example: 'IF([Conversions] > 0, [Spend] / [Conversions], 0)'
      },
      { 
        name: 'CEIL', 
        syntax: 'CEIL(value)', 
        description: 'Round up to nearest integer',
        example: 'CEIL([Quantity])'
      },
      { 
        name: 'FLOOR', 
        syntax: 'FLOOR(value)', 
        description: 'Round down to nearest integer',
        example: 'FLOOR([Quantity])'
      },
    ]
  };
}
