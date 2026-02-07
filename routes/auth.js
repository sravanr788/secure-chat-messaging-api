const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

const tokenBlacklist = require('../utils/tokenBlacklist');
const router = express.Router();

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET not defined in environment');
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '15m';

const { addToBlacklist, isBlacklisted } = tokenBlacklist;

// Mock user database (passwords will be hashed at startup)
let users = [
  {
    id: 'user1',
    username: 'alice',
    email: 'alice@chat.com',
    password: 'password123',
    status: 'online',
    lastSeen: new Date().toISOString(),
    role: 'admin',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice'
  },
  {
    id: 'user2',
    username: 'bob',
    email: 'bob@chat.com',
    password: 'bobsecret',
    status: 'offline',
    lastSeen: new Date(Date.now() - 3600000).toISOString(),
    role: 'user',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob'
  },
  {
    id: 'user3',
    username: 'charlie',
    email: 'charlie@chat.com',
    password: 'charlie2024',
    status: 'online',
    lastSeen: new Date().toISOString(),
    role: 'moderator',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=charlie'
  }
];

// hash mock passwords once at startup
(async () => {
  for (let user of users) {
    if (!user.password.startsWith('$2b$')) {
      user.password = await bcrypt.hash(user.password, 12);
    }
  }
})();

// helper to remove sensitive fields
function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    lastSeen: user.lastSeen,
    avatar: user.avatar
  };
}

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!password || (!username && !email)) {
      return res.status(400).json({
        error: 'Username or email and password are required'
      });
    }

    const user = users.find(
      u => (username && u.username === username) ||
        (email && u.email === email)
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    user.status = 'online';
    user.lastSeen = new Date().toISOString();

    res.json({
      message: 'Login successful',
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',

    });
  }
});

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (username.length < 3 || password.length < 8) {
      return res.status(400).json({ error: 'Invalid username or weak password' });
    }

    const existingUser = users.find(u => u.username === username || u.email === email);

    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = {
      id: uuidv4(),
      username,
      email,
      password: hashedPassword,
      status: 'offline',
      lastSeen: new Date().toISOString(),
      role: 'user',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);

    res.status(201).json({
      message: 'User registered successfully',
      user: sanitizeUser(newUser)
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.get('authorization');

    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      addToBlacklist(token, decoded.exp);

      const user = users.find(u => u.id === decoded.userId);
      if (user) {
        user.status = 'offline';
        user.lastSeen = new Date().toISOString();
      }


      res.json({ message: 'Logout successful' });
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// Profile endpoint
router.get('/profile', async (req, res) => {
  try {
    const authHeader = req.get('authorization');

    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];

    if (isBlacklisted(token)) {
      return res.status(401).json({ error: 'Token revoked' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);

      const user = users.find(u => u.id === decoded.userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        ...sanitizeUser(user),
        email: user.email, // only visible to owner
      });
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// Status update endpoint
router.put('/status', async (req, res) => {
  try {
    const authHeader = req.get('authorization');

    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];

    if (isBlacklisted(token)) {
      return res.status(401).json({ error: 'Token revoked' });
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET);

      const user = users.find(u => u.id === decoded.userId);
      const { status } = req.body;

      const validStatuses = ['online', 'offline', 'away', 'busy'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      user.status = status;
      user.lastSeen = new Date().toISOString();

      res.json({
        message: 'Status updated successfully',
        status: user.status,
        lastSeen: user.lastSeen
      });
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',

    });
  }
});

module.exports = router;
