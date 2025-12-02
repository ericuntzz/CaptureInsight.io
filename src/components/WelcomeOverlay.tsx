import { useState } from 'react';
import { X, Camera, FolderTree, Sparkles, ArrowRight, Shield, Lock, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Switch } from './ui/switch';

interface WelcomeOverlayProps {
  isOpen: boolean;
  onComplete: (aiLearningConsent: boolean) => void;
  onClose?: () => void;
  isLoading?: boolean;
  isStatusLoading?: boolean;
  hasError?: boolean;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function WelcomeOverlay({ 
  isOpen, 
  onComplete, 
  onClose, 
  isLoading = false,
  isStatusLoading = false,
  hasError = false,
  onRetry,
  isRetrying = false,
}: WelcomeOverlayProps) {
  const [aiLearningConsent, setAiLearningConsent] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  
  const steps = [
    {
      icon: Camera,
      title: '1. Capture Your Data',
      description: 'Use the floating toolbar to capture data from any dashboard, spreadsheet, or analytics tool.',
      color: '#FF6B35',
    },
    {
      icon: FolderTree,
      title: '2. Organize in Projects',
      description: 'Your captures are automatically organized into projects. View and edit data in spreadsheet format.',
      color: '#FFA07A',
    },
    {
      icon: Sparkles,
      title: '3. Ask Your AI Assistant',
      description: 'Query your data using natural language. Get insights across all your captured sources.',
      color: '#FF6B35',
    },
  ];

  const handleGetStarted = () => {
    if (isLoading) return;
    onComplete(aiLearningConsent);
  };

  const handleClose = () => {
    if (isLoading) return;
    if (onClose) {
      onClose();
    } else {
      setShowSkipConfirm(true);
    }
  };
  
  const handleConfirmSkip = () => {
    setShowSkipConfirm(false);
    onComplete(false);
  };
  
  const handleCancelSkip = () => {
    setShowSkipConfirm(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          {/* Backdrop - doesn't dismiss on click to prevent accidental close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Welcome Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="relative bg-[#1A1F2E] border border-[rgba(255,107,53,0.3)] rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.8)] w-full max-w-4xl overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="relative bg-gradient-to-br from-[#FF6B35] to-[#FFA07A] px-6 sm:px-8 py-8 sm:py-12">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Close welcome overlay"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              
              <div className="max-w-2xl">
                <h1 className="text-white text-2xl sm:text-4xl font-semibold mb-2 sm:mb-3">
                  Welcome to CaptureInsight
                </h1>
                <p className="text-white/90 text-base sm:text-lg">
                  Transform scattered data into actionable insights with screenshot-based analytics
                </p>
              </div>
            </div>

            {/* Loading State */}
            {isStatusLoading && (
              <div className="px-6 sm:px-8 py-12 flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#FF6B35] animate-spin mb-4" />
                <p className="text-[#9CA3AF] text-sm">Loading your preferences...</p>
              </div>
            )}
            
            {/* Error State */}
            {hasError && !isStatusLoading && !isRetrying && (
              <div className="px-6 sm:px-8 py-8">
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
                  <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                  <h3 className="text-white font-medium mb-2">Connection Issue</h3>
                  <p className="text-sm text-[#9CA3AF] mb-4">
                    We couldn't load your preferences. Please check your connection and try again.
                  </p>
                  {onRetry && (
                    <button
                      onClick={onRetry}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#2A2F3E] text-white text-sm rounded-lg hover:bg-[#3A3F4E] transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Try Again</span>
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {/* Retrying State */}
            {isRetrying && (
              <div className="px-6 sm:px-8 py-12 flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#FF6B35] animate-spin mb-4" />
                <p className="text-[#9CA3AF] text-sm">Retrying connection...</p>
              </div>
            )}

            {/* Steps - only show when not loading, no error, and not retrying */}
            {!isStatusLoading && !hasError && !isRetrying && (
            <div className="px-6 sm:px-8 py-6 sm:py-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
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
                      <div className="bg-[#0A0E1A] border border-[rgba(255,107,53,0.2)] rounded-xl p-4 sm:p-6 h-full">
                        <div
                          className="w-10 sm:w-12 h-10 sm:h-12 rounded-full flex items-center justify-center mb-3 sm:mb-4"
                          style={{
                            background: `linear-gradient(135deg, ${step.color}, ${step.color}99)`,
                          }}
                        >
                          <Icon className="w-5 sm:w-6 h-5 sm:h-6 text-white" />
                        </div>
                        <h3 className="text-white font-medium text-sm sm:text-base mb-2">{step.title}</h3>
                        <p className="text-xs sm:text-sm text-[#9CA3AF] leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                      
                      {/* Arrow between steps - only visible on desktop */}
                      {index < steps.length - 1 && (
                        <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                          <ArrowRight className="w-6 h-6 text-[#FF6B35]" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Key Features - Collapsible on mobile */}
              <div className="bg-[rgba(255,107,53,0.05)] border border-[rgba(255,107,53,0.2)] rounded-xl p-4 sm:p-6 mb-6">
                <h3 className="text-white font-medium mb-3 sm:mb-4">Key Features</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#FF6B35] mt-1.5 shrink-0" />
                    <div>
                      <div className="text-xs sm:text-sm text-white mb-0.5 sm:mb-1">No API Connections Needed</div>
                      <div className="text-xs text-[#9CA3AF]">Capture data from any source visually</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#FF6B35] mt-1.5 shrink-0" />
                    <div>
                      <div className="text-xs sm:text-sm text-white mb-0.5 sm:mb-1">Persistent Capture Boxes</div>
                      <div className="text-xs text-[#9CA3AF]">Boxes save and reappear when you return</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#FF6B35] mt-1.5 shrink-0" />
                    <div>
                      <div className="text-xs sm:text-sm text-white mb-0.5 sm:mb-1">Cross-Source Insights</div>
                      <div className="text-xs text-[#9CA3AF]">AI analyzes data from multiple tools</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#FF6B35] mt-1.5 shrink-0" />
                    <div>
                      <div className="text-xs sm:text-sm text-white mb-0.5 sm:mb-1">Full Markup Tools</div>
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
                className="bg-[#0A0E1A] border border-[#2A2F3E] rounded-xl p-4 sm:p-6 mb-6"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 flex items-center justify-center shrink-0">
                    <Shield className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white text-base sm:text-lg font-medium mb-2">Help Improve Our AI</h3>
                    <p className="text-xs sm:text-sm text-[#9CA3AF] mb-3 sm:mb-4 leading-relaxed">
                      Would you like to help us make our AI smarter? By enabling this option, 
                      your feedback on AI responses will be used to improve our algorithms.
                    </p>
                    
                    {/* Privacy assurance */}
                    <div className="bg-[#1A1F2E] border border-[#2A2F3E] rounded-lg p-3 sm:p-4 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Lock className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-emerald-400" />
                        <span className="text-xs sm:text-sm font-medium text-emerald-400">Your Privacy is Protected</span>
                      </div>
                      <ul className="text-xs text-[#9CA3AF] space-y-1.5">
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-400 mt-0.5 shrink-0">•</span>
                          <span><strong className="text-white">No PII used</strong> — We never use personally identifiable information to train our AI</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-400 mt-0.5 shrink-0">•</span>
                          <span><strong className="text-white">All data anonymized</strong> — Feedback is completely anonymized before analysis</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-400 mt-0.5 shrink-0">•</span>
                          <span>Sensitive info (emails, phone numbers, etc.) is <strong className="text-white">automatically stripped</strong></span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-400 mt-0.5 shrink-0">•</span>
                          <span>You can change this setting anytime in your account preferences</span>
                        </li>
                      </ul>
                    </div>

                    {/* Toggle */}
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={aiLearningConsent}
                        onCheckedChange={setAiLearningConsent}
                        className="data-[state=checked]:bg-emerald-500"
                      />
                      <span className={`text-xs sm:text-sm ${aiLearningConsent ? 'text-white' : 'text-[#9CA3AF]'}`}>
                        {aiLearningConsent 
                          ? 'Yes, I want to help improve the AI' 
                          : 'No thanks, keep my feedback private'}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* CTA */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs text-[#9CA3AF] text-center sm:text-left order-2 sm:order-1">
                  You can always change your preferences later in Settings.
                </p>
                <button
                  onClick={handleGetStarted}
                  disabled={isLoading}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white font-medium rounded-lg shadow-lg shadow-[#FF6B35]/25 hover:shadow-xl hover:shadow-[#FF6B35]/30 transition-all hover:scale-[1.02] active:scale-[0.98] order-1 sm:order-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <span>Get Started</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
            )}
          </motion.div>
          
          {/* Skip Confirmation Dialog */}
          <AnimatePresence>
            {showSkipConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center z-10"
              >
                <div className="absolute inset-0 bg-black/50" onClick={handleCancelSkip} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="relative bg-[#1A1F2E] border border-[#2A2F3E] rounded-xl p-6 max-w-sm mx-4 shadow-2xl"
                >
                  <h3 className="text-white font-medium text-lg mb-2">Skip Welcome?</h3>
                  <p className="text-sm text-[#9CA3AF] mb-4">
                    You can always access these settings later in your account preferences.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCancelSkip}
                      className="flex-1 px-4 py-2 bg-[#2A2F3E] text-white text-sm rounded-lg hover:bg-[#3A3F4E] transition-colors"
                    >
                      Go Back
                    </button>
                    <button
                      onClick={handleConfirmSkip}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white text-sm font-medium rounded-lg hover:shadow-lg transition-all"
                    >
                      Skip for Now
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>
  );
}
