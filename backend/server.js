const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");
const { Server } = require("socket.io");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

// -------------------- Load ENV & DB --------------------
dotenv.config();
connectDB();

// -------------------- App Init --------------------
const app = express();
app.use(express.json());

// -------------------- CORS --------------------
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5001",
  "https://classs-mate.netlify.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
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

// -------------------- Server --------------------
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () =>
  console.log(`🚀 Server running on PORT ${PORT}`)
);

// -------------------- Socket.IO --------------------
const io = new Server(server, {
  pingTimeout: 60000,
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// -------------------- Gemini Init (Safe) --------------------
console.log("Gemini API Key Loaded:", !!process.env.GEMINI_API_KEY);

let model = null;

if (process.env.GEMINI_API_KEY) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
} else {
  console.error("❌ Gemini API key missing");
}

// -------------------- Socket Events --------------------
io.on("connection", (socket) => {
  console.log("⚡ New socket connected:", socket.id);

  socket.on("setup", (userData) => {
    socket.join(userData._id);
    socket.userId = userData._id;
    socket.emit("connected");
  });

  socket.on("join chat", (room) => {
    socket.join(room);
  });

  socket.on("typing", (room) => socket.in(room).emit("typing"));
  socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

  socket.on("new message", async (newMessageRecieved) => {
    const chat = newMessageRecieved.chat;
    if (!chat?.users) return;

    chat.users.forEach((user) => {
      if (user._id === newMessageRecieved.sender._id) return;
      socket.in(user._id).emit("message received", newMessageRecieved);
    });

    // -------------------- Gemini Suggestions --------------------
    if (!model) return;

    try {
      const prompt = `Suggest 3 short professional replies for this message:\n"${newMessageRecieved.content}"`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      const suggestions = text
        .split(/\n+/)
        .map((s) => s.replace(/^[-*\d.]+\s*/, "").trim())
        .filter(Boolean)
        .slice(0, 3);

      socket.emit("suggestions", suggestions);
    } catch (err) {
      console.error("❌ Gemini error:", err.message);
    }
  });

  socket.on("disconnect", () => {
    if (socket.userId) socket.leave(socket.userId);
    console.log("❌ User disconnected:", socket.userId || "Unknown");
  });
});
