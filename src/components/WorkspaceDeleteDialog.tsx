import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Download, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface WorkspaceDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
  onConfirmDelete: () => void;
}

export function WorkspaceDeleteDialog({
  isOpen,
  onClose,
  workspaceId,
  workspaceName,
  onConfirmDelete,
}: WorkspaceDeleteDialogProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/export`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workspaceName.replace(/[^a-z0-9]/gi, '_')}_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Workspace data exported successfully');
    } catch (error) {
      console.error('Error exporting workspace data:', error);
      toast.error('Failed to export workspace data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      onConfirmDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="bg-[#1A1F2E] border-[#2A2F3E] max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <AlertDialogTitle className="text-white text-lg font-semibold">
              Delete Workspace
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-gray-400 text-sm leading-relaxed">
            Are you sure you want to delete <span className="text-white font-medium">"{workspaceName}"</span>?
            <br /><br />
            <span className="text-red-400 font-medium">This action cannot be undone.</span> All data in this workspace will be permanently deleted, including:
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>All sheets and captured data</li>
              <li>Chat conversations and history</li>
              <li>Insights and analysis results</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-4 p-3 bg-[#0D1117] rounded-lg border border-[#2A2F3E]">
          <p className="text-sm text-gray-400 mb-3">
            Want to keep a copy of your data before deleting?
          </p>
          <button
            onClick={handleExportData}
            disabled={isExporting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#2A2F3E] hover:bg-[#3A3F4E] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download Data (JSON)
              </>
            )}
          </button>
        </div>

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel 
            onClick={onClose}
            className="bg-[#2A2F3E] hover:bg-[#3A3F4E] text-white border-none"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white border-none"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              'Delete Workspace'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
