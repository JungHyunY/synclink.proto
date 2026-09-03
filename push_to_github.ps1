Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Yoonikon SyncLink - GitHub 1-Click Push Script          " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$remoteUrl = Read-Host "GitHub 원격 저장소 URL을 입력하세요 (예: https://github.com/JungHyunY/synclink.git)"

if ([string]::IsNullOrWhiteSpace($remoteUrl)) {
    Write-Host "URL이 입력되지 않아 취소합니다." -ForegroundColor Red
    exit 1
}

# Add or Update origin
git remote remove origin 2>$null
git remote add origin $remoteUrl

Write-Host "`nGitHub 'main' 브랜치로 푸시를 시작합니다..." -ForegroundColor Yellow
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n==========================================================" -ForegroundColor Green
    Write-Host "  푸시 성공! 저장소: $remoteUrl" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
} else {
    Write-Host "`n푸시 중 오류가 발생했습니다. GitHub 로그인 또는 저장소 생성 여부를 확인해 주세요." -ForegroundColor Red
}
