import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain,
  Plus,
  Trash2,
  Loader2,
  Search,
  ToggleLeft,
  ToggleRight,
  X,
  Sparkles,
  Pencil,
  Settings2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';
import { toast } from 'sonner';

interface AgentMemory {
  id: string;
  userId: string;
  spaceId: string | null;
  category: string | null;
  content: string;
  source: string | null;
  isActive: boolean;
  importance: number;
  metadata: any;
  lastAccessedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MemoryPageProps {
  spaces: Array<{ id: string; name: string }>;
  currentSpaceId?: string | null;
}

const CATEGORIES = [
  { value: 'preference', label: 'Preference', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { value: 'insight', label: 'Insight', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { value: 'pattern', label: 'Pattern', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { value: 'context', label: 'Context', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { value: 'goal', label: 'Goal', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
];

function getCategoryStyle(category: string | null) {
  return CATEGORIES.find(c => c.value === category) || { value: 'context', label: 'Context', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
}

function getSourceIcon(source: string | null) {
  switch (source) {
    case 'ai_learned': return { icon: Sparkles, label: 'AI-learned', className: 'text-purple-400' };
    case 'user_manual': return { icon: Pencil, label: 'Manual', className: 'text-blue-400' };
    case 'system': return { icon: Settings2, label: 'System', className: 'text-gray-400' };
    default: return { icon: Pencil, label: 'Manual', className: 'text-blue-400' };
  }
}

function timeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function MemoryPage({ spaces }: MemoryPageProps) {
  const queryClient = useQueryClient();
  const [scopeFilter, setScopeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // New memory form state
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('context');
  const [newSpaceId, setNewSpaceId] = useState<string>('');
  const [newImportance, setNewImportance] = useState(5);

  // Fetch memories
  const { data: memories = [], isLoading } = useQuery<AgentMemory[]>({
    queryKey: ['memories', scopeFilter, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (scopeFilter !== 'all' && scopeFilter !== 'global') {
        params.set('spaceId', scopeFilter);
      }
      if (categoryFilter !== 'all') {
        params.set('category', categoryFilter);
      }
      const res = await apiRequest('GET', `/api/memory?${params.toString()}`);
      return res.json();
    },
  });

  // Create memory mutation
  const createMutation = useMutation({
    mutationFn: async (data: { content: string; category: string; spaceId: string | null; importance: number }) => {
      const res = await apiRequest('POST', '/api/memory', {
        content: data.content,
        category: data.category,
        spaceId: data.spaceId,
        importance: data.importance,
        source: 'user_manual',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] });
      setShowAddForm(false);
      setNewContent('');
      setNewCategory('context');
      setNewSpaceId('');
      setNewImportance(5);
      toast.success('Memory created');
    },
    onError: () => toast.error('Failed to create memory'),
  });

  // Update memory mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; content?: string; isActive?: boolean; importance?: number; category?: string }) => {
      const res = await apiRequest('PATCH', `/api/memory/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] });
      setEditingId(null);
      toast.success('Memory updated');
    },
    onError: () => toast.error('Failed to update memory'),
  });

  // Delete memory mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/memory/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] });
      setDeleteConfirmId(null);
      toast.success('Memory deleted');
    },
    onError: () => toast.error('Failed to delete memory'),
  });

  // Filter memories
  const filteredMemories = memories.filter(m => {
    if (scopeFilter === 'global' && m.spaceId !== null) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!m.content.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Stats
  const totalCount = memories.length;
  const aiLearnedCount = memories.filter(m => m.source === 'ai_learned').length;
  const activeCount = memories.filter(m => m.isActive).length;

  return (
    <div className="h-full flex flex-col bg-[#0F1923] text-white overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-[rgba(255,107,53,0.1)]">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[#FF6B35]/20 to-[#FFA07A]/10 border border-[rgba(255,107,53,0.2)]">
            <Brain className="w-5 h-5 text-[#FF6B35]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Memory</h1>
            <p className="text-sm text-[#9CA3AF]">What your AI assistant remembers about you and your data</p>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-4 mt-3 text-xs text-[#9CA3AF]">
          <span>{totalCount} memories total</span>
          <span className="text-[rgba(255,107,53,0.3)]">|</span>
          <span>{aiLearnedCount} AI-learned</span>
          <span className="text-[rgba(255,107,53,0.3)]">|</span>
          <span>{activeCount} active</span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {/* Scope Filter */}
          <div className="flex items-center gap-1 bg-[#1A2735] rounded-lg p-0.5 border border-[rgba(255,107,53,0.1)]">
            <button
              onClick={() => setScopeFilter('all')}
              className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                scopeFilter === 'all' ? 'bg-[#FF6B35] text-white' : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setScopeFilter('global')}
              className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                scopeFilter === 'global' ? 'bg-[#FF6B35] text-white' : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              Global
            </button>
            {spaces.map(space => (
              <button
                key={space.id}
                onClick={() => setScopeFilter(space.id)}
                className={`px-3 py-1.5 text-xs rounded-md transition-all truncate max-w-[120px] ${
                  scopeFilter === space.id ? 'bg-[#FF6B35] text-white' : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                {space.name}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1 bg-[#1A2735] rounded-lg p-0.5 border border-[rgba(255,107,53,0.1)]">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                categoryFilter === 'all' ? 'bg-[#FF6B35] text-white' : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              All
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategoryFilter(cat.value)}
                className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                  categoryFilter === cat.value ? 'bg-[#FF6B35] text-white' : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memories..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#1A2735] rounded-lg border border-[rgba(255,107,53,0.1)] text-white placeholder-[#6B7280] focus:outline-none focus:border-[#FF6B35]/50"
            />
          </div>

          {/* Add Button */}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Memory
          </button>
        </div>
      </div>

      {/* Add Memory Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-[rgba(255,107,53,0.1)]"
          >
            <div className="px-6 py-4 bg-[#1A2735]/50">
              <div className="flex items-start gap-4">
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="What should your AI remember? (e.g., 'I prefer ROAS as my primary KPI')"
                  className="flex-1 p-3 text-sm bg-[#0F1923] rounded-lg border border-[rgba(255,107,53,0.15)] text-white placeholder-[#6B7280] focus:outline-none focus:border-[#FF6B35]/50 resize-none"
                  rows={2}
                />
                <div className="flex flex-col gap-2 min-w-[180px]">
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-[#0F1923] rounded-lg border border-[rgba(255,107,53,0.15)] text-white focus:outline-none focus:border-[#FF6B35]/50"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <select
                    value={newSpaceId}
                    onChange={(e) => setNewSpaceId(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-[#0F1923] rounded-lg border border-[rgba(255,107,53,0.15)] text-white focus:outline-none focus:border-[#FF6B35]/50"
                  >
                    <option value="">Global (all spaces)</option>
                    {spaces.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#9CA3AF]">Importance:</span>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={newImportance}
                      onChange={(e) => setNewImportance(Number(e.target.value))}
                      className="flex-1 accent-[#FF6B35]"
                    />
                    <span className="text-xs text-white w-4 text-right">{newImportance}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="flex-1 px-3 py-1.5 text-xs text-[#9CA3AF] rounded-lg border border-[rgba(255,107,53,0.15)] hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (newContent.trim()) {
                          createMutation.mutate({
                            content: newContent,
                            category: newCategory,
                            spaceId: newSpaceId || null,
                            importance: newImportance,
                          });
                        }
                      }}
                      disabled={!newContent.trim() || createMutation.isPending}
                      className="flex-1 px-3 py-1.5 text-xs bg-[#FF6B35] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {createMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Memory List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-[#FF6B35] animate-spin" />
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 rounded-full bg-[#1A2735] mb-4">
              <Brain className="w-8 h-8 text-[#FF6B35]/50" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No memories yet</h3>
            <p className="text-sm text-[#9CA3AF] max-w-md">
              Your AI assistant will learn about your preferences and data patterns as you chat.
              You can also add memories manually to help the AI understand your needs better.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Add your first memory
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {filteredMemories.map((memory) => {
                const catStyle = getCategoryStyle(memory.category);
                const sourceInfo = getSourceIcon(memory.source);
                const SourceIcon = sourceInfo.icon;
                const isEditing = editingId === memory.id;

                return (
                  <motion.div
                    key={memory.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: memory.isActive ? 1 : 0.5, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`group relative p-4 rounded-lg border transition-colors ${
                      memory.isActive
                        ? 'bg-[#1A2735]/60 border-[rgba(255,107,53,0.1)] hover:border-[rgba(255,107,53,0.25)]'
                        : 'bg-[#1A2735]/30 border-[rgba(255,107,53,0.05)]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              className="flex-1 p-2 text-sm bg-[#0F1923] rounded border border-[#FF6B35]/30 text-white focus:outline-none resize-none"
                              rows={2}
                              autoFocus
                            />
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => {
                                  if (editingContent.trim()) {
                                    updateMutation.mutate({ id: memory.id, content: editingContent.trim() });
                                  }
                                }}
                                className="px-2 py-1 text-xs bg-[#FF6B35] text-white rounded hover:opacity-90"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-2 py-1 text-xs text-[#9CA3AF] rounded border border-[rgba(255,107,53,0.15)] hover:text-white"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p
                            className="text-sm text-white cursor-pointer hover:text-[#FFA07A] transition-colors"
                            onClick={() => {
                              setEditingId(memory.id);
                              setEditingContent(memory.content);
                            }}
                          >
                            {memory.content}
                          </p>
                        )}

                        {/* Meta row */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {/* Category badge */}
                          <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${catStyle.color}`}>
                            {catStyle.label}
                          </span>

                          {/* Source */}
                          <span className={`flex items-center gap-1 text-[10px] ${sourceInfo.className}`}>
                            <SourceIcon className="w-3 h-3" />
                            {sourceInfo.label}
                          </span>

                          {/* Space scope */}
                          <span className="text-[10px] text-[#6B7280]">
                            {memory.spaceId
                              ? spaces.find(s => s.id === memory.spaceId)?.name || 'Space'
                              : 'Global'
                            }
                          </span>

                          {/* Timestamp */}
                          <span className="text-[10px] text-[#6B7280]">
                            {timeAgo(memory.createdAt)}
                          </span>

                          {/* Importance */}
                          <div className="flex items-center gap-1 ml-auto">
                            <input
                              type="range"
                              min={1}
                              max={10}
                              value={memory.importance}
                              onChange={(e) => {
                                updateMutation.mutate({ id: memory.id, importance: Number(e.target.value) });
                              }}
                              className="w-16 h-1 accent-[#FF6B35] opacity-0 group-hover:opacity-100 transition-opacity"
                              title={`Importance: ${memory.importance}/10`}
                            />
                            <span className="text-[10px] text-[#6B7280] w-6 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                              {memory.importance}/10
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Toggle active */}
                        <button
                          onClick={() => updateMutation.mutate({ id: memory.id, isActive: !memory.isActive })}
                          className="p-1.5 rounded hover:bg-[rgba(255,107,53,0.1)] transition-colors"
                          title={memory.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {memory.isActive
                            ? <ToggleRight className="w-4 h-4 text-emerald-400" />
                            : <ToggleLeft className="w-4 h-4 text-[#6B7280]" />
                          }
                        </button>

                        {/* Delete */}
                        {deleteConfirmId === memory.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => deleteMutation.mutate(memory.id)}
                              className="px-2 py-1 text-[10px] bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="p-1 rounded hover:bg-[rgba(255,107,53,0.1)]"
                            >
                              <X className="w-3 h-3 text-[#9CA3AF]" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(memory.id)}
                            className="p-1.5 rounded hover:bg-red-500/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-[#6B7280] hover:text-red-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
