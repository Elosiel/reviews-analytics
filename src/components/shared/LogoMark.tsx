// RA brand mark — same artwork as src/app/icon.svg (the favicon).
// Keep the two in sync if the logo changes.
export default function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1700 1700"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="1700" height="1700" rx="340" fill="#020607" />
      <g transform="translate(-250,-45)" fill="#4ce9f2">
        <path d="M295 235 L960 235 A235 265 0 0 1 960 765 L860 765 L830 615 L960 615 A95 115 0 0 0 960 385 L390 385 Z" />
        <path d="M833 647 L957 733 L567 1290 L365 1315 Z" />
        <path d="M836 704 L984 676 L1151 1555 L998 1555 Z" />
        <path d="M1098 1141 L1330 455 L1905 1555 L1745 1555 L1330 760 L1135 1336 Z" />
      </g>
    </svg>
  );
}
