import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";

interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  createdBy: string;
  spaceId?: string;
}

export function useTags(spaceId: string | null) {
  return useQuery<Tag[]>({
    queryKey: ["/api/spaces/" + spaceId + "/tags"],
    enabled: !!spaceId,
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      spaceId,
      name,
      color,
    }: {
      spaceId: string;
      name: string;
      color: string;
    }) => {
      const res = await apiRequest("POST", `/api/spaces/${spaceId}/tags`, { name, color });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces/" + variables.spaceId + "/tags"] });
    },
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{ name: string; color: string }>;
    }) => {
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
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces"] });
    },
  });
}

interface TagUsageStats {
  insightsCount: number;
  dataSheetsCount: number;
  chatMessagesCount: number;
  changeLogsCount: number;
  totalCount: number;
}

export function useTagUsage(tagId: string, spaceId: string | null) {
  const { data, isLoading } = useQuery<TagUsageStats>({
    queryKey: ["/api/tags/" + tagId + "/usage", spaceId],
    enabled: !!tagId && !!spaceId,
    placeholderData: {
      insightsCount: 0,
      dataSheetsCount: 0,
      chatMessagesCount: 0,
      changeLogsCount: 0,
      totalCount: 0,
    },
  });

  return {
    usage: data ?? {
      insightsCount: 0,
      dataSheetsCount: 0,
      chatMessagesCount: 0,
      changeLogsCount: 0,
      totalCount: 0,
    },
    isLoading,
  };
}
