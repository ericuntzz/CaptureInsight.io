import { motion, AnimatePresence } from 'motion/react';
import { GlowingDot } from './GlowingDot';
import { Check, X, Sparkles, AlertCircle } from 'lucide-react';
import { Progress } from './ui/progress';

export interface ProcessingOverlayProps {
  currentStep: 'ingesting' | 'matching_templates' | 'cleaning' | 'validating' | 'finalizing' | 'complete' | 'failed';
  stepDetails?: string;
  percentComplete?: number;
  templateMatch?: {
    templateId: string;
    templateName: string;
    confidence: number;
    wasAutoApplied: boolean;
  };
  onConfirmTemplate?: () => void;
  onDismissTemplate?: () => void;
  errorMessage?: string;
}

const stepLabels: Record<string, string> = {
  ingesting: 'Ingesting data...',
  matching_templates: 'Matching templates...',
  cleaning: 'Cleaning & structuring...',
  validating: 'Validating data...',
  finalizing: 'Finalizing...',
  complete: 'Processing complete',
  failed: 'Processing failed',
};

export function ProcessingOverlay({
  currentStep,
  stepDetails,
  percentComplete,
  templateMatch,
  onConfirmTemplate,
  onDismissTemplate,
  errorMessage,
}: ProcessingOverlayProps) {
  const isProcessing = currentStep !== 'complete' && currentStep !== 'failed';
  const isFailed = currentStep === 'failed';

  const getStepLabel = () => {
    if (stepDetails) {
      return stepDetails;
    }
    if (currentStep === 'matching_templates' && templateMatch) {
      return `Applying template: ${templateMatch.templateName}`;
    }
    return stepLabels[currentStep] || 'Processing...';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 bg-[#0A0E1A]/80 backdrop-blur-sm flex flex-col items-center justify-center z-30"
    >
      <div className="flex flex-col items-center gap-6 max-w-md px-6">
        {isProcessing && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="relative"
          >
            <motion.div
              className="w-16 h-16 rounded-full border-2 border-[#FF6B35]/30 flex items-center justify-center"
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <motion.div
                className="absolute w-16 h-16 rounded-full border-2 border-transparent border-t-[#FF6B35]"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            </motion.div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-[#FF6B35]" />
            </div>
          </motion.div>
        )}

        {isFailed && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center"
          >
            <AlertCircle className="w-8 h-8 text-red-400" />
          </motion.div>
        )}

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="text-center"
        >
          <AnimatePresence mode="wait">
            <motion.h3
              key={currentStep}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={`text-lg font-medium ${isFailed ? 'text-red-400' : 'text-white'}`}
            >
              {getStepLabel()}
            </motion.h3>
          </AnimatePresence>
          
          {isFailed && errorMessage && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 text-sm text-red-300/80"
            >
              {errorMessage}
            </motion.p>
          )}
        </motion.div>

        {percentComplete !== undefined && percentComplete > 0 && isProcessing && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: '100%', opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="w-full max-w-xs"
          >
            <Progress value={percentComplete} className="h-2 bg-[#1F2532]" />
            <p className="text-center text-xs text-[#64748B] mt-2">
              {Math.round(percentComplete)}% complete
            </p>
          </motion.div>
        )}

        {templateMatch && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            className="bg-[#1F2532] border border-[#FF6B35]/20 rounded-xl p-4 w-full"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#FF6B35]/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[#FF6B35]" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-white font-medium">
                  {templateMatch.wasAutoApplied 
                    ? `Using template: ${templateMatch.templateName}`
                    : `Suggested template: ${templateMatch.templateName}`
                  }
                </p>
                <p className="text-xs text-[#64748B]">
                  {Math.round(templateMatch.confidence * 100)}% confidence match
                </p>
              </div>
            </div>

            {!templateMatch.wasAutoApplied && onConfirmTemplate && onDismissTemplate && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={onConfirmTemplate}
                  className="flex-1 px-3 py-2 bg-[#FF6B35] hover:bg-[#ff8558] text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Apply Template
                </button>
                <button
                  onClick={onDismissTemplate}
                  className="px-3 py-2 bg-[#1A1F2E] hover:bg-[#2A2F3E] text-[#9CA3AF] text-sm font-medium rounded-lg transition-colors border border-[#374151]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        )}

        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.5 }}
            className="flex items-center gap-2 mt-2"
          >
            <GlowingDot />
            <span className="text-xs text-[#64748B]">AI is processing your data</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
