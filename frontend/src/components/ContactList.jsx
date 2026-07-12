export default function ContactList({ contacts, onlineUserIds, activeContactId, onSelect }) {
  return (
    <div className="contact-list">
      <h2>Contacts</h2>
      {contacts.length === 0 && <p className="empty">Aucun contact pour l'instant.</p>}
      {contacts.map((c) => (
        <div
          key={c.id}
          className={`contact-item ${activeContactId === c.id ? "active" : ""}`}
          onClick={() => onSelect(c)}
        >
          <div className="avatar">{c.full_name?.charAt(0)?.toUpperCase() || "?"}</div>
          <div className="contact-info">
            <span className="name">{c.full_name || c.email}</span>
            <span className={`status ${onlineUserIds.includes(c.id) ? "online" : "offline"}`}>
              {onlineUserIds.includes(c.id) ? "En ligne" : "Hors ligne"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
