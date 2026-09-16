import React from "react";
import {
  Laptop,
  Home,
  Plus,
  X,
  Sparkles,
  Columns2,
  Square,
  Sun,
  Moon,
  Wifi,
  WifiOff,
} from "lucide-react";
import { TabItem, LayoutMode } from "../types/session";

interface SessionTabBarProps {
  tabs: TabItem[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewConnection: () => void;
  layoutMode: LayoutMode;
  onToggleLayoutMode: () => void;
  onOpenAiAssistant: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  isServerConnected: boolean;
}

export const SessionTabBar: React.FC<SessionTabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewConnection,
  layoutMode,
  onToggleLayoutMode,
  onOpenAiAssistant,
  theme,
  onToggleTheme,
  isServerConnected,
}) => {
  return (
    <header className="session-tabbar-container">
      {/* 왼쪽: 브랜드 미니 로고 및 세션 탭 목록 */}
      <div className="session-tabbar-left">
        <div className="tabbar-brand" title="Yoonikon SyncLink">
          <span className="tabbar-brand-badge">SYNCLINK</span>
        </div>

        <div className="session-tabs-scroll">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isDashboard = tab.type === "dashboard";

            return (
              <div
                key={tab.id}
                className={`session-tab-item ${isActive ? "active" : ""}`}
                onClick={() => onSelectTab(tab.id)}
                title={tab.subtitle || tab.title}
              >
                <div className="tab-icon">
                  {isDashboard ? (
                    <Home size={15} />
                  ) : (
                    <Laptop size={15} className={tab.isConnected ? "text-success" : ""} />
                  )}
                </div>

                <span className="tab-title">{tab.title}</span>

                {/* 세션 상태 및 핑 표시 */}
                {!isDashboard && tab.ping !== undefined && tab.ping !== null && (
                  <span
                    className="tab-ping"
                    style={{ color: tab.ping < 50 ? "#34d399" : "#f59e0b" }}
                  >
                    {tab.ping}ms
                  </span>
                )}

                {/* 탭 닫기 버튼 (대시보드는 닫을 수 없음) */}
                {!isDashboard && (
                  <button
                    type="button"
                    className="tab-close-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                    title="세션 종료 및 탭 닫기"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            );
          })}

          {/* 새 연결 추가 버튼 */}
          <button
            type="button"
            className="tab-add-btn"
            onClick={onNewConnection}
            title="새 원격 접속 추가 (+)"
          >
            <Plus size={15} />
            <span>새 연결</span>
          </button>
        </div>
      </div>

      {/* 오른쪽: 레이아웃 모드(단일/분할) 및 유틸리티 도구 */}
      <div className="session-tabbar-right">
        {/* 나란히 2분할 뷰 토글 버튼 */}
        <button
          type="button"
          className={`tabbar-action-btn ${layoutMode === "split" ? "active" : ""}`}
          onClick={onToggleLayoutMode}
          title={
            layoutMode === "split"
              ? "단일 화면 모드로 전환 (현재 좌우 2분할 상태)"
              : "나란히 2분할(Side-by-Side Split View) 모드로 전환"
          }
        >
          {layoutMode === "split" ? <Square size={14} /> : <Columns2 size={14} />}
          <span style={{ fontWeight: 600 }}>
            {layoutMode === "split" ? "단일 화면" : "나란히 2분할"}
          </span>
          {tabs.filter((t) => t.type === "session").length >= 2 && layoutMode === "single" && (
            <span className="tabbar-recom-badge">추천</span>
          )}
        </button>

        {/* AI 클립보드 도우미 */}
        <button
          type="button"
          className="tabbar-action-btn ai-btn"
          onClick={onOpenAiAssistant}
          title="AI 스마트 클립보드 도우미 열기 (단축키: Ctrl+Space)"
        >
          <Sparkles size={14} color="#c084fc" />
          <span>AI 클립보드</span>
        </button>

        {/* 테마 토글 */}
        <button
          type="button"
          className="tabbar-icon-btn"
          onClick={onToggleTheme}
          title={`테마 전환 (${theme === "dark" ? "라이트 모드로" : "다크 모드로"})`}
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* 서버 상태 인디케이터 */}
        <div
          className="tabbar-server-indicator"
          title={isServerConnected ? "시그널링 서버 연결됨" : "서버 연결 끊김"}
        >
          {isServerConnected ? (
            <Wifi size={14} color="#34d399" />
          ) : (
            <WifiOff size={14} color="#ef4444" />
          )}
        </div>
      </div>
    </header>
  );
};
