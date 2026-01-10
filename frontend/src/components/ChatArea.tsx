import React, { useState, useRef, useEffect } from 'react'
import { Send, Smile, Paperclip, MoreVertical, Reply, Edit, Menu, X } from 'lucide-react'
import { Message, User } from '../types'
import MessageBubble from './MessageBubble'
import EmojiPicker from './EmojiPicker'
import ContextMenu from './ContextMenu'

interface ChatAreaProps {
  currentRoom: string
  messages: Message[] | undefined
  currentUser: User | null
  typingUsers: string[]
  onSendMessage: (message: string, replyTo?: Message) => void
  onAddReaction: (messageId: string, emoji: string) => void
  onRemoveReaction: (messageId: string, emoji: string) => void
  onReply?: (message: Message) => void
  onCancelReply?: () => void
  replyingTo?: Message | null
  isConnected: boolean
  onOpenSidebar?: () => void
}

const ChatArea: React.FC<ChatAreaProps> = ({
  currentRoom,
  messages,
  currentUser,
  typingUsers,
  onSendMessage,
  onAddReaction,
  onRemoveReaction,
  onReply,
  onCancelReply,
  replyingTo,
  isConnected,
  onOpenSidebar
}) => {
  const [messageInput, setMessageInput] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    message: Message
  } | null>(null)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px'
    }
  }, [messageInput])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSendMessage = () => {
    if (!messageInput.trim()) return

    if (editingMessage) {
      // Handle edit
      console.log('Editing message:', editingMessage.id, messageInput)
      setEditingMessage(null)
    } else if (replyingTo) {
      // Handle reply
      onSendMessage(messageInput, replyingTo)
      onCancelReply?.()
    } else {
      onSendMessage(messageInput)
    }

    setMessageInput('')
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleEmojiSelect = (emoji: string) => {
    setMessageInput(prev => prev + emoji)
    setShowEmojiPicker(false)
    inputRef.current?.focus()
  }

  const handleContextMenu = (e: React.MouseEvent, message: Message) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      message
    })
  }

  const handleContextAction = (action: string) => {
    if (!contextMenu) return

    const { message } = contextMenu

    switch (action) {
      case 'reply':
        onReply?.(message)
        inputRef.current?.focus()
        break
      case 'edit':
        if (message.own) {
          setEditingMessage(message)
          setMessageInput(message.message)
          inputRef.current?.focus()
        }
        break
      case 'delete':
        if (message.own) {
          console.log('Deleting message:', message.id)
        }
        break
      case 'react':
        setShowEmojiPicker(true)
        break
    }

    setContextMenu(null)
  }

  const handleReactionClick = (messageId: string, emoji: string, isOwnReaction: boolean) => {
    if (isOwnReaction) {
      onRemoveReaction(messageId, emoji)
    } else {
      onAddReaction(messageId, emoji)
    }
  }

  const cancelReply = () => {
    onCancelReply?.()
  }

  const cancelEdit = () => {
    setEditingMessage(null)
    setMessageInput('')
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
  }

  if (!currentRoom) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-800">
        <div className="text-center px-4">
          <svg className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-4 opacity-50 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h2 className="text-xl md:text-2xl font-bold text-gray-400 mb-2">Welcome to iConvo</h2>
          <p className="text-sm md:text-base text-gray-500">
            {onOpenSidebar ? 'Tap the menu button to select a room' : 'Select a room to start chatting'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-800 h-full">
      {/* Header */}
      <div className="p-3 md:p-4 border-b border-gray-700 bg-gray-900 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            {/* Mobile menu button */}
            {onOpenSidebar && (
              <button
                onClick={onOpenSidebar}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors md:hidden flex-shrink-0"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            
            {/* Room avatar */}
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm md:text-lg flex-shrink-0">
              {currentRoom[0]?.toUpperCase()}
            </div>
            
            <div className="min-w-0 flex-1">
              <h2 className="text-base md:text-xl font-bold text-white truncate">
                {currentRoom}
              </h2>
              <p className="text-xs md:text-sm text-gray-400 truncate">
                {typingUsers.length > 0 ? (
                  <span className="text-green-400">
                    {typingUsers.length === 1
                      ? `${typingUsers[0]} is typing...`
                      : `${typingUsers.slice(0, -1).join(', ')} and ${typingUsers[typingUsers.length - 1]} are typing...`
                    }
                  </span>
                ) : (
                  <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
                    {isConnected ? 'Active now' : 'Disconnected'}
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-1 md:space-x-2 flex-shrink-0">
            <button 
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors hidden sm:block"
              aria-label="Search"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button 
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="More options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4">
        {messages?.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            currentUser={currentUser}
            onContextMenu={handleContextMenu}
            onReactionClick={handleReactionClick}
          />
        ))}

        {/* Typing indicators */}
        {typingUsers.length > 0 && (
          <div className="flex items-center space-x-2 text-gray-400 text-xs md:text-sm">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
            <span className="hidden sm:inline">
              {typingUsers.length === 1
                ? `${typingUsers[0]} is typing...`
                : `${typingUsers.slice(0, -1).join(', ')} and ${typingUsers[typingUsers.length - 1]} are typing...`
              }
            </span>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>

    {/* Reply/Edit indicator */}
    {(replyingTo || editingMessage) && (
      <div className="px-3 md:px-4 py-2 border-t border-gray-700 bg-gray-900 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            {replyingTo && <Reply className="w-4 h-4 text-blue-400 flex-shrink-0" />}
            {editingMessage && <Edit className="w-4 h-4 text-yellow-400 flex-shrink-0" />}
            <div className="min-w-0 flex-1">
              <span className="text-gray-300 text-xs md:text-sm block truncate">
                {replyingTo ? `Replying to ${replyingTo.username}` : 'Editing message'}
              </span>
              {replyingTo && (
                <p className="text-gray-500 text-xs mt-0.5 truncate">
                  {replyingTo.message}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={replyingTo ? cancelReply : cancelEdit}
            className="text-gray-400 hover:text-white p-1 flex-shrink-0"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )}

    {/* Message input */}
    <div className="p-3 md:p-4 border-t border-gray-700 bg-gray-900 flex-shrink-0">
      <div className="flex items-end space-x-2 md:space-x-3">
        <div className="flex-1 relative min-w-0">
          <textarea
            ref={inputRef}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isConnected ? "Type a message..." : "Disconnected..."}
            disabled={!isConnected}
            className="w-full px-3 md:px-4 py-2 md:py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm md:text-base placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            rows={1}
            style={{ 
              maxHeight: '120px',
              fontSize: '16px' // Prevents zoom on iOS
            }}
          />

          {/* Emoji picker */}
          {showEmojiPicker && (
            <div ref={emojiPickerRef} className="absolute bottom-full left-0 right-0 md:right-auto md:left-auto mb-2 z-10">
              <EmojiPicker onEmojiSelect={handleEmojiSelect} />
            </div>
          )}
        </div>

        <div className="flex items-center space-x-1 md:space-x-2 flex-shrink-0">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Add emoji"
          >
            <Smile className="w-5 h-5" />
          </button>

          <button 
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors hidden sm:block"
            aria-label="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <button
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || !isConnected}
            className="p-2 md:p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
            aria-label="Send message"
          >
            <Send className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </button>
        </div>
      </div>
    </div>

    {/* Context menu */}
    {contextMenu && (
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        message={contextMenu.message}
        currentUser={currentUser}
        onAction={handleContextAction}
        onClose={() => setContextMenu(null)}
      />
    )}
  </div>
  )
}

export default ChatArea