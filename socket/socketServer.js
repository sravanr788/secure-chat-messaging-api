const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET not defined');
}

const JWT_SECRET = process.env.JWT_SECRET;

// in-memory tracking
const clients = new Map(); // ws -> { userId, username, roomId }

function initSocketServer(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection');

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);

        // 1️⃣ Authenticate
        if (data.type === 'auth') {
          const decoded = jwt.verify(data.token, JWT_SECRET);

          clients.set(ws, {
            userId: decoded.userId,
            username: decoded.username,
            roomId: null
          });

          ws.send(JSON.stringify({
            type: 'auth_success'
          }));
        }

        // 2️⃣ Join room
        if (data.type === 'join_room') {
          const client = clients.get(ws);
          if (!client) return;

          client.roomId = data.roomId;

          ws.send(JSON.stringify({
            type: 'joined_room',
            roomId: data.roomId
          }));
        }

        // 3️⃣ Send message
        if (data.type === 'message') {
          const client = clients.get(ws);
          if (!client || !client.roomId) return;

          broadcastToRoom(wss, client.roomId, {
            type: 'message',
            username: client.username,
            content: data.content,
            timestamp: new Date().toISOString()
          });
        }

        // 4️⃣ Typing indicator
        if (data.type === 'typing') {
          const client = clients.get(ws);
          if (!client || !client.roomId) return;

          broadcastToRoom(wss, client.roomId, {
            type: 'typing',
            username: client.username
          }, ws);
        }

      } catch (err) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log('WebSocket disconnected');
    });
  });
}

function broadcastToRoom(wss, roomId, message, excludeWs = null) {
  wss.clients.forEach(client => {
    const user = clients.get(client);

    if (
      client.readyState === WebSocket.OPEN &&
      user &&
      user.roomId === roomId &&
      client !== excludeWs
    ) {
      client.send(JSON.stringify(message));
    }
  });
}

module.exports = initSocketServer;
