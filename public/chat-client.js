// iConvo Client-Side Connection Manager
// Add this to your client HTML or as a separate JS file

class ChatClient {
  constructor(serverUrl = window.location.origin) {
    this.serverUrl = serverUrl;
    this.socket = null;
    this.currentRoom = null;
    this.currentUsername = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.messageQueue = [];
    this.isConnected = false;
    
    this.init();
  }
  
  init() {
    // Initialize Socket.IO with better connection options
    this.socket = io(this.serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true
    });
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Connected to server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.showStatus('Connected', 'success');
      
      // Rejoin room if we were in one
      if (this.currentRoom && this.currentUsername) {
        this.rejoinRoom();
      }
      
      // Send queued messages
      this.flushMessageQueue();
    });
    
    this.socket.on('disconnect', (reason) => {
      console.warn('⚠️ Disconnected:', reason);
      this.isConnected = false;
      this.showStatus('Disconnected - Reconnecting...', 'warning');
      
      if (reason === 'io server disconnect') {
        // Server disconnected us, manually reconnect
        this.socket.connect();
      }
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.showStatus('Connection failed. Please refresh the page.', 'error');
      } else {
        this.showStatus(`Connection error. Retrying (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`, 'warning');
      }
    });
    
    this.socket.on('reconnect', (attemptNumber) => {
      console.log('✅ Reconnected after', attemptNumber, 'attempts');
      this.showStatus('Reconnected!', 'success');
    });
    
    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔄 Reconnection attempt', attemptNumber);
    });
    
    this.socket.on('reconnect_failed', () => {
      console.error('❌ Reconnection failed');
      this.showStatus('Could not reconnect. Please refresh the page.', 'error');
    });
    
    // Chat events
    this.socket.on('join', (data) => {
      console.log('Joined room:', data);
      this.currentRoom = data.room;
      this.currentUsername = data.username;
      
      // Save to localStorage for persistence
      localStorage.setItem('chatRoom', data.room);
      localStorage.setItem('chatUsername', data.username);
      
      // Load message history if provided
      if (data.messageHistory && Array.isArray(data.messageHistory)) {
        this.displayMessageHistory(data.messageHistory);
      } else {
        // Request history separately
        this.requestMessageHistory(data.room);
      }
      
      this.onJoinRoom(data);
    });
    
    this.socket.on('message_history', (data) => {
      console.log('Received message history:', data.messages.length, 'messages');
      this.displayMessageHistory(data.messages);
    });
    
    this.socket.on('receive', (data) => {
      this.onReceiveMessage(data);
    });
    
    this.socket.on('userJoined', (data) => {
      this.onUserJoined(data);
    });
    
    this.socket.on('user count', (data) => {
      this.onUserCount(data);
    });
    
    this.socket.on('typing', (room, username) => {
      this.onTyping(room, username);
    });
    
    this.socket.on('stop typing', (room, username) => {
      this.onStopTyping(room, username);
    });
    
    // Error handling
    this.socket.on('join_error', (error) => {
      console.error('Join error:', error);
      this.showStatus('Error joining room: ' + error, 'error');
    });
    
    this.socket.on('message_error', (error) => {
      console.error('Message error:', error);
      this.showStatus('Message error: ' + error, 'error');
    });
    
    this.socket.on('username_taken', (username) => {
      console.error('Username taken:', username);
      this.showStatus('Username already taken: ' + username, 'error');
    });
    
    this.socket.on('connection_error', (error) => {
      console.error('Connection error:', error);
      this.showStatus('Connection error: ' + error, 'error');
    });
  }
  
  joinRoom(room, username) {
    if (!this.isConnected) {
      this.showStatus('Not connected. Please wait...', 'warning');
      return;
    }
    
    console.log('Joining room:', room, 'as', username);
    this.socket.emit('join', {
      room: room,
      username: username,
      broadcast: true
    });
  }
  
  rejoinRoom() {
    console.log('Rejoining room:', this.currentRoom, 'as', this.currentUsername);
    this.socket.emit('join', {
      room: this.currentRoom,
      username: this.currentUsername,
      broadcast: false // Don't announce rejoin after reconnect
    });
  }
  
  leaveRoom(room) {
    if (this.currentRoom) {
      this.socket.emit('leave', {
        room: room || this.currentRoom,
        username: this.currentUsername
      });
      
      this.currentRoom = null;
      this.currentUsername = null;
      localStorage.removeItem('chatRoom');
      localStorage.removeItem('chatUsername');
    }
  }
  
  sendMessage(message) {
    if (!this.isConnected) {
      // Queue message for later
      this.messageQueue.push(message);
      this.showStatus('Message queued. Reconnecting...', 'warning');
      return;
    }
    
    if (!this.currentRoom) {
      this.showStatus('Please join a room first', 'error');
      return;
    }
    
    this.socket.emit('send', {
      room: this.currentRoom,
      message: message
    });
  }
  
  requestMessageHistory(room, limit = 50) {
    this.socket.emit('get_history', {
      room: room,
      limit: limit
    });
  }
  
  flushMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      this.sendMessage(message);
    }
  }
  
  startTyping() {
    if (this.currentRoom && this.currentUsername) {
      this.socket.emit('typing', this.currentRoom, this.currentUsername);
    }
  }
  
  stopTyping() {
    if (this.currentRoom && this.currentUsername) {
      this.socket.emit('stop typing', this.currentRoom, this.currentUsername);
    }
  }
  
  // Override these methods in your implementation
  onJoinRoom(data) {
    console.log('onJoinRoom:', data);
  }
  
  onReceiveMessage(message) {
    console.log('onReceiveMessage:', message);
  }
  
  onUserJoined(data) {
    console.log('onUserJoined:', data);
  }
  
  onUserCount(data) {
    console.log('onUserCount:', data);
  }
  
  onTyping(room, username) {
    console.log('onTyping:', username);
  }
  
  onStopTyping(room, username) {
    console.log('onStopTyping:', username);
  }
  
  displayMessageHistory(messages) {
    console.log('displayMessageHistory:', messages.length, 'messages');
    // Override this to display messages in your UI
  }
  
  showStatus(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    // Override this to show status in your UI
    
    // Example implementation:
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = `status status-${type}`;
      
      // Auto-hide success messages after 3 seconds
      if (type === 'success') {
        setTimeout(() => {
          statusEl.textContent = '';
          statusEl.className = 'status';
        }, 3000);
      }
    }
  }
  
  // Auto-restore session on page load
  restoreSession() {
    const savedRoom = localStorage.getItem('chatRoom');
    const savedUsername = localStorage.getItem('chatUsername');
    
    if (savedRoom && savedUsername) {
      console.log('Restoring session:', savedRoom, savedUsername);
      // Wait for connection before joining
      if (this.isConnected) {
        this.joinRoom(savedRoom, savedUsername);
      } else {
        this.socket.once('connect', () => {
          this.joinRoom(savedRoom, savedUsername);
        });
      }
    }
  }
}

// Usage example:
// const chat = new ChatClient();
// chat.onReceiveMessage = (message) => {
//   // Display message in your UI
//   console.log('New message:', message);
// };
// chat.joinRoom('General', 'MyUsername');
// chat.sendMessage('Hello, world!');

// Auto-restore session if available
// window.addEventListener('load', () => {
//   chat.restoreSession();
// });