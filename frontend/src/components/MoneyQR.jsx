import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Html5Qrcode } from "html5-qrcode";

export default function MoneyQR({ profile, onScanResult, onClose }) {
  const [tab, setTab] = useState("receive");
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [scanError, setScanError] = useState("");
  const scannerRef = useRef(null);
  const scannerElId = "mabiald-qr-scanner";

  useEffect(() => {
    if (tab === "receive" && profile?.phone_number) {
      QRCode.toDataURL(`mabiald:${profile.phone_number}`, { width: 260, margin: 2 })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null));
    }
  }, [tab, profile?.phone_number]);

  useEffect(() => {
    if (tab !== "scan") return;
    let cancelled = false;
    const scanner = new Html5Qrcode(scannerElId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (decodedText) => {
          if (cancelled) return;
          const match = decodedText.match(/^mabiald:(.+)$/);
          if (match) {
            cancelled = true;
            scanner.stop().catch(() => {});
            onScanResult(match[1]);
          }
        },
        () => {}
      )
      .catch(() => setScanError("Impossible d'accéder à la caméra."));

    return () => {
      cancelled = true;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [tab, onScanResult]);

  return (
    <div className="money-transfer-overlay">
      <div className="money-transfer-form qr-modal">
        <h3>Green Money QR</h3>
        <div className="admin-tabs">
          <button
            className={`admin-tab ${tab === "receive" ? "active" : ""}`}
            onClick={() => setTab("receive")}
          >
            Mon code
          </button>
          <button
            className={`admin-tab ${tab === "scan" ? "active" : ""}`}
            onClick={() => setTab("scan")}
          >
            Scanner
          </button>
        </div>

        {tab === "receive" && (
          <div className="qr-receive-box">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Mon QR code Green Money" className="qr-image" />
            ) : (
              <p className="empty">Génération du code...</p>
            )}
            <p className="money-my-number">{profile?.phone_number}</p>
            <p className="pending-text">Montre ce code pour recevoir de l'argent.</p>
          </div>
        )}

        {tab === "scan" && (
          <div className="qr-scan-box">
            <div id={scannerElId} className="qr-scanner-frame" />
            {scanError && <p className="error">{scanError}</p>}
            <p className="pending-text">Vise le QR code Green Money du bénéficiaire.</p>
          </div>
        )}

        <div className="money-form-actions">
          <button type="button" className="money-cancel-btn" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
