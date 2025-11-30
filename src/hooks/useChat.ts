import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  citations?: Array<{
    entityId: string;
    entityType: string;
    name: string;
    relevanceScore: number;
  }>;
}

export interface UseChatOptions {
  spaceId: string | null;
  insightId: string;
  chatId?: string | null;
}

export interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (content: string) => Promise<void>;
  isLoading: boolean;
  isLoadingHistory: boolean;
  historyLoadError: string | null;
  retryLoadHistory: () => void;
  error: string | null;
  clearError: () => void;
  clearMessages: () => void;
}

export function useChat({ spaceId, insightId: _insightId, chatId }: UseChatOptions): UseChatReturn {
  // Note: _insightId is intentionally unused - chat and insight panels are independent
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyLoadError, setHistoryLoadError] = useState<string | null>(null);
  const loadedChatIdRef = useRef<string | null>(null);
  const currentChatIdRef = useRef<string | null>(chatId || null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    loadedChatIdRef.current = null;
  }, []);

  // Function to load chat history
  const loadChatHistory = useCallback(async (targetChatId: string) => {
    if (!targetChatId) return;
    
    setIsLoadingHistory(true);
    setHistoryLoadError(null);
    
    try {
      const res = await fetch(`/api/chats/${targetChatId}/messages`, { credentials: 'include' });
      
      if (!res.ok) throw new Error('Failed to load chat history');
      
      const data = await res.json();
      const loadedMessages: ChatMessage[] = data.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: new Date(m.createdAt),
        citations: m.citations,
      }));
      
      setMessages(loadedMessages);
      loadedChatIdRef.current = targetChatId;
      setHistoryLoadError(null);
    } catch (err) {
      console.error('Failed to load chat history:', err);
      setHistoryLoadError('Failed to load chat history');
      setMessages([]);
      // Don't set loadedChatIdRef so retry is allowed
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Retry handler for failed history load
  const retryLoadHistory = useCallback(() => {
    const targetId = currentChatIdRef.current;
    if (targetId && historyLoadError) {
      loadChatHistory(targetId);
    }
  }, [loadChatHistory, historyLoadError]);

  // Load messages from database when chatId changes
  useEffect(() => {
    // Always update currentChatIdRef first so retry works even on initial mount
    currentChatIdRef.current = chatId || null;
    
    if (!chatId) {
      setMessages([]);
      loadedChatIdRef.current = null;
      setHistoryLoadError(null);
      return;
    }
    
    if (loadedChatIdRef.current === chatId) return;
    
    loadChatHistory(chatId);
  }, [chatId, loadChatHistory]);

  // Reset when spaceId changes (different spaces have different chats)
  // Note: We don't reset on insightId changes - chat and insights are independent
  useEffect(() => {
    loadedChatIdRef.current = null;
    currentChatIdRef.current = null;
    setMessages([]);
    setError(null);
    setHistoryLoadError(null);
  }, [spaceId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    if (isAuthLoading) {
      toast.error('Please wait while authentication is loading...');
      return;
    }

    if (!isAuthenticated) {
      setError('Please log in to use the AI assistant.');
      toast.error('Please log in to use the AI assistant.');
      return;
    }

    if (!spaceId) {
      setError('Please select a space first.');
      toast.error('Please select a space first.');
      return;
    }

    // Don't allow sending if history failed to load
    if (historyLoadError) {
      toast.error('Please retry loading chat history first.');
      return;
    }

    // Don't allow sending while history is loading to prevent race conditions
    if (isLoadingHistory) {
      toast.error('Please wait for chat history to load.');
      return;
    }

    // IMPORTANT: Capture chatId at the start to prevent race conditions
    // If user switches chats during AI response, we still save to the original chat
    const originalChatId = chatId;
    const originalMessages = messages;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    // Helper to persist message to the ORIGINAL chat (not current)
    const persistToOriginalChat = async (role: 'user' | 'assistant', msgContent: string, citations?: any[]): Promise<boolean> => {
      if (!originalChatId) return false;
      
      try {
        const res = await fetch(`/api/chats/${originalChatId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ role, content: msgContent, citations }),
        });
        
        if (!res.ok) throw new Error('Failed to save message');
        return true;
      } catch (err) {
        console.error('Failed to persist message:', err);
        return false;
      }
    };

    // Persist user message to database
    const userMsgSaved = await persistToOriginalChat('user', content.trim());
    if (!userMsgSaved && originalChatId) {
      toast.error('Failed to save your message. Please try again.');
    }

    try {
      const chatHistory = [...originalMessages, userMessage].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messages: chatHistory,
          spaceId: spaceId,
          useRag: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 401) {
          const errorMsg = 'Please log in to use the AI assistant.';
          setError(errorMsg);
          toast.error(errorMsg);
          return;
        }
        
        if (response.status === 403) {
          const errorMsg = 'You do not have permission to use AI features in this space.';
          setError(errorMsg);
          toast.error(errorMsg);
          return;
        }
        
        if (response.status === 503 || errorData.message?.includes('not configured')) {
          const errorMsg = 'AI service is currently unavailable. Please try again later.';
          setError(errorMsg);
          toast.error(errorMsg);
          return;
        }

        throw new Error(errorData.message || 'Failed to get AI response');
      }

      const data = await response.json();

      const citations = data.citations?.map((c: any) => ({
        entityId: c.entityId,
        entityType: c.entityType,
        name: c.name || c.entityId,
        relevanceScore: c.relevanceScore,
      }));

      const aiMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        citations: citations?.length > 0 ? citations : undefined,
      };

      // Persist AI message to the ORIGINAL chat
      const aiMsgSaved = await persistToOriginalChat('assistant', data.response, citations?.length > 0 ? citations : undefined);
      
      // Only add to UI if we're still on the same chat
      // This prevents the AI response from appearing in the wrong chat's UI
      if (currentChatIdRef.current === originalChatId) {
        if (aiMsgSaved || !originalChatId) {
          setMessages(prev => [...prev, aiMessage]);
        } else {
          toast.error('AI response was not saved. Please try again.');
          setError('AI response was not saved. Please try again.');
        }
      } else {
        // User switched chats - message was saved to original chat, just don't show in UI
        // They'll see it when they switch back to that chat
        if (!aiMsgSaved && originalChatId) {
          toast.error('AI response was not saved. Please try again.');
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to get AI response';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [messages, spaceId, isAuthenticated, isAuthLoading, isLoadingHistory, chatId, historyLoadError]);

  return {
    messages,
    sendMessage,
    isLoading,
    isLoadingHistory,
    historyLoadError,
    retryLoadHistory,
    error,
    clearError,
    clearMessages,
  };
}
