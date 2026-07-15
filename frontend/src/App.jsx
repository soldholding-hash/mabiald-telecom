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
import PendingApproval from "./components/PendingApproval";
import AdminPanel from "./components/AdminPanel";
import MoneyWallet from "./components/MoneyWallet";
import DistributorPanel from "./components/DistributorPanel";

const ADMIN_EMAIL = "mabialdtelecom.admin@gmail.com";

export default function App() {
  const [session, setSession] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [profile, setProfile] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [activeTab, setActiveTab] = useState("calls");
  const [callsView, setCallsView] = useState("keypad");
  const [showAdmin, setShowAdmin] = useState(false);
  const [showDistributor, setShowDistributor] = useState(false);

  const webrtc = useWebRTC(profile?.id);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadProfile = useCallback(async () => {
    if (!session) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();
    setProfile(data || { id: session.user.id, email: session.user.email });
  }, [session]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!profile?.id) return;
    socket.connect();
    socket.emit("identify", profile.id);
    const onConnect = () => socket.emit("identify", profile.id);
    socket.on("connect", onConnect);
    const onPresence = (ids) => setOnlineUserIds(ids);
    socket.on("presence:update", onPresence);
    return () => {
      socket.off("presence:update", onPresence);
      socket.off("connect", onConnect);
      socket.disconnect();
    };
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    const loadContacts = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", profile.id)
        .eq("status", "approved");
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
      setCallsView("keypad");
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

  const isAdmin = profile.email === ADMIN_EMAIL;
  const isDistributor = profile.role === "distributor";

  if (isAdmin && showAdmin) {
    return <AdminPanel onBack={() => setShowAdmin(false)} />;
  }

  if (isDistributor && showDistributor) {
    return <DistributorPanel profile={profile} onBack={() => setShowDistributor(false)} />;
  }

  if (!isAdmin && profile.status === "pending") {
    return <PendingApproval profile={profile} />;
  }

  return (
    <div className="app-layout mobile-layout">
      <div className="mobile-header">
        <span>{profile.full_name || profile.email}</span>
        <div className="header-actions">
          {isAdmin && (
            <button className="admin-btn" onClick={() => setShowAdmin(true)}>⚙️ Admin</button>
          )}
          {isDistributor && (
            <button className="admin-btn" onClick={() => setShowDistributor(true)}>🏧 Distributeur</button>
          )}
          <button className="logout-btn" onClick={handleLogout}>Déconnexion</button>
        </div>
      </div>

      <div className="mobile-content">
        {activeTab === "calls" && callsView === "keypad" && (
          <div className="chat-with-back">
            <div className="calls-topbar">
              <span>Appels</span>
              <button className="history-btn" onClick={() => setCallsView("history")}>
                🕐 Historique
              </button>
            </div>
            <CallKeypad myPhoneNumber={profile.phone_number} onCallByPhone={handleCallByPhone} />
          </div>
        )}

        {activeTab === "calls" && callsView === "history" && (
          <div className="chat-with-back">
            <button className="back-btn" onClick={() => setCallsView("keypad")}>← Retour</button>
            <CallHistory currentUserId={profile.id} onCallBack={handleCallBack} />
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

        {activeTab === "money" && (
          <MoneyWallet profile={profile} onBalanceChange={loadProfile} />
        )}
      </div>

      <BottomNav
        activeTab={activeTab}
        onChange={(tab) => {
          setActiveTab(tab);
          setActiveContact(null);
          setCallsView("keypad");
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
