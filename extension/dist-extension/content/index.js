import { c as clientExports, j as jsxRuntimeExports, r as reactExports } from '../chunks/client-CMJDEr7s.js';
import { M as MessageType, T as TOOLBAR_DEFAULTS, C as CaptureMode } from '../chunks/constants-CBz2pEEC.js';

const FloatingToolbar = ({ onCapture, onClose, isCapturing }) => {
  const [position, setPosition] = reactExports.useState(TOOLBAR_DEFAULTS.POSITION);
  const [isDragging, setIsDragging] = reactExports.useState(false);
  const [dragOffset, setDragOffset] = reactExports.useState({ x: 0, y: 0 });
  const handleMouseDown = reactExports.useCallback((e) => {
    if (e.target.closest("button")) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  }, [position]);
  reactExports.useEffect(() => {
    const handleMouseMove = (e) => {
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
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "captureinsight-toolbar",
      style: {
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 2147483647,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 12px",
        backgroundColor: "#1a1a2e",
        borderRadius: "12px",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      },
      onMouseDown: handleMouseDown,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: {
          color: "#fff",
          fontSize: "14px",
          fontWeight: 600,
          marginRight: "8px"
        }, children: "📸 CaptureInsight" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: () => onCapture(CaptureMode.TAB),
            disabled: isCapturing,
            style: {
              padding: "6px 12px",
              backgroundColor: "#6366f1",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: isCapturing ? "wait" : "pointer",
              fontSize: "12px",
              fontWeight: 500,
              opacity: isCapturing ? 0.6 : 1
            },
            title: "Capture visible tab",
            children: "Capture"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: onClose,
            style: {
              padding: "6px 8px",
              backgroundColor: "transparent",
              color: "#9ca3af",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px"
            },
            title: "Close toolbar",
            children: "✕"
          }
        )
      ]
    }
  );
};
const ContentApp = () => {
  const [visible, setVisible] = reactExports.useState(false);
  const [isCapturing, setIsCapturing] = reactExports.useState(false);
  reactExports.useEffect(() => {
    const handleMessage = (message) => {
      if (message.type === MessageType.TOGGLE_TOOLBAR) {
        setVisible(message.visible);
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);
  const handleCapture = reactExports.useCallback(async (mode) => {
    setIsCapturing(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.CAPTURE_REQUEST,
        mode
      });
      if (response.success && response.dataUrl) {
        console.log("Screenshot captured successfully");
        chrome.runtime.sendMessage({
          type: MessageType.UPLOAD_SCREENSHOT,
          dataUrl: response.dataUrl,
          metadata: response.metadata
        });
      } else {
        console.error("Capture failed:", response.error);
      }
    } catch (error) {
      console.error("Capture error:", error);
    } finally {
      setIsCapturing(false);
    }
  }, []);
  const handleClose = reactExports.useCallback(() => {
    setVisible(false);
  }, []);
  if (!visible) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    FloatingToolbar,
    {
      onCapture: handleCapture,
      onClose: handleClose,
      isCapturing
    }
  );
};
function initContentScript() {
  const containerId = "captureinsight-root";
  if (document.getElementById(containerId)) {
    return;
  }
  const container = document.createElement("div");
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
  const shadowRoot = container.attachShadow({ mode: "closed" });
  const styleSheet = document.createElement("style");
  styleSheet.textContent = `
    * {
      box-sizing: border-box;
    }
    .captureinsight-toolbar {
      pointer-events: auto;
    }
    button:hover {
      filter: brightness(1.1);
    }
    button:active {
      transform: scale(0.98);
    }
  `;
  shadowRoot.appendChild(styleSheet);
  const reactRoot = document.createElement("div");
  shadowRoot.appendChild(reactRoot);
  document.body.appendChild(container);
  const root = clientExports.createRoot(reactRoot);
  root.render(/* @__PURE__ */ jsxRuntimeExports.jsx(ContentApp, {}));
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initContentScript);
} else {
  initContentScript();
}
console.log("CaptureInsight content script loaded");
//# sourceMappingURL=index.js.map
