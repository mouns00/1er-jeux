import type { Entree, EvenementFlux } from "./schema";

/** Appelle /api/simuler et transmet chaque événement du flux NDJSON. */
export async function lancerSimulation(
  entree: Entree,
  surEvenement: (e: EvenementFlux) => void,
  signal?: AbortSignal,
) {
  const rep = await fetch("/api/simuler", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entree),
    signal,
  });

  if (!rep.ok || !rep.body) {
    let message = "Le serveur ne répond pas. Réessaie.";
    try {
      const j = (await rep.json()) as { message?: string };
      if (j.message) message = j.message;
    } catch {}
    surEvenement({ type: "erreur", message });
    return;
  }

  const lecteur = rep.body.pipeThrough(new TextDecoderStream()).getReader();
  let tampon = "";
  let fini = false;
  while (true) {
    const { value, done } = await lecteur.read();
    if (done) break;
    tampon += value;
    let i: number;
    while ((i = tampon.indexOf("\n")) >= 0) {
      const ligne = tampon.slice(0, i).trim();
      tampon = tampon.slice(i + 1);
      if (!ligne) continue;
      const ev = JSON.parse(ligne) as EvenementFlux;
      if (ev.type !== "delta" && ev.type !== "reset") fini = true;
      surEvenement(ev);
    }
  }
  if (!fini) surEvenement({ type: "erreur", message: "La connexion a été coupée. Réessaie." });
}
