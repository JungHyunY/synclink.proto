#!/usr/bin/env bash
# ==============================================================================
# Yoonikon SyncLink - Linux Signaling Server One-Click Installer & Daemon Setup
# ==============================================================================
set -e

GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

echo -e "${BLUE}======================================================${NC}"
echo -e "${GREEN}  🚀 Yoonikon SyncLink 시그널링 서버 원클릭 자동 설치기  ${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. Root 권한 확인
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}❌ 관리자(root) 권한으로 실행해 주세요.${NC}"
  echo -e "   사용 예: sudo bash install.sh 또는 curl -sSL ... | sudo bash"
  exit 1
fi

INSTALL_DIR="/opt/synclink-server"
SERVICE_NAME="synclink-server"
PORT=5963

# 2. 패키지 관리자 및 Node.js 확인
echo -e "\n${YELLOW}[1/5] 시스템 패키지 및 Node.js 환경 확인 중...${NC}"
if ! command -v node >/dev/null 2>&1; then
  echo -e "Node.js가 설치되어 있지 않습니다. 최신 Node.js LTS를 자동으로 설치합니다..."
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y
    apt-get install -y curl ca-certificates gnupg
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  elif command -v dnf >/dev/null 2>&1; then
    dnf module enable -y nodejs:20
    dnf install -y nodejs
  elif command -v yum >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    yum install -y nodejs
  else
    echo -e "${RED}❌ 지원되는 패키지 관리자(apt, dnf, yum)를 찾을 수 없습니다. Node.js를 수동으로 설치해 주세요.${NC}"
    exit 1
  fi
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js 감지 완료:${NC} ${NODE_VERSION}"

# 3. 설치 디렉토리 생성 및 서버 코드 다운로드/배치
echo -e "\n${YELLOW}[2/5] 서버 파일 배치 중 (${INSTALL_DIR})...${NC}"
mkdir -p "${INSTALL_DIR}"

GITHUB_RAW="https://raw.githubusercontent.com/JungHyunY/synclink.proto/main/signaling-server"

# 현재 스크립트와 같은 위치에 index.js가 있으면 로컬 복사, 없으면 GitHub에서 다운로드
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo "")"
if [ -f "${SCRIPT_DIR}/index.js" ] && [ -f "${SCRIPT_DIR}/package.json" ]; then
  echo "로컬 파일로부터 복사합니다..."
  cp "${SCRIPT_DIR}/index.js" "${INSTALL_DIR}/"
  cp "${SCRIPT_DIR}/package.json" "${INSTALL_DIR}/"
else
  echo "GitHub 원격 저장소에서 최신 코드를 다운로드합니다..."
  curl -fsSL "${GITHUB_RAW}/index.js" -o "${INSTALL_DIR}/index.js"
  curl -fsSL "${GITHUB_RAW}/package.json" -o "${INSTALL_DIR}/package.json"
fi

# 4. 의존성 설치
echo -e "\n${YELLOW}[3/5] Node.js 의존성 모듈 설치 중...${NC}"
cd "${INSTALL_DIR}"
npm install --omit=dev --silent
echo -e "${GREEN}✓ 의존성 모듈 설치 완료${NC}"

# 5. 방화벽 포트(5963/TCP) 자동 개방
echo -e "\n${YELLOW}[4/5] OS 방화벽 포트 (${PORT}/TCP) 개방 중...${NC}"
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow ${PORT}/tcp
  echo -e "${GREEN}✓ UFW 방화벽에 포트 ${PORT}/tcp 허용 완료${NC}"
elif command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
  firewall-cmd --zone=public --add-port=${PORT}/tcp --permanent
  firewall-cmd --reload
  echo -e "${GREEN}✓ firewalld에 포트 ${PORT}/tcp 허용 완료${NC}"
elif command -v iptables >/dev/null 2>&1; then
  iptables -I INPUT -p tcp --dport ${PORT} -j ACCEPT
  echo -e "${GREEN}✓ iptables에 포트 ${PORT}/tcp 허용 완료${NC}"
else
  echo -e "알려진 활성 방화벽이 없습니다 (클라우드 인스턴스 보안그룹 인바운드 규칙에서 ${PORT} 포트를 열어주세요)."
fi

# 6. Systemd 백그라운드 서비스 등록 및 시작
echo -e "\n${YELLOW}[5/5] Systemd 백그라운드 상시 서비스 등록 중...${NC}"
NODE_PATH=$(command -v node)

cat <<EOF > /etc/systemd/system/${SERVICE_NAME}.service
[Unit]
Description=Yoonikon SyncLink WebRTC Signaling Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=${NODE_PATH} ${INSTALL_DIR}/index.js
Restart=always
RestartSec=5
Environment=PORT=${PORT}
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl restart ${SERVICE_NAME}

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}  🎉 SyncLink 시그널링 서버 설치 및 구동이 완료되었습니다!  ${NC}"
echo -e "${GREEN}======================================================${NC}"
echo -e "• 서비스 상태 : ${GREEN}Active (실행 중 / 부팅 시 자동 시작)${NC}"
echo -e "• 서비스 포트 : ${GREEN}${PORT}/TCP${NC}"
echo -e "• 설치 경로   : ${INSTALL_DIR}"
echo -e ""
echo -e "📋 유용한 관리 명령어:"
echo -e "  - 상태 확인 : ${YELLOW}systemctl status ${SERVICE_NAME}${NC}"
echo -e "  - 실시간 로그: ${YELLOW}journalctl -u ${SERVICE_NAME} -f${NC}"
echo -e "  - 서비스 재시작: ${YELLOW}systemctl restart ${SERVICE_NAME}${NC}"
echo -e "  - 서비스 중지: ${YELLOW}systemctl stop ${SERVICE_NAME}${NC}"
echo -e "======================================================"
