import React from 'react';
import { Camera, Database, Lightbulb, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from '../hooks/useRouter';
import { buildRoute } from '../routes';

interface NavigationProps {
  currentView: 'capture' | 'data' | 'changelogs' | 'insights';
  onViewChange: (view: 'capture' | 'data' | 'changelogs' | 'insights') => void;
  currentSpaceName?: string;
}

export function Navigation({ currentView, onViewChange, currentSpaceName }: NavigationProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 h-[72px] bg-[#0A0E1A] border-b border-[#1A1F2E] z-50">
      <div className="max-w-[1400px] mx-auto px-6 h-full flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <Link to={buildRoute.capture()} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF6B35] to-[#FFA07A] flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-semibold">CaptureInsight</h1>
              {currentSpaceName && (
                <p className="text-xs text-[#6B7280]">{currentSpaceName}</p>
              )}
            </div>
          </Link>
        </div>

        {/* Right side - AI Assistant could go here */}
        <div className="flex items-center gap-3">
          {/* Placeholder for user menu, notifications, etc. */}
        </div>
      </div>
    </nav>
  );
}