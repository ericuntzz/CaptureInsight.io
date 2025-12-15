import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  label?: string;
}

export function CustomSelect({ value, onChange, options, label }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm text-[#9CA3AF] mb-2">{label}</label>
      )}
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 bg-[#1A1F2E] border border-[rgba(255,255,255,0.08)] rounded-lg text-white text-left flex items-center justify-between hover:border-[#FF6B35] transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent"
      >
        <span>{value}</span>
        <ChevronDown
          className={`text-[#9CA3AF] transition-transform ${isOpen ? 'rotate-180' : ''}`}
          size={18}
        />
      </button>

      {isOpen && (
        <div className="absolute z-[100] w-full mt-2 bg-[#1A1F2E] border border-[#FF6B35] rounded-lg shadow-lg overflow-hidden"
          style={{ boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 107, 53, 0.3)' }}
        >
          {options.map((option, index) => (
            <button
              key={index}
              onClick={() => {
                onChange(option);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[rgba(255,107,53,0.1)] transition-colors ${
                value === option ? 'bg-[rgba(255,107,53,0.05)]' : ''
              }`}
            >
              <span className={value === option ? 'text-white' : 'text-[#9CA3AF]'}>
                {option}
              </span>
              {value === option && (
                <Check className="text-[#FF6B35]" size={18} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
