import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { socket } from "./socket";
import { useWebRTC } from "./hooks/useWebRTC";
import Auth from "./components/Auth";
import ContactList from "./components/ContactList";
import Chat from "./components/Chat";
import CallModal from "./components/CallModal";

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [activeContact, setActiveContact] = useState(null);

  const webrtc = useWebRTC(profile?.id);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  };

  if (!session) return <Auth onAuth={() => {}} />;
  if (!profile) return <div className="loading-screen">Chargement...</div>;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span>{profile.full_name || profile.email}</span>
          <button className="logout-btn" onClick={handleLogout}>Déconnexion</button>
        </div>
        <ContactList
          contacts={contacts}
          onlineUserIds={onlineUserIds}
          activeContactId={activeContact?.id}
          onSelect={setActiveContact}
        />
      </aside>

      <main className="main-panel">
        <Chat currentUser={profile} contact={activeContact} onStartCall={handleStartCall} />
      </main>

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
