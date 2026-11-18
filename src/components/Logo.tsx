export function DeltaLogo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="dl-g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="50%" stopColor="var(--os-accent)" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id="dl-g2" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <path d="M32 5 L60 55 Q61.5 58 58 58 L6 58 Q2.5 58 4 55 Z" fill="url(#dl-g1)" />
      <path d="M32 22 L46 48 L18 48 Z" fill="#0a0b12" fillOpacity="0.55" />
      <path d="M32 5 L60 55 Q61.5 58 58 58 L44 58 L32 34 Z" fill="url(#dl-g2)" opacity="0.18" />
    </svg>
  );
}

export function ClaudeMark({ size = 18, className = "" }: { size?: number; className?: string }) {
  // A simple sparkle mark for the assistant
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 1.5c.5 4.9 2.2 7.9 4.6 9.1 1.5.7 3.4 1.1 5.9 1.4-2.5.3-4.4.7-5.9 1.4-2.4 1.2-4.1 4.2-4.6 9.1-.5-4.9-2.2-7.9-4.6-9.1-1.5-.7-3.4-1.1-5.9-1.4 2.5-.3 4.4-.7 5.9-1.4C9.8 9.4 11.5 6.4 12 1.5Z" />
    </svg>
  );
}
