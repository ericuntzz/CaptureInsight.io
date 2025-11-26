// Universal Tag Search - Search across all tagged items in a space
// TODO: Backend tag-based search endpoint needed for full functionality.
// Currently uses client-side filtering of insights/sheets from existing endpoints.

import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  X,
  Calendar,
  User,
  Tag as TagIcon,
  FileText,
  Database,
  MessageSquare,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Tag } from '../data/insightsData';
import { TaggedItem, TagSearchFilters, DbTag } from '../types/database';
import { TagBadge } from './TagBadge';
import { apiRequest } from '../lib/queryClient';

async function searchTaggedItems(
  filters: TagSearchFilters,
  allTags: Tag[]
): Promise<TaggedItem[]> {
  if (!filters.spaceId) return [];

  const results: TaggedItem[] = [];

  try {
    const entityTypesToSearch = filters.entityTypes?.length
      ? filters.entityTypes
      : ['insight', 'data_sheet'];

    if (entityTypesToSearch.includes('insight')) {
      const insightsRes = await apiRequest('GET', `/api/spaces/${filters.spaceId}/insights`);
      const insights = await insightsRes.json();

      for (const insight of insights) {
        if (filters.searchQuery) {
          const query = filters.searchQuery.toLowerCase();
          const matchesTitle = insight.title?.toLowerCase().includes(query);
          const matchesSummary = insight.summary?.toLowerCase().includes(query);
          if (!matchesTitle && !matchesSummary) continue;
        }

        let entityTags: DbTag[] = [];
        try {
          const assocRes = await apiRequest('GET', `/api/tag-associations/insight/${insight.id}`);
          const associations = await assocRes.json();
          entityTags = associations
            .map((assoc: { tagId: string }) => allTags.find(t => t.id === assoc.tagId))
            .filter(Boolean)
            .map((tag: Tag) => ({
              id: tag.id,
              name: tag.name,
              color: tag.color,
              created_at: tag.createdAt || new Date(),
              created_by: tag.createdBy || 'unknown',
              space_id: filters.spaceId,
            }));
        } catch {
          entityTags = [];
        }

        if (filters.tags?.length) {
          const hasMatchingTag = filters.tags.some(tagId =>
            entityTags.some(t => t.id === tagId)
          );
          if (!hasMatchingTag) continue;
        }

        results.push({
          entity_type: 'insight',
          entity_id: insight.id,
          entity_name: insight.title || 'Untitled Insight',
          entity_preview: insight.summary,
          tags: entityTags,
          created_at: new Date(insight.createdAt || Date.now()),
          created_by: insight.createdBy || 'unknown',
          space_id: filters.spaceId,
          folder_id: insight.folderId,
        });
      }
    }

    if (entityTypesToSearch.includes('data_sheet')) {
      const sheetsRes = await apiRequest('GET', `/api/spaces/${filters.spaceId}/sheets`);
      const sheets = await sheetsRes.json();

      for (const sheet of sheets) {
        if (filters.searchQuery) {
          const query = filters.searchQuery.toLowerCase();
          const matchesName = sheet.name?.toLowerCase().includes(query);
          if (!matchesName) continue;
        }

        let entityTags: DbTag[] = [];
        try {
          const assocRes = await apiRequest('GET', `/api/tag-associations/data_sheet/${sheet.id}`);
          const associations = await assocRes.json();
          entityTags = associations
            .map((assoc: { tagId: string }) => allTags.find(t => t.id === assoc.tagId))
            .filter(Boolean)
            .map((tag: Tag) => ({
              id: tag.id,
              name: tag.name,
              color: tag.color,
              created_at: tag.createdAt || new Date(),
              created_by: tag.createdBy || 'unknown',
              space_id: filters.spaceId,
            }));
        } catch {
          entityTags = [];
        }

        if (filters.tags?.length) {
          const hasMatchingTag = filters.tags.some(tagId =>
            entityTags.some(t => t.id === tagId)
          );
          if (!hasMatchingTag) continue;
        }

        results.push({
          entity_type: 'data_sheet',
          entity_id: sheet.id,
          entity_name: sheet.name || 'Untitled Sheet',
          entity_preview: sheet.dataSourceType === 'screenshot'
            ? 'Screenshot capture'
            : sheet.dataSourceType === 'link'
            ? 'Saved link'
            : undefined,
          tags: entityTags,
          created_at: new Date(sheet.createdAt || Date.now()),
          created_by: sheet.createdBy || 'unknown',
          space_id: filters.spaceId,
          folder_id: sheet.folderId,
        });
      }
    }
  } catch (err) {
    console.error('Error searching tagged items:', err);
  }

  return results.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
}

interface UniversalTagSearchProps {
  spaceId: string | null;
  allTags: Tag[];
}

export function UniversalTagSearch({ spaceId, allTags }: UniversalTagSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<TagSearchFilters>({
    spaceId: spaceId || '',
    tags: [],
    entityTypes: [],
    searchQuery: '',
  });
  const [results, setResults] = useState<TaggedItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Update filters when search query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch();
      } else {
        setResults([]);
      }
    }, 300); // Debounce

    return () => clearTimeout(timer);
  }, [searchQuery, filters]);

  const performSearch = async () => {
    if (!spaceId) return;

    setIsSearching(true);
    try {
      const searchFilters: TagSearchFilters = {
        ...filters,
        spaceId,
        searchQuery: searchQuery.trim(),
      };
      const items = await searchTaggedItems(searchFilters, allTags);
      setResults(items);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Toggle tag filter
  const toggleTagFilter = (tagId: string) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags?.includes(tagId)
        ? prev.tags.filter(id => id !== tagId)
        : [...(prev.tags || []), tagId],
    }));
  };

  // Toggle entity type filter
  const toggleEntityTypeFilter = (
    entityType: 'chat_message' | 'data_sheet' | 'change_log' | 'insight'
  ) => {
    setFilters(prev => ({
      ...prev,
      entityTypes: prev.entityTypes?.includes(entityType)
        ? prev.entityTypes.filter(t => t !== entityType)
        : [...(prev.entityTypes || []), entityType],
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      spaceId: spaceId || '',
      tags: [],
      entityTypes: [],
      searchQuery: '',
    });
    setSearchQuery('');
    setResults([]);
  };

  const activeFilterCount =
    (filters.tags?.length || 0) + (filters.entityTypes?.length || 0);

  return (
    <div className="h-full bg-[#0A0E1A] flex flex-col">
      {/* Search Header */}
      <div className="p-6 border-b border-[#1A1F2E]">
        <h1 className="text-white text-2xl mb-4">Universal Search</h1>

        {/* Search Input */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search across all tagged items..."
            className="w-full pl-12 pr-4 py-3 bg-[#1A1F2E] border border-[#2D3B4E] rounded-lg text-white placeholder:text-[#6B7280] outline-none focus:border-[#FF6B35]"
          />
          {isSearching && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showFilters
                ? 'bg-[rgba(255,107,53,0.2)] text-[#FF6B35]'
                : 'bg-[#1A1F2E] text-[#9CA3AF] hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm">Filters</span>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 bg-[#FF6B35] text-white text-xs rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-sm text-[#FF6B35] hover:text-[#FFA07A]"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-4">
                {/* Entity Type Filters */}
                <div>
                  <div className="text-xs text-[#9CA3AF] mb-2">ITEM TYPES</div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { type: 'insight' as const, label: 'Insights', icon: FileText },
                      { type: 'data_sheet' as const, label: 'Data Sheets', icon: Database },
                      { type: 'chat_message' as const, label: 'Chat Messages', icon: MessageSquare },
                      { type: 'change_log' as const, label: 'Change Logs', icon: Clock },
                    ].map(({ type, label, icon: Icon }) => (
                      <button
                        key={type}
                        onClick={() => toggleEntityTypeFilter(type)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          filters.entityTypes?.includes(type)
                            ? 'bg-[rgba(255,107,53,0.2)] text-[#FF6B35] border border-[#FF6B35]'
                            : 'bg-[#1A1F2E] text-[#9CA3AF] hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tag Filters */}
                <div>
                  <div className="text-xs text-[#9CA3AF] mb-2">TAGS</div>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => toggleTagFilter(tag.id)}
                        className={`transition-all ${
                          filters.tags?.includes(tag.id)
                            ? 'ring-2 ring-[#FF6B35]'
                            : 'opacity-60 hover:opacity-100'
                        }`}
                      >
                        <TagBadge tag={tag} size="sm" interactive={false} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-6">
        {searchQuery.trim() === '' && results.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-[#2D3B4E] mx-auto mb-4" />
            <h3 className="text-white text-lg mb-2">Search Anything</h3>
            <p className="text-sm text-[#6B7280] max-w-md mx-auto">
              Search across insights, data sheets, chat messages, and change logs.
              Use filters to narrow down your search.
            </p>
          </div>
        )}

        {searchQuery.trim() !== '' && results.length === 0 && !isSearching && (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-[#2D3B4E] mx-auto mb-4" />
            <h3 className="text-white text-lg mb-2">No Results Found</h3>
            <p className="text-sm text-[#6B7280]">
              Try adjusting your search or filters
            </p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="text-sm text-[#9CA3AF] mb-4">
              {results.length} result{results.length !== 1 ? 's' : ''} found
            </div>

            {results.map((item) => (
              <SearchResultCard key={`${item.entity_type}-${item.entity_id}`} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Search Result Card
function SearchResultCard({ item }: { item: TaggedItem }) {
  const getIcon = () => {
    switch (item.entity_type) {
      case 'insight':
        return <FileText className="w-5 h-5 text-[#FF6B35]" />;
      case 'data_sheet':
        return <Database className="w-5 h-5 text-[#4ECDC4]" />;
      case 'chat_message':
        return <MessageSquare className="w-5 h-5 text-[#FFE66D]" />;
      case 'change_log':
        return <Clock className="w-5 h-5 text-[#A8E6CF]" />;
    }
  };

  const getTypeLabel = () => {
    switch (item.entity_type) {
      case 'insight':
        return 'Insight';
      case 'data_sheet':
        return 'Data Sheet';
      case 'chat_message':
        return 'Chat Message';
      case 'change_log':
        return 'Change Log';
    }
  };

  return (
    <div className="bg-[#1A1F2E] rounded-lg p-4 hover:bg-[#252B3D] transition-colors">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-[#0A0E1A] rounded-lg">{getIcon()}</div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-[#6B7280]">{getTypeLabel()}</span>
            <span className="text-xs text-[#6B7280]">•</span>
            <span className="text-xs text-[#6B7280]">
              {item.created_at.toLocaleDateString()}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-white mb-2">{item.entity_name}</h3>

          {/* Preview */}
          {item.entity_preview && (
            <p className="text-sm text-[#9CA3AF] mb-3 line-clamp-2">
              {item.entity_preview}
            </p>
          )}

          {/* Tags */}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {item.tags.map((tag) => (
                <TagBadge
                  key={tag.id}
                  tag={tag}
                  size="sm"
                  interactive={false}
                />
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#6B7280]">by {item.created_by}</span>
            <button className="flex items-center gap-1 text-xs text-[#FF6B35] hover:text-[#FFA07A]">
              <span>View</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
