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

export default function MoneyWallet({ profile, onBalanceChange }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTransfer, setShowTransfer] = useState(false);
  const [targetPhone, setTargetPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sending, setSending] = useState(false);

  const loadTransactions = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("wallet_transactions")
      .select("*, from:from_user_id(id, full_name, phone_number), to:to_user_id(id, full_name, phone_number)")
      .or(`from_user_id.eq.${profile.id},to_user_id.eq.${profile.id}`)
      .order("created_at", { ascending: false })
      .limit(50);
    setTransactions(data || []);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    loadTransactions();
    if (!profile?.id) return;
    const channel = supabase
      .channel(`wallet-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallet_transactions" },
        () => {
          loadTransactions();
          onBalanceChange?.();
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [profile?.id, loadTransactions, onBalanceChange]);

  const handleTransfer = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const amt = parseFloat(amount);
    if (!targetPhone.trim() || !amt || amt <= 0) {
      setError("Renseigne un numéro et un montant valides.");
      return;
    }
    setSending(true);
    try {
      const { data: recipients } = await supabase
        .from("profiles")
        .select("id, full_name, phone_number")
        .eq("phone_number", targetPhone.trim());

      const recipient = recipients && recipients[0];
      if (!recipient) {
        setError("Aucun utilisateur ne correspond à ce numéro.");
        setSending(false);
        return;
      }
      if (recipient.id === profile.id) {
        setError("Tu ne peux pas t'envoyer de l'argent à toi-même.");
        setSending(false);
        return;
      }

      const { error: rpcError } = await supabase.rpc("transfer_money", {
        sender_id: profile.id,
        receiver_id: recipient.id,
        amount: amt,
        note: note || null,
      });

      if (rpcError) throw rpcError;

      setSuccess(`${formatAmount(amt)} envoyé à ${recipient.full_name || recipient.phone_number}.`);
      setTargetPhone("");
      setAmount("");
      setNote("");
      setShowTransfer(false);
      onBalanceChange?.();
    } catch (err) {
      setError(err.message.includes("Solde insuffisant") ? "Solde insuffisant." : err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="money-wallet">
      <div className="money-balance-card">
        <span className="money-balance-label">Solde disponible</span>
        <span className="money-balance-amount">{formatAmount(profile?.balance || 0)}</span>
        <span className="money-my-number">{profile?.phone_number}</span>
        <button className="money-transfer-btn" onClick={() => setShowTransfer(true)}>
          ↗ Envoyer de l'argent
        </button>
      </div>

      {showTransfer && (
        <div className="money-transfer-overlay">
          <form className="money-transfer-form" onSubmit={handleTransfer}>
            <h3>Envoyer de l'argent</h3>
            <input
              type="text"
              placeholder="Numéro du destinataire"
              value={targetPhone}
              onChange={(e) => setTargetPhone(e.target.value)}
              inputMode="tel"
            />
            <input
              type="number"
              placeholder="Montant (FCFA)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
            />
            <input
              type="text"
              placeholder="Note (optionnel)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {error && <p className="error">{error}</p>}
            <div className="money-form-actions">
              <button type="button" className="money-cancel-btn" onClick={() => { setShowTransfer(false); setError(""); }}>
                Annuler
              </button>
              <button type="submit" className="money-send-btn" disabled={sending}>
                {sending ? "Envoi..." : "Envoyer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {success && <p className="info money-success">{success}</p>}

      <div className="money-history">
        <h2>Historique</h2>
        {loading && <p className="empty">Chargement...</p>}
        {!loading && transactions.length === 0 && (
          <p className="empty">Aucune transaction pour l'instant.</p>
        )}
        {transactions.map((t) => {
          const isOutgoing = t.from_user_id === profile.id;
          const isCredit = t.type === "credit";
          const other = isOutgoing ? t.to : t.from;
          return (
            <div key={t.id} className="money-tx-item">
              <div className={`money-tx-icon ${isOutgoing ? "out" : "in"}`}>
                {isCredit ? "＋" : isOutgoing ? "↗" : "↙"}
              </div>
              <div className="money-tx-info">
                <span className="money-tx-name">
                  {isCredit
                    ? "Crédit MABIALD Télécom"
                    : other?.full_name || other?.phone_number || "Utilisateur"}
                </span>
                {t.note && <span className="money-tx-note">{t.note}</span>}
                <span className="money-tx-time">{formatTime(t.created_at)}</span>
              </div>
              <span className={`money-tx-amount ${isOutgoing && !isCredit ? "negative" : "positive"}`}>
                {isOutgoing && !isCredit ? "-" : "+"}{formatAmount(t.amount)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
