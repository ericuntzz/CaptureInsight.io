// React hooks for insight operations

import { useState, useEffect, useCallback } from 'react';
import { Insight, mockInsights } from '../data/insightsData';
import { DbInsight, DbInsightSource } from '../types/database';
import { toast } from 'sonner@2.0.3';
import {
  getInsightsForSpace,
  getInsightById,
  createInsight as apiCreateInsight,
  updateInsight as apiUpdateInsight,
  deleteInsight as apiDeleteInsight,
  addCommentToInsight,
  parseMentions,
} from '../api/insights';

/**
 * Hook to manage insights for a space
 */
export function useInsights(spaceId: string | null) {
  const [insights, setInsights] = useState<Insight[]>(mockInsights);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load insights when space changes
  useEffect(() => {
    if (!spaceId) {
      setInsights([]);
      return;
    }

    const loadInsights = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const dbInsights = await getInsightsForSpace(spaceId);
        // Convert DbInsight to Insight format
        // This is simplified - in production, you'd fetch associated data too
        setInsights(
          dbInsights.map(i => ({
            id: i.id,
            title: i.title,
            summary: i.summary,
            status: i.status,
            dateCreated: i.created_at,
            createdBy: i.created_by,
            assignedTo: i.assigned_to,
            tags: [], // Would be fetched from tag_associations
            sources: [], // Would be fetched from insight_sources
            comments: [], // Would be fetched from insight_comments
            folderId: i.folder_id,
          }))
        );
      } catch (err) {
        setError('Failed to load insights');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadInsights();
  }, [spaceId]);

  // Create a new insight
  const createInsight = useCallback(
    async (
      insightData: {
        title: string;
        summary: string;
        status: 'Open' | 'Closed';
        assignedTo?: string;
        folderId?: string;
      },
      tagIds: string[],
      sources: Array<{
        source_type: 'chat' | 'capture' | 'datasheet' | 'changelog';
        source_id: string;
        source_name: string;
        source_url?: string;
        chat_bubble_id?: string;
      }>
    ): Promise<Insight | null> => {
      if (!spaceId) {
        toast.error('No space selected');
        return null;
      }

      try {
        const dbInsight: Omit<DbInsight, 'id' | 'created_at'> = {
          ...insightData,
          created_by: 'current-user',
          space_id: spaceId,
        };

        const newDbInsight = await apiCreateInsight(dbInsight, tagIds, sources);
        
        const newInsight: Insight = {
          id: newDbInsight.id,
          title: newDbInsight.title,
          summary: newDbInsight.summary,
          status: newDbInsight.status,
          dateCreated: newDbInsight.created_at,
          createdBy: newDbInsight.created_by,
          assignedTo: newDbInsight.assigned_to,
          tags: tagIds,
          sources: sources.map((s, idx) => ({
            id: `source-${idx}`,
            type: s.source_type,
            name: s.source_name,
            url: s.source_url || '',
            chatBubbleId: s.chat_bubble_id,
          })),
          comments: [],
          folderId: newDbInsight.folder_id,
        };

        setInsights(prev => [newInsight, ...prev]);
        toast.success('Insight created!');
        return newInsight;
      } catch (err) {
        toast.error('Failed to create insight');
        console.error(err);
        return null;
      }
    },
    [spaceId]
  );

  // Update an insight
  const updateInsight = useCallback(
    async (
      insightId: string,
      updates: {
        title?: string;
        summary?: string;
        status?: 'Open' | 'Closed';
        assignedTo?: string;
        folderId?: string;
      }
    ): Promise<boolean> => {
      try {
        await apiUpdateInsight(insightId, updates);
        setInsights(prev =>
          prev.map(insight =>
            insight.id === insightId
              ? { ...insight, ...updates }
              : insight
          )
        );
        toast.success('Insight updated!');
        return true;
      } catch (err) {
        toast.error('Failed to update insight');
        console.error(err);
        return false;
      }
    },
    []
  );

  // Delete an insight
  const deleteInsight = useCallback(
    async (insightId: string): Promise<boolean> => {
      try {
        await apiDeleteInsight(insightId);
        setInsights(prev => prev.filter(insight => insight.id !== insightId));
        toast.success('Insight deleted!');
        return true;
      } catch (err) {
        toast.error('Failed to delete insight');
        console.error(err);
        return false;
      }
    },
    []
  );

  // Add a comment to an insight
  const addComment = useCallback(
    async (
      insightId: string,
      content: string,
      parentId?: string
    ): Promise<boolean> => {
      try {
        // Parse @mentions from content
        const mentions = parseMentions(content);
        const mentionedUserIds = mentions; // In production, map usernames to IDs

        const newComment = await addCommentToInsight(
          insightId,
          content,
          'current-user',
          parentId,
          mentionedUserIds
        );

        setInsights(prev =>
          prev.map(insight =>
            insight.id === insightId
              ? {
                  ...insight,
                  comments: [
                    ...insight.comments,
                    {
                      id: newComment.id,
                      content: newComment.content,
                      author: 'Current User', // Would map from author_id
                      createdAt: newComment.created_at,
                      mentions: mentionedUserIds,
                      parentId: newComment.parent_id,
                    },
                  ],
                }
              : insight
          )
        );

        toast.success('Comment added!');
        return true;
      } catch (err) {
        toast.error('Failed to add comment');
        console.error(err);
        return false;
      }
    },
    []
  );

  // Change insight status
  const changeStatus = useCallback(
    async (insightId: string, newStatus: 'Open' | 'Closed'): Promise<boolean> => {
      return updateInsight(insightId, { status: newStatus });
    },
    [updateInsight]
  );

  // Get insight by ID
  const getInsight = useCallback(
    (insightId: string): Insight | undefined => {
      return insights.find(insight => insight.id === insightId);
    },
    [insights]
  );

  return {
    insights,
    isLoading,
    error,
    createInsight,
    updateInsight,
    deleteInsight,
    addComment,
    changeStatus,
    getInsight,
  };
}

/**
 * Hook to get insights filtered by various criteria
 */
export function useInsightFilters(
  insights: Insight[],
  filters: {
    tags?: string[];
    folders?: string[];
    dateRange?: { start: Date; end: Date };
    people?: string[];
    status?: 'Open' | 'Closed';
    searchQuery?: string;
  }
) {
  const [filteredInsights, setFilteredInsights] = useState<Insight[]>(insights);

  useEffect(() => {
    let result = [...insights];

    // Tag filter
    if (filters.tags && filters.tags.length > 0) {
      result = result.filter(insight =>
        insight.tags.some(tagId => filters.tags!.includes(tagId))
      );
    }

    // Folder filter
    if (filters.folders && filters.folders.length > 0) {
      result = result.filter(insight =>
        insight.folderId && filters.folders!.includes(insight.folderId)
      );
    }

    // People filter
    if (filters.people && filters.people.length > 0) {
      result = result.filter(insight => {
        const involvedPeople = [insight.createdBy];
        if (insight.assignedTo) involvedPeople.push(insight.assignedTo);
        return involvedPeople.some(person => filters.people!.includes(person));
      });
    }

    // Status filter
    if (filters.status) {
      result = result.filter(insight => insight.status === filters.status);
    }

    // Date range filter
    if (filters.dateRange) {
      result = result.filter(
        insight =>
          insight.dateCreated >= filters.dateRange!.start &&
          insight.dateCreated <= filters.dateRange!.end
      );
    }

    // Search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(
        insight =>
          insight.title.toLowerCase().includes(query) ||
          insight.summary.toLowerCase().includes(query)
      );
    }

    setFilteredInsights(result);
  }, [insights, filters]);

  return filteredInsights;
}
