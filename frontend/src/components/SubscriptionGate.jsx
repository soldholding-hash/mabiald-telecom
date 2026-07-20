import { useState } from "react";
import { supabase } from "../supabaseClient";

function formatAmount(n) {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

const PRICE = 5000;

export default function SubscriptionGate({ profile, onActivated, onGoToMoney }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleActivate = async () => {
    setError("");
    setLoading(true);
    const { error: rpcError } = await supabase.rpc("activate_subscription", {
      user_id: profile.id,
    });
    setLoading(false);
    if (rpcError) {
      setError(
        rpcError.message.includes("Solde insuffisant")
          ? "Solde insuffisant. Recharge ton compte Green Money."
          : rpcError.message
      );
      return;
    }
    onActivated();
  };

  return (
    <div className="pending-box">
      <p className="pending-icon">🔒</p>
      <p className="pending-title">Abonnement requis</p>
      <p className="pending-text">
        Pour passer des appels et envoyer des messages, active ton abonnement mensuel
        Green Télécom à {formatAmount(PRICE)}, prélevé sur ton solde Green Money.
      </p>
      <p className="money-my-number">Ton solde actuel : {formatAmount(profile?.balance || 0)}</p>
      {error && <p className="error">{error}</p>}
      <div className="money-form-actions">
        <button type="button" className="money-cancel-btn" onClick={onGoToMoney}>
          Recharger
        </button>
        <button type="button" className="money-send-btn" onClick={handleActivate} disabled={loading}>
          {loading ? "Activation..." : `Payer ${formatAmount(PRICE)}`}
        </button>
      </div>
    </div>
  );
}
