#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================"
echo -e "   iConvo Enhanced Chat Application"
echo -e "       Deployment Script v2.0"
echo -e "========================================${NC}"
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js is not installed${NC}"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}[INFO] Node.js version:${NC}"
node --version

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo -e "${RED}[ERROR] npm is not available${NC}"
    exit 1
fi

echo -e "${GREEN}[INFO] npm version:${NC}"
npm --version
echo

# Install dependencies
echo -e "${YELLOW}[INFO] Installing dependencies...${NC}"
if ! npm install; then
    echo -e "${RED}[ERROR] Failed to install dependencies${NC}"
    exit 1
fi

echo
echo -e "${GREEN}[SUCCESS] Dependencies installed successfully!${NC}"
echo

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}[INFO] Creating .env configuration file...${NC}"
    cat > .env << EOF
# iConvo Configuration
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

# Security
MAX_CONNECTIONS_PER_IP=10
MAX_MESSAGE_LENGTH=1000
MAX_USERNAME_LENGTH=50
MAX_ROOM_NAME_LENGTH=100

# Rate Limiting
RATE_LIMIT_WINDOW=60000
MAX_MESSAGES_PER_WINDOW=50
MAX_JOINS_PER_WINDOW=10

# Features
ENABLE_SPAM_PROTECTION=true
ENABLE_TYPING_INDICATORS=true
ENABLE_USER_LIST=true
ENABLE_EMOJIS=true

# Advanced Features (disabled by default)
ENABLE_FILE_SHARING=false
ENABLE_PRIVATE_MESSAGES=false
ENABLE_MESSAGE_REACTIONS=false
ENABLE_MESSAGE_THREADS=false
ENABLE_VOICE_CHAT=false
ENABLE_SCREEN_SHARE=false
EOF
    echo -e "${GREEN}[SUCCESS] .env file created with default configuration${NC}"
    echo
fi

# Display network information
echo -e "${YELLOW}[INFO] Detecting network interfaces...${NC}"
if command -v ip &> /dev/null; then
    # Linux
    ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | while read ip; do
        echo -e "${BLUE}[NETWORK] Available at: http://$ip:3000${NC}"
    done
elif command -v ifconfig &> /dev/null; then
    # macOS/BSD
    ifconfig | grep -E 'inet\s' | grep -v '127.0.0.1' | awk '{print $2}' | while read ip; do
        echo -e "${BLUE}[NETWORK] Available at: http://$ip:3000${NC}"
    done
fi

echo
echo -e "${GREEN}========================================"
echo -e "          Setup Complete!"
echo -e "========================================${NC}"
echo
echo "The enhanced iConvo chat application is ready to start."
echo
echo "Available endpoints:"
echo "  - Chat Application: http://localhost:3000"
echo "  - Health Check: http://localhost:3000/health"
echo "  - Statistics: http://localhost:3000/stats"
echo
echo "Configuration can be modified in the .env file."
echo
echo "[1] Start the application now"
echo "[2] Start in development mode (auto-restart)"
echo "[3] Exit"
echo
read -p "Choose an option (1-3): " choice

case $choice in
    1)
        echo -e "${YELLOW}[INFO] Starting iConvo Chat Application...${NC}"
        npm start
        ;;
    2)
        echo -e "${YELLOW}[INFO] Starting iConvo in development mode...${NC}"
        npm run dev
        ;;
    *)
        echo -e "${YELLOW}[INFO] You can start the application later with: npm start${NC}"
        echo
        ;;
esac

echo
echo -e "${GREEN}Thank you for using iConvo!${NC}"
