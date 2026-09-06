@echo off
chcp 65001 >nul
title Yoonikon SyncLink - Signaling Server (Windows)
color 0b

echo =======================================================
echo   🚀 Yoonikon SyncLink Signaling Server (Windows)
echo =======================================================
echo.

:: 1. Node.js 설치 확인
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [오류] Node.js 가 설치되어 있지 않습니다!
    echo.
    echo Node.js 공식 홈페이지에서 LTS 버전을 설치한 후 다시 실행해주세요:
    echo 👉 https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. 작업 디렉토리 이동
cd /d "%~dp0"

:: 3. 의존성 패키지 확인 및 설치
if not exist "node_modules\" (
    echo 📦 처음 실행 감지: 필요한 라이브러리를 설치합니다 (npm install)...
    call npm install
    if %errorlevel% neq 0 (
        echo [오류] 패키지 설치에 실패했습니다. 인터넷 연결을 확인해주세요.
        pause
        exit /b 1
    )
    echo.
)

:: 4. Windows 방화벽 5963/TCP 인바운드 규칙 등록 시도
netsh advfirewall firewall show rule name="SyncLink_Signaling_5963" >nul 2>nul
if %errorlevel% neq 0 (
    echo 🔓 외부 기기(Mac, 다른 PC) 접속을 위해 방화벽 포트(5963/TCP) 등록을 시도합니다...
    netsh advfirewall firewall add rule name="SyncLink_Signaling_5963" dir=in action=allow protocol=TCP localport=5963 >nul 2>nul
    if %errorlevel% equ 0 (
        echo ✅ 방화벽 포트(5963/TCP) 등록 성공!
    ) else (
        echo ℹ️ 방화벽 등록 건너뜀 (다른 기기에서 접속이 안 될 경우 '관리자 권한으로 실행'해 주세요).
    )
    echo.
)

:: 5. 서버 실행
echo ⚡ 시그널링 서버를 시작합니다...
echo.
node index.js

if %errorlevel% neq 0 (
    echo.
    echo [종료] 서버가 비정상 종료되었습니다.
    pause
)
