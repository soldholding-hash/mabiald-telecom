import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";

function generatePhoneNumber() {
  const part1 = Math.floor(10 + Math.random() * 90);
  const part2 = Math.floor(1000 + Math.random() * 9000);
  return `03${part1}${part2}`;
}

function generateDistributorCode() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `DIST${n}`;
}

function formatAmount(n) {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

export default function AdminPanel({ onBack }) {
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [phoneInputs, setPhoneInputs] = useState({});
  const [creditInputs, setCreditInputs] = useState({});
  const [distCodeInputs, setDistCodeInputs] = useState({});
  const [distNameInputs, setDistNameInputs] = useState({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("pending");
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState("");

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
      .eq("role", "client")
      .order("created_at", { ascending: false });
    const { data: distData } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "distributor")
      .order("created_at", { ascending: false });

    setPending(pendingData || []);
    setApproved(approvedData || []);
    setDistributors(distData || []);

    const inputs = {};
    const distCodes = {};
    (pendingData || []).forEach((p) => {
      inputs[p.id] = generatePhoneNumber();
    });
    (approvedData || []).forEach((p) => {
      distCodes[p.id] = generateDistributorCode();
    });
    setPhoneInputs(inputs);
    setDistCodeInputs(distCodes);
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

  const handleCredit = async (userId) => {
    const amount = parseFloat(creditInputs[userId]);
    if (!amount || amount <= 0) return;
    setBusyId(userId);
    setMessage("");
    const { error } = await supabase.rpc("credit_money", {
      receiver_id: userId,
      amount,
      note: "Crédit administrateur",
    });
    setBusyId(null);
    if (error) {
      setMessage("Erreur: " + error.message);
    } else {
      setMessage(`${formatAmount(amount)} crédités avec succès.`);
      setCreditInputs((prev) => ({ ...prev, [userId]: "" }));
      loadProfiles();
    }
  };

  const handleMakeDistributor = async (userId) => {
    const code = distCodeInputs[userId]?.trim();
    const name = distNameInputs[userId]?.trim();
    if (!code || !name) {
      setMessage("Renseigne le code distributeur et le nom commercial.");
      return;
    }
    setBusyId(userId);
    setMessage("");
    const { error } = await supabase
      .from("profiles")
      .update({ role: "distributor", distributor_code: code, commercial_name: name })
      .eq("id", userId);
    setBusyId(null);
    if (error) {
      setMessage("Erreur: " + error.message);
    } else {
      setMessage(`${name} est maintenant distributeur agréé (code ${code}).`);
      loadProfiles();
    }
  };

  const handleRevokeDistributor = async (userId) => {
    if (!confirm("Révoquer le statut de distributeur ?")) return;
    await supabase
      .from("profiles")
      .update({ role: "client", distributor_code: null, commercial_name: null })
      .eq("id", userId);
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
          Clients ({approved.length})
        </button>
        <button
          className={`admin-tab ${view === "distributors" ? "active" : ""}`}
          onClick={() => setView("distributors")}
        >
          Distributeurs ({distributors.length})
        </button>
      </div>

      {message && <p className="info">{message}</p>}
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
              <p className="admin-detail">💰 Solde: {formatAmount(p.balance || 0)}</p>
              <div className="admin-phone-row">
                <input
                  type="number"
                  value={creditInputs[p.id] || ""}
                  onChange={(e) =>
                    setCreditInputs((prev) => ({ ...prev, [p.id]: e.target.value }))
                  }
                  placeholder="Montant à créditer (FCFA)"
                  min="1"
                />
              </div>
              <div className="admin-actions">
                <button
                  className="approve-btn"
                  onClick={() => handleCredit(p.id)}
                  disabled={busyId === p.id}
                >
                  {busyId === p.id ? "Envoi..." : "Créditer"}
                </button>
              </div>
              <p className="admin-subheading">Faire de ce client un distributeur</p>
              <div className="admin-phone-row">
                <input
                  type="text"
                  value={distCodeInputs[p.id] || ""}
                  onChange={(e) =>
                    setDistCodeInputs((prev) => ({ ...prev, [p.id]: e.target.value }))
                  }
                  placeholder="Code distributeur"
                />
              </div>
              <div className="admin-phone-row">
                <input
                  type="text"
                  value={distNameInputs[p.id] || ""}
                  onChange={(e) =>
                    setDistNameInputs((prev) => ({ ...prev, [p.id]: e.target.value }))
                  }
                  placeholder="Nom commercial du point de retrait"
                />
              </div>
              <div className="admin-actions">
                <button
                  className="approve-btn"
                  onClick={() => handleMakeDistributor(p.id)}
                  disabled={busyId === p.id}
                >
                  Ériger en distributeur
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && view === "distributors" && distributors.length === 0 && (
        <p className="empty">Aucun distributeur agréé pour l'instant.</p>
      )}

      {!loading && view === "distributors" && (
        <div className="admin-list">
          {distributors.map((d) => (
            <div key={d.id} className="admin-card">
              <p><strong>{d.commercial_name}</strong></p>
              <p className="admin-detail">👤 {d.full_name}</p>
              <p className="admin-detail">🔑 Code: {d.distributor_code}</p>
              <p className="admin-detail">📞 {d.phone_number}</p>
              <div className="admin-actions">
                <button className="reject-btn" onClick={() => handleRevokeDistributor(d.id)}>
                  Révoquer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
