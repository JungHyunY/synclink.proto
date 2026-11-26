import React, { useState, useEffect, useRef } from "react";
import {
  Cast,
  Lock,
  Play,
  Monitor,
  Activity,
  History,
  BookOpen,
  ArrowRight,
  X,
  Laptop,
} from "lucide-react";
import { SavedDevice, RecentDevice } from "../types/session";

interface NewSessionTabProps {
  tabId: string;
  onConnect: (targetId: string, pin: string, mode: "screen" | "flow", sourceTabId: string) => void;
  onClose: () => void;
  recentDevices: RecentDevice[];
  savedDevices: SavedDevice[];
  isConnecting: boolean;
  authError: string | null;
  isSplitView?: boolean;
}

function formatDeviceId(id: string): string {
  const digits = id.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

export const NewSessionTab: React.FC<NewSessionTabProps> = ({
  tabId,
  onConnect,
  onClose,
  recentDevices,
  savedDevices,
  isConnecting,
  authError,
  isSplitView = false,
}) => {
  const [targetId, setTargetId] = useState("");
  const [pin, setPin] = useState("");
  const [mode, setMode] = useState<"screen" | "flow">("screen");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // 자동 포커스
    inputRef.current?.focus();
  }, []);

  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 9);
    setTargetId(formatDeviceId(raw));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = targetId.replace(/\s+/g, "");
    if (!cleanId || cleanId.length < 9) {
      return;
    }
    onConnect(cleanId, pin, mode, tabId);
  };

  const handleQuickSelect = (devId: string, devPin?: string) => {
    setTargetId(formatDeviceId(devId));
    if (devPin) setPin(devPin);
    const cleanId = devId.replace(/\s+/g, "");
    if (cleanId.length === 9) {
      onConnect(cleanId, devPin || "", mode, tabId);
    }
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isSplitView ? "16px" : "32px",
        overflowY: "auto",
        background: "var(--bg-radial)",
      }}
    >
      <div
        className="glass-card"
        style={{
          width: "100%",
          maxWidth: isSplitView ? "460px" : "520px",
          padding: isSplitView ? "20px" : "28px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          animation: "fadeIn 0.2s ease-out",
        }}
      >
        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "rgba(37, 99, 235, 0.15)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Cast size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)" }}>
                새 원격 세션 연결
              </h3>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                원격 제어할 상대 PC의 ID와 PIN을 입력하세요
              </p>
            </div>
          </div>
          <button
            type="button"
            className="tabbar-icon-btn"
            onClick={onClose}
            title="새 세션 탭 닫기"
            style={{ width: "28px", height: "28px", padding: 0 }}
          >
            <X size={15} />
          </button>
        </div>

        {/* 연결 모드 선택 탭 */}
        <div className="mode-selector-pill-group" style={{ margin: 0 }}>
          <button
            type="button"
            className={`mode-pill ${mode === "screen" ? "active" : ""}`}
            onClick={() => setMode("screen")}
          >
            <Monitor size={15} />
            <span>화면 제어 (Screen)</span>
          </button>
          <button
            type="button"
            className={`mode-pill ${mode === "flow" ? "active" : ""}`}
            onClick={() => setMode("flow")}
          >
            <Activity size={15} />
            <span>SyncLink Flow (KVM)</span>
          </button>
        </div>

        {/* 에러 메시지 알림 */}
        {authError && (
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "8px",
              color: "#f87171",
              fontSize: "0.82rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>⚠️ {authError}</span>
          </div>
        )}

        {/* 입력 폼 */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="input-field-group">
            <label className="input-label">원격 기기 ID (9자리)</label>
            <div className="custom-input-wrapper">
              <Laptop className="input-icon-left" size={18} />
              <input
                ref={inputRef}
                className="custom-input mono"
                style={{ fontSize: "1.05rem", letterSpacing: "1px", fontWeight: 700 }}
                value={targetId}
                onChange={handleIdChange}
                placeholder="000 000 000"
                maxLength={11}
                disabled={isConnecting}
              />
            </div>
          </div>

          <div className="input-field-group">
            <label className="input-label">접속 비밀번호 (PIN)</label>
            <div className="custom-input-wrapper">
              <Lock className="input-icon-left" size={18} />
              <input
                type="password"
                className="custom-input mono"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="비밀번호 입력 (설정된 경우)"
                disabled={isConnecting}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-main btn-primary-glow"
            style={{ width: "100%", padding: "12px", marginTop: "4px" }}
            disabled={isConnecting || targetId.replace(/\s+/g, "").length < 9}
          >
            <Play size={18} />
            <span>{isConnecting ? "연결 시도 중..." : "원격 제어 시작"}</span>
          </button>
        </form>

        {/* 빠른 연결: 최근 접속 기기 */}
        {recentDevices.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingTop: "8px", borderTop: "1px solid var(--card-border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)" }}>
              <History size={13} />
              <span>최근 연결 기기 (클릭하여 즉시 연결)</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {recentDevices.slice(0, 4).map((dev) => (
                <button
                  key={dev.id}
                  type="button"
                  onClick={() => handleQuickSelect(dev.id, dev.pin)}
                  className="quick-pick-chip"
                  style={{
                    padding: "5px 10px",
                    borderRadius: "6px",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid var(--card-border)",
                    color: "var(--text-main)",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(37, 99, 235, 0.15)";
                    e.currentTarget.style.borderColor = "var(--primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                    e.currentTarget.style.borderColor = "var(--card-border)";
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{dev.name || formatDeviceId(dev.id)}</span>
                  <ArrowRight size={11} color="var(--primary)" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 주소록 기기 */}
        {savedDevices.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)" }}>
              <BookOpen size={13} />
              <span>주소록 기기</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {savedDevices.slice(0, 4).map((dev) => (
                <button
                  key={dev.id}
                  type="button"
                  onClick={() => handleQuickSelect(dev.id, dev.pin)}
                  className="quick-pick-chip"
                  style={{
                    padding: "5px 10px",
                    borderRadius: "6px",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid var(--card-border)",
                    color: "var(--text-main)",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(37, 99, 235, 0.15)";
                    e.currentTarget.style.borderColor = "var(--primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                    e.currentTarget.style.borderColor = "var(--card-border)";
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{dev.name}</span>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>({formatDeviceId(dev.id)})</span>
                  <ArrowRight size={11} color="var(--primary)" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
