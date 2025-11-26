import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";

interface Space {
  id: string;
  name: string;
  description?: string;
  goals?: string;
  instructions?: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  folders?: Folder[];
  tags?: Tag[];
}

interface Folder {
  id: string;
  name: string;
  spaceId: string;
  sheets?: Sheet[];
}

interface Sheet {
  id: string;
  name: string;
  rowCount?: number;
  lastModified?: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

export function useSpaces() {
  return useQuery<Space[]>({
    queryKey: ["/api/spaces"],
  });
}

export function useSpace(id: string | null) {
  return useQuery<Space>({
    queryKey: ["/api/spaces/" + id],
    enabled: !!id,
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
    mutationFn: async ({ id, data }: { id: string; data: Partial<Space> }) => {
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
  return useQuery<Folder[]>({
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
