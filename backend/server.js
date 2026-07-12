import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());
app.get("/", (req, res) => res.send("MABIALD Telecom - signaling server OK"));
app.get("/health", (req, res) => res.json({ status: "ok", online: onlineUsers.size }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const onlineUsers = new Map();

function broadcastPresence() {
  io.emit("presence:update", Array.from(onlineUsers.keys()));
}

io.on("connection", (socket) => {
  let currentUserId = null;

  socket.on("identify", (userId) => {
    currentUserId = userId;
    onlineUsers.set(userId, socket.id);
    broadcastPresence();
  });

  socket.on("call:offer", ({ toUserId, fromUserId, offer, callType, callId }) => {
    const targetSocket = onlineUsers.get(toUserId);
    if (targetSocket) {
      io.to(targetSocket).emit("call:incoming", { fromUserId, offer, callType, callId });
    } else {
      socket.emit("call:unavailable", { toUserId, callId });
    }
  });

  socket.on("call:answer", ({ toUserId, answer }) => {
    const targetSocket = onlineUsers.get(toUserId);
    if (targetSocket) io.to(targetSocket).emit("call:answered", { answer });
  });

  socket.on("call:ice-candidate", ({ toUserId, candidate }) => {
    const targetSocket = onlineUsers.get(toUserId);
    if (targetSocket) io.to(targetSocket).emit("call:ice-candidate", { candidate });
  });

  socket.on("call:reject", ({ toUserId }) => {
    const targetSocket = onlineUsers.get(toUserId);
    if (targetSocket) io.to(targetSocket).emit("call:rejected");
  });

  socket.on("call:end", ({ toUserId }) => {
    const targetSocket = onlineUsers.get(toUserId);
    if (targetSocket) io.to(targetSocket).emit("call:ended");
  });

  socket.on("typing", ({ toUserId, fromUserId, isTyping }) => {
    const targetSocket = onlineUsers.get(toUserId);
    if (targetSocket) io.to(targetSocket).emit("typing", { fromUserId, isTyping });
  });

  socket.on("disconnect", () => {
    if (currentUserId) {
      onlineUsers.delete(currentUserId);
      broadcastPresence();
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`MABIALD Telecom signaling server démarré sur le port ${PORT}`);
});
