export enum CaptureMode {
  TAB = 'tab',
  WINDOW = 'window',
  FULLSCREEN = 'fullscreen',
  SELECTION = 'selection'
}

export enum MessageType {
  CAPTURE_REQUEST = 'CAPTURE_REQUEST',
  CAPTURE_RESPONSE = 'CAPTURE_RESPONSE',
  AUTH_STATUS_REQUEST = 'AUTH_STATUS_REQUEST',
  AUTH_STATUS_RESPONSE = 'AUTH_STATUS_RESPONSE',
  OPEN_POPUP = 'OPEN_POPUP',
  TOGGLE_TOOLBAR = 'TOGGLE_TOOLBAR',
  UPLOAD_SCREENSHOT = 'UPLOAD_SCREENSHOT',
  UPLOAD_RESPONSE = 'UPLOAD_RESPONSE',
  GET_CURRENT_TAB = 'GET_CURRENT_TAB',
  TAB_INFO = 'TAB_INFO'
}

export interface CaptureRequest {
  type: MessageType.CAPTURE_REQUEST;
  mode: CaptureMode;
  selection?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface CaptureResponse {
  type: MessageType.CAPTURE_RESPONSE;
  success: boolean;
  dataUrl?: string;
  error?: string;
  metadata?: CaptureMetadata;
}

export interface CaptureMetadata {
  url: string;
  title: string;
  timestamp: number;
  mode: CaptureMode;
  dimensions: {
    width: number;
    height: number;
  };
}

export interface AuthStatusRequest {
  type: MessageType.AUTH_STATUS_REQUEST;
}

export interface AuthStatusResponse {
  type: MessageType.AUTH_STATUS_RESPONSE;
  isAuthenticated: boolean;
  user?: UserInfo;
}

export interface UserInfo {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
}

export interface UploadScreenshotRequest {
  type: MessageType.UPLOAD_SCREENSHOT;
  dataUrl: string;
  metadata: CaptureMetadata;
  spaceId?: string;
  projectId?: string;
  tags?: string[];
}

export interface UploadResponse {
  type: MessageType.UPLOAD_RESPONSE;
  success: boolean;
  insightId?: string;
  error?: string;
}

export interface ToggleToolbarMessage {
  type: MessageType.TOGGLE_TOOLBAR;
  visible: boolean;
}

export interface TabInfo {
  id: number;
  url: string;
  title: string;
  favIconUrl?: string;
}

export interface GetCurrentTabRequest {
  type: MessageType.GET_CURRENT_TAB;
}

export interface TabInfoResponse {
  type: MessageType.TAB_INFO;
  tab: TabInfo;
}

export type ExtensionMessage =
  | CaptureRequest
  | CaptureResponse
  | AuthStatusRequest
  | AuthStatusResponse
  | UploadScreenshotRequest
  | UploadResponse
  | ToggleToolbarMessage
  | GetCurrentTabRequest
  | TabInfoResponse;

export interface StorageData {
  authToken?: string;
  apiBaseUrl?: string;
  lastSpace?: string;
  lastProject?: string;
  toolbarPosition?: { x: number; y: number };
  toolbarVisible?: boolean;
}
