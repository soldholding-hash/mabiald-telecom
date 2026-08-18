import { useEffect, useRef, useState, useCallback } from "react";
import { UserAgent, Registerer, Inviter, SessionState } from "sip.js";

const ASTERISK_HOST = "169.58.50.109";
const ASTERISK_WSS_PORT = 8089;

export function useSipPhone(phoneNumber, sipPassword) {
  const [registered, setRegistered] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [inCall, setInCall] = useState(false);
  const userAgentRef = useRef(null);
  const registererRef = useRef(null);
  const currentSessionRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const attachRemoteAudio = useCallback((session) => {
    const remoteStream = new MediaStream();
    session.sessionDescriptionHandler.peerConnection
      .getReceivers()
      .forEach((receiver) => {
        if (receiver.track) remoteStream.addTrack(receiver.track);
      });
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!phoneNumber || !sipPassword) return;

    const uri = UserAgent.makeURI(`sip:${phoneNumber}@${ASTERISK_HOST}`);
    if (!uri) return;

    const userAgent = new UserAgent({
      uri,
      transportOptions: {
        server: `wss://${ASTERISK_HOST}:${ASTERISK_WSS_PORT}/ws`,
      },
      authorizationUsername: phoneNumber,
      authorizationPassword: sipPassword,
      delegate: {
        onInvite: (invitation) => {
          currentSessionRef.current = invitation;
          setIncomingCall(invitation);

          invitation.stateChange.addListener((state) => {
            if (state === SessionState.Established) {
              setInCall(true);
              setIncomingCall(null);
              attachRemoteAudio(invitation);
            } else if (
              state === SessionState.Terminated
            ) {
              setInCall(false);
              setIncomingCall(null);
              currentSessionRef.current = null;
            }
          });
        },
      },
    });

    userAgentRef.current = userAgent;

    userAgent
      .start()
      .then(() => {
        const registerer = new Registerer(userAgent);
        registererRef.current = registerer;
        return registerer.register();
      })
      .then(() => setRegistered(true))
      .catch((err) => {
        console.error("Erreur enregistrement SIP:", err);
        setRegistered(false);
      });

    return () => {
      if (registererRef.current) {
        registererRef.current.unregister().catch(() => {});
      }
      if (userAgentRef.current) {
        userAgentRef.current.stop().catch(() => {});
      }
      setRegistered(false);
    };
  }, [phoneNumber, sipPassword, attachRemoteAudio]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    try {
      await incomingCall.accept({
        sessionDescriptionHandlerOptions: {
          constraints: { audio: true, video: false },
        },
      });
    } catch (err) {
      console.error("Erreur en répondant à l'appel:", err);
    }
  }, [incomingCall]);

  const rejectCall = useCallback(() => {
    if (!incomingCall) return;
    incomingCall.reject().catch(() => {});
    setIncomingCall(null);
  }, [incomingCall]);

  const hangup = useCallback(() => {
    const session = currentSessionRef.current;
    if (!session) return;
    if (session.state === SessionState.Established) {
      session.bye().catch(() => {});
    } else {
      session.cancel().catch(() => {});
    }
    setInCall(false);
    setIncomingCall(null);
    currentSessionRef.current = null;
  }, []);

  return {
    registered,
    incomingCall,
    inCall,
    acceptCall,
    rejectCall,
    hangup,
    remoteAudioRef,
  };
}
