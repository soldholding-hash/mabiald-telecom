import { useRef, useState, useCallback, useEffect } from "react";
import { socket } from "../socket";
import { supabase } from "../supabaseClient";

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
  const callIdRef = useRef(null);
  const wasAnsweredRef = useRef(false);

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
      const callId = crypto.randomUUID();
      callIdRef.current = callId;
      wasAnsweredRef.current = false;

      await supabase.from("calls").insert({
        id: callId,
        caller_id: currentUserId,
        callee_id: toUserId,
        call_type: callType,
        status: "ringing",
      });

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
        callId,
      });

      setCallState("calling");
    },
    [createPeerConnection, getLocalMedia, currentUserId]
  );

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    const { fromUserId, offer, callType, callId } = incomingCall;
    targetUserRef.current = fromUserId;
    callIdRef.current = callId;
    wasAnsweredRef.current = true;

    if (callId) {
      await supabase
        .from("calls")
        .update({ status: "answered", answered_at: new Date().toISOString() })
        .eq("id", callId);
    }

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
      if (incomingCall.callId) {
        supabase
          .from("calls")
          .update({ status: "rejected", ended_at: new Date().toISOString() })
          .eq("id", incomingCall.callId);
      }
    }
    setIncomingCall(null);
    setCallState("idle");
  }, [incomingCall]);

  const endCall = useCallback(() => {
    if (targetUserRef.current) {
      socket.emit("call:end", { toUserId: targetUserRef.current });
    }
    if (callIdRef.current) {
      const finalStatus = wasAnsweredRef.current ? "completed" : "missed";
      supabase
        .from("calls")
        .update({ status: finalStatus, ended_at: new Date().toISOString() })
        .eq("id", callIdRef.current);
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
    callIdRef.current = null;
    wasAnsweredRef.current = false;
  }, [localStream]);

  useEffect(() => {
    const onIncoming = ({ fromUserId, offer, callType, callId }) => {
      setIncomingCall({ fromUserId, offer, callType, callId });
      setCallState("ringing");
    };

    const onAnswered = async ({ answer }) => {
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        wasAnsweredRef.current = true;
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

    const onUnavailable = ({ callId }) => {
      if (callId) {
        supabase
          .from("calls")
          .update({ status: "missed", ended_at: new Date().toISOString() })
          .eq("id", callId);
      }
      alert("Utilisateur hors ligne ou injoignable.");
      setCallState("idle");
      callIdRef.current = null;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
