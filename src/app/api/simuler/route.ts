import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  EntreeSchema,
  ReponseIASchema,
  type EvenementFlux,
} from "@/lib/schema";
import { SYSTEM_PROMPT, buildPrompt } from "@/lib/prompt";
import { detecteDetresse, MESSAGE_DETRESSE } from "@/lib/safety";
import { cleClient, verifierLimite } from "@/lib/rate-limit";
import { REPONSE_EXEMPLE } from "@/lib/exemple";

// Une simulation prend souvent 30 à 90 s : on laisse de la marge (Vercel).
export const maxDuration = 300;

const MODELE = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

function json(status: number, message: string, headers?: HeadersInit) {
  return Response.json({ message }, { status, headers });
}

// Mode test : réponse d'exemple, sans appel à l'IA ni frais.
const FACTICE = process.env.SIMULATION_FACTICE === "1";

export async function POST(req: Request) {
  if (!FACTICE && !process.env.ANTHROPIC_API_KEY) {
    return json(500, "La clé API n'est pas configurée sur le serveur (ANTHROPIC_API_KEY).");
  }

  // 1. Lecture et validation de ce que l'utilisateur a envoyé
  let brut: unknown;
  try {
    brut = await req.json();
  } catch {
    return json(400, "Requête illisible.");
  }
  const parse = EntreeSchema.safeParse(brut);
  if (!parse.success) {
    return json(400, parse.error.issues[0]?.message ?? "Formulaire incomplet.");
  }
  const entree = parse.data;

  // 2. Situation de détresse évidente : on n'appelle même pas l'IA
  //    (et ça ne compte pas dans la limite).
  if (detecteDetresse(entree.decision, entree.scenarioA, entree.scenarioB, entree.situation)) {
    return ndjson(async (envoyer) => {
      envoyer({ type: "detresse", message: MESSAGE_DETRESSE });
    });
  }

  // 3. Limite de requêtes par utilisateur
  const limite = verifierLimite(cleClient(req));
  if (!limite.ok) {
    const minutes = Math.max(1, Math.round(limite.reessayerDansS / 60));
    return json(
      429,
      `Tu as atteint la limite de simulations pour le moment. Réessaie dans ${minutes} min.`,
      { "Retry-After": String(limite.reessayerDansS) },
    );
  }

  if (FACTICE) return simulationFactice();

  // 4. Appel à Claude, en streaming
  const client = new Anthropic();

  return ndjson(async (envoyer) => {
    const flux = client.beta.messages.stream(
      {
        model: MODELE,
        max_tokens: 32000,
        // Si le modèle principal refuse par erreur (filtre de sécurité trop
        // prudent), l'API relance automatiquement sur un modèle de secours.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: {
          effort: "medium",
          format: zodOutputFormat(ReponseIASchema),
        },
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        ],
        messages: [{ role: "user", content: buildPrompt(entree) }],
      },
      { signal: req.signal },
    );

    for await (const ev of flux) {
      if (ev.type === "content_block_start" && ev.content_block.type === "fallback") {
        // Changement de modèle en cours de route : le texte déjà reçu est jeté.
        envoyer({ type: "reset" });
      } else if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
        envoyer({ type: "delta", texte: ev.delta.text });
      }
    }

    const final = await flux.finalMessage();

    if (final.stop_reason === "refusal") {
      envoyer({
        type: "erreur",
        message: "L'IA n'a pas pu traiter cette demande. Reformule ta décision et réessaie.",
      });
      return;
    }
    if (final.stop_reason === "max_tokens") {
      envoyer({ type: "erreur", message: "La réponse a été coupée. Réessaie." });
      return;
    }

    // Texte produit après le dernier changement de modèle éventuel
    let texte = "";
    for (const bloc of final.content) {
      if (bloc.type === "fallback") texte = "";
      else if (bloc.type === "text") texte += bloc.text;
    }

    let objet: unknown;
    try {
      objet = JSON.parse(texte);
    } catch {
      envoyer({ type: "erreur", message: "La réponse de l'IA est illisible. Réessaie." });
      return;
    }
    const valide = ReponseIASchema.safeParse(objet);
    if (!valide.success) {
      console.error("Réponse IA invalide", valide.error.issues.slice(0, 5));
      envoyer({ type: "erreur", message: "La réponse de l'IA est incomplète. Réessaie." });
      return;
    }

    const { securite, simulation } = valide.data;
    if (securite.situation_de_detresse || !simulation) {
      envoyer({ type: "detresse", message: securite.message || MESSAGE_DETRESSE });
      return;
    }
    envoyer({ type: "resultat", simulation });
  });
}

function simulationFactice() {
  const texte = JSON.stringify(REPONSE_EXEMPLE);
  return ndjson(async (envoyer) => {
    for (let i = 0; i < texte.length; i += 60) {
      envoyer({ type: "delta", texte: texte.slice(i, i + 60) });
      await new Promise((r) => setTimeout(r, 25));
    }
    const { simulation } = ReponseIASchema.parse(JSON.parse(texte));
    envoyer({ type: "resultat", simulation: simulation! });
  });
}

/** Réponse en flux NDJSON : un objet JSON par ligne. */
function ndjson(travail: (envoyer: (e: EvenementFlux) => void) => Promise<void>) {
  const encodeur = new TextEncoder();
  const corps = new ReadableStream<Uint8Array>({
    async start(controleur) {
      const envoyer = (e: EvenementFlux) =>
        controleur.enqueue(encodeur.encode(JSON.stringify(e) + "\n"));
      try {
        await travail(envoyer);
      } catch (err) {
        envoyer({ type: "erreur", message: messageErreur(err) });
      } finally {
        controleur.close();
      }
    },
  });
  return new Response(corps, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}

function messageErreur(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    console.error("Clé API refusée");
    return "Le serveur n'arrive pas à se connecter à l'IA (clé API invalide).";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "L'IA est très demandée en ce moment. Réessaie dans une minute.";
  }
  if (err instanceof Anthropic.APIUserAbortError) {
    return "Simulation annulée.";
  }
  if (err instanceof Anthropic.APIError) {
    console.error("Erreur API", err.status, err.message);
    return "L'IA a rencontré un problème. Réessaie dans un instant.";
  }
  console.error(err);
  return "Une erreur inattendue est survenue. Réessaie.";
}
