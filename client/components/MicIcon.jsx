import React from "react";

/** Clear microphone glyph for voice + draw recording. */
export default function MicIcon({ className = "", recording = false, style }) {
  return (
    <svg
      className={className}
      style={style}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="9"
        y="3"
        width="6"
        height="11"
        rx="3"
        fill={recording ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M6 11a6 6 0 0 0 12 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 21h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
