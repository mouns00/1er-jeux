import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variante = "principal" | "secondaire" | "discret";

export function Bouton({
  variante = "principal",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  const base =
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 font-display text-base font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-a";
  const styles: Record<Variante, string> = {
    principal: "bg-ink text-bg hover:opacity-90",
    secondaire: "border border-line bg-surface text-ink hover:bg-surface-2",
    discret: "text-muted hover:text-ink",
  };
  return <button className={`${base} ${styles[variante]} ${className}`} {...props} />;
}

export function Carte({
  children,
  className = "",
  fond = "bg-surface border-line",
}: {
  children: ReactNode;
  className?: string;
  /** Classes de fond et de bordure (remplacent celles par défaut). */
  fond?: string;
}) {
  return (
    <section className={`rounded-3xl border p-5 sm:p-6 ${fond} ${className}`}>
      {children}
    </section>
  );
}

export function Etiquette({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted ${className}`}>
      {children}
    </p>
  );
}

export function PastilleScenario({ id, className = "" }: { id: "A" | "B"; className?: string }) {
  return (
    <span
      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-lg font-display text-sm font-extrabold text-bg ${
        id === "A" ? "bg-a" : "bg-b"
      } ${className}`}
    >
      {id}
    </span>
  );
}
