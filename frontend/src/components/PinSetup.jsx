import { useState } from "react";
import { supabase } from "../supabaseClient";

async function hashPin(pin) {
  const enc = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function PinSetup({ profile, onDone }) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!/^\d{4}$/.test(pin)) {
      setError("Le code PIN doit contenir exactement 4 chiffres.");
      return;
    }
    if (pin !== confirmPin) {
      setError("Les deux codes ne correspondent pas.");
      return;
    }
    setSaving(true);
    const hash = await hashPin(pin);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ money_pin_hash: hash })
      .eq("id", profile.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onDone();
  };

  return (
    <div className="pin-setup">
      <p className="pending-icon">🔒</p>
      <h2>Configure ton code PIN</h2>
      <p className="pending-text">
        Ce code à 4 chiffres protège tes transactions Mabiald Money.
        Tu devras le saisir à chaque envoi d'argent.
      </p>
      <form onSubmit={handleSubmit} className="auth-form">
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          placeholder="Nouveau code PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          placeholder="Confirme le code PIN"
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={saving}>
          {saving ? "Enregistrement..." : "Valider mon code PIN"}
        </button>
      </form>
    </div>
  );
}
