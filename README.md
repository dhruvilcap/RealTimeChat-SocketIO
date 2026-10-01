# RealTime Chat Application

A complete real-time chat application built with:

- Node.js
- Express.js
- MongoDB
- Mongoose
- Socket.IO
- JWT authentication
- bcrypt password hashing
- HTML/CSS/JavaScript
- Responsive conversational UI

## Features

### Group Broadcast
Users can join the application and use the Group Broadcast area. Messages are delivered in real time to all connected authenticated users.

### Personal One-to-One Chat
Users register with:
- Name
- Email
- Password

After login, users can select another registered user and exchange private messages in real time.

### UI Features
- Responsive desktop/mobile layout
- Online/offline status
- Last seen
- Typing indicator
- Search users
- Emoji picker
- Message timestamps
- Auto scrolling
- Connection status
- Secure password hashing
- JWT socket authentication

## Requirements

Install:

1. Node.js
2. MongoDB Community Server OR use a MongoDB Atlas database
3. VS Code (recommended)

## Installation

Open terminal in the project folder:

```bash
npm install
```

Create `.env`:

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/realtime_chat
JWT_SECRET=my_super_secret_chat_key_12345
```

If using MongoDB Atlas, replace MONGODB_URI with your Atlas connection string.

## Start

```bash
npm start
```

For development:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Test private chat

1. Open Chrome normally:
   http://localhost:3000/register.html
2. Create User A.
3. Open an Incognito window.
4. Create User B with a different email.
5. Login as both users.
6. Select the other user.
7. Send messages.
8. Open two browser windows to see real-time delivery.

## Important

This project intentionally does not store chat message history in MongoDB. Socket.IO delivers messages in real time while users are connected.

If persistent chat history is required, add a Message model and REST/socket persistence layer.

## Folder structure

```text
RealTimeChat/
├── server.js
├── package.json
├── .env.example
├── .gitignore
├── README.md
├── models/
│   └── User.js
└── public/
    ├── index.html
    ├── login.html
    ├── register.html
    ├── chat.html
    ├── css/
    │   └── style.css
    └── js/
        ├── auth.js
        └── private-chat.js
```
