import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import type { Space as UISpace, Workspace as UIWorkspace, Sheet as UISheet } from "../components/SpaceBrowser";
import type { Tag } from "../data/insightsData";

interface APISpace {
  id: string;
  name: string;
  description?: string | null;
  goals?: string | null;
  instructions?: string | null;
  ownerId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  workspaces: APIWorkspace[];
  tags: APITag[];
}

interface APIWorkspace {
  id: string;
  name: string;
  spaceId: string;
  sheets: APISheet[];
}

interface APISheet {
  id: string;
  name: string;
  rowCount?: number;
  lastModified?: string;
  dataSourceType?: string;
  dataSourceMeta?: any;
}

interface APITag {
  id: string;
  name: string;
  color: string;
  createdAt?: Date | string;
  createdBy?: string;
  spaceId: string;
}

function transformAPISpaceToUISpace(apiSpace: APISpace): UISpace {
  const workspaces = (apiSpace.workspaces || []).map((workspace): UIWorkspace => ({
    id: workspace.id,
    name: workspace.name,
    sheets: (workspace.sheets || []).map((sheet): UISheet => ({
      id: sheet.id,
      name: sheet.name,
      rowCount: sheet.rowCount ?? 0,
      lastModified: sheet.lastModified ?? "Never",
      dataSource: sheet.dataSourceMeta ? {
        type: sheet.dataSourceType as 'screenshot' | 'link' | 'file',
        name: sheet.name,
        captureDate: new Date(),
        capturedBy: '',
        folder: workspace.name,
        space: apiSpace.name,
        tags: [],
        ...sheet.dataSourceMeta,
      } : undefined,
    })),
  }));
  
  return {
    id: apiSpace.id,
    name: apiSpace.name,
    description: apiSpace.description ?? undefined,
    goals: apiSpace.goals ?? undefined,
    instructions: apiSpace.instructions ?? undefined,
    workspaces: workspaces,
    folders: workspaces,
    tags: (apiSpace.tags || []).map((tag): Tag => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      createdAt: tag.createdAt ? new Date(tag.createdAt) : new Date(),
      createdBy: tag.createdBy ?? '',
      spaceId: tag.spaceId,
    })),
  };
}

export function useSpaces() {
  return useQuery<UISpace[], Error, UISpace[]>({
    queryKey: ["/api/spaces"],
    select: (data: any) => {
      if (!Array.isArray(data)) return [];
      return data.map(transformAPISpaceToUISpace);
    },
  });
}

export function useSpace(id: string | null) {
  return useQuery<UISpace>({
    queryKey: ["/api/spaces/" + id],
    enabled: !!id,
    select: (data: any) => transformAPISpaceToUISpace(data),
  });
}

export function useCreateSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; goals?: string; instructions?: string }) => {
      const res = await apiRequest("POST", "/api/spaces", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces"] });
    },
  });
}

export function useUpdateSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string; goals?: string; instructions?: string } }) => {
      const res = await apiRequest("PUT", `/api/spaces/${id}`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces"] });
      queryClient.invalidateQueries({ queryKey: ["/api/spaces/" + variables.id] });
    },
  });
}

export function useDeleteSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/spaces/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces"] });
    },
  });
}

export function useWorkspaces(spaceId: string | null) {
  return useQuery<UIWorkspace[]>({
    queryKey: ["/api/spaces/" + spaceId + "/workspaces"],
    enabled: !!spaceId,
  });
}

export function useFolders(spaceId: string | null) {
  return useWorkspaces(spaceId);
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ spaceId, name }: { spaceId: string; name: string; onOptimisticId?: (tempId: string) => void }) => {
      const res = await apiRequest("POST", `/api/spaces/${spaceId}/workspaces`, { name });
      return res.json();
    },
    // Optimistic update - add workspace immediately for instant feedback
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["/api/spaces/" + variables.spaceId + "/workspaces"] });
      await queryClient.cancelQueries({ queryKey: ["/api/spaces"] });
      
      const previousWorkspaces = queryClient.getQueryData<UIWorkspace[]>(
        ["/api/spaces/" + variables.spaceId + "/workspaces"]
      );
      
      // Create unique temp ID for this specific workspace
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimisticWorkspace: UIWorkspace = {
        id: tempId,
        name: variables.name,
        sheets: [],
      };
      
      queryClient.setQueryData<UIWorkspace[]>(
        ["/api/spaces/" + variables.spaceId + "/workspaces"],
        (old) => old ? [...old, optimisticWorkspace] : [optimisticWorkspace]
      );
      
      // Call callback with temp ID so caller can switch to it immediately
      variables.onOptimisticId?.(tempId);
      
      return { previousWorkspaces, tempId };
    },
    onError: (_err, variables, context) => {
      if (context?.previousWorkspaces) {
        queryClient.setQueryData(
          ["/api/spaces/" + variables.spaceId + "/workspaces"],
          context.previousWorkspaces
        );
      }
    },
    onSuccess: (result, variables, context) => {
      // Replace only this specific temp workspace with real one (preserves concurrent creations)
      queryClient.setQueryData<UIWorkspace[]>(
        ["/api/spaces/" + variables.spaceId + "/workspaces"],
        (old) => {
          if (!old) return [{ id: result.id, name: result.name, sheets: [] }];
          return old.map(w => w.id === context?.tempId 
            ? { id: result.id, name: result.name, sheets: [] } 
            : w
          );
        }
      );
      // Background refresh to get full data
      queryClient.invalidateQueries({ queryKey: ["/api/spaces"] });
    },
  });
}

export function useCreateFolder() {
  return useCreateWorkspace();
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await apiRequest("PUT", `/api/workspaces/${id}`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces"] });
    },
  });
}

export function useUpdateFolder() {
  return useUpdateWorkspace();
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, spaceId }: { id: string; spaceId: string }) => {
      await apiRequest("DELETE", `/api/workspaces/${id}`);
      return { id, spaceId };
    },
    // Optimistic update - remove workspace immediately for instant feedback
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["/api/spaces/" + variables.spaceId + "/workspaces"] });
      await queryClient.cancelQueries({ queryKey: ["/api/spaces"] });
      
      const previousWorkspaces = queryClient.getQueryData<UIWorkspace[]>(
        ["/api/spaces/" + variables.spaceId + "/workspaces"]
      );
      
      // Optimistically remove the workspace from cache
      queryClient.setQueryData<UIWorkspace[]>(
        ["/api/spaces/" + variables.spaceId + "/workspaces"],
        (old) => old ? old.filter(w => w.id !== variables.id) : []
      );
      
      return { previousWorkspaces };
    },
    onError: (_err, variables, context) => {
      // Rollback on error
      if (context?.previousWorkspaces) {
        queryClient.setQueryData(
          ["/api/spaces/" + variables.spaceId + "/workspaces"],
          context.previousWorkspaces
        );
      }
    },
    onSuccess: (_, variables) => {
      // Background refresh to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["/api/spaces"] });
      // Also invalidate workspace-specific queries
      queryClient.invalidateQueries({ 
        queryKey: ["/api/spaces/" + variables.spaceId + "/chats"],
        exact: false 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/spaces/" + variables.spaceId + "/insights"],
        exact: false 
      });
    },
  });
}

export function useDeleteFolder() {
  return useDeleteWorkspace();
}

export function useCreateSheet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      spaceId, 
      workspaceId,
      folderId, 
      name, 
      dataSourceType, 
      dataSourceMeta 
    }: { 
      spaceId: string; 
      workspaceId?: string;
      folderId?: string; 
      name: string; 
      dataSourceType?: string;
      dataSourceMeta?: any;
    }) => {
      const res = await apiRequest("POST", `/api/spaces/${spaceId}/sheets`, { 
        workspaceId: workspaceId || folderId, 
        name,
        dataSourceType,
        dataSourceMeta,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces"] });
    },
  });
}

export function useUpdateSheet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; workspaceId?: string; folderId?: string; dataSourceType?: string; dataSourceMeta?: any } }) => {
      const updateData = {
        ...data,
        workspaceId: data.workspaceId || data.folderId,
      };
      delete updateData.folderId;
      const res = await apiRequest("PUT", `/api/sheets/${id}`, updateData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces"] });
      // Also invalidate sheets query to update the UI in InsightWorkspace
      queryClient.invalidateQueries({ queryKey: ["/api/sheets"] });
    },
  });
}

export function useDeleteSheet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/sheets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sheets"] });
    },
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ spaceId, name, color }: { spaceId: string; name: string; color: string }) => {
      const res = await apiRequest("POST", `/api/spaces/${spaceId}/tags`, { name, color });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces"] });
    },
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; color?: string } }) => {
      const res = await apiRequest("PUT", `/api/tags/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces"] });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/tags/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces"] });
    },
  });
}
