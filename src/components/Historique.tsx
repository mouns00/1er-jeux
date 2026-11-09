"use client";

import { useState } from "react";
import { lireHistorique, supprimer, toutEffacer, type Sauvegarde } from "@/lib/history";
import { Bouton, Etiquette, PastilleScenario } from "./ui";

export function Historique({
  onOuvrir,
  onRetour,
}: {
  onOuvrir: (s: Sauvegarde) => void;
  onRetour: () => void;
}) {
  const [liste, setListe] = useState<Sauvegarde[]>(() => lireHistorique());

  return (
    <div className="apparition space-y-5 pt-2">
      <div className="space-y-2">
        <Etiquette>Sur ce téléphone uniquement</Etiquette>
        <h2 className="font-display text-4xl font-extrabold tracking-tight">Tes simulations</h2>
      </div>

      {liste.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line p-6 text-center text-muted">
          Aucune simulation pour l&apos;instant. Lance ta première !
        </p>
      ) : (
        <ul className="space-y-2">
          {liste.map((s) => {
            const v = s.simulation.verdict.penche_vers;
            return (
              <li key={s.id} className="flex items-stretch gap-1">
                <button
                  onClick={() => onOuvrir(s)}
                  className="flex flex-1 items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition hover:bg-surface-2"
                >
                  {v === "egalite" ? (
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 font-display text-sm font-extrabold">
                      =
                    </span>
                  ) : (
                    <PastilleScenario id={v} />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-display font-semibold">{s.simulation.titre}</span>
                    <span className="block font-mono text-[11px] text-muted">
                      {new Date(s.date).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </span>
                </button>
                <button
                  onClick={() => {
                    supprimer(s.id);
                    setListe(lireHistorique());
                  }}
                  aria-label={`Supprimer « ${s.simulation.titre} »`}
                  className="rounded-2xl px-3 text-muted transition hover:bg-surface-2 hover:text-danger"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-2">
        <Bouton variante="secondaire" onClick={onRetour} className="w-full">
          Retour
        </Bouton>
        {liste.length > 0 && (
          <Bouton
            variante="discret"
            className="w-full text-sm"
            onClick={() => {
              if (confirm("Effacer tout l'historique de ce téléphone ?")) {
                toutEffacer();
                setListe([]);
              }
            }}
          >
            Tout effacer
          </Bouton>
        )}
      </div>
    </div>
  );
}
