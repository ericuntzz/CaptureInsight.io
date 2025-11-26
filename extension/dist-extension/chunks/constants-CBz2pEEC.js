var CaptureMode = /* @__PURE__ */ ((CaptureMode2) => {
  CaptureMode2["TAB"] = "tab";
  CaptureMode2["WINDOW"] = "window";
  CaptureMode2["FULLSCREEN"] = "fullscreen";
  CaptureMode2["SELECTION"] = "selection";
  return CaptureMode2;
})(CaptureMode || {});
var MessageType = /* @__PURE__ */ ((MessageType2) => {
  MessageType2["CAPTURE_REQUEST"] = "CAPTURE_REQUEST";
  MessageType2["CAPTURE_RESPONSE"] = "CAPTURE_RESPONSE";
  MessageType2["AUTH_STATUS_REQUEST"] = "AUTH_STATUS_REQUEST";
  MessageType2["AUTH_STATUS_RESPONSE"] = "AUTH_STATUS_RESPONSE";
  MessageType2["OPEN_POPUP"] = "OPEN_POPUP";
  MessageType2["TOGGLE_TOOLBAR"] = "TOGGLE_TOOLBAR";
  MessageType2["UPLOAD_SCREENSHOT"] = "UPLOAD_SCREENSHOT";
  MessageType2["UPLOAD_RESPONSE"] = "UPLOAD_RESPONSE";
  MessageType2["GET_CURRENT_TAB"] = "GET_CURRENT_TAB";
  MessageType2["TAB_INFO"] = "TAB_INFO";
  return MessageType2;
})(MessageType || {});

typeof chrome !== "undefined" && chrome.runtime ? chrome.runtime.getURL("") : "https://captureinsight.replit.dev";
const DEFAULT_API_URL = "https://ae16f8db-b279-4904-a814-a24b3f29eff4-00-8wubmfb2t7hb.kirk.replit.dev";
const STORAGE_KEYS = {
  API_BASE_URL: "apiBaseUrl",
  LAST_SPACE: "lastSpace",
  LAST_PROJECT: "lastProject",
  TOOLBAR_POSITION: "toolbarPosition",
  TOOLBAR_VISIBLE: "toolbarVisible",
  USER_PREFERENCES: "userPreferences"
};
const API_ENDPOINTS = {
  AUTH_STATUS: "/api/auth/user",
  UPLOAD_SCREENSHOT: "/api/captures",
  SPACES: "/api/spaces",
  PROJECTS: "/api/projects",
  TAGS: "/api/tags"
};
const TOOLBAR_DEFAULTS = {
  POSITION: { x: 20, y: 20 }};

export { API_ENDPOINTS as A, CaptureMode as C, DEFAULT_API_URL as D, MessageType as M, STORAGE_KEYS as S, TOOLBAR_DEFAULTS as T };
//# sourceMappingURL=constants-CBz2pEEC.js.map
