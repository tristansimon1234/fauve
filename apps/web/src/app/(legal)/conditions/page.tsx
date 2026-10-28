import { CREDIT_PACK, PLAN_ORDER, PLANS, reelsPerMonth } from "@fauve/agent";
import type { Metadata } from "next";
import Link from "next/link";
import { company } from "@/lib/legal";

export const metadata: Metadata = { title: "Conditions d’utilisation et de vente", alternates: { canonical: "/conditions" } };

// The terms of use and of sale, in plain words: what Edith does, what the client keeps, what is paid
// and how it stops. Edith is a professional service (businesses, independents), sold by subscription.

export default function TermsPage() {
  return (
    <>
      <h1>Conditions d’utilisation et de vente</h1>
      <p>
        Ces conditions encadrent l’utilisation d’Edith et son abonnement. Edith est édité par {company.name}, {company.form}, dont le siège est {company.address}, immatriculée sous le
        numéro {company.registration}
        {company.vat ? `, TVA ${company.vat}` : ""} (« nous »). Elles s’appliquent à toute personne qui utilise Edith pour son activité (« le client ») : en continuant après les avoir
        vues, sur WhatsApp, dans l’application ou au moment de payer, le client les accepte.
      </p>

      <h2>1. Le service</h2>
      <p>
        Edith est un community manager fondé sur l’intelligence artificielle, sur WhatsApp et dans une application web. À partir des photos, vidéos, messages et vocaux que le client
        lui envoie, il prépare des publications pour Instagram et TikTok : montage des vidéos, textes, légendes, carrousels, voix off, musique ; il les publie quand le client le
        demande, lui rappelle le bon moment pour publier et lui montre ses résultats. Edith est une IA et le dit toujours : il ne se fait jamais passer pour une personne.
      </p>
      <p>
        Edith est réservé aux professionnels : commerces, indépendants et entreprises qui l’utilisent pour leur activité. En l’utilisant, le client confirme agir dans ce cadre.
      </p>

      <h2>2. Rien n’est publié sans le client</h2>
      <p>
        Aucune publication ne part sans l’accord du client, donné par un message ou un bouton (« Oui, publie-le », « Publier »). Rien ne part tout seul à une heure prévue : Edith
        fait signe au moment choisi, et le client décide. Le client relit ce qu’il valide et en reste responsable, ainsi que des comptes Instagram et TikTok qu’il relie.
      </p>

      <h2>3. Les contenus du client</h2>
      <ul>
        <li>Le client garde la propriété de ses photos, vidéos, textes, logo et voix. Il nous autorise à les traiter, les modifier et les héberger le temps nécessaire au service.</li>
        <li>
          Il garantit en avoir les droits, et avoir l’accord des personnes qui y apparaissent (clients, élèves, équipe). Edith peut flouter un visage à sa demande.
        </li>
        <li>
          Un Reel envoyé en exemple (son lien ou sa vidéo) ne sert qu’à en reprendre la forme pour un Reel du client : ni ses images ni ses mots ne sont repris, et la vidéo n’est
          pas gardée.
        </li>
        <li>Aucune musique protégée n’est ajoutée : la musique des Reels est composée pour eux. Un son tendance s’ajoute dans l’application du réseau social.</li>
        <li>
          Les contenus préparés par Edith pour le client (montages, textes, carrousels) lui appartiennent une fois livrés, sans redevance, pour toute utilisation liée à son activité.
        </li>
      </ul>

      <h2>4. La voix du client</h2>
      <p>
        Le client peut faire cloner sa propre voix pour raconter ses Reels. Il ne le fait qu’avec sa voix à lui, et l’accepte expressément avant le clonage. L’enregistrement est
        supprimé dès que la voix est clonée ; la voix clonée ne sert qu’aux Reels du client, et il peut la supprimer à tout moment (Style › Voix off), ce qui l’efface aussi chez
        notre prestataire.
      </p>

      <h2>5. Contenus faits par l’IA</h2>
      <p>
        Les textes, montages, voix et images sont produits par des modèles d’intelligence artificielle. Ils peuvent contenir des erreurs ou des imprécisions : Edith n’invente pas
        de prix, d’horaires ou d’avis, mais le client relit avant de publier. Edith ne garantit aucun résultat d’audience, d’abonnés ou de réservations.
      </p>

      <h2>6. Offres, prix et crédits</h2>
      <p>Edith s’utilise avec un abonnement mensuel, sans engagement et sans période d’essai :</p>
      <ul>
        {PLAN_ORDER.map((id) => (
          <li key={id}>
            {PLANS[id].label} : {PLANS[id].priceEur} € TTC par mois, {PLANS[id].credits} crédits à chaque renouvellement (environ {reelsPerMonth(id)} Reels soignés par mois).
          </li>
        ))}
        <li>
          « {CREDIT_PACK.label} » : {CREDIT_PACK.credits} crédits pour {CREDIT_PACK.priceEur} € TTC, en paiement unique, pour un abonnement en cours.
        </li>
      </ul>
      <p>
        Les crédits paient le travail d’Edith (montages, corrections, carrousels composés, images). Le prix d’un montage dépend de ce qu’il a vraiment demandé, entre un minimum et
        un maximum indiqués à son lancement ; le message de livraison dit combien il a utilisé et ce qu’il reste. Un montage qui échoue n’est pas débité. La conversation avec Edith,
        les textes sur photos, la retouche, les changements faits à la main et les bilans ne coûtent aucun crédit.
      </p>
      <p>
        À chaque renouvellement, le solde est remis aux crédits de l’offre ; les crédits achetés en plus qui restent passent au mois suivant, une fois. Les crédits n’ont pas de
        valeur monétaire et ne sont ni remboursés ni échangés.
      </p>

      <h2>7. Paiement, changement d’offre et résiliation</h2>
      <p>
        Le paiement se fait par carte, via Stripe, au début de chaque période mensuelle. Le client peut passer à l’offre au-dessus à tout moment : la différence du mois en cours est
        facturée au prorata et ses crédits en plus arrivent aussitôt. Il peut changer de carte ou arrêter son abonnement à tout moment (Réglages › Abonnement et crédits, ou en
        écrivant à {company.email}) : l’arrêt prend effet à la fin de la période payée, sans remboursement de la période en cours. Un paiement refusé suspend la fabrication de
        nouveaux contenus jusqu’à sa régularisation.
      </p>
      <p>
        Nous pouvons changer nos prix pour l’avenir : un abonnement en cours garde son prix jusqu’à ce que nous prévenions le client au moins 30 jours avant, et il peut alors arrêter
        avant que le nouveau prix s’applique.
      </p>

      <h2>8. Bonne utilisation</h2>
      <p>
        Le client n’utilise pas Edith pour publier des contenus illicites, trompeurs, haineux, ou qui portent atteinte aux droits d’autrui, ni pour cloner la voix d’une autre
        personne. Nous pouvons suspendre un compte qui ne respecte pas ces conditions ou qui met le service en danger, après l’avoir prévenu sauf urgence.
      </p>

      <h2>9. Disponibilité et responsabilité</h2>
      <p>
        Edith dépend de services tiers (WhatsApp, Instagram, TikTok, prestataires d’IA, hébergement). Nous faisons de notre mieux pour qu’il fonctionne en continu, sans pouvoir
        le garantir : une publication peut être retardée ou refusée par un réseau social. Notre responsabilité est limitée aux dommages directs et, au total, aux sommes payées par
        le client sur les douze derniers mois.
      </p>

      <h2>10. Données personnelles</h2>
      <p>
        Voir la <Link href="/confidentialite">politique de confidentialité</Link> et la <Link href="/suppression-des-donnees">suppression des données</Link>.
      </p>

      <h2>11. Changements de ces conditions</h2>
      <p>
        Nous pouvons faire évoluer ces conditions. Un changement important est annoncé au client avant de s’appliquer ; s’il continue d’utiliser Edith ensuite, il l’accepte.
      </p>

      <h2>12. Droit applicable</h2>
      <p>
        Ces conditions sont soumises au droit français. En cas de désaccord, nous cherchons d’abord une solution amiable ({company.email}) ; à défaut, les tribunaux compétents sont
        ceux du ressort de notre siège.
      </p>
    </>
  );
}
