// Insight API functions for Supabase integration

import {
  DbInsight,
  DbInsightSource,
  DbInsightComment,
  DbCommentMention,
} from '../types/database';
import { Insight, mockInsights } from '../data/insightsData';

// ============================================================================
// INSIGHT CRUD OPERATIONS
// ============================================================================

/**
 * Get all insights for a space
 */
export async function getInsightsForSpace(spaceId: string): Promise<DbInsight[]> {
  // TODO: Replace with actual Supabase query
  // const { data, error } = await supabase
  //   .from('insights')
  //   .select(`
  //     *,
  //     sources:insight_sources(*),
  //     comments:insight_comments(*),
  //     tags:tag_associations!inner(tags(*))
  //   `)
  //   .eq('space_id', spaceId)
  //   .order('created_at', { ascending: false });
  
  // Mock implementation
  return mockInsights.map(insight => ({
    id: insight.id,
    title: insight.title,
    summary: insight.summary,
    status: insight.status,
    created_at: insight.dateCreated,
    created_by: insight.createdBy,
    assigned_to: insight.assignedTo,
    space_id: spaceId,
    folder_id: insight.folderId,
  })) as DbInsight[];
}

/**
 * Get a single insight by ID
 */
export async function getInsightById(insightId: string): Promise<DbInsight | null> {
  // TODO: Replace with actual Supabase query
  // const { data, error } = await supabase
  //   .from('insights')
  //   .select(`
  //     *,
  //     sources:insight_sources(*),
  //     comments:insight_comments(*),
  //     tags:tag_associations!inner(tags(*))
  //   `)
  //   .eq('id', insightId)
  //   .single();
  
  // Mock implementation
  const insight = mockInsights.find(i => i.id === insightId);
  if (!insight) return null;
  
  return {
    id: insight.id,
    title: insight.title,
    summary: insight.summary,
    status: insight.status,
    created_at: insight.dateCreated,
    created_by: insight.createdBy,
    assigned_to: insight.assignedTo,
    space_id: 'mock-space',
    folder_id: insight.folderId,
  };
}

/**
 * Create a new insight
 */
export async function createInsight(
  insight: Omit<DbInsight, 'id' | 'created_at'>,
  tagIds: string[],
  sources: Omit<DbInsightSource, 'id' | 'created_at' | 'insight_id'>[]
): Promise<DbInsight> {
  // TODO: Replace with actual Supabase query
  // This should be a transaction:
  // 1. Insert into insights table
  // 2. Insert into insight_sources table
  // 3. Insert into tag_associations table
  
  // const { data: newInsight, error: insightError } = await supabase
  //   .from('insights')
  //   .insert(insight)
  //   .select()
  //   .single();
  //
  // const { error: sourcesError } = await supabase
  //   .from('insight_sources')
  //   .insert(sources.map(s => ({ ...s, insight_id: newInsight.id })));
  //
  // const { error: tagsError } = await supabase
  //   .from('tag_associations')
  //   .insert(tagIds.map(tagId => ({
  //     tag_id: tagId,
  //     entity_type: 'insight',
  //     entity_id: newInsight.id,
  //     created_by: insight.created_by,
  //   })));
  
  // Mock implementation
  const newInsight: DbInsight = {
    ...insight,
    id: `insight-${Date.now()}`,
    created_at: new Date(),
  };
  
  return newInsight;
}

/**
 * Update an insight
 */
export async function updateInsight(
  insightId: string,
  updates: Partial<Omit<DbInsight, 'id' | 'created_at' | 'created_by' | 'space_id'>>
): Promise<DbInsight | null> {
  // TODO: Replace with actual Supabase query
  // const { data, error } = await supabase
  //   .from('insights')
  //   .update(updates)
  //   .eq('id', insightId)
  //   .select()
  //   .single();
  
  // Mock implementation
  console.log('Updating insight:', insightId, updates);
  return null;
}

/**
 * Delete an insight (cascade will handle sources and comments)
 */
export async function deleteInsight(insightId: string): Promise<void> {
  // TODO: Replace with actual Supabase query
  // const { error } = await supabase
  //   .from('insights')
  //   .delete()
  //   .eq('id', insightId);
  
  // Mock implementation
  console.log('Deleting insight:', insightId);
}

// ============================================================================
// INSIGHT SOURCES
// ============================================================================

/**
 * Add sources to an insight
 */
export async function addSourcesToInsight(
  insightId: string,
  sources: Omit<DbInsightSource, 'id' | 'created_at' | 'insight_id'>[]
): Promise<DbInsightSource[]> {
  // TODO: Replace with actual Supabase query
  // const { data, error } = await supabase
  //   .from('insight_sources')
  //   .insert(sources.map(s => ({ ...s, insight_id: insightId })))
  //   .select();
  
  // Mock implementation
  return sources.map(s => ({
    ...s,
    id: `source-${Date.now()}`,
    insight_id: insightId,
    created_at: new Date(),
  }));
}

/**
 * Remove a source from an insight
 */
export async function removeSourceFromInsight(sourceId: string): Promise<void> {
  // TODO: Replace with actual Supabase query
  // const { error } = await supabase
  //   .from('insight_sources')
  //   .delete()
  //   .eq('id', sourceId);
  
  // Mock implementation
  console.log('Removing source:', sourceId);
}

// ============================================================================
// INSIGHT COMMENTS
// ============================================================================

/**
 * Add a comment to an insight
 */
export async function addCommentToInsight(
  insightId: string,
  content: string,
  authorId: string,
  parentId?: string,
  mentionedUserIds?: string[]
): Promise<DbInsightComment> {
  // TODO: Replace with actual Supabase query
  // This should be a transaction:
  // 1. Insert into insight_comments table
  // 2. Insert into comment_mentions table for each mention
  
  // const { data: newComment, error: commentError } = await supabase
  //   .from('insight_comments')
  //   .insert({
  //     insight_id: insightId,
  //     content,
  //     author_id: authorId,
  //     parent_id: parentId,
  //   })
  //   .select()
  //   .single();
  //
  // if (mentionedUserIds && mentionedUserIds.length > 0) {
  //   const { error: mentionsError } = await supabase
  //     .from('comment_mentions')
  //     .insert(mentionedUserIds.map(userId => ({
  //       comment_id: newComment.id,
  //       mentioned_user_id: userId,
  //     })));
  // }
  
  // Mock implementation
  const newComment: DbInsightComment = {
    id: `comment-${Date.now()}`,
    insight_id: insightId,
    content,
    author_id: authorId,
    parent_id: parentId,
    created_at: new Date(),
  };
  
  return newComment;
}

/**
 * Update a comment
 */
export async function updateComment(
  commentId: string,
  content: string
): Promise<DbInsightComment | null> {
  // TODO: Replace with actual Supabase query
  // const { data, error } = await supabase
  //   .from('insight_comments')
  //   .update({ content, updated_at: new Date() })
  //   .eq('id', commentId)
  //   .select()
  //   .single();
  
  // Mock implementation
  console.log('Updating comment:', commentId, content);
  return null;
}

/**
 * Delete a comment
 */
export async function deleteComment(commentId: string): Promise<void> {
  // TODO: Replace with actual Supabase query
  // const { error } = await supabase
  //   .from('insight_comments')
  //   .delete()
  //   .eq('id', commentId);
  
  // Mock implementation
  console.log('Deleting comment:', commentId);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse @mentions from comment content
 */
export function parseMentions(content: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1]);
  }
  
  return mentions;
}

/**
 * Get insights by status
 */
export async function getInsightsByStatus(
  spaceId: string,
  status: 'Open' | 'Closed'
): Promise<DbInsight[]> {
  // TODO: Replace with actual Supabase query
  // const { data, error } = await supabase
  //   .from('insights')
  //   .select('*')
  //   .eq('space_id', spaceId)
  //   .eq('status', status)
  //   .order('created_at', { ascending: false });
  
  // Mock implementation
  const allInsights = await getInsightsForSpace(spaceId);
  return allInsights.filter(i => i.status === status);
}

/**
 * Get insights assigned to a user
 */
export async function getInsightsAssignedToUser(
  spaceId: string,
  userId: string
): Promise<DbInsight[]> {
  // TODO: Replace with actual Supabase query
  // const { data, error } = await supabase
  //   .from('insights')
  //   .select('*')
  //   .eq('space_id', spaceId)
  //   .eq('assigned_to', userId)
  //   .order('created_at', { ascending: false });
  
  // Mock implementation
  const allInsights = await getInsightsForSpace(spaceId);
  return allInsights.filter(i => i.assigned_to === userId);
}

/**
 * Get insights in a folder
 */
export async function getInsightsInFolder(
  spaceId: string,
  folderId: string
): Promise<DbInsight[]> {
  // TODO: Replace with actual Supabase query
  // const { data, error } = await supabase
  //   .from('insights')
  //   .select('*')
  //   .eq('space_id', spaceId)
  //   .eq('folder_id', folderId)
  //   .order('created_at', { ascending: false });
  
  // Mock implementation
  const allInsights = await getInsightsForSpace(spaceId);
  return allInsights.filter(i => i.folder_id === folderId);
}
