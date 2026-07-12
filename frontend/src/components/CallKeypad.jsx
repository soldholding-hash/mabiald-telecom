import { useState } from "react";
import { supabase } from "../supabaseClient";

const KEYS = [
  ["1", ""], ["2", "ABC"], ["3", "DEF"],
  ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
  ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
  ["*", ""], ["0", "+"], ["#", ""],
];

export default function CallKeypad({ myPhoneNumber, onCallByPhone }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);

  const pressKey = (key) => {
    setError("");
    setInput((prev) => prev + key);
  };

  const backspace = () => {
    setError("");
    setInput((prev) => prev.slice(0, -1));
  };

  const normalize = (s) => s.replace(/[^0-9+]/g, "");

  const callNow = async (callType) => {
    if (!input.trim()) return;
    setSearching(true);
    setError("");
    const target = normalize(input);
    const { data, error: qErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("phone_number", input.trim());

    let contact = data && data[0];
    if (!contact) {
      const { data: all } = await supabase.from("profiles").select("*");
      contact = all?.find((p) => normalize(p.phone_number || "") === target);
    }

    setSearching(false);
    if (!contact) {
      setError("Aucun utilisateur ne correspond à ce numéro.");
      return;
    }
    onCallByPhone(contact, callType);
  };

  return (
    <div className="keypad-screen">
      <div className="my-number">
        <span>Votre numéro</span>
        <strong>{myPhoneNumber || "..."}</strong>
      </div>

      <div className="keypad-display">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Composer un numéro"
          inputMode="tel"
        />
        {input && (
          <button className="backspace-btn" onClick={backspace}>⌫</button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="keypad-grid">
        {KEYS.map(([num, letters]) => (
          <button key={num} className="keypad-key" onClick={() => pressKey(num)}>
            <span className="keypad-num">{num}</span>
            {letters && <span className="keypad-letters">{letters}</span>}
          </button>
        ))}
      </div>

      <div className="keypad-actions">
        <button
          className="keypad-call-btn audio"
          onClick={() => callNow("audio")}
          disabled={searching || !input.trim()}
          title="Appel vocal"
        >
          📞
        </button>
        <button
          className="keypad-call-btn video"
          onClick={() => callNow("video")}
          disabled={searching || !input.trim()}
          title="Appel vidéo"
        >
          🎥
        </button>
      </div>
    </div>
  );
}
