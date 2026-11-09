"use client";

import { useState } from "react";
import { PRIORITES, type Entree, type ScenarioSimule, type Simulation } from "@/lib/schema";
import { partagerCarte } from "@/lib/share-card";
import { Bouton, Carte, Etiquette, PastilleScenario } from "./ui";
import { Mention } from "./Mention";

function moyenne(s: ScenarioSimule) {
  const n = PRIORITES.map((p) => s.notes[p.id].note);
  return Math.round((n.reduce((a, b) => a + b, 0) / n.length) * 10) / 10;
}

export function Resultat({
  simulation: sim,
  entree,
  onNouvelle,
  onModifier,
}: {
  simulation: Simulation;
  entree: Entree;
  onNouvelle: () => void;
  onModifier: () => void;
}) {
  const [onglet, setOnglet] = useState<"A" | "B">("A");
  const [partage, setPartage] = useState<"" | "en-cours" | "telecharge" | "erreur">("");
  const [A, B] = sim.scenarios;
  const actif = onglet === "A" ? A : B;
  const v = sim.verdict.penche_vers;

  const partager = async () => {
    setPartage("en-cours");
    try {
      const r = await partagerCarte(sim);
      setPartage(r === "telecharge" ? "telecharge" : "");
    } catch {
      setPartage("erreur");
    }
  };

  return (
    <div className="apparition space-y-5 pt-2">
      <div className="space-y-2">
        <Etiquette>Ta simulation · 2027 → 2031</Etiquette>
        <h2 className="font-display text-4xl font-extrabold leading-[1] tracking-tight">{sim.titre}</h2>
        <p className="text-sm text-muted">{entree.decision}</p>
      </div>

      {/* Verdict */}
      <Carte
        className="space-y-3 border-2"
        fond={v === "A" ? "border-a bg-a-soft" : v === "B" ? "border-b bg-b-soft" : "border-ink/30 bg-surface"}
      >
        <div className="flex items-center gap-2">
          {v !== "egalite" && <PastilleScenario id={v} />}
          <Etiquette className="text-ink/70">
            {v === "egalite" ? "Verdict · égalité" : `Verdict · penche vers ${v}`}
          </Etiquette>
        </div>
        <p className="font-display text-2xl font-bold leading-snug">« {sim.verdict.phrase} »</p>
        <p className="leading-relaxed text-ink/80">{sim.verdict.pourquoi}</p>
      </Carte>

      {/* Notes */}
      <Carte className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <Etiquette>Les notes en 2031</Etiquette>
          <p className="font-mono text-xs text-muted">
            <span className="text-a">A {moyenne(A)}</span> · <span className="text-b">B {moyenne(B)}</span>
          </p>
        </div>
        {PRIORITES.map((p) => (
          <div key={p.id} className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="font-semibold">
                {p.label}
                {entree.priorites.indexOf(p.id) >= 0 && (
                  <span className="ml-1.5 font-mono text-[10px] text-muted">
                    #{entree.priorites.indexOf(p.id) + 1}
                  </span>
                )}
              </span>
            </div>
            {([A, B] as const).map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={`h-full rounded-full ${s.id === "A" ? "bg-a" : "bg-b"}`}
                    style={{ width: `${s.notes[p.id].note * 10}%` }}
                  />
                </div>
                <span className="w-10 text-right font-mono text-xs">{s.notes[p.id].note}/10</span>
              </div>
            ))}
          </div>
        ))}
      </Carte>

      {/* Onglets scénarios */}
      <div
        role="tablist"
        className="sticky top-2 z-10 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface/90 p-1 backdrop-blur"
      >
        {([A, B] as const).map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={onglet === s.id}
            onClick={() => setOnglet(s.id)}
            className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold transition ${
              onglet === s.id ? (s.id === "A" ? "bg-a text-bg" : "bg-b text-bg") : "text-muted hover:text-ink"
            }`}
          >
            <span className="font-display font-extrabold">{s.id}</span>
            <span className="line-clamp-1">{s.nom}</span>
          </button>
        ))}
      </div>

      <DetailScenario key={actif.id} s={actif} />

      {/* La vraie question */}
      <Carte className="space-y-2 text-bg" fond="bg-ink border-ink">
        <Etiquette className="text-bg/60">La vraie question à te poser</Etiquette>
        <p className="font-display text-2xl font-bold leading-snug">{sim.vraie_question}</p>
      </Carte>

      <div className="space-y-2 pt-2">
        <Bouton onClick={partager} disabled={partage === "en-cours"} className="w-full">
          {partage === "en-cours" ? "Création de l'image…" : "Partager ma carte verdict"}
        </Bouton>
        {partage === "telecharge" && (
          <p className="text-center text-sm text-muted">Image téléchargée. Poste-la en story !</p>
        )}
        {partage === "erreur" && (
          <p className="text-center text-sm text-danger">Impossible de créer l&apos;image. Réessaie.</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Bouton variante="secondaire" onClick={onModifier}>
            Ajuster
          </Bouton>
          <Bouton variante="secondaire" onClick={onNouvelle}>
            Nouvelle
          </Bouton>
        </div>
      </div>

      <Mention className="pt-2 text-center" />
    </div>
  );
}

function DetailScenario({ s }: { s: ScenarioSimule }) {
  const couleur = s.id === "A" ? "bg-a" : "bg-b";
  const texteCouleur = s.id === "A" ? "text-a" : "text-b";
  return (
    <div role="tabpanel" className="apparition space-y-5">
      <p className="text-lg leading-relaxed">{s.resume}</p>

      {/* Ligne du temps */}
      <ol className="relative space-y-6 pl-8">
        <span className={`absolute bottom-2 left-[9px] top-2 w-0.5 ${couleur} opacity-30`} aria-hidden />
        {s.chronologie.map((a) => (
          <li key={a.annee} className="relative">
            <span
              className={`absolute -left-8 top-1 size-5 rounded-full border-4 border-bg ${couleur}`}
              aria-hidden
            />
            <p className={`font-mono text-xs font-semibold ${texteCouleur}`}>{a.annee}</p>
            <p className="font-display text-lg font-bold leading-snug">{a.titre}</p>
            <p className="mt-1 leading-relaxed text-ink/80">{a.recit}</p>
          </li>
        ))}
      </ol>

      <Carte className="space-y-2">
        <Etiquette>Une journée type en 2031</Etiquette>
        <p className="leading-relaxed">{s.journee_type_2031}</p>
      </Carte>

      <Carte className="space-y-3">
        <Etiquette>Pourquoi ces notes</Etiquette>
        <ul className="space-y-2.5">
          {PRIORITES.map((p) => (
            <li key={p.id} className="text-sm leading-relaxed">
              <span className="font-semibold">
                {p.label} <span className={`font-mono ${texteCouleur}`}>{s.notes[p.id].note}/10</span>
              </span>{" "}
              — <span className="text-ink/80">{s.notes[p.id].pourquoi}</span>
            </li>
          ))}
        </ul>
      </Carte>

      <div className="grid gap-3 sm:grid-cols-2">
        <Carte className="space-y-2">
          <Etiquette className="text-ok">Meilleur cas</Etiquette>
          <p className="leading-relaxed">{s.meilleur_cas}</p>
        </Carte>
        <Carte className="space-y-2">
          <Etiquette className="text-danger">Pire cas</Etiquette>
          <p className="leading-relaxed">{s.pire_cas}</p>
        </Carte>
      </div>

      <Carte className="space-y-2">
        <Etiquette>Les risques</Etiquette>
        <ul className="space-y-2">
          {s.risques.map((r) => (
            <li key={r} className="flex gap-2 leading-relaxed">
              <span className={`mt-2 size-1.5 shrink-0 rounded-full ${couleur}`} aria-hidden />
              {r}
            </li>
          ))}
        </ul>
      </Carte>
    </div>
  );
}
