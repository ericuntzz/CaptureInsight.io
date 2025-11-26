import React, { useState } from 'react';
import { X, Target, FileText, Trash2, Edit2, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { LLMExportDialog } from './LLMExportDialog';
import { Project } from './ProjectBrowser';

/**
 * ============================================================================
 * 🤖 REPLIT AI REFACTORING NOTE
 * ============================================================================
 * 
 * This component needs refactoring from "Project" to "Space":
 * 
 * 1. INTERFACE TO RENAME:
 *    - ProjectSettingsDialogProps → SpaceSettingsDialogProps
 * 
 * 2. PARAMETERS TO RENAME:
 *    - projectName → spaceName
 *    - projectId → spaceId
 *    - project → space
 * 
 * 3. IMPORTS TO UPDATE:
 *    - import { Project } from './ProjectBrowser' → import { Space } from './SpaceBrowser'
 * 
 * 4. COMPONENT NAME:
 *    - export function ProjectSettingsDialog → export function SpaceSettingsDialog
 * 
 * 5. FILE TO RENAME:
 *    - This file should be renamed to SpaceSettingsDialog.tsx
 * 
 * The UI text has already been updated below.
 * ============================================================================
 */

interface ProjectSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  projectId: string;
  project: Project;
  currentGoals?: string;
  currentInstructions?: string;
  onSave: (projectId: string, data: { name: string; goals: string; instructions: string }) => void;
  onDelete: (projectId: string) => void;
}

export function ProjectSettingsDialog({
  isOpen,
  onClose,
  projectName,
  projectId,
  project,
  currentGoals = '',
  currentInstructions = '',
  onSave,
  onDelete,
}: ProjectSettingsDialogProps) {
  const [name, setName] = useState(projectName);
  const [goals, setGoals] = useState(currentGoals);
  const [instructions, setInstructions] = useState(currentInstructions);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLLMExport, setShowLLMExport] = useState(false);

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Space name cannot be empty');
      return;
    }
    onSave(projectId, { name, goals, instructions });
    toast.success('Space settings saved');
    onClose();
  };

  const handleDelete = () => {
    onDelete(projectId);
    toast.success('Space deleted');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1A1F2E] border-[rgba(255,107,53,0.3)] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-[#FF6B35]" />
            Space Settings
          </DialogTitle>
          <DialogDescription className="text-[#9CA3AF]">
            Configure the settings for your space to optimize AI assistance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Space Name */}
          <div className="space-y-2">
            <Label htmlFor="project-name" className="text-[#E5E7EB] flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-[#9CA3AF]" />
              Space Name
            </Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter space name..."
              className="bg-[#0A0E1A] border-[rgba(255,107,53,0.3)] text-white placeholder:text-[#6B7280] focus:border-[#FF6B35]"
            />
          </div>

          {/* Goals */}
          <div className="space-y-2">
            <Label htmlFor="project-goals" className="text-[#E5E7EB] flex items-center gap-2">
              <Target className="w-4 h-4 text-[#9CA3AF]" />
              Space Goals
            </Label>
            <Textarea
              id="project-goals"
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder="What are you trying to achieve with this space?&#10;&#10;Example: Track Q4 marketing performance to optimize CAC and identify highest-performing channels."
              rows={4}
              className="bg-[#0A0E1A] border-[rgba(255,107,53,0.3)] text-white placeholder:text-[#6B7280] focus:border-[#FF6B35] resize-none"
            />
            <p className="text-xs text-[#6B7280]">
              Define your objectives to help the AI Assistant understand what you're working toward.
            </p>
          </div>

          {/* AI Instructions */}
          <div className="space-y-2">
            <Label htmlFor="project-instructions" className="text-[#E5E7EB] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#9CA3AF]" />
              AI Assistant Instructions
            </Label>
            <Textarea
              id="project-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="How should the AI Assistant interpret this data?&#10;&#10;Example:&#10;• Revenue data is in USD&#10;• Compare performance against $50 target CAC&#10;• Focus on month-over-month trends&#10;�� Prioritize Google Ads and Facebook Ads analysis"
              rows={6}
              className="bg-[#0A0E1A] border-[rgba(255,107,53,0.3)] text-white placeholder:text-[#6B7280] focus:border-[#FF6B35] resize-none"
            />
            <p className="text-xs text-[#6B7280]">
              Guide how the AI should reference, analyze, and interpret data from this space.
            </p>
          </div>

          {/* LLM Connection Section */}
          <div className="space-y-2 p-4 bg-[rgba(255,107,53,0.05)] border border-[rgba(255,107,53,0.2)] rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <Label className="text-[#E5E7EB] flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-[#FF6B35]" />
                  Connect to External LLM
                </Label>
                <p className="text-xs text-[#9CA3AF]">
                  Export your space data to use with ChatGPT, Claude, or other LLMs. Choose specific folders and sheets to include.
                </p>
              </div>
              <button
                onClick={() => setShowLLMExport(true)}
                className="ml-4 px-4 py-2 bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white rounded-lg hover:shadow-lg transition-all text-sm whitespace-nowrap flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Connect LLM
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-[rgba(255,107,53,0.2)]">
            {/* Delete Button */}
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-sm">Delete Space</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-400">Are you sure?</span>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors"
                >
                  Yes, Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 bg-[#0A0E1A] text-[#9CA3AF] text-sm rounded-lg hover:bg-[#1A1F2E] transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Save Buttons - Hide when delete confirmation is active */}
            {!showDeleteConfirm && (
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-[#9CA3AF] hover:text-white hover:bg-[#0A0E1A] rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white rounded-lg hover:shadow-lg transition-all text-sm"
                >
                  Save Changes
                </button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>

      {/* LLM Export Dialog */}
      <LLMExportDialog
        isOpen={showLLMExport}
        onClose={() => setShowLLMExport(false)}
        project={project}
      />
    </Dialog>
  );
}