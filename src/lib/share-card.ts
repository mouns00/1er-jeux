import { PRIORITES, type Simulation } from "./schema";

const L = 1080;
const H = 1920;
const MARGE = 88;

const C = {
  fond: "#121110",
  carte: "#1f1c1a",
  ligne: "#34302b",
  texte: "#f6f1e9",
  doux: "#a39a8f",
  a: "#8f89ff",
  b: "#ff8a4c",
};

function police(variable: string, repli: string) {
  if (typeof document === "undefined") return repli;
  const v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return v ? `${v}, ${repli}` : repli;
}

function couper(ctx: CanvasRenderingContext2D, texte: string, largeur: number): string[] {
  const mots = texte.split(/\s+/);
  const lignes: string[] = [];
  let courante = "";
  for (const m of mots) {
    const essai = courante ? `${courante} ${m}` : m;
    if (ctx.measureText(essai).width > largeur && courante) {
      lignes.push(courante);
      courante = m;
    } else courante = essai;
  }
  if (courante) lignes.push(courante);
  return lignes;
}

function paragraphe(
  ctx: CanvasRenderingContext2D,
  texte: string,
  x: number,
  y: number,
  largeur: number,
  interligne: number,
  maxLignes: number,
): number {
  let lignes = couper(ctx, texte, largeur);
  if (lignes.length > maxLignes) {
    lignes = lignes.slice(0, maxLignes);
    let der = lignes[maxLignes - 1];
    while (ctx.measureText(der + "…").width > largeur && der.includes(" ")) {
      der = der.slice(0, der.lastIndexOf(" "));
    }
    lignes[maxLignes - 1] = der + "…";
  }
  lignes.forEach((l, i) => ctx.fillText(l, x, y + i * interligne));
  return y + lignes.length * interligne;
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Dessine la carte verdict au format story (1080×1920) et renvoie un PNG. */
export async function genererCarte(sim: Simulation): Promise<Blob> {
  if (typeof document !== "undefined" && document.fonts) await document.fonts.ready;

  const display = police("--font-bricolage", "system-ui, sans-serif");
  const sans = police("--font-inter", "system-ui, sans-serif");
  const mono = police("--font-jetbrains", "ui-monospace, monospace");

  const canvas = document.createElement("canvas");
  canvas.width = L;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.textBaseline = "top";

  // Fond avec deux halos colorés
  ctx.fillStyle = C.fond;
  ctx.fillRect(0, 0, L, H);
  for (const [x, y, coul] of [
    [0, 0, C.a],
    [L, H * 0.55, C.b],
  ] as const) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 700);
    g.addColorStop(0, coul + "38");
    g.addColorStop(1, coul + "00");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L, H);
  }

  const largeur = L - MARGE * 2;
  let y = 120;

  // En-tête
  ctx.fillStyle = C.doux;
  ctx.font = `500 28px ${mono}`;
  ctx.fillText("LE JUMEAU DE DÉCISION · 2027 → 2031", MARGE, y);
  y += 70;

  // Titre
  ctx.fillStyle = C.texte;
  ctx.font = `800 84px ${display}`;
  y = paragraphe(ctx, sim.titre, MARGE, y, largeur, 92, 3) + 44;

  // Scénarios
  const [A, B] = sim.scenarios;
  for (const [s, coul] of [
    [A, C.a],
    [B, C.b],
  ] as const) {
    ctx.fillStyle = coul;
    rect(ctx, MARGE, y, 64, 64, 18);
    ctx.fill();
    ctx.fillStyle = C.fond;
    ctx.font = `800 38px ${display}`;
    ctx.textAlign = "center";
    ctx.fillText(s.id, MARGE + 32, y + 12);
    ctx.textAlign = "left";
    ctx.fillStyle = C.texte;
    ctx.font = `700 40px ${display}`;
    const fin = paragraphe(ctx, s.nom, MARGE + 92, y + 10, largeur - 92, 48, 2);
    y = Math.max(y + 64, fin) + 26;
  }
  y += 20;

  // Notes
  rect(ctx, MARGE, y, largeur, 4 * 118 + 56, 36);
  ctx.fillStyle = C.carte;
  ctx.fill();
  let yn = y + 40;
  const xBarre = MARGE + 230;
  const lBarre = largeur - 230 - 120;
  for (const p of PRIORITES) {
    ctx.fillStyle = C.texte;
    ctx.font = `600 32px ${sans}`;
    ctx.fillText(p.label, MARGE + 40, yn + 22);
    for (const [s, coul, dy] of [
      [A, C.a, 0],
      [B, C.b, 46],
    ] as const) {
      const n = s.notes[p.id].note;
      ctx.fillStyle = C.ligne;
      rect(ctx, xBarre, yn + dy + 6, lBarre, 22, 11);
      ctx.fill();
      ctx.fillStyle = coul;
      rect(ctx, xBarre, yn + dy + 6, Math.max(22, (lBarre * n) / 10), 22, 11);
      ctx.fill();
      ctx.font = `600 30px ${mono}`;
      ctx.fillText(`${n}/10`, xBarre + lBarre + 20, yn + dy);
    }
    yn += 118;
  }
  y += 4 * 118 + 56 + 50;

  // Verdict
  const coulVerdict =
    sim.verdict.penche_vers === "A" ? C.a : sim.verdict.penche_vers === "B" ? C.b : C.texte;
  ctx.fillStyle = coulVerdict;
  ctx.font = `600 28px ${mono}`;
  const etiquette =
    sim.verdict.penche_vers === "egalite"
      ? "VERDICT · ÉGALITÉ"
      : `VERDICT · PENCHE VERS ${sim.verdict.penche_vers}`;
  ctx.fillText(etiquette, MARGE, y);
  y += 56;
  ctx.fillStyle = C.texte;
  ctx.font = `800 62px ${display}`;
  const restant = H - 230 - y;
  y = paragraphe(ctx, `« ${sim.verdict.phrase} »`, MARGE, y, largeur, 72, Math.max(2, Math.min(4, Math.floor(restant / 72))));

  // La vraie question, s'il reste de la place
  const yMax = H - 230;
  if (yMax - y > 200) {
    y += 56;
    ctx.fillStyle = C.ligne;
    ctx.fillRect(MARGE, y, largeur, 2);
    y += 44;
    ctx.fillStyle = C.doux;
    ctx.font = `600 28px ${mono}`;
    ctx.fillText("LA VRAIE QUESTION", MARGE, y);
    y += 52;
    ctx.fillStyle = C.texte;
    ctx.font = `500 44px ${sans}`;
    paragraphe(ctx, sim.vraie_question, MARGE, y, largeur, 58, Math.max(1, Math.floor((yMax - y) / 58)));
  }

  // Pied
  ctx.fillStyle = C.doux;
  ctx.font = `400 28px ${sans}`;
  ctx.fillText("Une simulation, pas une prédiction.", MARGE, H - 150);
  ctx.font = `600 28px ${mono}`;
  const site = typeof location !== "undefined" ? location.host : "";
  ctx.fillText(site ? `Fais la tienne → ${site}` : "Fais la tienne, toi aussi.", MARGE, H - 106);

  return await new Promise<Blob>((ok, ko) =>
    canvas.toBlob((b) => (b ? ok(b) : ko(new Error("toBlob"))), "image/png"),
  );
}

/** Partage l'image (téléphone) ou la télécharge (ordinateur). */
export async function partagerCarte(sim: Simulation): Promise<"partage" | "telecharge"> {
  const blob = await genererCarte(sim);
  const nom = `jumeau-${sim.titre.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "verdict"}.png`;
  const fichier = new File([blob], nom, { type: "image/png" });

  if (navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: sim.titre, text: sim.verdict.phrase });
      return "partage";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "partage";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "telecharge";
}
