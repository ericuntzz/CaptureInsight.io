import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
  </svg>
);

const SquareIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
  </svg>
);

const UploadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const LinkIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const ZapIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const DatabaseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);

const LoaderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const FolderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const TagIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
    <path d="M7 7h.01" />
  </svg>
);

const SparklesIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </svg>
);

const BrainIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </svg>
);

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'capture' | 'primary' | 'dashboard' | 'setting';
  hasValue?: boolean;
  showTooltip?: boolean;
  count?: number;
}

const ToolButton: React.FC<ToolButtonProps> = ({ 
  icon, 
  label, 
  onClick, 
  active = false, 
  disabled = false, 
  variant = 'default',
  hasValue = false,
  showTooltip = true,
  count
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const getStyles = () => {
    const base = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '40px',
      height: '40px',
      border: 'none',
      borderRadius: '10px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      transition: 'all 0.15s ease',
      padding: 0,
      position: 'relative' as const
    };
    
    if (variant === 'primary') {
      return {
        ...base,
        backgroundColor: '#FF6B35',
        color: '#fff',
        width: count ? '48px' : '40px'
      };
    }
    
    if (variant === 'dashboard') {
      return {
        ...base,
        backgroundColor: 'transparent',
        color: '#FF6B35'
      };
    }
    
    if (variant === 'capture' && active) {
      return {
        ...base,
        backgroundColor: 'rgba(255, 107, 53, 0.15)',
        border: '1.5px solid rgba(255, 107, 53, 0.4)',
        color: '#FF6B35'
      };
    }
    
    if (variant === 'setting') {
      return {
        ...base,
        backgroundColor: hasValue ? 'rgba(255, 107, 53, 0.1)' : (active ? 'rgba(255, 107, 53, 0.15)' : 'transparent'),
        border: hasValue ? '1px solid rgba(255, 107, 53, 0.3)' : (active ? '1.5px solid rgba(255, 107, 53, 0.4)' : '1px solid transparent'),
        color: hasValue || active ? '#FF6B35' : '#9CA3AF'
      };
    }
    
    return {
      ...base,
      backgroundColor: active ? 'rgba(255, 107, 53, 0.15)' : 'transparent',
      border: active ? '1.5px solid rgba(255, 107, 53, 0.4)' : '1px solid transparent',
      color: active ? '#FF6B35' : '#9CA3AF'
    };
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onClick}
        disabled={disabled}
        style={getStyles()}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {icon}
        {count !== undefined && count > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            backgroundColor: '#fff',
            color: '#FF6B35',
            fontSize: '10px',
            fontWeight: 600,
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {count}
          </span>
        )}
      </button>
      {showTooltip && isHovered && !disabled && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '8px',
          padding: '6px 10px',
          backgroundColor: 'rgba(45, 59, 78, 0.95)',
          borderRadius: '6px',
          fontSize: '11px',
          color: '#fff',
          whiteSpace: 'nowrap',
          zIndex: 100
        }}>
          {label}
        </div>
      )}
    </div>
  );
};

interface FloatingToolbarProps {
  onCapture: (mode: CaptureMode) => void;
  status: StatusType;
  statusMessage: string;
  onOpenDashboard: () => void;
}

const FloatingToolbar: React.FC<FloatingToolbarProps> = ({ onCapture, status, statusMessage, onOpenDashboard }) => {
  const [position, setPosition] = useState(TOOLBAR_DEFAULTS.POSITION);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [activeCapture, setActiveCapture] = useState<string | null>(null);
  const [hasContent, setHasContent] = useState(false);
  const [showLinkPopup, setShowLinkPopup] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showApiTooltip, setShowApiTooltip] = useState(false);
  
  const [selectedDestination, setSelectedDestination] = useState<{spaceId: string, folderId: string} | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedLlm, setSelectedLlm] = useState<string | null>(null);
  
  const toolbarRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if ((e.target as HTMLElement).closest('.popup-content')) return;
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setShowLinkPopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isWorking = status === 'capturing' || status === 'uploading';

  const handleCaptureClick = (mode: CaptureMode, buttonId: string) => {
    if (isWorking) return;
    setActiveCapture(buttonId);
    onCapture(mode);
  };

  const handleUploadClick = () => {
    if (isWorking) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setHasContent(true);
        console.log('[CaptureInsight] File selected:', file.name);
      }
    };
    input.click();
  };

  const handleLinkSubmit = () => {
    if (linkUrl.trim()) {
      setHasContent(true);
      setShowLinkPopup(false);
      console.log('[CaptureInsight] Link added:', linkUrl);
      setLinkUrl('');
    }
  };

  const handleFinalCapture = () => {
    console.log('[CaptureInsight] Final capture with settings:', {
      destination: selectedDestination,
      tags: selectedTags,
      llm: selectedLlm
    });
  };

  useEffect(() => {
    if (status === 'success') {
      setHasContent(true);
      const timer = setTimeout(() => {
        setActiveCapture(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
    if (status === 'idle' && activeCapture) {
      const timer = setTimeout(() => setActiveCapture(null), 100);
      return () => clearTimeout(timer);
    }
  }, [status, activeCapture]);

  return (
    <div
      ref={toolbarRef}
      className="captureinsight-toolbar"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 2147483647,
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        padding: '8px 10px',
        backgroundColor: 'rgba(26, 31, 46, 0.98)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '14px',
        border: '1px solid rgba(26, 31, 46, 0.98)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
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

      {/* Capture Mode Buttons */}
      <ToolButton
        icon={isWorking && activeCapture === 'selection' ? <LoaderIcon /> : <ScanIcon />}
        label="Capture Selected Portion"
        onClick={() => handleCaptureClick(CaptureMode.SELECTION, 'selection')}
        active={activeCapture === 'selection'}
        disabled={isWorking}
        variant="capture"
      />
      
      <ToolButton
        icon={isWorking && activeCapture === 'tab' ? <LoaderIcon /> : <SquareIcon />}
        label="Capture Selected Window"
        onClick={() => handleCaptureClick(CaptureMode.TAB, 'tab')}
        active={activeCapture === 'tab'}
        disabled={isWorking}
        variant="capture"
      />
      
      <ToolButton
        icon={<UploadIcon />}
        label="Upload File"
        onClick={handleUploadClick}
        disabled={isWorking}
      />

      {/* Share Link Button with Popup */}
      <div style={{ position: 'relative' }}>
        <ToolButton
          icon={<LinkIcon />}
          label="Insert Share Link"
          onClick={() => setShowLinkPopup(!showLinkPopup)}
          active={showLinkPopup}
          disabled={isWorking}
          showTooltip={!showLinkPopup}
        />
        
        {showLinkPopup && (
          <div 
            className="popup-content"
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '12px',
              width: '280px',
              backgroundColor: 'rgba(26, 31, 46, 0.98)',
              backdropFilter: 'blur(16px)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 107, 53, 0.2)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
              padding: '12px',
              zIndex: 110
            }}
          >
            <div style={{ fontSize: '10px', color: '#9CA3AF', marginBottom: '8px', textTransform: 'uppercase' }}>
              Add URL
            </div>
            <input
              type="url"
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLinkSubmit()}
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: '#0A0E1A',
                border: '1px solid rgba(255, 107, 53, 0.2)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '13px',
                outline: 'none',
                marginBottom: '8px'
              }}
            />
            <button
              onClick={handleLinkSubmit}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#FF6B35',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Add Link
            </button>
          </div>
        )}
      </div>

      {/* API Button (Coming Soon) */}
      <div 
        style={{ position: 'relative' }}
        onMouseEnter={() => setShowApiTooltip(true)}
        onMouseLeave={() => setShowApiTooltip(false)}
      >
        <ToolButton
          icon={<ZapIcon />}
          label="Connect via API"
          onClick={() => {}}
          disabled={true}
        />
        {showApiTooltip && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            padding: '6px 10px',
            backgroundColor: 'rgba(45, 59, 78, 0.95)',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#fff',
            whiteSpace: 'nowrap',
            zIndex: 100
          }}>
            API Link Coming Soon
          </div>
        )}
      </div>

      {/* Setting Buttons - Only show when content exists */}
      {hasContent && (
        <>
          <div style={{
            width: '1px',
            height: '24px',
            backgroundColor: 'rgba(255, 107, 53, 0.2)',
            margin: '0 4px'
          }} />
          
          <ToolButton
            icon={<EyeOffIcon />}
            label="Blur Sensitive Data"
            onClick={() => console.log('Blur toggle')}
            variant="setting"
          />
          
          <ToolButton
            icon={<FolderIcon />}
            label="Save To"
            onClick={() => console.log('Open destination picker')}
            variant="setting"
            hasValue={!!selectedDestination}
          />
          
          <ToolButton
            icon={<TagIcon />}
            label="Tags"
            onClick={() => console.log('Open tags picker')}
            variant="setting"
            hasValue={selectedTags.length > 0}
          />
          
          <ToolButton
            icon={<SparklesIcon />}
            label="Send to LLM"
            onClick={() => console.log('Open LLM picker')}
            variant="setting"
            hasValue={!!selectedLlm}
          />
        </>
      )}

      {/* Separator before dashboard */}
      <div style={{
        width: '1px',
        height: '24px',
        backgroundColor: 'rgba(255, 107, 53, 0.2)',
        margin: '0 4px'
      }} />

      {/* Dashboard Button */}
      <ToolButton
        icon={status === 'success' ? <CheckIcon /> : <DatabaseIcon />}
        label="View Dashboard"
        onClick={onOpenDashboard}
        variant="dashboard"
      />

      {/* Final Capture Button - Only show when content exists */}
      {hasContent && (
        <ToolButton
          icon={<BrainIcon />}
          label="Capture Data"
          onClick={handleFinalCapture}
          variant="primary"
          count={1}
        />
      )}

      {/* Status Message */}
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

  const handleOpenDashboard = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
  }, []);

  if (!visible) return null;

  return (
    <FloatingToolbar
      onCapture={handleCapture}
      status={status}
      statusMessage={statusMessage}
      onOpenDashboard={handleOpenDashboard}
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
      filter: brightness(1.1);
    }
    button:active:not(:disabled) {
      transform: scale(0.95);
    }
    input:focus {
      border-color: rgba(255, 107, 53, 0.5) !important;
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
