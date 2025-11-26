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
  folder_id: string;
  created_at: Date;
  created_by: string;
  source_file_id?: string; // Link back to original capture
  tags?: string[]; // Array of tag IDs
  data: any[][]; // Spreadsheet data
}

// Change Log with tags
export interface DbChangeLog {
  id: string;
  title: string;
  description: string;
  space_id: string;
  folder_id?: string;
  created_at: Date;
  created_by: string;
  tags?: string[]; // Array of tag IDs
  changes: any[]; // Array of change objects
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

// Unified tagged item result (for search)
export interface TaggedItem {
  entity_type: 'chat_message' | 'data_sheet' | 'change_log' | 'insight';
  entity_id: string;
  entity_name: string;
  entity_preview?: string;
  tags: DbTag[];
  created_at: Date;
  created_by: string;
  space_id: string;
  folder_id?: string;
}

// Search filters
export interface TagSearchFilters {
  tags?: string[]; // Tag IDs
  folders?: string[];
  dateRange?: { start: Date; end: Date };
  people?: string[]; // User IDs
  entityTypes?: ('chat_message' | 'data_sheet' | 'change_log' | 'insight')[];
  searchQuery?: string;
  spaceId: string;
}
