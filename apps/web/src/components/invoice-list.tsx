import type { InvoiceRow } from "@fauve/agent";
import { DownloadIcon } from "./icons";

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/**
 * Her invoices (Réglages › Abonnement et crédits, the phone page /factures): what, when, how much,
 * and Stripe's PDF; one still to pay opens Stripe's page to pay it.
 */
export function InvoiceList({ rows, timeZone, dark = false }: { rows: InvoiceRow[] | null; timeZone: string; dark?: boolean }) {
  const muted = dark ? "text-white/60" : "text-muted";
  if (rows === null) return <p className={`text-sm leading-normal ${muted}`}>Je n’arrive pas à lire tes factures pour l’instant. Réessaie dans un moment.</p>;
  if (!rows.length) return <p className={`text-sm leading-normal ${muted}`}>Pas encore de facture : chacune arrive ici après un paiement.</p>;
  const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone });
  return (
    <ul className="flex flex-col">
      {rows.map((row) => (
        <li key={row.id} className={`flex items-center justify-between gap-3 border-b py-2.5 text-[14px] last:border-b-0 ${dark ? "border-white/10" : "border-line"}`}>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">{row.label}</span>
            <span className={`text-[12px] ${muted}`}>
              {date.format(new Date(row.date))}
              {row.number ? ` · n° ${row.number}` : ""}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <span className="font-semibold tabular-nums">{euros.format(row.amount)}</span>
            {!row.paid && row.page ? (
              <a href={row.page} target="_blank" rel="noreferrer" className={`font-bold underline underline-offset-2 ${dark ? "text-peach" : "text-peach-ink"}`}>
                À payer
              </a>
            ) : row.pdf ? (
              <a
                href={row.pdf}
                aria-label={`Télécharger la facture du ${date.format(new Date(row.date))}`}
                className={`inline-flex items-center gap-1 font-bold ${dark ? "text-white" : "text-violet"}`}
              >
                <DownloadIcon size={16} /> PDF
              </a>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
