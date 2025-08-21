const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { Server } = require("socket.io");
const path = require("path");
const cors = require("cors");

dotenv.config();
connectDB();

const app = express();
app.use(express.json());

// ✅ Allow React frontend (port 3000) to talk to backend
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

// -------------------- API Routes --------------------
app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

// -------------------- Error Middleware --------------------
app.use(notFound);
app.use(errorHandler);

// -------------------- Deployment --------------------
const __dirname1 = path.resolve();
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname1, "/frontend/build")));
  app.get("*", (req, res) =>
    res.sendFile(path.resolve(__dirname1, "frontend", "build", "index.html"))
  );
} else {
  app.get("/", (req, res) => {
    res.send("API is running..");
  });
}
// ------------------------------------------------------

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () =>
  console.log(`🚀 Server running on PORT ${PORT}`)
);

// -------------------- Socket.IO Setup --------------------
const io = new Server(server, {
  pingTimeout: 60000,
  cors: {
    origin: "http://localhost:3000", // ✅ frontend URL
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("⚡ New socket connected:", socket.id);

  // User Setup
  socket.on("setup", (userData) => {
    socket.join(userData._id);
    socket.userId = userData._id;
    socket.emit("connected");
    console.log(`✅ User ${userData._id} joined personal room`);
  });

  // Join a chat room
  socket.on("join chat", (room) => {
    socket.join(room);
    console.log(`📌 User joined chat room: ${room}`);
  });

  // Typing Indicators
  socket.on("typing", (room) => socket.in(room).emit("typing"));
  socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

  // Receive and broadcast new message
  socket.on("new message", (newMessageRecieved) => {
    const chat = newMessageRecieved.chat;
    if (!chat.users) return console.log("❌ chat.users not defined");

    chat.users.forEach((user) => {
      if (user._id === newMessageRecieved.sender._id) return;
      socket.in(user._id).emit("message received", newMessageRecieved);
    });
  });

  // Handle user disconnect
  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.userId || "Unknown"}`);
    if (socket.userId) {
      socket.leave(socket.userId);
    }
  });
});
