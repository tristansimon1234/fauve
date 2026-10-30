import type { Metadata } from "next";
import Link from "next/link";
import { company } from "@/lib/legal";

export const metadata: Metadata = { title: "Accord de traitement des données", alternates: { canonical: "/sous-traitance" } };

// The data processing agreement (GDPR art. 28) between each business and Edith, an annex to the terms,
// accepted with them: for the people in what the business sends (its clients, its team), the business
// decides and Edith processes on its behalf. Every commitment here is one the code keeps (retention,
// security, deletion, sub-processors): change one, change the other.

export default function ProcessingAgreementPage() {
  return (
    <>
      <h1>Accord de traitement des données</h1>
      <p>
        Cet accord est une annexe aux <Link href="/conditions">conditions d’utilisation et de vente</Link> et en fait partie : il est accepté avec elles. Il répond à l’article 28 du
        règlement général sur la protection des données (RGPD).
      </p>

      <h2>1. Qui fait quoi</h2>
      <p>
        Les photos, vidéos et messages vocaux que le client envoie à Edith peuvent montrer ou faire entendre d’autres personnes : ses clients, ses élèves, son équipe, des passants.
        Pour ces données, le client est le <strong>responsable du traitement</strong> : c’est lui qui décide de les filmer et de les publier. {company.name} ({company.address},{" "}
        {company.registration}), qui édite Edith, est son <strong>sous-traitant</strong> : il les traite pour le compte du client et sur ses instructions.
      </p>
      <p>
        Pour les données du client lui-même (son compte, ses conversations, son abonnement), {company.name} est responsable du traitement : voir la{" "}
        <Link href="/confidentialite">politique de confidentialité</Link>.
      </p>

      <h2>2. Le traitement</h2>
      <ul>
        <li>
          <strong>Finalité</strong> : préparer les contenus du client (Reels, carrousels, photos, légendes) et les publier sur ses comptes, quand il le demande. Rien d’autre : ni
          publicité, ni revente, ni entraînement d’un modèle par {company.name}.
        </li>
        <li>
          <strong>Opérations</strong> : stockage ; lecture automatique des vidéos et des photos par des modèles d’IA (ce qu’on y voit, les paroles) ; repérage de la position des
          visages, des mains et des corps image par image, pour placer les textes et les animations, sans jamais reconnaître qui que ce soit ; floutage à la demande ; montage ;
          publication.
        </li>
        <li>
          <strong>Données</strong> : l’image et la voix des personnes filmées, et ce que le client écrit sur elles dans ses demandes.
        </li>
        <li>
          <strong>Personnes concernées</strong> : les clients, élèves et membres de l’équipe du client, et toute personne visible ou audible dans ce qu’il envoie.
        </li>
        <li>
          <strong>Durée</strong> : les photos et vidéos envoyées sont supprimées 24 heures après la mise en ligne de la publication qui les utilise, ou 7 jours après leur envoi si
          aucune ne les utilise (jusqu’à 6 mois pour ses meilleures vidéos, gardées pour ses prochains Reels). Les contenus montés restent tant que le compte existe.
        </li>
      </ul>

      <h2>3. Les instructions du client</h2>
      <p>
        Les demandes du client à Edith (ses messages, les boutons qu’il touche, ses réglages dans l’application) sont ses instructions. {company.name} ne traite ces données que
        pour les suivre, et prévient le client si une instruction lui paraît contraire à la réglementation.
      </p>

      <h2>4. Confidentialité</h2>
      <p>
        Seules les personnes de l’équipe d’Edith qui en ont besoin pour faire fonctionner ou réparer le service y accèdent, et elles sont tenues à la confidentialité.
      </p>

      <h2>5. Sécurité</h2>
      <ul>
        <li>Données et fichiers hébergés en France (Paris), chiffrés pendant leur transport et stockés chiffrés par l’hébergeur.</li>
        <li>Chaque commerce ne voit que ses propres données ; les fichiers sont privés et ne s’ouvrent que par des liens temporaires.</li>
        <li>Connexion par WhatsApp, sans mot de passe, par des liens à usage unique et de courte durée.</li>
        <li>Les clés d’accès aux services ne quittent jamais nos serveurs.</li>
      </ul>

      <h2>6. Sous-traitants ultérieurs</h2>
      <p>
        Le client autorise {company.name} à faire appel aux prestataires listés dans la <Link href="/confidentialite">politique de confidentialité</Link> (hébergement, modèles
        d’IA, voix, messagerie, publication). Chacun est tenu à des obligations de protection équivalentes à celles de cet accord. Certains traitent des données hors de l’Union
        européenne ; ces transferts sont encadrés par les clauses contractuelles types de la Commission européenne ou un mécanisme reconnu équivalent. Tout nouveau prestataire
        est ajouté à cette liste avant d’être utilisé ; le client qui s’y oppose peut résilier son abonnement.
      </p>

      <h2>7. Les droits des personnes</h2>
      <p>
        C’est au client de répondre aux personnes qu’il filme. {company.name} l’y aide : flouter un visage, retirer une photo ou une vidéo, tout supprimer. Une demande qui nous
        arrive directement d’une de ces personnes est transmise au client.
      </p>

      <h2>8. En cas de violation de données</h2>
      <p>
        {company.name} prévient le client sans retard injustifié, et au plus tard 48 heures après en avoir eu connaissance, avec ce qu’il sait de ce qui s’est passé, des données
        touchées et de ce qui est fait. Il l’aide, autant que possible, à remplir ses propres obligations (notification à la CNIL, information des personnes).
      </p>

      <h2>9. Fin du traitement</h2>
      <p>
        Avant de partir, le client peut télécharger ses contenus montés. Quand il supprime son compte (en écrivant « Supprimer mes données » à Edith sur WhatsApp, ou dans
        Réglages › Mon compte), tout est supprimé aussitôt ; sinon, ses données sont supprimées 30 jours après la fin de son abonnement. Seules les factures sont conservées,
        comme la loi l’impose.
      </p>

      <h2>10. Contrôle</h2>
      <p>
        Sur demande à {company.email}, {company.name} fournit au client les informations nécessaires pour vérifier que cet accord est respecté. Le client peut aussi faire réaliser
        un audit, à ses frais, une fois par an au plus, en le prévenant 30 jours avant.
      </p>

      <h2>11. Les engagements du client</h2>
      <ul>
        <li>Avoir l’accord des personnes qu’il filme et les informer que leur image peut être publiée sur ses réseaux.</li>
        <li>Ne pas envoyer de données sensibles (santé, opinions, mineurs sans l’accord de leurs parents) dont Edith n’a pas besoin.</li>
        <li>Donner des instructions conformes à la réglementation.</li>
      </ul>
    </>
  );
}
