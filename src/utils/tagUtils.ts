// Utility functions for tag management

import { Tag, TAG_COLORS } from '../data/insightsData';

/**
 * Get the next color to assign to a new tag based on existing tags
 */
export function getNextTagColor(existingTags: Tag[]): string {
  const colorIndex = existingTags.length % TAG_COLORS.length;
  return TAG_COLORS[colorIndex];
}

/**
 * Create a new tag with auto-assigned color
 * Tags are space-scoped for proper isolation
 */
export function createTag(name: string, createdBy: string, spaceId: string, existingTags: Tag[]): Tag {
  const color = getNextTagColor(existingTags);
  return {
    id: `tag-${Date.now()}`,
    name: name.trim(),
    color,
    createdAt: new Date(),
    createdBy,
    spaceId, // Added: Space association for proper scoping
  };
}

/**
 * Check if tag name already exists within a space (case-insensitive)
 * Only checks within the specified space for proper isolation
 */
export function tagNameExists(name: string, spaceId: string, existingTags: Tag[]): boolean {
  const normalizedName = name.trim().toLowerCase();
  return existingTags.some((tag) => 
    tag.spaceId === spaceId && tag.name.toLowerCase() === normalizedName
  );
}

/**
 * Get tag usage statistics across all entities
 * This would typically query the database, but for now returns mock data
 */
export interface TagUsageStats {
  insightsCount: number;
  dataSheetsCount: number;
  chatMessagesCount: number;
  changeLogsCount: number;
  totalCount: number;
}

/**
 * Calculate tag usage across the application
 * In production, this should query the tag_associations table
 */
export function getTagUsageStats(
  tagId: string,
  insights: any[],
  dataSheets?: any[],
  chatMessages?: any[],
  changeLogs?: any[]
): TagUsageStats {
  const insightsCount = insights.filter((insight) => insight.tags.includes(tagId)).length;
  
  // In real implementation, query data_sheets, chat_messages, change_logs tables
  const dataSheetsCount = dataSheets?.filter((sheet) => sheet.tags?.includes(tagId)).length || 0;
  const chatMessagesCount = chatMessages?.filter((msg) => msg.tags?.includes(tagId)).length || 0;
  const changeLogsCount = changeLogs?.filter((log) => log.tags?.includes(tagId)).length || 0;

  return {
    insightsCount,
    dataSheetsCount,
    chatMessagesCount,
    changeLogsCount,
    totalCount: insightsCount + dataSheetsCount + chatMessagesCount + changeLogsCount,
  };
}

/**
 * Validate tag name
 * Ensures uniqueness within the space scope only
 */
export interface TagValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateTagName(
  name: string, 
  spaceId: string, 
  existingTags: Tag[], 
  currentTagId?: string
): TagValidationResult {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return { isValid: false, error: 'Tag name cannot be empty' };
  }

  if (trimmedName.length < 2) {
    return { isValid: false, error: 'Tag name must be at least 2 characters' };
  }

  if (trimmedName.length > 30) {
    return { isValid: false, error: 'Tag name must be less than 30 characters' };
  }

  // Check for duplicate names within the same space (case-insensitive), excluding current tag if editing
  const normalizedName = trimmedName.toLowerCase();
  const duplicate = existingTags.find((tag) => 
    tag.spaceId === spaceId &&
    tag.name.toLowerCase() === normalizedName && 
    tag.id !== currentTagId
  );

  if (duplicate) {
    return { isValid: false, error: 'A tag with this name already exists' };
  }

  return { isValid: true };
}

/**
 * Remove tag from all entities (cascade delete)
 */
export function cascadeDeleteTag(tagId: string, entities: {
  insights: any[];
  dataSheets?: any[];
  chatMessages?: any[];
  changeLogs?: any[];
}): void {
  // Remove tag from insights
  entities.insights.forEach((insight) => {
    if (insight.tags?.includes(tagId)) {
      insight.tags = insight.tags.filter((id: string) => id !== tagId);
    }
  });

  // Remove tag from data sheets
  entities.dataSheets?.forEach((sheet) => {
    if (sheet.tags?.includes(tagId)) {
      sheet.tags = sheet.tags.filter((id: string) => id !== tagId);
    }
  });

  // Remove tag from chat messages
  entities.chatMessages?.forEach((msg) => {
    if (msg.tags?.includes(tagId)) {
      msg.tags = msg.tags.filter((id: string) => id !== tagId);
    }
  });

  // Remove tag from change logs
  entities.changeLogs?.forEach((log) => {
    if (log.tags?.includes(tagId)) {
      log.tags = log.tags.filter((id: string) => id !== tagId);
    }
  });
}

/**
 * Filter tags by space
 * Helper to get only tags belonging to a specific space
 */
export function filterTagsBySpace(tags: Tag[], spaceId: string): Tag[] {
  return tags.filter((tag) => tag.spaceId === spaceId);
}

/**
 * Get tag by ID
 * Helper to safely retrieve a tag
 */
export function getTagById(tagId: string, tags: Tag[]): Tag | undefined {
  return tags.find((tag) => tag.id === tagId);
}

/**
 * Get multiple tags by IDs
 * Helper to retrieve multiple tags at once
 */
export function getTagsByIds(tagIds: string[], tags: Tag[]): Tag[] {
  return tags.filter((tag) => tagIds.includes(tag.id));
}