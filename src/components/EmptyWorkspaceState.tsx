import { motion } from 'motion/react';
import { Upload, Plus } from 'lucide-react';
import { Button } from './ui/button';

interface EmptyWorkspaceStateProps {
  onUploadData: () => void;
}

export function EmptyWorkspaceState({ onUploadData }: EmptyWorkspaceStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center h-full bg-[#0A0D12]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-lg px-8"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#FF6B35]/20 to-[#FF6B35]/5 border border-[#FF6B35]/20 flex items-center justify-center mx-auto mb-6"
        >
          <Upload className="w-10 h-10 text-[#FF6B35]" />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="text-2xl font-semibold text-white mb-3"
        >
          Welcome to CaptureInsight
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="text-gray-400 text-base leading-relaxed mb-8"
        >
          Start by uploading your data - capture screenshots, upload files, or add links. 
          Your first workspace will be created automatically with your data ready to analyze.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="relative inline-block"
        >
          <div className="absolute -inset-1 rounded-xl overflow-hidden">
            <motion.div
              className="absolute inset-0 rounded-xl"
              style={{
                background: 'conic-gradient(from 0deg, transparent, #FF6B35, transparent, transparent)',
              }}
              animate={{
                rotate: [0, 360],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
            <motion.div
              className="absolute inset-0 rounded-xl opacity-0"
              style={{
                background: 'conic-gradient(from 180deg, transparent, #FF6B35, transparent, transparent)',
              }}
              animate={{
                opacity: [0, 1, 0],
                rotate: [0, 360],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'linear',
                times: [0, 0.5, 1],
              }}
            />
          </div>

          <div className="absolute inset-0.5 rounded-[10px] bg-[#0A0D12]" />

          <Button
            onClick={onUploadData}
            className="relative h-12 px-8 bg-[#FF6B35] hover:bg-[#E55A2B] text-white font-medium text-base rounded-xl shadow-lg shadow-[#FF6B35]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#FF6B35]/30"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Data
          </Button>
        </motion.div>

      </motion.div>
    </div>
  );
}
