import { supabase } from "../supabaseClient";

export default function PendingApproval({ profile }) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="auth-screen">
      <h1>MABIALD Télécom</h1>
      <div className="pending-box">
        <p className="pending-icon">⏳</p>
        <p className="pending-title">Inscription en attente de validation</p>
        <p className="pending-text">
          Merci {profile?.full_name || ""}, ton compte a été créé avec succès.
          Notre équipe vérifie actuellement tes informations et t'attribuera bientôt
          ton numéro MABIALD Télécom. Tu recevras un accès complet dès validation.
        </p>
      </div>
      <button className="link-btn" onClick={handleLogout}>Se déconnecter</button>
    </div>
  );
}
