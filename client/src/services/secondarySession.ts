import { io, Socket } from "socket.io-client";
import { RemoteSession } from "../types/session";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
  ],
};

function preferH264(sdp: string): string {
  if (!sdp) return sdp;
  const lines = sdp.split(/\r\n|\n/);
  const mVideoIndex = lines.findIndex((l) => l.startsWith("m=video "));
  if (mVideoIndex === -1) return sdp;

  const mLine = lines[mVideoIndex];
  const parts = mLine.split(" ");
  if (parts.length <= 3) return sdp;

  const header = parts.slice(0, 3);
  const payloadTypes = parts.slice(3);

  const h264Payloads: string[] = [];
  const otherPayloads: string[] = [];

  for (const pt of payloadTypes) {
    const isH264 = lines.some(
      (l) => l.startsWith(`a=rtpmap:${pt} H264/`) || l.startsWith(`a=rtpmap:${pt} h264/`)
    );
    if (isH264) {
      h264Payloads.push(pt);
    } else {
      otherPayloads.push(pt);
    }
  }

  if (h264Payloads.length === 0) return sdp;
  lines[mVideoIndex] = `${header.join(" ")} ${[...h264Payloads, ...otherPayloads].join(" ")}`;
  return lines.join("\r\n");
}

export function startSecondarySession({
  serverUrl,
  targetRoomId,
  targetPin,
  mode = "screen",
  onStream,
  onStatusChange,
  onClose,
  onPing,
}: {
  serverUrl: string;
  targetRoomId: string;
  targetPin: string;
  mode?: "screen" | "flow";
  onStream: (stream: MediaStream) => void;
  onStatusChange: (status: string) => void;
  onClose: () => void;
  onPing: (ms: number) => void;
}): {
  sessionId: string;
  getSession: () => RemoteSession;
  sendControl: (payload: any) => void;
  close: () => void;
} {
  const sessionId = `session_${targetRoomId.replace(/\s+/g, "")}_${Date.now()}`;
  let socket: Socket | null = null;
  let peer: RTCPeerConnection | null = null;
  let controlChannel: RTCDataChannel | null = null;
  let pingInterval: any = null;

  const sessionObj: RemoteSession = {
    id: sessionId,
    roomId: targetRoomId.replace(/\s+/g, ""),
    deviceName: `PC ${targetRoomId}`,
    pin: targetPin,
    mode,
    socket: null,
    peer: null,
    controlChannel: null,
    flowChannel: null,
    remoteStream: null,
    status: "Connecting...",
    ping: null,
    fps: 30,
    quality: 65,
    monitor: 0,
    isBlackScreen: false,
    guestCursor: { x: 0, y: 0, visible: false, clicking: false },
    createdAt: Date.now(),
  };

  const createPeer = (hostTargetId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peer = pc;
    sessionObj.peer = pc;

    const ctrl = pc.createDataChannel("synclink-control", { ordered: true });
    controlChannel = ctrl;
    sessionObj.controlChannel = ctrl;

    pc.ondatachannel = (e) => {
      if (e.channel.label === "synclink-control") {
        controlChannel = e.channel;
        sessionObj.controlChannel = e.channel;
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && socket?.connected) {
        socket.emit("ice-candidate", { target: hostTargetId, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      console.log(`[SecondarySession ${sessionId}] ontrack received:`, e.streams[0]);
      sessionObj.remoteStream = e.streams[0];
      sessionObj.status = "Connected";
      onStatusChange("Connected");
      onStream(e.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      console.log(`[SecondarySession ${sessionId}] WebRTC state:`, pc.connectionState);
      if (pc.connectionState === "connected") {
        sessionObj.status = "Connected";
        onStatusChange("Connected");
      } else if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        close();
      }
    };

    return pc;
  };

  // 1. 전용 Socket.io 연결
  socket = io(serverUrl, {
    transports: ["websocket", "polling"],
    timeout: 8000,
    reconnectionAttempts: 5,
  });
  sessionObj.socket = socket;

  socket.on("connect", () => {
    console.log(`[SecondarySession ${sessionId}] Socket connected:`, socket?.id);
    socket?.emit("auth-connect", {
      roomId: sessionObj.roomId,
      password: targetPin,
      mode,
    });
  });

  socket.on("auth-response", (res: any) => {
    if (res.success && res.roomId) {
      sessionObj.deviceName = res.deviceName || `PC ${res.roomId}`;
      sessionObj.status = "Authenticating WebRTC...";
      onStatusChange("Authenticating WebRTC...");
    } else {
      console.warn(`[SecondarySession ${sessionId}] Auth failed:`, res.error);
      sessionObj.status = res.error || "Auth Failed";
      onStatusChange(sessionObj.status);
      close();
    }
  });

  socket.on("offer", async (payload: any) => {
    console.log(`[SecondarySession ${sessionId}] Offer received from host:`, payload.caller);
    const pc = createPeer(payload.caller);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await pc.createAnswer();
      const prioritizedAnswer = {
        type: answer.type,
        sdp: preferH264(answer.sdp || ""),
      } as RTCSessionDescriptionInit;
      await pc.setLocalDescription(prioritizedAnswer);

      socket?.emit("answer", {
        target: payload.caller,
        caller: socket.id,
        sdp: prioritizedAnswer,
      });
    } catch (e) {
      console.error(`[SecondarySession ${sessionId}] Offer/Answer error:`, e);
    }
  });

  socket.on("ice-candidate", async (payload: any) => {
    if (peer && payload.candidate) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch (err) {
        console.warn(`[SecondarySession ${sessionId}] Add ICE candidate error:`, err);
      }
    }
  });

  socket.on("host-disconnected", () => {
    console.log(`[SecondarySession ${sessionId}] Host disconnected`);
    close();
  });

  socket.on("disconnect", () => {
    console.log(`[SecondarySession ${sessionId}] Socket disconnected`);
  });

  // Ping 측정 타이머
  pingInterval = setInterval(() => {
    if (socket?.connected) {
      const start = Date.now();
      socket.emit("ping-check", () => {
        const latency = Date.now() - start;
        sessionObj.ping = latency;
        onPing(latency);
      });
    }
  }, 2500);

  const sendControl = (payload: any) => {
    if (controlChannel && controlChannel.readyState === "open") {
      try {
        controlChannel.send(JSON.stringify(payload));
        return;
      } catch (err) {
        console.warn(`[SecondarySession ${sessionId}] DataChannel send error:`, err);
      }
    }
    if (socket && socket.connected) {
      socket.emit("control-event", {
        ...payload,
        targetRoom: sessionObj.roomId,
      });
    }
  };

  const close = () => {
    clearInterval(pingInterval);
    if (peer) {
      peer.close();
      peer = null;
    }
    if (controlChannel) {
      controlChannel.close();
      controlChannel = null;
    }
    if (socket) {
      socket.emit("guest-disconnect", { roomId: sessionObj.roomId });
      socket.disconnect();
      socket = null;
    }
    sessionObj.status = "Disconnected";
    onClose();
  };

  return {
    sessionId,
    getSession: () => sessionObj,
    sendControl,
    close,
  };
}
