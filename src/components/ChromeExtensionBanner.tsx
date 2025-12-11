import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Chrome, Download } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

const BANNER_DISMISSED_KEY = 'captureinsight_extension_banner_dismissed';

interface ChromeExtensionBannerProps {
  className?: string;
}

export function ChromeExtensionBanner({ className = '' }: ChromeExtensionBannerProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem(BANNER_DISMISSED_KEY);
    if (!isDismissed) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    setIsVisible(false);
  };

  const handleInstall = () => {
    toast.info('Chrome extension coming soon! We\'ll notify you when it\'s available.');
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border-b border-blue-100 ${className}`}
        >
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 flex items-center justify-center">
                <Chrome className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm text-gray-700">
                Capture data instantly with our Chrome Extension.
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                onClick={handleInstall}
                size="sm"
                className="bg-[#030213] hover:bg-[#1a1a2e] text-white rounded-lg text-sm px-4"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Install Extension
              </Button>
              <button
                onClick={handleDismiss}
                className="p-1.5 hover:bg-blue-100 rounded-full transition-colors"
                aria-label="Dismiss banner"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
