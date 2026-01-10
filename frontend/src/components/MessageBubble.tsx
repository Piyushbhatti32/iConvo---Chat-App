import React, { useState } from 'react'
import { ThumbsUp, Heart, Laugh, Angry, Frown, Check, CheckCheck, Clock } from 'lucide-react'
import { Message, User } from '../types'

interface MessageBubbleProps {
  message: Message
  currentUser: User | null
  onContextMenu: (e: React.MouseEvent, message: Message) => void
  onReactionClick: (messageId: string, emoji: string, isOwnReaction: boolean) => void
  onReply?: (message: Message) => void
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  currentUser,
  onContextMenu,
  onReactionClick,
  onReply
}) => {
  const [showReactions, setShowReactions] = useState(false)
  const isOwn = message.own || message.username === currentUser?.name
  const isSystem = message.type === 'system'

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getReactionIcon = (emoji: string) => {
    switch (emoji) {
      case '👍': return <ThumbsUp className="w-4 h-4" />
      case '❤️': return <Heart className="w-4 h-4" />
      case '😂': return <Laugh className="w-4 h-4" />
      case '😠': return <Angry className="w-4 h-4" />
      case '😮': return <Frown className="w-4 h-4" />
      default: return <span>{emoji}</span>
    }
  }

  const quickReactions = ['👍', '❤️', '😂', '😠', '😮']

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'sending':
        return <Clock className="w-3 h-3 text-gray-400" />
      case 'sent':
        return <Check className="w-3 h-3 text-gray-400" />
      case 'delivered':
        return <CheckCheck className="w-3 h-3 text-gray-400" />
      case 'read':
        return <CheckCheck className="w-3 h-3 text-blue-400" />
      default:
        return null
    }
  }

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="bg-gray-700 text-gray-300 text-sm px-3 py-1 rounded-full">
          {message.message}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`}
      onContextMenu={(e) => onContextMenu(e, message)}
    >
      <div className={`max-w-xs lg:max-w-md ${isOwn ? 'order-2' : 'order-1'}`}>
        {/* Username */}
        {!isOwn && (
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-sm font-medium text-gray-300">
              {message.username}
            </span>
            <span className="text-xs text-gray-500">
              {formatTime(message.timestamp)}
            </span>
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`relative px-4 py-2 rounded-2xl cursor-pointer transition-all ${
            isOwn
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-100'
          }`}
          onMouseEnter={() => setShowReactions(true)}
          onMouseLeave={() => setShowReactions(false)}
        >
          {/* Reply indicator */}
          {message.replyToMessage && (
            <div className={`mb-2 p-2 rounded-lg border-l-4 ${
              isOwn ? 'border-blue-300 bg-blue-700' : 'border-gray-500 bg-gray-600'
            }`}>
              <div className="text-xs opacity-70">
                Replying to {message.replyToMessage.username}
              </div>
              <div className="text-sm truncate">
                {message.replyToMessage.message}
              </div>
            </div>
          )}

          {/* Message content */}
          <div className="whitespace-pre-wrap break-words">
            {message.message}
          </div>

          {/* Edited indicator */}
          {message.edited && (
            <span className="text-xs opacity-70 ml-2">(edited)</span>
          )}

          {/* Timestamp for own messages */}
          {isOwn && (
            <div className="flex items-center justify-end space-x-1 text-xs opacity-70 mt-1">
              <span>{formatTime(message.timestamp)}</span>
              {getStatusIcon(message.status)}
            </div>
          )}

          {/* Quick reactions */}
          {showReactions && (
            <div className={`absolute ${isOwn ? '-left-16' : '-right-16'} top-0 flex space-x-1 bg-gray-800 rounded-full p-1 shadow-lg`}>
              {onReply && (
                <button
                  onClick={() => onReply(message)}
                  className="w-6 h-6 hover:bg-gray-700 rounded-full flex items-center justify-center text-sm transition-colors"
                  title="Reply"
                >
                  ↩️
                </button>
              )}
              {quickReactions.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => onReactionClick(message.id, emoji, false)}
                  className="w-6 h-6 hover:bg-gray-700 rounded-full flex items-center justify-center text-sm transition-colors"
                >
                  {getReactionIcon(emoji)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reactions */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(message.reactions).map(([emoji, users]) => {
              const isOwnReaction = users.includes(currentUser?.id || '')
              return (
                <button
                  key={emoji}
                  onClick={() => onReactionClick(message.id, emoji, isOwnReaction)}
                  className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs transition-colors ${
                    isOwnReaction
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  <span>{emoji}</span>
                  <span>{users.length}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Image attachment */}
        {message.imageUrl && (
          <div className="mt-2">
            <img
              src={message.imageUrl}
              alt="Shared image"
              className="max-w-full rounded-lg cursor-pointer hover:opacity-90"
              onClick={() => window.open(message.imageUrl, '_blank')}
            />
          </div>
        )}

        {/* File attachment */}
        {message.fileUrl && message.fileName && (
          <div className="mt-2">
            <a
              href={message.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
            >
              <div className="text-blue-400">📎</div>
              <span className="text-blue-400 underline">{message.fileName}</span>
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

export default MessageBubble