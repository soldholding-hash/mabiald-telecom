import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error: signErr } = await supabase.auth.signUp({ email, password });
        if (signErr) throw signErr;
        if (data.user) {
          await supabase.from("profiles").insert({
            id: data.user.id,
            full_name: fullName,
            email,
            birth_date: birthDate || null,
            birth_place: birthPlace,
            contact_phone: contactPhone,
            address,
            status: "pending",
          });
        }
        if (!data.session) {
          setInfo(
            "Compte créé. Vérifie ta boîte mail pour confirmer ton adresse, puis attends la validation de ton inscription par MABIALD Télécom avant de pouvoir te connecter."
          );
          setMode("login");
        } else {
          onAuth();
        }
      } else {
        const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signErr) throw signErr;
        onAuth();
      }
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
          <>
            <input
              type="text"
              placeholder="Nom et prénom"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <label className="field-label">Date de naissance</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Lieu de naissance"
              value={birthPlace}
              onChange={(e) => setBirthPlace(e.target.value)}
              required
            />
            <input
              type="tel"
              placeholder="Numéro de téléphone"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Adresse"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </>
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
        {info && <p className="info">{info}</p>}
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
