import { useEffect, useRef } from "react";

export default function CallModal({
  callState,
  incomingCall,
  localStream,
  remoteStream,
  onAccept,
  onReject,
  onEnd,
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  if (callState === "idle") return null;

  return (
    <div className="call-modal-overlay">
      <div className="call-modal">
        {callState === "ringing" && incomingCall && (
          <>
            <p>Appel {incomingCall.callType === "video" ? "vidéo" : "vocal"} entrant...</p>
            <div className="call-actions">
              <button className="accept" onClick={onAccept}>Répondre</button>
              <button className="reject" onClick={onReject}>Refuser</button>
            </div>
          </>
        )}

        {callState === "calling" && <p>Appel en cours...</p>}

        {callState === "in-call" && (
          <>
            <div className="video-grid">
              <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
              <video ref={localVideoRef} autoPlay playsInline muted className="local-video" />
            </div>
            <button className="hangup" onClick={onEnd}>Raccrocher</button>
          </>
        )}

        {callState === "calling" && (
          <button className="hangup" onClick={onEnd}>Annuler</button>
        )}
      </div>
    </div>
  );
}
