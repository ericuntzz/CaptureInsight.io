import { Copy, Download, Grid3X3 } from 'lucide-react';
import { Button } from '../ui/button';

interface BackupCodesDisplayProps {
  codes: string[];
  onCopyAll?: () => void;
  onDownload?: () => void;
}

export function BackupCodesDisplay({ codes, onCopyAll, onDownload }: BackupCodesDisplayProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-gray-400">
        <Grid3X3 className="w-4 h-4" />
        <span className="text-sm font-medium">Backup Codes</span>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {codes.map((code, index) => (
          <div
            key={index}
            className="bg-[#0F1219] border border-[rgba(255,107,53,0.2)] rounded-lg px-4 py-3 text-center font-mono text-white text-sm tracking-wider"
          >
            {code}
          </div>
        ))}
      </div>

      {(onCopyAll || onDownload) && (
        <div className="flex gap-3">
          {onCopyAll && (
            <Button
              type="button"
              variant="outline"
              onClick={onCopyAll}
              className="flex-1 border-[rgba(255,107,53,0.3)] text-white hover:bg-[rgba(255,107,53,0.1)] hover:text-white"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy All
            </Button>
          )}
          {onDownload && (
            <Button
              type="button"
              variant="outline"
              onClick={onDownload}
              className="flex-1 border-[rgba(255,107,53,0.3)] text-white hover:bg-[rgba(255,107,53,0.1)] hover:text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default BackupCodesDisplay;
