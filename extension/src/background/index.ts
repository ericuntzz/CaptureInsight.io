import { 
  MessageType, 
  CaptureRequest, 
  CaptureResponse, 
  CaptureMetadata,
  ExtensionMessage,
  AuthStatusResponse 
} from '@shared/types';
import { STORAGE_KEYS, DEFAULT_API_URL, API_ENDPOINTS } from '@shared/constants';

async function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  try {
    const base64Data = dataUrl.split(',')[1];
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
      const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
      return { width, height };
    }
    
    return { width: 0, height: 0 };
  } catch (error) {
    console.error('Error parsing image dimensions:', error);
    return { width: 0, height: 0 };
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  console.log('CaptureInsight extension installed', details);
  
  chrome.storage.local.set({
    [STORAGE_KEYS.API_BASE_URL]: DEFAULT_API_URL,
    [STORAGE_KEYS.TOOLBAR_VISIBLE]: true
  });
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch((error) => {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  });
  
  return true;
});

async function handleMessage(
  message: ExtensionMessage, 
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  switch (message.type) {
    case MessageType.CAPTURE_REQUEST:
      return handleCaptureRequest(message);
    
    case MessageType.AUTH_STATUS_REQUEST:
      return handleAuthStatusRequest();
    
    case MessageType.GET_CURRENT_TAB:
      return handleGetCurrentTab(sender);
    
    case MessageType.UPLOAD_SCREENSHOT:
      return handleUploadScreenshot(message);
    
    case 'OPEN_DASHBOARD':
      return handleOpenDashboard();
    
    case 'FETCH_SPACES':
      return handleFetchSpaces();
    
    case 'FETCH_TAGS':
      return handleFetchTags(message);
    
    default:
      console.warn('Unknown message type:', message);
      return { success: false, error: 'Unknown message type' };
  }
}

async function handleCaptureRequest(request: CaptureRequest): Promise<CaptureResponse> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab?.id) {
      return {
        type: MessageType.CAPTURE_RESPONSE,
        success: false,
        error: 'No active tab found'
      };
    }

    const dataUrl = await chrome.tabs.captureVisibleTab({
      format: 'png',
      quality: 100
    });

    const dimensions = await getImageDimensions(dataUrl);

    const metadata: CaptureMetadata = {
      url: tab.url || '',
      title: tab.title || '',
      timestamp: Date.now(),
      mode: request.mode,
      dimensions
    };

    return {
      type: MessageType.CAPTURE_RESPONSE,
      success: true,
      dataUrl,
      metadata
    };
  } catch (error) {
    console.error('Capture error:', error);
    return {
      type: MessageType.CAPTURE_RESPONSE,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown capture error'
    };
  }
}

async function handleAuthStatusRequest(): Promise<AuthStatusResponse> {
  try {
    const storage = await chrome.storage.local.get([STORAGE_KEYS.API_BASE_URL]);
    const apiUrl = storage[STORAGE_KEYS.API_BASE_URL] || DEFAULT_API_URL;

    const response = await fetch(`${apiUrl}${API_ENDPOINTS.AUTH_STATUS}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      return {
        type: MessageType.AUTH_STATUS_RESPONSE,
        isAuthenticated: false
      };
    }

    const user = await response.json();
    
    return {
      type: MessageType.AUTH_STATUS_RESPONSE,
      isAuthenticated: true,
      user
    };
  } catch (error) {
    console.error('Auth status check failed:', error);
    return {
      type: MessageType.AUTH_STATUS_RESPONSE,
      isAuthenticated: false
    };
  }
}

async function handleGetCurrentTab(_sender: chrome.runtime.MessageSender) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  return {
    type: MessageType.TAB_INFO,
    tab: {
      id: tab?.id || 0,
      url: tab?.url || '',
      title: tab?.title || '',
      favIconUrl: tab?.favIconUrl
    }
  };
}

async function handleUploadScreenshot(message: ExtensionMessage) {
  if (message.type !== MessageType.UPLOAD_SCREENSHOT) {
    return { success: false, error: 'Invalid message type' };
  }

  try {
    const storage = await chrome.storage.local.get([STORAGE_KEYS.API_BASE_URL]);
    const apiUrl = storage[STORAGE_KEYS.API_BASE_URL] || DEFAULT_API_URL;

    const response = await fetch(`${apiUrl}${API_ENDPOINTS.UPLOAD_SCREENSHOT}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dataUrl: message.dataUrl,
        metadata: message.metadata,
        spaceId: message.spaceId,
        projectId: message.projectId,
        tags: message.tags
      })
    });

    if (!response.ok) {
      if (response.status === 401) {
        return {
          type: MessageType.UPLOAD_RESPONSE,
          success: false,
          error: 'Not authenticated. Please log in to CaptureInsight first.'
        };
      }
      const error = await response.text();
      return {
        type: MessageType.UPLOAD_RESPONSE,
        success: false,
        error
      };
    }

    const result = await response.json();
    
    return {
      type: MessageType.UPLOAD_RESPONSE,
      success: true,
      insightId: result.id
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      type: MessageType.UPLOAD_RESPONSE,
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url) return;
  
  const isRestrictedPage = 
    tab.url.startsWith('chrome://') || 
    tab.url.startsWith('chrome-extension://') || 
    tab.url.startsWith('chrome-search://') ||
    tab.url.startsWith('edge://') ||
    tab.url.startsWith('about:') ||
    tab.url === '' ||
    tab.url === 'about:blank';
  
  if (isRestrictedPage) {
    console.log('Cannot inject into browser internal pages:', tab.url);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'CaptureInsight',
      message: 'Please navigate to a website first (e.g., google.com). The toolbar cannot run on browser pages.'
    });
    return;
  }
  
  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: MessageType.TOGGLE_TOOLBAR,
      visible: true
    });
    console.log('Toggle toolbar message sent successfully');
  } catch (error) {
    console.log('Content script not loaded, injecting now...');
    
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/index.js']
      });
      
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content/styles.css']
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      await chrome.tabs.sendMessage(tab.id, {
        type: MessageType.TOGGLE_TOOLBAR,
        visible: true
      });
      console.log('Content script injected and toolbar shown');
    } catch (injectError) {
      console.error('Failed to inject content script:', injectError);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-128.png',
        title: 'CaptureInsight',
        message: 'Could not load on this page. Try refreshing or navigate to a different website.'
      });
    }
  }
});

async function handleOpenDashboard() {
  try {
    const storage = await chrome.storage.local.get([STORAGE_KEYS.API_BASE_URL]);
    const apiUrl = storage[STORAGE_KEYS.API_BASE_URL] || DEFAULT_API_URL;
    
    await chrome.tabs.create({ url: apiUrl });
    return { success: true };
  } catch (error) {
    console.error('Error opening dashboard:', error);
    return { success: false, error: 'Failed to open dashboard' };
  }
}

async function handleFetchSpaces() {
  try {
    const storage = await chrome.storage.local.get([STORAGE_KEYS.API_BASE_URL]);
    const apiUrl = storage[STORAGE_KEYS.API_BASE_URL] || DEFAULT_API_URL;

    const response = await fetch(`${apiUrl}/api/spaces`, {
      credentials: 'include'
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Not authenticated', spaces: [] };
      }
      return { success: false, error: 'Failed to fetch spaces', spaces: [] };
    }

    const spaces = await response.json();
    return { success: true, spaces };
  } catch (error) {
    console.error('Error fetching spaces:', error);
    return { success: false, error: 'Network error', spaces: [] };
  }
}

async function handleFetchTags(message: any) {
  try {
    const storage = await chrome.storage.local.get([STORAGE_KEYS.API_BASE_URL]);
    const apiUrl = storage[STORAGE_KEYS.API_BASE_URL] || DEFAULT_API_URL;
    const spaceId = message.spaceId;

    if (!spaceId) {
      return { success: false, error: 'No space selected', tags: [] };
    }

    const response = await fetch(`${apiUrl}/api/spaces/${spaceId}/tags`, {
      credentials: 'include'
    });

    if (!response.ok) {
      return { success: false, error: 'Failed to fetch tags', tags: [] };
    }

    const tags = await response.json();
    return { success: true, tags };
  } catch (error) {
    console.error('Error fetching tags:', error);
    return { success: false, error: 'Network error', tags: [] };
  }
}

console.log('CaptureInsight background service worker initialized');
