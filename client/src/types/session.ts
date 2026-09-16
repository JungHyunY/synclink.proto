import { Socket } from "socket.io-client";

export interface RemoteSession {
  id: string; // e.g. "session_123456789"
  roomId: string;
  deviceName: string;
  pin: string;
  mode: "screen" | "flow";
  socket: Socket | null;
  peer: RTCPeerConnection | null;
  controlChannel: RTCDataChannel | null;
  flowChannel: RTCDataChannel | null;
  remoteStream: MediaStream | null;
  status: string;
  ping: number | null;
  fps: number;
  quality: number;
  monitor: number;
  isBlackScreen: boolean;
  guestCursor: { x: number; y: number; visible: boolean; clicking: boolean };
  createdAt: number;
}

export type LayoutMode = "single" | "split";
export type ActivePane = "left" | "right";

export interface TabItem {
  id: string; // 'dashboard' or session.id
  type: "dashboard" | "session";
  title: string;
  subtitle?: string;
  roomId?: string;
  status?: string;
  ping?: number | null;
  isConnected?: boolean;
}
