import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Monitor,
  Cast,
  Power,
  Hash,
  Shield,
  Key,
  Copy,
  Check,
  Settings as SettingsIcon,
  BookOpen,
  Laptop,
  Maximize2,
  Minimize2,
  Trash2,
  Plus,
  Activity,
  Wifi,
  Lock,
  Clipboard,
  Zap,
  Play,
  Square,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import "./App.css";

const DEFAULT_SERVER_URL = "http://127.0.0.1:3001";
const ICE_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

function maskServerUrl(url: string): string {
  return url.replace(/183\.111\.\d+\.\d+/, "183.111.***.***");
}

interface SavedDevice {
  id: string;
  name: string;
  pin?: string;
  memo?: string;
  createdAt: number;
}

interface RecentDevice {
  id: string;
  name?: string;
  pin?: string;
  lastConnected: number;
}

// 9자리 무작위 기기 ID 생성기
function generateRandomDeviceId(): string {
  const num = Math.floor(100000000 + Math.random() * 900000000);
  return num.toString();
}

// 9자리 포맷팅 (123 456 789)
function formatDeviceId(id: string): string {
  const cleaned = id.replace(/\D/g, "");
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)}`;
}

function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<"connect" | "host" | "devices" | "settings">("connect");

  // Server & Connectivity
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem("synclink_server_url") || DEFAULT_SERVER_URL);
  const [showServerUrl, setShowServerUrl] = useState(false);
  const [isServerConnected, setIsServerConnected] = useState(false);
  const [ping, setPing] = useState<number | null>(null);

  // Host Configuration (Hardware Machine ID + LocalStorage)
  const [myDeviceId, setMyDeviceId] = useState(() => {
    return localStorage.getItem("synclink_device_id") || "100000000";
  });
  const [myPin, setMyPin] = useState(() => localStorage.getItem("synclink_pin") || "1234");
  const [myDeviceName, setMyDeviceName] = useState(() => localStorage.getItem("synclink_devicename") || "My Workstation");
  const [isHostingActive, setIsHostingActive] = useState(false);
  const [hostMonitorIndex, setHostMonitorIndex] = useState(0);
  const [hostFps, setHostFps] = useState<number>(30);
  const [hostQuality, setHostQuality] = useState<number>(65);

  // Guest Connection Inputs
  const [targetId, setTargetId] = useState("");
  const [targetPin, setTargetPin] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [saveToBookAfterConnect, setSaveToBookAfterConnect] = useState(true);

  // Address Book & Recent Connections
  const [savedDevices, setSavedDevices] = useState<SavedDevice[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("synclink_saved_devices") || "[]");
    } catch {
      return [];
    }
  });
  const [recentDevices, setRecentDevices] = useState<RecentDevice[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("synclink_recent_devices") || "[]");
    } catch {
      return [];
    }
  });

  // Active Session State
  const [isConnected, setIsConnected] = useState(false);
  const [isHostMode, setIsHostMode] = useState(false);
  const [sessionRoomId, setSessionRoomId] = useState("");
  const [sessionDeviceName, setSessionDeviceName] = useState("");
  const [status, setStatus] = useState("Ready");
  const [sessionFps, setSessionFps] = useState<number>(30);
  const [sessionQuality, setSessionQuality] = useState<number>(65);
  const [sessionMonitor, setSessionMonitor] = useState<number>(0);
  const [autoClipboardSync, setAutoClipboardSync] = useState(true);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(true);
  const [isBlackScreen, setIsBlackScreen] = useState(false);
  const [isPrivacyCover, setIsPrivacyCover] = useState(false);
  const [showSponsorAd, setShowSponsorAd] = useState(() => {
    const saved = localStorage.getItem("synclink_show_sponsor_ad");
    return saved === null ? true : saved === "true";
  });

  // New Device Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDeviceId, setNewDeviceId] = useState("");
  const [newDevicePin, setNewDevicePin] = useState("");
  const [newDeviceMemo, setNewDeviceMemo] = useState("");

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const isHostRef = useRef(false);
  const candidateQueue = useRef<RTCIceCandidate[]>([]);
  const activeMonitorRef = useRef(0);
  const lastClipboardTextRef = useRef("");
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem("synclink_server_url", serverUrl);
  }, [serverUrl]);

  useEffect(() => {
    localStorage.setItem("synclink_pin", myPin);
  }, [myPin]);

  useEffect(() => {
    localStorage.setItem("synclink_devicename", myDeviceName);
  }, [myDeviceName]);

  useEffect(() => {
    localStorage.setItem("synclink_saved_devices", JSON.stringify(savedDevices));
  }, [savedDevices]);

  useEffect(() => {
    localStorage.setItem("synclink_recent_devices", JSON.stringify(recentDevices));
  }, [recentDevices]);

  // Check OS permissions & Fetch Hardware Machine ID on launch
  useEffect(() => {
    const init = async () => {
      try {
        const granted = await invoke<boolean>("check_permissions");
        setPermissionGranted(granted);
      } catch (err) {
        console.error("Permission check error:", err);
      }

      try {
        const hardwareId = await invoke<string>("get_machine_id");
        if (hardwareId) {
          setMyDeviceId(hardwareId);
          localStorage.setItem("synclink_device_id", hardwareId);
        }
      } catch (err) {
        console.warn("Hardware ID fallback:", err);
        if (!localStorage.getItem("synclink_device_id")) {
          const generated = generateRandomDeviceId();
          setMyDeviceId(generated);
          localStorage.setItem("synclink_device_id", generated);
        }
      }
    };
    init();
    const interval = setInterval(async () => {
      try {
        const granted = await invoke<boolean>("check_permissions");
        setPermissionGranted(granted);
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Initialize Socket.io Connection
  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(serverUrl, {
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Connected to signaling server:", socket.id);
      setIsServerConnected(true);
      // Auto-register host if hosting was active
      if (isHostRef.current) {
        socket.emit("register-host", {
          roomId: myDeviceId,
          password: myPin,
          deviceName: myDeviceName,
        });
      }
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected from signaling server");
      setIsServerConnected(false);
    });

    socket.on("host-registered", (res) => {
      console.log("🖥️ Host registered response:", res);
    });

    // 🔑 Guest Auth Response
    socket.on("auth-response", async (res: { success: boolean; error?: string; roomId?: string; deviceName?: string; hostSocketId?: string }) => {
      setIsConnecting(false);
      if (res.success && res.roomId) {
        setAuthError(null);
        setSessionRoomId(res.roomId);
        setSessionDeviceName(res.deviceName || "Remote PC");
        setIsConnected(true);
        setIsHostMode(false);
        isHostRef.current = false;
        setStatus("Connecting WebRTC...");

        // Expand window to resizable remote desktop view
        try {
          await invoke("set_window_session_mode", { isSession: true });
        } catch (e) {
          console.warn("Failed to set window session mode:", e);
        }

        // Save to recent devices
        addRecentDevice(res.roomId, res.deviceName, targetPin);

        if (saveToBookAfterConnect && !savedDevices.some((d) => d.id === res.roomId)) {
          addSavedDevice(res.roomId, res.deviceName || `PC ${res.roomId}`, targetPin, "");
        }
      } else {
        setAuthError(res.error || "인증에 실패했어요.");
        setIsConnected(false);
      }
    });

    // WebRTC Signaling
    socket.on("user-connected", async (userId: string) => {
      if (!isHostRef.current || !peerRef.current) return;
      setStatus("Guest connected. Negotiating...");
      try {
        const offer = await peerRef.current.createOffer();
        await peerRef.current.setLocalDescription(offer);
        socket.emit("offer", { target: userId, caller: socket.id, sdp: offer });
      } catch (e) {
        console.error("Offer error:", e);
      }
    });

    socket.on("offer", async (payload) => {
      const peer = createPeerConnection(payload.caller);
      try {
        await peer.setRemoteDescription(payload.sdp);
        processCandidateQueue(peer);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("answer", { target: payload.caller, sdp: answer });
        setIsConnected(true);
      } catch (e) {
        console.error("Answer error:", e);
      }
    });

    socket.on("answer", async (payload) => {
      if (peerRef.current) {
        await peerRef.current.setRemoteDescription(payload.sdp);
        processCandidateQueue(peerRef.current);
        setStatus("Session Active");
        setIsConnected(true);
      }
    });

    socket.on("ice-candidate", async (payload) => {
      const peer = peerRef.current;
      if (peer) {
        if (!peer.remoteDescription) candidateQueue.current.push(payload.candidate);
        else await peer.addIceCandidate(payload.candidate).catch((e) => console.error(e));
      }
    });

    // 🎮 Control Events
    socket.on("control-event", async (payload) => {
      if (isHostRef.current) {
        try {
          if (payload.type === "mousemove") {
            if (payload.monitorIndex !== undefined && payload.monitorIndex !== activeMonitorRef.current) {
              activeMonitorRef.current = payload.monitorIndex;
              setHostMonitorIndex(payload.monitorIndex);
              await invoke("start_screen_capture", {
                monitorIndex: payload.monitorIndex,
                fps: hostFps,
                quality: hostQuality,
              });
            }
            await invoke("remote_mouse_move", {
              x: payload.x,
              y: payload.y,
              monitorIndex: activeMonitorRef.current,
            });
          } else if (payload.type === "click") {
            await invoke("remote_mouse_click", {
              button: payload.button || "left",
              x: payload.x,
              y: payload.y,
              monitorIndex: activeMonitorRef.current,
            });
          } else if (payload.type === "keydown" || payload.type === "keyup") {
            const state = payload.type === "keydown" ? "down" : "up";
            await invoke("remote_keyboard_event", { state, key: payload.key });
          } else if (payload.type === "switch-monitor") {
            activeMonitorRef.current = payload.monitorIndex;
            setHostMonitorIndex(payload.monitorIndex);
            await invoke("start_screen_capture", {
              monitorIndex: payload.monitorIndex,
              fps: hostFps,
              quality: hostQuality,
            });
          } else if (payload.type === "toggle-blackscreen") {
            setIsPrivacyCover(payload.enabled);
          }
        } catch (err) {
          console.error("Control handler error:", err);
        }
      }
    });

    // 📋 Clipboard Sync Event
    socket.on("clipboard-sync", async (payload: { text: string }) => {
      if (payload.text && payload.text !== lastClipboardTextRef.current) {
        lastClipboardTextRef.current = payload.text;
        try {
          await invoke("set_clipboard_text", { text: payload.text });
          console.log("📋 Clipboard synced successfully from remote");
        } catch (err) {
          console.error("Failed to set clipboard:", err);
        }
      }
    });

    // ⚡ Quality & FPS Change Event
    socket.on("quality-change", async (payload: { fps?: number; quality?: number }) => {
      if (isHostRef.current) {
        try {
          await invoke("update_capture_settings", {
            fps: payload.fps,
            quality: payload.quality,
          });
          if (payload.fps) setHostFps(payload.fps);
          if (payload.quality) setHostQuality(payload.quality);
        } catch (err) {
          console.error("Failed to update capture settings:", err);
        }
      }
    });

    // Host Offline Notification
    socket.on("host-offline", () => {
      if (!isHostRef.current) {
        alert("호스트와의 연결이 종료되었어요.");
        endSession();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [serverUrl, myDeviceId, myPin, myDeviceName]);

  // Video Frame Listener from Rust
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const startListening = async () => {
      unlisten = await listen<string>("video-frame", (event) => {
        const canvas = captureCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const img = new Image();
        img.onload = () => {
          if (canvas.width !== img.width) canvas.width = img.width;
          if (canvas.height !== img.height) canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
        };
        img.src = `data:image/jpeg;base64,${event.payload}`;
      });
    };
    if (isHostingActive) startListening();
    return () => {
      if (unlisten) unlisten();
    };
  }, [isHostingActive]);

  // Periodic Clipboard Sync (Both Host and Guest)
  useEffect(() => {
    if (!isConnected || !autoClipboardSync) return;

    const interval = setInterval(async () => {
      try {
        const currentText = await invoke<string>("get_clipboard_text");
        if (currentText && currentText !== lastClipboardTextRef.current) {
          lastClipboardTextRef.current = currentText;
          socketRef.current?.emit("clipboard-sync", {
            targetRoom: sessionRoomId || myDeviceId,
            text: currentText,
          });
        }
      } catch {
        // clipboard read errors ignored
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [isConnected, autoClipboardSync, sessionRoomId, myDeviceId]);

  // Periodic Ping Measurement
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      const start = Date.now();
      socketRef.current?.emit("ping-check", start, (sentTime: number) => {
        setPing(Date.now() - sentTime);
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [isConnected]);

  // WebRTC Helper
  const createPeerConnection = (targetId: string) => {
    const peer = new RTCPeerConnection(ICE_SERVERS);
    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current?.emit("ice-candidate", { target: targetId, candidate: e.candidate });
      }
    };
    peer.ontrack = (e) => {
      setStatus("Connected");
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
        remoteVideoRef.current.play().catch((err) => console.error("Play error:", err));
      }
    };
    return peer;
  };

  const processCandidateQueue = async (peer: RTCPeerConnection) => {
    while (candidateQueue.current.length > 0) {
      const c = candidateQueue.current.shift();
      if (c) peer.addIceCandidate(c);
    }
  };

  // Start Hosting
  const startHosting = async () => {
    if (!myPin) return alert("무인 접속을 위한 PIN 비밀번호를 설정해 주세요.");
    isHostRef.current = true;
    setIsHostingActive(true);
    setIsHostMode(true);
    setSessionRoomId(myDeviceId);
    setSessionDeviceName(myDeviceName);
    setStatus("Hosting Active");

    socketRef.current?.emit("register-host", {
      roomId: myDeviceId,
      password: myPin,
      deviceName: myDeviceName,
    });

    try {
      await invoke("start_screen_capture", {
        monitorIndex: hostMonitorIndex,
        fps: hostFps,
        quality: hostQuality,
      });

      if (captureCanvasRef.current) {
        const canvas = captureCanvasRef.current as any;
        const stream = canvas.captureStream(hostFps);
        const peer = createPeerConnection("guest");
        stream.getTracks().forEach((track: any) => peer.addTrack(track, stream));
        peerRef.current = peer;
      }
    } catch (err) {
      console.error("Start host error:", err);
      setIsHostingActive(false);
      isHostRef.current = false;
    }
  };

  // Stop Hosting
  const stopHosting = () => {
    setIsHostingActive(false);
    isHostRef.current = false;
    setIsConnected(false);
    peerRef.current?.close();
    peerRef.current = null;
    setStatus("Ready");
  };

  // Connect as Guest
  const connectToDevice = (target: string, pin: string) => {
    const cleanId = target.replace(/\s+/g, "");
    if (!cleanId) return alert("접속할 기기 ID를 입력해 주세요.");
    setIsConnecting(true);
    setAuthError(null);

    socketRef.current?.emit("auth-connect", {
      roomId: cleanId,
      password: pin,
    });
  };

  // Add Recent Device
  const addRecentDevice = (id: string, name?: string, pin?: string) => {
    setRecentDevices((prev) => {
      const filtered = prev.filter((d) => d.id !== id);
      return [{ id, name, pin, lastConnected: Date.now() }, ...filtered].slice(0, 5);
    });
  };

  // Add Saved Device
  const addSavedDevice = (id: string, name: string, pin?: string, memo?: string) => {
    const cleanId = id.replace(/\s+/g, "");
    setSavedDevices((prev) => {
      const filtered = prev.filter((d) => d.id !== cleanId);
      return [{ id: cleanId, name, pin, memo, createdAt: Date.now() }, ...filtered];
    });
  };

  // Remove Saved Device
  const removeSavedDevice = (id: string) => {
    setSavedDevices((prev) => prev.filter((d) => d.id !== id));
  };

  // End Current Session
  const endSession = () => {
    peerRef.current?.close();
    peerRef.current = null;
    setIsConnected(false);
    setIsBlackScreen(false);
    setIsPrivacyCover(false);
    setStatus("Ready");
    setPing(null);
    if (isHostRef.current) {
      setIsHostingActive(false);
      isHostRef.current = false;
    }

    // Reset window back to fixed dashboard size
    invoke("set_window_session_mode", { isSession: false }).catch(() => {});
  };

  // Guest Input Handlers
  const handleRemoteInput = (e: React.MouseEvent, type: string) => {
    if (isHostRef.current) return;
    const video = e.currentTarget as HTMLVideoElement;
    if (type === "click") {
      const wrapper = video.parentElement;
      if (wrapper) wrapper.focus();
    }
    const rect = video.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    if (type === "mousemove") {
      socketRef.current?.emit("control-event", {
        targetRoom: sessionRoomId,
        type: "mousemove",
        x,
        y,
        monitorIndex: sessionMonitor,
      });
    } else if (type === "click") {
      socketRef.current?.emit("control-event", {
        targetRoom: sessionRoomId,
        type: "click",
        button: e.button === 2 ? "right" : e.button === 1 ? "middle" : "left",
        x,
        y,
        monitorIndex: sessionMonitor,
      });
    }
  };

  const handleKeyInput = (e: React.KeyboardEvent, type: "keydown" | "keyup") => {
    if (isHostRef.current) return;
    socketRef.current?.emit("control-event", {
      targetRoom: sessionRoomId,
      type,
      key: e.key,
    });
  };

  // Change Remote Quality Preset
  const applyQualityPreset = (quality: number, fps: number) => {
    setSessionQuality(quality);
    setSessionFps(fps);
    socketRef.current?.emit("quality-change", {
      targetRoom: sessionRoomId,
      fps,
      quality,
    });
  };

  // Switch Remote Monitor
  const switchRemoteMonitor = (newIndex: number) => {
    setSessionMonitor(newIndex);
    socketRef.current?.emit("control-event", {
      targetRoom: sessionRoomId,
      type: "switch-monitor",
      monitorIndex: newIndex,
    });
  };

  // Toggle Host Privacy Black Screen (Curtain Mode)
  const toggleBlackScreen = (enable: boolean) => {
    setIsBlackScreen(enable);
    socketRef.current?.emit("control-event", {
      targetRoom: sessionRoomId,
      type: "toggle-blackscreen",
      enabled: enable,
    });
  };

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoContainerRef.current?.requestFullscreen().catch((err) => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.error(err));
      setIsFullscreen(false);
    }
  };

  // Copy to Clipboard Helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  // External Link Opener (Opens in default OS browser via plugin-opener)
  const handleOpenExternal = async (url: string) => {
    try {
      await openUrl(url);
    } catch {
      window.open(url, "_blank");
    }
  };

  // Toggle Sponsor Ad in Sidebar
  const handleToggleSponsorAd = (enabled: boolean) => {
    setShowSponsorAd(enabled);
    localStorage.setItem("synclink_show_sponsor_ad", String(enabled));
  };

  return (
    <div className="container">
      {/* 프라이버시 블랙스크린 (호스트 커튼 모드) 오버레이 */}
      {isPrivacyCover && isHostMode && (
        <div className="privacy-cover-overlay">
          <Shield size={64} color="#10b981" />
          <h2 style={{ fontSize: "1.6rem", margin: 0, fontWeight: 700 }}>🔒 프라이버시 보호 모드 동작 중</h2>
          <p style={{ color: "#94a3b8", margin: 0, fontSize: "1rem" }}>
            원격 사용자가 접속하여 현장 모니터 화면을 안전하게 보호하고 있어요.
          </p>
        </div>
      )}

      {/* macOS 권한 경고 배너 */}
      {!permissionGranted && (
        <div className="alert-banner">
          <span>⚠️ 원격 제어와 화면 캡처를 위해 macOS 시스템 권한이 필요해요.</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => invoke("open_permission_settings", { permissionType: "accessibility" })}
              style={{ padding: "6px 12px", borderRadius: "6px", border: "none", background: "white", color: "#ef4444", fontWeight: "bold", cursor: "pointer" }}
            >
              제어 권한 ⚙️
            </button>
            <button
              onClick={() => invoke("open_permission_settings", { permissionType: "screen" })}
              style={{ padding: "6px 12px", borderRadius: "6px", border: "none", background: "white", color: "#ef4444", fontWeight: "bold", cursor: "pointer" }}
            >
              화면 기록 📷
            </button>
          </div>
        </div>
      )}

      {/* Background Frame Capture Canvas */}
      <canvas ref={captureCanvasRef} style={{ position: "absolute", top: -9999, left: -9999, visibility: "hidden" }} />

      {/* ─────────────────── MAIN DASHBOARD ─────────────────── */}
      {!isConnected ? (
        <div className="main-layout">
          {/* 사이드바 네비게이션 */}
          <div className="sidebar">
            <div className="brand-section">
              <div className="brand-logo">
                <Zap size={22} />
              </div>
              <div>
                <h2 className="brand-title">SyncLink</h2>
                <span className="brand-badge">FOSS Edition</span>
              </div>
            </div>

            <div className="nav-menu">
              <button className={`nav-item ${activeTab === "connect" ? "active" : ""}`} onClick={() => setActiveTab("connect")}>
                <Cast size={18} />
                <span>원격 접속 (Connect)</span>
              </button>
              <button className={`nav-item ${activeTab === "host" ? "active" : ""}`} onClick={() => setActiveTab("host")}>
                <Laptop size={18} />
                <span>내 PC 호스팅 (Host)</span>
              </button>
              <button className={`nav-item ${activeTab === "devices" ? "active" : ""}`} onClick={() => setActiveTab("devices")}>
                <BookOpen size={18} />
                <span>기기 주소록 ({savedDevices.length})</span>
              </button>
              <button className={`nav-item ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab("settings")}>
                <SettingsIcon size={18} />
                <span>설정 (Settings)</span>
              </button>
            </div>

            <div className="sidebar-footer">
              {/* Carbon Ads / Open Source Sponsor Card */}
              {showSponsorAd && (
                <div
                  className="carbon-ad-box"
                  onClick={() => handleOpenExternal("https://www.carbonads.net")}
                  title="스폰서 링크 열기 (새 브라우저 창)"
                >
                  <div className="carbon-ad-content">
                    <div className="carbon-ad-img">
                      <Zap size={20} />
                    </div>
                    <p className="carbon-ad-text">
                      <b>Cloud VPS High Performance</b> — 오픈소스 서버를 위한 초고속 NVMe 인스턴스
                    </p>
                  </div>
                  <div className="carbon-ad-footer">
                    <span className="carbon-ad-tag">ads via Carbon • 서버 후원</span>
                    <ExternalLink size={12} className="carbon-ad-ext" />
                  </div>
                </div>
              )}

              <div className="server-status">
                <div className={`status-dot-sm ${isServerConnected ? "online" : "offline"}`} />
                <span>{isServerConnected ? "시그널링 서버에 연결되었어요" : "서버가 오프라인이에요"}</span>
              </div>
            </div>
          </div>

          {/* 메인 컨텐츠 영역 */}
          <div className="content-area">
            {/* 탭 1: 원격 접속 (Connect) */}
            {activeTab === "connect" && (
              <div>
                <div className="content-header">
                  <h1 className="content-title">원격 데스크톱 접속</h1>
                  <p className="content-subtitle">접속할 컴퓨터의 9자리 기기 ID와 PIN 비밀번호를 입력해 주세요.</p>
                </div>

                <div className="card-grid">
                  {/* 접속 입력 카드 */}
                  <div className="glass-card">
                    <div className="card-title-row">
                      <h3 className="card-title">
                        <Monitor size={20} color="#60a5fa" />
                        새 세션 연결하기
                      </h3>
                    </div>

                    {authError && (
                      <div style={{ padding: "10px 14px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "10px", color: "#fca5a5", fontSize: "0.85rem" }}>
                        ⚠️ {authError}
                      </div>
                    )}

                    <div className="input-field-group">
                      <label className="input-label">기기 ID (9자리)</label>
                      <div className="custom-input-wrapper">
                        <Hash className="input-icon-left" size={18} />
                        <input
                          className="custom-input large-id mono"
                          placeholder="000 000 000"
                          value={formatDeviceId(targetId)}
                          onChange={(e) => setTargetId(e.target.value.replace(/\s+/g, ""))}
                          maxLength={11}
                        />
                      </div>
                    </div>

                    <div className="input-field-group">
                      <label className="input-label">무인 접속 PIN / 비밀번호</label>
                      <div className="custom-input-wrapper">
                        <Key className="input-icon-left" size={18} />
                        <input
                          className="custom-input mono"
                          type="password"
                          placeholder="••••••"
                          value={targetPin}
                          onChange={(e) => setTargetPin(e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                      <input
                        type="checkbox"
                        id="saveDevice"
                        checked={saveToBookAfterConnect}
                        onChange={(e) => setSaveToBookAfterConnect(e.target.checked)}
                        style={{ accentColor: "var(--primary)" }}
                      />
                      <label htmlFor="saveDevice" style={{ fontSize: "0.85rem", color: "var(--text-muted)", cursor: "pointer" }}>
                        접속 성공 시 주소록에 자동으로 저장해요
                      </label>
                    </div>

                    <button
                      className="btn-main btn-primary-glow"
                      onClick={() => connectToDevice(targetId, targetPin)}
                      disabled={isConnecting || !isServerConnected}
                    >
                      {isConnecting ? (
                        <>
                          <Activity className="animate-spin" size={18} />
                          <span>연결하는 중이에요...</span>
                        </>
                      ) : (
                        <>
                          <Play size={18} />
                          <span>원격 접속 시작하기</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* 최근 접속 기기 카드 */}
                  <div className="glass-card">
                    <div className="card-title-row">
                      <h3 className="card-title">
                        <Laptop size={20} color="#818cf8" />
                        최근 접속 기기
                      </h3>
                    </div>

                    {recentDevices.length === 0 ? (
                      <div style={{ color: "var(--text-dim)", textAlign: "center", padding: "40px 0", fontSize: "0.9rem" }}>
                        최근 접속한 기기 기록이 없어요.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {recentDevices.map((dev) => (
                          <div key={dev.id} className="device-card">
                            <div className="device-info-left">
                              <div className="device-icon-box">
                                <Monitor size={20} />
                              </div>
                              <div>
                                <h4 className="device-name">{dev.name || `PC ${formatDeviceId(dev.id)}`}</h4>
                                <span className="device-id-tag mono">{formatDeviceId(dev.id)}</span>
                              </div>
                            </div>
                            <button
                              className="btn-main btn-secondary-dark"
                              style={{ padding: "8px 14px", fontSize: "0.85rem" }}
                              onClick={() => {
                                setTargetId(dev.id);
                                if (dev.pin) setTargetPin(dev.pin);
                                connectToDevice(dev.id, dev.pin || targetPin);
                              }}
                            >
                              접속
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 탭 2: 내 PC 호스팅 (Host) */}
            {activeTab === "host" && (
              <div>
                <div className="content-header">
                  <h1 className="content-title">내 PC 호스팅 및 무인 접속 설정</h1>
                  <p className="content-subtitle">이 PC를 외부에서 원격 제어할 수 있도록 고정 ID와 PIN을 설정해요.</p>
                </div>

                <div className="card-grid">
                  <div className="glass-card">
                    <div className="card-title-row">
                      <h3 className="card-title">
                        <Shield size={20} color="#34d399" />
                        내 호스트 기기 정보
                      </h3>
                      {isHostingActive && (
                        <span style={{ fontSize: "0.75rem", background: "rgba(16, 185, 129, 0.2)", color: "#34d399", padding: "4px 8px", borderRadius: "6px", fontWeight: "bold" }}>
                          ● 호스팅 서비스 동작 중이에요
                        </span>
                      )}
                    </div>

                    <div className="input-field-group">
                      <label className="input-label">내 기기 ID (외부 공유용)</label>
                      <div className="custom-input-wrapper">
                        <Hash className="input-icon-left" size={18} />
                        <input className="custom-input large-id mono" value={formatDeviceId(myDeviceId)} readOnly />
                        <button
                          className="btn-icon-only"
                          style={{ position: "absolute", right: "8px" }}
                          onClick={() => copyToClipboard(myDeviceId)}
                          title="기기 ID 복사"
                        >
                          {copiedNotification ? <Check size={16} color="#34d399" /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="input-field-group">
                      <label className="input-label">내 컴퓨터 이름</label>
                      <div className="custom-input-wrapper">
                        <Laptop className="input-icon-left" size={18} />
                        <input
                          className="custom-input"
                          value={myDeviceName}
                          onChange={(e) => setMyDeviceName(e.target.value)}
                          placeholder="예: Jay's Office PC"
                        />
                      </div>
                    </div>

                    <div className="input-field-group">
                      <label className="input-label">무인 접속 고정 PIN (비밀번호)</label>
                      <div className="custom-input-wrapper">
                        <Lock className="input-icon-left" size={18} />
                        <input
                          className="custom-input mono"
                          value={myPin}
                          onChange={(e) => setMyPin(e.target.value)}
                          placeholder="접속 비밀번호 설정"
                        />
                      </div>
                    </div>

                    <div style={{ padding: "12px 14px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "10px", border: "1px solid var(--card-border)", fontSize: "0.85rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "10px" }}>
                      <Monitor size={18} color="#60a5fa" />
                      <span>원격 접속 시 주 모니터가 자동으로 공유되고, 게스트가 세션 중에 모니터를 자유롭게 바꿀 수 있어요.</span>
                    </div>

                    {!isHostingActive ? (
                      <button className="btn-main btn-primary-glow" onClick={startHosting} disabled={!isServerConnected}>
                        <Play size={18} />
                        <span>호스팅 서비스 시작하기</span>
                      </button>
                    ) : (
                      <button className="btn-main btn-danger-soft" onClick={stopHosting}>
                        <Square size={18} />
                        <span>호스팅 중지하기</span>
                      </button>
                    )}
                  </div>

                  {/* 호스팅 상태 레이더 카드 */}
                  <div className="glass-card" style={{ alignItems: "center", justifyContent: "center" }}>
                    {isHostingActive ? (
                      <div className="host-active-box" style={{ width: "100%" }}>
                        <div className="radar-wrapper">
                          <div className="radar-pulse" />
                          <div className="radar-core">
                            <Cast size={32} />
                          </div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <h3 style={{ margin: "0 0 6px 0", fontSize: "1.3rem" }}>호스팅 서비스가 활성화되었어요</h3>
                          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>
                            외부에서 ID <b>{formatDeviceId(myDeviceId)}</b> 로 언제든 원격 제어할 수 있어요.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-dim)" }}>
                        <Laptop size={48} style={{ opacity: 0.3, marginBottom: "12px" }} />
                        <p style={{ margin: 0 }}>호스팅 서비스를 시작하면 원격 접속 요청을 기다려요.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 탭 3: 기기 주소록 (Address Book) */}
            {activeTab === "devices" && (
              <div>
                <div className="content-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h1 className="content-title">기기 주소록</h1>
                    <p className="content-subtitle">자주 접속하는 원격 컴퓨터를 등록하고 한 번에 연결해 보세요.</p>
                  </div>
                  <button className="btn-main btn-primary-glow" style={{ padding: "10px 16px" }} onClick={() => setShowAddModal(true)}>
                    <Plus size={18} />
                    <span>새 기기 추가</span>
                  </button>
                </div>

                {savedDevices.length === 0 ? (
                  <div className="glass-card" style={{ textAlign: "center", padding: "60px 20px" }}>
                    <BookOpen size={48} style={{ opacity: 0.2, margin: "0 auto 16px auto" }} />
                    <h3 style={{ margin: "0 0 8px 0" }}>등록된 기기가 없어요</h3>
                    <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "0.9rem" }}>
                      [새 기기 추가] 버튼을 눌러 자주 쓰는 컴퓨터를 등록해 보세요.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {savedDevices.map((dev) => (
                      <div key={dev.id} className="device-card">
                        <div className="device-info-left">
                          <div className="device-icon-box">
                            <Laptop size={22} />
                          </div>
                          <div>
                            <h4 className="device-name">{dev.name}</h4>
                            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                              <span className="device-id-tag mono">{formatDeviceId(dev.id)}</span>
                              {dev.memo && <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>• {dev.memo}</span>}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            className="btn-main btn-primary-glow"
                            style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                            onClick={() => {
                              setTargetId(dev.id);
                              if (dev.pin) setTargetPin(dev.pin);
                              connectToDevice(dev.id, dev.pin || "");
                            }}
                          >
                            <Play size={14} />
                            <span>연결</span>
                          </button>
                          <button className="btn-icon-only" onClick={() => removeSavedDevice(dev.id)} title="기기 삭제">
                            <Trash2 size={16} color="#fca5a5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 탭 4: 설정 (Settings) */}
            {activeTab === "settings" && (
              <div>
                <div className="content-header">
                  <h1 className="content-title">시스템 설정</h1>
                  <p className="content-subtitle">시그널링 서버 주소와 클립보드 동기화 옵션을 관리해요.</p>
                </div>

                <div className="glass-card" style={{ maxWidth: "600px" }}>
                  <div className="input-field-group">
                    <label className="input-label">시그널링 서버 주소 (Signaling Server URL)</label>
                    <div className="custom-input-wrapper">
                      <Wifi className="input-icon-left" size={18} />
                      <input
                        className="custom-input mono"
                        value={showServerUrl ? serverUrl : maskServerUrl(serverUrl)}
                        onChange={(e) => setServerUrl(e.target.value)}
                        onFocus={() => setShowServerUrl(true)}
                        onBlur={() => setShowServerUrl(false)}
                      />
                      <button
                        type="button"
                        className="btn-icon-only"
                        style={{ position: "absolute", right: "8px" }}
                        onClick={() => setShowServerUrl(!showServerUrl)}
                        title={showServerUrl ? "IP 주소 마스킹하기" : "실제 IP 주소 보기"}
                      >
                        {showServerUrl ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                      <button className="btn-main btn-secondary-dark" style={{ padding: "6px 12px", fontSize: "0.8rem" }} onClick={() => setServerUrl(DEFAULT_SERVER_URL)}>
                        기본 공용 서버
                      </button>
                      <button className="btn-main btn-secondary-dark" style={{ padding: "6px 12px", fontSize: "0.8rem" }} onClick={() => setServerUrl("http://localhost:3001")}>
                        로컬호스트 (3001)
                      </button>
                    </div>
                  </div>

                  <div className="input-field-group" style={{ marginTop: "12px" }}>
                    <label className="input-label">클립보드 동기화</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <input
                        type="checkbox"
                        id="autoClip"
                        checked={autoClipboardSync}
                        onChange={(e) => setAutoClipboardSync(e.target.checked)}
                        style={{ accentColor: "var(--primary)" }}
                      />
                      <label htmlFor="autoClip" style={{ fontSize: "0.9rem", color: "var(--text-main)", cursor: "pointer" }}>
                        세션 연결 중 텍스트 복사(`Ctrl+C` / `Ctrl+V`)를 자동으로 양방향 동기화해요
                      </label>
                    </div>
                  </div>

                  <div className="input-field-group" style={{ marginTop: "16px" }}>
                    <label className="input-label">오픈소스 프로젝트 후원 및 스폰서</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <input
                        type="checkbox"
                        id="sponsorAdToggle"
                        checked={showSponsorAd}
                        onChange={(e) => handleToggleSponsorAd(e.target.checked)}
                        style={{ accentColor: "var(--primary)" }}
                      />
                      <label htmlFor="sponsorAdToggle" style={{ fontSize: "0.9rem", color: "var(--text-main)", cursor: "pointer" }}>
                        사이드바에 스폰서 광고 표시하기 (오픈소스 서버 유지비 후원에 큰 힘이 돼요)
                      </label>
                    </div>
                  </div>
                </div>

                {/* Self-Hosted 시그널링 서버 안내 카드 */}
                <div className="glass-card" style={{ maxWidth: "600px", marginTop: "16px" }}>
                  <h3 className="card-title" style={{ fontSize: "1rem", marginBottom: "8px" }}>
                    <Shield size={18} color="#34d399" />
                    나만의 시그널링 서버 셀프 호스팅 (Self-Hosted)
                  </h3>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5, margin: "0 0 12px 0" }}>
                    외부 공용 서버에 의존하지 않고 개인 VPS 또는 홈 서버에 직접 시그널링 서버를 띄워 100% 독립적이고 안전한 사설 원격망을 운영할 수 있어요.
                  </p>
                  <div style={{ background: "rgba(0,0,0,0.4)", padding: "10px 14px", borderRadius: "8px", fontFamily: "monospace", fontSize: "0.8rem", color: "#60a5fa", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>cd signaling-server && npm install && npm start</span>
                    <button
                      className="btn-icon-only"
                      onClick={() => copyToClipboard("cd signaling-server && npm install && npm start")}
                      title="실행 명령어 복사"
                    >
                      {copiedNotification ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ─────────────────── IN-SESSION SCREEN (ACTIVE) ─────────────────── */
        <div className="session-screen" ref={videoContainerRef}>
          {/* 상단 플로팅 글래스모피즘 툴바 */}
          <div className="in-session-toolbar">
            <div className="toolbar-badge">
              <div className="status-dot-sm online" />
              <span>{sessionDeviceName || formatDeviceId(sessionRoomId)}</span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "4px" }}>({status})</span>
            </div>

            {ping !== null && (
              <div className="toolbar-badge" style={{ color: ping < 50 ? "#34d399" : "#f59e0b" }}>
                <Activity size={14} />
                <span>{ping} ms</span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "4px" }}>• {sessionFps} FPS</span>
              </div>
            )}

            <div className="toolbar-divider" />

            {/* 게스트 제어 옵션들 */}
            {!isHostMode && (
              <>
                {/* 화질 프리셋 */}
                <button
                  className={`toolbar-btn ${sessionQuality === 95 ? "active" : ""}`}
                  onClick={() => applyQualityPreset(95, 60)}
                  title="초고화질 (60 FPS)"
                >
                  <Zap size={14} />
                  <span>Ultra 60fps</span>
                </button>

                <button
                  className={`toolbar-btn ${sessionQuality === 65 ? "active" : ""}`}
                  onClick={() => applyQualityPreset(65, 30)}
                  title="균형 화질 (30 FPS)"
                >
                  <span>Balanced</span>
                </button>

                {/* 모니터 전환 */}
                <button
                  className="toolbar-btn"
                  onClick={() => switchRemoteMonitor(sessionMonitor === 0 ? 1 : 0)}
                  title="화면 전환"
                >
                  <Monitor size={14} />
                  <span>Display {sessionMonitor + 1}</span>
                </button>

                {/* 클립보드 동기화 상태 */}
                <button
                  className={`toolbar-btn ${autoClipboardSync ? "active" : ""}`}
                  onClick={() => setAutoClipboardSync(!autoClipboardSync)}
                  title="클립보드 자동 동기화 토글"
                >
                  <Clipboard size={14} />
                  <span>클립보드</span>
                </button>

                {/* 프라이버시 블랙스크린 (커튼 모드) */}
                <button
                  className={`toolbar-btn ${isBlackScreen ? "active" : ""}`}
                  onClick={() => toggleBlackScreen(!isBlackScreen)}
                  title="호스트 현장 모니터 화면 가리기 (프라이버시 모드)"
                >
                  <EyeOff size={14} color={isBlackScreen ? "#34d399" : "#94a3b8"} />
                  <span>{isBlackScreen ? "화면 가림 On" : "프라이버시"}</span>
                </button>

                <div className="toolbar-divider" />

                {/* 전체화면 */}
                <button className="toolbar-btn" onClick={toggleFullscreen} title="전체화면">
                  {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
              </>
            )}

            {/* 세션 종료 */}
            <button className="btn-main btn-danger-soft" style={{ padding: "6px 12px", fontSize: "0.85rem" }} onClick={endSession}>
              <Power size={14} />
              <span>종료</span>
            </button>
          </div>

          {/* 영상 스트리밍 뷰 */}
          <div className="video-container">
            {isHostMode ? (
              <div className="host-active-box">
                <div className="radar-wrapper">
                  <div className="radar-pulse" />
                  <div className="radar-core">
                    <Cast size={36} />
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <h2 style={{ margin: "0 0 8px 0" }}>ON AIR</h2>
                  <p style={{ color: "var(--text-muted)", margin: 0 }}>게스트가 현재 PC를 원격 제어하고 있어요.</p>
                </div>
              </div>
            ) : (
              <div
                className="video-wrapper"
                tabIndex={0}
                onKeyDown={(e) => handleKeyInput(e, "keydown")}
                onKeyUp={(e) => handleKeyInput(e, "keyup")}
                onContextMenu={(e) => e.preventDefault()}
              >
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  muted
                  onClick={(e) => handleRemoteInput(e, "click")}
                  onMouseMove={(e) => handleRemoteInput(e, "mousemove")}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────── 기기 추가 모달 ─────────────────── */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
        >
          <div className="glass-card" style={{ width: "400px", background: "#111827", borderColor: "rgba(255,255,255,0.15)" }}>
            <h3 style={{ margin: 0, fontSize: "1.2rem" }}>새 원격 기기 등록</h3>

            <div className="input-field-group">
              <label className="input-label">기기 별칭 (이름)</label>
              <input
                className="custom-input"
                placeholder="예: 회사 사무실 PC"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
              />
            </div>

            <div className="input-field-group">
              <label className="input-label">기기 ID (9자리)</label>
              <input
                className="custom-input mono"
                placeholder="000 000 000"
                value={formatDeviceId(newDeviceId)}
                onChange={(e) => setNewDeviceId(e.target.value.replace(/\s+/g, ""))}
              />
            </div>

            <div className="input-field-group">
              <label className="input-label">PIN 비밀번호 (선택사항)</label>
              <input
                className="custom-input mono"
                type="password"
                placeholder="••••••"
                value={newDevicePin}
                onChange={(e) => setNewDevicePin(e.target.value)}
              />
            </div>

            <div className="input-field-group">
              <label className="input-label">메모 (선택사항)</label>
              <input
                className="custom-input"
                placeholder="예: 3층 연구실 4번 좌석"
                value={newDeviceMemo}
                onChange={(e) => setNewDeviceMemo(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <button
                className="btn-main btn-secondary-dark"
                style={{ flex: 1 }}
                onClick={() => {
                  setShowAddModal(false);
                  setNewDeviceName("");
                  setNewDeviceId("");
                  setNewDevicePin("");
                  setNewDeviceMemo("");
                }}
              >
                취소
              </button>
              <button
                className="btn-main btn-primary-glow"
                style={{ flex: 1 }}
                onClick={() => {
                  if (!newDeviceId || !newDeviceName) return alert("기기 이름과 ID를 입력해 주세요.");
                  addSavedDevice(newDeviceId, newDeviceName, newDevicePin, newDeviceMemo);
                  setShowAddModal(false);
                  setNewDeviceName("");
                  setNewDeviceId("");
                  setNewDevicePin("");
                  setNewDeviceMemo("");
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;