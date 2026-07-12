import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { socket } from "./socket";
import { useWebRTC } from "./hooks/useWebRTC";
import Auth from "./components/Auth";
import ContactList from "./components/ContactList";
import Chat from "./components/Chat";
import CallModal from "./components/CallModal";
import CallKeypad from "./components/CallKeypad";
import CallHistory from "./components/CallHistory";
import BottomNav from "./components/BottomNav";

export default function App() {
  const [session, setSession] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [profile, setProfile] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [activeTab, setActiveTab] = useState("calls");
  const [callsView, setCallsView] = useState("history");

  const webrtc = useWebRTC(profile?.id);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    const loadProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      setProfile(data || { id: session.user.id, email: session.user.email });
    };
    loadProfile();
  }, [session]);

  useEffect(() => {
    if (!profile?.id) return;
    socket.connect();
    socket.emit("identify", profile.id);
    const onPresence = (ids) => setOnlineUserIds(ids);
    socket.on("presence:update", onPresence);
    return () => {
      socket.off("presence:update", onPresence);
      socket.disconnect();
    };
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    const loadContacts = async () => {
      const { data } = await supabase.from("profiles").select("*").neq("id", profile.id);
      setContacts(data || []);
    };
    loadContacts();
  }, [profile?.id]);

  const handleStartCall = useCallback(
    (toUserId, callType) => {
      webrtc.startCall(toUserId, callType);
    },
    [webrtc]
  );

  const handleCallByPhone = useCallback(
    (contact, callType) => {
      webrtc.startCall(contact.id, callType);
      setCallsView("history");
    },
    [webrtc]
  );

  const handleCallBack = useCallback(
    (contact, callType) => {
      webrtc.startCall(contact.id, callType);
    },
    [webrtc]
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  };

  if (!sessionChecked) {
    return <div className="loading-screen">Chargement...</div>;
  }

  if (!session) return <Auth onAuth={() => {}} />;
  if (!profile) return <div className="loading-screen">Chargement...</div>;

  return (
    <div className="app-layout mobile-layout">
      <div className="mobile-header">
        <span>{profile.full_name || profile.email}</span>
        <button className="logout-btn" onClick={handleLogout}>Déconnexion</button>
      </div>

      <div className="mobile-content">
        {activeTab === "calls" && callsView === "history" && (
          <CallHistory
            currentUserId={profile.id}
            onOpenKeypad={() => setCallsView("keypad")}
            onCallBack={handleCallBack}
          />
        )}

        {activeTab === "calls" && callsView === "keypad" && (
          <div className="chat-with-back">
            <button className="back-btn" onClick={() => setCallsView("history")}>← Retour</button>
            <CallKeypad myPhoneNumber={profile.phone_number} onCallByPhone={handleCallByPhone} />
          </div>
        )}

        {activeTab === "chats" && !activeContact && (
          <ContactList
            contacts={contacts}
            onlineUserIds={onlineUserIds}
            activeContactId={activeContact?.id}
            onSelect={setActiveContact}
          />
        )}

        {activeTab === "chats" && activeContact && (
          <div className="chat-with-back">
            <button className="back-btn" onClick={() => setActiveContact(null)}>← Retour</button>
            <Chat currentUser={profile} contact={activeContact} onStartCall={handleStartCall} />
          </div>
        )}
      </div>

      <BottomNav
        activeTab={activeTab}
        onChange={(tab) => {
          setActiveTab(tab);
          setActiveContact(null);
          setCallsView("history");
        }}
      />

      <CallModal
        callState={webrtc.callState}
        incomingCall={webrtc.incomingCall}
        localStream={webrtc.localStream}
        remoteStream={webrtc.remoteStream}
        onAccept={webrtc.acceptCall}
        onReject={webrtc.rejectCall}
        onEnd={webrtc.endCall}
      />
    </div>
  );
}
