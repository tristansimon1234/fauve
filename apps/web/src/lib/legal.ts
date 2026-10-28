// What the legal pages say about who runs Edith. The fields between brackets wait for the company
// (Tristan: no SIREN yet); once they are filled, `complete` is true and the pages go into the sitemap.
export const company = {
  name: "[Raison sociale]",
  /** Its legal form and capital, if any (« SAS au capital de 1 000 € », « Entrepreneur individuel »). */
  form: "[Forme juridique]",
  address: "[Adresse du siège]",
  registration: "[SIREN / RCS]",
  /** Intra-community VAT number, once there is one. */
  vat: "",
  email: "[email de contact]",
  /** Who answers for what the site publishes (LCEN, art. 6). */
  publisher: "[Directeur de la publication]",
  updatedAt: "28 octobre 2026",
};

/** True once the company's details are filled in (no « [ » placeholder left). */
export const complete = ![company.name, company.form, company.address, company.registration, company.email, company.publisher].some((v) => v.includes("["));

/** The site's host (LCEN): where the pages and the server run. The data is stored by Supabase in Paris. */
export const host = {
  name: "Vercel Inc.",
  address: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
  site: "vercel.com",
};

/**
 * The version of the terms she accepts by going on (kept on the studio with the date, studios.terms_*).
 * Changed when the terms change in a way that matters: the next ones are shown again.
 */
export const TERMS_VERSION = "2026-10-28";

/** What Edith adds under her first WhatsApp message to someone new: going on accepts the terms. */
export const TERMS_LINE = "En continuant, tu acceptes les conditions d’utilisation et la politique de confidentialité d’Edith : edith-ai.app/conditions";
