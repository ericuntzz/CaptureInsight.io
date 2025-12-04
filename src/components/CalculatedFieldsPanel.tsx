import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Trash2, Pencil, Calculator, DollarSign, Percent, Hash, 
  AlertCircle, CheckCircle2, X, HelpCircle, Lightbulb
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { Switch } from './ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useTemplateEditor, CalculatedField, TemplateColumn } from '../contexts/TemplateEditorContext';

interface CalculatedFieldsPanelProps {
  fields: CalculatedField[];
  columns: TemplateColumn[];
  sampleData?: Record<string, any>[];
  onEdit: (field: CalculatedField) => void;
  showEditor: boolean;
  editingField: CalculatedField | null;
  onCloseEditor: () => void;
}

const outputTypeOptions = [
  { value: 'currency', label: 'Currency', icon: DollarSign, example: '$12.45' },
  { value: 'percentage', label: 'Percentage', icon: Percent, example: '2.5%' },
  { value: 'number', label: 'Number', icon: Hash, example: '123.45' },
  { value: 'integer', label: 'Integer', icon: Hash, example: '123' },
] as const;

const formulaExamples = [
  { name: 'CPA', formula: '[Ad Spend] / [Conversions]', description: 'Cost Per Acquisition' },
  { name: 'CTR', formula: '([Clicks] / [Impressions]) * 100', description: 'Click-Through Rate' },
  { name: 'ROAS', formula: '[Revenue] / [Ad Spend]', description: 'Return on Ad Spend' },
  { name: 'CPC', formula: '[Ad Spend] / [Clicks]', description: 'Cost Per Click' },
  { name: 'CVR', formula: '([Conversions] / [Clicks]) * 100', description: 'Conversion Rate' },
];

function getOutputTypeIcon(type: CalculatedField['outputType']) {
  const Icon = outputTypeOptions.find(o => o.value === type)?.icon || Hash;
  return Icon;
}

function evaluatePreview(expression: string, row: Record<string, any>): { value: number | null; error?: string } {
  try {
    let evalExpression = expression;
    const columnRefs = expression.match(/\[([^\]]+)\]/g) || [];
    
    for (const ref of columnRefs) {
      const columnName = ref.slice(1, -1);
      const rawValue = row[columnName];
      
      if (rawValue === null || rawValue === undefined || rawValue === '') {
        return { value: null, error: 'Missing data' };
      }
      
      let numValue: number;
      if (typeof rawValue === 'number') {
        numValue = rawValue;
      } else {
        const cleaned = String(rawValue).replace(/[$€£¥₹,]/g, '').replace(/%$/, '').trim();
        numValue = parseFloat(cleaned);
      }
      
      if (isNaN(numValue)) {
        return { value: null, error: 'Invalid number' };
      }
      
      evalExpression = evalExpression.replace(ref, numValue.toString());
    }
    
    evalExpression = evalExpression.replace(/\bABS\s*\(/gi, 'Math.abs(');
    evalExpression = evalExpression.replace(/\bROUND\s*\(/gi, 'Math.round(');
    evalExpression = evalExpression.replace(/\bCEIL\s*\(/gi, 'Math.ceil(');
    evalExpression = evalExpression.replace(/\bFLOOR\s*\(/gi, 'Math.floor(');
    evalExpression = evalExpression.replace(/\bMIN\s*\(/gi, 'Math.min(');
    evalExpression = evalExpression.replace(/\bMAX\s*\(/gi, 'Math.max(');
    evalExpression = evalExpression.replace(/\bIF\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi, '(($1) ? ($2) : ($3))');
    
    const result = new Function(`return ${evalExpression}`)();
    
    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
      return { value: null, error: 'Invalid result' };
    }
    
    return { value: result };
  } catch {
    return { value: null, error: 'Formula error' };
  }
}

function formatPreviewValue(
  value: number, 
  outputType: CalculatedField['outputType'],
  formatConfig?: CalculatedField['formatConfig']
): string {
  const decimals = formatConfig?.decimalPlaces ?? 2;
  
  switch (outputType) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: formatConfig?.currencyCode || 'USD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
    case 'percentage':
      const pctValue = formatConfig?.percentageMode === 'whole' ? value : value * 100;
      return `${pctValue.toFixed(decimals)}%`;
    case 'integer':
      return Math.round(value).toLocaleString('en-US');
    default:
      return value.toFixed(decimals);
  }
}

function FieldCard({ 
  field, 
  sampleData,
  onEdit, 
  onDelete, 
  onToggle 
}: { 
  field: CalculatedField; 
  sampleData?: Record<string, any>[];
  onEdit: () => void; 
  onDelete: () => void;
  onToggle: () => void;
}) {
  const previewValue = useMemo(() => {
    if (!sampleData || sampleData.length === 0) return null;
    const result = evaluatePreview(field.expression, sampleData[0]);
    if (result.value === null) return result.error || '-';
    return formatPreviewValue(result.value, field.outputType, field.formatConfig);
  }, [field, sampleData]);

  const OutputIcon = getOutputTypeIcon(field.outputType);
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`group bg-[#1A1F2E] rounded-xl border ${field.isActive ? 'border-purple-500/30' : 'border-[#2A2F3E] opacity-60'} p-4 hover:border-purple-500/50 transition-all`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-8 h-8 rounded-lg ${field.isActive ? 'bg-purple-500/20' : 'bg-gray-500/20'} flex items-center justify-center`}>
              <OutputIcon className={`w-4 h-4 ${field.isActive ? 'text-purple-400' : 'text-gray-400'}`} />
            </div>
            <div>
              <h4 className="text-sm font-medium text-white">{field.name || 'Untitled Field'}</h4>
              {field.description && (
                <p className="text-xs text-gray-500">{field.description}</p>
              )}
            </div>
          </div>
          
          <div className="mt-3 p-2 bg-[#0D1117] rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500">Formula:</span>
              <code className="text-xs text-purple-300 font-mono bg-purple-500/10 px-1.5 py-0.5 rounded">
                {field.expression || 'No formula defined'}
              </code>
            </div>
            {previewValue && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Preview:</span>
                <span className={`text-sm font-medium ${field.isActive ? 'text-green-400' : 'text-gray-400'}`}>
                  {previewValue}
                </span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <Switch
            checked={field.isActive}
            onCheckedChange={onToggle}
            className="data-[state=checked]:bg-purple-500"
          />
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="p-1.5 hover:bg-[#252A3A] rounded-lg transition-colors"
              title="Edit field"
            >
              <Pencil className="w-3.5 h-3.5 text-gray-400" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
              title="Delete field"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FieldEditor({
  field,
  columns,
  sampleData,
  onSave,
  onCancel,
}: {
  field: CalculatedField | null;
  columns: TemplateColumn[];
  sampleData?: Record<string, any>[];
  onSave: (field: Partial<CalculatedField>) => void;
  onCancel: () => void;
}) {
  const { validateFormula } = useTemplateEditor();
  
  const [name, setName] = useState(field?.name || '');
  const [description, setDescription] = useState(field?.description || '');
  const [expression, setExpression] = useState(field?.expression || '');
  const [outputType, setOutputType] = useState<CalculatedField['outputType']>(field?.outputType || 'number');
  const [currencyCode, setCurrencyCode] = useState(field?.formatConfig?.currencyCode || 'USD');
  const [decimalPlaces, setDecimalPlaces] = useState(field?.formatConfig?.decimalPlaces ?? 2);
  const [percentageMode, setPercentageMode] = useState<'decimal' | 'whole'>(field?.formatConfig?.percentageMode || 'decimal');
  
  const validation = useMemo(() => {
    if (!expression) return null;
    return validateFormula(expression);
  }, [expression, validateFormula]);
  
  const previewResult = useMemo(() => {
    if (!sampleData || sampleData.length === 0 || !expression) return null;
    const result = evaluatePreview(expression, sampleData[0]);
    if (result.value === null) return { error: result.error };
    return { 
      value: formatPreviewValue(result.value, outputType, { currencyCode, decimalPlaces, percentageMode })
    };
  }, [expression, sampleData, outputType, currencyCode, decimalPlaces, percentageMode]);
  
  const insertColumnRef = (columnName: string) => {
    setExpression(prev => prev + `[${columnName}]`);
  };
  
  const handleSave = () => {
    if (!name.trim() || !expression.trim()) return;
    if (validation && !validation.isValid) return;
    
    onSave({
      name: name.trim(),
      description: description.trim(),
      expression: expression.trim(),
      outputType,
      formatConfig: {
        currencyCode: outputType === 'currency' ? currencyCode : undefined,
        decimalPlaces,
        percentageMode: outputType === 'percentage' ? percentageMode : undefined,
      },
    });
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-[#0D1117] rounded-xl border border-purple-500/30 p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-medium text-white flex items-center gap-2">
          <Calculator className="w-5 h-5 text-purple-400" />
          {field ? 'Edit Calculated Field' : 'New Calculated Field'}
        </h3>
        <button onClick={onCancel} className="p-1 hover:bg-[#1A1F2E] rounded-lg transition-colors">
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>
      
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Field Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., CPA"
              className="w-full px-3 py-2 bg-[#1A1F2E] border border-transparent focus:border-purple-500/50 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Cost Per Acquisition"
              className="w-full px-3 py-2 bg-[#1A1F2E] border border-transparent focus:border-purple-500/50 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none"
            />
          </div>
        </div>
        
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs text-gray-400">Formula *</label>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-0.5 hover:bg-[#1A1F2E] rounded">
                  <HelpCircle className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs bg-[#1A1F2E] border-[#2A2F3E] text-xs">
                <p className="mb-2">Use [Column Name] syntax to reference columns.</p>
                <p>Supported: +, -, *, /, parentheses, ROUND, ABS, MIN, MAX</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <textarea
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="e.g., [Ad Spend] / [Conversions]"
            rows={2}
            className={`w-full px-3 py-2 bg-[#1A1F2E] border rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none font-mono ${
              validation && !validation.isValid ? 'border-red-500/50' : 'border-transparent focus:border-purple-500/50'
            }`}
          />
          {validation && !validation.isValid && (
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {validation.error}
            </p>
          )}
          {validation && validation.isValid && (
            <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Formula is valid
            </p>
          )}
        </div>
        
        {columns.length > 0 && (
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Insert Column Reference</label>
            <div className="flex flex-wrap gap-1">
              {columns.map(col => (
                <button
                  key={col.id}
                  onClick={() => insertColumnRef(col.displayName)}
                  className="px-2 py-1 bg-[#1A1F2E] hover:bg-purple-500/20 text-xs text-gray-300 hover:text-purple-300 rounded border border-[#2A2F3E] hover:border-purple-500/30 transition-colors"
                >
                  {col.displayName}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Output Format</label>
            <Select value={outputType} onValueChange={(v: string) => setOutputType(v as CalculatedField['outputType'])}>
              <SelectTrigger className="w-full bg-[#1A1F2E] border-transparent text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1F2E] border-[#2A2F3E]">
                {outputTypeOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-white hover:bg-purple-500/20">
                    <div className="flex items-center gap-2">
                      <opt.icon className="w-3.5 h-3.5" />
                      {opt.label}
                      <span className="text-gray-500 text-xs">({opt.example})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Decimal Places</label>
            <Select value={String(decimalPlaces)} onValueChange={(v: string) => setDecimalPlaces(Number(v))}>
              <SelectTrigger className="w-full bg-[#1A1F2E] border-transparent text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1F2E] border-[#2A2F3E]">
                {[0, 1, 2, 3, 4].map(n => (
                  <SelectItem key={n} value={String(n)} className="text-white hover:bg-purple-500/20">
                    {n} decimal{n !== 1 ? 's' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {outputType === 'currency' && (
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Currency</label>
            <Select value={currencyCode} onValueChange={setCurrencyCode}>
              <SelectTrigger className="w-full bg-[#1A1F2E] border-transparent text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1F2E] border-[#2A2F3E]">
                {['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'].map(code => (
                  <SelectItem key={code} value={code} className="text-white hover:bg-purple-500/20">
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        {outputType === 'percentage' && (
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Percentage Mode</label>
            <Select value={percentageMode} onValueChange={(v: string) => setPercentageMode(v as 'decimal' | 'whole')}>
              <SelectTrigger className="w-full bg-[#1A1F2E] border-transparent text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1F2E] border-[#2A2F3E]">
                <SelectItem value="decimal" className="text-white hover:bg-purple-500/20">
                  Decimal (0.025 → 2.5%)
                </SelectItem>
                <SelectItem value="whole" className="text-white hover:bg-purple-500/20">
                  Whole number (2.5 → 2.5%)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        
        {previewResult && (
          <div className="p-3 bg-[#1A1F2E] rounded-lg border border-purple-500/20">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Live Preview:</span>
              {previewResult.error ? (
                <span className="text-sm text-red-400">{previewResult.error}</span>
              ) : (
                <span className="text-lg font-medium text-green-400">{previewResult.value}</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">Based on first row of sample data</p>
          </div>
        )}
        
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !expression.trim() || (validation !== null && !validation.isValid)}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {field ? 'Save Changes' : 'Add Field'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function CalculatedFieldsPanel({
  fields,
  columns,
  sampleData,
  onEdit,
  showEditor,
  editingField,
  onCloseEditor,
}: CalculatedFieldsPanelProps) {
  const { addCalculatedField, updateCalculatedField, deleteCalculatedField } = useTemplateEditor();
  
  const handleSave = (fieldData: Partial<CalculatedField>) => {
    if (editingField) {
      updateCalculatedField(editingField.id, fieldData);
    } else {
      addCalculatedField(fieldData);
    }
    onCloseEditor();
  };
  
  const handleToggle = (field: CalculatedField) => {
    updateCalculatedField(field.id, { isActive: !field.isActive });
  };
  
  return (
    <div className="space-y-4">
      <AnimatePresence mode="popLayout">
        {showEditor && (
          <FieldEditor
            key="editor"
            field={editingField}
            columns={columns}
            sampleData={sampleData}
            onSave={handleSave}
            onCancel={onCloseEditor}
          />
        )}
      </AnimatePresence>
      
      {fields.length === 0 && !showEditor ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-[#FF6B35]/10 flex items-center justify-center mb-4">
            <Calculator className="w-10 h-10 text-purple-400" />
          </div>
          <p className="text-lg text-white font-medium mb-2">Create calculated KPIs</p>
          <p className="text-sm text-gray-400 mb-6 text-center max-w-md">
            Define formulas to automatically calculate metrics like CPA, CTR, ROAS from your data columns.
          </p>
          
          {columns.length > 0 ? (
            <>
              <div className="w-full max-w-md mb-6">
                <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                  <Lightbulb className="w-3 h-3" />
                  Popular formulas for marketing data:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {formulaExamples.slice(0, 4).map(ex => (
                    <div key={ex.name} className="p-2 bg-[#1A1F2E] rounded-lg border border-[#2A2F3E]">
                      <div className="text-xs font-medium text-white mb-0.5">{ex.name}</div>
                      <div className="text-xs text-gray-500">{ex.description}</div>
                    </div>
                  ))}
                </div>
              </div>
              
              <button
                onClick={() => onEdit({} as CalculatedField)}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-[#FF6B35] hover:from-purple-600 hover:to-[#FF7B45] text-white rounded-xl text-base font-medium transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                Add Calculated Field
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-500 text-center">
              Add columns first to start creating calculated fields
            </p>
          )}
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {fields.map(field => (
            <FieldCard
              key={field.id}
              field={field}
              sampleData={sampleData}
              onEdit={() => onEdit(field)}
              onDelete={() => deleteCalculatedField(field.id)}
              onToggle={() => handleToggle(field)}
            />
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
