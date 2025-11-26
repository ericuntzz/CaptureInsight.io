import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  MessageType, 
  CaptureMode, 
  ToggleToolbarMessage,
  CaptureResponse,
  CaptureMetadata
} from '@shared/types';
import { TOOLBAR_DEFAULTS } from '@shared/constants';

type StatusType = 'idle' | 'capturing' | 'uploading' | 'success' | 'error';

interface Space {
  id: string;
  name: string;
  description?: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

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

const CheckboxIcon = ({ checked }: { checked: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill={checked ? '#FF6B35' : 'transparent'} stroke={checked ? '#FF6B35' : '#9CA3AF'} />
    {checked && <polyline points="9 12 12 15 16 9" stroke="#fff" />}
  </svg>
);

const RadioIcon = ({ checked }: { checked: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" fill="transparent" stroke={checked ? '#FF6B35' : '#9CA3AF'} />
    {checked && <circle cx="12" cy="12" r="5" fill="#FF6B35" />}
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

const popupStyles = {
  container: {
    position: 'absolute' as const,
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
  },
  header: {
    fontSize: '10px',
    color: '#9CA3AF',
    marginBottom: '8px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px'
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '13px',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left' as const,
    transition: 'background-color 0.15s ease'
  },
  listItemHover: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)'
  },
  listItemActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    border: '1px solid rgba(255, 107, 53, 0.3)'
  },
  scrollContainer: {
    maxHeight: '200px',
    overflowY: 'auto' as const,
    marginBottom: '8px'
  },
  emptyState: {
    padding: '20px',
    textAlign: 'center' as const,
    color: '#9CA3AF',
    fontSize: '12px'
  },
  loadingState: {
    padding: '20px',
    textAlign: 'center' as const,
    color: '#9CA3AF',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  }
};

interface FloatingToolbarProps {
  onCapture: (mode: CaptureMode) => void;
  status: StatusType;
  statusMessage: string;
  onOpenDashboard: () => void;
  onStatusChange: (status: StatusType, message: string) => void;
  capturedData: { dataUrl: string; metadata: CaptureMetadata } | null;
  onClearCapturedData: () => void;
}

const FloatingToolbar: React.FC<FloatingToolbarProps> = ({ 
  onCapture, 
  status, 
  statusMessage, 
  onOpenDashboard, 
  onStatusChange,
  capturedData,
  onClearCapturedData
}) => {
  const [position, setPosition] = useState(TOOLBAR_DEFAULTS.POSITION);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [activeCapture, setActiveCapture] = useState<string | null>(null);
  const [showLinkPopup, setShowLinkPopup] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showApiTooltip, setShowApiTooltip] = useState(false);
  
  const [showDestinationPopup, setShowDestinationPopup] = useState(false);
  const [showTagsPopup, setShowTagsPopup] = useState(false);
  const [showLlmPopup, setShowLlmPopup] = useState(false);
  
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);
  
  const [selectedDestination, setSelectedDestination] = useState<{spaceId: string, spaceName: string} | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedLlm, setSelectedLlm] = useState<string | null>(null);
  
  const [uploadedDataUrl, setUploadedDataUrl] = useState<string | null>(null);
  const [uploadedMetadata, setUploadedMetadata] = useState<CaptureMetadata | null>(null);
  const [storedLink, setStoredLink] = useState<string | null>(null);
  
  const toolbarRef = useRef<HTMLDivElement>(null);
  
  const hasContent = !!(capturedData || uploadedDataUrl || storedLink);

  const closeAllPopups = useCallback(() => {
    setShowLinkPopup(false);
    setShowDestinationPopup(false);
    setShowTagsPopup(false);
    setShowLlmPopup(false);
  }, []);

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
        closeAllPopups();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeAllPopups]);

  const isWorking = status === 'capturing' || status === 'uploading';

  const fetchSpaces = useCallback(async () => {
    setLoadingSpaces(true);
    try {
      const response = await chrome.runtime.sendMessage({ type: 'FETCH_SPACES' });
      if (response.success && response.spaces) {
        setSpaces(response.spaces);
      } else {
        console.error('[CaptureInsight] Failed to fetch spaces:', response.error);
      }
    } catch (error) {
      console.error('[CaptureInsight] Error fetching spaces:', error);
    } finally {
      setLoadingSpaces(false);
    }
  }, []);

  const fetchTags = useCallback(async (spaceId: string) => {
    setLoadingTags(true);
    try {
      const response = await chrome.runtime.sendMessage({ 
        type: 'FETCH_TAGS',
        spaceId 
      });
      if (response.success && response.tags) {
        setTags(response.tags);
      } else {
        console.error('[CaptureInsight] Failed to fetch tags:', response.error);
      }
    } catch (error) {
      console.error('[CaptureInsight] Error fetching tags:', error);
    } finally {
      setLoadingTags(false);
    }
  }, []);

  const handleDestinationClick = useCallback(() => {
    closeAllPopups();
    setShowDestinationPopup(true);
    fetchSpaces();
  }, [closeAllPopups, fetchSpaces]);

  const handleTagsClick = useCallback(() => {
    closeAllPopups();
    setShowTagsPopup(true);
    if (selectedDestination?.spaceId) {
      fetchTags(selectedDestination.spaceId);
    }
  }, [closeAllPopups, fetchTags, selectedDestination]);

  const handleLlmClick = useCallback(() => {
    closeAllPopups();
    setShowLlmPopup(true);
  }, [closeAllPopups]);

  const handleSelectSpace = useCallback((space: Space) => {
    setSelectedDestination({ spaceId: space.id, spaceName: space.name });
    setSelectedTags([]);
    setShowDestinationPopup(false);
    console.log('[CaptureInsight] Selected space:', space.name);
  }, []);

  const handleToggleTag = useCallback((tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  }, []);

  const handleSelectLlm = useCallback((option: string) => {
    setSelectedLlm(option);
    setShowLlmPopup(false);
    console.log('[CaptureInsight] Selected LLM:', option);
  }, []);

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
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          setUploadedDataUrl(dataUrl);
          setUploadedMetadata({
            url: window.location.href,
            title: document.title,
            timestamp: Date.now(),
            mode: CaptureMode.TAB,
            dimensions: { width: 0, height: 0 }
          });
          console.log('[CaptureInsight] File uploaded and converted to dataUrl:', file.name);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleLinkSubmit = () => {
    if (linkUrl.trim()) {
      setStoredLink(linkUrl.trim());
      setShowLinkPopup(false);
      console.log('[CaptureInsight] Link stored:', linkUrl);
      setLinkUrl('');
    }
  };

  const handleFinalCapture = async () => {
    const dataUrl = capturedData?.dataUrl || uploadedDataUrl;
    const metadata = capturedData?.metadata || uploadedMetadata;
    
    if (!dataUrl && !storedLink) {
      onStatusChange('error', 'No content to upload');
      return;
    }

    onStatusChange('uploading', 'Uploading to CaptureInsight...');

    try {
      const uploadData: any = {
        type: MessageType.UPLOAD_SCREENSHOT,
        metadata: metadata || {
          url: storedLink || window.location.href,
          title: document.title,
          timestamp: Date.now(),
          mode: CaptureMode.TAB,
          dimensions: { width: 0, height: 0 }
        }
      };

      if (dataUrl) {
        uploadData.dataUrl = dataUrl;
      }

      if (selectedDestination?.spaceId) {
        uploadData.spaceId = selectedDestination.spaceId;
      }

      if (selectedTags.length > 0) {
        uploadData.tags = selectedTags;
      }

      if (storedLink && !dataUrl) {
        uploadData.sourceUrl = storedLink;
      } else if (storedLink) {
        uploadData.metadata.url = storedLink;
      }

      if (selectedLlm) {
        uploadData.analyze = selectedLlm !== 'none';
        uploadData.llmModel = selectedLlm === 'gemini-2.5-flash' ? 'gemini-flash' : 'gemini-pro';
      }

      console.log('[CaptureInsight] Uploading with settings:', {
        hasDataUrl: !!dataUrl,
        destination: selectedDestination,
        tags: selectedTags,
        llm: selectedLlm,
        link: storedLink
      });

      const result = await chrome.runtime.sendMessage(uploadData);

      if (result.success) {
        onStatusChange('success', 'Saved to CaptureInsight!');
        setUploadedDataUrl(null);
        setUploadedMetadata(null);
        setStoredLink(null);
        setSelectedTags([]);
        onClearCapturedData();
        
        setTimeout(() => {
          onStatusChange('idle', '');
        }, 3000);
      } else {
        onStatusChange('error', result.error || 'Upload failed');
        setTimeout(() => {
          onStatusChange('idle', '');
        }, 5000);
      }
    } catch (error) {
      console.error('[CaptureInsight] Upload error:', error);
      onStatusChange('error', 'Upload failed');
      setTimeout(() => {
        onStatusChange('idle', '');
      }, 5000);
    }
  };

  useEffect(() => {
    if (status === 'success') {
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

  const llmOptions = [
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'none', label: "Don't analyze" }
  ];

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
        .popup-list-item:hover {
          background-color: rgba(255, 107, 53, 0.1) !important;
        }
      `}</style>

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

      <div style={{ position: 'relative' }}>
        <ToolButton
          icon={<LinkIcon />}
          label="Insert Share Link"
          onClick={() => {
            closeAllPopups();
            setShowLinkPopup(!showLinkPopup);
          }}
          active={showLinkPopup}
          disabled={isWorking}
          showTooltip={!showLinkPopup}
        />
        
        {showLinkPopup && (
          <div 
            className="popup-content"
            style={popupStyles.container}
          >
            <div style={popupStyles.header}>
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
                marginBottom: '8px',
                boxSizing: 'border-box'
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
          
          <div style={{ position: 'relative' }}>
            <ToolButton
              icon={<FolderIcon />}
              label={selectedDestination ? `Save to: ${selectedDestination.spaceName}` : "Save To"}
              onClick={handleDestinationClick}
              active={showDestinationPopup}
              variant="setting"
              hasValue={!!selectedDestination}
              showTooltip={!showDestinationPopup}
            />
            
            {showDestinationPopup && (
              <div 
                className="popup-content"
                style={popupStyles.container}
              >
                <div style={popupStyles.header}>
                  Select Destination
                </div>
                <div style={popupStyles.scrollContainer}>
                  {loadingSpaces ? (
                    <div style={popupStyles.loadingState}>
                      <LoaderIcon /> Loading spaces...
                    </div>
                  ) : spaces.length === 0 ? (
                    <div style={popupStyles.emptyState}>
                      No spaces found. Create a space in CaptureInsight first.
                    </div>
                  ) : (
                    spaces.map(space => (
                      <button
                        key={space.id}
                        className="popup-list-item"
                        onClick={() => handleSelectSpace(space)}
                        style={{
                          ...popupStyles.listItem,
                          ...(selectedDestination?.spaceId === space.id ? popupStyles.listItemActive : {})
                        }}
                      >
                        <FolderIcon />
                        <span>{space.name}</span>
                        {selectedDestination?.spaceId === space.id && (
                          <CheckIcon />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div style={{ position: 'relative' }}>
            <ToolButton
              icon={<TagIcon />}
              label={selectedTags.length > 0 ? `${selectedTags.length} tags selected` : "Tags"}
              onClick={handleTagsClick}
              active={showTagsPopup}
              variant="setting"
              hasValue={selectedTags.length > 0}
              showTooltip={!showTagsPopup}
            />
            
            {showTagsPopup && (
              <div 
                className="popup-content"
                style={popupStyles.container}
              >
                <div style={popupStyles.header}>
                  Select Tags {selectedDestination && `(${selectedDestination.spaceName})`}
                </div>
                <div style={popupStyles.scrollContainer}>
                  {!selectedDestination ? (
                    <div style={popupStyles.emptyState}>
                      Select a destination space first to see available tags.
                    </div>
                  ) : loadingTags ? (
                    <div style={popupStyles.loadingState}>
                      <LoaderIcon /> Loading tags...
                    </div>
                  ) : tags.length === 0 ? (
                    <div style={popupStyles.emptyState}>
                      No tags found in this space.
                    </div>
                  ) : (
                    tags.map(tag => (
                      <button
                        key={tag.id}
                        className="popup-list-item"
                        onClick={() => handleToggleTag(tag.id)}
                        style={popupStyles.listItem}
                      >
                        <CheckboxIcon checked={selectedTags.includes(tag.id)} />
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: tag.color || '#FF6B35'
                          }} />
                          {tag.name}
                        </span>
                      </button>
                    ))
                  )}
                </div>
                {selectedTags.length > 0 && (
                  <button
                    onClick={() => setShowTagsPopup(false)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      backgroundColor: '#FF6B35',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      marginTop: '4px'
                    }}
                  >
                    Done ({selectedTags.length} selected)
                  </button>
                )}
              </div>
            )}
          </div>
          
          <div style={{ position: 'relative' }}>
            <ToolButton
              icon={<SparklesIcon />}
              label={selectedLlm ? `LLM: ${llmOptions.find(o => o.id === selectedLlm)?.label}` : "Send to LLM"}
              onClick={handleLlmClick}
              active={showLlmPopup}
              variant="setting"
              hasValue={!!selectedLlm}
              showTooltip={!showLlmPopup}
            />
            
            {showLlmPopup && (
              <div 
                className="popup-content"
                style={popupStyles.container}
              >
                <div style={popupStyles.header}>
                  AI Analysis
                </div>
                <div style={{ marginBottom: '4px' }}>
                  {llmOptions.map(option => (
                    <button
                      key={option.id}
                      className="popup-list-item"
                      onClick={() => handleSelectLlm(option.id)}
                      style={{
                        ...popupStyles.listItem,
                        ...(selectedLlm === option.id ? popupStyles.listItemActive : {})
                      }}
                    >
                      <RadioIcon checked={selectedLlm === option.id} />
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <div style={{
        width: '1px',
        height: '24px',
        backgroundColor: 'rgba(255, 107, 53, 0.2)',
        margin: '0 4px'
      }} />

      <ToolButton
        icon={status === 'success' ? <CheckIcon /> : <DatabaseIcon />}
        label="View Dashboard"
        onClick={onOpenDashboard}
        variant="dashboard"
      />

      {hasContent && (
        <ToolButton
          icon={status === 'uploading' ? <LoaderIcon /> : <BrainIcon />}
          label="Capture Data"
          onClick={handleFinalCapture}
          variant="primary"
          count={1}
          disabled={status === 'uploading'}
        />
      )}

      {statusMessage && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: '8px',
          padding: '6px 12px',
          backgroundColor: status === 'error' ? 'rgba(239, 68, 68, 0.9)' : 
                          status === 'success' ? 'rgba(34, 197, 94, 0.9)' : 
                          'rgba(26, 31, 46, 0.95)',
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
  const [capturedData, setCapturedData] = useState<{dataUrl: string, metadata: CaptureMetadata} | null>(null);

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

  const handleStatusChange = useCallback((newStatus: StatusType, message: string) => {
    setStatus(newStatus);
    setStatusMessage(message);
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
        setCapturedData({
          dataUrl: response.dataUrl,
          metadata: response.metadata!
        });
        setStatus('success');
        setStatusMessage('Screenshot captured! Configure options and click Capture.');
        
        setTimeout(() => {
          setStatusMessage('');
        }, 3000);
      } else {
        setStatus('error');
        setStatusMessage(response.error || 'Capture failed');
        
        setTimeout(() => {
          setStatus('idle');
          setStatusMessage('');
        }, 5000);
      }
    } catch (error) {
      console.error('[CaptureInsight] Capture error:', error);
      setStatus('error');
      setStatusMessage('Capture failed');
      
      setTimeout(() => {
        setStatus('idle');
        setStatusMessage('');
      }, 5000);
    }
  }, []);

  const handleOpenDashboard = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
    } catch (error) {
      console.error('[CaptureInsight] Error opening dashboard:', error);
    }
  }, []);

  const handleClearCapturedData = useCallback(() => {
    setCapturedData(null);
  }, []);

  if (!visible) return null;

  return (
    <FloatingToolbar 
      onCapture={handleCapture}
      status={status}
      statusMessage={statusMessage}
      onOpenDashboard={handleOpenDashboard}
      onStatusChange={handleStatusChange}
      capturedData={capturedData}
      onClearCapturedData={handleClearCapturedData}
    />
  );
};

const CONTAINER_ID = 'captureinsight-toolbar-container';

function init() {
  if (document.getElementById(CONTAINER_ID)) {
    console.log('[CaptureInsight] Already initialized');
    return;
  }

  console.log('[CaptureInsight] Initializing content script');
  
  const container = document.createElement('div');
  container.id = CONTAINER_ID;
  container.style.cssText = 'position: fixed; z-index: 2147483647; pointer-events: none;';
  document.body.appendChild(container);
  
  const shadowRoot = container.attachShadow({ mode: 'closed' });
  
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    * {
      pointer-events: auto;
      box-sizing: border-box;
    }
  `;
  shadowRoot.appendChild(styleSheet);
  
  const appContainer = document.createElement('div');
  shadowRoot.appendChild(appContainer);
  
  const root = createRoot(appContainer);
  root.render(<ContentApp />);
  
  console.log('[CaptureInsight] Content script initialized');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
