const http = require("http");
const https = require("https");
const fs = require("fs");
const { Server } = require("socket.io");
const { exec } = require("child_process");
const os = require("os");

const PORT = process.env.PORT || 5963;
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || "";
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || "";

// Map<roomId, { hostSocketId, password, deviceName, online, guests }>
const rooms = new Map();

// ─── 1. 보안: 무차별 대입(Brute-Force) 방지 Rate Limiting ───
// Map<clientIp_roomId, { failedCount, lockUntil }>
const authRateLimits = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 30 * 1000; // 30초 임시 차단

function getClientIp(reqOrSocket) {
  if (reqOrSocket.handshake) {
    // Socket.io
    return (
      reqOrSocket.handshake.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      reqOrSocket.handshake.address ||
      "unknown"
    );
  }
  // HTTP req
  return (
    reqOrSocket.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    reqOrSocket.socket?.remoteAddress ||
    "unknown"
  );
}

// 주기적으로 만료된 Rate Limit 엔트리 정리 (메모리 누수 방지)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of authRateLimits.entries()) {
    if (record.lockUntil && record.lockUntil < now) {
      authRateLimits.delete(key);
    }
  }
}, 60 * 1000);

// ─── 2. STUN / TURN ICE 서버 기본 목록 및 커스텀 환경변수 제공 ───
const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

function getIceServers() {
  // 사용자가 TURN 환경변수를 지정한 경우 자동 통합
  // 예: TURN_URL="turn:turn.yoonikon.com:3478", TURN_USER="user", TURN_PASS="pass"
  if (process.env.TURN_URL) {
    const turnEntry = {
      urls: process.env.TURN_URL,
    };
    if (process.env.TURN_USER) turnEntry.username = process.env.TURN_USER;
    if (process.env.TURN_PASS) turnEntry.credential = process.env.TURN_PASS;
    return [...DEFAULT_ICE_SERVERS, turnEntry];
  }
  return DEFAULT_ICE_SERVERS;
}

// ─── OS 방화벽 인바운드 포트 자동 개방 (Linux UFW / firewalld / Windows netsh) ───
function autoOpenFirewallPort(port) {
  const platform = os.platform();
  let cmd = "";

  if (platform === "linux") {
    cmd = `(command -v ufw >/dev/null 2>&1 && ufw allow ${port}/tcp) || (command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --zone=public --add-port=${port}/tcp --permanent && firewall-cmd --reload) || (command -v iptables >/dev/null 2>&1 && iptables -I INPUT -p tcp --dport ${port} -j ACCEPT)`;
  } else if (platform === "win32") {
    cmd = `netsh advfirewall firewall add rule name="SyncLink_Signaling_${port}" dir=in action=allow protocol=TCP localport=${port}`;
  }

  if (cmd) {
    exec(cmd, (err) => {
      if (err) {
        console.log(`ℹ️ [Firewall] 자동 방화벽 개방 건너뜀 (수동 설정 또는 root/관리자 권한 필요)`);
      } else {
        console.log(`🔓 [Firewall] OS 방화벽 포트 ${port}/TCP 인바운드 허용 완료`);
      }
    });
  }
}

autoOpenFirewallPort(PORT);

// ─── HTTP / HTTPS 서버 핸들러 ───
const requestHandler = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1) Health Check
  if (req.url === "/health" || req.url === "/ping" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        status: "ok",
        service: "synclink-signaling",
        version: "1.0.18",
        roomsOnline: rooms.size,
        protocol: isHttps ? "https" : "http",
        timestamp: Date.now(),
      })
    );
    return;
  }

  // 2) ICE / STUN / TURN 목록 엔드포인트 (/ice-servers)
  if (req.url === "/ice-servers") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ iceServers: getIceServers() }));
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
};

// ─── 4. HTTPS (WSS) 자동 감지 및 인스턴스 초기화 ───
let server;
let isHttps = false;

if (
  SSL_KEY_PATH &&
  SSL_CERT_PATH &&
  fs.existsSync(SSL_KEY_PATH) &&
  fs.existsSync(SSL_CERT_PATH)
) {
  try {
    const sslOptions = {
      key: fs.readFileSync(SSL_KEY_PATH),
      cert: fs.readFileSync(SSL_CERT_PATH),
    };
    server = https.createServer(sslOptions, requestHandler);
    isHttps = true;
    console.log(`🔒 [SSL] HTTPS / WSS 보안 소켓 모드로 활성화되었습니다.`);
  } catch (sslErr) {
    console.warn(`⚠️ [SSL] 인증서 로드 실패, HTTP 모드로 폴백합니다:`, sslErr.message);
    server = http.createServer(requestHandler);
  }
} else {
  server = http.createServer(requestHandler);
}

const io = new Server(server, {
  cors: { origin: "*" },
  transports: ["websocket", "polling"],
});

server.listen(PORT, "0.0.0.0", () => {
  const protocol = isHttps ? "https" : "http";
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        ips.push(net.address);
      }
    }
  }

  console.log("\n=======================================================");
  console.log(`  🚀 Yoonikon SyncLink Signaling Server v1.0.18 [${isHttps ? "WSS/HTTPS" : "WS/HTTP"}]`);
  console.log("=======================================================");
  console.log(`  📡 [Local Host]  ${protocol}://localhost:${PORT}`);
  if (ips.length > 0) {
    ips.forEach((ip) => {
      console.log(`  🌐 [Network IP]  ${protocol}://${ip}:${PORT}`);
    });
  } else {
    console.log(`  🌐 [Network IP]  ${protocol}://0.0.0.0:${PORT}`);
  }
  console.log(`  🛡️ [Security]    PIN 5회 오류 시 ${LOCKOUT_MS / 1000}초 자동 차단`);
  console.log(`  🌐 [ICE / TURN]  ${protocol}://localhost:${PORT}/ice-servers`);
  console.log("=======================================================");
  console.log("  💡 원격 접속할 기기의 [설정] 탭에 위 주소를 입력하세요.");
  console.log("=======================================================\n");
});

io.on("connection", (socket) => {
  const clientIp = getClientIp(socket);
  console.log(`🔌 Client connected: ${socket.id} (IP: ${clientIp})`);

  // 1. Host 등록 (무인 접속용 PIN/비밀번호 포함)
  socket.on("register-host", ({ roomId, password, deviceName }) => {
    const existing = rooms.get(roomId);
    if (existing && existing.online && existing.hostSocketId !== socket.id) {
      const activeHostSocket = io.sockets.sockets.get(existing.hostSocketId);
      if (activeHostSocket && activeHostSocket.connected) {
        console.log(
          `⚠️ Host Re-registration ignored for Room ${roomId}: Active host ${existing.hostSocketId} already registered. Sub-window duplicate prevented.`
        );
        socket.emit("host-registered", {
          success: true,
          roomId,
          note: "Existing active host preserved",
        });
        return;
      }
    }

    socket.join(roomId);
    socket.data.hostedRoomId = roomId;
    rooms.set(roomId, {
      hostSocketId: socket.id,
      password: password || "",
      deviceName: deviceName || "Remote Host",
      online: true,
      guests: existing && existing.guests ? existing.guests : new Set(),
    });
    console.log(`🖥️ Host Registered -> Room ID: ${roomId} [${deviceName}]`);
    socket.emit("host-registered", { success: true, roomId });
  });

  // 2. Guest 인증 및 접속 요청 (무차별 대입 차단 적용)
  socket.on("auth-connect", ({ roomId, password, mode }) => {
    const rateLimitKey = `${clientIp}_${roomId}`;
    const limitRecord = authRateLimits.get(rateLimitKey);
    const now = Date.now();

    // 락아웃 확인
    if (limitRecord && limitRecord.lockUntil && limitRecord.lockUntil > now) {
      const remainingSec = Math.ceil((limitRecord.lockUntil - now) / 1000);
      console.log(`🚫 Auth Blocked: IP ${clientIp} is locked out for Room ${roomId} (${remainingSec}s left)`);
      socket.emit("auth-response", {
        success: false,
        error: `비밀번호 입력 5회 실패로 보안 차단되었습니다. ${remainingSec}초 후에 다시 시도해주세요.`,
      });
      return;
    }

    const room = rooms.get(roomId);
    if (!room || !room.online) {
      console.log(`❌ Auth Failed (Room not found or offline): ${roomId}`);
      socket.emit("auth-response", {
        success: false,
        error: "호스트가 오프라인이거나 기기 ID를 찾을 수 없어요.",
      });
      return;
    }

    if (room.password && room.password !== password) {
      // 실패 횟수 누적
      const currentFails = (limitRecord ? limitRecord.failedCount : 0) + 1;
      let isLocked = false;
      let lockTime = 0;

      if (currentFails >= MAX_FAILED_ATTEMPTS) {
        isLocked = true;
        lockTime = now + LOCKOUT_MS;
      }

      authRateLimits.set(rateLimitKey, {
        failedCount: currentFails,
        lockUntil: lockTime,
      });

      console.log(
        `❌ Auth Failed (Wrong PIN) -> Room: ${roomId}, IP: ${clientIp}, Fails: ${currentFails}/${MAX_FAILED_ATTEMPTS}`
      );

      const errorMsg = isLocked
        ? `비밀번호를 ${MAX_FAILED_ATTEMPTS}회 틀려 30초간 접속이 차단되었습니다.`
        : `비밀번호(PIN)가 일치하지 않아요. (실패 ${currentFails}/${MAX_FAILED_ATTEMPTS}회)`;

      socket.emit("auth-response", {
        success: false,
        error: errorMsg,
      });
      return;
    }

    // 인증 성공 시 Rate Limit 기록 초기화
    authRateLimits.delete(rateLimitKey);

    socket.join(roomId);
    socket.data.joinedRoomId = roomId;
    if (!room.guests) room.guests = new Set();
    room.guests.add(socket.id);

    console.log(
      `🔑 Auth Success: Guest (${socket.id}) -> Room: ${roomId} [Mode: ${mode || "screen"}]`
    );
    socket.emit("auth-response", {
      success: true,
      roomId,
      deviceName: room.deviceName,
      hostSocketId: room.hostSocketId,
      iceServers: getIceServers(), // P2P 수립 시 최적 ICE 목록 동봉
    });

    // Host에게 새 게스트가 연결되었음을 알림
    io.to(room.hostSocketId).emit("user-connected", {
      guestId: socket.id,
      mode: mode || "screen",
    });
  });

  // 3. 기존 호환성용 join-room
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    socket.data.joinedRoomId = roomId;
    const room = rooms.get(roomId);
    if (room) {
      if (!room.guests) room.guests = new Set();
      room.guests.add(socket.id);
    }
    console.log(`User ${socket.id} joined room: ${roomId}`);
    socket.to(roomId).emit("user-connected", socket.id);
  });

  // 4. WebRTC 시그널링 (Offer / Answer / ICE Candidate)
  socket.on("offer", (payload) => {
    console.log(`➡️ Offer: ${payload.caller} -> ${payload.target}`);
    io.to(payload.target).emit("offer", payload);
  });

  socket.on("answer", (payload) => {
    console.log(`⬅️ Answer: to ${payload.target}`);
    io.to(payload.target).emit("answer", payload);
  });

  socket.on("ice-candidate", (payload) => {
    io.to(payload.target).emit("ice-candidate", payload);
  });

  // ─── 3. 고빈도 제어 신호 최적화 ───
  // mousemove 등 고주기 스트리밍 이벤트가 서버 CPU와 대역폭을 잠식하지 않도록 필터링
  // 마우스 이동은 WebRTC P2P DataChannel로 통신하고, 시그널링 소켓으로는 비상 키/클릭 이벤트만 통과
  socket.on("control-event", (payload) => {
    if (payload && payload.type === "mousemove") {
      // mousemove는 P2P DataChannel 전용이므로 서버 릴레이에서 드롭
      return;
    }
    socket.to(payload.targetRoom).emit("control-event", payload);
  });

  // 6. 클립보드 텍스트 실시간 동기화
  socket.on("clipboard-sync", (payload) => {
    console.log(`📋 Clipboard Sync -> Room: ${payload.targetRoom}`);
    socket.to(payload.targetRoom).emit("clipboard-sync", payload);
  });

  // 7. 화질 및 FPS 실시간 변경 요청
  socket.on("quality-change", (payload) => {
    console.log(
      `⚡ Quality Change -> Room: ${payload.targetRoom} (FPS: ${payload.fps}, Quality: ${payload.quality}%)`
    );
    socket.to(payload.targetRoom).emit("quality-change", payload);
  });

  // 8. RTT(지연시간) 측정을 위한 Ping
  socket.on("ping-check", (...args) => {
    const callback = args.find((a) => typeof a === "function");
    if (typeof callback === "function") {
      const payload = args.find((a) => typeof a !== "function");
      callback(payload !== undefined ? payload : Date.now());
    }
  });

  // 9. 게스트 명시적 세션 종료 처리
  socket.on("guest-disconnect", ({ roomId }) => {
    console.log(`👋 Guest (${socket.id}) ended session for Room: ${roomId}`);
    const targetRoomId = roomId || socket.data.joinedRoomId;
    if (targetRoomId) {
      const room = rooms.get(targetRoomId);
      if (room && room.guests) {
        room.guests.delete(socket.id);
      }
      socket.to(targetRoomId).emit("guest-disconnected", { guestId: socket.id });
      socket.leave(targetRoomId);
    }
    delete socket.data.joinedRoomId;
  });

  // 10. 소켓 연결 해제 처리 (Host 또는 Guest 종료)
  socket.on("disconnect", () => {
    console.log(`❌ Client disconnected: ${socket.id}`);

    // 1) 호스트인 경우 방 정리
    for (const [roomId, room] of rooms.entries()) {
      if (room.hostSocketId === socket.id) {
        room.online = false;
        socket.to(roomId).emit("host-offline", { roomId });
        rooms.delete(roomId);
        console.log(`🛑 Host disconnected, Room closed: ${roomId}`);
      }
    }

    // 2) 게스트인 경우 세션 정리
    const joinedRoomId = socket.data.joinedRoomId;
    if (joinedRoomId) {
      const room = rooms.get(joinedRoomId);
      if (room && room.guests) {
        room.guests.delete(socket.id);
      }
      socket.to(joinedRoomId).emit("guest-disconnected", { guestId: socket.id });
      console.log(`👋 Guest (${socket.id}) disconnected from Room: ${joinedRoomId}`);
    } else {
      for (const [roomId, room] of rooms.entries()) {
        if (room.guests && room.guests.has(socket.id)) {
          room.guests.delete(socket.id);
          socket.to(roomId).emit("guest-disconnected", { guestId: socket.id });
          console.log(
            `👋 Guest (${socket.id}) disconnected from Room (guest Set match): ${roomId}`
          );
        }
      }
    }
  });
});