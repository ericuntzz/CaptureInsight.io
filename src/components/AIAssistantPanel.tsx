import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Send, ExternalLink, Copy, ThumbsUp, ThumbsDown, Download, RefreshCw, MoreHorizontal, Tag as TagIcon, Check, X, AlertCircle, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Tag, Insight } from '../data/insightsData';
import { TagBadge } from './TagBadge';
import { TagSelector } from './TagSelector';
import { CreateInsightCard } from './CreateInsightCard';
import { TypewriterText } from './TypewriterText';
import { GlowingDot } from './GlowingDot';
import { toast } from 'sonner';
import { copyToClipboard } from '../utils/clipboard';
import { useAuth } from '../hooks/useAuth';
import { useTags, useCreateTag } from '../hooks/useTags';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: Date;
  tags?: string[]; // NEW: Array of tag IDs associated with this message
  insightId?: string; // NEW: If this message is part of an Insight
}

interface Citation {
  sheetName: string;
  sheetId: string;
  rows: number[];
  value?: string;
}

interface AIAssistantPanelProps {
  projectName?: string;
  spaceId?: string | null; // Added: Space context for tag operations
}

/**
 * =============================================================================
 * REPLIT IMPLEMENTATION NOTE - DATA ACCURACY PROTOCOL
 * =============================================================================
 * 
 * Problem: Digital marketers don't trust the data being presented to them 
 * (especially if they're uploading data via screenshots). They've had too many 
 * LLMs hallucinate on them and are worried that they'll be presenting numbers 
 * and stats that are fundamentally wrong due to upload issues.
 * 
 * Solution: We need a "triple layer" data check protocol that ENSURES the data 
 * that a user uploads/screenshots is accurate 99.99% of the time.
 * 
 * Implementation Requirements:
 * 1. Build a triple-layer data validation system for screenshot/upload accuracy
 * 2. Add a review step in the process that allows users to verify data after 
 *    it's gone through the data checker protocol
 * 3. Provide confidence scores or accuracy indicators for uploaded data
 * 4. Allow users to flag and correct any inaccuracies before analysis
 * 
 * This is critical for user trust and platform credibility.
 * =============================================================================
 */

export function AIAssistantPanel({ projectName = 'All Projects', spaceId = null }: AIAssistantPanelProps) {
  const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hi! I'm your AI Analyst Assistant. I can help you analyze data across all your captured spreadsheets. Try asking me things like:

• What's my customer acquisition cost trend?
• Compare revenue by channel this quarter
• Show me anomalies in my ad spend data`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Simple animation trigger: detect when AI finishes responding
  const wasThinkingRef = useRef(false);
  const [animatingMessageId, setAnimatingMessageId] = useState<string | null>(null);

  // Fetch tags from real API
  const { data: tagsData = [] } = useTags(spaceId);
  const createTagMutation = useCreateTag();

  // Convert API data to Tag type (handle Date string -> Date conversion)
  const tags: Tag[] = useMemo(() => {
    return tagsData.map((tag: any) => ({
      ...tag,
      createdAt: tag.createdAt instanceof Date ? tag.createdAt : new Date(tag.createdAt),
    }));
  }, [tagsData]);

  // Tagging state
  const [showTagChatButton, setShowTagChatButton] = useState(false);
  const [isTagSelectionMode, setIsTagSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [showCreateInsightPrompt, setShowCreateInsightPrompt] = useState(false);
  const [showInsightCreationCard, setShowInsightCreationCard] = useState(false);
  const [pendingTagId, setPendingTagId] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Trigger animation when AI finishes responding (isThinking goes from true → false)
  useEffect(() => {
    if (wasThinkingRef.current && !isThinking && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        setAnimatingMessageId(lastMessage.id);
      }
    }
    wasThinkingRef.current = isThinking;
  }, [isThinking, messages]);
  
  // Clear animation when complete
  const handleAnimationComplete = useCallback(() => {
    setAnimatingMessageId(null);
  }, []);

  // Show "Tag Chat" button after first user message
  useEffect(() => {
    const hasUserMessage = messages.some(m => m.role === 'user' && m.id !== '1');
    setShowTagChatButton(hasUserMessage);
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (!isAuthenticated) {
      toast.error('Please log in to use the AI assistant.');
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsThinking(true);
    setAiError(null);

    try {
      const chatHistory = updatedMessages
        .filter(m => m.id !== '1')
        .map(m => ({ role: m.role, content: m.content }));

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
          throw new Error('Please log in to use the AI assistant.');
        }
        if (response.status === 503 || errorData.message?.includes('not configured')) {
          setAiError('AI service is not configured. Please contact your administrator.');
          throw new Error('AI service not configured');
        }
        throw new Error(errorData.message || 'Failed to get AI response');
      }

      const data = await response.json();

      const citations: Citation[] = data.citations?.map((c: any) => ({
        sheetName: c.name || c.entityId,
        sheetId: c.entityId,
        rows: [],
        value: `${c.entityType} (${Math.round(c.relevanceScore * 100)}% match)`,
      })) || [];

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        citations: citations.length > 0 ? citations : undefined,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get AI response';
      if (!aiError) {
        toast.error(errorMessage + ' Please try again.');
      }
    } finally {
      setIsThinking(false);
    }
  };

  const handleTagChatClick = () => {
    setIsTagSelectionMode(!isTagSelectionMode);
    if (!isTagSelectionMode) {
      toast.info('Select chat bubbles to tag by clicking on them');
    } else {
      setSelectedMessageIds([]);
    }
  };

  const handleMessageSelect = (messageId: string) => {
    if (!isTagSelectionMode) return;

    setSelectedMessageIds(prev => {
      if (prev.includes(messageId)) {
        return prev.filter(id => id !== messageId);
      } else {
        return [...prev, messageId];
      }
    });
  };

  const handleTagSelect = (tagId: string) => {
    if (selectedMessageIds.length === 0) {
      toast.error('Please select at least one message first');
      return;
    }

    // Apply tag to selected messages
    setMessages(prev => prev.map(msg => {
      if (selectedMessageIds.includes(msg.id)) {
        const existingTags = msg.tags || [];
        if (!existingTags.includes(tagId)) {
          return { ...msg, tags: [...existingTags, tagId] };
        }
      }
      return msg;
    }));

    // Store the tag ID and show the create insight prompt
    setPendingTagId(tagId);
    setShowTagSelector(false);
    setShowCreateInsightPrompt(true);
  };

  const handleCreateTag = (name: string, color: string) => {
    if (!spaceId) {
      toast.error('Please select a space first to create tags.');
      return;
    }

    createTagMutation.mutate(
      { spaceId, name, color },
      {
        onSuccess: () => {
          toast.success(`Tag "${name}" created!`);
        },
        onError: (error) => {
          toast.error(`Failed to create tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
        },
      }
    );
  };

  const handleCreateInsightYes = () => {
    setShowCreateInsightPrompt(false);
    setShowInsightCreationCard(true);
  };

  const handleCreateInsightNo = () => {
    setShowCreateInsightPrompt(false);
    setSelectedMessageIds([]);
    setIsTagSelectionMode(false);
    setPendingTagId(null);
    toast.success('Messages tagged successfully!');
  };

  const handleClearChat = () => {
    // Check if any messages are tagged or linked to insights
    const taggedMessages = messages.filter(m => m.tags && m.tags.length > 0);
    const linkedMessages = messages.filter(m => m.insightId);

    if (taggedMessages.length > 0 || linkedMessages.length > 0) {
      const confirmed = window.confirm(
        `⚠️ Warning\n\nThis chat contains ${taggedMessages.length} tagged message(s) and ${linkedMessages.length} message(s) linked to Insights.\n\nClearing this chat will remove the connection to those Insights. The Insights will remain, but clicking their source links will show an error instead of navigating to the messages.\n\nAre you sure you want to continue?`
      );

      if (!confirmed) {
        return;
      }
    }

    // Clear the chat
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: `Hi! I'm your AI Analyst Assistant. I can help you analyze data across all your captured spreadsheets. Try asking me things like:

• What's my customer acquisition cost trend?
• Compare revenue by channel this quarter
• Show me anomalies in my ad spend data`,
        timestamp: new Date(),
      },
    ]);
    setSelectedMessageIds([]);
    setIsTagSelectionMode(false);
    setShowTagChatButton(false);
    toast.success('Chat cleared');
  };

  return (
    <div className="flex flex-col h-full bg-[#0A0E1A] p-[0px] m-[0px] relative overflow-hidden">
      {/* Authentication Banner */}
      {!isAuthLoading && !isAuthenticated && (
        <div className="mx-[238px] mt-4 p-4 bg-[#1A1F2E] border border-[#2D3B4E] rounded-xl flex items-center gap-3">
          <LogIn className="w-5 h-5 text-[#FF6B35]" />
          <div className="flex-1">
            <p className="text-white text-sm font-medium">Sign in to use AI Assistant</p>
            <p className="text-[#9CA3AF] text-xs mt-0.5">Log in to start analyzing your data with AI-powered insights.</p>
          </div>
        </div>
      )}

      {/* AI Configuration Error Banner */}
      {aiError && (
        <div className="mx-[238px] mt-4 p-4 bg-[#1A1F2E] border border-[#FF6B35]/30 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[#FF6B35]" />
          <div className="flex-1">
            <p className="text-white text-sm font-medium">AI Service Unavailable</p>
            <p className="text-[#9CA3AF] text-xs mt-0.5">{aiError}</p>
          </div>
          <button
            onClick={() => setAiError(null)}
            className="p-1 text-[#6B7280] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 px-[238px] py-[317px] relative" style={{ paddingBottom: '400px' }}>
        {messages.filter(m => m.source !== 'canvas').map((message) => {
          const isSelected = selectedMessageIds.includes(message.id);
          const messageTags = message.tags?.map(tagId => tags.find(t => t.id === tagId)).filter(Boolean) as Tag[];
          const isUser = message.role === 'user';
          const shouldAnimate = !isUser && animatingMessageId === message.id;

          return (
            <div
              key={message.id}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div className="flex items-start gap-3 max-w-[80%]">
                {/* Selection Circle */}
                {isTagSelectionMode && message.id !== '1' && (
                  <button
                    onClick={() => handleMessageSelect(message.id)}
                    className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-3 transition-all ${
                      isSelected
                        ? 'bg-[#FF6B35] border-[#FF6B35]'
                        : 'border-[#6B7280] hover:border-[#FF6B35]'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </button>
                )}

                {/* Message Content */}
                <div
                  onClick={() => isTagSelectionMode && message.id !== '1' && handleMessageSelect(message.id)}
                  className={`flex-1 rounded-xl transition-all ${
                    isUser
                      ? 'bg-gradient-to-r from-[#FF6B35] to-[#E55A2B] text-white px-4 py-3'
                      : 'text-[#E5E7EB] py-2'
                  } ${
                    isSelected ? 'ring-2 ring-[#FF6B35]' : ''
                  } ${
                    isTagSelectionMode && message.id !== '1' ? 'cursor-pointer hover:ring-1 hover:ring-[#FF6B35]' : ''
                  }`}
                >
                  <div className="whitespace-pre-wrap text-sm">
                    {shouldAnimate ? (
                      <TypewriterText 
                        text={message.content}
                        speed={8}
                        onComplete={handleAnimationComplete}
                      />
                    ) : (
                      message.content
                    )}
                  </div>
                  
                  {/* Message Tags */}
                  {messageTags && messageTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {messageTags.map((tag) => (
                        <TagBadge key={tag.id} tag={tag} size="sm" interactive={false} />
                      ))}
                    </div>
                  )}

                  {/* Citations */}
                  {message.citations && message.citations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#2D3B4E] space-y-2">
                      <div className="text-xs text-[#9CA3AF]">Sources:</div>
                      {message.citations.map((citation, idx) => (
                        <button
                          key={idx}
                          className="flex items-center gap-2 text-xs text-[#FF6B35] hover:text-[#FFA07A] transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>{citation.sheetName} (rows {citation.rows.join(', ')})</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Action Buttons - Only for assistant messages */}
                  {!isUser && !isTagSelectionMode && (
                    <div className="flex items-center gap-1 mt-3">
                      <button
                        type="button"
                        onClick={async () => {
                          const success = await copyToClipboard(message.content);
                          if (success) {
                            setCopiedId(message.id);
                            setTimeout(() => setCopiedId(null), 2000);
                          }
                        }}
                        className="p-1.5 text-[#6B7280] hover:text-[#FF6B35] transition-colors"
                        title="Copy"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 text-[#6B7280] hover:text-[#FF6B35] transition-colors"
                        title="Like"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 text-[#6B7280] hover:text-[#FF6B35] transition-colors"
                        title="Dislike"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 text-[#6B7280] hover:text-[#FF6B35] transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 text-[#6B7280] hover:text-[#FF6B35] transition-colors"
                        title="Refresh"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 text-[#6B7280] hover:text-[#FF6B35] transition-colors"
                        title="More"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Thinking indicator */}
        {isThinking && (
          <div className="flex justify-start">
            <div className="py-2">
              <GlowingDot />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 mx-[246px] mb-[161px] relative z-20">
        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-2">
          {/* Input Field Container */}
          <div className="w-full relative flex items-center bg-[#1A1F2E] rounded-[132px] px-[38px] py-[14px]">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={!isAuthenticated ? "Sign in to use AI Assistant" : "Ask anything"}
              disabled={!isAuthenticated}
              rows={1}
              className="flex-1 bg-transparent border-none text-white text-sm outline-none resize-none placeholder:text-[#6B7280] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: '24px', maxHeight: '120px' }}
            />
            
            {/* Right Side Icons */}
            <div className="flex items-center gap-2 ml-2">
              <button
                type="button"
                className="flex-shrink-0 p-1 hover:bg-[#252B3D] rounded transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 1V8M8 8V15M8 8H15M8 8H1" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
              <button
                type="button"
                className="flex-shrink-0 p-1 hover:bg-[#252B3D] rounded transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 11C9.65685 11 11 9.65685 11 8V4C11 2.34315 9.65685 1 8 1C6.34315 1 5 2.34315 5 4V8C5 9.65685 6.34315 11 8 11Z" stroke="#6B7280" strokeWidth="1.5"/>
                  <path d="M3 8C3 10.7614 5.23858 13 8 13M8 13C10.7614 13 13 10.7614 13 8M8 13V15" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!input.trim() || isThinking || !isAuthenticated}
              className="ml-2 flex-shrink-0 w-9 h-9 bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {/* Tag Chat Button - Appears after first message */}
          <AnimatePresence>
            {showTagChatButton && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="self-end"
              >
                <button
                  type="button"
                  onClick={handleTagChatClick}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    isTagSelectionMode
                      ? 'bg-[rgba(255,107,53,0.2)] text-[#FF6B35] border border-[#FF6B35]'
                      : 'bg-[#1A1F2E] text-[#9CA3AF] hover:text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)]'
                  }`}
                >
                  <TagIcon className="w-4 h-4" />
                  <span className="text-sm">{isTagSelectionMode ? 'Cancel Tagging' : 'Tag Chat'}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tag Selection Actions */}
          {isTagSelectionMode && selectedMessageIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="self-end flex items-center gap-2"
            >
              <span className="text-sm text-[#9CA3AF]">
                {selectedMessageIds.length} message{selectedMessageIds.length > 1 ? 's' : ''} selected
              </span>
              <div className="relative">
                <button
                  onClick={() => setShowTagSelector(!showTagSelector)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#FF6B35] text-white rounded-lg hover:bg-[#FFA07A] transition-colors"
                >
                  <TagIcon className="w-4 h-4" />
                  <span className="text-sm">Add Tag</span>
                </button>

                {/* Tag Selector Dropdown */}
                {showTagSelector && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowTagSelector(false)}
                    />
                    <div className="absolute bottom-full mb-2 right-0 z-50">
                      <div className="bg-[#1A1F2E] rounded-lg shadow-lg border border-[#2D3B4E] overflow-hidden min-w-[250px]">
                        <div className="p-3">
                          <div className="text-[10px] text-[#9CA3AF] mb-2">SELECT TAG</div>
                          <div className="max-h-[200px] overflow-y-auto space-y-1">
                            {tags.map((tag) => (
                              <button
                                key={tag.id}
                                onClick={() => handleTagSelect(tag.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[#9CA3AF] hover:text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)] transition-all text-left"
                              >
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: tag.color }}
                                />
                                <span>{tag.name}</span>
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => {
                              const name = prompt('Enter tag name:');
                              if (name) {
                                const colorIndex = tags.length % 10;
                                const colors = ['#FF6B35', '#4ECDC4', '#FFE66D', '#A8E6CF', '#FF8B94', '#B4A7D6', '#FFD3B6', '#88D8B0', '#FFA07A', '#98D8C8'];
                                handleCreateTag(name, colors[colorIndex]);
                              }
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 mt-2 rounded-md text-sm text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)] transition-all border-t border-[#2D3B4E] pt-3"
                          >
                            <span>+ Add New Tag</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </form>
      </div>

      {/* Create Insight Prompt */}
      <AnimatePresence>
        {showCreateInsightPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1A1F2E] rounded-xl p-6 max-w-md border border-[#2D3B4E]"
            >
              <h3 className="text-white text-lg mb-2">Create an Insight?</h3>
              <p className="text-[#9CA3AF] text-sm mb-6">
                Would you like to create an Insight from these tagged messages? This will help you organize and reference this information later.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleCreateInsightYes}
                  className="flex-1 px-4 py-2 bg-[#FF6B35] text-white rounded-lg hover:bg-[#FFA07A] transition-colors"
                >
                  Yes, Create Insight
                </button>
                <button
                  onClick={handleCreateInsightNo}
                  className="flex-1 px-4 py-2 bg-[#252B3D] text-[#9CA3AF] rounded-lg hover:bg-[#2D3B4E] transition-colors"
                >
                  No, Just Tag
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Insight Creation Card */}
      <CreateInsightCard
        isOpen={showInsightCreationCard}
        onClose={() => {
          setShowInsightCreationCard(false);
          setSelectedMessageIds([]);
          setIsTagSelectionMode(false);
          setPendingTagId(null);
        }}
        selectedMessages={messages.filter(m => selectedMessageIds.includes(m.id))}
        onRemoveMessage={(messageId) => {
          setSelectedMessageIds(prev => prev.filter(id => id !== messageId));
        }}
        tags={tags}
        selectedTagIds={pendingTagId ? [pendingTagId] : []}
        onTagsChange={(tagIds) => {
          // Update pending tags
          setPendingTagId(tagIds[0] || null);
        }}
        onCreateTag={handleCreateTag}
        onSave={(insight) => {
          // TODO: Save insight to backend/state
          console.log('Created insight:', insight);
          
          // Link messages to insight
          const insightId = `insight-${Date.now()}`;
          setMessages(prev => prev.map(msg => {
            if (selectedMessageIds.includes(msg.id)) {
              return { ...msg, insightId };
            }
            return msg;
          }));
          
          toast.success('Insight created successfully!');
          setShowInsightCreationCard(false);
          setSelectedMessageIds([]);
          setIsTagSelectionMode(false);
          setPendingTagId(null);
        }}
      />
    </div>
  );
}