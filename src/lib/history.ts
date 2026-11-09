import type { Entree, Simulation } from "./schema";

export type Sauvegarde = {
  id: string;
  date: string; // ISO
  entree: Entree;
  simulation: Simulation;
};

const CLE = "jumeau:historique";
const MAX = 30;

export function lireHistorique(): Sauvegarde[] {
  try {
    const brut = localStorage.getItem(CLE);
    const liste = brut ? (JSON.parse(brut) as Sauvegarde[]) : [];
    return Array.isArray(liste) ? liste : [];
  } catch {
    return [];
  }
}

function ecrire(liste: Sauvegarde[]) {
  try {
    localStorage.setItem(CLE, JSON.stringify(liste.slice(0, MAX)));
  } catch {
    // Stockage plein ou bloqué (navigation privée) : on ignore.
  }
}

export function sauvegarder(entree: Entree, simulation: Simulation): Sauvegarde {
  const s: Sauvegarde = {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(Date.now()),
    date: new Date().toISOString(),
    entree,
    simulation,
  };
  ecrire([s, ...lireHistorique()]);
  return s;
}

export function supprimer(id: string) {
  ecrire(lireHistorique().filter((s) => s.id !== id));
}

export function toutEffacer() {
  try {
    localStorage.removeItem(CLE);
  } catch {}
}
