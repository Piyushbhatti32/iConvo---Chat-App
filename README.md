# iConvo Chat Application

A real-time chat application built with Node.js, Express, and Socket.IO that enables users to create and join chat rooms, send messages, and use emojis.

## Features

- 💬 Real-time messaging
- 🌐 Network-accessible chat rooms
- 👥 Multiple chat rooms support
- 📊 Active user count tracking
- 😊 Emoji picker integration
- 🔄 Persistent room sessions
- 📱 Responsive design
- 👤 Anonymous user support
- ⚡ Real-time feedback system

## Prerequisites

- Node.js (v12 or higher)
- npm (Node Package Manager)

## Installation

1. Clone or download the repository
2. Navigate to the project directory
3. Install dependencies:
```bash
npm install
```

## Usage

1. Start the server:
```bash
npm start
```

2. Access the application:
   - Locally: `http://localhost:3000`
   - From other devices on the network: Use the network URLs displayed in the server console

## Features in Detail

### Chat Rooms
- Create or join existing chat rooms
- Persistent room sessions (saves current room in sessionStorage)
- Automatic cleanup on window/tab close

### User Management
- Anonymous user support with auto-incrementing numbers
- Real-time user count updates
- Tracks both total and active users in rooms

### UI Features
- Modern and responsive design
- Sidebar for room management
- PicMo emoji picker integration
- Sound notifications for new messages
- Real-time feedback system

### Network Accessibility
- Accessible over local network
- Cross-device compatibility
- CORS enabled for broader access

## Project Structure

```
iConvo/
├── public/
│   ├── Ding.mp3          # Message notification sound
│   ├── index.html        # Main HTML file
│   ├── script.js         # Client-side JavaScript
│   ├── style.css         # Main styles
│   └── themes.css        # Theme-specific styles
├── index.js              # Server implementation
├── package.json          # Project dependencies and scripts
└── README.md            # Project documentation
```

## Technical Details

- **Backend**: Node.js with Express
- **Real-time Communication**: Socket.IO
- **Frontend**: Vanilla JavaScript
- **Styling**: CSS3 with custom themes
- **Emoji Support**: PicMo emoji picker (via CDN)

## Error Handling

- Robust error handling for server and socket connections
- Automatic reconnection attempts
- Clear user feedback for connection issues
- Network interface validation and logging

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is open source and available under the [MIT License](https://opensource.org/licenses/MIT).
