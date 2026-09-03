# Yoonikon SyncLink (유니콘 싱크링크)

> **차세대 WebRTC P2P 초저지연 원격 데스크톱 & 크로스 플랫폼 디바이스 제어 솔루션**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Tauri: v2](https://img.shields.io/badge/Tauri-v2.0-24C8D8.svg)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-Tokio_|_rdev-DEA584.svg)](https://www.rust-lang.org/)
[![UI: BDS](https://img.shields.io/badge/Design_System-BDS_v1.0.2-6366F1.svg)](https://www.npmjs.com/package/blueward-design-system)

---

## 📥 클라이언트 다운로드 (Client Downloads)

별도의 개발 환경이나 빌드 없이, 아래 링크에서 **운영체제별 최신 설치 파일**을 즉시 다운로드하여 사용하실 수 있습니다.

| 운영체제 (OS) | 파일 형식 | 바로 다운로드 |
| :--- | :---: | :--- |
| **Windows 10 / 11** (64-bit) | `.exe` | [**⬇️ Windows 설치 파일 (.exe) 다운로드**](https://github.com/JungHyunY/synclink.proto/releases/latest) |
| **Windows 10 / 11** (MSI 패키지) | `.msi` | [**⬇️ Windows 패키지 (.msi) 다운로드**](https://github.com/JungHyunY/synclink.proto/releases/latest) |
| **macOS** (Apple Silicon M1/M2/M3/M4) | `.dmg` | [**⬇️ Mac 설치 파일 (.dmg) 다운로드**](https://github.com/JungHyunY/synclink.proto/releases/latest) |

> 📌 **안내**: [**📦 전체 릴리즈 및 이전 버전 다운로드 페이지 (GitHub Releases)**](https://github.com/JungHyunY/synclink.proto/releases)에서 모든 파일 목록과 패치 내역을 확인하실 수 있습니다.

---

## ⚡ 퀵 스타트 (Quick Start - 3분 완성)

### 1️⃣ 리눅스 서버 준비 (원클릭 자동 설치)
개인 VPS나 홈 서버(Ubuntu, Debian, CentOS, Rocky Linux 등) 터미널에 아래 명령어를 입력하면 **Node.js 설치 + 방화벽 개방 + 부팅 시 자동 시작 등록**까지 자동으로 완료됩니다:
```bash
curl -fsSL https://raw.githubusercontent.com/JungHyunY/synclink.proto/main/signaling-server/install.sh | sudo bash
```
> *Docker 사용 시*: `cd signaling-server && docker compose up -d`

### 2️⃣ 클라이언트 실행 및 원격 연결
1. 상단 **[클라이언트 다운로드]**에서 본인 OS에 맞는 설치 파일(`.exe` / `.dmg`)을 받아 실행합니다.
2. **[설정] 탭**에서 구축한 서버 주소(예: `http://내_서버_IP:5963`)를 입력합니다.
3. **[원격 접속] 탭**에서 상대방 PC의 9자리 기기 ID와 PIN을 입력하면 즉시 60FPS 초저지연 원격 제어가 시작됩니다!
   *(호스트 PC는 [무인 원격 접속 상시 대기]가 켜져 있어 별도의 버튼 클릭 없이 자동 수락됩니다)*

---

## 2. 아키텍처 및 핵심 기술

* **초경량 데스크톱 클라이언트 (`client/`):** Tauri v2 기반의 10MB 미만 초경량 번들 (Electron 대비 메모리 점유율 90% 절감)
* **초저지연 WebRTC P2P 전송:** STUN/TURN 서버 기반의 중계 서버 없는 다이렉트 화면/입력 스트리밍
* **시그널링 서버 (`signaling-server/`):** Node.js + Socket.io 기반의 초고속 P2P 세션 연결
* **BDS 디자인 시스템 내장:** `blueward-design-system` v1.0.2 기반의 유려한 다크/라이트 테마 인터페이스

---

## 3. 실행 방법

### 시그널링 서버 설치 및 실행 (Signaling Server)

#### 방법 1: 리눅스 원클릭 자동 설치 (추천: Ubuntu / Debian / CentOS / Rocky)
리눅스 터미널에서 아래 명령어 한 줄을 실행하면 Node.js 환경 감지, 방화벽 포트 개방(5963/TCP), systemd 상시 백그라운드 서비스 등록 및 자동 시작이 완료됩니다:
```bash
curl -fsSL https://raw.githubusercontent.com/JungHyunY/synclink.proto/main/signaling-server/install.sh | sudo bash
```

#### 방법 2: Docker 컨테이너 실행
```bash
cd signaling-server
docker compose up -d
```

#### 방법 3: 수동 실행
```bash
cd signaling-server
npm install
npm start
```

### 데스크톱 클라이언트 실행 (개발 모드)
```bash
cd client
npm install
npm run tauri dev
```
