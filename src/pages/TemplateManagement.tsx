import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Search, 
  Plus, 
  FileText, 
  Pencil, 
  Trash2, 
  Calendar,
  BarChart3,
  Filter,
  ChevronDown,
  Layers,
  Globe,
  Building2,
  RotateCcw,
  X
} from 'lucide-react';
import { useTemplates, useDeleteTemplate, type DataTemplate } from '../hooks/useTemplates';
import { useTemplateEditor } from '../contexts/TemplateEditorContext';
import { TemplateEditor } from '../components/TemplateEditor';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { toast } from 'sonner';

interface TemplateManagementProps {
  workspaceId: string | null;
  spaceId: string | null;
  onBack: () => void;
}

type SortOption = 'name' | 'usageCount' | 'lastUsed' | 'createdAt';
type ScopeFilter = 'all' | 'workspace' | 'space';

const STORAGE_KEY_SEARCH = 'captureinsight_template_management_search';
const STORAGE_KEY_SORT = 'captureinsight_template_management_sort';
const STORAGE_KEY_FILTER = 'captureinsight_template_management_filter';

function getStoredValue<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      return JSON.parse(stored) as T;
    }
  } catch (e) {
    console.error(`Error reading ${key} from localStorage:`, e);
  }
  return defaultValue;
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
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

function TemplateCard({ 
  template, 
  onEdit, 
  onDelete 
}: { 
  template: DataTemplate; 
  onEdit: () => void; 
  onDelete: () => void;
}) {
  const columnCount = template.columnSchema?.columns?.length || 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-[#1A1F2E] rounded-xl border border-[rgba(255,107,53,0.15)] p-5 hover:border-[rgba(255,107,53,0.3)] transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FF6B35] to-[#FF8F35] flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-medium">{template.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                template.scope === 'space' 
                  ? 'bg-blue-500/20 text-blue-400' 
                  : 'bg-purple-500/20 text-purple-400'
              }`}>
                {template.scope === 'space' ? (
                  <span className="flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    Space
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    Workspace
                  </span>
                )}
              </span>
              {template.sourceType && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#FF6B35]/20 text-[#FF6B35]">
                  {sourceTypeLabels[template.sourceType] || template.sourceType}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-2 text-gray-400 hover:text-[#FF6B35] hover:bg-[#FF6B35]/10 rounded-lg transition-colors"
            title="Edit template"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
            title="Delete template"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {template.description && (
        <p className="text-gray-400 text-sm mb-4 line-clamp-2">
          {template.description}
        </p>
      )}
      
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5" />
          <span>{columnCount} column{columnCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5" />
          <span>{template.usageCount || 0} uses</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatDate(template.lastUsedAt)}</span>
        </div>
      </div>
    </motion.div>
  );
}

export function TemplateManagement({ workspaceId, spaceId, onBack }: TemplateManagementProps) {
  const { data: templates = [], isLoading } = useTemplates(workspaceId, spaceId);
  const deleteTemplateMutation = useDeleteTemplate();
  const { openEditor, hasDraft, draftTimestamp, restoreDraft, clearDraft } = useTemplateEditor();
  
  const [searchQuery, setSearchQuery] = useState<string>(() => getStoredValue(STORAGE_KEY_SEARCH, ''));
  const [sortBy, setSortBy] = useState<SortOption>(() => getStoredValue(STORAGE_KEY_SORT, 'usageCount'));
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>(() => getStoredValue(STORAGE_KEY_FILTER, 'all'));
  const [templateToDelete, setTemplateToDelete] = useState<DataTemplate | null>(null);

  // Persist search query to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SEARCH, JSON.stringify(searchQuery));
    } catch (e) {
      console.error('Error saving search query to localStorage:', e);
    }
  }, [searchQuery]);

  // Persist sort option to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SORT, JSON.stringify(sortBy));
    } catch (e) {
      console.error('Error saving sort option to localStorage:', e);
    }
  }, [sortBy]);

  // Persist scope filter to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_FILTER, JSON.stringify(scopeFilter));
    } catch (e) {
      console.error('Error saving scope filter to localStorage:', e);
    }
  }, [scopeFilter]);
  
  const filteredAndSortedTemplates = useMemo(() => {
    let result = [...templates];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.name.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query))
      );
    }
    
    if (scopeFilter !== 'all') {
      result = result.filter(t => t.scope === scopeFilter);
    }
    
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'usageCount':
          return (b.usageCount || 0) - (a.usageCount || 0);
        case 'lastUsed':
          if (!a.lastUsedAt) return 1;
          if (!b.lastUsedAt) return -1;
          return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
        case 'createdAt':
          if (!a.createdAt) return 1;
          if (!b.createdAt) return -1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });
    
    return result;
  }, [templates, searchQuery, sortBy, scopeFilter]);
  
  const handleEdit = (template: DataTemplate) => {
    openEditor({
      id: template.id,
      name: template.name,
      description: template.description || '',
      scope: template.scope,
      sourceType: template.sourceType as any,
      aiPromptHints: template.aiPromptHints || '',
      columns: template.columnSchema?.columns?.map((col, idx) => ({
        id: `col-${idx}`,
        ...col,
        aliases: template.columnAliases?.[col.canonicalName] || [],
      })) || [],
      cleaningPipeline: template.cleaningPipeline?.steps || [],
      columnAliases: template.columnAliases || {},
    });
  };
  
  const handleDelete = async () => {
    if (!templateToDelete) return;
    
    try {
      await deleteTemplateMutation.mutateAsync(templateToDelete.id);
      toast.success('Template deleted successfully');
      setTemplateToDelete(null);
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };
  
  const handleCreateNew = () => {
    openEditor();
  };
  
  const sortLabels: Record<SortOption, string> = {
    name: 'Name',
    usageCount: 'Most Used',
    lastUsed: 'Recently Used',
    createdAt: 'Newest',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 bg-[#0F1219] overflow-auto"
    >
      <div className="max-w-4xl mx-auto p-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </button>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FFA07A] flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white">Template Management</h1>
              <p className="text-gray-400">Create and manage data templates for automated cleaning</p>
            </div>
          </div>
          
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#FF6B35] hover:bg-[#FF8F35] text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        </div>

        {/* Draft Restoration Banner */}
        <AnimatePresence>
          {hasDraft && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 bg-[#1A1F2E] border border-[#FF6B35]/30 rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#FF6B35]/20 flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-[#FF6B35]" />
                </div>
                <div>
                  <p className="text-white font-medium">Unsaved template draft found</p>
                  <p className="text-gray-400 text-sm">
                    {draftTimestamp 
                      ? `Last edited ${new Date(draftTimestamp).toLocaleString()}`
                      : 'You have an unsaved template from a previous session'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearDraft}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
                  title="Discard draft"
                >
                  <X className="w-5 h-5" />
                </button>
                <button
                  onClick={restoreDraft}
                  className="flex items-center gap-2 px-4 py-2 bg-[#FF6B35] hover:bg-[#FF8F35] text-white rounded-lg font-medium transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restore Draft
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#1A1F2E] border border-[rgba(255,107,53,0.2)] rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-[#FF6B35]/50"
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1F2E] border border-[rgba(255,107,53,0.2)] rounded-lg text-gray-300 hover:border-[#FF6B35]/50 transition-colors">
                <Filter className="w-4 h-4" />
                {scopeFilter === 'all' ? 'All Scopes' : scopeFilter === 'workspace' ? 'Workspace' : 'Space'}
                <ChevronDown className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#1A1F2E] border-[#FF6B35]/30">
              <DropdownMenuItem 
                onClick={() => setScopeFilter('all')}
                className="text-white hover:bg-[#FF6B35]/20 cursor-pointer"
              >
                All Scopes
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setScopeFilter('workspace')}
                className="text-white hover:bg-[#FF6B35]/20 cursor-pointer"
              >
                Workspace Only
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setScopeFilter('space')}
                className="text-white hover:bg-[#FF6B35]/20 cursor-pointer"
              >
                Space Only
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1F2E] border border-[rgba(255,107,53,0.2)] rounded-lg text-gray-300 hover:border-[#FF6B35]/50 transition-colors">
                Sort: {sortLabels[sortBy]}
                <ChevronDown className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#1A1F2E] border-[#FF6B35]/30">
              {Object.entries(sortLabels).map(([key, label]) => (
                <DropdownMenuItem 
                  key={key}
                  onClick={() => setSortBy(key as SortOption)}
                  className="text-white hover:bg-[#FF6B35]/20 cursor-pointer"
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredAndSortedTemplates.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1A1F2E] flex items-center justify-center">
              <FileText className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              {searchQuery || scopeFilter !== 'all' ? 'No templates found' : 'No templates yet'}
            </h3>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              {searchQuery || scopeFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Create your first template to automatically clean and structure incoming data based on predefined column schemas.'}
            </p>
            {!searchQuery && scopeFilter === 'all' && (
              <button
                onClick={handleCreateNew}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FF6B35] hover:bg-[#FF8F35] text-white rounded-lg font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Your First Template
              </button>
            )}
          </motion.div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence mode="popLayout">
              {filteredAndSortedTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onEdit={() => handleEdit(template)}
                  onDelete={() => setTemplateToDelete(template)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AlertDialog open={!!templateToDelete} onOpenChange={() => setTemplateToDelete(null)}>
        <AlertDialogContent className="bg-[#1A1F2E] border-[#FF6B35]/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Template</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to delete "{templateToDelete?.name}"? This action cannot be undone.
              {(templateToDelete?.usageCount || 0) > 0 && (
                <span className="block mt-2 text-yellow-500">
                  This template has been used {templateToDelete?.usageCount} time{templateToDelete?.usageCount !== 1 ? 's' : ''}.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#0A0E1A] border-[#1A1F2E] text-white hover:bg-[#1A1F2E]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Template Editor Modal */}
      <TemplateEditor />
    </motion.div>
  );
}
