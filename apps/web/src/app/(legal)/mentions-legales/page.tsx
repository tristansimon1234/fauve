import type { Metadata } from "next";
import Link from "next/link";
import { company, host, VAT_EXEMPTION } from "@/lib/legal";

export const metadata: Metadata = { title: "Mentions légales", alternates: { canonical: "/mentions-legales" } };

// Who publishes the site and who hosts it (LCEN, art. 6).
export default function LegalNoticePage() {
  return (
    <>
      <h1>Mentions légales</h1>

      <h2>Éditeur</h2>
      <p>
        {company.name}, {company.form}
        <br />
        Siège : {company.address}
        <br />
        Immatriculation : {company.registration}
        {company.siret ? (
          <>
            <br />
            SIRET : {company.siret}
          </>
        ) : null}
        {company.vat ? (
          <>
            <br />
            TVA intracommunautaire : {company.vat}
          </>
        ) : VAT_EXEMPTION ? (
          <>
            <br />
            {VAT_EXEMPTION}
          </>
        ) : null}
        <br />
        Contact : {company.email}
      </p>

      <h2>Directeur de la publication</h2>
      <p>{company.publisher}</p>

      <h2>Hébergeur</h2>
      <p>
        {host.name}, {host.address} ({host.site}). Les données du service sont stockées par Supabase, en France (Paris).
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Le nom Edith, le site, ses textes, son logo et sa mascotte appartiennent à l’éditeur. Les vidéos d’exemple viennent de Mixkit et les photos d’Unsplash, sous leurs
        licences ; les commerces montrés en exemple sont fictifs.
      </p>

      <h2>Pour aller plus loin</h2>
      <p>
        <Link href="/conditions">Conditions d’utilisation et de vente</Link> · <Link href="/confidentialite">Politique de confidentialité</Link> ·{" "}
        <Link href="/suppression-des-donnees">Suppression des données</Link>
      </p>
    </>
  );
}
