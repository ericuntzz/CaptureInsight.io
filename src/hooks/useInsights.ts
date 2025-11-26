import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";

interface InsightSource {
  id: string;
  type: 'chat' | 'capture' | 'datasheet' | 'changelog';
  name: string;
  url: string;
  chatBubbleId?: string;
}

interface InsightComment {
  id: string;
  content: string;
  author: string;
  createdAt: Date;
  mentions: string[];
  parentId?: string;
}

interface Insight {
  id: string;
  title: string;
  summary: string;
  status: 'Open' | 'Archived';
  priority?: 'High' | 'Medium' | 'Low';
  dateCreated: Date;
  createdBy: string;
  assignedTo?: string;
  tags: string[];
  sources: InsightSource[];
  comments: InsightComment[];
  folderId?: string;
  spaceId?: string;
}

export function useInsights(spaceId: string | null) {
  return useQuery<Insight[]>({
    queryKey: ["/api/spaces/" + spaceId + "/insights"],
    enabled: !!spaceId,
  });
}

export function useInsight(id: string | null) {
  return useQuery<Insight>({
    queryKey: ["/api/insights/" + id],
    enabled: !!id,
  });
}

export function useCreateInsight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      spaceId, 
      data 
    }: { 
      spaceId: string; 
      data: {
        title: string;
        summary: string;
        status?: 'Open' | 'Archived';
        priority?: 'High' | 'Medium' | 'Low';
        folderId?: string;
        tags?: string[];
      }
    }) => {
      const res = await apiRequest("POST", `/api/spaces/${spaceId}/insights`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces/" + variables.spaceId + "/insights"] });
    },
  });
}

export function useUpdateInsight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      id, 
      data 
    }: { 
      id: string; 
      data: Partial<{
        title: string;
        summary: string;
        status: 'Open' | 'Archived';
        priority: 'High' | 'Medium' | 'Low';
        folderId: string;
        assignedTo: string;
      }>
    }) => {
      const res = await apiRequest("PUT", `/api/insights/${id}`, data);
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/insights/" + result.id] });
      if (result.spaceId) {
        queryClient.invalidateQueries({ queryKey: ["/api/spaces/" + result.spaceId + "/insights"] });
      }
    },
  });
}

export function useDeleteInsight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/insights/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces"] });
    },
  });
}

export function useInsightComments(insightId: string | null) {
  return useQuery<InsightComment[]>({
    queryKey: ["/api/insights/" + insightId + "/comments"],
    enabled: !!insightId,
  });
}

export function useCreateInsightComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      insightId,
      content,
      parentId,
    }: {
      insightId: string;
      content: string;
      parentId?: string;
    }) => {
      const res = await apiRequest("POST", `/api/insights/${insightId}/comments`, {
        content,
        parentId,
      });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/insights/" + variables.insightId + "/comments"] });
    },
  });
}
