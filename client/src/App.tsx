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
  Cloud,
  Mail,
  Heart,
  ExternalLink,
  RefreshCw,
  Server,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { check } from "@tauri-apps/plugin-updater";
import "./App.css";

const DEFAULT_SERVER_URL = "";
const ICE_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// ─── 서포트 & 파트너십 링크 (언제든 본인의 주소로 쉽게 변경 가능) ───
const SUPPORT_LINKS = {
  buyMeACoffee: "https://buymeacoffee.com/junghyuny", // Buy Me a Coffee 후원 링크
  digitalOcean: "https://m.do.co/c/synclink",     // DigitalOcean $200 무료 크레딧 추천인 링크
  contactEmail: "tpp6347@gmail.com",       // 광고 & 제휴 문의 수신 Gmail
};

const openExternalLink = async (url: string) => {
  try {
    await openUrl(url);
  } catch {
    window.open(url, "_blank");
  }
};

function BuyMeACoffeeOfficialButton({ url }: { url: string }) {
  return (
    <button
      onClick={() => openExternalLink(url)}
      title="Buy Me a Coffee 공식 후원 페이지 열기"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        background: "#FFDD00",
        color: "#000000",
        border: "none",
        borderRadius: "8px",
        padding: "8px 16px",
        fontFamily: "'Cookie', cursive, var(--bds-font-sans)",
        fontSize: "1.15rem",
        fontWeight: 700,
        letterSpacing: "0.2px",
        cursor: "pointer",
        boxShadow: "0 4px 14px rgba(255, 221, 0, 0.35)",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px) scale(1.02)";
        e.currentTarget.style.boxShadow = "0 6px 20px rgba(255, 221, 0, 0.5)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0) scale(1)";
        e.currentTarget.style.boxShadow = "0 4px 14px rgba(255, 221, 0, 0.35)";
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.216 6.415l-.132-.666c-.119-.597-.388-1.156-1.01-1.378-.602-.217-1.385-.181-2.428-.181H4.636c-.954 0-1.74.032-2.348.243-.616.216-.902.776-1.026 1.381l-.872 4.417c-.366 1.849.208 3.731 1.545 5.051 1.258 1.242 3.018 1.838 4.887 1.838h8.556c1.869 0 3.629-.596 4.887-1.838 1.337-1.32 1.911-3.202 1.545-5.051l-.594-3.216zm-3.284 3.518h-2.133v-1.07h2.133v1.07zm0-2.14h-2.133V6.723h2.133v1.07zm-3.2 2.14h-2.133v-1.07h2.133v1.07zm0-2.14h-2.133V6.723h2.133v1.07zm-3.2 2.14H8.4v-1.07h2.132v1.07zm0-2.14H8.4V6.723h2.132v1.07zM23.99 8.21c-.044-.225-.13-.443-.263-.637-.216-.317-.557-.525-.951-.577l-1.082-.143.435 2.193c.196.993-.058 2.01-.699 2.788-.475.577-1.144.93-1.886 1.025l.235 1.189c1.233-.186 2.338-.828 3.092-1.777.949-1.196 1.326-2.736 1.119-4.068z" />
      </svg>
      <span>Buy me a coffee</span>
    </button>
  );
}

function maskServerUrl(url: string): string {
  if (!url || url.trim() === "") return "미설정";
  return url.replace(/(\d{1,3}\.\d{1,3}\.)\d{1,3}\.\d{1,3}/, "$1***.***");
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

  // New Device Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDeviceId, setNewDeviceId] = useState("");
  const [newDevicePin, setNewDevicePin] = useState("");
  const [newDeviceMemo, setNewDeviceMemo] = useState("");

  // Auto-Updater State
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState<any>(null);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);

  const handleCheckForUpdate = async (manual = false) => {
    try {
      setIsCheckingUpdate(true);
      const update = await check();
      setIsCheckingUpdate(false);
      if (update) {
        setAvailableUpdate(update);
      } else if (manual) {
        alert("현재 최신 버전(v1.0.0)을 사용 중이에요! ✨");
      }
    } catch (err) {
      setIsCheckingUpdate(false);
      if (manual) {
        console.warn("Update check notice:", err);
        alert("현재 최신 버전이거나 업데이트 서버를 조회 중이에요.");
      }
    }
  };

  const handleInstallUpdate = async () => {
    if (!availableUpdate) return;
    try {
      setIsInstallingUpdate(true);
      await availableUpdate.downloadAndInstall();
      alert("최신 버전 다운로드가 완료되었어요! 앱을 자동으로 재실행합니다.");
    } catch (err) {
      alert("업데이트 설치 중 오류가 발생했어요: " + err);
    } finally {
      setIsInstallingUpdate(false);
    }
  };

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
  const remoteStreamRef = useRef<MediaStream | null>(null);

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

  // WebRTC Peer Connection Factory
  const createPeerConnection = (targetId: string) => {
    const peer = new RTCPeerConnection(ICE_SERVERS);
    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current?.emit("ice-candidate", { target: targetId, candidate: e.candidate });
      }
    };
    peer.ontrack = (e) => {
      console.log("🎥 Video track received from host!", e.streams[0]);
      setStatus("Connected");
      remoteStreamRef.current = e.streams[0];
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
        remoteVideoRef.current.play().catch((err) => console.error("Play error:", err));
      }
    };
    peer.onconnectionstatechange = () => {
      console.log("📡 WebRTC Connection State:", peer.connectionState);
      if (peer.connectionState === "connected") {
        setStatus("Connected");
        setIsConnected(true);
        if (isHostRef.current) {
          invoke("minimize_host_window").catch(() => {});
        }
      } else if (
        peer.connectionState === "disconnected" ||
        peer.connectionState === "failed" ||
        peer.connectionState === "closed"
      ) {
        if (isHostRef.current) {
          console.log("👋 Guest WebRTC disconnected");
          peerRef.current?.close();
          peerRef.current = null;
          setIsConnected(false);
          setIsPrivacyCover(false);
          invoke("set_privacy_mode", { enabled: false }).catch(() => {});
          invoke("restore_host_window").catch(() => {});
          setStatus("Hosting Active");
        } else {
          endSession();
        }
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

  // Initialize Socket.io Connection
  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    if (!serverUrl || serverUrl.trim() === "") {
      setIsServerConnected(false);
      return;
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
      if (!isHostRef.current) return;
      console.log(`🔌 Guest (${userId}) connected. Creating fresh WebRTC Offer...`);
      setStatus("Guest connected. Negotiating...");

      peerRef.current?.close();
      const peer = createPeerConnection(userId);
      if (captureCanvasRef.current) {
        const canvas = captureCanvasRef.current as any;
        const stream = canvas.captureStream(hostFps);
        stream.getTracks().forEach((track: any) => peer.addTrack(track, stream));
      }
      peerRef.current = peer;

      try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit("offer", { target: userId, caller: socket.id, sdp: offer });
      } catch (e) {
        console.error("Offer error:", e);
      }
    });

    socket.on("offer", async (payload) => {
      peerRef.current?.close();
      const peer = createPeerConnection(payload.caller);
      peerRef.current = peer;
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
      if (peer && peer.remoteDescription) {
        await peer.addIceCandidate(payload.candidate).catch((e) => console.error(e));
      } else {
        candidateQueue.current.push(payload.candidate);
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
            invoke("set_privacy_mode", { enabled: payload.enabled }).catch(() => {});
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

    // Guest Disconnected Notification (Host receives this)
    socket.on("guest-disconnected", () => {
      if (isHostRef.current) {
        console.log("👋 Guest disconnected via signaling");
        peerRef.current?.close();
        peerRef.current = null;
        setIsConnected(false);
        setIsPrivacyCover(false);
        invoke("set_privacy_mode", { enabled: false }).catch(() => {});
        invoke("restore_host_window").catch(() => {});
        setStatus("Hosting Active");
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

    if (captureCanvasRef.current) {
      captureCanvasRef.current.width = 1920;
      captureCanvasRef.current.height = 1080;
    }

    try {
      await invoke("start_screen_capture", {
        monitorIndex: hostMonitorIndex,
        fps: hostFps,
        quality: hostQuality,
      });
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
    if (!isHostRef.current && sessionRoomId) {
      socketRef.current?.emit("guest-disconnect", { roomId: sessionRoomId });
    }
    peerRef.current?.close();
    peerRef.current = null;
    remoteStreamRef.current = null;
    setIsConnected(false);
    setIsBlackScreen(false);
    setIsPrivacyCover(false);
    setStatus("Ready");
    setPing(null);
    if (isHostRef.current) {
      setIsHostingActive(false);
      isHostRef.current = false;
      invoke("set_privacy_mode", { enabled: false }).catch(() => {});
      invoke("restore_host_window").catch(() => {});
    }

    // Reset window back to fixed dashboard size
    invoke("set_window_session_mode", { isSession: false }).catch(() => {});
  };

  // Immediate Video Stream Attach
  useEffect(() => {
    if (isConnected && !isHostMode && remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [isConnected, isHostMode]);

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
    if ([" ", "Space", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Backspace"].includes(e.key)) {
      e.preventDefault();
    }
    const keyToSend = e.key === " " ? "space" : e.key;
    socketRef.current?.emit("control-event", {
      targetRoom: sessionRoomId,
      type,
      key: keyToSend,
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

      {/* Background Frame Capture Canvas - visually active to prevent macOS WebKit from throttling captureStream */}
      <canvas
        ref={captureCanvasRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          opacity: 0.001,
          zIndex: -999,
        }}
      />

      {/* ─────────────────── MAIN DASHBOARD ─────────────────── */}
      {!isConnected ? (
        <div className="main-layout">
          {/* 사이드바 네비게이션 */}
          <div className="sidebar">
            <div className="brand-section">
              <img
                src="/app-icon.png"
                alt="Yoonikon SyncLink Logo"
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  boxShadow: "0 0 20px rgba(59, 130, 246, 0.4)",
                  objectFit: "cover",
                }}
              />
              <div>
                <h2 className="brand-title">Yoonikon SyncLink</h2>
                <span className="brand-badge" style={{ background: "rgba(0, 102, 255, 0.15)", color: "#38bdf8", border: "1px solid rgba(0, 194, 255, 0.3)" }}>
                  by nexus
                </span>
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
              {/* 미니 서포트 바 */}
              <div style={{ display: "flex", gap: "6px", marginBottom: "4px" }}>
                <button
                  className="btn-main"
                  style={{ flex: 1, padding: "5px 2px", fontSize: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", background: "#FFDD00", color: "#000000", border: "none", fontWeight: 700 }}
                  onClick={() => openExternalLink(SUPPORT_LINKS.buyMeACoffee)}
                  title="Buy Me a Coffee 공식 후원"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.216 6.415l-.132-.666c-.119-.597-.388-1.156-1.01-1.378-.602-.217-1.385-.181-2.428-.181H4.636c-.954 0-1.74.032-2.348.243-.616.216-.902.776-1.026 1.381l-.872 4.417c-.366 1.849.208 3.731 1.545 5.051 1.258 1.242 3.018 1.838 4.887 1.838h8.556c1.869 0 3.629-.596 4.887-1.838 1.337-1.32 1.911-3.202 1.545-5.051l-.594-3.216zm-3.284 3.518h-2.133v-1.07h2.133v1.07zm0-2.14h-2.133V6.723h2.133v1.07zm-3.2 2.14h-2.133v-1.07h2.133v1.07zm0-2.14h-2.133V6.723h2.133v1.07zm-3.2 2.14H8.4v-1.07h2.132v1.07zm0-2.14H8.4V6.723h2.132v1.07zM23.99 8.21c-.044-.225-.13-.443-.263-.637-.216-.317-.557-.525-.951-.577l-1.082-.143.435 2.193c.196.993-.058 2.01-.699 2.788-.475.577-1.144.93-1.886 1.025l.235 1.189c1.233-.186 2.338-.828 3.092-1.777.949-1.196 1.326-2.736 1.119-4.068z" />
                  </svg>
                  <span>BMC</span>
                </button>
                <button
                  className="btn-main btn-secondary-dark"
                  style={{ flex: 1, padding: "5px 2px", fontSize: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "3px" }}
                  onClick={() => openExternalLink(SUPPORT_LINKS.digitalOcean)}
                  title="DigitalOcean $200 무료 크레딧"
                >
                  <Cloud size={13} color="#00C2FF" />
                  <span>DO 서버</span>
                </button>
                <button
                  className="btn-main btn-secondary-dark"
                  style={{ flex: 1, padding: "5px 2px", fontSize: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "3px" }}
                  onClick={() => openExternalLink(`mailto:${SUPPORT_LINKS.contactEmail}?subject=[Yoonikon SyncLink 광고 및 파트너십 문의]`)}
                  title="광고 및 제휴 문의"
                >
                  <Mail size={13} color="#34d399" />
                  <span>문의</span>
                </button>
              </div>

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
                      <button className="btn-main btn-secondary-dark" style={{ padding: "6px 12px", fontSize: "0.8rem" }} onClick={() => setServerUrl("http://localhost:5963")}>
                        로컬호스트 (5963)
                      </button>
                      <button
                        className="btn-main btn-secondary-dark"
                        style={{ padding: "6px 12px", fontSize: "0.8rem", color: "#fca5a5" }}
                        onClick={() => {
                          setServerUrl("");
                          localStorage.removeItem("synclink_server_url");
                        }}
                        title="서버 주소를 초기화하고 초기 설정 화면으로 돌아가요"
                      >
                        서버 설정 초기화
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
                </div>

                {/* nexus 개발자 & 프로젝트 정보 카드 */}
                <div className="glass-card" style={{ maxWidth: "600px", marginTop: "16px" }}>
                  <h3 className="card-title" style={{ fontSize: "1rem", marginBottom: "8px" }}>
                    <Shield size={18} color="#818cf8" />
                    프로젝트 정보 (Project Info)
                  </h3>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div>• <b>개발자</b>: nexus (개인 개발자 프로젝트)</div>
                    <div>• <b>라이선스</b>: 100% 무료 & 오픈소스 (월 구독 / 과금 없음)</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "4px" }}>
                      <span>• <b>버전</b>: Yoonikon SyncLink v1.0.0 (Native Desktop)</span>
                      <button
                        className="btn-main btn-secondary-dark"
                        style={{ padding: "4px 10px", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "5px" }}
                        onClick={() => handleCheckForUpdate(true)}
                        disabled={isCheckingUpdate}
                      >
                        <RefreshCw size={12} className={isCheckingUpdate ? "spin" : ""} />
                        <span>{isCheckingUpdate ? "확인 중..." : "업데이트 확인"}</span>
                      </button>
                    </div>
                  </div>

                  {/* 신규 버전 발견 시 업데이트 배너 */}
                  {availableUpdate && (
                    <div style={{ marginTop: "12px", background: "rgba(0, 194, 255, 0.1)", border: "1px solid rgba(0, 194, 255, 0.35)", borderRadius: "10px", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#38bdf8" }}>🎉 새로운 버전이 있어요! ({availableUpdate.version})</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>원클릭으로 최신 패치를 다운로드하고 자동 설치해요.</div>
                      </div>
                      <button
                        className="btn-main"
                        style={{ padding: "6px 14px", fontSize: "0.8rem", background: "linear-gradient(135deg, #0066FF 0%, #00C2FF 100%)", color: "white", border: "none" }}
                        onClick={handleInstallUpdate}
                        disabled={isInstallingUpdate}
                      >
                        {isInstallingUpdate ? "설치 중..." : "지금 업데이트"}
                      </button>
                    </div>
                  )}
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

                {/* 프로젝트 후원 & 파트너십 (Support & Partnership) 카드 */}
                <div className="glass-card" style={{ maxWidth: "600px", marginTop: "16px" }}>
                  <h3 className="card-title" style={{ fontSize: "1rem", marginBottom: "12px" }}>
                    <Heart size={18} color="#f43f5e" />
                    프로젝트 후원 & 파트너십 (Support & Partnership)
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {/* Buy Me a Coffee (공식 브랜드 스타일) */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255, 221, 0, 0.06)", border: "1px solid rgba(255, 221, 0, 0.25)", borderRadius: "12px", padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#FFDD00", display: "flex", alignItems: "center", justifyContent: "center", color: "#000", flexShrink: 0 }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.216 6.415l-.132-.666c-.119-.597-.388-1.156-1.01-1.378-.602-.217-1.385-.181-2.428-.181H4.636c-.954 0-1.74.032-2.348.243-.616.216-.902.776-1.026 1.381l-.872 4.417c-.366 1.849.208 3.731 1.545 5.051 1.258 1.242 3.018 1.838 4.887 1.838h8.556c1.869 0 3.629-.596 4.887-1.838 1.337-1.32 1.911-3.202 1.545-5.051l-.594-3.216zm-3.284 3.518h-2.133v-1.07h2.133v1.07zm0-2.14h-2.133V6.723h2.133v1.07zm-3.2 2.14h-2.133v-1.07h2.133v1.07zm0-2.14h-2.133V6.723h2.133v1.07zm-3.2 2.14H8.4v-1.07h2.132v1.07zm0-2.14H8.4V6.723h2.132v1.07zM23.99 8.21c-.044-.225-.13-.443-.263-.637-.216-.317-.557-.525-.951-.577l-1.082-.143.435 2.193c.196.993-.058 2.01-.699 2.788-.475.577-1.144.93-1.886 1.025l.235 1.189c1.233-.186 2.338-.828 3.092-1.777.949-1.196 1.326-2.736 1.119-4.068z" />
                          </svg>
                        </div>
                        <div>
                          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)" }}>개발자 커피 한 잔 선물하기 (Buy Me a Coffee)</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Yoonikon SyncLink의 100% 무료 운영과 지속적인 개발을 따뜻하게 응원해 주세요</div>
                        </div>
                      </div>
                      <BuyMeACoffeeOfficialButton url={SUPPORT_LINKS.buyMeACoffee} />
                    </div>

                    {/* DigitalOcean 레퍼럴 */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0, 194, 255, 0.08)", border: "1px solid rgba(0, 194, 255, 0.25)", borderRadius: "10px", padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <Cloud size={20} color="#00C2FF" />
                        <div>
                          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>DigitalOcean 클라우드 $200 무료 크레딧</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>추천 링크로 가입하고 나만의 시그널링 서버를 60일간 무료로 구축해 보세요</div>
                        </div>
                      </div>
                      <button
                        className="btn-main"
                        style={{ padding: "6px 14px", fontSize: "0.8rem", background: "linear-gradient(135deg, #0066FF 0%, #00C2FF 100%)", color: "white", border: "none", display: "flex", alignItems: "center", gap: "4px" }}
                        onClick={() => openExternalLink(SUPPORT_LINKS.digitalOcean)}
                      >
                        <span>$200 받기</span>
                        <ExternalLink size={12} />
                      </button>
                    </div>

                    {/* 광고 및 제휴 문의 */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(52, 211, 153, 0.08)", border: "1px solid rgba(52, 211, 153, 0.25)", borderRadius: "10px", padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <Mail size={20} color="#34d399" />
                        <div>
                          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>광고 게재 & 비즈니스 파트너십 제안</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>앱 내 스폰서십 광고 게재 문의: {SUPPORT_LINKS.contactEmail}</div>
                        </div>
                      </div>
                      <button
                        className="btn-main"
                        style={{ padding: "6px 14px", fontSize: "0.8rem", background: "linear-gradient(135deg, #059669 0%, #10b981 100%)", color: "white", border: "none", display: "flex", alignItems: "center", gap: "4px" }}
                        onClick={() => openExternalLink(`mailto:${SUPPORT_LINKS.contactEmail}?subject=[Yoonikon SyncLink 광고 및 파트너십 문의]`)}
                      >
                        <span>문의 메일</span>
                        <ExternalLink size={12} />
                      </button>
                    </div>
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

      {/* ─────────────────── 초기 시그널링 서버 설정 화면 (서버 주소 미설정 시) ─────────────────── */}
      {(!serverUrl || serverUrl.trim() === "") && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(6, 11, 24, 0.92)",
            backdropFilter: "blur(24px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            className="glass-card"
            style={{
              width: "480px",
              maxWidth: "92vw",
              padding: "36px 32px",
              background: "#0B132B",
              border: "1px solid rgba(0, 194, 255, 0.35)",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.9), 0 0 35px rgba(0, 102, 255, 0.2)",
              borderRadius: "20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "46px",
                  height: "46px",
                  borderRadius: "14px",
                  background: "linear-gradient(135deg, #0066FF 0%, #00C2FF 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  boxShadow: "0 0 20px rgba(0, 194, 255, 0.4)",
                  flexShrink: 0,
                }}
              >
                <Server size={24} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--text-main)" }}>Yoonikon SyncLink 서버 설정</h2>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>사설 통신망을 위한 시그널링 서버 주소를 지정해 주세요</p>
              </div>
            </div>

            <p style={{ fontSize: "0.85rem", color: "#94a3b8", lineHeight: 1.5, margin: "0 0 18px 0" }}>
              Yoonikon SyncLink는 보안과 독립성을 위해 공용 중앙 서버에 의존하지 않는 <b>100% 사설 P2P 원격 제어</b> 프로그램이에요. 통신 신호를 중계할 시그널링 서버 주소를 입력해 주세요.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const input = form.elements.namedItem("initialServerInput") as HTMLInputElement;
                if (input && input.value.trim()) {
                  let formatted = input.value.trim();
                  if (!formatted.startsWith("http://") && !formatted.startsWith("https://")) {
                    formatted = "http://" + formatted;
                  }
                  setServerUrl(formatted);
                  localStorage.setItem("synclink_server_url", formatted);
                }
              }}
            >
              <div className="input-field-group" style={{ marginBottom: "14px" }}>
                <label className="input-label" style={{ fontWeight: 600 }}>시그널링 서버 주소 (URL / IP)</label>
                <input
                  name="initialServerInput"
                  className="input-text mono"
                  placeholder="예: http://192.168.0.10:5963 또는 http://내서버:5963"
                  defaultValue=""
                  autoFocus
                  required
                  style={{ fontSize: "0.9rem", padding: "12px 14px", borderColor: "rgba(0, 194, 255, 0.4)" }}
                />
              </div>

              <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
                <button
                  type="button"
                  className="btn-main btn-secondary-dark"
                  style={{ flex: 1, padding: "8px 10px", fontSize: "0.8rem" }}
                  onClick={() => {
                    setServerUrl("http://localhost:5963");
                    localStorage.setItem("synclink_server_url", "http://localhost:5963");
                  }}
                >
                  로컬호스트 (localhost:5963)
                </button>
              </div>

              <div style={{ background: "rgba(0, 0, 0, 0.35)", borderRadius: "10px", padding: "12px", marginBottom: "22px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#60a5fa", marginBottom: "4px" }}>💡 아직 시그널링 서버가 없으신가요?</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                  개인 PC나 VPS 터미널에서 아래 명령어로 10초 만에 띄울 수 있어요:
                </div>
                <div style={{ marginTop: "6px", fontFamily: "monospace", fontSize: "0.75rem", color: "#34d399", background: "rgba(0,0,0,0.5)", padding: "6px 8px", borderRadius: "6px" }}>
                  cd signaling-server && npm install && npm start
                </div>
              </div>

              <button
                type="submit"
                className="btn-main btn-primary"
                style={{ width: "100%", padding: "12px", fontSize: "0.95rem", fontWeight: 700, borderRadius: "10px" }}
              >
                <span>서버 저장 및 시작하기</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;