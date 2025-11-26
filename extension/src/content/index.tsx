import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  MessageType, 
  CaptureMode, 
  ToggleToolbarMessage,
  CaptureResponse
} from '@shared/types';
import { TOOLBAR_DEFAULTS } from '@shared/constants';

type StatusType = 'idle' | 'capturing' | 'uploading' | 'success' | 'error';

const ScanIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
  </svg>
);

const SquareIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
  </svg>
);

const UploadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const LinkIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const ZapIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const DatabaseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const LoaderIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

interface ToolbarProps {
  onCapture: (mode: CaptureMode) => void;
  status: StatusType;
  statusMessage: string;
}

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  color?: string;
}

const ToolButton: React.FC<ToolButtonProps> = ({ icon, label, onClick, active = false, disabled = false, color = '#9CA3AF' }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={label}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '44px',
      height: '44px',
      backgroundColor: active ? 'rgba(255, 107, 53, 0.15)' : 'transparent',
      border: active ? '1.5px solid rgba(255, 107, 53, 0.4)' : '1.5px solid transparent',
      borderRadius: '10px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      color: active ? '#FF6B35' : color,
      opacity: disabled ? 0.5 : 1,
      transition: 'all 0.15s ease',
      padding: 0
    }}
  >
    {icon}
  </button>
);

const FloatingToolbar: React.FC<ToolbarProps> = ({ onCapture, status, statusMessage }) => {
  const [position, setPosition] = useState(TOOLBAR_DEFAULTS.POSITION);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [activeButton, setActiveButton] = useState<string | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  }, [position]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const isWorking = status === 'capturing' || status === 'uploading';
  
  const handleCaptureClick = (mode: CaptureMode, buttonId: string) => {
    if (isWorking) return;
    setActiveButton(buttonId);
    onCapture(mode);
  };

  const handleUploadClick = () => {
    if (isWorking) return;
    setActiveButton('upload');
  };

  const handleLinkClick = () => {
    if (isWorking) return;
    setActiveButton('link');
  };

  useEffect(() => {
    if (status === 'idle' && activeButton) {
      const timer = setTimeout(() => setActiveButton(null), 100);
      return () => clearTimeout(timer);
    }
    if (status === 'success') {
      const timer = setTimeout(() => setActiveButton(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [status, activeButton]);

  return (
    <div
      className="captureinsight-toolbar"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 2147483647,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 10px',
        backgroundColor: 'rgba(26, 31, 46, 0.98)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '14px',
        border: '1px solid rgba(255, 107, 53, 0.25)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.1)',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
      onMouseDown={handleMouseDown}
    >
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      
      <ToolButton
        icon={isWorking && activeButton === 'selection' ? <LoaderIcon /> : <ScanIcon />}
        label="Capture Selection"
        onClick={() => handleCaptureClick(CaptureMode.SELECTION, 'selection')}
        active={activeButton === 'selection'}
        disabled={isWorking}
      />
      
      <ToolButton
        icon={isWorking && activeButton === 'tab' ? <LoaderIcon /> : <SquareIcon />}
        label="Capture Full Tab"
        onClick={() => handleCaptureClick(CaptureMode.TAB, 'tab')}
        active={activeButton === 'tab'}
        disabled={isWorking}
      />
      
      <ToolButton
        icon={<UploadIcon />}
        label="Upload File"
        onClick={handleUploadClick}
        active={activeButton === 'upload'}
        disabled={isWorking}
      />
      
      <ToolButton
        icon={<LinkIcon />}
        label="Add Link"
        onClick={handleLinkClick}
        active={activeButton === 'link'}
        disabled={isWorking}
      />
      
      <div style={{
        width: '1px',
        height: '28px',
        backgroundColor: 'rgba(255, 107, 53, 0.2)',
        margin: '0 4px'
      }} />
      
      <ToolButton
        icon={<ZapIcon />}
        label="Quick Actions"
        onClick={() => {}}
        disabled={isWorking}
      />
      
      <ToolButton
        icon={status === 'success' ? <CheckIcon /> : <DatabaseIcon />}
        label="Open Dashboard"
        onClick={() => window.open(window.location.origin, '_blank')}
        active={status === 'success'}
        color={status === 'success' ? '#22c55e' : '#FF6B35'}
      />
      
      {statusMessage && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: '8px',
          padding: '6px 12px',
          backgroundColor: status === 'error' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(26, 31, 46, 0.95)',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#fff',
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}>
          {statusMessage}
        </div>
      )}
    </div>
  );
};

const ContentApp: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<StatusType>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    console.log('[CaptureInsight] Content script message listener registered');
    
    const handleMessage = (message: ToggleToolbarMessage, _sender: chrome.runtime.MessageSender, sendResponse: (response: unknown) => void) => {
      console.log('[CaptureInsight] Message received:', message);
      if (message.type === MessageType.TOGGLE_TOOLBAR) {
        console.log('[CaptureInsight] Setting visible to:', message.visible);
        setVisible(message.visible);
        if (message.visible) {
          setStatus('idle');
          setStatusMessage('');
        }
        sendResponse({ success: true });
      }
      return true;
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const handleCapture = useCallback(async (mode: CaptureMode) => {
    setStatus('capturing');
    setStatusMessage('Taking screenshot...');
    
    try {
      const response: CaptureResponse = await chrome.runtime.sendMessage({
        type: MessageType.CAPTURE_REQUEST,
        mode
      });

      if (response.success && response.dataUrl) {
        setStatus('uploading');
        setStatusMessage('Uploading to CaptureInsight...');
        
        const uploadResult = await chrome.runtime.sendMessage({
          type: MessageType.UPLOAD_SCREENSHOT,
          dataUrl: response.dataUrl,
          metadata: response.metadata
        });
        
        if (uploadResult.success) {
          setStatus('success');
          setStatusMessage('Screenshot saved!');
          
          setTimeout(() => {
            setStatus('idle');
            setStatusMessage('');
          }, 3000);
        } else {
          setStatus('error');
          setStatusMessage(uploadResult.error || 'Upload failed');
        }
      } else {
        setStatus('error');
        setStatusMessage(response.error || 'Capture failed');
      }
    } catch (error) {
      console.error('Capture error:', error);
      setStatus('error');
      setStatusMessage(error instanceof Error ? error.message : 'Unknown error');
    }
  }, []);

  if (!visible) return null;

  return (
    <FloatingToolbar
      onCapture={handleCapture}
      status={status}
      statusMessage={statusMessage}
    />
  );
};

function initContentScript() {
  const containerId = 'captureinsight-root';
  
  if (document.getElementById(containerId)) {
    return;
  }

  const container = document.createElement('div');
  container.id = containerId;
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    z-index: 2147483647;
    pointer-events: none;
  `;
  
  const shadowRoot = container.attachShadow({ mode: 'closed' });
  
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    * {
      box-sizing: border-box;
    }
    .captureinsight-toolbar {
      pointer-events: auto;
    }
    button:hover:not(:disabled) {
      background-color: rgba(255, 107, 53, 0.1) !important;
    }
    button:active:not(:disabled) {
      transform: scale(0.95);
    }
  `;
  shadowRoot.appendChild(styleSheet);
  
  const reactRoot = document.createElement('div');
  shadowRoot.appendChild(reactRoot);
  
  document.body.appendChild(container);
  
  const root = createRoot(reactRoot);
  root.render(<ContentApp />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContentScript);
} else {
  initContentScript();
}

console.log('[CaptureInsight] Content script loaded on:', window.location.href);
