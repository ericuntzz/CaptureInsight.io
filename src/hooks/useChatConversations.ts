import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";

export interface ChatConversation {
  id: string;
  title: string;
  spaceId: string;
  workspaceId: string | null;
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

export function useChatConversations(spaceId: string | null, workspaceId: string | null) {
  // Don't fetch if workspaceId is a temp ID (workspace not yet created in DB)
  const isValidWorkspace = !workspaceId || !workspaceId.startsWith('temp-');
  
  return useQuery<ChatConversation[]>({
    queryKey: ["/api/spaces/" + spaceId + "/chats", { workspaceId }],
    queryFn: async () => {
      const url = workspaceId 
        ? `/api/spaces/${spaceId}/chats?workspaceId=${workspaceId}`
        : `/api/spaces/${spaceId}/chats`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch chats');
      return res.json();
    },
    enabled: !!spaceId && isValidWorkspace,
    staleTime: 0, // Always refetch to ensure deleted items don't reappear
    refetchOnMount: true,
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
      workspaceId,
    }: { 
      spaceId: string; 
      title?: string;
      insightId?: string;
      workspaceId?: string;
    }) => {
      // Don't create chat if workspaceId is a temp ID (workspace not yet created in DB)
      if (workspaceId?.startsWith('temp-')) {
        throw new Error('Cannot create chat with temporary workspace ID. Please wait for workspace to be created.');
      }
      
      const res = await apiRequest("POST", `/api/spaces/${spaceId}/chats`, {
        title: title || 'New Chat',
        insightId: insightId || null,
        workspaceId: workspaceId || null,
      });
      return res.json();
    },
    // Optimistic update - add chat to cache immediately for instant UI feedback
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/spaces/" + variables.spaceId + "/chats"] });
      
      // Snapshot the previous value
      const previousChats = queryClient.getQueryData<ChatConversation[]>(
        ["/api/spaces/" + variables.spaceId + "/chats", { workspaceId: variables.workspaceId }]
      );
      
      // Create optimistic chat with unique temporary ID
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimisticChat: ChatConversation = {
        id: tempId,
        title: variables.title || 'New Chat',
        spaceId: variables.spaceId,
        workspaceId: variables.workspaceId || null,
        insightId: variables.insightId || null,
        userId: '',
        savedToMemory: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
      };
      
      // Add optimistic chat to cache
      queryClient.setQueryData<ChatConversation[]>(
        ["/api/spaces/" + variables.spaceId + "/chats", { workspaceId: variables.workspaceId }],
        (old) => old ? [optimisticChat, ...old] : [optimisticChat]
      );
      
      // Return tempId so we can replace only this specific chat on success
      return { previousChats, tempId };
    },
    onError: (_err, variables, context) => {
      // Rollback on error
      if (context?.previousChats) {
        queryClient.setQueryData(
          ["/api/spaces/" + variables.spaceId + "/chats", { workspaceId: variables.workspaceId }],
          context.previousChats
        );
      }
    },
    onSuccess: (result, variables, context) => {
      // Replace only this specific optimistic chat with real one (preserves concurrent creations)
      queryClient.setQueryData<ChatConversation[]>(
        ["/api/spaces/" + variables.spaceId + "/chats", { workspaceId: variables.workspaceId }],
        (old) => {
          if (!old) return [result];
          // Replace only the matching temp chat
          return old.map(c => c.id === context?.tempId ? result : c);
        }
      );
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
