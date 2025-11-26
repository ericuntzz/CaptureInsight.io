import React, { useState } from 'react';
import { Pencil, Type, Palette, Settings, Minus, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type MarkupTool = 'draw' | 'text' | null;
export type MarkupElement = DrawElement | TextElement;

export interface DrawElement {
  type: 'draw';
  id: string;
  captureIndex: number;
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
}

export interface TextElement {
  type: 'text';
  id: string;
  captureIndex: number;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  fontFamily: string;
}

interface MarkupToolsProps {
  captureIndex: number;
  captureBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  scrollOffset: { left: number; top: number };
  activeTool: MarkupTool;
  onToolChange: (tool: MarkupTool) => void;
  drawColor: string;
  onDrawColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  textColor: string;
  onTextColorChange: (color: string) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  fontFamily: string;
  onFontFamilyChange: (family: string) => void;
}

const COLORS = [
  { name: 'Orange', value: '#FF6B35' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Yellow', value: '#F59E0B' },
  { name: 'Green', value: '#10B981' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'White', value: '#FFFFFF' },
  { name: 'Black', value: '#000000' },
];

const STROKE_WIDTHS = [2, 4, 6, 8, 12];
const FONT_SIZES = [12, 14, 16, 18, 24, 32];
const FONT_FAMILIES = ['Inter', 'Arial', 'Georgia', 'Courier New', 'Comic Sans MS'];

export function MarkupTools({
  captureIndex,
  captureBox,
  scrollOffset,
  activeTool,
  onToolChange,
  drawColor,
  onDrawColorChange,
  strokeWidth,
  onStrokeWidthChange,
  textColor,
  onTextColorChange,
  fontSize,
  onFontSizeChange,
  fontFamily,
  onFontFamilyChange
}: MarkupToolsProps) {
  const [showDrawOptions, setShowDrawOptions] = useState(false);
  const [showTextOptions, setShowTextOptions] = useState(false);

  // Position below the capture box menu
  const menuX = captureBox.x - scrollOffset.left;
  const menuY = captureBox.y - scrollOffset.top - 96; // Position above the main menu

  return (
    <div
      className="fixed z-[85] pointer-events-auto"
      style={{
        left: `${menuX}px`,
        top: `${menuY}px`,
      }}
    >
      <div className="flex items-center gap-2 bg-[rgba(26,31,46,0.98)] backdrop-blur-xl border border-[rgba(255,107,53,0.3)] rounded-lg px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
        {/* Draw Tool */}
        <div className="relative">
          <button
            onClick={() => {
              onToolChange(activeTool === 'draw' ? null : 'draw');
              setShowDrawOptions(!showDrawOptions);
              setShowTextOptions(false);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-all ${
              activeTool === 'draw'
                ? 'bg-[rgba(255,107,53,0.2)] text-[#FF6B35] border border-[rgba(255,107,53,0.5)]'
                : 'text-[#9CA3AF] hover:text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)]'
            }`}
            title="Draw"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Draw</span>
          </button>

          {/* Draw Options Panel */}
          <AnimatePresence>
            {showDrawOptions && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full mt-2 left-0 w-72 bg-[rgba(26,31,46,0.98)] backdrop-blur-xl border border-[rgba(255,107,53,0.3)] rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.6)] p-3"
              >
                {/* Color Picker */}
                <div className="mb-3">
                  <div className="text-[10px] text-[#9CA3AF] mb-2">COLOR</div>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => onDrawColorChange(color.value)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          drawColor === color.value
                            ? 'border-[#FF6B35] scale-110'
                            : 'border-transparent hover:border-[rgba(255,107,53,0.5)]'
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Stroke Width */}
                <div>
                  <div className="text-[10px] text-[#9CA3AF] mb-2">STROKE WIDTH</div>
                  <div className="flex gap-2">
                    {STROKE_WIDTHS.map((width) => (
                      <button
                        key={width}
                        onClick={() => onStrokeWidthChange(width)}
                        className={`flex-1 py-2 rounded-md transition-all ${
                          strokeWidth === width
                            ? 'bg-[rgba(255,107,53,0.2)] text-[#FF6B35] border border-[rgba(255,107,53,0.5)]'
                            : 'text-[#9CA3AF] hover:text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)]'
                        }`}
                      >
                        <div
                          className="mx-auto rounded-full"
                          style={{
                            width: `${width}px`,
                            height: `${width}px`,
                            backgroundColor: strokeWidth === width ? '#FF6B35' : '#9CA3AF'
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-px h-5 bg-[rgba(255,107,53,0.2)]" />

        {/* Text Tool */}
        <div className="relative">
          <button
            onClick={() => {
              onToolChange(activeTool === 'text' ? null : 'text');
              setShowTextOptions(!showTextOptions);
              setShowDrawOptions(false);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-all ${
              activeTool === 'text'
                ? 'bg-[rgba(255,107,53,0.2)] text-[#FF6B35] border border-[rgba(255,107,53,0.5)]'
                : 'text-[#9CA3AF] hover:text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)]'
            }`}
            title="Add Text"
          >
            <Type className="w-3.5 h-3.5" />
            <span>Text</span>
          </button>

          {/* Text Options Panel */}
          <AnimatePresence>
            {showTextOptions && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full mt-2 left-0 w-72 bg-[rgba(26,31,46,0.98)] backdrop-blur-xl border border-[rgba(255,107,53,0.3)] rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.6)] p-3"
              >
                {/* Color Picker */}
                <div className="mb-3">
                  <div className="text-[10px] text-[#9CA3AF] mb-2">COLOR</div>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => onTextColorChange(color.value)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          textColor === color.value
                            ? 'border-[#FF6B35] scale-110'
                            : 'border-transparent hover:border-[rgba(255,107,53,0.5)]'
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Font Size */}
                <div className="mb-3">
                  <div className="text-[10px] text-[#9CA3AF] mb-2">FONT SIZE</div>
                  <div className="grid grid-cols-3 gap-2">
                    {FONT_SIZES.map((size) => (
                      <button
                        key={size}
                        onClick={() => onFontSizeChange(size)}
                        className={`py-2 rounded-md text-xs transition-all ${
                          fontSize === size
                            ? 'bg-[rgba(255,107,53,0.2)] text-[#FF6B35] border border-[rgba(255,107,53,0.5)]'
                            : 'text-[#9CA3AF] hover:text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)]'
                        }`}
                      >
                        {size}px
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Family */}
                <div>
                  <div className="text-[10px] text-[#9CA3AF] mb-2">FONT</div>
                  <div className="flex flex-col gap-1">
                    {FONT_FAMILIES.map((family) => (
                      <button
                        key={family}
                        onClick={() => onFontFamilyChange(family)}
                        className={`py-2 px-3 rounded-md text-xs text-left transition-all ${
                          fontFamily === family
                            ? 'bg-[rgba(255,107,53,0.2)] text-[#FF6B35] border border-[rgba(255,107,53,0.5)]'
                            : 'text-[#9CA3AF] hover:text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)]'
                        }`}
                        style={{ fontFamily: family }}
                      >
                        {family}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-px h-5 bg-[rgba(255,107,53,0.2)]" />

        {/* Clear Tool */}
        <button
          onClick={() => onToolChange(null)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-[#9CA3AF] hover:text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)] transition-all"
          title="Clear Tool"
        >
          <Circle className="w-3.5 h-3.5" />
          <span>None</span>
        </button>
      </div>
    </div>
  );
}
