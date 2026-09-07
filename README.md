# Yoonikon SyncLink (싱크링크)

> 윈도우와 맥북을 같이 쓰거나 다른 PC를 원격으로 제어할 때 쓰려고 만든 **WebRTC P2P 원격 제어 & 가상 KVM(Flow) 프로그램**이에요.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Tauri: v2](https://img.shields.io/badge/Tauri-v2.0-24C8D8.svg)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-Tokio_|_rdev-DEA584.svg)](https://www.rust-lang.org/)

---

## 📥 앱 다운로드

직접 빌드할 필요 없이 아래에서 내 컴퓨터 운영체제에 맞는 걸 받아서 바로 쓰시면 돼요.

| OS | 파일 | 다운로드 |
| :--- | :---: | :--- |
| **Windows 10 / 11** (64-bit) | `.exe` | [**⬇️ Windows 실행 파일 (.exe) 받기**](https://github.com/JungHyunY/synclink.proto/releases/latest) |
| **Windows 10 / 11** (설치형) | `.msi` | [**⬇️ Windows 설치 패키지 (.msi) 받기**](https://github.com/JungHyunY/synclink.proto/releases/latest) |
| **macOS** (M1/M2/M3/M4 실리콘) | `.dmg` | [**⬇️ Mac 디스크 이미지 (.dmg) 받기**](https://github.com/JungHyunY/synclink.proto/releases/latest) |

> 📌 이전 버전이나 전체 파일 목록이 궁금하시면 [GitHub Releases 페이지](https://github.com/JungHyunY/synclink.proto/releases)를 확인해주세요.

> 💡 **맥(macOS)에서 "앱이 손상되었기 때문에 열 수 없습니다"라고 뜰 때**:  
> 애플 개발자 유료 인증서가 안 들어간 오픈소스 앱이라 맥 게이트키퍼가 보안 경고를 띄우는 거예요. **실제 파일에 문제 있는 게 아니니까**, 앱을 `응용 프로그램` 폴더로 옮겨둔 뒤 터미널 열고 아래 명령어 한 번만 쳐주시면 정상적으로 열려요.
> ```bash
> xattr -cr /Applications/SyncLink.app
> ```
> *(또는 `시스템 설정 > 개인정보 보호 및 보안 > 보안` 맨 밑에서 **[확인 없이 열기]**를 눌러도 됩니다)*

---

## ✨ 이런 기능들이 있어요

- **초저지연 WebRTC P2P 연결**: 중계 서버 거치지 않고 내 PC와 상대 PC가 직접 다이렉트로 통신해서 딜레이가 거의 없어요.
- **🌊 SyncLink Flow (가상 KVM 모드)**: Microsoft Mouse Without Borders를 윈도우 ↔ 맥에서도 쓸 수 있게 만들었어요. 모니터 가장자리로 마우스 커서를 밀면 옆 PC로 스무스하게 넘어가서 한 세트의 마우스/키보드로 두 대를 동시에 조작할 수 있어요.
- **✨ AI 스마트 클립보드 도우미 (Google Gemini)**: 원격 PC나 내 PC에서 복사(`Ctrl+C`)한 터미널 오류 로그를 즉시 분석해 해결 명령어를 제안하고, 외국어 번역과 코드 해설을 단축키(`Ctrl+Space`) 한 번으로 제공해요. (무료 Gemini API 키 지원)
- **🖥️ 60FPS 풀 화면 원격 제어**: 일반적인 TeamViewer나 AnyDesk처럼 화면을 보면서 원격 제어하는 모드도 지원해요. 상단 툴바 위치도 내 맘대로 옮기거나 숨길 수 있어요.
- **📋 실시간 클립보드 공유**: 윈도우에서 `Ctrl+C` 복사하고 맥에서 `Cmd+V` 붙여넣기하면 바로 들어가요.
- **🔋 무인 원격 접속 & 화면 깨우기**: 상대 PC가 잠자기 모드에 들어가서 꺼지지 않도록 방지해주고, 원격 접속 시 꺼져있던 모니터를 알아서 깨워줘요.
- **🪟 멀티 세션 지원**: 창을 최대 3개까지 동시에 띄워서 여러 대의 컴퓨터를 한 번에 제어할 수 있어요.

---

## ⚡ 빠른 시작 (처음 써볼 때)

### 1단계: 시그널링 서버 켜기 (택 1)

P2P로 서로를 찾아가려면 처음에 길을 안내해 줄 시그널링 서버가 하나 돌아가고 있어야 해요.

#### 🪟 윈도우 PC에서 켤 때 (제일 편한 방법)
1. 컴퓨터에 [Node.js](https://nodejs.org/)가 깔려있는지 확인해주세요. (LTS 버전 추천)
2. `signaling-server` 폴더 안에 있는 **`start-windows.bat`** 파일을 그냥 더블 클릭해서 실행하세요.  
   *(처음 켤 때 알아서 `npm install` 해주고 방화벽 5963 포트도 알아서 열어줘요)*
3. 까만 창에 나오는 **`[Network IP]` (예: `http://192.168.0.15:5963`)** 주소를 기억해두세요.

> 터미널로 직접 켜고 싶다면:
> ```powershell
> cd signaling-server
> npm install
> npm start
> ```

#### 🐧 리눅스 서버에서 켤 때 (오라클 클라우드 / 개인 VPS / 우분투 홈서버)
터미널에 이 명령어 한 줄만 복사해서 붙여넣으면 끝나요:
```bash
curl -fsSL https://raw.githubusercontent.com/JungHyunY/synclink.proto/main/signaling-server/install.sh | sudo bash
```
> 도커가 편하시면: `cd signaling-server && docker compose up -d`

---

### 2단계: 클라이언트 켜고 연결하기

1. 양쪽 컴퓨터에서 다운받은 SyncLink 앱을 켭니다.
2. **[설정] 탭**에 들어가서 1단계에서 띄운 서버 주소(예: `http://192.168.0.15:5963`)를 넣고 저장하세요.  
   *(서버를 띄운 컴퓨터 자체에서 테스트할 땐 `로컬호스트 (5963)` 버튼을 누르면 돼요)*
3. **[원격 접속] 탭**에서 상대방 PC의 9자리 기기 ID와 PIN 비밀번호를 입력하고 접속 버튼을 누르면 바로 연결됩니다!  
   *(화면 제어 모드랑 Flow(가상 KVM) 모드 중 원하는 걸 골라서 연결할 수 있어요)*

---

## 🛠️ 개발 환경에서 직접 빌드하기

혹시 코드를 직접 수정하거나 개발 모드로 실행해보고 싶다면 아래 순서대로 하시면 돼요.

### 요구 사항
- [Node.js](https://nodejs.org/) 18 이상
- [Rust](https://www.rust-lang.org/) (최신 stable)
- C++ 빌드 툴 (윈도우의 경우 Visual Studio C++ 빌드 도구)

### 1. 시그널링 서버 실행
```bash
cd signaling-server
npm install
npm start
```

### 2. 데스크톱 클라이언트 실행
```bash
cd client
npm install
npm run tauri dev
```

---

## 📜 라이선스
MIT License
