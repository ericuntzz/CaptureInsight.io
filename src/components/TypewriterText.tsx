import { useState, useEffect, useRef } from 'react';

interface TypewriterTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
}

export function TypewriterText({ 
  text, 
  speed = 20,
  onComplete,
  className = ''
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const indexRef = useRef(0);
  const lastTimeRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    
    if (!text) {
      setDisplayedText('');
      setIsComplete(true);
      onComplete?.();
      return;
    }

    let cancelled = false;
    indexRef.current = 0;
    setDisplayedText('');
    setIsComplete(false);
    lastTimeRef.current = 0;

    const animate = (timestamp: number) => {
      if (cancelled) return;
      
      if (!lastTimeRef.current) {
        lastTimeRef.current = timestamp;
      }

      const elapsed = timestamp - lastTimeRef.current;
      const charsToAdd = Math.floor(elapsed / speed);
      
      if (charsToAdd > 0) {
        const newIndex = Math.min(indexRef.current + charsToAdd, text.length);
        
        if (newIndex > indexRef.current) {
          indexRef.current = newIndex;
          setDisplayedText(text.slice(0, newIndex));
          lastTimeRef.current = timestamp;
        }
      }

      if (indexRef.current < text.length) {
        rafIdRef.current = requestAnimationFrame(animate);
      } else {
        rafIdRef.current = null;
        setIsComplete(true);
        onComplete?.();
      }
    };

    rafIdRef.current = requestAnimationFrame(animate);

    return () => {
      cancelled = true;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [text, speed, onComplete]);

  return (
    <span className={className}>
      {displayedText}
      {!isComplete && (
        <span 
          className="inline-block w-[2px] h-[1em] bg-current ml-[1px] animate-pulse"
          style={{ verticalAlign: 'text-bottom' }}
        />
      )}
    </span>
  );
}
