import React, { useState } from 'react'
import { Search, Plus, Settings, Wifi, WifiOff, LogOut } from 'lucide-react'
import { Room, User } from '../types'

interface SidebarProps {
  rooms: Room[]
  currentRoom: string
  currentUser: User | null
  onRoomSelect: (roomId: string, username?: string) => void
  onLogout: () => void
  isConnected: boolean
}

const Sidebar: React.FC<SidebarProps> = ({
  rooms,
  currentRoom,
  currentUser,
  onRoomSelect,
  onLogout,
  isConnected
}) => {
  const [searchQuery, setSearchQuery] = useState('')

  const handleRoomClick = (roomId: string) => {
    if (currentUser) {
      onRoomSelect(roomId)
    } else {
      onRoomSelect(roomId, undefined)
    }
  }

  const handleNewRoom = () => {
    const roomName = prompt('Enter room name:')
    if (roomName) {
      // In a real app, this would create a new room on the server
      console.log('Creating new room:', roomName)
    }
  }

  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="w-full md:w-80 lg:w-96 bg-gray-900 border-r border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 md:p-4 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h1 className="text-lg md:text-xl font-bold text-white">iConvo</h1>
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-green-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400" />
            )}
            <button 
              className="p-1.5 md:p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
        </div>

        {/* User info */}
        {currentUser && (
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="flex items-center space-x-2 md:space-x-3 min-w-0 flex-1">
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {currentUser.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                {/* Online status indicator */}
                <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${
                  isConnected ? 'bg-green-500' : 'bg-gray-500'
                }`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white font-medium text-sm md:text-base truncate">
                  {currentUser.name}
                </p>
                <p className={`text-xs md:text-sm ${isConnected ? 'text-green-400' : 'text-gray-500'}`}>
                  {isConnected ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 md:p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search rooms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 md:pl-10 pr-3 md:pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          />
        </div>
      </div>

      {/* Rooms list */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 md:p-4">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h2 className="text-gray-300 font-medium text-sm md:text-base">Rooms</h2>
            <button
              onClick={handleNewRoom}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
              aria-label="Add new room"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {filteredRooms.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-sm">No rooms found</p>
            </div>
          ) : (
            <div className="space-y-1 md:space-y-2">
              {filteredRooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => handleRoomClick(room.id)}
                  className={`p-2.5 md:p-3 rounded-lg cursor-pointer transition-all ${
                    currentRoom === room.id
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'hover:bg-gray-800 text-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2 md:space-x-3">
                    <div className="relative flex-shrink-0">
                      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center font-semibold text-base md:text-lg ${
                        currentRoom === room.id 
                          ? 'bg-blue-700' 
                          : 'bg-gradient-to-br from-blue-500 to-purple-600'
                      }`}>
                        {room.avatar}
                      </div>
                      {room.unread > 0 && currentRoom !== room.id && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                          <span className="text-xs text-white font-bold">
                            {room.unread > 9 ? '9+' : room.unread}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="font-medium text-sm md:text-base truncate">
                          {room.name}
                        </p>
                        {room.time && (
                          <span className={`text-xs flex-shrink-0 ml-2 ${
                            currentRoom === room.id ? 'text-blue-200' : 'text-gray-500'
                          }`}>
                            {room.time}
                          </span>
                        )}
                      </div>
                      {room.lastMessage && (
                        <p className={`text-xs md:text-sm truncate ${
                          currentRoom === room.id ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {room.lastMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 md:p-4 border-t border-gray-700 flex-shrink-0 bg-gray-900">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>iConvo v1.0</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
              {isConnected ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>
        {!isConnected && (
          <p className="text-red-400 text-xs mt-2 text-center">
            Reconnecting...
          </p>
        )}
      </div>
    </div>
  )
}

export default Sidebar