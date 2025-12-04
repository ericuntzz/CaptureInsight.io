import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ColumnSchema {
  columns: Array<{
    canonicalName: string;
    displayName: string;
    position: number;
    dataType: 'currency' | 'percentage' | 'integer' | 'decimal' | 'date' | 'text' | 'boolean';
    isRequired: boolean;
    validationRules?: {
      format?: string;
      min?: number;
      max?: number;
      maxLength?: number;
      pattern?: string;
      allowedValues?: string[];
    };
  }>;
}

export interface CleaningPipeline {
  steps: Array<{
    id: string;
    type: 'remove_commas' | 'strip_currency' | 'convert_percentage' | 'trim_whitespace' | 'convert_date_format' | 'remove_duplicates' | 'fill_empty' | 'custom';
    enabled: boolean;
    config?: {
      targetColumns?: string[];
      fromFormat?: string;
      toFormat?: string;
      percentageMode?: 'decimal' | 'whole';
      fillValue?: string;
      customRule?: string;
    };
  }>;
}

export interface MatchingConfig {
  autoApplyThreshold: number;
  suggestThreshold: number;
  featureWeights: {
    columnNameSimilarity: number;
    columnTypeMatch: number;
    sourceFingerprint: number;
    statisticalProfile: number;
  };
}

export interface DataTemplate {
  id: string;
  name: string;
  description: string | null;
  scope: 'workspace' | 'space';
  workspaceId: string | null;
  spaceId: string | null;
  createdBy: string | null;
  sourceType: string | null;
  sourceFingerprint: {
    googleSheetId?: string;
    urlPatterns?: string[];
    fileNamePatterns?: string[];
  } | null;
  columnSchema: ColumnSchema | null;
  columnAliases: Record<string, string[]> | null;
  cleaningPipeline: CleaningPipeline | null;
  aiPromptHints: string | null;
  matchingConfig: MatchingConfig | null;
  statisticalProfile: {
    rowCountRange: [number, number];
    columnCount: number;
    columnSignatures: Record<string, {
      nullRatio: number;
      uniqueRatio: number;
      sampleValues: string[];
      patternType?: string;
    }>;
  } | null;
  usageCount: number | null;
  lastUsedAt: string | null;
  version: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface TemplateMatchResult {
  template: DataTemplate;
  confidence: number;
  recommendation: 'auto-apply' | 'suggest' | 'none';
  matchDetails: {
    columnNameSimilarity: number;
    columnTypeMatch: number;
    sourceFingerprint: number;
    statisticalProfile: number;
  };
}

export function useTemplates(workspaceId: string | null, spaceId: string | null) {
  return useQuery<DataTemplate[]>({
    queryKey: ['/api/templates/available', { workspaceId, spaceId }],
    queryFn: async () => {
      if (!workspaceId || !spaceId) return [];
      const params = new URLSearchParams();
      params.append('workspaceId', workspaceId);
      params.append('spaceId', spaceId);
      const res = await fetch(`/api/templates/available?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch templates');
      return res.json();
    },
    enabled: !!workspaceId && !!spaceId,
    staleTime: 30000,
  });
}

export function useWorkspaceTemplates(workspaceId: string | null) {
  return useQuery<DataTemplate[]>({
    queryKey: ['/api/workspaces', workspaceId, 'templates'],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await fetch(`/api/workspaces/${workspaceId}/templates`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch workspace templates');
      return res.json();
    },
    enabled: !!workspaceId,
    staleTime: 30000,
  });
}

export function useSpaceTemplates(spaceId: string | null) {
  return useQuery<DataTemplate[]>({
    queryKey: ['/api/spaces', spaceId, 'templates'],
    queryFn: async () => {
      if (!spaceId) return [];
      const res = await fetch(`/api/spaces/${spaceId}/templates`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch space templates');
      return res.json();
    },
    enabled: !!spaceId,
    staleTime: 30000,
  });
}

export function useTemplate(id: string | null) {
  return useQuery<DataTemplate>({
    queryKey: ['/api/templates', id],
    queryFn: async () => {
      if (!id) throw new Error('Template ID is required');
      const res = await fetch(`/api/templates/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch template');
      return res.json();
    },
    enabled: !!id,
    staleTime: 30000,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      workspaceId: string;
      name: string;
      description?: string;
      scope?: 'workspace' | 'space';
      sourceType?: string;
      columnSchema?: ColumnSchema;
      cleaningPipeline?: CleaningPipeline;
      aiPromptHints?: string;
    }) => {
      const res = await fetch(`/api/workspaces/${data.workspaceId}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create template');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['/api/spaces'] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      name?: string;
      description?: string;
      scope?: 'workspace' | 'space';
      sourceType?: string;
      columnSchema?: ColumnSchema;
      cleaningPipeline?: CleaningPipeline;
      aiPromptHints?: string;
    }) => {
      const res = await fetch(`/api/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update template');
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/templates', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['/api/spaces'] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/templates/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to delete template');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['/api/spaces'] });
    },
  });
}

export function useApplyTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ templateId, sheetId }: { templateId: string; sheetId: string }) => {
      const res = await fetch(`/api/templates/${templateId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sheetId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to apply template');
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sheets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/templates', variables.templateId] });
    },
  });
}

export function useMatchTemplate(sheetId: string | null) {
  return useQuery<TemplateMatchResult[]>({
    queryKey: ['/api/templates/match', { sheetId }],
    queryFn: async () => {
      if (!sheetId) return [];
      const res = await fetch(`/api/templates/match?sheetId=${sheetId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to match templates');
      return res.json();
    },
    enabled: !!sheetId,
    staleTime: 60000,
  });
}

export function useMatchTemplateWithData() {
  return useMutation({
    mutationFn: async ({ 
      data, 
      workspaceId, 
      spaceId, 
      sourceUrl, 
      fileName 
    }: { 
      data: Record<string, any>[];
      workspaceId: string;
      spaceId: string;
      sourceUrl?: string;
      fileName?: string;
    }) => {
      const res = await fetch('/api/templates/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ data, workspaceId, spaceId, sourceUrl, fileName }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to match templates');
      }
      return res.json() as Promise<TemplateMatchResult[]>;
    },
  });
}
