import { io } from "socket.io-client";

const SIGNALING_URL = "https://mabiald-telecom.onrender.com";

export const socket = io(SIGNALING_URL, {
  autoConnect: false,
  transports: ["websocket"],
});
