import type { ReponseIA } from "./schema";

/**
 * Réponse d'exemple utilisée en mode « simulation factice »
 * (SIMULATION_FACTICE=1) pour tester l'interface sans clé API ni frais.
 */
export const REPONSE_EXEMPLE: ReponseIA = {
  securite: { situation_de_detresse: false, message: "" },
  simulation: {
    titre: "Paris ou Montréal ?",
    scenarios: [
      {
        id: "A",
        nom: "La promo parisienne",
        resume:
          "Tu restes, tu montes en grade et tu gagnes en confort. Mais l'envie d'ailleurs ne disparaît pas vraiment.",
        chronologie: [
          { annee: 2027, titre: "Tu serres les dents", recit: "Tu prends un gros projet pour viser la promo. Les soirées s'allongent, les week-ends raccourcissent. Tu te dis que c'est un passage." },
          { annee: 2028, titre: "La promotion arrive", recit: "Tu deviens responsable d'équipe. +15 % de salaire, un vrai titre. Tu fêtes ça, puis tu réalises que tes journées sont surtout faites de réunions." },
          { annee: 2029, titre: "Le confort s'installe", recit: "Tu changes d'appart, tu voyages deux fois par an. Tu vas voir tes parents à Lyon un week-end par mois, et ça compte." },
          { annee: 2030, titre: "Le petit pincement", recit: "Une amie rentre de Montréal et raconte sa vie là-bas. Tu ressens un pincement. Tu commences à te demander si tu as eu peur." },
          { annee: 2031, titre: "Stable, mais tiède", recit: "Ta vie est solide et plutôt agréable. La question de partir revient parfois le soir, moins fort qu'avant, mais elle revient." },
        ],
        notes: {
          argent: { note: 8, pourquoi: "Salaire en hausse, épargne qui grossit." },
          famille: { note: 8, pourquoi: "Tu es à 2 h de tes parents et tu les vois souvent." },
          liberte: { note: 4, pourquoi: "Ton agenda est rempli par le travail." },
          serenite: { note: 6, pourquoi: "Peu d'imprévus, mais un regret discret." },
        },
        journee_type_2031:
          "Tu te réveilles à 7 h dans ton appart du 11e. Métro, café, première réunion à 9 h. Tu enchaînes les points d'équipe jusqu'à 18 h. Le soir, un verre avec des collègues ou un appel à ta mère. Tu t'endors en scrollant des photos de voyages.",
        risques: [
          "Épuisement à force de viser toujours plus haut",
          "Regret de ne pas avoir tenté l'aventure",
          "Routine qui étouffe ta créativité",
        ],
        meilleur_cas: "Tu trouves du sens dans ton rôle de manager et tu t'offres un congé sabbatique à l'étranger en 2030.",
        pire_cas: "Tu t'épuises au travail et tu te sens coincé·e dans une vie choisie par défaut.",
      },
      {
        id: "B",
        nom: "Le grand saut à Montréal",
        resume:
          "Tu pars, tu galères au début, puis tu te construis une vie qui te ressemble, avec la distance comme prix à payer.",
        chronologie: [
          { annee: 2027, titre: "L'arrivée et le froid", recit: "Premier hiver à -25 °C. Tu enchaînes les candidatures, ton épargne fond. Tu doutes, mais tu découvres une ville qui te donne de l'énergie." },
          { annee: 2028, titre: "Le premier vrai poste", recit: "Tu décroches un poste de cheffe de projet dans une startup. Moins payé qu'à Paris au début, mais une ambiance qui te plaît." },
          { annee: 2029, titre: "Tu prends racine", recit: "Tu as une bande d'amis, tu fais du vélo l'été et du ski de fond l'hiver. Les appels à tes parents deviennent un rituel du dimanche." },
          { annee: 2030, titre: "La distance pèse", recit: "Ton père a un souci de santé. Tu rentres trois semaines en urgence. Tu réalises ce que la distance coûte vraiment." },
          { annee: 2031, titre: "Une vie à toi", recit: "Tu as un poste qui te plaît et une vie que tu as construite toi-même. Tu réfléchis à la suite, rester ou revenir, mais sans regret." },
        ],
        notes: {
          argent: { note: 6, pourquoi: "Deux ans difficiles, puis un salaire correct." },
          famille: { note: 4, pourquoi: "6 h de décalage et un océan entre vous." },
          liberte: { note: 9, pourquoi: "Tu as choisi ta vie de A à Z." },
          serenite: { note: 6, pourquoi: "Fière de toi, mais inquiète pour tes parents." },
        },
        journee_type_2031:
          "Tu te réveilles à 7 h 30 sur le Plateau. Vélo jusqu'au bureau, réunion en franglais. À midi, poutine avec l'équipe. Le soir, appel vidéo à tes parents qui se couchent déjà. Tu termines avec des amis sur une terrasse au soleil couchant.",
        risques: [
          "Visa ou permis de travail plus compliqué que prévu (à vérifier avec un pro)",
          "Isolement les premiers mois",
          "Culpabilité face à l'éloignement de tes parents",
        ],
        meilleur_cas: "Tu t'épanouis, tu obtiens ta résidence et tu fais venir tes parents l'été.",
        pire_cas: "Tu n'arrives pas à trouver de travail stable et tu rentres en 2028, épargne épuisée.",
      },
    ],
    verdict: {
      penche_vers: "B",
      phrase: "Tu as besoin d'air plus que de sécurité, pour l'instant.",
      pourquoi:
        "Tes deux premières priorités sont la liberté et la sérénité. Montréal te donne nettement plus de liberté, pour une sérénité équivalente. Le vrai coût, c'est la distance avec tes parents : à anticiper dès maintenant.",
    },
    vraie_question:
      "Est-ce que tu as envie de partir, ou juste envie que ta vie actuelle change ?",
  },
};
