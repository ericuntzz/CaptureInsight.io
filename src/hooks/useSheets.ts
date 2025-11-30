import { useQuery } from '@tanstack/react-query';

export interface Sheet {
  id: string;
  name: string;
  workspaceId: string | null;
  spaceId: string;
  rowCount: number | null;
  lastModified: string | null;
  dataSourceType: string | null;
  dataSourceMeta: {
    preview?: string;
    url?: string;
    [key: string]: any;
  } | null;
  data: any;
  cleanedData: {
    type: 'tabular' | 'document' | 'metrics' | 'mixed';
    title?: string;
    description?: string;
    data: any[];
    metadata?: {
      sourceType: string;
      columnCount?: number;
      rowCount?: number;
      extractedAt: string;
      aiModel: string;
    };
  } | null;
  cleanedAt: string | null;
  cleaningStatus: 'pending' | 'processing' | 'completed' | 'failed' | null;
  encryptedData: string | null;
  encryptionIv: string | null;
  encryptionVersion: number | null;
  createdAt: string | null;
  createdBy: string | null;
}

export function useWorkspaceSheets(spaceId: string | null, workspaceId: string | null) {
  return useQuery<Sheet[]>({
    queryKey: ['/api/sheets', { spaceId, workspaceId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (spaceId) params.append('spaceId', spaceId);
      if (workspaceId) params.append('workspaceId', workspaceId);
      const res = await fetch(`/api/sheets?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch sheets');
      return res.json();
    },
    enabled: !!spaceId,
    staleTime: 0, // Always refetch to ensure deleted items don't reappear
    refetchOnMount: true,
  });
}

export function useSheets(spaceId: string | null) {
  return useWorkspaceSheets(spaceId, null);
}
