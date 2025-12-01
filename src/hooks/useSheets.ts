import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface QualityDetails {
  confidence: number; // 0-100: How confident AI is in extraction
  completeness: number; // 0-100: Data completeness (no missing values)
  dataRichness: number; // 0-100: Amount of useful data found
  issues?: string[]; // List of quality issues found
}

export interface ValidationResult {
  isValid: boolean;
  failureType?: 'empty_image' | 'low_quality' | 'unsupported_format' | 'no_data_found' | 'ai_error' | 'parse_error' | 'file_too_small';
  message?: string;
  warnings?: string[];
  details?: {
    textDensity?: number;
    contrast?: number;
    fileSize?: number;
    dimensions?: { width: number; height: number };
    colorVariance?: number;
  };
}

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
  // Quality scoring fields
  qualityScore: number | null; // 0-100 overall quality
  qualityDetails: QualityDetails | null;
  validationResult: ValidationResult | null;
  encryptedData: string | null;
  encryptionIv: string | null;
  encryptionVersion: number | null;
  createdAt: string | null;
  createdBy: string | null;
}

export function useWorkspaceSheets(spaceId: string | null, workspaceId: string | null) {
  const query = useQuery<Sheet[]>({
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
    staleTime: 0,
    refetchOnMount: true,
    refetchInterval: (query) => {
      const sheets = query.state.data;
      if (!sheets) return false;
      const hasPendingSheets = sheets.some(
        (sheet: Sheet) => sheet.cleaningStatus === 'pending' || sheet.cleaningStatus === 'processing'
      );
      return hasPendingSheets ? 3000 : false;
    },
  });
  return query;
}

export function useSheets(spaceId: string | null) {
  return useWorkspaceSheets(spaceId, null);
}

export function useUpdateSheetCleanedData() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ sheetId, cleanedData }: { sheetId: string; cleanedData: any }) => {
      const res = await fetch(`/api/sheets/${sheetId}/cleaned-data`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cleanedData }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update cleaned data');
      }
      return res.json();
    },
    onMutate: async ({ sheetId, cleanedData }) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ['/api/sheets'] });
      
      // Snapshot the previous value
      const previousSheets = queryClient.getQueriesData<Sheet[]>({ queryKey: ['/api/sheets'] });
      
      // Optimistically update all matching queries
      queryClient.setQueriesData<Sheet[]>({ queryKey: ['/api/sheets'] }, (old) => {
        if (!old) return old;
        return old.map(sheet => 
          sheet.id === sheetId 
            ? { ...sheet, cleanedData } 
            : sheet
        );
      });
      
      return { previousSheets };
    },
    onError: (_err, _variables, context) => {
      // Rollback to the previous value on error
      if (context?.previousSheets) {
        context.previousSheets.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure server state is synced
      queryClient.invalidateQueries({ queryKey: ['/api/sheets'] });
    },
  });
}

export function useRetrySheetProcessing() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (sheetId: string) => {
      const res = await fetch(`/api/sheets/${sheetId}/retry`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to retry processing');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sheets'] });
    },
  });
}
