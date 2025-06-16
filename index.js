const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const path = require("path");
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
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
  console.log("New user connected:", socket.id);

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
      if (username === 'Anonymous' && usernames[socket.id] && usernames[socket.id].startsWith('Anonymous')) {
        username = usernames[socket.id];
      } else if (roomUsernames[room].has(username)) {
        // Handle duplicate usernames
        if (username.startsWith('Anonymous')) {
          let counter = anonymousCount[room] + 1;
          while (roomUsernames[room].has(`Anonymous${counter}`)) {
            counter++;
          }
          username = `Anonymous${counter}`;
          anonymousCount[room] = counter;
        } else {
          // For non-anonymous users, reject the connection
          socket.emit("username_taken", username);
          return;
        }
      }
      console.log(`User ${username} (${socket.id}) attempting to join room ${room}`);

      // Leave previous room if any
      const previousRoom = rooms[socket.id];
      if (previousRoom && previousRoom !== room) {
        socket.leave(previousRoom);
        socket.to(previousRoom).emit("recieve", `Server: ${usernames[socket.id]} left the chat`);

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
        socket.to(room).emit("userJoined", { room: room, username: username });
      }

      // Update user count
      updateUserCount(room);

      console.log(`User ${username} successfully joined room ${room}`);
    } else {
      console.log("Invalid join attempt - missing username or room");
      socket.emit("recieve", "Server: Error - Username and room are required");
    }
  });

  // Handle user leaving a room
  socket.on("leave", (room) => {
    if (room && rooms[socket.id] === room) {
      const username = usernames[socket.id];

      socket.leave(room);
      socket.to(room).emit("recieve", `Server: ${username} left the chat`);

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
    const message = typeof data === 'object' ? data.message : arguments[1];

    // Verify user is in the room they're trying to send to
    if (userRoom === room && username) {
      // Validate message is not empty
      if (!message || !message.trim()) {
        socket.emit("message_error", "Empty messages are not allowed");
        return;
      }

      const formattedMessage = {
        username: username,
        message: message,
        timestamp: new Date().toISOString()
      };

      console.log(`Message from ${username} in ${room}: ${message}`);
      
      // Send to everyone in the room including sender
      io.to(room).emit("receive", formattedMessage);
      
      // Send confirmation back to sender
      socket.emit("message_sent", formattedMessage);
    } else {
      console.log(`Invalid message attempt from ${socket.id} - not in room ${room}`);
      socket.emit("message_error", "You must be in a room to send messages");
    }
  });

  // Handle typing indicators
  socket.on('typing', (room, username) => {
    const userRoom = rooms[socket.id];
    if (userRoom === room && usernames[socket.id] === username) {
      // Broadcast to everyone in the room except the sender
      socket.to(room).emit('typing', room, username);
    }
  });

  socket.on('stop typing', (room, username) => {
    const userRoom = rooms[socket.id];
    if (userRoom === room && usernames[socket.id] === username) {
      // Broadcast to everyone in the room except the sender
      socket.to(room).emit('stop typing', room, username);
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

  // Handle user disconnection
  socket.on('disconnect', () => {
    try {
      const room = rooms[socket.id];
      const username = usernames[socket.id];
      
      if (room) {
        console.log(`User ${username} disconnecting from room ${room}`);
        
        // Notify room before removing user
        if (username) {
          io.to(room).emit('receive', `Server: ${username} left the chat`);
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

        // Update user count for the room
        const sockets = io.sockets.adapter.rooms.get(room);
        const count = sockets ? sockets.size : 0;
        io.to(room).emit('user count', {
          total: count,
          active: roomUsers[room] ? roomUsers[room].size : 0,
          room: room
        });
      }

      // Clean up user tracking
      delete rooms[socket.id];
      delete usernames[socket.id];
      
      console.log(`User disconnected: ${socket.id}${username ? ` (${username})` : ''}`);
    } catch (error) {
      console.error('Error handling disconnect:', error);
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
});