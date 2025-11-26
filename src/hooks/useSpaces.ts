import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import type { Space as UISpace, Folder as UIFolder, Sheet as UISheet } from "../components/SpaceBrowser";
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
  folders: APIFolder[];
  tags: APITag[];
}

interface APIFolder {
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
  return {
    id: apiSpace.id,
    name: apiSpace.name,
    description: apiSpace.description ?? undefined,
    goals: apiSpace.goals ?? undefined,
    instructions: apiSpace.instructions ?? undefined,
    folders: apiSpace.folders.map((folder): UIFolder => ({
      id: folder.id,
      name: folder.name,
      sheets: folder.sheets.map((sheet): UISheet => ({
        id: sheet.id,
        name: sheet.name,
        rowCount: sheet.rowCount ?? 0,
        lastModified: sheet.lastModified ?? "Never",
        dataSource: sheet.dataSourceMeta ? {
          type: sheet.dataSourceType as 'screenshot' | 'link' | 'file',
          name: sheet.name,
          captureDate: new Date(),
          capturedBy: '',
          folder: folder.name,
          space: apiSpace.name,
          tags: [],
          ...sheet.dataSourceMeta,
        } : undefined,
      })),
    })),
    tags: apiSpace.tags.map((tag): Tag => ({
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

export function useFolders(spaceId: string | null) {
  return useQuery<UIFolder[]>({
    queryKey: ["/api/spaces/" + spaceId + "/folders"],
    enabled: !!spaceId,
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ spaceId, name }: { spaceId: string; name: string }) => {
      const res = await apiRequest("POST", `/api/spaces/${spaceId}/folders`, { name });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces/" + variables.spaceId + "/folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/spaces"] });
    },
  });
}

export function useUpdateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await apiRequest("PUT", `/api/folders/${id}`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces"] });
    },
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/folders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces"] });
    },
  });
}

export function useCreateSheet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      spaceId, 
      folderId, 
      name, 
      dataSourceType, 
      dataSourceMeta 
    }: { 
      spaceId: string; 
      folderId?: string; 
      name: string; 
      dataSourceType?: string;
      dataSourceMeta?: any;
    }) => {
      const res = await apiRequest("POST", `/api/spaces/${spaceId}/sheets`, { 
        folderId, 
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
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; folderId?: string; dataSourceType?: string; dataSourceMeta?: any } }) => {
      const res = await apiRequest("PUT", `/api/sheets/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces"] });
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
