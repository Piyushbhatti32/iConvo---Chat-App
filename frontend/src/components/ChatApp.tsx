import React, { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import Sidebar from './Sidebar'
import ChatArea from './ChatArea'
import { Message, Room, User } from '../types'

interface ChatAppProps {
  currentUser: User
  onLogout: () => void
}

const ChatApp: React.FC<ChatAppProps> = ({ currentUser, onLogout }) => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [currentRoom, setCurrentRoom] = useState<string>('')
  const [rooms, setRooms] = useState<Room[]>([
    { id: 'general', name: 'General', avatar: 'G', lastMessage: 'Hey everyone!', time: '2m ago', unread: 3 },
    { id: 'tech', name: 'Tech Talk', avatar: 'T', lastMessage: 'Check out this new framework', time: '1h ago', unread: 0 },
    { id: 'random', name: 'Random', avatar: 'R', lastMessage: 'lol', time: '3h ago', unread: 1 }
  ])
  const [messages, setMessages] = useState<Message[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false) // Mobile sidebar toggle
  const [isMobile, setIsMobile] = useState(false) // Track if we're on mobile
  const isSwitchingRoomsRef = useRef(false)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const messageQueueRef = useRef<any[]>([])

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
      // Auto-close sidebar on desktop
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(false)
      }
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Close sidebar when room is selected on mobile
  useEffect(() => {
    if (isMobile && currentRoom) {
      setIsSidebarOpen(false)
    }
  }, [currentRoom, isMobile])

  useEffect(() => {
    // Load session from localStorage for room only
    const session = localStorage.getItem('chatSession')
    if (session) {
      const { room } = JSON.parse(session)
      if (room) setCurrentRoom(room)
    }

    // Initialize socket connection
    const initSocket = () => {
      const newSocket = io('/', {
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
        timeout: 20000,
        forceNew: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      })

      // Socket event handlers
      newSocket.on('connect', () => {
        console.log('Connected to server')
        setIsConnected(true)
        processMessageQueue()
      })

      newSocket.on('disconnect', (reason) => {
        console.log('Disconnected:', reason)

        if (!isSwitchingRoomsRef.current) {
          setIsConnected(false)
          if (reason === 'io server disconnect') {
            scheduleReconnect(newSocket)
          }
        } else {
          console.log('Ignoring disconnect during room switch')
        }
      })

      newSocket.on('connect_error', (error) => {
        console.error('Connection error:', error)
        setIsConnected(false)
        scheduleReconnect(newSocket)
      })

      newSocket.on('reconnect', (attemptNumber) => {
        console.log('Reconnected after', attemptNumber, 'attempts')
        setIsConnected(true)
        processMessageQueue()
      })

      newSocket.on('reconnect_error', (error) => {
        console.error('Reconnection failed:', error)
        scheduleReconnect(newSocket)
      })

      newSocket.on('reconnect_failed', () => {
        console.error('Failed to reconnect after max attempts')
      })

      // Message events
      newSocket.on('receive', handleMessage)
      newSocket.on('message', handleMessage)
      newSocket.on('message_history', handleMessageHistory)
      newSocket.on('message_sent', handleMessageSent)
      newSocket.on('message_edited', handleMessageEdited)
      newSocket.on('message_deleted', handleMessageDeleted)

      // Reaction events
      newSocket.on('reaction_added', handleReactionAdded)
      newSocket.on('reaction_removed', handleReactionRemoved)

      // User events
      newSocket.on('userJoined', handleUserJoined)
      newSocket.on('user_left', handleUserLeft)
      newSocket.on('user_status_changed', handleUserStatusChanged)
      newSocket.on('user count', handleUserCount)

      // Typing events
      newSocket.on('typing', handleTyping)
      newSocket.on('stop typing', handleStopTyping)

      // Error events
      newSocket.on('message_error', showError)
      newSocket.on('join_error', showError)
      newSocket.on('connection_error', showError)

      // Status events
      newSocket.on('unread_count_updated', handleUnreadCountUpdated)

      // Message status events
      newSocket.on('message_delivered', (data: { messageId: string }) => {
        setMessages(prev => prev.map(msg =>
          msg.id === data.messageId ? { ...msg, status: 'delivered' as const } : msg
        ))
      })

      newSocket.on('message_read', (data: { messageId: string }) => {
        setMessages(prev => prev.map(msg =>
          msg.id === data.messageId ? { ...msg, status: 'read' as const } : msg
        ))
      })

      // Join confirmation
      newSocket.on('join', (data) => {
        console.log('Successfully joined room:', data.room)
        isSwitchingRoomsRef.current = false
      })

      setSocket(newSocket)
    }

    initSocket()

    return () => {
      if (socket) {
        socket.disconnect()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [])

  const scheduleReconnect = (socketInstance: Socket) => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    reconnectTimeoutRef.current = setTimeout(() => {
      console.log('Attempting to reconnect...')
      socketInstance.connect()
    }, 2000)
  }

  const processMessageQueue = () => {
    while (messageQueueRef.current.length > 0 && socket?.connected) {
      const message = messageQueueRef.current.shift()
      if (message) {
        socket.emit('send', message)
      }
    }
  }

  const handleMessage = (message: Message) => {
    setMessages(prev => [...prev, message])

    // Mark as read if user is active
    if (document.hasFocus()) {
      markAsRead()
    }
  }

  const handleMessageHistory = (data: { messages: Message[] }) => {
    setMessages(data.messages)
  }

  const handleMessageSent = (message: Message) => {
    setMessages(prev => prev.map(msg =>
      msg.id === message.id ? { ...message, own: true, status: 'sent' as const } : msg
    ))
  }

  const handleMessageEdited = (data: { messageId: string, newMessage: string }) => {
    setMessages(prev => prev.map(msg =>
      msg.id === data.messageId
        ? { ...msg, message: data.newMessage, edited: true }
        : msg
    ))
  }

  const handleMessageDeleted = (data: { messageId: string, deleteFor: string }) => {
    setMessages(prev => prev.filter(msg => msg.id !== data.messageId))
  }

  const handleReactionAdded = (data: { messageId: string, emoji: string, userId: string, reactions: Record<string, string[]> }) => {
    setMessages(prev => prev.map(msg =>
      msg.id === data.messageId
        ? { ...msg, reactions: data.reactions }
        : msg
    ))
  }

  const handleReactionRemoved = (data: { messageId: string, emoji: string, userId: string, reactions: Record<string, string[]> }) => {
    setMessages(prev => prev.map(msg =>
      msg.id === data.messageId
        ? { ...msg, reactions: data.reactions }
        : msg
    ))
  }

  const handleUserJoined = (data: { username: string }) => {
    const systemMessage: Message = {
      id: `sys_${Date.now()}`,
      username: 'Server',
      message: `${data.username} joined the room`,
      timestamp: new Date().toISOString(),
      room: currentRoom,
      type: 'system'
    }
    setMessages(prev => [...prev, systemMessage])
  }

  const handleUserLeft = (data: { userName: string }) => {
    const systemMessage: Message = {
      id: `sys_${Date.now()}`,
      username: 'Server',
      message: `${data.userName} left the room`,
      timestamp: new Date().toISOString(),
      room: currentRoom,
      type: 'system'
    }
    setMessages(prev => [...prev, systemMessage])
  }

  const handleUserStatusChanged = (data: { userId: string, username: string, status: string }) => {
    console.log('User status changed:', data)
  }

  const handleUserCount = (data: { total: number, active: number }) => {
    setRooms(prev => prev.map(room =>
      room.id === currentRoom
        ? { ...room, userCount: data.active }
        : room
    ))
  }

  const handleTyping = (data: any) => {
    let username: string
    if (typeof data === 'object') {
      username = data.userName || data.username
    } else {
      username = data
    }

    if (username && username !== currentUser?.name) {
      setTypingUsers(prev => [...new Set([...prev, username])])
      setTimeout(() => {
        setTypingUsers(prev => prev.filter(u => u !== username))
      }, 3000)
    }
  }

  const handleStopTyping = (data: any) => {
    let username: string
    if (typeof data === 'object') {
      username = data.userName || data.username
    } else {
      username = data
    }

    setTypingUsers(prev => prev.filter(u => u !== username))
  }

  const handleUnreadCountUpdated = (data: { room: string, count: number }) => {
    setRooms(prev => prev.map(room =>
      room.id === data.room
        ? { ...room, unread: data.count }
        : room
    ))
  }

  const showError = (message: string) => {
    console.error(message)
    alert(message)
  }

  const joinRoom = (roomId: string, username?: string) => {
    if (!socket?.connected) {
      showError('Not connected to server')
      return
    }

    const userName = username || currentUser.name
    if (!userName) return

    if (currentRoom === roomId) {
      return
    }

    isSwitchingRoomsRef.current = true

    setMessages([])
    setCurrentRoom(roomId)

    socket.emit('join', {
      room: roomId,
      username: userName
    })

    localStorage.setItem('chatSession', JSON.stringify({
      username: currentUser.name,
      room: roomId
    }))

    setTimeout(() => {
      isSwitchingRoomsRef.current = false
    }, 1000)
  }

  const sendMessage = (message: string, replyTo?: Message) => {
    if (!message.trim() || !currentRoom) return

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const messageData = {
      id: messageId,
      room: currentRoom,
      message: message.trim(),
      username: currentUser.name,
      userId: currentUser.id,
      timestamp: new Date().toISOString(),
      status: 'sending' as const,
      replyTo: replyTo?.id,
      replyToMessage: replyTo || undefined
    }

    setMessages(prev => [...prev, { ...messageData, own: true }])

    if (socket?.connected) {
      socket.emit('send', messageData)

      setTimeout(() => {
        setMessages(prev => prev.map(msg =>
          msg.id === messageId ? { ...msg, status: 'sent' as const } : msg
        ))
      }, 100)
    } else {
      messageQueueRef.current.push(messageData)
      showError('Message queued - waiting for connection')
    }
  }

  const markAsRead = () => {
    if (currentRoom && socket?.connected) {
      socket.emit('mark_as_read', { room: currentRoom })
    }
  }

  const handleReply = (message: Message) => {
    setReplyingTo(message)
  }

  const handleCancelReply = () => {
    setReplyingTo(null)
  }

  const addReaction = (messageId: string, emoji: string) => {
    if (socket?.connected) {
      socket.emit('add_reaction', {
        messageId,
        emoji,
        userId: currentUser?.id,
        room: currentRoom
      })
    }
  }

  const removeReaction = (messageId: string, emoji: string) => {
    if (socket?.connected) {
      socket.emit('remove_reaction', {
        messageId,
        emoji,
        userId: currentUser?.id,
        room: currentRoom
      })
    }
  }

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  return (
    <div className="flex h-full w-full mx-auto relative overflow-hidden">
      {/* Mobile Menu Button */}
      {isMobile && (
        <button
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50 p-2 bg-gray-800 text-white rounded-lg shadow-lg md:hidden hover:bg-gray-700 transition-colors"
          aria-label="Toggle menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isSidebarOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      )}

      {/* Overlay for mobile when sidebar is open */}
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          ${isMobile ? 'fixed inset-y-0 left-0 z-40' : 'relative'}
          w-full md:w-80 lg:w-96
          transition-transform duration-300 ease-in-out
          ${isMobile && !isSidebarOpen ? '-translate-x-full' : 'translate-x-0'}
          ${isMobile && !currentRoom ? 'translate-x-0' : ''}
        `}
      >
        <Sidebar
          rooms={rooms}
          currentRoom={currentRoom}
          currentUser={currentUser}
          onRoomSelect={joinRoom}
          onLogout={onLogout}
          isConnected={isConnected}
        />
      </div>

      {/* Chat Area */}
      <div className="flex-1 w-full md:w-auto">
        <ChatArea
          currentRoom={currentRoom}
          messages={messages}
          currentUser={currentUser}
          typingUsers={typingUsers}
          onSendMessage={sendMessage}
          onAddReaction={addReaction}
          onRemoveReaction={removeReaction}
          onReply={handleReply}
          onCancelReply={handleCancelReply}
          replyingTo={replyingTo}
          isConnected={isConnected}
          onOpenSidebar={isMobile ? toggleSidebar : undefined}
        />
      </div>
    </div>
  )
}

export default ChatApp