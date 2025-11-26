import React, { useState } from 'react';
import { FolderPlus, Target, FileText, Edit2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';

interface CreateSpaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; description: string; goals: string; instructions: string }) => void;
}

export function CreateSpaceDialog({ isOpen, onClose, onCreate }: CreateSpaceDialogProps) {
  const [name, setName] = useState('');
  const [goals, setGoals] = useState('');
  const [instructions, setInstructions] = useState('');

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error('Space name is required');
      return;
    }
    onCreate({ name, description: '', goals, instructions });
    toast.success(`Space "${name}" created successfully`);
    
    // Reset form
    setName('');
    setGoals('');
    setInstructions('');
    onClose();
  };

  const handleCancel = () => {
    setName('');
    setGoals('');
    setInstructions('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1A1F2E] border-[rgba(255,107,53,0.3)] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-[#FF6B35]" />
            Create New Space
          </DialogTitle>
          <DialogDescription className="text-[#6B7280]">
            Define the purpose and guidelines for your new space.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Space Name */}
          <div className="space-y-2">
            <Label htmlFor="new-space-name" className="text-[#E5E7EB] flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-[#9CA3AF]" />
              Space Name <span className="text-red-400 ml-1">*</span>
            </Label>
            <Input
              id="new-space-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q4 Marketing Analysis"
              className="bg-[#0A0E1A] border-[rgba(255,107,53,0.3)] text-white placeholder:text-[#6B7280] focus:border-[#FF6B35]"
              autoFocus
            />
          </div>

          {/* Goals */}
          <div className="space-y-2">
            <Label htmlFor="new-space-goals" className="text-[#E5E7EB] flex items-center gap-2">
              <Target className="w-4 h-4 text-[#9CA3AF]" />
              Space Goals
            </Label>
            <Textarea
              id="new-space-goals"
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
            <Label htmlFor="new-space-instructions" className="text-[#E5E7EB] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#9CA3AF]" />
              AI Assistant Instructions
            </Label>
            <Textarea
              id="new-space-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="How should the AI Assistant interpret this data?&#10;&#10;Example:&#10;• Revenue data is in USD&#10;• Compare performance against $50 target CAC&#10;• Focus on month-over-month trends&#10;• Prioritize Google Ads and Facebook Ads analysis"
              rows={6}
              className="bg-[#0A0E1A] border-[rgba(255,107,53,0.3)] text-white placeholder:text-[#6B7280] focus:border-[#FF6B35] resize-none"
            />
            <p className="text-xs text-[#6B7280]">
              Guide how the AI should reference, analyze, and interpret data from this space.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-[rgba(255,107,53,0.2)]">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-[#9CA3AF] hover:text-white hover:bg-[#0A0E1A] rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white rounded-lg hover:shadow-lg transition-all text-sm"
            >
              Create Space
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}