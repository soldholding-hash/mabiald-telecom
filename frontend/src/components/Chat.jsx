import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { socket } from "../socket";

export default function Chat({ currentUser, contact, onStartCall }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [contactTyping, setContactTyping] = useState(false);
  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);

  useEffect(() => {
    if (!contact) return;
    let channel;

    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${currentUser.id},receiver_id.eq.${contact.id}),and(sender_id.eq.${contact.id},receiver_id.eq.${currentUser.id})`
        )
        .order("created_at", { ascending: true });
      setMessages(data || []);
    };
    load();

    channel = supabase
      .channel(`messages-${currentUser.id}-${contact.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new;
          const involvesPair =
            (m.sender_id === currentUser.id && m.receiver_id === contact.id) ||
            (m.sender_id === contact.id && m.receiver_id === currentUser.id);
          if (involvesPair) setMessages((prev) => [...prev, m]);
        }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [contact, currentUser.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const onTyping = ({ fromUserId, isTyping }) => {
      if (fromUserId === contact?.id) setContactTyping(isTyping);
    };
    socket.on("typing", onTyping);
    return () => socket.off("typing", onTyping);
  }, [contact]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const content = text.trim();
    setText("");
    await supabase.from("messages").insert({
      sender_id: currentUser.id,
      receiver_id: contact.id,
      content,
    });
    socket.emit("typing", { toUserId: contact.id, fromUserId: currentUser.id, isTyping: false });
  };

  const handleTyping = (val) => {
    setText(val);
    socket.emit("typing", { toUserId: contact.id, fromUserId: currentUser.id, isTyping: true });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("typing", { toUserId: contact.id, fromUserId: currentUser.id, isTyping: false });
    }, 1500);
  };

  if (!contact) {
    return <div className="chat-placeholder">Sélectionne un contact pour discuter.</div>;
  }

  return (
    <div className="chat-window">
      <div className="chat-header">
        <span>{contact.full_name || contact.email}</span>
        <div className="call-buttons">
          <button onClick={() => onStartCall(contact.id, "audio")} title="Appel vocal">📞</button>
          <button onClick={() => onStartCall(contact.id, "video")} title="Appel vidéo">🎥</button>
        </div>
      </div>

      <div className="messages-area">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`message-bubble ${m.sender_id === currentUser.id ? "sent" : "received"}`}
          >
            {m.content}
          </div>
        ))}
        {contactTyping && <div className="typing-indicator">en train d'écrire...</div>}
        <div ref={bottomRef} />
      </div>

      <form className="message-input" onSubmit={sendMessage}>
        <input
          type="text"
          value={text}
          onChange={(e) => handleTyping(e.target.value)}
          placeholder="Écris un message..."
        />
        <button type="submit">Envoyer</button>
      </form>
    </div>
  );
}
