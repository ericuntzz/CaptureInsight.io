// Space type definition
// This file exists to provide the Space type for the application
// Space is essentially the same as Project but renamed for the Space-scoped architecture

import { Tag } from '../data/insightsData';

export interface Sheet {
  id: string;
  name: string;
  rowCount: number;
  lastModified: string;
  analysisType?: 'one-time' | 'scheduled' | 'llm-integration' | 'api' | null;
  llmProvider?: { id: string; name: string };
  schedule?: { frequency: string; time: string };
}

export interface Folder {
  id: string;
  name: string;
  sheets: Sheet[];
}

export interface Space {
  id: string;
  name: string;
  description?: string;
  folders: Folder[];
  goals?: string;
  instructions?: string;
  tags?: Tag[]; // Space-level tag management
}
