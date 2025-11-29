import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";

export interface ChatConversation {
  id: string;
  title: string;
  spaceId: string;
  insightId: string | null;
  userId: string;
  savedToMemory: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  spaceId: string;
  citations?: Array<{
    entityId: string;
    entityType: string;
    name: string;
    relevanceScore: number;
  }>;
}

export function useChatConversations(spaceId: string | null) {
  return useQuery<ChatConversation[]>({
    queryKey: ["/api/spaces/" + spaceId + "/chats"],
    enabled: !!spaceId,
  });
}

export function useChatConversation(chatId: string | null) {
  return useQuery<ChatConversation>({
    queryKey: ["/api/chats/" + chatId],
    enabled: !!chatId,
  });
}

export function useCreateChatConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      spaceId, 
      title,
      insightId,
    }: { 
      spaceId: string; 
      title?: string;
      insightId?: string;
    }) => {
      const res = await apiRequest("POST", `/api/spaces/${spaceId}/chats`, {
        title: title || 'New Chat',
        insightId: insightId || null,
      });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces/" + variables.spaceId + "/chats"] });
    },
  });
}

export function useUpdateChatConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      chatId, 
      data 
    }: { 
      chatId: string; 
      data: Partial<{
        title: string;
        insightId: string | null;
        savedToMemory: boolean;
      }>
    }) => {
      const res = await apiRequest("PATCH", `/api/chats/${chatId}`, data);
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats/" + result.id] });
      if (result.spaceId) {
        queryClient.invalidateQueries({ queryKey: ["/api/spaces/" + result.spaceId + "/chats"] });
      }
    },
  });
}

export function useDeleteChatConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ chatId, spaceId }: { chatId: string; spaceId: string }) => {
      await apiRequest("DELETE", `/api/chats/${chatId}`);
      return { chatId, spaceId };
    },
    onSuccess: (variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces/" + variables.spaceId + "/chats"] });
    },
  });
}

export function useChatMessages(chatId: string | null) {
  return useQuery<ChatMessage[]>({
    queryKey: ["/api/chats/" + chatId + "/messages"],
    enabled: !!chatId,
  });
}

export function useCreateChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      chatId, 
      role,
      content,
      citations,
    }: { 
      chatId: string;
      role: 'user' | 'assistant';
      content: string;
      citations?: Array<{
        entityId: string;
        entityType: string;
        name: string;
        relevanceScore: number;
      }>;
    }) => {
      const res = await apiRequest("POST", `/api/chats/${chatId}/messages`, {
        role,
        content,
        citations,
      });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats/" + variables.chatId + "/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/spaces"] }); // Refresh to update lastMessageAt
    },
  });
}
