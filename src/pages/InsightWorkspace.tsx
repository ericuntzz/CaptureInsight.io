import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown,
  ChevronUp,
  Image,
  FileText,
  Link2,
  Send,
  Copy,
  FileDown,
  Presentation,
  Plus,
  Edit3,
  Code,
  ArrowLeft,
  Sparkles,
  MessageSquare,
  Database,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useChat } from '../hooks/useChat';
import { useInsight, useCreateInsight, useUpdateInsight } from '../hooks/useInsights';
import { RichTextEditor } from '../components/RichTextEditor';
import { Button } from '../components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { copyToClipboard } from '../utils/clipboard';

interface InsightSource {
  id: string;
  sourceType: 'screenshot' | 'link' | 'file' | 'chat' | 'datasheet';
  sourceId: string;
  sourceName: string;
  sourceUrl?: string;
}

interface DataSourceViewerProps {
  source: InsightSource;
  sheetData: any;
  onEditData: (sourceId: string, newData: any) => void;
  onRemove: (sourceId: string) => void;
}

function DataSourceViewer({ source, sheetData, onEditData, onRemove }: DataSourceViewerProps) {
  const [showRawJson, setShowRawJson] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState(JSON.stringify(sheetData?.data || {}, null, 2));

  const imageUrl = sheetData?.data?.dataUrl || sheetData?.data?.preview;
  const extractedContent = sheetData?.data?.extracted || sheetData?.data;

  const handleSaveEdit = () => {
    try {
      const parsed = JSON.parse(editedData);
      onEditData(source.sourceId, parsed);
      setIsEditing(false);
      toast.success('Data updated successfully');
    } catch {
      toast.error('Invalid JSON format');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#1A1F2E]/60 border border-[#2A2F3E] rounded-xl p-4 hover:border-[#FF6B35]/30 transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {source.sourceType === 'screenshot' && <Image className="w-4 h-4 text-[#FF6B35]" />}
          {source.sourceType === 'link' && <Link2 className="w-4 h-4 text-blue-400" />}
          {source.sourceType === 'file' && <FileText className="w-4 h-4 text-emerald-400" />}
          <span className="text-sm font-medium text-white">{source.sourceName}</span>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowRawJson(!showRawJson)}
                className="p-1.5 rounded-lg hover:bg-[#2A2F3E] transition-colors"
              >
                <Code className={`w-3.5 h-3.5 ${showRawJson ? 'text-[#FF6B35]' : 'text-gray-400'}`} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{showRawJson ? 'Hide Raw Data' : 'View Raw Data'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onRemove(source.sourceId)}
                className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-400" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Remove Source</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {imageUrl && (
          <div className="relative group">
            <img
              src={imageUrl}
              alt={source.sourceName}
              className="w-full h-40 object-cover rounded-lg border border-[#2A2F3E]"
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
              <button className="px-3 py-1.5 bg-[#FF6B35] rounded-lg text-xs font-medium text-white">
                View Full Size
              </button>
            </div>
          </div>
        )}

        <div className={`${imageUrl ? '' : 'col-span-2'}`}>
          {showRawJson ? (
            <div className="relative">
              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editedData}
                    onChange={(e) => setEditedData(e.target.value)}
                    className="w-full h-40 bg-[#0A0D12] border border-[#2A2F3E] rounded-lg p-3 text-xs font-mono text-gray-300 focus:border-[#FF6B35] focus:outline-none resize-none"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEdit} className="bg-[#FF6B35] hover:bg-[#E55A2B]">
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <pre className="bg-[#0A0D12] border border-[#2A2F3E] rounded-lg p-3 text-xs font-mono text-gray-300 overflow-auto max-h-40">
                    {JSON.stringify(extractedContent, null, 2)}
                  </pre>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="absolute top-2 right-2 p-1.5 bg-[#2A2F3E] rounded-lg hover:bg-[#3A3F4E] transition-colors"
                  >
                    <Edit3 className="w-3 h-3 text-gray-400" />
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="bg-[#0A0D12] border border-[#2A2F3E] rounded-lg p-3 h-40 overflow-auto">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Extracted Data
              </h4>
              {typeof extractedContent === 'object' ? (
                <div className="space-y-1.5">
                  {Object.entries(extractedContent).slice(0, 6).map(([key, value]) => (
                    <div key={key} className="flex items-start gap-2">
                      <span className="text-xs text-gray-500 min-w-[80px]">{key}:</span>
                      <span className="text-xs text-white">
                        {typeof value === 'string' ? value : JSON.stringify(value)}
                      </span>
                    </div>
                  ))}
                  {Object.keys(extractedContent).length > 6 && (
                    <button
                      onClick={() => setShowRawJson(true)}
                      className="text-xs text-[#FF6B35] hover:underline"
                    >
                      +{Object.keys(extractedContent).length - 6} more fields
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-300">{String(extractedContent)}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {source.sourceUrl && (
        <a
          href={source.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 text-xs text-[#FF6B35] hover:underline flex items-center gap-1"
        >
          <Link2 className="w-3 h-3" />
          {source.sourceUrl}
        </a>
      )}
    </motion.div>
  );
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  badge?: string | number;
  children: React.ReactNode;
}

function CollapsibleSection({ title, icon, isOpen, onToggle, badge, children }: CollapsibleSectionProps) {
  return (
    <div className="border border-[#2A2F3E] rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-[#1A1F2E]/60 hover:bg-[#1A1F2E] transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="font-medium text-white">{title}</span>
          {badge !== undefined && (
            <span className="px-2 py-0.5 bg-[#FF6B35]/15 text-[#FF6B35] text-xs font-medium rounded-full">
              {badge}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-[#0A0D12]/50">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface InsightWorkspaceProps {
  onBack: () => void;
  spaceId: string | null;
  insightId?: string | null;
}

export function InsightWorkspace({ onBack, spaceId, insightId }: InsightWorkspaceProps) {
  useAuth();
  const [isDataSourcesOpen, setIsDataSourcesOpen] = useState(true);
  const [isAiChatOpen, setIsAiChatOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'default' | 'slide' | 'doc'>('default');

  const [insightTitle, setInsightTitle] = useState('New Insight');
  const [insightContent, setInsightContent] = useState('');
  const [sources, setSources] = useState<InsightSource[]>([]);
  const [sheetsData, setSheetsData] = useState<Record<string, any>>({});
  const [aiChatInput, setAiChatInput] = useState('');
  const aiChatContainerRef = useRef<HTMLDivElement>(null);

  const activeInsightId = insightId || `temp-${Date.now()}`;

  const { messages: chatMessages, sendMessage, isLoading: isAiTyping } = useChat({
    spaceId,
    insightId: activeInsightId,
  });

  const { data: insight } = useInsight(insightId || null);
  const updateInsightMutation = useUpdateInsight();
  const createInsightMutation = useCreateInsight();

  useEffect(() => {
    if (insight) {
      setInsightTitle(insight.title || 'Untitled Insight');
      setInsightContent(insight.summary || '');
    }
  }, [insight]);

  useEffect(() => {
    if (insightId) {
      fetch(`/api/insights/${insightId}/sources`, { credentials: 'include' })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setSources(data);
            data.forEach((source: InsightSource) => {
              if (source.sourceType === 'screenshot' || source.sourceType === 'datasheet') {
                fetch(`/api/sheets/${source.sourceId}`, { credentials: 'include' })
                  .then((res) => res.json())
                  .then((sheetData) => {
                    setSheetsData((prev) => ({ ...prev, [source.sourceId]: sheetData }));
                  })
                  .catch(console.error);
              }
            });
          }
        })
        .catch(console.error);
    }
  }, [insightId]);

  useEffect(() => {
    if (aiChatContainerRef.current) {
      aiChatContainerRef.current.scrollTop = aiChatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSendMessage = async () => {
    if (!aiChatInput.trim() || isAiTyping) return;
    const message = aiChatInput.trim();
    setAiChatInput('');
    await sendMessage(message);
  };

  const handleSaveInsight = async () => {
    if (!spaceId) {
      toast.error('Please select a space first');
      return;
    }

    try {
      if (insightId) {
        await updateInsightMutation.mutateAsync({
          id: insightId,
          data: { title: insightTitle, summary: insightContent },
        });
        toast.success('Insight saved');
      } else {
        await createInsightMutation.mutateAsync({
          spaceId,
          data: {
            title: insightTitle,
            summary: insightContent,
            status: 'Open',
          },
        });
        toast.success('Insight created');
      }
    } catch (error) {
      console.error('Error saving insight:', error);
      toast.error('Failed to save insight');
    }
  };

  const handleEditSourceData = (sourceId: string, newData: any) => {
    setSheetsData((prev) => ({
      ...prev,
      [sourceId]: { ...prev[sourceId], data: newData },
    }));
  };

  const handleRemoveSource = (sourceId: string) => {
    setSources((prev) => prev.filter((s) => s.sourceId !== sourceId));
    setSheetsData((prev) => {
      const newData = { ...prev };
      delete newData[sourceId];
      return newData;
    });
    toast.success('Source removed');
  };

  const handleExportMarkdown = () => {
    let markdown = `# ${insightTitle}\n\n`;
    markdown += insightContent.replace(/<[^>]*>/g, '');
    markdown += '\n\n---\n\n';
    markdown += `*Exported from CaptureInsight on ${new Date().toLocaleDateString()}*`;

    copyToClipboard(markdown);
    toast.success('Markdown copied to clipboard');
  };

  const handleExportPdf = () => {
    toast.info('PDF export coming soon');
  };

  const handleExportSlides = () => {
    toast.info('Slides export coming soon');
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-[#0A0D12]"
    >
      <div className="max-w-6xl mx-auto px-8 py-16">
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-12"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-200" />
          <span className="text-sm font-medium">Back</span>
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <input
              type="text"
              value={insightTitle}
              onChange={(e) => setInsightTitle(e.target.value)}
              placeholder="Insight Title..."
              className="text-3xl font-bold tracking-tight text-white bg-transparent border-none outline-none w-full placeholder:text-gray-600"
            />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveInsight}
                className="border-[#FF6B35]/30 text-[#FF6B35] hover:bg-[#FF6B35]/10"
              >
                Save
              </Button>
            </div>
          </div>
          <p className="text-gray-500 text-sm">
            {insightId ? 'Edit your insight and connected data sources' : 'Create a new insight from your data'}
          </p>
        </motion.div>

        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <CollapsibleSection
              title="Data Sources"
              icon={<Database className="w-5 h-5 text-[#FF6B35]" />}
              isOpen={isDataSourcesOpen}
              onToggle={() => setIsDataSourcesOpen(!isDataSourcesOpen)}
              badge={sources.length || undefined}
            >
              {sources.length > 0 ? (
                <div className="space-y-4">
                  {sources.map((source) => (
                    <DataSourceViewer
                      key={source.id}
                      source={source}
                      sheetData={sheetsData[source.sourceId]}
                      onEditData={handleEditSourceData}
                      onRemove={handleRemoveSource}
                    />
                  ))}
                  <button className="w-full py-3 border-2 border-dashed border-[#2A2F3E] rounded-xl text-gray-500 hover:text-[#FF6B35] hover:border-[#FF6B35]/30 transition-all flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">Add Data Source</span>
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Database className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <h4 className="text-white font-medium mb-1">No data sources yet</h4>
                  <p className="text-gray-500 text-sm mb-4">
                    Upload screenshots, files, or links to get started
                  </p>
                  <Button className="bg-gradient-to-r from-[#FF6B35] to-[#E55A2B]">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Data Source
                  </Button>
                </div>
              )}
            </CollapsibleSection>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <CollapsibleSection
              title="AI Chat"
              icon={<MessageSquare className="w-5 h-5 text-[#FF6B35]" />}
              isOpen={isAiChatOpen}
              onToggle={() => setIsAiChatOpen(!isAiChatOpen)}
              badge={chatMessages.length || undefined}
            >
              <div className="space-y-4">
                <div
                  ref={aiChatContainerRef}
                  className="h-64 overflow-y-auto space-y-3 bg-[#0A0D12] rounded-lg p-4"
                >
                  {chatMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                      <Sparkles className="w-8 h-8 text-[#FF6B35]/40 mb-2" />
                      <p className="text-gray-500 text-sm">
                        Ask AI about your data sources
                      </p>
                      <p className="text-gray-600 text-xs mt-1">
                        AI can see all connected data and help you extract insights
                      </p>
                    </div>
                  ) : (
                    chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-xl px-4 py-2.5 ${
                            msg.role === 'user'
                              ? 'bg-gradient-to-r from-[#FF6B35] to-[#E55A2B] text-white'
                              : 'bg-[#1A1F2E] text-gray-300 border border-[#2A2F3E]'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px] opacity-60">
                              {formatRelativeTime(msg.timestamp)}
                            </span>
                            {msg.role === 'assistant' && (
                              <button
                                onClick={() => {
                                  copyToClipboard(msg.content);
                                  toast.success('Copied to clipboard');
                                }}
                                className="p-1 hover:bg-white/10 rounded transition-colors"
                              >
                                <Copy className="w-3 h-3 opacity-60 hover:opacity-100" />
                              </button>
                            )}
                          </div>
                          {msg.citations && msg.citations.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-white/10">
                              <p className="text-[10px] opacity-50 mb-1">Sources:</p>
                              <div className="flex flex-wrap gap-1">
                                {msg.citations.map((cite, i) => (
                                  <span
                                    key={i}
                                    className="text-[10px] px-1.5 py-0.5 bg-[#FF6B35]/20 rounded text-[#FF6B35]"
                                  >
                                    {cite.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {isAiTyping && (
                    <div className="flex justify-start">
                      <div className="bg-[#1A1F2E] border border-[#2A2F3E] rounded-xl px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 bg-[#FF6B35] rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-[#FF6B35] rounded-full animate-bounce [animation-delay:0.1s]" />
                          <div className="w-2 h-2 bg-[#FF6B35] rounded-full animate-bounce [animation-delay:0.2s]" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiChatInput}
                    onChange={(e) => setAiChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    placeholder="Ask AI about your data..."
                    className="flex-1 px-4 py-3 bg-[#1A1F2E] border border-[#2A2F3E] rounded-full text-white placeholder:text-gray-500 focus:border-[#FF6B35] focus:outline-none text-sm"
                    disabled={isAiTyping}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!aiChatInput.trim() || isAiTyping}
                    className="bg-gradient-to-r from-[#FF6B35] to-[#E55A2B] hover:from-[#E55A2B] hover:to-[#D04A1B] rounded-full px-5"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CollapsibleSection>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="border border-[#2A2F3E] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between p-4 bg-[#1A1F2E]/60 border-b border-[#2A2F3E]">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-[#FF6B35]" />
                  <span className="font-medium text-white">Insight Canvas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-[#0A0D12] rounded-lg p-0.5">
                    {(['default', 'slide', 'doc'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          viewMode === mode
                            ? 'bg-[#FF6B35] text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-[#0A0D12]/50 min-h-[400px]">
                <RichTextEditor
                  content={insightContent}
                  onChange={setInsightContent}
                  placeholder="Start writing your insight..."
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-[#1A1F2E]/60 border-t border-[#2A2F3E]">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      toast.info('Insert data reference coming soon');
                    }}
                    className="text-gray-400 hover:text-white"
                  >
                    <Database className="w-4 h-4 mr-2" />
                    Insert Data
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      toast.info('AI expand coming soon');
                    }}
                    className="text-gray-400 hover:text-white"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI Expand
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={handleExportMarkdown}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy as Markdown</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={handleExportPdf}>
                        <FileDown className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export as PDF</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={handleExportSlides}>
                        <Presentation className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export as Slides</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
