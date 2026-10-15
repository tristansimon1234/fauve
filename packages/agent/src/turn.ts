/**
 * Tools that close her message: buttons and cards under it, a reaction. Their
 * result tells the model nothing new, so asking it again after them only made
 * it write its answer a second time (« Samedi 17 octobre à 18 h, noté… » twice).
 */
export const CLOSING_TOOLS: ReadonlySet<string> = new Set(["reply_with", "react_to_message"]);

/**
 * True when a step of the tool loop ends the turn: it only calls closing tools,
 * which run without a new model call. Buttons with no word at all yet still go
 * back to the model, so it writes the message they sit under.
 */
export function endsTurn(tools: string[], hasSpoken: boolean): boolean {
  if (!tools.length || !tools.every((name) => CLOSING_TOOLS.has(name))) return false;
  return hasSpoken || !tools.includes("reply_with");
}
