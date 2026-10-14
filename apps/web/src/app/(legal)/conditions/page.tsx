import type { Metadata } from "next";
import { company } from "@/lib/legal";

export const metadata: Metadata = { title: "Conditions d’utilisation" };

export default function TermsPage() {
  return (
    <>
      <h1>Conditions d’utilisation</h1>
      <p>
        Ces conditions encadrent l’utilisation de Simone, service édité par {company.name} ({company.registration},{" "}
        {company.address}). En utilisant Simone, le studio les accepte.
      </p>

      <h2>Le service</h2>
      <p>
        Simone est une assistante fondée sur l’intelligence artificielle. Elle prépare le calendrier de publication, monte
        les vidéos envoyées par le studio, rédige les légendes, programme les publications sur les comptes connectés et
        envoie un bilan chaque semaine. Simone indique toujours qu’elle est une IA.
      </p>

      <h2>Validation avant publication</h2>
      <p>
        Aucun contenu n’est publié sans la validation du studio. Le studio reste responsable des contenus qu’il valide et
        des comptes qu’il connecte.
      </p>

      <h2>Contenus et droit à l’image</h2>
      <ul>
        <li>Le studio garantit disposer des droits sur les vidéos, photos et textes qu’il transmet.</li>
        <li>Il recueille l’accord des personnes filmées (clients, élèves, équipe) avant tout envoi.</li>
        <li>Aucune musique protégée n’est intégrée aux vidéos ; le son tendance s’ajoute dans l’application du réseau social.</li>
        <li>Le studio conserve la propriété de ses contenus et nous accorde le droit de les traiter pour fournir le service.</li>
      </ul>

      <h2>Abonnement</h2>
      <p>
        L’abonnement est de 29 € par mois (Essentiel) ou 49 € par mois (Pro), sans engagement, résiliable à tout moment depuis les réglages ou en écrivant à{" "}
        {company.email}. La résiliation prend effet à la fin de la période en cours.
      </p>

      <h2>Disponibilité et responsabilité</h2>
      <p>
        Simone dépend de services tiers (WhatsApp, Instagram, TikTok, prestataires d’IA). Nous faisons notre possible pour
        assurer la continuité du service, sans garantie de résultat sur l’audience ou les réservations. Les contenus
        générés par l’IA peuvent contenir des erreurs : le studio les relit avant de valider.
      </p>

      <h2>Données personnelles</h2>
      <p>
        Voir la <a href="/confidentialite">politique de confidentialité</a>.
      </p>

      <h2>Droit applicable</h2>
      <p>Ces conditions sont soumises au droit français.</p>
    </>
  );
}
