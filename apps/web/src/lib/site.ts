// The public address of the landing, for search engines and link previews (canonical links, sitemap,
// robots, structured data). The app itself reads APP_URL; this one never changes with the deployment.
export const SITE_URL = "https://edith-ai.app";

// Pages a search engine has no reason to visit: the app behind login, the pages a link opens,
// and the server routes.
export const PRIVATE_PATHS = [
  "/api/",
  "/auth/",
  "/l/",
  "/v/",
  "/depot",
  "/voix",
  "/merci",
  "/essai",
  "/abonnement",
  "/fauve",
  "/calendrier",
  "/publications",
  "/grille",
  "/mediatheque",
  "/composants",
  "/resultats",
  "/style",
  "/reglages",
];
