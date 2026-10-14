import { WhatsAppIcon } from "@/components/icons";
import { Orb } from "@/components/orb";
import { whatsappLink } from "@/lib/public-env";

/** Friendly empty state that sends the manager back to WhatsApp. */
export function EmptyState({
  title,
  children,
  cta = "Écrire à Brigitte sur WhatsApp",
  message,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  cta?: string | null;
  /** Prefilled WhatsApp message. */
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-3.5 rounded-[22px] bg-soft px-6 py-10 text-center ${className}`}
    >
      <Orb size={52} />
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="max-w-[440px] text-sm leading-relaxed text-muted">{children}</p>
      {cta && (
        <a href={whatsappLink(message)} className="btn btn-primary mt-1">
          <WhatsAppIcon size={18} />
          {cta}
        </a>
      )}
    </div>
  );
}

/** Signed in, but this phone number is not attached to any studio yet. */
export function NoStudio() {
  return (
    <EmptyState title="Ton studio n’est pas encore créé" cta="Commencer sur WhatsApp">
      Ce numéro n’est relié à aucun studio pour l’instant. Écris à Brigitte sur WhatsApp avec ce même numéro : elle crée
      ton studio en quelques questions, et tout apparaîtra ici.
    </EmptyState>
  );
}

/** Fallback while a screen loads its data. */
export function PageLoading({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[34px] font-extrabold tracking-[-0.02em]">{title}</h1>
        <p className="text-[15px] text-muted">Chargement…</p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-[20px] bg-soft motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  );
}
