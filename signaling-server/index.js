const { Server } = require("socket.io");

const io = new Server(3001, {
  cors: { origin: "*" },
});

console.log("📡 Signaling Server running on port 3001");

// Map<roomId, { hostSocketId, password, deviceName, online }>
const rooms = new Map();

io.on("connection", (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // 1. Host 등록 (무인 접속용 PIN/비밀번호 포함)
  socket.on("register-host", ({ roomId, password, deviceName }) => {
    socket.join(roomId);
    rooms.set(roomId, {
      hostSocketId: socket.id,
      password: password || "",
      deviceName: deviceName || "Remote Host",
      online: true,
    });
    console.log(`🖥️ Host Registered -> Room ID: ${roomId} [${deviceName}]`);
    socket.emit("host-registered", { success: true, roomId });
  });

  // 2. Guest 인증 및 접속 요청
  socket.on("auth-connect", ({ roomId, password }) => {
    const room = rooms.get(roomId);
    if (!room || !room.online) {
      console.log(`❌ Auth Failed (Room not found or offline): ${roomId}`);
      socket.emit("auth-response", { 
        success: false, 
        error: "호스트가 오프라인이거나 기기 ID를 찾을 수 없어요." 
      });
      return;
    }

    if (room.password && room.password !== password) {
      console.log(`❌ Auth Failed (Wrong password) for Room: ${roomId}`);
      socket.emit("auth-response", { 
        success: false, 
        error: "비밀번호(PIN)가 일치하지 않아요." 
      });
      return;
    }

    socket.join(roomId);
    console.log(`🔑 Auth Success: Guest (${socket.id}) -> Room: ${roomId}`);
    socket.emit("auth-response", { 
      success: true, 
      roomId, 
      deviceName: room.deviceName,
      hostSocketId: room.hostSocketId 
    });

    // Host에게 새 게스트가 연결되었음을 알림
    io.to(room.hostSocketId).emit("user-connected", socket.id);
  });

  // 3. 기존 호환성용 join-room
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room: ${roomId}`);
    socket.to(roomId).emit("user-connected", socket.id);
  });

  // 4. WebRTC 시그널링
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

  // 5. 마우스 / 키보드 제어 신호 중계
  socket.on("control-event", (payload) => {
    console.log(`🎮 Control: ${payload.type} (x:${payload.x?.toFixed(2)}, y:${payload.y?.toFixed(2)}) -> Room: ${payload.targetRoom}`);
    socket.to(payload.targetRoom).emit("control-event", payload);
  });

  // 6. [신규] 클립보드 텍스트 실시간 동기화
  socket.on("clipboard-sync", (payload) => {
    console.log(`📋 Clipboard Sync -> Room: ${payload.targetRoom}`);
    socket.to(payload.targetRoom).emit("clipboard-sync", payload);
  });

  // 7. [신규] 화질 및 FPS 실시간 변경 요청
  socket.on("quality-change", (payload) => {
    console.log(`⚡ Quality Change -> Room: ${payload.targetRoom} (FPS: ${payload.fps}, Quality: ${payload.quality}%)`);
    socket.to(payload.targetRoom).emit("quality-change", payload);
  });

  // 8. [신규] RTT(지연시간) 측정을 위한 Ping
  socket.on("ping-check", (timestamp, callback) => {
    if (typeof callback === "function") {
      callback(timestamp);
    }
  });

  // 9. 연결 해제 처리
  socket.on("disconnect", () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
    for (const [roomId, room] of rooms.entries()) {
      if (room.hostSocketId === socket.id) {
        room.online = false;
        socket.to(roomId).emit("host-offline", { roomId });
        rooms.delete(roomId);
        console.log(`🛑 Host disconnected, Room closed: ${roomId}`);
      }
    }
  });
});