import React from 'react';
import { X, Camera, FolderTree, Sparkles, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WelcomeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WelcomeOverlay({ isOpen, onClose }: WelcomeOverlayProps) {
  const steps = [
    {
      icon: Camera,
      title: '1. Capture Your Data',
      description: 'Use the floating toolbar to capture data from any dashboard, spreadsheet, or analytics tool. Select regions, entire screens, or specific windows.',
      color: '#FF6B35',
    },
    {
      icon: FolderTree,
      title: '2. Organize in Projects',
      description: 'Your captures are automatically organized into projects and folders. View and edit your data in clean spreadsheet format with full editing capabilities.',
      color: '#FFA07A',
    },
    {
      icon: Sparkles,
      title: '3. Ask Your AI Assistant',
      description: 'Query your data using natural language. The AI Analyst references all your captured data to provide insights across multiple sources.',
      color: '#FF6B35',
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Welcome Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-[#1A1F2E] border border-[rgba(255,107,53,0.3)] rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.8)] w-full max-w-4xl mx-4 overflow-hidden"
          >
            {/* Header */}
            <div className="relative bg-gradient-to-br from-[#FF6B35] to-[#FFA07A] px-8 py-12">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              
              <div className="max-w-2xl">
                <h1 className="text-white text-4xl mb-3">Welcome to CaptureInsight</h1>
                <p className="text-white/90 text-lg">
                  Transform scattered data into actionable insights with screenshot-based analytics
                </p>
              </div>
            </div>

            {/* Steps */}
            <div className="px-8 py-8">
              <div className="grid grid-cols-3 gap-6 mb-8">
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                      className="relative"
                    >
                      <div className="bg-[#0A0E1A] border border-[rgba(255,107,53,0.2)] rounded-xl p-6 h-full">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                          style={{
                            background: `linear-gradient(135deg, ${step.color}, ${step.color}99)`,
                          }}
                        >
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-white mb-2">{step.title}</h3>
                        <p className="text-sm text-[#9CA3AF] leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                      
                      {/* Arrow between steps */}
                      {index < steps.length - 1 && (
                        <div className="absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                          <ArrowRight className="w-6 h-6 text-[#FF6B35]" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Key Features */}
              <div className="bg-[rgba(255,107,53,0.05)] border border-[rgba(255,107,53,0.2)] rounded-xl p-6 mb-6">
                <h3 className="text-white mb-4">Key Features</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#FF6B35] mt-1.5" />
                    <div>
                      <div className="text-sm text-white mb-1">No API Connections Needed</div>
                      <div className="text-xs text-[#9CA3AF]">Capture data from any source visually</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#FF6B35] mt-1.5" />
                    <div>
                      <div className="text-sm text-white mb-1">Persistent Capture Boxes</div>
                      <div className="text-xs text-[#9CA3AF]">Boxes save and reappear when you return</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#FF6B35] mt-1.5" />
                    <div>
                      <div className="text-sm text-white mb-1">Cross-Source Insights</div>
                      <div className="text-xs text-[#9CA3AF]">AI analyzes data from multiple tools</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#FF6B35] mt-1.5" />
                    <div>
                      <div className="text-sm text-white mb-1">Full Markup Tools</div>
                      <div className="text-xs text-[#9CA3AF]">Annotate, blur, and highlight captures</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="flex items-center justify-between">
                <div className="text-xs text-[#9CA3AF]">
                  This is an interactive demo. Click anywhere to start exploring.
                </div>
                <button
                  onClick={onClose}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white rounded-lg hover:shadow-lg transition-all"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
