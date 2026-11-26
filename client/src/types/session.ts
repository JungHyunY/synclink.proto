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
  id: string; // 'dashboard' or session.id or 'new_session_...'
  type: "dashboard" | "session" | "new_session";
  title: string;
  subtitle?: string;
  roomId?: string;
  status?: string;
  ping?: number | null;
  isConnected?: boolean;
}

export interface PendingNewSession {
  id: string;
  title: string;
  targetId?: string;
  targetPin?: string;
  mode?: "screen" | "flow";
}

export interface SavedDevice {
  id: string;
  name: string;
  pin?: string;
  memo?: string;
  createdAt: number;
}

export interface RecentDevice {
  id: string;
  name?: string;
  pin?: string;
  lastConnected: number;
}
