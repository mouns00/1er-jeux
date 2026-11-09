import { Bouton, Carte, Etiquette } from "./ui";

const AIDES = [
  { num: "3114", label: "Prévention du suicide", detail: "24h/24, gratuit, partout en France" },
  { num: "15", label: "SAMU", detail: "Urgence médicale" },
  { num: "112", label: "Urgences", detail: "Numéro européen, depuis n'importe quel téléphone" },
  { num: "3919", label: "Violences Femmes Info", detail: "Gratuit et anonyme" },
  { num: "119", label: "Enfance en danger", detail: "24h/24, gratuit" },
  { num: "114", label: "Urgences par SMS", detail: "Si tu ne peux pas parler" },
];

export function Detresse({ message, onRetour }: { message: string; onRetour: () => void }) {
  return (
    <div className="apparition space-y-6 pt-4">
      <div className="space-y-3">
        <Etiquette>On met la simulation de côté</Etiquette>
        <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight">
          Toi d&apos;abord.
        </h2>
        <p className="text-base leading-relaxed">{message}</p>
      </div>

      <Carte className="space-y-1 p-2 sm:p-2">
        {AIDES.map((a) => (
          <a
            key={a.num}
            href={a.num === "114" ? "sms:114" : `tel:${a.num}`}
            className="flex items-center gap-4 rounded-2xl px-3 py-3 transition hover:bg-surface-2"
          >
            <span className="min-w-16 font-display text-2xl font-extrabold">{a.num}</span>
            <span>
              <span className="block font-semibold">{a.label}</span>
              <span className="block text-sm text-muted">{a.detail}</span>
            </span>
          </a>
        ))}
      </Carte>

      <p className="text-sm text-muted">
        Hors de France ? Appelle le numéro d&apos;urgence local, ou cherche une ligne d&apos;écoute
        sur <a className="underline" href="https://findahelpline.com/fr" target="_blank" rel="noreferrer">findahelpline.com</a>.
      </p>

      <Bouton variante="secondaire" onClick={onRetour} className="w-full">
        Revenir à l&apos;accueil
      </Bouton>
    </div>
  );
}
