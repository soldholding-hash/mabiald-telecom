import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import PinSetup from "./PinSetup";
import MoneyQR from "./MoneyQR";

async function hashPin(pin) {
  const enc = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

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
  const [step, setStep] = useState("form");
  const [targetPhone, setTargetPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [recipient, setRecipient] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sending, setSending] = useState(false);

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [wStep, setWStep] = useState("form");
  const [distCode, setDistCode] = useState("");
  const [wAmount, setWAmount] = useState("");
  const [distributor, setDistributor] = useState(null);
  const [wPin, setWPin] = useState("");
  const [wError, setWError] = useState("");
  const [wSending, setWSending] = useState(false);

  const [showQR, setShowQR] = useState(false);

  const [incomingRequest, setIncomingRequest] = useState(null);
  const [incomingPin, setIncomingPin] = useState("");
  const [incomingError, setIncomingError] = useState("");
  const [incomingBusy, setIncomingBusy] = useState(false);

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

  const checkIncomingRequest = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("withdrawal_requests")
      .select("*, distributor:distributor_id(commercial_name, phone_number)")
      .eq("client_id", profile.id)
      .eq("status", "pending")
      .eq("initiated_by", "distributor")
      .order("created_at", { ascending: false })
      .limit(1);
    setIncomingRequest((data && data[0]) || null);
  }, [profile?.id]);

  useEffect(() => {
    loadTransactions();
    checkIncomingRequest();
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "withdrawal_requests" },
        () => {
          checkIncomingRequest();
          onBalanceChange?.();
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [profile?.id, loadTransactions, checkIncomingRequest, onBalanceChange]);

  const resetTransferState = () => {
    setShowTransfer(false);
    setStep("form");
    setTargetPhone("");
    setAmount("");
    setNote("");
    setRecipient(null);
    setPin("");
    setError("");
  };

  const handleScanResult = (phone) => {
    setShowQR(false);
    setTargetPhone(phone);
    setAmount("");
    setNote("");
    setStep("form");
    setShowTransfer(true);
  };

  const handleLookup = async (e) => {
    e.preventDefault();
    setError("");
    const amt = parseFloat(amount);
    if (!targetPhone.trim() || !amt || amt <= 0) {
      setError("Renseigne un numéro et un montant valides.");
      return;
    }
    const { data: recipients } = await supabase
      .from("profiles")
      .select("id, full_name, phone_number")
      .eq("phone_number", targetPhone.trim());

    const found = recipients && recipients[0];
    if (!found) {
      setError("Aucun utilisateur ne correspond à ce numéro.");
      return;
    }
    if (found.id === profile.id) {
      setError("Tu ne peux pas t'envoyer de l'argent à toi-même.");
      return;
    }
    setRecipient(found);
    setStep("confirm");
  };

  const handlePinConfirm = async (e) => {
    e.preventDefault();
    setError("");
    if (!/^\d{4}$/.test(pin)) {
      setError("Le code PIN doit contenir 4 chiffres.");
      return;
    }
    setSending(true);
    try {
      const enteredHash = await hashPin(pin);
      if (enteredHash !== profile.money_pin_hash) {
        setError("Code PIN incorrect.");
        setSending(false);
        return;
      }
      const amt = parseFloat(amount);
      const { error: rpcError } = await supabase.rpc("transfer_money", {
        sender_id: profile.id,
        receiver_id: recipient.id,
        amount: amt,
        note: note || null,
      });
      if (rpcError) throw rpcError;
      setSuccess(`${formatAmount(amt)} envoyé à ${recipient.full_name || recipient.phone_number}.`);
      resetTransferState();
      onBalanceChange?.();
    } catch (err) {
      setError(err.message.includes("Solde insuffisant") ? "Solde insuffisant." : err.message);
      setSending(false);
    }
  };

  const resetWithdrawState = () => {
    setShowWithdraw(false);
    setWStep("form");
    setDistCode("");
    setWAmount("");
    setDistributor(null);
    setWPin("");
    setWError("");
  };

  const handleWithdrawLookup = async (e) => {
    e.preventDefault();
    setWError("");
    const amt = parseFloat(wAmount);
    if (!distCode.trim() || !amt || amt <= 0) {
      setWError("Renseigne un code distributeur et un montant valides.");
      return;
    }
    if (amt > (profile.balance || 0)) {
      setWError("Solde insuffisant.");
      return;
    }
    const { data: dists } = await supabase
      .from("profiles")
      .select("id, commercial_name, distributor_code")
      .eq("distributor_code", distCode.trim())
      .eq("role", "distributor");

    const found = dists && dists[0];
    if (!found) {
      setWError("Code distributeur invalide.");
      return;
    }
    setDistributor(found);
    setWStep("confirm");
  };

  const handleWithdrawPinConfirm = async (e) => {
    e.preventDefault();
    setWError("");
    if (!/^\d{4}$/.test(wPin)) {
      setWError("Le code PIN doit contenir 4 chiffres.");
      return;
    }
    setWSending(true);
    try {
      const enteredHash = await hashPin(wPin);
      if (enteredHash !== profile.money_pin_hash) {
        setWError("Code PIN incorrect.");
        setWSending(false);
        return;
      }
      const amt = parseFloat(wAmount);
      const { error: rpcError } = await supabase.rpc("withdraw_by_client_code", {
        client_id: profile.id,
        dist_code: distCode.trim(),
        amount: amt,
      });
      if (rpcError) throw rpcError;
      setSuccess(`Retrait de ${formatAmount(amt)} effectué chez ${distributor.commercial_name}.`);
      resetWithdrawState();
      onBalanceChange?.();
    } catch (err) {
      setWError(err.message.includes("Solde insuffisant") ? "Solde insuffisant." : err.message);
      setWSending(false);
    }
  };

  const handleAcceptIncoming = async (e) => {
    e.preventDefault();
    setIncomingError("");
    if (!/^\d{4}$/.test(incomingPin)) {
      setIncomingError("Le code PIN doit contenir 4 chiffres.");
      return;
    }
    setIncomingBusy(true);
    try {
      const enteredHash = await hashPin(incomingPin);
      if (enteredHash !== profile.money_pin_hash) {
        setIncomingError("Code PIN incorrect.");
        setIncomingBusy(false);
        return;
      }
      const { error: rpcError } = await supabase.rpc("confirm_withdrawal_by_client", {
        request_id: incomingRequest.id,
        client_id: profile.id,
      });
      if (rpcError) throw rpcError;
      setSuccess(`Retrait de ${formatAmount(incomingRequest.amount)} confirmé.`);
      setIncomingRequest(null);
      setIncomingPin("");
      onBalanceChange?.();
    } catch (err) {
      setIncomingError(err.message.includes("Solde insuffisant") ? "Solde insuffisant." : err.message);
      setIncomingBusy(false);
    }
  };

  const handleRejectIncoming = async () => {
    setIncomingBusy(true);
    await supabase.rpc("reject_withdrawal_by_client", {
      request_id: incomingRequest.id,
      client_id: profile.id,
    });
    setIncomingRequest(null);
    setIncomingPin("");
    setIncomingBusy(false);
  };

  if (!profile?.money_pin_hash) {
    return <PinSetup profile={profile} onDone={onBalanceChange} />;
  }

  return (
    <div className="money-wallet">
      <div className="money-balance-card">
        <span className="money-balance-label">Solde disponible</span>
        <span className="money-balance-amount">{formatAmount(profile?.balance || 0)}</span>
        <span className="money-my-number">{profile?.phone_number}</span>
        <div className="money-balance-actions">
          <button className="money-transfer-btn" onClick={() => setShowTransfer(true)}>
            ↗ Envoyer
          </button>
          <button className="money-withdraw-btn" onClick={() => setShowWithdraw(true)}>
            🏧 Retirer
          </button>
          <button className="money-withdraw-btn" onClick={() => setShowQR(true)}>
            📷 QR
          </button>
        </div>
      </div>

      {showQR && (
        <MoneyQR profile={profile} onScanResult={handleScanResult} onClose={() => setShowQR(false)} />
      )}

      {incomingRequest && (
        <div className="money-transfer-overlay">
          <form className="money-transfer-form" onSubmit={handleAcceptIncoming}>
            <h3>Demande de retrait</h3>
            <div className="money-confirm-box">
              <p className="money-confirm-name">{incomingRequest.distributor?.commercial_name}</p>
              <p className="money-confirm-amount">{formatAmount(incomingRequest.amount)}</p>
            </div>
            <p className="pending-text">
              Ce distributeur demande à retirer ce montant de ton compte. Confirme avec ton code PIN si c'est bien toi.
            </p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="Code PIN"
              value={incomingPin}
              onChange={(e) => setIncomingPin(e.target.value.replace(/\D/g, ""))}
              autoFocus
            />
            {incomingError && <p className="error">{incomingError}</p>}
            <div className="money-form-actions">
              <button type="button" className="money-cancel-btn" onClick={handleRejectIncoming} disabled={incomingBusy}>
                Refuser
              </button>
              <button type="submit" className="money-send-btn" disabled={incomingBusy}>
                {incomingBusy ? "..." : "Confirmer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showTransfer && step === "form" && (
        <div className="money-transfer-overlay">
          <form className="money-transfer-form" onSubmit={handleLookup}>
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
              <button type="button" className="money-cancel-btn" onClick={resetTransferState}>
                Annuler
              </button>
              <button type="submit" className="money-send-btn">
                Continuer
              </button>
            </div>
          </form>
        </div>
      )}

      {showTransfer && step === "confirm" && recipient && (
        <div className="money-transfer-overlay">
          <div className="money-transfer-form">
            <h3>Confirme le bénéficiaire</h3>
            <div className="money-confirm-box">
              <p className="money-confirm-name">{recipient.full_name || "Nom non renseigné"}</p>
              <p className="money-confirm-phone">{recipient.phone_number}</p>
              <p className="money-confirm-amount">{formatAmount(parseFloat(amount) || 0)}</p>
              {note && <p className="money-confirm-note">Note : {note}</p>}
            </div>
            <p className="pending-text">Vérifie bien le nom avant de continuer.</p>
            <div className="money-form-actions">
              <button type="button" className="money-cancel-btn" onClick={() => setStep("form")}>
                Modifier
              </button>
              <button type="button" className="money-send-btn" onClick={() => setStep("pin")}>
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {showTransfer && step === "pin" && recipient && (
        <div className="money-transfer-overlay">
          <form className="money-transfer-form" onSubmit={handlePinConfirm}>
            <h3>Code PIN requis</h3>
            <p className="pending-text">
              Envoi de {formatAmount(parseFloat(amount) || 0)} à {recipient.full_name || recipient.phone_number}
            </p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="Code PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              autoFocus
            />
            {error && <p className="error">{error}</p>}
            <div className="money-form-actions">
              <button type="button" className="money-cancel-btn" onClick={() => setStep("confirm")}>
                Retour
              </button>
              <button type="submit" className="money-send-btn" disabled={sending}>
                {sending ? "Envoi..." : "Valider"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showWithdraw && wStep === "form" && (
        <div className="money-transfer-overlay">
          <form className="money-transfer-form" onSubmit={handleWithdrawLookup}>
            <h3>Retirer de l'argent</h3>
            <input
              type="text"
              placeholder="Code distributeur"
              value={distCode}
              onChange={(e) => setDistCode(e.target.value)}
            />
            <input
              type="number"
              placeholder="Montant (FCFA)"
              value={wAmount}
              onChange={(e) => setWAmount(e.target.value)}
              min="1"
            />
            {wError && <p className="error">{wError}</p>}
            <div className="money-form-actions">
              <button type="button" className="money-cancel-btn" onClick={resetWithdrawState}>
                Annuler
              </button>
              <button type="submit" className="money-send-btn">
                Continuer
              </button>
            </div>
          </form>
        </div>
      )}

      {showWithdraw && wStep === "confirm" && distributor && (
        <div className="money-transfer-overlay">
          <div className="money-transfer-form">
            <h3>Confirme le distributeur</h3>
            <div className="money-confirm-box">
              <p className="money-confirm-name">{distributor.commercial_name}</p>
              <p className="money-confirm-amount">{formatAmount(parseFloat(wAmount) || 0)}</p>
            </div>
            <p className="pending-text">Vérifie bien le nom avant de continuer.</p>
            <div className="money-form-actions">
              <button type="button" className="money-cancel-btn" onClick={() => setWStep("form")}>
                Modifier
              </button>
              <button type="button" className="money-send-btn" onClick={() => setWStep("pin")}>
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {showWithdraw && wStep === "pin" && distributor && (
        <div className="money-transfer-overlay">
          <form className="money-transfer-form" onSubmit={handleWithdrawPinConfirm}>
            <h3>Code PIN requis</h3>
            <p className="pending-text">
              Retrait de {formatAmount(parseFloat(wAmount) || 0)} chez {distributor.commercial_name}
            </p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="Code PIN"
              value={wPin}
              onChange={(e) => setWPin(e.target.value.replace(/\D/g, ""))}
              autoFocus
            />
            {wError && <p className="error">{wError}</p>}
            <div className="money-form-actions">
              <button type="button" className="money-cancel-btn" onClick={() => setWStep("confirm")}>
                Retour
              </button>
              <button type="submit" className="money-send-btn" disabled={wSending}>
                {wSending ? "Envoi..." : "Valider"}
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
                    ? "Crédit Green Télécom"
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
