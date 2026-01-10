export interface User {
  id: string
  name: string
  avatar?: string
  status?: 'online' | 'offline' | 'away'
}

export interface Room {
  id: string
  name: string
  avatar: string
  lastMessage?: string
  time?: string
  unread: number
  userCount?: number
}

export interface Message {
  id: string
  username: string
  message: string
  timestamp: string
  room: string
  type?: 'message' | 'system' | 'image' | 'video' | 'voice' | 'file' | 'audio'
  own?: boolean
  edited?: boolean
  deleted?: boolean
  reactions?: Record<string, string[]>
  replyTo?: string
  replyToMessage?: Message
  forwarded?: boolean
  forwardedFrom?: string
  starred?: boolean
  pinned?: boolean
  status?: 'sending' | 'sent' | 'delivered' | 'read'
  // Media fields
  imageUrl?: string
  videoUrl?: string
  voiceUrl?: string
  fileUrl?: string
  fileName?: string
  fileSize?: number
  audioUrl?: string
  // Additional metadata
  editedAt?: string
  deletedAt?: string
  deletedFor?: 'everyone' | 'me'
  userId?: string
}

export interface ChatSession {
  username: string
  room: string
}

export interface AuthState {
  isAuthenticated: boolean
  user: User | null
  isLoading: boolean
  error: string | null
}

export interface MessageReaction {
  emoji: string
  userId: string
  username: string
  timestamp: string
}

export interface FileAttachment {
  name: string
  size: number
  type: string
  url: string
  thumbnail?: string
}

export interface VoiceMessage {
  url: string
  duration: number
  waveform?: number[]
}

export interface PinnedMessage {
  messageId: string
  pinnedBy: string
  pinnedAt: string
}