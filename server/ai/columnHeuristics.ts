/**
 * Column Type Heuristics Module
 * 
 * Pre-processing module that detects column types before AI cleaning
 * to improve data cleaning accuracy and reduce AI token usage.
 */

export interface ColumnTypeHeuristic {
  columnName: string;
  detectedType: 'currency' | 'percentage' | 'integer' | 'decimal' | 'date' | 'text' | 'boolean';
  confidence: number;
  patterns: string[];
  suggestedFormat?: string;
}

export interface CurrencyDetectionResult {
  isCurrency: boolean;
  symbol?: string;
  confidence: number;
}

export interface PercentageDetectionResult {
  isPercentage: boolean;
  format?: 'symbol' | 'decimal';
  confidence: number;
}

export interface DateDetectionResult {
  isDate: boolean;
  format?: string;
  confidence: number;
}

export interface IntegerDetectionResult {
  isInteger: boolean;
  confidence: number;
}

export interface DecimalDetectionResult {
  isDecimal: boolean;
  confidence: number;
}

export interface BooleanDetectionResult {
  isBoolean: boolean;
  confidence: number;
}

const CURRENCY_SYMBOLS = ['$', '€', '£', '¥', '₹', '₽', '₩', '฿', 'R$', 'kr', 'zł'];
const CURRENCY_CODES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'RUB', 'KRW', 'THB', 'BRL', 'SEK', 'PLN'];

const DATE_PATTERNS: { pattern: RegExp; format: string }[] = [
  { pattern: /^\d{4}-\d{2}-\d{2}$/, format: 'YYYY-MM-DD' },
  { pattern: /^\d{4}\/\d{2}\/\d{2}$/, format: 'YYYY/MM/DD' },
  { pattern: /^\d{2}-\d{2}-\d{4}$/, format: 'DD-MM-YYYY' },
  { pattern: /^\d{2}\/\d{2}\/\d{4}$/, format: 'DD/MM/YYYY' },
  { pattern: /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, format: 'M/D/YYYY' },
  { pattern: /^\d{1,2}-\d{1,2}-\d{2,4}$/, format: 'M-D-YYYY' },
  { pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, format: 'ISO8601' },
  { pattern: /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}$/i, format: 'Mon DD, YYYY' },
  { pattern: /^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i, format: 'DD Mon YYYY' },
  { pattern: /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}$/i, format: 'Month DD, YYYY' },
];

const BOOLEAN_TRUE_VALUES = ['true', 'yes', 'y', '1', 'on', 'enabled', 'active'];
const BOOLEAN_FALSE_VALUES = ['false', 'no', 'n', '0', 'off', 'disabled', 'inactive'];

/**
 * Extract non-null, non-empty string values from an array
 */
function extractStringValues(values: unknown[]): string[] {
  return values
    .filter(v => v != null && v !== '')
    .map(v => String(v).trim())
    .filter(v => v.length > 0);
}

/**
 * Detect if values represent currency
 */
export function detectCurrency(values: string[]): CurrencyDetectionResult {
  if (values.length === 0) {
    return { isCurrency: false, confidence: 0 };
  }

  let currencyCount = 0;
  const symbolCounts: Record<string, number> = {};

  for (const value of values) {
    const trimmed = value.trim();
    
    for (const symbol of CURRENCY_SYMBOLS) {
      if (trimmed.startsWith(symbol) || trimmed.endsWith(symbol)) {
        const numPart = trimmed.replace(symbol, '').replace(/[,\s]/g, '');
        if (/^-?\d+\.?\d*$/.test(numPart)) {
          currencyCount++;
          symbolCounts[symbol] = (symbolCounts[symbol] || 0) + 1;
          break;
        }
      }
    }

    for (const code of CURRENCY_CODES) {
      if (trimmed.includes(code)) {
        const numPart = trimmed.replace(code, '').replace(/[,\s]/g, '');
        if (/^-?\d+\.?\d*$/.test(numPart)) {
          currencyCount++;
          symbolCounts[code] = (symbolCounts[code] || 0) + 1;
          break;
        }
      }
    }

    if (/^\$[\d,]+\.?\d*$/.test(trimmed) || /^[\d,]+\.?\d*\$$/.test(trimmed)) {
      currencyCount++;
      symbolCounts['$'] = (symbolCounts['$'] || 0) + 1;
    }
  }

  const confidence = currencyCount / values.length;
  
  if (confidence >= 0.6) {
    const mostCommonSymbol = Object.entries(symbolCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0];
    
    return {
      isCurrency: true,
      symbol: mostCommonSymbol,
      confidence: Math.min(confidence, 1),
    };
  }

  return { isCurrency: false, confidence };
}

/**
 * Detect if values represent percentages
 */
export function detectPercentage(values: string[]): PercentageDetectionResult {
  if (values.length === 0) {
    return { isPercentage: false, confidence: 0 };
  }

  let symbolPercentCount = 0;
  let decimalPercentCount = 0;

  for (const value of values) {
    const trimmed = value.trim();
    
    if (/^-?\d+\.?\d*\s*%$/.test(trimmed)) {
      symbolPercentCount++;
      continue;
    }

    const num = parseFloat(trimmed);
    if (!isNaN(num) && num >= -1 && num <= 1 && trimmed.includes('.')) {
      decimalPercentCount++;
    }
  }

  const symbolConfidence = symbolPercentCount / values.length;
  const decimalConfidence = decimalPercentCount / values.length;

  if (symbolConfidence >= 0.6) {
    return {
      isPercentage: true,
      format: 'symbol',
      confidence: Math.min(symbolConfidence, 1),
    };
  }

  if (decimalConfidence >= 0.7) {
    return {
      isPercentage: true,
      format: 'decimal',
      confidence: Math.min(decimalConfidence * 0.8, 1),
    };
  }

  return { isPercentage: false, confidence: Math.max(symbolConfidence, decimalConfidence) };
}

/**
 * Detect if values represent dates
 */
export function detectDate(values: string[]): DateDetectionResult {
  if (values.length === 0) {
    return { isDate: false, confidence: 0 };
  }

  const formatCounts: Record<string, number> = {};
  let dateCount = 0;

  for (const value of values) {
    const trimmed = value.trim();
    
    for (const { pattern, format } of DATE_PATTERNS) {
      if (pattern.test(trimmed)) {
        dateCount++;
        formatCounts[format] = (formatCounts[format] || 0) + 1;
        break;
      }
    }

    if (!Object.keys(formatCounts).some(f => formatCounts[f] > 0)) {
      const parsed = Date.parse(trimmed);
      if (!isNaN(parsed) && trimmed.length > 5) {
        const hasDateIndicators = /\d/.test(trimmed) && 
          (/[\/\-\.]/.test(trimmed) || /[a-zA-Z]/.test(trimmed));
        if (hasDateIndicators) {
          dateCount++;
          formatCounts['auto'] = (formatCounts['auto'] || 0) + 1;
        }
      }
    }
  }

  const confidence = dateCount / values.length;

  if (confidence >= 0.6) {
    const mostCommonFormat = Object.entries(formatCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0];
    
    return {
      isDate: true,
      format: mostCommonFormat,
      confidence: Math.min(confidence, 1),
    };
  }

  return { isDate: false, confidence };
}

/**
 * Detect if values represent integers
 */
export function detectInteger(values: string[]): IntegerDetectionResult {
  if (values.length === 0) {
    return { isInteger: false, confidence: 0 };
  }

  let integerCount = 0;

  for (const value of values) {
    const trimmed = value.trim().replace(/,/g, '');
    
    if (/^-?\d+$/.test(trimmed)) {
      integerCount++;
    }
  }

  const confidence = integerCount / values.length;

  return {
    isInteger: confidence >= 0.7,
    confidence: Math.min(confidence, 1),
  };
}

/**
 * Detect if values represent decimal numbers
 */
export function detectDecimal(values: string[]): DecimalDetectionResult {
  if (values.length === 0) {
    return { isDecimal: false, confidence: 0 };
  }

  let decimalCount = 0;
  let hasDecimalPoint = false;

  for (const value of values) {
    const trimmed = value.trim().replace(/,/g, '');
    
    if (/^-?\d+\.?\d*$/.test(trimmed)) {
      decimalCount++;
      if (trimmed.includes('.')) {
        hasDecimalPoint = true;
      }
    }
  }

  const confidence = decimalCount / values.length;

  return {
    isDecimal: confidence >= 0.7 && hasDecimalPoint,
    confidence: Math.min(confidence, 1),
  };
}

/**
 * Detect if values represent booleans
 */
export function detectBoolean(values: string[]): BooleanDetectionResult {
  if (values.length === 0) {
    return { isBoolean: false, confidence: 0 };
  }

  let booleanCount = 0;

  for (const value of values) {
    const lower = value.trim().toLowerCase();
    
    if (BOOLEAN_TRUE_VALUES.includes(lower) || BOOLEAN_FALSE_VALUES.includes(lower)) {
      booleanCount++;
    }
  }

  const confidence = booleanCount / values.length;

  return {
    isBoolean: confidence >= 0.8,
    confidence: Math.min(confidence, 1),
  };
}

/**
 * Detect column types for all columns in the dataset
 */
export function detectColumnTypes(data: Record<string, unknown>[]): ColumnTypeHeuristic[] {
  if (data.length === 0) {
    return [];
  }

  const columns = Object.keys(data[0] || {});
  const results: ColumnTypeHeuristic[] = [];

  for (const columnName of columns) {
    const values = data.map(row => row[columnName]);
    const stringValues = extractStringValues(values);

    if (stringValues.length === 0) {
      results.push({
        columnName,
        detectedType: 'text',
        confidence: 0,
        patterns: [],
      });
      continue;
    }

    const currencyResult = detectCurrency(stringValues);
    if (currencyResult.isCurrency && currencyResult.confidence >= 0.7) {
      results.push({
        columnName,
        detectedType: 'currency',
        confidence: currencyResult.confidence,
        patterns: currencyResult.symbol ? [`${currencyResult.symbol}X.XX`] : [],
        suggestedFormat: currencyResult.symbol ? `${currencyResult.symbol}0.00` : undefined,
      });
      continue;
    }

    const percentageResult = detectPercentage(stringValues);
    if (percentageResult.isPercentage && percentageResult.confidence >= 0.7) {
      results.push({
        columnName,
        detectedType: 'percentage',
        confidence: percentageResult.confidence,
        patterns: percentageResult.format === 'symbol' ? ['X%'] : ['0.XX'],
        suggestedFormat: percentageResult.format === 'symbol' ? '0%' : '0.00',
      });
      continue;
    }

    const dateResult = detectDate(stringValues);
    if (dateResult.isDate && dateResult.confidence >= 0.7) {
      results.push({
        columnName,
        detectedType: 'date',
        confidence: dateResult.confidence,
        patterns: dateResult.format ? [dateResult.format] : [],
        suggestedFormat: dateResult.format,
      });
      continue;
    }

    const booleanResult = detectBoolean(stringValues);
    if (booleanResult.isBoolean && booleanResult.confidence >= 0.8) {
      results.push({
        columnName,
        detectedType: 'boolean',
        confidence: booleanResult.confidence,
        patterns: ['true/false', 'yes/no'],
      });
      continue;
    }

    const integerResult = detectInteger(stringValues);
    if (integerResult.isInteger && integerResult.confidence >= 0.7) {
      results.push({
        columnName,
        detectedType: 'integer',
        confidence: integerResult.confidence,
        patterns: ['0', '-0'],
      });
      continue;
    }

    const decimalResult = detectDecimal(stringValues);
    if (decimalResult.isDecimal && decimalResult.confidence >= 0.7) {
      results.push({
        columnName,
        detectedType: 'decimal',
        confidence: decimalResult.confidence,
        patterns: ['0.00'],
      });
      continue;
    }

    results.push({
      columnName,
      detectedType: 'text',
      confidence: 1 - Math.max(
        currencyResult.confidence,
        percentageResult.confidence,
        dateResult.confidence,
        booleanResult.confidence,
        integerResult.confidence,
        decimalResult.confidence
      ),
      patterns: [],
    });
  }

  return results;
}

/**
 * Generate a summary of detected column types for AI prompts
 */
export function generateColumnTypeSummary(heuristics: ColumnTypeHeuristic[]): string {
  if (heuristics.length === 0) {
    return 'No column types detected.';
  }

  const lines: string[] = ['Detected column types:'];
  
  for (const h of heuristics) {
    const confidenceLabel = h.confidence >= 0.9 ? 'high' : h.confidence >= 0.7 ? 'medium' : 'low';
    let line = `- ${h.columnName}: ${h.detectedType} (${confidenceLabel} confidence)`;
    if (h.suggestedFormat) {
      line += ` [format: ${h.suggestedFormat}]`;
    }
    lines.push(line);
  }

  return lines.join('\n');
}
