import { useState, useCallback, useEffect } from 'react';
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
}

export interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (content: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  clearMessages: () => void;
}

export function useChat({ spaceId, insightId }: UseChatOptions): UseChatReturn {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [insightId, spaceId]);

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

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

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

      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to get AI response';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [messages, spaceId, isAuthenticated, isAuthLoading]);

  return {
    messages,
    sendMessage,
    isLoading,
    error,
    clearError,
    clearMessages,
  };
}
