import { c as clientExports, j as jsxRuntimeExports, r as reactExports } from '../chunks/client-CMJDEr7s.js';
import { M as MessageType, T as TOOLBAR_DEFAULTS, C as CaptureMode } from '../chunks/constants-CBz2pEEC.js';

const FloatingToolbar = ({ onCapture, onClose, status, statusMessage }) => {
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
  const isWorking = status === "capturing" || status === "uploading";
  const getButtonContent = () => {
    switch (status) {
      case "capturing":
        return "📷 Capturing...";
      case "uploading":
        return "⬆️ Uploading...";
      case "success":
        return "✓ Saved!";
      case "error":
        return "✗ Failed";
      default:
        return "📸 Capture";
    }
  };
  const getButtonColor = () => {
    switch (status) {
      case "success":
        return "#22c55e";
      case "error":
        return "#ef4444";
      default:
        return "#6366f1";
    }
  };
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
        flexDirection: "column",
        gap: "4px",
        padding: "10px 14px",
        backgroundColor: "#1a1a2e",
        borderRadius: "12px",
        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.4)",
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      },
      onMouseDown: handleMouseDown,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: {
            color: "#fff",
            fontSize: "14px",
            fontWeight: 600,
            marginRight: "8px"
          }, children: "CaptureInsight" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: () => onCapture(CaptureMode.TAB),
              disabled: isWorking,
              style: {
                padding: "8px 16px",
                backgroundColor: getButtonColor(),
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: isWorking ? "wait" : "pointer",
                fontSize: "13px",
                fontWeight: 500,
                opacity: isWorking ? 0.8 : 1,
                minWidth: "110px",
                transition: "background-color 0.2s"
              },
              title: "Capture and save to CaptureInsight",
              children: getButtonContent()
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
                fontSize: "16px"
              },
              title: "Close toolbar",
              children: "✕"
            }
          )
        ] }),
        statusMessage && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: {
          fontSize: "11px",
          color: status === "error" ? "#ef4444" : "#9ca3af",
          marginTop: "4px",
          maxWidth: "280px",
          wordBreak: "break-word"
        }, children: statusMessage })
      ]
    }
  );
};
const ContentApp = () => {
  const [visible, setVisible] = reactExports.useState(false);
  const [status, setStatus] = reactExports.useState("idle");
  const [statusMessage, setStatusMessage] = reactExports.useState("");
  reactExports.useEffect(() => {
    const handleMessage = (message) => {
      if (message.type === MessageType.TOGGLE_TOOLBAR) {
        setVisible(message.visible);
        if (message.visible) {
          setStatus("idle");
          setStatusMessage("");
        }
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);
  const handleCapture = reactExports.useCallback(async (mode) => {
    setStatus("capturing");
    setStatusMessage("Taking screenshot...");
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.CAPTURE_REQUEST,
        mode
      });
      if (response.success && response.dataUrl) {
        setStatus("uploading");
        setStatusMessage("Uploading to CaptureInsight...");
        const uploadResult = await chrome.runtime.sendMessage({
          type: MessageType.UPLOAD_SCREENSHOT,
          dataUrl: response.dataUrl,
          metadata: response.metadata
        });
        if (uploadResult.success) {
          setStatus("success");
          setStatusMessage("Screenshot saved! Check your dashboard.");
          setTimeout(() => {
            setStatus("idle");
            setStatusMessage("");
          }, 3e3);
        } else {
          setStatus("error");
          setStatusMessage(uploadResult.error || "Failed to upload. Please try again.");
        }
      } else {
        setStatus("error");
        setStatusMessage(response.error || "Capture failed");
      }
    } catch (error) {
      console.error("Capture error:", error);
      setStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "Unknown error occurred");
    }
  }, []);
  const handleClose = reactExports.useCallback(() => {
    setVisible(false);
    setStatus("idle");
    setStatusMessage("");
  }, []);
  if (!visible) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    FloatingToolbar,
    {
      onCapture: handleCapture,
      onClose: handleClose,
      status,
      statusMessage
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
