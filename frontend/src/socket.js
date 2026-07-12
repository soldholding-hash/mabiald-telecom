import { io } from "socket.io-client";

const SIGNALING_URL = "https://TON-BACKEND-SIGNALING.onrender.com";

export const socket = io(SIGNALING_URL, {
  autoConnect: false,
  transports: ["websocket"],
});
