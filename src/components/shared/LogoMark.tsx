// RA brand mark — same artwork as src/app/icon.svg (the favicon).
// Keep the two in sync if the logo changes.
export default function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="512" height="512" rx="104" fill="#060a0c" />
      <g fill="none" stroke="#3ceaf6" strokeWidth="46">
        <path
          d="M92 148 H214 C290 148 290 296 214 296 H186 L110 448"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M214 296 L298 448" strokeLinecap="round" />
        <path d="M282 450 L372 178 L462 450" strokeLinecap="round" />
      </g>
    </svg>
  );
}
