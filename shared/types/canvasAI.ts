export interface CanvasContext {
  title: string;
  notes: string;
  selection?: {
    text: string;
    start: number;
    end: number;
  };
}

export type QuickActionType = 'polish' | 'shorten' | 'expand' | 'simplify' | 'professional' | 'fix_grammar' | 'summarize';

export interface AIEditProposal {
  type: 'replace' | 'insert' | 'delete' | 'rewrite';
  targetType: 'title' | 'notes' | 'selection';
  originalText?: string;
  suggestedText: string;
  rationale: string;
}

export interface AICanvasResponse {
  response: string;
  editProposals?: AIEditProposal[];
  citations?: Array<{
    entityId: string;
    entityType: string;
    name: string;
    relevanceScore: number;
  }>;
}

export interface CanvasChatRequest {
  messages: Array<{ role: string; content: string }>;
  spaceId?: string;
  canvasContext?: CanvasContext;
  quickAction?: QuickActionType;
  useRag?: boolean;
}
