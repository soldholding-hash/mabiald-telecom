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
  const audioCtxRef = useRef(null);
  const ringIntervalRef = useRef(null);
  const vibrateIntervalRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  const stopRinging = () => {
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    if (vibrateIntervalRef.current) {
      clearInterval(vibrateIntervalRef.current);
      vibrateIntervalRef.current = null;
    }
    if (navigator.vibrate) navigator.vibrate(0);
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  const playBeep = (ctx, freq, startTime, duration) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
  };

  useEffect(() => {
    if (callState === "ringing") {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const ringPattern = () => {
        const now = ctx.currentTime;
        playBeep(ctx, 880, now, 0.4);
        playBeep(ctx, 880, now + 0.5, 0.4);
      };
      ringPattern();
      ringIntervalRef.current = setInterval(ringPattern, 1800);

      if (navigator.vibrate) {
        navigator.vibrate([400, 200, 400]);
        vibrateIntervalRef.current = setInterval(() => {
          navigator.vibrate([400, 200, 400]);
        }, 1800);
      }
    } else {
      stopRinging();
    }

    return () => {
      stopRinging();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState]);

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
