import type { Metadata } from "next";
import { company } from "@/lib/legal";

export const metadata: Metadata = { title: "Suppression des données", alternates: { canonical: "/suppression-des-donnees" } };

export default function DataDeletionPage() {
  return (
    <>
      <h1>Suppression des données</h1>
      <p>Tu peux demander à tout moment la suppression complète des données de ton commerce.</p>

      <h2>Comment faire</h2>
      <ul>
        <li>
          Écris « <strong>Supprimer mes données</strong> » à Edith sur WhatsApp, depuis le numéro de ton compte ;
        </li>
        <li>ou envoie un e-mail à {company.email} en indiquant ton numéro WhatsApp et le nom de ton commerce.</li>
      </ul>

      <h2>Ce qui est supprimé</h2>
      <p>
        Le compte, les conversations, les vidéos et photos, les contenus préparés, les statistiques, les connexions aux réseaux sociaux et
        ta voix clonée (effacée aussi chez notre prestataire de voix). Les publications déjà en ligne sur Instagram ou TikTok restent sur ces réseaux :
        tu peux les retirer depuis leurs applications.
      </p>

      <h2>Délai</h2>
      <p>
        La suppression est effectuée sous 30 jours. Seules les factures sont conservées, pendant la durée imposée par la
        loi.
      </p>
    </>
  );
}
