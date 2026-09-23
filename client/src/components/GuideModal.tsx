import React, { useState } from "react";
import {
  X,
  Server,
  Cast,
  Waves,
  Sparkles,
  Layers,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
  Laptop,
  Monitor,
  Copy,
  Check,
  ArrowRight,
} from "lucide-react";

interface GuideStep {
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  description: string;
  points: {
    icon: React.ReactNode;
    title: string;
    detail: string;
  }[];
  tip?: string;
  actionHint?: string;
  targetTab?: "connect" | "host" | "devices" | "settings";
}

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenExternalLink?: (url: string) => void;
  onNavigateTab?: (tab: "connect" | "host" | "devices" | "settings") => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({
  isOpen,
  onClose,
  onOpenExternalLink,
  onNavigateTab,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const handleFinish = () => {
    if (dontShowAgain) {
      localStorage.setItem("synclink_tutorial_seen", "true");
    }
    onClose();
  };

  const handleCopyServerCommand = () => {
    const cmd = "cd signaling-server && npm install && npm start";
    navigator.clipboard.writeText(cmd).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  };

  const steps: GuideStep[] = [
    {
      badge: "1단계 · 길잡이 서버 준비",
      badgeColor: "#8a9a5b",
      title: "시그널링 서버 (Signaling Server) 켜기",
      subtitle: "P2P 직접 연결을 안내해 줄 초경량 중계 서버가 필요합니다.",
      description:
        "SyncLink는 영상 스트리밍을 외부 서버를 거치지 않고 내 PC와 상대 PC 간 다이렉트로 통신합니다. 단, 처음에 서로를 찾기 위한 주소 교환(Signaling)용 서버 1개가 네트워크 안에 켜져 있어야 합니다.",
      points: [
        {
          icon: <Server size={18} color="#8a9a5b" />,
          title: "윈도우에서 가장 편하게 켤 때",
          detail:
            "signaling-server 폴더 안의 'start-windows.bat'을 더블 클릭하면 자동으로 필요한 패키지를 받고 5963 포트를 열어줍니다.",
        },
        {
          icon: <Laptop size={18} color="#38bdf8" />,
          title: "서버 주소 확인 및 설정",
          detail:
            "기본적으로 사내 중앙 시그널링 서버(http://183.111.166.141:5963)가 자동 설정되어 있어 별도 설정 없이 바로 이용하실 수 있습니다.",
        },
      ],
      tip: "💡 사내망 외부나 개인 환경에서 테스트할 때는 [설정] 탭에서 사내 서버 또는 '로컬 (5963)' 버튼으로 전환할 수 있습니다.",
      actionHint: "설정 탭으로 바로 가기",
      targetTab: "settings",
    },
    {
      badge: "2단계 · 내 PC 호스팅 & 상대방 연결",
      badgeColor: "#38bdf8",
      title: "내 PC 화면 공유하기 & 원격 접속",
      subtitle: "화면을 보여줄 PC와 제어할 PC를 간편하게 페어링합니다.",
      description:
        "화면을 원격 제어받을 컴퓨터에서 [내 PC 호스팅]을 켜두고, 접속할 컴퓨터에서 해당 기기 ID와 PIN 비밀번호를 입력해 접속합니다.",
      points: [
        {
          icon: <Laptop size={18} color="#8a9a5b" />,
          title: "화면 공유 PC (Host)",
          detail:
            "[내 PC 호스팅] 탭에서 '호스팅 대기 시작'을 켭니다. 화면에 표시되는 9자리 기기 ID와 4자리 PIN 번호를 확인하세요.",
        },
        {
          icon: <Cast size={18} color="#38bdf8" />,
          title: "원격 조작 PC (Guest)",
          detail:
            "[원격 접속] 탭에서 호스트 PC의 9자리 기기 ID와 PIN 번호를 넣고 '원격 접속 시작' 버튼을 누르면 1초 만에 화면이 열립니다.",
        },
      ],
      tip: "🔐 자주 접속하는 PC는 주소록(Ctrl+D)에 저장해두면 PIN 번호 없이 원클릭으로 즉시 접속할 수 있습니다.",
      actionHint: "원격 접속 탭으로 바로 가기",
      targetTab: "connect",
    },
    {
      badge: "3단계 · 두 가지 제어 모드",
      badgeColor: "#a855f7",
      title: "화면 제어 vs SyncLink Flow (가상 KVM)",
      subtitle: "사용 환경에 맞춰 최적의 동작 모드를 선택하세요.",
      description:
        "일반적인 풀스크린 원격 화면 뷰어와 마우스 하나로 양쪽 PC 모니터를 넘나드는 Flow 모드를 모두 지원합니다.",
      points: [
        {
          icon: <Monitor size={18} color="#38bdf8" />,
          title: "🖥️ 화면 제어 모드 (Remote Screen)",
          detail:
            "TeamViewer처럼 원격 PC의 실제 화면을 보면서 마우스·키보드를 조작합니다. 최대 60FPS 및 멀티 모니터 전환을 지원합니다.",
        },
        {
          icon: <Waves size={18} color="#a855f7" />,
          title: "🌊 SyncLink Flow (가상 KVM 모드)",
          detail:
            "모니터 가장자리로 마우스를 밀면 옆 PC로 스무스하게 커서가 넘어갑니다. 윈도우와 맥북을 책상에 나란히 두고 하나의 마우스/키보드로 두 PC를 동시 조작할 때 최적입니다.",
        },
      ],
      tip: "📋 실시간 클립보드 공유가 기본 활성화되어 있어 윈도우에서 Ctrl+C 복사 후 맥북에서 Cmd+V로 바로 붙여넣을 수 있습니다.",
    },
    {
      badge: "4단계 · 프로 팁 & 특수 기능",
      badgeColor: "#eab308",
      title: "AI 클립보드 & 다중 세션 분할 뷰",
      subtitle: "작업 효율을 극대화하는 SyncLink만의 고급 기능들입니다.",
      description:
        "복사한 터미널 오류 로그를 즉시 분석하고, 여러 대의 PC를 한 화면에서 탭 및 화면 분할로 동시에 관제하세요.",
      points: [
        {
          icon: <Sparkles size={18} color="#c084fc" />,
          title: "✨ AI 스마트 클립보드 (Ctrl+Space)",
          detail:
            "터미널 에러 로그를 복사(Ctrl+C)한 뒤 단축키를 누르면 Google Gemini AI가 즉시 원인을 분석하고 해결 명령어를 제안합니다.",
        },
        {
          icon: <Layers size={18} color="#34d399" />,
          title: "🪟 멀티 세션 탭 & 화면 분할 (Ctrl+T)",
          detail:
            "상단 탭 바에서 새 세션을 열어 최대 3대의 컴퓨터를 동시에 띄우거나, 좌우 2분할 뷰로 나란히 놓고 모니터링할 수 있습니다.",
        },
      ],
      tip: "💡 맥북(macOS)에서 키보드/마우스 제어가 안 될 경우 '시스템 설정 > 개인정보 보호 및 보안 > 손쉬운 사용' 권한을 허용해주세요.",
    },
  ];

  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  return (
    <div
      className="custom-dialog-overlay"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.78)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleFinish();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "680px",
          maxHeight: "92vh",
          backgroundColor: "#13161c",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "20px",
          boxShadow: "0 24px 48px rgba(0, 0, 0, 0.75)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: "#f4f4f5",
        }}
      >
        {/* 모달 상단 헤더 */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background:
              "linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0) 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "rgba(107, 127, 66, 0.22)",
                border: "1px solid rgba(107, 127, 66, 0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-glow, #a3e635)",
              }}
            >
              <HelpCircle size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "1.15rem",
                    fontWeight: 800,
                    color: "#fff",
                    letterSpacing: "-0.3px",
                  }}
                >
                  SyncLink 빠른 시작 가이드
                </h3>
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "20px",
                    background: "rgba(107, 127, 66, 0.2)",
                    border: "1px solid rgba(107, 127, 66, 0.4)",
                    color: "var(--accent-glow, #a3e635)",
                  }}
                >
                  {currentStepIndex + 1} / {steps.length}
                </span>
              </div>
              <p
                style={{
                  margin: "3px 0 0",
                  fontSize: "0.8rem",
                  color: "var(--text-muted, #94a3b8)",
                }}
              >
                P2P 초저지연 원격 제어 및 Flow 가상 KVM을 100% 활용하는 법
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleFinish}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "8px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
            title="가이드 닫기"
          >
            <X size={20} />
          </button>
        </div>

        {/* 상단 스텝 프로그레스 인디케이터 바 */}
        <div
          style={{
            display: "flex",
            gap: "6px",
            padding: "12px 24px 0",
            background: "rgba(0, 0, 0, 0.2)",
          }}
        >
          {steps.map((s, idx) => (
            <div
              key={idx}
              onClick={() => setCurrentStepIndex(idx)}
              style={{
                flex: 1,
                height: "4px",
                borderRadius: "2px",
                backgroundColor:
                  idx === currentStepIndex
                    ? "var(--accent-glow, #a3e635)"
                    : idx < currentStepIndex
                    ? "rgba(163, 230, 53, 0.4)"
                    : "rgba(255, 255, 255, 0.1)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              title={`${idx + 1}단계: ${s.title}`}
            />
          ))}
        </div>

        {/* 메인 스텝 컨텐츠 영역 */}
        <div
          style={{
            padding: "24px",
            overflowY: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          {/* 스텝 타이틀 카드 */}
          <div>
            <span
              style={{
                display: "inline-block",
                fontSize: "0.72rem",
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: "12px",
                background: "rgba(255, 255, 255, 0.08)",
                border: `1px solid ${currentStep.badgeColor}55`,
                color: currentStep.badgeColor,
                marginBottom: "8px",
              }}
            >
              {currentStep.badge}
            </span>
            <h2
              style={{
                margin: 0,
                fontSize: "1.3rem",
                fontWeight: 800,
                color: "#fff",
                letterSpacing: "-0.4px",
              }}
            >
              {currentStep.title}
            </h2>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "0.88rem",
                color: "var(--accent-glow, #a3e635)",
                fontWeight: 500,
              }}
            >
              {currentStep.subtitle}
            </p>
            <p
              style={{
                margin: "10px 0 0",
                fontSize: "0.85rem",
                lineHeight: 1.6,
                color: "#cbd5e1",
              }}
            >
              {currentStep.description}
            </p>
          </div>

          {/* 스텝 상세 포인트 박스 리스트 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {currentStep.points.map((pt, pIdx) => (
              <div
                key={pIdx}
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "14px",
                  padding: "14px 16px",
                  display: "flex",
                  gap: "14px",
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    padding: "8px",
                    borderRadius: "10px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                >
                  {pt.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: "0.92rem",
                      fontWeight: 700,
                      color: "#fff",
                      marginBottom: "4px",
                    }}
                  >
                    {pt.title}
                  </div>
                  <div
                    style={{
                      fontSize: "0.82rem",
                      lineHeight: 1.5,
                      color: "#94a3b8",
                    }}
                  >
                    {pt.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 1단계 전용 빠른 명령어 복사 블록 */}
          {currentStepIndex === 0 && (
            <div
              style={{
                background: "rgba(0, 0, 0, 0.45)",
                border: "1px solid rgba(138, 154, 91, 0.35)",
                borderRadius: "12px",
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                <span style={{ fontSize: "0.72rem", color: "#8a9a5b", fontWeight: 700 }}>
                  터미널로 서버 직접 켜기 (수동 실행)
                </span>
                <span
                  style={{
                    fontFamily: "Consolas, monospace",
                    fontSize: "0.82rem",
                    color: "#34d399",
                  }}
                >
                  cd signaling-server && npm install && npm start
                </span>
              </div>
              <button
                type="button"
                className="btn-main btn-secondary-dark"
                style={{
                  padding: "6px 12px",
                  fontSize: "0.78rem",
                  gap: "6px",
                  flexShrink: 0,
                }}
                onClick={handleCopyServerCommand}
              >
                {copiedCode ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                <span>{copiedCode ? "복사됨!" : "명령어 복사"}</span>
              </button>
            </div>
          )}

          {/* 유용한 팁 배너 */}
          {currentStep.tip && (
            <div
              style={{
                background: "rgba(107, 127, 66, 0.12)",
                border: "1px solid rgba(107, 127, 66, 0.35)",
                borderRadius: "12px",
                padding: "12px 16px",
                fontSize: "0.82rem",
                color: "#e2e8f0",
                lineHeight: 1.5,
              }}
            >
              {currentStep.tip}
            </div>
          )}

          {/* 해당 기능 탭으로 바로 이동할 수 있는 단축 액션 버튼 */}
          {currentStep.actionHint && currentStep.targetTab && onNavigateTab && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-main"
                style={{
                  background: "rgba(56, 189, 248, 0.12)",
                  border: "1px solid rgba(56, 189, 248, 0.4)",
                  color: "#38bdf8",
                  padding: "7px 14px",
                  fontSize: "0.82rem",
                  gap: "6px",
                  borderRadius: "8px",
                }}
                onClick={() => onNavigateTab(currentStep.targetTab!)}
              >
                <span>{currentStep.actionHint}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}

          {/* 마지막 4단계에서 온라인 전체 설명서 링크 제공 */}
          {isLastStep && onOpenExternalLink && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "12px",
                padding: "10px 14px",
              }}
            >
              <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                더 자세한 문제 해결 및 전체 기능 설명서가 필요하신가요?
              </span>
              <button
                type="button"
                className="btn-main btn-secondary-dark"
                style={{ padding: "6px 12px", fontSize: "0.78rem", gap: "6px" }}
                onClick={() =>
                  onOpenExternalLink(
                    "https://github.com/JungHyunY/synclink.proto/blob/main/README_KR.md"
                  )
                }
              >
                <span>온라인 설명서 보기</span>
                <ExternalLink size={13} />
              </button>
            </div>
          )}
        </div>

        {/* 모달 하단 푸터 네비게이션 */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(0, 0, 0, 0.3)",
          }}
        >
          {/* 다시 보지 않기 체크박스 */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              fontSize: "0.8rem",
              color: "#94a3b8",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              style={{
                accentColor: "var(--accent-glow, #a3e635)",
                cursor: "pointer",
                width: "14px",
                height: "14px",
              }}
            />
            <span>앱 시작 시 이 가이드 다시 보지 않기</span>
          </label>

          {/* 이전 / 다음 / 완료 버튼군 */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {!isFirstStep && (
              <button
                type="button"
                className="btn-main btn-secondary-dark"
                style={{ padding: "8px 14px", fontSize: "0.85rem", gap: "6px" }}
                onClick={() => setCurrentStepIndex((prev) => Math.max(0, prev - 1))}
              >
                <ChevronLeft size={16} />
                <span>이전</span>
              </button>
            )}

            {!isLastStep ? (
              <button
                type="button"
                className="btn-main btn-primary"
                style={{ padding: "8px 18px", fontSize: "0.85rem", gap: "6px" }}
                onClick={() =>
                  setCurrentStepIndex((prev) => Math.min(steps.length - 1, prev + 1))
                }
              >
                <span>다음 단계</span>
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="btn-main btn-primary"
                style={{
                  padding: "8px 22px",
                  fontSize: "0.85rem",
                  gap: "6px",
                  background: "var(--primary-gradient)",
                }}
                onClick={handleFinish}
              >
                <CheckCircle2 size={16} />
                <span>가이드 완료 & 시작하기</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
