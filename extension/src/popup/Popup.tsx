import React, { useState, useEffect, useCallback } from 'react';
import { 
  MessageType, 
  CaptureMode, 
  CaptureResponse, 
  AuthStatusResponse,
  TabInfo 
} from '@shared/types';
import { DEFAULT_API_URL, STORAGE_KEYS } from '@shared/constants';

interface CaptureHistoryItem {
  id: string;
  dataUrl: string;
  timestamp: number;
  url: string;
  title: string;
}

const Popup: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<TabInfo | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastCapture, setLastCapture] = useState<CaptureHistoryItem | null>(null);
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);

  useEffect(() => {
    checkAuthStatus();
    getCurrentTab();
    loadSettings();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response: AuthStatusResponse = await chrome.runtime.sendMessage({
        type: MessageType.AUTH_STATUS_REQUEST
      });
      setIsAuthenticated(response.isAuthenticated);
    } catch (error) {
      console.error('Failed to check auth status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentTab = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.GET_CURRENT_TAB
      });
      if (response.tab) {
        setCurrentTab(response.tab);
      }
    } catch (error) {
      console.error('Failed to get current tab:', error);
    }
  };

  const loadSettings = async () => {
    const storage = await chrome.storage.local.get([STORAGE_KEYS.API_BASE_URL]);
    if (storage[STORAGE_KEYS.API_BASE_URL]) {
      setApiUrl(storage[STORAGE_KEYS.API_BASE_URL]);
    }
  };

  const handleCapture = useCallback(async (mode: CaptureMode) => {
    setIsCapturing(true);
    
    try {
      const response: CaptureResponse = await chrome.runtime.sendMessage({
        type: MessageType.CAPTURE_REQUEST,
        mode
      });

      if (response.success && response.dataUrl) {
        const captureItem: CaptureHistoryItem = {
          id: Date.now().toString(),
          dataUrl: response.dataUrl,
          timestamp: Date.now(),
          url: currentTab?.url || '',
          title: currentTab?.title || ''
        };
        setLastCapture(captureItem);
      } else {
        console.error('Capture failed:', response.error);
      }
    } catch (error) {
      console.error('Capture error:', error);
    } finally {
      setIsCapturing(false);
    }
  }, [currentTab]);

  const handleToggleToolbar = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: MessageType.TOGGLE_TOOLBAR,
        visible: true
      });
      window.close();
    }
  };

  const handleOpenDashboard = () => {
    chrome.tabs.create({ url: apiUrl });
  };

  const handleLogin = () => {
    chrome.tabs.create({ url: `${apiUrl}/login` });
    window.close();
  };

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>📸</span>
          <h1 style={styles.title}>CaptureInsight</h1>
        </div>
        <div style={styles.authBadge}>
          {isAuthenticated ? (
            <span style={styles.authBadgeConnected}>Connected</span>
          ) : (
            <span style={styles.authBadgeDisconnected}>Not connected</span>
          )}
        </div>
      </header>

      {currentTab && (
        <div style={styles.tabInfo}>
          <img 
            src={currentTab.favIconUrl || 'icons/icon-16.png'} 
            alt="" 
            style={styles.favicon}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div style={styles.tabDetails}>
            <div style={styles.tabTitle}>{currentTab.title}</div>
            <div style={styles.tabUrl}>{currentTab.url}</div>
          </div>
        </div>
      )}

      <div style={styles.captureSection}>
        <h2 style={styles.sectionTitle}>Quick Capture</h2>
        <button
          onClick={() => handleCapture(CaptureMode.TAB)}
          disabled={isCapturing}
          style={{
            ...styles.captureButton,
            backgroundColor: '#6366f1',
            opacity: isCapturing ? 0.6 : 1,
            width: '100%'
          }}
        >
          <span style={styles.buttonIcon}>🖼️</span>
          <span>Capture Visible Tab</span>
        </button>

        <button
          onClick={handleToggleToolbar}
          style={styles.toolbarButton}
        >
          <span style={styles.buttonIcon}>🎯</span>
          <span>Show Floating Toolbar</span>
        </button>
      </div>

      {lastCapture && (
        <div style={styles.previewSection}>
          <h2 style={styles.sectionTitle}>Last Capture</h2>
          <img 
            src={lastCapture.dataUrl} 
            alt="Last capture preview" 
            style={styles.previewImage}
          />
        </div>
      )}

      <div style={styles.actions}>
        {!isAuthenticated ? (
          <button onClick={handleLogin} style={styles.primaryButton}>
            Connect to CaptureInsight
          </button>
        ) : (
          <button onClick={handleOpenDashboard} style={styles.secondaryButton}>
            Open Dashboard
          </button>
        )}
      </div>

      <footer style={styles.footer}>
        <span>v1.0.0</span>
      </footer>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px',
    minHeight: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    color: '#9ca3af'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  logoIcon: {
    fontSize: '24px'
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#fff'
  },
  authBadge: {
    fontSize: '11px'
  },
  authBadgeConnected: {
    padding: '4px 8px',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    color: '#22c55e',
    borderRadius: '12px'
  },
  authBadgeDisconnected: {
    padding: '4px 8px',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    borderRadius: '12px'
  },
  tabInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '8px'
  },
  favicon: {
    width: '16px',
    height: '16px',
    flexShrink: 0
  },
  tabDetails: {
    overflow: 'hidden',
    flex: 1
  },
  tabTitle: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#fff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  tabUrl: {
    fontSize: '11px',
    color: '#9ca3af',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  captureSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  captureButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '16px',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'opacity 0.2s, transform 0.1s'
  },
  buttonIcon: {
    fontSize: '20px'
  },
  toolbarButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500
  },
  previewSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  previewImage: {
    width: '100%',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  },
  actions: {
    marginTop: 'auto'
  },
  primaryButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#6366f1',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600
  },
  secondaryButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500
  },
  footer: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: '11px'
  }
};

export default Popup;
