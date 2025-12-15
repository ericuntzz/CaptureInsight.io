import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CustomSelect } from './CustomSelect';

interface Rule {
  id: string;
  enabled: boolean;
  expanded: boolean;
}

interface RemoveCommasRule extends Rule {
  applyTo: string;
}

interface StripCurrencyRule extends Rule {
  applyTo: string;
}

interface ConvertPercentagesRule extends Rule {
  percentageMode: string;
  applyTo: string;
}

interface ConvertDateFormatRule extends Rule {
  fromFormat: string;
  toFormat: string;
  applyTo: string;
}

interface FillEmptyValuesRule extends Rule {
  fillValue: string;
  applyTo: string;
}

export function CleaningPipeline() {
  const [removeCommas, setRemoveCommas] = useState<RemoveCommasRule>({
    id: 'remove-commas',
    enabled: false,
    expanded: false,
    applyTo: 'All Columns'
  });

  const [stripCurrency, setStripCurrency] = useState<StripCurrencyRule>({
    id: 'strip-currency',
    enabled: false,
    expanded: false,
    applyTo: 'All Columns'
  });

  const [convertPercentages, setConvertPercentages] = useState<ConvertPercentagesRule>({
    id: 'convert-percentages',
    enabled: false,
    expanded: false,
    percentageMode: 'Decimal (0.125)',
    applyTo: 'All Columns'
  });

  const [convertDateFormat, setConvertDateFormat] = useState<ConvertDateFormatRule>({
    id: 'convert-date',
    enabled: false,
    expanded: false,
    fromFormat: 'MM/DD/YYYY',
    toFormat: 'YYYY-MM-DD',
    applyTo: 'All Columns'
  });

  const [fillEmptyValues, setFillEmptyValues] = useState<FillEmptyValuesRule>({
    id: 'fill-empty',
    enabled: false,
    expanded: false,
    fillValue: '',
    applyTo: 'All Columns'
  });

  const toggleRule = (_ruleId: string, setter: any, currentState: any) => {
    setter({ ...currentState, enabled: !currentState.enabled, expanded: !currentState.enabled });
  };

  const toggleExpanded = (_ruleId: string, setter: any, currentState: any) => {
    if (currentState.enabled) {
      setter({ ...currentState, expanded: !currentState.expanded });
    }
  };

  return (
    <div className="space-y-3">
      {/* Remove Commas */}
      <button 
        onClick={() => toggleRule('remove-commas', setRemoveCommas, removeCommas)}
        className={`w-full rounded-xl border overflow-hidden transition-all duration-200 text-left ${
          removeCommas.enabled
            ? 'bg-[#FF6B35] border-[#FF6B35]'
            : 'bg-[#0A0D12] border-[rgba(255,255,255,0.08)] hover:border-[#FF6B35]'
        }`}
        style={removeCommas.enabled ? { boxShadow: '0 0 20px -5px rgba(255, 107, 53, 0.4)' } : {}}
      >
        <div className="flex items-center gap-3 p-4">
          <div className="flex-1 flex items-center justify-between gap-6">
            <div>
              <h3 className={`mb-1 ${removeCommas.enabled ? 'text-white' : 'text-white'}`}>Remove Commas</h3>
              <p className={`text-sm ${removeCommas.enabled ? 'text-white/80' : 'text-[#9CA3AF]'}`}>Strip commas from numbers</p>
            </div>
            <div className="flex items-center gap-2 text-sm whitespace-nowrap">
              <span className={removeCommas.enabled ? 'text-white/80' : 'text-[#6B7280]'}>1,234,567</span>
              <span className={removeCommas.enabled ? 'text-white/80' : 'text-[#9CA3AF]'}>→</span>
              <span className={removeCommas.enabled ? 'text-white/80' : 'text-[#6B7280]'}>1234567</span>
            </div>
          </div>
        </div>
      </button>

      {/* Strip Currency Symbols */}
      <button 
        onClick={() => toggleRule('strip-currency', setStripCurrency, stripCurrency)}
        className={`w-full rounded-xl border overflow-hidden transition-all duration-200 text-left ${
          stripCurrency.enabled
            ? 'bg-[#FF6B35] border-[#FF6B35]'
            : 'bg-[#0A0D12] border-[rgba(255,255,255,0.08)] hover:border-[#FF6B35]'
        }`}
        style={stripCurrency.enabled ? { boxShadow: '0 0 20px -5px rgba(255, 107, 53, 0.4)' } : {}}
      >
        <div className="flex items-center gap-3 p-4">
          <div className="flex-1 flex items-center justify-between gap-6">
            <div>
              <h3 className={`mb-1 ${stripCurrency.enabled ? 'text-white' : 'text-white'}`}>Strip Currency Symbols</h3>
              <p className={`text-sm ${stripCurrency.enabled ? 'text-white/80' : 'text-[#9CA3AF]'}`}>Remove $ from values</p>
            </div>
            <div className="flex items-center gap-2 text-sm whitespace-nowrap">
              <span className={stripCurrency.enabled ? 'text-white/80' : 'text-[#6B7280]'}>$1,234.56</span>
              <span className={stripCurrency.enabled ? 'text-white/80' : 'text-[#9CA3AF]'}>→</span>
              <span className={stripCurrency.enabled ? 'text-white/80' : 'text-[#6B7280]'}>1,234.56</span>
            </div>
          </div>
        </div>
      </button>

      {/* Convert Percentages */}
      <button 
        onClick={() => toggleRule('convert-percentages', setConvertPercentages, convertPercentages)}
        className={`w-full rounded-xl border overflow-hidden transition-all duration-200 text-left ${
          convertPercentages.enabled
            ? 'bg-[#FF6B35] border-[#FF6B35]'
            : 'bg-[#0A0D12] border-[rgba(255,255,255,0.08)] hover:border-[#FF6B35]'
        }`}
        style={convertPercentages.enabled ? { boxShadow: '0 0 20px -5px rgba(255, 107, 53, 0.4)' } : {}}
      >
        <div className="flex items-center gap-3 p-4">
          <div className="flex-1 flex items-center justify-between gap-6">
            <div>
              <h3 className={`mb-1 ${convertPercentages.enabled ? 'text-white' : 'text-white'}`}>Convert Percentages</h3>
              <p className={`text-sm ${convertPercentages.enabled ? 'text-white/80' : 'text-[#9CA3AF]'}`}>Convert % strings to decimals</p>
            </div>
            <div className="flex items-center gap-2 text-sm whitespace-nowrap">
              <span className={convertPercentages.enabled ? 'text-white/80' : 'text-[#6B7280]'}>12.5%</span>
              <span className={convertPercentages.enabled ? 'text-white/80' : 'text-[#9CA3AF]'}>→</span>
              <span className={convertPercentages.enabled ? 'text-white/80' : 'text-[#6B7280]'}>0.125</span>
            </div>
          </div>
        </div>
      </button>

      {/* Convert Date Format */}
      <div 
        className={`rounded-xl border transition-all duration-200 ${
          convertDateFormat.enabled
            ? 'bg-[#FF6B35] border-[#FF6B35]'
            : 'bg-[#0A0D12] border-[rgba(255,255,255,0.08)] hover:border-[#FF6B35]'
        }`}
        style={convertDateFormat.enabled ? { boxShadow: '0 0 20px -5px rgba(255, 107, 53, 0.4)' } : {}}
      >
        <button
          onClick={() => toggleRule('convert-date', setConvertDateFormat, convertDateFormat)}
          className="w-full flex items-center gap-3 p-4 text-left"
        >
          <div className="flex-1 flex items-center justify-between gap-6">
            <div>
              <h3 className={`mb-1 ${convertDateFormat.enabled ? 'text-white' : 'text-white'}`}>Convert Date Format</h3>
              <p className={`text-sm ${convertDateFormat.enabled ? 'text-white/80' : 'text-[#9CA3AF]'}`}>Standardize date formats</p>
            </div>
            <div className="flex items-center gap-2 text-sm whitespace-nowrap">
              <span className={convertDateFormat.enabled ? 'text-white/80' : 'text-[#6B7280]'}>12/25/2024</span>
              <span className={convertDateFormat.enabled ? 'text-white/80' : 'text-[#9CA3AF]'}>→</span>
              <span className={convertDateFormat.enabled ? 'text-white/80' : 'text-[#6B7280]'}>2024-12-25</span>
            </div>
          </div>
          {convertDateFormat.enabled && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded('convert-date', setConvertDateFormat, convertDateFormat);
              }}
              className="p-1 hover:bg-[rgba(0,0,0,0.2)] rounded transition-colors flex-shrink-0"
            >
              <ChevronDown
                className={`text-white/80 transition-transform ${convertDateFormat.expanded ? 'rotate-180' : ''}`}
                size={20}
              />
            </button>
          )}
        </button>
        
        {convertDateFormat.enabled && convertDateFormat.expanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-[rgba(255,255,255,0.08)] pt-4 bg-[#1A1F2E] rounded-b-xl">
            <div className="grid grid-cols-2 gap-3">
              <CustomSelect
                label="From Format"
                value={convertDateFormat.fromFormat}
                onChange={(value) => setConvertDateFormat({ ...convertDateFormat, fromFormat: value })}
                options={['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY']}
              />
              <CustomSelect
                label="To Format"
                value={convertDateFormat.toFormat}
                onChange={(value) => setConvertDateFormat({ ...convertDateFormat, toFormat: value })}
                options={['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'DD-MM-YYYY']}
              />
            </div>
          </div>
        )}
      </div>

      {/* Fill Empty Values */}
      <div 
        className={`rounded-xl border overflow-hidden transition-all duration-200 ${
          fillEmptyValues.enabled
            ? 'bg-[#FF6B35] border-[#FF6B35]'
            : 'bg-[#0A0D12] border-[rgba(255,255,255,0.08)] hover:border-[#FF6B35]'
        }`}
        style={fillEmptyValues.enabled ? { boxShadow: '0 0 20px -5px rgba(255, 107, 53, 0.4)' } : {}}
      >
        <button
          onClick={() => toggleRule('fill-empty', setFillEmptyValues, fillEmptyValues)}
          className="w-full flex items-center gap-3 p-4 text-left"
        >
          <div className="flex-1 flex items-center justify-between gap-6">
            <div>
              <h3 className={`mb-1 ${fillEmptyValues.enabled ? 'text-white' : 'text-white'}`}>Fill Empty Values</h3>
              <p className={`text-sm italic ${fillEmptyValues.enabled ? 'text-white/80' : 'text-[#9CA3AF]'}`}>Replace empty cells with default</p>
            </div>
            <div className="flex items-center gap-2 text-sm whitespace-nowrap">
              <span className={fillEmptyValues.enabled ? 'text-white/80' : 'text-[#6B7280]'}>(empty)</span>
              <span className={fillEmptyValues.enabled ? 'text-white/80' : 'text-[#9CA3AF]'}>→</span>
              <span className={fillEmptyValues.enabled ? 'text-white/80' : 'text-[#6B7280]'}>N/A</span>
            </div>
          </div>
          {fillEmptyValues.enabled && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded('fill-empty', setFillEmptyValues, fillEmptyValues);
              }}
              className="p-1 hover:bg-[rgba(0,0,0,0.2)] rounded transition-colors flex-shrink-0"
            >
              <ChevronDown
                className={`text-white/80 transition-transform ${fillEmptyValues.expanded ? 'rotate-180' : ''}`}
                size={20}
              />
            </button>
          )}
        </button>
        
        {fillEmptyValues.enabled && fillEmptyValues.expanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-[rgba(255,255,255,0.08)] pt-4 bg-[#1A1F2E]">
            <div>
              <label className="block text-sm text-[#9CA3AF] mb-2">
                Fill Value
              </label>
              <input
                type="text"
                value={fillEmptyValues.fillValue}
                onChange={(e) => setFillEmptyValues({ ...fillEmptyValues, fillValue: e.target.value })}
                placeholder="N/A, 0, or leave empty"
                className="w-full px-4 py-3 bg-[#0A0D12] border border-[#FF6B35] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
