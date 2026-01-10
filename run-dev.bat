@echo off
echo Starting iConvo Chat App - Frontend and Backend
echo ===============================================

echo Starting backend server...
start "Backend Server" cmd /k "cd /d %~dp0 && npm run dev"

timeout /t 3 /nobreak > nul

echo Starting frontend server...
start "Frontend Server" cmd /k "cd /d %~dp0\frontend && npm run dev"

echo.
echo Both servers are starting up...
echo - Backend: http://localhost:3000 (or check console for port)
echo - Frontend: http://localhost:5173 (Vite default)
echo.
echo Press any key to close this window (servers will keep running)
pause > nul