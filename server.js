require("dotenv").config();

const path = require("path");
const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const User = require("./models/User");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mongodb+srv://dhruvilcap_db_user:qwQ9HvFtbB76Cw6@cluster0.dpsixk3.mongodb.net/realtime_chat";
const JWT_SECRET = process.env.JWT_SECRET || "development_secret_change_me";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function createToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      name: user.name,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function cleanUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    avatarColor: user.avatarColor || "#6c63ff",
    lastSeen: user.lastSeen
  };
}

function randomColor() {
  const colors = [
    "#6c63ff", "#00b894", "#0984e3", "#e17055",
    "#fdcb6e", "#e84393", "#00cec9", "#636e72"
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// ---------- Authentication API ----------

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required."
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({ message: "Name must have at least 2 characters." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must have at least 6 characters." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "Email is already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      avatarColor: randomColor()
    });

    const token = createToken(user);

    res.status(201).json({
      message: "Registration successful.",
      token,
      user: cleanUser(user)
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Server error during registration." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required."
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const passwordMatched = await bcrypt.compare(password, user.password);

    if (!passwordMatched) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    user.lastSeen = new Date();
    await user.save();

    const token = createToken(user);

    res.json({
      message: "Login successful.",
      token,
      user: cleanUser(user)
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login." });
  }
});

// ---------- User API ----------

app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({})
      .select("name email avatarColor lastSeen")
      .sort({ name: 1 });

    res.json(users.map(cleanUser));
  } catch (error) {
    console.error("Users error:", error);
    res.status(500).json({ message: "Unable to load users." });
  }
});

app.get("/api/auth/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;

    if (!token) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "User not found." });
    }

    res.json({ user: cleanUser(user) });
  } catch {
    res.status(401).json({ message: "Invalid or expired token." });
  }
});

// ---------- Socket.IO authentication ----------

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication required."));
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new Error("User not found."));
    }

    socket.user = cleanUser(user);
    next();
  } catch {
    next(new Error("Invalid or expired token."));
  }
});

const onlineUsers = new Map(); // userId -> Set(socketId)

function addOnlineSocket(userId, socketId) {
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socketId);
}

function removeOnlineSocket(userId, socketId) {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return false;

  sockets.delete(socketId);

  if (sockets.size === 0) {
    onlineUsers.delete(userId);
    return true;
  }

  return false;
}

function getOnlineUserIds() {
  return [...onlineUsers.keys()];
}

io.on("connection", async (socket) => {
  const user = socket.user;
  const userId = user.id;

  addOnlineSocket(userId, socket.id);
  socket.join(`user:${userId}`);
  socket.join("group-chat");

  await User.findByIdAndUpdate(userId, { lastSeen: new Date() });

  io.emit("presence:update", {
    userId,
    online: true
  });

  socket.emit("presence:list", getOnlineUserIds());

  socket.on("group:message", (text) => {
    const message = String(text || "").trim();

    if (!message || message.length > 2000) return;

    io.to("group-chat").emit("group:message", {
      id: `${Date.now()}-${Math.random()}`,
      senderId: user.id,
      senderName: user.name,
      text: message,
      time: new Date().toISOString()
    });
  });

  socket.on("private:message", ({ receiverId, text }) => {
    const message = String(text || "").trim();

    if (!receiverId || !message || message.length > 2000) return;
    if (receiverId === userId) return;

    const payload = {
      id: `${Date.now()}-${Math.random()}`,
      senderId: user.id,
      senderName: user.name,
      receiverId,
      text: message,
      time: new Date().toISOString()
    };

    io.to(`user:${receiverId}`).emit("private:message", payload);
    socket.emit("private:message", payload);
  });

  socket.on("typing:start", ({ receiverId, chatType }) => {
    if (chatType === "group") {
      socket.to("group-chat").emit("typing:update", {
        chatType: "group",
        userId,
        userName: user.name,
        typing: true
      });
      return;
    }

    if (receiverId) {
      io.to(`user:${receiverId}`).emit("typing:update", {
        chatType: "private",
        userId,
        userName: user.name,
        typing: true
      });
    }
  });

  socket.on("typing:stop", ({ receiverId, chatType }) => {
    if (chatType === "group") {
      socket.to("group-chat").emit("typing:update", {
        chatType: "group",
        userId,
        userName: user.name,
        typing: false
      });
      return;
    }

    if (receiverId) {
      io.to(`user:${receiverId}`).emit("typing:update", {
        chatType: "private",
        userId,
        userName: user.name,
        typing: false
      });
    }
  });

  socket.on("disconnect", async () => {
    const becameOffline = removeOnlineSocket(userId, socket.id);

    if (becameOffline) {
      await User.findByIdAndUpdate(userId, { lastSeen: new Date() });

      io.emit("presence:update", {
        userId,
        online: false,
        lastSeen: new Date().toISOString()
      });
    }
  });
});

// ---------- Start server ----------

async function startServer() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB Connected");

    server.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

startServer();
