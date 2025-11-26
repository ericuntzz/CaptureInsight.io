// React hooks for tag operations
// Uses React state for now, will integrate with Supabase when backend is connected

import { useState, useEffect, useCallback } from 'react';
import { Tag, mockTags, TAG_COLORS } from '../data/insightsData';
import { DbTag, DbTagAssociation } from '../types/database';
import { toast } from 'sonner@2.0.3';
import {
  getTagsForSpace,
  createTag as apiCreateTag,
  updateTag as apiUpdateTag,
  deleteTag as apiDeleteTag,
  addTagsToEntity,
  removeTagsFromEntity,
  getTagUsageStats as apiGetTagUsageStats,
} from '../api/tags';
import { validateTagName, getNextTagColor } from '../utils/tagUtils';

/**
 * Hook to manage tags for a space
 */
export function useTags(spaceId: string | null) {
  const [tags, setTags] = useState<Tag[]>(mockTags);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load tags when space changes
  useEffect(() => {
    if (!spaceId) {
      setTags([]);
      return;
    }

    const loadTags = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const dbTags = await getTagsForSpace(spaceId);
        setTags(
          dbTags.map(t => ({
            id: t.id,
            name: t.name,
            color: t.color,
            createdAt: t.created_at,
            createdBy: t.created_by,
          }))
        );
      } catch (err) {
        setError('Failed to load tags');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTags();
  }, [spaceId]);

  // Create a new tag
  const createTag = useCallback(
    async (name: string, color?: string): Promise<Tag | null> => {
      if (!spaceId) {
        toast.error('No space selected');
        return null;
      }

      // Validate tag name - now space-scoped
      const validation = validateTagName(name, spaceId, tags);
      if (!validation.isValid) {
        toast.error(validation.error || 'Invalid tag name');
        return null;
      }

      const tagColor = color || getNextTagColor(tags);
      
      try {
        const dbTag = await apiCreateTag(name, tagColor, spaceId, 'current-user');
        const newTag: Tag = {
          id: dbTag.id,
          name: dbTag.name,
          color: dbTag.color,
          createdAt: dbTag.created_at,
          createdBy: dbTag.created_by,
          spaceId, // Added: Include spaceId in the Tag object
        };
        
        setTags(prev => [...prev, newTag]);
        toast.success(`Tag "${name}" created!`);
        return newTag;
      } catch (err) {
        toast.error('Failed to create tag');
        console.error(err);
        return null;
      }
    },
    [spaceId, tags]
  );

  // Update a tag
  const updateTag = useCallback(
    async (tagId: string, updates: { name?: string; color?: string }): Promise<boolean> => {
      if (!spaceId) {
        toast.error('No space selected');
        return false;
      }

      // Validate if updating name - now space-scoped
      if (updates.name) {
        const validation = validateTagName(updates.name, spaceId, tags, tagId);
        if (!validation.isValid) {
          toast.error(validation.error || 'Invalid tag name');
          return false;
        }
      }

      try {
        await apiUpdateTag(tagId, updates);
        setTags(prev =>
          prev.map(tag =>
            tag.id === tagId ? { ...tag, ...updates } : tag
          )
        );
        toast.success('Tag updated!');
        return true;
      } catch (err) {
        toast.error('Failed to update tag');
        console.error(err);
        return false;
      }
    },
    [spaceId, tags]
  );

  // Delete a tag
  const deleteTag = useCallback(
    async (tagId: string): Promise<boolean> => {
      try {
        await apiDeleteTag(tagId);
        setTags(prev => prev.filter(tag => tag.id !== tagId));
        return true;
      } catch (err) {
        toast.error('Failed to delete tag');
        console.error(err);
        return false;
      }
    },
    []
  );

  // Get tag by ID
  const getTagById = useCallback(
    (tagId: string): Tag | undefined => {
      return tags.find(tag => tag.id === tagId);
    },
    [tags]
  );

  // Get multiple tags by IDs
  const getTagsByIds = useCallback(
    (tagIds: string[]): Tag[] => {
      return tags.filter(tag => tagIds.includes(tag.id));
    },
    [tags]
  );

  return {
    tags,
    isLoading,
    error,
    createTag,
    updateTag,
    deleteTag,
    getTagById,
    getTagsByIds,
  };
}

/**
 * Hook to manage tags for a specific entity
 */
export function useEntityTags(
  entityType: 'chat_message' | 'data_sheet' | 'change_log' | 'insight',
  entityId: string | null
) {
  const [entityTags, setEntityTags] = useState<string[]>([]);

  // Add tags to entity
  const addTags = useCallback(
    async (tagIds: string[]): Promise<boolean> => {
      if (!entityId) return false;

      try {
        await addTagsToEntity(tagIds, entityType, entityId, 'current-user');
        setEntityTags(prev => [...new Set([...prev, ...tagIds])]);
        toast.success('Tags added!');
        return true;
      } catch (err) {
        toast.error('Failed to add tags');
        console.error(err);
        return false;
      }
    },
    [entityType, entityId]
  );

  // Remove tags from entity
  const removeTags = useCallback(
    async (tagIds: string[]): Promise<boolean> => {
      if (!entityId) return false;

      try {
        await removeTagsFromEntity(tagIds, entityType, entityId);
        setEntityTags(prev => prev.filter(id => !tagIds.includes(id)));
        toast.success('Tags removed!');
        return true;
      } catch (err) {
        toast.error('Failed to remove tags');
        console.error(err);
        return false;
      }
    },
    [entityType, entityId]
  );

  // Set tags (replace all)
  const setTags = useCallback(
    async (tagIds: string[]): Promise<boolean> => {
      if (!entityId) return false;

      const toRemove = entityTags.filter(id => !tagIds.includes(id));
      const toAdd = tagIds.filter(id => !entityTags.includes(id));

      try {
        if (toRemove.length > 0) {
          await removeTagsFromEntity(toRemove, entityType, entityId);
        }
        if (toAdd.length > 0) {
          await addTagsToEntity(toAdd, entityType, entityId, 'current-user');
        }
        setEntityTags(tagIds);
        return true;
      } catch (err) {
        toast.error('Failed to update tags');
        console.error(err);
        return false;
      }
    },
    [entityType, entityId, entityTags]
  );

  return {
    entityTags,
    addTags,
    removeTags,
    setTags,
  };
}

/**
 * Hook to get tag usage statistics
 */
export function useTagUsage(tagId: string | null, spaceId: string | null) {
  const [usage, setUsage] = useState({
    insightsCount: 0,
    dataSheetsCount: 0,
    chatMessagesCount: 0,
    changeLogsCount: 0,
    totalCount: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!tagId || !spaceId) {
      setUsage({
        insightsCount: 0,
        dataSheetsCount: 0,
        chatMessagesCount: 0,
        changeLogsCount: 0,
        totalCount: 0,
      });
      return;
    }

    const loadUsage = async () => {
      setIsLoading(true);
      try {
        const stats = await apiGetTagUsageStats(tagId, spaceId);
        setUsage(stats);
      } catch (err) {
        console.error('Failed to load tag usage:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadUsage();
  }, [tagId, spaceId]);

  return { usage, isLoading };
}