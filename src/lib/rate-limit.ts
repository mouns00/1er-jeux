/**
 * Limite de requêtes par utilisateur (adresse IP), en mémoire.
 *
 * Suffisant pour commencer et en local. Sur Vercel, chaque instance du
 * serveur a sa propre mémoire : pour une limite stricte en production,
 * remplacer par un stockage partagé (ex. Upstash Redis / Vercel KV).
 */
type Fenetre = { debut: number; nombre: number };

const fenetres = new Map<string, Fenetre[]>();

export type Regle = { max: number; dureeMs: number };

export const REGLES: Regle[] = [
  { max: Number(process.env.LIMITE_PAR_HEURE ?? 5), dureeMs: 60 * 60 * 1000 },
  { max: Number(process.env.LIMITE_PAR_JOUR ?? 15), dureeMs: 24 * 60 * 60 * 1000 },
];

export function verifierLimite(
  cle: string,
  maintenant = Date.now(),
): { ok: true } | { ok: false; reessayerDansS: number } {
  const etat =
    fenetres.get(cle) ?? REGLES.map(() => ({ debut: maintenant, nombre: 0 }));

  for (let i = 0; i < REGLES.length; i++) {
    const r = REGLES[i];
    if (maintenant - etat[i].debut >= r.dureeMs) etat[i] = { debut: maintenant, nombre: 0 };
    if (etat[i].nombre >= r.max) {
      fenetres.set(cle, etat);
      return {
        ok: false,
        reessayerDansS: Math.ceil((etat[i].debut + r.dureeMs - maintenant) / 1000),
      };
    }
  }
  for (const f of etat) f.nombre++;
  fenetres.set(cle, etat);

  // Ménage de temps en temps pour ne pas grossir indéfiniment.
  if (fenetres.size > 10_000) {
    const plusLongue = Math.max(...REGLES.map((r) => r.dureeMs));
    for (const [k, v] of fenetres) {
      if (v.every((f) => maintenant - f.debut >= plusLongue)) fenetres.delete(k);
    }
  }
  return { ok: true };
}

export function cleClient(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
