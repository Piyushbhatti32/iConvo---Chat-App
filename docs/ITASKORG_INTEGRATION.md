# iTaskOrg Integration with iConvo Server

## ✅ Server Updates Completed

The iConvo server has been updated to support **both** iTaskOrg's event structure and the original iConvo frontend, maintaining **backward compatibility**.

## 🔧 New iTaskOrg Event Handlers

### 1. **Authentication**
- Extracts `userId`, `groupId`, `userName`, and `token` from `socket.handshake.auth`
- Stores user info on socket for later use: `socket.userId`, `socket.userName`, `socket.groupId`

### 2. **Room Management**

#### `join_room` (iTaskOrg format)
```javascript
socket.emit('join_room', {
  roomId: 'group-{groupId}',
  groupId: '{groupId}',
  userId: '{userId}',
  userName: '{userName}'
});
```
- Emits: `user_joined` event to room members
- Also emits: Legacy `userJoined` event for backward compatibility

#### `leave_room` (iTaskOrg format)
```javascript
socket.emit('leave_room', {
  roomId: 'group-{groupId}',
  groupId: '{groupId}',
  userId: '{userId}'
});
```
- Emits: `user_left` event with `lastSeen` timestamp
- Also emits: Legacy `receive` system message

### 3. **Messaging**

#### `send_message` (iTaskOrg format)
```javascript
socket.emit('send_message', {
  roomId: 'group-{groupId}',
  groupId: '{groupId}',
  content: 'message text',
  type: 'text',
  replyTo: null,
  mentions: [],
  attachments: []
});
```

**Server Response:**
- Emits: `message` event to all room members with full message object:
  ```javascript
  {
    id: 'msg_...',
    groupId: '{groupId}',
    content: 'message text',
    senderId: '{userId}',
    userId: '{userId}',
    createdBy: '{userId}',
    userName: '{userName}',
    senderName: '{userName}',
    timestamp: 'ISO string',
    type: 'text',
    replyTo: null,
    mentions: [],
    attachments: []
  }
  ```
- Also emits: Legacy `receive` event for backward compatibility

### 4. **Presence Tracking**

#### `get_room_users` (iTaskOrg format)
```javascript
socket.emit('get_room_users', {
  roomId: 'group-{groupId}',
  groupId: '{groupId}'
});
```

**Server Response:**
```javascript
socket.emit('room_users', {
  groupId: '{groupId}',
  users: [
    {
      userId: '{userId}',
      userName: '{userName}',
      lastSeen: 'ISO string'
    },
    // ... more users
  ]
});
```

**Automatic Events:**
- On user join: `user_joined` → `{ groupId, userId, userName }`
- On user leave: `user_left` → `{ groupId, userId, userName, lastSeen }`

### 5. **Typing Indicators**

#### `typing` (iTaskOrg format - object)
```javascript
socket.emit('typing', {
  roomId: 'group-{groupId}',
  groupId: '{groupId}',
  userId: '{userId}',
  userName: '{userName}',
  isTyping: true | false
});
```

**Server Response:**
- Emits: `typing` event with object format to room members
- Also emits: Legacy format (`typing(room, username)`) for backward compatibility

**Note:** The handler supports both formats:
- iTaskOrg: Object with `roomId`, `groupId`, `isTyping`, etc.
- Legacy: `typing(room, username)` - string, string

### 6. **Message Receipts**

#### `mark_read` (iTaskOrg format)
```javascript
socket.emit('mark_read', {
  roomId: 'group-{groupId}',
  groupId: '{groupId}',
  userId: '{userId}',
  lastReadMessageId: '{messageId}'
});
```

**Server Response:**
```javascript
socket.to(roomId).emit('message_receipt', {
  groupId: '{groupId}',
  messageId: '{messageId}',
  userId: '{userId}',
  status: 'read'
});
```

### 7. **System Messages**

#### `system_message` (iTaskOrg format)
```javascript
socket.emit('system_message', {
  roomId: 'group-{groupId}',
  groupId: '{groupId}',
  content: 'System message text',
  eventType: 'member_added' | 'member_removed' | etc.
});
```

**Server Response:**
```javascript
io.to(roomId).emit('system_message', {
  id: 'sys_...',
  groupId: '{groupId}',
  content: 'System message text',
  type: 'system',
  systemEvent: '{eventType}',
  timestamp: 'ISO string'
});
```

## 🔄 Event Mapping Summary

| iTaskOrg Event | Server Emits | Legacy Also Emits |
|----------------|--------------|-------------------|
| `join_room` | `user_joined` | `userJoined` |
| `leave_room` | `user_left` | `receive` (system msg) |
| `send_message` | `message` | `receive` |
| `typing` | `typing` (object) | `typing` (string, string) |
| `get_room_users` | `room_users` | `user count` |
| `mark_read` | `message_receipt` | - |
| `system_message` | `system_message` | - |

## 🔐 Room Naming Convention

iTaskOrg uses rooms named: **`group-{groupId}`**

Example: If `groupId = "abc123"`, room name is `"group-abc123"`

## ✅ Backward Compatibility

All existing iConvo frontend features continue to work:
- `join` event (legacy format)
- `leave` event (legacy format)
- `send` event (legacy format)
- `typing` / `stop typing` (legacy format)
- `get_user_count` event
- `receive` event for messages
- `userJoined` / `userJoined` events

## 🚀 Testing

1. **Test iTaskOrg Integration:**
   - Connect from iTaskOrg app
   - Join a group room: `join_room({ roomId: 'group-abc123', ... })`
   - Send message: `send_message({ roomId: 'group-abc123', content: 'test' })`
   - Check presence: `get_room_users({ roomId: 'group-abc123' })`

2. **Test Legacy iConvo:**
   - Original iConvo frontend should continue working
   - All existing events remain functional

## 📝 Notes

- The server maintains **dual event emission** for backward compatibility
- Room tracking uses Socket.IO's native room system
- User presence is tracked per room using `roomUsers` Map
- Message history is stored per room (in-memory, max 100 messages)

## 🐛 Troubleshooting

### Issue: Events not received
- Check room name matches: `group-{groupId}`
- Verify `groupId` is passed correctly
- Check server logs for connection/auth info

### Issue: Presence not updating
- Verify `get_room_users` is called after `join_room`
- Check `room_users` event is being received
- Ensure `user_joined` / `user_left` events fire correctly

### Issue: Messages not appearing
- Verify user has joined room via `join_room`
- Check `send_message` includes all required fields
- Ensure `message` event is being listened for (not `receive`)

