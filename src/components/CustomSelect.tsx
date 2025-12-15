import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleScroll = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 8,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      }
    };

    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm text-[#9CA3AF] mb-2">{label}</label>
      )}
      
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 bg-[#1A1F2E] border border-[rgba(255,255,255,0.08)] rounded-lg text-white text-left flex items-center justify-between hover:border-[#FF6B35] transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent"
      >
        <span>{value}</span>
        <ChevronDown
          className={`text-[#9CA3AF] transition-transform ${isOpen ? 'rotate-180' : ''}`}
          size={18}
        />
      </button>

      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          className="bg-[#1A1F2E] border border-[#FF6B35] rounded-lg shadow-lg overflow-hidden"
          style={{ 
            position: 'absolute',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 9999,
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 107, 53, 0.3)' 
          }}
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
        </div>,
        document.body
      )}
    </div>
  );
}
