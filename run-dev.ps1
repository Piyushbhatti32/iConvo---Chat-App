# iConvo Development Runner
# This script starts both frontend and backend servers

Write-Host "Starting iConvo Chat App - Frontend and Backend" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green

# Start backend server in background
Write-Host "Starting backend server..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    npm run dev
}

# Wait a moment for backend to initialize
Start-Sleep -Seconds 3

# Start frontend server in background
Write-Host "Starting frontend server..." -ForegroundColor Yellow
$frontendJob = Start-Job -ScriptBlock {
    Set-Location "$using:PWD\frontend"
    npm run dev
}

Write-Host ""
Write-Host "Both servers are starting up..." -ForegroundColor Cyan
Write-Host "- Backend: http://localhost:3000 (or check console for port)" -ForegroundColor White
Write-Host "- Frontend: http://localhost:5173 (Vite default)" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop all servers" -ForegroundColor Red

# Wait for user to stop
try {
    Wait-Job -Job $backendJob, $frontendJob -Any | Out-Null
} finally {
    Write-Host "Stopping servers..." -ForegroundColor Yellow
    Stop-Job -Job $backendJob, $frontendJob
    Remove-Job -Job $backendJob, $frontendJob
}