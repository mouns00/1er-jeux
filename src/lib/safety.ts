/**
 * Filtre rapide, avant même d'appeler l'IA, pour les cas les plus évidents.
 * L'IA fait aussi sa propre vérification (voir SYSTEM_PROMPT), qui couvre
 * les formulations plus subtiles.
 */
const MOTIFS_DETRESSE: RegExp[] = [
  /\bsuicid/i,
  /\bme\s+(tuer|suicider|foutre en l'air)\b/i,
  /\ben\s+finir\s+avec\s+(la\s+vie|ma\s+vie|tout)\b/i,
  /\bmettre\s+fin\s+à\s+(mes\s+jours|ma\s+vie)\b/i,
  /\bplus\s+envie\s+de\s+vivre\b/i,
  /\bme\s+faire\s+du\s+mal\b/i,
  /\bscarifi/i,
  /\bil\s+me\s+(frappe|bat|tape)\b/i,
  /\belle\s+me\s+(frappe|bat|tape)\b/i,
  /\bmenace\s+de\s+(me\s+)?tuer\b/i,
  /\bviol(é|ée|ence conjugale|ences conjugales)\b/i,
];

export function detecteDetresse(...textes: string[]): boolean {
  const t = textes.join("\n");
  return MOTIFS_DETRESSE.some((m) => m.test(t));
}

export const MESSAGE_DETRESSE =
  "Ce que tu écris semble lourd, et tu n'as pas à le porter seul·e. Ici, on ne va pas simuler ton avenir : ce qui compte maintenant, c'est que tu sois en sécurité et que tu puisses en parler à quelqu'un. Appelle une ligne d'écoute, gratuitement, à n'importe quelle heure. Si tu es en danger immédiat, appelle les secours.";
