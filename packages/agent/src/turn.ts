/**
 * Tools that close her message: buttons and cards under it, a reaction. Their
 * result tells the model nothing new, so asking it again after them only made
 * it write its answer a second time (« Samedi 17 octobre à 18 h, noté… » twice).
 */
export const CLOSING_TOOLS: ReadonlySet<string> = new Set(["reply_with", "react_to_message"]);

/**
 * True when a step of the tool loop ends the turn: it only calls closing tools,
 * which run without a new model call, and it carries her words itself. Buttons
 * or a reaction alone still go back to the model: words from an earlier step are
 * often only a preamble (« Je regarde tes vidéos… »), the answer is still to come.
 */
export function endsTurn(tools: string[], stepSpeaks: boolean): boolean {
  if (!tools.length || !tools.every((name) => CLOSING_TOOLS.has(name))) return false;
  return stepSpeaks;
}
