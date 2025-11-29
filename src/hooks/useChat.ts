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

export function useChat({ spaceId, insightId, chatId }: UseChatOptions): UseChatReturn {
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

  // Reset when spaceId or insightId changes
  useEffect(() => {
    loadedChatIdRef.current = null;
    currentChatIdRef.current = null;
    setMessages([]);
    setError(null);
    setHistoryLoadError(null);
  }, [insightId, spaceId]);

  const persistMessage = useCallback(async (role: 'user' | 'assistant', content: string, citations?: any[]): Promise<boolean> => {
    if (!chatId) return false;
    
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role, content, citations }),
      });
      
      if (!res.ok) throw new Error('Failed to save message');
      return true;
    } catch (err) {
      console.error('Failed to persist message:', err);
      return false;
    }
  }, [chatId]);

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

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    // Persist user message to database
    const userMsgSaved = await persistMessage('user', content.trim());
    if (!userMsgSaved && chatId) {
      toast.error('Failed to save your message. Please try again.');
    }

    try {
      const chatHistory = [...messages, userMessage].map(m => ({
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

      // Persist AI message to database first, then update UI
      const aiMsgSaved = await persistMessage('assistant', data.response, citations?.length > 0 ? citations : undefined);
      
      if (aiMsgSaved || !chatId) {
        // Only add to UI if persisted successfully (or no chatId means no persistence needed)
        setMessages(prev => [...prev, aiMessage]);
      } else {
        // Failed to persist - show error and don't add to UI
        toast.error('AI response was not saved. Please try again.');
        setError('AI response was not saved. Please try again.');
      }
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to get AI response';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [messages, spaceId, isAuthenticated, isAuthLoading, persistMessage, isLoadingHistory, chatId, historyLoadError]);

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
