import React from 'react'
import { Reply, Edit, Trash2, Smile } from 'lucide-react'
import { Message, User } from '../types'

interface ContextMenuProps {
  x: number
  y: number
  message: Message
  currentUser: User | null
  onAction: (action: string) => void
  onClose: () => void
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  message,
  currentUser,
  onAction,
  onClose
}) => {
  const isOwnMessage = message.own || message.username === currentUser?.name

  const menuItems = [
    {
      id: 'reply',
      label: 'Reply',
      icon: Reply,
      show: true
    },
    {
      id: 'react',
      label: 'React',
      icon: Smile,
      show: true
    },
    {
      id: 'edit',
      label: 'Edit',
      icon: Edit,
      show: isOwnMessage && !message.deleted
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      show: isOwnMessage && !message.deleted,
      danger: true
    }
  ].filter(item => item.show)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Menu */}
      <div
        className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-2 min-w-48"
        style={{
          left: x,
          top: y,
          transform: 'translate(-50%, -100%)'
        }}
      >
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              onAction(item.id)
              onClose()
            }}
            className={`w-full px-4 py-2 text-left flex items-center space-x-3 hover:bg-gray-700 transition-colors ${
              item.danger ? 'text-red-400 hover:text-red-300' : 'text-gray-300 hover:text-white'
            }`}
          >
            <item.icon className="w-4 h-4" />
            <span className="text-sm">{item.label}</span>
          </button>
        ))}
      </div>
    </>
  )
}

export default ContextMenu