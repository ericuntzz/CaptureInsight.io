import { motion } from 'motion/react';

interface GlowingDotProps {
  className?: string;
}

export function GlowingDot({ className = '' }: GlowingDotProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <motion.div
        className="relative"
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-[#FF6B35]" />
        <motion.div
          className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-[#FF6B35]"
          initial={{ opacity: 0.6, scale: 1 }}
          animate={{ 
            opacity: [0.6, 0, 0.6],
            scale: [1, 2.5, 1]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeOut"
          }}
        />
      </motion.div>
    </div>
  );
}
