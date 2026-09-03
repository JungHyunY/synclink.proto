# Yoonikon SyncLink (유니콘 싱크링크)

> **차세대 WebRTC P2P 초저지연 원격 데스크톱 & 크로스 플랫폼 디바이스 제어 솔루션**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Tauri: v2](https://img.shields.io/badge/Tauri-v2.0-24C8D8.svg)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-Tokio_|_rdev-DEA584.svg)](https://www.rust-lang.org/)
[![UI: BDS](https://img.shields.io/badge/Design_System-BDS_v1.0.2-6366F1.svg)](https://www.npmjs.com/package/blueward-design-system)

---

## 1. 개요 (Overview)

**Yoonikon SyncLink**는 **Tauri v2 (Rust 네이티브 코어)**와 **React 19 (TypeScript + Blueward Design System)**를 결합하여 제작된 초경량 고성능 **WebRTC P2P 원격 데스크톱 제어 솔루션**입니다.

Yoonikon AIOps 생태계의 **Yoonikon Sentinel**과 유기적으로 연계되어, 관제 시스템에서 감지된 원격 서버나 단말에 **클릭 한 번으로 60fps 초저지연 화면 스트리밍과 정밀 마우스/키보드 원격 제어를 수행**할 수 있습니다.

---

## 2. 아키텍처 및 핵심 기술

* **초경량 데스크톱 클라이언트 (`client/`):** Tauri v2 기반의 10MB 미만 초경량 번들 (Electron 대비 메모리 점유율 90% 절감)
* **초저지연 WebRTC P2P 전송:** STUN/TURN 서버 기반의 중계 서버 없는 다이렉트 화면/입력 스트리밍
* **시그널링 서버 (`signaling-server/`):** Node.js + Socket.io 기반의 초고속 P2P 세션 연결
* **BDS 디자인 시스템 내장:** `blueward-design-system` v1.0.2 기반의 유려한 다크/라이트 테마 인터페이스

---

## 3. 실행 방법

### 시그널링 서버 실행
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
