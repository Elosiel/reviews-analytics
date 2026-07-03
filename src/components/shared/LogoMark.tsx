// RA brand mark — same artwork as src/app/icon.svg (the favicon).
// Faithful trace of the original neon monogram: continuous arm→bowl→leg R,
// crossbar-less A with a clipped left leg, angled end cuts, cyan glow.
// Keep the two files in sync if the logo changes.
export default function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1800 1800"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter id="ra-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="30" />
        </filter>
        <g id="ra-glyph">
          <path
            d="M 300 232 L 855 232
               C 1035 232 1140 330 1140 478
               C 1140 650 1000 728 865 738
               L 883 716 L 1150 1462 L 997 1497 L 720 685 L 795 608
               C 930 590 1008 555 1008 466
               C 1008 355 935 367 855 367
               L 395 367 Z"
          />
          <path
            d="M 1467 522 L 1958 1492 L 1800 1502 L 1472 770
               L 1230 1120 L 1108 1042 Z"
          />
        </g>
      </defs>
      <rect width="1800" height="1800" rx="360" fill="#050a0b" />
      <g transform="translate(-91,137) scale(0.88)">
        <use href="#ra-glyph" fill="#2fd9e6" opacity="0.8" filter="url(#ra-glow)" />
        <use href="#ra-glyph" fill="#49e8ef" />
      </g>
    </svg>
  );
}
