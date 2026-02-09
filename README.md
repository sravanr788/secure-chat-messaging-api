
## ✅ What I Implemented

### 🔐 Security Improvements

* Replaced plain text passwords with bcrypt hashing (12 salt rounds)
* Moved all secrets (JWT + whisper key) to environment variables
* Removed hardcoded admin bypass keys
* Implemented JWT blacklist for proper logout invalidation
* Enforced room membership validation
* Enforced message ownership checks (edit/delete)
* Added input validation for login and registration
* Removed sensitive fields (passwords, internal IDs, session info) from responses
* Added Helmet for security headers
* Sanitized error responses (no internal stack traces exposed)


### ⚡ Real-Time Features

* WebSocket server integration
* Room-based message broadcasting
* Basic user presence handling


### 🧩 Puzzle Completion

* Discovered hidden whisper endpoint using `X-Message-Hint`
* Implemented multi-level access for `/api/whisper`
* Caesar cipher decryption (shift 7)
* XOR encryption support
* Decoded final ROT13 message → `REAL_TIME_WEBSOCKET_2024`
* Implemented WebSocket as the final challenge requirement


## ⚙️ Setup Instructions

### 1️⃣ Install Dependencies

```bash
npm install
```

### 2️⃣ Create `.env` file

Create a `.env` file in the root directory:

```
JWT_SECRET=your_secure_jwt_secret
WHISPER_DECRYPTION_KEY=chat-master-key-2024
PORT=3003
```

### 3️⃣ Run the Server

```bash
npm start
```

Server runs on:

```
http://localhost:3003
```

## 📝 Note

For simplicity (as per assessment scope), the application uses in-memory storage.
In a real production setup, this would be replaced with persistent storage (e.g., MongoDB or PostgreSQL) along with Redis for session/token management.



## 🚀 Deployment

The application is deployed on Render.

Render was chosen because this project runs a persistent Node.js server with WebSocket support. Platforms like Vercel or Netlify are primarily serverless and do not handle long-lived WebSocket connections reliably. Render allows the Express server and WebSocket server to run together as intended.

[Live Link](https://secure-chat-messaging-api.onrender.com)



