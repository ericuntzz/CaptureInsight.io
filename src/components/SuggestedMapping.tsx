import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Check, X, HelpCircle } from 'lucide-react';
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

interface SuggestedMappingProps {
  suggestion: ColumnMappingSuggestion;
  onAccept: () => void;
  onReject: () => void;
}

function getConfidenceBadgeColor(confidence: number): string {
  if (confidence >= 85) return 'bg-green-500/20 text-green-400 border-green-500/30';
  if (confidence >= 65) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 85) return 'High';
  if (confidence >= 65) return 'Medium';
  return 'Low';
}

export function SuggestedMapping({ suggestion, onAccept, onReject }: SuggestedMappingProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-[#FF6B35]/10 to-transparent rounded-lg border border-[#FF6B35]/20"
    >
      <Sparkles className="w-3.5 h-3.5 text-[#FF6B35] flex-shrink-0" />
      
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400">AI suggests:</span>
        <span className="text-xs font-medium text-white font-mono">
          {suggestion.suggestedCanonicalName}
        </span>
        <span className="text-xs text-gray-500">
          ({suggestion.suggestedDisplayName})
        </span>
        <span className="text-xs text-gray-500">
          • {suggestion.suggestedDataType}
        </span>
        
        <Badge 
          variant="outline" 
          className={`text-[10px] py-0 h-4 ${getConfidenceBadgeColor(suggestion.confidence)}`}
        >
          {suggestion.confidence}% {getConfidenceLabel(suggestion.confidence)}
        </Badge>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="p-0.5 text-gray-500 hover:text-gray-300 transition-colors">
                <HelpCircle className="w-3 h-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[280px] bg-[#1A1F2E] border-[#FF6B35]/30">
              <p className="text-xs">{suggestion.reason}</p>
              {suggestion.alternativeNames && suggestion.alternativeNames.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#FF6B35]/20">
                  <p className="text-[10px] text-gray-500">Alternatives:</p>
                  <p className="text-xs text-gray-400">
                    {suggestion.alternativeNames.join(', ')}
                  </p>
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onAccept}
          className="p-1.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
          title="Accept suggestion"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          onClick={onReject}
          className="p-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
          title="Reject suggestion"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  );
}

interface SuggestedMappingBannerProps {
  totalSuggestions: number;
  highConfidenceCount: number;
  onApplyAll: () => void;
  onDismissAll: () => void;
  isLoading?: boolean;
}

export function SuggestedMappingBanner({
  totalSuggestions,
  highConfidenceCount,
  onApplyAll,
  onDismissAll,
  isLoading = false,
}: SuggestedMappingBannerProps) {
  if (totalSuggestions === 0 && !isLoading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mb-4 p-4 bg-gradient-to-r from-[#FF6B35]/10 to-[#FF8F35]/5 rounded-xl border border-[#FF6B35]/20"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF6B35] to-[#FF8F35] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-white">
              {isLoading ? 'Analyzing columns...' : `${totalSuggestions} AI Suggestions`}
            </h4>
            {!isLoading && (
              <p className="text-xs text-gray-400">
                {highConfidenceCount} high-confidence matches found
              </p>
            )}
          </div>
        </div>
        
        {!isLoading && totalSuggestions > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={onDismissAll}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              Dismiss All
            </button>
            <button
              onClick={onApplyAll}
              className="px-3 py-1.5 text-xs bg-[#FF6B35] hover:bg-[#FF7B45] text-white rounded-lg font-medium transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3 h-3" />
              Apply All
            </button>
          </div>
        )}
        
        {isLoading && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-gray-400">Processing...</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
