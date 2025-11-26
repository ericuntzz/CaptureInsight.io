import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, RotateCw, ChevronDown, ExternalLink, FileText, Copy, Trash2, Download, MoreVertical, Presentation } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Insight, Tag } from '../data/insightsData';
import { TagBadge } from './TagBadge';
import { toast } from 'sonner';
import { copyToClipboard } from '../utils/clipboard';
import { RichTextEditor } from './RichTextEditor';
import { useChat, ChatMessage } from '../hooks/useChat';
import { useAuth } from '../hooks/useAuth';

interface CanvasInsightViewProps {
  insights: Insight[];
  openTabs: string[];
  activeTabId: string;
  tags: Tag[];
  spaceId: string | null;
  onSwitchTab: (insightId: string) => void;
  onCloseTab: (insightId: string) => void;
  onCloseCanvas: () => void;
  onCreateNewInsight?: (insight: Insight) => void;
  onUpdateInsight?: (insightId: string, updates: Partial<Insight>) => void;
}

export function CanvasInsightView({
  insights,
  openTabs,
  activeTabId,
  tags,
  spaceId,
  onSwitchTab,
  onCloseTab,
  onCloseCanvas,
  onCreateNewInsight,
  onUpdateInsight,
}: CanvasInsightViewProps) {
  const { user } = useAuth();
  
  // Get the active insight
  const activeInsight = insights.find(i => i.id === activeTabId);
  
  // View mode state: 'default', 'slide', or 'doc'
  const [viewMode, setViewMode] = useState<'default' | 'slide' | 'doc'>('default');
  
  // Use the chat hook to manage messages
  const { messages: chatMessages, sendMessage, isLoading: isAiTyping, clearMessages } = useChat({
    spaceId,
    insightId: activeTabId,
  });

  // Add keyboard shortcuts: Esc to close canvas, Cmd/Ctrl+K for new chat, Cmd/Ctrl+W to close tab
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc: Close canvas
      if (e.key === 'Escape') {
        onCloseCanvas();
      }
      
      // Cmd/Ctrl+K: New chat
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (onCreateNewInsight) {
          const newInsight: Insight = {
            id: `insight-${Date.now()}`,
            title: 'New Chat Insight',
            summary: 'Start chatting with AI to generate insights...',
            status: 'Open',
            tags: [],
            sources: [],
            comments: [],
            dateCreated: new Date(),
            createdBy: user?.firstName || user?.email || 'Anonymous',
            folderId: '',
          };
          onCreateNewInsight(newInsight);
        }
      }
      
      // Cmd/Ctrl+W: Close active tab
      if ((e.metaKey || e.ctrlKey) && e.key === 'w' && activeTabId) {
        e.preventDefault();
        onCloseTab(activeTabId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCloseCanvas, onCreateNewInsight, onCloseTab, activeTabId]);

  if (!activeInsight) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="h-full bg-[#1E1E1E] flex"
    >
      {/* Left Panel: AI Chat (30%) */}
      <div className="w-[30%] h-full border-r border-[#2A2A2A] flex flex-col bg-[#1A1A1A]">
        <CanvasAIChat 
          insight={activeInsight} 
          spaceId={spaceId}
          onCreateNewInsight={onCreateNewInsight} 
          onUpdateInsight={onUpdateInsight} 
          chatMessages={chatMessages} 
          sendMessage={sendMessage}
          isAiTyping={isAiTyping}
          clearMessages={clearMessages}
        />
      </div>

      {/* Right Panel: Insight Card Canvas (70%) */}
      <div className="w-[70%] flex flex-col">
        {/* Canvas Header with Tabs */}
        <div className="flex-shrink-0 bg-[#1E1E1E]">
          <div className="flex items-center justify-between px-[24px] py-[16px] bg-[rgb(33,33,33)]">
            <div className="flex items-center gap-2 overflow-x-auto flex-1">
              {/* Tabs */}
              {openTabs.map((insightId) => {
                const insight = insights.find(i => i.id === insightId);
                if (!insight) return null;
                
                const isActive = insightId === activeTabId;
                
                return (
                  <div
                    key={insightId}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#2A2A2A] text-white'
                        : 'text-[#9CA3AF] hover:text-white hover:bg-[#252525]'
                    }`}
                    onClick={() => onSwitchTab(insightId)}
                  >
                    <span className="text-sm whitespace-nowrap max-w-[200px] truncate">
                      {insight.title}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseTab(insightId);
                      }}
                      className="text-[#6B7280] hover:text-white transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
              
              {/* New Chat button - more minimal */}
              <button
                onClick={() => {
                  if (onCreateNewInsight) {
                    const newInsight: Insight = {
                      id: `insight-${Date.now()}`,
                      title: 'New Chat Insight',
                      summary: 'Start chatting with AI to generate insights...',
                      status: 'Open',
                      tags: [],
                      sources: [],
                      comments: [],
                      dateCreated: new Date(),
                      createdBy: user?.firstName || user?.email || 'Anonymous',
                      folderId: '',
                    };
                    onCreateNewInsight(newInsight);
                  }
                }}
                className="px-3 py-1.5 text-sm text-[#6B7280] hover:text-white transition-colors whitespace-nowrap"
              >
                + New Insight
              </button>
            </div>

            {/* View Mode Toggle Buttons */}
            <div className="flex items-center gap-1 ml-4">
              <button
                onClick={() => setViewMode('default')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'default'
                    ? 'text-white bg-[#2A2A2A]'
                    : 'text-[#6B7280] hover:text-white hover:bg-[#252525]'
                }`}
                title="Canvas View"
              >
                <FileText className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('slide')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'slide'
                    ? 'text-white bg-[#2A2A2A]'
                    : 'text-[#6B7280] hover:text-white hover:bg-[#252525]'
                }`}
                title="Slide View"
              >
                <Presentation className="w-5 h-5" />
              </button>
            </div>

            {/* Close Canvas Button - more minimal */}
            <button
              onClick={onCloseCanvas}
              className="ml-4 p-1.5 text-[#6B7280] hover:text-white rounded transition-colors"
              title="Close Canvas (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <CanvasInsightCard insight={activeInsight} tags={tags} onUpdateInsight={onUpdateInsight} insightId={activeInsight.id} chatMessages={chatMessages} viewMode={viewMode} />
      </div>
    </motion.div>
  );
}

// AI Chat Panel Component (Left Side)
interface CanvasAIChatProps {
  insight: Insight;
  spaceId: string | null;
  onCreateNewInsight?: (insight: Insight) => void;
  onUpdateInsight?: (insightId: string, updates: Partial<Insight>) => void;
  chatMessages: ChatMessage[];
  sendMessage: (content: string) => Promise<void>;
  isAiTyping: boolean;
  clearMessages: () => void;
}

function CanvasAIChat({ 
  insight, 
  spaceId,
  onCreateNewInsight, 
  onUpdateInsight, 
  chatMessages, 
  sendMessage,
  isAiTyping,
  clearMessages,
}: CanvasAIChatProps) {
  const [aiChatInput, setAiChatInput] = useState('');
  const aiChatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (aiChatContainerRef.current) {
      aiChatContainerRef.current.scrollTop = aiChatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSendAiMessage = async () => {
    if (!aiChatInput.trim()) return;
    
    const messageContent = aiChatInput.trim();
    
    // Auto-generate title from first message
    if (chatMessages.length === 0 && onUpdateInsight) {
      let autoTitle = messageContent;
      
      // Truncate if too long
      if (autoTitle.length > 50) {
        autoTitle = autoTitle.substring(0, 47) + '...';
      }
      
      // Capitalize first letter if needed
      autoTitle = autoTitle.charAt(0).toUpperCase() + autoTitle.slice(1);
      
      onUpdateInsight(insight.id, { title: autoTitle });
      toast.success('Title auto-generated from your message');
    }
    
    setAiChatInput('');
    
    // Send message using the hook
    await sendMessage(messageContent);
  };
  
  // Copy message to clipboard
  const handleCopyMessage = (content: string) => {
    copyToClipboard(content);
    toast.success('Message copied to clipboard!');
  };
  
  // Format relative time
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  };
  
  // Clear all chat history
  const handleClearChat = () => {
    if (confirm('Are you sure you want to clear all chat history? This cannot be undone.')) {
      clearMessages();
      toast.success('Chat history cleared');
    }
  };
  
  // Export conversation as markdown
  const handleExportChat = () => {
    if (chatMessages.length === 0) {
      toast.error('No messages to export');
      return;
    }
    
    let markdown = `# ${insight.title}\n\n`;
    markdown += `**Exported:** ${new Date().toLocaleString()}\n\n`;
    markdown += `---\n\n`;
    
    chatMessages.forEach((msg) => {
      const role = msg.role === 'user' ? '**You**' : '**AI Assistant**';
      const timestamp = formatRelativeTime(msg.timestamp);
      markdown += `### ${role} (${timestamp})\n\n`;
      markdown += `${msg.content}\n\n`;
      markdown += `---\n\n`;
    });
    
    // Create download
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${insight.id}-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Conversation exported as Markdown!');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header - REMOVED */}

      {/* Chat Messages */}
      <div
        ref={aiChatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 scrollbar-hide"
      >
        {chatMessages.length === 0 && (
          <div className="text-center py-8">
            <Sparkles className="w-8 h-8 mx-auto mb-3 text-[#FF6B35] opacity-50" />
            <p className="text-white mb-1">Start a conversation about this insight</p>
            <p className="text-xs text-[#6B7280] mb-6">Ask questions, get analysis, or brainstorm ideas (only you can see this chat)</p>
            
            {/* Starter Prompts */}
            <div className="space-y-2 max-w-md mx-auto">
              <button
                onClick={() => setAiChatInput("Analyze the key trends from the linked data sources")}
                className="w-full text-left px-4 py-3 bg-[#1A1F2E] hover:bg-[#252B3D] border border-[#2D3B4E] hover:border-[#FF6B35] rounded-lg transition-colors"
              >
                <p className="text-sm text-[#E5E7EB]">Analyze the key trends from the linked data sources</p>
              </button>
              <button
                onClick={() => setAiChatInput("What are the most important insights from this data?")}
                className="w-full text-left px-4 py-3 bg-[#1A1F2E] hover:bg-[#252B3D] border border-[#2D3B4E] hover:border-[#FF6B35] rounded-lg transition-colors"
              >
                <p className="text-sm text-[#E5E7EB]">What are the most important insights from this data?</p>
              </button>
              <button
                onClick={() => setAiChatInput("Generate actionable recommendations based on this insight")}
                className="w-full text-left px-4 py-3 bg-[#1A1F2E] hover:bg-[#252B3D] border border-[#2D3B4E] hover:border-[#FF6B35] rounded-lg transition-colors"
              >
                <p className="text-sm text-[#E5E7EB]">Generate actionable recommendations based on this insight</p>
              </button>
            </div>
          </div>
        )}
        
        {chatMessages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 group ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`relative max-w-[85%] rounded-lg p-3 transition-all bg-[#1A1F2E] text-[#E5E7EB]`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p className="text-xs opacity-60 mt-1">
                {formatRelativeTime(message.timestamp)}
              </p>
              
              {/* Hover Action Buttons */}
              <div className="absolute -top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#1A1F2E] border border-[#2D3B4E] rounded px-1 py-1">
                <button
                  onClick={() => handleCopyMessage(message.content)}
                  className="p-1 text-[#6B7280] hover:text-white transition-colors"
                  title="Copy message"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {isAiTyping && (
          <div className="flex gap-3">
            <div className="bg-[#1A1F2E] rounded-lg p-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-[#6B7280] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-[#6B7280] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-[#6B7280] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chat Input */}
      <div className="flex-shrink-0 p-4">
        <input
          type="text"
          value={aiChatInput}
          onChange={(e) => setAiChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendAiMessage();
            }
          }}
          placeholder="Ask about this insight... (Press Enter to send)"
          className="w-full px-4 py-3 bg-[#1A1F2E] border border-[#2D3B4E] text-white placeholder:text-[#6B7280] outline-none focus:border-[#FF6B35] transition-colors rounded-[43px] text-[13px]"
        />
      </div>
    </div>
  );
}

// Insight Card Canvas Component (Right Side)
function CanvasInsightCard({ insight, tags, onUpdateInsight, insightId, chatMessages, viewMode }: { insight: Insight; tags: Tag[]; onUpdateInsight?: (insightId: string, updates: Partial<Insight>) => void; insightId: string; chatMessages: ChatMessage[]; viewMode: 'default' | 'slide' | 'doc' }) {
  const [isDetailsCollapsed, setIsDetailsCollapsed] = useState(true); // Collapsed by default in canvas mode
  const [notes, setNotes] = useState(insight.summary);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isAIGenerated, setIsAIGenerated] = useState(true); // Track if content is AI-generated

  // Guard against undefined tags - API may return null/undefined
  const insightTagIds = insight.tags || [];
  const insightTags = tags.filter((tag) => insightTagIds.includes(tag.id));

  const handleRegenerateAISummary = () => {
    setIsRegenerating(true);
    
    // Simulate AI regeneration
    setTimeout(() => {
      const regeneratedContent = `AI-Generated Insight Summary (Regenerated at ${new Date().toLocaleTimeString()})\n\nBased on analysis of the linked sources and conversation context, here are the key findings:\n\n• This insight relates to "${insight.title}"\n• Generated from ${insight.sources.length} source${insight.sources.length !== 1 ? 's' : ''}\n• Created on ${insight.dateCreated.toLocaleDateString()}\n\nIn production, this would contain intelligent analysis of all connected data sources, chat history, and space context to provide actionable insights.`;
      
      setNotes(regeneratedContent);
      setIsAIGenerated(true);
      setIsRegenerating(false);
      toast.success('AI summary regenerated!');
    }, 2000);
  };

  const handleNotesChange = (newValue: string) => {
    setNotes(newValue);
    // Mark as user-edited if content diverges from AI-generated
    if (isAIGenerated) {
      setIsAIGenerated(false);
    }
  };
  
  // Generate notes summary from chat messages
  const handleUpdateNotesFromChat = () => {
    if (chatMessages.length === 0) {
      toast.error('No chat messages to summarize');
      return;
    }
    
    setIsRegenerating(true);
    
    // Simulate AI summary generation from chat
    setTimeout(() => {
      const userMessageCount = chatMessages.filter(m => m.role === 'user').length;
      const aiMessageCount = chatMessages.filter(m => m.role === 'assistant').length;
      
      // Extract key topics from user messages
      const userMessages = chatMessages.filter(m => m.role === 'user').map(m => m.content);
      const firstUserMessage = userMessages[0] || 'No messages';
      
      const summary = `AI-Generated Summary from ${chatMessages.length} Chat Messages\n(Generated at ${new Date().toLocaleTimeString()})\n\n**Conversation Overview:**\nThis chat included ${userMessageCount} question${userMessageCount !== 1 ? 's' : ''} and ${aiMessageCount} AI response${aiMessageCount !== 1 ? 's' : ''}.\n\n**Key Discussion Points:**\n• Initial question: "${firstUserMessage.substring(0, 80)}${firstUserMessage.length > 80 ? '...' : ''}"\n• Topics explored through AI conversation\n• Insights derived from back-and-forth dialogue\n\n**Next Steps:**\n• Review AI-generated responses for actionable insights\n• Consider linking relevant data sources\n• Share findings with team members\n\nIn production, this would intelligently summarize the entire conversation, extract key insights, and highlight action items.`;
      
      setNotes(summary);
      setIsAIGenerated(true);
      setIsRegenerating(false);
      toast.success(`Notes updated from ${chatMessages.length} chat messages!`);
    }, 2000);
  };

  // Render Slide View
  if (viewMode === 'slide') {
    return (
      <div className="flex flex-col flex-1 overflow-hidden bg-[#212121]">
        {/* Slide View - Google Slides Style */}
        <div className="flex-1 overflow-y-auto p-12">
          <div className="flex flex-col items-center justify-center gap-4">
            {/* Slide */}
            <div className="w-full max-w-4xl aspect-[16/9] bg-white rounded-lg shadow-2xl p-12 flex flex-col">
              {/* Title Box */}
              <div className="mb-8">
                <input
                  type="text"
                  defaultValue={insight.title}
                  onChange={(e) => {
                    if (onUpdateInsight) {
                      onUpdateInsight(insightId, { title: e.target.value });
                    }
                  }}
                  className="w-full text-4xl text-[#1A1A1A] bg-transparent border-b-2 border-[#E0E0E0] pb-4 outline-none focus:border-[#FF6B35] transition-colors"
                  placeholder="Click to add title"
                />
              </div>
              
              {/* Summary Box */}
              <div className="flex-1 border-2 border-[#E0E0E0] rounded p-6 overflow-y-auto">
                <textarea
                  value={notes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  placeholder="Click to add text"
                  className="w-full h-full text-lg text-[#333333] bg-transparent outline-none resize-none"
                />
              </div>
            </div>

            {/* Add Slide Button */}
            <button
              onClick={() => {
                toast.info('Add slide functionality coming soon!');
              }}
              className="w-full max-w-4xl py-4 bg-[#2A2A2A] hover:bg-[#333333] text-white rounded-lg transition-colors flex items-center justify-center gap-2 border border-[#3A3A3A] hover:border-[#FF6B35]"
            >
              <span className="text-lg">Add Slide +</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default View (existing)
  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#212121]">
      {/* Card Header - Clean title at top left */}
      <div className="flex-shrink-0 px-[32px] py-[26px] pt-[33px] pr-[32px] pb-[8px] pl-[32px]">
        <input
          type="text"
          value={insight.title}
          onChange={(e) => {
            if (onUpdateInsight) {
              onUpdateInsight(insightId, { title: e.target.value });
            }
          }}
          className="w-full text-xl text-white bg-transparent border-none outline-none focus:opacity-80 transition-opacity px-4"
          placeholder="Add a title..."
        />
      </div>

      {/* Card Content - Minimal, no section labels */}
      <div className="flex-1 overflow-y-auto px-[32px] py-[-6px] space-y-8 scrollbar-hide">
        {/* Notes Section - No label, just content */}
        <div className="flex flex-col h-full">
          <RichTextEditor
            content={notes}
            onChange={handleNotesChange}
            placeholder="Add your notes here... Type @ to mention someone or select text and click the comment button"
            disabled={isRegenerating}
          />
          
          {/* Regenerating indicator overlay */}
          {isRegenerating && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#212121]/80 rounded-lg z-20">
              <div className="flex items-center gap-2 text-[#FF6B35]">
                <RotateCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">Generating AI summary...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}