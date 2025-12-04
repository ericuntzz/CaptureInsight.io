import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, Check, ChevronDown, X, Sparkles, 
  AlertCircle, CheckCircle2, HelpCircle, RefreshCw
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { Badge } from './ui/badge';

export interface ColumnMappingSuggestion {
  sourceColumn: string;
  suggestedCanonicalName: string;
  suggestedDisplayName: string;
  suggestedDataType: 'currency' | 'percentage' | 'integer' | 'decimal' | 'date' | 'text' | 'boolean';
  confidence: number;
  reason: string;
  alternativeNames?: string[];
}

export interface ConfirmedMapping {
  sourceColumn: string;
  mappedTo: string;
  displayName: string;
  wasAISuggested: boolean;
  confidence: number;
}

interface ColumnMappingPanelProps {
  suggestions: ColumnMappingSuggestion[];
  isLoading?: boolean;
  onConfirm: (mappings: ConfirmedMapping[]) => void;
  onDismiss: () => void;
  onRefresh?: () => void;
}

interface MappingCardProps {
  suggestion: ColumnMappingSuggestion;
  isConfirmed: boolean;
  selectedMapping: string;
  onSelect: (mapping: string, displayName: string) => void;
  onConfirm: () => void;
  onReject: () => void;
  allOptions: { name: string; displayName: string }[];
}

function getConfidenceBadgeVariant(confidence: number): "default" | "secondary" | "destructive" | "outline" {
  if (confidence >= 90) return "default";
  if (confidence >= 70) return "secondary";
  if (confidence >= 50) return "outline";
  return "destructive";
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 90) return "text-green-400";
  if (confidence >= 70) return "text-yellow-400";
  if (confidence >= 50) return "text-orange-400";
  return "text-red-400";
}

function MappingCard({ 
  suggestion, 
  isConfirmed, 
  selectedMapping,
  onSelect, 
  onConfirm, 
  onReject,
  allOptions,
}: MappingCardProps) {
  const [showAlternatives, setShowAlternatives] = useState(false);
  
  const alternatives = (suggestion.alternativeNames || []).map(name => ({
    name,
    displayName: name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }));
  
  const options = [
    { name: suggestion.suggestedCanonicalName, displayName: suggestion.suggestedDisplayName },
    ...alternatives,
    ...allOptions.filter(opt => 
      opt.name !== suggestion.suggestedCanonicalName && 
      !alternatives.some(alt => alt.name === opt.name)
    ),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-lg border transition-all ${
        isConfirmed 
          ? 'bg-green-500/10 border-green-500/30' 
          : 'bg-[#0A0E1A] border-[#1A1F2E] hover:border-[#FF6B35]/30'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-white bg-[#1A1F2E] px-2 py-1 rounded">
              {suggestion.sourceColumn}
            </span>
            <ArrowRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
            
            {isConfirmed ? (
              <span className="font-mono text-sm text-green-400 bg-green-500/10 px-2 py-1 rounded flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {selectedMapping}
              </span>
            ) : (
              <Select
                value={selectedMapping}
                onValueChange={(value) => {
                  const option = options.find(o => o.name === value);
                  onSelect(value, option?.displayName || value);
                }}
              >
                <SelectTrigger className="w-[180px] h-8 bg-[#1A1F2E] border-[#FF6B35]/30 text-sm">
                  <SelectValue placeholder="Select mapping" />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1F2E] border-[#FF6B35]/30 max-h-[200px]">
                  {options.map((opt, idx) => (
                    <SelectItem 
                      key={`${opt.name}-${idx}`} 
                      value={opt.name} 
                      className="text-white hover:bg-[#FF6B35]/20"
                    >
                      <span className="flex items-center gap-2">
                        {opt.displayName}
                        {idx === 0 && (
                          <Badge variant="outline" className="text-[10px] py-0 h-4">
                            AI
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            <Badge 
              variant={getConfidenceBadgeVariant(suggestion.confidence)}
              className="text-xs"
            >
              {suggestion.confidence}%
            </Badge>
          </div>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-xs text-gray-500 mt-2 truncate cursor-help flex items-center gap-1">
                  <HelpCircle className="w-3 h-3" />
                  {suggestion.reason}
                </p>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[300px] bg-[#1A1F2E] border-[#FF6B35]/30">
                <p className="text-sm">{suggestion.reason}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isConfirmed && (
            <>
              <button
                onClick={onConfirm}
                className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                title="Confirm mapping"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={onReject}
                className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                title="Remove suggestion"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
          {isConfirmed && (
            <button
              onClick={onReject}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#1A1F2E] transition-colors"
              title="Edit mapping"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function ColumnMappingPanel({
  suggestions,
  isLoading = false,
  onConfirm,
  onDismiss,
  onRefresh,
}: ColumnMappingPanelProps) {
  const [mappingStates, setMappingStates] = useState<Record<string, {
    selectedMapping: string;
    displayName: string;
    dataType: string;
    isConfirmed: boolean;
  }>>(() => {
    const initial: Record<string, any> = {};
    suggestions.forEach(s => {
      initial[s.sourceColumn] = {
        selectedMapping: s.suggestedCanonicalName,
        displayName: s.suggestedDisplayName,
        dataType: s.suggestedDataType,
        isConfirmed: false,
      };
    });
    return initial;
  });

  React.useEffect(() => {
    const newStates: Record<string, any> = {};
    suggestions.forEach(s => {
      if (!mappingStates[s.sourceColumn]) {
        newStates[s.sourceColumn] = {
          selectedMapping: s.suggestedCanonicalName,
          displayName: s.suggestedDisplayName,
          dataType: s.suggestedDataType,
          isConfirmed: false,
        };
      } else {
        newStates[s.sourceColumn] = mappingStates[s.sourceColumn];
      }
    });
    if (Object.keys(newStates).length !== Object.keys(mappingStates).length) {
      setMappingStates(newStates);
    }
  }, [suggestions]);

  const handleSelect = (sourceColumn: string, mapping: string, displayName: string) => {
    setMappingStates(prev => ({
      ...prev,
      [sourceColumn]: {
        ...prev[sourceColumn],
        selectedMapping: mapping,
        displayName: displayName,
      },
    }));
  };

  const handleConfirmOne = (sourceColumn: string) => {
    setMappingStates(prev => ({
      ...prev,
      [sourceColumn]: {
        ...prev[sourceColumn],
        isConfirmed: true,
      },
    }));
  };

  const handleRejectOne = (sourceColumn: string) => {
    setMappingStates(prev => ({
      ...prev,
      [sourceColumn]: {
        ...prev[sourceColumn],
        isConfirmed: false,
      },
    }));
  };

  const handleConfirmAll = () => {
    const confirmed: ConfirmedMapping[] = suggestions.map(s => ({
      sourceColumn: s.sourceColumn,
      mappedTo: mappingStates[s.sourceColumn]?.selectedMapping || s.suggestedCanonicalName,
      displayName: mappingStates[s.sourceColumn]?.displayName || s.suggestedDisplayName,
      wasAISuggested: true,
      confidence: s.confidence,
    }));
    onConfirm(confirmed);
  };

  const handleConfirmSelected = () => {
    const confirmed: ConfirmedMapping[] = suggestions
      .filter(s => mappingStates[s.sourceColumn]?.isConfirmed)
      .map(s => ({
        sourceColumn: s.sourceColumn,
        mappedTo: mappingStates[s.sourceColumn]?.selectedMapping || s.suggestedCanonicalName,
        displayName: mappingStates[s.sourceColumn]?.displayName || s.suggestedDisplayName,
        wasAISuggested: true,
        confidence: s.confidence,
      }));
    onConfirm(confirmed);
  };

  const allOptions = suggestions.flatMap(s => {
    const alternatives = (s.alternativeNames || []).map(name => ({
      name,
      displayName: name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    }));
    return [
      { name: s.suggestedCanonicalName, displayName: s.suggestedDisplayName },
      ...alternatives,
    ];
  }).filter((v, i, a) => a.findIndex(t => t.name === v.name) === i);

  const confirmedCount = Object.values(mappingStates).filter(s => s.isConfirmed).length;
  const highConfidenceCount = suggestions.filter(s => s.confidence >= 80).length;

  if (isLoading) {
    return (
      <div className="p-6 bg-[#0A0E1A] rounded-xl border border-[#1A1F2E]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FF6B35] to-[#FF8F35] flex items-center justify-center animate-pulse">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Analyzing Columns...</h3>
            <p className="text-sm text-gray-400">AI is suggesting column mappings</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-[#1A1F2E] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="p-6 bg-[#0A0E1A] rounded-xl border border-[#1A1F2E]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FF6B35] to-[#FF8F35] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">AI Column Mapping</h3>
            <p className="text-sm text-gray-400">
              {highConfidenceCount} of {suggestions.length} columns matched with high confidence
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#1A1F2E] rounded-lg transition-colors"
              title="Refresh suggestions"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 p-3 bg-[#1A1F2E]/50 rounded-lg">
        <AlertCircle className="w-4 h-4 text-[#FF6B35]" />
        <span className="text-sm text-gray-300">
          Review and confirm each mapping. Click the checkmark to confirm or select a different mapping.
        </span>
      </div>

      <div className="space-y-3 mb-6 max-h-[400px] overflow-y-auto pr-2">
        <AnimatePresence mode="popLayout">
          {suggestions.map((suggestion, idx) => (
            <MappingCard
              key={suggestion.sourceColumn}
              suggestion={suggestion}
              isConfirmed={mappingStates[suggestion.sourceColumn]?.isConfirmed || false}
              selectedMapping={mappingStates[suggestion.sourceColumn]?.selectedMapping || suggestion.suggestedCanonicalName}
              onSelect={(mapping, displayName) => handleSelect(suggestion.sourceColumn, mapping, displayName)}
              onConfirm={() => handleConfirmOne(suggestion.sourceColumn)}
              onReject={() => handleRejectOne(suggestion.sourceColumn)}
              allOptions={allOptions}
            />
          ))}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-[#1A1F2E]">
        <div className="text-sm text-gray-400">
          {confirmedCount} of {suggestions.length} mappings confirmed
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onDismiss}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          {confirmedCount > 0 && confirmedCount < suggestions.length && (
            <button
              onClick={handleConfirmSelected}
              className="px-4 py-2 bg-[#1A1F2E] hover:bg-[#252B3D] text-white rounded-lg transition-colors"
            >
              Apply {confirmedCount} Confirmed
            </button>
          )}
          <button
            onClick={handleConfirmAll}
            className="px-4 py-2 bg-gradient-to-r from-[#FF6B35] to-[#FF8F35] hover:from-[#FF7B45] hover:to-[#FF9F45] text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Apply All Mappings
          </button>
        </div>
      </div>
    </div>
  );
}
