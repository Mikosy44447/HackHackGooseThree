import React from "react";

// Hand-drawn SVG decorations for PoliticAlert

/** Wobbly speech bubble that says HONK */
export function HonkBubble({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 120 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {/* Rough rounded rect */}
      <path
        d="M6 10 C5 4, 12 2, 20 2 L100 3 C110 3, 116 7, 115 14 L113 38 C114 46, 107 50, 98 50 L52 49 L40 58 L44 49 L20 50 C10 50, 4 45, 5 37 Z"
        fill="#fef9c3"
        stroke="#1c1917"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <text
        x="60"
        y="32"
        textAnchor="middle"
        fontSize="18"
        fontWeight="800"
        fill="#713f12"
        fontFamily="Arial, sans-serif"
        letterSpacing="1"
      >
        HONK!
      </text>
    </svg>
  );
}

/** Sketchy wavy divider line */
export function WavyDivider({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 400 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path
        d="M0 10 C20 4, 40 16, 60 10 C80 4, 100 16, 120 10 C140 4, 160 16, 180 10 C200 4, 220 16, 240 10 C260 4, 280 16, 300 10 C320 4, 340 16, 360 10 C380 4, 400 14, 400 10"
        stroke="#d8c9ae"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Small pond ripple accent */
export function PondRipple({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 80 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <ellipse cx="40" cy="20" rx="38" ry="9" fill="#ccfbf1" stroke="#5eead4" strokeWidth="1.5" />
      <ellipse cx="40" cy="20" rx="22" ry="5" fill="#99f6e4" stroke="#2dd4bf" strokeWidth="1.5" />
      <path d="M24 20 C30 17, 50 17, 56 20" stroke="#0f766e" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Sketchy star / highlight burst */
export function SketchStar({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 50 50"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M25 4 L28 20 L44 14 L32 25 L46 32 L29 31 L28 47 L22 32 L6 38 L18 26 L4 18 L21 20 Z"
        fill="#fef08a"
        stroke="#713f12"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Feather doodle accent */
export function FeatherDoodle({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 40 70"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {/* Quill spine */}
      <path d="M20 65 C20 40, 18 20, 22 5" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round" />
      {/* Barbs left */}
      <path d="M20 55 C12 50, 6 46, 4 42" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M20 47 C11 43, 5 38, 3 33" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M20 39 C13 34, 8 28, 7 23" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M20 31 C15 25, 12 18, 13 12" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M21 22 C18 16, 18 10, 21 5" stroke="#fbbf24" strokeWidth="1.2" strokeLinecap="round" />
      {/* Barbs right */}
      <path d="M20 55 C28 50, 34 46, 36 42" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M20 47 C29 43, 35 38, 37 33" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M20 39 C27 34, 32 28, 33 23" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M20 31 C25 25, 28 18, 27 12" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
