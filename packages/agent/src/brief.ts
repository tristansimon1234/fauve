import { z } from "zod";

// Simone's brief before she makes something (Tristan: « simone part trop vite en production »,
// « elle pose pas assez de question et le form non plus »): like a community manager, she asks
// what changes the result and that she does not know yet, a few questions at most, each with
// answers to tap. The chat asks them in a card under her message (reply_with questions), the
// Créer screen before « C'est parti »; her answers join her request, which the editor, the voice
// over and the carousel designer read.

/** A few questions at most: a brief, not a form. */
export const MAX_BRIEF_QUESTIONS = 3;
/** Her own words for an answer. */
export const MAX_BRIEF_ANSWER = 200;

export const briefQuestionSchema = z.object({
  question: z.string().trim().min(3).max(100).describe("Courte, dans ses mots à elle"),
  answers: z.array(z.string().trim().min(1).max(48)).min(2).max(4).describe("Les réponses les plus probables, concrètes, la plus probable d'abord"),
});
export type BriefQuestion = z.infer<typeof briefQuestionSchema>;
export const briefQuestionsSchema = z.array(briefQuestionSchema).min(1).max(MAX_BRIEF_QUESTIONS);

/** Her answer to one question: empty when she leaves it to Simone. */
export type BriefAnswer = { question: string; answer: string };

/** What a brief needs and how to ask it: in Simone's chat prompt and in the Créer question writer's. */
export const BRIEF_GUIDE = `Ton brief avant de produire : une bonne community manager ne se lance pas sans savoir ce que la publication doit faire pour le commerce. Ce qui change le résultat, à peu près dans cet ordre :
- à quoi elle sert : faire réserver ou faire venir, faire découvrir le lieu, l'équipe ou une prestation, annoncer une nouveauté ou un événement, montrer un savoir-faire ou un résultat, donner un conseil, ou juste l'ambiance ;
- son message et ses mots exacts : l'offre, le prix, la date, le nom du cours, du plat ou du produit. Jamais une offre ni un prix qu'elle n'a pas choisis pour cette publication, même lus sur son site ou gardés en mémoire : propose-les en réponse (« La séance découverte à 40 € »), elle dit oui ou non ;
- la fin : ce que les gens doivent faire après (réserver par le lien en bio, passer, appeler, écrire en message, enregistrer, partager) ;
- pour un effet, un univers ou une animation précise qu'elle demande : le moment ou le geste où il arrive, ce qui apparaît, les mots qu'on y lit, et s'il reste un message à la fin ;
- pour un Reel, quand ce n'est pas déjà choisi : une voix qui raconte, du texte à l'écran, ou juste ses images et la musique.
Ne demande que ce qui manque et change vraiment le résultat : jamais ce qu'elle a déjà dit ou choisi, ce que tu sais déjà (mémoire, contexte) ni ce que montrent ses fichiers ; jamais de question technique (musique, police, couleurs, transitions, durée, nombre d'animations, niveau de soin) : ça, c'est ton métier. Au plus ${MAX_BRIEF_QUESTIONS} questions, en une seule fois. Chacune courte, dans ses mots à elle, avec 2 à 4 réponses à toucher : concrètes, tirées de ce que tu sais d'elle (son activité, son offre, ses fichiers), la plus probable d'abord ; elle peut aussi répondre avec ses mots ou te laisser choisir.`;

/** The Créer screen's question writer: her files, what she imagines and what the screen already chose. */
export const BRIEF_QUESTIONS_PROMPT = `Tu es Simone, la community manager d'un commerce de quartier. La gérante vient de choisir ses photos et ses vidéos sur l'écran « Créer » de l'app, et elle a peut-être écrit ce qu'elle imagine. Avant de fabriquer sa publication, tu lui poses les quelques questions qui changent le résultat.

${BRIEF_GUIDE}

Ce que l'écran lui a déjà fait choisir (deja_choisi : le format, la voix off, le style, le jour et les réseaux) ne se redemande jamais : chacun a sa ligne sur l'écran.

Tu reçois son commerce (activite, nom, memoire : ce que tu en sais), ce qu'elle imagine (demande, peut-être vide), ses fichiers (combien de vidéos et de photos, et ce qu'on y voit quand tu les as déjà regardés) et ce qui est déjà choisi.

Réponds avec tes questions (questions), 1 à ${MAX_BRIEF_QUESTIONS}, dans l'ordre où elle y penserait ; aucune seulement quand sa demande dit déjà tout ce qui compte (à quoi sert la publication, son message avec ses mots exacts, la fin). Tutoie-la, chaleureuse et simple, sans deviner son genre (aucun accord qui la concerne). Pas d'emoji.`;

export const briefWriterSchema = z.object({ questions: z.array(briefQuestionSchema).max(MAX_BRIEF_QUESTIONS) });

/** When the question writer fails: what any publication needs, what it is for and how it ends. */
export function fallbackQuestions(reel: boolean): BriefQuestion[] {
  return [
    { question: reel ? "C’est pour quoi, ce Reel ?" : "C’est pour quoi, cette publication ?", answers: ["Faire réserver", "Faire découvrir", "Annoncer une nouveauté", "Juste l’ambiance"] },
    { question: "Ce que les gens doivent faire après ?", answers: ["Réserver", "Passer nous voir", "Nous suivre"] },
  ];
}

/** Her answers, one per line (« C'est pour quoi, ce Reel ? Faire réserver »); a question left open: Simone chooses. */
export function answersText(answers: BriefAnswer[]): string {
  return answers.map((a) => `${a.question.trim()} ${a.answer.trim().slice(0, MAX_BRIEF_ANSWER) || "Choisis pour moi."}`).join("\n");
}

/** Where a message has no card (WhatsApp, Instagram): the questions with their answers, to answer in one message. One question: its answers are the buttons, when they fit. */
export function questionsAsText(questions: BriefQuestion[]): { text: string; options?: string[] } {
  const only = questions.length === 1 ? questions[0] : undefined;
  if (only && only.answers.length <= 3 && only.answers.every((a) => a.length <= 20)) return { text: only.question, options: only.answers };
  const numbered = questions.map((q, i) => `${questions.length > 1 ? `${i + 1}. ` : ""}${q.question}\n${q.answers.join(" · ")}`);
  return { text: [...numbered, questions.length > 1 ? "Réponds-moi en un message, comme ça te vient." : ""].filter(Boolean).join("\n\n") };
}

/** The card under Simone's message, as the model reads its conversation back. */
export function questionsMemo(questions: BriefQuestion[]): string {
  return `[questions dans une carte : ${questions.map((q, i) => `${i + 1}. ${q.question} (${q.answers.join(" / ")})`).join(" ")}]`;
}
