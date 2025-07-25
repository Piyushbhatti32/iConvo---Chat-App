@echo off
echo ========================================
echo    iConvo Enhanced Chat Application
echo        Deployment Script v2.0
echo ========================================
echo.

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Display Node.js version
echo [INFO] Node.js version:
node --version

:: Check if npm is available
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not available
    pause
    exit /b 1
)

echo [INFO] npm version:
npm --version
echo.

:: Install dependencies
echo [INFO] Installing dependencies...
npm install
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Dependencies installed successfully!
echo.

:: Create .env file if it doesn't exist
if not exist .env (
    echo [INFO] Creating .env configuration file...
    (
        echo # iConvo Configuration
        echo PORT=3000
        echo HOST=0.0.0.0
        echo LOG_LEVEL=info
        echo.
        echo # Security
        echo MAX_CONNECTIONS_PER_IP=10
        echo MAX_MESSAGE_LENGTH=1000
        echo MAX_USERNAME_LENGTH=50
        echo MAX_ROOM_NAME_LENGTH=100
        echo.
        echo # Rate Limiting
        echo RATE_LIMIT_WINDOW=60000
        echo MAX_MESSAGES_PER_WINDOW=50
        echo MAX_JOINS_PER_WINDOW=10
        echo.
        echo # Features
        echo ENABLE_SPAM_PROTECTION=true
        echo ENABLE_TYPING_INDICATORS=true
        echo ENABLE_USER_LIST=true
        echo ENABLE_EMOJIS=true
        echo.
        echo # Advanced Features (disabled by default)
        echo ENABLE_FILE_SHARING=false
        echo ENABLE_PRIVATE_MESSAGES=false
        echo ENABLE_MESSAGE_REACTIONS=false
        echo ENABLE_MESSAGE_THREADS=false
        echo ENABLE_VOICE_CHAT=false
        echo ENABLE_SCREEN_SHARE=false
    ) > .env
    echo [SUCCESS] .env file created with default configuration
    echo.
)

:: Display network information
echo [INFO] Detecting network interfaces...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R "IPv4.*Address"') do (
    set ip=%%a
    set ip=!ip: =!
    if defined ip echo [NETWORK] Available at: http://!ip!:3000
)

echo.
echo ========================================
echo           Setup Complete!
echo ========================================
echo.
echo The enhanced iConvo chat application is ready to start.
echo.
echo Available endpoints:
echo   - Chat Application: http://localhost:3000
echo   - Health Check: http://localhost:3000/health
echo   - Statistics: http://localhost:3000/stats
echo.
echo Configuration can be modified in the .env file.
echo.
echo [1] Start the application now
echo [2] Start in development mode (auto-restart)
echo [3] Exit
echo.
set /p choice="Choose an option (1-3): "

if "%choice%"=="1" (
    echo [INFO] Starting iConvo Chat Application...
    npm start
) else if "%choice%"=="2" (
    echo [INFO] Starting iConvo in development mode...
    npm run dev
) else (
    echo [INFO] You can start the application later with: npm start
    echo.
)

echo.
echo Thank you for using iConvo!
pause
