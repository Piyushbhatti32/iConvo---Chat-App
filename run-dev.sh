#!/bin/bash

echo "Starting iConvo Chat App - Frontend and Backend"
echo "==============================================="

# Function to cleanup background processes on script exit
cleanup() {
    echo ""
    echo "Stopping servers..."
    kill $(jobs -p) 2>/dev/null
    exit
}

# Set trap to cleanup on script exit
trap cleanup EXIT INT TERM

echo "Starting backend server..."
npm run dev &
BACKEND_PID=$!

echo "Waiting 3 seconds for backend to initialize..."
sleep 3

echo "Starting frontend server..."
cd frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "Both servers are starting up..."
echo "- Backend: http://localhost:3000 (or check console for port)"
echo "- Frontend: http://localhost:5173 (Vite default)"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for background processes
wait