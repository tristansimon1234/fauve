import type { ToolName } from "./tools.ts";

// What the app shows while Fauve works, one line per tool she calls (« Je
// regarde ton calendrier… »). null: nothing to show (buttons, reactions). A
// Record over every tool name: a new tool cannot ship without its line.

export const TOOL_STATUS: Record<ToolName, string | null> = {
  get_studio_context: "Je relis ton profil…",
  update_onboarding: "Je note ça…",
  read_website: "Je lis ton site…",
  get_connect_link: "Je prépare le lien de connexion…",
  get_post_link: "Je prépare le lien…",
  get_calendar: "Je regarde ton calendrier…",
  create_post: "J’ajoute la publication…",
  update_post: "Je mets la publication à jour…",
  request_content: "J’ajoute ça à ta liste « À filmer »…",
  analyze_clips: "Je regarde tes vidéos…",
  quote_montage: "Je prépare le montage et son prix…",
  montage_status: "Je regarde où en est le montage…",
  choose_version: "Je remets cette version…",
  montage: "Je lance le montage…",
  create_edit_plan: "J’écris le plan de montage…",
  render: "Je lance le rendu…",
  write_on_photos: "J’écris sur tes photos…",
  list_text_layers: "Je regarde les styles de texte…",
  apply_text_layer: "Je pose le texte…",
  design_text_layer: "Je prépare le dessin du texte…",
  retouch_photos: "Je prépare la retouche…",
  blur_video: "Je prépare le floutage…",
  copy_text_style: "J’étudie ton exemple…",
  style_texts: "Je change le style des textes…",
  schedule_post: "Je programme la publication…",
  get_instagram_activity: "Je regarde ton Instagram…",
  analyze_performance: "J’analyse ce qui marche…",
  reply_to_comment: "Je réponds au commentaire…",
  get_metrics: "Je regarde les chiffres…",
  update_brand_profile: "Je mets ton style à jour…",
  reply_with: null,
  react_to_message: null,
};
