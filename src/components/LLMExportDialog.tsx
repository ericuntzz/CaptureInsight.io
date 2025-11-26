import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Copy, Link2, FileText, CheckCircle2, Sparkles, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Space } from './SpaceBrowser';
import { copyToClipboard } from '../utils/clipboard';

interface LLMExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  space?: Space;
  project?: Space; // Backwards compatibility
}

interface FolderSelection {
  [folderId: string]: {
    selected: boolean;
    sheets: {
      [sheetId: string]: boolean;
    };
  };
}

export function LLMExportDialog({ isOpen, onClose, space, project }: LLMExportDialogProps) {
  const spaceData = space || project; // Use space, fall back to project for backwards compatibility
  const [activeTab, setActiveTab] = useState<'export' | 'api'>('export');
  const [selectedFolders, setSelectedFolders] = useState<FolderSelection>(() => {
    if (!spaceData) return {};
    const initial: FolderSelection = {};
    spaceData.folders.forEach(folder => {
      initial[folder.id] = {
        selected: true,
        sheets: {}
      };
      folder.sheets.forEach(sheet => {
        initial[folder.id].sheets[sheet.id] = true;
      });
    });
    return initial;
  });
  
  const [exportFormat, setExportFormat] = useState<'markdown' | 'json' | 'text'>('markdown');
  const [llmProvider, setLlmProvider] = useState<'openai' | 'anthropic' | 'custom'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const toggleFolder = (folderId: string) => {
    const newSelected = { ...selectedFolders };
    newSelected[folderId].selected = !newSelected[folderId].selected;
    // If selecting folder, select all its sheets
    if (newSelected[folderId].selected) {
      Object.keys(newSelected[folderId].sheets).forEach(sheetId => {
        newSelected[folderId].sheets[sheetId] = true;
      });
    }
    setSelectedFolders(newSelected);
  };

  const toggleSheet = (folderId: string, sheetId: string) => {
    const newSelected = { ...selectedFolders };
    newSelected[folderId].sheets[sheetId] = !newSelected[folderId].sheets[sheetId];
    
    // If all sheets are deselected, deselect folder
    const allSheetsDeselected = Object.values(newSelected[folderId].sheets).every(v => !v);
    if (allSheetsDeselected) {
      newSelected[folderId].selected = false;
    } else {
      newSelected[folderId].selected = true;
    }
    setSelectedFolders(newSelected);
  };

  const generateMarkdownExport = () => {
    let markdown = `# ${spaceData?.name}\n\n`;
    
    if (spaceData?.description) {
      markdown += `**Description:** ${spaceData.description}\n\n`;
    }
    
    if (spaceData?.goals) {
      markdown += `## Project Goals\n\n${spaceData.goals}\n\n`;
    }
    
    if (spaceData?.instructions) {
      markdown += `## AI Analysis Instructions\n\n${spaceData.instructions}\n\n`;
    }
    
    markdown += `---\n\n`;
    markdown += `## Data\n\n`;
    
    spaceData?.folders.forEach(folder => {
      if (selectedFolders[folder.id]?.selected) {
        markdown += `### ${folder.name}\n\n`;
        
        folder.sheets.forEach(sheet => {
          if (selectedFolders[folder.id].sheets[sheet.id]) {
            markdown += `#### ${sheet.name}\n`;
            markdown += `*${sheet.rowCount} rows of data*\n\n`;
            markdown += `**Sample Data:**\n`;
            markdown += `| Column A | Column B | Column C | Column D |\n`;
            markdown += `|----------|----------|----------|----------|\n`;
            markdown += `| Sample 1 | Data 1   | Value 1  | Metric 1 |\n`;
            markdown += `| Sample 2 | Data 2   | Value 2  | Metric 2 |\n`;
            markdown += `| Sample 3 | Data 3   | Value 3  | Metric 3 |\n\n`;
          }
        });
      }
    });
    
    markdown += `---\n\n`;
    markdown += `*Exported from CaptureInsight on ${new Date().toLocaleString()}*\n`;
    
    return markdown;
  };

  const generateJSONExport = () => {
    const selectedData = {
      project: {
        name: spaceData?.name,
        description: spaceData?.description,
        goals: spaceData?.goals,
        instructions: spaceData?.instructions,
      },
      folders: spaceData?.folders
        .filter(folder => selectedFolders[folder.id]?.selected)
        .map(folder => ({
          name: folder.name,
          sheets: folder.sheets
            .filter(sheet => selectedFolders[folder.id].sheets[sheet.id])
            .map(sheet => ({
              name: sheet.name,
              rowCount: sheet.rowCount,
              lastModified: sheet.lastModified,
              sampleData: [
                { columnA: 'Sample 1', columnB: 'Data 1', columnC: 'Value 1', columnD: 'Metric 1' },
                { columnA: 'Sample 2', columnB: 'Data 2', columnC: 'Value 2', columnD: 'Metric 2' },
                { columnA: 'Sample 3', columnB: 'Data 3', columnC: 'Value 3', columnD: 'Metric 3' },
              ]
            }))
        })),
      exportedAt: new Date().toISOString(),
    };
    
    return JSON.stringify(selectedData, null, 2);
  };

  const generateTextExport = () => {
    let text = `PROJECT: ${spaceData?.name}\n`;
    text += `${'='.repeat(60)}\n\n`;
    
    if (spaceData?.description) {
      text += `DESCRIPTION:\n${spaceData.description}\n\n`;
    }
    
    if (spaceData?.goals) {
      text += `GOALS:\n${spaceData.goals}\n\n`;
    }
    
    if (spaceData?.instructions) {
      text += `AI INSTRUCTIONS:\n${spaceData.instructions}\n\n`;
    }
    
    text += `${'-'.repeat(60)}\n`;
    text += `DATA:\n\n`;
    
    spaceData?.folders.forEach(folder => {
      if (selectedFolders[folder.id]?.selected) {
        text += `\n[${folder.name}]\n`;
        
        folder.sheets.forEach(sheet => {
          if (selectedFolders[folder.id].sheets[sheet.id]) {
            text += `  • ${sheet.name} (${sheet.rowCount} rows)\n`;
            text += `    Sample Data:\n`;
            text += `    Column A | Column B | Column C | Column D\n`;
            text += `    Sample 1 | Data 1   | Value 1  | Metric 1\n`;
            text += `    Sample 2 | Data 2   | Value 2  | Metric 2\n`;
            text += `    Sample 3 | Data 3   | Value 3  | Metric 3\n\n`;
          }
        });
      }
    });
    
    text += `\nExported: ${new Date().toLocaleString()}\n`;
    
    return text;
  };

  const getExportContent = () => {
    switch (exportFormat) {
      case 'markdown':
        return generateMarkdownExport();
      case 'json':
        return generateJSONExport();
      case 'text':
        return generateTextExport();
      default:
        return generateMarkdownExport();
    }
  };

  const handleCopyToClipboard = async () => {
    const content = getExportContent();
    try {
      await copyToClipboard(content);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleConnectAPI = () => {
    if (!apiKey.trim()) {
      toast.error('Please enter your API key');
      return;
    }

    // Mock API connection
    toast.success(`Connected to ${llmProvider.toUpperCase()}! Your project data is now accessible to the LLM.`);
    
    // In a real implementation, this would:
    // 1. Validate the API key
    // 2. Send the selected data to the LLM's context/knowledge base
    // 3. Set up a connection for ongoing access
  };

  const selectedCount = spaceData?.folders.reduce((count, folder) => {
    if (selectedFolders[folder.id]?.selected) {
      return count + Object.values(selectedFolders[folder.id].sheets).filter(Boolean).length;
    }
    return count;
  }, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1A1F2E] border-[rgba(255,107,53,0.3)] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#FF6B35]" />
            Connect to LLM
          </DialogTitle>
          <DialogDescription className="text-sm text-[#9CA3AF] mt-1">
            Export your project data or connect directly to your preferred LLM
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'export' | 'api')} className="mt-4">
          <TabsList className="grid w-full grid-cols-2 bg-[#0A0E1A]">
            <TabsTrigger 
              value="export" 
              className="data-[state=active]:bg-[#FF6B35] data-[state=active]:text-white"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy & Paste
            </TabsTrigger>
            <TabsTrigger 
              value="api" 
              className="data-[state=active]:bg-[#FF6B35] data-[state=active]:text-white"
            >
              <Link2 className="w-4 h-4 mr-2" />
              API Connection
            </TabsTrigger>
          </TabsList>

          {/* Data Selection Panel - Shared */}
          <div className="my-6 p-4 bg-[#0A0E1A] border border-[rgba(255,107,53,0.2)] rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-[#E5E7EB]">Select Data to Include</Label>
              <span className="text-xs text-[#9CA3AF]">{selectedCount} sheets selected</span>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {spaceData?.folders.map(folder => (
                <div key={folder.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`folder-${folder.id}`}
                      checked={selectedFolders[folder.id]?.selected}
                      onCheckedChange={() => toggleFolder(folder.id)}
                      className="border-[rgba(255,107,53,0.5)] data-[state=checked]:bg-[#FF6B35]"
                    />
                    <Label
                      htmlFor={`folder-${folder.id}`}
                      className="text-sm text-[#E5E7EB] cursor-pointer"
                    >
                      {folder.name} ({folder.sheets.length} sheets)
                    </Label>
                  </div>

                  {selectedFolders[folder.id]?.selected && (
                    <div className="ml-6 space-y-1.5">
                      {folder.sheets.map(sheet => (
                        <div key={sheet.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`sheet-${sheet.id}`}
                            checked={selectedFolders[folder.id].sheets[sheet.id]}
                            onCheckedChange={() => toggleSheet(folder.id, sheet.id)}
                            className="border-[rgba(255,107,53,0.5)] data-[state=checked]:bg-[#FF6B35]"
                          />
                          <Label
                            htmlFor={`sheet-${sheet.id}`}
                            className="text-xs text-[#9CA3AF] cursor-pointer"
                          >
                            {sheet.name} ({sheet.rowCount} rows)
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#E5E7EB]">Export Format</Label>
              <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as any)}>
                <SelectTrigger className="bg-[#0A0E1A] border-[rgba(255,107,53,0.3)] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1F2E] border-[rgba(255,107,53,0.3)]">
                  <SelectItem value="markdown" className="text-white hover:bg-[rgba(255,107,53,0.1)]">
                    Markdown (Best for ChatGPT, Claude)
                  </SelectItem>
                  <SelectItem value="json" className="text-white hover:bg-[rgba(255,107,53,0.1)]">
                    JSON (Structured data)
                  </SelectItem>
                  <SelectItem value="text" className="text-white hover:bg-[rgba(255,107,53,0.1)]">
                    Plain Text (Universal)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {showPreview && (
              <div className="space-y-2">
                <Label className="text-[#E5E7EB] flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Preview
                </Label>
                <pre className="bg-[#0A0E1A] border border-[rgba(255,107,53,0.2)] rounded-lg p-4 text-xs text-[#E5E7EB] max-h-96 overflow-y-auto">
                  {getExportContent()}
                </pre>
              </div>
            )}

            <div className="flex items-center gap-2 pt-4 border-t border-[rgba(255,107,53,0.2)]">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="px-4 py-2 text-[#9CA3AF] hover:text-white hover:bg-[#0A0E1A] rounded-lg transition-colors text-sm flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </button>
              
              <div className="flex-1" />
              
              <button
                onClick={handleCopyToClipboard}
                className="px-4 py-2 bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white rounded-lg hover:shadow-lg transition-all text-sm flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy to Clipboard
                  </>
                )}
              </button>
            </div>

            <div className="bg-[rgba(255,107,53,0.1)] border border-[rgba(255,107,53,0.3)] rounded-lg p-3">
              <p className="text-xs text-[#E5E7EB]">
                <strong>How to use:</strong> Copy the exported data and paste it into your LLM chat (ChatGPT, Claude, etc.) 
                along with your question or request for analysis.
              </p>
            </div>
          </TabsContent>

          {/* API Connection Tab */}
          <TabsContent value="api" className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#E5E7EB]">LLM Provider</Label>
              <Select value={llmProvider} onValueChange={(v) => setLlmProvider(v as any)}>
                <SelectTrigger className="bg-[#0A0E1A] border-[rgba(255,107,53,0.3)] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1F2E] border-[rgba(255,107,53,0.3)]">
                  <SelectItem value="openai" className="text-white hover:bg-[rgba(255,107,53,0.1)]">
                    OpenAI (ChatGPT)
                  </SelectItem>
                  <SelectItem value="anthropic" className="text-white hover:bg-[rgba(255,107,53,0.1)]">
                    Anthropic (Claude)
                  </SelectItem>
                  <SelectItem value="custom" className="text-white hover:bg-[rgba(255,107,53,0.1)]">
                    Custom API Endpoint
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[#E5E7EB]">API Key</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="bg-[#0A0E1A] border-[rgba(255,107,53,0.3)] text-white placeholder:text-[#6B7280]"
              />
              <p className="text-xs text-[#6B7280]">
                Your API key is stored locally and never sent to CaptureInsight servers.
              </p>
            </div>

            <div className="bg-[rgba(255,107,53,0.1)] border border-[rgba(255,107,53,0.3)] rounded-lg p-3">
              <p className="text-xs text-[#E5E7EB] mb-2">
                <strong>What happens when you connect:</strong>
              </p>
              <ul className="text-xs text-[#9CA3AF] space-y-1 list-disc list-inside">
                <li>Your selected project data will be uploaded to {llmProvider === 'openai' ? 'OpenAI' : llmProvider === 'anthropic' ? 'Anthropic' : 'your custom endpoint'}</li>
                <li>The LLM will have ongoing access to analyze this data</li>
                <li>You can query the data directly through the LLM interface</li>
                <li>Data syncs automatically when you update your project</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-[rgba(255,107,53,0.2)]">
              <button
                onClick={onClose}
                className="px-4 py-2 text-[#9CA3AF] hover:text-white hover:bg-[#0A0E1A] rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConnectAPI}
                className="px-4 py-2 bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white rounded-lg hover:shadow-lg transition-all text-sm flex items-center gap-2"
              >
                <Link2 className="w-4 h-4" />
                Connect to {llmProvider === 'openai' ? 'OpenAI' : llmProvider === 'anthropic' ? 'Anthropic' : 'API'}
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}