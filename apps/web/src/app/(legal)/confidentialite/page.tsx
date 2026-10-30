import type { Metadata } from "next";
import Link from "next/link";
import { company } from "@/lib/legal";

export const metadata: Metadata = { title: "Politique de confidentialité", alternates: { canonical: "/confidentialite" } };

export default function PrivacyPage() {
  return (
    <>
      <h1>Politique de confidentialité</h1>
      <p>
        Edith est un community manager fondé sur l’intelligence artificielle, pour les commerces et les indépendants, sur WhatsApp et dans une application web. Cette page dit
        quelles données nous traitons, pourquoi, avec qui, combien de temps, et quels sont tes droits.
      </p>

      <h2>Responsable du traitement</h2>
      <p>
        {company.name}, {company.address} ({company.registration}). Contact : {company.email}.
      </p>

      <h2>Données traitées</h2>
      <ul>
        <li>Identité et contact : numéro de téléphone WhatsApp, prénom, nom et activité du commerce, son site et son lien de réservation.</li>
        <li>Conversations avec Edith (WhatsApp et application) et les fichiers envoyés : photos, vidéos, messages vocaux, captures.</li>
        <li>Ce qu’Edith prépare : légendes, plans de montage, vidéos montées, carrousels, voix off, musique, et ce qu’il retient de ton commerce (sa mémoire, ton style).</li>
        <li>
          Ta voix, si tu choisis de la faire cloner : l’enregistrement que tu fais pour cela, puis la voix clonée. Elle ne sert qu’à raconter tes Reels, avec ton accord exprès.
        </li>
        <li>Comptes Instagram et TikTok reliés : leur identifiant, leur jeton d’accès, leurs publications et leurs statistiques (vues, abonnés, visites, interactions).</li>
        <li>Abonnement : offre, statut de paiement et identifiant client chez Stripe. Nous ne voyons jamais ton numéro de carte.</li>
        <li>Données techniques : sessions de connexion, journaux, coûts de traitement.</li>
      </ul>
      <p>
        Les vidéos peuvent montrer des clients ou l’équipe du commerce : tu t’engages à avoir leur accord avant de nous les envoyer. Pour ces personnes, c’est toi le responsable du
        traitement et nous ton sous-traitant (voir l’<Link href="/sous-traitance">accord de traitement des données</Link>). Edith peut flouter un visage à ta demande.
        Pour placer ses textes et ses animations, Edith repère dans tes vidéos les visages, les mains et les corps (leur position, image par image) : ce repérage ne sert pas à
        reconnaître qui que ce soit et reste attaché à la vidéo.
      </p>

      <h2>Finalités et bases légales</h2>
      <ul>
        <li>Fournir le service (préparer, faire valider et publier tes contenus, te faire signe, te montrer tes résultats) : exécution du contrat.</li>
        <li>Cloner ta voix : ton consentement, que tu peux retirer à tout moment en supprimant ta voix.</li>
        <li>Connexion sécurisée par WhatsApp : exécution du contrat et sécurité.</li>
        <li>Prévenir les abus (limite de messages, nouveaux numéros) et suivre nos coûts : intérêt légitime.</li>
        <li>Facturation et obligations comptables : obligation légale.</li>
      </ul>
      <p>Nous ne vendons aucune donnée et ne faisons pas de publicité ciblée avec tes données.</p>

      <h2>Sous-traitants</h2>
      <ul>
        <li>Supabase (base de données et fichiers) : hébergement en France (Paris).</li>
        <li>Vercel (site, traitements et ateliers de rendu des vidéos) : exécution en France (Paris).</li>
        <li>Meta Platforms (WhatsApp Business) : messagerie.</li>
        <li>Anthropic (modèles Claude) : conversation, plans, montages, textes.</li>
        <li>Google (modèles Gemini) : lecture des vidéos et des photos, images par IA.</li>
        <li>ElevenLabs : voix off, clonage de ta voix si tu le demandes, lecture des messages vocaux, musique des Reels.</li>
        <li>TypeSafe : choix de la réaction d’Edith aux messages écrits dans l’application.</li>
        <li>Treg : récupération de la vidéo d’un Reel Instagram que tu envoies en exemple, par son lien.</li>
        <li>Meta Platforms (Instagram) et TikTok : publication sur tes comptes et lecture de leurs statistiques, à ta demande.</li>
        <li>Stripe : paiement de l’abonnement.</li>
      </ul>
      <p>
        Certains de ces prestataires peuvent traiter des données hors de l’Union européenne ; ces transferts sont encadrés par les clauses contractuelles types de la Commission
        européenne ou un mécanisme équivalent.
      </p>

      <h2>Durées de conservation</h2>
      <ul>
        <li>Compte, conversations, contenus préparés et statistiques : pendant l’abonnement, puis supprimés 30 jours après sa fin. Un compte qui ne s’abonne pas est supprimé 30 jours après son dernier message. À ta demande, tout est supprimé aussitôt.</li>
        <li>
          Photos et vidéos envoyées : supprimées 24 h après la mise en ligne de la publication qui les utilise, ou 7 jours après leur envoi si aucune ne les utilise (jusqu’à 6 mois
          pour tes meilleures vidéos, gardées pour tes prochains Reels). Les photos de ton site restent tant que ton compte existe.
        </li>
        <li>Enregistrement fait pour cloner ta voix : supprimé dès que la voix est clonée. Voix clonée : jusqu’à ce que tu la supprimes, ou que ton compte soit supprimé.</li>
        <li>Reel envoyé en exemple : seule sa lecture (sa forme, son rythme) est gardée ; sa vidéo est supprimée une fois lue.</li>
        <li>Liens de connexion envoyés par Edith : à usage unique, 15 minutes à 24 heures selon leur usage.</li>
        <li>Factures : 10 ans (obligation légale).</li>
      </ul>

      <h2>Tes droits</h2>
      <p>
        Tu peux demander l’accès, la rectification, l’effacement, la portabilité ou la limitation de tes données, et t’opposer à certains traitements, en écrivant à {company.email}{" "}
        ou directement à Edith sur WhatsApp. Voir aussi <Link href="/suppression-des-donnees">la suppression des données</Link>. Tu peux introduire une réclamation auprès de la
        CNIL (cnil.fr).
      </p>
    </>
  );
}
