import { useState } from "react";
import { isMuted, setMuted, unlockAudio } from "../lib/sfx";

export default function MuteButton() {
  const [muted, setMuteState] = useState(isMuted);
  return (
    <button
      className="mute-btn"
      type="button"
      onClick={() => {
        const next = !muted;
        setMuted(next);
        setMuteState(next);
        if (!next) unlockAudio();
      }}
    >
      {muted ? "聲音關" : "聲音開"}
    </button>
  );
}
