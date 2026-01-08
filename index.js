const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const path = require("path");
const os = require('os');
const moment = require('moment-timezone');
const config = require('./config');

// Logging utility
const log = {
  info: (msg, ...args) => console.log(`[INFO] ${moment().format('YYYY-MM-DD HH:mm:ss')} - ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[WARN] ${moment().format('YYYY-MM-DD HH:mm:ss')} - ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[ERROR] ${moment().format('YYYY-MM-DD HH:mm:ss')} - ${msg}`, ...args),
  debug: (msg, ...args) => config.logLevel === 'debug' && console.log(`[DEBUG] ${moment().format('YYYY-MM-DD HH:mm:ss')} - ${msg}`, ...args)
};

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: config.corsOrigin,
    methods: ["GET", "POST"]
  }
});

// Rate limiting and security
const connectionLimits = new Map(); // IP -> { count, resetTime }
const messageLimits = new Map(); // socket.id -> { count, resetTime }
const joinLimits = new Map(); // socket.id -> { count, resetTime }

// Middleware for JSON parsing and security headers
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Statistics tracking
const stats = {
  startTime: Date.now(),
  totalConnections: 0,
  currentConnections: 0,
  totalMessages: 0,
  totalRooms: 0,
  peakConnections: 0,
  messagesPerMinute: 0,
  activeRooms: () => Object.keys(roomUsers).length,
  uptime: () => Date.now() - stats.startTime
};

// Message history storage
const messageHistory = {}; // room -> array of messages

// Utility functions
function sanitizeMessage(message) {
  if (typeof message !== 'string') return '';
  return message
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

function isRateLimited(limits, key, maxCount, windowMs) {
  const now = Date.now();
  const limit = limits.get(key);
  
  if (!limit) {
    limits.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }
  
  if (now > limit.resetTime) {
    limits.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }
  
  if (limit.count >= maxCount) {
    return true;
  }
  
  limit.count++;
  return false;
}

function validateInput(input, maxLength, allowEmpty = false) {
  if (!allowEmpty && (!input || !input.trim())) return false;
  if (input.length > maxLength) return false;
  return true;
}

// Health check endpoint
app.get(config.healthCheckPath, (req, res) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: stats.uptime(),
    connections: stats.currentConnections,
    rooms: stats.activeRooms(),
    memory: process.memoryUsage(),
    version: require('./package.json').version || '1.0.0'
  };
  res.json(healthData);
});

// Statistics endpoint
app.get(config.statsPath, (req, res) => {
  const detailedStats = {
    ...stats,
    activeRooms: stats.activeRooms(),
    uptime: stats.uptime(),
    roomList: Object.keys(roomUsers).map(room => ({
      name: room,
      users: roomUsers[room] ? roomUsers[room].size : 0,
      messages: messageHistory[room] ? messageHistory[room].length : 0
    })),
    systemInfo: {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      memory: process.memoryUsage()
    }
  };
  res.json(detailedStats);
});

// Serve static files from current directory (or 'public' if you have one)
const staticDir = path.join(__dirname, "public");
app.use(express.static(staticDir));

// If files are in the same directory as server.js, also serve from current directory
app.use(express.static(__dirname));

// Store user and room info
const rooms = {}; // socket.id -> room name
const usernames = {}; // socket.id -> username
const roomUsers = {}; // room name -> Set of socket.ids
const roomUsernames = {}; // room name -> Set of usernames
const anonymousCount = {}; // room name -> current anonymous count

io.on('connection', (socket) => {
  const clientIP = socket.handshake.address;
  const auth = socket.handshake.auth || {}; // Get auth data from socket.io client
  
  // Extract iTaskOrg auth data
  const userId = auth.userId || null;
  const groupId = auth.groupId || null;
  const userName = auth.userName || null;
  const token = auth.token || null; // Firebase token (can be verified if needed)
  
  log.info(`New user connected: ${socket.id} from ${clientIP}${userId ? ` (userId: ${userId}, groupId: ${groupId})` : ''}`);
  
  // Update statistics
  stats.totalConnections++;
  stats.currentConnections++;
  stats.peakConnections = Math.max(stats.peakConnections, stats.currentConnections);
  
  // Check connection limits per IP
  if (isRateLimited(connectionLimits, clientIP, config.maxConnectionsPerIP, 3600000)) { // 1 hour window
    log.warn(`Connection rate limit exceeded for IP: ${clientIP}`);
    socket.emit('connection_error', 'Too many connections from this IP address');
    socket.disconnect();
    return;
  }
  
  // Initialize client-specific rate limiting
  messageLimits.set(socket.id, { count: 0, resetTime: Date.now() + config.rateLimitWindow });
  joinLimits.set(socket.id, { count: 0, resetTime: Date.now() + config.rateLimitWindow });
  
  // Store iTaskOrg user info if available
  if (userId) {
    socket.userId = userId;
    socket.userName = userName;
    socket.groupId = groupId;
  }

  // Add new handler for username_update event
  socket.on("restore_username", (data) => {
    if (data.username) {
      // Validate the username isn't taken in current room
      const room = rooms[socket.id];
      if (room && roomUsernames[room] && roomUsernames[room].has(data.username)) {
        socket.emit("username_taken", data.username);
        return;
      }
      
      // Update username in server state
      usernames[socket.id] = data.username;
      
      // Confirm username update to client
      socket.emit("username_updated", { username: data.username });
      
      console.log(`Username restored for ${socket.id}: ${data.username}`);
    }
  });

  // Function to update user count in a room
  function updateUserCount(room) {
    if (room) {
      const sockets = io.sockets.adapter.rooms.get(room);
      const count = sockets ? sockets.size : 0;

      // Update room users count
      if (roomUsers[room]) {
        const activeUsers = roomUsers[room].size;
        // Emit both total users and active users
        io.to(room).emit('user count', {
          total: count,
          active: activeUsers,
          room: room
        });
        console.log(`Room ${room} has ${activeUsers} active users out of ${count} total`);
      }
    }
  }

  // Handle user joining a room
  socket.on("join", (data) => {
    // Handle both object format and legacy format
    const room = typeof data === 'object' ? data.room : data;
    let username = typeof data === 'object' ? data.username : arguments[1];
    const broadcast = typeof data === 'object' ? data.broadcast : true;

    if (username && room) {
      // Check if user is already in the same room
      if (rooms[socket.id] === room) {
        socket.emit("join_error", "You are already in this room");
        return;
      }

      // Initialize room username tracking if needed
      if (!roomUsernames[room]) {
        roomUsernames[room] = new Set();
      }
      if (!anonymousCount[room]) {
        anonymousCount[room] = 0;
      }

      // For anonymous users, keep their number if they already have one
      if (username === 'Anonymous') {
        if (usernames[socket.id] && usernames[socket.id].startsWith('Anonymous')) {
          username = usernames[socket.id];
        } else {
          // Atomically get next anonymous number
          anonymousCount[room] = (anonymousCount[room] || 0) + 1;
          let counter = anonymousCount[room];
          
          // Keep incrementing until we find an unused number
          while (roomUsernames[room].has(`Anonymous${counter}`)) {
            counter++;
            anonymousCount[room] = counter;
          }
          
          username = `Anonymous${counter}`;
        }
      } else if (roomUsernames[room].has(username)) {
        // For non-anonymous users, reject the connection
        log.warn(`Username collision: ${username} already exists in room ${room}`);
        socket.emit("username_taken", username);
        return;
      }
      console.log(`User ${username} (${socket.id}) attempting to join room ${room}`);

      // Leave previous room if any
      const previousRoom = rooms[socket.id];
      if (previousRoom && previousRoom !== room) {
        socket.leave(previousRoom);
        socket.to(previousRoom).emit("receive", `Server: ${usernames[socket.id]} left the chat`);

        // Remove from room users tracking
        if (roomUsers[previousRoom]) {
          roomUsers[previousRoom].delete(socket.id);
          if (roomUsers[previousRoom].size === 0) {
            delete roomUsers[previousRoom];
          }
        }

        updateUserCount(previousRoom);
        console.log(`User ${usernames[socket.id]} left room ${previousRoom}`);
      }

      // Track user info
      rooms[socket.id] = room;
      usernames[socket.id] = username;

      // Initialize room users set if it doesn't exist
      if (!roomUsers[room]) {
        roomUsers[room] = new Set();
      }
      roomUsers[room].add(socket.id);

      // Track the username in this room
      roomUsernames[room].add(username);

      // Join the specified room
      socket.join(room);

      // Confirm join to the user first
      socket.emit("join", { room: room, username: username });

      // Then notify others in the room if broadcast is true
      if (broadcast) {
        console.log(`Broadcasting userJoined event for ${username} in room ${room}`);
        socket.to(room).emit("userJoined", { room: room, username: username });
      } else {
        console.log(`Not broadcasting userJoined event (broadcast=${broadcast})`);
      }

      // Update user count
      updateUserCount(room);

      console.log(`User ${username} successfully joined room ${room}`);
    } else {
      console.log("Invalid join attempt - missing username or room");
      socket.emit("receive", "Server: Error - Username and room are required");
    }
  });

  // Handle user leaving a room
  socket.on("leave", (data) => {
    // Handle both object format and string format
    const room = typeof data === 'object' ? data.room : data;
    const username = typeof data === 'object' ? data.username : usernames[socket.id];
    
    if (room && rooms[socket.id] === room) {
      console.log(`User ${username} leaving room ${room}`);

      socket.leave(room);
      socket.to(room).emit("receive", `Server: ${username} left the chat`);

      // Clean up tracking
      delete rooms[socket.id];
      delete usernames[socket.id];

      if (roomUsers[room]) {
        roomUsers[room].delete(socket.id);
        if (roomUsers[room].size === 0) {
          delete roomUsers[room];
        }
      }

      if (roomUsernames[room]) {
        roomUsernames[room].delete(username);
        if (roomUsernames[room].size === 0) {
          delete roomUsernames[room];
          delete anonymousCount[room];
        }
      }

      updateUserCount(room);
      console.log(`User ${username} left room ${room}`);
    }
  });

  // Handle sending messages
  socket.on("send", (data) => {
    const userRoom = rooms[socket.id];
    const username = usernames[socket.id];

    // Extract room and message from data
    const room = typeof data === 'object' ? data.room : data;
    let message = typeof data === 'object' ? data.message : arguments[1];

    // Rate limiting for messages
    if (isRateLimited(messageLimits, socket.id, config.maxMessagesPerWindow, config.rateLimitWindow)) {
      log.warn(`Message rate limit exceeded for user: ${username} (${socket.id})`);
      socket.emit("message_error", "You are sending messages too quickly. Please slow down.");
      return;
    }

    // Verify user is in the room they're trying to send to
    if (userRoom === room && username) {
      // Validate message input
      if (!validateInput(message, config.maxMessageLength)) {
        socket.emit("message_error", "Message is empty or too long");
        return;
      }

      // Sanitize message content
      message = sanitizeMessage(message);
      
      // Check for spam protection (basic duplicate message detection)
      if (config.enableSpamProtection) {
        const roomHistory = messageHistory[room] || [];
        const recentMessages = roomHistory.slice(-5); // Check last 5 messages
        const duplicateCount = recentMessages.filter(msg => 
          msg.username === username && msg.message === message
        ).length;
        
        if (duplicateCount >= 2) {
          socket.emit("message_error", "Please avoid sending duplicate messages");
          return;
        }
      }

      const formattedMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        username: username,
        message: message,
        timestamp: new Date().toISOString(),
        room: room
      };

      // Store message in history
      if (!messageHistory[room]) {
        messageHistory[room] = [];
      }
      messageHistory[room].push(formattedMessage);
      
      // Keep only recent messages in memory
      if (messageHistory[room].length > config.maxMessageHistory) {
        messageHistory[room] = messageHistory[room].slice(-config.maxMessageHistory);
      }

      // Update statistics
      stats.totalMessages++;
      
      log.debug(`Message from ${username} in ${room}: ${message}`);

      // Send to everyone in the room including sender
      io.to(room).emit("receive", formattedMessage);

      // Send confirmation back to sender
      socket.emit("message_sent", formattedMessage);
    } else {
      log.warn(`Invalid message attempt from ${socket.id} - not in room ${room}`);
      socket.emit("message_error", "You must be in a room to send messages");
    }
  });

  // Handle typing indicators (combined handler for both formats)
  socket.on('typing', (data, usernameArg) => {
    let room, userName, isTyping, groupId, userId;
    
    // Check if it's iTaskOrg format (object) or legacy format (string, string)
    if (typeof data === 'object' && data !== null && data.roomId) {
      // iTaskOrg format
      room = data.roomId || data.room;
      userName = data.userName || socket.userName || usernames[socket.id];
      isTyping = data.isTyping !== false;
      groupId = data.groupId || socket.groupId;
      userId = data.userId || socket.userId;
    } else {
      // Legacy format: typing(room, username)
      room = data;
      userName = usernameArg || usernames[socket.id];
      isTyping = true; // Legacy format always means typing
      groupId = socket.groupId;
      userId = socket.userId;
    }
    
    const userRoom = rooms[socket.id];
    if (userRoom === room && userName) {
      // Emit iTaskOrg format if groupId exists
      if (groupId) {
        socket.to(room).emit('typing', {
          groupId: groupId,
          userId: userId,
          userName: userName,
          isTyping: isTyping
        });
      }
      
      // Also emit legacy format for backward compatibility
      if (isTyping) {
        socket.to(room).emit('typing', room, userName);
      } else {
        socket.to(room).emit('stop typing', room, userName);
      }
    }
  });

  socket.on('stop typing', (room, username) => {
    const userRoom = rooms[socket.id];
    if (userRoom === room && usernames[socket.id] === username) {
      // Broadcast to everyone in the room except the sender
      socket.to(room).emit('stop typing', room, username);
      
      // Also emit iTaskOrg format if applicable
      const groupId = socket.groupId;
      const userId = socket.userId;
      if (groupId) {
        socket.to(room).emit('typing', {
          groupId: groupId,
          userId: userId,
          userName: username,
          isTyping: false
        });
      }
    }
  });

  // Handle theme changes
  socket.on('user theme', (data) => {
    if (usernames[socket.id] && data.username === usernames[socket.id]) {
      console.log(`User ${usernames[socket.id]} changed theme to ${data.theme || 'default'}`);
      // Optional: broadcast theme change to room
      // socket.to(rooms[socket.id]).emit('user theme changed', {
      //   username: usernames[socket.id],
      //   theme: data.theme
      // });
    }
  });

  // Handle user count requests (legacy iConvo)
  socket.on('get_user_count', (data) => {
    const room = data.room;
    if (room && roomUsers[room]) {
      const activeUsers = roomUsers[room].size;
      const sockets = io.sockets.adapter.rooms.get(room);
      const totalUsers = sockets ? sockets.size : 0;
      
      socket.emit('user count', {
        total: totalUsers,
        active: activeUsers,
        room: room
      });
    }
  });

  // ========== iTaskOrg Event Handlers ==========
  
  // iTaskOrg: Join room (group chat)
  socket.on('join_room', (data) => {
    const roomId = data.roomId || data.room;
    const groupId = data.groupId || socket.groupId;
    const userId = data.userId || socket.userId || socket.id;
    const userName = data.userName || socket.userName || 'Unknown';
    
    if (!roomId) {
      socket.emit('join_error', 'Room ID is required');
      return;
    }
    
    log.info(`iTaskOrg: User ${userName} (${userId}) joining room ${roomId} (groupId: ${groupId})`);
    
    // Store user info
    socket.userId = userId;
    socket.userName = userName;
    socket.groupId = groupId;
    
    // Use existing join logic but with iTaskOrg format
    const joinData = {
      room: roomId,
      username: userName,
      broadcast: true
    };
    
    // Call existing join handler logic
    const room = joinData.room;
    let username = joinData.username;
    const broadcast = joinData.broadcast !== false;
    
    // Initialize room if needed
    if (!roomUsernames[room]) {
      roomUsernames[room] = new Set();
    }
    if (!roomUsers[room]) {
      roomUsers[room] = new Set();
    }
    
    // Leave previous room if any
    const previousRoom = rooms[socket.id];
    if (previousRoom && previousRoom !== room) {
      socket.leave(previousRoom);
      socket.to(previousRoom).emit('user_left', {
        groupId: socket.groupId || null,
        userId: socket.userId,
        userName: usernames[socket.id] || socket.userName,
        lastSeen: new Date().toISOString()
      });
      
      if (roomUsers[previousRoom]) {
        roomUsers[previousRoom].delete(socket.id);
        if (roomUsers[previousRoom].size === 0) {
          delete roomUsers[previousRoom];
        }
      }
      updateUserCount(previousRoom);
    }
    
    // Track user info
    rooms[socket.id] = room;
    usernames[socket.id] = username;
    roomUsers[room].add(socket.id);
    roomUsernames[room].add(username);
    
    // Join Socket.IO room
    socket.join(room);
    
    // Emit iTaskOrg-specific events
    socket.emit('join', { room: room, username: username });
    
    // Notify others in room
    socket.to(room).emit('user_joined', {
      groupId: groupId,
      userId: userId,
      userName: userName
    });
    
    // Also emit legacy event for backward compatibility
    if (broadcast) {
      socket.to(room).emit('userJoined', { room: room, username: username });
    }
    
    updateUserCount(room);
    log.info(`iTaskOrg: User ${userName} successfully joined room ${roomId}`);
  });
  
  // iTaskOrg: Leave room
  socket.on('leave_room', (data) => {
    const roomId = data.roomId || data.room;
    const groupId = data.groupId || socket.groupId;
    const userId = data.userId || socket.userId;
    const userName = socket.userName || usernames[socket.id] || 'Unknown';
    const room = roomId || rooms[socket.id];
    
    if (room && rooms[socket.id] === room) {
      log.info(`iTaskOrg: User ${userName} (${userId}) leaving room ${room}`);
      
      socket.leave(room);
      
      // Emit iTaskOrg-specific event
      socket.to(room).emit('user_left', {
        groupId: groupId,
        userId: userId,
        userName: userName,
        lastSeen: new Date().toISOString()
      });
      
      // Also emit legacy event
      socket.to(room).emit('receive', `Server: ${userName} left the chat`);
      
      // Clean up tracking
      if (roomUsers[room]) {
        roomUsers[room].delete(socket.id);
        if (roomUsers[room].size === 0) {
          delete roomUsers[room];
        }
      }
      
      if (roomUsernames[room]) {
        roomUsernames[room].delete(userName);
        if (roomUsernames[room].size === 0) {
          delete roomUsernames[room];
        }
      }
      
      updateUserCount(room);
    }
  });
  
  // iTaskOrg: Send message
  socket.on('send_message', (data) => {
    const roomId = data.roomId || data.room;
    const groupId = data.groupId || socket.groupId;
    const content = data.content || data.message;
    const userId = data.userId || socket.userId || socket.id;
    const userName = socket.userName || usernames[socket.id] || 'Unknown';
    const userRoom = rooms[socket.id];
    
    // Rate limiting
    if (isRateLimited(messageLimits, socket.id, config.maxMessagesPerWindow, config.rateLimitWindow)) {
      log.warn(`Message rate limit exceeded for user: ${userName} (${socket.id})`);
      socket.emit('message_error', 'You are sending messages too quickly. Please slow down.');
      return;
    }
    
    // Validate
    if (!validateInput(content, config.maxMessageLength)) {
      socket.emit('message_error', 'Message is empty or too long');
      return;
    }
    
    // Verify user is in the room
    if (userRoom === roomId && userName) {
      const sanitizedMessage = sanitizeMessage(content);
      
      const formattedMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        groupId: groupId,
        content: sanitizedMessage,
        message: sanitizedMessage, // For backward compatibility
        senderId: userId,
        userId: userId, // Alias
        createdBy: userId, // Alias
        userName: userName,
        senderName: userName, // Alias
        username: userName, // Legacy alias
        timestamp: data.timestamp || new Date().toISOString(),
        type: data.type || 'text',
        replyTo: data.replyTo || null,
        mentions: data.mentions || [],
        attachments: data.attachments || [],
        room: roomId
      };
      
      // Store in history
      if (!messageHistory[roomId]) {
        messageHistory[roomId] = [];
      }
      messageHistory[roomId].push(formattedMessage);
      
      if (messageHistory[roomId].length > config.maxMessageHistory) {
        messageHistory[roomId] = messageHistory[roomId].slice(-config.maxMessageHistory);
      }
      
      stats.totalMessages++;
      log.debug(`iTaskOrg message from ${userName} in ${roomId}: ${sanitizedMessage}`);
      
      // Emit iTaskOrg-specific event
      io.to(roomId).emit('message', formattedMessage);
      
      // Also emit legacy event for backward compatibility
      io.to(roomId).emit('receive', {
        id: formattedMessage.id,
        username: userName,
        message: sanitizedMessage,
        timestamp: formattedMessage.timestamp,
        room: roomId
      });
      
      socket.emit('message_sent', formattedMessage);
    } else {
      log.warn(`Invalid message attempt from ${socket.id} - not in room ${roomId}`);
      socket.emit('message_error', 'You must be in a room to send messages');
    }
  });
  
  
  // iTaskOrg: Get room users (presence)
  socket.on('get_room_users', (data) => {
    const roomId = data.roomId || data.room;
    const groupId = data.groupId || socket.groupId;
    
    if (roomId && roomUsers[roomId]) {
      const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
      const users = [];
      
      if (socketsInRoom) {
        socketsInRoom.forEach(socketId => {
          const socketData = io.sockets.sockets.get(socketId);
          if (socketData) {
            const userId = socketData.userId || socketId;
            const userName = socketData.userName || usernames[socketId] || 'Unknown';
            users.push({
              userId: userId,
              userName: userName,
              lastSeen: new Date().toISOString()
            });
          }
        });
      }
      
      // Emit iTaskOrg format
      socket.emit('room_users', {
        groupId: groupId,
        users: users
      });
    }
  });
  
  // iTaskOrg: Mark messages as read
  socket.on('mark_read', (data) => {
    const roomId = data.roomId || data.room;
    const groupId = data.groupId || socket.groupId;
    const userId = data.userId || socket.userId;
    const messageId = data.lastReadMessageId || data.messageId;
    
    if (roomId && userId && messageId) {
      // Broadcast read receipt to room
      socket.to(roomId).emit('message_receipt', {
        groupId: groupId,
        messageId: messageId,
        userId: userId,
        status: 'read'
      });
      
      log.debug(`iTaskOrg: User ${userId} marked message ${messageId} as read in room ${roomId}`);
    }
  });
  
  // iTaskOrg: System message support
  socket.on('system_message', (data) => {
    const roomId = data.roomId || data.room;
    const groupId = data.groupId || socket.groupId;
    const content = data.content || data.message;
    
    if (roomId && content) {
      const systemMsg = {
        id: `sys_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        groupId: groupId,
        content: content,
        type: 'system',
        systemEvent: data.eventType || 'system',
        timestamp: new Date().toISOString(),
        room: roomId
      };
      
      io.to(roomId).emit('system_message', systemMsg);
    }
  });

  // Handle background state
  socket.on('background', (data) => {
    console.log(`User ${data.username} in room ${data.room} went to background`);
    // Keep the connection but mark as inactive
    if (data.room && roomUsers[data.room]) {
      socket.backgroundState = true;
      updateUserCount(data.room);
    }
  });

  // Handle foreground state
  socket.on('foreground', (data) => {
    console.log(`User ${data.username} in room ${data.room} returned to foreground`);
    // Mark as active and refresh room state
    if (data.room && roomUsers[data.room]) {
      socket.backgroundState = false;
      updateUserCount(data.room);

      // Re-emit room information
      const roomInfo = {
        room: data.room,
        users: Array.from(roomUsernames[data.room] || []),
        count: roomUsers[data.room].size
      };
      socket.emit('room info', roomInfo);
    }
  });

  // Handle user disconnection
  socket.on('disconnect', () => {
    try {
      const room = rooms[socket.id];
      const username = usernames[socket.id];

      // Update statistics
      stats.currentConnections = Math.max(0, stats.currentConnections - 1);
      
      // Clean up rate limiting maps
      messageLimits.delete(socket.id);
      joinLimits.delete(socket.id);

      if (room) {
        log.info(`User ${username} disconnecting from room ${room}`);

        // Notify room before removing user (legacy)
        if (username) {
          io.to(room).emit('receive', `Server: ${username} left the chat`);
        }
        
        // Emit iTaskOrg-specific event
        const groupId = socket.groupId || null;
        const userId = socket.userId || socket.id;
        if (groupId) {
          io.to(room).emit('user_left', {
            groupId: groupId,
            userId: userId,
            userName: username,
            lastSeen: new Date().toISOString()
          });
        }

        // Remove from room tracking
        if (roomUsers[room]) {
          roomUsers[room].delete(socket.id);
          if (roomUsers[room].size === 0) {
            delete roomUsers[room];
            delete anonymousCount[room];
          }
        }

        // Remove from username tracking
        if (roomUsernames[room]) {
          roomUsernames[room].delete(username);
          if (roomUsernames[room].size === 0) {
            delete roomUsernames[room];
          }
        }

        // Update user count for the room (legacy)
        const sockets = io.sockets.adapter.rooms.get(room);
        const count = sockets ? sockets.size : 0;
        io.to(room).emit('user count', {
          total: count,
          active: roomUsers[room] ? roomUsers[room].size : 0,
          room: room
        });
        
        // Also emit iTaskOrg room_users update
        if (groupId) {
          const users = [];
          if (sockets) {
            sockets.forEach(socketId => {
              const socketData = io.sockets.sockets.get(socketId);
              if (socketData) {
                users.push({
                  userId: socketData.userId || socketId,
                  userName: socketData.userName || usernames[socketId] || 'Unknown',
                  lastSeen: new Date().toISOString()
                });
              }
            });
          }
          io.to(room).emit('room_users', {
            groupId: groupId,
            users: users
          });
        }
      }

      // Clean up user tracking
      delete rooms[socket.id];
      delete usernames[socket.id];

      log.info(`User disconnected: ${socket.id}${username ? ` (${username})` : ''}`);
    } catch (error) {
      log.error('Error handling disconnect:', error);
    }
  });

  // Handle connection errors
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});

// Error handling for the server
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please try a different port.`);
  } else {
    console.error('Server error:', error);
  }
});

io.on('error', (error) => {
  console.error('Socket.IO error:', error);
});

// Start the server
const PORT = process.env.PORT || 3000;
const networkInterfaces = os.networkInterfaces();

server.listen(PORT, '0.0.0.0', () => {
  console.log('\nServer is running and accessible at:');
  console.log(`- Local: http://localhost:${PORT}`);

  // Log all network interfaces
  Object.keys(networkInterfaces).forEach((interfaceName) => {
    networkInterfaces[interfaceName].forEach((interface) => {
      // Skip internal and non-IPv4 addresses
      if (!interface.internal && interface.family === 'IPv4') {
        console.log(`- Network: http://${interface.address}:${PORT}`);
      }
    });
  });

  console.log(`\nStatic files served from: ${staticDir}`);
  console.log('\nTo access from other devices on the network, use any of the Network URLs listed above.');
  
  log.info('Server started successfully');
  log.info(`Configuration: ${JSON.stringify({ 
    port: config.port, 
    maxConnections: config.maxConnectionsPerIP,
    maxMessageLength: config.maxMessageLength,
    rateLimitWindow: config.rateLimitWindow,
    enableSpamProtection: config.enableSpamProtection
  })}`);
});

// Periodic cleanup tasks
setInterval(() => {
  const now = Date.now();
  
  // Clean up expired rate limits
  for (const [key, limit] of connectionLimits.entries()) {
    if (now > limit.resetTime) {
      connectionLimits.delete(key);
    }
  }
  
  for (const [key, limit] of messageLimits.entries()) {
    if (now > limit.resetTime) {
      messageLimits.delete(key);
    }
  }
  
  for (const [key, limit] of joinLimits.entries()) {
    if (now > limit.resetTime) {
      joinLimits.delete(key);
    }
  }
  
  // Log statistics periodically
  if (config.logLevel === 'debug') {
    log.debug(`Active connections: ${stats.currentConnections}, Rate limit maps: connection(${connectionLimits.size}), message(${messageLimits.size}), join(${joinLimits.size})`);
  }
}, 300000); // Every 5 minutes

// Calculate messages per minute
setInterval(() => {
  const oneMinuteAgo = Date.now() - 60000;
  let recentMessages = 0;
  
  Object.values(messageHistory).forEach(history => {
    recentMessages += history.filter(msg => 
      new Date(msg.timestamp).getTime() > oneMinuteAgo
    ).length;
  });
  
  stats.messagesPerMinute = recentMessages;
}, 60000); // Every minute

// Graceful shutdown
process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    log.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    log.info('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
