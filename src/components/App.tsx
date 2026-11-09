"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Entree, Simulation } from "@/lib/schema";
import { lancerSimulation } from "@/lib/client-flux";
import { sauvegarder } from "@/lib/history";
import { Formulaire } from "./Formulaire";
import { Chargement } from "./Chargement";
import { Resultat } from "./Resultat";
import { Detresse } from "./Detresse";
import { Historique } from "./Historique";
import { Bouton } from "./ui";

type Vue =
  | { nom: "formulaire"; initial?: Entree }
  | { nom: "chargement"; entree: Entree; texte: string }
  | { nom: "resultat"; entree: Entree; simulation: Simulation }
  | { nom: "detresse"; message: string }
  | { nom: "erreur"; entree: Entree; message: string }
  | { nom: "historique" };

export function App() {
  const [vue, setVue] = useState<Vue>({ nom: "formulaire" });
  const annulation = useRef<AbortController | null>(null);

  // Service worker (app installable)
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [vue.nom]);

  const simuler = useCallback(async (entree: Entree) => {
    annulation.current?.abort();
    const ctrl = new AbortController();
    annulation.current = ctrl;
    setVue({ nom: "chargement", entree, texte: "" });

    try {
      await lancerSimulation(
        entree,
        (ev) => {
          if (ctrl.signal.aborted) return;
          switch (ev.type) {
            case "delta":
              setVue((v) => (v.nom === "chargement" ? { ...v, texte: v.texte + ev.texte } : v));
              break;
            case "reset":
              setVue((v) => (v.nom === "chargement" ? { ...v, texte: "" } : v));
              break;
            case "resultat":
              sauvegarder(entree, ev.simulation);
              try {
                localStorage.removeItem("jumeau:brouillon");
              } catch {}
              setVue({ nom: "resultat", entree, simulation: ev.simulation });
              break;
            case "detresse":
              setVue({ nom: "detresse", message: ev.message });
              break;
            case "erreur":
              setVue({ nom: "erreur", entree, message: ev.message });
              break;
          }
        },
        ctrl.signal,
      );
    } catch {
      if (!ctrl.signal.aborted) {
        setVue({
          nom: "erreur",
          entree,
          message: "Impossible de joindre le serveur. Vérifie ta connexion et réessaie.",
        });
      }
    }
  }, []);

  const annuler = () => {
    annulation.current?.abort();
    setVue((v) => ({ nom: "formulaire", initial: v.nom === "chargement" ? v.entree : undefined }));
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <header className="flex items-center justify-between py-3">
        <button
          onClick={() => vue.nom !== "chargement" && setVue({ nom: "formulaire" })}
          className="flex items-center gap-2.5"
          aria-label="Accueil"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon.svg" alt="" className="size-8" />
          <span className="font-display text-base font-bold tracking-tight">Le Jumeau de décision</span>
        </button>
        <div className="flex items-center gap-1">
          {vue.nom !== "historique" && vue.nom !== "chargement" && (
            <button
              onClick={() => setVue({ nom: "historique" })}
              className="rounded-xl px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-ink"
            >
              Historique
            </button>
          )}
          <BoutonTheme />
        </div>
      </header>

      <main className="flex-1 py-4">
        {vue.nom === "formulaire" && (
          <Formulaire key={vue.initial ? "init" : "vide"} initial={vue.initial} onValider={simuler} />
        )}
        {vue.nom === "chargement" && <Chargement texte={vue.texte} onAnnuler={annuler} />}
        {vue.nom === "resultat" && (
          <Resultat
            simulation={vue.simulation}
            entree={vue.entree}
            onNouvelle={() => setVue({ nom: "formulaire", initial: undefined })}
            onModifier={() => setVue({ nom: "formulaire", initial: vue.entree })}
          />
        )}
        {vue.nom === "detresse" && (
          <Detresse message={vue.message} onRetour={() => setVue({ nom: "formulaire" })} />
        )}
        {vue.nom === "historique" && (
          <Historique
            onOuvrir={(s) => setVue({ nom: "resultat", entree: s.entree, simulation: s.simulation })}
            onRetour={() => setVue({ nom: "formulaire" })}
          />
        )}
        {vue.nom === "erreur" && (
          <div className="apparition space-y-5 pt-6">
            <h2 className="font-display text-3xl font-extrabold tracking-tight">Oups.</h2>
            <p className="text-lg leading-relaxed">{vue.message}</p>
            <div className="grid gap-2">
              <Bouton onClick={() => simuler(vue.entree)}>Réessayer</Bouton>
              <Bouton variante="secondaire" onClick={() => setVue({ nom: "formulaire", initial: vue.entree })}>
                Modifier ma demande
              </Bouton>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function BoutonTheme() {
  const basculer = () => {
    const root = document.documentElement;
    const sombreActuel =
      root.dataset.theme === "dark" ||
      (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
    const suivant = sombreActuel ? "light" : "dark";
    root.dataset.theme = suivant;
    try {
      localStorage.setItem("jumeau:theme", suivant);
    } catch {}
  };
  return (
    <button
      onClick={basculer}
      aria-label="Changer de thème (clair / sombre)"
      className="flex size-10 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-ink"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
