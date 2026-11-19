/** Tesseract (4D hypercube) mark: an outer cube, an inner cube, and the edges joining them. */
export function TesseractIcon({ size = 24, color = "currentColor", strokeWidth = 2, className = "" }: {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 2 20.5 7v10L12 22 3.5 17V7Z" />
      <path d="M12 7.5 16.5 10v5L12 17.5 7.5 15v-5Z" opacity="0.9" />
      <path d="M12 2v5.5M20.5 7l-4 3M20.5 17l-4-2M12 22v-4.5M3.5 17l4-2M3.5 7l4 3" opacity="0.75" />
    </svg>
  );
}
