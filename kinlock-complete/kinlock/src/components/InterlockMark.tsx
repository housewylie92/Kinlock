type InterlockMarkProps = {
  size?: number;
  animated?: boolean;
  className?: string;
};

/**
 * The Kinlock signature mark: two arcs that swing together and clasp —
 * a visual for two-way sync (the thing Cozi never had) that also reads
 * as an abstracted "K". Animated version is used on the auth brand panel;
 * static version is used as the small logomark elsewhere.
 */
export function InterlockMark({
  size = 96,
  animated = false,
  className = "",
}: InterlockMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Kinlock"
    >
      <circle cx="48" cy="48" r="46" fill="var(--indigo-dark)" />
      <g className={animated ? "kinlock-arc-left" : ""}>
        <path
          d="M52 20 A28 28 0 0 0 52 76"
          stroke="var(--gold)"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
      </g>
      <g className={animated ? "kinlock-arc-right" : ""}>
        <path
          d="M44 20 A28 28 0 0 1 44 76"
          stroke="var(--teal)"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
      </g>
      <circle cx="48" cy="48" r="4.5" fill="#f5f6fa" />

      {animated && (
        <style>{`
          .kinlock-arc-left {
            transform-origin: 48px 48px;
            animation: clasp-left 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
          }
          .kinlock-arc-right {
            transform-origin: 48px 48px;
            animation: clasp-right 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
          }
          @keyframes clasp-left {
            0% { transform: rotate(-18deg); opacity: 0; }
            100% { transform: rotate(0deg); opacity: 1; }
          }
          @keyframes clasp-right {
            0% { transform: rotate(18deg); opacity: 0; }
            100% { transform: rotate(0deg); opacity: 1; }
          }
        `}</style>
      )}
    </svg>
  );
}
