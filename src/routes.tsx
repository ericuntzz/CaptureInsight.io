// Route definitions for CaptureInsight application

export const ROUTES = {
  // Main views
  HOME: '/',
  CAPTURE: '/capture',
  DATA: '/data',
  CHANGE_LOGS: '/changelogs',
  INSIGHTS: '/insights',
  
  // Data management deep links
  DATA_SPACE: '/data/:spaceId',
  DATA_FOLDER: '/data/:spaceId/:folderId',
  DATA_SHEET: '/data/:spaceId/:folderId/:sheetId',
  
  // Insights deep links
  INSIGHT_DETAIL: '/insights/:insightId',
  
  // AI Assistant deep links
  AI_CHAT: '/ai-assistant',
  AI_CHAT_MESSAGE: '/ai-assistant#message-:messageId',
  
  // Tag management
  TAGS: '/tags',
  TAG_DETAIL: '/tags/:tagId',
  
  // Universal search
  SEARCH: '/search',
} as const;

// Helper functions to build URLs with parameters
export const buildRoute = {
  capture: () => ROUTES.CAPTURE,
  data: () => ROUTES.DATA,
  dataSpace: (spaceId: string) => `/data/${spaceId}`,
  dataFolder: (spaceId: string, folderId: string) => `/data/${spaceId}/${folderId}`,
  dataSheet: (spaceId: string, folderId: string, sheetId: string) => 
    `/data/${spaceId}/${folderId}/${sheetId}`,
  changeLogs: () => ROUTES.CHANGE_LOGS,
  insights: () => ROUTES.INSIGHTS,
  insightDetail: (insightId: string) => `/insights/${insightId}`,
  aiChat: () => ROUTES.AI_CHAT,
  aiChatMessage: (messageId: string) => `/ai-assistant#message-${messageId}`,
  tags: () => ROUTES.TAGS,
  tagDetail: (tagId: string) => `/tags/${tagId}`,
  search: (query?: string) => query ? `/search?q=${encodeURIComponent(query)}` : ROUTES.SEARCH,
};

// Parse URL parameters
export const parseRoute = {
  isCapture: (pathname: string) => pathname === '/capture',
  isData: (pathname: string) => pathname.startsWith('/data'),
  isChangeLogs: (pathname: string) => pathname.startsWith('/changelogs'),
  isInsights: (pathname: string) => pathname.startsWith('/insights'),
  isAIChat: (pathname: string) => pathname.startsWith('/ai-assistant'),
  isTags: (pathname: string) => pathname.startsWith('/tags'),
  isSearch: (pathname: string) => pathname.startsWith('/search'),
  
  getSpaceId: (pathname: string) => {
    const match = pathname.match(/^\/data\/([^\/]+)/);
    return match ? match[1] : null;
  },
  
  getFolderId: (pathname: string) => {
    const match = pathname.match(/^\/data\/[^\/]+\/([^\/]+)/);
    return match ? match[1] : null;
  },
  
  getSheetId: (pathname: string) => {
    const match = pathname.match(/^\/data\/[^\/]+\/[^\/]+\/([^\/]+)/);
    return match ? match[1] : null;
  },
  
  getInsightId: (pathname: string) => {
    const match = pathname.match(/^\/insights\/([^\/]+)/);
    return match ? match[1] : null;
  },
  
  getTagId: (pathname: string) => {
    const match = pathname.match(/^\/tags\/([^\/]+)/);
    return match ? match[1] : null;
  },
  
  getMessageId: (hash: string) => {
    const match = hash.match(/#message-(.+)/);
    return match ? match[1] : null;
  },
};

// Get current view from pathname
// Default is now 'insights' since capture functionality is handled by Chrome extension
// Root path '/' and any unknown path defaults to 'insights'
export const getCurrentView = (pathname: string): 'capture' | 'data' | 'changelogs' | 'insights' => {
  if (parseRoute.isCapture(pathname)) return 'capture';
  if (parseRoute.isData(pathname)) return 'data';
  if (parseRoute.isChangeLogs(pathname)) return 'changelogs';
  if (parseRoute.isInsights(pathname)) return 'insights';
  return 'insights';
};
