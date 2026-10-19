import React, { useState } from "react";
import {
  X,
  Star,
  Coffee,
  Heart,
  Copy,
  Check,
  ExternalLink,
  Coins,
  ShieldAlert,
} from "lucide-react";

export interface CryptoAddress {
  coin: string;
  name: string;
  network: string;
  address: string;
  badgeColor: string;
}

export interface SupportLinksConfig {
  githubRepo: string;
  githubSponsors: string;
  buyMeACoffee: string;
  kofi: string;
  crypto: CryptoAddress[];
}

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  links: SupportLinksConfig;
  onOpenLink: (url: string) => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({
  isOpen,
  onClose,
  links,
  onOpenLink,
}) => {
  const [copiedCoin, setCopiedCoin] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyAddress = (coin: string, address: string) => {
    navigator.clipboard.writeText(address).then(() => {
      setCopiedCoin(coin);
      setTimeout(() => {
        setCopiedCoin(null);
      }, 2000);
    });
  };

  return (
    <div
      className="custom-dialog-overlay"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "620px",
          maxHeight: "90vh",
          backgroundColor: "#18181b",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "18px",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: "#f4f4f5",
        }}
      >
        {/* 모달 헤더 */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0) 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "rgba(0, 91, 75, 0.2)",
                border: "1px solid rgba(0, 91, 75, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-glow, #a3e635)",
              }}
            >
              <Heart size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>
                SyncLink 후원 및 개발 지원
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#a1a1aa" }}>
                OmniRoute 스타일 다채널 오픈소스 지원 안내
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#a1a1aa",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#a1a1aa")}
          >
            <X size={20} />
          </button>
        </div>

        {/* 모달 본문 (스크롤) */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#d4d4d8", lineHeight: 1.5 }}>
            SyncLink는 완전 무료 오픈소스로 개발 및 배포되고 있습니다.
            보내주시는 따뜻한 응원은 서버 운영비 및 기능 고도화에 소중히 사용됩니다.
          </p>

          {/* 1. 무료 후원 (GitHub Star) */}
          <div
            style={{
              background: "rgba(234, 179, 8, 0.06)",
              border: "1px solid rgba(234, 179, 8, 0.25)",
              borderRadius: "12px",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ color: "#eab308", flexShrink: 0 }}>
                <Star size={22} fill="#eab308" />
              </div>
              <div>
                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fef08a" }}>
                  ⭐ GitHub Star (무료 후원)
                </div>
                <div style={{ fontSize: "0.78rem", color: "#a1a1aa", marginTop: "2px" }}>
                  비용 부담 없이 프로젝트 인지도와 성장에 가장 큰 힘이 됩니다.
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn-main"
              style={{
                padding: "7px 14px",
                fontSize: "0.8rem",
                background: "#eab308",
                color: "#000",
                fontWeight: 700,
                border: "none",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                flexShrink: 0,
                borderRadius: "8px",
                cursor: "pointer",
              }}
              onClick={() => onOpenLink(links.githubRepo)}
            >
              <span>Star 주기</span>
              <ExternalLink size={13} color="#000" />
            </button>
          </div>

          {/* 2. 간편 후원 플랫폼 3종 그리드 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" }}>
            {/* Buy Me a Coffee */}
            <div
              onClick={() => onOpenLink(links.buyMeACoffee)}
              style={{
                background: "rgba(255, 221, 0, 0.06)",
                border: "1px solid rgba(255, 221, 0, 0.25)",
                borderRadius: "12px",
                padding: "12px",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 221, 0, 0.12)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 221, 0, 0.06)")}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Coffee size={16} color="#ffd100" />
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ffd100" }}>Buy Me a Coffee</span>
                </div>
                <ExternalLink size={13} color="#ffd100" />
              </div>
              <p style={{ margin: "6px 0 0", fontSize: "0.75rem", color: "#a1a1aa" }}>
                커피 한 잔 응원하기
              </p>
            </div>

            {/* Ko-fi */}
            <div
              onClick={() => onOpenLink(links.kofi)}
              style={{
                background: "rgba(19, 195, 244, 0.06)",
                border: "1px solid rgba(19, 195, 244, 0.25)",
                borderRadius: "12px",
                padding: "12px",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(19, 195, 244, 0.12)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(19, 195, 244, 0.06)")}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Heart size={16} color="#13c3f4" />
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#13c3f4" }}>Ko-fi</span>
                </div>
                <ExternalLink size={13} color="#13c3f4" />
              </div>
              <p style={{ margin: "6px 0 0", fontSize: "0.75rem", color: "#a1a1aa" }}>
                수수료 없는 1회성 팁
              </p>
            </div>

            {/* GitHub Sponsors */}
            <div
              onClick={() => onOpenLink(links.githubSponsors)}
              style={{
                background: "rgba(234, 76, 137, 0.06)",
                border: "1px solid rgba(234, 76, 137, 0.25)",
                borderRadius: "12px",
                padding: "12px",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(234, 76, 137, 0.12)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(234, 76, 137, 0.06)")}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Heart size={16} color="#ea4c89" fill="#ea4c89" />
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ea4c89" }}>GitHub Sponsors</span>
                </div>
                <ExternalLink size={13} color="#ea4c89" />
              </div>
              <p style={{ margin: "6px 0 0", fontSize: "0.75rem", color: "#a1a1aa" }}>
                공식 정기/일회성 스폰서
              </p>
            </div>
          </div>

          {/* 3. 암호화폐 후원 (Crypto Multi-Chain) */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "14px",
              padding: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <Coins size={18} color="var(--accent-glow, #a3e635)" />
              <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fff" }}>
                ₿ Crypto 암호화폐 후원 (다중 체인)
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {links.crypto.map((item) => (
                <div
                  key={item.coin}
                  style={{
                    background: "rgba(0, 0, 0, 0.25)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        backgroundColor: item.badgeColor + "22",
                        color: item.badgeColor,
                        border: `1px solid ${item.badgeColor}44`,
                        flexShrink: 0,
                      }}
                    >
                      {item.coin}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "0.75rem", color: "#a1a1aa" }}>
                        {item.name} <span style={{ color: "#71717a" }}>({item.network})</span>
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          fontFamily: "monospace",
                          color: "#e4e4e7",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={item.address}
                      >
                        {item.address}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyAddress(item.coin, item.address)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      background: copiedCoin === item.coin ? "#22c55e" : "rgba(255, 255, 255, 0.08)",
                      color: copiedCoin === item.coin ? "#000" : "#fff",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      flexShrink: 0,
                      transition: "all 0.15s ease",
                    }}
                  >
                    {copiedCoin === item.coin ? (
                      <>
                        <Check size={13} />
                        <span>복사됨!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>복사</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* 암호화폐 전송 주의사항 배너 */}
            <div
              style={{
                marginTop: "12px",
                padding: "8px 12px",
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.75rem",
                color: "#fca5a5",
              }}
            >
              <ShieldAlert size={15} style={{ flexShrink: 0 }} />
              <span>반드시 각 코인의 명시된 네트워크(Network)를 확인 후 전송해 주세요.</span>
            </div>
          </div>
        </div>

        {/* 모달 푸터 */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            justifyContent: "flex-end",
            background: "rgba(0, 0, 0, 0.2)",
          }}
        >
          <button
            type="button"
            className="btn-main btn-secondary-dark"
            style={{ padding: "8px 20px", fontSize: "0.85rem", borderRadius: "8px", cursor: "pointer" }}
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
