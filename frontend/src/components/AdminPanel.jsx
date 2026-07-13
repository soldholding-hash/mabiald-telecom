import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";

function generatePhoneNumber() {
  const part1 = Math.floor(10 + Math.random() * 90);
  const part2 = Math.floor(1000 + Math.random() * 9000);
  return `03${part1}${part2}`;
}

export default function AdminPanel({ onBack }) {
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [phoneInputs, setPhoneInputs] = useState({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("pending");

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    const { data: pendingData } = await supabase
      .from("profiles")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    const { data: approvedData } = await supabase
      .from("profiles")
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    setPending(pendingData || []);
    setApproved(approvedData || []);

    const inputs = {};
    (pendingData || []).forEach((p) => {
      inputs[p.id] = generatePhoneNumber();
    });
    setPhoneInputs(inputs);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const handleApprove = async (userId) => {
    const phone = phoneInputs[userId]?.trim();
    if (!phone) return;
    await supabase
      .from("profiles")
      .update({ phone_number: phone, status: "approved" })
      .eq("id", userId);
    loadProfiles();
  };

  const handleReject = async (userId) => {
    if (!confirm("Rejeter et supprimer cette inscription ?")) return;
    await supabase.from("profiles").delete().eq("id", userId);
    loadProfiles();
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <button className="back-btn" onClick={onBack}>← Retour</button>
        <h2>Administration</h2>
      </div>

      <div className="admin-tabs">
        <button
          className={`admin-tab ${view === "pending" ? "active" : ""}`}
          onClick={() => setView("pending")}
        >
          En attente ({pending.length})
        </button>
        <button
          className={`admin-tab ${view === "approved" ? "active" : ""}`}
          onClick={() => setView("approved")}
        >
          Validés ({approved.length})
        </button>
      </div>

      {loading && <p className="empty">Chargement...</p>}

      {!loading && view === "pending" && pending.length === 0 && (
        <p className="empty">Aucune inscription en attente.</p>
      )}

      {!loading && view === "pending" && (
        <div className="admin-list">
          {pending.map((p) => (
            <div key={p.id} className="admin-card">
              <p><strong>{p.full_name}</strong></p>
              <p className="admin-detail">📧 {p.email}</p>
              <p className="admin-detail">🎂 {p.birth_date} — {p.birth_place}</p>
              <p className="admin-detail">📱 {p.contact_phone}</p>
              <p className="admin-detail">🏠 {p.address}</p>
              <div className="admin-phone-row">
                <input
                  type="text"
                  value={phoneInputs[p.id] || ""}
                  onChange={(e) =>
                    setPhoneInputs((prev) => ({ ...prev, [p.id]: e.target.value }))
                  }
                  placeholder="Numéro MABIALD à attribuer"
                />
              </div>
              <div className="admin-actions">
                <button className="approve-btn" onClick={() => handleApprove(p.id)}>
                  Valider
                </button>
                <button className="reject-btn" onClick={() => handleReject(p.id)}>
                  Rejeter
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && view === "approved" && (
        <div className="admin-list">
          {approved.map((p) => (
            <div key={p.id} className="admin-card">
              <p><strong>{p.full_name}</strong></p>
              <p className="admin-detail">📧 {p.email}</p>
              <p className="admin-detail">📞 {p.phone_number}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
