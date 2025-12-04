import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search, 
  FileText, 
  Check, 
  Layers, 
  Calendar,
  Sparkles,
  Ban
} from 'lucide-react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { type DataTemplate, type TemplateMatchResult } from '../hooks/useTemplates';

interface TemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  templates: DataTemplate[];
  matchResults?: TemplateMatchResult[];
  suggestedTemplateId?: string;
  onSelect: (templateId: string | null) => void;
  isApplying?: boolean;
}

const sourceTypeLabels: Record<string, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  ga4: 'GA4',
  google_sheets: 'Google Sheets',
  csv: 'CSV',
  custom: 'Custom',
};

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Never used';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return 'text-green-400';
  if (confidence >= 60) return 'text-yellow-400';
  return 'text-gray-400';
}

function getConfidenceBg(confidence: number): string {
  if (confidence >= 80) return 'bg-green-500/20';
  if (confidence >= 60) return 'bg-yellow-500/20';
  return 'bg-gray-500/20';
}

interface TemplateCardProps {
  template: DataTemplate;
  matchResult?: TemplateMatchResult;
  isSuggested: boolean;
  isSelected: boolean;
  onSelect: () => void;
}

function TemplateCard({ 
  template, 
  matchResult, 
  isSuggested, 
  isSelected,
  onSelect 
}: TemplateCardProps) {
  const columnCount = template.columnSchema?.columns?.length || 0;
  const columns = template.columnSchema?.columns || [];
  const confidence = matchResult ? Math.round(matchResult.confidence * 100) : null;
  
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            onClick={onSelect}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`relative w-full text-left p-4 rounded-xl border transition-all ${
              isSelected 
                ? 'bg-[#FF6B35]/10 border-[#FF6B35]' 
                : isSuggested
                  ? 'bg-[#1A1F2E] border-[#FF6B35]/50 hover:border-[#FF6B35]'
                  : 'bg-[#1A1F2E] border-[rgba(255,107,53,0.15)] hover:border-[rgba(255,107,53,0.3)]'
            }`}
          >
            {isSuggested && !isSelected && (
              <div className="absolute -top-2 -right-2">
                <span className="flex items-center gap-1 px-2 py-0.5 bg-[#FF6B35] text-white text-xs font-medium rounded-full">
                  <Sparkles className="w-3 h-3" />
                  Suggested
                </span>
              </div>
            )}
            
            {isSelected && (
              <div className="absolute top-3 right-3">
                <div className="w-6 h-6 rounded-full bg-[#FF6B35] flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              </div>
            )}
            
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FF6B35] to-[#FF8F35] flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-white" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium truncate pr-8">{template.name}</h3>
                
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {template.sourceType && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#FF6B35]/20 text-[#FF6B35]">
                      {sourceTypeLabels[template.sourceType] || template.sourceType}
                    </span>
                  )}
                  {confidence !== null && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getConfidenceBg(confidence)} ${getConfidenceColor(confidence)}`}>
                      {confidence}% match
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    <span>{columnCount} columns</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(template.lastUsedAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.button>
        </TooltipTrigger>
        
        {columns.length > 0 && (
          <TooltipContent 
            side="right" 
            className="bg-[#0A0E1A] border-[#1A1F2E] p-3 max-w-xs"
          >
            <div className="text-xs">
              <div className="font-medium text-white mb-2">Column Preview</div>
              <div className="space-y-1 max-h-48 overflow-auto">
                {columns.slice(0, 10).map((col, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-4">
                    <span className="text-gray-300 truncate">{col.displayName}</span>
                    <span className="text-gray-500 text-[10px] uppercase">{col.dataType}</span>
                  </div>
                ))}
                {columns.length > 10 && (
                  <div className="text-gray-500 pt-1">
                    +{columns.length - 10} more columns
                  </div>
                )}
              </div>
            </div>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

export function TemplateSelector({
  isOpen,
  onClose,
  templates,
  matchResults = [],
  suggestedTemplateId,
  onSelect,
  isApplying = false,
}: TemplateSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    suggestedTemplateId || null
  );
  
  const matchResultsMap = useMemo(() => {
    const map = new Map<string, TemplateMatchResult>();
    matchResults.forEach(result => {
      map.set(result.template.id, result);
    });
    return map;
  }, [matchResults]);
  
  const filteredTemplates = useMemo(() => {
    let result = [...templates];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.name.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query))
      );
    }
    
    result.sort((a, b) => {
      if (a.id === suggestedTemplateId) return -1;
      if (b.id === suggestedTemplateId) return 1;
      
      const aMatch = matchResultsMap.get(a.id);
      const bMatch = matchResultsMap.get(b.id);
      
      if (aMatch && bMatch) {
        return bMatch.confidence - aMatch.confidence;
      }
      if (aMatch) return -1;
      if (bMatch) return 1;
      
      return (b.usageCount || 0) - (a.usageCount || 0);
    });
    
    return result;
  }, [templates, searchQuery, matchResultsMap, suggestedTemplateId]);
  
  const handleApply = () => {
    onSelect(selectedTemplateId);
  };
  
  const handleSkip = () => {
    onSelect(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0A0E1A] border-[#1A1F2E] max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3 text-white">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FF6B35] to-[#FF8F35] flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <div>Select a Template</div>
              <p className="text-sm font-normal text-gray-400 mt-0.5">
                Choose a template to structure your data
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="relative flex-shrink-0 mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#1A1F2E] border border-[rgba(255,107,53,0.2)] rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-[#FF6B35]/50"
          />
        </div>
        
        <div className="flex-1 overflow-auto mt-4 -mx-6 px-6">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#1A1F2E] flex items-center justify-center">
                <FileText className="w-6 h-6 text-gray-500" />
              </div>
              <p className="text-gray-400">
                {searchQuery ? 'No templates match your search' : 'No templates available'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 pb-4">
              <AnimatePresence mode="popLayout">
                {filteredTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    matchResult={matchResultsMap.get(template.id)}
                    isSuggested={template.id === suggestedTemplateId}
                    isSelected={template.id === selectedTemplateId}
                    onSelect={() => setSelectedTemplateId(template.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between pt-4 border-t border-[#1A1F2E] flex-shrink-0 -mx-6 px-6">
          <button
            onClick={handleSkip}
            disabled={isApplying}
            className="flex items-center gap-2 px-4 py-2.5 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <Ban className="w-4 h-4" />
            Skip - No Template
          </button>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isApplying}
              className="px-4 py-2.5 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!selectedTemplateId || isApplying}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6B35] hover:bg-[#FF8F35] text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApplying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Apply Template
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
