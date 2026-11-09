export const MENTION =
  "Une simulation, pas une prédiction, ni un conseil financier, juridique ou en immigration.";

export function Mention({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-muted ${className}`}>
      <span aria-hidden>⚠︎ </span>
      {MENTION}
    </p>
  );
}
