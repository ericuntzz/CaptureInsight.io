import React from 'react';
import { Database } from 'lucide-react';

interface QuickNavButtonProps {
  onClick: () => void;
}

export function QuickNavButton({ onClick }: QuickNavButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-br from-[#FF6B35] to-[#FFA07A] rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center z-50 group"
      aria-label="View Dashboard"
    >
      <Database className="w-6 h-6 text-white" />
      
      {/* Tooltip */}
      <div className="absolute bottom-full mb-3 right-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="bg-[#2D3B4E] rounded-lg px-3 py-1.5 shadow-lg whitespace-nowrap">
          <span className="text-xs text-white">View Dashboard</span>
        </div>
      </div>
    </button>
  );
}
