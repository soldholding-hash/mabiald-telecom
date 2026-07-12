export default function BottomNav({ activeTab, onChange }) {
  return (
    <nav className="bottom-nav">
      <button
        className={`bottom-nav-item ${activeTab === "calls" ? "active" : ""}`}
        onClick={() => onChange("calls")}
      >
        <span className="bottom-nav-icon">📞</span>
        <span>Appels</span>
      </button>
      <button
        className={`bottom-nav-item ${activeTab === "chats" ? "active" : ""}`}
        onClick={() => onChange("chats")}
      >
        <span className="bottom-nav-icon">💬</span>
        <span>Discussions</span>
      </button>
    </nav>
  );
}
