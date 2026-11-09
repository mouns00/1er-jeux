"use client";

import { useEffect, useMemo, useState } from "react";
import { parse } from "partial-json";
import { Bouton, Carte, Etiquette, PastilleScenario } from "./ui";

type Partiel = {
  simulation?: {
    titre?: string;
    scenarios?: {
      nom?: string;
      chronologie?: { annee?: number; titre?: string; recit?: string }[];
      journee_type_2031?: string;
    }[];
    verdict?: { phrase?: string };
  } | null;
};

const ANNEES = [2027, 2028, 2029, 2030, 2031];

const PHRASES = [
  "Ton jumeau fait ses valises…",
  "On avance le calendrier…",
  "On compare les deux vies…",
  "On regarde ce qui pourrait mal tourner…",
  "On cherche la vraie question…",
];

function lirePartiel(texte: string): Partiel | null {
  if (!texte) return null;
  try {
    return parse(texte) as Partiel;
  } catch {
    return null;
  }
}

export function Chargement({ texte, onAnnuler }: { texte: string; onAnnuler: () => void }) {
  const p = useMemo(() => lirePartiel(texte)?.simulation ?? null, [texte]);
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % PHRASES.length), 3500);
    return () => clearInterval(t);
  }, []);

  const scenarios = p?.scenarios ?? [];
  // Dernier morceau de récit reçu, pour montrer que ça avance.
  const apercu = scenarios
    .map((s, k) => ({ id: k === 0 ? "A" : "B", der: s.chronologie?.at(-1) }))
    .filter((x) => x.der?.titre)
    .at(-1);
  const etape = !p
    ? "On prépare la simulation"
    : p.verdict?.phrase
      ? "Verdict en cours"
      : scenarios[1]?.chronologie?.length
        ? "Scénario B"
        : scenarios[0]?.chronologie?.length
          ? "Scénario A"
          : "On pose le décor";

  return (
    <div className="apparition space-y-6 pt-4" aria-live="polite">
      <div className="space-y-2">
        <Etiquette>Simulation en cours · {etape}</Etiquette>
        <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight">
          {p?.titre || PHRASES[i]}
        </h2>
        {p?.titre && <p className="pulse-doux text-muted">{PHRASES[i]}</p>}
      </div>

      <Carte className="space-y-5">
        {(["A", "B"] as const).map((id, k) => {
          const s = scenarios[k];
          const n = s?.chronologie?.length ?? 0;
          return (
            <div key={id} className="space-y-3">
              <div className="flex items-center gap-3">
                <PastilleScenario id={id} />
                <p className="font-display text-lg font-semibold leading-tight">
                  {s?.nom || <span className="text-muted">Scénario {id}</span>}
                </p>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {ANNEES.map((a, j) => {
                  const fait = j < n - 1 || (j === n - 1 && !!s?.journee_type_2031);
                  const encours = j === n - 1 && !fait;
                  return (
                    <div key={a} className="space-y-1">
                      <div
                        className={`h-2 rounded-full transition-colors duration-500 ${
                          fait ? (id === "A" ? "bg-a" : "bg-b") : encours ? `pulse-doux ${id === "A" ? "bg-a" : "bg-b"}` : "bg-surface-2"
                        }`}
                      />
                      <p className="text-center font-mono text-[10px] text-muted">{a}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Carte>

      {apercu && (
        <p key={apercu.id + apercu.der?.titre} className="apparition text-sm text-muted">
          <span className="font-mono text-xs">
            {apercu.id} · {apercu.der?.annee ?? "…"}
          </span>{" "}
          — {apercu.der?.titre}
        </p>
      )}

      <p className="text-sm text-muted">
        Ça prend en général entre 30 secondes et 1 minute 30. Tu peux garder l&apos;écran ouvert.
      </p>
      <Bouton variante="secondaire" onClick={onAnnuler} className="w-full">
        Annuler
      </Bouton>
    </div>
  );
}
