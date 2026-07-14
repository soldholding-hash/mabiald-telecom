import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";

function formatAmount(n) {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) +
    " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABELS = {
  pending: "En attente de confirmation",
  approved: "Validé",
  rejected: "Refusé par le client",
};

export default function DistributorPanel({ profile, onBack }) {
  const [clientPhone, setClientPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sending, setSending] = useState(false);
  const [requests, setRequests] = useState([]);

  const loadRequests = useCallback(async () => {
    const { data } = await supabase
      .from("withdrawal_requests")
      .select("*, client:client_id(full_name, phone_number)")
      .eq("distributor_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setRequests(data || []);
  }, [profile.id]);

  useEffect(() => {
    loadRequests();
    const channel = supabase
      .channel(`distributor-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "withdrawal_requests" },
        () => loadRequests()
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [profile.id, loadRequests]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const amt = parseFloat(amount);
    if (!clientPhone.trim() || !amt || amt <= 0) {
      setError("Renseigne un numéro client et un montant valides.");
      return;
    }
    setSending(true);
    const { error: rpcError } = await supabase.rpc("request_withdrawal_by_distributor", {
      distributor_id: profile.id,
      client_phone: clientPhone.trim(),
      amount: amt,
    });
    setSending(false);
    if (rpcError) {
      setError(rpcError.message.includes("Client introuvable") ? "Client introuvable." : rpcError.message);
      return;
    }
    setSuccess("Demande envoyée. Le client doit confirmer avec son code PIN.");
    setClientPhone("");
    setAmount("");
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <button className="back-btn" onClick={onBack}>← Retour</button>
        <h2>{profile.commercial_name || "Distributeur"}</h2>
      </div>

      <div className="money-wallet">
        <p className="admin-detail">Code distributeur : <strong>{profile.distributor_code}</strong></p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            type="tel"
            placeholder="Numéro du client"
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
          />
          <input
            type="number"
            placeholder="Montant du retrait (FCFA)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="1"
          />
          {error && <p className="error">{error}</p>}
          {success && <p className="info">{success}</p>}
          <button type="submit" disabled={sending}>
            {sending ? "Envoi..." : "Envoyer la demande au client"}
          </button>
        </form>

        <div className="money-history">
          <h2>Demandes récentes</h2>
          {requests.length === 0 && <p className="empty">Aucune demande pour l'instant.</p>}
          {requests.map((r) => (
            <div key={r.id} className="money-tx-item">
              <div className={`money-tx-icon ${r.status === "approved" ? "in" : r.status === "rejected" ? "out" : ""}`}>
                {r.status === "approved" ? "✓" : r.status === "rejected" ? "✕" : "…"}
              </div>
              <div className="money-tx-info">
                <span className="money-tx-name">{r.client?.full_name || r.client?.phone_number}</span>
                <span className="money-tx-note">{STATUS_LABELS[r.status] || r.status}</span>
                <span className="money-tx-time">{formatTime(r.created_at)}</span>
              </div>
              <span className="money-tx-amount">{formatAmount(r.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
