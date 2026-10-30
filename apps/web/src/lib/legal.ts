// What the legal pages say about who runs Edith. The fields between brackets wait for the company;
// once they are filled, `complete` is true and the pages go into the sitemap. Its registration
// (formality J00296131972) was validated by INSEE on 30 October 2026: a micro-entreprise, under the
// VAT threshold (franchise en base de TVA, art. 293 B du CGI), so no VAT is charged.
export const company = {
  name: "Tristan Simon",
  /** Its legal form and capital, if any (« SAS au capital de 1 000 € », « Entrepreneur individuel »). */
  form: "entrepreneur individuel (micro-entreprise)",
  address: "59 rue de Ponthieu, 75008 Paris",
  registration: "SIREN 904 467 578",
  /** Its establishment (SIREN + NIC 00038), asked by banks and Stripe; shown in the legal notice. */
  siret: "904 467 578 00038",
  /** Intra-community VAT number, once there is one. */
  vat: "",
  email: "contact@edith-ai.app",
  /** Who answers for what the site publishes (LCEN, art. 6). */
  publisher: "Tristan Simon",
  updatedAt: "30 octobre 2026",
};

/** Under the VAT threshold (franchise en base): prices are net, and every invoice says why (CGI, art. 242 nonies A). */
export const VAT_EXEMPTION = company.vat ? null : "TVA non applicable, art. 293 B du CGI";

/** What follows a price: « TTC » once VAT is charged; nothing before, since no VAT is included. */
export const priceTax = company.vat ? " TTC" : "";

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
export const TERMS_VERSION = "2026-10-29";

/** What Edith adds under her first WhatsApp message to someone new: going on accepts the terms. */
export const TERMS_LINE = "En continuant, tu acceptes les conditions d’utilisation et la politique de confidentialité d’Edith : edith-ai.app/conditions";
