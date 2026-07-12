import { useRef, useState, useCallback, useEffect } from "react";
import { socket } from "../socket";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function useWebRTC(currentUserId) {
  const [callState, setCallState] = useState("idle");
  const [incomingCall, setIncomingCall] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);

  const pcRef = useRef(null);
  const targetUserRef = useRef(null);
  const pendingCandidates = useRef([]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && targetUserRef.current) {
        socket.emit("call:ice-candidate", {
          toUserId: targetUserRef.current,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        setCallState("idle");
      }
    };

    return pc;
  }, []);

  const getLocalMedia = useCallback(async (callType) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === "video",
    });
    setLocalStream(stream);
    return stream;
  }, []);

  const startCall = useCallback(
    async (toUserId, callType) => {
      targetUserRef.current = toUserId;
      const pc = createPeerConnection();
      pcRef.current = pc;

      const stream = await getLocalMedia(callType);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("call:offer", {
        toUserId,
        fromUserId: currentUserId,
        offer,
        callType,
      });

      setCallState("calling");
    },
    [createPeerConnection, getLocalMedia, currentUserId]
  );

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    const { fromUserId, offer, callType } = incomingCall;
    targetUserRef.current = fromUserId;

    const pc = createPeerConnection();
    pcRef.current = pc;

    const stream = await getLocalMedia(callType);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    pendingCandidates.current.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)));
    pendingCandidates.current = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("call:answer", { toUserId: fromUserId, answer });
    setCallState("in-call");
    setIncomingCall(null);
  }, [incomingCall, createPeerConnection, getLocalMedia]);

  const rejectCall = useCallback(() => {
    if (incomingCall) {
      socket.emit("call:reject", { toUserId: incomingCall.fromUserId });
    }
    setIncomingCall(null);
    setCallState("idle");
  }, [incomingCall]);

  const endCall = useCallback(() => {
    if (targetUserRef.current) {
      socket.emit("call:end", { toUserId: targetUserRef.current });
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallState("idle");
    targetUserRef.current = null;
  }, [localStream]);

  useEffect(() => {
    const onIncoming = ({ fromUserId, offer, callType }) => {
      setIncomingCall({ fromUserId, offer, callType });
      setCallState("ringing");
    };

    const onAnswered = async ({ answer }) => {
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        setCallState("in-call");
      }
    };

    const onIceCandidate = ({ candidate }) => {
      if (pcRef.current && pcRef.current.remoteDescription) {
        pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        pendingCandidates.current.push(candidate);
      }
    };

    const onRejected = () => {
      endCall();
    };

    const onEnded = () => {
      endCall();
    };

    const onUnavailable = () => {
      alert("Utilisateur hors ligne ou injoignable.");
      setCallState("idle");
    };

    socket.on("call:incoming", onIncoming);
    socket.on("call:answered", onAnswered);
    socket.on("call:ice-candidate", onIceCandidate);
    socket.on("call:rejected", onRejected);
    socket.on("call:ended", onEnded);
    socket.on("call:unavailable", onUnavailable);

    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:answered", onAnswered);
      socket.off("call:ice-candidate", onIceCandidate);
      socket.off("call:rejected", onRejected);
      socket.off("call:ended", onEnded);
      socket.off("call:unavailable", onUnavailable);
    };
  }, [endCall]);

  return {
    callState,
    incomingCall,
    localStream,
    remoteStream,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
  };
}
