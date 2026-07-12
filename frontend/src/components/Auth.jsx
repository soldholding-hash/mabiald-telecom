import { useState } from "react";
import { supabase } from "../supabaseClient";

function generatePhoneNumber() {
  const part1 = Math.floor(10 + Math.random() * 90);
  const part2 = Math.floor(1000 + Math.random() * 9000);
  return `+242 06 ${part1} ${part2}`;
}

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error: signErr } = await supabase.auth.signUp({ email, password });
        if (signErr) throw signErr;
        if (data.user) {
          let inserted = false;
          let attempts = 0;
          while (!inserted && attempts < 5) {
            const phone_number = generatePhoneNumber();
            const { error: insertErr } = await supabase.from("profiles").insert({
              id: data.user.id,
              full_name: fullName,
              email,
              phone_number,
            });
            if (!insertErr) {
              inserted = true;
            } else if (insertErr.code === "23505") {
              attempts++;
            } else {
              throw insertErr;
            }
          }
        }
      } else {
        const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signErr) throw signErr;
      }
      onAuth();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <h1>MABIALD Télécom</h1>
      <p className="tagline">Messagerie, appels vocaux & vidéo</p>
      <form onSubmit={handleSubmit} className="auth-form">
        {mode === "signup" && (
          <input
            type="text"
            placeholder="Nom complet"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Chargement..." : mode === "login" ? "Se connecter" : "Créer un compte"}
        </button>
      </form>
      <button className="link-btn" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
        {mode === "login" ? "Pas de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
      </button>
    </div>
  );
}
