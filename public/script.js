var socket;
var usernameInput;
var chatIDInput;
var messageInput;
var messageContainer;
var chatRoom;
var totalUsers;
var messageForm;
var currentRoom = null;
var currentUsername = null;
var savedRooms = [];
var connectedUsers = 0;
var savedTheme = ""; // In-memory theme storage
var messageSound = new Audio('Ding.mp3'); // Audio for message notifications

// Function to play message sound
function playMessageSound() {
  messageSound.currentTime = 0; // Reset the audio to start
  messageSound.play().catch(error => console.log('Error playing sound:', error));
}

// The anonymous counter is now handled by the server

function onload() {
  console.log("Starting application initialization...");

  // Initialize elements
  usernameInput = document.getElementById("NameInput");
  messageInput = document.getElementById("messageInput");
  messageContainer = document.getElementById("messageContainer");
  chatRoom = document.getElementById("RoomID");
  totalUsers = document.getElementById("totalUser");
  messageForm = document.getElementById("messageForm");

  // Load saved rooms from memory and theme
  loadSavedRooms();
  loadSavedTheme();
  populateRoomList();

  // Load saved username if any
  loadUsernameFromSession();

  // Initialize socket connection
  initializeSocket();

  // Wait for socket connection before attempting to join room
  if (socket) {
    if (socket.connected) {
      console.log("Socket already connected, loading session...");
      loadRoomFromSession();
    } else {
      console.log("Waiting for socket connection...");
      socket.once('connect', () => {
        console.log("Socket connected, loading session...");
        loadRoomFromSession();
      });
    }
  }

  console.log("Chat application loaded");

  // Add event listeners
  if (messageForm) {
    messageForm.addEventListener("submit", function(e) {
      e.preventDefault();
      sendMessage();
    });
  }

  // Add event listeners for theme buttons
  document.querySelectorAll(".theme-btn").forEach((button) => {
    button.addEventListener("click", function() {
      const themeName = this.dataset.theme;
      applyTheme(themeName);

      // Update active state on buttons
      document
        .querySelectorAll(".theme-btn")
        .forEach((btn) => btn.classList.remove("active"));
      this.classList.add("active");

      // Emit theme change to server if connected
      if (socket && socket.connected && currentUsername && currentRoom) {
        socket.emit("user theme", {
          theme: themeName,
          username: currentUsername,
          roomId: currentRoom,
        });
      }
    });
  });

  // Theme toggle button functionality
  const themeToggle = document.querySelector(".theme-toggle");
  const themeSelector = document.querySelector(".theme-selector");

  if (themeToggle && themeSelector) {
    // Toggle theme selector on click (for mobile devices)
    themeToggle.addEventListener("click", function(e) {
      e.stopPropagation();
      themeSelector.style.display =
        themeSelector.style.display === "block" ? "none" : "block";
    });

    // Close theme selector when clicking outside
    document.addEventListener("click", function(e) {
      if (!themeSelector.contains(e.target) && e.target !== themeToggle) {
        themeSelector.style.display = "none";
      }
    });
  }

  // Add keyboard shortcuts
  document.addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
      if (event.target === messageInput && currentRoom) {
        event.preventDefault();
        sendMessage();
      } else if (event.target === usernameInput) {
        event.preventDefault();
        Connect();
      } else if (event.target === document.getElementById("newRoomName")) {
        event.preventDefault();
        createNewRoom();
      }
    }
    if (event.key === "Escape") {
      closeSidebar();
      closeAddRoomModal();
    }
  });

  // Initialize typing indicator
  initializeTypingIndicator();

  // Initialize emoji picker
  initializeEmojiPicker();

  // --- Enhanced session persistence ---
  loadSession();
}

// Sidebar Functions
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const hamburger = document.getElementById("hamburgerBtn");

  if (sidebar) sidebar.classList.toggle("active");
  if (overlay) overlay.classList.toggle("active");
  if (hamburger) hamburger.classList.toggle("active");
}

function closeSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const hamburger = document.getElementById("hamburgerBtn");

  if (sidebar) sidebar.classList.remove("active");
  if (overlay) overlay.classList.remove("active");
  if (hamburger) hamburger.classList.remove("active");
}

// Room Management Functions
function loadSavedRooms() {
  // Initialize with some default rooms if none exist
  if (savedRooms.length === 0) {
    savedRooms = [
      { name: "General", users: 0, messages: 0, icon: "💬" },
      { name: "Tech Talk", users: 0, messages: 0, icon: "💻" },
      { name: "Random", users: 0, messages: 0, icon: "🎲" },
      { name: "Gaming", users: 0, messages: 0, icon: "🎮" },
      { name: "Music", users: 0, messages: 0, icon: "🎵" },
    ];
  }
  console.log("Loaded saved rooms:", savedRooms);
}

function populateRoomList() {
  const roomList = document.getElementById("roomList");
  if (!roomList) {
    console.error("Room list element not found");
    return;
  }

  console.log("Populating room list with:", savedRooms);
  roomList.innerHTML = "";

  savedRooms.forEach((room, index) => {
    const roomItem = document.createElement("li");
    roomItem.className = "room-item";

    // Highlight the current room
    if (currentRoom === room.name) {
      roomItem.classList.add("active");
      console.log("Highlighting active room:", room.name);
    }

    // Create room item HTML
    roomItem.innerHTML = `
      <div class="room-link" onclick="joinRoom('${escapeHtml(room.name)}')">
        <div class="room-info">
          <div class="room-icon">${room.icon}</div>
          <div class="room-details">
            <div class="room-name">${escapeHtml(room.name)}</div>
            <div class="room-users">${room.users} users • ${room.messages} messages</div>
          </div>
        </div>
        <div class="room-actions">
          <button class="room-action" onclick="event.stopPropagation(); deleteRoom(${index})" title="Delete room">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `;

    roomList.appendChild(roomItem);
  });

  // Log the current room for debugging
  if (currentRoom) {
    console.log("Current room in populateRoomList:", currentRoom);
  }
}

// --- Debounce join requests ---
let joinRoomTimeout = null;
let joinRoomInProgress = false;
function joinRoom(roomName) {
  if (joinRoomInProgress) return;
  if (!socket || !roomName) {
    console.error("Cannot join room: socket or room name is missing");
    return;
  }
  if (!socket.connected) {
    console.error("Cannot join room: socket is not connected");
    showFeedbackMessage("Cannot join room: not connected to server");
    return;
  }
  if (joinRoomTimeout) clearTimeout(joinRoomTimeout);
  joinRoomInProgress = true;
  try {
    if (currentRoom === roomName) {
      showFeedbackMessage(`You are already connected to "${roomName}"`, true);
      populateRoomList();
      if (chatRoom) {
        chatRoom.innerHTML = `Chatroom: <span class='connected'>${escapeHtml(roomName)}</span>`;
        chatRoom.classList.add('flash-highlight');
        setTimeout(() => {
          chatRoom.classList.remove('flash-highlight');
        }, 2000);
      }
      setTimeout(() => { closeSidebar(); }, 1500);
      if (messageInput) messageInput.focus();
      joinRoomInProgress = false;
      return;
    }
    if (currentRoom) {
      socket.emit("leave", { room: currentRoom, username: currentUsername });
    }
    currentUsername = usernameInput.value || "Anonymous";
    // Show loading spinner
    if (chatRoom) {
      chatRoom.innerHTML = `<span class='spinner'></span> <span class='connecting'>Joining ${escapeHtml(roomName)}...</span>`;
    }
    socket.emit("join", {
      room: roomName,
      username: currentUsername,
      broadcast: true
    });
    closeSidebar();
    closeAddRoomModal();
    if (messageInput) messageInput.focus();
    joinRoomTimeout = setTimeout(() => { joinRoomInProgress = false; }, 1000);
  } catch (error) {
    joinRoomInProgress = false;
    console.error("Error joining room:", error);
    showFeedbackMessage("Failed to join room: " + error.message);
  }
}

// --- Modularized join confirmation handler ---
function handleJoinConfirmation(data) {
  if (data && data.room && data.username) {
    currentRoom = data.room;
    currentUsername = data.username;
    saveSession(currentUsername, currentRoom);
    if (chatRoom) {
      chatRoom.innerHTML = `Chatroom: <span class='connected'>${escapeHtml(data.room)}</span>`;
      chatRoom.classList.add('flash-highlight');
      setTimeout(() => {
        chatRoom.classList.remove('flash-highlight');
      }, 1200);
    }
    showFeedbackMessage(`Connected to "${escapeHtml(data.room)}" as ${escapeHtml(data.username)}`, true);
    populateRoomList();
    if (messageInput) messageInput.focus();
    joinRoomInProgress = false;
  }
}

// --- Spinner CSS (inject if not present) ---
if (!document.getElementById('spinner-style')) {
  const style = document.createElement('style');
  style.id = 'spinner-style';
  style.innerHTML = `
    .spinner {
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 3px solid #ccc;
      border-top: 3px solid #4CAF50;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      vertical-align: middle;
      margin-right: 8px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

function showAddRoomModal() {
  const modal = document.getElementById("addRoomModal");
  const input = document.getElementById("newRoomName");
  if (modal) modal.classList.add("active");
  if (input) input.focus();
}

function closeAddRoomModal() {
  const modal = document.getElementById("addRoomModal");
  const input = document.getElementById("newRoomName");
  if (modal) modal.classList.remove("active");
  if (input) input.value = "";
}

function createNewRoom() {
  const input = document.getElementById("newRoomName");
  if (!input) return;

  const roomName = input.value.trim();

  if (!roomName) {
    alert("Please enter a room name");
    return;
  }

  if (
    savedRooms.some(
      (room) => room.name.toLowerCase() === roomName.toLowerCase()
    )
  ) {
    alert("A room with this name already exists");
    return;
  }

  // Create new room
  const roomIcons = [
    "💬",
    "💻",
    "🎲",
    "🎮",
    "🎵",
    "📚",
    "🌟",
    "🔥",
    "⚡",
    "🎨",
  ];
  const randomIcon = roomIcons[Math.floor(Math.random() * roomIcons.length)];

  const newRoom = {
    name: roomName,
    users: 1,
    messages: 0,
    icon: randomIcon,
  };

  savedRooms.unshift(newRoom); // Add to beginning of array
  populateRoomList();
  closeAddRoomModal();

  // Auto-join the new room
  setTimeout(() => {
    joinRoom(roomName);
  }, 300);
}

function deleteRoom(index) {
  if (confirm("Are you sure you want to delete this room?")) {
    const deletedRoom = savedRooms[index];
    const roomName = deletedRoom.name;

    // If we're currently in the deleted room, disconnect first
    if (currentRoom === roomName) {
      // Leave the room on the server and notify about deletion
      if (socket && socket.connected) {
        socket.emit("leave", { room: roomName, username: currentUsername });
        socket.emit("room_deleted", { room: roomName });  // Add notification about room deletion
      }

      // Update UI
      currentRoom = null;
      if (chatRoom) {
        chatRoom.innerHTML = "Chatroom: <span class='disconnected'>Not Connected</span>";
      }
      if (totalUsers) {
        totalUsers.textContent = "Users Online: 0";
      }

      // Clear message container
      if (messageContainer) {
        messageContainer.innerHTML = "";
      }

      addMessage("System", "Room was deleted. Please join another room.", "left");
    } else {
      // If we're not in the room being deleted, just notify server about deletion
      if (socket && socket.connected) {
        socket.emit("room_deleted", { room: roomName });
      }
    }

    // Remove room from saved rooms
    savedRooms.splice(index, 1);
    populateRoomList();
  }
}

// --- Enhanced session persistence ---
function saveSession(username, room) {
  if (username) sessionStorage.setItem('currentUsername', username);
  if (room) sessionStorage.setItem('currentRoom', room);
}

function loadSession() {
  const savedUsername = sessionStorage.getItem('currentUsername');
  const savedRoom = sessionStorage.getItem('currentRoom');
  if (savedUsername && usernameInput) {
    usernameInput.value = savedUsername;
    currentUsername = savedUsername;
  }
  if (savedRoom) {
    joinRoom(savedRoom);
  }
}

// Connect function - now simply calls joinRoom
function Connect() {
  var username = usernameInput ? usernameInput.value.trim() : "";
  var roomID = currentRoom;

  // Handle anonymous users
  if (!username || username === "Anonymous") {
    // Just use "Anonymous" and let the server handle the numbering
    username = "Anonymous";
    // Update the input field after server response with the correct number
  }

  if (!roomID) {
    showFeedbackMessage("Please select a room from the sidebar");
    return;
  }

  // Update the UI immediately to show we're trying to connect
  if (chatRoom) {
    chatRoom.innerHTML =
      "Chatroom: <span class='connecting'>Connecting to " +
      escapeHtml(roomID) +
      "...</span>";
  }

  // Update local variables
  currentUsername = username;
  saveUsernameToSession(username);

  // Update UI to show connecting status
  if (chatRoom) {
    chatRoom.innerHTML =
      "Chatroom: <span class='connecting'>Connecting to " +
      escapeHtml(roomID) +
      "...</span>";
  }

  // Emit join event to server
  if (socket && socket.connected) {
    // Update room in saved rooms list if it exists
    let roomExists = false;
    for (let i = 0; i < savedRooms.length; i++) {
      if (savedRooms[i].name === roomID) {
        roomExists = true;
        break;
      }
    }

    // Add room to saved rooms if it doesn't exist
    if (!roomExists) {
      const roomIcons = [
        "💬",
        "💻",
        "🎲",
        "🎮",
        "🎵",
        "📚",
        "🌟",
        "🔥",
        "⚡",
        "🎨",
      ];
      const randomIcon =
        roomIcons[Math.floor(Math.random() * roomIcons.length)];

      savedRooms.push({
        name: roomID,
        users: 1,
        messages: 0,
        icon: randomIcon,
      });
    }

    // Update the room list to show the current room as active
    populateRoomList();

    // Emit join event to server
    if (!roomID || !username) {
      showFeedbackMessage("Error: Username and room are required");
      return;
    }

    // Emit join event with broadcast flag
    socket.emit("join", {
      room: roomID,
      username: username,
      broadcast: true, // This tells the server to broadcast to other users
    });
  } else {
    showFeedbackMessage(
      "Error: Not connected to server. Please refresh the page."
    );
    if (chatRoom) {
      chatRoom.innerHTML =
        "Chatroom: <span class='disconnected'>Not Connected</span>";
    }
  }

  // Focus on message input
  if (messageInput) messageInput.focus();
}

function sendMessage() {
  const message = messageInput.value.trim();

  if (!message) {
    showFeedbackMessage("Cannot send empty messages");
    return;
  }

  if (!currentRoom) {
    showFeedbackMessage("Please connect to a room first from the sidebar");
    return;
  }

  if (!socket || !socket.connected) {
    showFeedbackMessage("Error: Not connected to server");
    return;
  }

  try {
    // Send message to server
    socket.emit("send", {
      room: currentRoom,
      message: message
    });

    // Clear input field immediately
    messageInput.value = "";
    messageInput.focus();

    // Play sound
    playMessageSound();

    // Update room message count
    const roomEntry = savedRooms.find(room => room.name === currentRoom);
    if (roomEntry) {
      roomEntry.messages = (roomEntry.messages || 0) + 1;
      populateRoomList();
    }
  } catch (error) {
    console.error("Error sending message:", error);
    showFeedbackMessage("Failed to send message. Please try again.");
  }
}

function addMessage(username, message, side) {
  if (!messageContainer) return;

  // Extract actual message content for user messages
  let displayMessage = message;
  let displayUsername = username;

  if (!username.startsWith('System') && message.includes(': ')) {
    const parts = message.split(': ');
    displayUsername = parts[0];
    displayMessage = parts.slice(1).join(': ');
  }

  // Handle system messages
  if (username === "System") {
    const isJoinMessage = message.includes("Welcome to") || message.includes("joined the chat");
    showFeedbackMessage(message, isJoinMessage);
    if (!isJoinMessage) return; // Don't show other system messages in chat
  }

  // Create message element
  const messageElement = document.createElement("li");
  messageElement.className = "message" + (side === "left" ? "Left" : "Right");

  // Get current time in user's timezone
  const timeString = moment().format("hh:mm A");

  // Create message content
  messageElement.innerHTML = `
        <p class="messageText">
            ${escapeHtml(displayMessage)}
            <span>${escapeHtml(displayUsername)} ● ${timeString}</span>
        </p>
    `;

  // Add message to container
  messageContainer.appendChild(messageElement);

  // Auto-scroll to bottom
  messageContainer.scrollTop = messageContainer.scrollHeight;

  // Keep only last 50 messages
  const messages = messageContainer.getElementsByClassName('message' + (side === "left" ? "Left" : "Right"));
  while (messages.length > 50) {
    messages[0].remove();
  }
}

// Hide empty message or any object inside
document.querySelectorAll('.messageText').forEach(msg => {
  const span = msg.querySelector('span');
  if (!msg.textContent.trim() || (span && !span.textContent.trim())) {
    const li = msg.closest('li');
    if (li) li.style.display = 'none';
  }
});

// Function to show feedback message in the feedback element
function showFeedbackMessage(message, isPersistent) {
  if (!messageContainer) return;

  // Create a new feedback element for each message to allow multiple messages
  var feedbackId = "feedback_" + Date.now();
  var feedbackElement = document.getElementById(feedbackId);
  var feedbackContainer = null;

  // Always create a new feedback element for join messages
  if (isPersistent || !feedbackElement) {
    // First check if there's already a messageFeedback container
    var existingFeedbacks = document.getElementsByClassName("messageFeedback");
    if (existingFeedbacks.length > 0) {
      feedbackContainer = existingFeedbacks[0];
      // Don't clear existing content for persistent messages
      if (!isPersistent) {
        feedbackContainer.innerHTML = "";
      }
    } else {
      // Create new container
      feedbackContainer = document.createElement("li");
      feedbackContainer.className = "messageFeedback";
      messageContainer.appendChild(feedbackContainer);
    }

    // Create the feedback paragraph with unique ID
    feedbackElement = document.createElement("p");
    feedbackElement.id = feedbackId;
    feedbackElement.style.padding = "8px";
    feedbackElement.style.margin = "4px 0";

    // Apply special styling for persistent messages like join notifications
    if (isPersistent) {
      if (message.includes("joined")) {
        feedbackElement.style.backgroundColor = "rgba(0, 255, 0, 0.1)";
        feedbackElement.style.borderLeft = "3px solid #4CAF50";
      } else if (message.includes("left")) {
        feedbackElement.style.backgroundColor = "rgba(255, 0, 0, 0.1)";
        feedbackElement.style.borderLeft = "3px solid #f44336";
      }
    }
    feedbackContainer.appendChild(feedbackElement);
  } else {
    // Get the parent container
    feedbackContainer = feedbackElement.closest(".messageFeedback");
  }

  // Make sure the container is visible
  if (feedbackContainer) {
    feedbackContainer.style.display = "block";
  }

  // Set the message
  feedbackElement.textContent = message;

  // Add a data attribute to mark if this is persistent
  if (isPersistent) {
    feedbackElement.dataset.persistent = "true";
  }

  // Ensure the message container scrolls to show the feedback
  messageContainer.scrollTop = messageContainer.scrollHeight;

  // Auto-remove after 5 seconds for non-persistent messages
  if (!isPersistent) {
    setTimeout(function() {
      if (feedbackElement && document.body.contains(feedbackElement)) {
        // Only remove if it's not marked as persistent
        if (!feedbackElement.dataset.persistent) {
          feedbackElement.remove();
          // If the feedback container is empty, hide it
          if (feedbackContainer && feedbackContainer.children.length === 0) {
            feedbackContainer.style.display = "none";
          }
        }
      }
    }, 5000);
  }
}

function initializeTypingIndicator() {
  if (!messageInput) return;

  let typingTimeout;

  // Add input event listener to message input
  messageInput.addEventListener("input", function() {
    if (currentRoom && socket && socket.connected && currentUsername) {
      // Emit typing event
      socket.emit("typing", currentRoom, currentUsername);

      // Clear previous timeout
      clearTimeout(typingTimeout);

      // Set timeout to stop typing indicator after 2 seconds of inactivity
      typingTimeout = setTimeout(function() {
        if (socket && socket.connected) {
          socket.emit("stop typing", currentRoom, currentUsername);
        }
      }, 2000);
    }
  });

  // Add focus and blur events to the message input
  messageInput.addEventListener("focus", function() {
    // When input is focused, show typing indicators if any
    if (currentRoom && socket && socket.connected) {
      // Re-enable typing indicators
      document.body.classList.add("typing-enabled");
    }
  });

  messageInput.addEventListener("blur", function() {
    // When input loses focus, hide all typing indicators
    document.body.classList.remove("typing-enabled");

    // Remove all typing indicators
    var typingElements = document.querySelectorAll(
      ".messageFeedback[data-user]"
    );
    typingElements.forEach(function(element) {
      if (!element.querySelector("#feedback")) {
        // Don't remove feedback messages
        element.style.display = "none";
      }
    });

    // Also emit stop typing
    if (currentRoom && socket && socket.connected && currentUsername) {
      socket.emit("stop typing", currentRoom, currentUsername);
      if (typingTimeout) clearTimeout(typingTimeout);
    }
  });
}

function showTypingIndicator(username) {
  if (!messageContainer) return;

  // Don't show typing indicator for current user
  if (username === currentUsername) return;

  // Remove existing typing indicator for this user
  removeTypingIndicator(username);

  // Check if there's already a feedback message
  var feedbackElement = document.getElementById("feedback");
  if (feedbackElement) {
    // Don't show typing indicator if there's a persistent system feedback message
    if (feedbackElement.dataset.persistent === "true") {
      return;
    }
  }

  // Create typing indicator
  var typingElement = document.createElement("li");
  typingElement.className = "messageFeedback";
  typingElement.dataset.user = username; // Store username for later removal

  // Create the typing indicator with animated dots
  typingElement.innerHTML =
    '<p class="feedback">' +
    '<div class="loader">' +
    escapeHtml(username) +
    " is typing <span></span><span></span><span></span></div>" +
    "</p>";

  messageContainer.appendChild(typingElement);
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

function removeTypingIndicator(username) {
  var typingElements = document.querySelectorAll(".messageFeedback");

  typingElements.forEach(function(element) {
    // Only remove typing indicators that have a user data attribute
    // and match the specified username
    if (element.dataset.user && element.dataset.user === username) {
      // Check if this element contains the feedback element
      var feedbackElement = element.querySelector("#feedback");
      if (!feedbackElement) {
        element.remove();
      }
    }
  });
}

function resetRoomCounters(roomName) {
  for (let i = 0; i < savedRooms.length; i++) {
    if (savedRooms[i].name === roomName) {
      savedRooms[i].users = 0;
      savedRooms[i].messages = 0;
      break;
    }
  }
  populateRoomList();
}

function escapeHtml(text) {
  if (typeof text !== "string") return "";

  var map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, function(m) {
    return map[m];
  });
}

// Function to save username to session storage
function saveUsernameToSession(username) {
  if (username) {
    sessionStorage.setItem('currentUsername', username);
    console.log('Username saved to session:', username);
  }
}

// Function to load username from session storage
function loadUsernameFromSession() {
  const savedUsername = sessionStorage.getItem('currentUsername');
  if (savedUsername) {
    currentUsername = savedUsername;
    if (usernameInput) {
      usernameInput.value = savedUsername;
    }
    console.log('Username loaded from session:', savedUsername);
    return savedUsername;
  }
  return null;
}

// Socket.io Connection
function initializeSocket() {
  try {
    socket = io(window.location.origin);

    socket.on("connect", () => {
      console.log("Connected to server");
      showFeedbackMessage("Connected to server", true);
    });

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      showFeedbackMessage("Connection error: " + error.message);
    });

    socket.on("disconnect", (reason) => {
      console.log("Disconnected:", reason);
      showFeedbackMessage("Disconnected from server: " + reason);
      if (chatRoom) {
        chatRoom.innerHTML = "Chatroom: <span class='disconnected'>Disconnected</span>";
      }
      if (totalUsers) {
        totalUsers.textContent = "Users Online: 0";
      }
      setTimeout(() => {
        if (!socket.connected) {
          socket.connect();
        }
      }, 5000);
    });

    // Handle username taken error
    socket.on("username_taken", (username) => {
      console.log("Username taken:", username);
      showFeedbackMessage(`Username \"${username}\" is already taken in this room`);
    });

    // Handle join confirmation from server
    socket.on("join", handleJoinConfirmation);
  } catch (error) {
    console.error("Error initializing socket:", error);
    showFeedbackMessage("Failed to initialize connection: " + error.message);
  }
}

// Function to update room in saved rooms list
function updateRoomInList(roomName) {
  if (!roomName) return;

  // Find existing room or add new one
  let roomEntry = savedRooms.find(r => r.name === roomName);
  if (!roomEntry) {
    roomEntry = {
      name: roomName,
      users: 0,
      messages: 0,
      icon: '💬',
      timestamp: new Date().toISOString()
    };
    savedRooms.push(roomEntry);
    saveSavedRooms();
  }
}

// Theme switching functionality - using in-memory storage instead of localStorage
function loadSavedTheme() {
  applyTheme(savedTheme);

  // Mark the active theme button
  document.querySelectorAll(".theme-btn").forEach((button) => {
    if (button.dataset.theme === savedTheme) {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
  });
}

function applyTheme(themeName) {
  // Remove any existing theme classes
  document.body.className = document.body.className
    .replace(/theme-\w+/g, "")
    .trim();

  // Add the new theme class if it's not the default theme
  if (themeName) {
    document.body.classList.add(themeName);
  }

  // Save the theme preference in memory
  savedTheme = themeName || "";
}

// Emoji Picker Initialization
let pickerInstance = null;

function initializeEmojiPicker() {
  try {
    const rootElement = document.querySelector('#emoji-picker-container');
    const emojiButton = document.querySelector('#emoji-button');
    const messageForm = document.querySelector('#messageForm');

    if (!pickerInstance) {
      // Create the picker instance
      pickerInstance = window.picmo.createPicker({
          rootElement,
          showPreview: true,
          showRecents: true,
          maxRecents: 16,
          theme: document.body.classList.contains('theme-dark') ? 'dark' : 'light',
          styleProperties: {
              '--border-radius': '8px',
              '--category-tab-height': '40px',
          }
      });

      // Handle emoji selection
      pickerInstance.addEventListener('emoji:select', event => {
          const messageInput = document.querySelector('#messageInput');
          if (messageInput) {
              const cursorPos = messageInput.selectionStart;
              const textBeforeCursor = messageInput.value.substring(0, cursorPos);
              const textAfterCursor = messageInput.value.substring(cursorPos);
              messageInput.value = textBeforeCursor + event.emoji + textAfterCursor;
              // Set cursor position after the inserted emoji
              messageInput.selectionStart = cursorPos + event.emoji.length;
              messageInput.selectionEnd = cursorPos + event.emoji.length;
              messageInput.focus();
          }
          // Keep the picker open after selection
      });
    }

    // Toggle emoji picker visibility
    emojiButton.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent document click from immediately closing
      const isVisible = rootElement.classList.contains('visible');
      if (!isVisible) {
          rootElement.classList.add('visible');
          messageForm.classList.add('emoji-visible');
          emojiButton.classList.add('active');
      } else {
          rootElement.classList.remove('visible');
          messageForm.classList.remove('emoji-visible');
          emojiButton.classList.remove('active');
      }
    });

    // Close emoji picker when clicking outside
    document.addEventListener('click', (event) => {
      if (!event.target.closest('#emoji-picker-container') && 
          !event.target.closest('#emoji-button')) {
          rootElement.classList.remove('visible');
          messageForm.classList.remove('emoji-visible');
          emojiButton.classList.remove('active');
      }
    });
  } catch (error) {
    console.error('Error initializing emoji picker:', error);
  }
}

function toggleEmojiPicker(show) {
  const container = document.querySelector('#emoji-picker-container');
  if (container) {
    if (show === undefined) {
      container.classList.toggle('visible');
    } else {
      container.classList.toggle('visible', show);
    }
  }
}

// Session storage functions for room persistence
function saveRoomToSession(roomName) {
  try {
    sessionStorage.setItem('currentRoom', roomName);
    sessionStorage.setItem('currentUsername', usernameInput.value);
  } catch (e) {
    console.error('Error saving to sessionStorage:', e);
  }
}

function loadRoomFromSession() {
  try {
    const roomName = sessionStorage.getItem('currentRoom');
    const username = sessionStorage.getItem('currentUsername');

    if (roomName && username) {
      // Set the username if it exists
      if (usernameInput && username) {
        usernameInput.value = username;
        currentUsername = username;
      }

      // Join the room if it exists
      if (roomName) {
        joinRoom(roomName);
      }
    }
  } catch (e) {
    console.error('Error loading from sessionStorage:', e);
  }
}

function clearRoomSession() {
  try {
    sessionStorage.removeItem('currentRoom');
    sessionStorage.removeItem('currentUsername');
  } catch (e) {
    console.error('Error clearing sessionStorage:', e);
  }
}

function updateTotalUsers(count) {
  if (totalUsers) {
    if (typeof count === 'number') {
      connectedUsers = count;
      totalUsers.textContent = `Users Online: ${count}`;
    } else if (count && typeof count === 'object') {
      connectedUsers = count.active;
      totalUsers.textContent = `Users Online: ${count.active}`;

      // Update room list if available
      const roomEntry = savedRooms.find(r => r.name === count.room);
      if (roomEntry) {
        roomEntry.users = count.active;
        populateRoomList();
      }
    } else {
      totalUsers.textContent = `Users Online: ${connectedUsers}`;
    }
  }
}

// Add visibility change handling
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Tab is hidden
        console.log('Tab hidden, marking connection as background');
        if (socket && socket.connected) {
            socket.emit('background', { room: currentRoom, username: currentUsername });
        }
    } else {
        // Tab is visible again
        console.log('Tab visible, checking connection');
        if (socket) {
            if (!socket.connected) {
                console.log('Reconnecting after tab becomes visible');
                socket.connect();
            } else if (currentRoom && currentUsername) {
                console.log('Refreshing room state');
                socket.emit('foreground', { room: currentRoom, username: currentUsername });
            }
        }
    }
});
