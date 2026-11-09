import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Ce que l'utilisateur envoie                                         */
/* ------------------------------------------------------------------ */

export const PRIORITES = [
  { id: "argent", label: "Argent" },
  { id: "famille", label: "Famille" },
  { id: "liberte", label: "Liberté" },
  { id: "serenite", label: "Sérénité" },
] as const;

export type PrioriteId = (typeof PRIORITES)[number]["id"];

export const EntreeSchema = z.object({
  decision: z.string().trim().min(5, "Décris ta décision en une phrase.").max(300),
  scenarioA: z.string().trim().min(3, "Décris le scénario A.").max(600),
  scenarioB: z.string().trim().min(3, "Décris le scénario B.").max(600),
  situation: z.string().trim().max(1500).default(""),
  priorites: z
    .array(z.enum(["argent", "famille", "liberte", "serenite"]))
    .max(4)
    .default([]),
});

export type Entree = z.infer<typeof EntreeSchema>;

/* ------------------------------------------------------------------ */
/* Ce que l'IA renvoie                                                 */
/* Les bornes (.min/.max) ne sont pas envoyées à l'API (non supportées */
/* par les sorties structurées) : elles sont vérifiées ici, côté       */
/* serveur, une fois la réponse complète reçue.                        */
/* ------------------------------------------------------------------ */

const Note = z.object({
  note: z.number().int().min(0).max(10),
  pourquoi: z.string(),
});

const Annee = z.object({
  annee: z.number().int().min(2027).max(2031),
  titre: z.string(),
  recit: z.string(),
});

const Scenario = z.object({
  id: z.enum(["A", "B"]),
  nom: z.string(),
  resume: z.string(),
  chronologie: z.array(Annee).min(5).max(5),
  notes: z.object({
    argent: Note,
    famille: Note,
    liberte: Note,
    serenite: Note,
  }),
  journee_type_2031: z.string(),
  risques: z.array(z.string()).min(1).max(5),
  meilleur_cas: z.string(),
  pire_cas: z.string(),
});

export const SimulationSchema = z.object({
  titre: z.string(),
  scenarios: z.array(Scenario).min(2).max(2),
  verdict: z.object({
    penche_vers: z.enum(["A", "B", "egalite"]),
    phrase: z.string(),
    pourquoi: z.string(),
  }),
  vraie_question: z.string(),
});

export const ReponseIASchema = z.object({
  securite: z.object({
    situation_de_detresse: z.boolean(),
    message: z.string(),
  }),
  simulation: SimulationSchema.nullable(),
});

export type Simulation = z.infer<typeof SimulationSchema>;
export type ScenarioSimule = z.infer<typeof Scenario>;
export type ReponseIA = z.infer<typeof ReponseIASchema>;

/* ------------------------------------------------------------------ */
/* Messages envoyés du serveur vers le navigateur (NDJSON)             */
/* ------------------------------------------------------------------ */

export type EvenementFlux =
  | { type: "delta"; texte: string }
  | { type: "reset" }
  | { type: "resultat"; simulation: Simulation }
  | { type: "detresse"; message: string }
  | { type: "erreur"; message: string };
