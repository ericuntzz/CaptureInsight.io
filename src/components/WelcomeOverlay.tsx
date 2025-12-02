import { useState } from 'react';
import { X, Camera, FolderTree, Sparkles, ArrowRight, Shield, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Switch } from './ui/switch';

interface WelcomeOverlayProps {
  isOpen: boolean;
  onComplete: (aiLearningConsent: boolean) => void;
  onClose?: () => void;
}

export function WelcomeOverlay({ isOpen, onComplete, onClose }: WelcomeOverlayProps) {
  const [aiLearningConsent, setAiLearningConsent] = useState(false);
  
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

  const handleGetStarted = () => {
    onComplete(aiLearningConsent);
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      onComplete(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Welcome Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-[#1A1F2E] border border-[rgba(255,107,53,0.3)] rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.8)] w-full max-w-4xl mx-4 overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="relative bg-gradient-to-br from-[#FF6B35] to-[#FFA07A] px-8 py-12">
              <button
                onClick={handleClose}
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

              {/* AI Learning Consent Section */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-[#0A0E1A] border border-[#2A2F3E] rounded-xl p-6 mb-6"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white text-lg mb-2">Help Improve Our AI</h3>
                    <p className="text-sm text-[#9CA3AF] mb-4 leading-relaxed">
                      Would you like to help us make our AI smarter? By enabling this option, 
                      your feedback on AI responses will be used to improve our algorithms.
                    </p>
                    
                    {/* Privacy assurance */}
                    <div className="bg-[#1A1F2E] border border-[#2A2F3E] rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Lock className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-medium text-emerald-400">Your Privacy is Protected</span>
                      </div>
                      <ul className="text-xs text-[#9CA3AF] space-y-1.5">
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-400 mt-0.5">•</span>
                          <span>We will <strong className="text-white">never</strong> use any Personally Identifiable Information (PII) to train our algorithms</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-400 mt-0.5">•</span>
                          <span>All feedback data is <strong className="text-white">completely anonymized</strong> before being used</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-400 mt-0.5">•</span>
                          <span>Your sensitive information (emails, phone numbers, etc.) is <strong className="text-white">automatically stripped</strong></span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-400 mt-0.5">•</span>
                          <span>You can change this setting anytime in your account preferences</span>
                        </li>
                      </ul>
                    </div>

                    {/* Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={aiLearningConsent}
                          onCheckedChange={setAiLearningConsent}
                          className="data-[state=checked]:bg-emerald-500"
                        />
                        <span className={`text-sm ${aiLearningConsent ? 'text-white' : 'text-[#9CA3AF]'}`}>
                          {aiLearningConsent 
                            ? 'Yes, I want to help improve the AI' 
                            : 'No thanks, keep my feedback private'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* CTA */}
              <div className="flex items-center justify-between">
                <div className="text-xs text-[#9CA3AF]">
                  This is an interactive demo. Click anywhere to start exploring.
                </div>
                <button
                  onClick={handleGetStarted}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white rounded-lg hover:shadow-lg transition-all hover:scale-105"
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
