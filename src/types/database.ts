// Database types matching Supabase schema for Insights system

export interface DbTag {
  id: string;
  name: string;
  color: string;
  created_at: Date;
  created_by: string;
  space_id: string;
}

export interface DbTagAssociation {
  id: string;
  tag_id: string;
  entity_type: 'chat_message' | 'data_sheet' | 'change_log' | 'insight';
  entity_id: string;
  created_at: Date;
  created_by: string;
}

export interface DbInsight {
  id: string;
  title: string;
  summary: string;
  status: 'Open' | 'Closed';
  created_at: Date;
  created_by: string;
  assigned_to?: string;
  space_id: string;
  workspace_id?: string;
  folder_id?: string;
}

export interface DbInsightSource {
  id: string;
  insight_id: string;
  source_type: 'chat' | 'capture' | 'datasheet' | 'changelog';
  source_id: string;
  source_name: string;
  source_url?: string;
  chat_bubble_id?: string;
  created_at: Date;
}

export interface DbInsightComment {
  id: string;
  insight_id: string;
  content: string;
  author_id: string;
  parent_id?: string;
  created_at: Date;
  updated_at?: Date;
}

export interface DbCommentMention {
  id: string;
  comment_id: string;
  mentioned_user_id: string;
  created_at: Date;
}

// Data Sheet with tags
export interface DbDataSheet {
  id: string;
  name: string;
  space_id: string;
  workspace_id: string;
  folder_id?: string;
  created_at: Date;
  created_by: string;
  source_file_id?: string;
  tags?: string[];
  data: any[][];
}

// Change Log with tags
export interface DbChangeLog {
  id: string;
  title: string;
  description: string;
  space_id: string;
  workspace_id?: string;
  folder_id?: string;
  created_at: Date;
  created_by: string;
  tags?: string[];
  changes: any[];
}

// Chat Message with tags
export interface DbChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  space_id: string;
  created_at: Date;
  tags?: string[]; // Array of tag IDs
  insight_id?: string; // Link to created insight
}

export interface TaggedItem {
  entity_type: 'chat_message' | 'data_sheet' | 'change_log' | 'insight';
  entity_id: string;
  entity_name: string;
  entity_preview?: string;
  tags: DbTag[];
  created_at: Date;
  created_by: string;
  space_id: string;
  workspace_id?: string;
  folder_id?: string;
}

export interface TagSearchFilters {
  tags?: string[];
  workspaces?: string[];
  folders?: string[];
  dateRange?: { start: Date; end: Date };
  people?: string[];
  entityTypes?: ('chat_message' | 'data_sheet' | 'change_log' | 'insight')[];
  searchQuery?: string;
  spaceId: string;
}
