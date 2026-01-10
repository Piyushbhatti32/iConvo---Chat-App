# iConvo Chat Application

A real-time chat application built with Node.js, Express, and Socket.IO that enables users to create and join chat rooms, send messages, and use emojis.

## ✨ Features

- 💬 Real-time messaging with Socket.IO
- 🌐 Network-accessible chat rooms
- 👥 Multiple chat rooms support
- 📊 Active user count tracking
- 😊 Emoji picker integration (PicMo)
- 🔄 Persistent room sessions
- 📱 Responsive design for mobile devices
- 👤 Anonymous user support with auto-incrementing numbers
- ⚡ Real-time feedback system
- 🎨 Multiple theme support (Light, Dark, Blue, Purple, Green)
- 🔒 Security features (input validation, rate limiting, XSS protection)
- 📈 Health monitoring endpoints
- 🚀 Performance optimizations
- ♿ Accessibility improvements

## 🔒 Security Features

- **Input Validation**: All user inputs are validated and sanitized
- **Rate Limiting**: Message rate limiting to prevent spam
- **XSS Protection**: Basic XSS prevention for user messages
- **Connection Limiting**: Limits connections per IP to prevent DoS
- **Input Sanitization**: HTML escaping for all user-generated content

## 📊 Monitoring

- **Health Check**: `/health` - Application health status
- **Statistics**: `/stats` - Real-time usage statistics
- **Connection Monitoring**: Automatic cleanup of disconnected users

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

### Installation

1. Clone or download the repository
2. Navigate to the project directory
3. Run the deployment script:

**On Windows:**
```bash
deploy.bat
```

**On Linux/Mac:**
```bash
chmod +x deploy.sh
./deploy.sh
```

**Manual Installation:**
```bash
npm install
npm start
```

### Access the Application

- **Local**: `http://localhost:3000`
- **Network**: Use the network URLs displayed in the console
- **Health Check**: `http://localhost:3000/health`
- **Statistics**: `http://localhost:3000/stats`

## 🛠️ Development Setup

For development with hot-reloading for both frontend and backend:

### Option 1: Using the batch script (Windows)
```bash
run-dev.bat
```

### Option 2: Using PowerShell script (Windows)
```bash
.\run-dev.ps1
```

### Option 3: Using shell script (Linux/Mac)
```bash
chmod +x run-dev.sh
./run-dev.sh
```

### Option 4: Using npm script (Cross-platform)
```bash
npm run dev:all
```

This will start both the backend server and frontend development server simultaneously.

- **Backend**: Runs with nodemon for auto-restart on changes
- **Frontend**: Runs with Vite dev server (typically http://localhost:5173)

## 🎯 Features in Detail

### Chat Rooms
- Create or join existing chat rooms
- Persistent room sessions (saves current room in sessionStorage)
- Automatic cleanup on window/tab close
- Room-specific message history

### User Management
- Anonymous user support with auto-incrementing numbers
- Real-time user count updates
- Tracks both total and active users in rooms
- Username validation and conflict resolution

### UI Features
- Modern and responsive design
- Sidebar for room management
- PicMo emoji picker integration
- Sound notifications for new messages
- Real-time feedback system
- Multiple theme support
- Keyboard navigation support

### Performance Optimizations
- Message history management
- Debounced typing indicators
- Efficient DOM operations
- Memory leak prevention
- Connection pooling

### Network Accessibility
- Accessible over local network
- Cross-device compatibility
- CORS enabled for broader access
- Connection limiting and rate limiting

## ⚙️ Configuration

The application uses a centralized configuration file (`config.js`) for easy customization:

```javascript
module.exports = {
  port: process.env.PORT || 3000,
  maxConnectionsPerIP: 5,
  maxMessageLength: 1000,
  rateLimitWindow: 60000,
  maxMessagesPerWindow: 30,
  // ... more options
};
```

## 📁 Project Structure

```
iConvo/
├── public/
│   ├── Ding.mp3          # Message notification sound
│   ├── index.html        # Main HTML file
│   ├── script.js         # Client-side JavaScript
│   ├── style.css         # Main styles
│   ├── themes.css        # Theme-specific styles
│   └── system-message.css # System message styles
├── config.js             # Application configuration
├── index.js              # Server implementation
├── package.json          # Project dependencies and scripts
├── deploy.sh             # Linux/Mac deployment script
├── deploy.bat            # Windows deployment script
└── README.md            # Project documentation
```

## 🔧 Technical Details

- **Backend**: Node.js with Express
- **Real-time Communication**: Socket.IO
- **Frontend**: Vanilla JavaScript with ES6+ features
- **Styling**: CSS3 with custom themes and responsive design
- **Emoji Support**: PicMo emoji picker (via CDN)
- **Security**: Input validation, rate limiting, XSS protection
- **Performance**: Message history management, debouncing, memory optimization

## 🛡️ Error Handling

- Robust error handling for server and socket connections
- Automatic reconnection attempts
- Clear user feedback for connection issues
- Network interface validation and logging
- Graceful degradation for network issues

## 🚀 Deployment

### Local Development
```bash
npm install
npm run dev  # Uses nodemon for auto-restart
```

### Production
```bash
npm install
npm start
```

### Environment Variables
- `PORT`: Server port (default: 3000)
- `LOG_LEVEL`: Logging level (default: 'info')

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](https://opensource.org/licenses/MIT).

## 🆘 Support

If you encounter any issues:
1. Check the console for error messages
2. Verify your network connection
3. Ensure the port is not already in use
4. Check the health endpoint: `http://localhost:3000/health`

## 🔄 Recent Updates

- ✅ Added comprehensive security features
- ✅ Implemented rate limiting and connection limiting
- ✅ Added health monitoring endpoints
- ✅ Improved accessibility with ARIA labels
- ✅ Enhanced performance with message history management
- ✅ Added configuration file for easy customization
- ✅ Created deployment scripts for easy setup
- ✅ Fixed memory leaks and improved error handling
- ✅ Added input validation and XSS protection
