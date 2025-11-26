export const API_BASE_URL = typeof chrome !== 'undefined' && chrome.runtime
  ? chrome.runtime.getURL('')
  : 'https://captureinsight.replit.dev';

export const DEFAULT_API_URL = 'https://ae16f8db-b279-4904-a814-a24b3f29eff4-00-8wubmfb2t7hb.kirk.replit.dev';

export const STORAGE_KEYS = {
  API_BASE_URL: 'apiBaseUrl',
  LAST_SPACE: 'lastSpace',
  LAST_PROJECT: 'lastProject',
  TOOLBAR_POSITION: 'toolbarPosition',
  TOOLBAR_VISIBLE: 'toolbarVisible',
  USER_PREFERENCES: 'userPreferences'
} as const;

export const API_ENDPOINTS = {
  AUTH_STATUS: '/api/auth/user',
  UPLOAD_SCREENSHOT: '/api/captures',
  SPACES: '/api/spaces',
  PROJECTS: '/api/projects',
  TAGS: '/api/tags'
} as const;

export const CAPTURE_QUALITY = {
  HIGH: 1.0,
  MEDIUM: 0.8,
  LOW: 0.6
} as const;

export const TOOLBAR_DEFAULTS = {
  POSITION: { x: 20, y: 20 } as { x: number; y: number },
  WIDTH: 280,
  HEIGHT: 48
};

export const MESSAGE_TIMEOUT = 30000;

export const SUPPORTED_IMAGE_FORMATS = ['image/png', 'image/jpeg', 'image/webp'] as const;

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
