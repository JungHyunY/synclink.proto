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
  RefreshCw,
  Server,
  Edit2,
  X,
  MousePointer,
  Keyboard,
  AlertCircle,
  ExternalLink,
  Sun,
  Moon,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import "./App.css";

const DEFAULT_SERVER_URL = "";
const ICE_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// ─── 서포트 & 파트너십 링크 ───
const SUPPORT_LINKS = {
  buyMeACoffee: "https://buymeacoffee.com/tpp6347", // Buy Me a Coffee 공식 후원 링크
};

const openExternalLink = async (url: string) => {
  try {
    await openUrl(url);
    return;
  } catch (openerErr) {
    console.warn("Plugin-opener failed, trying native shell invoke:", openerErr);
  }

  try {
    await invoke("open_external_url", { url });
    return;
  } catch (invokeErr) {
    console.warn("Native shell invoke failed, trying window.open:", invokeErr);
  }

  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (winErr) {
    console.error("All URL open methods failed:", winErr);
  }
};

function normalizeServerUrl(rawUrl: string): string {
  let trimmed = rawUrl.trim();
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `http://${trimmed}`;
  }
  return trimmed.replace(/\/+$/, "");
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
  const [myDeviceName, setMyDeviceName] = useState(() => localStorage.getItem("synclink_devicename") || "");
  const [isHostingActive, setIsHostingActive] = useState(false);
  const [autoHostStandby, setAutoHostStandby] = useState<boolean>(() => localStorage.getItem("synclink_auto_standby") !== "false");
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
  const [showShortcutsMenu, setShowShortcutsMenu] = useState(false);
  const [isAutoStartEnabled, setIsAutoStartEnabled] = useState(false);

  // Dark / Light Theme State
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("synclink_theme") as "dark" | "light") || "dark";
  });

  // Virtual Remote Cursor State
  const [showVirtualCursor, setShowVirtualCursor] = useState(true);
  const [guestCursor, setGuestCursor] = useState<{ x: number; y: number; visible: boolean; clicking: boolean }>({
    x: 0,
    y: 0,
    visible: false,
    clicking: false,
  });

  // New Device Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDeviceId, setNewDeviceId] = useState("");
  const [newDevicePin, setNewDevicePin] = useState("");
  const [newDeviceMemo, setNewDeviceMemo] = useState("");

  // Edit Device State
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editingDeviceName, setEditingDeviceName] = useState("");

  // Auto-Updater State
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState<any>(null);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);

  // Server Connection Test State
  const [serverTestResult, setServerTestResult] = useState<{
    status: "idle" | "testing" | "success" | "error";
    message: string;
    latency?: number;
    details?: string;
  }>({ status: "idle", message: "" });

  const handleTestServerConnection = async (targetUrl?: string) => {
    const rawTarget = targetUrl !== undefined ? targetUrl : serverUrl;
    const cleanUrl = normalizeServerUrl(rawTarget);

    if (!cleanUrl) {
      setServerTestResult({
        status: "error",
        message: "서버 주소가 입력되지 않았어요.",
        details: "서버 주소(예: http://192.168.0.x:5963)를 먼저 입력해주세요."
      });
      return;
    }

    // localhost 검사 (macOS/타 기기 접속 시 자주 발생하는 실수 경고)
    const isLocalhost = cleanUrl.includes("localhost") || cleanUrl.includes("127.0.0.1");

    setServerTestResult({
      status: "testing",
      message: `서버(${cleanUrl})로 연결 테스트 진행 중...`
    });

    const startTime = Date.now();

    // 1단계: HTTP Health Check (/health) 테스트 (빠른 응답 및 진단)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${cleanUrl}/health`, {
        method: "GET",
        signal: controller.signal,
        headers: { "Accept": "application/json" }
      }).catch((err) => {
        throw err;
      });
      clearTimeout(timeoutId);

      if (res && res.ok) {
        const latency = Date.now() - startTime;
        let data: any = {};
        try {
          data = await res.json();
        } catch {}
        setServerTestResult({
          status: "success",
          message: `시그널링 서버 연결 성공! (지연시간: ${latency}ms)`,
          latency,
          details: `서버 버전: ${data.version || "1.0.4"} | 온라인 호스트 방: ${data.roomsOnline ?? 0}개`
        });
        return;
      }
    } catch (httpErr) {
      console.warn("HTTP Health check failed, falling back to Socket.io handshake:", httpErr);
    }

    // 2단계: Socket.io 직접 핸드셰이크 테스트
    try {
      const testSocket = io(cleanUrl, {
        transports: ["websocket", "polling"],
        timeout: 5000,
        reconnection: false,
        autoConnect: true,
      });

      const socketResult = await new Promise<{ success: boolean; latency: number; error?: string }>((resolve) => {
        const timeout = setTimeout(() => {
          testSocket.disconnect();
          resolve({ success: false, latency: 0, error: "연결 시간 초과 (Timeout 5초)" });
        }, 5000);

        testSocket.on("connect", () => {
          clearTimeout(timeout);
          const latency = Date.now() - startTime;
          testSocket.disconnect();
          resolve({ success: true, latency });
        });

        testSocket.on("connect_error", (err) => {
          clearTimeout(timeout);
          testSocket.disconnect();
          resolve({ success: false, latency: 0, error: err.message });
        });
      });

      if (socketResult.success) {
        setServerTestResult({
          status: "success",
          message: `시그널링 서버 연결 성공! (지연시간: ${socketResult.latency}ms)`,
          latency: socketResult.latency,
          details: "Socket.io 웹소켓 핸드셰이크가 정상적으로 완료되었습니다."
        });
      } else {
        let helpGuide = "서버가 켜져 있는지 확인해주세요.";
        if (isLocalhost) {
          helpGuide = "현재 주소가 'localhost'로 설정되어 있습니다! 다른 기기(Mac/다른 PC)에서 접속할 때는 서버가 실행 중인 PC의 '실제 로컬 IP(예: 192.168.0.x:5963)'나 공인 IP를 입력해야 합니다.";
        } else {
          helpGuide = "서버 PC의 방화벽(5963 포트)이 차단되어 있거나, 같은 공유기(Wi-Fi) 네트워크에 연결되어 있지 않을 수 있습니다.";
        }

        setServerTestResult({
          status: "error",
          message: `서버 연결 실패: ${socketResult.error}`,
          details: helpGuide
        });
      }
    } catch (err: any) {
      setServerTestResult({
        status: "error",
        message: `연결 시도 중 에러 발생: ${err.message || err}`,
        details: isLocalhost
          ? "다른 PC/Mac에서는 localhost 대신 서버 PC의 실제 IP를 입력하세요."
          : "IP 주소와 포트(5963) 번호, 방화벽 설정을 확인해주세요."
      });
    }
  };

  const handleCheckForUpdate = async (manual = false) => {
    try {
      setIsCheckingUpdate(true);
      let updateCheckFn: any = null;
      try {
        const updaterPkg = "@tauri-apps/plugin-updater";
        const updaterMod = await import(/* @vite-ignore */ updaterPkg);
        updateCheckFn = updaterMod.check;
      } catch (modErr) {
        console.warn("Tauri updater plugin not loaded:", modErr);
      }

      if (!updateCheckFn) {
        setIsCheckingUpdate(false);
        if (manual) alert("현재 최신 버전(v1.0.4)을 사용 중이에요! ✨");
        return;
      }

      const update = await updateCheckFn();
      setIsCheckingUpdate(false);
      if (update) {
        setAvailableUpdate(update);
      } else if (manual) {
        alert("현재 최신 버전(v1.0.4)을 사용 중이에요! ✨");
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
  const isScreenCapturingRef = useRef(false);
  const autoHostStandbyRef = useRef(autoHostStandby);
  const candidateQueue = useRef<RTCIceCandidate[]>([]);
  const activeMonitorRef = useRef(0);
  const lastClipboardTextRef = useRef("");
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const activeKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    autoHostStandbyRef.current = autoHostStandby;
    localStorage.setItem("synclink_auto_standby", autoHostStandby ? "true" : "false");
  }, [autoHostStandby]);

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

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("synclink_theme", theme);
  }, [theme]);

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

      // Fetch actual OS computer name
      try {
        const osDeviceName = await invoke<string>("get_device_name");
        const currentSaved = localStorage.getItem("synclink_devicename");
        if (osDeviceName && (!currentSaved || currentSaved === "My Workstation" || currentSaved.trim() === "")) {
          setMyDeviceName(osDeviceName);
          localStorage.setItem("synclink_devicename", osDeviceName);
        }
      } catch (err) {
        console.warn("Device name fetch error:", err);
      }

      // Check OS Autostart (Launch at startup) status
      try {
        const autostart = await invoke<boolean>("get_autostart_status");
        setIsAutoStartEnabled(autostart);
      } catch (err) {
        console.warn("Autostart status fetch error:", err);
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

  const handleToggleAutoStart = async (enabled: boolean) => {
    try {
      const res = await invoke<boolean>("set_autostart_status", { enabled });
      setIsAutoStartEnabled(res);
    } catch (err) {
      console.error("Failed to toggle autostart:", err);
      alert("자동 실행 설정 중 오류가 발생했어요: " + err);
    }
  };

  // Handle Guest Disconnection (For Host: release capture and maintain standby)
  const handleHostGuestDisconnected = async () => {
    console.log("👋 Guest disconnected (cleaning up WebRTC & screen capture)");
    peerRef.current?.close();
    peerRef.current = null;
    setIsConnected(false);
    setIsPrivacyCover(false);
    invoke("set_privacy_mode", { enabled: false }).catch(() => {});
    invoke("restore_host_window").catch(() => {});

    // Stop screen capture to conserve CPU/GPU
    if (isScreenCapturingRef.current) {
      await invoke("stop_screen_capture").catch(() => {});
      isScreenCapturingRef.current = false;
      setIsHostingActive(false);
    }

    if (autoHostStandbyRef.current) {
      isHostRef.current = true;
      setIsHostMode(false);
      setStatus("Standby");
    } else {
      isHostRef.current = false;
      setIsHostMode(false);
      setStatus("Ready");
    }
  };

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
          handleHostGuestDisconnected();
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

    const cleanUrl = normalizeServerUrl(serverUrl);
    if (!cleanUrl) {
      setIsServerConnected(false);
      return;
    }

    const socket = io(cleanUrl, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 8000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Connected to signaling server:", socket.id);
      setIsServerConnected(true);
      // Auto-register host if hosting was active or autoHostStandby is enabled
      if (isHostRef.current || autoHostStandbyRef.current) {
        if (myDeviceId && myPin) {
          socket.emit("register-host", {
            roomId: myDeviceId,
            password: myPin,
            deviceName: myDeviceName,
          });
          isHostRef.current = true;
          setStatus(autoHostStandbyRef.current ? "Standby" : "Ready");
          console.log("🖥️ Auto registered host standby for Room:", myDeviceId);
        }
      }
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected from signaling server");
      setIsServerConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.warn("⚠️ Signaling connection error:", err.message);
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
      console.log(`🔌 Guest (${userId}) connected. Starting capture & WebRTC Offer...`);
      setStatus("Guest connected. Negotiating...");

      // Start screen capture on demand if not capturing yet
      if (!isScreenCapturingRef.current) {
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
          isScreenCapturingRef.current = true;
          setIsHostingActive(true);
        } catch (err) {
          console.error("Screen capture start error on guest connect:", err);
        }
      }

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
          } else if (payload.type === "mousedown") {
            await invoke("remote_mouse_down", {
              button: payload.button || "left",
              x: payload.x,
              y: payload.y,
              monitorIndex: activeMonitorRef.current,
            });
          } else if (payload.type === "mouseup") {
            await invoke("remote_mouse_up", {
              button: payload.button || "left",
              x: payload.x,
              y: payload.y,
              monitorIndex: activeMonitorRef.current,
            });
          } else if (payload.type === "keydown" || payload.type === "keyup") {
            const state = payload.type === "keydown" ? "down" : "up";
            await invoke("remote_keyboard_event", { state, key: payload.key, code: payload.code || null });
          } else if (payload.type === "shortcut") {
            await invoke("remote_shortcut", { keys: payload.keys });
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
        handleHostGuestDisconnected();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [serverUrl, myDeviceId, myPin, myDeviceName]);

  // Keep auto-standby registration active when credentials or connection change
  useEffect(() => {
    if (!socketRef.current || !isServerConnected) return;
    if (autoHostStandby && myDeviceId && myPin) {
      socketRef.current.emit("register-host", {
        roomId: myDeviceId,
        password: myPin,
        deviceName: myDeviceName,
      });
      isHostRef.current = true;
      setStatus("Standby");
      console.log("⚡ Auto Unattended Standby registered for Room:", myDeviceId);
    }
  }, [autoHostStandby, isServerConnected, myDeviceId, myPin, myDeviceName]);

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

  // Start Hosting (Manual immediate start)
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
      isScreenCapturingRef.current = true;
    } catch (err) {
      console.error("Start host error:", err);
      setIsHostingActive(false);
      isHostRef.current = false;
      isScreenCapturingRef.current = false;
    }
  };

  // Stop Hosting (Manual stop)
  const stopHosting = async () => {
    setIsHostingActive(false);
    setIsHostMode(false);
    setIsConnected(false);
    peerRef.current?.close();
    peerRef.current = null;
    if (isScreenCapturingRef.current) {
      await invoke("stop_screen_capture").catch(() => {});
      isScreenCapturingRef.current = false;
    }
    if (autoHostStandby) {
      isHostRef.current = true;
      setStatus("Standby");
    } else {
      isHostRef.current = false;
      setStatus("Ready");
    }
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

  // Update Saved Device Name
  const updateSavedDeviceName = (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setSavedDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, name: trimmed } : d))
    );
    setRecentDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, name: trimmed } : d))
    );
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
      const v = remoteVideoRef.current;
      v.srcObject = remoteStreamRef.current;
      v.play().catch(() => {});
      v.onloadedmetadata = () => {
        v.play().catch(() => {});
      };
    }
  }, [isConnected, isHostMode]);

  // Guest Input Handlers (Full Mouse Down, Up, Drag, Right-click & Long-press Support)
  const handleRemoteInput = (e: React.MouseEvent, type: string) => {
    if (isHostRef.current) return;
    const video = (e.currentTarget.tagName === "VIDEO" ? e.currentTarget : remoteVideoRef.current) as HTMLVideoElement;
    if (!video) return;

    if (type === "mousedown" || type === "click") {
      const wrapper = video.parentElement;
      if (wrapper) wrapper.focus();
    }

    const rect = video.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // 비디오 원본 비율과 엘리먼트 크기를 기반으로 실제 영상 표시 영역(Content Box) 오차 정밀 보정
    const vWidth = video.videoWidth > 0 ? video.videoWidth : 1920;
    const vHeight = video.videoHeight > 0 ? video.videoHeight : 1080;
    const videoRatio = vWidth / vHeight;
    const elemRatio = rect.width / rect.height;

    let renderWidth = rect.width;
    let renderHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (elemRatio > videoRatio) {
      // 좌우에 검은 여백(Pillarbox)이 생긴 경우
      renderWidth = rect.height * videoRatio;
      offsetX = (rect.width - renderWidth) / 2;
    } else {
      // 상하에 검은 여백(Letterbox)이 생긴 경우
      renderHeight = rect.width / videoRatio;
      offsetY = (rect.height - renderHeight) / 2;
    }

    const clickX = e.clientX - rect.left - offsetX;
    const clickY = e.clientY - rect.top - offsetY;

    const x = Math.max(0, Math.min(1, clickX / renderWidth));
    const y = Math.max(0, Math.min(1, clickY / renderHeight));

    const buttonName = e.button === 2 ? "right" : e.button === 1 ? "middle" : "left";

    if (type === "mousemove") {
      socketRef.current?.emit("control-event", {
        targetRoom: sessionRoomId,
        type: "mousemove",
        x,
        y,
        monitorIndex: sessionMonitor,
      });
    } else if (type === "mousedown") {
      setGuestCursor((prev) => ({ ...prev, clicking: true }));
      socketRef.current?.emit("control-event", {
        targetRoom: sessionRoomId,
        type: "mousedown",
        button: buttonName,
        x,
        y,
        monitorIndex: sessionMonitor,
      });
    } else if (type === "mouseup") {
      setGuestCursor((prev) => ({ ...prev, clicking: false }));
      socketRef.current?.emit("control-event", {
        targetRoom: sessionRoomId,
        type: "mouseup",
        button: buttonName,
        x,
        y,
        monitorIndex: sessionMonitor,
      });
    } else if (type === "contextmenu") {
      e.preventDefault();
      e.stopPropagation();
      // Safe fallback if mousedown/mouseup wasn't already triggered by browser
      socketRef.current?.emit("control-event", {
        targetRoom: sessionRoomId,
        type: "click",
        button: "right",
        x,
        y,
        monitorIndex: sessionMonitor,
      });
    }
  };

  // Remote Key Event Dispatcher
  const sendRemoteKeyEvent = (type: "keydown" | "keyup", key: string, code?: string) => {
    if (isHostRef.current || !sessionRoomId) return;
    const keyToSend = key === " " ? "space" : key;
    socketRef.current?.emit("control-event", {
      targetRoom: sessionRoomId,
      type,
      key: keyToSend,
      code: code || undefined,
    });
  };

  // Remote Preset Shortcut Dispatcher (e.g., Ctrl+Alt+Del, Win, Alt+Tab)
  const sendRemoteShortcut = (keys: string[]) => {
    if (isHostRef.current || !sessionRoomId) return;
    socketRef.current?.emit("control-event", {
      targetRoom: sessionRoomId,
      type: "shortcut",
      keys,
    });
  };

  const handleKeyInput = (e: React.KeyboardEvent, type: "keydown" | "keyup") => {
    if (isHostRef.current) return;
    const isModifierCombo = e.ctrlKey || e.altKey || e.metaKey;
    const isBrowserSpecial = [
      " ", "Space", "Tab", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
      "Backspace", "Delete", "Home", "End", "PageUp", "PageDown",
      "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
    ].includes(e.key);

    if (isModifierCombo || isBrowserSpecial) {
      e.preventDefault();
      e.stopPropagation();
    }
    sendRemoteKeyEvent(type, e.key, e.code);
  };

  // Global Key Listener for Remote Control Session (Prevents focus drop & browser shortcut interception)
  useEffect(() => {
    if (!isConnected || isHostMode || !sessionRoomId) return;

    const onGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      const isModifierCombo = e.ctrlKey || e.altKey || e.metaKey;
      const isBrowserSpecial = [
        "Tab", "Escape", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
        "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Backspace", "Delete", " ", "Home", "End", "PageUp", "PageDown"
      ].includes(e.key);

      if (isModifierCombo || isBrowserSpecial) {
        e.preventDefault();
        e.stopPropagation();
      }

      activeKeysRef.current.add(e.code || e.key);
      sendRemoteKeyEvent("keydown", e.key, e.code);
    };

    const onGlobalKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      const isModifierCombo = e.ctrlKey || e.altKey || e.metaKey;
      const isBrowserSpecial = [
        "Tab", "Escape", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
        "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Backspace", "Delete", " ", "Home", "End", "PageUp", "PageDown"
      ].includes(e.key);

      if (isModifierCombo || isBrowserSpecial) {
        e.preventDefault();
        e.stopPropagation();
      }

      activeKeysRef.current.delete(e.code || e.key);
      sendRemoteKeyEvent("keyup", e.key, e.code);
    };

    const onWindowBlur = () => {
      // Release any currently held modifier/regular keys to prevent sticky keys on the host
      if (activeKeysRef.current.size > 0) {
        activeKeysRef.current.forEach((k) => {
          sendRemoteKeyEvent("keyup", k, k);
        });
        activeKeysRef.current.clear();
      }
    };

    const onGlobalMouseUp = (e: MouseEvent) => {
      setGuestCursor((prev) => ({ ...prev, clicking: false }));
      const buttonName = e.button === 2 ? "right" : e.button === 1 ? "middle" : "left";
      socketRef.current?.emit("control-event", {
        targetRoom: sessionRoomId,
        type: "mouseup",
        button: buttonName,
        monitorIndex: sessionMonitor,
      });
    };

    window.addEventListener("keydown", onGlobalKeyDown, { capture: true });
    window.addEventListener("keyup", onGlobalKeyUp, { capture: true });
    window.addEventListener("mouseup", onGlobalMouseUp);
    window.addEventListener("blur", onWindowBlur);

    return () => {
      window.removeEventListener("keydown", onGlobalKeyDown, { capture: true });
      window.removeEventListener("keyup", onGlobalKeyUp, { capture: true });
      window.removeEventListener("mouseup", onGlobalMouseUp);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [isConnected, isHostMode, sessionRoomId, sessionMonitor]);

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
          <span>⚠️ 원격 제어 및 화면 캡처 권한이 필요해요. (권한 부여 후 <strong>Cmd+Q로 앱을 재시작</strong>해야 적용됩니다)</span>
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
                src={theme === "light" ? "/assets/yoonikon_tactical_logo_light.svg" : "/assets/yoonikon_tactical_logo_dark.svg"}
                alt="Yoonikon SyncLink Logo"
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  boxShadow: "0 0 15px rgba(107, 127, 66, 0.35)",
                  border: "1px solid rgba(107, 127, 66, 0.4)",
                  objectFit: "cover",
                }}
              />
              <div>
                <h2 className="brand-title">Yoonikon SyncLink</h2>
                <span className="brand-badge" style={{ background: "rgba(107, 127, 66, 0.15)", color: "#8a9a5b", border: "1px solid rgba(107, 127, 66, 0.4)" }}>
                  TACTICAL SUITE
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
              {/* Buy Me a Coffee 공식 미니 배너 */}
              <div
                onClick={() => openExternalLink(SUPPORT_LINKS.buyMeACoffee)}
                title="개발자에게 커피 한 잔 선물하기 (Buy Me a Coffee)"
                style={{
                  background: "rgba(255, 221, 0, 0.08)",
                  border: "1px solid rgba(255, 221, 0, 0.28)",
                  borderRadius: "10px",
                  padding: "9px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  marginBottom: "8px",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 221, 0, 0.16)";
                  e.currentTarget.style.borderColor = "rgba(255, 221, 0, 0.5)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 221, 0, 0.08)";
                  e.currentTarget.style.borderColor = "rgba(255, 221, 0, 0.28)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div
                    style={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "6px",
                      background: "#FFDD00",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#000",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.216 6.415l-.132-.666c-.119-.597-.388-1.156-1.01-1.378-.602-.217-1.385-.181-2.428-.181H4.636c-.954 0-1.74.032-2.348.243-.616.216-.902.776-1.026 1.381l-.872 4.417c-.366 1.849.208 3.731 1.545 5.051 1.258 1.242 3.018 1.838 4.887 1.838h8.556c1.869 0 3.629-.596 4.887-1.838 1.337-1.32 1.911-3.202 1.545-5.051l-.594-3.216zm-3.284 3.518h-2.133v-1.07h2.133v1.07zm0-2.14h-2.133V6.723h2.133v1.07zm-3.2 2.14h-2.133v-1.07h2.133v1.07zm0-2.14h-2.133V6.723h2.133v1.07zm-3.2 2.14H8.4v-1.07h2.132v1.07zm0-2.14H8.4V6.723h2.132v1.07zM23.99 8.21c-.044-.225-.13-.443-.263-.637-.216-.317-.557-.525-.951-.577l-1.082-.143.435 2.193c.196.993-.058 2.01-.699 2.788-.475.577-1.144.93-1.886 1.025l.235 1.189c1.233-.186 2.338-.828 3.092-1.777.949-1.196 1.326-2.736 1.119-4.068z" />
                    </svg>
                  </div>
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#fef08a" }}>Buy me a coffee</span>
                </div>
                <ExternalLink size={12} color="#fef08a" style={{ opacity: 0.8 }} />
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
                        <Monitor size={20} color="#8a9a5b" />
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
                      {isHostingActive ? (
                        <span style={{ fontSize: "0.75rem", background: "rgba(239, 68, 68, 0.2)", color: "#f87171", padding: "4px 8px", borderRadius: "6px", fontWeight: "bold" }}>
                          ● 실시간 화면 송출 중
                        </span>
                      ) : autoHostStandby && isServerConnected ? (
                        <span style={{ fontSize: "0.75rem", background: "rgba(16, 185, 129, 0.2)", color: "#34d399", padding: "4px 8px", borderRadius: "6px", fontWeight: "bold" }}>
                          ● 무인 접속 대기 중
                        </span>
                      ) : (
                        <span style={{ fontSize: "0.75rem", background: "rgba(148, 163, 184, 0.2)", color: "#94a3b8", padding: "4px 8px", borderRadius: "6px", fontWeight: "bold" }}>
                          ○ 수동 모드
                        </span>
                      )}
                    </div>

                    {/* 무인 자동 대기 설정 스위치 */}
                    <div style={{
                      background: autoHostStandby ? "rgba(16, 185, 129, 0.08)" : "rgba(255, 255, 255, 0.03)",
                      border: autoHostStandby ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid var(--card-border)",
                      borderRadius: "10px",
                      padding: "12px 14px",
                      marginBottom: "14px",
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "12px",
                      transition: "all 0.2s ease",
                    }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                          <span style={{ fontSize: "0.9rem", fontWeight: 700, color: autoHostStandby ? "#34d399" : "var(--text-main)" }}>
                            ⚡ 무인 원격 접속 상시 대기 (Auto Standby)
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                          앱이 실행 중이면 [호스팅 시작] 버튼을 누르지 않아도 사전에 등록된 ID/PIN으로 외부에서 즉시 접속할 수 있어요.
                          <br />
                          <span style={{ color: "#38bdf8" }}>* 게스트가 접속하기 전까지 화면 캡처는 대기 상태로 유지되어 CPU와 배터리를 소모하지 않습니다.</span>
                        </p>
                      </div>
                      <label style={{ position: "relative", display: "inline-block", width: "42px", height: "24px", flexShrink: 0, cursor: "pointer", marginTop: "2px" }}>
                        <input
                          type="checkbox"
                          checked={autoHostStandby}
                          onChange={(e) => setAutoHostStandby(e.target.checked)}
                          style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                          position: "absolute",
                          cursor: "pointer",
                          top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: autoHostStandby ? "#10b981" : "#475569",
                          transition: ".3s",
                          borderRadius: "24px",
                        }}>
                          <span style={{
                            position: "absolute",
                            content: '""',
                            height: "18px",
                            width: "18px",
                            left: autoHostStandby ? "20px" : "3px",
                            bottom: "3px",
                            backgroundColor: "white",
                            transition: ".3s",
                            borderRadius: "50%",
                          }} />
                        </span>
                      </label>
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
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <label className="input-label" style={{ margin: 0 }}>내 컴퓨터 이름</label>
                        <button
                          type="button"
                          style={{
                            fontSize: "0.72rem",
                            color: "#8a9a5b",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "3px",
                            padding: "0 2px",
                          }}
                          onClick={async () => {
                            try {
                              const name = await invoke<string>("get_device_name");
                              if (name) {
                                setMyDeviceName(name);
                                localStorage.setItem("synclink_devicename", name);
                              }
                            } catch {}
                          }}
                          title="OS의 실제 기기 이름으로 다시 가져와요"
                        >
                          <RefreshCw size={11} />
                          <span>OS 기기 이름 불러오기</span>
                        </button>
                      </div>
                      <div className="custom-input-wrapper">
                        <Laptop className="input-icon-left" size={18} />
                        <input
                          className="custom-input"
                          value={myDeviceName}
                          onChange={(e) => setMyDeviceName(e.target.value)}
                          placeholder="OS 컴퓨터 이름"
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
                      <Monitor size={18} color="#8a9a5b" />
                      <span>원격 접속 시 주 모니터가 자동으로 공유되고, 게스트가 세션 중에 모니터를 자유롭게 바꿀 수 있어요.</span>
                    </div>

                    {!isHostingActive ? (
                      <button className="btn-main btn-primary-glow" onClick={startHosting} disabled={!isServerConnected}>
                        <Play size={18} />
                        <span>수동 화면 송출 즉시 시작</span>
                      </button>
                    ) : (
                      <button className="btn-main btn-danger-soft" onClick={stopHosting}>
                        <Square size={18} />
                        <span>화면 송출 중지하기</span>
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
                          <h3 style={{ margin: "0 0 6px 0", fontSize: "1.3rem", color: "#f87171" }}>실시간 화면 송출 중</h3>
                          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>
                            게스트가 연결되어 화면과 마우스/키보드가 실시간 동기화되고 있어요.
                          </p>
                        </div>
                      </div>
                    ) : autoHostStandby && isServerConnected ? (
                      <div className="host-active-box" style={{ width: "100%" }}>
                        <div className="radar-wrapper">
                          <div className="radar-pulse" style={{ borderColor: "rgba(16, 185, 129, 0.5)" }} />
                          <div className="radar-core" style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)", boxShadow: "0 0 25px rgba(16, 185, 129, 0.5)" }}>
                            <Shield size={32} color="#ffffff" />
                          </div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <h3 style={{ margin: "0 0 6px 0", fontSize: "1.3rem", color: "#34d399" }}>무인 접속 대기 중</h3>
                          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: "0 0 8px 0" }}>
                            외부에서 ID <b>{formatDeviceId(myDeviceId)}</b> 와 PIN으로 언제든 바로 접속할 수 있어요.
                          </p>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                            (접속 전에는 화면 캡처가 정지되어 있어 CPU/배터리 소모 0%)
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-dim)" }}>
                        <Laptop size={48} style={{ opacity: 0.3, marginBottom: "12px" }} />
                        <p style={{ margin: 0 }}>무인 접속 대기를 켜거나 호스팅을 시작하면 외부 접속을 수신해요.</p>
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
                            {editingDeviceId === dev.id ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                                <input
                                  className="custom-input"
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: "0.9rem",
                                    fontWeight: 700,
                                    borderRadius: "6px",
                                    width: "170px",
                                    border: "1px solid var(--primary)",
                                    background: "rgba(0,0,0,0.5)",
                                    color: "var(--text-main)",
                                  }}
                                  value={editingDeviceName}
                                  onChange={(e) => setEditingDeviceName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      updateSavedDeviceName(dev.id, editingDeviceName);
                                      setEditingDeviceId(null);
                                    } else if (e.key === "Escape") {
                                      setEditingDeviceId(null);
                                    }
                                  }}
                                  autoFocus
                                />
                                <button
                                  className="btn-icon-only"
                                  style={{ padding: "4px" }}
                                  onClick={() => {
                                    updateSavedDeviceName(dev.id, editingDeviceName);
                                    setEditingDeviceId(null);
                                  }}
                                  title="이름 저장"
                                >
                                  <Check size={16} color="#34d399" />
                                </button>
                                <button
                                  className="btn-icon-only"
                                  style={{ padding: "4px" }}
                                  onClick={() => setEditingDeviceId(null)}
                                  title="취소"
                                >
                                  <X size={16} color="#94a3b8" />
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                                <h4 className="device-name" style={{ margin: 0 }}>{dev.name}</h4>
                                <button
                                  className="btn-icon-only"
                                  style={{ padding: "2px 4px", opacity: 0.7, cursor: "pointer" }}
                                  onClick={() => {
                                    setEditingDeviceId(dev.id);
                                    setEditingDeviceName(dev.name);
                                  }}
                                  title="기기 이름 변경하기"
                                >
                                  <Edit2 size={13} color="#8a9a5b" />
                                </button>
                              </div>
                            )}
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
                    <div style={{ display: "flex", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
                      <button
                        className="btn-main btn-secondary-dark"
                        style={{ padding: "6px 12px", fontSize: "0.8rem", color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.4)" }}
                        onClick={() => handleTestServerConnection()}
                        disabled={serverTestResult.status === "testing"}
                      >
                        {serverTestResult.status === "testing" ? (
                          <>
                            <RefreshCw size={13} className="spin" style={{ marginRight: "4px" }} />
                            연결 확인 중...
                          </>
                        ) : (
                          <>
                            <Zap size={13} style={{ marginRight: "4px" }} />
                            서버 연결 테스트
                          </>
                        )}
                      </button>
                      <button className="btn-main btn-secondary-dark" style={{ padding: "6px 12px", fontSize: "0.8rem" }} onClick={() => setServerUrl("http://localhost:5963")}>
                        로컬호스트 (5963)
                      </button>
                      <button
                        className="btn-main btn-secondary-dark"
                        style={{ padding: "6px 12px", fontSize: "0.8rem", color: "#fca5a5" }}
                        onClick={() => {
                          setServerUrl("");
                          localStorage.removeItem("synclink_server_url");
                          setServerTestResult({ status: "idle", message: "" });
                        }}
                        title="서버 주소를 초기화하고 초기 설정 화면으로 돌아가요"
                      >
                        서버 설정 초기화
                      </button>
                    </div>

                    {/* Server Connection Test Diagnostic Card */}
                    {serverTestResult.status !== "idle" && (
                      <div
                        style={{
                          marginTop: "10px",
                          padding: "10px 14px",
                          borderRadius: "8px",
                          fontSize: "0.82rem",
                          border:
                            serverTestResult.status === "success"
                              ? "1px solid rgba(74, 222, 128, 0.4)"
                              : serverTestResult.status === "error"
                              ? "1px solid rgba(248, 113, 113, 0.4)"
                              : "1px solid rgba(56, 189, 248, 0.4)",
                          background:
                            serverTestResult.status === "success"
                              ? "rgba(34, 197, 94, 0.08)"
                              : serverTestResult.status === "error"
                              ? "rgba(239, 68, 68, 0.08)"
                              : "rgba(56, 189, 248, 0.08)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "bold" }}>
                          {serverTestResult.status === "testing" && <RefreshCw size={14} className="spin" color="#38bdf8" />}
                          {serverTestResult.status === "success" && <Check size={14} color="#4ade80" />}
                          {serverTestResult.status === "error" && <AlertCircle size={14} color="#f87171" />}
                          <span
                            style={{
                              color:
                                serverTestResult.status === "success"
                                  ? "#4ade80"
                                  : serverTestResult.status === "error"
                                  ? "#f87171"
                                  : "#38bdf8",
                            }}
                          >
                            {serverTestResult.message}
                          </span>
                        </div>
                        {serverTestResult.details && (
                          <div style={{ marginTop: "4px", color: "var(--text-muted)", fontSize: "0.78rem", lineHeight: "1.4" }}>
                            {serverTestResult.details}
                          </div>
                        )}
                      </div>
                    )}
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

                  <div className="input-field-group" style={{ marginTop: "12px" }}>
                    <label className="input-label">무인 원격 접속 상시 대기</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <input
                        type="checkbox"
                        id="autoStandbySetting"
                        checked={autoHostStandby}
                        onChange={(e) => setAutoHostStandby(e.target.checked)}
                        style={{ accentColor: "var(--primary)" }}
                      />
                      <label htmlFor="autoStandbySetting" style={{ fontSize: "0.9rem", color: "var(--text-main)", cursor: "pointer" }}>
                        앱 실행 시 백그라운드에서 자동으로 호스트 대기 상태를 유지해요 (수동 버튼 클릭 없이 외부 접속 허용)
                      </label>
                    </div>
                  </div>

                  <div className="input-field-group" style={{ marginTop: "12px" }}>
                    <label className="input-label">시스템 시작 시 자동 실행 (부팅 시 자동 시작)</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <input
                        type="checkbox"
                        id="autoStartSetting"
                        checked={isAutoStartEnabled}
                        onChange={(e) => handleToggleAutoStart(e.target.checked)}
                        style={{ accentColor: "var(--primary)" }}
                      />
                      <label htmlFor="autoStartSetting" style={{ fontSize: "0.9rem", color: "var(--text-main)", cursor: "pointer" }}>
                        컴퓨터를 켤 때 Synclink가 백그라운드에서 자동으로 시작되어 상시 원격 접속이 가능해요
                      </label>
                    </div>
                  </div>

                  {/* 테마 설정 (다크 모드 / 라이트 모드) */}
                  <div className="input-field-group" style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--card-border)" }}>
                    <label className="input-label">화면 테마 (Dark / Light Theme)</label>
                    <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                      <button
                        type="button"
                        className="btn-main"
                        style={{
                          flex: 1,
                          padding: "10px 14px",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          borderRadius: "10px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          background: theme === "dark" ? "var(--primary-gradient)" : "var(--input-bg)",
                          color: theme === "dark" ? "#ffffff" : "var(--text-muted)",
                          border: theme === "dark" ? "1px solid var(--primary)" : "1px solid var(--card-border)",
                          boxShadow: theme === "dark" ? "var(--shadow-glow)" : "none",
                        }}
                        onClick={() => setTheme("dark")}
                      >
                        <Moon size={16} />
                        <span>다크 모드 (Dark HUD)</span>
                      </button>
                      <button
                        type="button"
                        className="btn-main"
                        style={{
                          flex: 1,
                          padding: "10px 14px",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          borderRadius: "10px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          background: theme === "light" ? "var(--primary-gradient)" : "var(--input-bg)",
                          color: theme === "light" ? "#ffffff" : "var(--text-muted)",
                          border: theme === "light" ? "1px solid var(--primary)" : "1px solid var(--card-border)",
                          boxShadow: theme === "light" ? "var(--shadow-glow)" : "none",
                        }}
                        onClick={() => setTheme("light")}
                      >
                        <Sun size={16} />
                        <span>라이트 모드 (Light Clean)</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 앱 버전 및 소프트웨어 업데이트 카드 */}
                <div className="glass-card" style={{ maxWidth: "600px", marginTop: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <h3 className="card-title" style={{ fontSize: "1rem", marginBottom: "4px" }}>
                        <Shield size={18} color="#818cf8" />
                        버전 및 업데이트
                      </h3>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                        Yoonikon SyncLink <b>v1.0.4</b> (Native Desktop)
                      </div>
                    </div>
                    <button
                      className="btn-main btn-secondary-dark"
                      style={{ padding: "6px 12px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "6px" }}
                      onClick={() => handleCheckForUpdate(true)}
                      disabled={isCheckingUpdate}
                    >
                      <RefreshCw size={13} className={isCheckingUpdate ? "spin" : ""} />
                      <span>{isCheckingUpdate ? "확인 중..." : "업데이트 확인"}</span>
                    </button>
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
                        style={{ padding: "6px 14px", fontSize: "0.8rem", background: "linear-gradient(135deg, #6b7f42 0%, #8a9a5b 100%)", color: "white", border: "none" }}
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
                    <Server size={18} color="#34d399" />
                    나만의 시그널링 서버 셀프 호스팅 (Self-Hosted)
                  </h3>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5, margin: "0 0 12px 0" }}>
                    개인 VPS 또는 홈 서버에 직접 시그널링 서버를 띄워 독립적인 사설 원격망을 운영할 수 있어요.
                    리눅스 터미널에서 아래 명령어를 실행하면 <b>자동 설치 및 백그라운드 구동</b>이 완료됩니다.
                  </p>
                  <div style={{ background: "rgba(0,0,0,0.4)", padding: "10px 14px", borderRadius: "8px", fontFamily: "monospace", fontSize: "0.75rem", color: "#8a9a5b", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                    <span style={{ wordBreak: "break-all" }}>curl -fsSL https://raw.githubusercontent.com/JungHyunY/synclink.proto/main/signaling-server/install.sh | sudo bash</span>
                    <button
                      className="btn-icon-only"
                      onClick={() => copyToClipboard("curl -fsSL https://raw.githubusercontent.com/JungHyunY/synclink.proto/main/signaling-server/install.sh | sudo bash")}
                      title="리눅스 원클릭 자동 설치 명령어 복사"
                    >
                      {copiedNotification ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                {/* Buy Me a Coffee 공식 후원 배너 */}
                <div
                  className="glass-card"
                  style={{
                    maxWidth: "600px",
                    marginTop: "16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "16px",
                    background: "rgba(255, 221, 0, 0.05)",
                    border: "1px solid rgba(255, 221, 0, 0.25)",
                    cursor: "pointer",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                  onClick={() => openExternalLink(SUPPORT_LINKS.buyMeACoffee)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 221, 0, 0.1)";
                    e.currentTarget.style.borderColor = "rgba(255, 221, 0, 0.45)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 221, 0, 0.05)";
                    e.currentTarget.style.borderColor = "rgba(255, 221, 0, 0.25)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                  title="Buy Me a Coffee 후원 페이지 열기"
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "10px",
                        background: "#FFDD00",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#000",
                        flexShrink: 0,
                        boxShadow: "0 2px 8px rgba(255, 221, 0, 0.35)",
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.216 6.415l-.132-.666c-.119-.597-.388-1.156-1.01-1.378-.602-.217-1.385-.181-2.428-.181H4.636c-.954 0-1.74.032-2.348.243-.616.216-.902.776-1.026 1.381l-.872 4.417c-.366 1.849.208 3.731 1.545 5.051 1.258 1.242 3.018 1.838 4.887 1.838h8.556c1.869 0 3.629-.596 4.887-1.838 1.337-1.32 1.911-3.202 1.545-5.051l-.594-3.216zm-3.284 3.518h-2.133v-1.07h2.133v1.07zm0-2.14h-2.133V6.723h2.133v1.07zm-3.2 2.14h-2.133v-1.07h2.133v1.07zm0-2.14h-2.133V6.723h2.133v1.07zm-3.2 2.14H8.4v-1.07h2.132v1.07zm0-2.14H8.4V6.723h2.132v1.07zM23.99 8.21c-.044-.225-.13-.443-.263-.637-.216-.317-.557-.525-.951-.577l-1.082-.143.435 2.193c.196.993-.058 2.01-.699 2.788-.475.577-1.144.93-1.886 1.025l.235 1.189c1.233-.186 2.338-.828 3.092-1.777.949-1.196 1.326-2.736 1.119-4.068z" />
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fef08a" }}>
                        개발자에게 커피 한 잔 선물하기
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                        SyncLink의 무료 운영과 오픈소스 개발을 따뜻하게 응원해 주세요
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn-main"
                    style={{
                      padding: "6px 14px",
                      fontSize: "0.8rem",
                      background: "#FFDD00",
                      color: "#000",
                      fontWeight: 700,
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      flexShrink: 0,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openExternalLink(SUPPORT_LINKS.buyMeACoffee);
                    }}
                  >
                    <span>Buy me a coffee</span>
                    <ExternalLink size={13} color="#000" />
                  </button>
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

                {/* 원격 마우스 커서 표시 토글 */}
                <button
                  className={`toolbar-btn ${showVirtualCursor ? "active" : ""}`}
                  onClick={() => setShowVirtualCursor(!showVirtualCursor)}
                  title="원격 마우스 포인터 표시 On/Off"
                >
                  <MousePointer size={14} color={showVirtualCursor ? "#38bdf8" : "#94a3b8"} />
                  <span>{showVirtualCursor ? "커서 On" : "커서 Off"}</span>
                </button>

                {/* 원격 단축키 퀵 전송 메뉴 */}
                <div style={{ position: "relative" }}>
                  <button
                    className={`toolbar-btn ${showShortcutsMenu ? "active" : ""}`}
                    onClick={() => setShowShortcutsMenu(!showShortcutsMenu)}
                    title="단축키 퀵 전송 메뉴"
                  >
                    <Keyboard size={14} />
                    <span>단축키</span>
                  </button>

                  {showShortcutsMenu && (
                    <div
                      className="glass-card"
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        marginTop: "8px",
                        padding: "6px",
                        width: "210px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        zIndex: 10001,
                        background: "rgba(15, 23, 42, 0.96)",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        borderRadius: "10px",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.6)",
                      }}
                    >
                      <button
                        className="shortcut-item-btn"
                        onClick={() => {
                          sendRemoteShortcut(["control", "alt", "delete"]);
                          setShowShortcutsMenu(false);
                        }}
                      >
                        <span className="shortcut-key">Ctrl + Alt + Del</span>
                        <span className="shortcut-desc">보안 화면</span>
                      </button>
                      <button
                        className="shortcut-item-btn"
                        onClick={() => {
                          sendRemoteShortcut(["meta"]);
                          setShowShortcutsMenu(false);
                        }}
                      >
                        <span className="shortcut-key">Win (시작)</span>
                        <span className="shortcut-desc">시작 메뉴</span>
                      </button>
                      <button
                        className="shortcut-item-btn"
                        onClick={() => {
                          sendRemoteShortcut(["meta", "d"]);
                          setShowShortcutsMenu(false);
                        }}
                      >
                        <span className="shortcut-key">Win + D</span>
                        <span className="shortcut-desc">바탕화면</span>
                      </button>
                      <button
                        className="shortcut-item-btn"
                        onClick={() => {
                          sendRemoteShortcut(["alt", "tab"]);
                          setShowShortcutsMenu(false);
                        }}
                      >
                        <span className="shortcut-key">Alt + Tab</span>
                        <span className="shortcut-desc">작업 전환</span>
                      </button>
                      <button
                        className="shortcut-item-btn"
                        onClick={() => {
                          sendRemoteShortcut(["control", "shift", "escape"]);
                          setShowShortcutsMenu(false);
                        }}
                      >
                        <span className="shortcut-key">Ctrl+Shift+Esc</span>
                        <span className="shortcut-desc">작업 관리자</span>
                      </button>
                      <button
                        className="shortcut-item-btn"
                        onClick={() => {
                          sendRemoteShortcut(["alt", "f4"]);
                          setShowShortcutsMenu(false);
                        }}
                      >
                        <span className="shortcut-key">Alt + F4</span>
                        <span className="shortcut-desc">창 닫기</span>
                      </button>
                      <button
                        className="shortcut-item-btn"
                        onClick={() => {
                          sendRemoteShortcut(["hangulmode"]);
                          setShowShortcutsMenu(false);
                        }}
                      >
                        <span className="shortcut-key">한/영 전환</span>
                        <span className="shortcut-desc">언어 변경</span>
                      </button>
                    </div>
                  )}
                </div>

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
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleRemoteInput(e, "contextmenu");
                }}
                onMouseEnter={() => setGuestCursor((prev) => ({ ...prev, visible: true }))}
                onMouseLeave={() => setGuestCursor((prev) => ({ ...prev, visible: false, clicking: false }))}
                onMouseDown={(e) => {
                  if (e.target !== remoteVideoRef.current) {
                    handleRemoteInput(e, "mousedown");
                  }
                }}
                onMouseUp={(e) => {
                  if (e.target !== remoteVideoRef.current) {
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
                  if (e.target !== remoteVideoRef.current) {
                    handleRemoteInput(e, "mousemove");
                  }
                }}
                style={{ cursor: showVirtualCursor ? "none" : "default" }}
              >
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  muted
                  onMouseDown={(e) => handleRemoteInput(e, "mousedown")}
                  onMouseUp={(e) => handleRemoteInput(e, "mouseup")}
                  onMouseMove={(e) => handleRemoteInput(e, "mousemove")}
                  onContextMenu={(e) => handleRemoteInput(e, "contextmenu")}
                  style={{ cursor: showVirtualCursor ? "none" : "default" }}
                />

                {/* 🎯 선명한 원격 마우스 커서 오버레이 (Virtual Remote Cursor) */}
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
                          left: "-8px",
                          top: "-8px",
                          width: "16px",
                          height: "16px",
                          borderRadius: "50%",
                          background: "rgba(56, 189, 248, 0.45)",
                          border: "2px solid #38bdf8",
                          pointerEvents: "none",
                        }}
                      />
                    )}
                  </div>
                )}
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
                  background: "linear-gradient(135deg, #6b7f42 0%, #8a9a5b 100%)",
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
                  const formatted = normalizeServerUrl(input.value.trim());
                  setServerUrl(formatted);
                  localStorage.setItem("synclink_server_url", formatted);
                }
              }}
            >
              <div className="input-field-group" style={{ marginBottom: "14px" }}>
                <label className="input-label" style={{ fontWeight: 600 }}>시그널링 서버 주소 (URL / IP)</label>
                <input
                  id="initialServerInput"
                  name="initialServerInput"
                  className="input-text mono"
                  placeholder="예: http://192.168.0.10:5963 또는 http://내서버:5963"
                  defaultValue=""
                  autoFocus
                  required
                  style={{ fontSize: "0.9rem", padding: "12px 14px", borderColor: "rgba(0, 194, 255, 0.4)" }}
                />
              </div>

              <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn-main btn-secondary-dark"
                  style={{ flex: 1, padding: "8px 10px", fontSize: "0.8rem", color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.4)" }}
                  onClick={() => {
                    const input = document.getElementById("initialServerInput") as HTMLInputElement;
                    if (input) handleTestServerConnection(input.value);
                  }}
                  disabled={serverTestResult.status === "testing"}
                >
                  {serverTestResult.status === "testing" ? (
                    <>
                      <RefreshCw size={13} className="spin" style={{ marginRight: "4px" }} />
                      연결 확인 중...
                    </>
                  ) : (
                    <>
                      <Zap size={13} style={{ marginRight: "4px" }} />
                      서버 연결 테스트
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="btn-main btn-secondary-dark"
                  style={{ flex: 1, padding: "8px 10px", fontSize: "0.8rem" }}
                  onClick={() => {
                    const input = document.getElementById("initialServerInput") as HTMLInputElement;
                    if (input) input.value = "http://localhost:5963";
                    setServerUrl("http://localhost:5963");
                    localStorage.setItem("synclink_server_url", "http://localhost:5963");
                  }}
                >
                  로컬호스트 (5963)
                </button>
              </div>

              {/* 연결 테스트 결과 알림 */}
              {serverTestResult.status !== "idle" && (
                <div
                  style={{
                    marginBottom: "14px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontSize: "0.82rem",
                    border:
                      serverTestResult.status === "success"
                        ? "1px solid rgba(74, 222, 128, 0.4)"
                        : serverTestResult.status === "error"
                        ? "1px solid rgba(248, 113, 113, 0.4)"
                        : "1px solid rgba(56, 189, 248, 0.4)",
                    background:
                      serverTestResult.status === "success"
                        ? "rgba(34, 197, 94, 0.08)"
                        : serverTestResult.status === "error"
                        ? "rgba(239, 68, 68, 0.08)"
                        : "rgba(56, 189, 248, 0.08)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "bold" }}>
                    {serverTestResult.status === "testing" && <RefreshCw size={14} className="spin" color="#38bdf8" />}
                    {serverTestResult.status === "success" && <Check size={14} color="#4ade80" />}
                    {serverTestResult.status === "error" && <AlertCircle size={14} color="#f87171" />}
                    <span
                      style={{
                        color:
                          serverTestResult.status === "success"
                            ? "#4ade80"
                            : serverTestResult.status === "error"
                            ? "#f87171"
                            : "#38bdf8",
                      }}
                    >
                      {serverTestResult.message}
                    </span>
                  </div>
                  {serverTestResult.details && (
                    <div style={{ marginTop: "4px", color: "var(--text-muted)", fontSize: "0.78rem", lineHeight: "1.4" }}>
                      {serverTestResult.details}
                    </div>
                  )}
                </div>
              )}

              <div style={{ background: "rgba(0, 0, 0, 0.35)", borderRadius: "10px", padding: "12px", marginBottom: "22px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#8a9a5b", marginBottom: "4px" }}>💡 아직 시그널링 서버가 없으신가요?</div>
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