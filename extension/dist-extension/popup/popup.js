import { r as reactExports, j as jsxRuntimeExports, c as clientExports, R as React } from '../chunks/client-CMJDEr7s.js';
import { D as DEFAULT_API_URL, M as MessageType, S as STORAGE_KEYS, C as CaptureMode } from '../chunks/constants-CBz2pEEC.js';

true              &&(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
}());

const Popup = () => {
  const [isAuthenticated, setIsAuthenticated] = reactExports.useState(false);
  const [isLoading, setIsLoading] = reactExports.useState(true);
  const [currentTab, setCurrentTab] = reactExports.useState(null);
  const [isCapturing, setIsCapturing] = reactExports.useState(false);
  const [lastCapture, setLastCapture] = reactExports.useState(null);
  const [apiUrl, setApiUrl] = reactExports.useState(DEFAULT_API_URL);
  reactExports.useEffect(() => {
    checkAuthStatus();
    getCurrentTab();
    loadSettings();
  }, []);
  const checkAuthStatus = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.AUTH_STATUS_REQUEST
      });
      setIsAuthenticated(response.isAuthenticated);
    } catch (error) {
      console.error("Failed to check auth status:", error);
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
      console.error("Failed to get current tab:", error);
    }
  };
  const loadSettings = async () => {
    const storage = await chrome.storage.local.get([STORAGE_KEYS.API_BASE_URL]);
    if (storage[STORAGE_KEYS.API_BASE_URL]) {
      setApiUrl(storage[STORAGE_KEYS.API_BASE_URL]);
    }
  };
  const handleCapture = reactExports.useCallback(async (mode) => {
    setIsCapturing(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.CAPTURE_REQUEST,
        mode
      });
      if (response.success && response.dataUrl) {
        const captureItem = {
          id: Date.now().toString(),
          dataUrl: response.dataUrl,
          timestamp: Date.now(),
          url: currentTab?.url || "",
          title: currentTab?.title || ""
        };
        setLastCapture(captureItem);
      } else {
        console.error("Capture failed:", response.error);
      }
    } catch (error) {
      console.error("Capture error:", error);
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
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: styles.container, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: styles.loading, children: "Loading..." }) });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: styles.container, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { style: styles.header, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: styles.logo, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: styles.logoIcon, children: "📸" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { style: styles.title, children: "CaptureInsight" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: styles.authBadge, children: isAuthenticated ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: styles.authBadgeConnected, children: "Connected" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: styles.authBadgeDisconnected, children: "Not connected" }) })
    ] }),
    currentTab && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: styles.tabInfo, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "img",
        {
          src: currentTab.favIconUrl || "icons/icon-16.png",
          alt: "",
          style: styles.favicon,
          onError: (e) => {
            e.target.style.display = "none";
          }
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: styles.tabDetails, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: styles.tabTitle, children: currentTab.title }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: styles.tabUrl, children: currentTab.url })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: styles.captureSection, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { style: styles.sectionTitle, children: "Quick Capture" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "button",
        {
          onClick: () => handleCapture(CaptureMode.TAB),
          disabled: isCapturing,
          style: {
            ...styles.captureButton,
            backgroundColor: "#6366f1",
            opacity: isCapturing ? 0.6 : 1,
            width: "100%"
          },
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: styles.buttonIcon, children: "🖼️" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Capture Visible Tab" })
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "button",
        {
          onClick: handleToggleToolbar,
          style: styles.toolbarButton,
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: styles.buttonIcon, children: "🎯" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Show Floating Toolbar" })
          ]
        }
      )
    ] }),
    lastCapture && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: styles.previewSection, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { style: styles.sectionTitle, children: "Last Capture" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "img",
        {
          src: lastCapture.dataUrl,
          alt: "Last capture preview",
          style: styles.previewImage
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: styles.actions, children: !isAuthenticated ? /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: handleLogin, style: styles.primaryButton, children: "Connect to CaptureInsight" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: handleOpenDashboard, style: styles.secondaryButton, children: "Open Dashboard" }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("footer", { style: styles.footer, children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "v1.0.0" }) })
  ] });
};
const styles = {
  container: {
    padding: "16px",
    minHeight: "400px",
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "200px",
    color: "#9ca3af"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "8px"
  },
  logoIcon: {
    fontSize: "24px"
  },
  title: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#fff"
  },
  authBadge: {
    fontSize: "11px"
  },
  authBadgeConnected: {
    padding: "4px 8px",
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    color: "#22c55e",
    borderRadius: "12px"
  },
  authBadgeDisconnected: {
    padding: "4px 8px",
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    color: "#ef4444",
    borderRadius: "12px"
  },
  tabInfo: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: "8px"
  },
  favicon: {
    width: "16px",
    height: "16px",
    flexShrink: 0
  },
  tabDetails: {
    overflow: "hidden",
    flex: 1
  },
  tabTitle: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#fff",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  tabUrl: {
    fontSize: "11px",
    color: "#9ca3af",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  captureSection: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  sectionTitle: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.5px"
  },
  captureButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    padding: "16px",
    border: "none",
    borderRadius: "8px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500,
    transition: "opacity 0.2s, transform 0.1s"
  },
  buttonIcon: {
    fontSize: "20px"
  },
  toolbarButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "12px",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "8px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500
  },
  previewSection: {
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  previewImage: {
    width: "100%",
    borderRadius: "8px",
    border: "1px solid rgba(255, 255, 255, 0.1)"
  },
  actions: {
    marginTop: "auto"
  },
  primaryButton: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#6366f1",
    border: "none",
    borderRadius: "8px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 600
  },
  secondaryButton: {
    width: "100%",
    padding: "12px",
    backgroundColor: "transparent",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    borderRadius: "8px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 500
  },
  footer: {
    textAlign: "center",
    color: "#6b7280",
    fontSize: "11px"
  }
};

const container = document.getElementById("root");
if (container) {
  const root = clientExports.createRoot(container);
  root.render(
    /* @__PURE__ */ jsxRuntimeExports.jsx(React.StrictMode, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Popup, {}) })
  );
}
//# sourceMappingURL=popup.js.map
