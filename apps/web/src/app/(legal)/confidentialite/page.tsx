import type { Metadata } from "next";
import { company } from "@/lib/legal";

export const metadata: Metadata = { title: "Politique de confidentialité" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Politique de confidentialité</h1>
      <p>
        Simone est un assistant IA qui gère les réseaux sociaux des commerces de quartier (studios, salons, restaurants, boutiques), principalement
        depuis WhatsApp. Cette page explique quelles données nous traitons, pourquoi, et quels sont tes droits.
      </p>

      <h2>Responsable du traitement</h2>
      <p>
        {company.name}, {company.address} ({company.registration}). Contact : {company.email}.
      </p>

      <h2>Données traitées</h2>
      <ul>
        <li>Identité et contact : numéro de téléphone WhatsApp, prénom, nom du studio.</li>
        <li>Conversations avec Simone (WhatsApp et web app) et les fichiers envoyés : vidéos, photos, messages vocaux.</li>
        <li>Contenus préparés : légendes, plans de montage, vidéos montées, calendrier de publication.</li>
        <li>Comptes Instagram et TikTok connectés et leurs statistiques (vues, portée, interactions, réservations attribuées).</li>
        <li>Données techniques : journaux de connexion, sessions, coûts de traitement.</li>
      </ul>
      <p>
        Les vidéos peuvent montrer des clients ou l’équipe du commerce. Le commerce s’engage à recueillir leur accord avant de nous les
        transmettre ; Simone propose des cadrages sans visage et peut flouter les visages.
      </p>

      <h2>Finalités et bases légales</h2>
      <ul>
        <li>Fournir le service (préparer, faire valider et publier les contenus, envoyer les relances et les bilans) : exécution du contrat.</li>
        <li>Connexion sécurisée par code WhatsApp : exécution du contrat et sécurité.</li>
        <li>Amélioration du service et suivi des coûts : intérêt légitime.</li>
        <li>Facturation et obligations comptables : obligation légale.</li>
      </ul>
      <p>Nous ne vendons aucune donnée et ne faisons pas de publicité ciblée avec tes données.</p>

      <h2>Sous-traitants</h2>
      <ul>
        <li>Supabase (base de données et fichiers) : hébergement en France (Paris).</li>
        <li>Vercel (hébergement du site et des traitements) : exécution en France (Paris).</li>
        <li>Meta Platforms (WhatsApp Business) : messagerie.</li>
        <li>Anthropic (modèle d’IA Claude) : rédaction, planification et plans de montage.</li>
        <li>Google (modèle d’IA Gemini) : lecture des vidéos et des photos, images par IA.</li>
        <li>ElevenLabs : voix off, lecture des messages vocaux et musique des Reels.</li>
        <li>TypeSafe : choix de la réaction de Simone aux messages écrits dans l’application.</li>
        <li>Meta Platforms (Instagram) et TikTok : publication sur tes comptes, à ta demande.</li>
        <li>Stripe : paiement de l’abonnement.</li>
      </ul>
      <p>
        Certains de ces prestataires peuvent traiter des données hors de l’Union européenne ; ces transferts sont encadrés
        par les clauses contractuelles types de la Commission européenne ou un mécanisme équivalent.
      </p>

      <h2>Durées de conservation</h2>
      <ul>
        <li>Données du studio, conversations et médias : pendant l’abonnement, puis supprimées sous 30 jours après la résiliation.</li>
        <li>Photos et vidéos envoyées : supprimées 24 h après la mise en ligne de la publication qui les utilise, ou 7 jours après leur envoi si aucune ne les utilise (jusqu’à 6 mois pour les meilleures vidéos, gardées pour tes prochains Reels).</li>
        <li>Codes et liens de connexion : à usage unique, 15 minutes maximum (24 heures pour le lien d’une publication envoyé sur WhatsApp).</li>
        <li>Factures : 10 ans (obligation légale).</li>
      </ul>

      <h2>Tes droits</h2>
      <p>
        Tu peux demander l’accès, la rectification, l’effacement, la portabilité ou la limitation de tes données, et
        t’opposer à certains traitements, en écrivant à {company.email} ou directement à Simone sur WhatsApp. Voir aussi{" "}
        <a href="/suppression-des-donnees">la suppression des données</a>. Tu peux introduire une réclamation auprès de la
        CNIL (cnil.fr).
      </p>
    </>
  );
}
