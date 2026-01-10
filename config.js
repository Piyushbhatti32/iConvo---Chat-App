// Configuration file for iConvo Chat Application
module.exports = {
  // Server Configuration
  port: process.env.PORT || 3000,
  host: process.env.HOST || '0.0.0.0',
  
  // Security Configuration
  maxConnectionsPerIP: parseInt(process.env.MAX_CONNECTIONS_PER_IP) || 10,
  maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH) || 1000,
  maxUsernameLength: parseInt(process.env.MAX_USERNAME_LENGTH) || 50,
  maxRoomNameLength: parseInt(process.env.MAX_ROOM_NAME_LENGTH) || 100,
  
  // Rate Limiting
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000, // 1 minute
  maxMessagesPerWindow: parseInt(process.env.MAX_MESSAGES_PER_WINDOW) || 50,
  maxJoinsPerWindow: parseInt(process.env.MAX_JOINS_PER_WINDOW) || 10,
  
  // Message History & Persistence
  maxMessageHistory: parseInt(process.env.MAX_MESSAGE_HISTORY) || 100,
  enableMessagePersistence: process.env.ENABLE_MESSAGE_PERSISTENCE !== 'false', // ENABLED by default
  
  // Features
  enableTypingIndicators: process.env.ENABLE_TYPING_INDICATORS !== 'false',
  enableUserList: process.env.ENABLE_USER_LIST !== 'false',
  enableEmojis: process.env.ENABLE_EMOJIS !== 'false',
  enableFileSharing: process.env.ENABLE_FILE_SHARING === 'true',
  enablePrivateMessages: process.env.ENABLE_PRIVATE_MESSAGES === 'true',
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  enableAccessLog: process.env.ENABLE_ACCESS_LOG !== 'false',
  
  // CORS Configuration
  corsOrigin: process.env.CORS_ORIGIN || '*',
  
  // Health Check
  healthCheckPath: process.env.HEALTH_CHECK_PATH || '/health',
  statsPath: process.env.STATS_PATH || '/stats',
  
  // Default Rooms
  defaultRooms: [
    { name: 'General', description: 'General discussion', icon: '💬', maxUsers: 100 },
    { name: 'Tech Talk', description: 'Technology discussions', icon: '💻', maxUsers: 50 },
    { name: 'Random', description: 'Random conversations', icon: '🎲', maxUsers: 50 },
    { name: 'Gaming', description: 'Gaming discussions', icon: '🎮', maxUsers: 50 },
    { name: 'Music', description: 'Music and entertainment', icon: '🎵', maxUsers: 50 }
  ],
  
  // Moderation
  enableProfanityFilter: process.env.ENABLE_PROFANITY_FILTER === 'true',
  enableSpamProtection: process.env.ENABLE_SPAM_PROTECTION !== 'false',
  enableAutoModeration: process.env.ENABLE_AUTO_MODERATION === 'true',
  
  // Advanced Features
  enableMessageReactions: process.env.ENABLE_MESSAGE_REACTIONS === 'true',
  enableMessageThreads: process.env.ENABLE_MESSAGE_THREADS === 'true',
  enableVoiceChat: process.env.ENABLE_VOICE_CHAT === 'true',
  enableScreenShare: process.env.ENABLE_SCREEN_SHARE === 'true'
};
