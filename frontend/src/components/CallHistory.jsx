import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";

function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

export default function CallHistory({ currentUserId, onCallBack }) {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCalls = useCallback(async () => {
    if (!currentUserId) return;
    const { data } = await supabase
      .from("calls")
      .select("*, caller:caller_id(id, full_name, email, phone_number), callee:callee_id(id, full_name, email, phone_number)")
      .or(`caller_id.eq.${currentUserId},callee_id.eq.${currentUserId}`)
      .order("created_at", { ascending: false })
      .limit(50);
    setCalls(data || []);
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    loadCalls();
    const channel = supabase
      .channel(`calls-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls" },
        () => loadCalls()
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [currentUserId, loadCalls]);

  return (
    <div className="call-history">
      <div className="call-history-header">
        <h2>Appels récents</h2>
      </div>

      {loading && <p className="empty">Chargement...</p>}
      {!loading && calls.length === 0 && (
        <p className="empty">Aucun appel pour l'instant.</p>
      )}

      <div className="call-history-list">
        {calls.map((call) => {
          const isOutgoing = call.caller_id === currentUserId;
          const other = isOutgoing ? call.callee : call.caller;
          const isMissed = call.status === "missed" && !isOutgoing;
          const isRejected = call.status === "rejected";
          const statusLabel =
            call.status === "completed"
              ? isOutgoing ? "Sortant" : "Entrant"
              : call.status === "missed"
              ? isOutgoing ? "Sans réponse" : "Manqué"
              : call.status === "rejected"
              ? "Refusé"
              : "En cours";

          return (
            <div
              key={call.id}
              className="call-history-item"
              onClick={() => other && onCallBack(other, call.call_type)}
            >
              <div className={`call-avatar ${isMissed || isRejected ? "missed" : ""}`}>
                {other?.full_name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="call-history-info">
                <span className={`call-history-name ${isMissed || isRejected ? "missed-text" : ""}`}>
                  {other?.full_name || other?.phone_number || "Utilisateur"}
                </span>
                <span className="call-history-meta">
                  {call.call_type === "video" ? "🎥" : "📞"} {isOutgoing ? "↗" : "↙"} {statusLabel}
                </span>
              </div>
              <span className="call-history-time">{formatTime(call.created_at)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
