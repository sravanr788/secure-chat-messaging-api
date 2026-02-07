const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { isBlacklisted } = require('../utils/tokenBlacklist');

const router = express.Router();

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET not defined in environment');
}

const JWT_SECRET = process.env.JWT_SECRET;

// helper to verify token
function getCurrentUser(req) {
  const authHeader = req.get('authorization');

  if (!authHeader) {
    return null;
  }

  try {
    const token = authHeader.split(' ')[1];

    if (isBlacklisted(token)) return null;

    return jwt.verify(token, JWT_SECRET);
  } catch{
    return null;
  }
}



// In-memory storage for messages and rooms
let messages = [
  {
    id: '1',
    roomId: 'general',
    userId: 'user1',
    username: 'alice',
    content: 'Welcome to the chat!',
    timestamp: new Date('2024-01-01T10:00:00Z').toISOString(),
    edited: false,
    deleted: false
  },
  {
    id: '2',
    roomId: 'general',
    userId: 'user2',
    username: 'bob',
    content: 'Hello everyone!',
    timestamp: new Date('2024-01-01T10:01:00Z').toISOString(),
    edited: false,
    deleted: false
  },
  {
    id: '3',
    roomId: 'private',
    userId: 'user1',
    username: 'alice',
    content: 'This is a private message',
    timestamp: new Date('2024-01-01T10:02:00Z').toISOString(),
    edited: false,
    deleted: false
  }
];

const chatRooms = [
  {
    id: 'general',
    name: 'General Chat',
    type: 'public',
    createdBy: 'admin',
    members: ['user1', 'user2', 'user3'],
    createdAt: new Date('2024-01-01').toISOString()
  },
  {
    id: 'private',
    name: 'Private Room',
    type: 'private',
    createdBy: 'user1',
    members: ['user1'],
    createdAt: new Date('2024-01-01').toISOString()
  }
];


// Get all rooms
router.get('/', async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    res.json({
      rooms: chatRooms.map(room => ({
        id: room.id,
        name: room.name,
        type: room.type,
        memberCount: room.members.length,
        members: room.members.includes(currentUser.userId) ? room.members : [],
        createdAt: room.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// Get messages from room
router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const room = chatRooms.find(r => r.id === roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!room.members.includes(currentUser.userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const roomMessages = messages.filter(m => m.roomId === roomId && !m.deleted);

    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;

    const paginatedMessages = roomMessages.slice(offset, offset + limit);

    res.json({
      messages: paginatedMessages.map(msg => ({
        id: msg.id,
        content: msg.content,
        username: msg.username,
        timestamp: msg.timestamp,
        edited: msg.edited,
        editHistory: 
      msg.userId === currentUser.userId ? msg.editHistory || [] : [],
      })),
      room: {
        id: room.id,
        name: room.name,
        type: room.type
      },
      pagination: {
        offset,
        limit,
        total: roomMessages.length
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// Get specific message
router.get('/:roomId/:messageId', async (req, res) => {
  try {
    const { roomId, messageId } = req.params;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const room = chatRooms.find(r => r.id === roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!room.members.includes(currentUser.userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const message = messages.find(m => m.id === messageId && m.roomId === roomId && !m.deleted);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({
      id: message.id,
      content: message.content,
      username: message.username,
      timestamp: message.timestamp,
      edited: message.edited,
      editHistory: message.userId === currentUser.userId ? message.editHistory : [] || []
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// Send message to room
router.post('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { content } = req.body;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const room = chatRooms.find(r => r.id === roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!room.members.includes(currentUser.userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const newMessage = {
      id: uuidv4(),
      roomId,
      userId: currentUser.userId,
      username: currentUser.username,
      content: content.trim(),
      timestamp: new Date().toISOString(),
      edited: false,
      deleted: false
    };

    messages.push(newMessage);

    res.status(201).json({
      message: 'Message sent successfully',
      messageData: {
        id: newMessage.id,
        content: newMessage.content,
        username: newMessage.username,
        timestamp: newMessage.timestamp
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// Edit message
router.put('/:roomId/:messageId', async (req, res) => {
  try {
    const { roomId, messageId } = req.params;
    const { content } = req.body;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const room = chatRooms.find(r => r.id === roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!room.members.includes(currentUser.userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messageIndex = messages.findIndex(m => m.id === messageId && m.roomId === roomId && !m.deleted);

    if (messageIndex === -1) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = messages[messageIndex];

    if (message.userId !== currentUser.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Message content is required' });
    }

    if (!message.editHistory) {
      message.editHistory = [];
    }

    message.editHistory.push({
      previousContent: message.content,
      editedAt: new Date().toISOString(),
      editedBy: currentUser.userId
    });

    message.content = content.trim();
    message.edited = true;
    message.lastEditedAt = new Date().toISOString();

    res.json({
      message: 'Message updated successfully',
      messageData: {
        id: message.id,
        content: message.content,
        edited: message.edited,
        lastEditedAt: message.lastEditedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// Delete message
router.delete('/:roomId/:messageId', async (req, res) => {
  try {
    const { roomId, messageId } = req.params;
    const currentUser = getCurrentUser(req);

    if (!currentUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const room = chatRooms.find(r => r.id === roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!room.members.includes(currentUser.userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messageIndex = messages.findIndex(m => m.id === messageId && m.roomId === roomId && !m.deleted);

    if (messageIndex === -1) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = messages[messageIndex];

    if (message.userId !== currentUser.userId) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    message.deleted = true;
    message.deletedAt = new Date().toISOString();
    message.deletedBy = currentUser.userId;

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

module.exports = router;
