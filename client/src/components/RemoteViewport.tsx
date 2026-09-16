import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  Zap,
  Monitor,
  Keyboard,
  Maximize2,
  Power,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { RemoteSession } from "../types/session";

interface RemoteViewportProps {
  session: RemoteSession;
  isFocused?: boolean;
  onFocus?: () => void;
  onClose?: () => void;
  onToggleFullscreen?: () => void;
  isSplitView?: boolean;
  paneLabel?: "left" | "right";
  onSendKeyEvent?: (session: RemoteSession, type: "keydown" | "keyup", key: string, code?: string) => void;
}

export const RemoteViewport: React.FC<RemoteViewportProps> = ({
  session,
  isFocused = true,
  onFocus,
  onClose,
  onToggleFullscreen,
  isSplitView = false,
  paneLabel,
  onSendKeyEvent,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [guestCursor, setGuestCursor] = useState<{
    x: number;
    y: number;
    visible: boolean;
    clicking: boolean;
  }>({
    x: 0,
    y: 0,
    visible: false,
    clicking: false,
  });

  const [showVirtualCursor] = useState(true);
  const [sessionQuality, setSessionQuality] = useState(session.quality || 65);
  const [sessionMonitor, setSessionMonitor] = useState(session.monitor || 0);
  const [showShortcutsMenu, setShowShortcutsMenu] = useState(false);
  const [isToolbarMinimized, setIsToolbarMinimized] = useState(isSplitView);

  // 미디어 스트림 자동 연결
  useEffect(() => {
    if (videoRef.current && session.remoteStream) {
      if (videoRef.current.srcObject !== session.remoteStream) {
        videoRef.current.srcObject = session.remoteStream;
      }
      videoRef.current.play().catch((err) => {
        console.warn(`[Viewport ${session.id}] Play warning:`, err);
      });
    }
  }, [session.remoteStream, session.id]);

  // 제어 이벤트 전송 유틸리티
  const sendControlEvent = (payload: any) => {
    if (session.controlChannel && session.controlChannel.readyState === "open") {
      try {
        session.controlChannel.send(JSON.stringify(payload));
        return;
      } catch (e) {
        console.warn("[Viewport] DataChannel send failed:", e);
      }
    }
    if (session.socket && session.socket.connected) {
      session.socket.emit("control-event", {
        ...payload,
        targetRoom: session.roomId,
      });
    }
  };

  // 마우스 입력 핸들러
  const handleRemoteInput = (e: React.MouseEvent, type: string) => {
    if (onFocus) onFocus();

    const video = (e.currentTarget.tagName === "VIDEO" ? e.currentTarget : videoRef.current) as HTMLVideoElement;
    if (!video) return;

    if (type === "mousedown" || type === "click") {
      containerRef.current?.focus();
    }

    const rect = video.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // 비디오 원본 비율과 엘리먼트 크기 기반 오차 보정
    const vWidth = video.videoWidth > 0 ? video.videoWidth : 1920;
    const vHeight = video.videoHeight > 0 ? video.videoHeight : 1080;
    const videoRatio = vWidth / vHeight;
    const elemRatio = rect.width / rect.height;

    let renderWidth = rect.width;
    let renderHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (elemRatio > videoRatio) {
      renderWidth = rect.height * videoRatio;
      offsetX = (rect.width - renderWidth) / 2;
    } else {
      renderHeight = rect.width / videoRatio;
      offsetY = (rect.height - renderHeight) / 2;
    }

    const clickX = e.clientX - rect.left - offsetX;
    const clickY = e.clientY - rect.top - offsetY;

    const x = Math.max(0, Math.min(1, clickX / renderWidth));
    const y = Math.max(0, Math.min(1, clickY / renderHeight));
    const buttonName = e.button === 2 ? "right" : e.button === 1 ? "middle" : "left";

    if (type === "mousemove") {
      sendControlEvent({
        type: "mousemove",
        x,
        y,
        monitorIndex: sessionMonitor,
      });
    } else if (type === "mousedown") {
      setGuestCursor((prev) => ({ ...prev, clicking: true }));
      sendControlEvent({
        type: "mousedown",
        button: buttonName,
        x,
        y,
        monitorIndex: sessionMonitor,
      });
    } else if (type === "mouseup") {
      setGuestCursor((prev) => ({ ...prev, clicking: false }));
      sendControlEvent({
        type: "mouseup",
        button: buttonName,
        x,
        y,
        monitorIndex: sessionMonitor,
      });
    } else if (type === "contextmenu") {
      sendControlEvent({
        type: "contextmenu",
        x,
        y,
        monitorIndex: sessionMonitor,
      });
    }
  };

  // 마우스 휠
  const handleWheel = (e: React.WheelEvent) => {
    if (onFocus) onFocus();
    e.preventDefault();
    sendControlEvent({
      type: "wheel",
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      monitorIndex: sessionMonitor,
    });
  };

  // 한/영 전환 키 전송
  const triggerHangulToggle = () => {
    if (onSendKeyEvent) {
      onSendKeyEvent(session, "keydown", "HangulMode", "Lang2");
      setTimeout(() => {
        onSendKeyEvent(session, "keyup", "HangulMode", "Lang2");
      }, 50);
    } else {
      sendControlEvent({ type: "keydown", key: "HangulMode", code: "Lang2" });
      setTimeout(() => {
        sendControlEvent({ type: "keyup", key: "HangulMode", code: "Lang2" });
      }, 50);
    }
  };

  // 원격 단축키
  const sendShortcut = (keys: string[]) => {
    sendControlEvent({ type: "shortcut", keys });
    setShowShortcutsMenu(false);
  };

  return (
    <div
      ref={containerRef}
      className={`remote-viewport-container ${isFocused ? "focused" : "unfocused"} ${
        isSplitView ? "split-mode" : ""
      }`}
      onClick={() => onFocus && onFocus()}
      tabIndex={0}
    >
      {/* 2분할 뷰 상단 상태 & 제어 바 */}
      {isSplitView && (
        <div className="split-pane-header">
          <div className="pane-header-left">
            <span className={`pane-badge ${isFocused ? "active" : ""}`}>
              {paneLabel === "left" ? "L 좌측" : "R 우측"}
            </span>
            <span className="pane-device-name" title={session.roomId}>
              {session.deviceName || `PC ${session.roomId}`}
            </span>
            {session.ping !== null && (
              <span
                className="pane-ping-badge"
                style={{ color: session.ping < 50 ? "#34d399" : "#f59e0b" }}
              >
                {session.ping}ms
              </span>
            )}
            <span className="pane-focus-indicator">
              {isFocused ? "🟢 제어 활성" : "클릭하여 제어"}
            </span>
          </div>

          <div className="pane-header-right">
            <button
              type="button"
              className="pane-header-btn"
              onClick={triggerHangulToggle}
              title="한/영 전환"
            >
              <span style={{ fontWeight: 700, fontSize: "0.75rem", color: "#38bdf8" }}>한/A</span>
            </button>

            <button
              type="button"
              className="pane-header-btn"
              onClick={() => {
                const nextMon = sessionMonitor === 0 ? 1 : 0;
                setSessionMonitor(nextMon);
                sendControlEvent({ type: "switch-monitor", monitorIndex: nextMon });
              }}
              title="모니터 전환"
            >
              <Monitor size={13} />
            </button>

            {onToggleFullscreen && (
              <button
                type="button"
                className="pane-header-btn"
                onClick={onToggleFullscreen}
                title="전체화면"
              >
                <Maximize2 size={13} />
              </button>
            )}

            {onClose && (
              <button
                type="button"
                className="pane-header-btn danger"
                onClick={onClose}
                title="이 세션 종료"
              >
                <Power size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 플로팅 툴바 (단일 화면 모드 또는 펼침 시) */}
      {!isSplitView && (
        <div className={`in-session-toolbar ${isToolbarMinimized ? "minimized" : ""} pos-top-center`}>
          {isToolbarMinimized ? (
            <div
              className="minimized-wrapper"
              onClick={() => setIsToolbarMinimized(false)}
              title="툴바 펼치기"
            >
              <div className="status-dot-sm online" />
              <span className="minimized-title">
                {session.deviceName || `PC ${session.roomId}`}
              </span>
              {session.ping !== null && (
                <span
                  className="minimized-ping"
                  style={{ color: session.ping < 50 ? "#34d399" : "#f59e0b" }}
                >
                  {session.ping}ms
                </span>
              )}
              <ChevronDown size={14} />
            </div>
          ) : (
            <div className="expanded-wrapper">
              <div className="toolbar-badge">
                <div className="status-dot-sm online" />
                <span>{session.deviceName || `PC ${session.roomId}`}</span>
              </div>

              {session.ping !== null && (
                <div
                  className="toolbar-badge"
                  style={{ color: session.ping < 50 ? "#34d399" : "#f59e0b" }}
                >
                  <Activity size={14} />
                  <span>{session.ping} ms</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "4px" }}>
                    • {session.fps || 30} FPS
                  </span>
                </div>
              )}

              {/* 화질 프리셋 */}
              <button
                className={`toolbar-btn ${sessionQuality === 95 ? "active" : ""}`}
                onClick={() => {
                  setSessionQuality(95);
                  sendControlEvent({ type: "change-quality", quality: 95, fps: 60 });
                }}
                title="초고화질 (60 FPS)"
              >
                <Zap size={13} />
                <span>Ultra 60fps</span>
              </button>

              <button
                className={`toolbar-btn ${sessionQuality === 65 ? "active" : ""}`}
                onClick={() => {
                  setSessionQuality(65);
                  sendControlEvent({ type: "change-quality", quality: 65, fps: 30 });
                }}
                title="균형 화질 (30 FPS)"
              >
                <span>Balanced</span>
              </button>

              {/* 모니터 전환 */}
              <button
                className="toolbar-btn"
                onClick={() => {
                  const nextMon = sessionMonitor === 0 ? 1 : 0;
                  setSessionMonitor(nextMon);
                  sendControlEvent({ type: "switch-monitor", monitorIndex: nextMon });
                }}
                title="화면 전환"
              >
                <Monitor size={14} />
                <span>Display {sessionMonitor + 1}</span>
              </button>

              {/* 한/영 전환 */}
              <button className="toolbar-btn" onClick={triggerHangulToggle} title="한/영 입력 전환">
                <span style={{ fontWeight: 800, fontSize: "0.8rem", color: "#38bdf8" }}>한/A</span>
                <span>한/영</span>
              </button>

              {/* 단축키 메뉴 */}
              <div style={{ position: "relative" }}>
                <button
                  className={`toolbar-btn ${showShortcutsMenu ? "active" : ""}`}
                  onClick={() => setShowShortcutsMenu(!showShortcutsMenu)}
                  title="단축키 퀵 전송"
                >
                  <Keyboard size={14} />
                  <span>단축키</span>
                </button>

                {showShortcutsMenu && (
                  <div className="shortcuts-dropdown-menu">
                    <button className="shortcut-menu-item" onClick={() => sendShortcut(["control", "alt", "delete"])}>
                      <span>Ctrl + Alt + Del</span>
                    </button>
                    <button className="shortcut-menu-item" onClick={() => sendShortcut(["meta"])}>
                      <span>Win (시작)</span>
                    </button>
                    <button className="shortcut-menu-item" onClick={() => sendShortcut(["meta", "d"])}>
                      <span>Win + D (바탕화면)</span>
                    </button>
                    <button className="shortcut-menu-item" onClick={() => sendShortcut(["alt", "tab"])}>
                      <span>Alt + Tab</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 전체화면 */}
              {onToggleFullscreen && (
                <button className="toolbar-btn" onClick={onToggleFullscreen} title="전체화면">
                  <Maximize2 size={14} />
                </button>
              )}

              {/* 최소화 */}
              <button
                className="toolbar-btn"
                onClick={() => setIsToolbarMinimized(true)}
                title="툴바 접기"
              >
                <ChevronUp size={14} />
              </button>

              {/* 세션 종료 */}
              {onClose && (
                <button
                  type="button"
                  className="btn-main btn-danger-soft"
                  style={{ padding: "5px 10px", fontSize: "0.8rem" }}
                  onClick={onClose}
                  title="원격 세션 종료"
                >
                  <Power size={13} />
                  <span>종료</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 비디오 래퍼 & 라이브 스트림 */}
      <div
        className="video-wrapper"
        tabIndex={0}
        onContextMenu={(e) => {
          e.preventDefault();
          handleRemoteInput(e, "contextmenu");
        }}
        onMouseEnter={() => setGuestCursor((prev) => ({ ...prev, visible: true }))}
        onMouseLeave={() => setGuestCursor((prev) => ({ ...prev, visible: false, clicking: false }))}
        onMouseDown={(e) => {
          if (e.target !== videoRef.current) {
            handleRemoteInput(e, "mousedown");
          }
        }}
        onMouseUp={(e) => {
          if (e.target !== videoRef.current) {
            handleRemoteInput(e, "mouseup");
          }
        }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setGuestCursor({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            visible: true,
            clicking: e.buttons > 0,
          });
          if (e.target !== videoRef.current) {
            handleRemoteInput(e, "mousemove");
          }
        }}
        onWheel={handleWheel}
        style={{ cursor: showVirtualCursor ? "none" : "default" }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedData={(e) => {
            (e.target as HTMLVideoElement).play().catch(() => {});
          }}
          onCanPlay={(e) => {
            (e.target as HTMLVideoElement).play().catch(() => {});
          }}
          onMouseDown={(e) => handleRemoteInput(e, "mousedown")}
          onMouseUp={(e) => handleRemoteInput(e, "mouseup")}
          onMouseMove={(e) => handleRemoteInput(e, "mousemove")}
          onContextMenu={(e) => handleRemoteInput(e, "contextmenu")}
          style={{ cursor: showVirtualCursor ? "none" : "default" }}
        />

        {/* 🎯 선명한 원격 가상 마우스 커서 오버레이 */}
        {showVirtualCursor && guestCursor.visible && (
          <div
            style={{
              position: "absolute",
              left: `${guestCursor.x}px`,
              top: `${guestCursor.y}px`,
              pointerEvents: "none",
              zIndex: 9999,
              transformOrigin: "0 0",
              transform: guestCursor.clicking ? "scale(0.85)" : "scale(1)",
              transition: "transform 0.05s cubic-bezier(0.2, 0, 0, 1)",
              filter: "drop-shadow(0 2px 5px rgba(0, 0, 0, 0.75))",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" style={{ display: "block" }}>
              <path
                d="M0 0 L0 17 L4.5 13 L7.8 20.2 L10.6 18.9 L7.2 11.8 L12.8 11.8 Z"
                fill="#ffffff"
                stroke="#090d16"
                strokeWidth="1.6"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
            {guestCursor.clicking && (
              <div
                style={{
                  position: "absolute",
                  left: "-6px",
                  top: "-6px",
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  border: "2px solid #38bdf8",
                  animation: "ping 0.4s cubic-bezier(0, 0, 0.2, 1) infinite",
                  opacity: 0.8,
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
