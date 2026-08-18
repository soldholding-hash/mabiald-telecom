export default function SipIncomingCall({ incomingCall, inCall, onAccept, onReject, onHangup }) {
  if (!incomingCall && !inCall) return null;

  return (
    <div className="call-modal-overlay">
      <div className="call-modal">
        {incomingCall && !inCall && (
          <>
            <p>Appel entrant depuis un poste fixe...</p>
            <div className="call-actions">
              <button className="accept" onClick={onAccept}>Répondre</button>
              <button className="reject" onClick={onReject}>Refuser</button>
            </div>
          </>
        )}
        {inCall && (
          <>
            <p>Appel en cours (poste fixe)</p>
            <button className="hangup" onClick={onHangup}>Raccrocher</button>
          </>
        )}
      </div>
    </div>
  );
}
