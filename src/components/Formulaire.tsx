"use client";

import { useEffect, useState } from "react";
import { PRIORITES, type Entree, type PrioriteId } from "@/lib/schema";
import { Bouton, Etiquette, PastilleScenario } from "./ui";
import { Mention } from "./Mention";

const VIDE: Entree = { decision: "", scenarioA: "", scenarioB: "", situation: "", priorites: [] };

const EXEMPLE: Entree = {
  decision: "Est-ce que je quitte Paris pour m'installer à Montréal ?",
  scenarioA:
    "Je reste à Paris, je garde mon CDI de cheffe de projet et je vise une promotion dans 2 ans.",
  scenarioB:
    "Je pars à Montréal avec un PVT, je cherche un poste dans la tech et je recommence à zéro.",
  situation:
    "29 ans, célibataire, pas d'enfants. 15 000 € d'épargne. Mes parents vieillissent et vivent à Lyon. Je me sens à l'étroit dans ma vie actuelle.",
  priorites: ["liberte", "serenite", "argent", "famille"],
};

const CLE_BROUILLON = "jumeau:brouillon";

const champ =
  "w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base text-ink placeholder:text-muted/70 outline-none transition focus:border-ink/40 focus:ring-4 focus:ring-ink/5";

export function Formulaire({
  initial,
  onValider,
}: {
  initial?: Entree;
  onValider: (e: Entree) => void;
}) {
  const [e, setE] = useState<Entree>(initial ?? VIDE);
  const [erreur, setErreur] = useState<string | null>(null);

  // Reprend le brouillon en cours (pratique si on ferme l'app par erreur).
  useEffect(() => {
    if (initial) return;
    try {
      const b = localStorage.getItem(CLE_BROUILLON);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique au montage
      if (b) setE({ ...VIDE, ...JSON.parse(b) });
    } catch {}
  }, [initial]);

  useEffect(() => {
    try {
      localStorage.setItem(CLE_BROUILLON, JSON.stringify(e));
    } catch {}
  }, [e]);

  const maj = <K extends keyof Entree>(k: K, v: Entree[K]) => setE((x) => ({ ...x, [k]: v }));

  const basculer = (id: PrioriteId) =>
    maj(
      "priorites",
      e.priorites.includes(id) ? e.priorites.filter((p) => p !== id) : [...e.priorites, id],
    );

  const valider = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (e.decision.trim().length < 5) return setErreur("Décris ta décision en une phrase.");
    if (e.scenarioA.trim().length < 3) return setErreur("Décris le scénario A.");
    if (e.scenarioB.trim().length < 3) return setErreur("Décris le scénario B.");
    setErreur(null);
    onValider(e);
  };

  return (
    <form onSubmit={valider} className="apparition space-y-7">
      <div className="space-y-3 pt-2">
        <h1 className="font-display text-[2.6rem] font-extrabold leading-[0.95] tracking-tight sm:text-6xl">
          Vis tes 5 prochaines années.
          <span className="block text-muted">Deux fois.</span>
        </h1>
        <p className="max-w-prose text-base leading-relaxed text-muted">
          Tu hésites avant un grand choix ? Décris-le. L&apos;IA simule ta vie de 2027 à 2031 dans
          chaque scénario, pour t&apos;aider à voir ce qui compte vraiment pour toi.
        </p>
        <button
          type="button"
          onClick={() => setE(EXEMPLE)}
          className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-a underline-offset-4 hover:underline"
        >
          Remplir avec un exemple →
        </button>
      </div>

      <label className="block space-y-2">
        <Etiquette>Ta décision</Etiquette>
        <input
          className={champ}
          value={e.decision}
          maxLength={300}
          onChange={(x) => maj("decision", x.target.value)}
          placeholder="Ex. : Est-ce que je lance mon business ?"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        {(["A", "B"] as const).map((id) => {
          const k = id === "A" ? "scenarioA" : "scenarioB";
          return (
            <label key={id} className="block space-y-2">
              <span className="flex items-center gap-2">
                <PastilleScenario id={id} />
                <Etiquette>Scénario {id}</Etiquette>
              </span>
              <textarea
                className={`${champ} min-h-28 resize-y ${id === "A" ? "focus:border-a" : "focus:border-b"}`}
                value={e[k]}
                maxLength={600}
                onChange={(x) => maj(k, x.target.value)}
                placeholder={
                  id === "A"
                    ? "Ex. : Je reste salarié et je garde la sécurité."
                    : "Ex. : Je démissionne et j'ouvre mon café."
                }
              />
            </label>
          );
        })}
      </div>

      <label className="block space-y-2">
        <Etiquette>Ta situation (facultatif)</Etiquette>
        <textarea
          className={`${champ} min-h-28 resize-y`}
          value={e.situation}
          maxLength={1500}
          onChange={(x) => maj("situation", x.target.value)}
          placeholder="Âge, famille, travail, argent de côté, ce qui te pèse, ce qui te fait envie…"
        />
        <span className="block text-xs text-muted">
          Plus tu donnes de détails, plus la simulation te ressemblera. Évite les infos qui
          permettraient de t&apos;identifier (nom, adresse…).
        </span>
      </label>

      <fieldset className="space-y-3">
        <legend>
          <Etiquette>Tes priorités, dans l&apos;ordre</Etiquette>
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRIORITES.map((p) => {
            const rang = e.priorites.indexOf(p.id);
            const actif = rang >= 0;
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => basculer(p.id)}
                aria-pressed={actif}
                className={`flex min-h-12 items-center justify-between rounded-2xl border px-4 text-left font-medium transition ${
                  actif
                    ? "border-ink bg-ink text-bg"
                    : "border-line bg-surface text-ink hover:bg-surface-2"
                }`}
              >
                {p.label}
                <span className="font-mono text-xs opacity-80">{actif ? `#${rang + 1}` : "+"}</span>
              </button>
            );
          })}
        </div>
        <span className="block text-xs text-muted">Touche-les dans l&apos;ordre d&apos;importance pour toi.</span>
      </fieldset>

      {erreur && (
        <p role="alert" className="rounded-2xl bg-b-soft px-4 py-3 text-sm font-medium text-ink">
          {erreur}
        </p>
      )}

      <div className="space-y-3">
        <Bouton type="submit" className="w-full text-lg">
          Simuler mes deux futurs
        </Bouton>
        <Mention className="text-center" />
      </div>
    </form>
  );
}
